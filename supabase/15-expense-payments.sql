-- Pavti Pustak — migration 15
-- An expense can be committed but not yet paid, and can be paid in instalments.
-- Run in Supabase Dashboard > SQL Editor after 14.
--
-- The mirror image of migrations 10 and 14 on the receipts side, and
-- deliberately the same shape so there is one rule to learn rather than two:
--
--   amount      the agreed bill
--   paid_amount how much of it has actually gone out (only while Unpaid)
--   amount_paid   = payment_status = 'Paid' ? amount : coalesce(paid_amount, 0)
--   amount_unpaid = payment_status = 'Paid' ? 0      : amount - coalesce(paid_amount, 0)
--
-- Why it matters here: the dashboard balance is collected minus spent. Before
-- this, recording a ₹20,000 mandap bill the day it was agreed subtracted the
-- whole amount from the balance on that date, even though nothing had left the
-- box. A half-paid bill did the same. Spending now counts money actually paid
-- out, and what is still owed to a vendor is reported separately.
--
-- Backward compatible by construction: every existing row gets
-- payment_status = 'Paid' and paid_amount = null, so amount_paid = amount and
-- no historical figure moves.

-- 1. The columns -----------------------------------------------------
alter table public.expenses
  add column if not exists payment_status text not null default 'Paid';

alter table public.expenses
  add column if not exists due_on date;

alter table public.expenses
  add column if not exists paid_amount numeric(12, 2);

-- Constraints are managed outside the add-column statements so re-running this
-- file updates the rule rather than skipping a changed inline definition.
alter table public.expenses
  drop constraint if exists expenses_payment_status_check;
alter table public.expenses
  add constraint expenses_payment_status_check
  check (payment_status in ('Paid', 'Unpaid'));

-- Exactly one shape per state, as receipts do it: a paid bill has no due date,
-- an unpaid one must have one. "Unpaid with no date" would be a bill nothing
-- ever surfaces.
alter table public.expenses
  drop constraint if exists expenses_due_on_check;
alter table public.expenses
  add constraint expenses_due_on_check check (
    (payment_status = 'Paid' and due_on is null)
    or (payment_status = 'Unpaid' and due_on is not null)
  );

-- Not more than the bill, not negative, and meaningless once settled — there
-- the whole amount has gone out, so a leftover partial figure would be a
-- second, contradictory record of the same money.
alter table public.expenses
  drop constraint if exists expenses_paid_amount_range;
alter table public.expenses
  add constraint expenses_paid_amount_range
  check (
    paid_amount is null
    or (
      paid_amount >= 0
      and paid_amount <= amount
      and payment_status = 'Unpaid'
    )
  );

-- `if not exists` rather than drop-and-recreate: the view below selects these
-- columns, so a second run could not drop them ("cannot drop column
-- amount_paid because other objects depend on it") and the whole migration
-- would fail. Changing either formula later therefore needs a
-- `drop ... cascade` and a rebuild of the view, deliberately.
alter table public.expenses
  add column if not exists amount_paid numeric(12, 2)
  generated always as (
    case when payment_status = 'Paid' then amount else coalesce(paid_amount, 0) end
  ) stored;

alter table public.expenses
  add column if not exists amount_unpaid numeric(12, 2)
  generated always as (
    case
      when payment_status = 'Paid' then 0
      else greatest(amount - coalesce(paid_amount, 0), 0)
    end
  ) stored;

-- Unpaid bills are read by due date, oldest first.
create index if not exists expenses_due_on_idx
  on public.expenses (due_on)
  where payment_status = 'Unpaid';

-- 2. Day-by-day spending ---------------------------------------------
-- `total` now means money that actually left the box on that day, which is what
-- the balance subtracts. What is still owed is reported alongside rather than
-- folded in, so the two can never be confused for each other.
--
-- The new columns go LAST: `create or replace view` may only append, never
-- insert or reorder. expense_count stays count(*) — it tallies expenses
-- recorded, and a bill is an expense whether or not it has been settled.
create or replace view public.expense_daily_totals
with (security_invoker = on) as
select
  spent_on,
  sum(amount_paid)::numeric(14, 2) as total,
  count(*)::integer as expense_count,
  sum(amount_unpaid)::numeric(14, 2) as unpaid,
  count(*) filter (where amount_unpaid > 0)::integer as unpaid_count
from public.expenses
group by spent_on;

-- 3. What the mandal still owes --------------------------------------
-- The counterpart of pledge_totals: one row, so the dashboard can show the
-- figure without pulling the bills themselves. Guarded on the remainder rather
-- than on payment_status, so a bill can never appear here owing ₹0.
create or replace view public.payable_totals
with (security_invoker = on) as
select
  coalesce(sum(amount_unpaid), 0)::numeric(14, 2) as owed,
  count(*)::integer as bill_count,
  coalesce(
    sum(case when due_on <= public.mandal_today() then amount_unpaid else 0 end),
    0
  )::numeric(14, 2) as due_now,
  count(*) filter (where due_on = public.mandal_today())::integer as due_today,
  count(*) filter (where due_on < public.mandal_today())::integer as overdue
from public.expenses
where amount_unpaid > 0;

-- Verify -------------------------------------------------------------
select
  (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'expenses'
      and column_name in ('payment_status', 'due_on', 'paid_amount',
                          'amount_paid', 'amount_unpaid')
  ) as columns_added,                                   -- expect 5
  (select coalesce(sum(amount_paid), 0) from public.expenses) as paid_out,
  (select owed from public.payable_totals) as still_owed,
  (select count(*) from public.expenses where payment_status = 'Unpaid')
    as unpaid_bills;
