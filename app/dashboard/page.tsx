"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStudent } from "@/hooks/useStudent";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

type Opportunity = {
  id: string;
  opp_type: string | null;
  org_name: string | null;
  deadline: string | null;
  deadline_ambiguous: boolean;
  funding_type: string | null;
  geo_scope: string | null;
  application_link: string | null;
  benefits: string | null;
  cgpa_required: number | null;
  degree_required: string | null;
  skills_required: string[];
  documents_required: string[];
  eligibility_raw: string | null;
  profile_fit_score: number | null;
  urgency_score: number | null;
  value_score: number | null;
  semantic_score: number | null;
  final_score: number | null;
  explanation: string | null;
  action_checklist: string[];
  urgency_flag: "Red" | "Orange" | "Yellow" | "Green" | null;
  status: string;
  inferred_fields: string[];
  contact_email: string | null;
  contact_phone: string | null;
  contact_person: string | null;
  evidence_quotes: { quote: string; supports: string }[] | null;
};

type StudentProfile = {
  id: string;
  cgpa: number | null;
  degree: string | null;
};

// Mirrors lib/score.ts degreeRank(). Client-side copy so we can derive the
// "why ineligible" reason without a round-trip to the server.
const DEGREE_RANK_RX: [RegExp, number][] = [
  [/\bphd\b|\bph\.d\b|\bdoctor(ate|al)\b/i, 3],
  [/\bmasters?\b|\bm\.?sc\b|\bm\.?s\b|\bm\.?a\b|\bmba\b|\bgraduate\b/i, 2],
  [/\bbachelors?\b|\bb\.?sc\b|\bb\.?s\b|\bb\.?a\b|\bundergraduate\b/i, 1],
];

function degreeRankClient(d: string | null): number | null {
  if (!d) return null;
  for (const [rx, rank] of DEGREE_RANK_RX) {
    if (rx.test(d)) return rank;
  }
  return null;
}

function ineligibilityReason(
  student: StudentProfile | null,
  opp: Opportunity,
): string | null {
  if (!student) return null;
  if (
    opp.cgpa_required !== null &&
    student.cgpa !== null &&
    student.cgpa < opp.cgpa_required - 0.01
  ) {
    return `Your CGPA (${student.cgpa.toFixed(2)}) is below the required ${opp.cgpa_required.toFixed(2)}.`;
  }
  const reqRank = degreeRankClient(opp.degree_required);
  const stdRank = degreeRankClient(student.degree);
  if (reqRank && stdRank && reqRank > stdRank) {
    return `Requires ${opp.degree_required} — your profile lists ${student.degree}.`;
  }
  // Fallback when we can't pinpoint the exact rule (e.g. eligibility text is
  // free-form and the pipeline marked it based on other signals).
  return opp.eligibility_raw
    ? `Check eligibility: ${opp.eligibility_raw}`
    : null;
}

const URGENCY_TONE: Record<string, "red" | "orange" | "yellow" | "green"> = {
  Red: "red",
  Orange: "orange",
  Yellow: "yellow",
  Green: "green",
};

const URGENCY_PILLS: {
  value: "all" | "Red" | "Orange" | "Yellow" | "Green";
  label: string;
  title: string;
  dot: string;
  activeBg: string;
  activeText: string;
}[] = [
  {
    value: "all",
    label: "All",
    title: "All urgencies",
    dot: "",
    activeBg: "bg-zinc-900 dark:bg-zinc-50",
    activeText: "text-zinc-50 dark:text-zinc-900",
  },
  {
    value: "Red",
    label: "Red",
    title: "Due in ≤ 3 days",
    dot: "bg-red-500",
    activeBg: "bg-red-600",
    activeText: "text-white",
  },
  {
    value: "Orange",
    label: "Orange",
    title: "Due in ≤ 7 days",
    dot: "bg-orange-500",
    activeBg: "bg-orange-500",
    activeText: "text-white",
  },
  {
    value: "Yellow",
    label: "Yellow",
    title: "Due in ≤ 14 days",
    dot: "bg-yellow-400",
    activeBg: "bg-yellow-500",
    activeText: "text-white",
  },
  {
    value: "Green",
    label: "Green",
    title: "More than 14 days",
    dot: "bg-green-500",
    activeBg: "bg-green-600",
    activeText: "text-white",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { studentId, isAuthenticated, hydrated } = useStudent();
  const [data, setData] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const [showExpired, setShowExpired] = useState(false);
  const [showIneligible, setShowIneligible] = useState(false);
  const [knownTypes, setKnownTypes] = useState<string[]>([]);
  const [detail, setDetail] = useState<Opportunity | null>(null);
  const [student, setStudent] = useState<StudentProfile | null>(null);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        student_id: studentId,
        status: "active",
        include_expired: showExpired ? "1" : "0",
        include_ineligible: showIneligible ? "1" : "0",
      });
      if (filterType !== "all") qs.set("type", filterType);
      if (filterUrgency !== "all") qs.set("urgency", filterUrgency);
      const res = await fetch(`/api/opportunities?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load");
        return;
      }
      setData(json.opportunities ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [studentId, filterType, filterUrgency, showExpired, showIneligible]);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace("/signin");
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch the student profile once per session so we can show a precise
  // "why ineligible" reason on cards (e.g. "your CGPA 3.4 < required 3.5").
  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/profile?student_id=${encodeURIComponent(studentId)}`,
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          profile?: { id: string; cgpa: number | null; degree: string | null };
        };
        if (json.profile) {
          setStudent({
            id: json.profile.id,
            cgpa: json.profile.cgpa,
            degree: json.profile.degree,
          });
        }
      } catch {
        // non-fatal: ineligible cards just won't have the precise reason line
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  // Load the stable list of types once (ignoring current filters) so the Type
  // dropdown doesn't collapse to only what the current filter allows.
  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({
          student_id: studentId,
          status: "all",
          include_expired: "1",
          include_ineligible: "1",
        });
        const res = await fetch(`/api/opportunities?${qs.toString()}`);
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { opportunities?: Opportunity[] };
        const set = new Set<string>();
        (json.opportunities ?? []).forEach((o) => {
          if (o.opp_type) set.add(o.opp_type);
        });
        setKnownTypes(Array.from(set).sort());
      } catch {
        // non-fatal: the dropdown will just stay empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  // Always keep the currently-selected type in the dropdown even if it has
  // been filtered out of `knownTypes` for some reason.
  const typeOptions = useMemo(() => {
    const set = new Set(knownTypes);
    if (filterType !== "all") set.add(filterType);
    return Array.from(set).sort();
  }, [knownTypes, filterType]);

  const filtersActive =
    filterType !== "all" ||
    filterUrgency !== "all" ||
    showExpired ||
    showIneligible;

  const resetFilters = () => {
    setFilterType("all");
    setFilterUrgency("all");
    setShowExpired(false);
    setShowIneligible(false);
  };

  const activeCount = data.filter((o) => o.status === "active").length;
  const expiredCount = data.filter((o) => o.status === "expired").length;
  const ineligibleCount = data.filter((o) => o.status === "ineligible").length;

  if (!hydrated || !studentId) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
          Loading…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your opportunities</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Ranked by fit + urgency + value + semantic match.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <Card>
        <CardContent className="divide-y divide-zinc-200 p-0 dark:divide-zinc-800">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Type
              </span>
              <SelectWithCaret
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-44"
                aria-label="Filter by opportunity type"
              >
                <option value="all">All types</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </SelectWithCaret>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Urgency
              </span>
              <div
                role="radiogroup"
                aria-label="Filter by urgency"
                className="inline-flex items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                {URGENCY_PILLS.map((p) => {
                  const selected = filterUrgency === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      title={p.title}
                      onClick={() => setFilterUrgency(p.value)}
                      className={
                        "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors " +
                        (selected
                          ? `${p.activeBg} ${p.activeText} shadow-sm`
                          : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-950 dark:hover:text-zinc-100")
                      }
                    >
                      {p.dot ? (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${p.dot} ${selected ? "opacity-90 ring-2 ring-white/40" : ""}`}
                          aria-hidden="true"
                        />
                      ) : null}
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Switch checked={showExpired} onCheckedChange={setShowExpired} />
                <span>Expired</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Switch
                  checked={showIneligible}
                  onCheckedChange={setShowIneligible}
                />
                <span>Ineligible</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                {loading ? (
                  "Loading…"
                ) : (
                  <>
                    Showing{" "}
                    <b className="text-zinc-900 dark:text-zinc-100">
                      {data.length}
                    </b>{" "}
                    opportunit{data.length === 1 ? "y" : "ies"}
                    {filtersActive ? " (filtered)" : ""}
                  </>
                )}
              </span>
              {activeCount > 0 ? (
                <Badge tone="green">{activeCount} active</Badge>
              ) : null}
              {expiredCount > 0 ? (
                <Badge tone="muted">{expiredCount} expired</Badge>
              ) : null}
              {ineligibleCount > 0 ? (
                <Badge tone="red">{ineligibleCount} ineligible</Badge>
              ) : null}
            </div>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!filtersActive}
              className="text-xs font-medium text-zinc-600 underline-offset-4 hover:text-blue-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline disabled:hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-blue-400 dark:disabled:hover:text-zinc-400"
            >
              Reset filters
            </button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="p-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {loading && data.length === 0 ? <SkeletonList /> : null}

          {!loading && data.length === 0 ? (
            <Card>
              <CardContent className="space-y-3 p-8 text-center">
                {filtersActive ? (
                  <>
                    <p className="text-sm text-zinc-500">
                      No opportunities match these filters.
                    </p>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-sm font-medium text-blue-600 underline-offset-4 hover:underline dark:text-blue-400"
                    >
                      Reset filters
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-base font-semibold">
                      No opportunities yet
                    </h3>
                    <p className="mx-auto max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                      Sync your Gmail inbox or paste an email manually. We&apos;ll
                      classify, extract, score, and explain each one.
                    </p>
                    <div className="flex justify-center pt-1">
                      <Link
                        href="/connect"
                        className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        Go to Connect →
                      </Link>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : null}

          {data.map((o) => (
            <OppCard
              key={o.id}
              opp={o}
              student={student}
              onOpen={() => setDetail(o)}
            />
          ))}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <ScoreLegend />
        </aside>
      </div>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          {detail ? <DetailView opp={detail} student={student} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SkeletonList() {
  // Three placeholder rows that mimic the OppCard footprint while the network
  // request is in flight. Avoids the "is the page broken?" feeling that a
  // single tiny "Loading…" line gives during the 30-60s first-time sync.
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <div className="flex animate-pulse gap-5 p-6">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-44 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="ml-auto h-5 w-14 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="space-y-1.5">
                <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-11/12 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-3 w-9/12 rounded bg-zinc-200 dark:bg-zinc-800" />
              </div>
              <div className="flex gap-3 pt-1">
                <div className="h-8 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                <div className="h-8 w-16 rounded-md bg-zinc-200 dark:bg-zinc-800" />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div className="h-16 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-2.5 w-14 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function SelectWithCaret({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative inline-block ${className ?? ""}`}>
      <Select {...props} className="h-9 w-full pr-8">
        {children}
      </Select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 8l4 4 4-4" />
      </svg>
    </div>
  );
}

function ScoreLegend() {
  const bands: {
    range: string;
    label: string;
    tone: "red" | "orange" | "yellow" | "green" | "default" | "muted";
    hint: string;
  }[] = [
    {
      range: "80–100",
      label: "Apply today",
      tone: "green",
      hint: "Rare. Full funding + known org + tight deadline + your profile closely matches the opportunity text.",
    },
    {
      range: "65–80",
      label: "Strong match",
      tone: "green",
      hint: "Most 'clear winners' live here. Apply this week.",
    },
    {
      range: "50–65",
      label: "Good match",
      tone: "yellow",
      hint: "Worth applying if you have bandwidth and docs ready.",
    },
    {
      range: "35–50",
      label: "Fair match",
      tone: "orange",
      hint: "Marginal — maybe missing funding info, sparse eligibility, or so-so semantic overlap.",
    },
    {
      range: "0–35",
      label: "Weak / skip",
      tone: "muted",
      hint: "Wrong type, unknown org, or the content barely overlaps with your profile.",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Score legend</CardTitle>
        <CardDescription>
          How to read the numbers on each opportunity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <ul className="space-y-3">
          {bands.map((b) => (
            <li key={b.range} className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge tone={b.tone} className="shrink-0">
                  {b.range}
                </Badge>
                <span className="font-medium">{b.label}</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {b.hint}
              </p>
            </li>
          ))}
        </ul>

        <Separator />

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Why scores rarely touch 100
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            A 100 would need <em>every</em> signal maxed at the same time:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-500 dark:text-zinc-400">
            <li>
              <b>Urgency = 1.0</b> only in the final ≤3 days before deadline.
            </li>
            <li>
              <b>Semantic</b> uses OpenAI <code>text-embedding-3-small</code>,
              which caps around cosine 0.6 on non-duplicate text. We stretch
              [0.2, 0.6] → [0, 1] to keep it useful, but sparse opportunity
              bodies still land mid-band.
            </li>
            <li>
              <b>Fit</b> averages only the signals the email actually declares.
              Sparse emails (no CGPA, no skills listed) settle at a neutral
              partial-credit value.
            </li>
            <li>
              <b>Value</b> needs a recognized org (prestige in our seed), full
              funding, and a geo match — all three.
            </li>
          </ul>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Realistic top in production: ~85. Realistic great match: 65–80.
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Formula
          </h4>
          <pre className="whitespace-pre-wrap rounded bg-zinc-50 p-2 text-[11px] leading-snug text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
{`deterministic = 0.30*fit
              + 0.30*urgency
              + 0.40*value

final = 0.70*deterministic
      + 0.30*semantic*`}
          </pre>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            *semantic is the stretched cosine between your narrated profile
            and the opportunity chunks (RAG).
          </p>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Urgency flag
          </h4>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge tone="red">Red ≤ 3d</Badge>
            <Badge tone="orange">Orange ≤ 7d</Badge>
            <Badge tone="yellow">Yellow ≤ 14d</Badge>
            <Badge tone="green">Green &gt; 14d</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function scoreTone(score: number): {
  ring: string;
  text: string;
  label: string;
} {
  if (score >= 80)
    return {
      ring: "border-green-500 dark:border-green-400",
      text: "text-green-700 dark:text-green-300",
      label: "Apply today",
    };
  if (score >= 65)
    return {
      ring: "border-green-400 dark:border-green-500",
      text: "text-green-700 dark:text-green-300",
      label: "Strong match",
    };
  if (score >= 50)
    return {
      ring: "border-yellow-400 dark:border-yellow-500",
      text: "text-yellow-700 dark:text-yellow-300",
      label: "Good match",
    };
  if (score >= 35)
    return {
      ring: "border-orange-400 dark:border-orange-500",
      text: "text-orange-700 dark:text-orange-300",
      label: "Fair match",
    };
  return {
    ring: "border-zinc-300 dark:border-zinc-700",
    text: "text-zinc-500 dark:text-zinc-400",
    label: "Weak",
  };
}

function ScoreOrb({ score }: { score: number }) {
  const { ring, text, label } = scoreTone(score);
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full border-4 bg-white dark:bg-zinc-950 ${ring}`}
      >
        <span className={`text-xl font-bold tabular-nums ${text}`}>
          {score}
        </span>
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
}

function OppCard({
  opp,
  student,
  onOpen,
}: {
  opp: Opportunity;
  student: StudentProfile | null;
  onOpen: () => void;
}) {
  const score = Math.round(((opp.final_score ?? 0) * 100 + Number.EPSILON));
  const tone = opp.urgency_flag ? URGENCY_TONE[opp.urgency_flag] : undefined;
  const statusTone =
    opp.status === "expired"
      ? "muted"
      : opp.status === "ineligible"
        ? "red"
        : "default";

  const ineligReason =
    opp.status === "ineligible" ? ineligibilityReason(student, opp) : null;

  return (
    <Card className="transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-6">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <h3 className="text-base font-semibold tracking-tight">
                {opp.org_name ?? "Unknown org"}
              </h3>
              {opp.opp_type ? (
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  · {opp.opp_type}
                </span>
              ) : null}
              {tone ? (
                <Badge tone={tone} className="ml-auto sm:ml-0">
                  {opp.urgency_flag}
                </Badge>
              ) : null}
              {opp.status !== "active" ? (
                <Badge tone={statusTone}>{opp.status}</Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                {opp.deadline
                  ? `Deadline: ${opp.deadline}`
                  : "Deadline not stated"}
                {opp.funding_type ? ` · ${opp.funding_type} funding` : ""}
                {opp.geo_scope ? ` · ${opp.geo_scope}` : ""}
              </span>
              {opp.deadline && opp.deadline_ambiguous ? (
                <Badge
                  tone="yellow"
                  title="The email didn't state the deadline clearly — this date is our best guess."
                >
                  Deadline unclear
                </Badge>
              ) : null}
            </div>
          </div>

          {ineligReason ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <span className="font-semibold">Ineligible:</span> {ineligReason}
            </p>
          ) : null}

          {opp.explanation ? (
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {opp.explanation}
            </p>
          ) : (
            <p className="text-sm text-zinc-500">
              Explanation pending — will appear after the next sync.
            </p>
          )}

          {opp.inferred_fields?.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {opp.inferred_fields.map((f) => (
                <Badge
                  key={f}
                  tone="muted"
                  title="This field wasn't in the email. We filled it from our organization knowledge base (RAG lookup)."
                  className="gap-1 font-normal"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-400"
                  />
                  Inferred from HEC profile: {f}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1 sm:gap-4">
            <Button variant="outline" size="sm" onClick={onOpen}>
              View details
            </Button>
            {opp.application_link ? (
              <a
                href={opp.application_link}
                target="_blank"
                rel="noreferrer noopener"
                className="break-all text-sm font-medium underline-offset-4 hover:underline"
              >
                Apply ↗
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 justify-start sm:justify-center">
          <ScoreOrb score={score} />
        </div>
      </div>
    </Card>
  );
}

function DetailView({
  opp,
  student,
}: {
  opp: Opportunity;
  student: StudentProfile | null;
}) {
  const ineligReason =
    opp.status === "ineligible" ? ineligibilityReason(student, opp) : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {opp.org_name ?? "Unknown org"}{" "}
          <span className="text-zinc-500">
            {opp.opp_type ? `· ${opp.opp_type}` : ""}
          </span>
        </DialogTitle>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
          <span>
            {opp.deadline ? `Deadline ${opp.deadline}` : "No deadline stated"}
          </span>
          {opp.deadline && opp.deadline_ambiguous ? (
            <Badge
              tone="yellow"
              title="The email didn't state the deadline clearly — this date is our best guess."
            >
              Deadline unclear
            </Badge>
          ) : null}
        </div>
      </DialogHeader>

      <div className="space-y-5 text-sm">
        {ineligReason ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <span className="font-semibold">Ineligible:</span> {ineligReason}
          </p>
        ) : null}

        {opp.explanation ? (
          <p className="text-zinc-700 dark:text-zinc-300">{opp.explanation}</p>
        ) : null}

        {opp.evidence_quotes && opp.evidence_quotes.length > 0 ? (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              From the email
            </h3>
            <ul className="space-y-2.5">
              {opp.evidence_quotes.map((q, i) => (
                <li
                  key={i}
                  className="border-l-2 border-zinc-200 pl-3 dark:border-zinc-800"
                >
                  <p className="text-[13px] italic leading-relaxed text-zinc-500 dark:text-zinc-400">
                    &ldquo;{q.quote}&rdquo;
                  </p>
                  {q.supports ? (
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      {q.supports}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Separator />

        <div>
          <h3 className="mb-2 text-sm font-semibold">Action checklist</h3>
          {opp.action_checklist?.length ? (
            <ul className="list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
              {opp.action_checklist.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-zinc-500">Checklist not yet generated.</p>
          )}
        </div>

        <Separator />

        <div className="grid gap-3 md:grid-cols-2">
          <Detail label="Funding" value={opp.funding_type} />
          <Detail label="Scope" value={opp.geo_scope} />
          <Detail
            label="CGPA required"
            value={opp.cgpa_required?.toString() ?? null}
          />
          <Detail label="Degree required" value={opp.degree_required} />
          <Detail label="Benefits" value={opp.benefits} />
          <Detail
            label="Documents"
            value={opp.documents_required?.join(", ") || null}
          />
          <Detail
            label="Skills expected"
            value={opp.skills_required?.join(", ") || null}
          />
          <Detail label="Eligibility (raw)" value={opp.eligibility_raw} />
        </div>

        {opp.contact_email || opp.contact_phone || opp.contact_person ? (
          <>
            <Separator />
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Contact
              </h3>
              <div className="grid gap-3 md:grid-cols-3">
                {opp.contact_person ? (
                  <Detail label="Contact person" value={opp.contact_person} />
                ) : null}
                {opp.contact_email ? (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      Email
                    </div>
                    <a
                      href={`mailto:${opp.contact_email}`}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {opp.contact_email}
                    </a>
                  </div>
                ) : null}
                {opp.contact_phone ? (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">
                      Phone
                    </div>
                    <a
                      href={`tel:${opp.contact_phone.replace(/\s+/g, "")}`}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {opp.contact_phone}
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        <Separator />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Score label="Fit" value={opp.profile_fit_score} />
          <Score label="Urgency" value={opp.urgency_score} />
          <Score label="Value" value={opp.value_score} />
          <Score label="Semantic" value={opp.semantic_score} />
        </div>

        {opp.application_link ? (
          <div>
            <a
              href={opp.application_link}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
            >
              Open application ↗
            </a>
          </div>
        ) : null}
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  const pct = Math.round(((value ?? 0) * 100 + Number.EPSILON));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">{label}</span>
        <span className="font-semibold">{value === null ? "—" : pct}</span>
      </div>
      <Progress value={pct} />
    </div>
  );
}
