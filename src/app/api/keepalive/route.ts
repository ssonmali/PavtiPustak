import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

/**
 * Daily keep-alive.
 *
 * Supabase pauses a free-tier project after 7 days without database activity,
 * and a paused project does NOT wake up when someone opens the site — it has to
 * be restored by hand from the dashboard. For a mandal that uses this a few
 * weeks a year, that means discovering it is down at a donor's doorstep. One
 * cheap query a day keeps the clock reset.
 *
 * The response is deliberately readable rather than an empty 200, so a human or
 * an uptime monitor can tell a working ping from a silently failing one.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Vercel Cron sends this header when CRON_SECRET is configured. If the secret
  // is set we require it; otherwise the route stays open so a free uptime
  // monitor can call it too. It only runs `select now()`, so there is nothing
  // here worth protecting beyond stopping idle traffic.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  const started = Date.now();

  // No cookies: this is not a user session, and ping() touches no table.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );

  const { data, error } = await supabase.rpc("ping");
  const ms = Date.now() - started;

  if (error) {
    // 503 so an uptime monitor treats it as down and actually tells someone.
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        hint: "Have you run supabase/06-ping.sql?",
        ms,
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, dbTime: data, ms },
    { headers: { "cache-control": "no-store" } },
  );
}
