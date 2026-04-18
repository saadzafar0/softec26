import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase";
import { cleanEmailBody, cleanedHash, senderDomain } from "@/lib/clean";
import { processRawEmail } from "@/lib/pipeline";
import { runExplanations } from "@/lib/explainRunner";

export const runtime = "nodejs";
export const maxDuration = 300;

const itemSchema = z.object({
  subject: z.string().nullable().optional(),
  sender: z.string().nullable().optional(),
  body: z.string().min(20),
});
const manualSchema = z.object({
  student_id: z.string().uuid(),
  emails: z.array(itemSchema).min(1).max(20),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = manualSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServerSupabase();
  const insertedIds: string[] = [];
  let skipped = 0;

  for (const item of parsed.data.emails) {
    const cleaned = cleanEmailBody(item.body);
    const hash = cleanedHash(
      item.sender ?? null,
      item.subject ?? null,
      cleaned,
    );

    const { data: dup } = await supabase
      .from("raw_emails")
      .select("id")
      .eq("student_id", parsed.data.student_id)
      .eq("cleaned_hash", hash)
      .maybeSingle();
    if (dup?.id) {
      skipped += 1;
      continue;
    }

    const { data: ins, error: insErr } = await supabase
      .from("raw_emails")
      .insert({
        student_id: parsed.data.student_id,
        gmail_message_id: null,
        subject: item.subject ?? null,
        sender: item.sender ?? null,
        sender_domain: senderDomain(item.sender ?? null),
        received_at: new Date().toISOString(),
        raw_body: item.body,
        cleaned_body: cleaned,
        cleaned_hash: hash,
        source: "manual",
      })
      .select("id")
      .single();
    if (!insErr && ins) insertedIds.push(ins.id as string);
  }

  let oppCount = 0;
  for (const id of insertedIds) {
    const res = await processRawEmail(id);
    if (res.status === "active") oppCount += 1;
  }
  if (oppCount > 0) {
    await runExplanations(parsed.data.student_id, 10);
  }

  return NextResponse.json({
    inserted: insertedIds.length,
    skipped_duplicates: skipped,
    opportunities_active: oppCount,
  });
}
