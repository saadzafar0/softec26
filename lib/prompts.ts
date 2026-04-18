export const SYSTEM_PROMPT = "You are a helpful assistant.";

export const NARRATE_PROFILE_PROMPT = `You write a concise one-paragraph narrated profile (4-6 sentences) for a university student, used for semantic matching against scholarship and internship emails. Use the JSON below. Write in first person. Mention degree, program, semester, CGPA, skills, interests, preferred opportunity types, financial need, location preference, and nationality only if present. Do not invent values.

Profile JSON:
{profile}

Return only the narrated paragraph, no preamble.`;

export const CLASSIFY_PROMPT = `You are a binary classifier. Given an email body, decide if it describes a concrete scholarship, internship, fellowship, grant, research program, or job opportunity that a student could apply to. Return is_opportunity=true only if there is a real application path (deadline, link, or contact). Newsletters summarizing many programs without an application path are false. Marketing/promotions/notifications are false.

Email:
"""
{email}
"""`;

export const EXTRACT_PROMPT = `Extract structured fields from this opportunity email. Use the original wording from the email; do not invent facts. Use null for unknown fields. Dates must be ISO yyyy-mm-dd. If the email mentions a rolling or year-round deadline, leave deadline null and set deadline_ambiguous=true. Only include an application_link if a URL appears verbatim in the email.

Email subject: {subject}
Sender: {sender}
Body:
"""
{body}
"""`;

export const EXPLAIN_PROMPT = `Write a short explanation (2-3 sentences) for why this opportunity matches the student, and a concrete action checklist of 4-7 items the student should do next to apply. Speak directly to the student. Be specific to the extracted fields. Do not repeat the explanation inside the checklist.

Student profile (narrated): {profile}
Opportunity fields JSON: {opportunity}
Org context: {org}
Scores JSON: {scores}`;
