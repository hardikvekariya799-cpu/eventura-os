"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* ================= NAV ================= */
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

/* ================= SETTINGS (local only) ================= */
type Theme = "Royal Gold" | "Midnight Purple" | "Emerald Night" | "Ocean Blue" | "Ruby Noir" | "Carbon Black" | "Ivory Light";
type SidebarMode = "Icons + Text" | "Icons Only";
type AppSettings = {
  ceoEmail: string;
  staffEmail: string;
  theme: Theme;
  sidebarMode: SidebarMode;
  compactTables: boolean;
  confirmDeletes: boolean;
  reducedMotion?: boolean;
  highContrast?: boolean;
};

const LS_SETTINGS = "eventura_os_settings_v3";

const SETTINGS_DEFAULTS: AppSettings = {
  ceoEmail: "hardikvekariya799@gmail.com",
  staffEmail: "eventurastaff@gmail.com",
  theme: "Royal Gold",
  sidebarMode: "Icons + Text",
  compactTables: false,
  confirmDeletes: true,
  reducedMotion: false,
  highContrast: false,
};

/* ================= KEYS (auto-detect) ================= */
const EVENT_KEYS = ["eventura-events", "eventura_os_events_v1", "eventura_events_v1"];
const FIN_KEYS = ["eventura-finance-transactions", "eventura_os_fin_v1", "eventura_fin_v1", "eventura_os_fin_tx_v1"];
const HR_KEYS = ["eventura-hr-team", "eventura_os_hr_v1", "eventura_hr_v1", "eventura-hr", "eventura_os_hr_team_v2"];
const VENDOR_KEYS = ["eventura-vendors", "eventura_os_vendors_v1", "eventura_vendors_v1", "eventura-vendor-list"];
const AI_KEYS = ["eventura_os_ai_docs_v1", "eventura-ai-docs", "eventura_ai_docs_v1"];

function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadFirstKey<T>(keys: string[], fallback: T): { keyUsed: string | null; data: T } {
  if (typeof window === "undefined") return { keyUsed: null, data: fallback };
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      return { keyUsed: k, data: JSON.parse(raw) as T };
    } catch {
      // keep trying
    }
  }
  return { keyUsed: null, data: fallback };
}

function roleFromEmail(email: string, s: AppSettings) {
  if (!email) return "Staff";
  return email.toLowerCase() === s.ceoEmail.toLowerCase() ? "CEO" : "Staff";
}

function ThemeTokens(theme: Theme, highContrast?: boolean) {
  const hc = !!highContrast;
  const base = {
    text: "#F9FAFB",
    muted: "#9CA3AF",
    bg: "#050816",
    panel: "rgba(11,16,32,0.60)",
    panel2: "rgba(11,16,32,0.85)",
    border: hc ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)",
    soft: hc ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
    accentBg: "rgba(212,175,55,0.12)",
    accentBd: hc ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)",
    accentTx: "#FDE68A",
    dangerBg: "rgba(248,113,113,0.10)",
    dangerBd: hc ? "rgba(248,113,113,0.55)" : "rgba(248,113,113,0.30)",
    dangerTx: "#FCA5A5",
    glow1: "rgba(255,215,110,0.18)",
    glow2: "rgba(120,70,255,0.18)",
  };

  switch (theme) {
    case "Midnight Purple":
      return { ...base, glow1: "rgba(139,92,246,0.22)", glow2: "rgba(212,175,55,0.14)", accentBg: "rgba(139,92,246,0.16)", accentBd: hc ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.30)", accentTx: "#DDD6FE" };
    case "Emerald Night":
      return { ...base, glow1: "rgba(16,185,129,0.18)", glow2: "rgba(212,175,55,0.12)", accentBg: "rgba(16,185,129,0.16)", accentBd: hc ? "rgba(16,185,129,0.55)" : "rgba(16,185,129,0.30)", accentTx: "#A7F3D0" };
    case "Ocean Blue":
      return { ...base, glow1: "rgba(59,130,246,0.22)", glow2: "rgba(34,211,238,0.14)", accentBg: "rgba(59,130,246,0.16)", accentBd: hc ? "rgba(59,130,246,0.55)" : "rgba(59,130,246,0.30)", accentTx: "#BFDBFE" };
    case "Ruby Noir":
      return { ...base, glow1: "rgba(244,63,94,0.18)", glow2: "rgba(212,175,55,0.10)", accentBg: "rgba(244,63,94,0.14)", accentBd: hc ? "rgba(244,63,94,0.50)" : "rgba(244,63,94,0.26)", accentTx: "#FDA4AF" };
    case "Carbon Black":
      return { ...base, bg: "#03040A", glow1: "rgba(255,255,255,0.10)", glow2: "rgba(212,175,55,0.10)" };
    case "Ivory Light":
      return {
        ...base,
        text: "#111827",
        muted: "#4B5563",
        bg: "#F9FAFB",
        panel: "rgba(255,255,255,0.78)",
        panel2: "rgba(255,255,255,0.92)",
        border: hc ? "rgba(17,24,39,0.22)" : "rgba(17,24,39,0.12)",
        soft: hc ? "rgba(17,24,39,0.07)" : "rgba(17,24,39,0.04)",
        accentTx: "#92400E",
      };
    default:
      return base;
  }
}

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
    h1: { fontSize: 26, fontWeight: 950 },
    muted: { color: T.muted, fontSize: 13, marginTop: 6 },
    smallMuted: { color: T.muted, fontSize: 12 },

    panel: {
      marginTop: 12,
      padding: 14,
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel,
      backdropFilter: "blur(10px)",
    },
    panelTitle: { fontWeight: 950, color: T.accentTx },
    grid: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    kpiRow: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 },
    kpi: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    kpiLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiValue: { marginTop: 6, fontSize: 18, fontWeight: 950 },
    pill: {
      padding: "5px 10px",
      borderRadius: 999,
      border: `1px solid ${T.accentBd}`,
      background: T.accentBg,
      color: T.accentTx,
      fontWeight: 950,
      fontSize: 12,
      whiteSpace: "nowrap",
    },
    rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  };
}

function KPI({ label, value, S }: { label: string; value: any; S: Record<string, CSSProperties> }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
    </div>
  );
}

export default function ReportsPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings>(SETTINGS_DEFAULTS);
  const [email, setEmail] = useState<string>("");

  const [keysInfo, setKeysInfo] = useState<{
    events: string | null;
    fin: string | null;
    hr: string | null;
    vendors: string | null;
    ai: string | null;
  }>({ events: null, fin: null, hr: null, vendors: null, ai: null });

  const [counts, setCounts] = useState<{ events: number; fin: number; hr: number; vendors: number; ai: number }>({
    events: 0,
    fin: 0,
    hr: 0,
    vendors: 0,
    ai: 0,
  });

  useEffect(() => {
    // settings
    const s = safeLoad<AppSettings>(LS_SETTINGS, SETTINGS_DEFAULTS);
    setSettings({ ...SETTINGS_DEFAULTS, ...s });

    // email fallback (no supabase dependency here)
    setEmail(safeLoad<string>("eventura_email", ""));

    // keys
    const e = loadFirstKey<any[]>(EVENT_KEYS, []);
    const f = loadFirstKey<any[]>(FIN_KEYS, []);
    const h = loadFirstKey<any[]>(HR_KEYS, []);
    const v = loadFirstKey<any[]>(VENDOR_KEYS, []);
    const a = loadFirstKey<any[]>(AI_KEYS, []);

    setKeysInfo({ events: e.keyUsed, fin: f.keyUsed, hr: h.keyUsed, vendors: v.keyUsed, ai: a.keyUsed });
    setCounts({
      events: Array.isArray(e.data) ? e.data.length : 0,
      fin: Array.isArray(f.data) ? f.data.length : 0,
      hr: Array.isArray(h.data) ? h.data.length : 0,
      vendors: Array.isArray(v.data) ? v.data.length : 0,
      ai: Array.isArray(a.data) ? a.data.length : 0,
    });
  }, []);

  const role = useMemo(() => roleFromEmail(email, settings), [email, settings]);
  const sidebarIconsOnly = settings.sidebarMode === "Icons Only";

  const T = ThemeTokens(settings.theme, settings.highContrast);
  const S = makeStyles(T);

  function signOut() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("eventura_email");
      document.cookie = `eventura_email=; Path=/; Max-Age=0`;
    }
    router.push("/login");
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

        <div style={{ marginTop: "auto" }}>
          <button
            onClick={signOut}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 14,
              border: `1px solid ${T.dangerBd}`,
              background: T.dangerBg,
              color: T.dangerTx,
              fontWeight: 950,
              cursor: "pointer",
            }}
          >
            {sidebarIconsOnly ? "⎋" : "Sign Out"}
          </button>
        </div>
      </aside>

      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={S.h1}>Reports</div>
            <div style={S.muted}>
              Company snapshot (safe build) • Logged in as <b>{email || "Unknown"}</b> • Role: <span style={S.pill}>{role}</span>
            </div>
            <div style={{ marginTop: 8, ...S.smallMuted }}>
              Keys → Events: <b>{keysInfo.events ?? "not found"}</b> • Finance: <b>{keysInfo.fin ?? "not found"}</b> • HR:{" "}
              <b>{keysInfo.hr ?? "not found"}</b> • Vendors: <b>{keysInfo.vendors ?? "not found"}</b> • AI: <b>{keysInfo.ai ?? "not found"}</b>
            </div>
          </div>
        </div>

        <div style={S.panel}>
          <div style={S.panelTitle}>Counts</div>
          <div style={S.kpiRow}>
            <KPI label="Events" value={counts.events} S={S} />
            <KPI label="Finance Tx" value={counts.fin} S={S} />
            <KPI label="Team" value={counts.hr} S={S} />
            <KPI label="Vendors" value={counts.vendors} S={S} />
          </div>
          <div style={{ marginTop: 10, ...S.smallMuted }}>
            Once this deploys successfully, we will add back Builder + Exports + Auto Insights **step-by-step** without breaking deployment.
          </div>
        </div>
      </main>
    </div>
  );
}
