import type { SupabaseClient } from "@supabase/supabase-js";
import { embedOne, pgvectorLiteral } from "@/lib/langchain";
import {
  blendScores,
  isEligible,
  profileFitScore,
  urgencyFlag,
  urgencyScore,
  valueScore,
} from "@/lib/score";
import { isExpired } from "@/lib/extract";
import type { Student } from "@/types";

export type RescoreResult = {
  opportunity_id: string;
  org_name: string | null;
  status: string;
  final_score: number;
  old_final_score: number | null;
};

export type RescoreOptions = {
  includeHidden?: boolean;
  profileVec?: number[] | null;
};

/**
 * Recompute fit / urgency / value / semantic / final scores for every
 * opportunity belonging to `student`. Reuses `profileVec` if provided,
 * otherwise fetches narrated_text and embeds it once.
 *
 * Safe to call from multiple entry points (the dedicated rescore route,
 * the profile POST, or the sync route). No LLM calls for classification,
 * extraction, or explanation — only scoring.
 */
export async function rescoreStudent(
  supabase: SupabaseClient,
  student: Student,
  options: RescoreOptions = {},
): Promise<RescoreResult[]> {
  const { includeHidden = true } = options;

  let profileVec: number[] | null = options.profileVec ?? null;
  if (!profileVec) {
    const { data: profEmb } = await supabase
      .from("student_profile_embeddings")
      .select("narrated_text")
      .eq("student_id", student.id)
      .maybeSingle();
    if (profEmb?.narrated_text) {
      try {
        profileVec = await embedOne(profEmb.narrated_text);
      } catch {
        profileVec = null;
      }
    }
  }

  const statuses = includeHidden
    ? ["active", "expired", "ineligible"]
    : ["active"];

  const { data: opps, error: oppErr } = await supabase
    .from("opportunities")
    .select("*")
    .eq("student_id", student.id)
    .in("status", statuses);
  if (oppErr) {
    throw new Error(`Failed to load opportunities: ${oppErr.message}`);
  }

  const results: RescoreResult[] = [];

  for (const opp of opps ?? []) {
    let status = opp.status as string;
    if (status !== "noise") {
      if (isExpired(opp.deadline)) {
        status = "expired";
      } else {
        const { eligible } = isEligible(student, {
          cgpa_required: opp.cgpa_required,
          degree_required: opp.degree_required,
        });
        status = eligible ? "active" : "ineligible";
      }
    }

    const fit = profileFitScore(student, {
      cgpa_required: opp.cgpa_required,
      degree_required: opp.degree_required,
      skills_required: opp.skills_required ?? [],
      opp_type: opp.opp_type,
    });
    const urgency = urgencyScore(opp.deadline, opp.opp_type);

    let prestige: number | null = null;
    if (opp.org_name) {
      const { data: orgRow } = await supabase
        .from("org_knowledge")
        .select("prestige_score")
        .ilike("org_name", opp.org_name)
        .maybeSingle();
      if (orgRow?.prestige_score != null) {
        prestige = Number(orgRow.prestige_score);
      }
    }
    const value = valueScore(
      student,
      { funding_type: opp.funding_type, geo_scope: opp.geo_scope },
      prestige,
    );

    let semantic: number | null = null;
    if (status === "active" && profileVec) {
      const { data: sims } = await supabase.rpc(
        "match_opportunity_chunks_for_opp",
        {
          query_embedding: pgvectorLiteral(profileVec),
          p_opportunity_id: opp.id,
        },
      );
      if (sims && Array.isArray(sims) && sims.length > 0) {
        const avg =
          sims.reduce(
            (s: number, r: { similarity: number }) => s + (r.similarity ?? 0),
            0,
          ) / sims.length;
        semantic = Math.max(0, Math.min(1, avg));
      }
    }

    const finalScore = blendScores({ fit, urgency, value, semantic });

    // Invalidate the stored explanation if either:
    //   (a) the status flipped (e.g. ineligible -> active after profile edit), or
    //   (b) the final_score moved by ≥ 0.05 (5 pts on the 0-100 display scale).
    // Otherwise the dashboard would show old reasoning ("urgent deadline next
    // week") next to numbers that no longer support it. Setting the columns to
    // null lets `runExplanations` regenerate them on the next pass.
    const oldScore =
      typeof opp.final_score === "number" ? opp.final_score : null;
    const oldStatus = opp.status as string;
    const scoreShifted =
      oldScore !== null && Math.abs(finalScore - oldScore) >= 0.05;
    const statusFlipped = oldStatus !== status;
    const invalidateExplanation = scoreShifted || statusFlipped;

    const update: Record<string, unknown> = {
      status,
      profile_fit_score: fit,
      urgency_score: urgency,
      value_score: value,
      semantic_score: semantic,
      final_score: finalScore,
      urgency_flag: urgencyFlag(opp.deadline),
    };
    if (invalidateExplanation) {
      update.explanation = null;
      update.action_checklist = null;
      update.evidence_quotes = [];
    }

    await supabase
      .from("opportunities")
      .update(update)
      .eq("id", opp.id);

    await supabase
      .from("opportunity_chunks")
      .update({ final_score: finalScore })
      .eq("opportunity_id", opp.id);

    results.push({
      opportunity_id: opp.id as string,
      org_name: opp.org_name,
      status,
      final_score: finalScore,
      old_final_score: opp.final_score ?? null,
    });
  }

  return results.sort((a, b) => b.final_score - a.final_score);
}
