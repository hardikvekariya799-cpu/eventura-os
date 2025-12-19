"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

/* ================= SETTINGS STORAGE ================= */
const LS_SETTINGS = "eventura_os_settings_v3";

type RoleTab = "CEO" | "Staff";
type AppSettings = {
  ceoEmail: string;
  staffEmail: string;
  ceoDefaultPassword: string;
  staffDefaultPassword: string;
};

const DEFAULTS: AppSettings = {
  ceoEmail: "hardikvekariya799@gmail.com",
  staffEmail: "eventurastaff@gmail.com",
  ceoDefaultPassword: "Hardik@9727",
  staffDefaultPassword: "Eventura@79",
};

function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setSessionEmail(email: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("eventura_email", email);
  document.cookie = `eventura_email=${encodeURIComponent(email)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/* ================= SUPABASE (safe) ================= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export default function LoginPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  const [tab, setTab] = useState<RoleTab>("CEO");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const s = safeLoad<AppSettings>(LS_SETTINGS, DEFAULTS);
    setSettings({ ...DEFAULTS, ...s });
  }, []);

  // locked email based on settings + tab
  const lockedEmail = useMemo(
    () => (tab === "CEO" ? settings.ceoEmail : settings.staffEmail),
    [tab, settings]
  );

  // autofill password from settings
  useEffect(() => {
    setPassword(tab === "CEO" ? settings.ceoDefaultPassword : settings.staffDefaultPassword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, settings.ceoDefaultPassword, settings.staffDefaultPassword]);

  function switchTab(next: RoleTab) {
    setTab(next);
    setMsg("");
  }

  function crossLoginBlocked(email: string) {
    const ceo = settings.ceoEmail.toLowerCase();
    const staff = settings.staffEmail.toLowerCase();
    const used = (email || "").toLowerCase();

    if (tab === "CEO" && used !== ceo) return true;
    if (tab === "Staff" && used !== staff) return true;
    return false;
  }

  async function createAccount() {
    setMsg("");
    if (!supabase) {
      setMsg("❌ Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }

    setBusy(true);
    try {
      const email = lockedEmail.trim();
      if (crossLoginBlocked(email)) {
        setMsg("❌ Cross-login blocked. Use correct tab.");
        return;
      }
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMsg(`⚠️ ${error.message}`);
      } else {
        setMsg("✅ Account created. Now click Sign In.");
      }
    } catch (e: any) {
      setMsg(`❌ ${e?.message || "Create account failed"}`);
    } finally {
      setBusy(false);
    }
  }

  async function signIn() {
    setMsg("");
    if (!supabase) {
      setMsg("❌ Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }

    setBusy(true);
    try {
      const email = lockedEmail.trim();
      if (crossLoginBlocked(email)) {
        setMsg("❌ Cross-login blocked. Use correct tab.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(`❌ ${error.message}`);
        return;
      }

      const signedEmail = data?.user?.email || email;
      setSessionEmail(signedEmail);

      // ✅ redirect to dashboard always
      router.push("/dashboard");
    } catch (e: any) {
      setMsg(`❌ ${e?.message || "Login failed"}`);
    } finally {
      setBusy(false);
    }
  }

  // If missing env, show setup message (no crash)
  if (!supabase) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.h1}>Eventura OS</div>
          <div style={S.muted}>Supabase env missing on this deployment.</div>
          <div style={S.err}>
            Add in Vercel → Settings → Environment Variables (Production + Preview):
            <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 12, lineHeight: 1.5 }}>
              NEXT_PUBLIC_SUPABASE_URL
              <br />
              NEXT_PUBLIC_SUPABASE_ANON_KEY
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.topRow}>
          <div>
            <div style={S.h1}>Eventura OS Login</div>
            <div style={S.muted}>CEO & Staff tabs (controlled by Settings)</div>
          </div>
          <div style={S.badge}>Production</div>
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          <button
            style={{ ...S.tabBtn, ...(tab === "CEO" ? S.tabActive : null) }}
            onClick={() => switchTab("CEO")}
            disabled={busy}
          >
            CEO Login
          </button>
          <button
            style={{ ...S.tabBtn, ...(tab === "Staff" ? S.tabActive : null) }}
            onClick={() => switchTab("Staff")}
            disabled={busy}
          >
            Staff Login
          </button>
        </div>

        <div style={S.field}>
          <div style={S.label}>Email (locked)</div>
          <input style={S.input} value={lockedEmail} readOnly />
          <div style={S.smallMuted}>Change it in Settings → Access Control.</div>
        </div>

        <div style={S.field}>
          <div style={S.label}>Password</div>
          <input
            style={S.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Enter password"
          />
          <div style={S.smallMuted}>Default is taken from Settings (you can type your own).</div>
        </div>

        <div style={S.row}>
          <button style={S.ghostBtn} onClick={createAccount} disabled={busy}>
            {busy ? "Working..." : "Create Account"}
          </button>
          <button style={S.primaryBtn} onClick={signIn} disabled={busy}>
            {busy ? "Signing in..." : "Sign In"}
          </button>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        <div style={S.note}>
          <b>CEO:</b> {settings.ceoEmail}
          <br />
          <b>Staff:</b> {settings.staffEmail}
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES (hover fixed) ================= */
const S: Record<string, React.CSSProperties> = {
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
    maxWidth: 520,
    background: "rgba(11,16,32,0.92)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
    backdropFilter: "blur(10px)",
  },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  h1: { fontSize: 22, fontWeight: 950 },
  muted: { color: "#9CA3AF", fontSize: 13, marginTop: 6 },
  smallMuted: { color: "#9CA3AF", fontSize: 12, marginTop: 6 },
  badge: {
    fontSize: 12,
    fontWeight: 900,
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(212,175,55,0.14)",
    border: "1px solid rgba(212,175,55,0.28)",
    color: "#FDE68A",
  },
  tabs: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
  },
  tabBtn: {
    padding: "10px 12px",
    fontWeight: 950,
    background: "transparent",
    color: "#E5E7EB",
    border: "none",
    cursor: "pointer",
  },
  tabActive: { background: "rgba(212,175,55,0.18)", color: "#FDE68A" },

  field: { marginTop: 14 },
  label: { fontSize: 12, color: "#A7B0C0", fontWeight: 900, marginBottom: 8 },
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

  row: { display: "flex", gap: 10, marginTop: 14 },
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
    fontWeight: 950,
    cursor: "pointer",
  },

  msg: {
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#E5E7EB",
    fontSize: 13,
  },

  note: { marginTop: 12, color: "#A7B0C0", fontSize: 12, lineHeight: 1.35 },

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
};
