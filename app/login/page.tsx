"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"CEO" | "Staff">("CEO");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setLoading(false);
      setError("Invalid login credentials");
      return;
    }

    localStorage.setItem("eventura_email", email);
    document.cookie = `eventura_email=${encodeURIComponent(email)}; path=/; max-age=31536000; SameSite=Lax`;

    router.replace("/dashboard");
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "system-ui" }}>
      <div style={{ width: 360 }}>
        <h2>Eventura OS Login</h2>
        <p style={{ color: "#6b7280" }}>CEO / Staff Login</p>

        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button onClick={() => setTab("CEO")} style={{ flex: 1, fontWeight: tab === "CEO" ? 700 : 400, padding: 10 }}>CEO</button>
          <button onClick={() => setTab("Staff")} style={{ flex: 1, fontWeight: tab === "Staff" ? 700 : 400, padding: 10 }}>Staff</button>
        </div>

        <input type="email" placeholder={`${tab} Email`} value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }} />

        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", marginTop: 10 }} />

        <button onClick={login} disabled={loading}
          style={{ width: "100%", marginTop: 14, padding: 12, fontWeight: 700, cursor: "pointer" }}>
          {loading ? "Signing in..." : "Login"}
        </button>

        {error && <div style={{ color: "red", marginTop: 12 }}>{error}</div>}
      </div>
    </main>
  );
}
