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

  // ✅ If already logged in, redirect into software
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

    // ✅ REQUIRED FOR MIDDLEWARE (DO NOT REMOVE)
    localStorage.setItem("eventura_email", email);
    document.cookie = `eventura_email=${encodeURIComponent(
      email
    )}; path=/; max-age=31536000; SameSite=Lax`;

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

        {/* ROLE TABS */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button
            type="button"
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
            type="button"
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
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
          }}
        />

        {/* PASSWORD */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #d1d5db",
            marginTop: 10,
          }}
        />

        {/* LOGIN BUTTON */}
        <button
          type="button"
          onClick={login}
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
