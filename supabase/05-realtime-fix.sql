-- Pavti Pustak — migration 05
-- Fix: created receipts appeared on other devices immediately, but edits and
-- deletions did not.
--
-- Cause: with RLS enabled, Supabase Realtime evaluates the policy against the
-- OLD row for updates and deletes. Under the default replica identity that old
-- row is only the primary key, so the check cannot run and the event is
-- dropped. Inserts carry a complete new row, which is why they worked.
--
-- Run in Supabase Dashboard > SQL Editor. Safe to re-run.

-- 1. Give updates and deletes a full old row -------------------------
alter table public.receipts replica identity full;

-- 2. Publish the audit table too -------------------------------------
-- Every edit and deletion writes an audit row, so an INSERT there is a second,
-- independent signal that something changed. Insert events are the most
-- reliable kind, which makes this a useful belt to the replica-identity braces.
do $$
begin
  alter publication supabase_realtime add table public.receipt_audit;
exception
  when duplicate_object then null;
  when others then
    raise notice 'Could not add receipt_audit to supabase_realtime: %', sqlerrm;
end;
$$;

-- Make sure receipts is in there as well, in case 03 was only partly applied.
do $$
begin
  alter publication supabase_realtime add table public.receipts;
exception
  when duplicate_object then null;
  when others then
    raise notice 'Could not add receipts to supabase_realtime: %', sqlerrm;
end;
$$;

-- 3. Confirm ---------------------------------------------------------
-- Expect: two rows below, and relreplident = 'f' for receipts.
select 'published' as check, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('receipts', 'receipt_audit');

select 'replica identity' as check, relname, relreplident
from pg_class
where relname = 'receipts';
