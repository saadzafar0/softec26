import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/gmail";
import { createServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/connect?error=${encodeURIComponent(error)}`, req.url),
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/connect?error=missing_params", req.url));
  }

  try {
    const { refreshToken, email } = await exchangeCode(code);
    if (!refreshToken) {
      return NextResponse.redirect(
        new URL("/connect?error=no_refresh_token", req.url),
      );
    }
    const supabase = createServerSupabase();
    await supabase
      .from("students")
      .update({
        gmail_refresh_token: refreshToken,
        gmail_email: email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", state);

    return NextResponse.redirect(
      new URL(`/connect?student_id=${state}&connected=1`, req.url),
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      new URL(`/connect?error=${encodeURIComponent(detail)}`, req.url),
    );
  }
}
