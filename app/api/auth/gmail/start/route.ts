import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { buildAuthUrl } from "@/lib/gmail";

export const runtime = "nodejs";

// Sign in / connect Gmail — same OAuth flow.
// The callback finds-or-creates the student by email, so we do not need
// the student_id here. State is used only as a CSRF token.
export async function POST(_req: Request) {
  try {
    const state = randomUUID();
    const url = buildAuthUrl(state);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      {
        error: "OAuth not configured",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function GET(_req: Request) {
  try {
    const state = randomUUID();
    const url = buildAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (err) {
    return NextResponse.json(
      {
        error: "OAuth not configured",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
