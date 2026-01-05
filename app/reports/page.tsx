"use client";

import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ================== STORAGE (DO NOT TOUCH OTHER PAGES) ==================
   Reports will try multiple keys and pick the FIRST one that exists.
*/
const EVENT_KEYS = ["eventura-events", "eventura_os_events_v1", "eventura_events_v1"];
const FIN_KEYS = ["eventura-finance-transactions", "eventura_os_fin_v1", "eventura_fin_v1", "eventura_os_fin_tx_v1"];
const HR_KEYS = ["eventura-hr-team", "eventura_os_hr_v1", "eventura_hr_v1", "eventura_os_hr_team_v2"];
const VENDOR_KEYS = ["eventura-vendors", "eventura_os_vendors_v1", "eventura_vendors_v1", "eventura-vendor-list"];

const LS_SETTINGS = "eventura_os_settings_v3"; // optional (if exists)

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

type KeysInfo = {
  events: string | null;
  finance: string | null;
  hr: string | null;
  vendors: string | null;
};

/* ================== SAFE STORAGE HELPERS ================== */
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
    const raw = window.localStorage.getItem(k);
    if (!raw) continue;
    const parsed = safeParse<T>(raw, fallback);
    if (parsed && (Array.isArray(parsed) || typeof parsed === "object")) {
      return { keyUsed: k, data: parsed };
    }
  }
  return { keyUsed: null, data: fallback };
}

function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return safeParse<T>(window.localStorage.getItem(key), fallback);
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

function exportJSON(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================== NORMALIZERS (FLEXIBLE) ================== */
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

/* ================== THEME TOKENS (SAFE) ================== */
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

/* ================== UI SMALL ================== */
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

/* ================== PAGE ================== */
export default function ReportsPage() {
  const [settings, setSettings] = useState<AppSettings>({});
  const [email, setEmail] = useState("");
  const [keysInfo, setKeysInfo] = useState<KeysInfo>({ events: null, finance: null, hr: null, vendors: null });

  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [rawFin, setRawFin] = useState<any[]>([]);
  const [rawHR, setRawHR] = useState<any[]>([]);
  const [rawVendors, setRawVendors] = useState<any[]>([]);

  const [from, setFrom] = useState(isoMinusDays(30));
  const [to, setTo] = useState(todayYMD());
  const [msg, setMsg] = useState("");

  // ✅ deploy-safe timer handling (avoids DOM vs Node Timeout type errors)
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setEmail(window.localStorage.getItem("eventura_email") || "");
    setSettings(safeLoad<AppSettings>(LS_SETTINGS, {}));
    refreshRead();

    return () => {
      if (msgTimer.current) clearTimeout(msgTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flash(text: string) {
    setMsg(text);
    if (typeof window === "undefined") return;
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(""), 1500);
  }

  function refreshRead() {
    if (typeof window === "undefined") return;

    const e = loadFirstKey<any[]>(EVENT_KEYS, []);
    const f = loadFirstKey<any[]>(FIN_KEYS, []);
    const h = loadFirstKey<any[]>(HR_KEYS, []);
    const v = loadFirstKey<any[]>(VENDOR_KEYS, []);

    setKeysInfo({ events: e.keyUsed, finance: f.keyUsed, hr: h.keyUsed, vendors: v.keyUsed });
    setRawEvents(Array.isArray(e.data) ? e.data : []);
    setRawFin(Array.isArray(f.data) ? f.data : []);
    setRawHR(Array.isArray(h.data) ? h.data : []);
    setRawVendors(Array.isArray(v.data) ? v.data : []);

    flash("✅ Refreshed data from storage");
  }

  const ceoEmail = (settings.ceoEmail || "hardikvekariya799@gmail.com").toLowerCase();
  const isCEO = useMemo(() => (email || "").toLowerCase() === ceoEmail, [email, ceoEmail]);

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
    const avgWorkload =
      total === 0
        ? 0
        : Math.round(
            (team.reduce((a, b) => a + (Number.isFinite(b.workload as any) ? (b.workload as number) : 0), 0) / total) * 10
          ) / 10;
    const payroll = team.reduce((a, b) => a + (Number.isFinite(b.monthlySalary as any) ? (b.monthlySalary as number) : 0), 0);
    const highLoad = team.filter((m) => (m.workload ?? 0) >= 80).length;
    return { total, active, avgWorkload, payroll, highLoad };
  }, [team]);

  const vendorKpis = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter((v) => String(v.status || "").toLowerCase() !== "inactive").length;
    const rated = vendors.filter((v) => Number.isFinite(v.rating as any));
    const avgRating = rated.length ? +(rated.reduce((a, b) => a + (b.rating ?? 0), 0) / rated.length).toFixed(1) : 0;
    return { total, active, avgRating };
  }, [vendors]);

  const execSummary = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Range: ${from} → ${to}`);
    lines.push(`Events: ${eventsInRange.length}${eventStatus[0] ? ` (Top: ${eventStatus[0][0]} • ${eventStatus[0][1]})` : ""}`);
    lines.push(`Finance Net: ${formatCurrency(finTotals.net)} (Income ${formatCurrency(finTotals.income)} • Expense ${formatCurrency(finTotals.expense)})`);
    lines.push(`HR: ${hrKpis.total} team • ${hrKpis.active} active • Avg workload ${hrKpis.avgWorkload}%${hrKpis.highLoad ? ` • ⚠ High load: ${hrKpis.highLoad}` : ""}`);
    if (hrKpis.payroll > 0) lines.push(`Estimated monthly payroll: ${formatCurrency(hrKpis.payroll)}`);
    lines.push(`Vendors: ${vendorKpis.total} total • ${vendorKpis.active} active • Avg rating ${vendorKpis.avgRating || "—"}`);
    if (!events.length && !txs.length && !team.length && !vendors.length) lines.push(`No data found yet. Add at least 1 record in each module so Reports can read it.`);
    return lines;
  }, [from, to, eventsInRange.length, eventStatus, finTotals, hrKpis, vendorKpis, events.length, txs.length, team.length, vendors.length]);

  function exportAllJSON() {
    exportJSON(`eventura_company_report_${from}_to_${to}.json`, {
      version: "eventura-reports-v1",
      exportedAt: new Date().toISOString(),
      range: { from, to },
      keysUsed: keysInfo,
      summary: execSummary,
      data: { events: eventsInRange, finance: txsInRange, hr: team, vendors },
    });
    flash("✅ Exported JSON");
  }

  function exportAllCSV() {
    const rows = [
      { section: "SUMMARY", item: "Range", value: `${from} → ${to}` },
      { section: "SUMMARY", item: "Events", value: eventsInRange.length },
      { section: "SUMMARY", item: "Finance Net", value: finTotals.net },
      { section: "SUMMARY", item: "Team", value: hrKpis.total },
      { section: "SUMMARY", item: "Vendors", value: vendorKpis.total },
      { section: "SUMMARY", item: "High Workload", value: hrKpis.highLoad },
    ];
    exportCSV(`eventura_company_overview_${from}_to_${to}.csv`, rows);
    flash("✅ Exported CSV");
  }

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          <div>
            <div style={S.brandName}>Eventura OS</div>
            <div style={S.brandSub}>Reports</div>
          </div>
        </div>

        <nav style={S.nav}>
          <Link href="/dashboard" style={S.navItem as any}>📊 Dashboard</Link>
          <Link href="/events" style={S.navItem as any}>📅 Events</Link>
          <Link href="/finance" style={S.navItem as any}>💰 Finance</Link>
          <Link href="/vendors" style={S.navItem as any}>🏷️ Vendors</Link>
          <Link href="/hr" style={S.navItem as any}>🧑‍🤝‍🧑 HR</Link>
          <Link href="/reports" style={{ ...(S.navItem as any), border: `1px solid ${T.accentBd}`, background: T.accentBg }}>
            📈 Reports
          </Link>
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
            <div style={S.h1}>Company Reports</div>
            <div style={S.muted}>Connected to Events + Finance + HR + Vendors (read-only) • Export JSON/CSV • Deploy-safe</div>
          </div>

          <div style={S.headerRight}>
            <button style={S.secondaryBtn} onClick={refreshRead}>Refresh</button>
            <button style={S.secondaryBtn} onClick={exportAllJSON}>Export JSON</button>
            <button style={S.secondaryBtn} onClick={exportAllCSV}>Export CSV</button>
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

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
            <div style={S.smallNote}>
              Tip: Reports uses <b>YYYY-MM-DD</b> dates stored in Events/Finance.
            </div>
          </div>
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
              <KPI label="Events" value={String(eventsInRange.length)} S={S} />
              <KPI label="Net" value={formatCurrency(finTotals.net)} S={S} />
              <KPI label="Team" value={String(hrKpis.total)} S={S} />
              <KPI label="Vendors" value={String(vendorKpis.total)} S={S} />
            </div>
            <div style={S.smallNote}>HR/Vendors usually don’t have dates → shown as overall totals. Events/Finance follow the range.</div>
          </section>

          <section style={S.panel}>
            <div style={S.panelTitle}>Events Report</div>
            {!eventsInRange.length ? (
              <div style={S.muted}>No events found in this range.</div>
            ) : (
              <>
                <div style={S.sectionTitle}>Status breakdown</div>
                <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                  {eventStatus.slice(0, 8).map(([st, c]) => (
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

                {isCEO ? (
                  <div style={S.rowBetween}>
                    <div style={S.smallNote}>Export events as CSV</div>
                    <button style={S.secondaryBtn} onClick={() => exportCSV(`eventura_events_${from}_to_${to}.csv`, eventsInRange)}>
                      Export Events CSV
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section style={S.panel}>
            <div style={S.panelTitle}>Finance Report</div>
            <div style={S.kpiRow}>
              <KPI label="Income" value={formatCurrency(finTotals.income)} S={S} />
              <KPI label="Expense" value={formatCurrency(finTotals.expense)} S={S} />
              <KPI label="Net" value={formatCurrency(finTotals.net)} S={S} />
              <KPI label="Tx Count" value={String(txsInRange.length)} S={S} />
            </div>

            <div style={S.sectionTitle}>Recent transactions</div>
            {!txsInRange.length ? (
              <div style={S.muted}>No finance transactions in this range.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {txsInRange
                  .slice()
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .slice(0, 10)
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
              </div>
            )}

            {isCEO ? (
              <div style={S.rowBetween}>
                <div style={S.smallNote}>Export finance as CSV</div>
                <button style={S.secondaryBtn} onClick={() => exportCSV(`eventura_finance_${from}_to_${to}.csv`, txsInRange)}>
                  Export Finance CSV
                </button>
              </div>
            ) : null}
          </section>

          <section style={S.panel}>
            <div style={S.panelTitle}>HR Report</div>
            <div style={S.kpiRow}>
              <KPI label="Total Staff" value={String(hrKpis.total)} S={S} />
              <KPI label="Active" value={String(hrKpis.active)} S={S} />
              <KPI label="Avg Workload" value={`${hrKpis.avgWorkload}%`} S={S} />
              <KPI label="High Workload" value={String(hrKpis.highLoad)} S={S} />
            </div>

            {hrKpis.payroll > 0 ? <div style={S.noteBox}>Estimated Monthly Payroll: {formatCurrency(hrKpis.payroll)}</div> : null}

            <div style={S.sectionTitle}>High workload (>= 80%)</div>
            {team.filter((m) => (m.workload ?? 0) >= 80).length ? (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {team
                  .filter((m) => (m.workload ?? 0) >= 80)
                  .slice(0, 8)
                  .map((m) => (
                    <div key={m.id} style={S.itemCard}>
                      <div style={S.rowBetween}>
                        <div style={{ fontWeight: 950 }}>{m.name}</div>
                        <span style={S.pill}>{(m.workload ?? 0) + "%"}</span>
                      </div>
                      <div style={S.smallMuted}>{m.role || "—"} • {m.city || "—"} • {m.status || "—"}</div>
                    </div>
                  ))}
              </div>
            ) : (
              <div style={S.muted}>No one above 80% workload.</div>
            )}

            {isCEO ? (
              <div style={S.rowBetween}>
                <div style={S.smallNote}>Export HR list as CSV</div>
                <button style={S.secondaryBtn} onClick={() => exportCSV(`eventura_hr_${todayYMD()}.csv`, team)}>
                  Export HR CSV
                </button>
              </div>
            ) : null}
          </section>

          <section style={S.panel}>
            <div style={S.panelTitle}>Vendors Report</div>
            <div style={S.kpiRow}>
              <KPI label="Total" value={String(vendorKpis.total)} S={S} />
              <KPI label="Active" value={String(vendorKpis.active)} S={S} />
              <KPI label="Avg Rating" value={vendorKpis.avgRating ? String(vendorKpis.avgRating) : "—"} S={S} />
              <KPI label="Cities" value={String(new Set(vendors.map((v) => v.city || "—")).size)} S={S} />
            </div>

            <div style={S.sectionTitle}>Top rated vendors</div>
            {vendors.filter((v) => Number.isFinite(v.rating as any)).length ? (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {vendors
                  .filter((v) => Number.isFinite(v.rating as any))
                  .slice()
                  .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
                  .slice(0, 8)
                  .map((v) => (
                    <div key={v.id} style={S.itemCard}>
                      <div style={S.rowBetween}>
                        <div style={{ fontWeight: 950 }}>{v.name}</div>
                        <span style={S.pill}>{typeof v.rating === "number" ? `⭐ ${v.rating}` : "—"}</span>
                      </div>
                      <div style={S.smallMuted}>{v.category || "—"} • {v.city || "—"} • {v.phone || "—"}</div>
                    </div>
                  ))}
              </div>
            ) : (
              <div style={S.muted}>No vendor ratings found yet.</div>
            )}

            {isCEO ? (
              <div style={S.rowBetween}>
                <div style={S.smallNote}>Export vendor list as CSV</div>
                <button style={S.secondaryBtn} onClick={() => exportCSV(`eventura_vendors_${todayYMD()}.csv`, vendors)}>
                  Export Vendors CSV
                </button>
              </div>
            ) : null}
          </section>
        </div>

        <div style={S.footerNote}>✅ Connected reports (read-only) • ✅ No changes to other tabs • ✅ Deploy-safe</div>
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
    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35 },
    msg: { marginTop: 12, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontSize: 13 },
    rangeBar: { marginTop: 12, padding: 12, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft, display: "grid", gap: 10 },
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
    panel: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
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
    summaryLine: { padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, fontWeight: 900, color: T.text },
    barRow: { display: "grid", gridTemplateColumns: "1fr 2fr 50px", gap: 10, alignItems: "center" },
    barWrap: { height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" },
    barFill: { height: "100%", borderRadius: 999, background: T.accentTx, opacity: 0.9 },
    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 10 },
  };
}
