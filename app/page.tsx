"use client";
import { useEffect, useState } from "react";
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
  const router = useRouter();
  const {
    studentId,
    studentEmail,
    isAuthenticated,
    hydrated,
    signIn,
  } = useStudent();
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
    if (hydrated && !isAuthenticated) {
      router.replace("/signin");
    }
  }, [hydrated, isAuthenticated, router]);

  useEffect(() => {
    if (studentEmail) {
      setForm((prev) =>
        prev.email === studentEmail ? prev : { ...prev, email: studentEmail },
      );
    }
  }, [studentEmail]);

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
        signIn(data.student_id as string, payload.email);
        const rescored = typeof data.rescored === "number" ? data.rescored : 0;
        setMessage(
          rescored > 0
            ? `Profile saved. Rescored ${rescored} opportunity${rescored === 1 ? "" : "ies"}.`
            : "Profile saved and embedded.",
        );
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
        {studentEmail ? (
          <Badge tone="green">Signed in as {studentEmail}</Badge>
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
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Email" required>
                <Input
                  required
                  type="email"
                  value={form.email}
                  readOnly={Boolean(studentEmail)}
                  className={
                    studentEmail
                      ? "cursor-not-allowed bg-zinc-50 dark:bg-zinc-900"
                      : ""
                  }
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
            </div>

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
              <ChipPicker
                featured={FEATURED_SKILLS}
                featuredLabel="Top 10 common skills"
                searchValue={skillSearch}
                onSearchChange={setSkillSearch}
                searchPlaceholder="Search other skills"
                searchMatches={skillMatches}
                selected={form.skills}
                onToggle={toggleSkill}
                emptyMatchLabel="No matching skill found"
              />
            </Field>

            <Field label="Interests">
              <ChipPicker
                featured={FEATURED_INTERESTS}
                featuredLabel="Top 10 common interests"
                searchValue={interestSearch}
                onSearchChange={setInterestSearch}
                searchPlaceholder="Search other interests"
                searchMatches={interestMatches}
                selected={form.interests}
                onToggle={toggleInterest}
                emptyMatchLabel="No matching interest found"
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
                  className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-blue-600 hover:underline dark:text-zinc-400 dark:hover:text-blue-400"
                  href="/connect"
                >
                  Next: open inbox →
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

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
        (selected
          ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
          : "border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900")
      }
    >
      {label}
    </button>
  );
}

function SelectedChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-900 bg-zinc-900 py-1 pl-3 pr-1 text-xs font-medium text-zinc-50 dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 dark:text-zinc-500 dark:hover:bg-zinc-200 dark:hover:text-zinc-900"
      >
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        >
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </button>
    </span>
  );
}

function ChipPicker({
  featured,
  featuredLabel,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchMatches,
  selected,
  onToggle,
  emptyMatchLabel,
}: {
  featured: string[];
  featuredLabel: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchMatches: string[];
  selected: string[];
  onToggle: (item: string) => void;
  emptyMatchLabel: string;
}) {
  return (
    <div className="space-y-3">
      {selected.length > 0 ? (
        <div className="rounded-md border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Selected ({selected.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.map((item) => (
              <SelectedChip
                key={item}
                label={item}
                onRemove={() => onToggle(item)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {featuredLabel}
        </p>
        <div className="flex flex-wrap gap-2">
          {featured.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={selected.includes(item)}
              onClick={() => onToggle(item)}
            />
          ))}
        </div>
      </div>

      <Input
        value={searchValue}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
      />
      {searchValue.trim() ? (
        <div className="max-h-36 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
          <div className="flex flex-wrap gap-2">
            {searchMatches.length ? (
              searchMatches.map((item) => (
                <Chip
                  key={item}
                  label={item}
                  selected={selected.includes(item)}
                  onClick={() => onToggle(item)}
                />
              ))
            ) : (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {emptyMatchLabel}
              </span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
