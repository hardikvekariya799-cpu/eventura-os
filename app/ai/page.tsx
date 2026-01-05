"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ================== STORAGE (READ ONLY) ================== */
const EVENT_KEYS = ["eventura-events", "eventura_os_events_v1", "eventura_events_v1"];
const FIN_KEYS = ["eventura-finance-transactions", "eventura_os_fin_v1", "eventura_fin_v1", "eventura_os_fin_tx_v1"];
const HR_KEYS = ["eventura-hr-team", "eventura_os_hr_v1", "eventura_hr_v1", "eventura_os_hr_team_v2", "eventura-hr"];
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

type KeysInfo = { events: string | null; finance: string | null; hr: string | null; vendors: string | null };

type NormalEvent = { id: string; date: string; title: string; status: string; city?: string; budget?: number };
type NormalTx = { id: string; date: string; type: "Income" | "Expense"; amount: number; category?: string; note?: string; vendor?: string };
type NormalStaff = { id: string; name: string; role?: string; status?: string; city?: string; workload?: number; monthlySalary?: number; rating?: number; skills?: string[] };
type NormalVendor = { id: string; name: string; category?: string; city?: string; phone?: string; rating?: number; status?: string };

/* ================== SAFE HELPERS ================== */
function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return safeParse<T>(localStorage.getItem(key), fallback);
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
function exportText(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function exportJSON(filename: string, obj: any) {
  exportText(filename, JSON.stringify(obj, null, 2), "application/json;charset=utf-8");
}
function exportCSV(filename: string, rows: Record<string, any>[]) {
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  exportText(filename, csv, "text/csv;charset=utf-8");
}
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
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
      const skills = Array.isArray(x?.skills) ? x.skills.map((s: any) => String(s)) : undefined;
      return { id, name, role, status, city, workload, monthlySalary, rating, skills };
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
      return { ...base, text: "#111827", muted: "#4B5563", bg: "#F9FAFB", panel: "rgba(255,255,255,0.78)", panel2: "rgba(255,255,255,0.92)", border: hc ? "rgba(17,24,39,0.22)" : "rgba(17,24,39,0.12)", soft: hc ? "rgba(17,24,39,0.07)" : "rgba(17,24,39,0.04)", inputBg: hc ? "rgba(17,24,39,0.08)" : "rgba(17,24,39,0.04)", accentBg: "rgba(212,175,55,0.16)", accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)", accentTx: "#92400E", okTx: "#166534" };
    default:
      return { ...base, glow1: "rgba(255,215,110,0.18)", glow2: "rgba(120,70,255,0.18)", accentBg: "rgba(212,175,55,0.12)", accentBd: hc ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)", accentTx: "#FDE68A" };
  }
}

/* ================== AI BLOCKS ================== */
type AIBlock =
  | { type: "title"; text: string }
  | { type: "kpi"; label: string; value: string; tone?: "ok" | "warn" | "danger" }
  | { type: "bullets"; title?: string; items: string[] }
  | { type: "table"; title?: string; columns: string[]; rows: (string | number)[][] }
  | { type: "text"; text: string };

function blocksToMarkdown(blocks: AIBlock[]) {
  const md: string[] = [];
  for (const b of blocks) {
    if (b.type === "title") md.push(`# ${b.text}\n`);
    if (b.type === "text") md.push(`${b.text}\n`);
    if (b.type === "kpi") md.push(`- **${b.label}:** ${b.value}\n`);
    if (b.type === "bullets") {
      if (b.title) md.push(`## ${b.title}\n`);
      for (const it of b.items) md.push(`- ${it}\n`);
      md.push("\n");
    }
    if (b.type === "table") {
      if (b.title) md.push(`## ${b.title}\n`);
      md.push(`| ${b.columns.join(" | ")} |\n`);
      md.push(`| ${b.columns.map(() => "---").join(" | ")} |\n`);
      for (const r of b.rows) md.push(`| ${r.map(String).join(" | ")} |\n`);
      md.push("\n");
    }
  }
  return md.join("");
}

/* ================== PAGE ================== */
type ToolMode = "Executive Brief" | "Event Plan" | "Finance Insights" | "HR Planner" | "Vendor Match" | "Report Writer";

export default function AIToolsPage() {
  const [settings, setSettings] = useState<AppSettings>({});
  const [email, setEmail] = useState("");
  const [keysInfo, setKeysInfo] = useState<KeysInfo>({ events: null, finance: null, hr: null, vendors: null });

  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [rawFin, setRawFin] = useState<any[]>([]);
  const [rawHR, setRawHR] = useState<any[]>([]);
  const [rawVendors, setRawVendors] = useState<any[]>([]);

  const [from, setFrom] = useState(isoMinusDays(30));
  const [to, setTo] = useState(todayYMD());
  const [mode, setMode] = useState<ToolMode>("Executive Brief");

  const [eventGoal, setEventGoal] = useState("Wedding / Corporate / Birthday");
  const [eventCity, setEventCity] = useState("Surat");
  const [eventBudget, setEventBudget] = useState<number>(250000);
  const [eventGuests, setEventGuests] = useState<number>(300);

  const [currency, setCurrency] = useState<"INR" | "CAD" | "USD">("INR");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
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
    setMsg("✅ Refreshed AI data");
    window.setTimeout(() => setMsg(""), 1200);
  }

  const T = ThemeTokens((settings.theme as Theme) || "Royal Gold", settings.highContrast);
  const S = useMemo(() => makeStyles(T, !!settings.compactTables), [T, settings.compactTables]);

  const ceoEmail = (settings.ceoEmail || "hardikvekariya799@gmail.com").toLowerCase();
  const isCEO = (email || "").toLowerCase() === ceoEmail;

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
    const net = income - expense;
    const burn = expense > 0 ? Math.round((expense / Math.max(income, 1)) * 100) : 0;
    return { income, expense, net, burn };
  }, [txsInRange]);

  const hrKpis = useMemo(() => {
    const total = team.length;
    const active = team.filter((m) => String(m.status || "").toLowerCase() !== "inactive").length;
    const avgWorkload = total ? Math.round((team.reduce((a, b) => a + (b.workload ?? 0), 0) / total) * 10) / 10 : 0;
    const highLoadCount = team.filter((m) => (m.workload ?? 0) >= 80).length;
    const payroll = team.reduce((a, b) => a + (b.monthlySalary ?? 0), 0);
    return { total, active, avgWorkload, highLoadCount, payroll };
  }, [team]);

  const vendorKpis = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter((v) => String(v.status || "").toLowerCase() !== "inactive").length;
    const rated = vendors.filter((v) => Number.isFinite(v.rating as any));
    const avgRating = rated.length ? +(rated.reduce((a, b) => a + (b.rating ?? 0), 0) / rated.length).toFixed(1) : 0;
    return { total, active, avgRating };
  }, [vendors]);

  const topVendorsForCity = useMemo(() => {
    const list = vendors
      .filter((v) => (v.city || "").toLowerCase().includes(eventCity.toLowerCase()) || !v.city)
      .slice()
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return list.slice(0, 8);
  }, [vendors, eventCity]);

  const aiBlocks: AIBlock[] = useMemo(() => {
    const blocks: AIBlock[] = [];

    const commonHeader = () => {
      blocks.push({ type: "title", text: `AI Tools • ${mode}` });
      blocks.push({ type: "text", text: `Range: ${from} → ${to}` });
      blocks.push({ type: "kpi", label: "Events", value: String(eventsInRange.length), tone: eventsInRange.length ? "ok" : "warn" });
      blocks.push({ type: "kpi", label: "Net", value: formatCurrency(finTotals.net, currency), tone: finTotals.net < 0 ? "danger" : "ok" });
      blocks.push({ type: "kpi", label: "Team Active", value: `${hrKpis.active}/${hrKpis.total}`, tone: hrKpis.total ? "ok" : "warn" });
      blocks.push({ type: "kpi", label: "Vendors", value: String(vendorKpis.total), tone: vendorKpis.total ? "ok" : "warn" });
      blocks.push({ type: "text", text: "" });
    };

    if (mode === "Executive Brief") {
      commonHeader();
      const bullets: string[] = [];
      if (finTotals.net < 0) bullets.push("Finance alert: Net is negative. Reduce expenses OR add missing income entries.");
      if (finTotals.burn >= 90) bullets.push("High burn ratio: Expenses close to income. Tighten vendor costs and misc spending.");
      if (hrKpis.highLoadCount > 0) bullets.push(`HR alert: ${hrKpis.highLoadCount} member(s) at high workload. Reassign tasks or hire freelancer.`);
      if (!eventsInRange.length) bullets.push("No events found in range. Confirm event dates are saved as YYYY-MM-DD.");
      blocks.push({ type: "bullets", title: "Auto Insights", items: bullets.length ? bullets : ["All good. No critical alerts detected."] });
    }

    if (mode === "Event Plan") {
      blocks.push({ type: "title", text: "AI Tools • Event Plan Generator" });
      blocks.push({ type: "bullets", title: "Inputs", items: [`Goal: ${eventGoal}`, `City: ${eventCity}`, `Budget: ${formatCurrency(eventBudget || 0, currency)}`, `Guests: ${eventGuests || 0}`] });

      const budget = Math.max(0, Number(eventBudget) || 0);
      const alloc: [string, number][] = [
        ["Venue", Math.round(budget * 0.25)],
        ["Catering", Math.round(budget * 0.35)],
        ["Decor", Math.round(budget * 0.12)],
        ["Photo/Video", Math.round(budget * 0.08)],
        ["Entertainment", Math.round(budget * 0.06)],
        ["Logistics", Math.round(budget * 0.06)],
        ["Contingency", Math.round(budget * 0.08)],
      ];

      blocks.push({
        type: "table",
        title: "Suggested Budget Allocation",
        columns: ["Category", "Amount"],
        rows: alloc.map(([c, a]) => [c, formatCurrency(a, currency)]),
      });

      blocks.push({
        type: "table",
        title: "Recommended Vendors (Top Rated)",
        columns: ["Vendor", "Category", "City", "Rating", "Phone"],
        rows: topVendorsForCity.slice(0, 6).map((v) => [v.name, v.category || "—", v.city || "—", typeof v.rating === "number" ? v.rating : "—", v.phone || "—"]),
      });
    }

    if (mode === "Finance Insights") {
      commonHeader();
      blocks.push({
        type: "bullets",
        title: "Finance Actions (Auto)",
        items: [
          finTotals.net < 0 ? "Net negative: check missing income entries and reduce vendor expenses." : "Net positive: keep expense controls tight.",
          finTotals.burn >= 90 ? "Burn is high: renegotiate vendor costs or reprice packages." : "Burn is healthy: keep current margin structure.",
        ],
      });
    }

    if (mode === "HR Planner") {
      commonHeader();
      blocks.push({
        type: "table",
        title: "High Workload (≥ 80%)",
        columns: ["Name", "Role", "Workload", "City"],
        rows: team
          .filter((m) => (m.workload ?? 0) >= 80)
          .slice(0, 10)
          .map((m) => [m.name, m.role || "—", `${m.workload ?? 0}%`, m.city || "—"]),
      });
    }

    if (mode === "Vendor Match") {
      blocks.push({ type: "title", text: "AI Tools • Vendor Match" });
      blocks.push({ type: "text", text: `City: ${eventCity} • Goal: ${eventGoal}` });
      blocks.push({
        type: "table",
        title: "Top Vendors",
        columns: ["Vendor", "Category", "City", "Rating"],
        rows: topVendorsForCity.map((v) => [v.name, v.category || "—", v.city || "—", typeof v.rating === "number" ? v.rating : "—"]),
      });
    }

    if (mode === "Report Writer") {
      commonHeader();
      blocks.push({
        type: "bullets",
        title: "Company Summary",
        items: [
          `Period: ${from} to ${to}`,
          `Events: ${eventsInRange.length}`,
          `Finance: Income ${formatCurrency(finTotals.income, currency)} • Expense ${formatCurrency(finTotals.expense, currency)} • Net ${formatCurrency(finTotals.net, currency)}`,
          `HR: Team ${hrKpis.total} • Active ${hrKpis.active} • Avg workload ${hrKpis.avgWorkload}%`,
          `Vendors: ${vendorKpis.total} • Active ${vendorKpis.active} • Avg rating ${vendorKpis.avgRating || "—"}`,
        ],
      });
    }

    return blocks;
  }, [mode, from, to, currency, eventsInRange.length, finTotals, hrKpis, vendorKpis, eventGoal, eventCity, eventBudget, eventGuests, topVendorsForCity, team]);

  const markdown = useMemo(() => blocksToMarkdown(aiBlocks), [aiBlocks]);

  async function onCopyMD() {
    const ok = await copyToClipboard(markdown);
    setMsg(ok ? "✅ Copied Markdown" : "❌ Copy failed (browser blocked)");
    window.setTimeout(() => setMsg(""), 1200);
  }
  function onExportMD() {
    exportText(`eventura_ai_${mode.replace(/\s+/g, "_").toLowerCase()}_${todayYMD()}.md`, markdown, "text/markdown;charset=utf-8");
    setMsg("✅ Exported Markdown");
    window.setTimeout(() => setMsg(""), 1200);
  }
  function onExportJSON() {
    exportJSON(`eventura_ai_${mode.replace(/\s+/g, "_").toLowerCase()}_${todayYMD()}.json`, {
      version: "eventura-ai-tools-v1",
      exportedAt: new Date().toISOString(),
      mode,
      range: { from, to },
      keysUsed: keysInfo,
      inputs: { eventGoal, eventCity, eventBudget, eventGuests, currency },
      markdown,
    });
    setMsg("✅ Exported JSON");
    window.setTimeout(() => setMsg(""), 1200);
  }
  function onExportRawCSV() {
    exportCSV(`eventura_ai_raw_events_${from}_to_${to}.csv`, eventsInRange as any);
    exportCSV(`eventura_ai_raw_finance_${from}_to_${to}.csv`, txsInRange as any);
    exportCSV(`eventura_ai_raw_hr_${todayYMD()}.csv`, team as any);
    exportCSV(`eventura_ai_raw_vendors_${todayYMD()}.csv`, vendors as any);
    setMsg("✅ Exported raw CSVs");
    window.setTimeout(() => setMsg(""), 1200);
  }

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          <div>
            <div style={S.brandName}>Eventura OS</div>
            <div style={S.brandSub}>AI Tools</div>
          </div>
        </div>

        <nav style={S.nav}>
          <Link href="/dashboard" style={S.navItem as any}>📊 Dashboard</Link>
          <Link href="/events" style={S.navItem as any}>📅 Events</Link>
          <Link href="/finance" style={S.navItem as any}>💰 Finance</Link>
          <Link href="/vendors" style={S.navItem as any}>🏷️ Vendors</Link>
          <Link href="/hr" style={S.navItem as any}>🧑‍🤝‍🧑 HR</Link>
          <Link href="/reports" style={S.navItem as any}>📈 Reports</Link>
          <Link href="/ai" style={{ ...(S.navItem as any), border: `1px solid ${T.accentBd}`, background: T.accentBg }}>🧠 AI Tools</Link>
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
            <div style={S.h1}>AI Tools Command Center</div>
            <div style={S.muted}>Advanced insights + Markdown/JSON export • Deploy-safe</div>
          </div>

          <div style={S.headerRight}>
            <button style={S.secondaryBtn} onClick={refreshRead}>Refresh</button>
            <button style={S.secondaryBtn} onClick={onCopyMD}>Copy MD</button>
            <button style={S.secondaryBtn} onClick={onExportMD}>Export MD</button>
            <button style={S.secondaryBtn} onClick={onExportJSON}>Export JSON</button>
            {isCEO ? <button style={S.secondaryBtn} onClick={onExportRawCSV}>Export Raw CSV</button> : null}
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        <div style={S.controls}>
          <div style={S.controlGrid}>
            <div style={S.controlBox}>
              <div style={S.smallMuted}>Tool Mode</div>
              <select style={S.select} value={mode} onChange={(e) => setMode(e.target.value as ToolMode)}>
                <option>Executive Brief</option>
                <option>Event Plan</option>
                <option>Finance Insights</option>
                <option>HR Planner</option>
                <option>Vendor Match</option>
                <option>Report Writer</option>
              </select>
            </div>

            <div style={S.controlBox}>
              <div style={S.smallMuted}>Currency</div>
              <select style={S.select} value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                <option value="INR">INR</option>
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
              </select>
            </div>

            <div style={S.controlBox}>
              <div style={S.smallMuted}>From</div>
              <input style={S.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>

            <div style={S.controlBox}>
              <div style={S.smallMuted}>To</div>
              <input style={S.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div style={S.subControls}>
            <div style={S.subTitle}>Planner Inputs (Event Plan / Vendor Match)</div>
            <div style={S.subGrid}>
              <div style={S.controlBox}>
                <div style={S.smallMuted}>Goal</div>
                <input style={S.inputWide} value={eventGoal} onChange={(e) => setEventGoal(e.target.value)} />
              </div>
              <div style={S.controlBox}>
                <div style={S.smallMuted}>City</div>
                <input style={S.inputWide} value={eventCity} onChange={(e) => setEventCity(e.target.value)} />
              </div>
              <div style={S.controlBox}>
                <div style={S.smallMuted}>Budget</div>
                <input style={S.inputWide} type="number" value={eventBudget} onChange={(e) => setEventBudget(Number(e.target.value || 0))} />
              </div>
              <div style={S.controlBox}>
                <div style={S.smallMuted}>Guests</div>
                <input style={S.inputWide} type="number" value={eventGuests} onChange={(e) => setEventGuests(Number(e.target.value || 0))} />
              </div>
            </div>
          </div>
        </div>

        <div style={S.grid}>
          <section style={S.panel}>
            <div style={S.panelTitle}>Formatted Output</div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {aiBlocks.map((b, idx) => {
                if (b.type === "title") return <div key={idx} style={S.bigTitle}>{b.text}</div>;
                if (b.type === "text") return <div key={idx} style={S.textLine}>{b.text}</div>;
                if (b.type === "kpi") {
                  const box = b.tone === "ok" ? S.kpiOk : b.tone === "warn" ? S.kpiWarn : b.tone === "danger" ? S.kpiDanger : S.kpi;
                  return (
                    <div key={idx} style={box}>
                      <div style={S.kpiLabel}>{b.label}</div>
                      <div style={S.kpiValue}>{b.value}</div>
                    </div>
                  );
                }
                if (b.type === "bullets") {
                  return (
                    <div key={idx} style={S.card}>
                      {b.title ? <div style={S.cardTitle}>{b.title}</div> : null}
                      <ul style={S.ul}>
                        {b.items.map((it, i) => (
                          <li key={i} style={S.li}>{it}</li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                if (b.type === "table") {
                  return (
                    <div key={idx} style={S.card}>
                      {b.title ? <div style={S.cardTitle}>{b.title}</div> : null}
                      <div style={S.tableWrap}>
                        <table style={S.table}>
                          <thead>
                            <tr>
                              {b.columns.map((c) => (
                                <th key={c} style={S.th}>{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {b.rows.map((r, ri) => (
                              <tr key={ri}>
                                {r.map((cell, ci) => (
                                  <td key={ci} style={S.td}>{String(cell)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </section>

          <section style={S.panel}>
            <div style={S.panelTitle}>Markdown Output</div>
            <textarea style={S.textarea} value={markdown} readOnly />
            <div style={S.smallNote}>Copy to Docs/Word to create a clean company report.</div>
          </section>
        </div>

        <div style={S.footerNote}>✅ Deploy-safe • ✅ No external API • ✅ Advanced formatting + exports</div>
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
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
    },
    sidebar: {
      width: 290,
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
    roleBadge: { marginTop: 10, display: "inline-flex", padding: "5px 10px", borderRadius: 999, background: T.accentBg, border: `1px solid ${T.accentBd}`, color: T.accentTx, fontWeight: 950, width: "fit-content" },

    main: { flex: 1, padding: 16, maxWidth: 1500, margin: "0 auto", width: "100%" },
    header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: 12, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    headerRight: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },

    h1: { fontSize: 26, fontWeight: 950 },
    muted: { color: T.muted, fontSize: 13, marginTop: 6 },
    smallMuted: { color: T.muted, fontSize: 12 },
    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35, marginTop: 10 },

    msg: { marginTop: 12, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontSize: 13 },

    secondaryBtn: { padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontWeight: 950, cursor: "pointer", whiteSpace: "nowrap" },

    controls: { marginTop: 12, padding: 12, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },
    controlGrid: { display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1fr 1fr", gap: 12 },
    controlBox: { display: "grid", gap: 6 },

    subControls: { marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` },
    subTitle: { fontWeight: 950, color: T.accentTx, marginBottom: 10 },
    subGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 },

    input: { width: "100%", padding: compact ? "10px 10px" : "12px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, outline: "none", fontSize: 14 },
    inputWide: { width: "100%", padding: compact ? "10px 10px" : "12px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, outline: "none", fontSize: 14 },
    select: { width: "100%", padding: compact ? "10px 10px" : "12px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, outline: "none", fontSize: 14, fontWeight: 800 },

    grid: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    panel: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    bigTitle: { fontSize: 18, fontWeight: 950, padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    textLine: { padding: "8px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, fontWeight: 850 },

    kpi: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    kpiOk: { padding: 12, borderRadius: 16, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx },
    kpiWarn: { padding: 12, borderRadius: 16, border: `1px solid ${T.warnBd}`, background: T.warnBg, color: T.warnTx },
    kpiDanger: { padding: 12, borderRadius: 16, border: `1px solid ${T.dangerBd}`, background: T.dangerBg, color: T.dangerTx },
    kpiLabel: { fontSize: 12, fontWeight: 900, opacity: 0.9 },
    kpiValue: { marginTop: 6, fontSize: 18, fontWeight: 950 },

    card: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    cardTitle: { fontWeight: 950, marginBottom: 8 },
    ul: { margin: 0, paddingLeft: 18, display: "grid", gap: 6 },
    li: { fontWeight: 800 },

    tableWrap: { overflowX: "auto", borderRadius: 14, border: `1px solid ${T.border}` },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
    th: { textAlign: "left", padding: 10, borderBottom: `1px solid ${T.border}`, fontWeight: 950 },
    td: { padding: 10, borderBottom: `1px solid ${T.border}`, fontWeight: 800, color: T.text },

    textarea: {
      marginTop: 12,
      width: "100%",
      minHeight: 520,
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 13,
      lineHeight: 1.5,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      resize: "vertical",
    },

    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 10 },
  };
}
