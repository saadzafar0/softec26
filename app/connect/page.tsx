"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStudentId } from "@/hooks/useStudent";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectInner />
    </Suspense>
  );
}

function ConnectInner() {
  const { studentId, setStudentId } = useStudentId();
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
      | "error"
      | "empty"
      | "missing"
      | "no_student";
    opportunity_id?: string;
  };
  const [summary, setSummary] = useState<{
    emails_fetched?: number;
    new_emails?: number;
    inserted?: number;
    skipped_duplicates?: number;
    opportunities_active?: number;
    items?: TraceItem[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sid = params.get("student_id");
    const connected = params.get("connected");
    const errParam = params.get("error");
    if (sid && connected) {
      setStudentId(sid);
    }
    if (errParam) setError(decodeURIComponent(errParam));
  }, [params, setStudentId]);

  const [manualSubject, setManualSubject] = useState("");
  const [manualSender, setManualSender] = useState("");
  const [manualBody, setManualBody] = useState("");

  const startGmail = async () => {
    if (!studentId) {
      setError("Save your profile first on the Profile tab.");
      return;
    }
    setError(null);
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
    try {
      const res = await fetch("/api/emails/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "GMAIL_REAUTH") {
          setError("Gmail session expired. Please reconnect Gmail.");
        } else {
          setError(data.error ?? "Sync failed");
        }
        return;
      }
      setSummary(data);
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
    if (manualBody.trim().length < 20) {
      setError("Email body is too short.");
      return;
    }
    setSyncing(true);
    setSummary(null);
    setError(null);
    try {
      const res = await fetch("/api/emails/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          emails: [
            {
              subject: manualSubject || null,
              sender: manualSender || null,
              body: manualBody,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submit failed");
        return;
      }
      setSummary(data);
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
          Connect Gmail to auto-fetch 15 recent opportunity emails, or paste one
          in manually. Each email is cleaned, classified, extracted, scored, and
          explained.
        </p>
        {studentId ? (
          <Badge tone="green">Student {studentId.slice(0, 8)}…</Badge>
        ) : (
          <Badge tone="red">No profile yet — save one first.</Badge>
        )}
      </div>

      <Tabs defaultValue="gmail">
        <TabsList>
          <TabsTrigger value="gmail">Gmail</TabsTrigger>
          <TabsTrigger value="manual">Manual paste</TabsTrigger>
        </TabsList>

        <TabsContent value="gmail">
          <Card>
            <CardHeader>
              <CardTitle>Connect Gmail (read-only)</CardTitle>
              <CardDescription>
                We fetch up to 15 recent messages matching scholarship /
                internship / fellowship keywords.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button onClick={startGmail}>Connect Gmail</Button>
              <Button
                variant="outline"
                onClick={syncGmail}
                disabled={!studentId || syncing}
              >
                {syncing ? "Syncing…" : "Sync 15 emails now"}
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
              <CardTitle>Paste an email</CardTitle>
              <CardDescription>
                Fallback when Gmail isn’t available. The same pipeline runs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Input
                    value={manualSubject}
                    onChange={(e) => setManualSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sender</Label>
                  <Input
                    value={manualSender}
                    placeholder="Name &lt;address@example.org&gt;"
                    onChange={(e) => setManualSender(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Body</Label>
                <Textarea
                  rows={10}
                  value={manualBody}
                  onChange={(e) => setManualBody(e.target.value)}
                  placeholder="Paste the full email body here…"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={submitManual} disabled={syncing}>
                  {syncing ? "Processing…" : "Ingest email"}
                </Button>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  View dashboard →
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Last sync</CardTitle>
            <CardDescription>
              What happened to each fetched email as it moved through the
              pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              {"emails_fetched" in summary ? (
                <span>
                  Fetched <b>{summary.emails_fetched}</b>
                </span>
              ) : null}
              {"new_emails" in summary ? (
                <span>
                  New <b>{summary.new_emails}</b>
                </span>
              ) : null}
              {"inserted" in summary ? (
                <span>
                  Inserted <b>{summary.inserted}</b>
                </span>
              ) : null}
              {"skipped_duplicates" in summary ? (
                <span>
                  Duplicates skipped <b>{summary.skipped_duplicates}</b>
                </span>
              ) : null}
              {"opportunities_active" in summary ? (
                <span>
                  New active opportunities{" "}
                  <b>{summary.opportunities_active}</b>
                </span>
              ) : null}
            </div>

            {summary.items && summary.items.length > 0 ? (
              <TraceTable items={summary.items} />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="p-4 text-sm text-red-600">
            {error}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function TraceTable({
  items,
}: {
  items: {
    gmail_message_id: string;
    subject: string | null;
    sender: string | null;
    ingest: string;
    pipeline: string;
    opportunity_id?: string;
  }[];
}) {
  const ingestTone = (s: string) => {
    if (s === "new") return "green" as const;
    if (s.startsWith("dup")) return "yellow" as const;
    return "red" as const;
  };
  const pipelineTone = (s: string) => {
    if (s === "active") return "green" as const;
    if (s === "expired" || s === "ineligible") return "yellow" as const;
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
