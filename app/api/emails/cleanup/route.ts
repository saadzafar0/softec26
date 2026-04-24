import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const schema = z.object({ student_id: z.string().uuid() });

/**
 * Removes raw_emails (and the opportunities they spawned) that should never
 * have been ingested. The Gmail exclusion list (in `lib/keywords.ts`) only
 * affects future fetches — anything that landed in `raw_emails` before the
 * exclusion was added still pollutes the dashboard. This endpoint scrubs:
 *
 *   - Mail you sent yourself (sender field contains your own email address).
 *   - Google Classroom notifications (any sender on `classroom.google.com`).
 *
 * The matching is done in SQL with `ILIKE` so we can handle "Name <email>"
 * style sender headers without parsing them.
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "student_id required" },
      { status: 400 },
    );
  }
  const { student_id } = parsed.data;

  const supabase = createServerSupabase();

  const { data: studentRow, error: studentErr } = await supabase
    .from("students")
    .select("id, email")
    .eq("id", student_id)
    .single();
  if (studentErr || !studentRow) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  const studentEmail = (studentRow.email ?? "").trim().toLowerCase();

  // Build the OR'd ILIKE filter. Always include the Classroom domain.
  // Add the student's own email only if we have one (otherwise we'd match
  // every email in the table because `%%` is a wildcard for everything).
  const orClauses: string[] = ["sender.ilike.%classroom.google.com%"];
  if (studentEmail.length > 0) {
    // PostgREST `or=` syntax requires commas to be percent-encoded inside
    // values, but supabase-js handles the encoding when we use .or().
    orClauses.push(`sender.ilike.%${studentEmail}%`);
  }
  const orFilter = orClauses.join(",");

  const { data: targets, error: findErr } = await supabase
    .from("raw_emails")
    .select("id")
    .eq("student_id", student_id)
    .or(orFilter);
  if (findErr) {
    return NextResponse.json(
      { error: "Failed to find junk emails", details: findErr.message },
      { status: 500 },
    );
  }
  const targetIds = (targets ?? []).map((r) => r.id as string);

  if (targetIds.length === 0) {
    return NextResponse.json({
      raw_emails_removed: 0,
      opportunities_removed: 0,
    });
  }

  // Count opportunities first (for the response) before they're cascaded away.
  const { count: oppCount } = await supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .in("raw_email_id", targetIds);

  // Drop opportunities first. opportunity_chunks cascade off opportunities per
  // the schema. Doing this explicitly avoids relying on a CASCADE on the
  // raw_emails -> opportunities FK that may not exist.
  const { error: oppDelErr } = await supabase
    .from("opportunities")
    .delete()
    .in("raw_email_id", targetIds);
  if (oppDelErr) {
    return NextResponse.json(
      {
        error: "Failed to remove derived opportunities",
        details: oppDelErr.message,
      },
      { status: 500 },
    );
  }

  const { error: rawDelErr } = await supabase
    .from("raw_emails")
    .delete()
    .in("id", targetIds);
  if (rawDelErr) {
    return NextResponse.json(
      { error: "Failed to remove raw emails", details: rawDelErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    raw_emails_removed: targetIds.length,
    opportunities_removed: oppCount ?? 0,
  });
}
