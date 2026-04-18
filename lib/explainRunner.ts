import { createServerSupabase } from "./supabase";
import { explainOpportunity } from "./explain";

export async function runExplanations(studentId: string, topN = 10) {
  const supabase = createServerSupabase();

  const { data: prof } = await supabase
    .from("student_profile_embeddings")
    .select("narrated_text")
    .eq("student_id", studentId)
    .maybeSingle();
  const narratedProfile = prof?.narrated_text ?? "";

  // Catch rows missing an explanation AND rows that have one but were
  // generated before evidence_quotes existed (empty JSONB array). Two
  // queries merged in TS — PostgREST eq.[] on JSONB is unreliable.
  const baseSelect =
    "id, final_score, opp_type, org_name, deadline, deadline_ambiguous, eligibility_raw, cgpa_required, degree_required, skills_required, documents_required, benefits, funding_type, geo_scope, application_link, contact_email, contact_phone, contact_person, urgency_score, profile_fit_score, value_score, semantic_score, evidence_quotes, explanation, raw_emails ( cleaned_body, subject )";
  const [missingExpl, missingQuotes] = await Promise.all([
    supabase
      .from("opportunities")
      .select(baseSelect)
      .eq("student_id", studentId)
      .eq("status", "active")
      .is("explanation", null)
      .order("final_score", { ascending: false, nullsFirst: false })
      .limit(topN),
    supabase
      .from("opportunities")
      .select(baseSelect)
      .eq("student_id", studentId)
      .eq("status", "active")
      .not("explanation", "is", null)
      .order("final_score", { ascending: false, nullsFirst: false })
      .limit(topN),
  ]);

  type OppRow = {
    id: string;
    evidence_quotes?: unknown;
    [k: string]: unknown;
  };
  const hasQuotes = (q: unknown) => Array.isArray(q) && q.length > 0;
  const merged = new Map<string, OppRow>();
  for (const r of (missingExpl.data ?? []) as OppRow[]) merged.set(r.id, r);
  for (const r of (missingQuotes.data ?? []) as OppRow[]) {
    if (!hasQuotes(r.evidence_quotes)) merged.set(r.id, r);
  }
  const opps = Array.from(merged.values()).slice(0, topN);

  if (!opps.length) return { updated: 0 };

  let updated = 0;
  for (const opp of opps) {
    const raw = (opp as { raw_emails?: { cleaned_body?: string | null; subject?: string | null } | null }).raw_emails;
    const sourceEmail = [raw?.subject, raw?.cleaned_body].filter(Boolean).join("\n\n");
    const result = await explainOpportunity({
      profile: narratedProfile,
      opportunity: {
        opp_type: opp.opp_type,
        org_name: opp.org_name,
        deadline: opp.deadline,
        deadline_ambiguous: opp.deadline_ambiguous,
        eligibility_raw: opp.eligibility_raw,
        cgpa_required: opp.cgpa_required,
        degree_required: opp.degree_required,
        skills_required: opp.skills_required,
        documents_required: opp.documents_required,
        benefits: opp.benefits,
        funding_type: opp.funding_type,
        geo_scope: opp.geo_scope,
        application_link: opp.application_link,
        contact_email: opp.contact_email,
        contact_phone: opp.contact_phone,
        contact_person: opp.contact_person,
      },
      org: (opp.org_name as string | null) ?? "",
      scores: {
        final_score: opp.final_score,
        urgency_score: opp.urgency_score,
        profile_fit_score: opp.profile_fit_score,
        value_score: opp.value_score,
        semantic_score: opp.semantic_score,
      },
      source_email: sourceEmail,
    });
    if (!result) continue;
    await supabase
      .from("opportunities")
      .update({
        explanation: result.explanation,
        action_checklist: result.action_checklist,
        urgency_flag: result.urgency_flag,
        evidence_quotes: result.evidence_quotes,
      })
      .eq("id", opp.id);
    updated += 1;
  }
  return { updated };
}
