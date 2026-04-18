import { z } from "zod";
import { createChatModel } from "./langchain";
import { CLASSIFY_PROMPT } from "./prompts";

const KEYWORDS = [
  /\bscholarship(s)?\b/i,
  /\binternship(s)?\b/i,
  /\bfellowship(s)?\b/i,
  /\bgrant(s)?\b/i,
  /\bstipend\b/i,
  /\btuition\b/i,
  /\beligibility\b/i,
  /\bapply (by|before|now)\b/i,
  /\bdeadline\b/i,
  /\bcall for applications\b/i,
  /\b(undergraduate|graduate|phd|masters?)\b/i,
];

const URL_RX = /https?:\/\/[^\s)]+/i;
const DATE_RX =
  /\b(\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/i;

export function ruleScore(cleaned: string): number {
  if (!cleaned) return 0;
  let hits = 0;
  for (const rx of KEYWORDS) if (rx.test(cleaned)) hits += 1;
  const keywordScore = Math.min(hits / 4, 1);
  const hasUrl = URL_RX.test(cleaned) ? 1 : 0;
  const hasDate = DATE_RX.test(cleaned) ? 1 : 0;
  return 0.7 * keywordScore + 0.2 * hasUrl + 0.1 * hasDate;
}

const classifySchema = z.object({
  is_opportunity: z.boolean(),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(160).optional(),
});

export type ClassifyResult = z.infer<typeof classifySchema>;

export async function llmConfirm(cleaned: string): Promise<ClassifyResult> {
  const model = createChatModel({ temperature: 0 }).withStructuredOutput(
    classifySchema,
    { name: "classify_opportunity" },
  );
  const prompt = CLASSIFY_PROMPT.replace("{email}", cleaned.slice(0, 6000));
  try {
    return await model.invoke(prompt);
  } catch {
    return { is_opportunity: false, confidence: 0, reason: "llm_failure" };
  }
}

export async function classify(cleaned: string): Promise<{
  rule: number;
  llm: ClassifyResult | null;
  is_opportunity: boolean;
  confidence: number;
}> {
  const rule = ruleScore(cleaned);
  if (rule < 0.25) {
    return { rule, llm: null, is_opportunity: false, confidence: rule };
  }
  const llm = await llmConfirm(cleaned);
  const combined = 0.4 * rule + 0.6 * llm.confidence;
  return {
    rule,
    llm,
    is_opportunity: llm.is_opportunity && combined >= 0.45,
    confidence: combined,
  };
}
