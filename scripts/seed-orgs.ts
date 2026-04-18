/**
 * Seed the org_knowledge table and its embedding table.
 *
 * Run with: pnpm tsx scripts/seed-orgs.ts
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GITHUB_TOKEN
 */
import { createServerSupabase } from "@/lib/supabase";
import { embedBatch, pgvectorLiteral } from "@/lib/langchain";

type OrgSeed = {
  org_name: string;
  description: string;
  prestige_score: number;
  known_funding_type: "Full" | "Partial" | "None";
  typical_scope: "Local" | "National" | "International";
};

const ORGS: OrgSeed[] = [
  { org_name: "HEC Pakistan", description: "Higher Education Commission of Pakistan. Government body awarding local and international scholarships for Pakistani students across BS, MS, and PhD programs, covering tuition and stipend.", prestige_score: 8, known_funding_type: "Full", typical_scope: "National" },
  { org_name: "Fulbright", description: "US government flagship scholarship for international students to pursue masters and PhD in the United States, fully funded including tuition, stipend, travel, and insurance.", prestige_score: 10, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "DAAD", description: "German Academic Exchange Service. Fully funded scholarships for international students to study in Germany at masters and PhD level, including living stipend and travel.", prestige_score: 9, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Chevening", description: "UK government global scholarship program offering fully funded one-year masters degrees in the United Kingdom for outstanding emerging leaders.", prestige_score: 9, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Erasmus Mundus", description: "European Union joint masters programmes offering full scholarships for international students to study across multiple European universities.", prestige_score: 9, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Rhodes Scholarship", description: "Prestigious postgraduate scholarship for study at the University of Oxford, fully funded with stipend and tuition for exceptional students worldwide.", prestige_score: 10, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Schwarzman Scholars", description: "Fully funded one-year masters programme in global affairs at Tsinghua University in Beijing for future global leaders.", prestige_score: 9, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Commonwealth Scholarship", description: "UK Foreign and Commonwealth Office scholarships for students from Commonwealth countries to pursue masters and PhD in the UK, fully funded.", prestige_score: 9, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Aga Khan Foundation", description: "International Scholarship Programme providing 50 percent grant and 50 percent loan for postgraduate studies to outstanding students from select developing countries.", prestige_score: 7, known_funding_type: "Partial", typical_scope: "International" },
  { org_name: "MITACS Globalink", description: "Canadian research internship programme offering 12 week summer research placements at Canadian universities for international undergraduates with travel and living stipend.", prestige_score: 7, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Google", description: "Global technology company offering software engineering internships, STEP programme, and research internships worldwide, paid with competitive stipend and relocation.", prestige_score: 10, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Microsoft", description: "Global technology company offering software, research, and product internships worldwide, paid with stipend and housing support.", prestige_score: 10, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Meta", description: "Global social technology company offering paid software engineering and product internships with competitive compensation and housing.", prestige_score: 9, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Amazon", description: "Global technology and cloud company offering SDE and applied science internships worldwide with paid stipend and relocation support.", prestige_score: 9, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Alan Turing Institute", description: "UK national institute for data science and AI offering research internships and enrichment programmes for PhD and masters students.", prestige_score: 8, known_funding_type: "Partial", typical_scope: "International" },
  { org_name: "CERN", description: "European Organization for Nuclear Research offering summer student programmes and technical internships for physics, engineering, and computer science students with stipend.", prestige_score: 9, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "World Bank", description: "International financial institution offering summer internship programme for graduate students in economics, finance, and development with paid stipend.", prestige_score: 9, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "United Nations", description: "Intergovernmental organization offering internships across agencies for graduate students in international affairs, development, and policy.", prestige_score: 8, known_funding_type: "None", typical_scope: "International" },
  { org_name: "LUMS", description: "Lahore University of Management Sciences. Pakistani private university offering merit and need based financial aid and research assistantships for undergraduate and graduate programs.", prestige_score: 7, known_funding_type: "Partial", typical_scope: "National" },
  { org_name: "NUST", description: "National University of Sciences and Technology Pakistan. Public university offering need based scholarships, merit scholarships, and research assistantships to students.", prestige_score: 7, known_funding_type: "Partial", typical_scope: "National" },
  { org_name: "FCCU", description: "Forman Christian College University Lahore. Pakistani liberal arts university offering need based and merit scholarships, and international exchange opportunities.", prestige_score: 6, known_funding_type: "Partial", typical_scope: "National" },
  { org_name: "IBA Karachi", description: "Institute of Business Administration Karachi. Top Pakistani business school offering need based scholarships and merit awards for undergraduate and MBA programs.", prestige_score: 7, known_funding_type: "Partial", typical_scope: "National" },
  { org_name: "Gates Cambridge", description: "Fully funded postgraduate scholarship at the University of Cambridge for outstanding international students pursuing masters and PhD degrees.", prestige_score: 10, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Knight-Hennessy Scholars", description: "Fully funded graduate scholarship at Stanford University across all departments for outstanding students from around the world.", prestige_score: 10, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Clarendon Scholarship", description: "University of Oxford fully funded graduate scholarship for masters and doctoral students across all academic subjects.", prestige_score: 9, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Inlaks Scholarships", description: "India based foundation providing scholarships for Indian students to pursue masters and professional programmes at top universities abroad.", prestige_score: 7, known_funding_type: "Partial", typical_scope: "International" },
  { org_name: "Endeavour Leadership Program", description: "Australian government international scholarship for masters, PhD, and research for students worldwide, fully funded including tuition and stipend.", prestige_score: 8, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Monbukagakusho MEXT", description: "Japanese government scholarship for international students to pursue undergraduate and graduate studies in Japan, fully funded with stipend and travel.", prestige_score: 8, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "Khazanah", description: "Malaysian sovereign wealth fund scholarship for Malaysian students to pursue undergraduate and postgraduate studies domestically or internationally.", prestige_score: 7, known_funding_type: "Full", typical_scope: "International" },
  { org_name: "OpenAI", description: "AI research and deployment company offering paid residency and research engineer internship programmes for graduate students and engineers.", prestige_score: 9, known_funding_type: "Full", typical_scope: "International" },
];

async function main() {
  const supabase = createServerSupabase();

  const { error: insertErr } = await supabase
    .from("org_knowledge")
    .upsert(ORGS, { onConflict: "org_name" });
  if (insertErr) {
    console.error("Insert failed:", insertErr);
    process.exit(1);
  }
  console.log(`Upserted ${ORGS.length} org_knowledge rows.`);

  const { data: rows, error: fetchErr } = await supabase
    .from("org_knowledge")
    .select("id, description");
  if (fetchErr || !rows) {
    console.error("Fetch failed:", fetchErr);
    process.exit(1);
  }

  const vecs = await embedBatch(rows.map((r) => r.description ?? ""));
  const embRows = rows.map((r, i) => ({
    org_knowledge_id: r.id,
    embedding: pgvectorLiteral(vecs[i] ?? []),
  }));

  const { error: embErr } = await supabase
    .from("org_knowledge_embeddings")
    .upsert(embRows, { onConflict: "org_knowledge_id" });
  if (embErr) {
    console.error("Embedding upsert failed:", embErr);
    process.exit(1);
  }
  console.log(`Embedded ${embRows.length} org descriptions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
