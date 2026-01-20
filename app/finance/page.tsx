// app/finance/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* ===========================
   Eventura OS — Finance (Advanced)
   - Deploy-safe (client-only localStorage access)
   - Advanced dashboard KPIs
   - Transactions CRUD + filters + bulk actions
   - Budgets + variance
   - AR/AP (receivables/payables) + due tracking
   - Reports (monthly, category, event, cashflow)
   - Export (CSV + JSON) + Import (CSV + JSON)
   =========================== */

/* ================= AUTH / KEYS ================= */
const DB_FIN = "eventura-finance-transactions";
const DB_FIN_BUDGETS = "eventura-finance-budgets";
const DB_FIN_SETTINGS = "eventura-finance-settings";
const DB_FIN_AUDIT = "eventura-finance-audit";
const DB_AUTH_ROLE = "eventura-role"; // "CEO" | "Staff" (fallback: CEO)
const DB_AUTH_EMAIL = "eventura-email"; // optional (fallback blank)

/* ================= TYPES ================= */
type Role = "CEO" | "Staff";
type TxType = "Income" | "Expense";
type TxStatus = "Planned" | "Pending" | "Paid" | "Overdue";
type PayMethod = "Cash" | "UPI" | "Bank" | "Card" | "Cheque" | "Other";
type TxTag =
  | "Sales"
  | "ClientAdvance"
  | "VendorPayment"
  | "Salary"
  | "Marketing"
  | "Office"
  | "Transport"
  | "Equipment"
  | "Tax"
  | "Refund"
  | "Other";

type FinanceTx = {
  id: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  date: string; // YYYY-MM-DD
  type: TxType;
  status: TxStatus;

  amount: number; // base amount (pre-tax or total - your choice; we keep totalAmount computed)
  currency: "INR" | "CAD" | "USD" | "Other";

  category: TxTag;
  subcategory?: string;

  description: string;

  // Parties / Linking
  clientName?: string;
  vendorName?: string;
  eventTitle?: string;
  eventId?: string;

  // Payment / Invoice
  paymentMethod: PayMethod;
  referenceId?: string; // UTR / Txn ID
  invoiceNo?: string;

  // Taxes
  gstRate?: number; // 0–28
  gstIncluded?: boolean; // if true, amount includes GST
  tdsRate?: number; // 0–10 typical

  // Due / Schedule
  dueDate?: string; // YYYY-MM-DD
  recurring?: {
    enabled: boolean;
    freq: "Weekly" | "Monthly" | "Quarterly" | "Yearly";
    nextRun?: string; // YYYY-MM-DD
  };

  // Attachments (store names only in local mode)
  notes?: string;
};

type BudgetLine = {
  id: number;
  createdAt: string;
  updatedAt: string;

  month: string; // YYYY-MM (budget period)
  currency: "INR" | "CAD" | "USD" | "Other";

  // Targets
  revenueTarget: number; // Income target
  expenseCap: number; // Expense cap
  grossMarginTargetPct: number; // 0–100

  // Optional fixed-cost template breakdown (editable)
  fixedCosts: {
    officeRentUtilities: number;
    salaries: number;
    marketing: number;
    internetMisc: number;
    transportLogistics: number;
    adminCompliance: number;
  };

  // Notes
  notes?: string;
};

type FinanceSettings = {
  defaultCurrency: "INR" | "CAD" | "USD" | "Other";
  startOfWeek: "Mon" | "Sun";
  overdueRuleDays: number; // if dueDate < today => overdue
  showGst: boolean;
  showTds: boolean;
};

type AuditItem = {
  id: number;
  at: string; // ISO
  actorRole: Role;
  actorEmail?: string;
  action:
    | "CREATE_TX"
    | "UPDATE_TX"
    | "DELETE_TX"
    | "BULK_UPDATE"
    | "IMPORT"
    | "EXPORT"
    | "CREATE_BUDGET"
    | "UPDATE_BUDGET"
    | "DELETE_BUDGET"
    | "SETTINGS_UPDATE"
    | "AUTO_OVERDUE_SCAN"
    | "AUTO_RECUR_CREATE";
  details: string;
};

/* ================= UTIL ================= */
function nowISO() {
  return new Date().toISOString();
}
function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toYM(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function parseNum(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : fallback;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function safeJsonParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function escCSV(val: any) {
  const s = String(val ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function daysBetween(aYMD: string, bYMD: string) {
  // b - a
  const a = new Date(aYMD + "T00:00:00");
  const b = new Date(bYMD + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
function money(n: number, cur: string) {
  // simple format (no Intl dependency issues)
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${cur} ${parts.join(".")}`;
}

/* ================= DEFAULTS ================= */
// Uses the Break-Even monthly fixed-cost template: total 2,65,000 split into line items.
// :contentReference[oaicite:0]{index=0}
function defaultBudgetLine(month: string, currency: BudgetLine["currency"]): BudgetLine {
  return {
    id: Date.now(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    month,
    currency,
    revenueTarget: 0,
    expenseCap: 265000,
    grossMarginTargetPct: 25,
    fixedCosts: {
      officeRentUtilities: 40000,
      salaries: 150000,
      marketing: 30000,
      internetMisc: 10000,
      transportLogistics: 20000,
      adminCompliance: 15000,
    },
    notes: "Base fixed-cost template (editable).",
  };
}

function defaultSettings(): FinanceSettings {
  return {
    defaultCurrency: "INR",
    startOfWeek: "Mon",
    overdueRuleDays: 0,
    showGst: true,
    showTds: true,
  };
}

/* ================= UI PRIMITIVES ================= */
function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/80">
      {label}
    </span>
  );
}

function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "outline";
  disabled?: boolean;
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm transition border select-none";
  const styles =
    variant === "primary"
      ? "border-white/15 bg-white/10 text-white hover:bg-black hover:border-white/25"
      : variant === "outline"
      ? "border-white/20 bg-transparent text-white hover:bg-black"
      : variant === "danger"
      ? "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-black hover:border-red-500/70"
      : "border-transparent bg-transparent text-white/85 hover:bg-black hover:text-white";
  const dis = disabled ? "opacity-50 pointer-events-none" : "";
  return (
    <button title={title} onClick={onClick} className={cls(base, styles, dis)}>
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-white/30 hover:border-white/25"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-white/30 hover:border-white/25"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-black text-white">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/15 bg-[#0b0b0b] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="text-base font-semibold text-white">{title}</div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/80 hover:bg-black hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="max-h-[72vh] overflow-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-white/10 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ================= PAGE ================= */
type Tab = "Dashboard" | "Transactions" | "Budgets" | "AR/AP" | "Reports" | "Import/Export" | "Settings";

export default function FinancePage() {
  const [mounted, setMounted] = useState(false);

  // Auth context
  const [role, setRole] = useState<Role>("CEO");
  const [email, setEmail] = useState<string>("");

  // Data
  const [txs, setTxs] = useState<FinanceTx[]>([]);
  const [budgets, setBudgets] = useState<BudgetLine[]>([]);
  const [settings, setSettings] = useState<FinanceSettings>(defaultSettings());
  const [audit, setAudit] = useState<AuditItem[]>([]);

  // UI
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [toast, setToast] = useState<string>("");
  const toastRef = useRef<number | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [fType, setFType] = useState<TxType | "All">("All");
  const [fStatus, setFStatus] = useState<TxStatus | "All">("All");
  const [fCategory, setFCategory] = useState<TxTag | "All">("All");
  const [fCur, setFCur] = useState<FinanceTx["currency"] | "All">("All");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  // Selection
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[Number(k)]).map((k) => Number(k)),
    [selected]
  );

  // Modals
  const [openTxModal, setOpenTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<FinanceTx | null>(null);

  const [openBudgetModal, setOpenBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetLine | null>(null);

  const canEdit = role === "CEO";

  function notify(msg: string) {
    setToast(msg);
    if (toastRef.current) window.clearTimeout(toastRef.current);
    toastRef.current = window.setTimeout(() => setToast(""), 2200);
  }

  function pushAudit(action: AuditItem["action"], details: string) {
    const item: AuditItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      at: nowISO(),
      actorRole: role,
      actorEmail: email || undefined,
      action,
      details,
    };
    setAudit((prev) => [item, ...prev].slice(0, 500));
  }

  // Load
  useEffect(() => {
    setMounted(true);
    try {
      const r = (localStorage.getItem(DB_AUTH_ROLE) || "CEO").toUpperCase();
      const roleVal: Role = r === "STAFF" ? "Staff" : "CEO";
      setRole(roleVal);
      setEmail(localStorage.getItem(DB_AUTH_EMAIL) || "");
      const rawTx = safeJsonParse<FinanceTx[]>(localStorage.getItem(DB_FIN), []);
      const rawBud = safeJsonParse<BudgetLine[]>(localStorage.getItem(DB_FIN_BUDGETS), []);
      const rawSet = safeJsonParse<FinanceSettings>(localStorage.getItem(DB_FIN_SETTINGS), defaultSettings());
      const rawAud = safeJsonParse<AuditItem[]>(localStorage.getItem(DB_FIN_AUDIT), []);
      setTxs(Array.isArray(rawTx) ? rawTx : []);
      setBudgets(Array.isArray(rawBud) ? rawBud : []);
      setSettings(rawSet || defaultSettings());
      setAudit(Array.isArray(rawAud) ? rawAud : []);
    } catch {
      // ignore
    }
  }, []);

  // Persist
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(DB_FIN, JSON.stringify(txs));
    } catch {}
  }, [txs, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(DB_FIN_BUDGETS, JSON.stringify(budgets));
    } catch {}
  }, [budgets, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(DB_FIN_SETTINGS, JSON.stringify(settings));
    } catch {}
  }, [settings, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(DB_FIN_AUDIT, JSON.stringify(audit));
    } catch {}
  }, [audit, mounted]);

  /* ================= AUTO RULES ================= */
  // 1) Auto mark overdue
  useEffect(() => {
    if (!mounted) return;
    const today = toYMD(new Date());
    let changed = false;
    const next = txs.map((t) => {
      if (t.status === "Paid") return t;
      if (t.dueDate && daysBetween(t.dueDate, today) > settings.overdueRuleDays) {
        if (t.status !== "Overdue") {
          changed = true;
          return { ...t, status: "Overdue", updatedAt: nowISO() };
        }
      }
      return t;
    });
    if (changed) {
      setTxs(next);
      pushAudit("AUTO_OVERDUE_SCAN", "Auto-marked overdue items based on dueDate.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, settings.overdueRuleDays]);

  // 2) Recurring (creates a cloned Tx when nextRun <= today)
  useEffect(() => {
    if (!mounted) return;
    const today = toYMD(new Date());
    let created = 0;
    const nextTxs: FinanceTx[] = [...txs];

    function addMonths(ymd: string, months: number) {
      const d = new Date(ymd + "T00:00:00");
      d.setMonth(d.getMonth() + months);
      return toYMD(d);
    }
    function addDays(ymd: string, days: number) {
      const d = new Date(ymd + "T00:00:00");
      d.setDate(d.getDate() + days);
      return toYMD(d);
    }

    const updated = txs.map((t) => {
      if (!t.recurring?.enabled || !t.recurring.nextRun) return t;
      if (t.recurring.nextRun > today) return t;

      // create new tx for nextRun date
      const newTx: FinanceTx = {
        ...t,
        id: Date.now() + Math.floor(Math.random() * 1000),
        createdAt: nowISO(),
        updatedAt: nowISO(),
        date: t.recurring.nextRun,
        status: "Planned",
        referenceId: "",
        invoiceNo: "",
        notes: (t.notes ? t.notes + "\n" : "") + `Auto-created from recurring (${t.recurring.freq}).`,
      };
      nextTxs.unshift(newTx);
      created += 1;

      // advance nextRun
      let nextRun = t.recurring.nextRun;
      if (t.recurring.freq === "Weekly") nextRun = addDays(nextRun, 7);
      if (t.recurring.freq === "Monthly") nextRun = addMonths(nextRun, 1);
      if (t.recurring.freq === "Quarterly") nextRun = addMonths(nextRun, 3);
      if (t.recurring.freq === "Yearly") nextRun = addMonths(nextRun, 12);

      return {
        ...t,
        updatedAt: nowISO(),
        recurring: { ...t.recurring, nextRun },
      };
    });

    if (created > 0) {
      setTxs(updated.length ? nextTxs : nextTxs);
      pushAudit("AUTO_RECUR_CREATE", `Auto-created ${created} recurring transaction(s).`);
      notify(`Auto-created ${created} recurring tx.`);
    } else if (updated.some((u, i) => u !== txs[i])) {
      setTxs(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  /* ================= DERIVED ================= */
  const currency = settings.defaultCurrency;

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return txs
      .filter((t) => {
        if (fType !== "All" && t.type !== fType) return false;
        if (fStatus !== "All" && t.status !== fStatus) return false;
        if (fCategory !== "All" && t.category !== fCategory) return false;
        if (fCur !== "All" && t.currency !== fCur) return false;
        if (from && t.date < from) return false;
        if (to && t.date > to) return false;
        if (!qq) return true;
        const blob = [
          t.description,
          t.clientName,
          t.vendorName,
          t.eventTitle,
          t.invoiceNo,
          t.referenceId,
          t.subcategory,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return blob.includes(qq);
      })
      .sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)));
  }, [txs, q, fType, fStatus, fCategory, fCur, from, to]);

  function totalAmount(t: FinanceTx) {
    // If gstIncluded: amount already includes GST; else add GST
    const base = parseNum(t.amount, 0);
    const gstRate = clamp(parseNum(t.gstRate, 0), 0, 28);
    const gstAdd = t.gstIncluded ? 0 : base * (gstRate / 100);
    const subtotal = base + gstAdd;

    // TDS as withheld (only meaningful for certain expense/vendor)
    const tdsRate = clamp(parseNum(t.tdsRate, 0), 0, 20);
    const tds = subtotal * (tdsRate / 100);

    // We treat totalAmount as subtotal; and show tds separately in UI
    return { base, gstRate, gstAdd, subtotal, tds };
  }

  const kpis = useMemo(() => {
    const curTx = txs.filter((t) => t.currency === currency);
    const paid = curTx.filter((t) => t.status === "Paid");
    const income = paid.filter((t) => t.type === "Income").reduce((s, t) => s + totalAmount(t).subtotal, 0);
    const expense = paid.filter((t) => t.type === "Expense").reduce((s, t) => s + totalAmount(t).subtotal, 0);
    const net = income - expense;

    const openAR = curTx
      .filter((t) => t.type === "Income" && t.status !== "Paid")
      .reduce((s, t) => s + totalAmount(t).subtotal, 0);

    const openAP = curTx
      .filter((t) => t.type === "Expense" && t.status !== "Paid")
      .reduce((s, t) => s + totalAmount(t).subtotal, 0);

    const overdueCount = curTx.filter((t) => t.status === "Overdue").length;

    // burn/runway from last 60 days expenses
    const today = toYMD(new Date());
    const since = toYMD(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000));
    const recentExp = paid
      .filter((t) => t.type === "Expense" && t.date >= since && t.date <= today)
      .reduce((s, t) => s + totalAmount(t).subtotal, 0);
    const dailyBurn = recentExp / 60;
    const monthlyBurn = dailyBurn * 30;

    // cash balance approximation: net paid overall (can be replaced by bank balance later)
    const cashBalance = net;

    const runwayMonths = monthlyBurn > 0 ? cashBalance / monthlyBurn : 999;

    const grossMarginPct = income > 0 ? ((income - expense) / income) * 100 : 0;

    return {
      income,
      expense,
      net,
      openAR,
      openAP,
      overdueCount,
      monthlyBurn,
      cashBalance,
      runwayMonths,
      grossMarginPct,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, currency, settings.showGst, settings.showTds]);

  const last12 = useMemo(() => {
    const months: string[] = [];
    const d = new Date();
    d.setDate(1);
    for (let i = 0; i < 12; i++) {
      const dd = new Date(d);
      dd.setMonth(d.getMonth() - i);
      months.unshift(toYM(dd));
    }

    const curTx = txs.filter((t) => t.currency === currency && t.status === "Paid");
    const map: Record<string, { inc: number; exp: number; net: number }> = {};
    months.forEach((m) => (map[m] = { inc: 0, exp: 0, net: 0 }));
    for (const t of curTx) {
      const m = t.date.slice(0, 7);
      if (!map[m]) continue;
      const amt = totalAmount(t).subtotal;
      if (t.type === "Income") map[m].inc += amt;
      else map[m].exp += amt;
    }
    months.forEach((m) => (map[m].net = map[m].inc - map[m].exp));
    return { months, map };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, currency]);

  const byCategory = useMemo(() => {
    const curPaid = txs.filter((t) => t.currency === currency && t.status === "Paid");
    const map: Record<string, { inc: number; exp: number }> = {};
    for (const t of curPaid) {
      const key = t.category || "Other";
      if (!map[key]) map[key] = { inc: 0, exp: 0 };
      const amt = totalAmount(t).subtotal;
      if (t.type === "Income") map[key].inc += amt;
      else map[key].exp += amt;
    }
    const rows = Object.entries(map).map(([k, v]) => ({ category: k, ...v, net: v.inc - v.exp }));
    rows.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs, currency]);

  const budgetForThisMonth = useMemo(() => {
    const m = toYM(new Date());
    return budgets.find((b) => b.month === m && b.currency === currency) || null;
  }, [budgets, currency]);

  const variance = useMemo(() => {
    if (!budgetForThisMonth) return null;
    const m = budgetForThisMonth.month;
    const curPaid = txs.filter(
      (t) => t.currency === currency && t.status === "Paid" && t.date.startsWith(m)
    );
    const inc = curPaid.filter((t) => t.type === "Income").reduce((s, t) => s + totalAmount(t).subtotal, 0);
    const exp = curPaid.filter((t) => t.type === "Expense").reduce((s, t) => s + totalAmount(t).subtotal, 0);
    const gmPct = inc > 0 ? ((inc - exp) / inc) * 100 : 0;
    return {
      inc,
      exp,
      gmPct,
      revVsTarget: inc - budgetForThisMonth.revenueTarget,
      expVsCap: exp - budgetForThisMonth.expenseCap,
      gmVsTarget: gmPct - budgetForThisMonth.grossMarginTargetPct,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetForThisMonth, txs, currency]);

  /* ================= ACTIONS: TX ================= */
  function openCreateTx(type?: TxType) {
    const today = toYMD(new Date());
    const base: FinanceTx = {
      id: Date.now(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      date: today,
      type: type || "Expense",
      status: "Planned",
      amount: 0,
      currency,
      category: "Other",
      description: "",
      paymentMethod: "Bank",
      gstRate: 0,
      gstIncluded: false,
      tdsRate: 0,
      dueDate: "",
      recurring: { enabled: false, freq: "Monthly", nextRun: "" },
      notes: "",
    };
    setEditingTx(base);
    setOpenTxModal(true);
  }

  function openEditTx(id: number) {
    const t = txs.find((x) => x.id === id);
    if (!t) return;
    setEditingTx({ ...t });
    setOpenTxModal(true);
  }

  function saveTx() {
    if (!editingTx) return;
    const clean: FinanceTx = {
      ...editingTx,
      updatedAt: nowISO(),
      amount: parseNum(editingTx.amount, 0),
      gstRate: clamp(parseNum(editingTx.gstRate, 0), 0, 28),
      tdsRate: clamp(parseNum(editingTx.tdsRate, 0), 0, 20),
      description: (editingTx.description || "").trim(),
      subcategory: (editingTx.subcategory || "").trim() || undefined,
      clientName: (editingTx.clientName || "").trim() || undefined,
      vendorName: (editingTx.vendorName || "").trim() || undefined,
      eventTitle: (editingTx.eventTitle || "").trim() || undefined,
      eventId: (editingTx.eventId || "").trim() || undefined,
      referenceId: (editingTx.referenceId || "").trim() || undefined,
      invoiceNo: (editingTx.invoiceNo || "").trim() || undefined,
      dueDate: (editingTx.dueDate || "").trim() || undefined,
      recurring: editingTx.recurring?.enabled
        ? {
            enabled: true,
            freq: editingTx.recurring.freq,
            nextRun: (editingTx.recurring.nextRun || "").trim() || undefined,
          }
        : { enabled: false, freq: "Monthly", nextRun: "" },
      notes: (editingTx.notes || "").trim() || undefined,
    };

    if (!clean.description) {
      notify("Description required.");
      return;
    }
    if (!clean.date) {
      notify("Date required.");
      return;
    }

    setTxs((prev) => {
      const exists = prev.some((t) => t.id === clean.id);
      const next = exists ? prev.map((t) => (t.id === clean.id ? clean : t)) : [clean, ...prev];
      return next;
    });

    pushAudit(
      txs.some((t) => t.id === clean.id) ? "UPDATE_TX" : "CREATE_TX",
      `${clean.type} ${clean.category} ${clean.description} (${clean.currency} ${clean.amount})`
    );
    setOpenTxModal(false);
    setEditingTx(null);
    notify("Saved.");
  }

  function deleteTx(id: number) {
    const t = txs.find((x) => x.id === id);
    if (!t) return;
    setTxs((prev) => prev.filter((x) => x.id !== id));
    pushAudit("DELETE_TX", `Deleted tx #${id} (${t.type} ${t.description})`);
    notify("Deleted.");
  }

  function bulkSetStatus(status: TxStatus) {
    if (!selectedIds.length) return;
    setTxs((prev) =>
      prev.map((t) => (selectedIds.includes(t.id) ? { ...t, status, updatedAt: nowISO() } : t))
    );
    pushAudit("BULK_UPDATE", `Bulk set status=${status} for ${selectedIds.length} tx.`);
    setSelected({});
    notify("Bulk updated.");
  }

  function bulkDelete() {
    if (!selectedIds.length) return;
    setTxs((prev) => prev.filter((t) => !selectedIds.includes(t.id)));
    pushAudit("BULK_UPDATE", `Bulk deleted ${selectedIds.length} tx.`);
    setSelected({});
    notify("Bulk deleted.");
  }

  /* ================= ACTIONS: BUDGET ================= */
  function openCreateBudget() {
    const m = toYM(new Date());
    const base = defaultBudgetLine(m, currency);
    setEditingBudget(base);
    setOpenBudgetModal(true);
  }

  function openEditBudget(id: number) {
    const b = budgets.find((x) => x.id === id);
    if (!b) return;
    setEditingBudget({ ...b, fixedCosts: { ...b.fixedCosts } });
    setOpenBudgetModal(true);
  }

  function saveBudget() {
    if (!editingBudget) return;
    const clean: BudgetLine = {
      ...editingBudget,
      updatedAt: nowISO(),
      revenueTarget: parseNum(editingBudget.revenueTarget, 0),
      expenseCap: parseNum(editingBudget.expenseCap, 0),
      grossMarginTargetPct: clamp(parseNum(editingBudget.grossMarginTargetPct, 0), 0, 100),
      fixedCosts: {
        officeRentUtilities: parseNum(editingBudget.fixedCosts.officeRentUtilities, 0),
        salaries: parseNum(editingBudget.fixedCosts.salaries, 0),
        marketing: parseNum(editingBudget.fixedCosts.marketing, 0),
        internetMisc: parseNum(editingBudget.fixedCosts.internetMisc, 0),
        transportLogistics: parseNum(editingBudget.fixedCosts.transportLogistics, 0),
        adminCompliance: parseNum(editingBudget.fixedCosts.adminCompliance, 0),
      },
      notes: (editingBudget.notes || "").trim() || undefined,
    };
    if (!clean.month) {
      notify("Month required.");
      return;
    }
    setBudgets((prev) => {
      const exists = prev.some((b) => b.id === clean.id);
      const sameKey = prev.some((b) => b.id !== clean.id && b.month === clean.month && b.currency === clean.currency);
      if (sameKey) {
        notify("Budget for this month & currency already exists.");
        return prev;
      }
      return exists ? prev.map((b) => (b.id === clean.id ? clean : b)) : [clean, ...prev];
    });
    pushAudit(
      budgets.some((b) => b.id === clean.id) ? "UPDATE_BUDGET" : "CREATE_BUDGET",
      `Budget ${clean.month} (${clean.currency})`
    );
    setOpenBudgetModal(false);
    setEditingBudget(null);
    notify("Saved.");
  }

  function deleteBudget(id: number) {
    const b = budgets.find((x) => x.id === id);
    if (!b) return;
    setBudgets((prev) => prev.filter((x) => x.id !== id));
    pushAudit("DELETE_BUDGET", `Deleted budget ${b.month} (${b.currency})`);
    notify("Deleted.");
  }

  /* ================= EXPORT / IMPORT ================= */
  function exportCSV(which: "filtered" | "all") {
    const rows = (which === "all" ? txs : filtered).slice().sort((a, b) => a.date.localeCompare(b.date));
    const headers = [
      "id",
      "date",
      "type",
      "status",
      "currency",
      "amount",
      "gstRate",
      "gstIncluded",
      "tdsRate",
      "total",
      "category",
      "subcategory",
      "description",
      "clientName",
      "vendorName",
      "eventTitle",
      "eventId",
      "paymentMethod",
      "referenceId",
      "invoiceNo",
      "dueDate",
      "recurringEnabled",
      "recurringFreq",
      "recurringNextRun",
      "notes",
      "createdAt",
      "updatedAt",
    ];
    const lines = [headers.join(",")];
    for (const t of rows) {
      const calc = totalAmount(t);
      const vals = [
        t.id,
        t.date,
        t.type,
        t.status,
        t.currency,
        t.amount,
        t.gstRate ?? "",
        t.gstIncluded ? "true" : "false",
        t.tdsRate ?? "",
        calc.subtotal,
        t.category,
        t.subcategory ?? "",
        t.description ?? "",
        t.clientName ?? "",
        t.vendorName ?? "",
        t.eventTitle ?? "",
        t.eventId ?? "",
        t.paymentMethod,
        t.referenceId ?? "",
        t.invoiceNo ?? "",
        t.dueDate ?? "",
        t.recurring?.enabled ? "true" : "false",
        t.recurring?.freq ?? "",
        t.recurring?.nextRun ?? "",
        t.notes ?? "",
        t.createdAt,
        t.updatedAt,
      ].map(escCSV);
      lines.push(vals.join(","));
    }
    downloadText(`eventura_finance_${which}_${toYMD(new Date())}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
    pushAudit("EXPORT", `Exported CSV (${which}) rows=${rows.length}`);
    notify("CSV exported.");
  }

  function exportJSON() {
    const payload = {
      version: 1,
      exportedAt: nowISO(),
      settings,
      budgets,
      txs,
      audit,
    };
    downloadText(`eventura_finance_backup_${toYMD(new Date())}.json`, JSON.stringify(payload, null, 2), "application/json");
    pushAudit("EXPORT", `Exported JSON backup (tx=${txs.length}, budgets=${budgets.length})`);
    notify("JSON exported.");
  }

  const [importText, setImportText] = useState("");
  function importJSON() {
    try {
      const obj = JSON.parse(importText || "{}");
      const nextTx = Array.isArray(obj.txs) ? (obj.txs as FinanceTx[]) : [];
      const nextBud = Array.isArray(obj.budgets) ? (obj.budgets as BudgetLine[]) : [];
      const nextSet = obj.settings ? (obj.settings as FinanceSettings) : settings;
      const nextAud = Array.isArray(obj.audit) ? (obj.audit as AuditItem[]) : audit;

      setTxs(nextTx);
      setBudgets(nextBud);
      setSettings({ ...defaultSettings(), ...nextSet });
      setAudit(nextAud);
      pushAudit("IMPORT", `Imported JSON backup (tx=${nextTx.length}, budgets=${nextBud.length})`);
      notify("Imported JSON.");
    } catch {
      notify("Invalid JSON.");
    }
  }

  function importCSV() {
    // basic CSV (headers required; extra columns ignored)
    const raw = importText || "";
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      notify("CSV needs header + rows.");
      return;
    }
    const header = parseCSVLine(lines[0]);
    const idx = (k: string) => header.indexOf(k);

    const next: FinanceTx[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const get = (k: string) => (idx(k) >= 0 ? cols[idx(k)] : "");
      const t: FinanceTx = {
        id: parseNum(get("id"), Date.now() + i),
        createdAt: get("createdAt") || nowISO(),
        updatedAt: nowISO(),
        date: get("date") || toYMD(new Date()),
        type: (get("type") as TxType) || "Expense",
        status: (get("status") as TxStatus) || "Planned",
        currency: (get("currency") as any) || currency,
        amount: parseNum(get("amount"), 0),
        gstRate: parseNum(get("gstRate"), 0),
        gstIncluded: String(get("gstIncluded")).toLowerCase() === "true",
        tdsRate: parseNum(get("tdsRate"), 0),
        category: (get("category") as TxTag) || "Other",
        subcategory: get("subcategory") || undefined,
        description: get("description") || "",
        clientName: get("clientName") || undefined,
        vendorName: get("vendorName") || undefined,
        eventTitle: get("eventTitle") || undefined,
        eventId: get("eventId") || undefined,
        paymentMethod: (get("paymentMethod") as PayMethod) || "Bank",
        referenceId: get("referenceId") || undefined,
        invoiceNo: get("invoiceNo") || undefined,
        dueDate: get("dueDate") || undefined,
        recurring: {
          enabled: String(get("recurringEnabled")).toLowerCase() === "true",
          freq: ((get("recurringFreq") as any) || "Monthly") as any,
          nextRun: get("recurringNextRun") || undefined,
        },
        notes: get("notes") || undefined,
      };
      if (t.description.trim()) next.push(t);
    }
    setTxs((prev) => {
      // merge by id (import overrides)
      const map = new Map<number, FinanceTx>();
      for (const p of prev) map.set(p.id, p);
      for (const n of next) map.set(n.id, n);
      return Array.from(map.values()).sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)));
    });
    pushAudit("IMPORT", `Imported CSV rows=${next.length}`);
    notify("Imported CSV.");
  }

  function parseCSVLine(line: string) {
    // minimal CSV parser supporting quotes
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQ = false;
          }
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ",") {
          out.push(cur);
          cur = "";
        } else cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  /* ================= FINANCE AI (local) ================= */
  const financeAI = useMemo(() => {
    // rule-based insights (no external calls)
    const tips: Array<{ title: string; detail: string; level: "OK" | "Warn" | "Alert" }> = [];
    const m = toYM(new Date());

    if (kpis.overdueCount > 0) {
      tips.push({
        title: `Overdue items: ${kpis.overdueCount}`,
        detail: "Collect receivables faster and renegotiate vendor due dates. Add strict 50%-40%-10% collection rule.",
        level: "Alert",
      });
    }

    if (variance && variance.expVsCap > 0) {
      tips.push({
        title: "Expense cap breached (this month)",
        detail: `Expenses exceed budget by ${money(variance.expVsCap, currency)}. Freeze non-essential spends and shift to vendor credit where possible.`,
        level: "Warn",
      });
    }

    if (variance && variance.revVsTarget < 0) {
      tips.push({
        title: "Revenue below target (this month)",
        detail: `Revenue is short by ${money(Math.abs(variance.revVsTarget), currency)}. Push deposits, upsell add-ons, and close 2–3 fast corporate gigs.`,
        level: "Warn",
      });
    }

    if (kpis.grossMarginPct < 20 && kpis.income > 0) {
      tips.push({
        title: "Low gross margin",
        detail: "Raise package pricing or reduce rentals. Increase owned inventory usage to improve margin.",
        level: "Warn",
      });
    }

    if (kpis.runwayMonths < 2) {
      tips.push({
        title: "Runway is tight",
        detail: `Estimated runway ~${kpis.runwayMonths.toFixed(1)} months. Increase deposits, cut burn, and avoid large upfront equipment buys this month.`,
        level: "Alert",
      });
    } else if (kpis.runwayMonths > 6 && kpis.cashBalance > 0) {
      tips.push({
        title: "Healthy runway",
        detail: "Consider strategic spend: portfolio shoots, key vendor retainers, and inventory items with fast ROI.",
        level: "OK",
      });
    }

    // Seasonal reminder for wedding/festive months in India (generic)
    const monthNum = Number(m.slice(5, 7));
    if ([10, 11, 12, 1, 2].includes(monthNum)) {
      tips.push({
        title: "Peak season readiness",
        detail: "Lock vendor rates early, collect deposits upfront, and create cash buffer for high-volume execution weeks.",
        level: "OK",
      });
    }

    if (tips.length === 0) {
      tips.push({ title: "All stable", detail: "No major risks detected. Keep tracking budgets weekly.", level: "OK" });
    }

    return tips;
  }, [kpis, variance, currency]);

  /* ================= UI HELPERS ================= */
  function StatCard({
    title,
    value,
    sub,
    tone = "neutral",
  }: {
    title: string;
    value: string;
    sub?: string;
    tone?: "neutral" | "good" | "bad" | "warn";
  }) {
    const ring =
      tone === "good"
        ? "border-emerald-400/25"
        : tone === "bad"
        ? "border-red-400/25"
        : tone === "warn"
        ? "border-amber-300/25"
        : "border-white/15";
    return (
      <div className={cls("rounded-2xl border bg-white/5 p-4", ring)}>
        <div className="text-xs text-white/55">{title}</div>
        <div className="mt-1 text-lg font-semibold text-white">{value}</div>
        {sub ? <div className="mt-1 text-xs text-white/45">{sub}</div> : null}
      </div>
    );
  }

  function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{title}</div>
        {right}
      </div>
    );
  }

  /* ================= RENDER ================= */
  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">
              <div className="text-xs text-white/60">Eventura OS</div>
              <div className="text-sm font-semibold">Finance</div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <Pill label={role} />
              {email ? <Pill label={email} /> : null}
              <Pill label={`Currency: ${currency}`} />
              <Pill label={`Tx: ${txs.length}`} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Btn variant="ghost" onClick={() => exportCSV("filtered")} title="Export current filtered view as CSV (Excel opens CSV)">
              Export CSV (Filtered)
            </Btn>
            <Btn variant="ghost" onClick={exportJSON} title="Full backup export (JSON)">
              Backup JSON
            </Btn>
            <div className="hidden sm:flex items-center gap-2">
              <Btn onClick={() => openCreateTx("Income")} disabled={!canEdit}>
                + Income
              </Btn>
              <Btn onClick={() => openCreateTx("Expense")} disabled={!canEdit}>
                + Expense
              </Btn>
            </div>
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-black hover:text-white"
            >
              Back
            </Link>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <div className="md:sticky md:top-[72px] md:h-[calc(100vh-84px)]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 text-xs text-white/50">Navigation</div>
            {(["Dashboard", "Transactions", "Budgets", "AR/AP", "Reports", "Import/Export", "Settings"] as Tab[]).map(
              (t) => {
                const active = tab === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cls(
                      "mb-2 w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                      active
                        ? "border-white/25 bg-black text-white"
                        : "border-white/10 bg-transparent text-white/80 hover:bg-black hover:text-white hover:border-white/20"
                    )}
                  >
                    {t}
                  </button>
                );
              }
            )}

            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-xs text-white/55">Quick Filters</div>
              <div className="mt-2 space-y-2">
                <Input value={q} onChange={setQ} placeholder="Search (client, vendor, event, invoice…)" />
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={fType}
                    onChange={(v) => setFType(v as any)}
                    options={[
                      { value: "All", label: "All Types" },
                      { value: "Income", label: "Income" },
                      { value: "Expense", label: "Expense" },
                    ]}
                  />
                  <Select
                    value={fStatus}
                    onChange={(v) => setFStatus(v as any)}
                    options={[
                      { value: "All", label: "All Status" },
                      { value: "Planned", label: "Planned" },
                      { value: "Pending", label: "Pending" },
                      { value: "Paid", label: "Paid" },
                      { value: "Overdue", label: "Overdue" },
                    ]}
                  />
                </div>
                <Select
                  value={fCategory}
                  onChange={(v) => setFCategory(v as any)}
                  options={[
                    { value: "All", label: "All Categories" },
                    { value: "Sales", label: "Sales" },
                    { value: "ClientAdvance", label: "Client Advance" },
                    { value: "VendorPayment", label: "Vendor Payment" },
                    { value: "Salary", label: "Salary" },
                    { value: "Marketing", label: "Marketing" },
                    { value: "Office", label: "Office" },
                    { value: "Transport", label: "Transport" },
                    { value: "Equipment", label: "Equipment" },
                    { value: "Tax", label: "Tax" },
                    { value: "Refund", label: "Refund" },
                    { value: "Other", label: "Other" },
                  ]}
                />
                <Select
                  value={fCur}
                  onChange={(v) => setFCur(v as any)}
                  options={[
                    { value: "All", label: "All Currencies" },
                    { value: "INR", label: "INR" },
                    { value: "CAD", label: "CAD" },
                    { value: "USD", label: "USD" },
                    { value: "Other", label: "Other" },
                  ]}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={from} onChange={setFrom} type="date" />
                  <Input value={to} onChange={setTo} type="date" />
                </div>
                <div className="flex gap-2">
                  <Btn
                    variant="outline"
                    onClick={() => {
                      setQ("");
                      setFType("All");
                      setFStatus("All");
                      setFCategory("All");
                      setFCur("All");
                      setFrom("");
                      setTo("");
                      setSelected({});
                      notify("Filters reset.");
                    }}
                  >
                    Reset
                  </Btn>
                  <Btn variant="outline" onClick={() => exportCSV("filtered")}>
                    CSV
                  </Btn>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-xs text-white/55">Bulk Actions</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Btn variant="ghost" onClick={() => bulkSetStatus("Paid")} disabled={!canEdit || !selectedIds.length}>
                  Mark Paid
                </Btn>
                <Btn variant="ghost" onClick={() => bulkSetStatus("Pending")} disabled={!canEdit || !selectedIds.length}>
                  Mark Pending
                </Btn>
                <Btn variant="ghost" onClick={() => bulkSetStatus("Overdue")} disabled={!canEdit || !selectedIds.length}>
                  Mark Overdue
                </Btn>
                <Btn variant="danger" onClick={bulkDelete} disabled={!canEdit || !selectedIds.length}>
                  Delete
                </Btn>
              </div>
              <div className="mt-2 text-xs text-white/45">Selected: {selectedIds.length}</div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="space-y-4">
          {/* Toast */}
          {toast ? (
            <div className="rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white">
              {toast}
            </div>
          ) : null}

          {tab === "Dashboard" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <StatCard title="Paid Income" value={money(kpis.income, currency)} tone="good" />
                <StatCard title="Paid Expense" value={money(kpis.expense, currency)} tone="bad" />
                <StatCard title="Net" value={money(kpis.net, currency)} tone={kpis.net >= 0 ? "good" : "bad"} />
                <StatCard
                  title="Gross Margin"
                  value={`${kpis.grossMarginPct.toFixed(1)}%`}
                  sub="Paid income vs expense"
                  tone={kpis.grossMarginPct >= 25 ? "good" : kpis.grossMarginPct >= 20 ? "warn" : "bad"}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <StatCard title="Open Receivables (AR)" value={money(kpis.openAR, currency)} tone={kpis.openAR > 0 ? "warn" : "neutral"} />
                <StatCard title="Open Payables (AP)" value={money(kpis.openAP, currency)} tone={kpis.openAP > 0 ? "warn" : "neutral"} />
                <StatCard title="Overdue Count" value={`${kpis.overdueCount}`} tone={kpis.overdueCount > 0 ? "bad" : "neutral"} />
                <StatCard
                  title="Monthly Burn (est.)"
                  value={money(kpis.monthlyBurn, currency)}
                  sub={`Runway ~${kpis.runwayMonths === 999 ? "∞" : kpis.runwayMonths.toFixed(1)} months`}
                  tone={kpis.runwayMonths < 2 ? "bad" : kpis.runwayMonths < 4 ? "warn" : "neutral"}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <SectionTitle
                    title="Month Trend (Last 12)"
                    right={<Pill label="Paid only" />}
                  />
                  <div className="mt-3 overflow-auto">
                    <table className="min-w-full border-separate border-spacing-0">
                      <thead>
                        <tr className="text-left text-xs text-white/55">
                          <th className="sticky left-0 bg-[#0b0b0b] px-2 py-2">Month</th>
                          <th className="px-2 py-2">Income</th>
                          <th className="px-2 py-2">Expense</th>
                          <th className="px-2 py-2">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {last12.months.map((m) => {
                          const row = last12.map[m];
                          return (
                            <tr
                              key={m}
                              className="text-sm text-white/85 hover:bg-black"
                            >
                              <td className="sticky left-0 bg-[#0b0b0b] px-2 py-2">{m}</td>
                              <td className="px-2 py-2">{money(row.inc, currency)}</td>
                              <td className="px-2 py-2">{money(row.exp, currency)}</td>
                              <td className={cls("px-2 py-2", row.net >= 0 ? "text-emerald-200" : "text-red-200")}>
                                {money(row.net, currency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <SectionTitle title="Finance AI (Local Insights)" right={<Pill label="No external API" />} />
                  <div className="mt-3 space-y-2">
                    {financeAI.map((t, i) => (
                      <div
                        key={i}
                        className={cls(
                          "rounded-xl border px-3 py-3",
                          t.level === "Alert"
                            ? "border-red-500/30 bg-red-500/10"
                            : t.level === "Warn"
                            ? "border-amber-400/25 bg-amber-400/10"
                            : "border-white/10 bg-black/30"
                        )}
                      >
                        <div className="text-sm font-semibold">{t.title}</div>
                        <div className="mt-1 text-xs text-white/65">{t.detail}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="text-xs text-white/55">This Month Budget</div>
                    {budgetForThisMonth ? (
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-white/70">Revenue Target</span>
                          <span>{money(budgetForThisMonth.revenueTarget, currency)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/70">Expense Cap</span>
                          <span>{money(budgetForThisMonth.expenseCap, currency)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/70">GM Target</span>
                          <span>{budgetForThisMonth.grossMarginTargetPct}%</span>
                        </div>
                        {variance ? (
                          <div className="mt-2 rounded-xl border border-white/10 bg-[#0b0b0b] p-2 text-xs text-white/70">
                            <div className="flex items-center justify-between">
                              <span>Revenue variance</span>
                              <span className={variance.revVsTarget >= 0 ? "text-emerald-200" : "text-red-200"}>
                                {money(variance.revVsTarget, currency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Expense variance</span>
                              <span className={variance.expVsCap <= 0 ? "text-emerald-200" : "text-red-200"}>
                                {money(variance.expVsCap, currency)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>GM variance</span>
                              <span className={variance.gmVsTarget >= 0 ? "text-emerald-200" : "text-red-200"}>
                                {variance.gmVsTarget.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-white/70">
                        No budget set for <span className="font-semibold">{toYM(new Date())}</span>.
                        <div className="mt-2">
                          <Btn onClick={openCreateBudget} disabled={!canEdit}>
                            + Create Budget (template)
                          </Btn>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <SectionTitle title="Category Summary (Paid)" right={<Pill label={currency} />} />
                <div className="mt-3 overflow-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="text-left text-xs text-white/55">
                        <th className="px-2 py-2">Category</th>
                        <th className="px-2 py-2">Income</th>
                        <th className="px-2 py-2">Expense</th>
                        <th className="px-2 py-2">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byCategory.map((r) => (
                        <tr key={r.category} className="text-sm text-white/85 hover:bg-black">
                          <td className="px-2 py-2">{r.category}</td>
                          <td className="px-2 py-2">{money(r.inc, currency)}</td>
                          <td className="px-2 py-2">{money(r.exp, currency)}</td>
                          <td className={cls("px-2 py-2", r.net >= 0 ? "text-emerald-200" : "text-red-200")}>
                            {money(r.net, currency)}
                          </td>
                        </tr>
                      ))}
                      {!byCategory.length ? (
                        <tr>
                          <td className="px-2 py-3 text-sm text-white/60" colSpan={4}>
                            No paid transactions yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "Transactions" ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <SectionTitle
                title={`Transactions (${filtered.length})`}
                right={
                  <div className="flex items-center gap-2">
                    <Btn onClick={() => openCreateTx("Income")} disabled={!canEdit}>
                      + Income
                    </Btn>
                    <Btn onClick={() => openCreateTx("Expense")} disabled={!canEdit}>
                      + Expense
                    </Btn>
                    <Btn variant="outline" onClick={() => exportCSV("filtered")}>
                      Export CSV
                    </Btn>
                  </div>
                }
              />

              <div className="mt-3 overflow-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left text-xs text-white/55">
                      <th className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && selectedIds.length === filtered.length}
                          onChange={(e) => {
                            const v = e.target.checked;
                            const next: Record<number, boolean> = {};
                            if (v) filtered.forEach((t) => (next[t.id] = true));
                            setSelected(next);
                          }}
                        />
                      </th>
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Type</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Category</th>
                      <th className="px-2 py-2">Description</th>
                      <th className="px-2 py-2">Party</th>
                      <th className="px-2 py-2">Event</th>
                      <th className="px-2 py-2">Total</th>
                      <th className="px-2 py-2">Due</th>
                      <th className="px-2 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => {
                      const calc = totalAmount(t);
                      const party = t.clientName || t.vendorName || "-";
                      const due = t.dueDate ? `${t.dueDate}${t.status === "Overdue" ? " (Overdue)" : ""}` : "-";
                      return (
                        <tr key={t.id} className="text-sm text-white/85 hover:bg-black">
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={!!selected[t.id]}
                              onChange={(e) => setSelected((p) => ({ ...p, [t.id]: e.target.checked }))}
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">{t.date}</td>
                          <td className={cls("px-2 py-2", t.type === "Income" ? "text-emerald-200" : "text-red-200")}>
                            {t.type}
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span
                              className={cls(
                                "rounded-lg border px-2 py-1 text-xs",
                                t.status === "Paid"
                                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                                  : t.status === "Overdue"
                                  ? "border-red-400/30 bg-red-400/10 text-red-200"
                                  : t.status === "Pending"
                                  ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
                                  : "border-white/15 bg-white/5 text-white/75"
                              )}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-col gap-1">
                              <span>{t.category}</span>
                              {t.subcategory ? <span className="text-xs text-white/45">{t.subcategory}</span> : null}
                            </div>
                          </td>
                          <td className="px-2 py-2 min-w-[240px]">
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">{t.description}</span>
                              <div className="flex flex-wrap gap-1">
                                {t.invoiceNo ? <Pill label={`Inv: ${t.invoiceNo}`} /> : null}
                                {t.referenceId ? <Pill label={`Ref: ${t.referenceId}`} /> : null}
                                {t.recurring?.enabled ? <Pill label={`Rec: ${t.recurring.freq}`} /> : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-2 py-2">{party}</td>
                          <td className="px-2 py-2">{t.eventTitle || "-"}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className={t.type === "Income" ? "text-emerald-200" : "text-red-200"}>
                                {money(calc.subtotal, t.currency)}
                              </span>
                              {settings.showGst && calc.gstAdd > 0 ? (
                                <span className="text-xs text-white/45">GST +{money(calc.gstAdd, t.currency)}</span>
                              ) : null}
                              {settings.showTds && calc.tds > 0 ? (
                                <span className="text-xs text-white/45">TDS -{money(calc.tds, t.currency)}</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">{due}</td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Btn variant="ghost" onClick={() => openEditTx(t.id)} disabled={!canEdit}>
                                Edit
                              </Btn>
                              <Btn variant="danger" onClick={() => deleteTx(t.id)} disabled={!canEdit}>
                                Delete
                              </Btn>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!filtered.length ? (
                      <tr>
                        <td colSpan={11} className="px-2 py-6 text-center text-sm text-white/60">
                          No transactions match filters.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "Budgets" ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <SectionTitle
                title={`Budgets (${budgets.length})`}
                right={
                  <div className="flex items-center gap-2">
                    <Btn onClick={openCreateBudget} disabled={!canEdit}>
                      + Create Budget
                    </Btn>
                    <Btn
                      variant="outline"
                      onClick={() => {
                        // create next month budget quickly
                        const d = new Date();
                        d.setMonth(d.getMonth() + 1);
                        const m = toYM(d);
                        const b = defaultBudgetLine(m, currency);
                        setEditingBudget(b);
                        setOpenBudgetModal(true);
                      }}
                      disabled={!canEdit}
                    >
                      + Next Month Template
                    </Btn>
                  </div>
                }
              />

              <div className="mt-3 overflow-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="text-left text-xs text-white/55">
                      <th className="px-2 py-2">Month</th>
                      <th className="px-2 py-2">Currency</th>
                      <th className="px-2 py-2">Revenue Target</th>
                      <th className="px-2 py-2">Expense Cap</th>
                      <th className="px-2 py-2">GM Target</th>
                      <th className="px-2 py-2">Fixed Cost Total</th>
                      <th className="px-2 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgets
                      .slice()
                      .sort((a, b) => (a.month === b.month ? b.id - a.id : b.month.localeCompare(a.month)))
                      .map((b) => {
                        const fixedTotal =
                          b.fixedCosts.officeRentUtilities +
                          b.fixedCosts.salaries +
                          b.fixedCosts.marketing +
                          b.fixedCosts.internetMisc +
                          b.fixedCosts.transportLogistics +
                          b.fixedCosts.adminCompliance;
                        return (
                          <tr key={b.id} className="text-sm text-white/85 hover:bg-black">
                            <td className="px-2 py-2">{b.month}</td>
                            <td className="px-2 py-2">{b.currency}</td>
                            <td className="px-2 py-2">{money(b.revenueTarget, b.currency)}</td>
                            <td className="px-2 py-2">{money(b.expenseCap, b.currency)}</td>
                            <td className="px-2 py-2">{b.grossMarginTargetPct}%</td>
                            <td className="px-2 py-2">{money(fixedTotal, b.currency)}</td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                <Btn variant="ghost" onClick={() => openEditBudget(b.id)} disabled={!canEdit}>
                                  Edit
                                </Btn>
                                <Btn variant="danger" onClick={() => deleteBudget(b.id)} disabled={!canEdit}>
                                  Delete
                                </Btn>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    {!budgets.length ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-6 text-center text-sm text-white/60">
                          No budgets yet. Create one using template.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === "AR/AP" ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <SectionTitle title="Accounts Receivable (AR)" right={<Pill label="Income not paid" />} />
                <div className="mt-3 space-y-2">
                  {txs
                    .filter((t) => t.type === "Income" && t.status !== "Paid")
                    .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"))
                    .slice(0, 50)
                    .map((t) => {
                      const calc = totalAmount(t);
                      return (
                        <div key={t.id} className="rounded-xl border border-white/10 bg-black/30 p-3 hover:bg-black">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">{t.description}</div>
                              <div className="mt-1 text-xs text-white/60">
                                {t.clientName ? `Client: ${t.clientName}` : "Client: -"} • {t.date}
                                {t.dueDate ? ` • Due: ${t.dueDate}` : ""}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                <Pill label={t.status} />
                                {t.eventTitle ? <Pill label={`Event: ${t.eventTitle}`} /> : null}
                                {t.invoiceNo ? <Pill label={`Inv: ${t.invoiceNo}`} /> : null}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-emerald-200">{money(calc.subtotal, t.currency)}</div>
                              {canEdit ? (
                                <div className="mt-2 flex justify-end gap-2">
                                  <Btn variant="ghost" onClick={() => openEditTx(t.id)}>
                                    Edit
                                  </Btn>
                                  <Btn variant="ghost" onClick={() => bulkSetStatus("Paid")} disabled>
                                    {/* placeholder */}
                                  </Btn>
                                  <Btn variant="outline" onClick={() => {
                                    setSelected((p) => ({ ...p, [t.id]: true }));
                                    notify("Selected for bulk actions.");
                                  }}>
                                    Select
                                  </Btn>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {txs.filter((t) => t.type === "Income" && t.status !== "Paid").length === 0 ? (
                    <div className="text-sm text-white/60">No receivables.</div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <SectionTitle title="Accounts Payable (AP)" right={<Pill label="Expense not paid" />} />
                <div className="mt-3 space-y-2">
                  {txs
                    .filter((t) => t.type === "Expense" && t.status !== "Paid")
                    .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"))
                    .slice(0, 50)
                    .map((t) => {
                      const calc = totalAmount(t);
                      return (
                        <div key={t.id} className="rounded-xl border border-white/10 bg-black/30 p-3 hover:bg-black">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">{t.description}</div>
                              <div className="mt-1 text-xs text-white/60">
                                {t.vendorName ? `Vendor: ${t.vendorName}` : "Vendor: -"} • {t.date}
                                {t.dueDate ? ` • Due: ${t.dueDate}` : ""}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                <Pill label={t.status} />
                                <Pill label={t.category} />
                                {t.eventTitle ? <Pill label={`Event: ${t.eventTitle}`} /> : null}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-red-200">{money(calc.subtotal, t.currency)}</div>
                              {canEdit ? (
                                <div className="mt-2 flex justify-end gap-2">
                                  <Btn variant="ghost" onClick={() => openEditTx(t.id)}>
                                    Edit
                                  </Btn>
                                  <Btn
                                    variant="outline"
                                    onClick={() => {
                                      setSelected((p) => ({ ...p, [t.id]: true }));
                                      notify("Selected for bulk actions.");
                                    }}
                                  >
                                    Select
                                  </Btn>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {txs.filter((t) => t.type === "Expense" && t.status !== "Paid").length === 0 ? (
                    <div className="text-sm text-white/60">No payables.</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "Reports" ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <SectionTitle title="Reports" right={<Pill label="Use filters on left to slice data" />} />
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs text-white/55">Filtered Totals</div>
                    {(() => {
                      const inc = filtered
                        .filter((t) => t.type === "Income")
                        .reduce((s, t) => s + totalAmount(t).subtotal, 0);
                      const exp = filtered
                        .filter((t) => t.type === "Expense")
                        .reduce((s, t) => s + totalAmount(t).subtotal, 0);
                      return (
                        <div className="mt-2 space-y-1 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-white/70">Income</span>
                            <span className="text-emerald-200">{money(inc, currency)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-white/70">Expense</span>
                            <span className="text-red-200">{money(exp, currency)}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                            <span className="text-white/70">Net</span>
                            <span className={inc - exp >= 0 ? "text-emerald-200" : "text-red-200"}>
                              {money(inc - exp, currency)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="mt-3 flex gap-2">
                      <Btn variant="outline" onClick={() => exportCSV("filtered")}>
                        Export CSV
                      </Btn>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs text-white/55">Top Overdue</div>
                    <div className="mt-2 space-y-2">
                      {txs
                        .filter((t) => t.status === "Overdue")
                        .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"))
                        .slice(0, 6)
                        .map((t) => (
                          <div key={t.id} className="rounded-xl border border-white/10 bg-[#0b0b0b] p-2 hover:bg-black">
                            <div className="text-sm font-semibold">{t.description}</div>
                            <div className="mt-1 text-xs text-white/60">
                              {t.type} • {t.currency} • Due: {t.dueDate || "-"}
                            </div>
                          </div>
                        ))}
                      {txs.filter((t) => t.status === "Overdue").length === 0 ? (
                        <div className="text-sm text-white/60">No overdue items.</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="text-xs text-white/55">Audit (latest)</div>
                    <div className="mt-2 space-y-2">
                      {audit.slice(0, 8).map((a) => (
                        <div key={a.id} className="rounded-xl border border-white/10 bg-[#0b0b0b] p-2 hover:bg-black">
                          <div className="text-xs text-white/60">{new Date(a.at).toLocaleString()}</div>
                          <div className="text-sm font-semibold">{a.action}</div>
                          <div className="text-xs text-white/65">{a.details}</div>
                        </div>
                      ))}
                      {audit.length === 0 ? <div className="text-sm text-white/60">No audit yet.</div> : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "Import/Export" ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <SectionTitle
                title="Import / Export"
                right={
                  <div className="flex flex-wrap items-center gap-2">
                    <Btn variant="outline" onClick={() => exportCSV("all")}>
                      Export CSV (All)
                    </Btn>
                    <Btn variant="outline" onClick={exportJSON}>
                      Backup JSON
                    </Btn>
                  </div>
                }
              />

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-sm font-semibold">Import JSON / CSV</div>
                  <div className="mt-2 text-xs text-white/60">
                    Paste JSON backup OR CSV content (with headers). Import will merge by <b>id</b> for CSV.
                  </div>
                  <div className="mt-3">
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      rows={12}
                      className="w-full rounded-2xl border border-white/15 bg-black/50 p-3 text-sm text-white outline-none hover:border-white/25 focus:border-white/30"
                      placeholder="Paste JSON or CSV here…"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn onClick={importJSON} disabled={!canEdit}>
                      Import JSON
                    </Btn>
                    <Btn onClick={importCSV} disabled={!canEdit}>
                      Import CSV
                    </Btn>
                    <Btn variant="ghost" onClick={() => setImportText("")}>
                      Clear
                    </Btn>
                  </div>
                  {!canEdit ? (
                    <div className="mt-2 text-xs text-red-200">Staff role: import disabled.</div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-sm font-semibold">CSV Header Template</div>
                  <div className="mt-2 text-xs text-white/60">Use this header row for CSV import/export.</div>
                  <div className="mt-3 rounded-2xl border border-white/10 bg-[#0b0b0b] p-3 text-xs text-white/70">
                    id,date,type,status,currency,amount,gstRate,gstIncluded,tdsRate,total,category,subcategory,description,clientName,vendorName,eventTitle,eventId,paymentMethod,referenceId,invoiceNo,dueDate,recurringEnabled,recurringFreq,recurringNextRun,notes,createdAt,updatedAt
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Btn
                      variant="outline"
                      onClick={() =>
                        downloadText(
                          "eventura_finance_csv_header_template.csv",
                          "id,date,type,status,currency,amount,gstRate,gstIncluded,tdsRate,total,category,subcategory,description,clientName,vendorName,eventTitle,eventId,paymentMethod,referenceId,invoiceNo,dueDate,recurringEnabled,recurringFreq,recurringNextRun,notes,createdAt,updatedAt\n",
                          "text/csv;charset=utf-8"
                        )
                      }
                    >
                      Download Template
                    </Btn>
                    <Btn
                      variant="outline"
                      onClick={() => {
                        // also provide sample row
                        const sample =
                          "id,date,type,status,currency,amount,gstRate,gstIncluded,tdsRate,total,category,subcategory,description,clientName,vendorName,eventTitle,eventId,paymentMethod,referenceId,invoiceNo,dueDate,recurringEnabled,recurringFreq,recurringNextRun,notes,createdAt,updatedAt\n" +
                          `${Date.now()},${toYMD(new Date())},Income,Pending,${currency},50000,0,false,0,,Sales,,Wedding booking advance,Client A,,,Wedding A,,Bank,UTR123,INV-001,${toYMD(
                            new Date(Date.now() + 7 * 86400000)
                          )},false,Monthly,,Sample note,${nowISO()},${nowISO()}\n`;
                        downloadText("eventura_finance_csv_sample.csv", sample, "text/csv;charset=utf-8");
                      }}
                    >
                      Download Sample
                    </Btn>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "Settings" ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <SectionTitle title="Finance Settings" />
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs text-white/55">Default Currency</div>
                  <div className="mt-2">
                    <Select
                      value={settings.defaultCurrency}
                      onChange={(v) => {
                        const next = { ...settings, defaultCurrency: v as any };
                        setSettings(next);
                        pushAudit("SETTINGS_UPDATE", `defaultCurrency=${v}`);
                        notify("Saved.");
                      }}
                      options={[
                        { value: "INR", label: "INR" },
                        { value: "CAD", label: "CAD" },
                        { value: "USD", label: "USD" },
                        { value: "Other", label: "Other" },
                      ]}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs text-white/55">Overdue Rule (days)</div>
                  <div className="mt-2">
                    <Input
                      value={String(settings.overdueRuleDays)}
                      onChange={(v) => {
                        const n = clamp(parseNum(v, 0), -30, 365);
                        const next = { ...settings, overdueRuleDays: n };
                        setSettings(next);
                        pushAudit("SETTINGS_UPDATE", `overdueRuleDays=${n}`);
                      }}
                      type="number"
                    />
                  </div>
                  <div className="mt-2 text-xs text-white/60">
                    If dueDate is before today by more than this value, tx becomes Overdue automatically.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs text-white/55">Display</div>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={settings.showGst}
                        onChange={(e) => {
                          const next = { ...settings, showGst: e.target.checked };
                          setSettings(next);
                          pushAudit("SETTINGS_UPDATE", `showGst=${e.target.checked}`);
                        }}
                      />
                      Show GST breakdown
                    </label>
                    <label className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="checkbox"
                        checked={settings.showTds}
                        onChange={(e) => {
                          const next = { ...settings, showTds: e.target.checked };
                          setSettings(next);
                          pushAudit("SETTINGS_UPDATE", `showTds=${e.target.checked}`);
                        }}
                      />
                      Show TDS breakdown
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                <SectionTitle title="Admin Tools" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Btn
                    variant="danger"
                    disabled={!canEdit}
                    onClick={() => {
                      if (!confirm("Reset ALL finance data? This cannot be undone.")) return;
                      setTxs([]);
                      setBudgets([]);
                      setAudit([]);
                      setSettings(defaultSettings());
                      pushAudit("BULK_UPDATE", "RESET_ALL_FINANCE_DATA");
                      notify("Reset done.");
                    }}
                  >
                    Reset All Finance Data
                  </Btn>
                </div>
                {!canEdit ? <div className="mt-2 text-xs text-red-200">Staff role: admin tools disabled.</div> : null}
              </div>
            </div>
          ) : null}

          {/* Default when tab not matched */}
          {!["Dashboard", "Transactions", "Budgets", "AR/AP", "Reports", "Import/Export", "Settings"].includes(tab) ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
              Unknown tab.
            </div>
          ) : null}
        </div>
      </div>

      {/* TX MODAL */}
      <Modal
        open={openTxModal}
        title={editingTx ? (txs.some((t) => t.id === editingTx.id) ? "Edit Transaction" : "New Transaction") : "Transaction"}
        onClose={() => {
          setOpenTxModal(false);
          setEditingTx(null);
        }}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-white/55">
              {editingTx ? (
                <>
                  <span className="font-semibold">Total:</span>{" "}
                  {money(totalAmount(editingTx).subtotal, editingTx.currency)}
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Btn
                variant="ghost"
                onClick={() => {
                  setOpenTxModal(false);
                  setEditingTx(null);
                }}
              >
                Cancel
              </Btn>
              <Btn onClick={saveTx} disabled={!canEdit}>
                Save
              </Btn>
            </div>
          </div>
        }
      >
        {editingTx ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold">Basics</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-xs text-white/55">Date</div>
                  <Input value={editingTx.date} onChange={(v) => setEditingTx((p) => ({ ...p!, date: v }))} type="date" />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Due Date</div>
                  <Input
                    value={editingTx.dueDate || ""}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, dueDate: v }))}
                    type="date"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Type</div>
                  <Select
                    value={editingTx.type}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, type: v as any }))}
                    options={[
                      { value: "Income", label: "Income" },
                      { value: "Expense", label: "Expense" },
                    ]}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Status</div>
                  <Select
                    value={editingTx.status}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, status: v as any }))}
                    options={[
                      { value: "Planned", label: "Planned" },
                      { value: "Pending", label: "Pending" },
                      { value: "Paid", label: "Paid" },
                      { value: "Overdue", label: "Overdue" },
                    ]}
                  />
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 text-xs text-white/55">Description</div>
                <Input
                  value={editingTx.description}
                  onChange={(v) => setEditingTx((p) => ({ ...p!, description: v }))}
                  placeholder="e.g., Wedding booking advance / Vendor payment / Office rent…"
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-xs text-white/55">Category</div>
                  <Select
                    value={editingTx.category}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, category: v as any }))}
                    options={[
                      { value: "Sales", label: "Sales" },
                      { value: "ClientAdvance", label: "Client Advance" },
                      { value: "VendorPayment", label: "Vendor Payment" },
                      { value: "Salary", label: "Salary" },
                      { value: "Marketing", label: "Marketing" },
                      { value: "Office", label: "Office" },
                      { value: "Transport", label: "Transport" },
                      { value: "Equipment", label: "Equipment" },
                      { value: "Tax", label: "Tax" },
                      { value: "Refund", label: "Refund" },
                      { value: "Other", label: "Other" },
                    ]}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Subcategory</div>
                  <Input
                    value={editingTx.subcategory || ""}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, subcategory: v }))}
                    placeholder="optional"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold">Amount & Payment</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-xs text-white/55">Currency</div>
                  <Select
                    value={editingTx.currency}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, currency: v as any }))}
                    options={[
                      { value: "INR", label: "INR" },
                      { value: "CAD", label: "CAD" },
                      { value: "USD", label: "USD" },
                      { value: "Other", label: "Other" },
                    ]}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Amount</div>
                  <Input
                    value={String(editingTx.amount)}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, amount: parseNum(v, 0) }))}
                    type="number"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Payment Method</div>
                  <Select
                    value={editingTx.paymentMethod}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, paymentMethod: v as any }))}
                    options={[
                      { value: "Bank", label: "Bank" },
                      { value: "UPI", label: "UPI" },
                      { value: "Cash", label: "Cash" },
                      { value: "Card", label: "Card" },
                      { value: "Cheque", label: "Cheque" },
                      { value: "Other", label: "Other" },
                    ]}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Reference ID</div>
                  <Input
                    value={editingTx.referenceId || ""}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, referenceId: v }))}
                    placeholder="UTR / Txn ID"
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-xs text-white/55">Invoice No</div>
                  <Input
                    value={editingTx.invoiceNo || ""}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, invoiceNo: v }))}
                    placeholder="optional"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={!!editingTx.gstIncluded}
                      onChange={(e) => setEditingTx((p) => ({ ...p!, gstIncluded: e.target.checked }))}
                    />
                    GST included
                  </label>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-xs text-white/55">GST %</div>
                  <Input
                    value={String(editingTx.gstRate ?? 0)}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, gstRate: clamp(parseNum(v, 0), 0, 28) }))}
                    type="number"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">TDS %</div>
                  <Input
                    value={String(editingTx.tdsRate ?? 0)}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, tdsRate: clamp(parseNum(v, 0), 0, 20) }))}
                    type="number"
                  />
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-[#0b0b0b] p-3 text-xs text-white/70">
                {(() => {
                  const c = totalAmount(editingTx);
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Base</span>
                        <span>{money(c.base, editingTx.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>GST add</span>
                        <span>{money(c.gstAdd, editingTx.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/10 pt-1">
                        <span className="font-semibold">Total</span>
                        <span className="font-semibold">{money(c.subtotal, editingTx.currency)}</span>
                      </div>
                      {settings.showTds && c.tds > 0 ? (
                        <div className="flex items-center justify-between">
                          <span>TDS (withheld)</span>
                          <span>-{money(c.tds, editingTx.currency)}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold">Parties & Event Link</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-xs text-white/55">Client Name</div>
                  <Input
                    value={editingTx.clientName || ""}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, clientName: v }))}
                    placeholder="optional"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Vendor Name</div>
                  <Input
                    value={editingTx.vendorName || ""}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, vendorName: v }))}
                    placeholder="optional"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Event Title</div>
                  <Input
                    value={editingTx.eventTitle || ""}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, eventTitle: v }))}
                    placeholder="optional"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Event ID</div>
                  <Input
                    value={editingTx.eventId || ""}
                    onChange={(v) => setEditingTx((p) => ({ ...p!, eventId: v }))}
                    placeholder="optional"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold">Recurring</div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!editingTx.recurring?.enabled}
                  onChange={(e) =>
                    setEditingTx((p) => ({
                      ...p!,
                      recurring: { ...(p!.recurring || { enabled: false, freq: "Monthly", nextRun: "" }), enabled: e.target.checked },
                    }))
                  }
                />
                <div className="text-sm text-white/80">Enable recurring</div>
              </div>
              {editingTx.recurring?.enabled ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <div className="mb-1 text-xs text-white/55">Frequency</div>
                    <Select
                      value={editingTx.recurring.freq}
                      onChange={(v) => setEditingTx((p) => ({ ...p!, recurring: { ...p!.recurring!, freq: v as any } }))}
                      options={[
                        { value: "Weekly", label: "Weekly" },
                        { value: "Monthly", label: "Monthly" },
                        { value: "Quarterly", label: "Quarterly" },
                        { value: "Yearly", label: "Yearly" },
                      ]}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-white/55">Next Run</div>
                    <Input
                      value={editingTx.recurring.nextRun || ""}
                      onChange={(v) =>
                        setEditingTx((p) => ({ ...p!, recurring: { ...p!.recurring!, nextRun: v } }))
                      }
                      type="date"
                    />
                  </div>
                </div>
              ) : null}
              <div className="mt-3 text-xs text-white/60">
                When Next Run date arrives, a new transaction is auto-created (status Planned) and Next Run advances.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 md:col-span-2">
              <div className="text-sm font-semibold">Notes</div>
              <div className="mt-2">
                <textarea
                  value={editingTx.notes || ""}
                  onChange={(e) => setEditingTx((p) => ({ ...p!, notes: e.target.value }))}
                  rows={4}
                  className="w-full rounded-2xl border border-white/15 bg-black/50 p-3 text-sm text-white outline-none hover:border-white/25 focus:border-white/30"
                  placeholder="internal notes…"
                />
              </div>
            </div>
          </div>
        ) : null}
        {!canEdit ? <div className="mt-3 text-xs text-red-200">Staff role: editing disabled.</div> : null}
      </Modal>

      {/* BUDGET MODAL */}
      <Modal
        open={openBudgetModal}
        title={editingBudget ? (budgets.some((b) => b.id === editingBudget.id) ? "Edit Budget" : "New Budget") : "Budget"}
        onClose={() => {
          setOpenBudgetModal(false);
          setEditingBudget(null);
        }}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-white/55">Template is editable.</div>
            <div className="flex items-center gap-2">
              <Btn
                variant="ghost"
                onClick={() => {
                  setOpenBudgetModal(false);
                  setEditingBudget(null);
                }}
              >
                Cancel
              </Btn>
              <Btn onClick={saveBudget} disabled={!canEdit}>
                Save
              </Btn>
            </div>
          </div>
        }
      >
        {editingBudget ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold">Budget Targets</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-xs text-white/55">Month</div>
                  <Input
                    value={editingBudget.month}
                    onChange={(v) => setEditingBudget((p) => ({ ...p!, month: v }))}
                    placeholder="YYYY-MM"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Currency</div>
                  <Select
                    value={editingBudget.currency}
                    onChange={(v) => setEditingBudget((p) => ({ ...p!, currency: v as any }))}
                    options={[
                      { value: "INR", label: "INR" },
                      { value: "CAD", label: "CAD" },
                      { value: "USD", label: "USD" },
                      { value: "Other", label: "Other" },
                    ]}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Revenue Target</div>
                  <Input
                    value={String(editingBudget.revenueTarget)}
                    onChange={(v) => setEditingBudget((p) => ({ ...p!, revenueTarget: parseNum(v, 0) }))}
                    type="number"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Expense Cap</div>
                  <Input
                    value={String(editingBudget.expenseCap)}
                    onChange={(v) => setEditingBudget((p) => ({ ...p!, expenseCap: parseNum(v, 0) }))}
                    type="number"
                  />
                </div>
                <div className="md:col-span-2">
                  <div className="mb-1 text-xs text-white/55">Gross Margin Target %</div>
                  <Input
                    value={String(editingBudget.grossMarginTargetPct)}
                    onChange={(v) =>
                      setEditingBudget((p) => ({ ...p!, grossMarginTargetPct: clamp(parseNum(v, 0), 0, 100) }))
                    }
                    type="number"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold">Fixed Costs Breakdown</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <div className="mb-1 text-xs text-white/55">Office Rent & Utilities</div>
                  <Input
                    value={String(editingBudget.fixedCosts.officeRentUtilities)}
                    onChange={(v) =>
                      setEditingBudget((p) => ({
                        ...p!,
                        fixedCosts: { ...p!.fixedCosts, officeRentUtilities: parseNum(v, 0) },
                      }))
                    }
                    type="number"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Salaries</div>
                  <Input
                    value={String(editingBudget.fixedCosts.salaries)}
                    onChange={(v) =>
                      setEditingBudget((p) => ({ ...p!, fixedCosts: { ...p!.fixedCosts, salaries: parseNum(v, 0) } }))
                    }
                    type="number"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Marketing</div>
                  <Input
                    value={String(editingBudget.fixedCosts.marketing)}
                    onChange={(v) =>
                      setEditingBudget((p) => ({ ...p!, fixedCosts: { ...p!.fixedCosts, marketing: parseNum(v, 0) } }))
                    }
                    type="number"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Internet & Misc</div>
                  <Input
                    value={String(editingBudget.fixedCosts.internetMisc)}
                    onChange={(v) =>
                      setEditingBudget((p) => ({
                        ...p!,
                        fixedCosts: { ...p!.fixedCosts, internetMisc: parseNum(v, 0) },
                      }))
                    }
                    type="number"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Transport & Logistics</div>
                  <Input
                    value={String(editingBudget.fixedCosts.transportLogistics)}
                    onChange={(v) =>
                      setEditingBudget((p) => ({
                        ...p!,
                        fixedCosts: { ...p!.fixedCosts, transportLogistics: parseNum(v, 0) },
                      }))
                    }
                    type="number"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-white/55">Admin & Compliance</div>
                  <Input
                    value={String(editingBudget.fixedCosts.adminCompliance)}
                    onChange={(v) =>
                      setEditingBudget((p) => ({
                        ...p!,
                        fixedCosts: { ...p!.fixedCosts, adminCompliance: parseNum(v, 0) },
                      }))
                    }
                    type="number"
                  />
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-[#0b0b0b] p-3 text-xs text-white/70">
                {(() => {
                  const total =
                    editingBudget.fixedCosts.officeRentUtilities +
                    editingBudget.fixedCosts.salaries +
                    editingBudget.fixedCosts.marketing +
                    editingBudget.fixedCosts.internetMisc +
                    editingBudget.fixedCosts.transportLogistics +
                    editingBudget.fixedCosts.adminCompliance;
                  return (
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Fixed Cost Total</span>
                      <span className="font-semibold">{money(total, editingBudget.currency)}</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 md:col-span-2">
              <div className="text-sm font-semibold">Notes</div>
              <div className="mt-2">
                <textarea
                  value={editingBudget.notes || ""}
                  onChange={(e) => setEditingBudget((p) => ({ ...p!, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded-2xl border border-white/15 bg-black/50 p-3 text-sm text-white outline-none hover:border-white/25 focus:border-white/30"
                  placeholder="notes…"
                />
              </div>
            </div>
          </div>
        ) : null}
        {!canEdit ? <div className="mt-3 text-xs text-red-200">Staff role: editing disabled.</div> : null}
      </Modal>
    </div>
  );
}
