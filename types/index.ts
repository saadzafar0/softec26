export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type Student = {
  id: string;
  email: string;
  degree: string | null;
  program: string | null;
  semester: number | null;
  cgpa: number | null;
  skills: string[];
  interests: string[];
  preferred_types: string[];
  financial_need: boolean;
  location_pref: string | null;
  nationality: string | null;
  graduation_date: string | null;
  gmail_refresh_token: string | null;
  gmail_email: string | null;
  created_at: string;
  updated_at: string;
};

export type OpportunityStatus = "active" | "expired" | "ineligible" | "noise";
export type UrgencyFlag = "Red" | "Orange" | "Yellow" | "Green";
export type ChunkType =
  | "header"
  | "eligibility"
  | "benefits"
  | "documents"
  | "deadline";

export type RawEmail = {
  id: string;
  student_id: string;
  gmail_message_id: string | null;
  subject: string | null;
  sender: string | null;
  sender_domain: string | null;
  received_at: string | null;
  raw_body: string | null;
  cleaned_body: string | null;
  cleaned_hash: string | null;
  source: "gmail" | "manual";
  ingested_at: string;
};

export type Opportunity = {
  id: string;
  raw_email_id: string;
  student_id: string;
  is_opportunity: boolean | null;
  confidence: number | null;
  status: OpportunityStatus;
  opp_type: string | null;
  org_name: string | null;
  deadline: string | null;
  deadline_ambiguous: boolean;
  eligibility_raw: string | null;
  cgpa_required: number | null;
  degree_required: string | null;
  skills_required: string[];
  documents_required: string[];
  benefits: string | null;
  funding_type: string | null;
  geo_scope: string | null;
  application_link: string | null;
  inferred_fields: string[];
  profile_fit_score: number | null;
  urgency_score: number | null;
  value_score: number | null;
  semantic_score: number | null;
  final_score: number | null;
  explanation: string | null;
  action_checklist: string[];
  urgency_flag: UrgencyFlag | null;
  created_at: string;
};

export type ApiError = { error: string; code?: string; details?: unknown };
