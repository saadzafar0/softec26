import { NextResponse } from "next/server";
import { z } from "zod";
import { buildAuthUrl } from "@/lib/gmail";

export const runtime = "nodejs";

const startSchema = z.object({ student_id: z.string().uuid() });

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = startSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "student_id required" },
      { status: 400 },
    );
  }
  try {
    const url = buildAuthUrl(parsed.data.student_id);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      {
        error: "OAuth not configured",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
