"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ================== STORAGE KEYS (NO UI DEBUG) ================== */
const LS_EMAIL = "eventura_email";
const LS_SETTINGS = "eventura_os_settings_v3";

const EVENT_KEYS = ["eventura-events", "eventura_os_events_v1", "eventura_events_v1"];
const FIN_KEYS = ["eventura-finance-transactions", "eventura_os_fin_v1", "eventura_fin_v1", "eventura_os_fin_tx_v1"];
const HR_KEYS = ["eventura-hr-team", "eventura_os_hr_v1", "eventura_hr_v1", "eventura_os_hr_team_v2"];
const VENDOR_KEYS = ["eventura-vendors", "eventura_os_vendors_v1", "eventura_vendors_v1", "eventura-vendor-list"];

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

/* ================== NORMALIZERS ================== */
function normalizeEvents(raw: any): NormalEvent[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? `${x?.title ?? x?.name ?? "event"}-${x?.date ?? ""}`);
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
      const id = String(x?.id ?? x?._id ?? x?.name ?? Math.random().toString(16).slice(2));
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
      const id = String(x?.id ?? x?._id ?? x?.name ?? Math.random().toString(16).slice(2));
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

/* ================== THEME TOKENS (SAME FAMILY AS REPORTS) ================== */
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
    hoverBlack: "rgba(0,0,0,0.55)", // ✅ strong black hover
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
        hoverBlack: "rgba(0,0,0,0.08)",
      };
    default:
      return { ...base, glow1: "rgba(255,215,110,0.18)", glow2: "rgba(120,70,255,0.18)", accentBg: "rgba(212,175,55,0.12)", accentBd: hc ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)", accentTx: "#FDE68A" };
  }
}

/* ================== UI HELPERS ================== */
function Chip({ text, tone, S, T }: { text: string; tone: "ok" | "warn" | "bad" | "neutral"; S: any; T: any }) {
  const st =
    tone === "ok" ? S.chipOk : tone === "bad" ? S.chipBad : tone === "warn" ? S.chipWarn : S.chip;
  return <span style={st}>{text}</span>;
}

function Stat({ label, value, sub, S }: { label: string; value: string; sub?: string; S: any }) {
  return (
    <div style={S.statCard}>
      <div style={S.statLabel}>{label}</div>
      <div style={S.statValue}>{value}</div>
      {sub ? <div style={S.statSub}>{sub}</div> : null}
    </div>
  );
}

function HoverLink({
  href,
  active,
  icon,
  label,
  S,
  hoverKey,
  hovered,
  setHovered,
}: {
  href: string;
  active?: boolean;
  icon: string;
  label: string;
  S: any;
  hoverKey: string;
  hovered: string | null;
  setHovered: (v: string | null) => void;
}) {
  const isHover = hovered === hoverKey;
  const style = active
    ? S.navActive
    : isHover
    ? S.navHover
    : S.navItem;

  return (
    <Link
      href={href}
      style={style as any}
      onMouseEnter={() => setHovered(hoverKey)}
      onMouseLeave={() => setHovered(null)}
    >
      <span style={S.navIcon}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

/* ================== PAGE ================== */
export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<AppSettings>({});
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  const [from, setFrom] = useState(isoMinusDays(30));
  const [to, setTo] = useState(todayYMD());

  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [rawFin, setRawFin] = useState<any[]>([]);
  const [rawHR, setRawHR] = useState<any[]>([]);
  const [rawVendors, setRawVendors] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEmail(localStorage.getItem(LS_EMAIL) || "");
    setSettings(safeLoad<AppSettings>(LS_SETTINGS, {}));
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    const e = loadFirstKey<any[]>(EVENT_KEYS, []);
    const f = loadFirstKey<any[]>(FIN_KEYS, []);
    const h = loadFirstKey<any[]>(HR_KEYS, []);
    const v = loadFirstKey<any[]>(VENDOR_KEYS, []);
    setRawEvents(Array.isArray(e.data) ? e.data : []);
    setRawFin(Array.isArray(f.data) ? f.data : []);
    setRawHR(Array.isArray(h.data) ? h.data : []);
    setRawVendors(Array.isArray(v.data) ? v.data : []);
    setMsg("✅ Dashboard refreshed");
    setTimeout(() => setMsg(""), 1200);
  }

  const isCEO = useMemo(() => {
    const ceo = (settings.ceoEmail || "hardikvekariya799@gmail.com").toLowerCase();
    return (email || "").toLowerCase() === ceo;
  }, [email, settings.ceoEmail]);

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

  const pipeline = useMemo(() => {
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
      total === 0
        ? 0
        : Math.round(
            (team.reduce((a, b) => a + (Number.isFinite(b.workload as any) ? (b.workload as number) : 0), 0) / total) * 10
          ) / 10;
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

  const insights = useMemo(() => {
    const lines: { tone: "ok" | "warn" | "bad"; text: string }[] = [];
    if (finTotals.net < 0) lines.push({ tone: "bad", text: "Cashflow is negative in the selected range. Review expenses." });
    else lines.push({ tone: "ok", text: "Cashflow looks healthy for the selected range." });

    if (hrKpis.highLoad > 0) lines.push({ tone: "warn", text: `High workload: ${hrKpis.highLoad} team member(s) ≥ 80%.` });
    else lines.push({ tone: "ok", text: "Team workload is balanced." });

    const planned = pipeline.find(([s]) => s.toLowerCase().includes("plan") || s.toLowerCase().includes("tent"));
    if (planned && planned[1] >= 3) lines.push({ tone: "warn", text: "Many events are still planned/tentative. Confirm them." });

    if (!events.length && !txs.length && !team.length && !vendors.length) {
      lines.push({ tone: "warn", text: "No data found yet. Add events/finance/hr/vendors to see metrics." });
    }
    return lines.slice(0, 5);
  }, [finTotals.net, hrKpis.highLoad, pipeline, events.length, txs.length, team.length, vendors.length]);

  return (
    <div style={S.app}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          <div>
            <div style={S.brandName}>Eventura</div>
            <div style={S.brandSub}>Company Dashboard</div>
          </div>
        </div>

        <nav style={S.nav}>
          <HoverLink href="/dashboard" active icon="📊" label="Dashboard" S={S} hoverKey="dash" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/events" icon="📅" label="Events" S={S} hoverKey="events" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/finance" icon="💰" label="Finance" S={S} hoverKey="fin" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/vendors" icon="🏷️" label="Vendors" S={S} hoverKey="vendors" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/hr" icon="🧑‍🤝‍🧑" label="HR" S={S} hoverKey="hr" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/reports" icon="📈" label="Reports" S={S} hoverKey="reports" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/settings" icon="⚙️" label="Settings" S={S} hoverKey="settings" hovered={hoveredNav} setHovered={setHoveredNav} />
        </nav>

        <div style={S.sidebarFooter}>
          <div style={S.userBox}>
            <div style={S.userLabel}>Signed in</div>
            <div style={S.userEmail}>{email || "Unknown"}</div>
            <div style={S.roleBadge}>{isCEO ? "CEO" : "Staff"}</div>
          </div>

          <div style={S.footerBrand}>
            Founder: Hardik Vekariya • Co-Founder: Shubh Parekh • Digital Head: Dixit Bhuva
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={S.h1}>Company Command Center</div>
            <div style={S.muted}>
              Clean executive view • No tech/debug text • Black hover • Theme-aware • Deploy-safe
            </div>
          </div>

          <div style={S.headerRight}>
            <div style={S.rangeBox}>
              <div style={S.smallMuted}>From</div>
              <input style={S.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div style={S.rangeBox}>
              <div style={S.smallMuted}>To</div>
              <input style={S.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <button style={S.primaryBtn} onClick={refresh}>Refresh</button>
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* KPI Row */}
        <div style={S.kpiGrid}>
          <Stat label="Events (range)" value={String(eventsInRange.length)} sub={pipeline[0] ? `Top: ${pipeline[0][0]} (${pipeline[0][1]})` : "—"} S={S} />
          <Stat label="Net Cashflow" value={formatCurrency(finTotals.net)} sub={`Income ${formatCurrency(finTotals.income)} • Expense ${formatCurrency(finTotals.expense)}`} S={S} />
          <Stat label="Team" value={`${hrKpis.active}/${hrKpis.total}`} sub={`Avg workload ${hrKpis.avgWorkload}%`} S={S} />
          <Stat label="Vendors" value={String(vendorKpis.total)} sub={vendorKpis.avgRating ? `Avg rating ${vendorKpis.avgRating}` : "No ratings yet"} S={S} />
        </div>

        {/* Panels */}
        <div style={S.grid}>
          {/* Insights */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Executive Insights</div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {insights.map((x, i) => (
                <div key={i} style={S.insightRow}>
                  <Chip text={x.tone === "ok" ? "OK" : x.tone === "warn" ? "ATTN" : "RISK"} tone={x.tone} S={S} T={T} />
                  <div style={S.insightText}>{x.text}</div>
                </div>
              ))}
            </div>
            <div style={S.quickLinks}>
              <Link href="/reports" style={S.quickBtn as any}>Open Reports</Link>
              <Link href="/finance" style={S.quickBtn as any}>Review Finance</Link>
              <Link href="/events" style={S.quickBtn as any}>Manage Events</Link>
            </div>
          </section>

          {/* Pipeline */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Event Pipeline</div>
            {!pipeline.length ? (
              <div style={S.mutedBox}>No events in this range.</div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {pipeline.slice(0, 8).map(([st, c]) => {
                  const max = pipeline[0]?.[1] ?? c;
                  const pct = max ? Math.round((c / max) * 100) : 0;
                  return (
                    <div key={st} style={S.pipeRow}>
                      <div style={S.pipeTop}>
                        <div style={S.pipeLabel}>{st}</div>
                        <div style={S.pipeCount}>{c}</div>
                      </div>
                      <div style={S.pipeBarWrap}>
                        <div style={{ ...S.pipeBarFill, width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent Events */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Recent Events</div>
            {!eventsInRange.length ? (
              <div style={S.mutedBox}>No events found.</div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {eventsInRange
                  .slice()
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .slice(0, 7)
                  .map((e) => (
                    <div key={e.id} style={S.itemCard}>
                      <div style={S.rowBetween}>
                        <div style={S.itemTitle}>{e.title}</div>
                        <span style={S.pill}>{e.status}</span>
                      </div>
                      <div style={S.smallMuted}>
                        {e.date} • {e.city || "—"} {typeof e.budget === "number" ? `• Budget ${formatCurrency(e.budget)}` : ""}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* Recent Finance */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Recent Finance</div>
            {!txsInRange.length ? (
              <div style={S.mutedBox}>No transactions found.</div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {txsInRange
                  .slice()
                  .sort((a, b) => (a.date < b.date ? 1 : -1))
                  .slice(0, 8)
                  .map((t) => (
                    <div key={t.id} style={S.itemCard}>
                      <div style={S.rowBetween}>
                        <div style={S.itemTitle}>
                          {t.type} • {t.category || "General"}
                        </div>
                        <span style={S.pill}>{formatCurrency(t.amount)}</span>
                      </div>
                      <div style={S.smallMuted}>
                        {t.date} {t.vendor ? `• ${t.vendor}` : ""} {t.note ? `• ${t.note}` : ""}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </div>

        <div style={S.footerNote}>✅ Professional UI • ✅ Theme applied • ✅ Black hover • ✅ Deploy-safe</div>
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
      width: 40,
      height: 40,
      borderRadius: 14,
      display: "grid",
      placeItems: "center",
      fontWeight: 950,
      background: `linear-gradient(135deg, ${T.accentBg}, rgba(255,255,255,0.06))`,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
    },
    brandName: { fontWeight: 950, lineHeight: 1.1 },
    brandSub: { color: T.muted, fontSize: 12, marginTop: 2 },

    nav: { display: "grid", gap: 8, marginTop: 6 },
    navIcon: { width: 22, display: "inline-block" },

    navItem: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 12px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.border}`,
      background: T.soft,
      fontWeight: 900,
      fontSize: 13,
      transition: "background 120ms ease, transform 120ms ease",
    },

    navHover: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 12px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.border}`,
      background: T.hoverBlack, // ✅ BLACK HOVER (not transparent)
      fontWeight: 900,
      fontSize: 13,
      transform: "translateY(-1px)",
    },

    navActive: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 12px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.accentBd}`,
      background: T.accentBg,
      fontWeight: 950,
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
    footerBrand: { color: T.muted, fontSize: 11, lineHeight: 1.4, padding: "0 6px" },

    main: { flex: 1, padding: 16, maxWidth: 1500, margin: "0 auto", width: "100%" },

    header: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel,
      backdropFilter: "blur(10px)",
    },
    headerRight: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "end" },

    h1: { fontSize: 26, fontWeight: 950 },
    muted: { color: T.muted, fontSize: 13, marginTop: 6 },
    smallMuted: { color: T.muted, fontSize: 12 },

    rangeBox: { display: "grid", gap: 6 },

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

    primaryBtn: {
      padding: "12px 14px",
      borderRadius: 14,
      border: `1px solid ${T.accentBd}`,
      background: T.accentBg,
      color: T.accentTx,
      fontWeight: 950,
      cursor: "pointer",
    },

    msg: { marginTop: 12, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontSize: 13 },

    kpiGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
    statCard: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    statLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    statValue: { marginTop: 8, fontSize: 20, fontWeight: 950 },
    statSub: { marginTop: 6, color: T.muted, fontSize: 12, lineHeight: 1.3 },

    grid: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

    panel: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    mutedBox: { marginTop: 12, padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft, color: T.muted, fontWeight: 800 },

    insightRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft },
    insightText: { fontWeight: 850, lineHeight: 1.35, fontSize: 13 },

    chip: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.border}`, fontWeight: 950, fontSize: 12, background: "transparent" },
    chipOk: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.okBd}`, fontWeight: 950, fontSize: 12, background: T.okBg, color: T.okTx },
    chipWarn: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.accentBd}`, fontWeight: 950, fontSize: 12, background: T.accentBg, color: T.accentTx },
    chipBad: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.dangerBd}`, fontWeight: 950, fontSize: 12, background: T.dangerBg, color: T.dangerTx },

    quickLinks: { marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" },
    quickBtn: { padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, textDecoration: "none", fontWeight: 950 },

    pipeRow: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    pipeTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
    pipeLabel: { fontWeight: 950 },
    pipeCount: { fontWeight: 950, color: T.muted },
    pipeBarWrap: { marginTop: 10, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" },
    pipeBarFill: { height: "100%", borderRadius: 999, background: T.accentTx, opacity: 0.9 },

    itemCard: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
    itemTitle: { fontWeight: 950 },

    pill: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },

    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 10 },
  };
}
