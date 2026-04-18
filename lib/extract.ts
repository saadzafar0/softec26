import { z } from "zod";
import { createChatModel } from "./langchain";
import { EXTRACT_PROMPT } from "./prompts";

export const extractedSchema = z.object({
  opp_type: z.string().nullable(),
  org_name: z.string().nullable(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  deadline_ambiguous: z.boolean(),
  eligibility_raw: z.string().nullable(),
  cgpa_required: z.number().min(0).max(4.5).nullable(),
  degree_required: z.string().nullable(),
  skills_required: z.array(z.string()),
  documents_required: z.array(z.string()),
  benefits: z.string().nullable(),
  funding_type: z.enum(["Full", "Partial", "None"]).nullable(),
  geo_scope: z.enum(["Local", "National", "International"]).nullable(),
  application_link: z.string().url().nullable(),
});

export type Extracted = z.infer<typeof extractedSchema>;

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
    if (result.application_link) {
      const urlRx = /https?:\/\/[^\s)]+/gi;
      const urls = body.match(urlRx) ?? [];
      const found = urls.some((u) =>
        u.replace(/[.,;:]+$/, "") === result.application_link,
      );
      if (!found) result.application_link = null;
    }
    return result;
  } catch {
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
