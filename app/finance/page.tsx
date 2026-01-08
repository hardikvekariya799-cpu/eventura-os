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

// Optional finance meta (opening cash + AR/AP)
const FIN_META_KEY = "eventura_fin_meta_v2";

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
  category: string; // must be one of CATEGORY_CATALOG (or custom)
  vendor?: string;
  note?: string;
  method?: PayMethod;
  tags?: string;
  createdAt: string;
  updatedAt: string;
};

type FinanceMeta = {
  currency?: "INR" | "CAD" | "USD";
  openingCash?: number; // starting cash estimate
  accountsReceivable?: number; // current AR (money to receive)
  accountsPayable?: number; // current AP (money to pay)
};

/* ================== CATEGORY SYSTEM (DIVIDED) ================== */
type CatGroup =
  | "Revenue"
  | "COGS"
  | "Operating"
  | "Other"
  | "Investing"
  | "Financing"
  | "Asset"
  | "Liability";

const CATEGORY_CATALOG: { group: CatGroup; name: string; hint: string }[] = [
  // Revenue
  { group: "Revenue", name: "Event Booking Revenue", hint: "Client payment for events" },
  { group: "Revenue", name: "Advance / Token Received", hint: "Advance payment" },
  { group: "Revenue", name: "Commission Income", hint: "Vendor commission/fees" },
  { group: "Revenue", name: "Other Income", hint: "Any other revenue" },

  // COGS (direct cost)
  { group: "COGS", name: "Venue Cost", hint: "Direct venue cost" },
  { group: "COGS", name: "Decor Cost", hint: "Direct decor vendor cost" },
  { group: "COGS", name: "Food / Catering Cost", hint: "Direct catering cost" },
  { group: "COGS", name: "Artist / Entertainment Cost", hint: "Artist fees" },
  { group: "COGS", name: "Travel for Event", hint: "Direct travel for event execution" },

  // Operating expenses
  { group: "Operating", name: "Salary / Payroll", hint: "Staff salaries" },
  { group: "Operating", name: "Rent", hint: "Office rent" },
  { group: "Operating", name: "Marketing", hint: "Ads, promotions" },
  { group: "Operating", name: "Software / Subscriptions", hint: "Tools, SaaS" },
  { group: "Operating", name: "Utilities", hint: "Internet, electricity" },
  { group: "Operating", name: "Office Supplies", hint: "Stationery, supplies" },
  { group: "Operating", name: "Admin / Misc", hint: "General expenses" },

  // Other (non-operating)
  { group: "Other", name: "Bank Charges", hint: "Charges, fees" },
  { group: "Other", name: "Interest Expense", hint: "Loan interest" },
  { group: "Other", name: "Taxes Paid", hint: "Taxes outflow" },

  // Investing (cashflow)
  { group: "Investing", name: "Equipment Purchase", hint: "Camera, lights, etc." },
  { group: "Investing", name: "Security Deposit", hint: "Rent/security deposit" },

  // Financing (cashflow)
  { group: "Financing", name: "Owner Investment", hint: "Owner cash injected" },
  { group: "Financing", name: "Loan Received", hint: "Loan inflow" },
  { group: "Financing", name: "Loan Repayment", hint: "Principal repayment" },

  // Balance sheet tags (optional usage)
  { group: "Asset", name: "Accounts Receivable (AR)", hint: "Use if tracking AR via tx entry" },
  { group: "Liability", name: "Accounts Payable (AP)", hint: "Use if tracking AP via tx entry" },
];

function categoryGroupOf(cat: string): CatGroup {
  const found = CATEGORY_CATALOG.find((c) => c.name === cat);
  return found?.group ?? "Operating";
}

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
  return dateStr >= from && dateStr <= to;
}
function parseAmount(v: any): number {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
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

    const amount = parseAmount(x?.amount ?? x?.value ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const category = String(x?.category ?? "Admin / Misc").trim() || "Admin / Misc";
    const vendor = x?.vendor ? String(x.vendor) : undefined;
    const note = x?.note ? String(x.note) : x?.notes ? String(x.notes) : undefined;
    const method = x?.method ? (String(x.method) as PayMethod) : undefined;
    const tags = x?.tags ? String(x.tags) : undefined;

    out.push({
      id,
      date,
      type,
      amount: Math.abs(amount),
      category,
      vendor,
      note,
      method,
      tags,
      createdAt: String(x?.createdAt ?? nowISO()),
      updatedAt: String(x?.updatedAt ?? nowISO()),
    });
  }

  // De-dupe by id (keep latest updatedAt)
  const m = new Map<string, FinanceTx>();
  for (const tx of out) {
    const prev = m.get(tx.id);
    if (!prev) m.set(tx.id, tx);
    else m.set(tx.id, prev.updatedAt >= tx.updatedAt ? prev : tx);
  }
  return Array.from(m.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
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
    hoverBlack: "rgba(0,0,0,0.75)", // <<< BLACK HOVER
    okBg: "rgba(34,197,94,0.12)",
    okBd: hc ? "rgba(34,197,94,0.45)" : "rgba(34,197,94,0.28)",
    okTx: "#86EFAC",
    warnBg: "rgba(245,158,11,0.12)",
    warnBd: hc ? "rgba(245,158,11,0.45)" : "rgba(245,158,11,0.28)",
    warnTx: "#FCD34D",
    badBg: "rgba(248,113,113,0.10)",
    badBd: hc ? "rgba(248,113,113,0.55)" : "rgba(248,113,113,0.30)",
    badTx: "#FCA5A5",
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

/* ================== HOVER WRAPPERS (BLACK HOVER) ================== */
function mergeStyle(a?: CSSProperties, b?: CSSProperties): CSSProperties {
  return { ...(a || {}), ...(b || {}) };
}

function HoverBox({
  base,
  hover,
  children,
  style,
  onClick,
  title,
}: {
  base: CSSProperties;
  hover: CSSProperties;
  children: React.ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  title?: string;
}) {
  const [h, setH] = useState(false);
  return (
    <div
      title={title}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={mergeStyle(mergeStyle(base, style), h ? hover : undefined)}
    >
      {children}
    </div>
  );
}

function HoverButton({
  base,
  hover,
  children,
  onClick,
  disabled,
  type,
  title,
  style,
}: {
  base: CSSProperties;
  hover: CSSProperties;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
  style?: CSSProperties;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      type={type || "button"}
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={mergeStyle(mergeStyle(base, style), h && !disabled ? hover : undefined)}
    >
      {children}
    </button>
  );
}

function HoverLink({
  href,
  base,
  hover,
  children,
  style,
}: {
  href: string;
  base: CSSProperties;
  hover: CSSProperties;
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  const [h, setH] = useState(false);
  return (
    <Link
      href={href}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={mergeStyle(mergeStyle(base, style), h ? hover : undefined) as any}
    >
      {children}
    </Link>
  );
}

/* ================== PAGE ================== */
export default function FinancePage() {
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<AppSettings>({});
  const [keysUsed, setKeysUsed] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const [from, setFrom] = useState(isoMinusDays(30));
  const [to, setTo] = useState(todayYMD());

  const [txs, setTxs] = useState<FinanceTx[]>([]);
  const [meta, setMeta] = useState<FinanceMeta>({
    currency: "INR",
    openingCash: 0,
    accountsReceivable: 0,
    accountsPayable: 0,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TxType | "All">("All");
  const [groupFilter, setGroupFilter] = useState<CatGroup | "All">("All");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  // Modal form (add/edit)
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Keep amount as string to avoid NaN while typing
  const [draft, setDraft] = useState<{
    date: string;
    type: TxType;
    amount: string;
    category: string;
    vendor: string;
    note: string;
    method: PayMethod;
    tags: string;
  }>({
    date: todayYMD(),
    type: "Expense",
    amount: "",
    category: "Admin / Misc",
    vendor: "",
    note: "",
    method: "UPI",
    tags: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEmail(localStorage.getItem(LS_EMAIL) || "");
    setSettings(safeLoad<AppSettings>(LS_SETTINGS, {}));

    const loadedMeta = safeLoad<FinanceMeta>(FIN_META_KEY, {
      currency: "INR",
      openingCash: 0,
      accountsReceivable: 0,
      accountsPayable: 0,
    });
    setMeta(loadedMeta);

    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toast(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(""), 1400);
  }

  function hydrate() {
    const loaded = loadFirstKey<any[]>(FIN_KEYS_READ, []);
    setKeysUsed(loaded.keyUsed);
    setTxs(normalizeFin(loaded.data));
  }

  function persist(next: FinanceTx[], toastMsg?: string) {
    setTxs(next);
    writeFin(next);
    if (toastMsg) toast(toastMsg);
  }
  function persistMeta(next: FinanceMeta, toastMsg?: string) {
    setMeta(next);
    writeMeta(next);
    if (toastMsg) toast(toastMsg);
  }

  const isCEO = useMemo(() => {
    const ceo = (settings.ceoEmail || "hardikvekariya799@gmail.com").toLowerCase();
    return (email || "").toLowerCase() === ceo;
  }, [email, settings.ceoEmail]);

  const T = ThemeTokens((settings.theme as Theme) || "Royal Gold", settings.highContrast);
  const S = useMemo(() => makeStyles(T, !!settings.compactTables), [T, settings.compactTables]);

  const currency = (meta.currency || "INR") as "INR" | "CAD" | "USD";

  const categoriesAll = useMemo(() => {
    const set = new Set<string>(CATEGORY_CATALOG.map((c) => c.name));
    for (const t of txs) set.add(t.category || "Admin / Misc");
    return Array.from(set).sort();
  }, [txs]);

  const categoriesByGroup = useMemo(() => {
    const map = new Map<CatGroup, string[]>();
    for (const c of CATEGORY_CATALOG) {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c.name);
    }
    for (const [k, v] of map.entries()) v.sort();
    return map;
  }, []);

  const txsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txs.filter((t) => {
      if (!inRange(t.date, from, to)) return false;
      if (typeFilter !== "All" && t.type !== typeFilter) return false;

      const g = categoryGroupOf(t.category);
      if (groupFilter !== "All" && g !== groupFilter) return false;

      if (categoryFilter !== "All" && t.category !== categoryFilter) return false;

      if (!q) return true;
      const blob = [t.date, t.type, t.category, t.vendor || "", t.note || "", t.method || "", t.tags || ""]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [txs, from, to, search, typeFilter, groupFilter, categoryFilter]);

  // Core totals in range
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    let revenue = 0;
    let cogs = 0;
    let opex = 0;
    let other = 0;

    for (const t of txsFiltered) {
      if (t.type === "Income") income += t.amount;
      else expense += t.amount;

      const g = categoryGroupOf(t.category);

      if (t.type === "Income" && g === "Revenue") revenue += t.amount;
      if (t.type === "Expense" && g === "COGS") cogs += t.amount;
      if (t.type === "Expense" && g === "Operating") opex += t.amount;
      if (t.type === "Expense" && g === "Other") other += t.amount;
    }

    const net = income - expense;
    const grossProfit = revenue - cogs;
    const operatingProfit = grossProfit - opex;
    const netProfit = operatingProfit - other;

    return { income, expense, net, revenue, cogs, opex, other, grossProfit, operatingProfit, netProfit };
  }, [txsFiltered]);

  // Monthly P&L (all-time, last 12 months)
  const monthlyPL = useMemo(() => {
    const m = new Map<string, { revenue: number; cogs: number; opex: number; other: number }>();
    for (const t of txs) {
      const month = (t.date || "").slice(0, 7);
      if (!month) continue;
      const cur = m.get(month) || { revenue: 0, cogs: 0, opex: 0, other: 0 };

      const g = categoryGroupOf(t.category);
      if (t.type === "Income" && g === "Revenue") cur.revenue += t.amount;
      if (t.type === "Expense" && g === "COGS") cur.cogs += t.amount;
      if (t.type === "Expense" && g === "Operating") cur.opex += t.amount;
      if (t.type === "Expense" && g === "Other") cur.other += t.amount;

      m.set(month, cur);
    }

    const rows = Array.from(m.entries())
      .map(([month, v]) => {
        const gross = v.revenue - v.cogs;
        const op = gross - v.opex;
        const net = op - v.other;
        return { month, revenue: v.revenue, cogs: v.cogs, opex: v.opex, other: v.other, gross, op, net };
      })
      .sort((a, b) => (a.month < b.month ? 1 : -1));

    return rows.slice(0, 12);
  }, [txs]);

  // Cash Flow (range) - automated by category group
  const cashFlow = useMemo(() => {
    let operating = 0;
    let investing = 0;
    let financing = 0;

    for (const t of txsFiltered) {
      const g = categoryGroupOf(t.category);

      if (g === "Revenue") operating += t.type === "Income" ? t.amount : -t.amount;
      if (g === "COGS" || g === "Operating" || g === "Other") operating += t.type === "Expense" ? -t.amount : t.amount;

      if (g === "Investing") investing += t.type === "Expense" ? -t.amount : t.amount;
      if (g === "Financing") financing += t.type === "Income" ? t.amount : -t.amount;
    }

    const netCashChange = operating + investing + financing;
    return { operating, investing, financing, netCashChange };
  }, [txsFiltered]);

  // Balance Sheet (automated estimate)
  const balanceSheet = useMemo(() => {
    let op = 0,
      inv = 0,
      fin = 0;

    for (const t of txs) {
      const g = categoryGroupOf(t.category);
      if (g === "Revenue") op += t.type === "Income" ? t.amount : -t.amount;
      if (g === "COGS" || g === "Operating" || g === "Other") op += t.type === "Expense" ? -t.amount : t.amount;
      if (g === "Investing") inv += t.type === "Expense" ? -t.amount : t.amount;
      if (g === "Financing") fin += t.type === "Income" ? t.amount : -t.amount;
    }

    const openingCash = Number(meta.openingCash || 0);
    const cash = openingCash + op + inv + fin;

    const ar = Number(meta.accountsReceivable || 0);
    const ap = Number(meta.accountsPayable || 0);

    const totalAssets = cash + ar;
    const totalLiabilities = ap;
    const equity = totalAssets - totalLiabilities;

    return { cash, ar, ap, totalAssets, totalLiabilities, equity };
  }, [txs, meta.openingCash, meta.accountsReceivable, meta.accountsPayable]);

  // Ratios (automated)
  const ratios = useMemo(() => {
    const rev = totals.revenue;
    const gross = totals.grossProfit;
    const net = totals.netProfit;
    const expenseTotal = totals.cogs + totals.opex + totals.other;

    const grossMargin = rev > 0 ? gross / rev : 0;
    const netMargin = rev > 0 ? net / rev : 0;

    const currentRatio = balanceSheet.ap > 0 ? (balanceSheet.cash + balanceSheet.ar) / balanceSheet.ap : Infinity;
    const quickRatio = currentRatio;

    const last30From = isoMinusDays(30);
    const last30 = txs.filter((t) => inRange(t.date, last30From, todayYMD()));
    const burn = last30.reduce((a, t) => {
      const g = categoryGroupOf(t.category);
      if (t.type === "Expense" && (g === "COGS" || g === "Operating" || g === "Other")) return a + t.amount;
      return a;
    }, 0);
    const runwayMonths = burn > 0 ? balanceSheet.cash / burn : Infinity;

    const expenseRatio = rev > 0 ? expenseTotal / rev : 0;

    return {
      grossMargin,
      netMargin,
      currentRatio,
      quickRatio,
      burnPerMonthApprox: burn,
      runwayMonths,
      expenseRatio,
    };
  }, [totals, balanceSheet, txs]);

  // Add/Edit
  function openAdd() {
    setEditingId(null);
    setDraft({
      date: todayYMD(),
      type: "Expense",
      amount: "",
      category: "Admin / Misc",
      vendor: "",
      note: "",
      method: "UPI",
      tags: "",
    });
    setOpenForm(true);
  }
  function openEdit(id: string) {
    const tx = txs.find((x) => x.id === id);
    if (!tx) return;
    setEditingId(id);
    setDraft({
      date: tx.date,
      type: tx.type,
      amount: String(tx.amount),
      category: tx.category,
      vendor: tx.vendor || "",
      note: tx.note || "",
      method: (tx.method || "Other") as PayMethod,
      tags: tx.tags || "",
    });
    setOpenForm(true);
  }
  function closeForm() {
    setOpenForm(false);
    setEditingId(null);
  }

  function saveDraft() {
    const date = String(draft.date || "").slice(0, 10);
    const amount = parseAmount(draft.amount);
    const category = String(draft.category || "Admin / Misc").trim() || "Admin / Misc";

    if (!date) return toast("❌ Date required");
    if (!Number.isFinite(amount) || amount <= 0) return toast("❌ Amount must be > 0");

    const tx: FinanceTx = {
      id: editingId || uid(),
      date,
      type: draft.type,
      amount: Math.abs(amount),
      category,
      vendor: draft.vendor.trim() || undefined,
      note: draft.note.trim() || undefined,
      method: draft.method,
      tags: draft.tags.trim() || undefined,
      createdAt: editingId ? String(txs.find((x) => x.id === editingId)?.createdAt ?? nowISO()) : nowISO(),
      updatedAt: nowISO(),
    };

    const next = editingId ? txs.map((x) => (x.id === editingId ? tx : x)) : [tx, ...txs];
    next.sort((a, b) => (a.date < b.date ? 1 : -1));
    persist(next, editingId ? "✅ Updated" : "✅ Added");
    closeForm();
  }

  function removeTx(id: string) {
    const tx = txs.find((x) => x.id === id);
    if (!tx) return;
    const ok = confirm(`Delete ${tx.type} ${formatMoney(tx.amount, currency)} on ${tx.date}?`);
    if (!ok) return;
    persist(txs.filter((x) => x.id !== id), "🗑️ Deleted");
  }

  function exportRange() {
    exportJSON(`eventura_finance_${from}_to_${to}.json`, {
      version: "eventura-finance-auto-v1",
      exportedAt: new Date().toISOString(),
      range: { from, to },
      balanceSheet,
      cashFlow,
      pnl: totals,
      ratios,
      tx: txsFiltered,
    });
    toast("✅ Exported JSON");
  }

  function exportRangeCSV() {
    exportCSV(`eventura_finance_${from}_to_${to}.csv`, txsFiltered);
    toast("✅ Exported CSV");
  }

  const headerBadge = useMemo(() => {
    if (totals.netProfit > 0) return { txt: "Profitable (Range)", tone: "ok" as const };
    if (totals.netProfit < 0) return { txt: "Loss (Range)", tone: "bad" as const };
    return { txt: "Break-even (Range)", tone: "warn" as const };
  }, [totals.netProfit]);

  // BLACK HOVER STYLE (reused)
  const HOVER_BLACK: CSSProperties = useMemo(
    () => ({
      background: T.hoverBlack,
      borderColor: T.border,
      transition: "background 140ms ease, border-color 140ms ease, transform 140ms ease",
    }),
    [T.border, T.hoverBlack]
  );

  const HOVER_BLACK_LIFT: CSSProperties = useMemo(
    () => ({
      ...HOVER_BLACK,
      transform: "translateY(-1px)",
    }),
    [HOVER_BLACK]
  );

  const HOVER_BLACK_BTN: CSSProperties = useMemo(
    () => ({
      background: T.hoverBlack,
      borderColor: T.accentBd,
      transition: "background 140ms ease, border-color 140ms ease, transform 140ms ease",
      transform: "translateY(-1px)",
    }),
    [T.accentBd, T.hoverBlack]
  );

  const HOVER_BLACK_DANGER: CSSProperties = useMemo(
    () => ({
      background: "rgba(0,0,0,0.78)",
      borderColor: T.badBd,
      transition: "background 140ms ease, border-color 140ms ease, transform 140ms ease",
      transform: "translateY(-1px)",
    }),
    [T.badBd]
  );

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          <div>
            <div style={S.brandName}>Eventura</div>
            <div style={S.brandSub}>Finance</div>
          </div>
        </div>

        <nav style={S.nav}>
          <HoverLink href="/dashboard" base={S.navItem} hover={HOVER_BLACK}>
            📊 Dashboard
          </HoverLink>
          <HoverLink href="/events" base={S.navItem} hover={HOVER_BLACK}>
            📅 Events
          </HoverLink>
          <HoverLink href="/finance" base={S.navActive} hover={HOVER_BLACK}>
            💰 Finance
          </HoverLink>
          <HoverLink href="/vendors" base={S.navItem} hover={HOVER_BLACK}>
            🏷️ Vendors
          </HoverLink>
          <HoverLink href="/hr" base={S.navItem} hover={HOVER_BLACK}>
            🧑‍🤝‍🧑 HR
          </HoverLink>
          <HoverLink href="/reports" base={S.navItem} hover={HOVER_BLACK}>
            📈 Reports
          </HoverLink>
          <HoverLink href="/settings" base={S.navItem} hover={HOVER_BLACK}>
            ⚙️ Settings
          </HoverLink>
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

      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={S.h1}>Finance (Fully Automated)</div>
            <div style={S.muted}>Add/Edit/Delete entries → Auto P&amp;L • Auto Cashflow • Auto Balance Sheet • Auto Ratios</div>
          </div>

          <div style={S.headerRight}>
            <HoverButton base={S.secondaryBtn} hover={HOVER_BLACK_BTN} onClick={hydrate}>
              Refresh
            </HoverButton>
            <HoverButton base={S.secondaryBtn} hover={HOVER_BLACK_BTN} onClick={exportRange}>
              Export JSON
            </HoverButton>
            <HoverButton base={S.secondaryBtn} hover={HOVER_BLACK_BTN} onClick={exportRangeCSV}>
              Export CSV
            </HoverButton>
            <HoverButton base={S.primaryBtn} hover={HOVER_BLACK_BTN} onClick={openAdd}>
              + Add Entry
            </HoverButton>
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* Filters */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Filters</div>

          <div style={S.filtersGrid}>
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
                placeholder="vendor, note, tags, category..."
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
              <div style={S.smallMuted}>Group</div>
              <select style={S.select} value={groupFilter} onChange={(e) => setGroupFilter(e.target.value as any)}>
                <option value="All">All</option>
                <option value="Revenue">Revenue</option>
                <option value="COGS">COGS</option>
                <option value="Operating">Operating</option>
                <option value="Other">Other</option>
                <option value="Investing">Investing</option>
                <option value="Financing">Financing</option>
              </select>
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Category</div>
              <select style={S.select} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="All">All</option>
                {categoriesAll.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={S.rowBetween}>
            <div style={S.smallNote}>Currency (affects formatting only)</div>
            <select style={S.select} value={currency} onChange={(e) => persistMeta({ ...meta, currency: e.target.value as any }, "✅ Currency saved")}>
              <option value="INR">INR</option>
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </section>

        {/* KPIs */}
        <div style={S.kpiGrid}>
          <HoverBox base={S.kpiCard} hover={HOVER_BLACK_LIFT}>
            <div style={S.kpiLabel}>Revenue (Range)</div>
            <div style={S.kpiValue}>{formatMoney(totals.revenue, currency)}</div>
            <div style={S.kpiSub}>Gross Profit: {formatMoney(totals.grossProfit, currency)}</div>
          </HoverBox>
          <HoverBox base={S.kpiCard} hover={HOVER_BLACK_LIFT}>
            <div style={S.kpiLabel}>Expenses (Range)</div>
            <div style={S.kpiValue}>{formatMoney(totals.cogs + totals.opex + totals.other, currency)}</div>
            <div style={S.kpiSub}>
              COGS {formatMoney(totals.cogs, currency)} • Opex {formatMoney(totals.opex, currency)}
            </div>
          </HoverBox>
          <HoverBox base={S.kpiCard} hover={HOVER_BLACK_LIFT}>
            <div style={S.kpiLabel}>Net Profit (Range)</div>
            <div style={S.kpiValue}>{formatMoney(totals.netProfit, currency)}</div>
            <div style={S.kpiSub}>
              <span style={headerBadge.tone === "ok" ? S.badgeOk : headerBadge.tone === "bad" ? S.badgeBad : S.badgeWarn}>
                {headerBadge.txt}
              </span>
            </div>
          </HoverBox>
          <HoverBox base={S.kpiCard} hover={HOVER_BLACK_LIFT}>
            <div style={S.kpiLabel}>Transactions</div>
            <div style={S.kpiValue}>{txsFiltered.length}</div>
            <div style={S.kpiSub}>Total saved: {txs.length}</div>
          </HoverBox>
        </div>

        {/* Automated Statements */}
        <div style={S.grid2}>
          {/* P&L */}
          <section style={S.panel}>
            <div style={S.panelTitle}>P&amp;L (Automated)</div>
            <div style={S.statement}>
              <Row label="Revenue" value={formatMoney(totals.revenue, currency)} S={S} />
              <Row label="COGS" value={formatMoney(totals.cogs, currency)} S={S} dim />
              <Row label="Gross Profit" value={formatMoney(totals.grossProfit, currency)} S={S} strong />
              <div style={S.hr} />
              <Row label="Operating Expenses" value={formatMoney(totals.opex, currency)} S={S} dim />
              <Row label="Operating Profit" value={formatMoney(totals.operatingProfit, currency)} S={S} strong />
              <div style={S.hr} />
              <Row label="Other Expenses" value={formatMoney(totals.other, currency)} S={S} dim />
              <Row label="Net Profit" value={formatMoney(totals.netProfit, currency)} S={S} strong />
            </div>

            <div style={S.smallNote}>
              Tip: Put direct event costs under <b>COGS</b> and salaries/marketing under <b>Operating</b>.
            </div>
          </section>

          {/* Cashflow */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Cash Flow (Automated)</div>
            <div style={S.statement}>
              <Row label="Operating Cash Flow" value={formatMoney(cashFlow.operating, currency)} S={S} strong />
              <Row label="Investing Cash Flow" value={formatMoney(cashFlow.investing, currency)} S={S} />
              <Row label="Financing Cash Flow" value={formatMoney(cashFlow.financing, currency)} S={S} />
              <div style={S.hr} />
              <Row label="Net Cash Change (Range)" value={formatMoney(cashFlow.netCashChange, currency)} S={S} strong />
            </div>
            <div style={S.smallNote}>This is based on category groups automatically.</div>
          </section>
        </div>

        {/* Balance Sheet + Ratios */}
        <div style={S.grid2}>
          <section style={S.panel}>
            <div style={S.panelTitle}>Balance Sheet (Automated Estimate)</div>

            <div style={S.metaGrid}>
              <div style={S.field}>
                <div style={S.smallMuted}>Opening Cash</div>
                <input
                  style={S.input}
                  type="number"
                  value={meta.openingCash ?? 0}
                  onChange={(e) => persistMeta({ ...meta, openingCash: parseAmount(e.target.value) })}
                  onBlur={() => toast("✅ Saved")}
                />
              </div>
              <div style={S.field}>
                <div style={S.smallMuted}>Accounts Receivable (AR)</div>
                <input
                  style={S.input}
                  type="number"
                  value={meta.accountsReceivable ?? 0}
                  onChange={(e) => persistMeta({ ...meta, accountsReceivable: parseAmount(e.target.value) })}
                  onBlur={() => toast("✅ Saved")}
                />
              </div>
              <div style={S.field}>
                <div style={S.smallMuted}>Accounts Payable (AP)</div>
                <input
                  style={S.input}
                  type="number"
                  value={meta.accountsPayable ?? 0}
                  onChange={(e) => persistMeta({ ...meta, accountsPayable: parseAmount(e.target.value) })}
                  onBlur={() => toast("✅ Saved")}
                />
              </div>
            </div>

            <div style={S.statement}>
              <Row label="Cash (estimated)" value={formatMoney(balanceSheet.cash, currency)} S={S} strong />
              <Row label="Accounts Receivable" value={formatMoney(balanceSheet.ar, currency)} S={S} />
              <Row label="Total Assets" value={formatMoney(balanceSheet.totalAssets, currency)} S={S} strong />
              <div style={S.hr} />
              <Row label="Accounts Payable" value={formatMoney(balanceSheet.ap, currency)} S={S} />
              <Row label="Total Liabilities" value={formatMoney(balanceSheet.totalLiabilities, currency)} S={S} />
              <div style={S.hr} />
              <Row label="Equity (Assets - Liabilities)" value={formatMoney(balanceSheet.equity, currency)} S={S} strong />
            </div>

            <div style={S.smallNote}>
              Balance sheet cash uses <b>Opening Cash + all-time cashflow</b>. AR/AP are your current totals.
            </div>
          </section>

          <section style={S.panel}>
            <div style={S.panelTitle}>Financial Ratios (Automated)</div>

            <div style={S.ratioGrid}>
              <HoverBox base={S.ratioCard} hover={HOVER_BLACK}>
                <Ratio label="Gross Margin" value={pct(ratios.grossMargin)} S={S} />
              </HoverBox>
              <HoverBox base={S.ratioCard} hover={HOVER_BLACK}>
                <Ratio label="Net Margin" value={pct(ratios.netMargin)} S={S} />
              </HoverBox>
              <HoverBox base={S.ratioCard} hover={HOVER_BLACK}>
                <Ratio label="Expense Ratio" value={pct(ratios.expenseRatio)} S={S} />
              </HoverBox>
              <HoverBox base={S.ratioCard} hover={HOVER_BLACK}>
                <Ratio label="Current Ratio" value={ratioFmt(ratios.currentRatio)} S={S} />
              </HoverBox>
              <HoverBox base={S.ratioCard} hover={HOVER_BLACK}>
                <Ratio label="Quick Ratio" value={ratioFmt(ratios.quickRatio)} S={S} />
              </HoverBox>
              <HoverBox base={S.ratioCard} hover={HOVER_BLACK}>
                <Ratio label="Burn (30d approx)" value={formatMoney(ratios.burnPerMonthApprox, currency)} S={S} />
              </HoverBox>
              <HoverBox base={S.ratioCard} hover={HOVER_BLACK}>
                <Ratio label="Runway" value={runwayFmt(ratios.runwayMonths)} S={S} />
              </HoverBox>
            </div>

            <div style={S.smallNote}>
              Gross Margin works only if you classify direct costs under <b>COGS</b>.
            </div>
          </section>
        </div>

        {/* Monthly P&L */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Monthly P&amp;L (Last 12 months)</div>
          {!monthlyPL.length ? (
            <div style={S.empty}>Add transactions to see monthly P&amp;L.</div>
          ) : (
            <div style={S.table}>
              <div style={S.tableHead}>
                <div>Month</div>
                <div>Revenue</div>
                <div>COGS</div>
                <div>Opex</div>
                <div>Other</div>
                <div>Net</div>
              </div>

              {monthlyPL.map((r) => (
                <HoverBox key={r.month} base={S.tableRow} hover={HOVER_BLACK}>
                  <div style={{ fontWeight: 950 }}>{r.month}</div>
                  <div>{formatMoney(r.revenue, currency)}</div>
                  <div>{formatMoney(r.cogs, currency)}</div>
                  <div>{formatMoney(r.opex, currency)}</div>
                  <div>{formatMoney(r.other, currency)}</div>
                  <div style={{ fontWeight: 950 }}>{formatMoney(r.net, currency)}</div>
                </HoverBox>
              ))}
            </div>
          )}
        </section>

        {/* Transactions */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Transactions (Add/Edit/Delete only)</div>

          {!txsFiltered.length ? (
            <div style={S.empty}>No transactions found in this range/filter.</div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {txsFiltered.slice(0, 120).map((t) => (
                <HoverBox key={t.id} base={S.txCard} hover={HOVER_BLACK_LIFT}>
                  <div style={S.rowBetween}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={t.type === "Income" ? S.pillOk : S.pillWarn}>{t.type}</span>
                      <div style={{ fontWeight: 950 }}>{t.category}</div>
                      <span style={S.pill}>{categoryGroupOf(t.category)}</span>
                      {t.vendor ? <span style={S.pill}>{t.vendor}</span> : null}
                      {t.method ? <span style={S.pill}>{t.method}</span> : null}
                      {t.tags ? <span style={S.pill}>Tags: {t.tags}</span> : null}
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span style={S.pillMoney}>{formatMoney(t.amount, currency)}</span>

                      <HoverButton base={S.secondaryBtn} hover={HOVER_BLACK_BTN} onClick={() => openEdit(t.id)}>
                        Edit
                      </HoverButton>
                      <HoverButton base={S.dangerBtn} hover={HOVER_BLACK_DANGER} onClick={() => removeTx(t.id)}>
                        Delete
                      </HoverButton>
                    </div>
                  </div>

                  <div style={S.smallMuted}>
                    {t.date} {t.note ? `• ${t.note}` : ""}
                  </div>
                </HoverBox>
              ))}
            </div>
          )}
        </section>

        {/* Modal */}
        {openForm ? (
          <div style={S.modalOverlay} onClick={closeForm}>
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <div style={S.modalTitle}>{editingId ? "Edit Entry" : "Add Entry"}</div>
                <HoverButton base={S.secondaryBtn} hover={HOVER_BLACK_BTN} onClick={closeForm}>
                  Close
                </HoverButton>
              </div>

              <div style={S.modalGrid}>
                <div style={S.field}>
                  <div style={S.smallMuted}>Date</div>
                  <input style={S.input} type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Type</div>
                  <select style={S.select} value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as TxType }))}>
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                  </select>
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Amount</div>
                  <input
                    style={S.input}
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 25000"
                    value={draft.amount}
                    onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
                  />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Category</div>
                  <select
                    style={{ ...S.select, width: "100%" }}
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                  >
                    {(["Revenue", "COGS", "Operating", "Other", "Investing", "Financing"] as CatGroup[]).map((g) => (
                      <optgroup key={g} label={g}>
                        {(categoriesByGroup.get(g) || []).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <optgroup label="Custom / Existing">
                      {categoriesAll.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Vendor</div>
                  <input
                    style={{ ...S.input, width: "100%" }}
                    value={draft.vendor}
                    onChange={(e) => setDraft((d) => ({ ...d, vendor: e.target.value }))}
                    placeholder="optional"
                  />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Note</div>
                  <input
                    style={{ ...S.input, width: "100%" }}
                    value={draft.note}
                    onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                    placeholder="optional"
                  />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Method</div>
                  <select style={S.select} value={draft.method} onChange={(e) => setDraft((d) => ({ ...d, method: e.target.value as PayMethod }))}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank">Bank</option>
                    <option value="Card">Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Tags (comma separated)</div>
                  <input
                    style={{ ...S.input, width: "100%" }}
                    value={draft.tags}
                    onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                    placeholder="wedding, urgent, lead"
                  />
                </div>
              </div>

              <div style={S.modalFooter}>
                <HoverButton base={S.primaryBtn} hover={HOVER_BLACK_BTN} onClick={saveDraft}>
                  {editingId ? "Save Changes" : "Add Entry"}
                </HoverButton>
              </div>
            </div>
          </div>
        ) : null}

        <div style={S.footerNote}>✅ Black hover everywhere • ✅ All statements automated • ✅ Deploy-safe</div>
      </main>
    </div>
  );
}

/* ================== SMALL UI ================== */
function Row({ label, value, S, strong, dim }: { label: string; value: string; S: any; strong?: boolean; dim?: boolean }) {
  return (
    <div style={S.row}>
      <div style={{ fontWeight: strong ? 950 : 900, opacity: dim ? 0.85 : 1 }}>{label}</div>
      <div style={{ fontWeight: strong ? 950 : 900 }}>{value}</div>
    </div>
  );
}
function Ratio({ label, value, S }: { label: string; value: string; S: any }) {
  return (
    <>
      <div style={S.ratioLabel}>{label}</div>
      <div style={S.ratioValue}>{value}</div>
    </>
  );
}
function pct(x: number) {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(1)}%`;
}
function ratioFmt(x: number) {
  if (x === Infinity) return "∞";
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(2);
}
function runwayFmt(x: number) {
  if (x === Infinity) return "∞";
  if (!Number.isFinite(x)) return "—";
  if (x < 0) return "0.0 mo";
  return `${x.toFixed(1)} mo`;
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
    navItem: {
      display: "block",
      padding: "12px 12px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.border}`,
      background: T.soft,
      fontWeight: 900,
      fontSize: 13,
    },
    navActive: {
      display: "block",
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
      border: `1px solid ${T.badBd}`,
      background: T.badBg,
      color: T.badTx,
      fontWeight: 950,
      cursor: "pointer",
    },

    panel: { marginTop: 12, padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    filtersGrid: {
      marginTop: 12,
      display: "grid",
      gap: 10,
      gridTemplateColumns: "220px 220px 1fr 220px 220px 220px",
      alignItems: "end",
    },
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

    rowBetween: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginTop: 12 },

    kpiGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
    kpiCard: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },
    kpiLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiValue: { marginTop: 8, fontSize: 20, fontWeight: 950 },
    kpiSub: { marginTop: 6, color: T.muted, fontSize: 12, lineHeight: 1.3 },

    badgeOk: { display: "inline-flex", padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontWeight: 950, fontSize: 12 },
    badgeWarn: { display: "inline-flex", padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.warnBd}`, background: T.warnBg, color: T.warnTx, fontWeight: 950, fontSize: 12 },
    badgeBad: { display: "inline-flex", padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.badBd}`, background: T.badBg, color: T.badTx, fontWeight: 950, fontSize: 12 },

    grid2: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

    statement: { marginTop: 12, display: "grid", gap: 10 },
    row: { display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft },
    hr: { height: 1, background: T.border, margin: "4px 0" },

    ratioGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
    ratioCard: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    ratioLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    ratioValue: { marginTop: 6, fontSize: 18, fontWeight: 950 },

    metaGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "220px 220px 220px", gap: 10, alignItems: "end" },

    table: { marginTop: 12, borderRadius: 16, border: `1px solid ${T.border}`, overflow: "hidden" },
    tableHead: { display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr 1fr 1fr", gap: 10, padding: 12, background: T.soft, fontWeight: 950 },
    tableRow: {
      display: "grid",
      gridTemplateColumns: "120px 1fr 1fr 1fr 1fr 1fr",
      gap: 10,
      padding: 12,
      borderTop: `1px solid ${T.border}`,
      background: "rgba(255,255,255,0.02)",
    },

    txCard: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },

    pill: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillOk: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillWarn: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.warnBd}`, background: T.warnBg, color: T.warnTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillMoney: { padding: "8px 12px", borderRadius: 999, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, whiteSpace: "nowrap" },

    empty: { marginTop: 12, padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft, color: T.muted, fontWeight: 900 },

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
