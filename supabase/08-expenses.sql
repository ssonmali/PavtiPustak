-- Pavti Pustak — migration 08
-- Mandal expenses, so the dashboard can show what is actually left rather than
-- only what came in. Shared editing and audit match receipts.
-- Run in Supabase Dashboard > SQL Editor after 07.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(trim(description)) > 0),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null default 'Other',
  payment_method text not null check (payment_method in ('Cash', 'UPI')),
  spent_on date not null,
  note text,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now()),
  user_id uuid references auth.users not null default auth.uid(),
  created_by_email text
);

-- The category list is managed separately from the table so re-running this
-- file updates it: `create table if not exists` would skip a changed inline
-- constraint on a table that already exists.
update public.expenses set category = 'Mandap' where category = 'Pandal';

alter table public.expenses
  drop constraint if exists expenses_category_check;
alter table public.expenses
  add constraint expenses_category_check check (
    category in ('Decoration', 'Prasad', 'Food', 'Sound', 'Idol', 'Mandap',
                 'Electricity', 'Other')
  );

-- Same access order as the receipts list: newest spend first.
create index if not exists expenses_spent_on_idx
  on public.expenses (spent_on desc, created_at desc);

-- Row Level Security -------------------------------------------------
-- A shared ledger, like receipts: any volunteer may correct any row, and the
-- audit log records who did it.
alter table public.expenses enable row level security;

drop policy if exists "volunteers read all expenses" on public.expenses;
create policy "volunteers read all expenses"
  on public.expenses for select
  to authenticated
  using (true);

drop policy if exists "volunteers insert expenses" on public.expenses;
create policy "volunteers insert expenses"
  on public.expenses for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "volunteers update any expense" on public.expenses;
create policy "volunteers update any expense"
  on public.expenses for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "volunteers delete any expense" on public.expenses;
create policy "volunteers delete any expense"
  on public.expenses for delete
  to authenticated
  using (true);

-- Same triggers receipts use ----------------------------------------
drop trigger if exists expenses_touch_updated_at on public.expenses;
create trigger expenses_touch_updated_at
  before update on public.expenses
  for each row execute function public.touch_updated_at();

create or replace function public.set_expense_created_by_email()
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

drop trigger if exists expenses_set_created_by_email on public.expenses;
create trigger expenses_set_created_by_email
  before insert on public.expenses
  for each row execute function public.set_expense_created_by_email();

-- Totals -------------------------------------------------------------
-- Day-by-day spending, mirroring receipt_daily_totals so the dashboard can
-- line the two up without fetching every row.
create or replace view public.expense_daily_totals
with (security_invoker = on) as
select
  spent_on,
  sum(amount)::numeric(14, 2) as total,
  count(*)::integer as expense_count
from public.expenses
group by spent_on;

-- Realtime, so a spend entered on one phone shows on another.
alter table public.expenses replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.expenses;
exception
  when duplicate_object then null;
end $$;
