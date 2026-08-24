-- Pavti Pustak — migration 10
-- A contribution can be promised but not yet handed over. Unpaid rows carry the
-- date it is expected, and are kept out of every "collected" figure so cash in
-- hand stays truthful.
-- Run in Supabase Dashboard > SQL Editor after 09.

-- 1. The columns -----------------------------------------------------
alter table public.receipts
  add column if not exists payment_status text not null default 'Paid';

alter table public.receipts
  add column if not exists due_on date;

-- Managed outside the add-column above so re-running this file updates the
-- rule rather than skipping it.
alter table public.receipts
  drop constraint if exists receipts_payment_status_check;
alter table public.receipts
  add constraint receipts_payment_status_check
  check (payment_status in ('Paid', 'Unpaid'));

-- Exactly one shape per state: a paid row has no due date, an unpaid row must
-- have one. Without this, "unpaid, no date" would be a silent hole in the
-- reminder list — nothing would ever surface it.
alter table public.receipts
  drop constraint if exists receipts_due_on_check;
alter table public.receipts
  add constraint receipts_due_on_check check (
    (payment_status = 'Paid' and due_on is null)
    or (payment_status = 'Unpaid' and due_on is not null)
  );

-- The reminder list is read by due date, oldest first.
create index if not exists receipts_due_on_idx
  on public.receipts (due_on)
  where payment_status = 'Unpaid';

-- 2. Money in hand counts only what arrived --------------------------
-- Every one of these views previously summed all receipts. An unpaid row is a
-- promise, so including it would overstate what the mandal can spend.
create or replace view public.receipt_daily_totals
with (security_invoker = on) as
select
  collection_date,
  sum(amount)::numeric(14, 2) as total,
  sum(case when payment_method = 'Cash' then amount else 0 end)::numeric(14, 2)
    as cash,
  sum(case when payment_method = 'UPI' then amount else 0 end)::numeric(14, 2)
    as upi,
  count(*)::integer as receipt_count,
  count(distinct lower(trim(donor_name)))::integer as donor_count
from public.receipts
where payment_status = 'Paid'
group by collection_date;

create or replace view public.volunteer_totals
with (security_invoker = on) as
select
  coalesce(created_by_email, 'unknown') as volunteer,
  sum(amount)::numeric(14, 2) as total,
  count(*)::integer as receipt_count,
  min(collection_date) as first_collection,
  max(collection_date) as last_collection
from public.receipts
where payment_status = 'Paid'
group by coalesce(created_by_email, 'unknown');

-- Autocomplete offers a lifetime total, which should also mean money received.
-- SUPERSEDED by 13-donor-name-mr.sql, which appends donor_name_mr.
-- Replaying this file after 13 does not quietly revert the view — Postgres
-- refuses with "cannot drop columns from view" — but it does mean this
-- migration is no longer re-runnable on its own. Run 13 immediately after,
-- or drop the view first if you genuinely need to rebuild from here.
create or replace view public.donor_directory
with (security_invoker = on) as
select distinct on (lower(trim(donor_name)))
  trim(donor_name) as donor_name,
  phone_number,
  sum(amount) over (partition by lower(trim(donor_name)))::numeric(14, 2) as lifetime_total,
  count(*) over (partition by lower(trim(donor_name)))::integer as receipt_count,
  max(collection_date) over (partition by lower(trim(donor_name))) as last_collection
from public.receipts
where payment_status = 'Paid'
order by lower(trim(donor_name)), collection_date desc, receipt_number desc;

-- 3. What is still owed ----------------------------------------------
-- Today in the mandal's zone. The database runs in UTC, so plain current_date
-- would roll a reminder over at 05:30 local time.
create or replace function public.mandal_today()
returns date
language sql
stable
as $$
  select (timezone('Asia/Kolkata', now()))::date;
$$;

grant execute on function public.mandal_today() to authenticated;

-- One row, so the dashboard can show the expected figure without pulling the
-- pledges themselves. `due_today` and `overdue` are what the reminder counts.
create or replace view public.pledge_totals
with (security_invoker = on) as
select
  coalesce(sum(amount), 0)::numeric(14, 2) as expected,
  count(*)::integer as pledge_count,
  coalesce(
    sum(case when due_on <= public.mandal_today() then amount else 0 end), 0
  )::numeric(14, 2) as due_now,
  count(*) filter (where due_on = public.mandal_today())::integer as due_today,
  count(*) filter (where due_on < public.mandal_today())::integer as overdue
from public.receipts
where payment_status = 'Unpaid';
