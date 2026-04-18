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

export function urgencyScore(deadline: string | null): number {
  const days = daysUntil(deadline);
  if (days === null) return 0.3;
  if (days < 0) return 0;
  if (days <= 3) return 1.0;
  if (days <= 7) return 0.8;
  if (days <= 14) return 0.6;
  if (days <= 30) return 0.4;
  return 0.2;
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

const DEGREE_RANK: Record<string, number> = {
  BS: 1,
  BSc: 1,
  Bachelors: 1,
  Bachelor: 1,
  MS: 2,
  MSc: 2,
  Masters: 2,
  Master: 2,
  MBA: 2,
  PhD: 3,
  Doctorate: 3,
};

function degreeRank(d: string | null): number | null {
  if (!d) return null;
  const key = Object.keys(DEGREE_RANK).find((k) =>
    d.toLowerCase().includes(k.toLowerCase()),
  );
  return key ? (DEGREE_RANK[key] ?? null) : null;
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
  const prestigeNorm = prestige ? prestige / 10 : 0.3;
  let funding = 0.3;
  if (opp.funding_type === "Full") funding = 1;
  else if (opp.funding_type === "Partial") funding = 0.6;
  else if (opp.funding_type === "None") funding = 0.2;
  let geo = 0.5;
  if (opp.geo_scope && student.location_pref) {
    const sp = student.location_pref.toLowerCase();
    const gs = opp.geo_scope.toLowerCase();
    if (sp.includes(gs) || gs.includes(sp)) geo = 1;
    else if (sp.includes("international") || gs.includes("international")) geo = 0.7;
  }
  return prestigeNorm * 0.5 + funding * 0.3 + geo * 0.2;
}

export function blendScores(input: {
  fit: number;
  urgency: number;
  value: number;
  semantic: number | null;
}): number {
  const deterministic =
    input.fit * 0.4 + input.urgency * 0.35 + input.value * 0.25;
  if (input.semantic === null) return deterministic;
  return deterministic * 0.6 + input.semantic * 0.4;
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
