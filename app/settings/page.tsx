"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/* ================= SUPABASE (safe) ================= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/* ================= STORAGE KEYS ================= */
const LS_SETTINGS = "eventura_os_settings_v4";
const LS_ACL = "eventura_os_acl_v1";
const LS_COMPANY = "eventura_os_company_v1";

/* ================= TYPES ================= */
type SidebarMode = "Icons + Text" | "Icons Only";
type Theme =
  | "Royal Gold"
  | "Midnight Purple"
  | "Emerald Night"
  | "Ocean Blue"
  | "Ruby Noir"
  | "Carbon Black"
  | "Ivory Light";

type Density = "Comfort" | "Compact";
type FontScale = 90 | 100 | 110 | 120;

type Role = "CEO" | "Staff";

type Permission =
  | "events.read"
  | "events.create"
  | "events.edit"
  | "events.delete"
  | "finance.read"
  | "finance.create"
  | "finance.edit"
  | "finance.delete"
  | "vendors.read"
  | "vendors.create"
  | "vendors.edit"
  | "vendors.delete"
  | "hr.read"
  | "hr.create"
  | "hr.edit"
  | "hr.delete"
  | "reports.read"
  | "reports.export"
  | "settings.view";

type AppSettings = {
  ceoEmail: string;
  staffEmail: string;

  theme: Theme;
  sidebarMode: SidebarMode;

  density: Density;
  fontScale: FontScale;

  compactTables: boolean;
  confirmDeletes: boolean;

  reducedMotion: boolean;
  highContrast: boolean;

  modules: {
    dashboard: boolean;
    events: boolean;
    finance: boolean;
    vendors: boolean;
    ai: boolean;
    hr: boolean;
    reports: boolean;
    settings: boolean;
  };

  sessionTimeoutMin: 15 | 30 | 60 | 120;
  rememberDevice: boolean;

  notifications: {
    inApp: boolean;
    email: boolean;
    whatsapp: boolean;
    dailySummary: boolean;
    eventReminders: boolean;
    financeAlerts: boolean;
  };

  region: {
    timezone: string;
    currency: "INR" | "CAD" | "USD";
    language: "English" | "Gujarati" | "Hindi";
    dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  };
};

type ACLState = {
  Staff: Record<Permission, boolean>;
};

type CompanyProfile = {
  brandName: string;
  tagline: string;
  phone: string;
  city: string;
  website: string;
  founders: { name: string; title: string }[];
};

/* ================= DEFAULTS ================= */
const SETTINGS_DEFAULTS: AppSettings = {
  ceoEmail: "hardikvekariya799@gmail.com",
  staffEmail: "eventurastaff@gmail.com",

  theme: "Royal Gold",
  sidebarMode: "Icons + Text",

  density: "Comfort",
  fontScale: 100,

  compactTables: false,
  confirmDeletes: true,

  reducedMotion: false,
  highContrast: false,

  modules: {
    dashboard: true,
    events: true,
    finance: true,
    vendors: true,
    ai: true,
    hr: true,
    reports: true,
    settings: true,
  },

  sessionTimeoutMin: 60,
  rememberDevice: true,

  notifications: {
    inApp: true,
    email: false,
    whatsapp: false,
    dailySummary: true,
    eventReminders: true,
    financeAlerts: true,
  },

  region: {
    timezone: "America/Toronto",
    currency: "INR",
    language: "English",
    dateFormat: "DD/MM/YYYY",
  },
};

const ALL_PERMS: Permission[] = [
  "events.read",
  "events.create",
  "events.edit",
  "events.delete",
  "finance.read",
  "finance.create",
  "finance.edit",
  "finance.delete",
  "vendors.read",
  "vendors.create",
  "vendors.edit",
  "vendors.delete",
  "hr.read",
  "hr.create",
  "hr.edit",
  "hr.delete",
  "reports.read",
  "reports.export",
  "settings.view",
];

const ACL_DEFAULTS: ACLState = {
  Staff: Object.fromEntries(
    ALL_PERMS.map((p) => [
      p,
      p.endsWith(".read") || p === "reports.export" || p === "settings.view",
    ])
  ) as Record<Permission, boolean>,
};

const COMPANY_DEFAULTS: CompanyProfile = {
  brandName: "Eventura",
  tagline: "Events that Speak Your Style",
  phone: "",
  city: "Surat",
  website: "",
  founders: [
    { name: "Hardik Vekariya", title: "Founder & CEO" },
    { name: "Shubh Parekh", title: "Co-Founder" },
    { name: "Dixit Bhuva", title: "Digital Head" },
  ],
};

/* ================= NAV ================= */
type NavItem = { label: string; href: string; icon: string; key: keyof AppSettings["modules"] };
const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "📊", key: "dashboard" },
  { label: "Events", href: "/events", icon: "📅", key: "events" },
  { label: "Finance", href: "/finance", icon: "💰", key: "finance" },
  { label: "Vendors", href: "/vendors", icon: "🏷️", key: "vendors" },
  { label: "AI", href: "/ai", icon: "🤖", key: "ai" },
  { label: "HR", href: "/hr", icon: "🧑‍🤝‍🧑", key: "hr" },
  { label: "Reports", href: "/reports", icon: "📈", key: "reports" },
  { label: "Settings", href: "/settings", icon: "⚙️", key: "settings" },
];

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

function roleFromSettings(email: string, s: AppSettings): Role {
  if (!email) return "Staff";
  return email.toLowerCase() === s.ceoEmail.toLowerCase() ? "CEO" : "Staff";
}

function applyThemeToDom(settings: AppSettings) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-ev-theme", settings.theme);
  document.documentElement.setAttribute("data-ev-density", settings.density);
  document.documentElement.setAttribute("data-ev-sidebar", settings.sidebarMode);
  document.documentElement.setAttribute("data-ev-font", String(settings.fontScale));
  document.documentElement.setAttribute("data-ev-contrast", settings.highContrast ? "high" : "normal");
  document.documentElement.style.fontSize = `${settings.fontScale}%`;
}

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

function groupPerms(staff: Record<Permission, boolean>) {
  const byPrefix = (prefix: string) =>
    (Object.keys(staff) as Permission[]).filter((p) => p.startsWith(prefix));
  return [
    { title: "Events", items: byPrefix("events.") },
    { title: "Finance", items: byPrefix("finance.") },
    { title: "Vendors", items: byPrefix("vendors.") },
    { title: "HR", items: byPrefix("hr.") },
    { title: "Reports", items: byPrefix("reports.") },
    { title: "Settings", items: ["settings.view" as Permission] },
  ];
}
function prettyPerm(p: Permission) {
  const [m, a] = p.split(".");
  return `${cap(m)} ${cap(a)}`;
}
function cap(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/* ================= PAGE ================= */
export default function SettingsPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings>(SETTINGS_DEFAULTS);
  const [acl, setAcl] = useState<ACLState>(ACL_DEFAULTS);
  const [company, setCompany] = useState<CompanyProfile>(COMPANY_DEFAULTS);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  // load
  useEffect(() => {
    const s = safeLoad<AppSettings>(LS_SETTINGS, SETTINGS_DEFAULTS);
    const merged: AppSettings = {
      ...SETTINGS_DEFAULTS,
      ...s,
      modules: { ...SETTINGS_DEFAULTS.modules, ...(s as any).modules },
      notifications: { ...SETTINGS_DEFAULTS.notifications, ...(s as any).notifications },
      region: { ...SETTINGS_DEFAULTS.region, ...(s as any).region },
    };
    setSettings(merged);
    setAcl(safeLoad<ACLState>(LS_ACL, ACL_DEFAULTS));
    setCompany(safeLoad<CompanyProfile>(LS_COMPANY, COMPANY_DEFAULTS));
    applyThemeToDom(merged);
  }, []);

  // persist
  useEffect(() => {
    safeSave(LS_SETTINGS, settings);
    applyThemeToDom(settings);
  }, [settings]);

  useEffect(() => safeSave(LS_ACL, acl), [acl]);
  useEffect(() => safeSave(LS_COMPANY, company), [company]);

  // session email
  useEffect(() => {
    (async () => {
      try {
        if (!supabase) {
          const e =
            safeLoad<string>("eventura_email", "") ||
            safeLoad<string>("eventura_email_session", "");
          setEmail(e);
          setLoading(false);
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

  async function signOut() {
    try {
      if (supabase) await supabase.auth.signOut();
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem("eventura_email");
        sessionStorage.removeItem("eventura_email_session");
        document.cookie = `eventura_email=; Path=/; Max-Age=0`;
      }
      router.push("/login");
    }
  }

  function exportBackup() {
    const payload = {
      version: "eventura-settings-backup-v1",
      exportedAt: new Date().toISOString(),
      settings,
      acl,
      company,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eventura_settings_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file: File) {
    try {
      const json = JSON.parse(await file.text());
      if (!json?.settings) return alert("Invalid backup file.");
      const s = json.settings as AppSettings;
      const merged: AppSettings = {
        ...SETTINGS_DEFAULTS,
        ...s,
        modules: { ...SETTINGS_DEFAULTS.modules, ...(s as any).modules },
        notifications: { ...SETTINGS_DEFAULTS.notifications, ...(s as any).notifications },
        region: { ...SETTINGS_DEFAULTS.region, ...(s as any).region },
      };
      setSettings(merged);
      setAcl(json.acl ? (json.acl as ACLState) : ACL_DEFAULTS);
      setCompany(json.company ? (json.company as CompanyProfile) : COMPANY_DEFAULTS);
      alert("Imported ✅");
    } catch {
      alert("Import failed.");
    }
  }

  function resetAll() {
    if (!confirm("Reset Settings + Access Control + Company Profile to defaults?")) return;
    setSettings(SETTINGS_DEFAULTS);
    setAcl(ACL_DEFAULTS);
    setCompany(COMPANY_DEFAULTS);
  }

  function toggleStaffPreset(preset: "ReadOnly" | "Standard" | "Full") {
    if (!isCEO) return;

    const next: Record<Permission, boolean> = { ...acl.Staff };

    if (preset === "ReadOnly") {
      ALL_PERMS.forEach((perm) => (next[perm] = perm.endsWith(".read") || perm === "settings.view"));
      next["reports.export"] = false;
    } else if (preset === "Standard") {
      ALL_PERMS.forEach((perm) => (next[perm] = false));
      const allow: Permission[] = [
        "events.read",
        "events.create",
        "events.edit",
        "finance.read",
        "finance.create",
        "finance.edit",
        "vendors.read",
        "vendors.create",
        "vendors.edit",
        "hr.read",
        "hr.create",
        "hr.edit",
        "reports.read",
        "reports.export",
        "settings.view",
      ];
      allow.forEach((perm) => (next[perm] = true));
    } else {
      ALL_PERMS.forEach((perm) => (next[perm] = true));
    }

    setAcl({ Staff: next });
  }

  const T = ThemeTokens(settings.theme, settings.highContrast);
  const S = makeStyles(T);

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
          {NAV.filter((n) => settings.modules[n.key]).map((item) => (
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
              Logged in as <b>{email || "Unknown"}</b> • Role: <span style={S.rolePill}>{role}</span>
            </div>
          </div>

          <div style={S.headerRight}>
            <button style={S.secondaryBtn} onClick={exportBackup}>
              Export Backup
            </button>

            <label style={S.secondaryBtn as any}>
              Import Backup
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importBackup(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            <button style={S.dangerBtn} onClick={resetAll}>
              Reset All
            </button>
          </div>
        </div>

        {loading ? <div style={S.loadingBar}>Loading session…</div> : null}

        <div style={S.grid}>
          {/* Appearance */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Appearance</div>

            <div style={S.formGrid}>
              <Field label="Theme">
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

              <Field label="Sidebar mode">
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

              <Field label="Density">
                <select
                  style={S.select}
                  value={settings.density}
                  onChange={(e) => setSettings((p) => ({ ...p, density: e.target.value as Density }))}
                >
                  <option style={S.option}>Comfort</option>
                  <option style={S.option}>Compact</option>
                </select>
              </Field>

              <Field label="Font scale">
                <select
                  style={S.select}
                  value={settings.fontScale}
                  onChange={(e) =>
                    setSettings((p) => ({ ...p, fontScale: Number(e.target.value) as FontScale }))
                  }
                >
                  <option style={S.option} value={90}>
                    90%
                  </option>
                  <option style={S.option} value={100}>
                    100%
                  </option>
                  <option style={S.option} value={110}>
                    110%
                  </option>
                  <option style={S.option} value={120}>
                    120%
                  </option>
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

            <div style={S.smallNote}>Theme applies instantly ✅</div>
          </section>

          {/* Company */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Company Profile</div>

            {!isCEO ? (
              <div style={S.noteBox}>Only CEO can edit Company Profile.</div>
            ) : null}

            <div style={S.formGrid}>
              <Field label="Brand name">
                <input
                  style={S.input}
                  value={company.brandName}
                  disabled={!isCEO}
                  onChange={(e) => setCompany((p) => ({ ...p, brandName: e.target.value }))}
                />
              </Field>

              <Field label="Tagline">
                <input
                  style={S.input}
                  value={company.tagline}
                  disabled={!isCEO}
                  onChange={(e) => setCompany((p) => ({ ...p, tagline: e.target.value }))}
                />
              </Field>

              <Field label="City">
                <input
                  style={S.input}
                  value={company.city}
                  disabled={!isCEO}
                  onChange={(e) => setCompany((p) => ({ ...p, city: e.target.value }))}
                />
              </Field>

              <Field label="Phone">
                <input
                  style={S.input}
                  value={company.phone}
                  disabled={!isCEO}
                  onChange={(e) => setCompany((p) => ({ ...p, phone: e.target.value }))}
                />
              </Field>

              <Field label="Website">
                <input
                  style={S.input}
                  value={company.website}
                  disabled={!isCEO}
                  onChange={(e) => setCompany((p) => ({ ...p, website: e.target.value }))}
                />
              </Field>
            </div>

            <div style={S.sectionTitle}>Founders</div>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {company.founders.map((f, idx) => (
                <div key={idx} style={S.founderRow}>
                  <div style={{ display: "grid", gap: 8, flex: 1 }}>
                    <input
                      style={S.input}
                      value={f.name}
                      disabled={!isCEO}
                      onChange={(e) =>
                        setCompany((p) => {
                          const next = [...p.founders];
                          next[idx] = { ...next[idx], name: e.target.value };
                          return { ...p, founders: next };
                        })
                      }
                      placeholder="Name"
                    />
                    <input
                      style={S.input}
                      value={f.title}
                      disabled={!isCEO}
                      onChange={(e) =>
                        setCompany((p) => {
                          const next = [...p.founders];
                          next[idx] = { ...next[idx], title: e.target.value };
                          return { ...p, founders: next };
                        })
                      }
                      placeholder="Title"
                    />
                  </div>

                  {isCEO ? (
                    <button
                      style={S.dangerMini}
                      onClick={() =>
                        setCompany((p) => ({
                          ...p,
                          founders: p.founders.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {isCEO ? (
              <div style={S.rowBetween}>
                <div style={S.smallNote}>Shown on future reports/invoices.</div>
                <button
                  style={S.primaryBtnSmall}
                  onClick={() =>
                    setCompany((p) => ({
                      ...p,
                      founders: [...p.founders, { name: "", title: "" }],
                    }))
                  }
                >
                  Add Founder
                </button>
              </div>
            ) : null}
          </section>

          {/* Region & Notifications */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Region & Notifications</div>

            <div style={S.formGrid}>
              <Field label="Timezone">
                <input
                  style={S.input}
                  value={settings.region.timezone}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      region: { ...p.region, timezone: e.target.value },
                    }))
                  }
                />
              </Field>

              <Field label="Currency">
                <select
                  style={S.select}
                  value={settings.region.currency}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      region: { ...p.region, currency: e.target.value as any },
                    }))
                  }
                >
                  <option style={S.option}>INR</option>
                  <option style={S.option}>CAD</option>
                  <option style={S.option}>USD</option>
                </select>
              </Field>

              <Field label="Language">
                <select
                  style={S.select}
                  value={settings.region.language}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      region: { ...p.region, language: e.target.value as any },
                    }))
                  }
                >
                  <option style={S.option}>English</option>
                  <option style={S.option}>Gujarati</option>
                  <option style={S.option}>Hindi</option>
                </select>
              </Field>

              <Field label="Date format">
                <select
                  style={S.select}
                  value={settings.region.dateFormat}
                  onChange={(e) =>
                    setSettings((p) => ({
                      ...p,
                      region: { ...p.region, dateFormat: e.target.value as any },
                    }))
                  }
                >
                  <option style={S.option}>DD/MM/YYYY</option>
                  <option style={S.option}>MM/DD/YYYY</option>
                  <option style={S.option}>YYYY-MM-DD</option>
                </select>
              </Field>
            </div>

            <div style={S.sectionTitle}>Notifications</div>
            <div style={S.toggleRow}>
              <Toggle
                label="In-app"
                value={settings.notifications.inApp}
                onChange={(v) =>
                  setSettings((p) => ({ ...p, notifications: { ...p.notifications, inApp: v } }))
                }
                S={S}
              />
              <Toggle
                label="Email"
                value={settings.notifications.email}
                onChange={(v) =>
                  setSettings((p) => ({ ...p, notifications: { ...p.notifications, email: v } }))
                }
                S={S}
              />
              <Toggle
                label="WhatsApp"
                value={settings.notifications.whatsapp}
                onChange={(v) =>
                  setSettings((p) => ({ ...p, notifications: { ...p.notifications, whatsapp: v } }))
                }
                S={S}
              />
              <Toggle
                label="Daily summary"
                value={settings.notifications.dailySummary}
                onChange={(v) =>
                  setSettings((p) => ({
                    ...p,
                    notifications: { ...p.notifications, dailySummary: v },
                  }))
                }
                S={S}
              />
              <Toggle
                label="Event reminders"
                value={settings.notifications.eventReminders}
                onChange={(v) =>
                  setSettings((p) => ({
                    ...p,
                    notifications: { ...p.notifications, eventReminders: v },
                  }))
                }
                S={S}
              />
              <Toggle
                label="Finance alerts"
                value={settings.notifications.financeAlerts}
                onChange={(v) =>
                  setSettings((p) => ({
                    ...p,
                    notifications: { ...p.notifications, financeAlerts: v },
                  }))
                }
                S={S}
              />
            </div>
          </section>

          {/* Modules */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Modules (Sidebar visibility)</div>
            {!isCEO ? <div style={S.noteBox}>Only CEO can change modules visibility.</div> : null}

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {Object.entries(settings.modules).map(([k, v]) => (
                <div key={k} style={S.rowBetween}>
                  <div style={{ fontWeight: 950, textTransform: "capitalize" }}>{k}</div>
                  <button
                    style={v ? S.toggleOnBtn : S.toggleOffBtn}
                    disabled={!isCEO}
                    onClick={() =>
                      setSettings((p) => ({
                        ...p,
                        modules: { ...p.modules, [k]: !p.modules[k as any] },
                      }))
                    }
                  >
                    {v ? "Enabled" : "Disabled"}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Access Control */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Access Control (Staff)</div>

            {!isCEO ? (
              <div style={S.noteBox}>Only CEO can edit permissions.</div>
            ) : (
              <div style={S.rowBetween}>
                <div style={S.smallNote}>Quick presets:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button style={S.secondaryBtn} onClick={() => toggleStaffPreset("ReadOnly")}>
                    Read-Only
                  </button>
                  <button style={S.secondaryBtn} onClick={() => toggleStaffPreset("Standard")}>
                    Standard
                  </button>
                  <button style={S.secondaryBtn} onClick={() => toggleStaffPreset("Full")}>
                    Full
                  </button>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {groupPerms(acl.Staff).map((group) => (
                <div key={group.title} style={S.permGroup}>
                  <div style={S.permGroupTitle}>{group.title}</div>
                  <div style={S.permGrid}>
                    {group.items.map((perm) => {
                      const enabled = acl.Staff[perm];
                      return (
                        <button
                          key={perm}
                          style={enabled ? S.permOn : S.permOff}
                          disabled={!isCEO}
                          onClick={() => {
                            if (!isCEO) return;
                            setAcl((p) => ({ Staff: { ...p.Staff, [perm]: !p.Staff[perm] } }));
                          }}
                        >
                          {prettyPerm(perm)}: {enabled ? "ON" : "OFF"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={S.smallNote}>
              (Next step later: enforce these permissions inside each module page.)
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ================= UI BITS ================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
  S: Record<string, React.CSSProperties>;
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
function makeStyles(T: any): Record<string, React.CSSProperties> {
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

    rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
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
    primaryBtnSmall: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.accentBd}`,
      background: `linear-gradient(135deg, ${T.accentBg}, rgba(255,255,255,0.06))`,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
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

    sectionTitle: { marginTop: 14, fontWeight: 950, fontSize: 13, color: T.text },

    permGroup: {
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.soft,
    },
    permGroupTitle: { fontWeight: 950, marginBottom: 10 },
    permGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
    permOn: {
      padding: "10px 10px",
      borderRadius: 14,
      border: `1px solid ${T.okBd}`,
      background: T.okBg,
      color: T.okTx,
      fontWeight: 950,
      cursor: "pointer",
      textAlign: "left",
    },
    permOff: {
      padding: "10px 10px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: "rgba(0,0,0,0.05)",
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
      textAlign: "left",
    },

    founderRow: { display: "flex", gap: 10, alignItems: "flex-start" },
    dangerMini: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.dangerBd}`,
      background: T.dangerBg,
      color: T.dangerTx,
      fontWeight: 950,
      cursor: "pointer",
      height: "fit-content",
      marginTop: 2,
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
