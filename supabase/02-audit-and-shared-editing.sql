-- Pavti Pustak — migration 02
-- Any volunteer may now fix or remove any receipt, and every change is logged.
-- Run in Supabase Dashboard > SQL Editor after 01 (schema.sql).

-- 1. Shared editing -------------------------------------------------
-- The mandal ledger is collective: two volunteers collecting together must be
-- able to correct each other's typos. Accountability moves to the audit log.
-- Both names dropped so this migration can be re-run safely.
drop policy if exists "volunteers update own receipts" on public.receipts;
drop policy if exists "volunteers update any receipt" on public.receipts;
create policy "volunteers update any receipt"
  on public.receipts for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "volunteers delete own receipts" on public.receipts;
drop policy if exists "volunteers delete any receipt" on public.receipts;
create policy "volunteers delete any receipt"
  on public.receipts for delete
  to authenticated
  using (true);

-- `user_id` still records who *created* the receipt, and insert still requires
-- it to be your own id — that part is unchanged.

-- 2. Audit log ------------------------------------------------------
create table if not exists public.receipt_audit (
  id bigserial primary key,
  receipt_id uuid,                     -- not a FK: the row may be deleted
  receipt_number integer,
  action text not null check (action in ('created', 'updated', 'deleted')),
  actor_id uuid,
  actor_email text,
  changed_at timestamp with time zone not null default timezone('utc'::text, now()),
  before jsonb,
  after jsonb
);

create index if not exists receipt_audit_changed_at_idx
  on public.receipt_audit (changed_at desc);
create index if not exists receipt_audit_receipt_idx
  on public.receipt_audit (receipt_id);

alter table public.receipt_audit enable row level security;

-- Volunteers may read the log; only the trigger writes to it.
drop policy if exists "volunteers read audit log" on public.receipt_audit;
create policy "volunteers read audit log"
  on public.receipt_audit for select
  to authenticated
  using (true);

-- No insert/update/delete policies: the log is append-only from the trigger
-- (security definer), so it cannot be rewritten or cleared from the client.

-- 3. Trigger --------------------------------------------------------
create or replace function public.log_receipt_change()
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
    insert into public.receipt_audit
      (receipt_id, receipt_number, action, actor_id, actor_email, after)
    values (new.id, new.receipt_number, 'created', v_actor, v_email, to_jsonb(new));
    return new;

  elsif (tg_op = 'UPDATE') then
    -- Skip no-op saves so the log stays signal.
    if to_jsonb(old) = to_jsonb(new) then
      return new;
    end if;
    insert into public.receipt_audit
      (receipt_id, receipt_number, action, actor_id, actor_email, before, after)
    values (new.id, new.receipt_number, 'updated', v_actor, v_email,
            to_jsonb(old), to_jsonb(new));
    return new;

  elsif (tg_op = 'DELETE') then
    insert into public.receipt_audit
      (receipt_id, receipt_number, action, actor_id, actor_email, before)
    values (old.id, old.receipt_number, 'deleted', v_actor, v_email, to_jsonb(old));
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists receipts_audit_trigger on public.receipts;
create trigger receipts_audit_trigger
  after insert or update or delete on public.receipts
  for each row execute function public.log_receipt_change();
