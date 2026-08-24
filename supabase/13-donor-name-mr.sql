-- Pavti Pustak — migration 13
-- An optional Marathi spelling of the donor's name.
-- Run in Supabase Dashboard > SQL Editor after 12.
--
-- The receipt image reads entirely in Marathi, but a donor name typed in
-- English cannot be transliterated reliably: English spelling does not record
-- whether "n" is न or ण, "l" is ल or ळ, or whether "a" is अ or आ, so "Patil"
-- could be पाटील or पतिल. The app guesses as the volunteer types and lets them
-- correct it; this column is where the correction is kept, so it is made once
-- rather than being re-guessed on every share.
--
-- Deliberately nullable and separate from donor_name: the English spelling
-- stays the record of what was entered, and every existing receipt keeps
-- working with this empty (the app falls back to transliterating on the fly).

alter table public.receipts
  add column if not exists donor_name_mr text;

alter table public.receipts
  drop constraint if exists receipts_donor_name_mr_length;

alter table public.receipts
  add constraint receipts_donor_name_mr_length
  check (donor_name_mr is null or char_length(donor_name_mr) <= 120);

-- The autocomplete has to carry it, or picking a donor whose spelling was
-- corrected last week would silently re-guess the name this week. The view
-- selects explicit columns, so it must be re-created rather than left to pick
-- the new column up on its own.
--
-- donor_name_mr goes LAST, which is not a style choice: `create or replace
-- view` may only append columns. Putting it next to phone_number renames the
-- existing third column and Postgres rejects the whole statement with
-- "cannot change name of view column". Appending keeps the existing grants,
-- which a drop-and-recreate would discard.
create or replace view public.donor_directory
with (security_invoker = on) as
select distinct on (lower(trim(donor_name)))
  trim(donor_name) as donor_name,
  phone_number,
  sum(amount) over (partition by lower(trim(donor_name)))::numeric(14, 2) as lifetime_total,
  count(*) over (partition by lower(trim(donor_name)))::integer as receipt_count,
  max(collection_date) over (partition by lower(trim(donor_name))) as last_collection,
  donor_name_mr
from public.receipts
where payment_status = 'Paid'
-- collection_date desc picks the most recent spelling for a repeat donor, which
-- is the one most likely to have been corrected.
order by lower(trim(donor_name)), collection_date desc, receipt_number desc;

-- Verify: the column exists and is nullable, and the view exposes it.
select
  (
    select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'receipts'
      and column_name = 'donor_name_mr'
  ) as receipts_column_nullable,   -- expect YES
  (
    select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'donor_directory'
      and column_name = 'donor_name_mr'
  ) as in_donor_directory;         -- expect 1
