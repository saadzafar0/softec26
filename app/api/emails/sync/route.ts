import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase";
import { fetchRecentEmails, GMAIL_MAX_RESULTS, isReauthError } from "@/lib/gmail";
import { cleanEmailBody, cleanedHash, senderDomain } from "@/lib/clean";
import { processRawEmail } from "@/lib/pipeline";
import { runExplanations } from "@/lib/explainRunner";

export const runtime = "nodejs";
export const maxDuration = 300;

const syncSchema = z.object({ student_id: z.string().uuid() });

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = syncSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "student_id required" },
      { status: 400 },
    );
  }

  const supabase = createServerSupabase();
  const { data: student, error } = await supabase
    .from("students")
    .select("id, gmail_refresh_token")
    .eq("id", parsed.data.student_id)
    .single();
  if (error || !student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  if (!student.gmail_refresh_token) {
    return NextResponse.json(
      { error: "Gmail not connected", code: "GMAIL_REAUTH" },
      { status: 400 },
    );
  }

  let emails;
  try {
    emails = await fetchRecentEmails(
      student.gmail_refresh_token,
      GMAIL_MAX_RESULTS,
    );
    if (emails.length > GMAIL_MAX_RESULTS) {
      emails = emails.slice(0, GMAIL_MAX_RESULTS);
    }
  } catch (err) {
    if (isReauthError(err)) {
      await supabase
        .from("students")
        .update({ gmail_refresh_token: null })
        .eq("id", student.id);
      return NextResponse.json(
        { error: "Gmail token invalid", code: "GMAIL_REAUTH" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      {
        error: "Gmail fetch failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  const rawRows = emails.map((m) => {
    const cleaned = cleanEmailBody(m.rawBody);
    return {
      student_id: student.id,
      gmail_message_id: m.gmailMessageId,
      subject: m.subject,
      sender: m.sender,
      sender_domain: senderDomain(m.sender),
      received_at: m.receivedAt,
      raw_body: m.rawBody,
      cleaned_body: cleaned,
      cleaned_hash: cleanedHash(m.sender, m.subject, cleaned),
      source: "gmail" as const,
    };
  });

  const insertedIds: string[] = [];
  for (const row of rawRows) {
    const { data: existing } = await supabase
      .from("raw_emails")
      .select("id")
      .eq("student_id", row.student_id)
      .eq("gmail_message_id", row.gmail_message_id)
      .maybeSingle();
    if (existing?.id) continue;
    const { data: dup } = await supabase
      .from("raw_emails")
      .select("id")
      .eq("student_id", row.student_id)
      .eq("cleaned_hash", row.cleaned_hash)
      .maybeSingle();
    if (dup?.id) continue;
    const { data: ins, error: insErr } = await supabase
      .from("raw_emails")
      .insert(row)
      .select("id")
      .single();
    if (!insErr && ins) insertedIds.push(ins.id as string);
  }

  await supabase.from("gmail_sync_log").insert({
    student_id: student.id,
    emails_fetched: rawRows.length,
    opportunities_found: 0,
    last_message_id: rawRows[rawRows.length - 1]?.gmail_message_id ?? null,
  });

  let oppCount = 0;
  for (const id of insertedIds) {
    const res = await processRawEmail(id);
    if (res.status === "active") oppCount += 1;
  }

  if (oppCount > 0) {
    await runExplanations(student.id, 10);
  }

  return NextResponse.json({
    emails_fetched: rawRows.length,
    new_emails: insertedIds.length,
    opportunities_active: oppCount,
  });
}
