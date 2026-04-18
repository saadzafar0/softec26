export const SYSTEM_PROMPT = "You are a helpful assistant.";

export const NARRATE_PROFILE_PROMPT = `You write a concise one-paragraph narrated profile (4-6 sentences) for a university student, used for semantic matching against scholarship and internship emails. Use the JSON below. Write in first person. Mention degree, program, semester, CGPA, skills, interests, preferred opportunity types, financial need, location preference, and nationality only if present. Do not invent values.

Profile JSON:
{profile}

Return only the narrated paragraph, no preamble.`;

export const CLASSIFY_PROMPT = `You are a binary classifier. Decide if this email describes a concrete scholarship, internship, fellowship, grant, research program, exchange, leadership program, summer school, or similar student opportunity that the recipient could apply to.

Return is_opportunity=true when the email announces or forwards a specific program, even if the full details (exact deadline, link, or eligibility) are only in an attachment or require contacting an office. Placement office forwards, university announcements forwarding opportunities, and "apply through this portal / contact X" style emails ARE opportunities.

Return is_opportunity=false for: classroom / LMS notifications, assignment deadlines, course viva schedules, generic newsletters that don't describe a single program, marketing/product emails (Kaggle, LinkedIn jobs digest, etc.), event invitations with no application path, and purely informational announcements.

Give more weight to the subject line — it is usually the clearest signal. Use confidence in [0,1].

Subject: {subject}
Sender: {sender}
Body:
"""
{body}
"""`;

export const EXTRACT_PROMPT = `Extract structured fields from this opportunity email. Use the original wording from the email; do not invent facts. Use null for unknown fields. Dates must be ISO yyyy-mm-dd. If the email mentions a rolling or year-round deadline, leave deadline null and set deadline_ambiguous=true. Only include an application_link if a URL appears verbatim in the email.

Contact information rules:
- contact_email: an application or queries email ONLY IF it appears verbatim in the body (e.g. "send your CV to careers@…", "for queries: info@…"). Not the sender's address. Not a generic noreply. Null if none.
- contact_phone: a phone number for queries that appears verbatim in the body. Null if none.
- contact_person: the named person or role the email tells the student to contact (e.g. "Ms. Ayesha Khan", "Placement Coordinator"). Null if none.

Email subject: {subject}
Sender: {sender}
Body:
"""
{body}
"""`;

export const EXPLAIN_PROMPT = `Write a short explanation (2-3 sentences) for why this opportunity matches the student, and a concrete action checklist of 4-7 items the student should do next to apply. Speak directly to the student. Be specific to the extracted fields. Do not repeat the explanation inside the checklist.

Also return 1 to 3 evidence_quotes. Each quote MUST be a short, VERBATIM snippet (3 to 20 words) copied directly from the source_email below, with nothing added or paraphrased. Pair each quote with a brief label (2 to 5 words) naming the claim it backs, e.g. "deadline", "eligibility", "funding", "how to apply". Prefer quotes that substantiate the strongest ranking signals (deadline, eligibility fit, funding, contact). If the email has fewer than 3 quotable lines, return fewer — never fabricate.

Student profile (narrated): {profile}
Opportunity fields JSON: {opportunity}
Org context: {org}
Scores JSON: {scores}
Source email (verbatim):
"""
{source_email}
"""`;
