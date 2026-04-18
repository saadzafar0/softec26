"use client";
import { useEffect, useState } from "react";

const ID_KEY = "opportunity-radar:student_id";
const EMAIL_KEY = "opportunity-radar:student_email";
const AUTH_EVENT = "opportunity-radar:auth-change";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function notifyAuthChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function useStudentId() {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setId(readStorage(ID_KEY));
    sync();
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = (next: string | null) => {
    setId(next);
    writeStorage(ID_KEY, next);
    notifyAuthChange();
  };

  return { studentId: id, setStudentId: save };
}

export function useStudent() {
  const [id, setId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      setId(readStorage(ID_KEY));
      setEmail(readStorage(EMAIL_KEY));
      setHydrated(true);
    };
    sync();
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const signIn = (nextId: string, nextEmail: string) => {
    setId(nextId);
    setEmail(nextEmail);
    writeStorage(ID_KEY, nextId);
    writeStorage(EMAIL_KEY, nextEmail);
    notifyAuthChange();
  };

  const signOut = () => {
    setId(null);
    setEmail(null);
    writeStorage(ID_KEY, null);
    writeStorage(EMAIL_KEY, null);
    notifyAuthChange();
  };

  return {
    studentId: id,
    studentEmail: email,
    isAuthenticated: Boolean(id),
    hydrated,
    signIn,
    signOut,
  };
}
