import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Exchanges the token in a Supabase email link for a session, then forwards to
 * the page that needs it. Used by the password-recovery flow.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      // Only same-origin relative paths, so a crafted link in a real
      // recovery email cannot land the volunteer on someone else's site.
      return NextResponse.redirect(new URL(safeNextPath(next), request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
