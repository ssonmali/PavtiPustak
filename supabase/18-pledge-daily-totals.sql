-- Pavti Pustak — migration 18
-- Aggregate the unpaid pledges by day, so the overview and the receipts ledger
-- stop fetching raw rows to add up. Run in the SQL Editor after 17. Re-runnable.

-- 1. Pledges by day ---------------------------------------------------
--
-- The overview and the receipts ledger both fetched up to 1000 raw unpaid rows
-- on every load, ran the same four reductions over them on the client, and
-- threw the rows away. Switching between those two tabs re-sent the same 1000
-- rows. This is the same trick receipt_daily_totals already plays: aggregate
-- in the database and the payload stops growing with the ledger.
--
-- Grouped by collection_date, not due_on, because that is the window the rest
-- of both pages is keyed on — the figure has to line up with the collected
-- total beside it.
--
-- No business logic is reimplemented here, which is the only reason this is
-- safe. amount_received and amount_outstanding are stored generated columns
-- from migration 14, and their definitions already ARE receipt-utils'
-- received() and outstanding() — the same expressions receipt_daily_totals
-- sums. Every figure below is a sum or a count over those two columns, so
-- there is no second copy of the rule to drift out of step.
create or replace view public.pledge_daily_totals
with (security_invoker = on) as
select
  collection_date,
  -- What is still owed. outstanding() on the client.
  sum(amount_outstanding)::numeric(14, 2) as outstanding_total,
  -- Every unpaid row in the day, however much has come in against it.
  count(*)::integer as pledge_rows,
  -- Rows that have brought in nothing at all: received() === 0. The daily
  -- totals view counts only receipts that contributed money, so the overview
  -- adds these to get "every receipt written in the window".
  count(*) filter (where amount_received = 0)::integer as pledge_only_count,
  -- Rows that still owe something. A part-paid row whose remainder has
  -- reached zero is not still owed, even while its status says Unpaid.
  count(*) filter (where amount_outstanding > 0)::integer as owing_count
from public.receipts
where payment_status = 'Unpaid'
group by collection_date;

comment on view public.pledge_daily_totals is
  'Unpaid pledges aggregated by the day they were recorded. Replaces fetching '
  'up to 1000 raw rows on the overview and the receipts ledger.';

-- On the duplicate index: there isn't one. An earlier version of this file
-- also dropped receipts_outstanding_idx, on the grounds that
-- 10-payment-status.sql and 14-partial-payments.sql declare the same partial
-- index under two names. They do — but 16-write-integrity.sql already drops
-- it, for the same reason and keeping the same name. Checked against a real
-- Postgres replay of 01..16 rather than by reading the two files that create
-- it, which is how the redundant version got written in the first place.

-- Confirm: one row, receipts_due_on_idx.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'receipts'
  and indexdef like '%due_on%'
  and indexdef like '%Unpaid%';
