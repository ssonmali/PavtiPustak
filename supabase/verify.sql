-- Sanity check: run this to confirm migration 02 is fully in place.
select 'policies' as check, tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('receipts', 'receipt_audit')
order by tablename, cmd;

select 'trigger' as check, tgname, tgrelid::regclass::text as on_table
from pg_trigger
where tgname = 'receipts_audit_trigger';

select 'audit rows' as check, count(*) as entries from public.receipt_audit;

-- Is realtime actually publishing receipts? Must return one row.
-- If this is empty, migration 03 did not run and no cross-device updates
-- will ever arrive.
select 'realtime publication' as check, pubname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'receipts';

-- DELETE events need the full old row for RLS to be evaluated.
-- relreplident must be 'f' (full), not 'd' (default).
select 'replica identity' as check, relname, relreplident
from pg_class
where relname = 'receipts';

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
