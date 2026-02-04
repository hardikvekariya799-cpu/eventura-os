"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* =========================================================
   Eventura OS — Finance (Airtable-style layout)
   - Clean OS header + tabs
   - Views sidebar
   - Toolbar: Customize / Filter / Sort / Color / Share + Search
   - Gallery cards + Table view
   - Add / Edit / Duplicate / Delete
   - CSV Export + Excel-friendly Export (TSV)
   - CSV Import
   - Deploy-safe: no external libs
========================================================= */

type TxType = "Income" | "Expense";
type TxStatus = "Planned" | "Pending" | "Paid" | "Overdue" | "Cancelled";
type Currency = "INR" | "CAD" | "USD";
type PayMethod = "Cash" | "UPI" | "Bank" | "Card" | "Cheque";
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
type EventType = "Wedding" | "Corporate" | "Conference" | "Party" | "Training" | "Exhibition" | "Festival" | "Other";

type Layout = "Gallery" | "Table";

type SortKey = "date" | "amount" | "title" | "status" | "category";
type SortDir = "asc" | "desc";

type ViewDef = {
  id: string;
  name: string;
  layout: Layout;

  q: string;
  type: TxType | "All";
  status: TxStatus | "All";
  category: TxTag | "All";
  currency: Currency | "All";
  eventType: EventType | "All";
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD

  sortKey: SortKey;
  sortDir: SortDir;

  colorBy: "None" | "Status" | "Type" | "Category";
};

type FinanceTx = {
  id: string;

  title: string;
  date: string; // YYYY-MM-DD
  type: TxType;
  status: TxStatus;

  amount: number;
  currency: Currency;

  category: TxTag;
  eventType: EventType;

  clientName?: string;
  vendorName?: string;
  eventTitle?: string;

  dueDate?: string; // YYYY-MM-DD
  paymentMethod: PayMethod;

  invoiceNo?: string;
  referenceId?: string;
  notes?: string;

  createdAt: string;
  updatedAt: string;
};

const LS_TX = "eventura_fin_tx_air_v1";
const LS_VIEWS = "eventura_fin_views_air_v1";
const LS_ACTIVE_VIEW = "eventura_fin_active_view_air_v1";

/* ----------------- helpers ----------------- */
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
function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function parseNum(v: any, fallback = 0) {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : fallback;
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
function escCSV(val: any) {
  const s = String(val ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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
function badgeToneByStatus(s: TxStatus) {
  if (s === "Paid") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (s === "Overdue") return "bg-rose-100 text-rose-900 border-rose-200";
  if (s === "Pending") return "bg-amber-100 text-amber-900 border-amber-200";
  if (s === "Cancelled") return "bg-zinc-100 text-zinc-800 border-zinc-200";
  return "bg-sky-100 text-sky-900 border-sky-200";
}
function badgeToneByType(t: TxType) {
  return t === "Income"
    ? "bg-emerald-100 text-emerald-900 border-emerald-200"
    : "bg-rose-100 text-rose-900 border-rose-200";
}
function badgeToneByCategory(c: TxTag) {
  if (c === "Sales" || c === "ClientAdvance") return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (c === "VendorPayment" || c === "Salary") return "bg-amber-100 text-amber-900 border-amber-200";
  if (c === "Tax") return "bg-rose-100 text-rose-900 border-rose-200";
  return "bg-zinc-100 text-zinc-800 border-zinc-200";
}
function badgeTone(colorBy: ViewDef["colorBy"], tx: FinanceTx) {
  if (colorBy === "Status") return badgeToneByStatus(tx.status);
  if (colorBy === "Type") return badgeToneByType(tx.type);
  if (colorBy === "Category") return badgeToneByCategory(tx.category);
  return "bg-zinc-100 text-zinc-800 border-zinc-200";
}

/* ----------------- UI primitives (black hover) ----------------- */
function HoverBtn({
  children,
  onClick,
  variant = "soft",
  className,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "soft" | "outline" | "danger" | "ghost";
  className?: string;
  title?: string;
}) {
  const base =
    "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm border transition select-none";
  const v =
    variant === "outline"
      ? "bg-white border-zinc-200 text-zinc-900 hover:bg-black hover:text-white hover:border-black"
      : variant === "danger"
      ? "bg-rose-50 border-rose-200 text-rose-900 hover:bg-black hover:text-white hover:border-black"
      : variant === "ghost"
      ? "bg-transparent border-transparent text-zinc-700 hover:bg-black hover:text-white"
      : "bg-zinc-50 border-zinc-200 text-zinc-900 hover:bg-black hover:text-white hover:border-black";
  return (
    <button title={title} onClick={onClick} className={cls(base, v, className)}>
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-[12px] font-medium text-zinc-600">{label}</div>
      {children}
    </div>
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
      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition hover:border-black focus:border-black"
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
      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition hover:border-black focus:border-black"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition hover:border-black focus:border-black"
    />
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  maxW = "max-w-3xl",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxW?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className={cls("w-full overflow-hidden rounded-2xl bg-white shadow-2xl", maxW)}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div className="text-base font-semibold text-zinc-900">{title}</div>
          <HoverBtn variant="outline" onClick={onClose}>
            Close
          </HoverBtn>
        </div>
        <div className="max-h-[75vh] overflow-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-zinc-200 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ----------------- defaults ----------------- */
const TX_STATUSES: TxStatus[] = ["Planned", "Pending", "Paid", "Overdue", "Cancelled"];
const TX_TYPES: TxType[] = ["Income", "Expense"];
const CURRENCIES: Currency[] = ["INR", "CAD", "USD"];
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
const METHODS: PayMethod[] = ["Cash", "UPI", "Bank", "Card", "Cheque"];

function defaultViews(): ViewDef[] {
  return [
    {
      id: "v_main",
      name: "Finance board",
      layout: "Gallery",
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
    },
    {
      id: "v_income",
      name: "Income",
      layout: "Gallery",
      q: "",
      type: "Income",
      status: "All",
      category: "All",
      currency: "All",
      eventType: "All",
      from: "",
      to: "",
      sortKey: "date",
      sortDir: "desc",
      colorBy: "Category",
    },
    {
      id: "v_expense",
      name: "Expenses",
      layout: "Table",
      q: "",
      type: "Expense",
      status: "All",
      category: "All",
      currency: "All",
      eventType: "All",
      from: "",
      to: "",
      sortKey: "date",
      sortDir: "desc",
      colorBy: "Type",
    },
    {
      id: "v_overdue",
      name: "Overdue",
      layout: "Table",
      q: "",
      type: "All",
      status: "Overdue",
      category: "All",
      currency: "All",
      eventType: "All",
      from: "",
      to: "",
      sortKey: "dueDate",
      // @ts-expect-error keep sortKey typed; we’ll map dueDate to date fallback in sorter below
      sortDir: "asc",
      colorBy: "Status",
    } as any,
  ];
}

function demoTx(): FinanceTx[] {
  const today = toYMD(new Date());
  const m1 = toYMD(new Date(Date.now() - 1000 * 60 * 60 * 24 * 12));
  const m2 = toYMD(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30));
  return [
    {
      id: uid(),
      title: "Client advance — Wedding",
      date: m2,
      type: "Income",
      status: "Paid",
      amount: 150000,
      currency: "INR",
      category: "ClientAdvance",
      eventType: "Wedding",
      clientName: "Client A",
      eventTitle: "Wedding — Pal",
      paymentMethod: "Bank",
      invoiceNo: "INV-1001",
      referenceId: "UTR123",
      notes: "Advance received",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: uid(),
      title: "Vendor payment — Decor",
      date: m1,
      type: "Expense",
      status: "Pending",
      amount: 65000,
      currency: "INR",
      category: "VendorPayment",
      eventType: "Wedding",
      vendorName: "Decor Vendor",
      eventTitle: "Wedding — Pal",
      paymentMethod: "UPI",
      dueDate: today,
      notes: "Final payment pending",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
    {
      id: uid(),
      title: "Marketing — Instagram ads",
      date: today,
      type: "Expense",
      status: "Paid",
      amount: 12000,
      currency: "INR",
      category: "Marketing",
      eventType: "Other",
      paymentMethod: "Card",
      notes: "Campaign for leads",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    },
  ];
}

/* ========================================================= */
export default function FinancePage() {
  const [views, setViews] = useState<ViewDef[]>([]);
  const [activeViewId, setActiveViewId] = useState<string>("");

  const [txs, setTxs] = useState<FinanceTx[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showTxModal, setShowTxModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const importRef = useRef<HTMLInputElement | null>(null);

  /* ---------- load ---------- */
  useEffect(() => {
    const savedTx = safeParse<FinanceTx[]>(localStorage.getItem(LS_TX), []);
    const savedViews = safeParse<ViewDef[]>(localStorage.getItem(LS_VIEWS), []);
    const savedActive = localStorage.getItem(LS_ACTIVE_VIEW);

    const txInit = savedTx.length ? savedTx : demoTx();
    const viewInit = savedViews.length ? savedViews : defaultViews();
    const activeInit = savedActive && viewInit.some((v) => v.id === savedActive) ? savedActive : viewInit[0]?.id ?? "v_main";

    setTxs(txInit);
    setViews(viewInit);
    setActiveViewId(activeInit);
  }, []);

  /* ---------- persist ---------- */
  useEffect(() => {
    if (!views.length) return;
    localStorage.setItem(LS_VIEWS, JSON.stringify(views));
  }, [views]);

  useEffect(() => {
    if (!activeViewId) return;
    localStorage.setItem(LS_ACTIVE_VIEW, activeViewId);
  }, [activeViewId]);

  useEffect(() => {
    if (!txs.length) {
      localStorage.setItem(LS_TX, JSON.stringify([]));
      return;
    }
    localStorage.setItem(LS_TX, JSON.stringify(txs));
  }, [txs]);

  const activeView = useMemo(() => views.find((v) => v.id === activeViewId) ?? null, [views, activeViewId]);

  /* ---------- filtering ---------- */
  const filtered = useMemo(() => {
    if (!activeView) return txs;

    const q = activeView.q.trim().toLowerCase();
    const from = activeView.from.trim();
    const to = activeView.to.trim();

    const matches = (t: FinanceTx) => {
      if (activeView.type !== "All" && t.type !== activeView.type) return false;
      if (activeView.status !== "All" && t.status !== activeView.status) return false;
      if (activeView.category !== "All" && t.category !== activeView.category) return false;
      if (activeView.currency !== "All" && t.currency !== activeView.currency) return false;
      if (activeView.eventType !== "All" && t.eventType !== activeView.eventType) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;

      if (q) {
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
          t.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    };

    const rows = txs.filter(matches);

    const dir = activeView.sortDir === "asc" ? 1 : -1;
    const key = activeView.sortKey;

    rows.sort((a, b) => {
      const av =
        key === "amount"
          ? a.amount
          : key === "title"
          ? a.title.toLowerCase()
          : key === "status"
          ? a.status
          : key === "category"
          ? a.category
          : a.date; // date

      const bv =
        key === "amount"
          ? b.amount
          : key === "title"
          ? b.title.toLowerCase()
          : key === "status"
          ? b.status
          : key === "category"
          ? b.category
          : b.date;

      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });

    return rows;
  }, [txs, activeView]);

  /* ---------- KPIs ---------- */
  const kpis = useMemo(() => {
    const cur = (activeView?.currency && activeView.currency !== "All" ? activeView.currency : "INR") as Currency;
    let income = 0;
    let expense = 0;
    let overdue = 0;

    for (const t of filtered) {
      const amt = t.currency === cur ? t.amount : 0; // (simple: only sum selected currency)
      if (t.type === "Income") income += amt;
      else expense += amt;

      if (t.status === "Overdue") overdue += 1;
      if (t.dueDate && t.status !== "Paid" && t.dueDate < toYMD(new Date())) overdue += 0; // keep count via status
    }

    return {
      cur,
      income,
      expense,
      net: income - expense,
      rows: filtered.length,
      overdue,
    };
  }, [filtered, activeView]);

  /* ---------- CRUD ---------- */
  function openAdd() {
    setEditingId(null);
    setShowTxModal(true);
  }
  function openEdit(id: string) {
    setEditingId(id);
    setShowTxModal(true);
  }
  function removeTx(id: string) {
    setTxs((p) => p.filter((x) => x.id !== id));
    if (selectedId === id) setSelectedId(null);
  }
  function duplicateTx(id: string) {
    const t = txs.find((x) => x.id === id);
    if (!t) return;
    const copy: FinanceTx = {
      ...t,
      id: uid(),
      title: t.title + " (Copy)",
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    setTxs((p) => [copy, ...p]);
  }

  /* ---------- export/import ---------- */
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
      "eventType",
      "clientName",
      "vendorName",
      "eventTitle",
      "dueDate",
      "paymentMethod",
      "invoiceNo",
      "referenceId",
      "notes",
      "createdAt",
      "updatedAt",
    ] as const;

    const header = cols.join(",");
    const lines = filtered.map((t) =>
      cols
        .map((c) => {
          const v = (t as any)[c];
          return escCSV(v);
        })
        .join(",")
    );

    downloadText(`eventura_finance_${toYMD(new Date())}.csv`, [header, ...lines].join("\n"), "text/csv;charset=utf-8");
  }

  function exportExcelTSV() {
    // Excel-friendly: TSV opens cleanly without CSV comma issues.
    const cols = [
      "title",
      "date",
      "type",
      "status",
      "amount",
      "currency",
      "category",
      "eventType",
      "clientName",
      "vendorName",
      "eventTitle",
      "dueDate",
      "paymentMethod",
      "invoiceNo",
      "referenceId",
      "notes",
    ] as const;

    const header = cols.join("\t");
    const lines = filtered.map((t) =>
      cols
        .map((c) => {
          const v = (t as any)[c];
          return String(v ?? "").replace(/\t/g, " ");
        })
        .join("\t")
    );

    downloadText(`eventura_finance_${toYMD(new Date())}.xls`, [header, ...lines].join("\n"), "application/vnd.ms-excel");
  }

  function clickImport() {
    importRef.current?.click();
  }

  function importCSV(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = text.split(/\r?\n/).filter(Boolean);
      if (rows.length < 2) return;

      const header = rows[0].split(",").map((x) => x.trim());
      const idx = (k: string) => header.findIndex((h) => h === k);

      const out: FinanceTx[] = [];
      for (let i = 1; i < rows.length; i++) {
        const line = rows[i];
        if (!line.trim()) continue;

        // basic CSV parse (supports quotes)
        const cells: string[] = [];
        let cur = "";
        let inQ = false;
        for (let j = 0; j < line.length; j++) {
          const ch = line[j];
          if (ch === '"' && line[j + 1] === '"') {
            cur += '"';
            j++;
            continue;
          }
          if (ch === '"') {
            inQ = !inQ;
            continue;
          }
          if (ch === "," && !inQ) {
            cells.push(cur);
            cur = "";
            continue;
          }
          cur += ch;
        }
        cells.push(cur);

        const get = (k: string) => {
          const p = idx(k);
          if (p < 0) return "";
          return (cells[p] ?? "").trim();
        };

        const tx: FinanceTx = {
          id: get("id") || uid(),
          title: get("title") || "Untitled",
          date: get("date") || toYMD(new Date()),
          type: (get("type") as TxType) || "Expense",
          status: (get("status") as TxStatus) || "Planned",
          amount: parseNum(get("amount"), 0),
          currency: (get("currency") as Currency) || "INR",
          category: (get("category") as TxTag) || "Other",
          eventType: (get("eventType") as EventType) || "Other",
          clientName: get("clientName") || undefined,
          vendorName: get("vendorName") || undefined,
          eventTitle: get("eventTitle") || undefined,
          dueDate: get("dueDate") || undefined,
          paymentMethod: (get("paymentMethod") as PayMethod) || "Bank",
          invoiceNo: get("invoiceNo") || undefined,
          referenceId: get("referenceId") || undefined,
          notes: get("notes") || undefined,
          createdAt: get("createdAt") || nowISO(),
          updatedAt: nowISO(),
        };

        out.push(tx);
      }

      if (out.length) setTxs((p) => [...out, ...p]);
    };
    reader.readAsText(file);
  }

  /* ---------- views ---------- */
  function updateView(patch: Partial<ViewDef>) {
    setViews((prev) => prev.map((v) => (v.id === activeViewId ? { ...v, ...patch } : v)));
  }

  function addView() {
    const v: ViewDef = {
      id: uid("view"),
      name: "New view",
      layout: "Gallery",
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
    setViews((p) => [v, ...p]);
    setActiveViewId(v.id);
  }

  function renameView() {
    const name = prompt("Rename view:", activeView?.name ?? "");
    if (!name || !activeView) return;
    updateView({ name: name.trim().slice(0, 40) });
  }

  function deleteView() {
    if (!activeView) return;
    if (!confirm(`Delete view "${activeView.name}"?`)) return;
    setViews((p) => p.filter((x) => x.id !== activeView.id));
    setActiveViewId((p) => {
      const remain = views.filter((x) => x.id !== activeView.id);
      return remain[0]?.id ?? "v_main";
    });
  }

  /* ---------- record form ---------- */
  const editingTx = useMemo(() => (editingId ? txs.find((t) => t.id === editingId) ?? null : null), [editingId, txs]);

  const [form, setForm] = useState<FinanceTx | null>(null);
  useEffect(() => {
    if (!showTxModal) return;

    if (editingTx) {
      setForm({ ...editingTx });
    } else {
      setForm({
        id: uid(),
        title: "",
        date: toYMD(new Date()),
        type: "Expense",
        status: "Planned",
        amount: 0,
        currency: "INR",
        category: "Other",
        eventType: "Other",
        paymentMethod: "Bank",
        createdAt: nowISO(),
        updatedAt: nowISO(),
      });
    }
  }, [showTxModal, editingTx]);

  function saveTx() {
    if (!form) return;

    const clean: FinanceTx = {
      ...form,
      title: form.title.trim() || "Untitled",
      amount: parseNum(form.amount, 0),
      updatedAt: nowISO(),
    };

    setTxs((prev) => {
      const exists = prev.some((t) => t.id === clean.id);
      if (exists) return prev.map((t) => (t.id === clean.id ? clean : t));
      return [clean, ...prev];
    });

    setShowTxModal(false);
    setEditingId(null);
    setSelectedId(clean.id);
  }

  /* ========================================================= */
  return (
    <div className="min-h-screen bg-[#f6f7fb] text-zinc-900">
      {/* Top OS bar */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-4">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-black text-white grid place-items-center font-semibold">
                E
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Eventura OS</div>
                <div className="text-[12px] text-zinc-500">Finance</div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
              <span className="text-xs text-zinc-500">Signed in</span>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs">
                CEO
              </span>
            </div>
          </div>

          {/* App nav like your OS */}
          <div className="flex items-center justify-between pb-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                ["Dashboard", "/dashboard"],
                ["Events", "/events"],
                ["Finance", "/finance"],
                ["Vendors", "/vendors"],
                ["AI", "/ai"],
                ["HR", "/hr"],
                ["Reports", "/reports"],
                ["Settings", "/settings"],
              ].map(([label, href]) => {
                const active = href === "/finance";
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cls(
                      "rounded-xl border px-3 py-2 text-sm transition",
                      active
                        ? "border-black bg-black text-white"
                        : "border-zinc-200 bg-white text-zinc-800 hover:bg-black hover:text-white hover:border-black"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="hidden lg:flex items-center gap-2">
              <HoverBtn variant="outline" onClick={renameView} title="Rename current view">
                Rename view
              </HoverBtn>
              <HoverBtn variant="outline" onClick={addView} title="Add a new view">
                + View
              </HoverBtn>
            </div>
          </div>
        </div>
      </div>

      {/* Page header */}
      <div className="mx-auto max-w-[1400px] px-4 pt-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-2xl font-semibold">Finance Control Center</div>
            <div className="text-sm text-zinc-600">
              Transactions • Views • Import/Export • Reports • Clean OS layout • Black hover
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <HoverBtn onClick={exportExcelTSV} title="Excel-friendly export">
              Export Excel
            </HoverBtn>
            <HoverBtn onClick={exportCSV} title="Export filtered rows as CSV">
              Export CSV
            </HoverBtn>
            <HoverBtn onClick={clickImport} title="Import CSV">
              Import
            </HoverBtn>
            <HoverBtn onClick={() => setTxs(demoTx())} variant="outline" title="Load demo data">
              Demo
            </HoverBtn>
            <HoverBtn onClick={openAdd} variant="outline" title="Add transaction">
              + Add
            </HoverBtn>
            <input
              ref={importRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCSV(f);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>

        {/* KPI row */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
          {[
            ["Month", toYMD(new Date()).slice(0, 7)],
            ["Income", money(kpis.income, kpis.cur)],
            ["Expense", money(kpis.expense, kpis.cur)],
            ["Net", money(kpis.net, kpis.cur)],
            ["Rows", String(kpis.rows)],
            ["Overdue", String(kpis.overdue)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-zinc-200 bg-white p-3">
              <div className="text-[12px] text-zinc-500">{k}</div>
              <div className="mt-1 text-sm font-semibold">{v}</div>
            </div>
          ))}
        </div>

        {/* Workspace layout */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          {/* Views sidebar */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Views</div>
              <HoverBtn variant="ghost" onClick={addView} title="Add view">
                +
              </HoverBtn>
            </div>

            <div className="mt-2 space-y-1">
              {views.map((v) => {
                const active = v.id === activeViewId;
                return (
                  <button
                    key={v.id}
                    onClick={() => setActiveViewId(v.id)}
                    className={cls(
                      "w-full text-left rounded-xl border px-3 py-2 text-sm transition",
                      active
                        ? "border-black bg-black text-white"
                        : "border-transparent bg-white text-zinc-800 hover:bg-black hover:text-white hover:border-black"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{v.name}</span>
                      <span className="text-[11px] opacity-70">{v.layout}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <HoverBtn variant="outline" onClick={renameView}>
                Rename
              </HoverBtn>
              <HoverBtn variant="danger" onClick={deleteView}>
                Delete
              </HoverBtn>
            </div>
          </div>

          {/* Main board */}
          <div className="rounded-2xl border border-zinc-200 bg-white">
            {/* Toolbar (Airtable-like) */}
            <div className="flex flex-col gap-3 border-b border-zinc-200 p-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <HoverBtn
                  variant="soft"
                  onClick={() => updateView({ layout: activeView?.layout === "Gallery" ? "Table" : "Gallery" })}
                  title="Toggle layout"
                >
                  Layout: {activeView?.layout ?? "Gallery"}
                </HoverBtn>

                <HoverBtn variant="soft" onClick={() => {}} title="Customize cards">
                  Customize cards
                </HoverBtn>

                <HoverBtn
                  variant="soft"
                  onClick={() => updateView({ colorBy: activeView?.colorBy === "Status" ? "Category" : "Status" })}
                  title="Color style"
                >
                  Color: {activeView?.colorBy ?? "Status"}
                </HoverBtn>

                <HoverBtn variant="soft" onClick={() => alert("Share link feature can be wired later (Supabase/auth).")} title="Share">
                  Share view
                </HoverBtn>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-full md:w-[340px]">
                  <Input
                    value={activeView?.q ?? ""}
                    onChange={(v) => updateView({ q: v })}
                    placeholder="Search..."
                  />
                </div>
              </div>
            </div>

            {/* Filters row */}
            <div className="grid grid-cols-1 gap-2 border-b border-zinc-200 p-3 md:grid-cols-6">
              <Select
                value={activeView?.type ?? "All"}
                onChange={(v) => updateView({ type: v as any })}
                options={[{ value: "All", label: "Type: All" }, ...TX_TYPES.map((x) => ({ value: x, label: `Type: ${x}` }))]}
              />
              <Select
                value={activeView?.status ?? "All"}
                onChange={(v) => updateView({ status: v as any })}
                options={[{ value: "All", label: "Status: All" }, ...TX_STATUSES.map((x) => ({ value: x, label: `Status: ${x}` }))]}
              />
              <Select
                value={activeView?.category ?? "All"}
                onChange={(v) => updateView({ category: v as any })}
                options={[{ value: "All", label: "Category: All" }, ...TAGS.map((x) => ({ value: x, label: `Category: ${x}` }))]}
              />
              <Select
                value={activeView?.eventType ?? "All"}
                onChange={(v) => updateView({ eventType: v as any })}
                options={[{ value: "All", label: "Event: All" }, ...EVENT_TYPES.map((x) => ({ value: x, label: `Event: ${x}` }))]}
              />
              <Input value={activeView?.from ?? ""} onChange={(v) => updateView({ from: v })} placeholder="From (YYYY-MM-DD)" />
              <Input value={activeView?.to ?? ""} onChange={(v) => updateView({ to: v })} placeholder="To (YYYY-MM-DD)" />
            </div>

            {/* Sort row */}
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 p-3">
              <Select
                value={activeView?.sortKey ?? "date"}
                onChange={(v) => updateView({ sortKey: v as any })}
                options={[
                  { value: "date", label: "Sort: Date" },
                  { value: "amount", label: "Sort: Amount" },
                  { value: "title", label: "Sort: Title" },
                  { value: "status", label: "Sort: Status" },
                  { value: "category", label: "Sort: Category" },
                ]}
              />
              <Select
                value={activeView?.sortDir ?? "desc"}
                onChange={(v) => updateView({ sortDir: v as any })}
                options={[
                  { value: "desc", label: "Desc" },
                  { value: "asc", label: "Asc" },
                ]}
              />
              <Select
                value={activeView?.currency ?? "All"}
                onChange={(v) => updateView({ currency: v as any })}
                options={[{ value: "All", label: "Currency: All" }, ...CURRENCIES.map((x) => ({ value: x, label: `Currency: ${x}` }))]}
              />
              <HoverBtn
                variant="outline"
                onClick={() => updateView({ q: "", type: "All", status: "All", category: "All", currency: "All", eventType: "All", from: "", to: "" })}
                title="Clear filters"
              >
                Clear
              </HoverBtn>
            </div>

            {/* Content */}
            <div className="relative p-4">
              {activeView?.layout === "Table" ? (
                <div className="overflow-auto rounded-2xl border border-zinc-200">
                  <table className="min-w-[980px] w-full text-sm">
                    <thead className="bg-zinc-50 text-zinc-700">
                      <tr>
                        {["Title", "Date", "Type", "Status", "Amount", "Category", "Event", "Client/Vendor", "Due", "Actions"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold border-b border-zinc-200">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => (
                        <tr
                          key={t.id}
                          className={cls(
                            "border-b border-zinc-100 transition",
                            selectedId === t.id ? "bg-zinc-50" : "bg-white",
                            "hover:bg-black hover:text-white"
                          )}
                          onClick={() => setSelectedId(t.id)}
                        >
                          <td className="px-3 py-2 font-medium">{t.title}</td>
                          <td className="px-3 py-2">{t.date}</td>
                          <td className="px-3 py-2">{t.type}</td>
                          <td className="px-3 py-2">{t.status}</td>
                          <td className="px-3 py-2">{money(t.amount, t.currency)}</td>
                          <td className="px-3 py-2">{t.category}</td>
                          <td className="px-3 py-2">{t.eventType}</td>
                          <td className="px-3 py-2">{t.clientName || t.vendorName || "-"}</td>
                          <td className="px-3 py-2">{t.dueDate || "-"}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <button
                                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 hover:bg-black hover:text-white hover:border-black"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(t.id);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 hover:bg-black hover:text-white hover:border-black"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateTx(t.id);
                                }}
                              >
                                Duplicate
                              </button>
                              <button
                                className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 hover:bg-black hover:text-white hover:border-black"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm("Delete this transaction?")) removeTx(t.id);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!filtered.length ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-10 text-center text-zinc-500">
                            No rows found. Click <span className="font-semibold">+ Add</span> to create a transaction.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {filtered.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={cls(
                        "text-left rounded-2xl border border-zinc-200 bg-white shadow-sm transition overflow-hidden",
                        "hover:bg-black hover:text-white hover:border-black",
                        selectedId === t.id && "ring-2 ring-black"
                      )}
                    >
                      {/* cover */}
                      <div className="h-24 w-full bg-gradient-to-r from-zinc-100 to-zinc-50" />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-semibold leading-snug">{t.title}</div>
                          <span className={cls("shrink-0 rounded-full border px-2 py-1 text-[11px]", badgeTone(activeView?.colorBy ?? "Status", t))}>
                            {activeView?.colorBy === "Type" ? t.type : activeView?.colorBy === "Category" ? t.category : t.status}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-2">
                            <div className="text-zinc-500">Date</div>
                            <div className="font-medium">{t.date}</div>
                          </div>
                          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-2">
                            <div className="text-zinc-500">Amount</div>
                            <div className="font-medium">{money(t.amount, t.currency)}</div>
                          </div>
                          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-2">
                            <div className="text-zinc-500">Type</div>
                            <div className="font-medium">{t.type}</div>
                          </div>
                          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-2">
                            <div className="text-zinc-500">Category</div>
                            <div className="font-medium">{t.category}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className={cls("rounded-full border px-2 py-1 text-[11px]", badgeToneByType(t.type))}>
                            {t.type}
                          </span>
                          <span className={cls("rounded-full border px-2 py-1 text-[11px]", badgeToneByStatus(t.status))}>
                            {t.status}
                          </span>
                          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-700">
                            {t.eventType}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <span className="text-[12px] text-zinc-600 truncate">
                            {t.clientName ? `Client: ${t.clientName}` : t.vendorName ? `Vendor: ${t.vendorName}` : "—"}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center gap-2">
                          <button
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 hover:bg-white hover:text-zinc-900"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(t.id);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 hover:bg-white hover:text-zinc-900"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateTx(t.id);
                            }}
                          >
                            Duplicate
                          </button>
                          <button
                            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 hover:bg-white hover:text-zinc-900"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Delete this transaction?")) removeTx(t.id);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </button>
                  ))}

                  {!filtered.length ? (
                    <div className="col-span-full rounded-2xl border border-zinc-200 bg-white p-10 text-center text-zinc-500">
                      No cards found. Click <span className="font-semibold">+ Add</span> to create a transaction.
                    </div>
                  ) : null}
                </div>
              )}

              {/* Floating + button like Airtable */}
              <button
                onClick={openAdd}
                className="fixed bottom-7 right-7 h-14 w-14 rounded-full bg-black text-white shadow-xl transition hover:scale-[1.03]"
                title="Add transaction"
              >
                <span className="text-2xl leading-none">+</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={showTxModal}
        title={editingId ? "Edit transaction" : "Add transaction"}
        onClose={() => {
          setShowTxModal(false);
          setEditingId(null);
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <HoverBtn
              variant="outline"
              onClick={() => {
                setShowTxModal(false);
                setEditingId(null);
              }}
            >
              Cancel
            </HoverBtn>
            <HoverBtn onClick={saveTx}>{editingId ? "Save changes" : "Create"}</HoverBtn>
          </div>
        }
      >
        {!form ? null : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Title">
                <Input value={form.title} onChange={(v) => setForm((p) => (p ? { ...p, title: v } : p))} placeholder="Ex: Vendor payment — Decor" />
              </Field>
            </div>

            <Field label="Date">
              <Input value={form.date} onChange={(v) => setForm((p) => (p ? { ...p, date: v } : p))} placeholder="YYYY-MM-DD" />
            </Field>

            <Field label="Due date (optional)">
              <Input value={form.dueDate ?? ""} onChange={(v) => setForm((p) => (p ? { ...p, dueDate: v || undefined } : p))} placeholder="YYYY-MM-DD" />
            </Field>

            <Field label="Type">
              <Select
                value={form.type}
                onChange={(v) => setForm((p) => (p ? { ...p, type: v as TxType } : p))}
                options={TX_TYPES.map((x) => ({ value: x, label: x }))}
              />
            </Field>

            <Field label="Status">
              <Select
                value={form.status}
                onChange={(v) => setForm((p) => (p ? { ...p, status: v as TxStatus } : p))}
                options={TX_STATUSES.map((x) => ({ value: x, label: x }))}
              />
            </Field>

            <Field label="Amount">
              <Input
                value={String(form.amount)}
                onChange={(v) => setForm((p) => (p ? { ...p, amount: parseNum(v, 0) } : p))}
                placeholder="0"
                type="number"
              />
            </Field>

            <Field label="Currency">
              <Select
                value={form.currency}
                onChange={(v) => setForm((p) => (p ? { ...p, currency: v as Currency } : p))}
                options={CURRENCIES.map((x) => ({ value: x, label: x }))}
              />
            </Field>

            <Field label="Category">
              <Select
                value={form.category}
                onChange={(v) => setForm((p) => (p ? { ...p, category: v as TxTag } : p))}
                options={TAGS.map((x) => ({ value: x, label: x }))}
              />
            </Field>

            <Field label="Event type">
              <Select
                value={form.eventType}
                onChange={(v) => setForm((p) => (p ? { ...p, eventType: v as EventType } : p))}
                options={EVENT_TYPES.map((x) => ({ value: x, label: x }))}
              />
            </Field>

            <Field label="Payment method">
              <Select
                value={form.paymentMethod}
                onChange={(v) => setForm((p) => (p ? { ...p, paymentMethod: v as PayMethod } : p))}
                options={METHODS.map((x) => ({ value: x, label: x }))}
              />
            </Field>

            <Field label="Client name (optional)">
              <Input value={form.clientName ?? ""} onChange={(v) => setForm((p) => (p ? { ...p, clientName: v || undefined } : p))} placeholder="Client" />
            </Field>

            <Field label="Vendor name (optional)">
              <Input value={form.vendorName ?? ""} onChange={(v) => setForm((p) => (p ? { ...p, vendorName: v || undefined } : p))} placeholder="Vendor" />
            </Field>

            <div className="md:col-span-2">
              <Field label="Event title (optional)">
                <Input value={form.eventTitle ?? ""} onChange={(v) => setForm((p) => (p ? { ...p, eventTitle: v || undefined } : p))} placeholder="Ex: Wedding — Pal" />
              </Field>
            </div>

            <Field label="Invoice no (optional)">
              <Input value={form.invoiceNo ?? ""} onChange={(v) => setForm((p) => (p ? { ...p, invoiceNo: v || undefined } : p))} placeholder="INV-1001" />
            </Field>

            <Field label="Reference id (optional)">
              <Input value={form.referenceId ?? ""} onChange={(v) => setForm((p) => (p ? { ...p, referenceId: v || undefined } : p))} placeholder="UTR / Txn id" />
            </Field>

            <div className="md:col-span-2">
              <Field label="Notes (optional)">
                <TextArea value={form.notes ?? ""} onChange={(v) => setForm((p) => (p ? { ...p, notes: v || undefined } : p))} placeholder="Extra details..." />
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
