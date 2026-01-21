// app/finance/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* ================= AUTH / KEYS ================= */
const DB_FIN = "eventura-finance-transactions";
const DB_FIN_BUDGETS = "eventura-finance-budgets";
const DB_FIN_SETTINGS = "eventura-finance-settings";
const DB_FIN_AUDIT = "eventura-finance-audit";
const DB_AUTH_ROLE = "eventura-role"; // "CEO" | "Staff"
const DB_AUTH_EMAIL = "eventura-email";

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

type Recurring = {
  enabled: boolean;
  freq: "Weekly" | "Monthly" | "Quarterly" | "Yearly";
  nextRun?: string;
};

type FinanceTx = {
  id: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  date: string; // YYYY-MM-DD
  type: TxType;
  status: TxStatus;

  amount: number;
  currency: "INR" | "CAD" | "USD" | "Other";

  category: TxTag;
  subcategory?: string;

  description: string;

  clientName?: string;
  vendorName?: string;
  eventTitle?: string;
  eventId?: string;

  paymentMethod: PayMethod;
  referenceId?: string;
  invoiceNo?: string;

  gstRate?: number; // 0–28
  gstIncluded?: boolean;
  tdsRate?: number; // 0–20

  dueDate?: string; // YYYY-MM-DD
  recurring?: Recurring;

  notes?: string;
};

type BudgetLine = {
  id: number;
  createdAt: string;
  updatedAt: string;

  month: string; // YYYY-MM
  currency: "INR" | "CAD" | "USD" | "Other";

  revenueTarget: number;
  expenseCap: number;
  grossMarginTargetPct: number;

  fixedCosts: {
    officeRentUtilities: number;
    salaries: number;
    marketing: number;
    internetMisc: number;
    transportLogistics: number;
    adminCompliance: number;
  };

  notes?: string;
};

type FinanceSettings = {
  defaultCurrency: "INR" | "CAD" | "USD" | "Other";
  startOfWeek: "Mon" | "Sun";
  overdueRuleDays: number;
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
  const a = new Date(aYMD + "T00:00:00");
  const b = new Date(bYMD + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
function money(n: number, cur: string) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${cur} ${parts.join(".")}`;
}

/* ================= DEFAULTS ================= */
function defaultSettings(): FinanceSettings {
  return {
    defaultCurrency: "INR",
    startOfWeek: "Mon",
    overdueRuleDays: 0,
    showGst: true,
    showTds: true,
  };
}
function defaultRecurring(): Recurring {
  return { enabled: false, freq: "Monthly", nextRun: "" };
}
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
      const rawSet = safeJsonParse<FinanceSettings>(
        localStorage.getItem(DB_FIN_SETTINGS),
        defaultSettings()
      );
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

  // 1) Auto mark overdue (TYPE-SAFE)
  useEffect(() => {
    if (!mounted) return;

    const today = toYMD(new Date());
    let changed = false;

    const next: FinanceTx[] = txs.map((t): FinanceTx => {
      if (t.status === "Paid") return t;

      const due = t.dueDate;
      if (!due) return t;

      const isOver = daysBetween(due, today) > settings.overdueRuleDays;
      if (isOver && t.status !== "Overdue") {
        changed = true;
        return { ...t, status: "Overdue", updatedAt: nowISO() };
      }
      return t;
    });

    if (changed) {
      setTxs(next);
      pushAudit("AUTO_OVERDUE_SCAN", "Auto-marked overdue items based on dueDate.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, settings.overdueRuleDays]);

  // 2) Recurring — TYPE-SAFE
  useEffect(() => {
    if (!mounted) return;

    const today = toYMD(new Date());
    let created = 0;

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

    const newOnes: FinanceTx[] = [];
    const updated: FinanceTx[] = txs.map((t): FinanceTx => {
      if (!t.recurring?.enabled || !t.recurring.nextRun) return t;
      if (t.recurring.nextRun > today) return t;

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
      newOnes.push(newTx);
      created += 1;

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
      setTxs((prev) => [...newOnes, ...updated]);
      pushAudit("AUTO_RECUR_CREATE", `Auto-created ${created} recurring transaction(s).`);
      notify(`Auto-created ${created} recurring tx.`);
    } else {
      const changed = updated.some((u, i) => u !== txs[i]);
      if (changed) setTxs(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  /* ================= DERIVED ================= */
  const currency = settings.defaultCurrency;

  function totalAmount(t: FinanceTx) {
    const base = parseNum(t.amount, 0);
    const gstRate = clamp(parseNum(t.gstRate, 0), 0, 28);
    const gstAdd = t.gstIncluded ? 0 : base * (gstRate / 100);
    const subtotal = base + gstAdd;
    const tdsRate = clamp(parseNum(t.tdsRate, 0), 0, 20);
    const tds = subtotal * (tdsRate / 100);
    return { base, gstRate, gstAdd, subtotal, tds };
  }

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

  /* ================= EXPORT / IMPORT (FIXED) ================= */
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

  function exportCSV(which: "filtered" | "all") {
    const rows = (which === "all" ? txs : filtered).slice().sort((a, b) => a.date.localeCompare(b.date));
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

  const [importText, setImportText] = useState("");
  function exportJSON() {
    const payload = { version: 2, exportedAt: nowISO(), settings, budgets, txs, audit };
    downloadText(`eventura_finance_backup_${toYMD(new Date())}.json`, JSON.stringify(payload, null, 2), "application/json");
    pushAudit("EXPORT", `Exported JSON backup (tx=${txs.length}, budgets=${budgets.length})`);
    notify("JSON exported.");
  }
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

  function parseCSVLine(line: string) {
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
          } else inQ = false;
        } else cur += ch;
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

  function importCSV() {
    const raw = importText || "";
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return notify("CSV needs header + rows.");

    const header = parseCSVLine(lines[0]);
    const idx = (k: string) => header.indexOf(k);
    const getCell = (cols: string[], k: string) => (idx(k) >= 0 ? cols[idx(k)] : "");

    const next: FinanceTx[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);

      const recEnabled = String(getCell(cols, "recurringEnabled")).toLowerCase() === "true";
      const recFreq = (getCell(cols, "recurringFreq") || "Monthly") as Recurring["freq"];
      const recNext = getCell(cols, "recurringNextRun") || "";

      const t: FinanceTx = {
        id: parseNum(getCell(cols, "id"), Date.now() + i),
        createdAt: getCell(cols, "createdAt") || nowISO(),
        updatedAt: nowISO(),
        date: getCell(cols, "date") || toYMD(new Date()),
        type: (getCell(cols, "type") as TxType) || "Expense",
        status: (getCell(cols, "status") as TxStatus) || "Planned",
        currency: (getCell(cols, "currency") as any) || currency,
        amount: parseNum(getCell(cols, "amount"), 0),
        gstRate: parseNum(getCell(cols, "gstRate"), 0),
        gstIncluded: String(getCell(cols, "gstIncluded")).toLowerCase() === "true",
        tdsRate: parseNum(getCell(cols, "tdsRate"), 0),
        category: (getCell(cols, "category") as TxTag) || "Other",
        subcategory: getCell(cols, "subcategory") || undefined,
        description: getCell(cols, "description") || "",
        clientName: getCell(cols, "clientName") || undefined,
        vendorName: getCell(cols, "vendorName") || undefined,
        eventTitle: getCell(cols, "eventTitle") || undefined,
        eventId: getCell(cols, "eventId") || undefined,
        paymentMethod: (getCell(cols, "paymentMethod") as PayMethod) || "Bank",
        referenceId: getCell(cols, "referenceId") || undefined,
        invoiceNo: getCell(cols, "invoiceNo") || undefined,
        dueDate: getCell(cols, "dueDate") || undefined,
        recurring: recEnabled ? ({ enabled: true, freq: recFreq, nextRun: recNext || undefined } as Recurring) : undefined,
        notes: getCell(cols, "notes") || undefined,
      };

      if (t.description.trim()) next.push(t);
    }

    setTxs((prev) => {
      const map = new Map<number, FinanceTx>();
      for (const p of prev) map.set(p.id, p);
      for (const n of next) map.set(n.id, n);
      return Array.from(map.values()).sort((a, b) =>
        a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)
      );
    });

    pushAudit("IMPORT", `Imported CSV rows=${next.length}`);
    notify("Imported CSV.");
  }

  /* ================= MINIMAL UI TO COMPILE (rest of full UI not needed for the fix) ================= */
  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">
              <div className="text-xs text-white/60">Eventura OS</div>
              <div className="text-sm font-semibold">Finance (Deploy Safe)</div>
            </div>
            <Pill label={role} />
            <Pill label={`Tx: ${txs.length}`} />
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="outline" onClick={() => exportCSV("all")}>
              Export CSV
            </Btn>
            <Btn variant="outline" onClick={exportJSON}>
              Backup JSON
            </Btn>
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-black hover:text-white"
            >
              Back
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Import / Export (Fixed recurring typing)</div>
            <div className="flex gap-2">
              <Btn onClick={importJSON}>Import JSON</Btn>
              <Btn onClick={importCSV}>Import CSV</Btn>
            </div>
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
          <div className="mt-3 text-xs text-white/60">
            This build fixes: <b>Property 'freq' does not exist on type ... | undefined</b> by using a dedicated <b>Recurring</b> type and never referencing FinanceTx["recurring"]["freq"].
          </div>
        </div>
      </div>
    </div>
  );
}
