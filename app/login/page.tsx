"use client";

import React, { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Tab = "CEO" | "Staff";

/* ====== CONFIG (FROM VERCEL ENV) ====== */
const CEO_EMAIL = process.env.NEXT_PUBLIC_CEO_EMAIL || "hardikvekariya799@gmail.com";
const STAFF_EMAIL = process.env.NEXT_PUBLIC_STAFF_EMAIL || "eventurastaff@gmail.com";

const DEFAULT_CEO_PASSWORD =
  process.env.NEXT_PUBLIC_CEO_DEFAULT_PASSWORD || "Hardik@9727";
const DEFAULT_STAFF_PASSWORD =
  process.env.NEXT_PUBLIC_STAFF_DEFAULT_PASSWORD || "Eventura@79";

/* ====== SUPABASE ====== */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/* ====== HELPERS ====== */
function matchesTab(tab: Tab, email: string) {
  const e = email.toLowerCase();
  return (
    (tab === "CEO" && e === CEO_EMAIL.toLowerCase()) ||
    (tab === "Staff" && e === STAFF_EMAIL.toLowerCase())
  );
}

/* ====== PAGE ====== */
export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("CEO");

  const email = useMemo(() => (tab === "CEO" ? CEO_EMAIL : STAFF_EMAIL), [tab]);
  const [password, setPassword] = useState(
    tab === "CEO" ? DEFAULT_CEO_PASSWORD : DEFAULT_STAFF_PASSWORD
  );

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function switchTab(next: Tab) {
    setTab(next);
    setErr("");
    setMsg("");
    setPassword(next === "CEO" ? DEFAULT_CEO_PASSWORD : DEFAULT_STAFF_PASSWORD);
  }

  async function createAccount() {
    setErr("");
    setMsg("");

    if (!supabase) {
      setErr("Supabase not configured.");
      return;
    }
    if (!password || password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMsg(`⚠️ ${error.message} (If already created, click Sign In)`);
        return;
      }

      setMsg("✅ Account created. Now click Sign In.");
    } catch (e: any) {
      setErr(e?.message || "Account creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    setErr("");
    setMsg("");

    if (!supabase) {
      setErr("Supabase not configured.");
      return;
    }
    if (!matchesTab(tab, email)) {
      setErr("Wrong email for selected role.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErr("Invalid login credentials. Create account first if needed.");
        return;
      }

      // ✅ FINAL REDIRECT (NO MORE EDITS EVER)
      window.location.replace("/dashboard");
    } catch (e: any) {
      setErr(e?.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Eventura OS Login</h1>
        <p style={styles.muted}>CEO & Staff access</p>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            style={{ ...styles.tabBtn, ...(tab === "CEO" ? styles.tabActive : {}) }}
            onClick={() => switchTab("CEO")}
          >
            CEO Login
          </button>
          <button
            style={{ ...styles.tabBtn, ...(tab === "Staff" ? styles.tabActive : {}) }}
            onClick={() => switchTab("Staff")}
          >
            Staff Login
          </button>
        </div>

        <div style={styles.field}>
          <label>Email (locked)</label>
          <input style={styles.input} value={email} readOnly />
        </div>

        <div style={styles.field}>
          <label>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button style={styles.ghostBtn} onClick={createAccount} disabled={busy}>
            Create Account
          </button>
          <button style={styles.primaryBtn} onClick={signIn} disabled={busy}>
            Sign In
          </button>
        </div>

        {err && <div style={styles.err}>{err}</div>}
        {msg && <div style={styles.ok}>{msg}</div>}

        <div style={styles.smallNote}>
          CEO: <b>{CEO_EMAIL}</b>
          <br />
          Staff: <b>{STAFF_EMAIL}</b>
        </div>
      </div>
    </div>
  );
}

/* ====== STYLES ====== */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#050816",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    background: "#0b1020",
    borderRadius: 16,
    padding: 20,
    border: "1px solid rgba(255,255,255,0.1)",
  },
  h1: { fontSize: 26, fontWeight: 900 },
  muted: { color: "#9ca3af", marginBottom: 12 },
  field: { marginTop: 14, display: "flex", flexDirection: "column", gap: 6 },
  input: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
  },
  tabBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.15)",
    fontWeight: 800,
  },
  tabActive: {
    background: "rgba(212,175,55,0.25)",
    border: "1px solid rgba(212,175,55,0.6)",
  },
  primaryBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    background: "linear-gradient(135deg,#d4af37,#8b5cf6)",
    border: "none",
    fontWeight: 900,
    color: "#fff",
  },
  ghostBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "#fff",
    fontWeight: 800,
  },
  err: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    background: "rgba(239,68,68,0.2)",
  },
  ok: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    background: "rgba(34,197,94,0.2)",
  },
  smallNote: { marginTop: 12, fontSize: 12, color: "#9ca3af" },
};
