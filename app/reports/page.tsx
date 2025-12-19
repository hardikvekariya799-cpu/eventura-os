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

/* ================= STORAGE KEYS ================= */
const LS_SETTINGS = "eventura_os_settings_v3";
const LS_REPORT_TEMPLATES = "eventura_os_reports_templates_v1";

// Try multiple keys so we do NOT break other pages
const EVENT_KEYS = ["eventura-events", "eventura_os_events_v1", "eventura_events_v1"];
const FIN_KEYS = ["eventura-finance-transactions", "eventura_os_fin_v1", "eventura_fin_v1", "eventura_os_fin_tx_v1"];
const HR_KEYS = ["eventura-hr-team", "eventura_os_hr_v1", "eventura_hr_v1", "eventura-hr", "eventura_os_hr_team_v2"];
const VENDOR_KEYS = ["eventura-vendors", "eventura_os_vendors_v1", "eventura_vendors_v1", "eventura-vendor-list"];
const AI_KEYS = ["eventura_os_ai_docs_v1", "eventura-ai-docs", "eventura_ai_docs_v1"];

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

/* ================= REPORT BUILDER TYPES ================= */
type Module = "Events" | "Finance" | "HR" | "Vendors" | "AI";
type ReportTemplate = {
  id: string;
  name: string;
  module: Module;
  dateFrom: string;
  dateTo: string;
  status: string; // Events only
  city: string; // optional
  createdAt: string;
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

function safeSave<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
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

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function toYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoMinusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toYMD(d);
}

function inRange(dateStr: string | undefined, from: string, to: string) {
  if (!dateStr) return false;
  return dateStr >= from && dateStr <= to; // YYYY-MM-DD safe compare
}

function roleFromSettings(email: string, s: AppSettings): Role {
  if (!email) return "Staff";
  return email.toLowerCase() === s.ceoEmail.toLowerCase() ? "CEO" : "Staff";
}

function inr(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));
  } catch {
    return String(Math.round(n));
  }
}

function formatCurrency(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
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

function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================= NORMALIZED DATA ================= */
type NormalEvent = {
  id: string;
  date: string;
  title: string;
  status: string;
  city?: string;
  budget?: number;
};

type NormalTx = {
  id: string;
  date: string;
  type: "Income" | "Expense";
  amount: number;
  category?: string;
  vendor?: string;
  note?: string;
  city?: string; // optional if you store it
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

type AIDoc = {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  output?: string;
  inputs?: Record<string, any>;
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
      const type = String(x?.type ?? "").toLowerCase() === "income" ? "Income" : "Expense";
      const amount = Number(x?.amount ?? x?.value ?? 0);
      const category = x?.category ? String(x.category) : undefined;
      const vendor = x?.vendor ? String(x.vendor) : undefined;
      const note = x?.note ? String(x.note) : undefined;
      const city = x?.city ? String(x.city) : undefined;
      return {
        id: id || `${date}-${type}-${amount}`,
        date,
        type,
        amount: Number.isFinite(amount) ? amount : 0,
        category,
        vendor,
        note,
        city,
      };
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

/* ================= THEME TOKENS ================= */
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
      return {
        ...base,
        glow1: "rgba(139,92,246,0.22)",
        glow2: "rgba(212,175,55,0.14)",
        accentBg: "rgba(139,92,246,0.16)",
        accentBd: hc ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.30)",
        accentTx: "#DDD6FE",
      };
    case "Emerald Night":
      return {
        ...base,
        glow1: "rgba(16,185,129,0.18)",
        glow2: "rgba(212,175,55,0.12)",
        accentBg: "rgba(16,185,129,0.16)",
        accentBd: hc ? "rgba(16,185,129,0.55)" : "rgba(16,185,129,0.30)",
        accentTx: "#A7F3D0",
      };
    case "Ocean Blue":
      return {
        ...base,
        glow1: "rgba(59,130,246,0.22)",
        glow2: "rgba(34,211,238,0.14)",
        accentBg: "rgba(59,130,246,0.16)",
        accentBd: hc ? "rgba(59,130,246,0.55)" : "rgba(59,130,246,0.30)",
        accentTx: "#BFDBFE",
      };
    case "Ruby Noir":
      return {
        ...base,
        glow1: "rgba(244,63,94,0.18)",
        glow2: "rgba(212,175,55,0.10)",
        accentBg: "rgba(244,63,94,0.14)",
        accentBd: hc ? "rgba(244,63,94,0.50)" : "rgba(244,63,94,0.26)",
        accentTx: "#FDA4AF",
      };
    case "Carbon Black":
      return {
        ...base,
        bg: "#03040A",
        glow1: "rgba(255,255,255,0.10)",
        glow2: "rgba(212,175,55,0.10)",
        accentBg: "rgba(212,175,55,0.14)",
        accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)",
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
        border: hc ? "rgba(17,24,39,0.22)" : "rgba(17,24,39,0.12)",
        soft: hc ? "rgba(17,24,39,0.07)" : "rgba(17,24,39,0.04)",
        inputBg: hc ? "rgba(17,24,39,0.08)" : "rgba(17,24,39,0.04)",
        dangerTx: "#B91C1C",
        glow1: "rgba(212,175,55,0.16)",
        glow2: "rgba(59,130,246,0.14)",
        accentBg: "rgba(212,175,55,0.16)",
        accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)",
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
        accentBd: hc ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)",
        accentTx: "#FDE68A",
      };
  }
}

/* ================= UI PARTS ================= */
function KPIBox({ label, value, S }: { label: string; value: any; S: Record<string, CSSProperties> }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
    </div>
  );
}

function Field({ label, children, S }: { label: string; children: React.ReactNode; S: Record<string, CSSProperties> }) {
  return (
    <div style={S.field}>
      <div style={S.label}>{label}</div>
      {children}
    </div>
  );
}

/* ================= PAGE ================= */
export default function ReportsPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings>(SETTINGS_DEFAULTS);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"Company" | "Builder">("Company");

  // Company range
  const today = toYMD(new Date());
  const [from, setFrom] = useState<string>(() => isoMinusDays(30));
  const [to, setTo] = useState<string>(today);

  // Builder filters
  const [module, setModule] = useState<Module>("Events");
  const [dateFrom, setDateFrom] = useState<string>(() => isoMinusDays(30));
  const [dateTo, setDateTo] = useState<string>(today);
  const [status, setStatus] = useState<string>("All");
  const [city, setCity] = useState<string>("All");
  const [msg, setMsg] = useState<string>("");

  // templates
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");

  // Loaded raw keys info
  const [keysInfo, setKeysInfo] = useState<{
    events: string | null;
    fin: string | null;
    hr: string | null;
    vendors: string | null;
    ai: string | null;
  }>({ events: null, fin: null, hr: null, vendors: null, ai: null });

  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [rawFin, setRawFin] = useState<any[]>([]);
  const [rawHR, setRawHR] = useState<any[]>([]);
  const [rawVendors, setRawVendors] = useState<any[]>([]);
  const [rawAI, setRawAI] = useState<any[]>([]);

  // load settings + templates + module data
  useEffect(() => {
    setTemplates(safeLoad<ReportTemplate[]>(LS_REPORT_TEMPLATES, []));
    const s = safeLoad<AppSettings>(LS_SETTINGS, SETTINGS_DEFAULTS);
    setSettings({ ...SETTINGS_DEFAULTS, ...s });

    const e = loadFirstKey<any[]>(EVENT_KEYS, []);
    const f = loadFirstKey<any[]>(FIN_KEYS, []);
    const h = loadFirstKey<any[]>(HR_KEYS, []);
    const v = loadFirstKey<any[]>(VENDOR_KEYS, []);
    const a = loadFirstKey<any[]>(AI_KEYS, []);

    setKeysInfo({ events: e.keyUsed, fin: f.keyUsed, hr: h.keyUsed, vendors: v.keyUsed, ai: a.keyUsed });
    setRawEvents(Array.isArray(e.data) ? e.data : []);
    setRawFin(Array.isArray(f.data) ? f.data : []);
    setRawHR(Array.isArray(h.data) ? h.data : []);
    setRawVendors(Array.isArray(v.data) ? v.data : []);
    setRawAI(Array.isArray(a.data) ? a.data : []);
  }, []);

  useEffect(() => {
    safeSave(LS_REPORT_TEMPLATES, templates);
  }, [templates]);

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

  // normalized
  const events = useMemo(() => normalizeEvents(rawEvents), [rawEvents]);
  const txs = useMemo(() => normalizeFinance(rawFin), [rawFin]);
  const team = useMemo(() => normalizeHR(rawHR), [rawHR]);
  const vendors = useMemo(() => normalizeVendors(rawVendors), [rawVendors]);
  const aiDocs = useMemo(() => (Array.isArray(rawAI) ? (rawAI as AIDoc[]) : []), [rawAI]);

  // city list (builder)
  const cities = useMemo(() => {
    const s = new Set<string>();
    [...events, ...vendors, ...team].forEach((x: any) => {
      if (x?.city) s.add(String(x.city));
    });
    return ["All", ...Array.from(s).sort()];
  }, [events, vendors, team]);

  const eventStatuses = useMemo(() => {
    const s = new Set<string>();
    events.forEach((e) => s.add(String(e.status || "Unknown")));
    return ["All", ...Array.from(s).sort()];
  }, [events]);

  // company filtered
  const eventsInRange = useMemo(() => events.filter((e) => inRange(e.date, from, to)), [events, from, to]);
  const txsInRange = useMemo(() => txs.filter((t) => inRange(t.date, from, to)), [txs, from, to]);

  const finTotals = useMemo(() => sumFinance(txsInRange), [txsInRange]);
  const eventStatusBreak = useMemo(() => statusCount(eventsInRange), [eventsInRange]);

  const hrKpis = useMemo(() => {
    const total = team.length;
    const avgWorkload =
      total ? Math.round((team.reduce((a, b) => a + (Number.isFinite(b.workload as any) ? (b.workload as number) : 0), 0) / total) * 10) / 10 : 0;
    const active = team.filter((m) => String(m.status || "").toLowerCase() !== "inactive").length;
    const payroll = team.reduce((a, b) => a + (Number.isFinite(b.monthlySalary as any) ? (b.monthlySalary as number) : 0), 0);
    return { total, active, avgWorkload, payroll };
  }, [team]);

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

  const execSummary = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Report Range: ${from} → ${to}`);
    lines.push(`Events in range: ${eventsInRange.length}`);
    if (eventStatusBreak.length) lines.push(`Top event status: ${eventStatusBreak[0][0]} (${eventStatusBreak[0][1]})`);
    lines.push(`Finance Net: ${formatCurrency(finTotals.net)} (Income ${formatCurrency(finTotals.income)} • Expense ${formatCurrency(finTotals.expense)})`);
    lines.push(`Team: ${hrKpis.total} total • ${hrKpis.active} active • Avg workload ${hrKpis.avgWorkload}%`);
    if (hrKpis.payroll > 0) lines.push(`Estimated monthly payroll: ${formatCurrency(hrKpis.payroll)}`);
    lines.push(`Vendors: ${vendorKpis.total} total • ${vendorKpis.active} active`);

    const highWorkload = team.filter((m) => (m.workload ?? 0) >= 80).length;
    if (highWorkload) lines.push(`⚠ High workload staff (>=80%): ${highWorkload}`);

    if (finTotals.net < 0) lines.push(`⚠ Net is negative in this range. Control expenses + push collections.`);

    if (!events.length && !txs.length && !team.length && !vendors.length) {
      lines.push(`No module data found. Create at least one item in each module so Reports can read it.`);
    }
    return lines;
  }, [from, to, eventsInRange.length, eventStatusBreak, finTotals, hrKpis, vendorKpis, team, events.length, txs.length, vendors.length]);

  // Report Builder output
  const report = useMemo(() => {
    const cityOk = (item: any) => (city === "All" ? true : String(item?.city || "") === city);

    if (module === "Events") {
      const rows = events
        .filter((e) => inRange(e.date, dateFrom, dateTo))
        .filter((e) => cityOk(e))
        .filter((e) => (status === "All" ? true : String(e.status || "") === status));

      const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
        const k = String(r.status || "Unknown");
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      const totalBudget = rows.reduce((a, b) => a + Number(b.budget || 0), 0);

      return {
        title: "Events Report",
        kpis: [
          { label: "Events", value: rows.length },
          { label: "Total Budget", value: `₹${inr(totalBudget)}` },
          { label: "Cities", value: new Set(rows.map((r) => r.city).filter(Boolean)).size },
          { label: "Statuses", value: Object.keys(byStatus).length },
        ],
        breakdown: Object.entries(byStatus).map(([k, v]) => ({ key: k, value: v })),
        rows: rows.map((r) => ({
          date: r.date,
          title: r.title,
          status: r.status,
          city: r.city ?? "",
          budget: r.budget ?? "",
        })),
      };
    }

    if (module === "Finance") {
      const base = txs
        .filter((t) => inRange(t.date, dateFrom, dateTo))
        .filter((t) => (city === "All" ? true : t.city ? cityOk(t) : true)); // if tx has no city, don't block

      const income = base.filter((x) => x.type === "Income").reduce((a, b) => a + Number(b.amount || 0), 0);
      const expense = base.filter((x) => x.type === "Expense").reduce((a, b) => a + Number(b.amount || 0), 0);
      const profit = income - expense;

      const byCat = base.reduce<Record<string, number>>((acc, r) => {
        const k = String(r.category || "Uncategorized");
        const signed = r.type === "Expense" ? -Math.abs(r.amount) : Math.abs(r.amount);
        acc[k] = (acc[k] || 0) + signed;
        return acc;
      }, {});

      return {
        title: "Finance Report",
        kpis: [
          { label: "Income", value: `₹${inr(income)}` },
          { label: "Expense", value: `₹${inr(expense)}` },
          { label: "Profit", value: `₹${inr(profit)}` },
          { label: "Transactions", value: base.length },
        ],
        breakdown: Object.entries(byCat)
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
          .slice(0, 12)
          .map(([k, v]) => ({ key: k, value: v >= 0 ? `+₹${inr(v)}` : `-₹${inr(Math.abs(v))}` })),
        rows: base.map((r) => ({
          date: r.date,
          type: r.type,
          category: r.category ?? "",
          amount: r.amount,
          vendor: r.vendor ?? "",
          note: r.note ?? "",
        })),
      };
    }

    if (module === "HR") {
      const base = team.filter((m) => cityOk(m));
      const active = base.filter((m) => String(m.status || "").toLowerCase() !== "inactive");
      const avgWorkload =
        active.length === 0 ? 0 : Math.round(active.reduce((a, b) => a + Number(b.workload || 0), 0) / active.length);
      const avgRating =
        active.length === 0 ? 0 : +(active.reduce((a, b) => a + Number(b.rating || 0), 0) / active.length).toFixed(1);

      const payroll = base.reduce((a, b) => a + Number(b.monthlySalary || 0), 0);

      const byRole = base.reduce<Record<string, number>>((acc, r) => {
        const k = String(r.role || "Other");
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});

      return {
        title: "HR Report",
        kpis: [
          { label: "Team", value: base.length },
          { label: "Active", value: active.length },
          { label: "Avg Workload", value: `${avgWorkload}%` },
          { label: "Avg Rating", value: avgRating.toFixed(1) },
          { label: "Payroll/mo", value: `₹${inr(payroll)}` },
        ],
        breakdown: Object.entries(byRole)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([k, v]) => ({ key: k, value: v })),
        rows: base.map((m) => ({
          name: m.name,
          role: m.role ?? "",
          status: m.status ?? "",
          city: m.city ?? "",
          workload: m.workload ?? "",
          rating: m.rating ?? "",
          salary: m.monthlySalary ?? "",
          eventsThisMonth: m.eventsThisMonth ?? "",
        })),
      };
    }

    if (module === "Vendors") {
      const base = vendors.filter((v) => cityOk(v));
      const byCat = base.reduce<Record<string, number>>((acc, r) => {
        const k = String(r.category || "Other");
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});

      const avgRating =
        base.length === 0 ? 0 : +(base.reduce((a, b) => a + Number(b.rating || 0), 0) / base.length).toFixed(1);

      return {
        title: "Vendors Report",
        kpis: [
          { label: "Vendors", value: base.length },
          { label: "Avg Rating", value: avgRating.toFixed(1) },
          { label: "Categories", value: Object.keys(byCat).length },
          { label: "City", value: city === "All" ? "All" : city },
        ],
        breakdown: Object.entries(byCat)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([k, v]) => ({ key: k, value: v })),
        rows: base.map((v) => ({
          name: v.name,
          category: v.category ?? "",
          city: v.city ?? "",
          rating: v.rating ?? "",
          phone: v.phone ?? "",
          status: v.status ?? "",
        })),
      };
    }

    // AI
    const base = aiDocs.filter((d) => inRange((d.createdAt || "").slice(0, 10), dateFrom, dateTo));
    const byType = base.reduce<Record<string, number>>((acc, r) => {
      const k = String(r.type || "Other");
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    return {
      title: "AI Report",
      kpis: [
        { label: "Outputs", value: base.length },
        { label: "Types", value: Object.keys(byType).length },
        { label: "Range", value: `${dateFrom} → ${dateTo}` },
        { label: "Saved", value: "local" },
      ],
      breakdown: Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, value: v })),
      rows: base.map((d) => ({
        title: d.title,
        type: d.type,
        createdAt: d.createdAt ? new Date(d.createdAt).toLocaleString() : "",
      })),
    };
  }, [module, dateFrom, dateTo, status, city, events, txs, team, vendors, aiDocs]);

  function refreshRead() {
    const e = loadFirstKey<any[]>(EVENT_KEYS, []);
    const f = loadFirstKey<any[]>(FIN_KEYS, []);
    const h = loadFirstKey<any[]>(HR_KEYS, []);
    const v = loadFirstKey<any[]>(VENDOR_KEYS, []);
    const a = loadFirstKey<any[]>(AI_KEYS, []);

    setKeysInfo({ events: e.keyUsed, fin: f.keyUsed, hr: h.keyUsed, vendors: v.keyUsed, ai: a.keyUsed });
    setRawEvents(Array.isArray(e.data) ? e.data : []);
    setRawFin(Array.isArray(f.data) ? f.data : []);
    setRawHR(Array.isArray(h.data) ? h.data : []);
    setRawVendors(Array.isArray(v.data) ? v.data : []);
    setRawAI(Array.isArray(a.data) ? a.data : []);
    setMsg("✅ Refreshed data from localStorage");
  }

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

  function exportCompanyJSON() {
    const payload = {
      version: "eventura-company-report-v1",
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
    downloadFile(`eventura_company_report_${from}_to_${to}.json`, JSON.stringify(payload, null, 2), "application/json");
  }

  function exportReportJSON() {
    downloadFile(
      `eventura_report_${module.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ module, dateFrom, dateTo, status, city, report }, null, 2),
      "application/json"
    );
    setMsg("✅ Exported JSON");
  }

  function exportReportCSV() {
    exportCSV(`eventura_report_${module.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`, report.rows || []);
    setMsg("✅ Exported CSV");
  }

  function saveTemplate() {
    const n = templateName.trim();
    if (!n) return setMsg("❌ Template name required");
    const t: ReportTemplate = {
      id: uid(),
      name: n,
      module,
      dateFrom,
      dateTo,
      status,
      city,
      createdAt: new Date().toISOString(),
    };
    setTemplates((prev) => [t, ...prev]);
    setTemplateName("");
    setMsg("✅ Template saved");
  }

  function loadTemplate(t: ReportTemplate) {
    setTab("Builder");
    setModule(t.module);
    setDateFrom(t.dateFrom);
    setDateTo(t.dateTo);
    setStatus(t.status);
    setCity(t.city);
    setMsg(`✅ Loaded template: ${t.name}`);
  }

  function deleteTemplate(id: string) {
    setTemplates((prev) => prev.filter((x) => x.id !== id));
    setMsg("✅ Template deleted");
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
              Company & Builder Reports • Logged in as <b>{email || "Unknown"}</b> • Role: <span style={S.rolePill}>{role}</span>
            </div>
            <div style={{ marginTop: 8, ...S.smallMuted }}>
              Reading keys → Events: <b>{keysInfo.events ?? "not found"}</b> • Finance: <b>{keysInfo.fin ?? "not found"}</b> • HR:{" "}
              <b>{keysInfo.hr ?? "not found"}</b> • Vendors: <b>{keysInfo.vendors ?? "not found"}</b> • AI: <b>{keysInfo.ai ?? "not found"}</b>
            </div>
          </div>

          <div style={S.headerRight}>
            <button style={S.secondaryBtn} onClick={refreshRead}>Refresh</button>
            <button style={S.secondaryBtn} onClick={() => setTab("Company")}>Company</button>
            <button style={S.secondaryBtn} onClick={() => setTab("Builder")}>Builder</button>
            <button style={S.secondaryBtn} onClick={exportCompanyJSON}>Export Company JSON</button>
            {isCEO ? (
              <>
                <button style={S.secondaryBtn} onClick={() => exportCSV(`eventura_events_${from}_to_${to}.csv`, eventsInRange)}>Events CSV</button>
                <button style={S.secondaryBtn} onClick={() => exportCSV(`eventura_finance_${from}_to_${to}.csv`, txsInRange)}>Finance CSV</button>
              </>
            ) : null}
          </div>
        </div>

        {loading ? <div style={S.loadingBar}>Loading session…</div> : null}
        {msg ? <div style={S.msgBox}>{msg}</div> : null}

        {tab === "Company" ? (
          <>
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
              <div style={S.smallNote}>Company tab reads all modules and summarizes what’s going on.</div>
            </div>

            <div style={S.grid}>
              <section style={S.panel}>
                <div style={S.panelTitle}>Executive Summary (Auto)</div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {execSummary.map((line, i) => (
                    <div key={i} style={S.summaryLine}>{line}</div>
                  ))}
                </div>
              </section>

              <section style={S.panel}>
                <div style={S.panelTitle}>Company KPIs</div>
                <div style={S.kpiRow}>
                  <KPIBox label="Events" value={eventsInRange.length} S={S} />
                  <KPIBox label="Net" value={formatCurrency(finTotals.net)} S={S} />
                  <KPIBox label="Team" value={hrKpis.total} S={S} />
                  <KPIBox label="Vendors" value={vendorKpis.total} S={S} />
                </div>
                <div style={S.smallNote}>(HR/Vendors are overall counts; events/finance are range based.)</div>
              </section>

              <section style={S.panel}>
                <div style={S.panelTitle}>Events (Status breakdown)</div>
                {eventStatusBreak.length ? (
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {eventStatusBreak.slice(0, 8).map(([st, c]) => (
                      <div key={st} style={S.rowBetween}>
                        <div style={{ fontWeight: 950 }}>{st}</div>
                        <div style={S.pill}>{c}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={S.muted}>No events found in this range.</div>
                )}
              </section>

              <section style={S.panel}>
                <div style={S.panelTitle}>Vendors (Top rated)</div>
                {vendorKpis.topRated.length ? (
                  <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                    {vendorKpis.topRated.map((v) => (
                      <div key={v.id} style={S.itemCard}>
                        <div style={S.rowBetween}>
                          <div style={{ fontWeight: 950 }}>{v.name}</div>
                          <span style={S.pill}>⭐ {v.rating}</span>
                        </div>
                        <div style={S.smallMuted}>{v.category || "—"} • {v.city || "—"} • {v.phone || "—"}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={S.muted}>No vendor ratings yet.</div>
                )}
              </section>
            </div>
          </>
        ) : (
          <>
            <div style={S.panel}>
              <div style={S.panelTitle}>Report Builder</div>

              <div style={S.grid5}>
                <Field label="Module" S={S}>
                  <select style={S.select} value={module} onChange={(e) => setModule(e.target.value as Module)}>
                    {(["Events", "Finance", "HR", "Vendors", "AI"] as Module[]).map((x) => (
                      <option key={x} style={S.option} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="From" S={S}>
                  <input style={S.input} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </Field>

                <Field label="To" S={S}>
                  <input style={S.input} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </Field>

                <Field label="City" S={S}>
                  <select style={S.select} value={city} onChange={(e) => setCity(e.target.value)}>
                    {cities.map((c) => (
                      <option key={c} style={S.option} value={c}>
                        {c === "All" ? "All Cities" : c}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Status" S={S}>
                  <select
                    style={S.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={module !== "Events"}
                    title={module !== "Events" ? "Status filter only for Events" : ""}
                  >
                    {(module === "Events" ? eventStatuses : ["All"]).map((s) => (
                      <option key={s} style={S.option} value={s}>
                        {s === "All" ? "All Status" : s}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div style={S.rowBetween}>
                <div style={S.smallMuted}>Export JSON/CSV, and save templates for repeat reports.</div>
                <div style={S.row}>
                  <button style={S.ghostBtn} onClick={exportReportJSON}>Export JSON</button>
                  <button style={S.ghostBtn} onClick={exportReportCSV}>Export CSV</button>
                </div>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  style={{ ...S.input, width: 260 }}
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name"
                />
                <button style={S.primaryBtn} onClick={saveTemplate}>Save Template</button>
              </div>
            </div>

            <div style={S.panel}>
              <div style={S.panelTitle}>{report.title}</div>
              <div style={S.kpiRow}>
                {report.kpis.map((k: any) => (
                  <KPIBox key={k.label} label={k.label} value={k.value} S={S} />
                ))}
              </div>

              <div style={S.split}>
                <div style={S.box}>
                  <div style={S.boxTitle}>Breakdown</div>
                  {!report.breakdown?.length ? (
                    <div style={S.muted}>No breakdown available.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {report.breakdown.slice(0, 14).map((b: any) => (
                        <div key={b.key} style={S.breakRow}>
                          <div style={{ fontWeight: 950 }}>{b.key}</div>
                          <div style={S.pill}>{b.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={S.box}>
                  <div style={S.boxTitle}>Preview Rows</div>
                  {!report.rows?.length ? (
                    <div style={S.muted}>No rows found for selected filters.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {report.rows.slice(0, 10).map((r: any, idx: number) => (
                        <div key={idx} style={S.previewRow}>
                          <div style={S.smallMuted}>{Object.values(r).slice(0, 2).join(" • ")}</div>
                          <div style={S.previewMeta}>
                            {Object.entries(r)
                              .slice(2, 6)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" | ")}
                          </div>
                        </div>
                      ))}
                      {report.rows.length > 10 ? (
                        <div style={S.smallMuted}>… and {report.rows.length - 10} more rows (export CSV for full)</div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={S.panel}>
              <div style={S.panelTitle}>Saved Templates</div>
              {!templates.length ? (
                <div style={S.muted}>No templates yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {templates.map((t) => (
                    <div key={t.id} style={S.itemCard}>
                      <div style={S.rowBetween}>
                        <div>
                          <div style={{ fontWeight: 950 }}>{t.name}</div>
                          <div style={S.smallMuted}>
                            {t.module} • {t.dateFrom} → {t.dateTo} • {t.city} • {t.status}
                          </div>
                        </div>
                        <div style={S.row}>
                          <button style={S.ghostBtn} onClick={() => loadTemplate(t)}>Load</button>
                          <button style={S.dangerBtn} onClick={() => deleteTemplate(t.id)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
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

    msgBox: {
      marginTop: 12,
      padding: 10,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontSize: 13,
      fontWeight: 900,
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

    grid: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    panel: {
      marginTop: 12,
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

    /* ✅ dark select + dark options (hover readable) */
    select: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
      fontWeight: 900,
      appearance: "none",
      WebkitAppearance: "none",
      MozAppearance: "none",
    },
    option: { backgroundColor: "#0B1020", color: "#F9FAFB" },

    secondaryBtn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
    },
    primaryBtn: {
      padding: "10px 14px",
      borderRadius: 14,
      border: `1px solid ${T.accentBd}`,
      background: `linear-gradient(135deg, ${T.accentBg}, rgba(255,255,255,0.06))`,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    ghostBtn: {
      padding: "10px 14px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    dangerBtn: {
      padding: "10px 14px",
      borderRadius: 14,
      border: `1px solid ${T.dangerBd}`,
      background: T.dangerBg,
      color: T.dangerTx,
      fontWeight: 950,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },

    summaryLine: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      fontWeight: 900,
      color: T.text,
    },

    itemCard: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    row: { display: "flex", gap: 10, alignItems: "center" },
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

    /* Builder layout */
    grid5: { marginTop: 12, display: "grid", gridTemplateColumns: "220px 1fr 1fr 1fr 1fr", gap: 12 },
    field: { display: "grid", gap: 8 },
    label: { fontSize: 12, color: T.muted, fontWeight: 900 },

    split: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    box: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    boxTitle: { fontWeight: 950, marginBottom: 10 },

    breakRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
    previewRow: {
      padding: 10,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: "rgba(11,16,32,0.65)",
    },
    previewMeta: { marginTop: 6, color: "#C7CFDD", fontSize: 12 },
  };
}
