"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ================= STORAGE KEYS ================= */
const LS_SETTINGS = "eventura_os_settings_v3";

/* ================= TYPES ================= */
type Role = "CEO" | "Staff";
type SidebarMode = "Icons + Text" | "Icons Only";
type Theme = "Royal Gold" | "Midnight Purple" | "Emerald Night";

type AppSettings = {
  // Access control (used by Login + role detection)
  ceoEmail: string;
  staffEmail: string;

  // Default passwords shown in Login (local convenience only)
  ceoDefaultPassword: string;
  staffDefaultPassword: string;

  // UI
  theme: Theme;
  sidebarMode: SidebarMode;
  compactTables: boolean;

  // Behavior
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
function getCurrentEmail(): string {
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

  const email = useMemo(() => getCurrentEmail(), []);
  const role = useMemo(() => roleFromSettings(email, settings), [email, settings]);

  useEffect(() => {
    const s = safeLoad<AppSettings>(LS_SETTINGS, DEFAULTS);
    setSettings({ ...DEFAULTS, ...s });
  }, []);

  useEffect(() => {
    safeSave(LS_SETTINGS, settings);
    // apply theme immediately (global)
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-ev-theme", settings.theme);
      document.documentElement.setAttribute("data-ev-sidebar", settings.sidebarMode);
      document.documentElement.setAttribute("data-ev-compact", settings.compactTables ? "1" : "0");
    }
  }, [settings]);

  function update(patch: Partial<AppSettings>) {
    setMsg("");
    setSettings((prev) => ({ ...prev, ...patch, updatedAt: nowISO() }));
    setMsg("✅ Settings applied (saved). Go to Login and refresh if needed.");
  }

  function exportSettings() {
    downloadFile(
      `eventura_settings_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ settings }, null, 2),
      "application/json"
    );
    setMsg("✅ Settings exported.");
  }

  function resetSettings() {
    const ok = !settings.confirmDeletes || confirm("Reset settings to default?");
    if (!ok) return;
    setSettings({ ...DEFAULTS, updatedAt: nowISO() });
    setMsg("✅ Settings reset.");
  }

  const isCEO = role === "CEO";

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div style={S.topRow}>
          <div>
            <div style={S.h1}>Settings</div>
            <div style={S.muted}>
              Logged in as <b>{email || "Unknown"}</b> • Role:{" "}
              <span style={S.rolePill}>{role}</span>
            </div>
          </div>

          <div style={S.row}>
            <button style={S.ghostBtn} onClick={exportSettings}>
              Export Settings
            </button>
            <button style={S.dangerBtn} onClick={resetSettings}>
              Reset
            </button>
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* ACCESS CONTROL */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Access Control (Used by Login)</div>
          <div style={S.smallNote}>
            ✅ Login page will read these values. Only CEO can edit. Staff sees read-only.
          </div>

          <div style={S.grid2}>
            <Field label="CEO Email">
              <input
                style={{ ...S.input, ...(isCEO ? null : S.readOnly) }}
                value={settings.ceoEmail}
                readOnly={!isCEO}
                onChange={(e) => update({ ceoEmail: e.target.value })}
              />
            </Field>

            <Field label="Staff Email">
              <input
                style={{ ...S.input, ...(isCEO ? null : S.readOnly) }}
                value={settings.staffEmail}
                readOnly={!isCEO}
                onChange={(e) => update({ staffEmail: e.target.value })}
              />
            </Field>
          </div>

          <div style={S.grid2}>
            <Field label="CEO Default Password (for Login autofill)">
              <input
                style={{ ...S.input, ...(isCEO ? null : S.readOnly) }}
                type={isCEO ? "text" : "password"}
                value={settings.ceoDefaultPassword}
                readOnly={!isCEO}
                onChange={(e) => update({ ceoDefaultPassword: e.target.value })}
              />
            </Field>

            <Field label="Staff Default Password (for Login autofill)">
              <input
                style={{ ...S.input, ...(isCEO ? null : S.readOnly) }}
                type={isCEO ? "text" : "password"}
                value={settings.staffDefaultPassword}
                readOnly={!isCEO}
                onChange={(e) => update({ staffDefaultPassword: e.target.value })}
              />
            </Field>
          </div>

          {!isCEO ? (
            <div style={S.warn}>
              Staff cannot edit access control. Log in with CEO email to change.
            </div>
          ) : (
            <div style={S.tip}>
              ✅ After changing emails/passwords here, open <b>/login</b> and refresh.
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

        {/* BEHAVIOR */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Behavior</div>

          <div style={S.grid2}>
            <Toggle
              title="Confirm Deletes"
              desc="Ask before deleting items"
              value={settings.confirmDeletes}
              onChange={(v) => update({ confirmDeletes: v })}
            />
            <div style={S.card}>
              <div style={{ fontWeight: 950 }}>Info</div>
              <div style={S.smallMuted}>
                Passwords in Settings are stored locally only (browser). Supabase still controls real auth.
              </div>
            </div>
          </div>
        </div>

        <div style={S.footerNote}>✅ Settings now actually apply to Login + Access Control</div>
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

function Toggle({
  title,
  desc,
  value,
  onChange,
}: {
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={S.card}>
      <div style={S.rowBetween}>
        <div>
          <div style={{ fontWeight: 950 }}>{title}</div>
          <div style={S.smallMuted}>{desc}</div>
        </div>
        <button
          style={{ ...S.switch, ...(value ? S.switchOn : S.switchOff) }}
          onClick={() => onChange(!value)}
          aria-label={title}
        >
          <span style={{ ...S.knob, transform: value ? "translateX(20px)" : "translateX(0px)" }} />
        </button>
      </div>
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
  readOnly: {
    opacity: 0.75,
    cursor: "not-allowed",
  },

  /* ✅ Hover fix */
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
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },

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

  card: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
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

  switch: {
    width: 46,
    height: 26,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    padding: 3,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    background: "rgba(255,255,255,0.06)",
  },
  switchOn: { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.30)" },
  switchOff: { background: "rgba(255,255,255,0.06)" },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 999,
    background: "rgba(255,255,255,0.80)",
    boxShadow: "0 6px 16px rgba(0,0,0,0.35)",
    transition: "transform 180ms ease",
  },

  footerNote: { color: "#A7B0C0", fontSize: 12, textAlign: "center", padding: 6 },
};
