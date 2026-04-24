import type { Student, UrgencyFlag } from "@/types";
import type { Extracted } from "./extract";

export function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  d.setUTCHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

// Matches LLM-extracted opp_type strings that describe rolling-admission
// programs (no fixed deadline). Switched from an exact-string Set to a regex
// because the LLM frequently outputs variants the Set never matched —
// "summer internship", "RA position", "research opportunity", "paid internship",
// etc. — silently dragging genuinely-rolling opportunities to the low-urgency
// fallback (0.35) instead of the rolling baseline (0.55).
const ROLLING_OPP_RX =
  /\b(internship|mentorship|research|assistantship|job|position|fellowship\s+program)\b/i;

export function urgencyScore(
  deadline: string | null,
  oppType: string | null = null,
): number {
  const days = daysUntil(deadline);
  if (days === null) {
    // No deadline is normal for rolling-admission opportunities (internships,
    // mentorships, research). Don't penalize them as heavily as a missed date.
    if (oppType && ROLLING_OPP_RX.test(oppType)) return 0.55;
    return 0.35;
  }
  if (days < 0) return 0;
  if (days <= 3) return 1.0;
  if (days <= 7) return 0.85;
  if (days <= 14) return 0.7;
  if (days <= 30) return 0.5;
  return 0.3;
}

export function urgencyFlag(deadline: string | null): UrgencyFlag {
  const days = daysUntil(deadline);
  if (days === null) return "Yellow";
  if (days <= 3) return "Red";
  if (days <= 7) return "Orange";
  if (days <= 14) return "Yellow";
  return "Green";
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const A = new Set(a.map((x) => x.toLowerCase().trim()));
  const B = new Set(b.map((x) => x.toLowerCase().trim()));
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Ordered by specificity: check longer keys first so "MSc" wins over "MS"
// inside "Masters of Science", etc.
const DEGREE_RANK: [RegExp, number][] = [
  [/\bphd\b|\bph\.d\b|\bdoctor(ate|al)\b/i, 3],
  [/\bmasters?\b|\bm\.?sc\b|\bm\.?s\b|\bm\.?a\b|\bmba\b|\bgraduate\b/i, 2],
  [/\bbachelors?\b|\bb\.?sc\b|\bb\.?s\b|\bb\.?a\b|\bundergraduate\b/i, 1],
];

function degreeRank(d: string | null): number | null {
  if (!d) return null;
  for (const [rx, rank] of DEGREE_RANK) {
    if (rx.test(d)) return rank;
  }
  return null;
}

export function profileFitScore(
  student: Student,
  opp: Pick<
    Extracted,
    "cgpa_required" | "degree_required" | "skills_required" | "opp_type"
  >,
): number {
  let score = 0;
  let weight = 0;

  if (opp.cgpa_required && student.cgpa) {
    const head = student.cgpa - opp.cgpa_required;
    score += Math.max(0, Math.min(1, 0.5 + head * 0.8)) * 0.3;
    weight += 0.3;
  }

  const reqRank = degreeRank(opp.degree_required);
  const stdRank = degreeRank(student.degree);
  if (reqRank && stdRank) {
    score += (reqRank === stdRank ? 1 : reqRank > stdRank ? 0.2 : 0.7) * 0.25;
    weight += 0.25;
  }

  if (opp.skills_required?.length && student.skills?.length) {
    score += jaccard(student.skills, opp.skills_required) * 0.3;
    weight += 0.3;
  } else {
    score += 0.3 * 0.3;
    weight += 0.3;
  }

  if (opp.opp_type && student.preferred_types?.length) {
    const match = student.preferred_types.some((t) =>
      t.toLowerCase().includes(opp.opp_type!.toLowerCase()),
    );
    score += (match ? 1 : 0.3) * 0.15;
    weight += 0.15;
  } else {
    score += 0.3 * 0.15;
    weight += 0.15;
  }

  return weight === 0 ? 0.3 : score / weight;
}

export function valueScore(
  student: Student,
  opp: Pick<Extracted, "funding_type" | "geo_scope">,
  prestige: number | null,
): number {
  // Unknown orgs (not in the seeded org_knowledge) used to get prestige=0,
  // which heavily penalized perfectly reasonable local internships just for
  // not being famous. Baseline unknowns at 0.5.
  const prestigeNorm = prestige ? prestige / 10 : 0.5;
  let funding = 0.5; // unknown funding_type is neutral, not penalized
  if (opp.funding_type === "Full") funding = 1;
  else if (opp.funding_type === "Partial") funding = 0.7;
  else if (opp.funding_type === "None") funding = 0.35;
  let geo = 0.6;
  if (opp.geo_scope && student.location_pref) {
    const sp = student.location_pref.toLowerCase();
    const gs = opp.geo_scope.toLowerCase();
    if (sp.includes(gs) || gs.includes(sp)) geo = 1;
    else if (sp.includes("international") || gs.includes("international")) geo = 0.75;
  }
  return prestigeNorm * 0.4 + funding * 0.35 + geo * 0.25;
}

/**
 * Stretch raw cosine similarity into the full [0,1] band.
 * text-embedding-3-small rarely produces cosines above ~0.65 for non-duplicate
 * text, so the "natural" high-water mark is around 0.6. We remap [0.2, 0.6]
 * linearly into [0, 1] and clamp outside.
 */
export function stretchSemantic(raw: number | null): number | null {
  if (raw === null) return null;
  const LO = 0.2;
  const HI = 0.6;
  const stretched = (raw - LO) / (HI - LO);
  return Math.max(0, Math.min(1, stretched));
}

export function blendScores(input: {
  fit: number;
  urgency: number;
  value: number;
  semantic: number | null;
}): number {
  // Deterministic blend — value is weighted highest because funding + prestige +
  // geo-alignment is what students actually care about when picking what to chase.
  const deterministic =
    input.fit * 0.3 + input.urgency * 0.3 + input.value * 0.4;
  if (input.semantic === null) return deterministic;
  const semanticStretched = stretchSemantic(input.semantic) ?? 0;
  // Lower semantic weight vs. the old 0.4 — embedding cosines are noisy at this
  // scale and shouldn't drag down an otherwise strong deterministic match.
  return deterministic * 0.7 + semanticStretched * 0.3;
}

export function isEligible(
  student: Student,
  opp: Pick<Extracted, "cgpa_required" | "degree_required">,
): { eligible: boolean; reason?: string } {
  if (
    opp.cgpa_required &&
    student.cgpa !== null &&
    student.cgpa < opp.cgpa_required - 0.01
  ) {
    return { eligible: false, reason: "cgpa_below_required" };
  }
  const reqRank = degreeRank(opp.degree_required);
  const stdRank = degreeRank(student.degree);
  if (reqRank && stdRank && reqRank > stdRank) {
    return { eligible: false, reason: "degree_below_required" };
  }
  return { eligible: true };
}
