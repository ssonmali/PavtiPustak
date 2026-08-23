-- Pavti Pustak — migration 09
-- Expenses join the activity log, and the log becomes one feed the app can
-- read in a single query.
-- Run in Supabase Dashboard > SQL Editor after 08.

-- 1. The log ---------------------------------------------------------
-- A separate table rather than columns bolted onto receipt_audit: the two
-- entities have different shapes, and the union view below is what the app
-- reads, so nothing downstream has to know there are two tables.
create table if not exists public.expense_audit (
  id bigserial primary key,
  expense_id uuid,
  action text not null check (action in ('created', 'updated', 'deleted')),
  actor_id uuid,
  actor_email text,
  changed_at timestamp with time zone not null default timezone('utc'::text, now()),
  before jsonb,
  after jsonb
);

create index if not exists expense_audit_changed_at_idx
  on public.expense_audit (changed_at desc);
create index if not exists expense_audit_expense_idx
  on public.expense_audit (expense_id);

alter table public.expense_audit enable row level security;

-- Volunteers may read the log; only the trigger writes to it.
drop policy if exists "volunteers read expense audit" on public.expense_audit;
create policy "volunteers read expense audit"
  on public.expense_audit for select
  to authenticated
  using (true);

-- No insert/update/delete policies: append-only from the security-definer
-- trigger, so it cannot be rewritten or cleared from the client.

-- 2. Trigger ---------------------------------------------------------
create or replace function public.log_expense_change()
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
    insert into public.expense_audit
      (expense_id, action, actor_id, actor_email, after)
    values (new.id, 'created', v_actor, v_email, to_jsonb(new));
    return new;

  elsif (tg_op = 'UPDATE') then
    -- Skip no-op saves so the log stays signal.
    if to_jsonb(old) = to_jsonb(new) then
      return new;
    end if;
    insert into public.expense_audit
      (expense_id, action, actor_id, actor_email, before, after)
    values (new.id, 'updated', v_actor, v_email, to_jsonb(old), to_jsonb(new));
    return new;

  else
    insert into public.expense_audit
      (expense_id, action, actor_id, actor_email, before)
    values (old.id, 'deleted', v_actor, v_email, to_jsonb(old));
    return old;
  end if;
end;
$$;

drop trigger if exists expenses_audit on public.expenses;
create trigger expenses_audit
  after insert or update or delete on public.expenses
  for each row execute function public.log_expense_change();

-- 3. One feed --------------------------------------------------------
-- Contributions and expenses in a single ordered list. `entry_key` exists
-- because the two tables have independent sequences, so `id` alone is not
-- unique across the union.
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
from public.expense_audit b;

-- 4. Realtime --------------------------------------------------------
-- So a spend recorded on one phone lands in another's activity feed.
alter table public.expense_audit replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.expense_audit;
exception
  when duplicate_object then null;
end $$;
