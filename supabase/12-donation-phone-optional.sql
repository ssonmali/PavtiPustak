-- Pavti Pustak — migration 12
-- Make the donation box's phone number optional.
-- Run in Supabase Dashboard > SQL Editor after 11.
--
-- Why this exists as its own file rather than an edit to 11: the first version
-- of 11-donation-box.sql created `phone_number` as `not null`. That file has
-- since been corrected, but it opens with `create table if not exists`, so on
-- any project where 11 already ran the corrected version is skipped entirely
-- and the column stays NOT NULL. The app meanwhile treats the number as
-- optional — a donor handing over items in person is often not asked for one —
-- so saving such a donation fails at the database with a constraint error
-- rather than being accepted.
--
-- Safe either way: if the table was created from the corrected 11, every
-- statement below is already true and this is a no-op.

-- Idempotent: dropping NOT NULL from an already-nullable column is not an error.
alter table public.donations
  alter column phone_number drop not null;

-- The format check is restated so the constraint reads the way the column now
-- behaves. Strictly this is cosmetic — a CHECK passes when its expression is
-- unknown, so a bare `phone_number ~ '...'` already admitted NULL — but a
-- constraint that looks like it forbids blanks while allowing them is the kind
-- of thing that gets "fixed" wrongly later.
alter table public.donations
  drop constraint if exists donations_phone_number_check;

alter table public.donations
  add constraint donations_phone_number_check
  check (phone_number is null or phone_number ~ '^[0-9]{10}$');

-- Verify: is_nullable must be YES.
select
  'donations.phone_number' as column,
  is_nullable,              -- expect YES
  data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'donations'
  and column_name = 'phone_number';
