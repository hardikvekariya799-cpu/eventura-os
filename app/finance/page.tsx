// app/finance/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

/* =========================
   Local Storage Keys
========================= */
const LS_TX = "eventura_fin_tx_os_v1";
const LS_VIEW = "eventura_fin_view_os_v1";

/* =========================
   Types
========================= */
type TxType = "Income" | "Expense";
type TxStatus = "Planned" | "Pending" | "Paid" | "Overdue" | "Cancelled";
type Currency = "INR" | "CAD" | "USD" | "Other";

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

  category: string;
  eventTitle?: string;

  clientName?: string;
  vendorName?: string;

  dueDate?: string; // for AR/AP + overdue
  notes?: string;
};

type LayoutMode = "Gallery" | "Table";

/* =========================
   Helpers
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
function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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
function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function toneStatus(s: TxStatus) {
  if (s === "Paid") return "good";
  if (s === "Overdue") return "bad";
  if (s === "Pending") return "warn";
  if (s === "Cancelled") return "muted";
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
function isOverdue(tx: FinanceTx, todayYMD: string) {
  if (!tx.dueDate) return false;
  if (tx.status === "Paid" || tx.status === "Cancelled") return false;
  return tx.dueDate < todayYMD;
}

/* =========================
   UI bits
========================= */
function Btn({
  children,
  onClick,
  variant = "primary",
  className,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
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

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "neutral" | "good" | "bad" | "warn" | "muted";
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

function Card({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-black hover:border-white/15">
      <div className="text-xs font-semibold tracking-wide text-white/60">{title}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
      {sub ? <div className="mt-1 text-xs text-white/55">{sub}</div> : null}
    </div>
  );
}

function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
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
        <div className="max-h-[74vh] overflow-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-white/10 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

/* =========================
   Page
========================= */
export default function FinancePage() {
  const todayYMD = useMemo(() => toYMD(new Date()), []);
  const [month, setMonth] = useState<string>(() => toYM(new Date()));

  const [txs, setTxs] = useState<FinanceTx[]>([]);
  const [layout, setLayout] = useState<LayoutMode>("Gallery");

  // Filters
  const [q, setQ] = useState("");
  const [type, setType] = useState<TxType | "All">("All");
  const [status, setStatus] = useState<TxStatus | "All">("All");
  const [category, setCategory] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Add/Edit modal
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [fTitle, setFTitle] = useState("");
  const [fDate, setFDate] = useState(todayYMD);
  const [fType, setFType] = useState<TxType>("Expense");
  const [fStatus, setFStatus] = useState<TxStatus>("Planned");
  const [fAmount, setFAmount] = useState<string>("0");
  const [fCurrency, setFCurrency] = useState<Currency>("INR");
  const [fCategory, setFCategory] = useState("Other");
  const [fEventTitle, setFEventTitle] = useState("");
  const [fClient, setFClient] = useState("");
  const [fVendor, setFVendor] = useState("");
  const [fDue, setFDue] = useState("");
  const [fNotes, setFNotes] = useState("");

  // Load
  useEffect(() => {
    const stored = safeParse<FinanceTx[]>(localStorage.getItem(LS_TX), []);
    setTxs(Array.isArray(stored) ? stored : []);
    const view = safeParse<{ layout?: LayoutMode; month?: string }>(
      localStorage.getItem(LS_VIEW),
      {}
    );
    if (view.layout) setLayout(view.layout);
    if (view.month) setMonth(view.month);
  }, []);

  // Persist view
  useEffect(() => {
    localStorage.setItem(LS_VIEW, JSON.stringify({ layout, month }));
  }, [layout, month]);

  // Persist tx
  useEffect(() => {
    localStorage.setItem(LS_TX, JSON.stringify(txs));
  }, [txs]);

  const categories = useMemo(() => {
    const set = new Set<string>(["Other"]);
    txs.forEach((t) => set.add(t.category || "Other"));
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [txs]);

  const filtered = useMemo(() => {
    const mStart = `${month}-01`;
    const mEnd = `${month}-31`;

    return txs
      .filter((t) => t.date >= mStart && t.date <= mEnd)
      .filter((t) => (q.trim() ? `${t.title} ${t.category} ${t.clientName ?? ""} ${t.vendorName ?? ""} ${t.eventTitle ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()) : true))
      .filter((t) => (type === "All" ? true : t.type === type))
      .filter((t) => (status === "All" ? true : t.status === status))
      .filter((t) => (category === "All" ? true : (t.category || "Other") === category))
      .filter((t) => (from ? t.date >= from : true))
      .filter((t) => (to ? t.date <= to : true))
      .map((t) => {
        const overdue = isOverdue(t, todayYMD);
        return overdue ? { ...t, status: "Overdue" as TxStatus } : t;
      })
      .sort((a, b) => (a.date === b.date ? b.updatedAt.localeCompare(a.updatedAt) : b.date.localeCompare(a.date)));
  }, [txs, month, q, type, status, category, from, to, todayYMD]);

  const kpis = useMemo(() => {
    const inrIncome = filtered.filter((t) => t.type === "Income").reduce((s, t) => s + (t.currency === "INR" ? t.amount : 0), 0);
    const inrExpense = filtered.filter((t) => t.type === "Expense").reduce((s, t) => s + (t.currency === "INR" ? t.amount : 0), 0);
    const net = inrIncome - inrExpense;

    // Simple AR/AP (INR only): Pending/Overdue Income = AR, Pending/Overdue Expense = AP
    const ar = filtered
      .filter((t) => t.type === "Income" && (t.status === "Pending" || t.status === "Overdue") && t.currency === "INR")
      .reduce((s, t) => s + t.amount, 0);

    const ap = filtered
      .filter((t) => t.type === "Expense" && (t.status === "Pending" || t.status === "Overdue") && t.currency === "INR")
      .reduce((s, t) => s + t.amount, 0);

    const overdueCount = filtered.filter((t) => t.status === "Overdue").length;

    return { inrIncome, inrExpense, net, ar, ap, overdueCount };
  }, [filtered]);

  function resetForm() {
    setEditingId(null);
    setFTitle("");
    setFDate(todayYMD);
    setFType("Expense");
    setFStatus("Planned");
    setFAmount("0");
    setFCurrency("INR");
    setFCategory("Other");
    setFEventTitle("");
    setFClient("");
    setFVendor("");
    setFDue("");
    setFNotes("");
  }

  function openAdd() {
    resetForm();
    setOpen(true);
  }

  function openEdit(tx: FinanceTx) {
    setEditingId(tx.id);
    setFTitle(tx.title);
    setFDate(tx.date);
    setFType(tx.type);
    setFStatus(tx.status);
    setFAmount(String(tx.amount));
    setFCurrency(tx.currency);
    setFCategory(tx.category || "Other");
    setFEventTitle(tx.eventTitle || "");
    setFClient(tx.clientName || "");
    setFVendor(tx.vendorName || "");
    setFDue(tx.dueDate || "");
    setFNotes(tx.notes || "");
    setOpen(true);
  }

  function saveTx() {
    const amt = Number(String(fAmount).replace(/,/g, "").trim());
    const amount = Number.isFinite(amt) ? amt : 0;

    const base: FinanceTx = {
      id: editingId ?? `tx_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`,
      createdAt: editingId ? txs.find((t) => t.id === editingId)?.createdAt ?? nowISO() : nowISO(),
      updatedAt: nowISO(),
      title: fTitle.trim() || "Untitled",
      date: fDate || todayYMD,
      type: fType,
      status: fStatus,
      amount,
      currency: fCurrency,
      category: fCategory.trim() || "Other",
      eventTitle: fEventTitle.trim() || undefined,
      clientName: fClient.trim() || undefined,
      vendorName: fVendor.trim() || undefined,
      dueDate: fDue || undefined,
      notes: fNotes.trim() || undefined,
    };

    setTxs((prev) => {
      const idx = prev.findIndex((t) => t.id === base.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = base;
        return copy;
      }
      return [base, ...prev];
    });

    setOpen(false);
  }

  function deleteTx(id: string) {
    setTxs((prev) => prev.filter((t) => t.id !== id));
  }

  function exportCSV() {
    const headers = [
      "id",
      "date",
      "title",
      "type",
      "status",
      "amount",
      "currency",
      "category",
      "eventTitle",
      "clientName",
      "vendorName",
      "dueDate",
      "notes",
      "createdAt",
      "updatedAt",
    ];
    const rows = filtered.map((t) =>
      headers
        .map((h) => escCSV((t as any)[h]))
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    downloadText(`eventura_finance_${month}.csv`, csv, "text/csv;charset=utf-8");
  }

  // "Excel" export without libs: HTML table that Excel opens fine.
  function exportExcel() {
    const cols = [
      "Date",
      "Title",
      "Type",
      "Status",
      "Amount",
      "Currency",
      "Category",
      "Event",
      "Client",
      "Vendor",
      "Due",
      "Notes",
    ];
    const body = filtered
      .map(
        (t) => `<tr>
<td>${t.date}</td>
<td>${(t.title ?? "").replace(/</g, "&lt;")}</td>
<td>${t.type}</td>
<td>${t.status}</td>
<td>${t.amount}</td>
<td>${t.currency}</td>
<td>${(t.category ?? "").replace(/</g, "&lt;")}</td>
<td>${(t.eventTitle ?? "").replace(/</g, "&lt;")}</td>
<td>${(t.clientName ?? "").replace(/</g, "&lt;")}</td>
<td>${(t.vendorName ?? "").replace(/</g, "&lt;")}</td>
<td>${(t.dueDate ?? "").replace(/</g, "&lt;")}</td>
<td>${(t.notes ?? "").replace(/</g, "&lt;")}</td>
</tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body>
<table border="1">
<thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
<tbody>${body}</tbody>
</table>
</body>
</html>`;

    downloadText(
      `eventura_finance_${month}.xls`,
      html,
      "application/vnd.ms-excel;charset=utf-8"
    );
  }

  function importDemo() {
    const demo: FinanceTx[] = [
      {
        id: `tx_demo_${Date.now().toString(36)}_1`,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        title: "Client Advance - Wedding",
        date: `${month}-05`,
        type: "Income",
        status: "Paid",
        amount: 150000,
        currency: "INR",
        category: "ClientAdvance",
        eventTitle: "Vesu Wedding",
        clientName: "Client A",
        dueDate: "",
        notes: "Advance received",
      },
      {
        id: `tx_demo_${Date.now().toString(36)}_2`,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        title: "Vendor Payment - Decor",
        date: `${month}-10`,
        type: "Expense",
        status: "Pending",
        amount: 60000,
        currency: "INR",
        category: "VendorPayment",
        eventTitle: "Vesu Wedding",
        vendorName: "Decor Vendor",
        dueDate: `${month}-15`,
        notes: "Pay after final setup",
      },
    ];
    setTxs((prev) => [...demo, ...prev]);
  }

  return (
    <div className="space-y-4">
      {/* Title + Actions */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-xl font-semibold text-white">Finance Control Center</div>
            <div className="mt-1 text-sm text-white/60">
              Transactions • Views • Import/Export • Reports-style KPIs • Black Hover • Deploy Safe
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Btn onClick={exportExcel} variant="outline">Export Excel</Btn>
            <Btn onClick={exportCSV} variant="outline">Export CSV</Btn>
            <Btn onClick={importDemo} variant="outline">Import Demo</Btn>
            <Btn onClick={openAdd}>+ Add</Btn>
          </div>
        </div>

        {/* Month + Layout */}
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1 text-xs font-semibold text-white/60">Month</div>
            <Input value={month} onChange={setMonth} placeholder="YYYY-MM" type="month" />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-white/60">Layout</div>
            <Select
              value={layout}
              onChange={(v) => setLayout(v as LayoutMode)}
              options={[
                { value: "Gallery", label: "Gallery" },
                { value: "Table", label: "Table" },
              ]}
            />
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
            <div className="text-xs font-semibold text-white/70">Current view</div>
            <div className="mt-1 text-sm text-white/90">Finance board</div>
            <div className="mt-1 text-xs text-white/55">
              Rows: <span className="text-white/80">{filtered.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <Card title="Income (INR)" value={money(kpis.inrIncome, "INR")} sub={month} />
        <Card title="Expense (INR)" value={money(kpis.inrExpense, "INR")} sub={month} />
        <Card title="Net (INR)" value={money(kpis.net, "INR")} sub="Income - Expense" />
        <Card title="AR (INR)" value={money(kpis.ar, "INR")} sub="Pending/Overdue Income" />
        <Card title="AP (INR)" value={money(kpis.ap, "INR")} sub={`Overdue count: ${kpis.overdueCount}`} />
      </div>

      {/* Views + Filters */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Views</div>
            <Pill tone="muted">Manage</Pill>
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-3">
            <div className="text-sm text-white/90">Finance board</div>
            <div className="mt-1 text-xs text-white/55">
              Default board view • Layout: <span className="text-white/80">{layout}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">Filters</div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Input value={q} onChange={setQ} placeholder="Search..." />
            </div>

            <div>
              <Select
                value={type}
                onChange={(v) => setType(v as any)}
                options={[
                  { value: "All", label: "Type: All" },
                  { value: "Income", label: "Income" },
                  { value: "Expense", label: "Expense" },
                ]}
              />
            </div>

            <div>
              <Select
                value={status}
                onChange={(v) => setStatus(v as any)}
                options={[
                  { value: "All", label: "Status: All" },
                  { value: "Planned", label: "Planned" },
                  { value: "Pending", label: "Pending" },
                  { value: "Paid", label: "Paid" },
                  { value: "Overdue", label: "Overdue" },
                  { value: "Cancelled", label: "Cancelled" },
                ]}
              />
            </div>

            <div>
              <Select
                value={category}
                onChange={setCategory}
                options={categories.map((c) => ({ value: c, label: `Category: ${c}` }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input value={from} onChange={setFrom} placeholder="From (yyyy-mm-dd)" type="date" />
              <Input value={to} onChange={setTo} placeholder="To (yyyy-mm-dd)" type="date" />
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Btn
                variant="ghost"
                onClick={() => {
                  setQ("");
                  setType("All");
                  setStatus("All");
                  setCategory("All");
                  setFrom("");
                  setTo("");
                }}
              >
                Clear filters
              </Btn>
              <Btn variant="outline" onClick={() => setLayout("Gallery")}>Gallery</Btn>
              <Btn variant="outline" onClick={() => setLayout("Table")}>Table</Btn>
            </div>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-semibold text-white">Finance board</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            <span>Sort: Date</span>
            <span className="text-white/35">•</span>
            <span>Desc</span>
            <span className="text-white/35">•</span>
            <span>Layout: {layout}</span>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-6 text-center">
            <div className="text-sm text-white/80">No rows found.</div>
            <div className="mt-1 text-xs text-white/55">
              Click <span className="text-white/80">+ Add</span> to create a transaction.
            </div>
          </div>
        ) : layout === "Gallery" ? (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((t) => (
              <div
                key={t.id}
                className={cls(
                  "rounded-2xl border border-white/10 bg-black/40 p-4 transition",
                  "hover:bg-black hover:border-white/15"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{t.title}</div>
                    <div className="mt-1 text-xs text-white/55">
                      {t.date} • {t.type} • {t.category || "Other"}
                    </div>
                  </div>
                  <Pill tone={toneStatus(t.status)}>{t.status}</Pill>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-lg font-semibold text-white">{money(t.amount, t.currency)}</div>
                  <div className="flex items-center gap-2">
                    <Btn variant="ghost" onClick={() => openEdit(t)}>Edit</Btn>
                    <Btn variant="danger" onClick={() => deleteTx(t.id)}>Delete</Btn>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/60">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                    <div className="text-white/45">Event</div>
                    <div className="truncate text-white/80">{t.eventTitle || "—"}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                    <div className="text-white/45">Client/Vendor</div>
                    <div className="truncate text-white/80">
                      {t.clientName || t.vendorName || "—"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                    <div className="text-white/45">Due</div>
                    <div className="truncate text-white/80">{t.dueDate || "—"}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                    <div className="text-white/45">Updated</div>
                    <div className="truncate text-white/80">
                      {new Date(t.updatedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {t.notes ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2 text-xs text-white/70">
                    {t.notes}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-black/60">
                  <tr className="text-left text-xs text-white/60">
                    {["Date", "Title", "Type", "Status", "Amount", "Category", "Event", "Client/Vendor", "Due", "Actions"].map(
                      (h) => (
                        <th key={h} className="border-b border-white/10 px-3 py-3 font-semibold">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-white/10 bg-black/30 transition hover:bg-black"
                    >
                      <td className="px-3 py-3 text-white/85">{t.date}</td>
                      <td className="px-3 py-3 text-white">{t.title}</td>
                      <td className="px-3 py-3 text-white/85">{t.type}</td>
                      <td className="px-3 py-3">
                        <Pill tone={toneStatus(t.status)}>{t.status}</Pill>
                      </td>
                      <td className="px-3 py-3 text-white/90">{money(t.amount, t.currency)}</td>
                      <td className="px-3 py-3 text-white/85">{t.category || "Other"}</td>
                      <td className="px-3 py-3 text-white/70">{t.eventTitle || "—"}</td>
                      <td className="px-3 py-3 text-white/70">
                        {t.clientName || t.vendorName || "—"}
                      </td>
                      <td className="px-3 py-3 text-white/70">{t.dueDate || "—"}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Btn variant="ghost" onClick={() => openEdit(t)}>Edit</Btn>
                          <Btn variant="danger" onClick={() => deleteTx(t.id)}>Delete</Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={open}
        title={editingId ? "Edit transaction" : "Add transaction"}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn onClick={saveTx}>{editingId ? "Save changes" : "Add transaction"}</Btn>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-semibold text-white/60">Title</div>
            <Input value={fTitle} onChange={setFTitle} placeholder="e.g., Vendor Payment - Decor" />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-white/60">Date</div>
            <Input value={fDate} onChange={setFDate} type="date" />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-white/60">Due date (optional)</div>
            <Input value={fDue} onChange={setFDue} type="date" />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-white/60">Type</div>
            <Select
              value={fType}
              onChange={(v) => setFType(v as TxType)}
              options={[
                { value: "Income", label: "Income" },
                { value: "Expense", label: "Expense" },
              ]}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-white/60">Status</div>
            <Select
              value={fStatus}
              onChange={(v) => setFStatus(v as TxStatus)}
              options={[
                { value: "Planned", label: "Planned" },
                { value: "Pending", label: "Pending" },
                { value: "Paid", label: "Paid" },
                { value: "Overdue", label: "Overdue" },
                { value: "Cancelled", label: "Cancelled" },
              ]}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-white/60">Amount</div>
            <Input value={fAmount} onChange={setFAmount} placeholder="0" />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-white/60">Currency</div>
            <Select
              value={fCurrency}
              onChange={(v) => setFCurrency(v as Currency)}
              options={[
                { value: "INR", label: "INR" },
                { value: "CAD", label: "CAD" },
                { value: "USD", label: "USD" },
                { value: "Other", label: "Other" },
              ]}
            />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-white/60">Category</div>
            <Input value={fCategory} onChange={setFCategory} placeholder="e.g., VendorPayment / Salary" />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-white/60">Event title (optional)</div>
            <Input value={fEventTitle} onChange={setFEventTitle} placeholder="e.g., Vesu Wedding" />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-white/60">Client name (optional)</div>
            <Input value={fClient} onChange={setFClient} placeholder="Client" />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-white/60">Vendor name (optional)</div>
            <Input value={fVendor} onChange={setFVendor} placeholder="Vendor" />
          </div>

          <div className="md:col-span-2">
            <div className="mb-1 text-xs font-semibold text-white/60">Notes (optional)</div>
            <textarea
              value={fNotes}
              onChange={(e) => setFNotes(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-white/15 bg-black/50 p-3 text-sm text-white outline-none transition hover:border-white/25 focus:border-white/30"
              placeholder="Add internal notes, reference, payment conditions..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
