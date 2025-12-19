"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = supabaseClient();

  const [tab, setTab] = useState<"CEO" | "Staff">("CEO");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, go to dashboard or where user came from
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const from = params.get("from") || "/dashboard";
        router.replace(from);
      }
    })();
  }, [router, params, supabase]);

  async function login() {
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

    // store email for your OsShell role check
    localStorage.setItem("eventura_email", email);
    document.cookie = `eventura_email=${encodeURIComponent(email)}; path=/; max-age=31536000; SameSite=Lax`;

    const from = params.get("from") || "/dashboard";
    router.replace(from);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui",
      }}
    >
      <div style={{ width: 360 }}>
        <h2>Eventura OS Login</h2>
        <p style={{ color: "#6b7280" }}>Login once to access whole software</p>

        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button
            onClick={() => setTab("CEO")}
            style={{ flex: 1, fontWeight: tab === "CEO" ? 700 : 400, padding: 10 }}
            type="button"
          >
            CEO
          </button>
          <button
            onClick={() => setTab("Staff")}
            style={{ flex: 1, fontWeight: tab === "Staff" ? 700 : 400, padding: 10 }}
            type="button"
          >
            Staff
          </button>
        </div>

        <input
          type="email"
          placeholder={`${tab} Email`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db" }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #d1d5db", marginTop: 10 }}
        />

        <button
          onClick={login}
          disabled={loading}
          style={{ width: "100%", marginTop: 14, padding: 12, fontWeight: 700, cursor: "pointer" }}
          type="button"
        >
          {loading ? "Signing in..." : "Login"}
        </button>

        {error && <div style={{ color: "red", marginTop: 12 }}>{error}</div>}
      </div>
    </main>
  );
}
