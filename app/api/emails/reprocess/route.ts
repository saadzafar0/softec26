import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase";
import { processRawEmail } from "@/lib/pipeline";
import { runExplanations } from "@/lib/explainRunner";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  student_id: z.string().uuid(),
  only_noise: z.boolean().default(true),
});

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

  const supabase = createServerSupabase();

  const { data: raws, error } = await supabase
    .from("raw_emails")
    .select("id, subject, sender")
    .eq("student_id", parsed.data.student_id)
    .order("ingested_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to list emails", details: error.message },
      { status: 500 },
    );
  }

  const rawIds = (raws ?? []).map((r) => r.id as string);
  if (rawIds.length === 0) {
    return NextResponse.json({ reprocessed: 0, items: [] });
  }

  let targetIds: string[] = rawIds;
  if (parsed.data.only_noise) {
    const { data: oppRows } = await supabase
      .from("opportunities")
      .select("raw_email_id, status")
      .in("raw_email_id", rawIds);
    const noiseOrMissing = new Set(rawIds);
    for (const r of oppRows ?? []) {
      // Keep rows currently marked noise / extract_failed; drop already-active/expired/ineligible
      if (
        r.status === "active" ||
        r.status === "expired" ||
        r.status === "ineligible"
      ) {
        noiseOrMissing.delete(r.raw_email_id as string);
      }
    }
    targetIds = [...noiseOrMissing];
  }

  // Wipe existing opportunity rows for the targets so processRawEmail can upsert fresh.
  if (targetIds.length > 0) {
    await supabase
      .from("opportunities")
      .delete()
      .in("raw_email_id", targetIds);
  }

  type Item = {
    raw_email_id: string;
    subject: string | null;
    sender: string | null;
    status: string;
    opportunity_id?: string;
  };

  const items: Item[] = [];
  const bySubject = new Map<string, { subject: string | null; sender: string | null }>();
  for (const r of raws ?? []) {
    bySubject.set(r.id as string, {
      subject: (r.subject ?? null) as string | null,
      sender: (r.sender ?? null) as string | null,
    });
  }

  for (const id of targetIds) {
    const meta = bySubject.get(id) ?? { subject: null, sender: null };
    const res = await processRawEmail(id);
    items.push({
      raw_email_id: id,
      subject: meta.subject,
      sender: meta.sender,
      status: res.status,
      ...(res.opportunity_id ? { opportunity_id: res.opportunity_id } : {}),
    });
  }

  const activeCount = items.filter((i) => i.status === "active").length;
  if (activeCount > 0) {
    await runExplanations(parsed.data.student_id, 10);
  }

  return NextResponse.json({
    reprocessed: items.length,
    opportunities_active: activeCount,
    items,
  });
}
