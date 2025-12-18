"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"checking" | "ready">("checking");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const supabase = supabaseClient();

        // ✅ IMPORTANT:
        // If we arrived here via Supabase magic link, URL may contain ?code=...
        // We must exchange it for a session BEFORE checking getUser().
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );

          // Clean the URL (remove ?code=...) so refresh is stable.
          window.history.replaceState({}, document.title, "/dashboard");

          if (error) {
            router.replace("/login");
            return;
          }
        }

        // Now user should exist if login succeeded.
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          router.replace("/login");
          return;
        }

        setEmail(data.user.email ?? "");
        setPhase("ready");
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  async function logout() {
    try {
      const supabase = supabaseClient();
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
    }
  }

  if (phase === "checking") {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
        <h1 style={{ fontSize: 22 }}>Logging you in…</h1>
        <p style={{ color: "#6b7280" }}>
          If you just clicked the email magic link, please wait 2–3 seconds.
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui, Arial",
        minHeight: "100vh",
        background: "#eef2ff",
      }}
    >
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 16,
          marginBottom: 14,
        }}
      >
        <h1 style={{ fontSize: 30, margin: 0 }}>DASHBOARD ✅</h1>
        <div style={{ marginTop: 8, color: "#4b5563" }}>
          Logged in as <b>{email}</b>
        </div>

        <button
          onClick={logout}
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "white",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          Logout
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        <Kpi title="Active Events" value="0" />
        <Kpi title="This Month Revenue" value="₹0" />
        <Kpi title="This Month Expenses" value="₹0" />
        <Kpi title="Net Profit" value="₹0" />
      </div>

      <div style={{ marginTop: 16, fontSize: 13, color: "#6b7280" }}>
        Next: we will build Events (Add/Edit/Delete) connected to Supabase tables.
      </div>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{value}</div>
    </div>
  );
}
