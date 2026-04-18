import { z } from "zod";
import { createChatModel } from "./langchain";
import { EXPLAIN_PROMPT } from "./prompts";

// NOTE: OpenAI strict structured outputs don't support `minItems`/`maxItems`
// on arrays. We rely on the prompt to ask for 3-8 items and trim at the edges
// in code below.
const explainSchema = z.object({
  explanation: z.string(),
  action_checklist: z.array(z.string()),
  urgency_flag: z.enum(["Red", "Orange", "Yellow", "Green"]),
  evidence_quotes: z.array(
    z.object({
      quote: z.string(),
      supports: z.string(),
    }),
  ),
});

export type Explanation = z.infer<typeof explainSchema>;

export async function explainOpportunity(input: {
  profile: string;
  opportunity: Record<string, unknown>;
  org: string;
  scores: Record<string, unknown>;
  source_email: string;
}): Promise<Explanation | null> {
  const model = createChatModel({ temperature: 0.3 }).withStructuredOutput(
    explainSchema,
    { name: "explain_opportunity" },
  );
  // Cap source body to keep prompt small; pipeline already cleans HTML/sig.
  const source = (input.source_email ?? "").slice(0, 6000);
  const prompt = EXPLAIN_PROMPT.replace("{profile}", input.profile)
    .replace("{opportunity}", JSON.stringify(input.opportunity))
    .replace("{org}", input.org || "(unknown)")
    .replace("{scores}", JSON.stringify(input.scores))
    .replace("{source_email}", source);
  try {
    const result = await model.invoke(prompt);
    const checklist = (result.action_checklist ?? []).slice(0, 8);
    const quotes = (result.evidence_quotes ?? [])
      .filter((q) => {
        const raw = q.quote?.trim();
        if (!raw || raw.length < 6) return false;
        // Enforce "verbatim": quote must appear in source, case-insensitive,
        // after collapsing whitespace. Prevents hallucinated paraphrases.
        const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
        return norm(source).includes(norm(raw));
      })
      .slice(0, 3)
      .map((q) => ({
        quote: q.quote.trim().replace(/\s+/g, " ").slice(0, 240),
        supports: (q.supports ?? "").trim().slice(0, 60),
      }));
    return {
      ...result,
      action_checklist: checklist,
      evidence_quotes: quotes,
    };
  } catch (err) {
    console.error(
      "[explain] explainOpportunity failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
