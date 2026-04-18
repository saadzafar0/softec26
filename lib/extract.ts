import { z } from "zod";
import { createChatModel } from "./langchain";
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
  try {
    const result = await model.invoke(prompt);

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
        const urlRx = /https?:\/\/[^\s)]+/gi;
        const urls = body.match(urlRx) ?? [];
        const found = urls.some(
          (u) => u.replace(/[.,;:]+$/, "") === trimmed,
        );
        result.application_link = found ? trimmed : null;
      }
    }

    // Contact email: must look like an email AND appear verbatim in body.
    if (result.contact_email) {
      const email = result.contact_email.trim().toLowerCase();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const appears = body.toLowerCase().includes(email);
      result.contact_email = isEmail && appears ? email : null;
    }
    // Contact phone: keep only if it has at least 7 digits AND appears in body.
    if (result.contact_phone) {
      const phone = result.contact_phone.trim();
      const digits = phone.replace(/\D/g, "");
      const appears = body.includes(phone);
      result.contact_phone = digits.length >= 7 && appears ? phone : null;
    }
    if (result.contact_person) {
      const person = result.contact_person.trim();
      result.contact_person = person.length > 1 && person.length < 120
        ? person
        : null;
    }

    return result;
  } catch (err) {
    console.error(
      "[extract] extractFields failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export function isExpired(deadline: string | null): boolean {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return d < today;
}
