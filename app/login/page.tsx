"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/* ================= CONFIG ================= */

const CEO_EMAIL = "hardikvekariya799@gmail.com";
const STAFF_EMAIL = "eventurastaff@gmail.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/* ================= PAGE ================= */

export default function LoginPage() {
  const router = useRouter();

  const [role, setRole] = useState<"CEO" | "Staff">("CEO");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const email = role === "CEO" ? CEO_EMAIL : STAFF_EMAIL;

  /* Redirect if already logged in */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.replace("/dashboard");
    })();
  }, [router]);

  async function signIn() {
    setStatus("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      setLoading(false);
      setStatus("❌ Invalid login credentials");
      return;
    }

    // 🔒 HARD BLOCK CROSS LOGIN
    if (
      (role === "CEO" && data.user.email !== CEO_EMAIL) ||
      (role === "Staff" && data.user.email !== STAFF_EMAIL)
    ) {
      await supabase.auth.signOut();
      setLoading(false);
      setStatus("❌ Access denied");
      return;
    }

    // ✅ Store role reference for OS
    localStorage.setItem("eventura_email", email);
    document.cookie = `eventura_email=${email}; path=/; max-age=31536000`;

    router.replace("/dashboard");
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ width: 360 }}>
        <h2>Eventura OS Login</h2>
        <p style={{ color: "#6b7280" }}>Permanent login (CEO / Staff)</p>

        {/* ROLE TABS */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button
            onClick={() => setRole("CEO")}
            style={{ flex: 1, fontWeight: role === "CEO" ? 700 : 400 }}
          >
            CEO
          </button>
          <button
            onClick={() => setRole("Staff")}
            style={{ flex: 1, fontWeight: role === "Staff" ? 700 : 400 }}
          >
            Staff
          </button>
        </div>

        <div style={{ fontSize: 13, marginBottom: 6 }}>
          <b>Email:</b> {email}
        </div>

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <button
          onClick={signIn}
          disabled={loading}
          style={{ ...primaryBtn, marginTop: 12, width: "100%" }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        {status && (
          <div style={{ marginTop: 12, color: status.startsWith("❌") ? "red" : "green" }}>
            {status}
          </div>
        )}
      </div>
    </main>
  );
}

/* ================= STYLES ================= */

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
  fontWeight: 700,
};
