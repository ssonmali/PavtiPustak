-- Pavti Pustak — wipe the ledgers, keep the volunteers
-- Run in Supabase Dashboard > SQL Editor.
--
-- DESTRUCTIVE AND IRREVERSIBLE. Every receipt, expense and audit entry is
-- removed. Take a backup first if there is any chance the figures are still
-- wanted: Dashboard > Database > Backups, or export the ledgers from the
-- report page as Excel while the data is still there.
--
-- Kept:
--   auth.users            — the volunteers' logins
--   public.volunteer_names — their display names
--
-- Emptied:
--   public.receipts        public.receipt_audit
--   public.expenses        public.expense_audit
--
-- TRUNCATE rather than DELETE, for two reasons. The audit triggers fire
-- `after delete ... for each row`, so a DELETE would write one "deleted" audit
-- row per receipt — thousands of entries recording the wipe itself, in the very
-- table being cleared. TRUNCATE does not fire row-level triggers, so it leaves
-- nothing behind. It is also a single pass rather than a row-by-row scan.
--
-- RESTART IDENTITY resets the receipt_number sequence, so the next receipt
-- written is #1 again rather than continuing from the last season.
--
-- All four in one statement so it either all happens or none of it does. The
-- audit tables deliberately hold no foreign key to the rows they describe
-- (a receipt may be deleted while its history survives), so no CASCADE is
-- needed here.

begin;

truncate table
  public.receipts,
  public.receipt_audit,
  public.expenses,
  public.expense_audit
  restart identity;

commit;

-- Verify: every count below should be 0, and the volunteer rows should remain.
select 'receipts'        as table_name, count(*) from public.receipts
union all
select 'receipt_audit',        count(*) from public.receipt_audit
union all
select 'expenses',             count(*) from public.expenses
union all
select 'expense_audit',        count(*) from public.expense_audit
union all
select 'volunteer_names (kept)', count(*) from public.volunteer_names;
