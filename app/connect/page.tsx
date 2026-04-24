"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudent } from "@/hooks/useStudent";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type ParsedEmail = {
  subject: string | null;
  sender: string | null;
  body: string;
};

function parseBatchPaste(text: string): ParsedEmail[] {
  if (!text.trim()) return [];
  const blocks = text
    .split(/^\s*-{3,}\s*$/m)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  return blocks
    .map((block) => {
      const lines = block.split(/\r?\n/);
      let subject: string | null = null;
      let sender: string | null = null;
      let i = 0;
      while (i < lines.length) {
        const m = /^\s*(subject|from)\s*:\s*(.+?)\s*$/i.exec(lines[i]);
        if (!m) break;
        const k = m[1].toLowerCase();
        const v = m[2];
        if (k === "subject" && !subject) subject = v;
        else if (k === "from" && !sender) sender = v;
        i += 1;
      }
      if (i < lines.length && lines[i].trim() === "") i += 1;
      const body = lines.slice(i).join("\n").trim();
      return { subject, sender, body };
    })
    .filter((e) => e.body.length >= 20);
}

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectInner />
    </Suspense>
  );
}

function ConnectInner() {
  const router = useRouter();
  const { studentId, isAuthenticated, hydrated, signIn, studentEmail } =
    useStudent();
  const params = useSearchParams();
  const [syncing, setSyncing] = useState(false);
  type TraceItem = {
    gmail_message_id: string;
    subject: string | null;
    sender: string | null;
    ingest:
      | "new"
      | "dup_gmail_id"
      | "dup_cleaned_hash"
      | "insert_failed";
    pipeline:
      | "skipped"
      | "noise"
      | "extract_failed"
      | "active"
      | "expired"
      | "ineligible"
      | "duplicate"
      | "error"
      | "empty"
      | "missing"
      | "no_student";
    opportunity_id?: string;
  };
  type SummaryKind = "sync" | "manual" | "reprocess" | "cleanup";
  const [summary, setSummary] = useState<{
    kind: SummaryKind;
    emails_fetched?: number;
    new_emails?: number;
    inserted?: number;
    skipped_duplicates?: number;
    opportunities_active?: number;
    items?: TraceItem[];
    reprocessed?: number;
    rescored?: number;
    raw_emails_removed?: number;
    opportunities_removed?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      router.replace("/signin");
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    const sid = params.get("student_id");
    const connected = params.get("connected");
    const errParam = params.get("error");
    if (sid && connected && studentEmail && sid !== studentId) {
      signIn(sid, studentEmail);
    }
    if (errParam) setError(decodeURIComponent(errParam));
  }, [params, signIn, studentId, studentEmail]);

  const [manualBody, setManualBody] = useState("");
  const parsedManualEmails = parseBatchPaste(manualBody);

  const startGmail = async () => {
    if (!studentId) {
      setError("Save your profile first on the Profile tab.");
      return;
    }
    setError(null);
    setNeedsReauth(false);
    try {
      const res = await fetch("/api/auth/gmail/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start OAuth");
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
  };

  const syncGmail = async () => {
    if (!studentId) return;
    setSyncing(true);
    setSummary(null);
    setError(null);
    setNeedsReauth(false);
    try {
      const res = await fetch("/api/emails/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "GMAIL_REAUTH" || res.status === 401) {
          setNeedsReauth(true);
          setError(
            "Your Gmail session expired or the token was revoked. Reconnect to keep syncing.",
          );
        } else {
          setError(data.error ?? "Sync failed");
        }
        return;
      }
      setSummary({ kind: "sync", ...data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSyncing(false);
    }
  };

  const cleanupJunk = async () => {
    if (!studentId) return;
    setSyncing(true);
    setSummary(null);
    setError(null);
    try {
      const res = await fetch("/api/emails/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Cleanup failed");
        return;
      }
      setSummary({
        kind: "cleanup",
        raw_emails_removed: data.raw_emails_removed ?? 0,
        opportunities_removed: data.opportunities_removed ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSyncing(false);
    }
  };

  const reprocessAll = async () => {
    if (!studentId) return;
    setSyncing(true);
    setSummary(null);
    setError(null);
    try {
      // 1. Re-run pipeline on noise rows (may promote some to active opportunities).
      const reprocessRes = await fetch("/api/emails/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, only_noise: true }),
      });
      const reprocessData = await reprocessRes.json();
      if (!reprocessRes.ok) {
        setError(reprocessData.error ?? "Reprocess failed");
        return;
      }

      // 2. Rescore every opportunity (including ones just promoted above).
      const rescoreRes = await fetch("/api/opportunities/rescore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, include_hidden: true }),
      });
      const rescoreData = await rescoreRes.json();
      if (!rescoreRes.ok) {
        setError(rescoreData.error ?? "Rescore failed");
        return;
      }

      const rescoredItems = (rescoreData.items ?? []) as {
        opportunity_id: string;
        org_name: string | null;
        status: string;
        final_score: number;
        old_final_score: number | null;
      }[];

      setSummary({
        kind: "reprocess",
        reprocessed: reprocessData.reprocessed ?? 0,
        rescored: rescoreData.rescored ?? 0,
        opportunities_active: rescoredItems.filter((i) => i.status === "active")
          .length,
        items: rescoredItems.map((i) => ({
          gmail_message_id: i.opportunity_id,
          subject: i.org_name
            ? `${i.org_name} — score ${Math.round(i.final_score * 100)}${
                i.old_final_score !== null
                  ? ` (was ${Math.round(i.old_final_score * 100)})`
                  : ""
              }`
            : `score ${Math.round(i.final_score * 100)}`,
          sender: null,
          ingest: "new" as const,
          pipeline: i.status as TraceItem["pipeline"],
          opportunity_id: i.opportunity_id,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSyncing(false);
    }
  };

  const submitManual = async () => {
    if (!studentId) {
      setError("Save your profile first on the Profile tab.");
      return;
    }
    const emails = parsedManualEmails;
    if (emails.length === 0) {
      setError("Paste at least one email body (20+ characters).");
      return;
    }
    if (emails.length > 20) {
      setError(`Too many emails (${emails.length}). Max 20 per paste.`);
      return;
    }
    setSyncing(true);
    setSummary(null);
    setError(null);
    try {
      const res = await fetch("/api/emails/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, emails }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submit failed");
        return;
      }
      setSummary({ kind: "manual", ...data });
      setManualBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Bring emails in</h1>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
          Gmail is already connected via sign-in. Sync 15 recent opportunity
          emails, paste one manually, or re-connect if your session expires.
          Each email is cleaned, classified, extracted, scored, and explained.
        </p>
        {studentEmail ? (
          <Badge tone="green">Connected as {studentEmail}</Badge>
        ) : null}
      </div>

      <Tabs defaultValue="gmail">
        <TabsList>
          <TabsTrigger value="gmail">Gmail</TabsTrigger>
          <TabsTrigger value="manual">Manual paste</TabsTrigger>
        </TabsList>

        <TabsContent value="gmail">
          <Card>
            <CardHeader>
              <CardTitle>Gmail (read-only)</CardTitle>
              <CardDescription>
                We fetch up to 15 recent messages matching scholarship /
                internship / fellowship keywords. Re-connect only if the sync
                fails with a session expired error.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button
                onClick={syncGmail}
                disabled={!studentId || syncing}
              >
                {syncing ? "Syncing…" : "Sync 15 emails now"}
              </Button>
              <Button variant="outline" onClick={startGmail}>
                Re-connect Gmail
              </Button>
              <Button
                variant="ghost"
                onClick={reprocessAll}
                disabled={!studentId || syncing}
                title="Re-run the pipeline on noise emails (may surface new opportunities) and then rescore every opportunity with the current profile and formula."
              >
                {syncing ? "Processing…" : "Reprocess all"}
              </Button>
              <Button
                variant="ghost"
                onClick={cleanupJunk}
                disabled={!studentId || syncing}
                title="Remove emails you sent yourself and Google Classroom notifications that landed in the database before the new filters were added."
              >
                {syncing ? "Cleaning…" : "Cleanup junk"}
              </Button>
              <Link
                href="/dashboard"
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                View dashboard →
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle>Paste one or more emails</CardTitle>
              <CardDescription>
                Fallback when Gmail isn’t available. The same pipeline runs.
                Separate multiple emails with{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-zinc-900">
                  ---
                </code>{" "}
                on its own line. Optional headers{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-zinc-900">
                  Subject:
                </code>{" "}
                and{" "}
                <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px] dark:bg-zinc-900">
                  From:
                </code>{" "}
                at the top of each block are picked up automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Emails</Label>
                <Textarea
                  rows={16}
                  value={manualBody}
                  onChange={(e) => setManualBody(e.target.value)}
                  placeholder={`Subject: Fulbright Foreign Student Program 2026
From: scholarships@usefp.org

The United States Educational Foundation in Pakistan is now accepting applications…

---

Subject: Summer Internship 2026 | Acme Corp
From: careers@acme.com

We are hiring BSCS interns for summer 2026…`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={submitManual}
                  disabled={syncing || parsedManualEmails.length === 0}
                >
                  {syncing
                    ? "Processing…"
                    : `Ingest ${parsedManualEmails.length || 0} email${parsedManualEmails.length === 1 ? "" : "s"}`}
                </Button>
                {parsedManualEmails.length > 0 ? (
                  <Badge tone="muted">
                    {parsedManualEmails.length} detected
                    {parsedManualEmails.length > 20 ? " (max 20)" : ""}
                  </Badge>
                ) : null}
                <Link
                  href="/dashboard"
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  View dashboard →
                </Link>
              </div>
              {parsedManualEmails.length > 0 ? (
                <ul className="divide-y rounded-md border text-sm dark:divide-zinc-800 dark:border-zinc-800">
                  {parsedManualEmails.slice(0, 20).map((e, i) => (
                    <li key={i} className="flex items-start gap-3 p-2.5">
                      <span className="mt-0.5 w-6 text-right text-xs text-zinc-500">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {e.subject || (
                            <span className="text-zinc-500">
                              (no subject line)
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          {e.sender || "(no sender)"} · {e.body.length} chars
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle>{summaryTitle(summary.kind)}</CardTitle>
            <CardDescription>
              {summaryDescription(summary.kind)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              {summaryStats(summary).map((stat) => (
                <span key={stat.label}>
                  {stat.label} <b>{stat.value}</b>
                </span>
              ))}
            </div>

            {summary.items && summary.items.length > 0 ? (
              <TraceSection items={summary.items} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {needsReauth ? (
        <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="text-amber-900 dark:text-amber-200">
              Reconnect Gmail
            </CardTitle>
            <CardDescription className="text-amber-800/80 dark:text-amber-300/70">
              {error ??
                "Your Gmail session expired. Reconnect to resume syncing."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={startGmail}>Reconnect Gmail</Button>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="p-4 text-sm text-red-600">
            {error}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

type SummaryData = {
  kind: "sync" | "manual" | "reprocess" | "cleanup";
  emails_fetched?: number;
  new_emails?: number;
  inserted?: number;
  skipped_duplicates?: number;
  opportunities_active?: number;
  reprocessed?: number;
  rescored?: number;
  raw_emails_removed?: number;
  opportunities_removed?: number;
};

function summaryTitle(kind: SummaryData["kind"]): string {
  if (kind === "sync") return "Last sync";
  if (kind === "manual") return "Manual ingest";
  if (kind === "cleanup") return "Cleanup result";
  return "Last reprocess";
}

function summaryDescription(kind: SummaryData["kind"]): string {
  if (kind === "sync")
    return "What happened to each fetched email as it moved through the pipeline.";
  if (kind === "manual")
    return "Pasted emails cleaned, classified, extracted, and scored.";
  if (kind === "cleanup")
    return "Removed emails sent by you and Google Classroom notifications that pre-dated the current Gmail filters.";
  return "Noise rows re-run through the pipeline, then every opportunity rescored against your current profile.";
}

function summaryStats(
  summary: SummaryData,
): { label: string; value: number }[] {
  const out: { label: string; value: number }[] = [];
  if (summary.kind === "sync") {
    if (typeof summary.emails_fetched === "number")
      out.push({ label: "Fetched", value: summary.emails_fetched });
    if (typeof summary.new_emails === "number")
      out.push({ label: "New", value: summary.new_emails });
    if (typeof summary.opportunities_active === "number")
      out.push({
        label: "New active opportunities",
        value: summary.opportunities_active,
      });
    return out;
  }
  if (summary.kind === "manual") {
    if (typeof summary.inserted === "number")
      out.push({ label: "Inserted", value: summary.inserted });
    if (typeof summary.skipped_duplicates === "number")
      out.push({
        label: "Duplicates skipped",
        value: summary.skipped_duplicates,
      });
    if (typeof summary.opportunities_active === "number")
      out.push({
        label: "New active opportunities",
        value: summary.opportunities_active,
      });
    return out;
  }
  if (summary.kind === "cleanup") {
    if (typeof summary.raw_emails_removed === "number")
      out.push({
        label: "Raw emails removed",
        value: summary.raw_emails_removed,
      });
    if (typeof summary.opportunities_removed === "number")
      out.push({
        label: "Opportunities removed",
        value: summary.opportunities_removed,
      });
    return out;
  }
  // reprocess
  if (typeof summary.reprocessed === "number")
    out.push({ label: "Noise reprocessed", value: summary.reprocessed });
  if (typeof summary.rescored === "number")
    out.push({ label: "Opportunities rescored", value: summary.rescored });
  if (typeof summary.opportunities_active === "number")
    out.push({
      label: "Active opportunities",
      value: summary.opportunities_active,
    });
  return out;
}

type TraceRow = {
  gmail_message_id: string;
  subject: string | null;
  sender: string | null;
  ingest: string;
  pipeline: string;
  opportunity_id?: string;
};

function TraceSection({ items }: { items: TraceRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const hiddenStatuses = new Set([
    "noise",
    "extract_failed",
    "skipped",
    "duplicate",
  ]);
  const filtered = showAll
    ? items
    : items.filter((i) => !hiddenStatuses.has(i.pipeline));
  const hiddenCount = items.length - filtered.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          Showing <b>{filtered.length}</b> of {items.length}
          {hiddenCount > 0 && !showAll
            ? ` — hiding ${hiddenCount} non-opportunity rows`
            : ""}
        </span>
        {hiddenCount > 0 || showAll ? (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-medium underline-offset-4 hover:underline"
          >
            {showAll ? "Hide non-opportunities" : "Show all"}
          </button>
        ) : null}
      </div>
      {filtered.length > 0 ? <TraceTable items={filtered} /> : (
        <div className="rounded-md border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
          No opportunities matched this time.
        </div>
      )}
    </div>
  );
}

function TraceTable({
  items,
}: {
  items: TraceRow[];
}) {
  const ingestTone = (s: string) => {
    if (s === "new") return "green" as const;
    if (s.startsWith("dup")) return "yellow" as const;
    return "red" as const;
  };
  const pipelineTone = (s: string) => {
    if (s === "active") return "green" as const;
    if (s === "expired" || s === "ineligible") return "yellow" as const;
    if (s === "duplicate") return "muted" as const;
    if (s === "skipped") return "default" as const;
    if (s === "noise") return "default" as const;
    return "red" as const;
  };

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Subject</th>
            <th className="px-3 py-2">Sender</th>
            <th className="px-3 py-2">Ingest</th>
            <th className="px-3 py-2">Pipeline</th>
            <th className="px-3 py-2">Opportunity</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={item.gmail_message_id}
              className="border-t border-zinc-200 align-top dark:border-zinc-800"
            >
              <td className="px-3 py-2 text-zinc-500">{i + 1}</td>
              <td className="max-w-[22rem] truncate px-3 py-2" title={item.subject ?? ""}>
                {item.subject || <span className="text-zinc-400">(no subject)</span>}
              </td>
              <td className="max-w-[18rem] truncate px-3 py-2 text-zinc-600 dark:text-zinc-400" title={item.sender ?? ""}>
                {item.sender || "—"}
              </td>
              <td className="px-3 py-2">
                <Badge tone={ingestTone(item.ingest)}>{item.ingest}</Badge>
              </td>
              <td className="px-3 py-2">
                <Badge tone={pipelineTone(item.pipeline)}>{item.pipeline}</Badge>
              </td>
              <td className="px-3 py-2">
                {item.opportunity_id ? (
                  <Link
                    href={`/dashboard?opp=${item.opportunity_id}`}
                    className="text-xs font-medium underline-offset-4 hover:underline"
                  >
                    {item.opportunity_id.slice(0, 8)}…
                  </Link>
                ) : (
                  <span className="text-xs text-zinc-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
