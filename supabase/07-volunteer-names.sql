-- Pavti Pustak — migration 07
-- A display name per volunteer, so the app stops showing raw email addresses.
-- Each volunteer sets their own; nobody can rename anyone else.
-- Run in Supabase Dashboard > SQL Editor after 06.

create table if not exists public.volunteer_names (
  email text primary key,
  display_name text not null
    check (length(trim(display_name)) between 1 and 60),
  updated_at timestamp with time zone
    not null default timezone('utc'::text, now())
);

alter table public.volunteer_names enable row level security;

-- Everyone signed in reads every name: attribution on receipts and in the
-- activity log has to render other volunteers, not just the current one.
drop policy if exists "volunteers read all names" on public.volunteer_names;
create policy "volunteers read all names"
  on public.volunteer_names for select
  to authenticated
  using (true);

-- Writes are limited to your own row. `email` is not trusted from the client:
-- the check compares it against the address in the JWT.
drop policy if exists "volunteers set own name" on public.volunteer_names;
create policy "volunteers set own name"
  on public.volunteer_names for insert
  to authenticated
  with check (email = auth.jwt() ->> 'email');

drop policy if exists "volunteers update own name" on public.volunteer_names;
create policy "volunteers update own name"
  on public.volunteer_names for update
  to authenticated
  using (email = auth.jwt() ->> 'email')
  with check (email = auth.jwt() ->> 'email');

-- Clearing a name in the app deletes the row, so delete needs the same
-- ownership check as an update rather than being left to the default deny.
drop policy if exists "volunteers clear own name" on public.volunteer_names;
create policy "volunteers clear own name"
  on public.volunteer_names for delete
  to authenticated
  using (email = auth.jwt() ->> 'email');

create or replace function public.touch_volunteer_name()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists volunteer_names_touch on public.volunteer_names;
create trigger volunteer_names_touch
  before update on public.volunteer_names
  for each row execute function public.touch_volunteer_name();
