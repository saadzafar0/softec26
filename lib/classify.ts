import { z } from "zod";
import { createChatModel } from "./langchain";
import { OPPORTUNITY_RX } from "./keywords";
import { CLASSIFY_PROMPT } from "./prompts";

const NEGATIVE_SENDER_DOMAINS = [
  /classroom\.google\.com$/i,
  /canvas(lms)?\./i,
  /linkedin\.com$/i,
  /indeed\.com$/i,
  /kaggle\.com$/i,
  /noreply@google\.com$/i,
];

const NEGATIVE_SUBJECT = [
  /\bviva\b/i,
  /\bassignment\b/i,
  /\bquiz\b/i,
  /\bmid[- ]?term\b/i,
  /\bfinal exam\b/i,
  /\blecture\b/i,
  /\battendance\b/i,
  /^re: /i,
  /^fw: /i,
];

const URL_RX = /https?:\/\/[^\s)]+/i;
const DATE_RX =
  /\b(\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/i;

export function ruleScore(
  subject: string | null,
  sender: string | null,
  cleanedBody: string,
): number {
  const subj = subject ?? "";
  const body = cleanedBody ?? "";
  const combined = `${subj}\n${body}`;

  if (!combined.trim()) return 0;

  // Subject keywords weigh much more than body keywords.
  let subjectHits = 0;
  let bodyHits = 0;
  for (const rx of OPPORTUNITY_RX) {
    if (rx.test(subj)) subjectHits += 1;
    else if (rx.test(body)) bodyHits += 1;
  }
  const keywordScore = Math.min(subjectHits / 2 + bodyHits / 6, 1);
  const hasUrl = URL_RX.test(body) ? 1 : 0;
  const hasDate = DATE_RX.test(combined) ? 1 : 0;

  let score = 0.7 * keywordScore + 0.2 * hasUrl + 0.1 * hasDate;

  // Negative signals
  if (NEGATIVE_SUBJECT.some((rx) => rx.test(subj))) score -= 0.4;
  if (
    sender &&
    NEGATIVE_SENDER_DOMAINS.some((rx) => rx.test(sender))
  ) {
    score -= 0.3;
  }

  return Math.max(0, Math.min(1, score));
}

// NOTE: OpenAI strict structured outputs don't support `minimum`/`maximum`/`maxLength`.
// We clamp/truncate in code instead.
const classifySchema = z.object({
  is_opportunity: z.boolean(),
  confidence: z.number(),
  reason: z.string().nullable(),
});

export type ClassifyResult = z.infer<typeof classifySchema>;

export async function llmConfirm(
  subject: string | null,
  sender: string | null,
  cleanedBody: string,
): Promise<ClassifyResult> {
  const model = createChatModel({ temperature: 0 }).withStructuredOutput(
    classifySchema,
    { name: "classify_opportunity" },
  );
  const prompt = CLASSIFY_PROMPT.replace("{subject}", subject ?? "")
    .replace("{sender}", sender ?? "")
    .replace("{body}", cleanedBody.slice(0, 6000));

  const MAX_ATTEMPTS = 3;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await model.invoke(prompt);
      return {
        is_opportunity: Boolean(raw.is_opportunity),
        confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0)),
        reason: raw.reason ? raw.reason.slice(0, 200) : null,
      };
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  console.error("[classify] llmConfirm failed after retries:", msg);
  // Don't silently mark as noise — surface the failure so the caller can decide.
  // We return null-ish (is_opportunity unknown) to let the rule score fall back.
  return { is_opportunity: false, confidence: 0, reason: "llm_failure" };
}

export async function classify(
  subject: string | null,
  sender: string | null,
  cleanedBody: string,
): Promise<{
  rule: number;
  llm: ClassifyResult | null;
  is_opportunity: boolean;
  confidence: number;
}> {
  const rule = ruleScore(subject, sender, cleanedBody);
  // Very low rule score -> almost certainly noise, skip LLM.
  if (rule < 0.2) {
    return { rule, llm: null, is_opportunity: false, confidence: rule };
  }
  const llm = await llmConfirm(subject, sender, cleanedBody);
  const isLlmFailure = llm.reason === "llm_failure";

  // If the LLM transiently failed, trust the rule score alone rather than defaulting to noise.
  if (isLlmFailure) {
    const confidence = rule;
    return {
      rule,
      llm: null,
      is_opportunity: rule >= 0.45,
      confidence,
    };
  }

  const combined = 0.35 * rule + 0.65 * llm.confidence;

  // A very strong rule signal (typically subject contains multiple explicit
  // opportunity keywords) overrides an LLM "no" — bodies of placement-office
  // forwards are often just "see attached" and the LLM can't judge from that.
  const strongRule = rule >= 0.6;

  return {
    rule,
    llm,
    is_opportunity:
      strongRule || (llm.is_opportunity && combined >= 0.4),
    confidence: strongRule ? Math.max(rule, combined) : combined,
  };
}
