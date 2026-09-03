-- Pavti Pustak — migration 17
-- Put every table the app subscribes to in the realtime publication, in one
-- place. Run in Supabase Dashboard > SQL Editor. Safe to re-run.
--
-- Why this exists, given 03/05/08/09/11 already do it table by table:
--
-- src/lib/use-realtime.ts binds six tables. realtime-js matches the client's
-- bindings against the server's BY INDEX and unsubscribes with CHANNEL_ERROR
-- on the first mismatch, so ONE table missing from the publication takes the
-- whole channel down — every volunteer's device silently drops to a 30-second
-- full-page poll instead of live updates. That is the single most expensive
-- failure mode in the app, and it is caused by an unrun migration rather than
-- by anything in the code.
--
-- Spreading publication membership across five migrations made that easy to
-- hit: run 03 and 05 and 08 but not 11, and realtime is dead for everything,
-- with an error that reads like a network problem. This file is the one place
-- to run when 'realtime publication' in verify.sql shows a false.

do $$
declare
  t text;
begin
  foreach t in array array[
    'receipts', 'receipt_audit',
    'expenses', 'expense_audit',
    'donations', 'donation_audit'
  ]
  loop
    -- to_regclass rather than a cast: casting the name of a table that does
    -- not exist raises, and a mandal that has not run 11 yet should still get
    -- the other five added rather than the whole file aborting.
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %: table does not exist (run its migration first)', t;
      continue;
    end if;

    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'added % to supabase_realtime', t;
    exception
      when duplicate_object then
        raise notice '% was already published', t;
      when others then
        -- The publication may not exist on a self-hosted instance.
        raise notice 'could not add %: %', t, sqlerrm;
    end;

    -- Update and delete events carry only the primary key unless the replica
    -- identity is full, and realtime needs the whole old row to evaluate RLS.
    -- Without it those events are simply never delivered — the quiet half of
    -- this failure, which no error reports.
    execute format('alter table public.%I replica identity full', t);
  end loop;
end;
$$;

-- Confirm: every row should read true, true.
select
  expected.tablename,
  (p.tablename is not null) as published,
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
left join pg_class c
  on c.relname = expected.tablename
  and c.relnamespace = 'public'::regnamespace
order by published, expected.tablename;
