"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStudentId } from "@/hooks/useStudent";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ProfileForm = {
  email: string;
  degree: string;
  program: string;
  semester: string;
  cgpa: string;
  skills: string;
  interests: string;
  preferred_types: string[];
  financial_need: boolean;
  location_pref: string;
  nationality: string;
  graduation_date: string;
};

const OPP_TYPES = [
  "Scholarship",
  "Internship",
  "Fellowship",
  "Grant",
  "Research",
  "Job",
];

export default function ProfilePage() {
  const { studentId, setStudentId } = useStudentId();
  const [form, setForm] = useState<ProfileForm>({
    email: "",
    degree: "BS",
    program: "",
    semester: "",
    cgpa: "",
    skills: "",
    interests: "",
    preferred_types: ["Scholarship", "Internship"],
    financial_need: false,
    location_pref: "International",
    nationality: "",
    graduation_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
  }, [studentId]);

  const toggleType = (t: string) => {
    setForm((prev) => ({
      ...prev,
      preferred_types: prev.preferred_types.includes(t)
        ? prev.preferred_types.filter((x) => x !== t)
        : [...prev.preferred_types, t],
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const payload = {
      email: form.email.trim(),
      degree: form.degree || null,
      program: form.program || null,
      semester: form.semester ? Number(form.semester) : null,
      cgpa: form.cgpa ? Number(form.cgpa) : null,
      skills: splitList(form.skills),
      interests: splitList(form.interests),
      preferred_types: form.preferred_types,
      financial_need: form.financial_need,
      location_pref: form.location_pref || null,
      nationality: form.nationality || null,
      graduation_date: form.graduation_date || null,
    };

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save profile");
      } else {
        setStudentId(data.student_id);
        setMessage("Profile saved and embedded.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Build your profile
        </h1>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
          Tell us about your studies and goals. We narrate, embed, and use this
          to rank incoming opportunities by fit and urgency.
        </p>
        {studentId ? (
          <Badge tone="green">Signed in as {studentId.slice(0, 8)}…</Badge>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student profile</CardTitle>
          <CardDescription>
            All fields are optional except email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-5">
            <Row>
              <Field label="Email" required>
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                />
              </Field>
              <Field label="Nationality">
                <Input
                  value={form.nationality}
                  placeholder="e.g. Pakistani"
                  onChange={(e) =>
                    setForm({ ...form, nationality: e.target.value })
                  }
                />
              </Field>
            </Row>

            <Row>
              <Field label="Degree">
                <Select
                  value={form.degree}
                  onChange={(e) =>
                    setForm({ ...form, degree: e.target.value })
                  }
                >
                  <option>BS</option>
                  <option>MS</option>
                  <option>MBA</option>
                  <option>PhD</option>
                </Select>
              </Field>
              <Field label="Program">
                <Input
                  value={form.program}
                  placeholder="e.g. Computer Science"
                  onChange={(e) =>
                    setForm({ ...form, program: e.target.value })
                  }
                />
              </Field>
              <Field label="Semester">
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={form.semester}
                  onChange={(e) =>
                    setForm({ ...form, semester: e.target.value })
                  }
                />
              </Field>
            </Row>

            <Row>
              <Field label="CGPA">
                <Input
                  type="number"
                  step={0.01}
                  min={0}
                  max={4.5}
                  value={form.cgpa}
                  onChange={(e) =>
                    setForm({ ...form, cgpa: e.target.value })
                  }
                />
              </Field>
              <Field label="Graduation date">
                <Input
                  type="date"
                  value={form.graduation_date}
                  onChange={(e) =>
                    setForm({ ...form, graduation_date: e.target.value })
                  }
                />
              </Field>
              <Field label="Location preference">
                <Select
                  value={form.location_pref}
                  onChange={(e) =>
                    setForm({ ...form, location_pref: e.target.value })
                  }
                >
                  <option>Local</option>
                  <option>National</option>
                  <option>International</option>
                </Select>
              </Field>
            </Row>

            <Field label="Skills (comma separated)">
              <Textarea
                rows={2}
                value={form.skills}
                placeholder="Python, Machine Learning, React"
                onChange={(e) =>
                  setForm({ ...form, skills: e.target.value })
                }
              />
            </Field>

            <Field label="Interests (comma separated)">
              <Textarea
                rows={2}
                value={form.interests}
                placeholder="AI research, climate tech, policy"
                onChange={(e) =>
                  setForm({ ...form, interests: e.target.value })
                }
              />
            </Field>

            <div className="space-y-2">
              <Label>Preferred opportunity types</Label>
              <div className="flex flex-wrap gap-2">
                {OPP_TYPES.map((t) => {
                  const on = form.preferred_types.includes(t);
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() => toggleType(t)}
                      className={
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                        (on
                          ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                          : "border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900")
                      }
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                id="fin"
                checked={form.financial_need}
                onCheckedChange={(v) =>
                  setForm({ ...form, financial_need: v })
                }
              />
              <span>I need financial support</span>
            </label>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save profile"}
              </Button>
              {studentId ? (
                <Link
                  className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400"
                  href="/connect"
                >
                  Next: connect Gmail →
                </Link>
              ) : null}
              {message ? (
                <span className="text-sm text-green-600">{message}</span>
              ) : null}
              {error ? (
                <span className="text-sm text-red-600">{error}</span>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-3">{children}</div>;
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function splitList(s: string): string[] {
  return s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}
