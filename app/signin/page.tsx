"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudent } from "@/hooks/useStudent";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInInner />
    </Suspense>
  );
}

function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { studentId, isAuthenticated, hydrated, signIn } = useStudent();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    const sid = params.get("student_id");
    const email = params.get("email");
    const errParam = params.get("error");

    if (errParam) {
      setError(decodeURIComponent(errParam));
      return;
    }

    if (sid && email) {
      const wasReconnect = studentId === sid;
      signIn(sid, email);
      router.replace(wasReconnect ? "/connect" : "/");
    }
  }, [hydrated, params, signIn, router, studentId]);

  useEffect(() => {
    if (hydrated && isAuthenticated && !params.get("student_id")) {
      router.replace("/dashboard");
    }
  }, [hydrated, isAuthenticated, router, params]);

  const startGoogle = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/gmail/start", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start Google sign in.");
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <Card className="w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Use your Google account to sign in and let us scan your inbox for
            opportunities.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            onClick={startGoogle}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2"
          >
            <GoogleGlyph />
            {submitting ? "Redirecting…" : "Continue with Google"}
          </Button>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            We request read-only Gmail access. Your refresh token stays on our
            server and is only used to fetch recent messages on your behalf.
          </p>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            New here? Signing in with Google also creates your account. You'll
            add your study details on the next page.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
    >
      <path
        d="M21.35 11.1h-9.2v2.98h5.3c-.23 1.4-1.64 4.1-5.3 4.1-3.19 0-5.8-2.64-5.8-5.9s2.61-5.9 5.8-5.9c1.82 0 3.04.77 3.74 1.44l2.55-2.47C16.97 4.06 14.93 3.2 12.15 3.2 6.98 3.2 2.8 7.37 2.8 12.3s4.18 9.1 9.35 9.1c5.4 0 8.97-3.79 8.97-9.13 0-.61-.07-1.08-.17-1.57z"
        fill="currentColor"
      />
    </svg>
  );
}
