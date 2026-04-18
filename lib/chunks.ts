import type { ChunkType } from "@/types";
import type { Extracted } from "./extract";

export type OppChunk = { type: ChunkType; text: string };

export function buildChunks(
  subject: string | null,
  extracted: Extracted,
): OppChunk[] {
  const chunks: OppChunk[] = [];
  const header = [
    subject,
    extracted.org_name,
    extracted.opp_type,
    extracted.geo_scope,
    extracted.funding_type ? `${extracted.funding_type} funding` : null,
  ]
    .filter(Boolean)
    .join(" | ");
  if (header) chunks.push({ type: "header", text: header });

  if (extracted.eligibility_raw) {
    chunks.push({ type: "eligibility", text: extracted.eligibility_raw });
  } else if (extracted.degree_required || extracted.cgpa_required) {
    const parts: string[] = [];
    if (extracted.degree_required)
      parts.push(`Degree: ${extracted.degree_required}`);
    if (extracted.cgpa_required)
      parts.push(`Minimum CGPA: ${extracted.cgpa_required}`);
    if (extracted.skills_required?.length)
      parts.push(`Skills: ${extracted.skills_required.join(", ")}`);
    if (parts.length) chunks.push({ type: "eligibility", text: parts.join(". ") });
  }

  if (extracted.benefits) {
    chunks.push({ type: "benefits", text: extracted.benefits });
  }

  if (extracted.documents_required?.length) {
    chunks.push({
      type: "documents",
      text: `Documents required: ${extracted.documents_required.join(", ")}`,
    });
  }

  if (extracted.deadline) {
    chunks.push({
      type: "deadline",
      text: `Deadline: ${extracted.deadline}${extracted.deadline_ambiguous ? " (ambiguous)" : ""}`,
    });
  }

  return chunks;
}
