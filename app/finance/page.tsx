// app/finance/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/* =========================================================
   Eventura OS — Finance (Deploy-safe, no libs)
   - Real OS layout (header + nav) INSIDE this page
   - Black hover everywhere
   - Advanced finance: KPI bar, Views (Board/Table/Calendar/Reports),
     Filters, Search, Import/Export CSV (Excel-ready), Demo data,
     Add/Edit/Duplicate/Delete, Overdue detection
========================================================= */

/* =========================
   STORAGE
========================= */
const LS_TX = "eventura_fin_tx_v6";
const LS_PREF = "eventura_fin_pref_v6";
const LS_AUTH_ROLE = "eventura-role";
const LS_AUTH_EMAIL = "eventura-email";

/* =========================
   TYPES
========================= */
type Role = "CEO" | "Staff";
type TxType = "Income" | "Expense";
type TxStatus = "Planned" | "Pending" | "Paid" | "Overdue" | "Cancelled";
type Currency = "INR" | "CAD" | "USD" | "Other";
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

type EventType =
  | "Wedding"
  | "Corporate"
  | "Conference"
  | "Party"
  | "Training"
  | "Exhibition"
  | "Festival"
  | "Other";

type LayoutView = "Board" | "Table" | "Calendar" | "Reports";
type SortKey = "date" | "amount" | "status" | "category" | "title";
type SortDir = "asc" | "desc";
type ColorBy = "None" | "Status" | "Category" | "Type";

type FinanceTx = {
  id: string;
  createdAt: string;
  updatedAt: string;

  title: string;
  date: string; // YYYY-MM-DD
  dueDate?: string;

  type: TxType;
  status: TxStatus;

  amount: number;
  currency: Currency;

  category: TxTag;
  eventType: EventType;

  clientName?: string;
  vendorName?: string;
  eventTitle?: string;

  paymentMethod: PayMethod;
  referenceId?: string;
  invoiceNo?: string;

  notes?: string;
};

type Prefs = {
  month: string; // YYYY-MM
  view: LayoutView;

  q: string;
  type: TxType | "All";
  status: TxStatus | "All";
  category: TxTag | "All";
  currency: Currency | "All";
  eventType: EventType | "All";
  from: string; // YYYY-MM-DD or ""
  to: string;

  sortKey: SortKey;
  sortDir: SortDir;
  colorBy: ColorBy;
};

/* =========================
   ENUMS
========================= */
const TX_TYPES: TxType[] = ["Income", "Expense"];
const TX_STATUSES: TxStatus[] = ["Planned", "Pending", "Paid", "Overdue", "Cancelled"];
const CURRENCIES: Currency[] = ["INR", "CAD", "USD", "Other"];
const METHODS: PayMethod[] = ["Cash", "UPI", "Bank", "Card", "Cheque", "Other"];
const TAGS: TxTag[] = [
  "Sales",
  "ClientAdvance",
  "VendorPayment",
  "Salary",
  "Marketing",
  "Office",
  "Transport",
  "Equipment",
  "Tax",
  "Refund",
  "Other",
];
const EVENT_TYPES: EventType[] = [
  "Wedding",
  "Corporate",
  "Conference",
  "Party",
  "Training",
  "Exhibition",
  "Festival",
  "Other",
];

/* =========================
   UTILS
========================= */
function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
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
function safeJsonParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function parseNum(v: any, fallback = 0) {
  const n =
    typeof v === "number"
      ? v
      : Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : fallback;
}
function money(n: number, cur: Currency) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${cur} ${parts.join(".")}`;
}
function isSameYM(ym: string, ymd: string) {
  return ymd.slice(0, 7) === ym;
}
function daysBetween(aYMD: string, bYMD: string) {
  const a = new Date(aYMD + "T00:00:00");
  const b = new Date(bYMD + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
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
function toneForStatus(s: TxStatus) {
  if (s === "Paid") return "good";
  if (s === "Overdue") return "bad";
  if (s === "Pending") return "warn";
  if (s === "Cancelled") return "muted";
  return "neutral";
}
function toneForType(t: TxType) {
  return t === "Income" ? "good" : "bad";
}
function toneForCategory(c: TxTag) {
  if (c === "Sales" || c === "ClientAdvance") return "good";
  if (c === "VendorPayment" || c === "Salary") return "warn";
  if (c === "Tax") return "bad";
  return "neutral";
}

/* =========================
   UI PRIMITIVES (black hover)
========================= */
function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn" | "muted";
}) {
  const m =
    tone === "good"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
      : tone === "bad"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-200"
      : tone === "warn"
      ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
      : tone === "muted"
      ? "border-white/10 bg-white/5 text-white/55"
      : "border-white/15 bg-white/5 text-white/80";
  return (
    <span className={cls("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]", m)}>
      {children}
    </span>
  );
}

function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm transition border select-none";
  const v =
    variant === "primary"
      ? "border-white/15 bg-white/10 text-white hover:bg-black hover:border-white/25"
      : variant === "outline"
      ? "border-white/20 bg-transparent text-white/90 hover:bg-black"
      : variant === "danger"
      ? "border-rose-400/35 bg-rose-400/10 text-rose-200 hover:bg-black hover:border-rose-400/60"
      : "border-transparent bg-transparent text-white/80 hover:bg-black hover:text-white";
  return (
    <button
      title={title}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cls(base, v, disabled && "opacity-50 pointer-events-none", className)}
    >
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      disabled={disabled}
      className={cls(
        "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-white/30 hover:border-white/25",
        disabled && "opacity-60 cursor-not-allowed"
      )}
    />
  );
}

function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cls(
        "w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-white/30 hover:border-white/25",
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-black text-white">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className={cls(
        "w-full rounded-2xl border border-white/15 bg-black/50 p-3 text-sm text-white outline-none hover:border-white/25 focus:border-white/30",
        disabled && "opacity-60 cursor-not-allowed"
      )}
      placeholder={placeholder}
    />
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  maxW = "max-w-5xl",
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  maxW?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className={cls("w-full overflow-hidden rounded-2xl border border-white/15 bg-[#0b0b0b] shadow-2xl", maxW)}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="text-base font-semibold text-white">{title}</div>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/80 hover:bg-black hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="max-h-[74vh] overflow-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-white/10 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

/* =========================
   DEFAULT PREFS
========================= */
function defaultPrefs(): Prefs {
  return {
    month: toYM(new Date()),
    view: "Board",

    q: "",
    type: "All",
    status: "All",
    category: "All",
    currency: "All",
    eventType: "All",
    from: "",
    to: "",

    sortKey: "date",
    sortDir: "desc",
    colorBy: "Status",
  };
}

/* =========================
   DEMO
========================= */
function demoTx(month: string): FinanceTx[] {
  const y = month.slice(0, 4);
  const m = month.slice(5, 7);
  const mk = (d: string) => `${y}-${m}-${d}`;
  const id = () => Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);

  return [
    {
      id: id(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      title: "Client advance — Wedding",
      date: mk("05"),
      dueDate: mk("05"),
      type: "Income",
      status: "Paid",
      amount: 75000,
      currency: "INR",
      category: "ClientAdvance",
      eventType: "Wedding",
      clientName: "Patel Family",
      eventTitle: "Patel Wedding",
      paymentMethod: "UPI",
      referenceId: "UPI-ADV-001",
      invoiceNo: "INV-001",
      notes: "Advance received.",
    },
    {
      id: id(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      title: "Vendor payout — Decor",
      date: mk("08"),
      dueDate: mk("10"),
      type: "Expense",
      status: "Pending",
      amount: 42000,
      currency: "INR",
      category: "VendorPayment",
      eventType: "Wedding",
      vendorName: "Decor House",
      eventTitle: "Patel Wedding",
      paymentMethod: "Bank",
      referenceId: "NEFT-8891",
      invoiceNo: "V-DEC-889",
      notes: "Balance payment pending.",
    },
    {
      id: id(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      title: "Marketing — Instagram ads",
      date: mk("12"),
      dueDate: mk("12"),
      type: "Expense",
      status: "Paid",
      amount: 12000,
      currency: "INR",
      category: "Marketing",
      eventType: "Other",
      paymentMethod: "Card",
      referenceId: "META-ADS-12",
      notes: "Lead gen campaign.",
    },
    {
      id: id(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      title: "Invoice — Corporate event",
      date: mk("16"),
      dueDate: mk("18"),
      type: "Income",
      status: "Pending",
      amount: 110000,
      currency: "INR",
      category: "Sales",
      eventType: "Corporate",
      clientName: "Zenix Pvt Ltd",
      eventTitle: "Zenix Annual Meet",
      paymentMethod: "Bank",
      invoiceNo: "INV-002",
      notes: "Follow up for payment.",
    },
  ];
}

/* =========================
   MAIN
========================= */
export default function FinancePage() {
  const [role, setRole] = useState<Role>("CEO");
  const [email, setEmail] = useState<string>("Unknown");
  const [txs, setTxs] = useState<FinanceTx[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs());

  const [addOpen, setAddOpen] = useState(false);
  const [edit, setEdit] = useState<FinanceTx | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const today = toYMD(new Date());

  /* LOAD */
  useEffect(() => {
    const r = String(localStorage.getItem(LS_AUTH_ROLE) ?? "").toUpperCase() === "STAFF" ? "Staff" : "CEO";
    const e = String(localStorage.getItem(LS_AUTH_EMAIL) ?? "") || "Unknown";
    setRole(r as Role);
    setEmail(e);

    const p = safeJsonParse<Prefs | null>(localStorage.getItem(LS_PREF), null);
    setPrefs(p ?? defaultPrefs());

    const raw = safeJsonParse<any[]>(localStorage.getItem(LS_TX), []);
    const cleaned: FinanceTx[] = (raw || [])
      .map((x) => normalizeTx(x))
      .filter((x): x is FinanceTx => Boolean(x));
    setTxs(cleaned);
  }, []);

  /* SAVE */
  useEffect(() => {
    localStorage.setItem(LS_PREF, JSON.stringify(prefs));
  }, [prefs]);
  useEffect(() => {
    localStorage.setItem(LS_TX, JSON.stringify(txs));
  }, [txs]);

  /* OVERDUE AUTO */
  useEffect(() => {
    setTxs((prev) =>
      prev.map((t) => {
        const due = t.dueDate || t.date;
        const shouldBeOverdue =
          t.status !== "Paid" &&
          t.status !== "Cancelled" &&
          due &&
          daysBetween(due, today) > 0;
        if (shouldBeOverdue && t.status !== "Overdue") {
          return { ...t, status: "Overdue", updatedAt: nowISO() };
        }
        return t;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  function normalizeTx(raw: any): FinanceTx | null {
    if (!raw || typeof raw !== "object") return null;

    const id = String((raw as any).id ?? "");
    if (!id) return null;

    const type: TxType = TX_TYPES.includes((raw as any).type) ? (raw as any).type : "Expense";
    const status: TxStatus = TX_STATUSES.includes((raw as any).status) ? (raw as any).status : "Planned";
    const currency: Currency = CURRENCIES.includes((raw as any).currency) ? (raw as any).currency : "INR";
    const category: TxTag = TAGS.includes((raw as any).category) ? (raw as any).category : "Other";
    const eventType: EventType = EVENT_TYPES.includes((raw as any).eventType) ? (raw as any).eventType : "Other";
    const paymentMethod: PayMethod = METHODS.includes((raw as any).paymentMethod) ? (raw as any).paymentMethod : "Bank";

    const date = typeof (raw as any).date === "string" && (raw as any).date ? (raw as any).date : toYMD(new Date());
    const dueDate = typeof (raw as any).dueDate === "string" && (raw as any).dueDate ? (raw as any).dueDate : undefined;

    return {
      id,
      createdAt: typeof (raw as any).createdAt === "string" ? (raw as any).createdAt : nowISO(),
      updatedAt: typeof (raw as any).updatedAt === "string" ? (raw as any).updatedAt : nowISO(),

      title: String((raw as any).title ?? "Untitled"),
      date,
      dueDate,

      type,
      status,

      amount: parseNum((raw as any).amount, 0),
      currency,

      category,
      eventType,

      clientName: typeof (raw as any).clientName === "string" ? (raw as any).clientName : undefined,
      vendorName: typeof (raw as any).vendorName === "string" ? (raw as any).vendorName : undefined,
      eventTitle: typeof (raw as any).eventTitle === "string" ? (raw as any).eventTitle : undefined,

      paymentMethod,
      referenceId: typeof (raw as any).referenceId === "string" ? (raw as any).referenceId : undefined,
      invoiceNo: typeof (raw as any).invoiceNo === "string" ? (raw as any).invoiceNo : undefined,

      notes: typeof (raw as any).notes === "string" ? (raw as any).notes : undefined,
    };
  }

  /* FILTER + SORT + MONTH */
  const filtered = useMemo(() => {
    const q = prefs.q.trim().toLowerCase();
    const from = prefs.from.trim();
    const to = prefs.to.trim();

    const inRange = (d: string) => {
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };

    const base = txs.filter((t) => {
      if (!isSameYM(prefs.month, t.date)) return false;
      if (prefs.type !== "All" && t.type !== prefs.type) return false;
      if (prefs.status !== "All" && t.status !== prefs.status) return false;
      if (prefs.category !== "All" && t.category !== prefs.category) return false;
      if (prefs.currency !== "All" && t.currency !== prefs.currency) return false;
      if (prefs.eventType !== "All" && t.eventType !== prefs.eventType) return false;
      if (!inRange(t.date)) return false;

      if (!q) return true;
      const hay = [
        t.title,
        t.clientName,
        t.vendorName,
        t.eventTitle,
        t.category,
        t.status,
        t.type,
        t.currency,
        t.invoiceNo,
        t.referenceId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });

    const dir = prefs.sortDir === "asc" ? 1 : -1;
    const key = prefs.sortKey;

    base.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (key === "date") {
        av = a.date;
        bv = b.date;
      } else if (key === "amount") {
        av = a.amount;
        bv = b.amount;
      } else if (key === "status") {
        av = a.status;
        bv = b.status;
      } else if (key === "category") {
        av = a.category;
        bv = b.category;
      } else {
        av = a.title;
        bv = b.title;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    return base;
  }, [prefs, txs]);

  /* KPI (month) */
  const kpi = useMemo(() => {
    let income = 0;
    let expense = 0;
    let ar = 0; // pending income
    let ap = 0; // pending expense
    let overdue = 0;

    for (const t of filtered) {
      const amt = t.amount;
      if (t.type === "Income") income += amt;
      else expense += amt;

      if (t.type === "Income" && (t.status === "Pending" || t.status === "Overdue")) ar += amt;
      if (t.type === "Expense" && (t.status === "Pending" || t.status === "Overdue")) ap += amt;
      if (t.status === "Overdue") overdue += 1;
    }

    const net = income - expense;
    return { income, expense, net, ar, ap, overdue };
  }, [filtered]);

  /* ACTIONS */
  function upsertTx(next: FinanceTx) {
    setTxs((prev) => {
      const ix = prev.findIndex((x) => x.id === next.id);
      if (ix >= 0) {
        const copy = prev.slice();
        copy[ix] = { ...next, updatedAt: nowISO() };
        return copy;
      }
      return [{ ...next, createdAt: nowISO(), updatedAt: nowISO() }, ...prev];
    });
  }

  function removeTx(id: string) {
    setTxs((prev) => prev.filter((x) => x.id !== id));
  }

  function duplicateTx(tx: FinanceTx) {
    const id = Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
    upsertTx({
      ...tx,
      id,
      title: `${tx.title} (Copy)`,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });
  }

  function loadDemo() {
    setTxs((prev) => {
      const demo = demoTx(prefs.month);
      // avoid duplicates by title+date+amount quick check
      const exists = new Set(prev.map((t) => `${t.title}__${t.date}__${t.amount}`));
      const merged = [...demo.filter((d) => !exists.has(`${d.title}__${d.date}__${d.amount}`)), ...prev];
      return merged;
    });
  }

  /* EXPORT CSV (Excel-ready) */
  function exportCSV(label: "excel" | "csv") {
    const cols = [
      "id",
      "title",
      "date",
      "dueDate",
      "type",
      "status",
      "amount",
      "currency",
      "category",
      "eventType",
      "clientName",
      "vendorName",
      "eventTitle",
      "paymentMethod",
      "referenceId",
      "invoiceNo",
      "notes",
      "createdAt",
      "updatedAt",
    ] as const;

    const header = cols.join(",");
    const rows = filtered.map((t) =>
      cols
        .map((c) => {
          const v = (t as any)[c];
          return escCSV(v);
        })
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const name = `eventura_finance_${prefs.month}_${label}.csv`;
    downloadText(name, csv, "text/csv;charset=utf-8");
  }

  /* IMPORT CSV (paste) */
  function importFromCSV() {
    const raw = importText.trim();
    if (!raw) return;

    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return;

    // naive CSV split (supports quotes reasonably)
    const parseLine = (line: string) => {
      const out: string[] = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && (i === 0 || line[i - 1] !== "\\")) {
          if (inQ && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQ = !inQ;
          }
        } else if (ch === "," && !inQ) {
          out.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out.map((s) => s.trim());
    };

    const header = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
    const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

    const required = ["id", "title", "date", "type", "status", "amount", "currency", "category", "eventType"];
    const ok = required.every((k) => idx(k) >= 0);
    if (!ok) return;

    const next: FinanceTx[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = parseLine(lines[i]).map((v) => v.replace(/^"|"$/g, ""));
      const get = (k: string) => {
        const j = idx(k);
        return j >= 0 ? parts[j] : "";
      };

      const tx = normalizeTx({
        id: get("id") || Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36),
        title: get("title") || "Untitled",
        date: get("date") || toYMD(new Date()),
        dueDate: get("dueDate") || undefined,
        type: get("type"),
        status: get("status"),
        amount: get("amount"),
        currency: get("currency"),
        category: get("category"),
        eventType: get("eventType"),
        clientName: get("clientName") || undefined,
        vendorName: get("vendorName") || undefined,
        eventTitle: get("eventTitle") || undefined,
        paymentMethod: get("paymentMethod"),
        referenceId: get("referenceId") || undefined,
        invoiceNo: get("invoiceNo") || undefined,
        notes: get("notes") || undefined,
        createdAt: get("createdAt") || nowISO(),
        updatedAt: get("updatedAt") || nowISO(),
      });

      if (tx) next.push(tx);
    }

    setTxs((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]));
      for (const t of next) map.set(t.id, t);
      return Array.from(map.values());
    });

    setImportText("");
    setImportOpen(false);
  }

  /* CALENDAR GRID (simple month) */
  const calendar = useMemo(() => {
    const [yy, mm] = prefs.month.split("-").map((x) => Number(x));
    const first = new Date(yy, mm - 1, 1);
    const firstDow = first.getDay(); // 0 Sun
    const daysInMonth = new Date(yy, mm, 0).getDate();

    const cells: Array<{ ymd: string; day: number; income: number; expense: number; count: number }> = [];

    for (let pad = 0; pad < firstDow; pad++) {
      cells.push({ ymd: "", day: 0, income: 0, expense: 0, count: 0 });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${yy}-${pad2(mm)}-${pad2(d)}`;
      const list = filtered.filter((t) => t.date === ymd);
      let income = 0;
      let expense = 0;
      for (const t of list) {
        if (t.type === "Income") income += t.amount;
        else expense += t.amount;
      }
      cells.push({ ymd, day: d, income, expense, count: list.length });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ ymd: "", day: 0, income: 0, expense: 0, count: 0 });
    }
    return { cells, daysInMonth, firstDow };
  }, [filtered, prefs.month]);

  /* REPORTS */
  const reports = useMemo(() => {
    const byCategory = new Map<string, { income: number; expense: number; count: number }>();
    const byStatus = new Map<string, { sum: number; count: number }>();

    for (const t of filtered) {
      const cat = t.category;
      const cur = byCategory.get(cat) || { income: 0, expense: 0, count: 0 };
      if (t.type === "Income") cur.income += t.amount;
      else cur.expense += t.amount;
      cur.count += 1;
      byCategory.set(cat, cur);

      const st = t.status;
      const ss = byStatus.get(st) || { sum: 0, count: 0 };
      ss.sum += t.type === "Income" ? t.amount : -t.amount;
      ss.count += 1;
      byStatus.set(st, ss);
    }

    const catRows = Array.from(byCategory.entries()).map(([k, v]) => ({
      category: k,
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
      count: v.count,
    }));
    catRows.sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    const statusRows = Array.from(byStatus.entries()).map(([k, v]) => ({
      status: k,
      netImpact: v.sum,
      count: v.count,
    }));
    statusRows.sort((a, b) => b.count - a.count);

    return { catRows, statusRows };
  }, [filtered]);

  /* =========================
     OS LAYOUT (inside page)
  ========================= */
  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/events", label: "Events" },
    { href: "/finance", label: "Finance" },
    { href: "/vendors", label: "Vendors" },
    { href: "/ai", label: "AI" },
    { href: "/hr", label: "HR" },
    { href: "/reports", label: "Reports" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      {/* Top Header */}
      <div className="border-b border-white/10 bg-black/40">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-semibold">Eventura OS</div>
              <div className="text-xs text-white/55">Finance Control Center</div>
            </div>

            <div className="flex items-center gap-2">
              <div className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80">
                Signed in{" "}
                <span className="text-white"> {email || "Unknown"}</span>{" "}
                <span className="text-white/50">•</span>{" "}
                <span className="text-white">{role}</span>
              </div>
              <Btn
                variant="outline"
                onClick={() => {
                  const next: Role = role === "CEO" ? "Staff" : "CEO";
                  setRole(next);
                  localStorage.setItem(LS_AUTH_ROLE, next);
                }}
                title="Toggle role (local only)"
              >
                Switch Role
              </Btn>
            </div>
          </div>

          {/* Nav */}
          <div className="mt-3 flex flex-wrap gap-2">
            {nav.map((n) => {
              const active = n.href === "/finance";
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cls(
                    "rounded-xl border px-3 py-2 text-sm transition",
                    active
                      ? "border-white/25 bg-white/10 text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-black hover:text-white hover:border-white/20"
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* KPI row */}
        <div className="grid gap-3 md:grid-cols-6">
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 hover:bg-black transition">
            <div className="text-xs text-white/55">Month</div>
            <div className="mt-1 text-sm font-semibold">{prefs.month}</div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 hover:bg-black transition">
            <div className="text-xs text-white/55">Income</div>
            <div className="mt-1 text-sm font-semibold">{money(kpi.income, "INR")}</div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 hover:bg-black transition">
            <div className="text-xs text-white/55">Expense</div>
            <div className="mt-1 text-sm font-semibold">{money(kpi.expense, "INR")}</div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 hover:bg-black transition">
            <div className="text-xs text-white/55">Net</div>
            <div className="mt-1 text-sm font-semibold">{money(kpi.net, "INR")}</div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 hover:bg-black transition">
            <div className="text-xs text-white/55">AR</div>
            <div className="mt-1 text-sm font-semibold">{money(kpi.ar, "INR")}</div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 hover:bg-black transition">
            <div className="text-xs text-white/55">AP • Overdue</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">{money(kpi.ap, "INR")}</div>
              <Pill tone={kpi.overdue ? "bad" : "muted"}>{kpi.overdue}</Pill>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-5 rounded-2xl border border-white/15 bg-white/5 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="w-full sm:w-44">
                <div className="mb-1 text-xs text-white/55">Month</div>
                <Input value={prefs.month} onChange={(v) => setPrefs((p) => ({ ...p, month: v }))} type="month" />
              </div>
              <div className="w-full sm:w-44">
                <div className="mb-1 text-xs text-white/55">View</div>
                <Select
                  value={prefs.view}
                  onChange={(v) => setPrefs((p) => ({ ...p, view: v as LayoutView }))}
                  options={[
                    { value: "Board", label: "Board" },
                    { value: "Table", label: "Table" },
                    { value: "Calendar", label: "Calendar" },
                    { value: "Reports", label: "Reports" },
                  ]}
                />
              </div>
              <div className="w-full sm:w-44">
                <div className="mb-1 text-xs text-white/55">Sort</div>
                <div className="flex gap-2">
                  <Select
                    value={prefs.sortKey}
                    onChange={(v) => setPrefs((p) => ({ ...p, sortKey: v as SortKey }))}
                    options={[
                      { value: "date", label: "Date" },
                      { value: "amount", label: "Amount" },
                      { value: "status", label: "Status" },
                      { value: "category", label: "Category" },
                      { value: "title", label: "Title" },
                    ]}
                  />
                  <Select
                    value={prefs.sortDir}
                    onChange={(v) => setPrefs((p) => ({ ...p, sortDir: v as SortDir }))}
                    options={[
                      { value: "desc", label: "Desc" },
                      { value: "asc", label: "Asc" },
                    ]}
                  />
                </div>
              </div>
              <div className="w-full sm:w-44">
                <div className="mb-1 text-xs text-white/55">Color</div>
                <Select
                  value={prefs.colorBy}
                  onChange={(v) => setPrefs((p) => ({ ...p, colorBy: v as ColorBy }))}
                  options={[
                    { value: "Status", label: "Status" },
                    { value: "Category", label: "Category" },
                    { value: "Type", label: "Type" },
                    { value: "None", label: "None" },
                  ]}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Btn variant="outline" onClick={() => exportCSV("excel")}>
                Export Excel
              </Btn>
              <Btn variant="outline" onClick={() => exportCSV("csv")}>
                Export CSV
              </Btn>
              <Btn variant="outline" onClick={() => setImportOpen(true)}>
                Import
              </Btn>
              <Btn variant="outline" onClick={loadDemo}>
                Demo
              </Btn>
              <Btn
                onClick={() => {
                  setEdit(null);
                  setAddOpen(true);
                }}
              >
                + Add
              </Btn>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 grid gap-3 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <div className="mb-1 text-xs text-white/55">Search</div>
              <Input value={prefs.q} onChange={(v) => setPrefs((p) => ({ ...p, q: v }))} placeholder="Search title, client, vendor, invoice..." />
            </div>

            <div className="lg:col-span-2">
              <div className="mb-1 text-xs text-white/55">Type</div>
              <Select
                value={prefs.type}
                onChange={(v) => setPrefs((p) => ({ ...p, type: v as any }))}
                options={[{ value: "All", label: "All" }, ...TX_TYPES.map((t) => ({ value: t, label: t }))]}
              />
            </div>

            <div className="lg:col-span-2">
              <div className="mb-1 text-xs text-white/55">Status</div>
              <Select
                value={prefs.status}
                onChange={(v) => setPrefs((p) => ({ ...p, status: v as any }))}
                options={[{ value: "All", label: "All" }, ...TX_STATUSES.map((s) => ({ value: s, label: s }))]}
              />
            </div>

            <div className="lg:col-span-2">
              <div className="mb-1 text-xs text-white/55">Category</div>
              <Select
                value={prefs.category}
                onChange={(v) => setPrefs((p) => ({ ...p, category: v as any }))}
                options={[{ value: "All", label: "All" }, ...TAGS.map((c) => ({ value: c, label: c }))]}
              />
            </div>

            <div className="lg:col-span-2">
              <div className="mb-1 text-xs text-white/55">Event</div>
              <Select
                value={prefs.eventType}
                onChange={(v) => setPrefs((p) => ({ ...p, eventType: v as any }))}
                options={[{ value: "All", label: "All" }, ...EVENT_TYPES.map((e) => ({ value: e, label: e }))]}
              />
            </div>

            <div className="lg:col-span-2">
              <div className="mb-1 text-xs text-white/55">Currency</div>
              <Select
                value={prefs.currency}
                onChange={(v) => setPrefs((p) => ({ ...p, currency: v as any }))}
                options={[{ value: "All", label: "All" }, ...CURRENCIES.map((c) => ({ value: c, label: c }))]}
              />
            </div>

            <div className="lg:col-span-2">
              <div className="mb-1 text-xs text-white/55">From</div>
              <Input value={prefs.from} onChange={(v) => setPrefs((p) => ({ ...p, from: v }))} type="date" />
            </div>

            <div className="lg:col-span-2">
              <div className="mb-1 text-xs text-white/55">To</div>
              <Input value={prefs.to} onChange={(v) => setPrefs((p) => ({ ...p, to: v }))} type="date" />
            </div>

            <div className="lg:col-span-8 flex items-end gap-2">
              <Btn
                variant="ghost"
                onClick={() =>
                  setPrefs((p) => ({
                    ...p,
                    q: "",
                    type: "All",
                    status: "All",
                    category: "All",
                    currency: "All",
                    eventType: "All",
                    from: "",
                    to: "",
                    sortKey: "date",
                    sortDir: "desc",
                    colorBy: "Status",
                  }))
                }
              >
                Clear filters
              </Btn>
              <div className="text-xs text-white/50">
                Rows: <span className="text-white/80">{filtered.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-5">
          {prefs.view === "Board" ? (
            <BoardView
              txs={filtered}
              colorBy={prefs.colorBy}
              onEdit={(t) => {
                setEdit(t);
                setAddOpen(true);
              }}
              onDuplicate={duplicateTx}
              onDelete={removeTx}
            />
          ) : prefs.view === "Table" ? (
            <TableView
              txs={filtered}
              onEdit={(t) => {
                setEdit(t);
                setAddOpen(true);
              }}
              onDuplicate={duplicateTx}
              onDelete={removeTx}
            />
          ) : prefs.view === "Calendar" ? (
            <CalendarView cells={calendar.cells} />
          ) : (
            <ReportsView reports={reports} />
          )}
        </div>
      </div>

      {/* Add/Edit */}
      <TxModal
        open={addOpen}
        title={edit ? "Edit transaction" : "Add transaction"}
        role={role}
        initial={edit}
        onClose={() => {
          setAddOpen(false);
          setEdit(null);
        }}
        onSave={(t) => {
          upsertTx(t);
          setAddOpen(false);
          setEdit(null);
        }}
      />

      {/* Import */}
      <Modal
        open={importOpen}
        title="Import CSV (paste here)"
        onClose={() => setImportOpen(false)}
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-white/55">
              Tip: Export first, edit in Excel, then paste back here.
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => setImportOpen(false)}>
                Cancel
              </Btn>
              <Btn onClick={importFromCSV}>Import</Btn>
            </div>
          </div>
        }
        maxW="max-w-4xl"
      >
        <div className="text-xs text-white/60">
          Required columns: id,title,date,type,status,amount,currency,category,eventType
        </div>
        <div className="mt-3">
          <TextArea value={importText} onChange={setImportText} rows={14} placeholder="Paste CSV content here..." />
        </div>
      </Modal>
    </div>
  );
}

/* =========================
   BOARD (cards)
========================= */
function cardTone(colorBy: ColorBy, t: FinanceTx) {
  if (colorBy === "Status") return toneForStatus(t.status);
  if (colorBy === "Category") return toneForCategory(t.category);
  if (colorBy === "Type") return toneForType(t.type);
  return "neutral";
}

function BoardView({
  txs,
  colorBy,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  txs: FinanceTx[];
  colorBy: ColorBy;
  onEdit: (t: FinanceTx) => void;
  onDuplicate: (t: FinanceTx) => void;
  onDelete: (id: string) => void;
}) {
  if (!txs.length) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/5 p-10 text-center text-sm text-white/70 hover:bg-black transition">
        No rows found. Click <span className="text-white">+ Add</span> to create a transaction.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {txs.map((t) => {
        const tone = cardTone(colorBy, t);
        const accent =
          tone === "good"
            ? "border-emerald-400/25"
            : tone === "bad"
            ? "border-rose-400/25"
            : tone === "warn"
            ? "border-amber-400/25"
            : tone === "muted"
            ? "border-white/10"
            : "border-white/15";

        return (
          <div
            key={t.id}
            className={cls(
              "rounded-2xl border bg-white/5 p-4 transition hover:bg-black",
              accent
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-white">{t.title}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Pill tone={toneForType(t.type)}>{t.type}</Pill>
                  <Pill tone={toneForStatus(t.status)}>{t.status}</Pill>
                  <Pill tone="neutral">{t.category}</Pill>
                  <Pill tone="muted">{t.eventType}</Pill>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{money(t.amount, t.currency)}</div>
                <div className="mt-1 text-xs text-white/55">{t.date}</div>
                {t.dueDate ? <div className="text-xs text-white/45">Due: {t.dueDate}</div> : null}
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-xs text-white/70">
              {t.clientName ? (
                <div>
                  <span className="text-white/50">Client:</span> {t.clientName}
                </div>
              ) : null}
              {t.vendorName ? (
                <div>
                  <span className="text-white/50">Vendor:</span> {t.vendorName}
                </div>
              ) : null}
              {t.eventTitle ? (
                <div>
                  <span className="text-white/50">Event:</span> {t.eventTitle}
                </div>
              ) : null}
              {t.invoiceNo ? (
                <div>
                  <span className="text-white/50">Invoice:</span> {t.invoiceNo}
                </div>
              ) : null}
              {t.referenceId ? (
                <div>
                  <span className="text-white/50">Ref:</span> {t.referenceId}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Btn variant="outline" onClick={() => onEdit(t)}>
                Edit
              </Btn>
              <Btn variant="outline" onClick={() => onDuplicate(t)}>
                Duplicate
              </Btn>
              <Btn variant="danger" onClick={() => onDelete(t.id)}>
                Delete
              </Btn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================
   TABLE
========================= */
function TableView({
  txs,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  txs: FinanceTx[];
  onEdit: (t: FinanceTx) => void;
  onDuplicate: (t: FinanceTx) => void;
  onDelete: (id: string) => void;
}) {
  if (!txs.length) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/5 p-10 text-center text-sm text-white/70 hover:bg-black transition">
        No rows found. Click <span className="text-white">+ Add</span> to create a transaction.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/5">
      <div className="overflow-auto">
        <table className="min-w-[1000px] w-full border-collapse text-sm">
          <thead className="bg-black/40">
            <tr className="text-left text-xs text-white/70">
              {["Date", "Title", "Type", "Status", "Category", "Event", "Amount", "Party", "Actions"].map((h) => (
                <th key={h} className="border-b border-white/10 px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {txs.map((t) => (
              <tr key={t.id} className="border-b border-white/10 hover:bg-black transition">
                <td className="px-4 py-3 text-xs text-white/80 whitespace-nowrap">{t.date}</td>
                <td className="px-4 py-3">
                  <div className="text-white">{t.title}</div>
                  <div className="text-xs text-white/45">
                    {t.invoiceNo ? `INV: ${t.invoiceNo}` : ""}
                    {t.invoiceNo && t.referenceId ? " • " : ""}
                    {t.referenceId ? `REF: ${t.referenceId}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Pill tone={toneForType(t.type)}>{t.type}</Pill>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Pill tone={toneForStatus(t.status)}>{t.status}</Pill>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{t.category}</td>
                <td className="px-4 py-3 whitespace-nowrap">{t.eventType}</td>
                <td className="px-4 py-3 whitespace-nowrap font-semibold">{money(t.amount, t.currency)}</td>
                <td className="px-4 py-3 text-xs text-white/70">
                  {t.clientName ? `Client: ${t.clientName}` : t.vendorName ? `Vendor: ${t.vendorName}` : "—"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex gap-2">
                    <Btn variant="outline" onClick={() => onEdit(t)}>
                      Edit
                    </Btn>
                    <Btn variant="outline" onClick={() => onDuplicate(t)}>
                      Copy
                    </Btn>
                    <Btn variant="danger" onClick={() => onDelete(t.id)}>
                      Delete
                    </Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================
   CALENDAR
========================= */
function CalendarView({
  cells,
}: {
  cells: Array<{ ymd: string; day: number; income: number; expense: number; count: number }>;
}) {
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
      <div className="grid grid-cols-7 gap-2 text-xs text-white/55">
        {dow.map((d) => (
          <div key={d} className="px-1 py-2 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((c, i) => (
          <div
            key={i}
            className={cls(
              "min-h-[92px] rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-black",
              c.ymd ? "opacity-100" : "opacity-40"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-white/70">{c.day || ""}</div>
              {c.count ? <Pill tone="muted">{c.count}</Pill> : null}
            </div>
            {c.ymd ? (
              <div className="mt-2 space-y-1 text-[11px] text-white/70">
                {c.income ? <div>Income: <span className="text-white">{c.income.toFixed(0)}</span></div> : null}
                {c.expense ? <div>Expense: <span className="text-white">{c.expense.toFixed(0)}</span></div> : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================
   REPORTS
========================= */
function ReportsView({
  reports,
}: {
  reports: {
    catRows: Array<{ category: string; income: number; expense: number; net: number; count: number }>;
    statusRows: Array<{ status: string; netImpact: number; count: number }>;
  };
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/15 bg-white/5 p-4 hover:bg-black transition">
        <div className="text-sm font-semibold">By Category</div>
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="text-xs text-white/60">
              <tr>
                <th className="border-b border-white/10 py-2 text-left">Category</th>
                <th className="border-b border-white/10 py-2 text-right">Income</th>
                <th className="border-b border-white/10 py-2 text-right">Expense</th>
                <th className="border-b border-white/10 py-2 text-right">Net</th>
                <th className="border-b border-white/10 py-2 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {reports.catRows.map((r) => (
                <tr key={r.category} className="border-b border-white/10 hover:bg-black transition">
                  <td className="py-2">{r.category}</td>
                  <td className="py-2 text-right">{r.income.toFixed(0)}</td>
                  <td className="py-2 text-right">{r.expense.toFixed(0)}</td>
                  <td className="py-2 text-right font-semibold">{r.net.toFixed(0)}</td>
                  <td className="py-2 text-right">{r.count}</td>
                </tr>
              ))}
              {!reports.catRows.length ? (
                <tr>
                  <td className="py-6 text-center text-sm text-white/60" colSpan={5}>
                    No data.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-white/15 bg-white/5 p-4 hover:bg-black transition">
        <div className="text-sm font-semibold">By Status</div>
        <div className="mt-3 overflow-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-xs text-white/60">
              <tr>
                <th className="border-b border-white/10 py-2 text-left">Status</th>
                <th className="border-b border-white/10 py-2 text-right">Net Impact</th>
                <th className="border-b border-white/10 py-2 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {reports.statusRows.map((r) => (
                <tr key={r.status} className="border-b border-white/10 hover:bg-black transition">
                  <td className="py-2">
                    <Pill tone={toneForStatus(r.status as any)}>{r.status}</Pill>
                  </td>
                  <td className="py-2 text-right font-semibold">{r.netImpact.toFixed(0)}</td>
                  <td className="py-2 text-right">{r.count}</td>
                </tr>
              ))}
              {!reports.statusRows.length ? (
                <tr>
                  <td className="py-6 text-center text-sm text-white/60" colSpan={3}>
                    No data.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* =========================
   MODAL: ADD / EDIT
========================= */
function TxModal({
  open,
  title,
  role,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  role: Role;
  initial: FinanceTx | null;
  onClose: () => void;
  onSave: (t: FinanceTx) => void;
}) {
  const isEdit = Boolean(initial);

  const [id, setId] = useState("");
  const [txTitle, setTxTitle] = useState("");
  const [date, setDate] = useState(toYMD(new Date()));
  const [dueDate, setDueDate] = useState("");
  const [type, setType] = useState<TxType>("Expense");
  const [status, setStatus] = useState<TxStatus>("Planned");
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [category, setCategory] = useState<TxTag>("Other");
  const [eventType, setEventType] = useState<EventType>("Other");
  const [clientName, setClientName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>("Bank");
  const [referenceId, setReferenceId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    const mkId = () => Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);

    if (initial) {
      setId(initial.id);
      setTxTitle(initial.title);
      setDate(initial.date);
      setDueDate(initial.dueDate ?? "");
      setType(initial.type);
      setStatus(initial.status);
      setAmount(String(initial.amount));
      setCurrency(initial.currency);
      setCategory(initial.category);
      setEventType(initial.eventType);
      setClientName(initial.clientName ?? "");
      setVendorName(initial.vendorName ?? "");
      setEventTitle(initial.eventTitle ?? "");
      setPaymentMethod(initial.paymentMethod);
      setReferenceId(initial.referenceId ?? "");
      setInvoiceNo(initial.invoiceNo ?? "");
      setNotes(initial.notes ?? "");
    } else {
      setId(mkId());
      setTxTitle("");
      setDate(toYMD(new Date()));
      setDueDate("");
      setType("Expense");
      setStatus("Planned");
      setAmount("0");
      setCurrency("INR");
      setCategory("Other");
      setEventType("Other");
      setClientName("");
      setVendorName("");
      setEventTitle("");
      setPaymentMethod("Bank");
      setReferenceId("");
      setInvoiceNo("");
      setNotes("");
    }
  }, [open, initial]);

  const readOnly = role !== "CEO";

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-white/55">
            {readOnly ? "Staff mode: read-only (switch role to CEO to edit)." : isEdit ? "Editing transaction." : "Creating transaction."}
          </div>
          <div className="flex gap-2">
            <Btn variant="outline" onClick={onClose}>
              Cancel
            </Btn>
            <Btn
              disabled={readOnly}
              onClick={() => {
                const amt = clamp(parseNum(amount, 0), 0, 1_000_000_000);
                const tx: FinanceTx = {
                  id,
                  createdAt: initial?.createdAt ?? nowISO(),
                  updatedAt: nowISO(),
                  title: txTitle.trim() || "Untitled",
                  date,
                  dueDate: dueDate.trim() ? dueDate.trim() : undefined,
                  type,
                  status,
                  amount: amt,
                  currency,
                  category,
                  eventType,
                  clientName: clientName.trim() || undefined,
                  vendorName: vendorName.trim() || undefined,
                  eventTitle: eventTitle.trim() || undefined,
                  paymentMethod,
                  referenceId: referenceId.trim() || undefined,
                  invoiceNo: invoiceNo.trim() || undefined,
                  notes: notes.trim() || undefined,
                };
                onSave(tx);
              }}
            >
              Save
            </Btn>
          </div>
        </div>
      }
      maxW="max-w-5xl"
    >
      <div className="grid gap-3 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <div className="mb-1 text-xs text-white/55">Title</div>
          <Input value={txTitle} onChange={setTxTitle} placeholder="e.g., Vendor payout — Decor" disabled={readOnly} />
        </div>

        <div className="lg:col-span-3">
          <div className="mb-1 text-xs text-white/55">Date</div>
          <Input value={date} onChange={setDate} type="date" disabled={readOnly} />
        </div>

        <div className="lg:col-span-3">
          <div className="mb-1 text-xs text-white/55">Due date</div>
          <Input value={dueDate} onChange={setDueDate} type="date" disabled={readOnly} />
        </div>

        <div className="lg:col-span-3">
          <div className="mb-1 text-xs text-white/55">Type</div>
          <Select value={type} onChange={(v) => setType(v as TxType)} disabled={readOnly} options={TX_TYPES.map((t) => ({ value: t, label: t }))} />
        </div>

        <div className="lg:col-span-3">
          <div className="mb-1 text-xs text-white/55">Status</div>
          <Select value={status} onChange={(v) => setStatus(v as TxStatus)} disabled={readOnly} options={TX_STATUSES.map((s) => ({ value: s, label: s }))} />
        </div>

        <div className="lg:col-span-3">
          <div className="mb-1 text-xs text-white/55">Amount</div>
          <Input value={amount} onChange={setAmount} type="text" disabled={readOnly} />
        </div>

        <div className="lg:col-span-3">
          <div className="mb-1 text-xs text-white/55">Currency</div>
          <Select value={currency} onChange={(v) => setCurrency(v as Currency)} disabled={readOnly} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
        </div>

        <div className="lg:col-span-4">
          <div className="mb-1 text-xs text-white/55">Category</div>
          <Select value={category} onChange={(v) => setCategory(v as TxTag)} disabled={readOnly} options={TAGS.map((c) => ({ value: c, label: c }))} />
        </div>

        <div className="lg:col-span-4">
          <div className="mb-1 text-xs text-white/55">Event type</div>
          <Select value={eventType} onChange={(v) => setEventType(v as EventType)} disabled={readOnly} options={EVENT_TYPES.map((e) => ({ value: e, label: e }))} />
        </div>

        <div className="lg:col-span-4">
          <div className="mb-1 text-xs text-white/55">Event title</div>
          <Input value={eventTitle} onChange={setEventTitle} placeholder="e.g., Patel Wedding" disabled={readOnly} />
        </div>

        <div className="lg:col-span-4">
          <div className="mb-1 text-xs text-white/55">Client name</div>
          <Input value={clientName} onChange={setClientName} placeholder="Optional" disabled={readOnly} />
        </div>

        <div className="lg:col-span-4">
          <div className="mb-1 text-xs text-white/55">Vendor name</div>
          <Input value={vendorName} onChange={setVendorName} placeholder="Optional" disabled={readOnly} />
        </div>

        <div className="lg:col-span-4">
          <div className="mb-1 text-xs text-white/55">Payment method</div>
          <Select value={paymentMethod} onChange={(v) => setPaymentMethod(v as PayMethod)} disabled={readOnly} options={METHODS.map((m) => ({ value: m, label: m }))} />
        </div>

        <div className="lg:col-span-4">
          <div className="mb-1 text-xs text-white/55">Invoice no</div>
          <Input value={invoiceNo} onChange={setInvoiceNo} placeholder="Optional" disabled={readOnly} />
        </div>

        <div className="lg:col-span-4">
          <div className="mb-1 text-xs text-white/55">Reference ID</div>
          <Input value={referenceId} onChange={setReferenceId} placeholder="Optional" disabled={readOnly} />
        </div>

        <div className="lg:col-span-12">
          <div className="mb-1 text-xs text-white/55">Notes</div>
          <TextArea value={notes} onChange={setNotes} rows={4} placeholder="Optional notes..." disabled={readOnly} />
        </div>
      </div>
    </Modal>
  );
}
