import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return {
    url,
    key,
    ok: Boolean(url && key),
  };
}

/**
 * Lazy client: does NOT crash your app at import time.
 * It will only throw when you actually try to use Supabase.
 */
export function supabaseClient(): SupabaseClient {
  const env = getSupabaseEnv();

  if (!env.ok) {
    throw new Error(
      [
        "Supabase env missing.",
        "",
        "Fix this:",
        "1) Make sure .env.local is in PROJECT ROOT (same folder as package.json).",
        "2) It must contain (no quotes):",
        "   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co",
        "   NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx (anon public key)",
        "3) Restart dev server: Ctrl+C then npm run dev",
      ].join("\n")
    );
  }

  if (!client) {
    client = createClient(env.url, env.key);
  }
  return client;
}
