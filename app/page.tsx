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
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ProfileForm = {
  email: string;
  degree: string;
  program: string;
  semester: string;
  cgpa: string;
  skills: string[];
  interests: string[];
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

const SKILLS = [
  "Python",
  "Java",
  "JavaScript",
  "TypeScript",
  "C++",
  "React",
  "Node.js",
  "Machine Learning",
  "Data Science",
  "SQL",
  "Django",
  "FastAPI",
  "AWS",
  "Docker",
  "Kubernetes",
  "Git",
  "REST APIs",
  "GraphQL",
  "MongoDB",
  "PostgreSQL",
  "Vue.js",
  "Angular",
  "HTML/CSS",
  "Web Development",
  "Mobile Development",
  "iOS",
  "Android",
  "Flutter",
  "React Native",
  "Firebase",
  "GCP",
  "Azure",
  "DevOps",
  "CI/CD",
  "Linux",
  "Bash",
  "System Design",
  "Agile",
  "Communication",
  "Problem Solving",
  "Tensorflow",
  "PyTorch",
  "Deep Learning",
  "NLP",
  "Computer Vision",
  "Data Analysis",
  "Excel",
  "Tableau",
  "Leadership",
  "Project Management",
];

const INTERESTS = [
  "AI & Machine Learning",
  "Climate Tech",
  "Fintech",
  "Healthcare",
  "EdTech",
  "E-commerce",
  "Social Impact",
  "Startups",
  "Cybersecurity",
  "Blockchain",
  "Web3",
  "Data Science",
  "Software Engineering",
  "Product Management",
  "Entrepreneurship",
  "Research",
  "Design",
  "UX/UI",
  "Marketing",
  "Sales",
  "Operations",
  "Finance",
  "Consulting",
  "Innovation",
  "Sustainability",
  "Renewable Energy",
  "Biotechnology",
  "Robotics",
  "IoT",
  "Mobile Apps",
  "Game Development",
  "VR/AR",
  "Cloud Computing",
  "Database Design",
  "Security",
  "Open Source",
  "Mentoring",
  "Teaching",
  "Public Policy",
  "Social Media",
  "Content Creation",
  "Journalism",
  "Photography",
  "Video Production",
  "Networking",
  "Community Building",
  "Travel",
  "Cultural Exchange",
  "Language Learning",
  "International Development",
];

const OTHER_OPTION = "Other";
const FEATURED_SKILLS = [...SKILLS.slice(0, 10), OTHER_OPTION];
const FEATURED_INTERESTS = [...INTERESTS.slice(0, 10), OTHER_OPTION];
const PROFILE_DRAFT_KEY = "opportunity-radar:profile-form-draft";

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cape Verde",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Czechia",
  "Côte d'Ivoire",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "East Timor",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hong Kong",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Macao",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

export default function ProfilePage() {
  const { studentId, setStudentId } = useStudentId();
  const [form, setForm] = useState<ProfileForm>({
    email: "",
    degree: "BS",
    program: "",
    semester: "",
    cgpa: "",
    skills: [],
    interests: [],
    preferred_types: ["Scholarship", "Internship"],
    financial_need: false,
    location_pref: "International",
    nationality: "",
    graduation_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cgpaError, setCgpaError] = useState<string | null>(null);
  const [skillSearch, setSkillSearch] = useState("");
  const [interestSearch, setInterestSearch] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PROFILE_DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<ProfileForm>;
      setForm((prev) => ({
        ...prev,
        ...parsed,
        skills: Array.isArray(parsed.skills) ? parsed.skills : prev.skills,
        interests: Array.isArray(parsed.interests)
          ? parsed.interests
          : prev.interests,
        preferred_types: Array.isArray(parsed.preferred_types)
          ? parsed.preferred_types
          : prev.preferred_types,
      }));
    } catch {
      // Ignore malformed local draft.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_DRAFT_KEY, JSON.stringify(form));
    } catch {
      // Ignore storage errors.
    }
  }, [form]);

  useEffect(() => {
    if (!studentId) return;

    let cancelled = false;
    const loadProfile = async () => {
      try {
        const res = await fetch(
          `/api/profile?student_id=${encodeURIComponent(studentId)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          profile?: {
            email: string;
            degree: string | null;
            program: string | null;
            semester: number | null;
            cgpa: number | null;
            skills: string[] | null;
            interests: string[] | null;
            preferred_types: string[] | null;
            financial_need: boolean | null;
            location_pref: string | null;
            nationality: string | null;
            graduation_date: string | null;
          };
        };
        if (!data.profile || cancelled) return;

        setForm((prev) => ({
          ...prev,
          email: data.profile?.email ?? prev.email,
          degree: data.profile?.degree ?? prev.degree,
          program: data.profile?.program ?? "",
          semester:
            data.profile?.semester !== null && data.profile?.semester !== undefined
              ? String(data.profile.semester)
              : "",
          cgpa:
            data.profile?.cgpa !== null && data.profile?.cgpa !== undefined
              ? data.profile.cgpa.toFixed(2)
              : "",
          skills: data.profile?.skills ?? [],
          interests: data.profile?.interests ?? [],
          preferred_types:
            data.profile?.preferred_types && data.profile.preferred_types.length
              ? data.profile.preferred_types
              : prev.preferred_types,
          financial_need: Boolean(data.profile?.financial_need),
          location_pref: data.profile?.location_pref ?? "International",
          nationality: data.profile?.nationality ?? "",
          graduation_date: data.profile?.graduation_date ?? "",
        }));
      } catch {
        // Silent fail: local draft still keeps user data available.
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const toggleType = (t: string) => {
    setForm((prev) => ({
      ...prev,
      preferred_types: prev.preferred_types.includes(t)
        ? prev.preferred_types.filter((x) => x !== t)
        : [...prev.preferred_types, t],
    }));
  };

  const toggleSkill = (skill: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const toggleInterest = (interest: string) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const skillMatches = SKILLS.filter((skill) =>
    skill.toLowerCase().includes(skillSearch.toLowerCase()),
  );
  const interestMatches = INTERESTS.filter((interest) =>
    interest.toLowerCase().includes(interestSearch.toLowerCase()),
  );

  const handleCgpaChange = (value: string) => {
    if (value === "") {
      setForm({ ...form, cgpa: "" });
      setCgpaError(null);
      return;
    }
    if (!/^\d*\.?\d{0,2}$/.test(value)) {
      return;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      setCgpaError("Invalid CGPA value");
      return;
    }
    if (parsed < 0 || parsed > 4) {
      setCgpaError("CGPA must be between 0.00 and 4.00");
      setForm({ ...form, cgpa: value });
      return;
    }
    setCgpaError(null);
    setForm({ ...form, cgpa: value });
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
      skills: form.skills,
      interests: form.interests,
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
                <Select
                  value={form.nationality}
                  onChange={(e) =>
                    setForm({ ...form, nationality: e.target.value })
                  }
                >
                  <option value="">-- Select a country --</option>
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </Select>
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
                <Select
                  value={form.semester}
                  onChange={(e) =>
                    setForm({ ...form, semester: e.target.value })
                  }
                >
                  <option value="">-- Select semester --</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                    <option key={sem} value={String(sem)}>
                      Semester {sem}
                    </option>
                  ))}
                </Select>
              </Field>
            </Row>

            <Row>
              <Field label="CGPA">
                {cgpaError && (
                  <p className="mb-2 text-sm font-medium text-red-600 dark:text-red-400">
                    {cgpaError}
                  </p>
                )}
                <Input
                  type="number"
                  inputMode="decimal"
                  step={0.01}
                  min={0}
                  max={4}
                  value={form.cgpa}
                  onChange={(e) => handleCgpaChange(e.target.value)}
                  className={cgpaError ? "border-red-500 focus-visible:ring-red-400" : ""}
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

            <Field label="Skills">
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Top 10 common skills
                </p>
                <div className="flex flex-wrap gap-2">
                  {FEATURED_SKILLS.map((skill) => {
                    const selected = form.skills.includes(skill);
                    return (
                      <button
                        type="button"
                        key={skill}
                        onClick={() => toggleSkill(skill)}
                        className={
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                          (selected
                            ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                            : "border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900")
                        }
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
                <Input
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  placeholder="Search other skills"
                />
                {skillSearch.trim() ? (
                  <div className="max-h-36 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                    <div className="flex flex-wrap gap-2">
                      {skillMatches.length ? (
                        skillMatches.map((skill) => {
                          const selected = form.skills.includes(skill);
                          return (
                            <button
                              type="button"
                              key={skill}
                              onClick={() => toggleSkill(skill)}
                              className={
                                "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                                (selected
                                  ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900")
                              }
                            >
                              {skill}
                            </button>
                          );
                        })
                      ) : (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          No matching skill found
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {form.skills.length} selected
                </p>
              </div>
            </Field>

            <Field label="Interests">
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Top 10 common interests
                </p>
                <div className="flex flex-wrap gap-2">
                  {FEATURED_INTERESTS.map((interest) => {
                    const selected = form.interests.includes(interest);
                    return (
                      <button
                        type="button"
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                          (selected
                            ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                            : "border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900")
                        }
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
                <Input
                  value={interestSearch}
                  onChange={(e) => setInterestSearch(e.target.value)}
                  placeholder="Search other interests"
                />
                {interestSearch.trim() ? (
                  <div className="max-h-36 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                    <div className="flex flex-wrap gap-2">
                      {interestMatches.length ? (
                        interestMatches.map((interest) => {
                          const selected = form.interests.includes(interest);
                          return (
                            <button
                              type="button"
                              key={interest}
                              onClick={() => toggleInterest(interest)}
                              className={
                                "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                                (selected
                                  ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900")
                              }
                            >
                              {interest}
                            </button>
                          );
                        })
                      ) : (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          No matching interest found
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {form.interests.length} selected
                </p>
              </div>
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
                  className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-blue-600 hover:underline dark:text-zinc-400 dark:hover:text-blue-400"
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
