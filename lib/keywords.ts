// Single source of truth for the opportunity-keyword vocabulary.
//
// Two consumers use this list:
//   - `lib/gmail.ts`: builds the server-side Gmail search `q` that decides
//     which messages we ever download.
//   - `lib/classify.ts`: rule-based score that runs on every cleaned email.
//
// Keeping them in one file prevents drift, where the classifier knows keywords
// the Gmail fetch stage never matched (silently dropping opportunities).
//
// Each entry carries:
//   - `gmail`: a fragment in Gmail search-operator syntax. `undefined` means
//     this term is used only by the classifier (e.g. raw degree words that
//     would make the Gmail query match almost every email ever sent).
//   - `rx`:    a JS RegExp used by the classifier's rule scorer.
//
// Gmail syntax notes:
//   - `{a b}`    means `a OR b` (short form).
//   - `"foo bar"` is an exact phrase; without quotes it's AND of loose tokens.
//   - `OR` must be uppercase.

export type OpportunityKeyword = {
  gmail?: string;
  rx: RegExp;
};

export const OPPORTUNITY_KEYWORDS: OpportunityKeyword[] = [
  // Core opportunity nouns
  { gmail: "{scholarship scholarships}", rx: /\bscholarship(s)?\b/i },
  { gmail: "{internship internships}", rx: /\binternship(s)?\b/i },
  { gmail: "{fellowship fellowships}", rx: /\bfellowship(s)?\b/i },
  { gmail: "{grant grants}", rx: /\bgrant(s)?\b/i },
  { gmail: "{bursary bursaries}", rx: /\bbursar(y|ies)\b/i },
  { gmail: "studentship", rx: /\bstudentship\b/i },
  { gmail: "stipend", rx: /\bstipend\b/i },
  { gmail: "tuition", rx: /\btuition\b/i },
  { gmail: "eligibility", rx: /\beligibility\b/i },

  // Calls to action
  { gmail: "\"call for applications\"", rx: /\bcall for applications\b/i },
  { gmail: "\"call for papers\"", rx: /\bcall for papers\b/i },
  { gmail: "\"call for proposals\"", rx: /\bcall for proposals\b/i },
  {
    gmail: "\"now accepting applications\"",
    rx: /\bnow accepting applications\b/i,
  },
  { gmail: "\"open for applications\"", rx: /\bopen for applications\b/i },
  { gmail: "\"applications are open\"", rx: /\bapplications are open\b/i },
  {
    gmail:
      "\"apply by\" OR \"apply before\" OR \"apply now\" OR \"apply online\" OR \"apply via\" OR \"apply through\" OR \"apply here\"",
    rx: /\bapply (by|before|now|online|via|through|here)\b/i,
  },
  { gmail: "\"register by\"", rx: /\bregister by\b/i },
  { gmail: "\"registration open\"", rx: /\bregistration (is )?open\b/i },

  // Funding signals
  {
    gmail: "\"fully funded\" OR \"fully-funded\" OR \"full funding\"",
    rx: /\b(fully[- ]funded|full funding)\b/i,
  },

  // Urgency marker (noisy on its own, useful in combination)
  { gmail: "deadline", rx: /\bdeadline\b/i },

  // Generic opportunity words
  { gmail: "{opportunity opportunities}", rx: /\bopportunit(y|ies)\b/i },
  { gmail: "hackathon", rx: /\bhackathon\b/i },
  { gmail: "competition", rx: /\bcompetition\b/i },
  { gmail: "bootcamp", rx: /\bbootcamp\b/i },
  { gmail: "workshop", rx: /\bworkshop\b/i },
  { gmail: "{award awards}", rx: /\baward(s)?\b/i },
  { gmail: "prize", rx: /\bprize\b/i },

  // Program phrases (quoted to avoid matching unrelated AND-tokens)
  {
    gmail:
      "\"summer program\" OR \"summer programme\" OR \"summer school\" OR \"summer camp\"",
    rx: /\bsummer (camp|school|program|programme)\b/i,
  },
  {
    gmail:
      "\"exchange program\" OR \"exchange programme\" OR \"exchange semester\"",
    rx: /\bexchange (program|programme|semester)\b/i,
  },
  {
    gmail:
      "\"leadership program\" OR \"leadership programme\" OR \"leadership academy\"",
    rx: /\bleadership (program|programme|academy)\b/i,
  },
  {
    gmail: "\"mentorship program\" OR \"mentorship programme\"",
    rx: /\bmentorship (program|programme)\b/i,
  },
  {
    gmail:
      "\"research program\" OR \"research programme\" OR \"research assistantship\" OR \"research opportunity\"",
    rx: /\bresearch (program|programme|opportunity|assistantship)\b/i,
  },

  // Classifier-only signals — too generic for Gmail search (would match every
  // career/HR email ever), but useful as weak positive signals once we've
  // already filtered to the candidate set.
  { rx: /\b(undergraduate|graduate|phd|masters?)\b/i },
];

// All regexes — consumed by the rule-based classifier.
export const OPPORTUNITY_RX: RegExp[] = OPPORTUNITY_KEYWORDS.map((k) => k.rx);

// How far back Gmail looks. Scholarships/fellowships are often announced
// 3-6 months before their deadlines, so keep this comfortably above 60 days.
export const GMAIL_WINDOW_DAYS = 120;

// Senders / labels to exclude at the Gmail search stage. These sources are
// high-volume and never carry real opportunity emails, so filtering them out
// server-side preserves our 15-message budget for signal.
//   - `-from:classroom.google.com` drops Google Classroom assignment /
//     announcement notifications (matches no-reply@classroom.google.com and
//     any *@classroom.google.com variant).
//   - `-in:sent -in:drafts -in:chats` keeps the search restricted to mail
//     actually received from others. Without these, Gmail happily returns
//     your own outgoing messages (a forwarded scholarship link, a half-written
//     draft, chat logs) and wastes the 15-message budget on non-opportunities.
//   - `-in:spam -in:trash` are redundant in theory — Gmail's default search
//     excludes Spam and Trash unless you opt in with `in:anywhere` — but we
//     list them explicitly so the filter is self-documenting and survives any
//     future reshuffle of the query.
export const GMAIL_EXCLUSIONS: string[] = [
  "-from:classroom.google.com",
  "-in:sent",
  "-in:drafts",
  "-in:chats",
  "-in:spam",
  "-in:trash",
];

/**
 * Build the Gmail `q` parameter string from the keyword list.
 * Only entries that declare a `gmail` fragment are included.
 */
export function buildGmailQuery(windowDays: number = GMAIL_WINDOW_DAYS): string {
  const fragments = OPPORTUNITY_KEYWORDS
    .map((k) => k.gmail)
    .filter((g): g is string => typeof g === "string" && g.length > 0);
  const exclusions = GMAIL_EXCLUSIONS.join(" ");
  return `(${fragments.join(" OR ")})${exclusions ? ` ${exclusions}` : ""} newer_than:${windowDays}d`;
}
