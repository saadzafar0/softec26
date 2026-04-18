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

  const { data: opps } = await supabase
    .from("opportunities")
    .select("*")
    .eq("student_id", studentId)
    .eq("status", "active")
    .is("explanation", null)
    .order("final_score", { ascending: false, nullsFirst: false })
    .limit(topN);

  if (!opps?.length) return { updated: 0 };

  let updated = 0;
  for (const opp of opps) {
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
      },
      org: opp.org_name ?? "",
      scores: {
        final_score: opp.final_score,
        urgency_score: opp.urgency_score,
        profile_fit_score: opp.profile_fit_score,
        value_score: opp.value_score,
        semantic_score: opp.semantic_score,
      },
    });
    if (!result) continue;
    await supabase
      .from("opportunities")
      .update({
        explanation: result.explanation,
        action_checklist: result.action_checklist,
        urgency_flag: result.urgency_flag,
      })
      .eq("id", opp.id);
    updated += 1;
  }
  return { updated };
}
