"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const from = sp.get("from") || "/dashboard";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const supabase = supabaseClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) router.replace(from);
      } catch {}
    })();
  }, [router, from]);

  async function sendLink() {
    setStatus("Sending magic link...");
    try {
      const supabase = supabaseClient();

      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;

      setStatus("✅ Magic link sent. Check your email (and spam).");
    } catch (e: any) {
      setStatus(`❌ ${e?.message || "Failed to send link"}`);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Login</h1>
      <p style={{ color: "#6b7280", marginTop: 8 }}>
        Eventura OS (CEO / Staff) – sign in with email magic link.
      </p>

      <div style={{ marginTop: 12, maxWidth: 420 }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Email</div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 10,
            border: "1px solid #e5e7eb",
          }}
        />

        <button
          onClick={sendLink}
          style={{
            marginTop: 10,
            padding: "12px 14px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            fontWeight: 900,
          }}
        >
          Send magic link
        </button>

        {status ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              whiteSpace: "pre-wrap",
            }}
          >
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}
