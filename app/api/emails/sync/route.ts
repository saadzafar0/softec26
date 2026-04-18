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
    console.error("[emails/sync] Gmail fetch failed:", err);
    return NextResponse.json(
      {
        error: "Gmail fetch failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }

  type Trace = {
    gmail_message_id: string;
    subject: string | null;
    sender: string | null;
    ingest: "new" | "dup_gmail_id" | "dup_cleaned_hash" | "insert_failed";
    pipeline:
      | "skipped"
      | "noise"
      | "extract_failed"
      | "active"
      | "expired"
      | "ineligible"
      | "error"
      | "empty"
      | "missing"
      | "no_student";
    raw_email_id?: string;
    opportunity_id?: string;
  };

  const traces: Trace[] = [];

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

  async function hydrateExistingResult(
    trace: Trace,
    rawEmailId: string,
  ): Promise<void> {
    const { data: opp } = await supabase
      .from("opportunities")
      .select("id, status")
      .eq("raw_email_id", rawEmailId)
      .maybeSingle();
    if (opp?.id) {
      trace.pipeline = (opp.status ?? "active") as Trace["pipeline"];
      trace.opportunity_id = opp.id as string;
    } else {
      // Raw email is stored but pipeline never produced an opportunity row yet
      // (e.g. interrupted previous run). Re-run the pipeline so the user sees something.
      const res = await processRawEmail(rawEmailId);
      trace.pipeline = res.status as Trace["pipeline"];
      if (res.opportunity_id) trace.opportunity_id = res.opportunity_id;
    }
  }

  for (const row of rawRows) {
    const trace: Trace = {
      gmail_message_id: row.gmail_message_id,
      subject: row.subject,
      sender: row.sender,
      ingest: "new",
      pipeline: "skipped",
    };

    const { data: existing } = await supabase
      .from("raw_emails")
      .select("id")
      .eq("student_id", row.student_id)
      .eq("gmail_message_id", row.gmail_message_id)
      .maybeSingle();
    if (existing?.id) {
      trace.ingest = "dup_gmail_id";
      trace.raw_email_id = existing.id as string;
      await hydrateExistingResult(trace, existing.id as string);
      traces.push(trace);
      continue;
    }

    const { data: dup } = await supabase
      .from("raw_emails")
      .select("id")
      .eq("student_id", row.student_id)
      .eq("cleaned_hash", row.cleaned_hash)
      .maybeSingle();
    if (dup?.id) {
      trace.ingest = "dup_cleaned_hash";
      trace.raw_email_id = dup.id as string;
      await hydrateExistingResult(trace, dup.id as string);
      traces.push(trace);
      continue;
    }

    const { data: ins, error: insErr } = await supabase
      .from("raw_emails")
      .insert(row)
      .select("id")
      .single();
    if (insErr || !ins) {
      trace.ingest = "insert_failed";
      traces.push(trace);
      continue;
    }
    trace.raw_email_id = ins.id as string;

    const res = await processRawEmail(ins.id as string);
    trace.pipeline = res.status as Trace["pipeline"];
    if (res.opportunity_id) trace.opportunity_id = res.opportunity_id;
    traces.push(trace);
  }

  const oppCount = traces.filter((t) => t.pipeline === "active").length;

  await supabase.from("gmail_sync_log").insert({
    student_id: student.id,
    emails_fetched: rawRows.length,
    opportunities_found: oppCount,
    last_message_id: rawRows[rawRows.length - 1]?.gmail_message_id ?? null,
  });

  if (oppCount > 0) {
    await runExplanations(student.id, 10);
  }

  const newEmails = traces.filter((t) => t.ingest === "new").length;

  return NextResponse.json({
    emails_fetched: rawRows.length,
    new_emails: newEmails,
    opportunities_active: oppCount,
    items: traces,
  });
}
