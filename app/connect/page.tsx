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
  const [summary, setSummary] = useState<{
    emails_fetched?: number;
    new_emails?: number;
    inserted?: number;
    skipped_duplicates?: number;
    opportunities_active?: number;
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
          <CardContent className="flex flex-wrap gap-4 p-4 text-sm">
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
