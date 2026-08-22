-- Pavti Pustak — migration 03
-- Broadcast receipt changes so every volunteer's device stays current.
-- Run in Supabase Dashboard > SQL Editor after 02.

-- Add the table to Supabase's realtime publication. Wrapped because adding a
-- table that is already a member raises, and this should be re-runnable.
do $$
begin
  alter publication supabase_realtime add table public.receipts;
exception
  when duplicate_object then null;
  when others then
    -- The publication may not exist on a self-hosted instance; ignore.
    raise notice 'Could not add receipts to supabase_realtime: %', sqlerrm;
end;
$$;

-- DELETE events carry only the primary key unless the replica identity is
-- full. RLS on realtime needs the whole old row to evaluate the policy, so
-- without this, deletes are not delivered to subscribers.
alter table public.receipts replica identity full;

-- Note: realtime respects RLS, so only authenticated volunteers receive
-- events — the same audience that can already read the table.
