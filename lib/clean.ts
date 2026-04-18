import { createHash } from "node:crypto";
import * as cheerio from "cheerio";

const SIGNATURE_MARKERS = [
  /^--\s*$/m,
  /^Sent from my /im,
  /^Unsubscribe/im,
  /^You are receiving this/im,
  /^This email was sent to/im,
  /^To stop receiving/im,
];

export function stripHtml(input: string): string {
  if (!input) return "";
  const looksHtml = /<[a-z][^>]*>/i.test(input);
  if (!looksHtml) return input;
  const $ = cheerio.load(input);
  $("script, style, head, meta, link").remove();
  $("a").each((_: number, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().trim();
    if (href && href !== text) $(el).replaceWith(`${text} (${href})`);
  });
  return $("body").text() || $.text();
}

export function cleanEmailBody(raw: string): string {
  const text = stripHtml(raw);
  let out = text;
  for (const marker of SIGNATURE_MARKERS) {
    const match = out.match(marker);
    if (match && typeof match.index === "number") {
      out = out.slice(0, match.index);
    }
  }
  out = out
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return out;
}

export function cleanedHash(
  sender: string | null,
  subject: string | null,
  cleanedBody: string,
): string {
  const normalizedBody = cleanedBody
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const input = `${sender ?? ""}|${subject ?? ""}|${normalizedBody}`;
  return createHash("sha256").update(input).digest("hex");
}

export function senderDomain(sender: string | null): string | null {
  if (!sender) return null;
  const match = sender.match(/[\w.+-]+@([\w.-]+)/);
  return match?.[1]?.toLowerCase() ?? null;
}
