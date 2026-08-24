-- Sanity check: run the whole file in the SQL Editor to confirm every
-- migration (01–11) is in place. Each section names what it expects.
select 'policies' as check, tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('receipts', 'receipt_audit')
order by tablename, cmd;

select 'trigger' as check, tgname, tgrelid::regclass::text as on_table
from pg_trigger
where tgname = 'receipts_audit_trigger';

select 'audit rows' as check, count(*) as entries from public.receipt_audit;

-- Is realtime actually publishing everything the app subscribes to?
--
-- src/lib/use-realtime.ts listens to all six of these. A table missing here
-- is the worst kind of failure: the channel still reports SUBSCRIBED, so the
-- app looks healthy and simply never receives that table's changes. Listed as
-- expected-vs-actual rather than "rows returned", so a missing table shows up
-- as a false instead of quietly being absent from the output.
select
  'realtime publication' as check,
  expected.tablename,
  (p.tablename is not null) as published,
  -- Update and delete events need the full old row for RLS to be evaluated:
  -- 'f' (full), not 'd' (default). Insert-only audit tables are unaffected.
  c.relreplident = 'f' as replica_identity_full
from (
  values
    ('receipts'), ('receipt_audit'),
    ('expenses'), ('expense_audit'),
    ('donations'), ('donation_audit')
) as expected(tablename)
left join pg_publication_tables p
  on p.tablename = expected.tablename
  and p.pubname = 'supabase_realtime'
  and p.schemaname = 'public'
-- Joined on name, not via a ::regclass cast: casting the name of a table that
-- does not exist raises, which would break the whole query instead of
-- reporting the missing table as a false.
left join pg_class c
  on c.relname = expected.tablename
  and c.relnamespace = 'public'::regnamespace
order by published, expected.tablename;

-- Views and updated_at from migration 04.
select 'views' as check, table_name
from information_schema.views
where table_schema = 'public'
order by table_name;

-- 8. Volunteer display names (migration 07) ------------------------
select
  (select count(*) from public.volunteer_names) as names_set,
  (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'volunteer_names'
  ) as name_policies;   -- expect 4

-- 9. Expenses (migration 08) ---------------------------------------
select
  (select count(*) from public.expenses) as expenses,
  (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'expenses'
  ) as expense_policies,   -- expect 4
  (
    select relreplident from pg_class
    where oid = 'public.expenses'::regclass
  ) as expenses_replident;  -- expect 'f'

-- 10. Expense audit + combined feed (migration 09) -----------------
select
  (select count(*) from public.expense_audit) as expense_audit_rows,
  (select count(*) from public.activity_log) as activity_rows,
  (
    select count(*) from pg_trigger
    where tgrelid = 'public.expenses'::regclass and tgname = 'expenses_audit'
  ) as expense_audit_trigger;  -- expect 1

-- 11. Paid/unpaid receipts (migration 10) --------------------------
select
  count(*) filter (where payment_status = 'Unpaid') as unpaid,
  count(*) filter (where payment_status = 'Unpaid' and due_on is null)
    as unpaid_without_date,   -- must be 0; the constraint forbids it
  (select due_now from public.pledge_totals) as due_now,
  public.mandal_today() as mandal_today
from public.receipts;

-- 12. Donation box (migration 11) ----------------------------------
-- If this errors with "relation does not exist", migration 11 has not run and
-- the donation box cannot save anything.
select
  (select count(*) from public.donations) as donations,
  (select count(*) from public.donation_audit) as donation_audit_rows,
  (
    select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'donations'
  ) as donation_policies,   -- expect 4
  (
    select count(*) from pg_trigger
    where tgrelid = 'public.donations'::regclass and tgname = 'donations_audit'
  ) as donation_audit_trigger,  -- expect 1
  -- The phone number is optional, so the column must be nullable. If this is
  -- 'NO', migration 11 ran before that change and saving without a number
  -- will fail at the database rather than in the form.
  (
    select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'donations'
      and column_name = 'phone_number'
  ) as phone_nullable;  -- expect 'YES'

-- The activity feed unions receipts + expenses + donations. All three arms
-- must be present, or one ledger's history silently stops appearing.
select 'activity feed arms' as check, entity, count(*) as entries
from public.activity_log
group by entity
order by entity;
