import { z } from "zod";
import { createChatModel, withLLMRetry } from "./langchain";
import { EXTRACT_PROMPT } from "./prompts";

// NOTE: OpenAI's strict structured outputs do not support string `format`
// (e.g. `url`), `pattern`/`regex`, or numeric `minimum`/`maximum`. So the
// schema here stays loose; we normalize + validate in code after the call.
export const extractedSchema = z.object({
  opp_type: z.string().nullable(),
  org_name: z.string().nullable(),
  deadline: z.string().nullable(),
  deadline_ambiguous: z.boolean(),
  eligibility_raw: z.string().nullable(),
  cgpa_required: z.number().nullable(),
  degree_required: z.string().nullable(),
  skills_required: z.array(z.string()),
  documents_required: z.array(z.string()),
  benefits: z.string().nullable(),
  funding_type: z.enum(["Full", "Partial", "None"]).nullable(),
  geo_scope: z.enum(["Local", "National", "International"]).nullable(),
  application_link: z.string().nullable(),
  contact_email: z.string().nullable(),
  contact_phone: z.string().nullable(),
  contact_person: z.string().nullable(),
});

export type Extracted = z.infer<typeof extractedSchema>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDeadline(raw: string | null): {
  deadline: string | null;
  ambiguous: boolean;
} {
  if (!raw) return { deadline: null, ambiguous: false };
  const trimmed = raw.trim();
  if (ISO_DATE.test(trimmed)) {
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      return { deadline: trimmed, ambiguous: false };
    }
  }
  // Last-resort parse for non-ISO strings the LLM slipped through.
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    const iso = d.toISOString().slice(0, 10);
    return { deadline: iso, ambiguous: true };
  }
  return { deadline: null, ambiguous: true };
}

function normalizeCgpa(raw: number | null): number | null {
  if (raw === null || Number.isNaN(raw)) return null;
  // The LLM might return "75" for a percentage or "3.5" for CGPA.
  // Heuristic: if value > 5 assume it's a percentage, convert to ~4.0 scale.
  if (raw > 5 && raw <= 100) {
    return Number(((raw / 100) * 4).toFixed(2));
  }
  if (raw < 0 || raw > 5) return null;
  return raw;
}

export async function extractFields(
  subject: string | null,
  sender: string | null,
  body: string,
): Promise<Extracted | null> {
  const model = createChatModel({ temperature: 0 }).withStructuredOutput(
    extractedSchema,
    { name: "extract_opportunity_fields" },
  );
  const prompt = EXTRACT_PROMPT.replace("{subject}", subject ?? "")
    .replace("{sender}", sender ?? "")
    .replace("{body}", body.slice(0, 8000));

  const result = await withLLMRetry("extract", () => model.invoke(prompt));
  if (!result) return null;

  const { deadline, ambiguous } = normalizeDeadline(result.deadline);
  result.deadline = deadline;
  if (ambiguous) result.deadline_ambiguous = true;

  result.cgpa_required = normalizeCgpa(result.cgpa_required);

  if (result.application_link) {
    const trimmed = result.application_link.trim();
    const isHttpUrl = /^https?:\/\//i.test(trimmed);
    if (!isHttpUrl) {
      result.application_link = null;
    } else {
      // Accept the URL if it either appears verbatim OR its hostname appears as
      // a hostname of any URL in the body. This lets us keep LLM-expanded /
      // normalized URLs (http→https, trailing slash added, tracking params
      // stripped) without silently losing the Apply button.
      const urlRx = /https?:\/\/[^\s)]+/gi;
      const urls = body.match(urlRx) ?? [];
      const cleanedUrls = urls.map((u) => u.replace(/[.,;:]+$/, ""));
      let linkHost: string | null = null;
      try {
        linkHost = new URL(trimmed).hostname.toLowerCase().replace(/^www\./, "");
      } catch {
        linkHost = null;
      }
      const verbatim = cleanedUrls.some((u) => u === trimmed);
      const hostMatch = linkHost
        ? cleanedUrls.some((u) => {
            try {
              const h = new URL(u).hostname.toLowerCase().replace(/^www\./, "");
              return h === linkHost;
            } catch {
              return false;
            }
          })
        : false;
      result.application_link = verbatim || hostMatch ? trimmed : null;
    }
  }

  // Contact email: must look like an email AND appear verbatim in body.
  if (result.contact_email) {
    const email = result.contact_email.trim().toLowerCase();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const appears = body.toLowerCase().includes(email);
    result.contact_email = isEmail && appears ? email : null;
  }
  // Contact phone: keep if it has ≥7 digits AND those digits (in order) appear
  // as a substring of the body's digit stream. Lets us accept LLM-normalized
  // phones like "+92 300 1234567" even if the body has "0300-1234567".
  if (result.contact_phone) {
    const phone = result.contact_phone.trim();
    const digits = phone.replace(/\D/g, "");
    const bodyDigits = body.replace(/\D/g, "");
    const appears = digits.length > 0 && bodyDigits.includes(digits);
    result.contact_phone = digits.length >= 7 && appears ? phone : null;
  }
  if (result.contact_person) {
    const person = result.contact_person.trim();
    result.contact_person = person.length > 1 && person.length < 120
      ? person
      : null;
  }

  return result;
}

export function isExpired(deadline: string | null): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return d < today;
}
