"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStudent } from "@/hooks/useStudent";
import { useTheme } from "@/hooks/useTheme";

const tabs = [
  { href: "/", label: "Profile" },
  { href: "/connect", label: "Inbox" },
  { href: "/dashboard", label: "Dashboard" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, hydrated, studentEmail, signOut } = useStudent();

  const handleSignOut = () => {
    signOut();
    router.replace("/signin");
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-6">
        <Link
          href={isAuthenticated ? "/dashboard" : "/signin"}
          className="text-sm font-semibold tracking-tight"
        >
          Opportunity Radar
        </Link>

        <nav className="flex items-center gap-1">
          {hydrated && isAuthenticated ? (
            <>
              {tabs.map((t) => {
                const active = pathname === t.href;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                        : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                    )}
                  >
                    {t.label}
                  </Link>
                );
              })}
              <span className="mx-2 hidden h-5 w-px bg-zinc-200 dark:bg-zinc-800 sm:block" />
              {studentEmail ? (
                <span
                  className="hidden max-w-[180px] truncate text-xs text-zinc-500 dark:text-zinc-400 sm:inline"
                  title={studentEmail}
                >
                  {studentEmail}
                </span>
              ) : null}
              <ThemeToggle />
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Sign out
              </button>
            </>
          ) : hydrated ? (
            <>
              <ThemeToggle />
              <Link
                href="/signin"
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Sign in
              </Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme, hydrated } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {!hydrated ? (
        <span className="h-4 w-4" />
      ) : isDark ? (
        <SunIcon />
      ) : (
        <MoonIcon />
      )}
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
