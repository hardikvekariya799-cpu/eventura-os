"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/* ===== SUPABASE CLIENT ===== */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ===== PAGE ===== */
export default function LoginPage() {
  const router = useRouter();

  const [tab, setTab] = useState<"CEO" | "Staff">("CEO");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      setLoading(false);
      setError("Invalid login credentials");
      return;
    }

    // ✅ Store email for Eventura OS role check
    localStorage.setItem("eventura_email", email);
    document.cookie = `eventura_email=${email}; path=/; max-age=31536000`;

    router.replace("/dashboard");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui, Arial",
      }}
    >
      <div style={{ width: 360 }}>
        <h2>Eventura OS Login</h2>
        <p style={{ color: "#6b7280" }}>Login as CEO or Staff</p>

        {/* TABS */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => setTab("CEO")}
            style={{
              flex: 1,
              padding: 10,
              fontWeight: tab === "CEO" ? 700 : 400,
            }}
          >
            CEO
          </button>
          <button
            onClick={() => setTab("Staff")}
            style={{
              flex: 1,
              padding: 10,
              fontWeight: tab === "Staff" ? 700 : 400,
            }}
          >
            Staff
          </button>
        </div>

        {/* EMAIL */}
        <input
          type="email"
          placeholder={`${tab} Email`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        {/* PASSWORD */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ ...inputStyle, marginTop: 10 }}
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 14,
            padding: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {loading ? "Signing in..." : "Login"}
        </button>

        {error && (
          <div style={{ color: "red", marginTop: 12 }}>{error}</div>
        )}
      </div>
    </main>
  );
}

/* ===== STYLES ===== */
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: "1px solid #d1d5db",
};
