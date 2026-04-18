import { createServerSupabase } from "./supabase";
import { embedOne, pgvectorLiteral } from "./langchain";
import type { Extracted } from "./extract";

const SIMILARITY_THRESHOLD = 0.78;

export type OrgMatch = {
  org_knowledge_id: string;
  org_name: string;
  prestige_score: number | null;
  known_funding_type: string | null;
  typical_scope: string | null;
  description: string | null;
  similarity: number;
};

export async function lookupOrg(orgName: string | null): Promise<OrgMatch | null> {
  if (!orgName) return null;
  const supabase = createServerSupabase();
  const vec = await embedOne(orgName);
  const { data, error } = await supabase.rpc("match_org_knowledge", {
    query_embedding: pgvectorLiteral(vec),
    match_count: 1,
  });
  if (error || !data || data.length === 0) return null;
  const top = data[0] as OrgMatch;
  if (top.similarity < SIMILARITY_THRESHOLD) return null;
  return top;
}

/**
 * Fill extracted fields from org knowledge. Returns the names of fields that were filled.
 */
export function fillFromOrg(
  extracted: Extracted,
  org: OrgMatch | null,
): { extracted: Extracted; inferred: string[]; prestige: number | null } {
  const inferred: string[] = [];
  if (!org) return { extracted, inferred, prestige: null };
  const copy: Extracted = { ...extracted };
  if (!copy.funding_type && org.known_funding_type) {
    const ft = org.known_funding_type;
    if (ft === "Full" || ft === "Partial" || ft === "None") {
      copy.funding_type = ft;
      inferred.push("funding_type");
    }
  }
  if (!copy.geo_scope && org.typical_scope) {
    const gs = org.typical_scope;
    if (gs === "Local" || gs === "National" || gs === "International") {
      copy.geo_scope = gs;
      inferred.push("geo_scope");
    }
  }
  if (!copy.org_name && org.org_name) {
    copy.org_name = org.org_name;
    inferred.push("org_name");
  }
  return { extracted: copy, inferred, prestige: org.prestige_score };
}
