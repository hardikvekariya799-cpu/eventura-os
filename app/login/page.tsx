"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const supabase = supabaseClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) router.replace("/dashboard");
      } catch {}
    })();
  }, [router]);

  async function signIn() {
    setStatus("Signing in...");
    try {
      const supabase = supabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace("/dashboard");
    } catch (e: any) {
      setStatus(`❌ ${e?.message || "Login failed"}`);
    }
  }

  async function signUp() {
    setStatus("Creating account...");
    try {
      const supabase = supabaseClient();
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setStatus("✅ Account created. Now click Sign In.");
    } catch (e: any) {
      setStatus(`❌ ${e?.message || "Signup failed"}`);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ fontSize: 28, margin: 0 }}>Eventura OS Login</h1>
      <p style={{ color: "#6b7280", marginTop: 6 }}>
        Email + Password (permanent login on any device)
      </p>

      <div style={{ marginTop: 14, maxWidth: 420 }}>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Email</div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@eventura.com"
          style={inputStyle}
        />

        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 10, marginBottom: 6 }}>Password</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          style={inputStyle}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={signIn} style={primaryBtn}>
            Sign In
          </button>
          <button onClick={signUp} style={secondaryBtn}>
            Create Account
          </button>
        </div>

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

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
};

const primaryBtn: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  cursor: "pointer",
  fontWeight: 900,
};

const secondaryBtn: React.CSSProperties = {
  ...primaryBtn,
  background: "white",
  border: "1px solid #e5e7eb",
};
