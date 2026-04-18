import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedServer: SupabaseClient | null = null;
let cachedBrowser: SupabaseClient | null = null;

export function createServerSupabase(): SupabaseClient {
  if (cachedServer) return cachedServer;
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  cachedServer = createClient(url, serviceKey, {
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
