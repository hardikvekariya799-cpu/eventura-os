// app/finance/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* =========================================================
  EVENTURA OS — FINANCE (BEST CLEAN LAYOUT)
  ✅ Premium OS layout (not paragraph)
  ✅ Left sidebar + Top command bar + Tabbed workspace
  ✅ KPI strip + Quick actions + Transaction table + Calendar + Reports
  ✅ Black hover everywhere
  ✅ Deploy-safe (no libs) + localStorage
========================================================= */

type Role = "CEO" | "Staff";
type Tab = "Overview" | "Transactions" | "Calendar" | "Reports";

type TxType = "Income" | "Expense";
type TxStatus = "Planned" | "Pending" | "Paid" | "Overdue" | "Cancelled";
type Currency = "INR" | "CAD" | "USD" | "Other";
type PayMethod = "Cash" | "UPI" | "Bank" | "Card" | "Cheque" | "Other";
type TxCategory =
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
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: TxType;
  status: TxStatus;
  amount: number;
  currency: Currency;
  category: TxCategory;
  paymentMethod: PayMethod;
  clientName?: string;
  vendorName?: string;
  eventTitle?: string;
  dueDate?: string; // YYYY-MM-DD
  invoiceNo?: string;
  referenceId?: string;
  notes?: string;
};

const LS_TX = "eventura_fin_tx_v8";
const LS_ROLE = "eventura-role";
const LS_EMAIL = "eventura-email";

const TX_TYPES: TxType[] = ["Income", "Expense"];
const TX_STATUSES: TxStatus[] = ["Planned", "Pending", "Paid", "Overdue", "Cancelled"];
const CURRENCIES: Currency[] = ["INR", "CAD", "USD", "Other"];
const METHODS: PayMethod[] = ["Cash", "UPI", "Bank", "Card", "Cheque", "Other"];
const CATEGORIES: TxCategory[] = [
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
function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function uid(prefix = "tx") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}
function money(n: number, cur: Currency) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${cur} ${parts.join(".")}`;
}
function escCSV(v: any) {
  const s = String(v ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
function toneForCategory(c: TxCategory) {
  if (c === "Sales" || c === "ClientAdvance") return "good";
  if (c === "VendorPayment" || c === "Salary") return "warn";
  if (c === "Tax") return "bad";
  return "neutral";
}
function pillClass(t: "neutral" | "good" | "bad" | "warn" | "muted") {
  return t === "good"
    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
    : t === "bad"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-200"
      : t === "warn"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
        : t === "muted"
          ? "border-white/10 bg-white/5 text-white/55"
          : "border-white/15 bg-white/5 text-white/80";
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn" | "muted";
}) {
  return (
    <span className={cls("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]", pillClass(tone))}>
      {children}
    </span>
  );
}

function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
}) {
  const base = "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm transition border select-none";
  const v =
    variant === "primary"
      ? "border-white/15 bg-white/10 text-white hover:bg-black hover:border-white/25"
      : variant === "outline"
        ? "border-white/20 bg-transparent text-white/85 hover:bg-black hover:border-white/30"
        : variant === "danger"
          ? "border-rose-400/35 bg-rose-400/10 text-rose-200 hover:bg-black hover:border-rose-400/60"
          : "border-transparent bg-transparent text-white/75 hover:bg-black hover:text-white";
  return (
    <button
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
      className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none transition hover:border-white/25 focus:border-white/30"
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
      className="w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2 text-sm text-white outline-none transition hover:border-white/25 focus:border-white/30"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-[#0b0b0b] shadow-2xl">
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

function parseCSV(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let cur = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (ch === "," || ch === "\t")) {
      row.push(cur);
      cur = "";
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  row.push(cur);
  if (row.length > 1 || row[0] !== "") rows.push(row);

  const header = (rows[0] ?? []).map((h) => h.trim());
  const out: Array<Record<string, string>> = [];
  for (let r = 1; r < rows.length; r++) {
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) obj[header[c] || `col_${c}`] = (rows[r][c] ?? "").trim();
    out.push(obj);
  }
  return out;
}

function normalizeImported(row: Record<string, string>): FinanceTx | null {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };

  const title = get("title", "Title", "description", "Description");
  const date = get("date", "Date") || toYMD(new Date());
  const amountRaw = get("amount", "Amount");
  const amount = Number(String(amountRaw).replace(/,/g, ""));

  if (!title || !Number.isFinite(amount)) return null;

  const typeRaw = get("type", "Type") as any;
  const statusRaw = get("status", "Status") as any;
  const currencyRaw = get("currency", "Currency") as any;
  const categoryRaw = get("category", "Category") as any;
  const methodRaw = get("paymentMethod", "PaymentMethod", "method", "Method") as any;

  const type: TxType = TX_TYPES.includes(typeRaw) ? typeRaw : "Expense";
  const status: TxStatus = TX_STATUSES.includes(statusRaw) ? statusRaw : "Planned";
  const currency: Currency = CURRENCIES.includes(currencyRaw) ? currencyRaw : "INR";
  const category: TxCategory = CATEGORIES.includes(categoryRaw) ? categoryRaw : "Other";
  const paymentMethod: PayMethod = METHODS.includes(methodRaw) ? methodRaw : "Bank";

  return {
    id: uid(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    title,
    date,
    type,
    status,
    amount,
    currency,
    category,
    paymentMethod,
    clientName: get("clientName", "Client", "client") || undefined,
    vendorName: get("vendorName", "Vendor", "vendor") || undefined,
    eventTitle: get("eventTitle", "Event", "event") || undefined,
    dueDate: get("dueDate", "DueDate") || undefined,
    invoiceNo: get("invoiceNo", "Invoice", "InvoiceNo") || undefined,
    referenceId: get("referenceId", "Ref", "Reference") || undefined,
    notes: get("notes", "Notes") || undefined,
  };
}

export default function FinancePage() {
  const [role, setRole] = useState<Role>("CEO");
  const [email, setEmail] = useState<string>("Unknown");

  const [tab, setTab] = useState<Tab>("Overview");
  const [month, setMonth] = useState<string>(toYM(new Date()));
  const [txs, setTxs] = useState<FinanceTx[]>([]);

  // filters
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState<TxType | "All">("All");
  const [statusF, setStatusF] = useState<TxStatus | "All">("All");
  const [catF, setCatF] = useState<TxCategory | "All">("All");
  const [sortKey, setSortKey] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // modal
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceTx | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<FinanceTx>(() => ({
    id: uid(),
    createdAt: nowISO(),
    updatedAt: nowISO(),
    title: "",
    date: toYMD(new Date()),
    type: "Expense",
    status: "Planned",
    amount: 0,
    currency: "INR",
    category: "Other",
    paymentMethod: "Bank",
    clientName: "",
    vendorName: "",
    eventTitle: "",
    dueDate: "",
    invoiceNo: "",
    referenceId: "",
    notes: "",
  }));

  useEffect(() => {
    const r = String(localStorage.getItem(LS_ROLE) || "CEO").toUpperCase() === "STAFF" ? "Staff" : "CEO";
    setRole(r as Role);
    setEmail(localStorage.getItem(LS_EMAIL) || "Unknown");

    const loaded = safeParse<FinanceTx[]>(localStorage.getItem(LS_TX), []);
    setTxs(Array.isArray(loaded) ? loaded : []);
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_TX, JSON.stringify(txs));
  }, [txs]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    const list = txs.filter((t) => {
      if (t.date.slice(0, 7) !== month) return false;
      if (typeF !== "All" && t.type !== typeF) return false;
      if (statusF !== "All" && t.status !== statusF) return false;
      if (catF !== "All" && t.category !== catF) return false;

      if (qq) {
        const hay = [
          t.title,
          t.type,
          t.status,
          t.category,
          t.clientName || "",
          t.vendorName || "",
          t.eventTitle || "",
          t.invoiceNo || "",
          t.referenceId || "",
          t.notes || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const va = sortKey === "amount" ? a.amount : a.date;
      const vb = sortKey === "amount" ? b.amount : b.date;
      if (va < (vb as any)) return -1 * dir;
      if (va > (vb as any)) return 1 * dir;
      return 0;
    });

    return list;
  }, [txs, q, typeF, statusF, catF, month, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const income = filtered.filter((t) => t.type === "Income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
    const net = income - expense;

    const ar = filtered
      .filter((t) => t.type === "Income" && (t.status === "Pending" || t.status === "Overdue"))
      .reduce((s, t) => s + t.amount, 0);

    const ap = filtered
      .filter((t) => t.type === "Expense" && (t.status === "Pending" || t.status === "Overdue"))
      .reduce((s, t) => s + t.amount, 0);

    const overdue = filtered.filter((t) => t.status === "Overdue").length;
    return { income, expense, net, ar, ap, overdue };
  }, [filtered]);

  const byCategory = useMemo(() => {
    const m = new Map<TxCategory, { in: number; out: number }>();
    for (const c of CATEGORIES) m.set(c, { in: 0, out: 0 });
    for (const t of filtered) {
      const cur = m.get(t.category) || { in: 0, out: 0 };
      if (t.type === "Income") cur.in += t.amount;
      else cur.out += t.amount;
      m.set(t.category, cur);
    }
    return Array.from(m.entries()).map(([category, v]) => ({
      category,
      income: v.in,
      expense: v.out,
      net: v.in - v.out,
    }));
  }, [filtered]);

  const cal = useMemo(() => {
    if (tab !== "Calendar") return null;
    const first = new Date(`${month}-01T00:00:00`);
    const startDow = first.getDay();
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

    const cells: Array<{ ymd: string; day: number; income: number; expense: number; count: number }> = [];
    for (let i = 0; i < startDow; i++) cells.push({ ymd: "", day: 0, income: 0, expense: 0, count: 0 });

    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${month}-${pad2(d)}`;
      const list = filtered.filter((t) => t.date === ymd);
      const income = list.filter((t) => t.type === "Income").reduce((s, t) => s + t.amount, 0);
      const expense = list.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
      cells.push({ ymd, day: d, income, expense, count: list.length });
    }
    while (cells.length % 7 !== 0) cells.push({ ymd: "", day: 0, income: 0, expense: 0, count: 0 });
    return cells;
  }, [tab, month, filtered]);

  function openAdd() {
    setEditing(null);
    setForm({
      id: uid(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      title: "",
      date: toYMD(new Date()),
      type: "Expense",
      status: "Planned",
      amount: 0,
      currency: "INR",
      category: "Other",
      paymentMethod: "Bank",
      clientName: "",
      vendorName: "",
      eventTitle: "",
      dueDate: "",
      invoiceNo: "",
      referenceId: "",
      notes: "",
    });
    setOpen(true);
  }

  function openEdit(t: FinanceTx) {
    setEditing(t);
    setForm({
      ...t,
      clientName: t.clientName || "",
      vendorName: t.vendorName || "",
      eventTitle: t.eventTitle || "",
      dueDate: t.dueDate || "",
      invoiceNo: t.invoiceNo || "",
      referenceId: t.referenceId || "",
      notes: t.notes || "",
    });
    setOpen(true);
  }

  function saveTx() {
    if (!form.title.trim()) return alert("Title is required.");
    if (!Number.isFinite(Number(form.amount))) return alert("Amount must be a number.");

    const tx: FinanceTx = {
      ...form,
      title: form.title.trim(),
      amount: Number(form.amount),
      updatedAt: nowISO(),
      clientName: form.clientName?.trim() ? form.clientName.trim() : undefined,
      vendorName: form.vendorName?.trim() ? form.vendorName.trim() : undefined,
      eventTitle: form.eventTitle?.trim() ? form.eventTitle.trim() : undefined,
      dueDate: form.dueDate?.trim() ? form.dueDate.trim() : undefined,
      invoiceNo: form.invoiceNo?.trim() ? form.invoiceNo.trim() : undefined,
      referenceId: form.referenceId?.trim() ? form.referenceId.trim() : undefined,
      notes: form.notes?.trim() ? form.notes.trim() : undefined,
    };

    setTxs((prev) => {
      const idx = prev.findIndex((x) => x.id === tx.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = tx;
        return next;
      }
      return [tx, ...prev];
    });

    setOpen(false);
  }

  function delTx(id: string) {
    if (!confirm("Delete this transaction?")) return;
    setTxs((prev) => prev.filter((x) => x.id !== id));
  }

  function exportCSV() {
    const cols = [
      "title",
      "date",
      "type",
      "status",
      "amount",
      "currency",
      "category",
      "paymentMethod",
      "clientName",
      "vendorName",
      "eventTitle",
      "dueDate",
      "invoiceNo",
      "referenceId",
      "notes",
    ] as const;

    const rows = filtered.map((t) => cols.map((c) => escCSV((t as any)[c])));
    const csv = [cols.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadText(`eventura_finance_${month}.csv`, csv, "text/csv;charset=utf-8");
  }

  function exportExcel() {
    const cols = [
      "title",
      "date",
      "type",
      "status",
      "amount",
      "currency",
      "category",
      "paymentMethod",
      "clientName",
      "vendorName",
      "eventTitle",
      "dueDate",
      "invoiceNo",
      "referenceId",
      "notes",
    ];
    const head = `<tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>`;
    const body = filtered
      .map(
        (t) =>
          `<tr>${cols
            .map((c) => `<td>${String((t as any)[c] ?? "").replace(/</g, "&lt;")}</td>`)
            .join("")}</tr>`
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body><table border="1">${head}${body}</table></body></html>`;
    downloadText(`eventura_finance_${month}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
  }

  async function importCSVFile(file: File) {
    const text = await file.text();
    const rows = parseCSV(text);
    const imported: FinanceTx[] = [];
    for (const r of rows) {
      const tx = normalizeImported(r);
      if (tx) imported.push(tx);
    }
    if (!imported.length) return alert("No valid rows found in CSV.");
    setTxs((prev) => [...imported, ...prev]);
    alert(`Imported ${imported.length} transactions.`);
  }

  function loadDemo() {
    const ym = month;
    const demo: FinanceTx[] = [
      {
        id: uid(),
        createdAt: nowISO(),
        updatedAt: nowISO(),
        title: "Client advance — Wedding",
        date: `${ym}-05`,
        type: "Income",
        status: "Paid",
        amount: 50000,
        currency: "INR",
        category: "ClientAdvance",
        paymentMethod: "UPI",
        clientName: "Patel Family",
        eventTitle: "Wedding @ Surat",
        invoiceNo: "INV-1001",
      },
      {
        id: uid(),
        createdAt: nowISO(),
        updatedAt: nowISO(),
        title: "Vendor payment — Decor",
        date: `${ym}-08`,
        type: "Expense",
        status: "Pending",
        amount: 30000,
        currency: "INR",
        category: "VendorPayment",
        paymentMethod: "Bank",
        vendorName: "Decor House",
        dueDate: `${ym}-12`,
      },
      {
        id: uid(),
        createdAt: nowISO(),
        updatedAt: nowISO(),
        title: "Marketing — Instagram ads",
        date: `${ym}-10`,
        type: "Expense",
        status: "Paid",
        amount: 8000,
        currency: "INR",
        category: "Marketing",
        paymentMethod: "Card",
      },
      {
        id: uid(),
        createdAt: nowISO(),
        updatedAt: nowISO(),
        title: "Corporate booking",
        date: `${ym}-18`,
        type: "Income",
        status: "Pending",
        amount: 75000,
        currency: "INR",
        category: "Sales",
        paymentMethod: "Bank",
        clientName: "ABC Pvt Ltd",
        dueDate: `${ym}-28`,
      },
    ];
    setTxs((prev) => [...demo, ...prev]);
  }

  const appNav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/events", label: "Events" },
    { href: "/finance", label: "Finance" },
    { href: "/vendors", label: "Vendors" },
    { href: "/ai", label: "AI" },
    { href: "/hr", label: "HR" },
    { href: "/reports", label: "Reports" },
    { href: "/settings", label: "Settings" },
  ] as const;

  function TabBtn({ t }: { t: Tab }) {
    const active = tab === t;
    return (
      <button
        onClick={() => setTab(t)}
        className={cls(
          "rounded-xl border px-3 py-2 text-sm transition",
          active ? "border-white/25 bg-white/10 text-white" : "border-transparent text-white/70 hover:bg-black hover:text-white"
        )}
      >
        {t}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* PREMIUM BACKDROP */}
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-180px] h-[420px] w-[420px] rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* TOP OS BAR */}
      <div className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-[1450px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl border border-white/15 bg-white/5" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">Eventura OS</div>
              <div className="text-xs text-white/50">Finance Control Center</div>
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            {appNav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cls(
                  "rounded-xl border px-3 py-2 text-sm transition",
                  n.href === "/finance"
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-transparent bg-transparent text-white/70 hover:bg-black hover:text-white"
                )}
              >
                {n.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-2xl border border-white/12 bg-white/5 px-3 py-2 text-xs text-white/70 md:block">
              Signed in <span className="text-white">{email}</span> • <span className="text-white">{role}</span>
            </div>
            <Link
              href="/settings"
              className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-black hover:text-white"
            >
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* MAIN SHELL */}
      <div className="mx-auto grid max-w-[1450px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[280px_1fr]">
        {/* LEFT SIDEBAR (premium, clean, fast access) */}
        <aside className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 bg-black/35 px-4 py-4">
            <div className="text-sm font-semibold">Finance Workspace</div>
            <div className="mt-1 text-xs text-white/55">Fast navigation • clean layout</div>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTab("Overview")}
                className={cls(
                  "rounded-2xl border px-3 py-3 text-left transition",
                  tab === "Overview" ? "border-white/25 bg-white/10" : "border-white/10 bg-black/20 hover:bg-black hover:border-white/20"
                )}
              >
                <div className="text-xs text-white/55">Tab</div>
                <div className="mt-1 text-sm font-semibold">Overview</div>
              </button>

              <button
                onClick={() => setTab("Transactions")}
                className={cls(
                  "rounded-2xl border px-3 py-3 text-left transition",
                  tab === "Transactions" ? "border-white/25 bg-white/10" : "border-white/10 bg-black/20 hover:bg-black hover:border-white/20"
                )}
              >
                <div className="text-xs text-white/55">Tab</div>
                <div className="mt-1 text-sm font-semibold">Transactions</div>
              </button>

              <button
                onClick={() => setTab("Calendar")}
                className={cls(
                  "rounded-2xl border px-3 py-3 text-left transition",
                  tab === "Calendar" ? "border-white/25 bg-white/10" : "border-white/10 bg-black/20 hover:bg-black hover:border-white/20"
                )}
              >
                <div className="text-xs text-white/55">Tab</div>
                <div className="mt-1 text-sm font-semibold">Calendar</div>
              </button>

              <button
                onClick={() => setTab("Reports")}
                className={cls(
                  "rounded-2xl border px-3 py-3 text-left transition",
                  tab === "Reports" ? "border-white/25 bg-white/10" : "border-white/10 bg-black/20 hover:bg-black hover:border-white/20"
                )}
              >
                <div className="text-xs text-white/55">Tab</div>
                <div className="mt-1 text-sm font-semibold">Reports</div>
              </button>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="text-xs text-white/55">Month</div>
              <div className="mt-2">
                <Input value={month} onChange={setMonth} type="month" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Btn onClick={openAdd}>+ Add</Btn>
                <Btn variant="outline" onClick={loadDemo}>
                  Demo
                </Btn>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="text-xs text-white/55">Quick export</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Btn variant="outline" onClick={exportCSV}>
                  CSV
                </Btn>
                <Btn onClick={exportExcel}>Excel</Btn>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="text-xs text-white/55">Import</div>
              <div className="mt-2">
                <Btn variant="outline" onClick={() => fileRef.current?.click()} className="w-full">
                  Import CSV
                </Btn>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  importCSVFile(f).catch(() => alert("CSV import failed."));
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {/* COMMAND BAR */}
          <div className="border-b border-white/10 bg-black/35 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-lg font-semibold">{tab}</div>
                <div className="text-xs text-white/55">Clean • attractive • easy to access • black hover</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-[260px]">
                  <Input value={q} onChange={setQ} placeholder="Search title, client, vendor, invoice..." />
                </div>

                <div className="hidden lg:flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-1">
                  <TabBtn t="Overview" />
                  <TabBtn t="Transactions" />
                  <TabBtn t="Calendar" />
                  <TabBtn t="Reports" />
                </div>

                <Btn onClick={openAdd}>+ Add</Btn>
                <Btn variant="outline" onClick={() => fileRef.current?.click()}>
                  Import
                </Btn>
                <Btn variant="outline" onClick={exportCSV}>
                  Export CSV
                </Btn>
                <Btn onClick={exportExcel}>Export Excel</Btn>
              </div>
            </div>
          </div>

          {/* KPI STRIP */}
          <div className="px-4 py-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              {[
                { label: "Income", value: money(kpis.income, "INR") },
                { label: "Expense", value: money(kpis.expense, "INR") },
                { label: "Net", value: money(kpis.net, "INR") },
                { label: "AR", value: money(kpis.ar, "INR") },
                { label: "AP", value: money(kpis.ap, "INR") },
                { label: "Overdue", value: String(kpis.overdue) },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:bg-black hover:border-white/20"
                >
                  <div className="text-xs text-white/55">{k.label}</div>
                  <div className="mt-1 text-sm font-semibold">{k.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* WORKSPACE BODY */}
          <div className="px-4 pb-5">
            {/* FILTER BAR (only show for list-like tabs) */}
            {tab !== "Overview" ? (
              <div className="mb-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  <div className="md:col-span-3">
                    <Select
                      value={typeF}
                      onChange={(v) => setTypeF(v as any)}
                      options={[
                        { value: "All", label: "Type: All" },
                        ...TX_TYPES.map((t) => ({ value: t, label: `Type: ${t}` })),
                      ]}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Select
                      value={statusF}
                      onChange={(v) => setStatusF(v as any)}
                      options={[
                        { value: "All", label: "Status: All" },
                        ...TX_STATUSES.map((s) => ({ value: s, label: `Status: ${s}` })),
                      ]}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Select
                      value={catF}
                      onChange={(v) => setCatF(v as any)}
                      options={[
                        { value: "All", label: "Category: All" },
                        ...CATEGORIES.map((c) => ({ value: c, label: `Category: ${c}` })),
                      ]}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <div className="flex gap-2">
                      <Select
                        value={sortKey}
                        onChange={(v) => setSortKey(v as any)}
                        options={[
                          { value: "date", label: "Sort: Date" },
                          { value: "amount", label: "Sort: Amount" },
                        ]}
                      />
                      <Btn variant="outline" onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}>
                        {sortDir === "desc" ? "↓" : "↑"}
                      </Btn>
                      <Btn
                        variant="outline"
                        onClick={() => {
                          setQ("");
                          setTypeF("All");
                          setStatusF("All");
                          setCatF("All");
                          setSortKey("date");
                          setSortDir("desc");
                        }}
                      >
                        Reset
                      </Btn>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* OVERVIEW GRID */}
            {tab === "Overview" ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                {/* Focus cards */}
                <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Recent activity</div>
                    <Btn variant="ghost" onClick={() => setTab("Transactions")}>
                      Open table →
                    </Btn>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {(filtered.slice(0, 7).length ? filtered.slice(0, 7) : []).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => openEdit(t)}
                        className="w-full rounded-2xl border border-white/10 bg-black/35 p-3 text-left transition hover:bg-black hover:border-white/20"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{t.title}</div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Pill tone={toneForStatus(t.status)}>{t.status}</Pill>
                              <Pill tone={toneForType(t.type)}>{t.type}</Pill>
                              <Pill tone={toneForCategory(t.category)}>{t.category}</Pill>
                            </div>
                            <div className="mt-2 text-xs text-white/55">
                              {t.clientName || t.vendorName || "-"} • {t.eventTitle || "No event"} • {t.paymentMethod}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">{money(t.amount, t.currency)}</div>
                            <div className="text-xs text-white/55">{t.date}</div>
                          </div>
                        </div>
                      </button>
                    ))}

                    {filtered.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-black/35 p-6 text-sm text-white/70">
                        No transactions for this month. Click <span className="text-white">+ Add</span> or load{" "}
                        <span className="text-white">Demo</span>.
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Category summary */}
                <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Category summary</div>
                    <Pill tone="muted">{month}</Pill>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {byCategory.slice(0, 8).map((r) => (
                      <div
                        key={r.category}
                        className="rounded-2xl border border-white/10 bg-black/35 p-3 transition hover:bg-black hover:border-white/20"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{r.category}</div>
                          <Pill tone={toneForCategory(r.category)}>{money(r.net, "INR")}</Pill>
                        </div>
                        <div className="mt-1 text-xs text-white/60">
                          Income {money(r.income, "INR")} • Expense {money(r.expense, "INR")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {/* TRANSACTIONS TABLE */}
            {tab === "Transactions" ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                <div className="overflow-auto">
                  <table className="min-w-[1050px] w-full text-left text-sm">
                    <thead className="bg-black/45 border-b border-white/10">
                      <tr className="text-white/75">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Client/Vendor</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td className="px-4 py-6 text-white/70" colSpan={8}>
                            No rows found. Add a transaction or import CSV.
                          </td>
                        </tr>
                      ) : null}

                      {filtered.map((t) => (
                        <tr key={t.id} className="border-b border-white/10 hover:bg-black transition">
                          <td className="px-4 py-3 text-white/70">{t.date}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold">{t.title}</div>
                            <div className="text-xs text-white/55">
                              {t.eventTitle || "-"} • {t.paymentMethod} • {t.invoiceNo || "No invoice"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Pill tone={toneForType(t.type)}>{t.type}</Pill>
                          </td>
                          <td className="px-4 py-3">
                            <Pill tone={toneForStatus(t.status)}>{t.status}</Pill>
                          </td>
                          <td className="px-4 py-3">
                            <Pill tone={toneForCategory(t.category)}>{t.category}</Pill>
                          </td>
                          <td className="px-4 py-3 font-semibold">{money(t.amount, t.currency)}</td>
                          <td className="px-4 py-3 text-white/70">{t.clientName || t.vendorName || "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Btn variant="outline" onClick={() => openEdit(t)}>
                                Edit
                              </Btn>
                              <Btn variant="danger" onClick={() => delTx(t.id)}>
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
            ) : null}

            {/* CALENDAR */}
            {tab === "Calendar" ? (
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Calendar — {month}</div>
                  <div className="text-xs text-white/60">Totals per day (filtered)</div>
                </div>

                <div className="mt-3 grid grid-cols-7 gap-2 text-xs text-white/55">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="px-2 py-1">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-2">
                  {cal?.map((c, idx) => (
                    <div
                      key={idx}
                      className={cls(
                        "min-h-[96px] rounded-2xl border border-white/10 bg-black/35 p-2 transition hover:bg-black hover:border-white/20",
                        !c.ymd && "opacity-25"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-white/60">{c.day ? c.day : ""}</div>
                        {c.count ? <Pill tone="muted">{c.count}</Pill> : null}
                      </div>
                      {c.day ? (
                        <div className="mt-2 grid gap-1 text-xs">
                          <div className="text-white/70">In: {money(c.income, "INR")}</div>
                          <div className="text-white/70">Out: {money(c.expense, "INR")}</div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* REPORTS */}
            {tab === "Reports" ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-sm font-semibold">By Category</div>
                  <div className="mt-3 grid gap-2">
                    {byCategory.map((r) => (
                      <div
                        key={r.category}
                        className="rounded-2xl border border-white/10 bg-black/35 p-3 transition hover:bg-black hover:border-white/20"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{r.category}</div>
                          <Pill tone={toneForCategory(r.category)}>{money(r.net, "INR")}</Pill>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/70">
                          <span>Income: {money(r.income, "INR")}</span>
                          <span>Expense: {money(r.expense, "INR")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-sm font-semibold">Month Summary</div>
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
                    {[
                      { label: "Income", value: money(kpis.income, "INR") },
                      { label: "Expense", value: money(kpis.expense, "INR") },
                      { label: "Net", value: money(kpis.net, "INR") },
                      { label: "AR", value: money(kpis.ar, "INR") },
                      { label: "AP", value: money(kpis.ap, "INR") },
                      { label: "Overdue", value: String(kpis.overdue) },
                    ].map((k) => (
                      <div
                        key={k.label}
                        className="rounded-2xl border border-white/10 bg-black/35 p-4 transition hover:bg-black hover:border-white/20"
                      >
                        <div className="text-xs text-white/55">{k.label}</div>
                        <div className="mt-1 text-sm font-semibold">{k.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4">
                    <div className="text-xs text-white/55">Export</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Btn variant="outline" onClick={exportCSV}>
                        Export CSV
                      </Btn>
                      <Btn onClick={exportExcel}>Export Excel</Btn>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* ADD/EDIT MODAL */}
      <Modal
        open={open}
        title={editing ? "Edit transaction" : "Add transaction"}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
            <Btn onClick={saveTx}>{editing ? "Save" : "Add"}</Btn>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-6">
            <div className="mb-1 text-xs text-white/55">Title</div>
            <Input value={form.title} onChange={(v) => setForm((p) => ({ ...p, title: v }))} placeholder="e.g., Vendor payment — Decor" />
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-xs text-white/55">Date</div>
            <Input value={form.date} onChange={(v) => setForm((p) => ({ ...p, date: v }))} type="date" />
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-xs text-white/55">Due date</div>
            <Input value={form.dueDate || ""} onChange={(v) => setForm((p) => ({ ...p, dueDate: v }))} type="date" />
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-xs text-white/55">Type</div>
            <Select value={form.type} onChange={(v) => setForm((p) => ({ ...p, type: v as TxType }))} options={TX_TYPES.map((t) => ({ value: t, label: t }))} />
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-xs text-white/55">Status</div>
            <Select value={form.status} onChange={(v) => setForm((p) => ({ ...p, status: v as TxStatus }))} options={TX_STATUSES.map((s) => ({ value: s, label: s }))} />
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-xs text-white/55">Category</div>
            <Select value={form.category} onChange={(v) => setForm((p) => ({ ...p, category: v as TxCategory }))} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-xs text-white/55">Method</div>
            <Select value={form.paymentMethod} onChange={(v) => setForm((p) => ({ ...p, paymentMethod: v as PayMethod }))} options={METHODS.map((m) => ({ value: m, label: m }))} />
          </div>

          <div className="md:col-span-4">
            <div className="mb-1 text-xs text-white/55">Amount</div>
            <Input
              value={String(form.amount)}
              onChange={(v) => setForm((p) => ({ ...p, amount: Number(String(v).replace(/,/g, "")) || 0 }))}
              type="number"
            />
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-white/55">Currency</div>
            <Select value={form.currency} onChange={(v) => setForm((p) => ({ ...p, currency: v as Currency }))} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          </div>

          <div className="md:col-span-6">
            <div className="mb-1 text-xs text-white/55">Event</div>
            <Input value={form.eventTitle || ""} onChange={(v) => setForm((p) => ({ ...p, eventTitle: v }))} placeholder="Optional" />
          </div>

          <div className="md:col-span-6">
            <div className="mb-1 text-xs text-white/55">Client</div>
            <Input value={form.clientName || ""} onChange={(v) => setForm((p) => ({ ...p, clientName: v }))} placeholder="Optional" />
          </div>

          <div className="md:col-span-6">
            <div className="mb-1 text-xs text-white/55">Vendor</div>
            <Input value={form.vendorName || ""} onChange={(v) => setForm((p) => ({ ...p, vendorName: v }))} placeholder="Optional" />
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-xs text-white/55">Invoice</div>
            <Input value={form.invoiceNo || ""} onChange={(v) => setForm((p) => ({ ...p, invoiceNo: v }))} placeholder="Optional" />
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-xs text-white/55">Reference</div>
            <Input value={form.referenceId || ""} onChange={(v) => setForm((p) => ({ ...p, referenceId: v }))} placeholder="Optional" />
          </div>

          <div className="md:col-span-12">
            <div className="mb-1 text-xs text-white/55">Notes</div>
            <textarea
              value={form.notes || ""}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={4}
              className="w-full rounded-2xl border border-white/12 bg-black/50 p-3 text-sm text-white outline-none transition hover:border-white/25 focus:border-white/30"
              placeholder="Optional"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
