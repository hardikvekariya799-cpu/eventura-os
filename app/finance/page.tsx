"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ================== STORAGE KEYS ================== */
const LS_EMAIL = "eventura_email";
const LS_SETTINGS = "eventura_os_settings_v3";

// Read multiple keys for compatibility
const FIN_KEYS_READ = [
  "eventura-finance-transactions",
  "eventura_os_fin_v1",
  "eventura_fin_v1",
  "eventura_os_fin_tx_v1",
];
const FIN_KEY_WRITE = "eventura-finance-transactions";

// Optional finance “extra” settings for Balance Sheet fields etc.
const FIN_META_KEY = "eventura_fin_meta_v1";

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

type TxType = "Income" | "Expense";
type PayMethod = "Cash" | "UPI" | "Bank" | "Card" | "Cheque" | "Other";

type FinanceTx = {
  id: string;
  date: string; // YYYY-MM-DD
  type: TxType;
  amount: number; // positive
  category: string;
  vendor?: string;
  note?: string;
  method?: PayMethod;
  taxPct?: number; // 0-100
  tags?: string; // comma separated
  createdAt: string;
  updatedAt: string;
};

type RecurringRule = {
  id: string;
  label: string;
  enabled: boolean;
  freq: "Weekly" | "Monthly";
  // template tx
  type: TxType;
  amount: number;
  category: string;
  vendor?: string;
  note?: string;
  method?: PayMethod;
  taxPct?: number;
  tags?: string;
  // generation control
  lastRun?: string; // YYYY-MM-DD
};

type FinanceMeta = {
  currency?: "INR" | "CAD" | "USD";
  openingCash?: number; // starting cash estimate
  receivables?: number; // money to receive
  payables?: number; // money to pay
  recurring?: RecurringRule[];
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
function writeFin(list: FinanceTx[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FIN_KEY_WRITE, JSON.stringify(list));
}
function writeMeta(meta: FinanceMeta) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FIN_META_KEY, JSON.stringify(meta));
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function nowISO() {
  return new Date().toISOString();
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
  return dateStr >= from && dateStr <= to; // YYYY-MM-DD lexicographic works
}
function clampNum(n: any, min: number, max: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}
function formatMoney(amount: number, currency: "INR" | "CAD" | "USD") {
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

/* ================== NORMALIZER ================== */
function normalizeFin(raw: any): FinanceTx[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: FinanceTx[] = [];

  for (const x of arr) {
    const id = String(x?.id ?? x?._id ?? uid());
    const date = String(x?.date ?? x?.txDate ?? "").slice(0, 10);
    if (!date) continue;

    const t = String(x?.type ?? "").toLowerCase();
    const type: TxType = t === "income" ? "Income" : "Expense";
    const amount = Number(x?.amount ?? x?.value ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const category = String(x?.category ?? "Uncategorized").trim() || "Uncategorized";
    const vendor = x?.vendor ? String(x.vendor) : undefined;
    const note = x?.note ? String(x.note) : x?.notes ? String(x.notes) : undefined;
    const method = x?.method ? (String(x.method) as PayMethod) : undefined;
    const taxPct = Number.isFinite(Number(x?.taxPct)) ? clampNum(x.taxPct, 0, 100, 0) : undefined;
    const tags = x?.tags ? String(x.tags) : undefined;

    out.push({
      id,
      date,
      type,
      amount,
      category,
      vendor,
      note,
      method,
      taxPct,
      tags,
      createdAt: String(x?.createdAt ?? nowISO()),
      updatedAt: String(x?.updatedAt ?? nowISO()),
    });
  }

  // de-dupe by id keep latest
  const m = new Map<string, FinanceTx>();
  for (const tx of out) {
    const prev = m.get(tx.id);
    if (!prev) m.set(tx.id, tx);
    else m.set(tx.id, prev.updatedAt >= tx.updatedAt ? prev : tx);
  }
  return Array.from(m.values());
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
    hoverBlack: "rgba(0,0,0,0.55)",
    dangerBg: "rgba(248,113,113,0.10)",
    dangerBd: hc ? "rgba(248,113,113,0.55)" : "rgba(248,113,113,0.30)",
    dangerTx: "#FCA5A5",
    okBg: "rgba(34,197,94,0.12)",
    okBd: hc ? "rgba(34,197,94,0.45)" : "rgba(34,197,94,0.28)",
    okTx: "#86EFAC",
    warnBg: "rgba(245,158,11,0.12)",
    warnBd: hc ? "rgba(245,158,11,0.45)" : "rgba(245,158,11,0.28)",
    warnTx: "#FCD34D",
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
        warnTx: "#92400E",
        hoverBlack: "rgba(0,0,0,0.08)",
      };
    default:
      return { ...base, glow1: "rgba(255,215,110,0.18)", glow2: "rgba(120,70,255,0.18)", accentBg: "rgba(212,175,55,0.12)", accentBd: hc ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)", accentTx: "#FDE68A" };
  }
}

/* ================== SMALL UI ================== */
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
  const style = active ? S.navActive : isHover ? S.navHover : S.navItem;

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

function Pill({ text, tone, S }: { text: string; tone: "ok" | "warn" | "bad" | "neutral"; S: any }) {
  const st = tone === "ok" ? S.pillOk : tone === "bad" ? S.pillBad : tone === "warn" ? S.pillWarn : S.pill;
  return <span style={st}>{text}</span>;
}

/* ================== PAGE ================== */
export default function FinancePage() {
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<AppSettings>({});
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const [keysUsed, setKeysUsed] = useState<string | null>(null);

  const [from, setFrom] = useState(isoMinusDays(30));
  const [to, setTo] = useState(todayYMD());

  const [txs, setTxs] = useState<FinanceTx[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TxType | "All">("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [vendorFilter, setVendorFilter] = useState<string>("All");

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [meta, setMeta] = useState<FinanceMeta>({
    currency: "INR",
    openingCash: 0,
    receivables: 0,
    payables: 0,
    recurring: [],
  });

  const [draft, setDraft] = useState<Partial<FinanceTx>>({
    date: todayYMD(),
    type: "Expense",
    amount: 0,
    category: "Operations",
    vendor: "",
    note: "",
    method: "UPI",
    taxPct: 0,
    tags: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEmail(localStorage.getItem(LS_EMAIL) || "");
    setSettings(safeLoad<AppSettings>(LS_SETTINGS, {}));
    const loadedMeta = safeLoad<FinanceMeta>(FIN_META_KEY, {
      currency: "INR",
      openingCash: 0,
      receivables: 0,
      payables: 0,
      recurring: [],
    });
    setMeta(loadedMeta);
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function hydrate() {
    const loaded = loadFirstKey<any[]>(FIN_KEYS_READ, []);
    setKeysUsed(loaded.keyUsed);
    const normalized = normalizeFin(loaded.data);
    normalized.sort((a, b) => (a.date < b.date ? 1 : -1));
    setTxs(normalized);
  }

  function persist(next: FinanceTx[], toast?: string) {
    setTxs(next);
    writeFin(next);
    if (toast) {
      setMsg(toast);
      setTimeout(() => setMsg(""), 1200);
    }
  }

  function persistMeta(next: FinanceMeta, toast?: string) {
    setMeta(next);
    writeMeta(next);
    if (toast) {
      setMsg(toast);
      setTimeout(() => setMsg(""), 1200);
    }
  }

  const isCEO = useMemo(() => {
    const ceo = (settings.ceoEmail || "hardikvekariya799@gmail.com").toLowerCase();
    return (email || "").toLowerCase() === ceo;
  }, [email, settings.ceoEmail]);

  const T = ThemeTokens((settings.theme as Theme) || "Royal Gold", settings.highContrast);
  const S = useMemo(() => makeStyles(T, !!settings.compactTables), [T, settings.compactTables]);

  const currency = (meta.currency || "INR") as "INR" | "CAD" | "USD";

  // Filters
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of txs) set.add(t.category || "Uncategorized");
    return Array.from(set).sort();
  }, [txs]);

  const vendors = useMemo(() => {
    const set = new Set<string>();
    for (const t of txs) if (t.vendor) set.add(t.vendor);
    return Array.from(set).sort();
  }, [txs]);

  const txsInRange = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txs.filter((t) => {
      if (!inRange(t.date, from, to)) return false;
      if (typeFilter !== "All" && t.type !== typeFilter) return false;
      if (categoryFilter !== "All" && (t.category || "Uncategorized") !== categoryFilter) return false;
      if (vendorFilter !== "All" && (t.vendor || "—") !== vendorFilter) return false;

      if (!q) return true;
      const blob = [
        t.type,
        t.category,
        t.vendor || "",
        t.note || "",
        t.method || "",
        t.tags || "",
        t.date,
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [txs, from, to, search, typeFilter, categoryFilter, vendorFilter]);

  // Totals
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let tax = 0;

    for (const t of txsInRange) {
      const taxPct = Number.isFinite(Number(t.taxPct)) ? clampNum(t.taxPct, 0, 100, 0) : 0;
      const taxAmt = (t.amount * taxPct) / 100;

      if (t.type === "Income") income += t.amount;
      else expense += t.amount;

      tax += taxAmt;
    }
    const net = income - expense;
    return { income, expense, net, tax };
  }, [txsInRange]);

  const daysCount = useMemo(() => {
    const a = new Date(from);
    const b = new Date(to);
    const diff = Math.max(1, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    return diff;
  }, [from, to]);

  const avgPerDay = useMemo(() => {
    return {
      income: totals.income / daysCount,
      expense: totals.expense / daysCount,
      net: totals.net / daysCount,
    };
  }, [totals, daysCount]);

  // Monthly P&L
  const monthly = useMemo(() => {
    const m = new Map<string, { income: number; expense: number }>();
    for (const t of txs) {
      const key = (t.date || "").slice(0, 7); // YYYY-MM
      if (!key) continue;
      const cur = m.get(key) || { income: 0, expense: 0 };
      if (t.type === "Income") cur.income += t.amount;
      else cur.expense += t.amount;
      m.set(key, cur);
    }
    const rows = Array.from(m.entries())
      .map(([month, v]) => ({ month, income: v.income, expense: v.expense, net: v.income - v.expense }))
      .sort((a, b) => (a.month < b.month ? 1 : -1));
    return rows.slice(0, 12);
  }, [txs]);

  // Category breakdown (range)
  const categoryBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txsInRange) {
      const key = t.category || "Uncategorized";
      m.set(key, (m.get(key) ?? 0) + t.amount * (t.type === "Expense" ? 1 : 0));
    }
    const rows = Array.from(m.entries())
      .map(([category, amount]) => ({ category, amount }))
      .filter((x) => x.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    return rows.slice(0, 10);
  }, [txsInRange]);

  // Vendor spend (range)
  const vendorSpend = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txsInRange) {
      if (t.type !== "Expense") continue;
      const key = t.vendor || "—";
      m.set(key, (m.get(key) ?? 0) + t.amount);
    }
    const rows = Array.from(m.entries())
      .map(([vendor, amount]) => ({ vendor, amount }))
      .sort((a, b) => b.amount - a.amount);
    return rows.slice(0, 10);
  }, [txsInRange]);

  // Cash estimate + runway (simple)
  const cashEstimate = useMemo(() => {
    const opening = Number(meta.openingCash || 0);
    const receivables = Number(meta.receivables || 0);
    const payables = Number(meta.payables || 0);

    // Apply all-time totals to estimate
    let allIncome = 0;
    let allExpense = 0;
    for (const t of txs) {
      if (t.type === "Income") allIncome += t.amount;
      else allExpense += t.amount;
    }

    const cash = opening + allIncome - allExpense + receivables - payables;

    // burn rate (use last 30 days expense avg)
    const last30From = isoMinusDays(30);
    const last30 = txs.filter((t) => inRange(t.date, last30From, todayYMD()));
    const burn = last30.reduce((a, b) => a + (b.type === "Expense" ? b.amount : 0), 0);
    const burnPerMonth = burn; // approx
    const runwayMonths = burnPerMonth > 0 ? cash / burnPerMonth : Infinity;

    return { cash, runwayMonths: runwayMonths < 0 ? 0 : runwayMonths, burnPerMonth };
  }, [meta.openingCash, meta.receivables, meta.payables, txs]);

  // “AI-like” insights (local)
  const insights = useMemo(() => {
    const lines: { tone: "ok" | "warn" | "bad"; text: string }[] = [];
    const net = totals.net;

    if (txs.length === 0) {
      lines.push({ tone: "warn", text: "No finance data found. Add income/expense to unlock reports + dashboards." });
      return lines;
    }

    if (net >= 0) lines.push({ tone: "ok", text: `Net profit in selected range is positive: ${formatMoney(net, currency)}.` });
    else lines.push({ tone: "bad", text: `Net is negative in selected range: ${formatMoney(net, currency)}. Reduce costs or increase sales.` });

    if (avgPerDay.expense > avgPerDay.income && totals.income > 0) {
      lines.push({ tone: "warn", text: "Daily expense is higher than daily income for this range. Track category waste." });
    }

    if (vendorSpend[0]) {
      lines.push({ tone: "warn", text: `Top vendor spend: ${vendorSpend[0].vendor} (${formatMoney(vendorSpend[0].amount, currency)}). Try negotiation or alternate vendors.` });
    }

    if (categoryBreakdown[0]) {
      lines.push({ tone: "warn", text: `Highest cost category: ${categoryBreakdown[0].category} (${formatMoney(categoryBreakdown[0].amount, currency)}).` });
    }

    if (Number.isFinite(cashEstimate.runwayMonths) && cashEstimate.runwayMonths !== Infinity) {
      if (cashEstimate.runwayMonths < 2) lines.push({ tone: "bad", text: `Runway is low (approx ${cashEstimate.runwayMonths.toFixed(1)} months). Increase cash or cut burn.` });
      else lines.push({ tone: "ok", text: `Estimated runway: ${cashEstimate.runwayMonths.toFixed(1)} months (based on last 30 days burn).` });
    }

    return lines.slice(0, 6);
  }, [txs.length, totals.net, totals.income, avgPerDay, vendorSpend, categoryBreakdown, cashEstimate.runwayMonths, cashEstimate.burnPerMonth, currency]);

  // Recurring generator (safe local)
  function runRecurring() {
    const recurring = meta.recurring || [];
    if (!recurring.length) {
      setMsg("⚠️ No recurring rules found");
      setTimeout(() => setMsg(""), 1200);
      return;
    }

    const today = todayYMD();
    const created: FinanceTx[] = [];

    for (const r of recurring) {
      if (!r.enabled) continue;

      const last = r.lastRun || "";
      // Basic rule: generate once per week or per month when we haven't run in that window
      const shouldRun =
        r.freq === "Weekly"
          ? !last || weekKey(last) !== weekKey(today)
          : !last || last.slice(0, 7) !== today.slice(0, 7);

      if (!shouldRun) continue;

      const tx: FinanceTx = {
        id: uid(),
        date: today,
        type: r.type,
        amount: Math.max(0, Number(r.amount || 0)),
        category: r.category || "Uncategorized",
        vendor: r.vendor || undefined,
        note: r.note ? `[Recurring] ${r.note}` : "[Recurring]",
        method: r.method || "Other",
        taxPct: Number.isFinite(Number(r.taxPct)) ? clampNum(r.taxPct, 0, 100, 0) : 0,
        tags: r.tags || "recurring",
        createdAt: nowISO(),
        updatedAt: nowISO(),
      };
      if (tx.amount > 0) created.push(tx);

      // update lastRun
      r.lastRun = today;
    }

    if (!created.length) {
      persistMeta({ ...meta, recurring }, "✅ Recurring already up-to-date");
      return;
    }

    const nextTx = [...created, ...txs].sort((a, b) => (a.date < b.date ? 1 : -1));
    persist(nextTx, `✅ Added ${created.length} recurring transaction(s)`);
    persistMeta({ ...meta, recurring }, "✅ Recurring updated");
  }

  function weekKey(ymd: string) {
    const d = new Date(ymd + "T00:00:00");
    const onejan = new Date(d.getFullYear(), 0, 1);
    const ms = d.getTime() - onejan.getTime();
    const day = Math.floor(ms / (24 * 60 * 60 * 1000));
    const week = Math.floor((day + onejan.getDay()) / 7);
    return `${d.getFullYear()}-W${week}`;
  }

  // Form helpers
  function openCreate() {
    setEditingId(null);
    setDraft({
      date: todayYMD(),
      type: "Expense",
      amount: 0,
      category: "Operations",
      vendor: "",
      note: "",
      method: "UPI",
      taxPct: 0,
      tags: "",
    });
    setOpenForm(true);
  }

  function openEdit(id: string) {
    const tx = txs.find((x) => x.id === id);
    if (!tx) return;
    setEditingId(id);
    setDraft({ ...tx });
    setOpenForm(true);
  }

  function closeForm() {
    setOpenForm(false);
    setEditingId(null);
  }

  function saveDraft() {
    const date = String(draft.date || "").slice(0, 10);
    const type = (draft.type || "Expense") as TxType;
    const amount = Number(draft.amount || 0);
    const category = String(draft.category || "Uncategorized").trim() || "Uncategorized";

    if (!date) return toast("❌ Date required");
    if (!Number.isFinite(amount) || amount <= 0) return toast("❌ Amount must be > 0");

    const tx: FinanceTx = {
      id: editingId || uid(),
      date,
      type,
      amount: Math.abs(amount),
      category,
      vendor: String(draft.vendor || "").trim() || undefined,
      note: String(draft.note || "").trim() || undefined,
      method: (draft.method || "Other") as PayMethod,
      taxPct: Number.isFinite(Number(draft.taxPct)) ? clampNum(draft.taxPct, 0, 100, 0) : 0,
      tags: String(draft.tags || "").trim() || undefined,
      createdAt: editingId ? String(txs.find((x) => x.id === editingId)?.createdAt ?? nowISO()) : nowISO(),
      updatedAt: nowISO(),
    };

    const next = editingId ? txs.map((x) => (x.id === editingId ? tx : x)) : [tx, ...txs];
    next.sort((a, b) => (a.date < b.date ? 1 : -1));
    persist(next, editingId ? "✅ Transaction updated" : "✅ Transaction added");
    closeForm();
  }

  function removeTx(id: string) {
    const tx = txs.find((x) => x.id === id);
    if (!tx) return;
    const ok = confirm(`Delete transaction: ${tx.type} ${formatMoney(tx.amount, currency)} on ${tx.date}?`);
    if (!ok) return;
    persist(txs.filter((x) => x.id !== id), "🗑️ Deleted");
  }

  function toast(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(""), 1200);
  }

  function exportRangeJSON() {
    exportJSON(`eventura_finance_${from}_to_${to}.json`, {
      version: "eventura-finance-v2",
      exportedAt: new Date().toISOString(),
      range: { from, to },
      totals,
      meta,
      tx: txsInRange,
    });
    toast("✅ Exported JSON");
  }

  function exportRangeCSV() {
    exportCSV(`eventura_finance_${from}_to_${to}.csv`, txsInRange);
    toast("✅ Exported CSV");
  }

  function addRecurringRule() {
    const r: RecurringRule = {
      id: uid(),
      label: "Monthly Office Rent",
      enabled: true,
      freq: "Monthly",
      type: "Expense",
      amount: 15000,
      category: "Rent",
      vendor: "Office",
      note: "Office rent",
      method: "Bank",
      taxPct: 0,
      tags: "recurring,rent",
      lastRun: "",
    };
    persistMeta({ ...meta, recurring: [r, ...(meta.recurring || [])] }, "✅ Recurring rule added");
  }

  function updateRecurring(id: string, patch: Partial<RecurringRule>) {
    const next = (meta.recurring || []).map((r) => (r.id === id ? { ...r, ...patch } : r));
    persistMeta({ ...meta, recurring: next });
  }

  function deleteRecurring(id: string) {
    const ok = confirm("Delete this recurring rule?");
    if (!ok) return;
    persistMeta({ ...meta, recurring: (meta.recurring || []).filter((r) => r.id !== id) }, "🗑️ Rule deleted");
  }

  return (
    <div style={S.app}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          <div>
            <div style={S.brandName}>Eventura</div>
            <div style={S.brandSub}>Finance</div>
          </div>
        </div>

        <nav style={S.nav}>
          <HoverLink href="/dashboard" icon="📊" label="Dashboard" S={S} hoverKey="dash" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/events" icon="📅" label="Events" S={S} hoverKey="events" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/finance" active icon="💰" label="Finance" S={S} hoverKey="fin" hovered={hoveredNav} setHovered={setHoveredNav} />
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

          <div style={S.smallNote}>
            Storage: <b>{keysUsed ?? "not found"}</b>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={S.h1}>Finance Automation Center</div>
            <div style={S.muted}>Income • Expense • Recurring • P&L • Cashflow • Exports • Deploy-safe</div>
          </div>

          <div style={S.headerRight}>
            <button
              style={S.secondaryBtn}
              onClick={() => {
                hydrate();
                toast("✅ Refreshed");
              }}
            >
              Refresh
            </button>

            <button style={S.secondaryBtn} onClick={runRecurring}>
              Run Recurring
            </button>

            <button style={S.secondaryBtn} onClick={exportRangeJSON}>
              Export JSON
            </button>
            <button style={S.secondaryBtn} onClick={exportRangeCSV}>
              Export CSV
            </button>

            <button style={S.primaryBtn} onClick={openCreate}>
              + Add Tx
            </button>
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* Range + Filters */}
        <section style={S.filters}>
          <div style={S.filterRow}>
            <div style={S.field}>
              <div style={S.smallMuted}>From</div>
              <input style={S.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div style={S.field}>
              <div style={S.smallMuted}>To</div>
              <input style={S.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>

            <div style={S.fieldWide}>
              <div style={S.smallMuted}>Search</div>
              <input
                style={{ ...S.input, width: "100%" }}
                placeholder="category, vendor, note, method, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Type</div>
              <select style={S.select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
                <option value="All">All</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Category</div>
              <select style={S.select} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="All">All</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Vendor</div>
              <select style={S.select} value={vendorFilter} onChange={(e) => setVendorFilter(e.target.value)}>
                <option value="All">All</option>
                <option value="—">—</option>
                {vendors.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={S.filterBottom}>
            <div style={S.smallNote}>Currency</div>
            <select
              style={S.select}
              value={currency}
              onChange={(e) => persistMeta({ ...meta, currency: e.target.value as any }, "✅ Currency saved")}
            >
              <option value="INR">INR</option>
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </select>

            <button
              style={S.secondaryBtn}
              onClick={() => {
                setSearch("");
                setTypeFilter("All");
                setCategoryFilter("All");
                setVendorFilter("All");
              }}
            >
              Reset Filters
            </button>
          </div>
        </section>

        {/* KPIs */}
        <div style={S.kpiGrid}>
          <div style={S.statCard}>
            <div style={S.statLabel}>Income</div>
            <div style={S.statValue}>{formatMoney(totals.income, currency)}</div>
            <div style={S.statSub}>Avg/day: {formatMoney(avgPerDay.income, currency)}</div>
          </div>

          <div style={S.statCard}>
            <div style={S.statLabel}>Expense</div>
            <div style={S.statValue}>{formatMoney(totals.expense, currency)}</div>
            <div style={S.statSub}>Avg/day: {formatMoney(avgPerDay.expense, currency)}</div>
          </div>

          <div style={S.statCard}>
            <div style={S.statLabel}>Net</div>
            <div style={S.statValue}>{formatMoney(totals.net, currency)}</div>
            <div style={S.statSub}>Tax est: {formatMoney(totals.tax, currency)}</div>
          </div>

          <div style={S.statCard}>
            <div style={S.statLabel}>Tx Count</div>
            <div style={S.statValue}>{txsInRange.length}</div>
            <div style={S.statSub}>Range days: {daysCount}</div>
          </div>
        </div>

        {/* Insights */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Finance Insights (Auto)</div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {insights.map((x, i) => (
              <div key={i} style={S.suggestRow}>
                <Pill text={x.tone === "ok" ? "OK" : x.tone === "warn" ? "ATTN" : "RISK"} tone={x.tone} S={S} />
                <div style={S.suggestText}>{x.text}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Balance Sheet Lite */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Balance Sheet (Simple, Optional)</div>
          <div style={S.smallNote}>These are manual fields + auto cash estimate. Good enough for internal control.</div>

          <div style={S.bsGrid}>
            <div style={S.field}>
              <div style={S.smallMuted}>Opening Cash</div>
              <input
                style={S.input}
                type="number"
                value={meta.openingCash ?? 0}
                onChange={(e) => persistMeta({ ...meta, openingCash: Number(e.target.value || 0) })}
                onBlur={() => toast("✅ Saved")}
              />
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Receivables</div>
              <input
                style={S.input}
                type="number"
                value={meta.receivables ?? 0}
                onChange={(e) => persistMeta({ ...meta, receivables: Number(e.target.value || 0) })}
                onBlur={() => toast("✅ Saved")}
              />
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Payables</div>
              <input
                style={S.input}
                type="number"
                value={meta.payables ?? 0}
                onChange={(e) => persistMeta({ ...meta, payables: Number(e.target.value || 0) })}
                onBlur={() => toast("✅ Saved")}
              />
            </div>

            <div style={S.bsCard}>
              <div style={S.bsLabel}>Cash Estimate</div>
              <div style={S.bsValue}>{formatMoney(cashEstimate.cash, currency)}</div>
              <div style={S.bsSub}>Burn (30d): {formatMoney(cashEstimate.burnPerMonth, currency)} • Runway: {Number.isFinite(cashEstimate.runwayMonths) && cashEstimate.runwayMonths !== Infinity ? `${cashEstimate.runwayMonths.toFixed(1)} mo` : "∞"}</div>
            </div>
          </div>
        </section>

        {/* Analytics */}
        <div style={S.grid2}>
          <section style={S.panel}>
            <div style={S.panelTitle}>Top Expense Categories (Range)</div>
            {!categoryBreakdown.length ? (
              <div style={S.empty}>No expense categories in this range.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {categoryBreakdown.map((c) => (
                  <div key={c.category} style={S.rowBetween}>
                    <div style={{ fontWeight: 950 }}>{c.category}</div>
                    <div style={S.pillMoney}>{formatMoney(c.amount, currency)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={S.panel}>
            <div style={S.panelTitle}>Top Vendor Spend (Range)</div>
            {!vendorSpend.length ? (
              <div style={S.empty}>No vendor spend in this range.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {vendorSpend.map((v) => (
                  <div key={v.vendor} style={S.rowBetween}>
                    <div style={{ fontWeight: 950 }}>{v.vendor}</div>
                    <div style={S.pillMoney}>{formatMoney(v.amount, currency)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section style={S.panel}>
          <div style={S.panelTitle}>Monthly P&amp;L (Last 12 Months)</div>
          {!monthly.length ? (
            <div style={S.empty}>Add transactions to see monthly P&amp;L.</div>
          ) : (
            <div style={S.table}>
              <div style={S.tableHead}>
                <div>Month</div><div>Income</div><div>Expense</div><div>Net</div>
              </div>
              {monthly.map((r) => (
                <div key={r.month} style={S.tableRow}>
                  <div style={{ fontWeight: 950 }}>{r.month}</div>
                  <div>{formatMoney(r.income, currency)}</div>
                  <div>{formatMoney(r.expense, currency)}</div>
                  <div style={{ fontWeight: 950 }}>{formatMoney(r.net, currency)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recurring */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Recurring Transactions</div>
          <div style={S.smallNote}>
            Create rules like rent, salary, subscriptions. Click “Run Recurring” to generate today’s entries.
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={S.secondaryBtn} onClick={addRecurringRule}>+ Add Sample Rule</button>
            <button style={S.secondaryBtn} onClick={runRecurring}>Run Now</button>
          </div>

          {!((meta.recurring || []).length) ? (
            <div style={S.empty}>No recurring rules yet.</div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              {(meta.recurring || []).map((r) => (
                <div key={r.id} style={S.card}>
                  <div style={S.rowBetween}>
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ fontWeight: 950 }}>{r.label}</div>
                      <div style={S.smallMuted}>
                        {r.freq} • {r.type} • {formatMoney(r.amount, currency)} • {r.category} {r.vendor ? `• ${r.vendor}` : ""}
                      </div>
                      <div style={S.smallMuted}>Last run: {r.lastRun || "never"}</div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <label style={S.switchRow}>
                        <input
                          type="checkbox"
                          checked={!!r.enabled}
                          onChange={(e) => updateRecurring(r.id, { enabled: e.target.checked })}
                        />
                        <span style={S.smallMuted}>Enabled</span>
                      </label>

                      <select style={S.select} value={r.freq} onChange={(e) => updateRecurring(r.id, { freq: e.target.value as any })}>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>

                      <button style={S.dangerBtn} onClick={() => deleteRecurring(r.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Transactions */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Transactions (Range)</div>

          {!txsInRange.length ? (
            <div style={S.empty}>No transactions found in this range.</div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              {txsInRange
                .slice()
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .slice(0, 80)
                .map((t) => (
                  <div key={t.id} style={S.txCard}>
                    <div style={S.rowBetween}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <Pill text={t.type} tone={t.type === "Income" ? "ok" : "warn"} S={S} />
                        <div style={{ fontWeight: 950 }}>{t.category}</div>
                        {t.vendor ? <Pill text={t.vendor} tone="neutral" S={S} /> : null}
                        {t.method ? <div style={S.smallMuted}>• {t.method}</div> : null}
                        {t.taxPct ? <div style={S.smallMuted}>• Tax {t.taxPct}%</div> : null}
                        {t.tags ? <div style={S.smallMuted}>• Tags: {t.tags}</div> : null}
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={S.pillMoney}>{formatMoney(t.amount, currency)}</div>
                        <button style={S.secondaryBtn} onClick={() => openEdit(t.id)}>Edit</button>
                        <button style={S.dangerBtn} onClick={() => removeTx(t.id)}>Delete</button>
                      </div>
                    </div>

                    <div style={S.smallMuted}>
                      {t.date} {t.note ? `• ${t.note}` : ""}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Modal */}
        {openForm ? (
          <div style={S.modalOverlay} onMouseDown={closeForm}>
            <div style={S.modal} onMouseDown={(e) => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <div style={S.modalTitle}>{editingId ? "Edit Transaction" : "Add Transaction"}</div>
                <button style={S.secondaryBtn} onClick={closeForm}>Close</button>
              </div>

              <div style={S.modalGrid}>
                <div style={S.field}>
                  <div style={S.smallMuted}>Date</div>
                  <input style={S.input} type="date" value={String(draft.date || "")} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Type</div>
                  <select style={S.select} value={(draft.type as any) || "Expense"} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as any }))}>
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                  </select>
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Amount</div>
                  <input style={S.input} type="number" min={0} value={draft.amount ?? 0} onChange={(e) => setDraft((d) => ({ ...d, amount: Number(e.target.value || 0) }))} />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Category</div>
                  <input style={{ ...S.input, width: "100%" }} value={String(draft.category || "")} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} placeholder="e.g., Marketing, Decor, Rent, Salary, Travel" />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Vendor</div>
                  <input style={{ ...S.input, width: "100%" }} value={String(draft.vendor || "")} onChange={(e) => setDraft((d) => ({ ...d, vendor: e.target.value }))} placeholder="Vendor name (optional)" />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Note</div>
                  <input style={{ ...S.input, width: "100%" }} value={String(draft.note || "")} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} placeholder="Short note" />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Method</div>
                  <select style={S.select} value={(draft.method as any) || "Other"} onChange={(e) => setDraft((d) => ({ ...d, method: e.target.value as any }))}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank</option>
                    <option value="Card">Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Tax %</div>
                  <input style={S.input} type="number" min={0} max={100} value={draft.taxPct ?? 0} onChange={(e) => setDraft((d) => ({ ...d, taxPct: clampNum(e.target.value, 0, 100, 0) }))} />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Tags (comma separated)</div>
                  <input style={{ ...S.input, width: "100%" }} value={String(draft.tags || "")} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} placeholder="e.g., wedding, lead, urgent, recurring" />
                </div>
              </div>

              <div style={S.modalFooter}>
                <button style={S.primaryBtn} onClick={saveDraft}>
                  {editingId ? "Save Changes" : "Add Transaction"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div style={S.footerNote}>✅ Advanced Finance • ✅ Maximum automation • ✅ Black hover • ✅ Deploy-safe</div>
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
      background: T.hoverBlack,
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
    headerRight: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },

    h1: { fontSize: 26, fontWeight: 950 },
    muted: { color: T.muted, fontSize: 13, marginTop: 6 },
    smallMuted: { color: T.muted, fontSize: 12 },
    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35 },

    msg: { marginTop: 12, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontSize: 13 },

    primaryBtn: {
      padding: "12px 14px",
      borderRadius: 14,
      border: `1px solid ${T.accentBd}`,
      background: T.accentBg,
      color: T.accentTx,
      fontWeight: 950,
      cursor: "pointer",
    },
    secondaryBtn: {
      padding: "12px 14px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
    },
    dangerBtn: {
      padding: "12px 14px",
      borderRadius: 14,
      border: `1px solid ${T.dangerBd}`,
      background: T.dangerBg,
      color: T.dangerTx,
      fontWeight: 950,
      cursor: "pointer",
    },

    filters: { marginTop: 12, padding: 12, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },
    filterRow: { display: "grid", gridTemplateColumns: "220px 220px 1fr 220px 220px 220px", gap: 10, alignItems: "end" },
    filterBottom: { marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "end", flexWrap: "wrap" },

    field: { display: "grid", gap: 6 },
    fieldWide: { display: "grid", gap: 6 },

    input: {
      width: 220,
      padding: compact ? "10px 10px" : "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
    },
    select: {
      width: 220,
      padding: compact ? "10px 10px" : "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
    },

    kpiGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
    statCard: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    statLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    statValue: { marginTop: 8, fontSize: 20, fontWeight: 950 },
    statSub: { marginTop: 6, color: T.muted, fontSize: 12, lineHeight: 1.3 },

    panel: { marginTop: 12, padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    grid2: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

    rowBetween: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },

    pill: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillOk: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillWarn: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.warnBd}`, background: T.warnBg, color: T.warnTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillBad: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.dangerBd}`, background: T.dangerBg, color: T.dangerTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillMoney: { padding: "8px 12px", borderRadius: 999, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, whiteSpace: "nowrap" },

    empty: { marginTop: 12, padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft, color: T.muted, fontWeight: 900 },

    table: { marginTop: 12, borderRadius: 16, border: `1px solid ${T.border}`, overflow: "hidden" },
    tableHead: { display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr", gap: 10, padding: 12, background: T.soft, fontWeight: 950 },
    tableRow: { display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr", gap: 10, padding: 12, borderTop: `1px solid ${T.border}`, background: "rgba(255,255,255,0.02)" },

    card: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },

    txCard: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },

    suggestRow: { display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft },
    suggestText: { fontWeight: 850, lineHeight: 1.35, fontSize: 13 },

    bsGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "220px 220px 220px 1fr", gap: 12, alignItems: "end" },
    bsCard: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },
    bsLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    bsValue: { marginTop: 8, fontSize: 20, fontWeight: 950 },
    bsSub: { marginTop: 6, color: T.muted, fontSize: 12, lineHeight: 1.3 },

    switchRow: { display: "inline-flex", gap: 8, alignItems: "center" },

    modalOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.55)",
      display: "grid",
      placeItems: "center",
      padding: 14,
      zIndex: 50,
    },
    modal: {
      width: "min(980px, 100%)",
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel2,
      backdropFilter: "blur(10px)",
      padding: 14,
    },
    modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
    modalTitle: { fontWeight: 950, fontSize: 18, color: T.accentTx },
    modalGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "220px 220px 220px 1fr", gap: 10, alignItems: "end" },
    modalFooter: { marginTop: 12, display: "flex", justifyContent: "flex-end" },

    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 10 },
  };
}
