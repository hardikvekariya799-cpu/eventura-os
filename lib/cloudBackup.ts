import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Deploy-safe: returns null if env vars missing (no crash)
export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

export async function getSessionEmail(): Promise<string> {
  if (typeof window === "undefined") return "";
  const sb = getSupabase();
  if (!sb) return localStorage.getItem("eventura_email") || "";
  const { data } = await sb.auth.getSession();
  return data.session?.user?.email || "";
}

export async function cloudUpsert(key: string, value: any) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured.");
  const { data: sess } = await sb.auth.getSession();
  const user = sess.session?.user;
  if (!user) throw new Error("Not signed in.");

  const { error } = await sb
    .from("user_data")
    .upsert(
      { user_id: user.id, key, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );

  if (error) throw error;
}

export async function cloudGet(key: string) {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured.");
  const { data: sess } = await sb.auth.getSession();
  const user = sess.session?.user;
  if (!user) throw new Error("Not signed in.");

  const { data, error } = await sb
    .from("user_data")
    .select("value")
    .eq("user_id", user.id)
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;
  return data?.value ?? null;
}
