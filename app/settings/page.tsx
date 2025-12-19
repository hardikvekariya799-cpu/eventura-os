"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/* ================= SUPABASE (safe) ================= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/* ================= SETTINGS (LOCAL) ================= */
const LS_SETTINGS = "eventura_os_settings_v3"; // keep SAME key to avoid breaking your working app

type SidebarMode = "Icons + Text" | "Icons Only";
type Theme =
  | "Royal Gold"
  | "Midnight Purple"
  | "Emerald Night"
  | "Ocean Blue"
  | "Ruby Noir"
  | "Carbon Black"
  | "Ivory Light";

type AppSettings = {
  ceoEmail: string;
  staffEmail: string;
  theme: Theme;
  sidebarMode: SidebarMode;

  compactTables: boolean;
  confirmDeletes: boolean;

  reducedMotion: boolean;
  highContrast: boolean;

  // extra safe features
  quickActions: boolean;
  autoSaveLabel: boolean;
};

const SETTINGS_DEFAULTS: AppSettings = {
  ceoEmail: "hardikvekariya799@gmail.com",
  staffEmail: "eventurastaff@gmail.com",
  theme: "Royal Gold",
  sidebarMode: "Icons + Text",
  compactTables: false,
  confirmDeletes: true,
  reducedMotion: false,
  highContrast: false,
  quickActions: true,
  autoSaveLabel: true,
};

type Role = "CEO" | "Staff";

type NavItem = { label: string; href: string; icon: string };
const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "Events", href: "/events", icon: "📅" },
  { label: "Finance", href: "/finance", icon: "💰" },
  { label: "Vendors", href: "/vendors", icon: "🏷️" },
  { label: "AI", href: "/ai", icon: "🤖" },
  { label: "HR", href: "/hr", icon: "🧑‍🤝‍🧑" },
  { label: "Reports", href: "/reports", icon: "📈" },
  { label: "Settings", href: "/settings", icon: "⚙️" },
];

/* ================= LOCAL HELPERS ================= */
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

function roleFromSettings(email: string, s: AppSettings): Role {
  if (!email) return "Staff";
  return email.toLowerCase() === s.ceoEmail.toLowerCase() ? "CEO" : "Staff";
}

function applyThemeToDom(s: AppSettings) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-ev-theme", s.theme);
  document.documentElement.setAttribute("data-ev-sidebar", s.sidebarMode);
  document.documentElement.setAttribute("data-ev-contrast", s.highContrast ? "high" : "normal");
  document.documentElement.setAttribute("data-ev-motion", s.reducedMotion ? "reduced" : "normal");
}

/* ================= THEME TOKENS ================= */
function ThemeTokens(theme: Theme, highContrast: boolean) {
  const base = {
    text: "#F9FAFB",
    muted: "#9CA3AF",
    bg: "#050816",
    panel: "rgba(11,16,32,0.60)",
    panel2: "rgba(11,16,32,0.85)",
    border: highContrast ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)",
    soft: highContrast ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
    inputBg: highContrast ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
    dangerBg: "rgba(248,113,113,0.10)",
    dangerBd: highContrast ? "rgba(248,113,113,0.55)" : "rgba(248,113,113,0.30)",
    dangerTx: "#FCA5A5",
    okBg: "rgba(34,197,94,0.12)",
    okBd: highContrast ? "rgba(34,197,94,0.45)" : "rgba(34,197,94,0.28)",
    okTx: "#86EFAC",
  };

  switch (theme) {
    case "Midnight Purple":
      return {
        ...base,
        glow1: "rgba(139,92,246,0.22)",
        glow2: "rgba(212,175,55,0.14)",
        accentBg: "rgba(139,92,246,0.16)",
        accentBd: highContrast ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.30)",
        accentTx: "#DDD6FE",
      };
    case "Emerald Night":
      return {
        ...base,
        glow1: "rgba(16,185,129,0.18)",
        glow2: "rgba(212,175,55,0.12)",
        accentBg: "rgba(16,185,129,0.16)",
        accentBd: highContrast ? "rgba(16,185,129,0.55)" : "rgba(16,185,129,0.30)",
        accentTx: "#A7F3D0",
      };
    case "Ocean Blue":
      return {
        ...base,
        glow1: "rgba(59,130,246,0.22)",
        glow2: "rgba(34,211,238,0.14)",
        accentBg: "rgba(59,130,246,0.16)",
        accentBd: highContrast ? "rgba(59,130,246,0.55)" : "rgba(59,130,246,0.30)",
        accentTx: "#BFDBFE",
      };
    case "Ruby Noir":
      return {
        ...base,
        glow1: "rgba(244,63,94,0.18)",
        glow2: "rgba(212,175,55,0.10)",
        accentBg: "rgba(244,63,94,0.14)",
        accentBd: highContrast ? "rgba(244,63,94,0.50)" : "rgba(244,63,94,0.26)",
        accentTx: "#FDA4AF",
      };
    case "Carbon Black":
      return {
        ...base,
        bg: "#03040A",
        glow1: "rgba(255,255,255,0.10)",
        glow2: "rgba(212,175,55,0.10)",
        accentBg: "rgba(212,175,55,0.14)",
        accentBd: highContrast ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)",
        accentTx: "#FDE68A",
      };
    case "Ivory Light":
      return {
        ...base,
        text: "#111827",
        muted: "#4B5563",
        bg: "#F9FAFB",
        panel: "rgba(255,255,255,0.78)",
        panel2: "rgba(255,255,255,0.92)",
        border: highContrast ? "rgba(17,24,39,0.22)" : "rgba(17,24,39,0.12)",
        soft: highContrast ? "rgba(17,24,39,0.07)" : "rgba(17,24,39,0.04)",
        inputBg: highContrast ? "rgba(17,24,39,0.08)" : "rgba(17,24,39,0.04)",
        dangerTx: "#B91C1C",
        glow1: "rgba(212,175,55,0.16)",
        glow2: "rgba(59,130,246,0.14)",
        accentBg: "rgba(212,175,55,0.16)",
        accentBd: highContrast ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)",
        accentTx: "#92400E",
        okTx: "#166534",
      };
    case "Royal Gold":
    default:
      return {
        ...base,
        glow1: "rgba(255,215,110,0.18)",
        glow2: "rgba(120,70,255,0.18)",
        accentBg: "rgba(212,175,55,0.12)",
        accentBd: highContrast ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)",
        accentTx: "#FDE68A",
      };
  }
}

/* ================= PAGE ================= */
export default function SettingsPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings>(SETTINGS_DEFAULTS);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [savedPulse, setSavedPulse] = useState(0);

  // load once
  useEffect(() => {
    const s = safeLoad<AppSettings>(LS_SETTINGS, SETTINGS_DEFAULTS);
    const merged: AppSettings = { ...SETTINGS_DEFAULTS, ...s };
    setSettings(merged);
    applyThemeToDom(merged);
  }, []);

  // persist
  useEffect(() => {
    safeSave(LS_SETTINGS, settings);
    applyThemeToDom(settings);
    if (settings.autoSaveLabel) setSavedPulse((x) => x + 1);
  }, [settings]);

  // session email
  useEffect(() => {
    (async () => {
      try {
        if (!supabase) {
          setEmail(safeLoad<string>("eventura_email", ""));
          return;
        }
        const { data } = await supabase.auth.getSession();
        setEmail(data.session?.user?.email || "");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const role = useMemo(() => roleFromSettings(email, settings), [email, settings]);
  const isCEO = role === "CEO";
  const sidebarIconsOnly = settings.sidebarMode === "Icons Only";

  const T = ThemeTokens(settings.theme, settings.highContrast);
  const S = makeStyles(T);

  async function signOut() {
    try {
      if (supabase) await supabase.auth.signOut();
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("eventura_email");
        document.cookie = `eventura_email=; Path=/; Max-Age=0`;
      }
      router.push("/login");
    }
  }

  function exportSettings() {
    const payload = {
      version: "eventura-settings-backup-v1",
      exportedAt: new Date().toISOString(),
      settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eventura_settings_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importSettings(file: File) {
    try {
      const json = JSON.parse(await file.text());
      const incoming = (json?.settings ?? json) as Partial<AppSettings>;
      const merged: AppSettings = { ...SETTINGS_DEFAULTS, ...incoming };
      setSettings(merged);
      alert("Imported ✅");
    } catch {
      alert("Import failed.");
    }
  }

  function resetDefaults() {
    if (!confirm("Reset Settings to defaults?")) return;
    setSettings(SETTINGS_DEFAULTS);
  }

  return (
    <div style={S.app}>
      <aside style={{ ...S.sidebar, width: sidebarIconsOnly ? 76 : 280 }}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          {!sidebarIconsOnly ? (
            <div>
              <div style={S.brandName}>Eventura OS</div>
              <div style={S.brandSub}>{settings.theme}</div>
            </div>
          ) : null}
        </div>

        <nav style={S.nav}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} style={S.navItem as any}>
              <span style={S.navIcon}>{item.icon}</span>
              {!sidebarIconsOnly ? <span style={S.navLabel}>{item.label}</span> : null}
            </Link>
          ))}
        </nav>

        <div style={S.sidebarFooter}>
          {!sidebarIconsOnly ? (
            <div style={S.userBox}>
              <div style={S.userLabel}>Signed in</div>
              <div style={S.userEmail}>{email || "Unknown"}</div>
              <div style={S.roleBadge}>{role}</div>
            </div>
          ) : (
            <div style={S.roleBadgeSmall}>{role}</div>
          )}

          <button style={S.signOutBtn} onClick={signOut}>
            {sidebarIconsOnly ? "⎋" : "Sign Out"}
          </button>
        </div>
      </aside>

      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={S.h1}>Settings</div>
            <div style={S.muted}>
              Logged in as <b>{email || "Unknown"}</b> • Role:{" "}
              <span style={S.rolePill}>{role}</span>
              {settings.autoSaveLabel ? (
                <span key={savedPulse} style={S.savedPill}>
                  Saved
                </span>
              ) : null}
            </div>
          </div>

          <div style={S.headerRight}>
            <button style={S.secondaryBtn} onClick={exportSettings}>
              Export
            </button>

            <label style={S.secondaryBtn as any}>
              Import
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importSettings(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <button style={S.dangerBtn} onClick={resetDefaults}>
              Reset
            </button>
          </div>
        </div>

        {loading ? <div style={S.loadingBar}>Loading session…</div> : null}

        <div style={S.grid}>
          {/* Appearance */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Appearance</div>

            <div style={S.formGrid}>
              <Field label="Theme" S={S}>
                <select
                  style={S.select}
                  value={settings.theme}
                  onChange={(e) => setSettings((p) => ({ ...p, theme: e.target.value as Theme }))}
                >
                  {(
                    [
                      "Royal Gold",
                      "Midnight Purple",
                      "Emerald Night",
                      "Ocean Blue",
                      "Ruby Noir",
                      "Carbon Black",
                      "Ivory Light",
                    ] as Theme[]
                  ).map((t) => (
                    <option key={t} style={S.option}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Sidebar mode" S={S}>
                <select
                  style={S.select}
                  value={settings.sidebarMode}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, sidebarMode: e.target.value as SidebarMode }))
                  }
                >
                  <option style={S.option}>Icons + Text</option>
                  <option style={S.option}>Icons Only</option>
                </select>
              </Field>
            </div>

            <div style={S.toggleRow}>
              <Toggle
                label="Compact tables"
                value={settings.compactTables}
                onChange={(v) => setSettings((p) => ({ ...p, compactTables: v }))}
                S={S}
              />
              <Toggle
                label="Confirm deletes"
                value={settings.confirmDeletes}
                onChange={(v) => setSettings((p) => ({ ...p, confirmDeletes: v }))}
                S={S}
              />
              <Toggle
                label="Reduced motion"
                value={settings.reducedMotion}
                onChange={(v) => setSettings((p) => ({ ...p, reducedMotion: v }))}
                S={S}
              />
              <Toggle
                label="High contrast"
                value={settings.highContrast}
                onChange={(v) => setSettings((p) => ({ ...p, highContrast: v }))}
                S={S}
              />
            </div>

            <div style={S.smallNote}>
              Theme applies instantly across app pages that read DOM tokens.
            </div>
          </section>

          {/* Access */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Access</div>

            <div style={S.formGrid}>
              <Field label="CEO email" S={S}>
                <input
                  style={S.input}
                  value={settings.ceoEmail}
                  disabled={!isCEO}
                  onChange={(e) => setSettings((p) => ({ ...p, ceoEmail: e.target.value }))}
                />
              </Field>

              <Field label="Staff email" S={S}>
                <input
                  style={S.input}
                  value={settings.staffEmail}
                  disabled={!isCEO}
                  onChange={(e) => setSettings((p) => ({ ...p, staffEmail: e.target.value }))}
                />
              </Field>
            </div>

            {!isCEO ? (
              <div style={S.noteBox}>Only CEO can edit access emails.</div>
            ) : (
              <div style={S.noteBox}>
                Tip: Keep CEO email exactly same as your login email.
              </div>
            )}

            <div style={S.sectionTitle}>Extra Settings</div>
            <div style={S.toggleRow}>
              <Toggle
                label="Show quick actions"
                value={settings.quickActions}
                onChange={(v) => setSettings((p) => ({ ...p, quickActions: v }))}
                S={S}
              />
              <Toggle
                label="Show auto-save label"
                value={settings.autoSaveLabel}
                onChange={(v) => setSettings((p) => ({ ...p, autoSaveLabel: v }))}
                S={S}
              />
            </div>
          </section>

          {/* Data Tools */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Data Tools</div>
            <div style={S.smallNote}>Export/import settings backup anytime.</div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <button style={S.secondaryBtnFull} onClick={exportSettings}>
                Download Settings Backup (JSON)
              </button>

              <label style={S.secondaryBtnFull as any}>
                Import Backup (JSON)
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importSettings(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>

              <button style={S.dangerBtnFull} onClick={resetDefaults}>
                Reset Settings to Defaults
              </button>
            </div>
          </section>

          {/* Status */}
          <section style={S.panel}>
            <div style={S.panelTitle}>System Status</div>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <div style={S.statusRow}>
                <span style={S.smallMuted}>Role</span>
                <span style={S.statusPill}>{role}</span>
              </div>
              <div style={S.statusRow}>
                <span style={S.smallMuted}>Theme</span>
                <span style={S.statusPill}>{settings.theme}</span>
              </div>
              <div style={S.statusRow}>
                <span style={S.smallMuted}>Storage Key</span>
                <span style={S.statusPill}>{LS_SETTINGS}</span>
              </div>
              <div style={S.smallNote}>
                This Settings page only touches localStorage and DOM theme tokens.
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ================= SMALL UI ================= */
function Field({
  label,
  children,
  S,
}: {
  label: string;
  children: React.ReactNode;
  S: Record<string, CSSProperties>;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.9 }}>{label}</div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  S,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  S: Record<string, CSSProperties>;
}) {
  return (
    <button
      type="button"
      style={value ? S.toggleOnBtn : S.toggleOffBtn}
      onClick={() => onChange(!value)}
    >
      {label}: {value ? "ON" : "OFF"}
    </button>
  );
}

/* ================= STYLES ================= */
function makeStyles(T: any): Record<string, CSSProperties> {
  return {
    app: {
      minHeight: "100vh",
      display: "flex",
      background: `radial-gradient(1200px 800px at 20% 10%, ${T.glow1}, transparent 60%),
                   radial-gradient(900px 700px at 80% 20%, ${T.glow2}, transparent 55%),
                   ${T.bg}`,
      color: T.text,
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
    },

    sidebar: {
      position: "sticky",
      top: 0,
      height: "100vh",
      padding: 12,
      borderRight: `1px solid ${T.border}`,
      background: T.panel2,
      backdropFilter: "blur(10px)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    },
    brandRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 8px" },
    logoCircle: {
      width: 38,
      height: 38,
      borderRadius: 12,
      display: "grid",
      placeItems: "center",
      fontWeight: 950,
      background: `linear-gradient(135deg, ${T.accentBg}, rgba(255,255,255,0.06))`,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
    },
    brandName: { fontWeight: 950, lineHeight: 1.1 },
    brandSub: { color: T.muted, fontSize: 12, marginTop: 2 },

    nav: { display: "grid", gap: 8 },
    navItem: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 10px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.border}`,
      background: T.soft,
    },
    navIcon: { fontSize: 18, width: 22, textAlign: "center" },
    navLabel: { fontWeight: 900, fontSize: 13 },

    sidebarFooter: { marginTop: "auto", display: "grid", gap: 10 },
    userBox: {
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.soft,
    },
    userLabel: { fontSize: 12, color: T.muted, fontWeight: 900 },
    userEmail: { fontSize: 13, fontWeight: 900, marginTop: 6, wordBreak: "break-word" },
    roleBadge: {
      marginTop: 10,
      display: "inline-flex",
      alignItems: "center",
      padding: "5px 10px",
      borderRadius: 999,
      background: T.accentBg,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
      fontWeight: 950,
      width: "fit-content",
    },
    roleBadgeSmall: {
      display: "inline-flex",
      justifyContent: "center",
      padding: "6px 8px",
      borderRadius: 999,
      background: T.accentBg,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
      fontWeight: 950,
    },
    signOutBtn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.dangerBd}`,
      background: T.dangerBg,
      color: T.dangerTx,
      fontWeight: 950,
      cursor: "pointer",
    },

    main: { flex: 1, padding: 16, maxWidth: 1400, margin: "0 auto", width: "100%" },
    header: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      padding: 12,
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel,
      backdropFilter: "blur(10px)",
    },
    headerRight: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
    h1: { fontSize: 26, fontWeight: 950 },
    muted: { color: T.muted, fontSize: 13, marginTop: 6 },

    rolePill: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontWeight: 950,
      background: T.accentBg,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
      marginLeft: 8,
    },
    savedPill: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontWeight: 950,
      background: T.okBg,
      border: `1px solid ${T.okBd}`,
      color: T.okTx,
      marginLeft: 8,
    },

    grid: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    panel: {
      padding: 14,
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel,
      backdropFilter: "blur(10px)",
    },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    formGrid: { marginTop: 12, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" },

    input: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
    },
    select: {
      width: "100%",
      padding: "10px 10px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontWeight: 900,
    },
    option: { backgroundColor: "#0B1020", color: "#F9FAFB" },

    toggleRow: { marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" },
    sectionTitle: { marginTop: 14, fontWeight: 950, fontSize: 13, color: T.text },

    smallMuted: { color: T.muted, fontSize: 12 },
    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35 },

    secondaryBtn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
    },
    secondaryBtnFull: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
      textAlign: "center",
    },
    dangerBtn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.dangerBd}`,
      background: T.dangerBg,
      color: T.dangerTx,
      fontWeight: 950,
      cursor: "pointer",
    },
    dangerBtnFull: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.dangerBd}`,
      background: T.dangerBg,
      color: T.dangerTx,
      fontWeight: 950,
      cursor: "pointer",
      textAlign: "center",
    },

    toggleOnBtn: {
      padding: "9px 12px",
      borderRadius: 999,
      border: `1px solid ${T.okBd}`,
      background: T.okBg,
      color: T.okTx,
      fontWeight: 950,
      cursor: "pointer",
      fontSize: 12,
    },
    toggleOffBtn: {
      padding: "9px 12px",
      borderRadius: 999,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
      fontSize: 12,
    },

    noteBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.accentBd}`,
      background: T.accentBg,
      color: T.text,
      fontSize: 13,
      lineHeight: 1.35,
    },

    statusRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.soft,
    },
    statusPill: {
      padding: "5px 10px",
      borderRadius: 999,
      border: `1px solid ${T.accentBd}`,
      background: T.accentBg,
      color: T.accentTx,
      fontWeight: 950,
      fontSize: 12,
    },

    loadingBar: {
      marginTop: 12,
      padding: 10,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.muted,
      fontSize: 12,
    },
  };
}
