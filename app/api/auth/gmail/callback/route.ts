import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/gmail";
import { createServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

function redirectWithError(req: Request, msg: string) {
  return NextResponse.redirect(
    new URL(`/signin?error=${encodeURIComponent(msg)}`, req.url),
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  if (oauthError) return redirectWithError(req, oauthError);
  if (!code) return redirectWithError(req, "missing_code");

  try {
    const { refreshToken, email } = await exchangeCode(code);
    if (!email) return redirectWithError(req, "google_email_missing");

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = createServerSupabase();

    const { data: existing } = await supabase
      .from("students")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let studentId = existing?.id as string | undefined;

    if (!studentId) {
      const { data: created, error: insertErr } = await supabase
        .from("students")
        .insert({ email: normalizedEmail })
        .select("id")
        .single();
      if (insertErr || !created) {
        return redirectWithError(
          req,
          `signup_failed: ${insertErr?.message ?? "unknown"}`,
        );
      }
      studentId = created.id as string;
    }

    const updatePayload: Record<string, unknown> = {
      gmail_email: normalizedEmail,
      updated_at: new Date().toISOString(),
    };
    if (refreshToken) updatePayload["gmail_refresh_token"] = refreshToken;

    const { error: updateErr } = await supabase
      .from("students")
      .update(updatePayload)
      .eq("id", studentId);

    if (updateErr) {
      return redirectWithError(req, `update_failed: ${updateErr.message}`);
    }

    const target = new URL("/signin", req.url);
    target.searchParams.set("student_id", studentId);
    target.searchParams.set("email", normalizedEmail);
    return NextResponse.redirect(target);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return redirectWithError(req, detail);
  }
}
