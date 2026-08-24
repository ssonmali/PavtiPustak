-- Pavti Pustak — migration 04
-- Aggregate views (so the dashboard stops loading every row), a creator email
-- for per-volunteer totals, a donor directory for autocomplete, and an
-- updated_at column for optimistic locking.
-- Run in Supabase Dashboard > SQL Editor after 03.

-- 1. Optimistic locking ---------------------------------------------
alter table public.receipts
  add column if not exists updated_at timestamp with time zone
  not null default timezone('utc'::text, now());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists receipts_touch_updated_at on public.receipts;
create trigger receipts_touch_updated_at
  before update on public.receipts
  for each row execute function public.touch_updated_at();

-- 2. Who collected it -----------------------------------------------
-- Stored on the row rather than joined from auth.users, which the
-- `authenticated` role cannot read.
alter table public.receipts
  add column if not exists created_by_email text;

create or replace function public.set_created_by_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by_email := coalesce(new.created_by_email, auth.jwt() ->> 'email');
  return new;
end;
$$;

drop trigger if exists receipts_set_creator on public.receipts;
create trigger receipts_set_creator
  before insert on public.receipts
  for each row execute function public.set_created_by_email();

-- Backfill from the audit log where the creation was recorded.
update public.receipts r
set created_by_email = a.actor_email
from public.receipt_audit a
where a.receipt_id = r.id
  and a.action = 'created'
  and r.created_by_email is null;

-- 3. Aggregate views ------------------------------------------------
-- security_invoker keeps RLS in force: a view is otherwise evaluated as its
-- owner and would leak the whole table.

create or replace view public.receipt_daily_totals
with (security_invoker = on) as
select
  collection_date,
  sum(amount)::numeric(14, 2) as total,
  sum(case when payment_method = 'Cash' then amount else 0 end)::numeric(14, 2) as cash,
  sum(case when payment_method = 'UPI' then amount else 0 end)::numeric(14, 2) as upi,
  count(*)::integer as receipt_count,
  count(distinct lower(trim(donor_name)))::integer as donor_count
from public.receipts
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
group by coalesce(created_by_email, 'unknown');

-- One row per donor, newest contact details first — powers autocomplete.
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
order by lower(trim(donor_name)), collection_date desc, receipt_number desc;
