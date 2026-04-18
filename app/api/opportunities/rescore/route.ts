import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase";
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

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  student_id: z.string().uuid(),
  include_hidden: z.boolean().default(true),
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
  const studentId = parsed.data.student_id;
  const supabase = createServerSupabase();

  const { data: studentRow, error: studentErr } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .single();
  if (studentErr || !studentRow) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  const student = studentRow as Student;

  // Load (or skip) the stored profile embedding for semantic re-scoring.
  const { data: profEmb } = await supabase
    .from("student_profile_embeddings")
    .select("narrated_text")
    .eq("student_id", studentId)
    .maybeSingle();
  let profileVec: number[] | null = null;
  if (profEmb?.narrated_text) {
    try {
      profileVec = await embedOne(profEmb.narrated_text);
    } catch {
      profileVec = null;
    }
  }

  const statuses = parsed.data.include_hidden
    ? ["active", "expired", "ineligible"]
    : ["active"];

  const { data: opps, error: oppErr } = await supabase
    .from("opportunities")
    .select("*")
    .eq("student_id", studentId)
    .in("status", statuses);
  if (oppErr) {
    return NextResponse.json(
      { error: "Failed to load opportunities", details: oppErr.message },
      { status: 500 },
    );
  }

  type Result = {
    opportunity_id: string;
    org_name: string | null;
    status: string;
    final_score: number;
    old_final_score: number | null;
  };
  const results: Result[] = [];

  for (const opp of opps ?? []) {
    // Re-run the hard gates with current date + latest student profile.
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

    // Prestige: look up via inferred_fields / stored org link. We don't have a
    // stored FK, so approximate by re-matching on org_name against org_knowledge.
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

    // Semantic: only for active rows with a profile vec.
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

    await supabase
      .from("opportunities")
      .update({
        status,
        profile_fit_score: fit,
        urgency_score: urgency,
        value_score: value,
        semantic_score: semantic,
        final_score: finalScore,
        urgency_flag: urgencyFlag(opp.deadline),
      })
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

  return NextResponse.json({
    rescored: results.length,
    items: results.sort((a, b) => b.final_score - a.final_score),
  });
}
