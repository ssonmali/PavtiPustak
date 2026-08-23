# Deploying Pavti Pustak

## 1. Apply the database migrations

Run these in the Supabase dashboard → **SQL Editor**, in order. All of them are
re-runnable.

| File | What it does |
|---|---|
| `supabase/01-schema.sql` | `receipts` table, constraints, RLS |
| `supabase/02-audit-and-shared-editing.sql` | Shared editing + audit log trigger |
| `supabase/03-realtime.sql` | Realtime publication + replica identity |
| `supabase/04-views-and-locking.sql` | Aggregate views, `updated_at`, creator email |
| `supabase/05-realtime-fix.sql` | Replica identity + audit publication |
| `supabase/06-ping.sql` | `ping()` for the daily keep-alive |
| `supabase/07-volunteer-names.sql` | Volunteer display names, set by each volunteer |
| `supabase/08-expenses.sql` | Expenses table, daily spend view, realtime |
| `supabase/09-expense-audit.sql` | Expense audit log + the combined activity feed |

Then run `supabase/verify.sql` — it lists the policies, the trigger, and the
audit row count so you can confirm everything landed.

## 2. Create volunteer accounts

**Authentication → Users → Add user.** Tick **Auto Confirm User**, or the
account cannot log in. There is no public sign-up by design; also turn off
*Allow new users to sign up* under **Authentication → Sign In / Providers**.

**Volunteers set their own display name in the app** — the name in the header
links to the form. Until someone sets one, the name is derived from their email:
`sanket.sonmali@…` reads as "Sanket Sonmali", and `ganesh123@…` as "Ganesh 123".
Prefer `firstname.lastname@…` addresses so the default is already right.

A volunteer can only rename themselves; the RLS policy compares the row's email
against the one in the JWT, so nobody can rename a colleague.

## 3. Deploy to Vercel

1. **vercel.com → Add New → Project**, import `ssonmali/PavtiPustak`.
2. Framework preset is detected as Next.js. No build settings to change.
3. Add three **Environment Variables** (all three environments):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `sb_publishable_…` key |
   | `NEXT_PUBLIC_MANDAL_NAME` | your mandal's name, e.g. `श्री गणेश मंडळ` |
   | `CRON_SECRET` | any long random string — see step 7 |

   Never add the `sb_secret_…` key. The app does not use it, and a
   `NEXT_PUBLIC_` variable is shipped to the browser.
4. Deploy.

## 4. Point Supabase at the deployed URL

**Authentication → URL Configuration:**

- **Site URL:** `https://your-app.vercel.app`
- **Redirect URLs:** add `https://your-app.vercel.app/auth/confirm` and
  `https://your-app.vercel.app/**`

Without this, password-reset links bounce to `localhost:3000` and fail.

## 5. Install it on the volunteers' phones

Open the deployed URL in Chrome (Android) or Safari (iOS) → **Add to Home
Screen**. It installs standalone, with the mandal icon and Marathi as the
default language.

## 6. Tighten auth rate limits

**Authentication → Rate Limits.** Supabase applies defaults, but lower the
sign-in and password-recovery limits to suit a mandal of a few volunteers —
nobody legitimately needs 30 login attempts an hour. This is a dashboard
setting, not application code, which is why it is not in the repo.

## 7. Keep the project awake

Supabase pauses a free-tier project after **7 days without database activity**,
and a paused project does **not** wake up when someone opens the site — it must
be restored by hand from the dashboard. For a mandal that collects a few weeks a
year, that means finding out it is down at a donor's doorstep.

`vercel.json` already declares a daily cron hitting `/api/keepalive`, which runs
one trivial `select now()` and resets the clock. Nothing to configure beyond:

1. Deploy (crons are registered from `vercel.json` at deploy time — they do not
   run on preview deployments, only production).
2. Run `supabase/06-ping.sql`.
3. Set `CRON_SECRET` in Vercel to any long random string. Vercel sends it as a
   bearer token; the route rejects mismatches. If you leave it unset the route
   still works and stays open, which is harmless — it only reads the clock.
4. Verify by opening `https://your-app.vercel.app/api/keepalive`. Expect
   `{"ok":true,"dbTime":"…"}`. A 503 tells you which migration is missing.

Vercel's Hobby plan allows one cron job at daily granularity, which is exactly
what this needs.

**Do not assume it is working.** A cron that quietly stops leaves you paused
while you believe you are covered. Either check the endpoint occasionally, or
point a free uptime monitor at it — the route answers 503 when the database is
unreachable, so a monitor will actually tell you.

If the project does pause: dashboard → open the project → **Restore project** →
wait a couple of minutes. No data is lost; pausing is not deletion. Do this the
day *before* a collection round, not during one.

## Known limits

- **Password reset needs email.** Supabase's built-in SMTP is rate-limited to a
  handful of messages per hour and may land in spam. For reliable delivery,
  configure custom SMTP under **Project Settings → Auth → SMTP**.
- **Free-tier pausing** is handled by the daily cron in step 7. Without that
  cron — or if it fails — the project pauses after 7 idle days and needs a manual
  restore from the dashboard.
- **`receipt_number` can have gaps.** Sequences do not roll back, so a failed
  insert burns a number. Do not promise the treasurer a gapless series.
- **Offline support only runs in a production build.** The service worker is
  not registered in `next dev`, so test it with `npm run build && npm start`, or
  on the deployed URL. In DevTools use Application → Service Workers and the
  Network throttling "Offline" preset.
- **Offline caching stores pages on the device.** A volunteer's phone keeps the
  last version of each page it opened, so treat a shared phone as it would be
  treated with any other ledger. Signing out clears the cached pages.
- **`write-excel-file` is patched.** It numbers custom cell formats from 100,
  but the OOXML spec reserves 0–163 for Excel's built-ins, and Excel responds
  with "we found a problem with some content" and offers to repair the file.
  `patches/write-excel-file+4.1.1.patch` moves the base to 164; `postinstall`
  reapplies it, so a plain `npm install` on Vercel is enough. If the patch ever
  fails to apply after a version bump, the Excel export will start prompting for
  repair again — that is the symptom to look for.
- **No error monitoring is wired up.** Errors go to the Vercel function logs
  with a digest shown to the user. If you want alerting, add Sentry — it needs
  an account and a DSN, so it was left out deliberately.
