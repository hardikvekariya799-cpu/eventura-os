"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const supabase = supabaseClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) router.replace("/dashboard");
      } catch {}
    })();
  }, [router]);

  async function sendMagicLink() {
    setStatus("Sending magic link...");
    try {
      const supabase = supabaseClient();
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;
      setStatus("✅ Magic link sent. Open it on the SAME device/browser you requested it.");
    } catch (e: any) {
      setStatus(`❌ ${e?.message || "Failed to send link"}`);
    }
  }

  async function sendOTPCode() {
    setStatus("Sending OTP code...");
    try {
      const supabase = supabaseClient();

      // Supabase sends an email; if user opens on another device, OTP still works.
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });

      if (error) throw error;

      setStatus("✅ OTP sent. Check email and enter the code below, then Verify Code.");
    } catch (e: any) {
      setStatus(`❌ ${e?.message || "Failed to send OTP"}`);
    }
  }

  async function verifyOTP() {
    setStatus("Verifying code...");
    try {
      const supabase = supabaseClient();

      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });

      if (error) throw error;

      setStatus("✅ Verified! Redirecting...");
      router.replace("/dashboard");
    } catch (e: any) {
      setStatus(`❌ ${e?.message || "Verification failed"}`);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Login</h1>
      <p style={{ color: "#6b7280", marginTop: 8 }}>
        Use Magic Link (same device) OR OTP Code (works across devices).
      </p>

      <div style={{ marginTop: 12, maxWidth: 480 }}>
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

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <button
            onClick={sendMagicLink}
            style={{ padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 900 }}
          >
            Send magic link
          </button>

          <button
            onClick={sendOTPCode}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Send OTP code
          </button>
        </div>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>OTP Code</div>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code from email"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
            }}
          />

          <button
            onClick={verifyOTP}
            style={{ marginTop: 10, padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 900 }}
          >
            Verify Code
          </button>
        </div>

        {status ? (
          <pre
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
          </pre>
        ) : null}
      </div>
    </main>
  );
}
