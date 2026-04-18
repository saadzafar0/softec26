import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedServer: SupabaseClient | null = null;
let cachedBrowser: SupabaseClient | null = null;

export function createServerSupabase(): SupabaseClient {
  if (cachedServer) return cachedServer;
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  // Prefer the new secret key (sb_secret_...) introduced in 2025; fall back to
  // the legacy service_role JWT for backward compatibility.
  const serverKey =
    process.env["SUPABASE_SECRET_KEY"] ??
    process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serverKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  cachedServer = createClient(url, serverKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedServer;
}

export function createBrowserSupabase(): SupabaseClient {
  if (cachedBrowser) return cachedBrowser;
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const publishable =
    process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (!url || !publishable) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  cachedBrowser = createClient(url, publishable);
  return cachedBrowser;
}
