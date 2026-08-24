-- Pavti Pustak — migration 14
-- Let a contribution be paid in instalments.
-- Run in Supabase Dashboard > SQL Editor after 13.
--
-- A contributor who agrees to ₹1000 and hands over ₹500 today is one
-- contribution, not two: one receipt number, one document, issued once the
-- whole amount is in. `amount` stays the agreed contribution and `paid_amount`
-- records how much of it has arrived.
--
-- The two derived quantities, which every money figure in the app must use:
--
--   received    = payment_status = 'Paid' ? amount : coalesce(paid_amount, 0)
--   outstanding = payment_status = 'Paid' ? 0      : amount - coalesce(paid_amount, 0)
--
-- They are written as generated columns rather than repeated in each view, so
-- the rule lives in one place and a view cannot drift from it.
--
-- Deliberately backward compatible: for every existing row paid_amount is
-- null, so a Paid row still reports received = amount and an untouched pledge
-- still reports outstanding = amount. No historical figure moves.

alter table public.receipts
  add column if not exists paid_amount numeric(12, 2);

alter table public.receipts
  drop constraint if exists receipts_paid_amount_range;

-- Not more than the contribution (the remainder would go negative and the
-- reminder would chase a refund), not negative, and meaningless on a settled
-- receipt — there the whole amount is received and a leftover partial figure
-- would be a second, contradictory record of the same money.
alter table public.receipts
  add constraint receipts_paid_amount_range
  check (
    paid_amount is null
    or (
      paid_amount >= 0
      and paid_amount <= amount
      and payment_status = 'Unpaid'
    )
  );

-- `if not exists` rather than drop-and-recreate: the views below select these
-- columns, so once this file has run a second run cannot drop them ("cannot
-- drop column amount_received because other objects depend on it") and the
-- whole migration would fail. Changing either formula later therefore needs a
-- `drop ... cascade` and a rebuild of the four views, deliberately.
alter table public.receipts
  add column if not exists amount_received numeric(12, 2)
  generated always as (
    case when payment_status = 'Paid' then amount else coalesce(paid_amount, 0) end
  ) stored;

alter table public.receipts
  add column if not exists amount_outstanding numeric(12, 2)
  generated always as (
    case
      when payment_status = 'Paid' then 0
      else greatest(amount - coalesce(paid_amount, 0), 0)
    end
  ) stored;

create index if not exists receipts_outstanding_idx
  on public.receipts (due_on)
  where payment_status = 'Unpaid';

-- Money in the box, by day -------------------------------------------
-- The Paid-only filter has to go: a part-paid row is Unpaid, and excluding it
-- would report ₹0 collected on a day money was actually taken. The counts stay
-- restricted to rows that contributed something, so a pledge recorded today
-- does not inflate the day's receipt count.
create or replace view public.receipt_daily_totals
with (security_invoker = on) as
select
  collection_date,
  sum(amount_received)::numeric(14, 2) as total,
  sum(case when payment_method = 'Cash' then amount_received else 0 end)::numeric(14, 2)
    as cash,
  sum(case when payment_method = 'UPI' then amount_received else 0 end)::numeric(14, 2)
    as upi,
  count(*) filter (where amount_received > 0)::integer as receipt_count,
  count(distinct lower(trim(donor_name)))
    filter (where amount_received > 0)::integer as donor_count
from public.receipts
group by collection_date;

-- Credit follows the money received, not the promise -------------------
create or replace view public.volunteer_totals
with (security_invoker = on) as
select
  coalesce(created_by_email, 'unknown') as volunteer,
  sum(amount_received)::numeric(14, 2) as total,
  count(*) filter (where amount_received > 0)::integer as receipt_count,
  min(collection_date) as first_collection,
  max(collection_date) as last_collection
from public.receipts
where amount_received > 0
group by coalesce(created_by_email, 'unknown');

-- What is still owed --------------------------------------------------
-- `outstanding > 0` rather than `payment_status = 'Unpaid'`: once the last
-- instalment lands the app flips the row to Paid, but guarding on the remainder
-- means a row can never appear in the reminder list owing ₹0.
create or replace view public.pledge_totals
with (security_invoker = on) as
select
  coalesce(sum(amount_outstanding), 0)::numeric(14, 2) as expected,
  count(*)::integer as pledge_count,
  coalesce(
    sum(
      case when due_on <= public.mandal_today() then amount_outstanding else 0 end
    ), 0
  )::numeric(14, 2) as due_now,
  count(*) filter (where due_on = public.mandal_today())::integer as due_today,
  count(*) filter (where due_on < public.mandal_today())::integer as overdue
from public.receipts
where amount_outstanding > 0;

-- Autocomplete lifetime total ----------------------------------------
-- Rebuilt from the 13 body. donor_name_mr stays LAST for the same reason it
-- was put there: `create or replace view` may only append columns, so the
-- existing order cannot be disturbed. A donor who has only ever part-paid must
-- still be findable, so the Paid-only filter becomes received > 0.
create or replace view public.donor_directory
with (security_invoker = on) as
select distinct on (lower(trim(donor_name)))
  trim(donor_name) as donor_name,
  phone_number,
  sum(amount_received) over (partition by lower(trim(donor_name)))::numeric(14, 2)
    as lifetime_total,
  count(*) over (partition by lower(trim(donor_name)))::integer as receipt_count,
  max(collection_date) over (partition by lower(trim(donor_name))) as last_collection,
  donor_name_mr
from public.receipts
where amount_received > 0
order by lower(trim(donor_name)), collection_date desc, receipt_number desc;

-- Verify -------------------------------------------------------------
select
  (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'receipts'
      and column_name in ('paid_amount', 'amount_received', 'amount_outstanding')
  ) as columns_added,              -- expect 3
  (select coalesce(sum(amount_received), 0) from public.receipts) as collected,
  (select coalesce(sum(amount_outstanding), 0) from public.receipts) as still_owed,
  (select count(*) from public.receipts where paid_amount is not null)
    as part_paid_rows;
