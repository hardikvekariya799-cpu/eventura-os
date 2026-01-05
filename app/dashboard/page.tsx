"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ================== STORAGE KEYS (match your system) ================== */
const EVENT_KEYS = ["eventura-events", "eventura_os_events_v1", "eventura_events_v1"];
const FIN_KEYS = ["eventura-finance-transactions", "eventura_os_fin_v1", "eventura_fin_v1", "eventura_os_fin_tx_v1"];
const HR_KEYS = ["eventura-hr-team", "eventura_os_hr_v1", "eventura_hr_v1", "eventura_os_hr_team_v2"];
const VENDOR_KEYS = ["eventura-vendors", "eventura_os_vendors_v1", "eventura_vendors_v1", "eventura-vendor-list"];
const LS_SETTINGS = "eventura_os_settings_v3";

/* ================== TYPES ================== */
type Theme =
  | "Royal Gold"
  | "Midnight Purple"
  | "Emerald Night"
  | "Ocean Blue"
  | "Ruby Noir"
  | "Carbon Black"
  | "Ivory Light";

type AppSettings = {
  theme?: Theme;
  highContrast?: boolean;
  compactTables?: boolean;
  ceoEmail?: string;
  staffEmail?: string;
};

type NormalEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  status: string;
  city?: string;
  budget?: number;
};

type NormalTx = {
  id: string;
  date: string; // YYYY-MM-DD
  type: "Income" | "Expense";
  amount: number;
  category?: string;
  note?: string;
  vendor?: string;
};

type NormalStaff = {
  id: string;
  name: string;
  role?: string;
  status?: string;
  city?: string;
  workload?: number;
  monthlySalary?: number;
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
};

type KeysInfo = { events: string | null; finance: string | null; hr: string | null; vendors: string | null };

/* ================== SAFE HELPERS ================== */
function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadFirstKey<T>(keys: string[], fallback: T): { keyUsed: string | null; data: T } {
  if (typeof window === "undefined") return { keyUsed: null, data: fallback };
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    const parsed = safeParse<T>(raw, fallback);
    if (parsed && (Array.isArray(parsed) || typeof parsed === "object")) return { keyUsed: k, data: parsed };
  }
  return { keyUsed: null, data: fallback };
}

function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return safeParse<T>(localStorage.getItem(key), fallback);
}

function todayYMD(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function isoMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function inRange(dateStr: string, from: string, to: string) {
  if (!dateStr) return false;
  return dateStr >= from && dateStr <= to;
}

function formatCurrency(amount: number, currency: "INR" | "CAD" | "USD" = "INR") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function exportJSON(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

/* ================== NORMALIZERS ================== */
function normalizeEvents(raw: any): NormalEvent[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? `${x?.title ?? x?.name ?? "event"}-${x?.date ?? x?.eventDate ?? ""}`);
      const date = String(x?.date ?? x?.eventDate ?? "");
      const title = String(x?.title ?? x?.name ?? x?.eventName ?? "Untitled");
      const status = String(x?.status ?? x?.stage ?? "Unknown");
      const city = x?.city ? String(x.city) : undefined;
      const budget = Number.isFinite(Number(x?.budget)) ? Number(x.budget) : undefined;
      return { id, date, title, status, city, budget };
    })
    .filter((e) => e.date && e.title);
}

function normalizeFinance(raw: any): NormalTx[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? `${x?.date ?? ""}-${x?.type ?? ""}-${x?.amount ?? ""}`);
      const date = String(x?.date ?? x?.txDate ?? "");
      const t = String(x?.type ?? "").toLowerCase();
      const type: "Income" | "Expense" = t === "income" ? "Income" : "Expense";
      const amount = Number(x?.amount ?? x?.value ?? 0);
      const category = x?.category ? String(x.category) : undefined;
      const note = x?.note ? String(x.note) : undefined;
      const vendor = x?.vendor ? String(x.vendor) : undefined;
      return { id, date, type, amount: Number.isFinite(amount) ? amount : 0, category, note, vendor };
    })
    .filter((t) => t.date && t.amount > 0);
}

function normalizeHR(raw: any): NormalStaff[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? x?.name ?? x?.fullName ?? Math.random().toString(16).slice(2));
      const name = String(x?.name ?? x?.fullName ?? "Unknown");
      const role = x?.role ? String(x.role) : undefined;
      const status = x?.status ? String(x.status) : undefined;
      const city = x?.city ? String(x.city) : undefined;
      const workload = Number.isFinite(Number(x?.workload)) ? Number(x.workload) : undefined;
      const monthlySalary = Number.isFinite(Number(x?.monthlySalary)) ? Number(x.monthlySalary) : undefined;
      const rating = Number.isFinite(Number(x?.rating)) ? Number(x.rating) : undefined;
      return { id, name, role, status, city, workload, monthlySalary, rating };
    })
    .filter((m) => m.name);
}

function normalizeVendors(raw: any): NormalVendor[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? x?.name ?? x?.vendorName ?? Math.random().toString(16).slice(2));
      const name = String(x?.name ?? x?.vendorName ?? "Vendor");
      const category = x?.category ? String(x.category) : undefined;
      const city = x?.city ? String(x.city) : undefined;
      const phone = x?.phone ? String(x.phone) : undefined;
      const rating = Number.isFinite(Number(x?.rating)) ? Number(x.rating) : undefined;
      const status = x?.status ? String(x.status) : undefined;
      return { id, name, category, city, phone, rating, status };
    })
    .filter((v) => v.name);
}

/* ================== THEME TOKENS ================== */
function ThemeTokens(theme: Theme = "Royal Gold", highContrast?: boolean) {
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
    okBg: "rgba(34,197,94,0.12)",
    okBd: hc ? "rgba(34,197,94,0.45)" : "rgba(34,197,94,0.28)",
    okTx: "#86EFAC",
    warnBg: "rgba(245,158,11,0.12)",
    warnBd: hc ? "rgba(245,158,11,0.45)" : "rgba(245,158,11,0.28)",
    warnTx: "#FCD34D",
    dangerBg: "rgba(248,113,113,0.10)",
    dangerBd: hc ? "rgba(248,113,113,0.55)" : "rgba(248,113,113,0.30)",
    dangerTx: "#FCA5A5",
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
      return { ...base, text: "#111827", muted: "#4B5563", bg: "#F9FAFB", panel: "rgba(255,255,255,0.78)", panel2: "rgba(255,255,255,0.92)", border: hc ? "rgba(17,24,39,0.22)" : "rgba(17,24,39,0.12)", soft: hc ? "rgba(17,24,39,0.07)" : "rgba(17,24,39,0.04)", inputBg: hc ? "rgba(17,24,39,0.08)" : "rgba(17,24,39,0.04)", glow1: "rgba(212,175,55,0.16)", glow2: "rgba(59,130,246,0.14)", accentBg: "rgba(212,175,55,0.16)", accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)", accentTx: "#92400E", okTx: "#166534", warnTx: "#92400E", dangerTx: "#B91C1C" };
    default:
      return { ...base, glow1: "rgba(255,215,110,0.18)", glow2: "rgba(120,70,255,0.18)", accentBg: "rgba(212,175,55,0.12)", accentBd: hc ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)", accentTx: "#FDE68A" };
  }
}

/* ================== UI ================== */
function KPI({ label, value, hint, tone, S, T }: { label: string; value: string; hint?: string; tone?: "ok" | "warn" | "danger"; S: any; T: any }) {
  const badge =
    tone === "ok"
      ? { background: T.okBg, border: `1px solid ${T.okBd}`, color: T.okTx }
      : tone === "warn"
      ? { background: T.warnBg, border: `1px solid ${T.warnBd}`, color: T.warnTx }
      : tone === "danger"
      ? { background: T.dangerBg, border: `1px solid ${T.dangerBd}`, color: T.dangerTx }
      : { background: T.accentBg, border: `1px solid ${T.accentBd}`, color: T.accentTx };

  return (
    <div style={S.kpi}>
      <div style={S.rowBetween}>
        <div style={S.kpiLabel}>{label}</div>
        <span style={{ ...S.badge, ...badge }}>LIVE</span>
      </div>
      <div style={S.kpiValue}>{value}</div>
      {hint ? <div style={S.smallMuted}>{hint}</div> : null}
    </div>
  );
}

function Sparkline({ points, height = 40, S }: { points: number[]; height?: number; S: any }) {
  const w = 220;
  const h = height;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = Math.max(1, max - min);

  const d = points
    .map((p, i) => {
      const x = (i / Math.max(1, points.length - 1)) * w;
      const y = h - ((p - min) / span) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} style={S.spark}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.9" />
    </svg>
  );
}

/* ================== PAGE ================== */
export default function DashboardPage() {
  const [settings, setSettings] = useState<AppSettings>({});
  const [email, setEmail] = useState("");
  const [keysInfo, setKeysInfo] = useState<KeysInfo>({ events: null, finance: null, hr: null, vendors: null });

  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [rawFin, setRawFin] = useState<any[]>([]);
  const [rawHR, setRawHR] = useState<any[]>([]);
  const [rawVendors, setRawVendors] = useState<any[]>([]);

  const [preset, setPreset] = useState<"7" | "30" | "90" | "custom">("30");
  const [from, setFrom] = useState(isoMinusDays(30));
  const [to, setTo] = useState(todayYMD());
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setEmail(localStorage.getItem("eventura_email") || "");
    setSettings(safeLoad<AppSettings>(LS_SETTINGS, {}));
    refreshRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshRead() {
    const e = loadFirstKey<any[]>(EVENT_KEYS, []);
    const f = loadFirstKey<any[]>(FIN_KEYS, []);
    const h = loadFirstKey<any[]>(HR_KEYS, []);
    const v = loadFirstKey<any[]>(VENDOR_KEYS, []);
    setKeysInfo({ events: e.keyUsed, finance: f.keyUsed, hr: h.keyUsed, vendors: v.keyUsed });
    setRawEvents(Array.isArray(e.data) ? e.data : []);
    setRawFin(Array.isArray(f.data) ? f.data : []);
    setRawHR(Array.isArray(h.data) ? h.data : []);
    setRawVendors(Array.isArray(v.data) ? v.data : []);
    setMsg("✅ Dashboard refreshed");
    setTimeout(() => setMsg(""), 1200);
  }

  function applyPreset(p: "7" | "30" | "90" | "custom") {
    setPreset(p);
    if (p === "custom") return;
    const days = p === "7" ? 7 : p === "30" ? 30 : 90;
    setFrom(isoMinusDays(days));
    setTo(todayYMD());
  }

  const isCEO = useMemo(() => (email || "").toLowerCase() === "hardikvekariya799@gmail.com", [email]);
  const T = ThemeTokens((settings.theme as Theme) || "Royal Gold", settings.highContrast);
  const S = useMemo(() => makeStyles(T, !!settings.compactTables), [T, settings.compactTables]);

  const events = useMemo(() => normalizeEvents(rawEvents), [rawEvents]);
  const txs = useMemo(() => normalizeFinance(rawFin), [rawFin]);
  const team = useMemo(() => normalizeHR(rawHR), [rawHR]);
  const vendors = useMemo(() => normalizeVendors(rawVendors), [rawVendors]);

  const eventsInRange = useMemo(() => events.filter((e) => inRange(e.date, from, to)), [events, from, to]);
  const txsInRange = useMemo(() => txs.filter((t) => inRange(t.date, from, to)), [txs, from, to]);

  const finTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of txsInRange) {
      if (t.type === "Income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }, [txsInRange]);

  const eventStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of eventsInRange) {
      const k = (e.status || "Unknown").trim() || "Unknown";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [eventsInRange]);

  const hrKpis = useMemo(() => {
    const total = team.length;
    const active = team.filter((m) => String(m.status || "").toLowerCase() !== "inactive").length;
    const payroll = team.reduce((a, b) => a + (Number.isFinite(b.monthlySalary as any) ? (b.monthlySalary as number) : 0), 0);
    const avgWorkload =
      total === 0 ? 0 : Math.round((team.reduce((a, b) => a + (Number.isFinite(b.workload as any) ? (b.workload as number) : 0), 0) / total) * 10) / 10;
    const highLoad = team.filter((m) => (m.workload ?? 0) >= 80).length;
    return { total, active, payroll, avgWorkload, highLoad };
  }, [team]);

  const vendorKpis = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter((v) => String(v.status || "").toLowerCase() !== "inactive").length;
    const rated = vendors.filter((v) => Number.isFinite(v.rating as any));
    const avgRating = rated.length ? +(rated.reduce((a, b) => a + (b.rating ?? 0), 0) / rated.length).toFixed(1) : 0;
    return { total, active, avgRating };
  }, [vendors]);

  // Advanced “signals” (no external AI, deploy-safe)
  const signals = useMemo(() => {
    const list: { level: "ok" | "warn" | "danger"; title: string; detail: string }[] = [];

    // Finance signal
    if (txsInRange.length === 0) list.push({ level: "warn", title: "No finance activity", detail: "Add income/expense transactions to track profitability." });
    else if (finTotals.net < 0) list.push({ level: "danger", title: "Negative net cash flow", detail: `Net is ${formatCurrency(finTotals.net)} in the selected range.` });
    else list.push({ level: "ok", title: "Cash flow healthy", detail: `Net is ${formatCurrency(finTotals.net)} in the selected range.` });

    // Event pipeline signal
    const upcoming = eventsInRange.filter((e) => e.date >= todayYMD()).length;
    if (eventsInRange.length === 0) list.push({ level: "warn", title: "No events in range", detail: "Your pipeline is empty for the selected period." });
    else if (upcoming === 0) list.push({ level: "warn", title: "No upcoming events", detail: "You have events, but none scheduled after today." });
    else list.push({ level: "ok", title: "Pipeline active", detail: `${upcoming} upcoming event(s) in this range.` });

    // HR signal
    if (hrKpis.total === 0) list.push({ level: "warn", title: "No HR data", detail: "Add team members to measure workload & payroll." });
    else if (hrKpis.highLoad >= 2) list.push({ level: "danger", title: "Team overload risk", detail: `${hrKpis.highLoad} people have workload >= 80%.` });
    else if (hrKpis.highLoad === 1) list.push({ level: "warn", title: "Workload spike", detail: "One team member is above 80% workload." });
    else list.push({ level: "ok", title: "Workload balanced", detail: `Avg workload is ${hrKpis.avgWorkload}%.` });

    // Vendor signal
    if (vendorKpis.total === 0) list.push({ level: "warn", title: "No vendors found", detail: "Add vendors so you can track reliability and ratings." });
    else if (vendorKpis.avgRating && vendorKpis.avgRating < 3.5) list.push({ level: "warn", title: "Vendor quality risk", detail: `Average rating is ${vendorKpis.avgRating}.` });
    else list.push({ level: "ok", title: "Vendor base ready", detail: `${vendorKpis.active} active vendor(s).` });

    return list.slice(0, 6);
  }, [txsInRange.length, finTotals.net, eventsInRange.length, hrKpis.total, hrKpis.highLoad, hrKpis.avgWorkload, vendorKpis.total, vendorKpis.avgRating, vendorKpis.active]);

  // Trend data: simple buckets by week (last 8 points) within range
  const weeklySeries = useMemo(() => {
    const points = 8;
    const end = new Date(to + "T00:00:00");
    const starts: { from: string; to: string }[] = [];
    for (let i = points - 1; i >= 0; i--) {
      const a = new Date(end);
      a.setDate(a.getDate() - (i + 1) * 7 + 1);
      const b = new Date(end);
      b.setDate(b.getDate() - i * 7);
      const af = `${a.getFullYear()}-${String(a.getMonth() + 1).padStart(2, "0")}-${String(a.getDate()).padStart(2, "0")}`;
      const bf = `${b.getFullYear()}-${String(b.getMonth() + 1).padStart(2, "0")}-${String(b.getDate()).padStart(2, "0")}`;
      starts.push({ from: af, to: bf });
    }

    const ev = starts.map((r) => events.filter((e) => inRange(e.date, r.from, r.to)).length);
    const inc = starts.map((r) => txs.filter((t) => t.type === "Income" && inRange(t.date, r.from, r.to)).reduce((a, b) => a + b.amount, 0));
    const exp = starts.map((r) => txs.filter((t) => t.type === "Expense" && inRange(t.date, r.from, r.to)).reduce((a, b) => a + b.amount, 0));
    return { buckets: starts, ev, inc, exp };
  }, [events, txs, to]);

  const topVendors = useMemo(() => {
    return vendors
      .slice()
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 6);
  }, [vendors]);

  const highLoadTeam = useMemo(() => {
    return team
      .filter((m) => (m.workload ?? 0) >= 80)
      .slice()
      .sort((a, b) => (b.workload ?? 0) - (a.workload ?? 0))
      .slice(0, 6);
  }, [team]);

  const recentActivity = useMemo(() => {
    const ev = events
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 6)
      .map((e) => ({ t: e.date, type: "Event", title: e.title, meta: e.status }));

    const fx = txs
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 6)
      .map((t) => ({ t: t.date, type: "Finance", title: `${t.type} • ${t.category || "Uncategorized"}`, meta: formatCurrency(t.amount) }));

    const merged = [...ev, ...fx].sort((a, b) => (a.t < b.t ? 1 : -1)).slice(0, 10);
    return merged;
  }, [events, txs]);

  function exportDashboardBundle() {
    exportJSON(`eventura_dashboard_${from}_to_${to}.json`, {
      version: "eventura-dashboard-v1",
      exportedAt: new Date().toISOString(),
      range: { from, to },
      keysUsed: keysInfo,
      snapshot: {
        kpis: { events: eventsInRange.length, income: finTotals.income, expense: finTotals.expense, net: finTotals.net, team: hrKpis.total, vendors: vendorKpis.total },
        signals,
        topVendors,
        highLoadTeam,
      },
      data: { events: eventsInRange, finance: txsInRange, hr: team, vendors },
    });
    setMsg("✅ Exported dashboard JSON");
    setTimeout(() => setMsg(""), 1200);
  }

  function exportFinanceQuickCSV() {
    exportCSV(`eventura_finance_${from}_to_${to}.csv`, txsInRange);
    setMsg("✅ Exported finance CSV");
    setTimeout(() => setMsg(""), 1200);
  }

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          <div>
            <div style={S.brandName}>Eventura OS</div>
            <div style={S.brandSub}>Advanced Dashboard</div>
          </div>
        </div>

        <nav style={S.nav}>
          <Link href="/dashboard" style={{ ...(S.navItem as any), border: `1px solid ${T.accentBd}`, background: T.accentBg }}>
            🧠 Dashboard
          </Link>
          <Link href="/events" style={S.navItem as any}>📅 Events</Link>
          <Link href="/finance" style={S.navItem as any}>💰 Finance</Link>
          <Link href="/vendors" style={S.navItem as any}>🏷️ Vendors</Link>
          <Link href="/hr" style={S.navItem as any}>🧑‍🤝‍🧑 HR</Link>
          <Link href="/reports" style={S.navItem as any}>📈 Reports</Link>
          <Link href="/settings" style={S.navItem as any}>⚙️ Settings</Link>
        </nav>

        <div style={S.sidebarFooter}>
          <div style={S.userBox}>
            <div style={S.userLabel}>Signed in</div>
            <div style={S.userEmail}>{email || "Unknown"}</div>
            <div style={S.roleBadge}>{isCEO ? "CEO" : "Staff"}</div>
          </div>

          <div style={S.smallNote}>
            Reading keys:
            <div>Events: <b>{keysInfo.events ?? "not found"}</b></div>
            <div>Finance: <b>{keysInfo.finance ?? "not found"}</b></div>
            <div>HR: <b>{keysInfo.hr ?? "not found"}</b></div>
            <div>Vendors: <b>{keysInfo.vendors ?? "not found"}</b></div>
          </div>
        </div>
      </aside>

      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={S.h1}>CEO Control Dashboard</div>
            <div style={S.muted}>Live from localStorage • Range analytics • Signals & risk alerts • Export-ready</div>
          </div>

          <div style={S.headerRight}>
            <button style={S.secondaryBtn} onClick={refreshRead}>Refresh</button>
            <button style={S.secondaryBtn} onClick={exportDashboardBundle}>Export JSON</button>
            {isCEO ? <button style={S.secondaryBtn} onClick={exportFinanceQuickCSV}>Export Finance CSV</button> : null}
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* Range + Presets */}
        <div style={S.rangeBar}>
          <div style={S.rangeTop}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={S.presetRow}>
                <button style={preset === "7" ? S.presetBtnOn : S.presetBtn} onClick={() => applyPreset("7")}>7D</button>
                <button style={preset === "30" ? S.presetBtnOn : S.presetBtn} onClick={() => applyPreset("30")}>30D</button>
                <button style={preset === "90" ? S.presetBtnOn : S.presetBtn} onClick={() => applyPreset("90")}>90D</button>
                <button style={preset === "custom" ? S.presetBtnOn : S.presetBtn} onClick={() => applyPreset("custom")}>Custom</button>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={S.smallMuted}>From</div>
                <input style={S.input} type="date" value={from} onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }} />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <div style={S.smallMuted}>To</div>
                <input style={S.input} type="date" value={to} onChange={(e) => { setPreset("custom"); setTo(e.target.value); }} />
              </div>
            </div>

            <div style={S.tipBox}>
              <div style={{ fontWeight: 950 }}>Quick Insight</div>
              <div style={S.smallMuted}>
                Events/Finance follow the range. HR/Vendors are overall totals (usually no dates).
              </div>
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div style={S.kpiGrid}>
          <KPI label="Events (range)" value={String(eventsInRange.length)} hint={eventStatus[0] ? `Top: ${eventStatus[0][0]} • ${eventStatus[0][1]}` : "No status yet"} tone={eventsInRange.length ? "ok" : "warn"} S={S} T={T} />
          <KPI label="Net (range)" value={formatCurrency(finTotals.net)} hint={`Income ${formatCurrency(finTotals.income)} • Expense ${formatCurrency(finTotals.expense)}`} tone={finTotals.net < 0 ? "danger" : txsInRange.length ? "ok" : "warn"} S={S} T={T} />
          <KPI label="Team" value={String(hrKpis.total)} hint={`Active ${hrKpis.active} • Avg workload ${hrKpis.avgWorkload}%`} tone={hrKpis.highLoad >= 2 ? "danger" : hrKpis.highLoad === 1 ? "warn" : hrKpis.total ? "ok" : "warn"} S={S} T={T} />
          <KPI label="Vendors" value={String(vendorKpis.total)} hint={`Active ${vendorKpis.active} • Avg ⭐ ${vendorKpis.avgRating || "—"}`} tone={vendorKpis.total ? (vendorKpis.avgRating && vendorKpis.avgRating < 3.5 ? "warn" : "ok") : "warn"} S={S} T={T} />
        </div>

        {/* Main grid */}
        <div style={S.grid3}>
          {/* Signals */}
          <section style={S.panel}>
            <div style={S.panelTitle}>AI Signals (Deploy-safe)</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {signals.map((s, i) => (
                <div key={i} style={{ ...S.signalRow, ...(s.level === "ok" ? S.signalOk : s.level === "warn" ? S.signalWarn : S.signalDanger) }}>
                  <div style={{ fontWeight: 950 }}>{s.title}</div>
                  <div style={S.smallMuted}>{s.detail}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Trends */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Trends (Last 8 weeks)</div>
            <div style={S.trendGrid}>
              <div style={S.trendCard}>
                <div style={S.trendTitle}>Events</div>
                <div style={S.trendValue}>{eventsInRange.length}</div>
                <div style={S.trendLine}><Sparkline points={weeklySeries.ev} S={S} /></div>
              </div>
              <div style={S.trendCard}>
                <div style={S.trendTitle}>Income</div>
                <div style={S.trendValue}>{formatCurrency(weeklySeries.inc.reduce((a, b) => a + b, 0))}</div>
                <div style={S.trendLine}><Sparkline points={weeklySeries.inc.map((x) => Math.round(x))} S={S} /></div>
              </div>
              <div style={S.trendCard}>
                <div style={S.trendTitle}>Expense</div>
                <div style={S.trendValue}>{formatCurrency(weeklySeries.exp.reduce((a, b) => a + b, 0))}</div>
                <div style={S.trendLine}><Sparkline points={weeklySeries.exp.map((x) => Math.round(x))} S={S} /></div>
              </div>
            </div>

            <div style={S.smallNote}>
              Tip: These trends are derived from stored dates (YYYY-MM-DD). Add more records to see smoother charts.
            </div>
          </section>

          {/* Pipeline */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Event Pipeline</div>
            {eventsInRange.length ? (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {eventStatus.slice(0, 8).map(([st, c]) => (
                  <div key={st} style={S.pipeRow}>
                    <div style={{ fontWeight: 950 }}>{st}</div>
                    <div style={S.pipeBarWrap}>
                      <div style={{ ...S.pipeBarFill, width: `${Math.round((c / Math.max(1, eventStatus[0]?.[1] || 1)) * 100)}%` }} />
                    </div>
                    <div style={S.smallMuted}>{c}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={S.muted}>No events in this range.</div>
            )}

            <div style={S.sectionTitle}>Upcoming (next 7)</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {events
                .filter((e) => e.date >= todayYMD())
                .slice()
                .sort((a, b) => (a.date > b.date ? 1 : -1))
                .slice(0, 7)
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
              {!events.filter((e) => e.date >= todayYMD()).length ? <div style={S.muted}>No upcoming events.</div> : null}
            </div>
          </section>

          {/* Finance Radar */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Finance Radar</div>
            <div style={S.financeSplit}>
              <div style={S.financeCard}>
                <div style={S.smallMuted}>Income</div>
                <div style={S.bigNum}>{formatCurrency(finTotals.income)}</div>
                <div style={S.miniBarWrap}>
                  <div style={{ ...S.miniBarFill, width: `${Math.min(100, Math.round((finTotals.income / Math.max(1, finTotals.income + finTotals.expense)) * 100))}%` }} />
                </div>
              </div>
              <div style={S.financeCard}>
                <div style={S.smallMuted}>Expense</div>
                <div style={S.bigNum}>{formatCurrency(finTotals.expense)}</div>
                <div style={S.miniBarWrap}>
                  <div style={{ ...S.miniBarFill, width: `${Math.min(100, Math.round((finTotals.expense / Math.max(1, finTotals.income + finTotals.expense)) * 100))}%` }} />
                </div>
              </div>
              <div style={S.financeCard}>
                <div style={S.smallMuted}>Net</div>
                <div style={S.bigNum}>{formatCurrency(finTotals.net)}</div>
                <div style={S.smallMuted}>Tx count: {txsInRange.length}</div>
              </div>
            </div>

            <div style={S.sectionTitle}>Latest transactions</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {txsInRange
                .slice()
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .slice(0, 8)
                .map((t) => (
                  <div key={t.id} style={S.itemCard}>
                    <div style={S.rowBetween}>
                      <div style={{ fontWeight: 950 }}>{t.type} • {t.category || "Uncategorized"}</div>
                      <span style={S.pill}>{formatCurrency(t.amount)}</span>
                    </div>
                    <div style={S.smallMuted}>
                      {t.date} {t.vendor ? `• Vendor: ${t.vendor}` : ""} {t.note ? `• ${t.note}` : ""}
                    </div>
                  </div>
                ))}
              {!txsInRange.length ? <div style={S.muted}>No transactions in this range.</div> : null}
            </div>
          </section>

          {/* HR + Vendors */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Team + Vendor Intelligence</div>

            <div style={S.dualCols}>
              <div>
                <div style={S.sectionTitle}>HR Risks</div>
                {hrKpis.payroll > 0 ? (
                  <div style={S.noteBox}>Estimated Monthly Payroll: {formatCurrency(hrKpis.payroll)}</div>
                ) : (
                  <div style={S.smallMuted}>Payroll estimate needs monthlySalary values.</div>
                )}

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {highLoadTeam.map((m) => (
                    <div key={m.id} style={S.itemCard}>
                      <div style={S.rowBetween}>
                        <div style={{ fontWeight: 950 }}>{m.name}</div>
                        <span style={S.pill}>{(m.workload ?? 0) + "%"}</span>
                      </div>
                      <div style={S.smallMuted}>{m.role || "—"} • {m.city || "—"} • {m.status || "—"}</div>
                    </div>
                  ))}
                  {!highLoadTeam.length ? <div style={S.muted}>No one above 80% workload.</div> : null}
                </div>
              </div>

              <div>
                <div style={S.sectionTitle}>Top Vendors</div>
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {topVendors.map((v) => (
                    <div key={v.id} style={S.itemCard}>
                      <div style={S.rowBetween}>
                        <div style={{ fontWeight: 950 }}>{v.name}</div>
                        <span style={S.pill}>{typeof v.rating === "number" ? `⭐ ${v.rating}` : "—"}</span>
                      </div>
                      <div style={S.smallMuted}>{v.category || "—"} • {v.city || "—"} • {v.phone || "—"}</div>
                    </div>
                  ))}
                  {!topVendors.length ? <div style={S.muted}>No vendors found.</div> : null}
                </div>
              </div>
            </div>
          </section>

          {/* Activity */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Recent Activity</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {recentActivity.map((a, i) => (
                <div key={i} style={S.activityRow}>
                  <div style={S.activityLeft}>
                    <div style={S.activityDot} />
                    <div>
                      <div style={{ fontWeight: 950 }}>{a.type}: {a.title}</div>
                      <div style={S.smallMuted}>{a.t} • {a.meta}</div>
                    </div>
                  </div>
                  <span style={S.smallPill}>{a.type}</span>
                </div>
              ))}
              {!recentActivity.length ? <div style={S.muted}>No activity found yet.</div> : null}
            </div>

            <div style={S.sectionTitle}>Quick Actions</div>
            <div style={S.actionsRow}>
              <Link href="/events" style={S.actionLink as any}>➕ Add / Update Events</Link>
              <Link href="/finance" style={S.actionLink as any}>➕ Add Finance Tx</Link>
              <Link href="/hr" style={S.actionLink as any}>➕ Manage Team</Link>
              <Link href="/vendors" style={S.actionLink as any}>➕ Vendor List</Link>
            </div>
          </section>
        </div>

        <div style={S.footerNote}>✅ Advanced dashboard • ✅ Reads from localStorage • ✅ Deploy-safe (no external libs)</div>
      </main>
    </div>
  );
}

/* ================== STYLES ================== */
function makeStyles(T: any, compact: boolean): Record<string, CSSProperties> {
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
      width: 280,
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
      display: "block",
      padding: "10px 12px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.border}`,
      background: T.soft,
      fontWeight: 900,
      fontSize: 13,
    },

    sidebarFooter: { marginTop: "auto", display: "grid", gap: 10 },
    userBox: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    userLabel: { fontSize: 12, color: T.muted, fontWeight: 900 },
    userEmail: { fontSize: 13, fontWeight: 900, marginTop: 6, wordBreak: "break-word" },
    roleBadge: {
      marginTop: 10,
      display: "inline-flex",
      padding: "5px 10px",
      borderRadius: 999,
      background: T.accentBg,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
      fontWeight: 950,
      width: "fit-content",
    },

    main: { flex: 1, padding: 16, maxWidth: 1500, margin: "0 auto", width: "100%" },

    header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: 12, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    headerRight: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },

    h1: { fontSize: 26, fontWeight: 950 },
    muted: { color: T.muted, fontSize: 13, marginTop: 6 },
    smallMuted: { color: T.muted, fontSize: 12 },
    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35 },

    msg: { marginTop: 12, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontSize: 13 },

    rangeBar: { marginTop: 12, padding: 12, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft, display: "grid", gap: 10 },
    rangeTop: { display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" },

    presetRow: { display: "flex", gap: 8, padding: 6, borderRadius: 14, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)" },
    presetBtn: { padding: "8px 10px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontWeight: 950, cursor: "pointer" },
    presetBtnOn: { padding: "8px 10px", borderRadius: 12, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, cursor: "pointer" },

    tipBox: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: "rgba(0,0,0,0.14)", minWidth: 280 },

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

    secondaryBtn: { padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontWeight: 950, cursor: "pointer" },

    kpiGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
    kpi: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    kpiLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiValue: { marginTop: 8, fontSize: 22, fontWeight: 950 },
    badge: { padding: "4px 9px", borderRadius: 999, fontWeight: 950, fontSize: 11 },

    grid3: { marginTop: 12, display: "grid", gridTemplateColumns: "1.1fr 1.5fr 1.1fr", gap: 12 },
    panel: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },

    signalRow: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft, display: "grid", gap: 4 },
    signalOk: { border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx },
    signalWarn: { border: `1px solid ${T.warnBd}`, background: T.warnBg, color: T.warnTx },
    signalDanger: { border: `1px solid ${T.dangerBd}`, background: T.dangerBg, color: T.dangerTx },

    trendGrid: { marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
    trendCard: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    trendTitle: { color: T.muted, fontSize: 12, fontWeight: 900 },
    trendValue: { marginTop: 6, fontSize: 16, fontWeight: 950 },
    trendLine: { marginTop: 8, opacity: 0.95 },
    spark: { color: T.accentTx },

    pipeRow: { display: "grid", gridTemplateColumns: "1fr 2fr 40px", gap: 10, alignItems: "center" },
    pipeBarWrap: { height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" },
    pipeBarFill: { height: "100%", borderRadius: 999, background: T.accentTx, opacity: 0.9 },

    sectionTitle: { marginTop: 12, fontWeight: 950, fontSize: 13 },
    itemCard: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    pill: { padding: "5px 10px", borderRadius: 999, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },

    financeSplit: { marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
    financeCard: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    bigNum: { marginTop: 6, fontSize: 18, fontWeight: 950 },
    miniBarWrap: { marginTop: 10, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" },
    miniBarFill: { height: "100%", borderRadius: 999, background: T.accentTx, opacity: 0.9 },

    dualCols: { marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

    noteBox: { marginTop: 10, padding: 12, borderRadius: 16, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontSize: 13, lineHeight: 1.35 },

    activityRow: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
    activityLeft: { display: "flex", alignItems: "flex-start", gap: 10 },
    activityDot: { width: 10, height: 10, borderRadius: 999, background: T.accentTx, marginTop: 6, boxShadow: `0 0 0 4px ${T.accentBg}` },
    smallPill: { padding: "5px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)", color: T.text, fontWeight: 950, fontSize: 11 },

    actionsRow: { marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    actionLink: { textDecoration: "none", padding: "12px 12px", borderRadius: 16, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.04)", color: T.text, fontWeight: 950 },

    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 10 },
  };
}
