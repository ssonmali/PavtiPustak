# पावती पुस्तक · Pavti Pustak

Vargani (donation) receipt management for a Ganesh Mandal. Volunteers record
donations on their phones, WhatsApp a receipt to the donor, and the treasurer
exports the ledger for accounting.

## Features

- **Receipts** — create, edit, delete, with backdating for previous collections
- **WhatsApp** — one tap sends a bilingual thank-you via the `wa.me` intent
- **Exports** — Excel (.xlsx), a print-ready PDF report, per-donor slips, CSV
- **Overview** — daily collection chart split by Cash/UPI, per-volunteer totals
- **Activity log** — every change, by whom, with a field-level diff
- **Bilingual** — Marathi (default) and English
- **Realtime** — every volunteer's device stays in sync
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

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).
