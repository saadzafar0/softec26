import type { Student } from "@/types";

export function narrateProfile(student: Partial<Student>): string {
  const parts: string[] = [];
  const role = [
    student.semester ? `${ordinal(student.semester)}-semester` : null,
    student.degree,
    student.program,
  ]
    .filter(Boolean)
    .join(" ");
  if (role) parts.push(`I am a ${role} student`);
  else parts.push("I am a university student");

  if (student.cgpa !== null && student.cgpa !== undefined) {
    parts.push(`with a CGPA of ${student.cgpa}`);
  }
  if (student.nationality) parts.push(`from ${student.nationality}`);

  let sentence1 = parts.join(" ") + ".";

  const bits: string[] = [];
  if (student.skills?.length)
    bits.push(`My skills include ${student.skills.join(", ")}`);
  if (student.interests?.length)
    bits.push(`I am interested in ${student.interests.join(", ")}`);
  if (student.preferred_types?.length)
    bits.push(
      `I am looking for ${student.preferred_types.join(", ")} opportunities`,
    );
  if (student.financial_need) bits.push("I need financial support");
  if (student.location_pref)
    bits.push(`I prefer ${student.location_pref} opportunities`);
  if (student.graduation_date)
    bits.push(`I expect to graduate by ${student.graduation_date}`);

  const sentence2 = bits.length ? bits.join(". ") + "." : "";
  return [sentence1, sentence2].filter(Boolean).join(" ");
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
