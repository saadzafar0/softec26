import { google, type gmail_v1 } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

const GMAIL_QUERY =
  'scholarship OR internship OR fellowship OR "call for applications" OR opportunity OR grant OR "apply by" OR deadline newer_than:60d';

export function getOAuthClient() {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  const redirectUri = process.env["GOOGLE_REDIRECT_URI"];
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI",
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function buildAuthUrl(state: string): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCode(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const profile = await oauth2.userinfo.get();
  return {
    refreshToken: tokens.refresh_token ?? null,
    email: profile.data.email ?? null,
  };
}

export function clientForRefreshToken(refreshToken: string) {
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export type FetchedEmail = {
  gmailMessageId: string;
  subject: string | null;
  sender: string | null;
  receivedAt: string | null;
  rawBody: string;
};

function b64urlDecode(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  const plain = findPart(payload, "text/plain");
  if (plain?.body?.data) return b64urlDecode(plain.body.data);
  const html = findPart(payload, "text/html");
  if (html?.body?.data) return b64urlDecode(html.body.data);
  if (payload.body?.data) return b64urlDecode(payload.body.data);
  return "";
}

function findPart(
  part: gmail_v1.Schema$MessagePart,
  mimeType: string,
): gmail_v1.Schema$MessagePart | null {
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }
  return null;
}

function headerValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string | null {
  if (!headers) return null;
  const match = headers.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase(),
  );
  return match?.value ?? null;
}

export async function fetchRecentEmails(
  refreshToken: string,
  maxResults = 15,
): Promise<FetchedEmail[]> {
  const auth = clientForRefreshToken(refreshToken);
  const gmail = google.gmail({ version: "v1", auth });

  const list = await gmail.users.messages.list({
    userId: "me",
    q: GMAIL_QUERY,
    maxResults,
  });

  const ids = (list.data.messages ?? [])
    .map((m) => m.id)
    .filter((x): x is string => Boolean(x));

  const results: FetchedEmail[] = [];
  for (const id of ids) {
    const msg = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });
    const payload = msg.data.payload;
    const headers = payload?.headers;
    const subject = headerValue(headers, "Subject");
    const sender = headerValue(headers, "From");
    const dateStr = headerValue(headers, "Date");
    const received = dateStr ? new Date(dateStr).toISOString() : null;
    const rawBody = extractBody(payload);
    if (!rawBody) continue;
    results.push({
      gmailMessageId: id,
      subject,
      sender,
      receivedAt: received,
      rawBody,
    });
  }
  return results;
}

export function isReauthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("invalid_grant") ||
    msg.includes("Token has been expired") ||
    msg.includes("invalid_token")
  );
}
