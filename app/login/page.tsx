"use client";

import React, { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Tab = "CEO" | "Staff";

const CEO_EMAIL = "hardikvekariya799@gmail.com";
const STAFF_EMAIL = "eventurastaff@gmail.com";

const DEFAULT_CEO_PASSWORD = "Hardik@9727";
const DEFAULT_STAFF_PASSWORD = "Eventura@79";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function setSessionEmail(email: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("eventura_email", email);
  document.cookie = `eventura_email=${encodeURIComponent(
    email
  )}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function hardBlockCrossLogin(tab: Tab, email: string) {
  const e = email.toLowerCase();
  return (tab === "CEO" && e === CEO_EMAIL.toLowerCase()) || (tab === "Staff" && e === STAFF_EMAIL.toLowerCase());
}

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("CEO");
  const email = useMemo(() => (tab === "CEO" ? CEO_EMAIL : STAFF_EMAIL), [tab]);

  const [password, setPassword] = useState(DEFAULT_CEO_PASSWORD);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function switchTab(next: Tab) {
    setTab(next);
    setMsg("");
    setErr("");
    setPassword(next === "CEO" ? DEFAULT_CEO_PASSWORD : DEFAULT_STAFF_PASSWORD);
  }

  async function signIn() {
    setMsg("");
    setErr("");

    if (!supabase) {
      setErr("Supabase env missing on Vercel. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    if (!password) {
      setErr("Enter password.");
      return;
    }
    if (!hardBlockCrossLogin(tab, email)) {
      setErr("Cross-login blocked. Wrong tab/email.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErr(error.message);
        return;
      }

      const signedEmail = data?.user?.email || email;

      if (!hardBlockCrossLogin(tab, signedEmail)) {
        await supabase.auth.signOut();
        setErr("Cross-login blocked. Wrong account for this tab.");
        return;
      }

      setSessionEmail(signedEmail);
      setMsg("✅ Signed in!");
      window.location.href = "/"; // root will redirect to /login until you add dashboard later
    } catch (e: any) {
      setErr(e?.message || "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount() {
    setMsg("");
    setErr("");

    if (!supabase) {
      setErr("Supabase env missing on Vercel. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    if (!password || password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMsg(`⚠️ ${error.message}`);
      else setMsg("✅ Account created. Now click Sign In.");
    } catch (e: any) {
      setErr(e?.message || "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.h1}>Eventura OS Login</div>
        <div style={styles.muted}>CEO & Staff tabs (locked emails)</div>

        {!supabase ? (
          <div style={styles.err}>
            Supabase env missing (Production).
            <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 12, lineHeight: 1.5 }}>
              NEXT_PUBLIC_SUPABASE_URL
              <br />
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button style={{ ...styles.tabBtn, ...(tab === "CEO" ? styles.tabActive : null) }} onClick={() => switchTab("CEO")} disabled={busy}>
            CEO Login
          </button>
          <button style={{ ...styles.tabBtn, ...(tab === "Staff" ? styles.tabActive : null) }} onClick={() => switchTab("Staff")} disabled={busy}>
            Staff Login
          </button>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Email (locked)</label>
          <input style={styles.input} value={email} readOnly />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input style={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button style={styles.ghostBtn} onClick={createAccount} disabled={busy}>
            {busy ? "Working…" : "Create Account"}
          </button>
          <button style={styles.primaryBtn} onClick={signIn} disabled={busy}>
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </div>

        {err ? <div style={styles.err}>{err}</div> : null}
        {msg ? <div style={styles.ok}>{msg}</div> : null}

        <div style={styles.smallNote}>
          CEO: <b>{CEO_EMAIL}</b> <br />
          Staff: <b>{STAFF_EMAIL}</b>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 18,
    background:
      "radial-gradient(1200px 800px at 20% 10%, rgba(255,215,110,0.18), transparent 60%), radial-gradient(900px 700px at 80% 20%, rgba(120,70,255,0.18), transparent 55%), #050816",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#F9FAFB",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
  },
  card: {
    width: "100%",
    maxWidth: 540,
    background: "rgba(11,16,32,0.92)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
    backdropFilter: "blur(10px)",
  },
  h1: { fontSize: 26, fontWeight: 950 },
  muted: { color: "#9CA3AF", fontSize: 13, marginTop: 6 },
  field: { marginTop: 14 },
  label: { display: "block", fontSize: 12, color: "#9CA3AF", marginBottom: 8, fontWeight: 800 },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#F9FAFB",
    outline: "none",
    fontSize: 14,
  },
  tabBtn: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#E5E7EB",
    fontWeight: 950,
    cursor: "pointer",
  },
  tabActive: {
    background: "rgba(212,175,55,0.16)",
    border: "1px solid rgba(212,175,55,0.30)",
    color: "#FDE68A",
  },
  primaryBtn: {
    flex: 1,
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(212,175,55,0.35)",
    background: "linear-gradient(135deg, rgba(212,175,55,0.32), rgba(139,92,246,0.22))",
    color: "#FFF",
    fontWeight: 950,
    cursor: "pointer",
  },
  ghostBtn: {
    flex: 1,
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#E5E7EB",
    fontWeight: 900,
    cursor: "pointer",
  },
  err: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    background: "rgba(248,113,113,0.12)",
    border: "1px solid rgba(248,113,113,0.28)",
    color: "#FCA5A5",
    fontSize: 13,
    lineHeight: 1.4,
  },
  ok: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    background: "rgba(34,197,94,0.10)",
    border: "1px solid rgba(34,197,94,0.22)",
    color: "#BBF7D0",
    fontSize: 13,
    lineHeight: 1.4,
  },
  smallNote: { marginTop: 12, fontSize: 12, color: "#A7B0C0", lineHeight: 1.35 },
};
