import { z } from "zod";
import { createChatModel } from "./langchain";
import { EXPLAIN_PROMPT } from "./prompts";

const explainSchema = z.object({
  explanation: z.string(),
  action_checklist: z.array(z.string()).min(3).max(8),
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
    return await model.invoke(prompt);
  } catch {
    return null;
  }
}
