import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase";
import { rescoreStudent } from "@/lib/rescore";
import type { Student } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const schema = z.object({
  student_id: z.string().uuid(),
  include_hidden: z.boolean().default(true),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "student_id required" },
      { status: 400 },
    );
  }
  const supabase = createServerSupabase();

  const { data: studentRow, error: studentErr } = await supabase
    .from("students")
    .select("*")
    .eq("id", parsed.data.student_id)
    .single();
  if (studentErr || !studentRow) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  try {
    const items = await rescoreStudent(supabase, studentRow as Student, {
      includeHidden: parsed.data.include_hidden,
    });
    return NextResponse.json({ rescored: items.length, items });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Rescore failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
