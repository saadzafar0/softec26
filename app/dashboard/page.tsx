"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStudentId } from "@/hooks/useStudent";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  DialogDescription,
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
};

const URGENCY_TONE: Record<string, "red" | "orange" | "yellow" | "green"> = {
  Red: "red",
  Orange: "orange",
  Yellow: "yellow",
  Green: "green",
};

export default function DashboardPage() {
  const { studentId } = useStudentId();
  const [data, setData] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");
  const [showExpired, setShowExpired] = useState(false);
  const [showIneligible, setShowIneligible] = useState(false);
  const [detail, setDetail] = useState<Opportunity | null>(null);

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
    load();
  }, [load]);

  const types = useMemo(() => {
    const s = new Set<string>();
    data.forEach((o) => o.opp_type && s.add(o.opp_type));
    return Array.from(s).sort();
  }, [data]);

  if (!studentId) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-zinc-600 dark:text-zinc-400">
          Save your profile first on the Profile tab to see your ranked
          opportunities.
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
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Type</span>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-9 w-44"
            >
              <option value="all">All</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Urgency</span>
            <Select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value)}
              className="h-9 w-36"
            >
              <option value="all">All</option>
              <option value="Red">Red</option>
              <option value="Orange">Orange</option>
              <option value="Yellow">Yellow</option>
              <option value="Green">Green</option>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={showExpired} onCheckedChange={setShowExpired} />
            <span className="text-sm">Show expired</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={showIneligible}
              onCheckedChange={setShowIneligible}
            />
            <span className="text-sm">Show ineligible</span>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="p-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      ) : null}

      {data.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-zinc-500">
            No opportunities yet. Head to Connect and sync Gmail or paste an
            email.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {data.map((o) => (
          <OppCard key={o.id} opp={o} onOpen={() => setDetail(o)} />
        ))}
      </div>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          {detail ? <DetailView opp={detail} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OppCard({
  opp,
  onOpen,
}: {
  opp: Opportunity;
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
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>
              {opp.org_name ?? "Unknown org"}
              {opp.opp_type ? (
                <span className="ml-2 text-zinc-500">· {opp.opp_type}</span>
              ) : null}
            </CardTitle>
            <CardDescription>
              {opp.deadline
                ? `Deadline: ${opp.deadline}${opp.deadline_ambiguous ? " (ambiguous)" : ""}`
                : "Deadline not stated"}
              {opp.funding_type ? ` · ${opp.funding_type} funding` : ""}
              {opp.geo_scope ? ` · ${opp.geo_scope}` : ""}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {tone ? (
                <Badge tone={tone}>{opp.urgency_flag}</Badge>
              ) : null}
              {opp.status !== "active" ? (
                <Badge tone={statusTone}>{opp.status}</Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Score</span>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {score}
              </span>
            </div>
            <div className="w-32">
              <Progress value={score} />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {opp.explanation ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {opp.explanation}
          </p>
        ) : (
          <p className="text-sm text-zinc-500">
            Explanation pending — will appear after the next sync.
          </p>
        )}
        {opp.inferred_fields?.length ? (
          <p className="text-xs text-zinc-500">
            Inferred from org knowledge: {opp.inferred_fields.join(", ")}
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onOpen}>
          View details
        </Button>
        {opp.application_link ? (
          <a
            href={opp.application_link}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            Apply ↗
          </a>
        ) : null}
      </CardFooter>
    </Card>
  );
}

function DetailView({ opp }: { opp: Opportunity }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {opp.org_name ?? "Unknown org"}{" "}
          <span className="text-zinc-500">
            {opp.opp_type ? `· ${opp.opp_type}` : ""}
          </span>
        </DialogTitle>
        <DialogDescription>
          {opp.deadline
            ? `Deadline ${opp.deadline}${opp.deadline_ambiguous ? " (ambiguous)" : ""}`
            : "No deadline stated"}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 text-sm">
        {opp.explanation ? (
          <p className="text-zinc-700 dark:text-zinc-300">{opp.explanation}</p>
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
