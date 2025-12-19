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

function clearClientSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("eventura_email");
  document.cookie.split(";").forEach((c) => {
    document.cookie = c
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
}

function matchesTab(tab: Tab, email: string) {
  const e = email.trim().toLowerCase();
  return (
    (tab === "CEO" && e === CEO_EMAIL.toLowerCase()) ||
    (tab === "Staff" && e === STAFF_EMAIL.toLowerCase())
  );
}

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("CEO");

  // ✅ Prefill (still locked by default)
  const lockedEmail = useMemo(() => (tab === "CEO" ? CEO_EMAIL : STAFF_EMAIL), [tab]);
  const [email, setEmail] = useState<string>(CEO_EMAIL);

  const [password, setPassword] = useState(DEFAULT_CEO_PASSWORD);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function switchTab(next: Tab) {
    setTab(next);
    setMsg("");
    setErr("");
    const nextEmail = next === "CEO" ? CEO_EMAIL : STAFF_EMAIL;
    setEmail(nextEmail);
    setPassword(next === "CEO" ? DEFAULT_CEO_PASSWORD : DEFAULT_STAFF_PASSWORD);
  }

  async function createAccount() {
    setMsg("");
    setErr("");

    if (!supabase) {
      setErr(
        "Supabase env missing on Vercel. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      return;
    }
    if (!email.trim() || !password.trim()) {
      setErr("Email and password required.");
      return;
    }
    if (!matchesTab(tab, email)) {
      setErr(`Wrong email for ${tab}. Use: ${tab === "CEO" ? CEO_EMAIL : STAFF_EMAIL}`);
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      // Clear any stuck local session (client only)
      clearClientSession();

      const { error } = await supabase.auth.signUp({ email: email.trim(), password });

      if (error) {
        // If already registered, tell them to sign in instead
        setMsg(`⚠️ ${error.message} (If user already exists, just click Sign In.)`);
        return;
      }

      setMsg("✅ Account created. Now click Sign In.");
    } catch (e: any) {
      setErr(e?.message || "Unknown error creating account.");
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    setMsg("");
    setErr("");

    if (!supabase) {
      setErr(
        "Supabase env missing on Vercel. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      return;
    }
    if (!email.trim() || !password.trim()) {
      setErr("Email and password required.");
      return;
    }
    if (!matchesTab(tab, email)) {
      setErr(`Wrong email for ${tab}. Use: ${tab === "CEO" ? CEO_EMAIL : STAFF_EMAIL}`);
      return;
    }

    setBusy(true);
    try {
      clearClientSession();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        // Most common: user not created yet or password mismatch
        const m = error.message.toLowerCase();
        if (m.includes("invalid login credentials")) {
          setErr(
            "Invalid login credentials. ✅ First click 'Create Account' once (or reset password). Also check Supabase: Auth → Providers → Email → Confirm email should be OFF."
          );
        } else {
          setErr(error.message);
        }
        return;
      }

      const signedEmail = data?.user?.email || email.trim();
      setSessionEmail(signedEmail);

      setMsg("✅ Signed in! Redirecting…");
      window.location.href = "/"; // root redirects to /login or your next page
    } catch (e: any) {
      setErr(e?.message || "Unknown error signing in.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setMsg("");
    setErr("");

    if (!supabase) {
      setErr(
        "Supabase env missing on Vercel. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      return;
    }
    if (!email.trim()) {
      setErr("Email required.");
      return;
    }
    if (!matchesTab(tab, email)) {
      setErr(`Wrong email for ${tab}. Use: ${tab === "CEO" ? CEO_EMAIL : STAFF_EMAIL}`);
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        setErr(error.message);
        return;
      }
      setMsg("✅ Password reset email sent. Check inbox/spam.");
    } catch (e: any) {
      setErr(e?.message || "Unknown error sending reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.h1}>Eventura OS Login</div>
        <div style={styles.muted}>CEO & Staff tabs (locked accounts)</div>

        {!supabase ? (
          <div style={styles.err}>
            Supabase env missing on this deployment.
            <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 12, lineHeight: 1.5 }}>
              NEXT_PUBLIC_SUPABASE_URL
              <br />
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            style={{ ...styles.tabBtn, ...(tab === "CEO" ? styles.tabActive : null) }}
            onClick={() => switchTab("CEO")}
            disabled={busy}
          >
            CEO Login
          </button>
          <button
            style={{ ...styles.tabBtn, ...(tab === "Staff" ? styles.tabActive : null) }}
            onClick={() => switchTab("Staff")}
            disabled={busy}
          >
            Staff Login
          </button>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Email (locked)</label>
          <input style={styles.input} value={lockedEmail} readOnly />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={tab === "CEO" ? "Enter CEO password" : "Enter Staff password"}
          />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button style={styles.ghostBtn} onClick={createAccount} disabled={busy}>
            {busy ? "Working…" : "Create Account"}
          </button>
          <button style={styles.primaryBtn} onClick={signIn} disabled={busy}>
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </div>

        <button style={styles.linkBtn} onClick={resetPassword} disabled={busy}>
          Forgot password? Send reset email
        </button>

        {err ? <div style={styles.err}>{err}</div> : null}
        {msg ? <div style={styles.ok}>{msg}</div> : null}

        <div style={styles.smallNote}>
          CEO: <b>{CEO_EMAIL}</b>
          <br />
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
  linkBtn: {
    width: "100%",
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "#E5E7EB",
    fontWeight: 800,
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
