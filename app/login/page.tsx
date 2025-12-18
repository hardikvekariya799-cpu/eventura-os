"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CEO_EMAIL = "hardikvekariya799@gmail.com";
const STAFF_EMAIL = "eventurastaff@gmail.com";

export default function LoginPage() {
  const router = useRouter();

  const [role, setRole] = useState<"CEO" | "Staff">("CEO");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const email = role === "CEO" ? CEO_EMAIL : STAFF_EMAIL;

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

    // 🔒 HARD BLOCK CROSS LOGIN
    if (
      (role === "CEO" && email !== CEO_EMAIL) ||
      (role === "Staff" && email !== STAFF_EMAIL)
    ) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Access denied");
      return;
    }

    // ✅ STORE EMAIL FOR OS ROLE CHECK
    localStorage.setItem("eventura_email", email);
    document.cookie = `eventura_email=${email}; path=/; max-age=31536000`;

    router.push("/dashboard");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ width: 360 }}>
        <h2>Eventura OS Login</h2>

        {/* ROLE TABS */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button onClick={() => setRole("CEO")} style={{ flex: 1 }}>
            CEO
          </button>
          <button onClick={() => setRole("Staff")} style={{ flex: 1 }}>
            Staff
          </button>
        </div>

        <div style={{ marginBottom: 8 }}>
          <b>Email:</b> {email}
        </div>

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", marginBottom: 10 }}
        />

        <button onClick={login} disabled={loading} style={{ width: "100%" }}>
          {loading ? "Signing in..." : "Login"}
        </button>

        {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
      </div>
    </div>
  );
}
