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

-- 13. Marathi donor name (migration 13) ---------------------------
-- Both must be 1. in_view is the one worth checking: without it the donor
-- autocomplete stops reusing corrected Marathi spellings and re-guesses every
-- time, which looks like the transliterator being bad rather than a missing
-- column. (04 and 10 hold older definitions of this view, but replaying them
-- after 13 errors rather than reverting it — Postgres will not drop a view
-- column via create or replace.)
select
  (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'receipts'
      and column_name = 'donor_name_mr'
  ) as on_receipts,          -- expect 1
  (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'donor_directory'
      and column_name = 'donor_name_mr'
  ) as in_view,              -- expect 1
  (select count(*) from public.receipts where donor_name_mr is not null)
    as names_corrected_so_far;

-- 14. Partial payments, both ledgers (migrations 14 and 15) -------
-- The generated columns are the single definition of what a row is worth, so a
-- missing one means every money figure on that side silently falls back to face
-- amounts. Both sums must reconcile: paid + still-owed = agreed.
select
  (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'receipts'
      and column_name in ('paid_amount', 'amount_received', 'amount_outstanding')
  ) as receipt_columns,        -- expect 3 (migration 14)
  (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'expenses'
      and column_name in ('payment_status', 'due_on', 'paid_amount',
                          'amount_paid', 'amount_unpaid')
  ) as expense_columns,        -- expect 5 (migration 15)
  (
    select count(*) from information_schema.views
    where table_schema = 'public' and table_name = 'payable_totals'
  ) as payable_view,           -- expect 1 (migration 15)
  (
    select count(*) from public.receipts
    where amount_received + amount_outstanding <> amount
  ) as receipts_not_reconciling,   -- must be 0
  (
    select count(*) from public.expenses
    where amount_paid + amount_unpaid <> amount
  ) as expenses_not_reconciling;   -- must be 0

-- The activity feed unions receipts + expenses + donations. All three arms
-- must be present, or one ledger's history silently stops appearing.
select 'activity feed arms' as check, entity, count(*) as entries
from public.activity_log
group by entity
order by entity;
