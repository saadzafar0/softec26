import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

const endpoint = "https://models.github.ai/inference";

const chatModel = process.env["GH_MODELS_CHAT"] ?? "openai/gpt-4.1-mini";
const embedModel =
  process.env["GH_MODELS_EMBED"] ?? "openai/text-embedding-3-small";

function requireToken(): string {
  const token = process.env["GITHUB_TOKEN"];
  if (!token) throw new Error("Missing GITHUB_TOKEN in environment.");
  return token;
}

export function createChatModel(options?: { temperature?: number }) {
  return new ChatOpenAI({
    apiKey: requireToken(),
    model: chatModel,
    temperature: options?.temperature ?? 0.2,
    configuration: { baseURL: endpoint },
  });
}

export function createEmbeddings() {
  return new OpenAIEmbeddings({
    apiKey: requireToken(),
    model: embedModel,
    configuration: { baseURL: endpoint },
  });
}

/**
 * Embed a batch of texts with size-limited chunking + linear backoff on 429s.
 * GitHub Models has stricter rate limits than OpenAI proper.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const embeddings = createEmbeddings();
  const out: number[][] = [];
  const BATCH = 16;
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH).map((t) => t.slice(0, 8000));
    let attempt = 0;
    for (;;) {
      try {
        const vecs = await embeddings.embedDocuments(slice);
        out.push(...vecs);
        break;
      } catch (err) {
        attempt += 1;
        if (attempt >= 4) throw err;
        const wait = 500 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  return out;
}

export async function embedOne(text: string): Promise<number[]> {
  const [vec] = await embedBatch([text]);
  if (!vec) throw new Error("embedOne: empty embedding");
  return vec;
}

export function pgvectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/**
 * Wrap an async LLM call with linear-exponential retry. Returns null if all
 * attempts fail. Designed for transient GitHub Models 429 / 503 errors that
 * otherwise silently turn opportunities into noise.
 *
 * `label` is included in the failure log so we can tell extract failures from
 * explain failures from classify failures in the server console.
 */
export async function withLLMRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts: number = 3,
): Promise<T | null> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  console.error(`[${label}] failed after ${maxAttempts} attempts:`, msg);
  return null;
}
