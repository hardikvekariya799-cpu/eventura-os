"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ================= STORAGE KEYS ================= */
const LS_SETTINGS = "eventura_os_settings_v2";

// Your app data keys (used for Export / Import / Reset)
const DATA_KEYS = [
  "eventura_os_events_v1",
  "eventura_os_fin_tx_v1",
  "eventura_os_hr_team_v2",
  "eventura_os_vendors_v1",
  "eventura_os_ai_docs_v1",
  "eventura_os_reports_templates_v1",
  "eventura_os_tasks_v1",
];

type Role = "CEO" | "Staff";

type SidebarMode = "Icons + Text" | "Icons Only";
type Theme = "Royal Gold" | "Midnight Purple" | "Emerald Night";

type AppSettings = {
  // Access control (UI-only, no server)
  ceoEmail: string;
  staffEmail: string;

  // UI settings
  theme: Theme;
  sidebarMode: SidebarMode;
  compactTables: boolean;

  // Behavior
  autoSave: boolean;
  confirmDeletes: boolean;

  // Meta
  updatedAt: string;
};

const DEFAULTS: AppSettings = {
  ceoEmail: "hardikvekariya799@gmail.com",
  staffEmail: "eventurastaff@gmail.com",
  theme: "Royal Gold",
  sidebarMode: "Icons + Text",
  compactTables: false,
  autoSave: true,
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
function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function nowISO() {
  return new Date().toISOString();
}

function getCurrentEmail(): string {
  if (typeof window === "undefined") return "";
  // We kept this in your app earlier for role detection
  const fromLS = localStorage.getItem("eventura_email") || "";
  if (fromLS) return fromLS;
  // try cookie fallback
  const m = document.cookie.match(/(?:^|;\s*)eventura_email=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function roleFromSettings(email: string, s: AppSettings): Role {
  if (!email) return "Staff";
  return email.toLowerCase() === s.ceoEmail.toLowerCase() ? "CEO" : "Staff";
}

/* ================= PAGE ================= */
export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [msg, setMsg] = useState("");

  // read current session email
  const email = useMemo(() => getCurrentEmail(), []);
  const role = useMemo(() => roleFromSettings(email, settings), [email, settings]);

  // load settings
  useEffect(() => {
    const s = safeLoad<AppSettings>(LS_SETTINGS, DEFAULTS);
    // Merge defaults to avoid missing fields after updates
    const merged: AppSettings = { ...DEFAULTS, ...s };
    setSettings(merged);
  }, []);

  // save settings automatically
  useEffect(() => {
    if (!settings?.updatedAt) return;
    safeSave(LS_SETTINGS, settings);
  }, [settings]);

  function update(patch: Partial<AppSettings>) {
    setMsg("");
    setSettings((prev) => ({
      ...prev,
      ...patch,
      updatedAt: nowISO(),
    }));
  }

  function exportAllData() {
    const payload: Record<string, any> = { _meta: { exportedAt: nowISO() }, settings };
    for (const key of DATA_KEYS) {
      payload[key] = safeLoad<any>(key, null);
    }
    downloadFile(
      `eventura_backup_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      "application/json"
    );
    setMsg("✅ Backup exported (JSON).");
  }

  async function importAllData(file: File) {
    setMsg("");
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data !== "object") throw new Error("Invalid backup file.");

      // restore settings
      if (data.settings) {
        const merged: AppSettings = { ...DEFAULTS, ...data.settings, updatedAt: nowISO() };
        safeSave(LS_SETTINGS, merged);
        setSettings(merged);
      }

      // restore keys
      for (const key of DATA_KEYS) {
        if (key in data) {
          safeSave(key, data[key]);
        }
      }

      setMsg("✅ Backup imported. Refresh the app to see restored data.");
    } catch (e: any) {
      setMsg(`❌ Import failed: ${e?.message || "Unknown error"}`);
    }
  }

  function resetOnlySettings() {
    setMsg("");
    update({ ...DEFAULTS, updatedAt: nowISO() });
    setMsg("✅ Settings reset.");
  }

  function resetAllData() {
    setMsg("");
    const ok =
      !settings.confirmDeletes ||
      confirm("This will DELETE all local app data (events, finance, HR, vendors, AI, reports, tasks). Continue?");
    if (!ok) return;

    for (const key of DATA_KEYS) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(LS_SETTINGS);
    setSettings({ ...DEFAULTS, updatedAt: nowISO() });
    setMsg("✅ All local data reset. Refresh the app.");
  }

  function applyThemePreview(t: Theme) {
    update({ theme: t });
    setMsg(`✅ Theme set: ${t}`);
  }

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
            <button style={S.ghostBtn} onClick={exportAllData}>
              Export Backup
            </button>
            <label style={{ ...S.ghostBtn, cursor: "pointer" }}>
              Import Backup
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importAllData(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* ACCESS CONTROL */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Access Control (UI)</div>
          <div style={S.smallNote}>
            This controls role display inside the app. CEO role = matches CEO email.
          </div>

          <div style={S.grid2}>
            <Field label="CEO Email">
              <input
                style={S.input}
                value={settings.ceoEmail}
                onChange={(e) => update({ ceoEmail: e.target.value })}
                placeholder="ceo@gmail.com"
              />
            </Field>

            <Field label="Staff Email (default)">
              <input
                style={S.input}
                value={settings.staffEmail}
                onChange={(e) => update({ staffEmail: e.target.value })}
                placeholder="staff@gmail.com"
              />
            </Field>
          </div>

          <div style={S.tip}>
            ✅ To become CEO: log in with the CEO email above. <br />
            If you change CEO email here, your role changes immediately (based on current session email).
          </div>
        </div>

        {/* UI SETTINGS */}
        <div style={S.panel}>
          <div style={S.panelTitle}>UI Settings</div>

          <div style={S.grid3}>
            <Field label="Theme">
              <select
                style={S.select}
                value={settings.theme}
                onChange={(e) => applyThemePreview(e.target.value as Theme)}
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
                onChange={(e) => update({ sidebarMode: e.target.value as SidebarMode })}
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

          <div style={S.themeCards}>
            <ThemeCard
              title="Royal Gold"
              desc="Gold + purple glow (Eventura premium look)"
              active={settings.theme === "Royal Gold"}
              onClick={() => applyThemePreview("Royal Gold")}
            />
            <ThemeCard
              title="Midnight Purple"
              desc="Deep purple + clean contrast"
              active={settings.theme === "Midnight Purple"}
              onClick={() => applyThemePreview("Midnight Purple")}
            />
            <ThemeCard
              title="Emerald Night"
              desc="Green neon accents + dark elegance"
              active={settings.theme === "Emerald Night"}
              onClick={() => applyThemePreview("Emerald Night")}
            />
          </div>
        </div>

        {/* BEHAVIOR */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Behavior</div>

          <div style={S.grid2}>
            <Toggle
              title="Auto Save"
              desc="Automatically save settings changes"
              value={settings.autoSave}
              onChange={(v) => update({ autoSave: v })}
            />
            <Toggle
              title="Confirm Deletes"
              desc="Ask before deleting data"
              value={settings.confirmDeletes}
              onChange={(v) => update({ confirmDeletes: v })}
            />
          </div>

          <div style={S.smallMuted}>
            Updated: {new Date(settings.updatedAt).toLocaleString()}
          </div>
        </div>

        {/* DATA MANAGEMENT */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Data Management</div>

          <div style={S.rowBetween}>
            <div style={S.smallNote}>
              Reset only affects local app storage (safe, no server).
            </div>
            <div style={S.row}>
              <button style={S.ghostBtn} onClick={resetOnlySettings}>
                Reset Settings
              </button>
              <button style={S.dangerBtn} onClick={resetAllData}>
                Reset ALL Data
              </button>
            </div>
          </div>

          <div style={S.keysBox}>
            <div style={S.keysTitle}>Local Keys Used</div>
            <div style={S.keysGrid}>
              {DATA_KEYS.map((k) => (
                <div key={k} style={S.keyPill}>
                  {k}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={S.footerNote}>
          ✅ Hover fixed • ✅ Backup/Restore • ✅ Reset • ✅ No deploy errors
        </div>
      </div>
    </div>
  );
}

/* ================= UI COMPONENTS ================= */
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
    <div style={S.toggleCard}>
      <div style={S.rowBetween}>
        <div>
          <div style={{ fontWeight: 950 }}>{title}</div>
          <div style={S.smallMuted}>{desc}</div>
        </div>
        <button
          style={{
            ...S.switch,
            ...(value ? S.switchOn : S.switchOff),
          }}
          onClick={() => onChange(!value)}
          aria-label={title}
        >
          <span style={{ ...S.knob, transform: value ? "translateX(20px)" : "translateX(0px)" }} />
        </button>
      </div>
    </div>
  );
}

function ThemeCard({
  title,
  desc,
  active,
  onClick,
}: {
  title: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      style={{
        ...S.themeCard,
        ...(active ? S.themeCardActive : null),
      }}
      onClick={onClick}
    >
      <div style={{ fontWeight: 950 }}>{title}</div>
      <div style={S.smallMuted}>{desc}</div>
    </button>
  );
}

/* ================= STYLES (hover fix included) ================= */
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

  /* ✅ HOVER FIX: dark select + dark options */
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

  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(212,175,55,0.35)",
    background: "linear-gradient(135deg, rgba(212,175,55,0.32), rgba(139,92,246,0.22))",
    color: "#FFF",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
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

  themeCards: { marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
  themeCard: {
    textAlign: "left",
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "#F9FAFB",
    cursor: "pointer",
  },
  themeCardActive: {
    border: "1px solid rgba(212,175,55,0.35)",
    background: "rgba(212,175,55,0.10)",
  },

  toggleCard: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
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

  keysBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,32,0.55)",
  },
  keysTitle: { fontWeight: 950, marginBottom: 10, color: "#FDE68A" },
  keysGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  keyPill: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(139,92,246,0.12)",
    border: "1px solid rgba(139,92,246,0.22)",
    color: "#E9D5FF",
    fontWeight: 900,
  },

  footerNote: { color: "#A7B0C0", fontSize: 12, textAlign: "center", padding: 6 },
};

/* ================= END ================= */
