import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const querySchema = z.object({
  student_id: z.string().uuid(),
  status: z
    .enum(["active", "expired", "ineligible", "noise", "all"])
    .default("active"),
  include_expired: z.enum(["0", "1"]).default("0"),
  include_ineligible: z.enum(["0", "1"]).default("0"),
  type: z.string().optional(),
  urgency: z.enum(["Red", "Orange", "Yellow", "Green"]).optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { student_id, status, include_expired, include_ineligible, type, urgency } =
    parsed.data;

  const supabase = createServerSupabase();
  const statuses: string[] = [];
  if (status === "all") statuses.push("active", "expired", "ineligible");
  else statuses.push(status);
  if (include_expired === "1" && !statuses.includes("expired")) statuses.push("expired");
  if (include_ineligible === "1" && !statuses.includes("ineligible"))
    statuses.push("ineligible");

  let query = supabase
    .from("opportunities")
    .select(
      "id, opp_type, org_name, deadline, deadline_ambiguous, funding_type, geo_scope, application_link, benefits, cgpa_required, degree_required, skills_required, documents_required, eligibility_raw, profile_fit_score, urgency_score, value_score, semantic_score, final_score, explanation, action_checklist, urgency_flag, status, inferred_fields, contact_email, contact_phone, contact_person, evidence_quotes, created_at",
    )
    .eq("student_id", student_id)
    .in("status", statuses)
    .order("final_score", { ascending: false, nullsFirst: false });

  if (type) query = query.eq("opp_type", type);
  if (urgency) query = query.eq("urgency_flag", urgency);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Failed to load opportunities", details: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ opportunities: data ?? [] });
}
