// app/finance/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* =========================================================
  EVENTURA OS — FINANCE (deploy-safe, no external libs)
  - Full OS layout: top bar + left nav + signed-in panel
  - Finance Control Center: KPIs, Views, Filters, Search
  - Layouts: Gallery / Table / Calendar / Reports
  - Import CSV, Export CSV, Export Excel (.xls)
  - Add/Edit/Delete transactions
  - Persist: localStorage
========================================================= */

type Role = "CEO" | "Staff";
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

type Layout = "Gallery" | "Table" | "Calendar" | "Reports";
type SortKey = "date" | "amount" | "status" | "category" | "title";
type SortDir = "asc" | "desc";
type ColorBy = "None" | "Status" | "Category" | "Type";

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
  referenceId?: string;
  invoiceNo?: string;
  notes?: string;
};

type ViewDef = {
  id: string;
  name: string;
  layout: Layout;

  q: string;
  type: TxType | "All";
  status: TxStatus | "All";
  category: TxCategory | "All";
  currency: Currency | "All";

  from: string; // YYYY-MM-DD or ""
  to: string; // YYYY-MM-DD or ""

  sortKey: SortKey;
  sortDir: SortDir;

  colorBy: ColorBy;
};

const LS_TX = "eventura_fin_tx_v6";
const LS_VIEWS = "eventura_fin_views_v6";
const LS_ACTIVE_VIEW = "eventura_fin_active_view_v6";
const LS_ROLE = "eventura-role"; // "CEO" | "Staff"
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
function money(n: number, cur: Currency) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${cur} ${parts.join(".")}`;
}
function inRange(ymd: string, from: string, to: string) {
  if (!from && !to) return true;
  if (from && ymd < from) return false;
  if (to && ymd > to) return false;
  return true;
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
function pillClass(tone: "neutral" | "good" | "bad" | "warn" | "muted") {
  return tone === "good"
    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
    : tone === "bad"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-200"
      : tone === "warn"
        ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
        : tone === "muted"
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
    <span
      className={cls(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]",
        pillClass(tone)
      )}
    >
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
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm transition border select-none";
  const v =
    variant === "primary"
      ? "border-white/15 bg-white/10 text-white hover:bg-black hover:border-white/25"
      : variant === "outline"
        ? "border-white/20 bg-transparent text-white/90 hover:bg-black hover:border-white/30"
        : variant === "danger"
          ? "border-rose-400/35 bg-rose-400/10 text-rose-200 hover:bg-black hover:border-rose-400/60"
          : "border-transparent bg-transparent text-white/80 hover:bg-black hover:text-white";
  return (
    <button
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
      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none transition hover:border-white/25 focus:border-white/30"
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
      className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition hover:border-white/25 focus:border-white/30"
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
      <div
        className={cls(
          "w-full overflow-hidden rounded-2xl border border-white/15 bg-[#0b0b0b] shadow-2xl",
          maxW
        )}
      >
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

function defaultView(): ViewDef {
  return {
    id: "main",
    name: "Finance board",
    layout: "Gallery",
    q: "",
    type: "All",
    status: "All",
    category: "All",
    currency: "All",
    from: "",
    to: "",
    sortKey: "date",
    sortDir: "desc",
    colorBy: "Status",
  };
}

function uid(prefix = "tx") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

function demoData(today = new Date()): FinanceTx[] {
  const base = toYMD(today);
  const ym = toYM(today);
  return [
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
      referenceId: "UPI-REF-7781",
      notes: "Advance received",
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
      eventTitle: "Wedding @ Surat",
      dueDate: `${ym}-12`,
      notes: "Pay after setup confirmation",
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
      referenceId: "META-AD-112",
    },
    {
      id: uid(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      title: "Corporate event booking",
      date: base,
      type: "Income",
      status: "Pending",
      amount: 75000,
      currency: "INR",
      category: "Sales",
      paymentMethod: "Bank",
      clientName: "ABC Pvt Ltd",
      eventTitle: "Corporate Meetup",
      dueDate: `${ym}-28`,
      invoiceNo: "INV-1002",
    },
  ];
}

function buildExcelXls(filename: string, rows: Array<Record<string, any>>) {
  const cols = Object.keys(rows[0] ?? { id: "" });
  const head = `<tr>${cols.map((c) => `<th>${String(c)}</th>`).join("")}</tr>`;
  const body = rows
    .map(
      (r) =>
        `<tr>${cols
          .map((c) => `<td>${String(r[c] ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
          .join("")}</tr>`
    )
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>
<table border="1">${head}${body}</table>
</body></html>`;
  downloadText(filename, html, "application/vnd.ms-excel;charset=utf-8");
}

function parseCSV(text: string): Array<Record<string, string>> {
  // Simple CSV parser: handles quotes and commas
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
  // Accept flexible column names
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };

  const title = get("title", "Title", "description", "Description");
  const date = get("date", "Date", "txn_date") || toYMD(new Date());
  const typeRaw = get("type", "Type") as any;
  const statusRaw = get("status", "Status") as any;
  const amountRaw = get("amount", "Amount", "value");
  const currencyRaw = get("currency", "Currency") as any;
  const categoryRaw = get("category", "Category") as any;
  const methodRaw = get("paymentMethod", "PaymentMethod", "method", "Method") as any;

  const amount = Number(String(amountRaw).replace(/,/g, ""));
  if (!title) return null;
  if (!Number.isFinite(amount)) return null;

  const type: TxType = TX_TYPES.includes(typeRaw) ? typeRaw : "Expense";
  const status: TxStatus = TX_STATUSES.includes(statusRaw) ? statusRaw : "Planned";
  const currency: Currency = CURRENCIES.includes(currencyRaw) ? currencyRaw : "INR";
  const category: TxCategory = CATEGORIES.includes(categoryRaw) ? categoryRaw : "Other";
  const paymentMethod: PayMethod = METHODS.includes(methodRaw) ? methodRaw : "Bank";

  const tx: FinanceTx = {
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
    referenceId: get("referenceId", "Ref", "Reference") || undefined,
    invoiceNo: get("invoiceNo", "Invoice", "InvoiceNo") || undefined,
    notes: get("notes", "Notes") || undefined,
  };
  return tx;
}

export default function FinancePage() {
  // Signed-in display (same style as HR)
  const [role, setRole] = useState<Role>("CEO");
  const [email, setEmail] = useState<string>("Unknown");

  // Data
  const [txs, setTxs] = useState<FinanceTx[]>([]);
  const [views, setViews] = useState<ViewDef[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>("main");

  // Month + modal
  const [month, setMonth] = useState<string>(toYM(new Date())); // YYYY-MM
  const [openAdd, setOpenAdd] = useState(false);
  const [editing, setEditing] = useState<FinanceTx | null>(null);

  // Import file input ref
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Load
  useEffect(() => {
    setRole((String(localStorage.getItem(LS_ROLE) || "CEO").toUpperCase() === "STAFF" ? "Staff" : "CEO") as Role);
    setEmail(localStorage.getItem(LS_EMAIL) || "Unknown");

    const loadedTx = safeParse<FinanceTx[]>(localStorage.getItem(LS_TX), []);
    const loadedViews = safeParse<ViewDef[]>(localStorage.getItem(LS_VIEWS), []);
    const av = localStorage.getItem(LS_ACTIVE_VIEW) || "main";

    setTxs(Array.isArray(loadedTx) ? loadedTx : []);
    setViews(loadedViews.length ? loadedViews : [defaultView()]);
    setActiveViewId(av);
  }, []);

  // Save
  useEffect(() => {
    localStorage.setItem(LS_TX, JSON.stringify(txs));
  }, [txs]);
  useEffect(() => {
    localStorage.setItem(LS_VIEWS, JSON.stringify(views));
  }, [views]);
  useEffect(() => {
    localStorage.setItem(LS_ACTIVE_VIEW, activeViewId);
  }, [activeViewId]);

  const activeView = useMemo(() => {
    const v = views.find((x) => x.id === activeViewId);
    return v || views[0] || defaultView();
  }, [views, activeViewId]);

  // Filtered tx
  const filtered = useMemo(() => {
    const q = (activeView.q || "").trim().toLowerCase();
    const list = txs.filter((t) => {
      if (activeView.type !== "All" && t.type !== activeView.type) return false;
      if (activeView.status !== "All" && t.status !== activeView.status) return false;
      if (activeView.category !== "All" && t.category !== activeView.category) return false;
      if (activeView.currency !== "All" && t.currency !== activeView.currency) return false;
      if (!inRange(t.date, activeView.from, activeView.to)) return false;
      if (q) {
        const hay = [
          t.title,
          t.category,
          t.status,
          t.type,
          t.currency,
          t.clientName || "",
          t.vendorName || "",
          t.eventTitle || "",
          t.invoiceNo || "",
          t.referenceId || "",
          t.notes || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sk = activeView.sortKey;
    const dir = activeView.sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const va =
        sk === "amount" ? a.amount : sk === "date" ? a.date : sk === "status" ? a.status : sk === "category" ? a.category : a.title;
      const vb =
        sk === "amount" ? b.amount : sk === "date" ? b.date : sk === "status" ? b.status : sk === "category" ? b.category : b.title;
      if (va < (vb as any)) return -1 * dir;
      if (va > (vb as any)) return 1 * dir;
      return 0;
    });
    return list;
  }, [txs, activeView]);

  // Month scoped KPIs
  const monthTx = useMemo(() => filtered.filter((t) => t.date.slice(0, 7) === month), [filtered, month]);

  const kpis = useMemo(() => {
    const income = monthTx.filter((t) => t.type === "Income").reduce((s, t) => s + t.amount, 0);
    const expense = monthTx.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
    const net = income - expense;

    const ar = monthTx
      .filter((t) => t.type === "Income" && (t.status === "Pending" || t.status === "Overdue"))
      .reduce((s, t) => s + t.amount, 0);
    const ap = monthTx
      .filter((t) => t.type === "Expense" && (t.status === "Pending" || t.status === "Overdue"))
      .reduce((s, t) => s + t.amount, 0);
    const overdue = monthTx.filter((t) => t.status === "Overdue").length;

    return { income, expense, net, ar, ap, overdue };
  }, [monthTx]);

  // Reports data
  const reportByCategory = useMemo(() => {
    const m = new Map<TxCategory, { income: number; expense: number }>();
    for (const c of CATEGORIES) m.set(c, { income: 0, expense: 0 });
    for (const t of monthTx) {
      const cur = m.get(t.category) || { income: 0, expense: 0 };
      if (t.type === "Income") cur.income += t.amount;
      else cur.expense += t.amount;
      m.set(t.category, cur);
    }
    return Array.from(m.entries()).map(([category, v]) => ({ category, ...v, net: v.income - v.expense }));
  }, [monthTx]);

  const reportByStatus = useMemo(() => {
    const m = new Map<TxStatus, number>();
    for (const s of TX_STATUSES) m.set(s, 0);
    for (const t of monthTx) m.set(t.status, (m.get(t.status) || 0) + 1);
    return Array.from(m.entries()).map(([status, count]) => ({ status, count }));
  }, [monthTx]);

  // Actions
  function setView(patch: Partial<ViewDef>) {
    setViews((prev) =>
      prev.map((v) => (v.id === activeView.id ? { ...v, ...patch } : v))
    );
  }

  function addOrUpdateTx(tx: FinanceTx) {
    setTxs((prev) => {
      const idx = prev.findIndex((x) => x.id === tx.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...tx, updatedAt: nowISO() };
        return next;
      }
      return [{ ...tx, createdAt: nowISO(), updatedAt: nowISO() }, ...prev];
    });
  }

  function removeTx(id: string) {
    setTxs((prev) => prev.filter((x) => x.id !== id));
  }

  function exportCSV() {
    const cols = [
      "id",
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
      "createdAt",
      "updatedAt",
    ] as const;

    const rows = filtered.map((t) =>
      cols.map((c) => escCSV((t as any)[c]))
    );
    const csv = [cols.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadText(`eventura_finance_${toYMD(new Date())}.csv`, csv, "text/csv;charset=utf-8");
  }

  function exportExcel() {
    const rows = filtered.map((t) => ({
      id: t.id,
      title: t.title,
      date: t.date,
      type: t.type,
      status: t.status,
      amount: t.amount,
      currency: t.currency,
      category: t.category,
      paymentMethod: t.paymentMethod,
      clientName: t.clientName || "",
      vendorName: t.vendorName || "",
      eventTitle: t.eventTitle || "",
      dueDate: t.dueDate || "",
      invoiceNo: t.invoiceNo || "",
      referenceId: t.referenceId || "",
      notes: t.notes || "",
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
    if (!rows.length) rows.push({ id: "", title: "", date: "", type: "", status: "", amount: 0, currency: "", category: "", paymentMethod: "", clientName: "", vendorName: "", eventTitle: "", dueDate: "", invoiceNo: "", referenceId: "", notes: "", createdAt: "", updatedAt: "" } as any);
    buildExcelXls(`eventura_finance_${toYMD(new Date())}.xls`, rows);
  }

  async function importCSVFile(file: File) {
    const text = await file.text();
    const rows = parseCSV(text);
    const imported: FinanceTx[] = [];
    for (const r of rows) {
      const tx = normalizeImported(r);
      if (tx) imported.push(tx);
    }
    if (!imported.length) return;
    setTxs((prev) => [...imported, ...prev]);
  }

  function loadDemo() {
    setTxs((prev) => [...demoData(new Date()), ...prev]);
  }

  function duplicateTx(t: FinanceTx) {
    const copy: FinanceTx = {
      ...t,
      id: uid(),
      title: `${t.title} (copy)`,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    setTxs((prev) => [copy, ...prev]);
  }

  function saveNewView() {
    const name = prompt("View name?", "My view");
    if (!name) return;
    const v: ViewDef = {
      ...activeView,
      id: uid("view"),
      name,
    };
    setViews((prev) => [v, ...prev]);
    setActiveViewId(v.id);
  }

  function deleteActiveView() {
    if (activeView.id === "main") return;
    const ok = confirm(`Delete view "${activeView.name}"?`);
    if (!ok) return;
    setViews((prev) => prev.filter((v) => v.id !== activeView.id));
    setActiveViewId("main");
  }

  // Calendar (month grid)
  const cal = useMemo(() => {
    if (activeView.layout !== "Calendar") return null;
    const first = new Date(`${month}-01T00:00:00`);
    const startDow = first.getDay(); // 0 Sunday
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells: Array<{ ymd: string; day: number; income: number; expense: number; count: number }> = [];

    // pad
    for (let i = 0; i < startDow; i++) cells.push({ ymd: "", day: 0, income: 0, expense: 0, count: 0 });

    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${month}-${pad2(d)}`;
      const list = monthTx.filter((t) => t.date === ymd);
      const income = list.filter((t) => t.type === "Income").reduce((s, t) => s + t.amount, 0);
      const expense = list.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
      cells.push({ ymd, day: d, income, expense, count: list.length });
    }
    while (cells.length % 7 !== 0) cells.push({ ymd: "", day: 0, income: 0, expense: 0, count: 0 });

    return { cells };
  }, [activeView.layout, month, monthTx]);

  // OS nav
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

  // Form model
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
    referenceId: "",
    invoiceNo: "",
    notes: "",
  }));

  function openAddModal() {
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
      referenceId: "",
      invoiceNo: "",
      notes: "",
    });
    setOpenAdd(true);
  }

  function openEditModal(t: FinanceTx) {
    setEditing(t);
    setForm({
      ...t,
      clientName: t.clientName || "",
      vendorName: t.vendorName || "",
      eventTitle: t.eventTitle || "",
      dueDate: t.dueDate || "",
      referenceId: t.referenceId || "",
      invoiceNo: t.invoiceNo || "",
      notes: t.notes || "",
    });
    setOpenAdd(true);
  }

  function submitForm() {
    if (!form.title.trim()) {
      alert("Title is required.");
      return;
    }
    if (!Number.isFinite(form.amount)) {
      alert("Amount must be a number.");
      return;
    }
    const tx: FinanceTx = {
      ...form,
      title: form.title.trim(),
      amount: Number(form.amount),
      clientName: form.clientName?.trim() ? form.clientName.trim() : undefined,
      vendorName: form.vendorName?.trim() ? form.vendorName.trim() : undefined,
      eventTitle: form.eventTitle?.trim() ? form.eventTitle.trim() : undefined,
      dueDate: form.dueDate?.trim() ? form.dueDate.trim() : undefined,
      referenceId: form.referenceId?.trim() ? form.referenceId.trim() : undefined,
      invoiceNo: form.invoiceNo?.trim() ? form.invoiceNo.trim() : undefined,
      notes: form.notes?.trim() ? form.notes.trim() : undefined,
    };
    addOrUpdateTx(tx);
    setOpenAdd(false);
  }

  // Color by
  function pillToneForTx(t: FinanceTx) {
    if (activeView.colorBy === "Type") return toneForType(t.type);
    if (activeView.colorBy === "Category") return toneForCategory(t.category);
    if (activeView.colorBy === "Status") return toneForStatus(t.status);
    return "neutral";
  }

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* TOP BAR */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl border border-white/15 bg-white/5" />
            <div>
              <div className="text-sm font-semibold">Eventura OS</div>
              <div className="text-xs text-white/50">Finance</div>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {nav.map((n) => (
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
            <div className="hidden rounded-2xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70 md:block">
              Signed in <span className="text-white"> {email}</span> •{" "}
              <span className="text-white">{role}</span>
            </div>
            <Link
              href="/settings"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-black hover:text-white"
            >
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[260px_1fr]">
        {/* SIDEBAR */}
        <aside className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="mb-3 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="text-sm font-semibold">Eventura OS</div>
            <div className="text-xs text-white/55">Finance module</div>

            <div className="mt-3 flex items-center justify-between">
              <Pill tone="muted">{role}</Pill>
              <Pill tone="neutral">{email}</Pill>
            </div>
          </div>

          <div className="grid gap-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cls(
                  "flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                  n.href === "/finance"
                    ? "border border-white/20 bg-white/10 text-white"
                    : "border border-transparent text-white/75 hover:bg-black hover:text-white"
                )}
              >
                <span>{n.label}</span>
                {n.href === "/finance" ? <span className="text-xs text-white/50">Active</span> : null}
              </Link>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="text-xs font-semibold text-white/80">Quick actions</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Btn onClick={openAddModal} className="w-full justify-center">
                + Add transaction
              </Btn>
              <Btn variant="outline" onClick={loadDemo} className="w-full justify-center">
                Import demo
              </Btn>
              <Btn
                variant="outline"
                onClick={() => fileRef.current?.click()}
                className="w-full justify-center"
              >
                Import CSV
              </Btn>
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

        {/* MAIN */}
        <main className="rounded-2xl border border-white/10 bg-white/5 p-4">
          {/* HEADER */}
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xl font-semibold">Finance Control Center</div>
              <div className="text-sm text-white/55">
                Transactions • Views • Import/Export • Reports • Calendar • Black Hover • Deploy Safe
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="w-[160px]">
                <Input value={month} onChange={setMonth} type="month" />
              </div>
              <Btn onClick={exportExcel}>Export Excel</Btn>
              <Btn variant="outline" onClick={exportCSV}>
                Export CSV
              </Btn>
              <Btn variant="outline" onClick={() => fileRef.current?.click()}>
                Import
              </Btn>
              <Btn onClick={openAddModal}>+ Add</Btn>
            </div>
          </div>

          {/* KPI CARDS */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 hover:bg-black transition">
              <div className="text-xs text-white/55">Income</div>
              <div className="mt-1 text-sm font-semibold">{money(kpis.income, "INR")}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 hover:bg-black transition">
              <div className="text-xs text-white/55">Expense</div>
              <div className="mt-1 text-sm font-semibold">{money(kpis.expense, "INR")}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 hover:bg-black transition">
              <div className="text-xs text-white/55">Net</div>
              <div className="mt-1 text-sm font-semibold">{money(kpis.net, "INR")}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 hover:bg-black transition">
              <div className="text-xs text-white/55">AR</div>
              <div className="mt-1 text-sm font-semibold">{money(kpis.ar, "INR")}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 hover:bg-black transition">
              <div className="text-xs text-white/55">AP</div>
              <div className="mt-1 text-sm font-semibold">{money(kpis.ap, "INR")}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3 hover:bg-black transition">
              <div className="text-xs text-white/55">Overdue</div>
              <div className="mt-1 text-sm font-semibold">{kpis.overdue}</div>
            </div>
          </div>

          {/* VIEWS + FILTERS */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="muted">Views</Pill>
                <div className="min-w-[220px]">
                  <Select
                    value={activeViewId}
                    onChange={setActiveViewId}
                    options={views.map((v) => ({ value: v.id, label: v.name }))}
                  />
                </div>
                <Btn variant="outline" onClick={saveNewView}>
                  + Save view
                </Btn>
                <Btn variant="danger" onClick={deleteActiveView} disabled={activeView.id === "main"}>
                  Delete
                </Btn>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="muted">Layout</Pill>
                {(["Gallery", "Table", "Calendar", "Reports"] as Layout[]).map((l) => (
                  <Btn
                    key={l}
                    variant={activeView.layout === l ? "primary" : "outline"}
                    onClick={() => setView({ layout: l })}
                  >
                    {l}
                  </Btn>
                ))}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <Input
                  value={activeView.q}
                  onChange={(v) => setView({ q: v })}
                  placeholder="Search..."
                />
              </div>

              <div className="md:col-span-2">
                <Select
                  value={activeView.type}
                  onChange={(v) => setView({ type: v as any })}
                  options={[
                    { value: "All", label: "Type: All" },
                    ...TX_TYPES.map((t) => ({ value: t, label: `Type: ${t}` })),
                  ]}
                />
              </div>

              <div className="md:col-span-2">
                <Select
                  value={activeView.status}
                  onChange={(v) => setView({ status: v as any })}
                  options={[
                    { value: "All", label: "Status: All" },
                    ...TX_STATUSES.map((s) => ({ value: s, label: `Status: ${s}` })),
                  ]}
                />
              </div>

              <div className="md:col-span-2">
                <Select
                  value={activeView.category}
                  onChange={(v) => setView({ category: v as any })}
                  options={[
                    { value: "All", label: "Category: All" },
                    ...CATEGORIES.map((c) => ({ value: c, label: `Category: ${c}` })),
                  ]}
                />
              </div>

              <div className="md:col-span-2">
                <Select
                  value={activeView.currency}
                  onChange={(v) => setView({ currency: v as any })}
                  options={[
                    { value: "All", label: "Currency: All" },
                    ...CURRENCIES.map((c) => ({ value: c, label: `Currency: ${c}` })),
                  ]}
                />
              </div>

              <div className="md:col-span-2">
                <Input
                  value={activeView.from}
                  onChange={(v) => setView({ from: v })}
                  type="date"
                />
              </div>

              <div className="md:col-span-2">
                <Input value={activeView.to} onChange={(v) => setView({ to: v })} type="date" />
              </div>

              <div className="md:col-span-2">
                <Select
                  value={activeView.sortKey}
                  onChange={(v) => setView({ sortKey: v as SortKey })}
                  options={[
                    { value: "date", label: "Sort: Date" },
                    { value: "amount", label: "Sort: Amount" },
                    { value: "status", label: "Sort: Status" },
                    { value: "category", label: "Sort: Category" },
                    { value: "title", label: "Sort: Title" },
                  ]}
                />
              </div>

              <div className="md:col-span-2">
                <Select
                  value={activeView.sortDir}
                  onChange={(v) => setView({ sortDir: v as SortDir })}
                  options={[
                    { value: "desc", label: "Desc" },
                    { value: "asc", label: "Asc" },
                  ]}
                />
              </div>

              <div className="md:col-span-2">
                <Select
                  value={activeView.colorBy}
                  onChange={(v) => setView({ colorBy: v as ColorBy })}
                  options={[
                    { value: "None", label: "Color: None" },
                    { value: "Status", label: "Color: Status" },
                    { value: "Category", label: "Color: Category" },
                    { value: "Type", label: "Color: Type" },
                  ]}
                />
              </div>

              <div className="md:col-span-2">
                <Btn
                  variant="outline"
                  onClick={() =>
                    setView({
                      q: "",
                      type: "All",
                      status: "All",
                      category: "All",
                      currency: "All",
                      from: "",
                      to: "",
                      sortKey: "date",
                      sortDir: "desc",
                      colorBy: "Status",
                    })
                  }
                  className="w-full justify-center"
                >
                  Reset
                </Btn>
              </div>
            </div>
          </div>

          {/* CONTENT */}
          <div className="mt-4">
            {activeView.layout === "Gallery" ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filtered.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-white/70">
                    No rows found. Click <span className="text-white">+ Add</span> to create a transaction.
                  </div>
                ) : null}

                {filtered.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:bg-black hover:border-white/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{t.title}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Pill tone={pillToneForTx(t)}>{t.status}</Pill>
                          <Pill tone={toneForType(t.type)}>{t.type}</Pill>
                          <Pill tone={toneForCategory(t.category)}>{t.category}</Pill>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{money(t.amount, t.currency)}</div>
                        <div className="text-xs text-white/55">{t.date}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/70">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                        <div className="text-white/50">Client</div>
                        <div className="truncate">{t.clientName || "-"}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                        <div className="text-white/50">Vendor</div>
                        <div className="truncate">{t.vendorName || "-"}</div>
                      </div>
                      <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 p-2">
                        <div className="text-white/50">Event</div>
                        <div className="truncate">{t.eventTitle || "-"}</div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Btn variant="outline" onClick={() => openEditModal(t)}>
                        Edit
                      </Btn>
                      <Btn variant="outline" onClick={() => duplicateTx(t)}>
                        Duplicate
                      </Btn>
                      <Btn
                        variant="danger"
                        onClick={() => {
                          const ok = confirm("Delete this transaction?");
                          if (ok) removeTx(t.id);
                        }}
                      >
                        Delete
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {activeView.layout === "Table" ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <div className="overflow-auto">
                  <table className="min-w-[980px] w-full text-left text-sm">
                    <thead className="border-b border-white/10 bg-black/40">
                      <tr className="text-white/80">
                        <th className="px-3 py-3">Date</th>
                        <th className="px-3 py-3">Title</th>
                        <th className="px-3 py-3">Type</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Category</th>
                        <th className="px-3 py-3">Amount</th>
                        <th className="px-3 py-3">Client/Vendor</th>
                        <th className="px-3 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td className="px-3 py-6 text-white/70" colSpan={8}>
                            No rows found. Click + Add to create a transaction.
                          </td>
                        </tr>
                      ) : null}

                      {filtered.map((t) => (
                        <tr
                          key={t.id}
                          className="border-b border-white/10 hover:bg-black transition"
                        >
                          <td className="px-3 py-3 text-white/70">{t.date}</td>
                          <td className="px-3 py-3">
                            <div className="font-semibold">{t.title}</div>
                            <div className="text-xs text-white/50">
                              {t.eventTitle || "-"} • {t.paymentMethod}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Pill tone={toneForType(t.type)}>{t.type}</Pill>
                          </td>
                          <td className="px-3 py-3">
                            <Pill tone={toneForStatus(t.status)}>{t.status}</Pill>
                          </td>
                          <td className="px-3 py-3">
                            <Pill tone={toneForCategory(t.category)}>{t.category}</Pill>
                          </td>
                          <td className="px-3 py-3 font-semibold">{money(t.amount, t.currency)}</td>
                          <td className="px-3 py-3 text-white/70">
                            {t.clientName || t.vendorName || "-"}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Btn variant="outline" onClick={() => openEditModal(t)}>
                                Edit
                              </Btn>
                              <Btn variant="outline" onClick={() => duplicateTx(t)}>
                                Duplicate
                              </Btn>
                              <Btn
                                variant="danger"
                                onClick={() => {
                                  const ok = confirm("Delete this transaction?");
                                  if (ok) removeTx(t.id);
                                }}
                              >
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

            {activeView.layout === "Calendar" ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">Calendar — {month}</div>
                  <div className="text-xs text-white/60">Shows totals per day (filtered + month)</div>
                </div>

                <div className="grid grid-cols-7 gap-2 text-xs text-white/55">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="px-2 py-1">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-2">
                  {cal?.cells.map((c, idx) => (
                    <div
                      key={idx}
                      className={cls(
                        "min-h-[92px] rounded-2xl border border-white/10 bg-black/40 p-2 transition hover:bg-black",
                        !c.ymd && "opacity-30"
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

            {activeView.layout === "Reports" ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-sm font-semibold">By Category (Month)</div>
                  <div className="mt-3 grid gap-2">
                    {reportByCategory.map((r) => (
                      <div
                        key={r.category}
                        className="rounded-2xl border border-white/10 bg-black/40 p-3 hover:bg-black transition"
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

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-sm font-semibold">By Status (Month)</div>
                  <div className="mt-3 grid gap-2">
                    {reportByStatus.map((r) => (
                      <div
                        key={r.status}
                        className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 p-3 hover:bg-black transition"
                      >
                        <div className="flex items-center gap-2">
                          <Pill tone={toneForStatus(r.status)}>{r.status}</Pill>
                        </div>
                        <div className="text-sm font-semibold">{r.count}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-3">
                    <div className="text-xs text-white/55">Month summary</div>
                    <div className="mt-1 text-sm font-semibold">
                      Income {money(kpis.income, "INR")} • Expense {money(kpis.expense, "INR")} • Net{" "}
                      {money(kpis.net, "INR")}
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
        open={openAdd}
        title={editing ? "Edit transaction" : "Add transaction"}
        onClose={() => setOpenAdd(false)}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpenAdd(false)}>
              Cancel
            </Btn>
            <Btn onClick={submitForm}>{editing ? "Save changes" : "Add transaction"}</Btn>
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
            <Select
              value={form.type}
              onChange={(v) => setForm((p) => ({ ...p, type: v as TxType }))}
              options={TX_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-xs text-white/55">Status</div>
            <Select
              value={form.status}
              onChange={(v) => setForm((p) => ({ ...p, status: v as TxStatus }))}
              options={TX_STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-xs text-white/55">Category</div>
            <Select
              value={form.category}
              onChange={(v) => setForm((p) => ({ ...p, category: v as TxCategory }))}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-xs text-white/55">Payment method</div>
            <Select
              value={form.paymentMethod}
              onChange={(v) => setForm((p) => ({ ...p, paymentMethod: v as PayMethod }))}
              options={METHODS.map((m) => ({ value: m, label: m }))}
            />
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
            <Select
              value={form.currency}
              onChange={(v) => setForm((p) => ({ ...p, currency: v as Currency }))}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="md:col-span-6">
            <div className="mb-1 text-xs text-white/55">Event title</div>
            <Input value={form.eventTitle || ""} onChange={(v) => setForm((p) => ({ ...p, eventTitle: v }))} placeholder="e.g., Wedding @ Surat" />
          </div>

          <div className="md:col-span-6">
            <div className="mb-1 text-xs text-white/55">Client name</div>
            <Input value={form.clientName || ""} onChange={(v) => setForm((p) => ({ ...p, clientName: v }))} placeholder="Optional" />
          </div>

          <div className="md:col-span-6">
            <div className="mb-1 text-xs text-white/55">Vendor name</div>
            <Input value={form.vendorName || ""} onChange={(v) => setForm((p) => ({ ...p, vendorName: v }))} placeholder="Optional" />
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-xs text-white/55">Invoice no</div>
            <Input value={form.invoiceNo || ""} onChange={(v) => setForm((p) => ({ ...p, invoiceNo: v }))} placeholder="Optional" />
          </div>

          <div className="md:col-span-3">
            <div className="mb-1 text-xs text-white/55">Reference ID</div>
            <Input value={form.referenceId || ""} onChange={(v) => setForm((p) => ({ ...p, referenceId: v }))} placeholder="Optional" />
          </div>

          <div className="md:col-span-12">
            <div className="mb-1 text-xs text-white/55">Notes</div>
            <textarea
              value={form.notes || ""}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              rows={4}
              className="w-full rounded-2xl border border-white/15 bg-black/50 p-3 text-sm text-white outline-none transition hover:border-white/25 focus:border-white/30"
              placeholder="Optional"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
