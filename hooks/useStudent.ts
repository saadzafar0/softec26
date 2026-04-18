"use client";
import { useEffect, useState } from "react";

const KEY = "opportunity-radar:student_id";

export function useStudentId() {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored) setId(stored);
    } catch {}
  }, []);

  const save = (next: string | null) => {
    setId(next);
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {}
  };

  return { studentId: id, setStudentId: save };
}
