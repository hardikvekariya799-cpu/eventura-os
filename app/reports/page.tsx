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

/* ================= STORAGE KEYS =================
   We DO NOT change other pages.
   Reports will TRY multiple keys and pick the first that exists.
*/
const LS_SETTINGS = "eventura_os_settings_v3";

// common keys you used earlier in other pages/snippets
const EVENT_KEYS = ["eventura-events", "eventura_os_events_v1", "eventura_events_v1"];
const FIN_KEYS = ["eventura-finance-transactions", "eventura_os_fin_v1", "eventura_fin_v1"];
const HR_KEYS = ["eventura-hr-team", "eventura_os_hr_v1", "eventura_hr_v1", "eventura-hr"];
const VENDOR_KEYS = ["eventura-vendors", "eventura_os_vendors_v1", "eventura_vendors_v1", "eventura-vendor-list"];

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

/* ================= SETTINGS TYPES ================= */
type Role = "CEO" | "Staff";
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
  reducedMotion?: boolean;
  highContrast?: boolean;
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
};

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

function loadFirstKey<T>(keys: string[], fallback: T): { keyUsed: string | null; data: T } {
  if (typeof window === "undefined") return { keyUsed: null, data: fallback };
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as T;
      return { keyUsed: k, data: parsed };
    } catch {
      // ignore and keep trying
    }
  }
  return { keyUsed: null, data: fallback };
}

function roleFromSettings(email: string, s: AppSettings): Role {
  if (!email) return "Staff";
  return email.toLowerCase() === s.ceoEmail.toLowerCase() ? "CEO" : "Staff";
}

function toYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateSafe(s: any): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatCurrency(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/* ================= NORMALIZERS (flexible) ================= */
type EventStatus = string;
type NormalEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  status: EventStatus;
  city?: string;
  budget?: number;
};

type NormalTx = {
  id: string;
  date: string; // YYYY-MM-DD
  type: "Income" | "Expense";
  amount: number;
  category?: string;
  vendor?: string;
  note?: string;
};

type NormalStaff = {
  id: string;
  name: string;
  role?: string;
  city?: string;
  status?: string;
  workload?: number;
  monthlySalary?: number;
  eventsThisMonth?: number;
  rating?: number;
};

type NormalVendor = {
  id: string;
  name: string;
  category?: string;
  city?: string;
  phone?: string;
  rating?: number;
  status?: string;
  priceNote?: string;
};

function normalizeEvents(raw: any): NormalEvent[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? "");
      const date = String(x?.date ?? x?.eventDate ?? "");
      const title = String(x?.title ?? x?.name ?? x?.eventName ?? "Untitled");
      const status = String(x?.status ?? x?.stage ?? "Unknown");
      const city = x?.city ? String(x.city) : undefined;
      const budget = Number.isFinite(Number(x?.budget)) ? Number(x.budget) : undefined;
      return { id: id || `${title}-${date}`, date, title, status, city, budget };
    })
    .filter((e) => e.date && e.title);
}

function normalizeFinance(raw: any): NormalTx[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? "");
      const date = String(x?.date ?? x?.txDate ?? "");
      const type = x?.type === "Income" ? "Income" : "Expense";
      const amount = Number(x?.amount ?? x?.value ?? 0);
      const category = x?.category ? String(x.category) : undefined;
      const vendor = x?.vendor ? String(x.vendor) : undefined;
      const note = x?.note ? String(x.note) : undefined;
      return { id: id || `${date}-${type}-${amount}`, date, type, amount: Number.isFinite(amount) ? amount : 0, category, vendor, note };
    })
    .filter((t) => t.date && t.amount > 0);
}

function normalizeHR(raw: any): NormalStaff[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? "");
      const name = String(x?.name ?? x?.fullName ?? "Unknown");
      return {
        id: id || name,
        name,
        role: x?.role ? String(x.role) : undefined,
        city: x?.city ? String(x.city) : undefined,
        status: x?.status ? String(x.status) : undefined,
        workload: Number.isFinite(Number(x?.workload)) ? Number(x.workload) : undefined,
        monthlySalary: Number.isFinite(Number(x?.monthlySalary)) ? Number(x.monthlySalary) : undefined,
        eventsThisMonth: Number.isFinite(Number(x?.eventsThisMonth)) ? Number(x.eventsThisMonth) : undefined,
        rating: Number.isFinite(Number(x?.rating)) ? Number(x.rating) : undefined,
      };
    })
    .filter((m) => m.name);
}

function normalizeVendors(raw: any): NormalVendor[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? "");
      const name = String(x?.name ?? x?.vendorName ?? "Vendor");
      return {
        id: id || name,
        name,
        category: x?.category ? String(x.category) : undefined,
        city: x?.city ? String(x.city) : undefined,
        phone: x?.phone ? String(x.phone) : undefined,
        rating: Number.isFinite(Number(x?.rating)) ? Number(x.rating) : undefined,
        status: x?.status ? String(x.status) : undefined,
        priceNote: x?.priceNote ? String(x.priceNote) : undefined,
      };
    })
    .filter((v) => v.name);
}

/* ================= KPI CALCS ================= */
function inRange(dateStr: string, from: string, to: string) {
  if (!dateStr) return false;
  return dateStr >= from && dateStr <= to; // works for YYYY-MM-DD
}

function sumFinance(txs: NormalTx[]) {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === "Income") income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

function statusCount(events: NormalEvent[]) {
  const m = new Map<string, number>();
  for (const e of events) {
    const k = (e.status || "Unknown").trim();
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

function topCategories(txs: NormalTx[], type: "Income" | "Expense", n = 5) {
  const m = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== type) continue;
    const k = (t.category || "Other").trim() || "Other";
    m.set(k, (m.get(k) ?? 0) + t.amount);
  }
  return Array.from(m.entries())
    .map(([k, v]) => ({ category: k, amount: v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
}

function exportCSV(filename: string, rows: Record<string, any>[]) {
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================= THEME TOKENS (safe) ================= */
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
    inputBg: hc ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
    dangerBg: "rgba(248,113,113,0.10)",
    dangerBd: hc ? "rgba(248,113,113,0.55)" : "rgba(248,113,113,0.30)",
    dangerTx: "#FCA5A5",
    okBg: "rgba(34,197,94,0.12)",
    okBd: hc ? "rgba(34,197,94,0.45)" : "rgba(34,197,94,0.28)",
    okTx: "#86EFAC",
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
      return { ...base, bg: "#03040A", glow1: "rgba(255,255,255,0.10)", glow2: "rgba(212,175,55,0.10)", accentBg: "rgba(212,175,55,0.14)", accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)", accentTx: "#FDE68A" };
    case "Ivory Light":
      return { ...base, text: "#111827", muted: "#4B5563", bg: "#F9FAFB", panel: "rgba(255,255,255,0.78)", panel2: "rgba(255,255,255,0.92)", border: hc ? "rgba(17,24,39,0.22)" : "rgba(17,24,39,0.12)", soft: hc ? "rgba(17,24,39,0.07)" : "rgba(17,24,39,0.04)", inputBg: hc ? "rgba(17,24,39,0.08)" : "rgba(17,24,39,0.04)", dangerTx: "#B91C1C", glow1: "rgba(212,175,55,0.16)", glow2: "rgba(59,130,246,0.14)", accentBg: "rgba(212,175,55,0.16)", accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)", accentTx: "#92400E", okTx: "#166534" };
    case "Royal Gold":
    default:
      return { ...base, glow1: "rgba(255,215,110,0.18)", glow2: "rgba(120,70,255,0.18)", accentBg: "rgba(212,175,55,0.12)", accentBd: hc ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)", accentTx: "#FDE68A" };
  }
}

/* ================= PAGE ================= */
export default function ReportsPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings>(SETTINGS_DEFAULTS);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  // report range (default last 30 days)
  const today = toYMD(new Date());
  const [from, setFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toYMD(d);
  });
  const [to, setTo] = useState<string>(today);

  // loaded raw keys info
  const [keysInfo, setKeysInfo] = useState<{ events: string | null; fin: string | null; hr: string | null; vendors: string | null }>({
    events: null,
    fin: null,
    hr: null,
    vendors: null,
  });

  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [rawFin, setRawFin] = useState<any[]>([]);
  const [rawHR, setRawHR] = useState<any[]>([]);
  const [rawVendors, setRawVendors] = useState<any[]>([]);

  // load settings + all modules
  useEffect(() => {
    const s = safeLoad<AppSettings>(LS_SETTINGS, SETTINGS_DEFAULTS);
    setSettings({ ...SETTINGS_DEFAULTS, ...s });

    const e = loadFirstKey<any[]>(EVENT_KEYS, []);
    const f = loadFirstKey<any[]>(FIN_KEYS, []);
    const h = loadFirstKey<any[]>(HR_KEYS, []);
    const v = loadFirstKey<any[]>(VENDOR_KEYS, []);

    setKeysInfo({ events: e.keyUsed, fin: f.keyUsed, hr: h.keyUsed, vendors: v.keyUsed });
    setRawEvents(Array.isArray(e.data) ? e.data : []);
    setRawFin(Array.isArray(f.data) ? f.data : []);
    setRawHR(Array.isArray(h.data) ? h.data : []);
    setRawVendors(Array.isArray(v.data) ? v.data : []);
  }, []);

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
  const S = makeStyles(T, settings);

  // normalize
  const events = useMemo(() => normalizeEvents(rawEvents), [rawEvents]);
  const txs = useMemo(() => normalizeFinance(rawFin), [rawFin]);
  const team = useMemo(() => normalizeHR(rawHR), [rawHR]);
  const vendors = useMemo(() => normalizeVendors(rawVendors), [rawVendors]);

  // filtered by range
  const eventsInRange = useMemo(() => events.filter((e) => inRange(e.date, from, to)), [events, from, to]);
  const txsInRange = useMemo(() => txs.filter((t) => inRange(t.date, from, to)), [txs, from, to]);

  // KPIs
  const finTotals = useMemo(() => sumFinance(txsInRange), [txsInRange]);
  const eventStatus = useMemo(() => statusCount(eventsInRange), [eventsInRange]);
  const topExp = useMemo(() => topCategories(txsInRange, "Expense", 5), [txsInRange]);
  const topInc = useMemo(() => topCategories(txsInRange, "Income", 5), [txsInRange]);

  // HR KPIs
  const hrKpis = useMemo(() => {
    const total = team.length;
    const avgWorkload =
      total ? Math.round((team.reduce((a, b) => a + (Number.isFinite(b.workload as any) ? (b.workload as number) : 0), 0) / total) * 10) / 10 : 0;

    const active = team.filter((m) => String(m.status || "").toLowerCase() !== "inactive").length;
    const freelancers = team.filter((m) => String(m.status || "").toLowerCase().includes("freel")).length;

    const payroll = team.reduce((a, b) => a + (Number.isFinite(b.monthlySalary as any) ? (b.monthlySalary as number) : 0), 0);

    return { total, active, freelancers, avgWorkload, payroll };
  }, [team]);

  // Vendor KPIs
  const vendorKpis = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter((v) => String(v.status || "").toLowerCase() !== "inactive").length;
    const topRated = vendors
      .filter((v) => Number.isFinite(v.rating as any))
      .slice()
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 5);
    return { total, active, topRated };
  }, [vendors]);

  // Executive summary (auto)
  const execSummary = useMemo(() => {
    const lines: string[] = [];

    lines.push(`Report Range: ${from} → ${to}`);
    lines.push(`Events in range: ${eventsInRange.length}`);
    if (eventStatus.length) lines.push(`Top event status: ${eventStatus[0][0]} (${eventStatus[0][1]})`);

    lines.push(`Finance Net: ${formatCurrency(finTotals.net)} (Income ${formatCurrency(finTotals.income)} • Expense ${formatCurrency(finTotals.expense)})`);

    if (topExp.length) lines.push(`Biggest expense category: ${topExp[0].category} (${formatCurrency(topExp[0].amount)})`);
    if (topInc.length) lines.push(`Top income category: ${topInc[0].category} (${formatCurrency(topInc[0].amount)})`);

    lines.push(`Team: ${hrKpis.total} total • ${hrKpis.active} active • Avg workload ${hrKpis.avgWorkload}%`);
    if (hrKpis.payroll > 0) lines.push(`Estimated monthly payroll: ${formatCurrency(hrKpis.payroll)}`);

    lines.push(`Vendors: ${vendorKpis.total} total • ${vendorKpis.active} active`);

    // simple alerts
    const highWorkload = team.filter((m) => (m.workload ?? 0) >= 80).length;
    if (highWorkload) lines.push(`⚠ High workload staff (>=80%): ${highWorkload}`);

    const negativeNet = finTotals.net < 0;
    if (negativeNet) lines.push(`⚠ Net is negative in this range. Focus on expense control + collections.`);

    const noData = !events.length && !txs.length && !team.length && !vendors.length;
    if (noData) lines.push(`No module data found. (Reports reads localStorage; ensure modules saved at least one entry.)`);

    return lines;
  }, [from, to, eventsInRange.length, eventStatus, finTotals, topExp, topInc, hrKpis, vendorKpis, team, events.length, txs.length]);

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

  function exportAllJSON() {
    const payload = {
      version: "eventura-reports-export-v1",
      exportedAt: new Date().toISOString(),
      range: { from, to },
      keysUsed: keysInfo,
      data: {
        events: eventsInRange,
        finance: txsInRange,
        hr: team,
        vendors,
      },
      summary: execSummary,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eventura_report_${from}_to_${to}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function refreshRead() {
    const e = loadFirstKey<any[]>(EVENT_KEYS, []);
    const f = loadFirstKey<any[]>(FIN_KEYS, []);
    const h = loadFirstKey<any[]>(HR_KEYS, []);
    const v = loadFirstKey<any[]>(VENDOR_KEYS, []);
    setKeysInfo({ events: e.keyUsed, fin: f.keyUsed, hr: h.keyUsed, vendors: v.keyUsed });
    setRawEvents(Array.isArray(e.data) ? e.data : []);
    setRawFin(Array.isArray(f.data) ? f.data : []);
    setRawHR(Array.isArray(h.data) ? h.data : []);
    setRawVendors(Array.isArray(v.data) ? v.data : []);
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
            <div style={S.h1}>Reports</div>
            <div style={S.muted}>
              Company overview • Logged in as <b>{email || "Unknown"}</b> • Role: <span style={S.rolePill}>{role}</span>
            </div>
            <div style={{ marginTop: 8, ...S.smallMuted }}>
              Reading keys → Events: <b>{keysInfo.events ?? "not found"}</b> • Finance: <b>{keysInfo.fin ?? "not found"}</b> • HR:{" "}
              <b>{keysInfo.hr ?? "not found"}</b> • Vendors: <b>{keysInfo.vendors ?? "not found"}</b>
            </div>
          </div>

          <div style={S.headerRight}>
            <button style={S.secondaryBtn} onClick={refreshRead}>
              Refresh
            </button>
            <button style={S.secondaryBtn} onClick={exportAllJSON}>
              Export Report (JSON)
            </button>
            {isCEO ? (
              <>
                <button style={S.secondaryBtn} onClick={() => exportCSV(`eventura_events_${from}_to_${to}.csv`, eventsInRange)}>
                  Export Events CSV
                </button>
                <button style={S.secondaryBtn} onClick={() => exportCSV(`eventura_finance_${from}_to_${to}.csv`, txsInRange)}>
                  Export Finance CSV
                </button>
              </>
            ) : null}
          </div>
        </div>

        {loading ? <div style={S.loadingBar}>Loading session…</div> : null}

        <div style={S.rangeBar}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={S.smallMuted}>From</div>
              <input style={S.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={S.smallMuted}>To</div>
              <input style={S.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div style={S.smallNote}>Tip: Reports uses date fields (YYYY-MM-DD). Make sure each module stores valid dates.</div>
        </div>

        <div style={S.grid}>
          {/* Executive Summary */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Executive Summary (Auto)</div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {execSummary.map((line, i) => (
                <div key={i} style={S.summaryLine}>
                  {line}
                </div>
              ))}
            </div>
          </section>

          {/* Overall KPIs */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Company KPIs</div>
            <div style={S.kpiRow}>
              <KPI label="Events" value={String(eventsInRange.length)} S={S} />
              <KPI label="Net" value={formatCurrency(finTotals.net)} S={S} />
              <KPI label="Team" value={String(hrKpis.total)} S={S} />
              <KPI label="Vendors" value={String(vendorKpis.total)} S={S} />
            </div>
            <div style={S.smallNote}>(KPIs are for selected date range, HR/Vendors are overall because many HR/Vendor records may not have dates.)</div>
          </section>

          {/* Events */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Events Report</div>
            {eventsInRange.length ? (
              <>
                <div style={S.sectionTitle}>Status breakdown</div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {eventStatus.slice(0, 6).map(([st, c]) => (
                    <BarRow key={st} label={st} value={c} max={eventStatus[0]?.[1] ?? c} S={S} />
                  ))}
                </div>

                <div style={S.sectionTitle}>Recent events</div>
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {eventsInRange
                    .slice()
                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                    .slice(0, 8)
                    .map((e) => (
                      <div key={e.id} style={S.itemCard}>
                        <div style={S.rowBetween}>
                          <div style={{ fontWeight: 950 }}>{e.title}</div>
                          <span style={S.pill}>{e.status}</span>
                        </div>
                        <div style={S.smallMuted}>
                          {e.date} • {e.city || "—"} {typeof e.budget === "number" ? `• Budget ${formatCurrency(e.budget)}` : ""}
                        </div>
                      </div>
                    ))}
                </div>
              </>
            ) : (
              <div style={S.muted}>No events found in this range.</div>
            )}
          </section>

          {/* Finance */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Finance Report</div>
            <div style={S.kpiRow}>
              <KPI label="Income" value={formatCurrency(finTotals.income)} S={S} />
              <KPI label="Expense" value={formatCurrency(finTotals.expense)} S={S} />
              <KPI label="Net" value={formatCurrency(finTotals.net)} S={S} />
              <KPI label="Tx Count" value={String(txsInRange.length)} S={S} />
            </div>

            <div style={S.sectionTitle}>Top Expenses</div>
            {topExp.length ? (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {topExp.map((x) => (
                  <div key={x.category} style={S.rowBetween}>
                    <div style={{ fontWeight: 950 }}>{x.category}</div>
                    <div style={S.muted}>{formatCurrency(x.amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={S.muted}>No expense data in this range.</div>
            )}

            <div style={S.sectionTitle}>Top Income</div>
            {topInc.length ? (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {topInc.map((x) => (
                  <div key={x.category} style={S.rowBetween}>
                    <div style={{ fontWeight: 950 }}>{x.category}</div>
                    <div style={S.muted}>{formatCurrency(x.amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={S.muted}>No income data in this range.</div>
            )}
          </section>

          {/* HR */}
          <section style={S.panel}>
            <div style={S.panelTitle}>HR Report</div>
            <div style={S.kpiRow}>
              <KPI label="Total Staff" value={String(hrKpis.total)} S={S} />
              <KPI label="Active" value={String(hrKpis.active)} S={S} />
              <KPI label="Freelancers" value={String(hrKpis.freelancers)} S={S} />
              <KPI label="Avg Workload" value={`${hrKpis.avgWorkload}%`} S={S} />
            </div>

            {hrKpis.payroll > 0 ? <div style={S.noteBox}>Estimated Monthly Payroll: {formatCurrency(hrKpis.payroll)}</div> : null}

            <div style={S.sectionTitle}>High workload (>=80%)</div>
            {team.filter((m) => (m.workload ?? 0) >= 80).length ? (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {team
                  .filter((m) => (m.workload ?? 0) >= 80)
                  .slice(0, 8)
                  .map((m) => (
                    <div key={m.id} style={S.itemCard}>
                      <div style={S.rowBetween}>
                        <div style={{ fontWeight: 950 }}>{m.name}</div>
                        <span style={S.pill}>{m.workload}%</span>
                      </div>
                      <div style={S.smallMuted}>
                        {m.role || "—"} • {m.city || "—"} • {m.status || "—"}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div style={S.muted}>No one above 80% workload.</div>
            )}

            {isCEO ? (
              <div style={S.rowBetween}>
                <div style={S.smallNote}>Export HR list as CSV</div>
                <button style={S.secondaryBtn} onClick={() => exportCSV(`eventura_hr_${today}.csv`, team)}>
                  Export HR CSV
                </button>
              </div>
            ) : null}
          </section>

          {/* Vendors */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Vendors Report</div>
            <div style={S.kpiRow}>
              <KPI label="Total" value={String(vendorKpis.total)} S={S} />
              <KPI label="Active" value={String(vendorKpis.active)} S={S} />
              <KPI label="Top Rated" value={String(vendorKpis.topRated.length)} S={S} />
              <KPI label="Cities" value={String(new Set(vendors.map((v) => v.city || "—")).size)} S={S} />
            </div>

            <div style={S.sectionTitle}>Top rated vendors</div>
            {vendorKpis.topRated.length ? (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {vendorKpis.topRated.map((v) => (
                  <div key={v.id} style={S.itemCard}>
                    <div style={S.rowBetween}>
                      <div style={{ fontWeight: 950 }}>{v.name}</div>
                      <span style={S.pill}>{typeof v.rating === "number" ? `⭐ ${v.rating}` : "—"}</span>
                    </div>
                    <div style={S.smallMuted}>
                      {v.category || "—"} • {v.city || "—"} • {v.phone || "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={S.muted}>No ratings yet.</div>
            )}

            {isCEO ? (
              <div style={S.rowBetween}>
                <div style={S.smallNote}>Export vendor list as CSV</div>
                <button style={S.secondaryBtn} onClick={() => exportCSV(`eventura_vendors_${today}.csv`, vendors)}>
                  Export Vendors CSV
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}

/* ================= UI ================= */
function KPI({ label, value, S }: { label: string; value: string; S: Record<string, CSSProperties> }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
    </div>
  );
}

function BarRow({ label, value, max, S }: { label: string; value: number; max: number; S: Record<string, CSSProperties> }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div style={S.barRow}>
      <div style={{ fontWeight: 950 }}>{label}</div>
      <div style={S.barWrap}>
        <div style={{ ...S.barFill, width: `${pct}%` }} />
      </div>
      <div style={S.smallMuted}>{value}</div>
    </div>
  );
}

/* ================= STYLES ================= */
function makeStyles(T: any, settings: AppSettings): Record<string, CSSProperties> {
  const compact = !!settings.compactTables;

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
    smallMuted: { color: T.muted, fontSize: 12 },

    rolePill: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontWeight: 950,
      background: T.accentBg,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
      marginLeft: 6,
    },

    rangeBar: {
      marginTop: 12,
      padding: 12,
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.soft,
      display: "grid",
      gap: 10,
    },

    input: {
      width: 210,
      padding: compact ? "10px 10px" : "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
    },

    secondaryBtn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
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

    kpiRow: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 },
    kpi: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    kpiLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiValue: { marginTop: 6, fontSize: 18, fontWeight: 950 },

    sectionTitle: { marginTop: 14, fontWeight: 950, fontSize: 13 },

    itemCard: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },

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

    noteBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.okBd}`,
      background: T.okBg,
      color: T.okTx,
      fontSize: 13,
      lineHeight: 1.35,
    },

    summaryLine: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      fontWeight: 900,
      color: T.text,
    },

    barRow: { display: "grid", gridTemplateColumns: "1fr 2fr 50px", gap: 10, alignItems: "center" },
    barWrap: { height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" },
    barFill: { height: "100%", borderRadius: 999, background: T.accentTx, opacity: 0.9 },

    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35 },

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
