-- Sanity check: run this to confirm migration 02 is fully in place.
select 'policies' as check, tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('receipts', 'receipt_audit')
order by tablename, cmd;

select 'trigger' as check, tgname, tgrelid::regclass::text as on_table
from pg_trigger
where tgname = 'receipts_audit_trigger';

select 'audit rows' as check, count(*) as entries from public.receipt_audit;
