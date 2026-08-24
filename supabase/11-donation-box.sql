-- Pavti Pustak — migration 11
-- The donation box: in-kind or informal donations (a bag of rice, flowers,
-- decoration items) logged with who gave what, kept fully separate from the
-- vargani ledger and expenses — neither figure ever includes these rows.
-- Run in Supabase Dashboard > SQL Editor after 10.

create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  donation_number serial,
  donor_name text not null check (char_length(trim(donor_name)) > 0),
  -- Optional: a donor dropping off items in person is often not asked for a
  -- number.
  phone_number text check (phone_number is null or phone_number ~ '^[0-9]{10}$'),
  item text not null check (char_length(trim(item)) > 0),
  -- Optional: most donation-box entries are items, not cash, so a rupee
  -- figure is a note for the record rather than something ever totalled
  -- alongside receipts.
  value numeric(12, 2) check (value is null or value > 0),
  donation_date date not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  user_id uuid references auth.users not null default auth.uid(),
  created_by_email text
);

create index if not exists donations_donation_date_idx
  on public.donations (donation_date desc, donation_number desc);

-- Row Level Security -------------------------------------------------
-- A shared ledger, like receipts and expenses: any volunteer may correct any
-- row, and the audit log records who did it.
alter table public.donations enable row level security;

drop policy if exists "volunteers read all donations" on public.donations;
create policy "volunteers read all donations"
  on public.donations for select
  to authenticated
  using (true);

drop policy if exists "volunteers insert donations" on public.donations;
create policy "volunteers insert donations"
  on public.donations for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "volunteers update any donation" on public.donations;
create policy "volunteers update any donation"
  on public.donations for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "volunteers delete any donation" on public.donations;
create policy "volunteers delete any donation"
  on public.donations for delete
  to authenticated
  using (true);

-- Same triggers receipts/expenses use --------------------------------
drop trigger if exists donations_touch_updated_at on public.donations;
create trigger donations_touch_updated_at
  before update on public.donations
  for each row execute function public.touch_updated_at();

create or replace function public.set_donation_created_by_email()
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

drop trigger if exists donations_set_created_by_email on public.donations;
create trigger donations_set_created_by_email
  before insert on public.donations
  for each row execute function public.set_donation_created_by_email();

-- Audit log ------------------------------------------------------------
create table if not exists public.donation_audit (
  id bigserial primary key,
  donation_id uuid,
  action text not null check (action in ('created', 'updated', 'deleted')),
  actor_id uuid,
  actor_email text,
  changed_at timestamp with time zone not null default timezone('utc'::text, now()),
  before jsonb,
  after jsonb
);

create index if not exists donation_audit_changed_at_idx
  on public.donation_audit (changed_at desc);
create index if not exists donation_audit_donation_idx
  on public.donation_audit (donation_id);

alter table public.donation_audit enable row level security;

drop policy if exists "volunteers read donation audit" on public.donation_audit;
create policy "volunteers read donation audit"
  on public.donation_audit for select
  to authenticated
  using (true);

-- No insert/update/delete policies: append-only from the security-definer
-- trigger, so it cannot be rewritten or cleared from the client.

create or replace function public.log_donation_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_email text := coalesce(auth.jwt() ->> 'email', 'unknown');
begin
  if (tg_op = 'INSERT') then
    insert into public.donation_audit
      (donation_id, action, actor_id, actor_email, after)
    values (new.id, 'created', v_actor, v_email, to_jsonb(new));
    return new;

  elsif (tg_op = 'UPDATE') then
    if to_jsonb(old) = to_jsonb(new) then
      return new;
    end if;
    insert into public.donation_audit
      (donation_id, action, actor_id, actor_email, before, after)
    values (new.id, 'updated', v_actor, v_email, to_jsonb(old), to_jsonb(new));
    return new;

  else
    insert into public.donation_audit
      (donation_id, action, actor_id, actor_email, before)
    values (old.id, 'deleted', v_actor, v_email, to_jsonb(old));
    return old;
  end if;
end;
$$;

drop trigger if exists donations_audit on public.donations;
create trigger donations_audit
  after insert or update or delete on public.donations
  for each row execute function public.log_donation_change();

-- Join the one activity feed ------------------------------------------
-- Same shape as the receipt/expense arms: receipt_number stays null here, the
-- donation number is read from the before/after snapshot instead, same as an
-- expense's description is.
create or replace view public.activity_log
with (security_invoker = on) as
select
  'receipt'::text as entity,
  'receipt-' || a.id::text as entry_key,
  a.id,
  a.receipt_id as row_id,
  a.receipt_number,
  a.action,
  a.actor_id,
  a.actor_email,
  a.changed_at,
  a.before,
  a.after
from public.receipt_audit a
union all
select
  'expense'::text,
  'expense-' || b.id::text,
  b.id,
  b.expense_id,
  null::integer,
  b.action,
  b.actor_id,
  b.actor_email,
  b.changed_at,
  b.before,
  b.after
from public.expense_audit b
union all
select
  'donation'::text,
  'donation-' || c.id::text,
  c.id,
  c.donation_id,
  null::integer,
  c.action,
  c.actor_id,
  c.actor_email,
  c.changed_at,
  c.before,
  c.after
from public.donation_audit c;

-- Realtime, so a donation logged on one phone shows on another. -------
alter table public.donations replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.donations;
exception
  when duplicate_object then null;
end $$;

alter table public.donation_audit replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.donation_audit;
exception
  when duplicate_object then null;
end $$;
