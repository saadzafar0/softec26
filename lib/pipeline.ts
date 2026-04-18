import { createServerSupabase } from "./supabase";
import { cleanEmailBody, cleanedHash, senderDomain } from "./clean";
import { classify } from "./classify";
import { extractFields, isExpired } from "./extract";
import { lookupOrg, fillFromOrg } from "./orgLookup";
import { buildChunks } from "./chunks";
import { embedBatch, pgvectorLiteral, embedOne } from "./langchain";
import {
  urgencyScore,
  urgencyFlag,
  profileFitScore,
  valueScore,
  blendScores,
  isEligible,
} from "./score";
import type { Student } from "@/types";

type RawEmailRow = {
  id: string;
  student_id: string;
  subject: string | null;
  sender: string | null;
  raw_body: string | null;
  cleaned_body: string | null;
  cleaned_hash: string | null;
};

export async function processRawEmail(
  rawEmailId: string,
): Promise<{ status: string; opportunity_id?: string }> {
  const supabase = createServerSupabase();

  const { data: raw, error: rawErr } = await supabase
    .from("raw_emails")
    .select(
      "id, student_id, subject, sender, raw_body, cleaned_body, cleaned_hash",
    )
    .eq("id", rawEmailId)
    .single();
  if (rawErr || !raw) return { status: "missing" };
  const row = raw as RawEmailRow;

  let cleaned = row.cleaned_body;
  if (!cleaned && row.raw_body) {
    cleaned = cleanEmailBody(row.raw_body);
    const hash = row.cleaned_hash ?? cleanedHash(row.sender, row.subject, cleaned);
    await supabase
      .from("raw_emails")
      .update({
        cleaned_body: cleaned,
        cleaned_hash: hash,
        sender_domain: senderDomain(row.sender),
      })
      .eq("id", row.id);
  }
  if (!cleaned) return { status: "empty" };

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", row.student_id)
    .single();
  if (!student) return { status: "no_student" };
  const profile = student as Student;

  const classification = await classify(row.subject, row.sender, cleaned);
  if (!classification.is_opportunity) {
    const { data: oppNoise, error: noiseErr } = await supabase
      .from("opportunities")
      .upsert(
        {
          raw_email_id: row.id,
          student_id: row.student_id,
          is_opportunity: false,
          confidence: classification.confidence,
          status: "noise",
        },
        { onConflict: "raw_email_id" },
      )
      .select("id")
      .single();
    if (noiseErr) return { status: "error" };
    return { status: "noise", opportunity_id: oppNoise?.id as string };
  }

  const extracted = await extractFields(row.subject, row.sender, cleaned);
  if (!extracted) {
    const { data: oppFail } = await supabase
      .from("opportunities")
      .upsert(
        {
          raw_email_id: row.id,
          student_id: row.student_id,
          is_opportunity: true,
          confidence: classification.confidence,
          status: "noise",
        },
        { onConflict: "raw_email_id" },
      )
      .select("id")
      .single();
    return { status: "extract_failed", opportunity_id: oppFail?.id as string };
  }

  const orgMatch = await lookupOrg(extracted.org_name);
  const { extracted: enriched, inferred, prestige } = fillFromOrg(
    extracted,
    orgMatch,
  );

  const expired = isExpired(enriched.deadline);
  const { eligible, reason } = isEligible(profile, enriched);

  let status: "active" | "expired" | "ineligible" = "active";
  if (expired) status = "expired";
  else if (!eligible) status = "ineligible";

  const u_score = urgencyScore(enriched.deadline, enriched.opp_type);
  const fit = profileFitScore(profile, enriched);
  const value = valueScore(profile, enriched, prestige);

  const { data: opp, error: oppErr } = await supabase
    .from("opportunities")
    .upsert(
      {
        raw_email_id: row.id,
        student_id: row.student_id,
        is_opportunity: true,
        confidence: classification.confidence,
        status,
        opp_type: enriched.opp_type,
        org_name: enriched.org_name,
        deadline: enriched.deadline,
        deadline_ambiguous: enriched.deadline_ambiguous,
        eligibility_raw: enriched.eligibility_raw,
        cgpa_required: enriched.cgpa_required,
        degree_required: enriched.degree_required,
        skills_required: enriched.skills_required,
        documents_required: enriched.documents_required,
        benefits: enriched.benefits,
        funding_type: enriched.funding_type,
        geo_scope: enriched.geo_scope,
        application_link: enriched.application_link,
        contact_email: enriched.contact_email,
        contact_phone: enriched.contact_phone,
        contact_person: enriched.contact_person,
        inferred_fields: inferred,
        profile_fit_score: fit,
        urgency_score: u_score,
        value_score: value,
        urgency_flag: urgencyFlag(enriched.deadline),
      },
      { onConflict: "raw_email_id" },
    )
    .select("id")
    .single();
  if (oppErr || !opp) return { status: "error", ...(reason ? { reason } : {}) };
  const opportunityId = opp.id as string;

  if (status !== "active") {
    const det = blendScores({ fit, urgency: u_score, value, semantic: null });
    await supabase
      .from("opportunities")
      .update({ final_score: det })
      .eq("id", opportunityId);
    return { status, opportunity_id: opportunityId };
  }

  const chunks = buildChunks(row.subject, enriched);
  if (chunks.length > 0) {
    const vecs = await embedBatch(chunks.map((c) => c.text));
    const rows = chunks.map((c, i) => ({
      opportunity_id: opportunityId,
      student_id: row.student_id,
      chunk_type: c.type,
      chunk_text: c.text,
      embedding: pgvectorLiteral(vecs[i] ?? []),
      deadline_date: enriched.deadline,
      opp_type: enriched.opp_type,
    }));
    await supabase
      .from("opportunity_chunks")
      .delete()
      .eq("opportunity_id", opportunityId);
    await supabase.from("opportunity_chunks").insert(rows);
  }

  let semantic: number | null = null;
  const { data: profileEmb } = await supabase
    .from("student_profile_embeddings")
    .select("narrated_text")
    .eq("student_id", row.student_id)
    .maybeSingle();
  if (profileEmb?.narrated_text) {
    const pvec = await embedOne(profileEmb.narrated_text);
    const { data: sims } = await supabase.rpc(
      "match_opportunity_chunks_for_opp",
      {
        query_embedding: pgvectorLiteral(pvec),
        p_opportunity_id: opportunityId,
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

  const finalScore = blendScores({
    fit,
    urgency: u_score,
    value,
    semantic,
  });

  await supabase
    .from("opportunities")
    .update({ semantic_score: semantic, final_score: finalScore })
    .eq("id", opportunityId);

  await supabase
    .from("opportunity_chunks")
    .update({ final_score: finalScore })
    .eq("opportunity_id", opportunityId);

  return { status: "active", opportunity_id: opportunityId };
}
