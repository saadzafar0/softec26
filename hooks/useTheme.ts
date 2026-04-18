"use client";
import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const THEME_KEY = "opportunity-radar:theme";
const THEME_EVENT = "opportunity-radar:theme-change";

function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function applyThemeClass(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sync = () => {
      const stored = readStoredTheme();
      const next: Theme = stored ?? (systemPrefersDark() ? "dark" : "light");
      setThemeState(next);
      applyThemeClass(next);
      setHydrated(true);
    };
    sync();
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    applyThemeClass(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(THEME_EVENT));
    }
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return { theme, setTheme, toggleTheme, hydrated };
}
