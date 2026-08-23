-- Pavti Pustak — migration 06
-- A trivial function the daily keep-alive can call, so the free-tier project
-- never pauses for inactivity.
--
-- Run in Supabase Dashboard > SQL Editor. Safe to re-run.

-- Returns the database's own clock. Deliberately reveals nothing: it touches no
-- table, so granting it to `anon` exposes no receipt data.
create or replace function public.ping()
returns timestamp with time zone
language sql
stable
as $$
  select timezone('utc'::text, now());
$$;

-- The cron job is unauthenticated — it is not a volunteer — so anon needs it.
grant execute on function public.ping() to anon, authenticated;

select 'ping' as check, public.ping() as db_time;
