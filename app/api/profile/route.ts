import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase";
import { embedOne, pgvectorLiteral } from "@/lib/langchain";
import { narrateProfile } from "@/lib/narrate";

export const runtime = "nodejs";

const profileSchema = z.object({
  email: z.string().email(),
  degree: z.string().nullable().optional(),
  program: z.string().nullable().optional(),
  semester: z.number().int().min(1).max(8).nullable().optional(),
  cgpa: z.number().min(0).max(4).nullable().optional(),
  skills: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  preferred_types: z.array(z.string()).default([]),
  financial_need: z.boolean().default(false),
  location_pref: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
  graduation_date: z.string().nullable().optional(),
});

const getProfileSchema = z.object({
  student_id: z.string().uuid(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = getProfileSchema.safeParse({
    student_id: searchParams.get("student_id"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid student_id" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, email, degree, program, semester, cgpa, skills, interests, preferred_types, financial_need, location_pref, nationality, graduation_date",
    )
    .eq("id", parsed.data.student_id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Profile not found", details: error?.message },
      { status: 404 },
    );
  }

  return NextResponse.json({ profile: data });
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = profileSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServerSupabase();
  const row = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  const { data: student, error } = await supabase
    .from("students")
    .upsert(row, { onConflict: "email" })
    .select("*")
    .single();
  if (error || !student) {
    return NextResponse.json(
      { error: "Failed to save profile", details: error?.message },
      { status: 500 },
    );
  }

  const narrated = narrateProfile(student);
  try {
    const vec = await embedOne(narrated);
    await supabase.from("student_profile_embeddings").upsert(
      {
        student_id: student.id,
        narrated_text: narrated,
        embedding: pgvectorLiteral(vec),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id" },
    );
    // Edge case: profile updated -> invalidate cached semantic scores for rescoring
    await supabase
      .from("opportunities")
      .update({ semantic_score: null, final_score: null })
      .eq("student_id", student.id);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Profile saved but embedding failed",
        details: err instanceof Error ? err.message : String(err),
        student_id: student.id,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ student_id: student.id, narrated });
}
