"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/* ================= STORAGE KEYS ================= */
const LS_SETTINGS = "eventura_os_settings_v3";

/* ================= SUPABASE (safe) ================= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/* ================= TYPES ================= */
type Role = "CEO" | "Staff";
type SidebarMode = "Icons + Text" | "Icons Only";
type Theme = "Royal Gold" | "Midnight Purple" | "Emerald Night";

type AppSettings = {
  ceoEmail: string;
  staffEmail: string;
  ceoDefaultPassword: string;
  staffDefaultPassword: string;

  theme: Theme;
  sidebarMode: SidebarMode;
  compactTables: boolean;

  confirmDeletes: boolean;
  updatedAt: string;
};

const DEFAULTS: AppSettings = {
  ceoEmail: "hardikvekariya799@gmail.com",
  staffEmail: "eventurastaff@gmail.com",
  ceoDefaultPassword: "Hardik@9727",
  staffDefaultPassword: "Eventura@79",
  theme: "Royal Gold",
  sidebarMode: "Icons + Text",
  compactTables: false,
  confirmDeletes: true,
  updatedAt: new Date().toISOString(),
};

/* ================= HELPERS ================= */
function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function safeSave<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}
function nowISO() {
  return new Date().toISOString();
}
function setSessionEmail(email: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("eventura_email", email);
  document.cookie = `eventura_email=${encodeURIComponent(email)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
function getFallbackEmail(): string {
  if (typeof window === "undefined") return "";
  const fromLS = localStorage.getItem("eventura_email") || "";
  if (fromLS) return fromLS;
  const m = document.cookie.match(/(?:^|;\s*)eventura_email=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}
function roleFromSettings(email: string, s: AppSettings): Role {
  if (!email) return "Staff";
  return email.toLowerCase() === s.ceoEmail.toLowerCase() ? "CEO" : "Staff";
}
function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================= PAGE ================= */
export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [msg, setMsg] = useState("");

  const [sessionEmail, setSessionEmailState] = useState<string>("");

  // Load settings
  useEffect(() => {
    const s = safeLoad<AppSettings>(LS_SETTINGS, DEFAULTS);
    setSettings({ ...DEFAULTS, ...s });
  }, []);

  // Get email from Supabase session (REAL), fallback to local
  useEffect(() => {
    (async () => {
      if (!supabase) {
        setSessionEmailState(getFallbackEmail());
        return;
      }
      const { data } = await supabase.auth.getSession();
      const email = data.session?.user?.email || "";
      if (email) {
        setSessionEmailState(email);
        setSessionEmail(email); // keep app consistent everywhere
      } else {
        setSessionEmailState(getFallbackEmail());
      }

      // keep updated on auth changes
      const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
        const e = sess?.user?.email || "";
        if (e) {
          setSessionEmailState(e);
          setSessionEmail(e);
        }
      });
      return () => sub.subscription.unsubscribe();
    })();
  }, []);

  const role = useMemo(() => roleFromSettings(sessionEmail, settings), [sessionEmail, settings]);
  const isCEO = role === "CEO";

  // Save + apply theme globally
  useEffect(() => {
    safeSave(LS_SETTINGS, settings);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-ev-theme", settings.theme);
      document.documentElement.setAttribute("data-ev-sidebar", settings.sidebarMode);
      document.documentElement.setAttribute("data-ev-compact", settings.compactTables ? "1" : "0");
    }
  }, [settings]);

  function update(patch: Partial<AppSettings>) {
    setMsg("");
    setSettings((prev) => ({ ...prev, ...patch, updatedAt: nowISO() }));
    setMsg("✅ Saved.");
  }

  function guardedUpdate(patch: Partial<AppSettings>) {
    if (!isCEO) {
      setMsg("❌ Only CEO can edit Access Control.");
      return;
    }
    update(patch);
  }

  function exportSettings() {
    downloadFile(
      `eventura_settings_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ settings }, null, 2),
      "application/json"
    );
    setMsg("✅ Exported settings.");
  }

  function resetSettings() {
    const ok = !settings.confirmDeletes || confirm("Reset settings to default?");
    if (!ok) return;
    setSettings({ ...DEFAULTS, updatedAt: nowISO() });
    setMsg("✅ Reset settings.");
  }

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div style={S.topRow}>
          <div>
            <div style={S.h1}>Settings</div>
            <div style={S.muted}>
              Logged in as <b>{sessionEmail || "Unknown"}</b> • Role:{" "}
              <span style={S.rolePill}>{role}</span>
            </div>
            {!supabase ? (
              <div style={S.warn}>
                Supabase env not detected in this page. Using local fallback email.
              </div>
            ) : null}
          </div>

          <div style={S.row}>
            <button style={S.ghostBtn} onClick={exportSettings}>
              Export
            </button>
            <button style={S.dangerBtn} onClick={resetSettings}>
              Reset
            </button>
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* ACCESS CONTROL */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Access Control (CEO only)</div>
          <div style={S.smallNote}>
            CEO role is detected by matching your logged-in Supabase email with CEO Email below.
          </div>

          <div style={S.grid2}>
            <Field label="CEO Email">
              <input
                style={{ ...S.input, ...(isCEO ? null : S.readOnly) }}
                value={settings.ceoEmail}
                readOnly={!isCEO}
                onChange={(e) => guardedUpdate({ ceoEmail: e.target.value })}
              />
            </Field>

            <Field label="Staff Email">
              <input
                style={{ ...S.input, ...(isCEO ? null : S.readOnly) }}
                value={settings.staffEmail}
                readOnly={!isCEO}
                onChange={(e) => guardedUpdate({ staffEmail: e.target.value })}
              />
            </Field>
          </div>

          <div style={S.grid2}>
            <Field label="CEO Default Password (autofill only)">
              <input
                style={{ ...S.input, ...(isCEO ? null : S.readOnly) }}
                type={isCEO ? "text" : "password"}
                value={settings.ceoDefaultPassword}
                readOnly={!isCEO}
                onChange={(e) => guardedUpdate({ ceoDefaultPassword: e.target.value })}
              />
            </Field>

            <Field label="Staff Default Password (autofill only)">
              <input
                style={{ ...S.input, ...(isCEO ? null : S.readOnly) }}
                type={isCEO ? "text" : "password"}
                value={settings.staffDefaultPassword}
                readOnly={!isCEO}
                onChange={(e) => guardedUpdate({ staffDefaultPassword: e.target.value })}
              />
            </Field>
          </div>

          {!isCEO ? (
            <div style={S.warn}>
              You are currently detected as <b>Staff</b>. To edit Access Control, sign in with CEO
              email then refresh.
              <br />
              (If you logged in earlier as staff, click Sign Out and sign in with CEO.)
            </div>
          ) : (
            <div style={S.tip}>
              ✅ You are CEO. Changes here will control the Login page locked emails + default
              passwords.
            </div>
          )}
        </div>

        {/* UI */}
        <div style={S.panel}>
          <div style={S.panelTitle}>UI</div>

          <div style={S.grid3}>
            <Field label="Theme">
              <select
                style={S.select}
                value={settings.theme}
                onChange={(e) => update({ theme: e.target.value as any })}
              >
                {["Royal Gold", "Midnight Purple", "Emerald Night"].map((x) => (
                  <option key={x} style={S.option}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Sidebar Mode">
              <select
                style={S.select}
                value={settings.sidebarMode}
                onChange={(e) => update({ sidebarMode: e.target.value as any })}
              >
                {["Icons + Text", "Icons Only"].map((x) => (
                  <option key={x} style={S.option}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tables">
              <select
                style={S.select}
                value={settings.compactTables ? "Compact" : "Comfortable"}
                onChange={(e) => update({ compactTables: e.target.value === "Compact" })}
              >
                {["Comfortable", "Compact"].map((x) => (
                  <option key={x} style={S.option}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={S.smallMuted}>Updated: {new Date(settings.updatedAt).toLocaleString()}</div>
        </div>

        <div style={S.footerNote}>✅ Role detection fixed: Supabase session first</div>
      </div>
    </div>
  );
}

/* ================= UI ================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={S.field}>
      <div style={S.label}>{label}</div>
      {children}
    </div>
  );
}

/* ================= STYLES ================= */
const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 16,
    background:
      "radial-gradient(1200px 800px at 20% 10%, rgba(255,215,110,0.18), transparent 60%), radial-gradient(900px 700px at 80% 20%, rgba(120,70,255,0.18), transparent 55%), #050816",
    color: "#F9FAFB",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
  },
  shell: { maxWidth: 1100, margin: "0 auto", display: "grid", gap: 12 },
  topRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  h1: { fontSize: 26, fontWeight: 950 },
  muted: { color: "#9CA3AF", fontSize: 13, marginTop: 6 },
  smallMuted: { color: "#9CA3AF", fontSize: 12 },
  smallNote: { color: "#A7B0C0", fontSize: 12, lineHeight: 1.35 },

  rolePill: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 950,
    background: "rgba(139,92,246,0.16)",
    border: "1px solid rgba(139,92,246,0.30)",
    color: "#DDD6FE",
  },

  msg: {
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#E5E7EB",
    fontSize: 13,
  },

  panel: {
    background: "rgba(11,16,32,0.78)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
    backdropFilter: "blur(10px)",
  },
  panelTitle: { fontWeight: 950, color: "#FDE68A", marginBottom: 10 },

  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },

  field: { display: "grid", gap: 8 },
  label: { fontSize: 12, color: "#A7B0C0", fontWeight: 900 },

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
  readOnly: { opacity: 0.75, cursor: "not-allowed" },

  select: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#F9FAFB",
    outline: "none",
    fontSize: 14,
    fontWeight: 900,
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  },
  option: { backgroundColor: "#0B1020", color: "#F9FAFB" },

  row: { display: "flex", gap: 10, alignItems: "center" },
  ghostBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#E5E7EB",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dangerBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(248,113,113,0.30)",
    background: "rgba(248,113,113,0.10)",
    color: "#FCA5A5",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  tip: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    background: "rgba(34,197,94,0.08)",
    border: "1px solid rgba(34,197,94,0.18)",
    color: "#BBF7D0",
    fontSize: 13,
    lineHeight: 1.4,
  },
  warn: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    background: "rgba(248,113,113,0.10)",
    border: "1px solid rgba(248,113,113,0.22)",
    color: "#FCA5A5",
    fontSize: 13,
    lineHeight: 1.4,
  },

  footerNote: { color: "#A7B0C0", fontSize: 12, textAlign: "center", padding: 6 },
};
