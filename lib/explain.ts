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
});

export type Explanation = z.infer<typeof explainSchema>;

export async function explainOpportunity(input: {
  profile: string;
  opportunity: Record<string, unknown>;
  org: string;
  scores: Record<string, unknown>;
}): Promise<Explanation | null> {
  const model = createChatModel({ temperature: 0.3 }).withStructuredOutput(
    explainSchema,
    { name: "explain_opportunity" },
  );
  const prompt = EXPLAIN_PROMPT.replace("{profile}", input.profile)
    .replace("{opportunity}", JSON.stringify(input.opportunity))
    .replace("{org}", input.org || "(unknown)")
    .replace("{scores}", JSON.stringify(input.scores));
  try {
    const result = await model.invoke(prompt);
    // Enforce the 3..8 size invariant we used to declare in the schema.
    const checklist = (result.action_checklist ?? []).slice(0, 8);
    return { ...result, action_checklist: checklist };
  } catch (err) {
    console.error(
      "[explain] explainOpportunity failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
