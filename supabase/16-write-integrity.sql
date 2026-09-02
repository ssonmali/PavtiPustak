-- 16. Make the ledger's identity columns unforgeable
--
-- Until now the Zod schemas were the only thing keeping a receipt honest, and
-- they are advisory: the anon key is public by design and every volunteer holds
-- a real JWT, so PostgREST can be called directly. The update policies are
-- `using (true) with check (true)`, and the columns with no CHECK behind them —
-- user_id, created_by_email, receipt_number — were writable by hand. A
-- volunteer could reassign a 50,000 rupee receipt to a colleague under a
-- duplicate slip number, and volunteer_totals and every printed slip would
-- repeat it. The audit log records the true actor, so it was detectable after
-- the fact but not prevented.
--
-- Three things here: stop receipt numbers colliding, stop attribution being
-- supplied by the caller on insert, and stop all three columns changing on
-- update.
--
-- Every guard below is gated on `auth.uid() is not null` — that is, on there
-- being an authenticated end user making the call. Running as the service role
-- in the SQL editor leaves auth.uid() null and keeps full control, which is
-- what makes the backfills in 04/08/11 and any hand repair still possible.
-- The service role is trusted by definition; the volunteer's JWT is not.

-- 1. One slip number, one receipt -------------------------------------
-- `receipt_number serial` only ever supplied a default; it never enforced
-- uniqueness, so a direct write could duplicate one. Verified empty on
-- production before adding this:
--   select receipt_number, count(*) from public.receipts
--   group by receipt_number having count(*) > 1;
--
-- Built plainly rather than CONCURRENTLY: at a mandal's scale this is a
-- few thousand rows and takes milliseconds, and CONCURRENTLY cannot run
-- inside the transaction the SQL editor wraps statements in.
create unique index if not exists receipts_receipt_number_key
  on public.receipts (receipt_number);

-- 2. Drop the index we were maintaining twice --------------------------
-- 10-payment-status.sql:34 and 14-partial-payments.sql:63 declare the same
-- partial index under two names, so `if not exists` never deduplicated them
-- and Postgres kept two identical B-trees in step on every insert and every
-- mark-paid. receipts_due_on_idx is the one the reminder list was written
-- against, so that is the one that stays.
drop index if exists public.receipts_outstanding_idx;

-- 3. Attribution comes from the token, not the request -----------------
-- These three functions were `coalesce(new.created_by_email, auth.jwt() ->>
-- 'email')`, which trusts a caller-supplied value over the token and let an
-- insert forge who collected the money. The arguments are simply swapped: the
-- authenticated caller's own email wins, and a null (service role) falls back
-- to whatever was passed, which is what the backfills rely on.
--
-- user_id is pinned the same way. The server actions already set it from the
-- session, so this changes nothing they do — it only removes the option of
-- setting it to somebody else.

create or replace function public.set_created_by_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by_email := coalesce(auth.jwt() ->> 'email', new.created_by_email);
  new.user_id := coalesce(auth.uid(), new.user_id);
  return new;
end;
$$;

create or replace function public.set_expense_created_by_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by_email := coalesce(auth.jwt() ->> 'email', new.created_by_email);
  new.user_id := coalesce(auth.uid(), new.user_id);
  return new;
end;
$$;

create or replace function public.set_donation_created_by_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by_email := coalesce(auth.jwt() ->> 'email', new.created_by_email);
  new.user_id := coalesce(auth.uid(), new.user_id);
  return new;
end;
$$;

-- 4. Identity does not change on update --------------------------------
-- Who collected it, under what number, is a fact about the past. An edit may
-- correct the donor's name or the amount; it may not move the row to another
-- volunteer or renumber the slip.
--
-- Safe against every legitimate write path in the app: updateReceipt sends
-- `parsed.data`, and receiptSchema (src/lib/schemas.ts) contains only the
-- donor, money and date fields — Zod strips unknown keys, so none of these
-- three can be in it. markReceiptPaid touches payment_status, due_on and
-- paid_amount. Neither is affected by this trigger.
--
-- Silently restoring the old value rather than raising: a volunteer with a
-- patchy connection retrying a save should not be shown a database error for
-- a field their form never sent. The audit log still records what changed.

create or replace function public.pin_receipt_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.user_id := old.user_id;
    new.created_by_email := old.created_by_email;
    new.receipt_number := old.receipt_number;
  end if;
  return new;
end;
$$;

drop trigger if exists receipts_pin_identity on public.receipts;
create trigger receipts_pin_identity
  before update on public.receipts
  for each row execute function public.pin_receipt_identity();

-- Expenses and donations have no slip number, but the same two columns.
create or replace function public.pin_ledger_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.user_id := old.user_id;
    new.created_by_email := old.created_by_email;
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_pin_identity on public.expenses;
create trigger expenses_pin_identity
  before update on public.expenses
  for each row execute function public.pin_ledger_identity();

drop trigger if exists donations_pin_identity on public.donations;
create trigger donations_pin_identity
  before update on public.donations
  for each row execute function public.pin_ledger_identity();

-- Note on what is deliberately still open: the update policies remain
-- `using (true)`, so any volunteer may still edit or delete any row. That is
-- the intended shape of a shared mandal ledger — there are no roles — and the
-- audit log is what makes it accountable. This migration narrows *what* a write
-- may say, not *who* may write.
