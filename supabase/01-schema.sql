-- Pavti Pustak — receipts schema
-- Run in Supabase Dashboard > SQL Editor.

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number serial,
  donor_name text not null check (char_length(trim(donor_name)) > 0),
  amount numeric(12, 2) not null check (amount > 0),
  phone_number text not null check (phone_number ~ '^[0-9]{10}$'),
  payment_method text not null check (payment_method in ('Cash', 'UPI')),
  collection_date date not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null default auth.uid()
);

-- Dashboard sorts newest-first; receipt_number is the tiebreaker.
create index if not exists receipts_collection_date_idx
  on public.receipts (collection_date desc, receipt_number desc);

-- Row Level Security -------------------------------------------------
-- The mandal is a shared ledger: every logged-in volunteer may READ all
-- receipts, but may only WRITE rows tagged with their own user_id.
alter table public.receipts enable row level security;

drop policy if exists "volunteers read all receipts" on public.receipts;
create policy "volunteers read all receipts"
  on public.receipts for select
  to authenticated
  using (true);

drop policy if exists "volunteers insert own receipts" on public.receipts;
create policy "volunteers insert own receipts"
  on public.receipts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "volunteers update own receipts" on public.receipts;
create policy "volunteers update own receipts"
  on public.receipts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "volunteers delete own receipts" on public.receipts;
create policy "volunteers delete own receipts"
  on public.receipts for delete
  to authenticated
  using (auth.uid() = user_id);
