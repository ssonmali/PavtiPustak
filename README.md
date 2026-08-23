# पावती पुस्तक · Pavti Pustak

Vargani (contribution) receipt management for a Ganesh Mandal. Volunteers record
contributions on their phones, WhatsApp a receipt to the donor, and the treasurer
prints the ledger for accounting.

## Features

- **Receipts** — create, edit, delete, with backdating for previous collections
- **WhatsApp** — one tap sends a bilingual thank-you via the `wa.me` intent
- **Print / PDF** — a ruled report for today, a custom date range, or all time,
  plus a printable slip per receipt
- **Overview** — daily collection chart split by Cash/UPI, per-volunteer totals
- **Activity log** — every change, by whom, with a field-level diff
- **Bilingual** — Marathi (default) and English
- **Realtime** — every volunteer's device stays in sync
- **Offline-first** — enter receipts with no signal; they queue on the device
  and sync automatically on reconnect
- **Mobile-first** — installable PWA, card layouts, 44px tap targets

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase
(Postgres + Auth + Realtime + RLS) · Vercel

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values
npm run dev
```

Apply the SQL in `supabase/` in numeric order first — see [DEPLOYMENT.md](DEPLOYMENT.md).

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server |
| `npm run verify` | Lint + typecheck + tests |
| `npm test` | Unit tests (vitest) |
| `npm run build` | Production build |

Tests run under a non-IST timezone in CI on purpose: date handling must not
depend on the host zone.

## Keeping the free tier awake

Supabase pauses an idle free-tier project after 7 days, and it does not wake on
its own. `vercel.json` declares a daily cron against `/api/keepalive` to prevent
that. See [DEPLOYMENT.md](DEPLOYMENT.md) step 7.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).
