import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public values (inlined at build time). The publishable key is meant for browsers: access is
// limited by Row Level Security in the database, not by keeping this key secret.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** With both variables set the app uses Supabase and requires login; otherwise localStorage. */
export const isSupabaseConfigured = Boolean(url && key);

/**
 * What this build received (never the values), to diagnose configuration problems.
 * NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA is set by Vercel when system variables are exposed.
 */
export const buildInfo = {
  hasUrl: Boolean(url),
  urlLooksRight: Boolean(url && /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url)),
  hasKey: Boolean(key),
  commit: (process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null,
};

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !key) throw new Error("Supabase is not configured");
  // Magic links bring the session in the URL; supabase-js reads it on start.
  client ??= createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}
