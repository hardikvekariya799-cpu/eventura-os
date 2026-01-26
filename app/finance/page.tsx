// app/finance/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* =========================
   STORAGE KEYS
========================= */
const DB_FIN = "eventura-finance-transactions";
const DB_FIN_BUDGETS = "eventura-finance-budgets";
const DB_FIN_SETTINGS = "eventura-finance-settings";
const DB_FIN_AUDIT = "eventura-finance-audit";
const DB_AUTH_ROLE = "eventura-role"; // "CEO" | "Staff"
const DB_AUTH_EMAIL = "eventura-email";

/* =========================
   TYPES (STRICT + DEPLOY-SAFE)
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

type RecurringFreq = "Weekly" | "Monthly" | "Quarterly" | "Yearly";
type Recurring = { enabled: boolean; freq: RecurringFreq; nextRun?: string };

type FinanceTx = {
  id: number;
  createdAt: string;
  updatedAt: string;

  date: string; // YYYY-MM-DD
  type: TxType;
  status: TxStatus;

  amount: number;
  currency: Currency;

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

  gstRate?: number;
  gstIncluded?: boolean;

  tdsRate?: number;
  dueDate?: string;

  recurring?: Recurring;

  notes?: string;
};

type BudgetLine = {
  id: number;
  createdAt: string;
  updatedAt: string;

  month: string; // YYYY-MM
  currency: Currency;

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
  defaultCurrency: Currency;
  overdueRuleDays: number;
  showGst: boolean;
  showTds: boolean;
  lockStaffEdits: boolean;
};

type AuditAction =
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

type AuditItem = {
  id: number;
  at: string;
  actorRole: Role;
  actorEmail?: string;
  action: AuditAction;
  details: string;
};

/* =========================
   CONSTANTS + COERCION
========================= */
const TX_STATUSES: TxStatus[] = ["Planned", "Pending", "Paid", "Overdue", "Cancelled"];
const TX_TYPES: TxType[] = ["Income", "Expense"];
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
const RECUR_FREQS: RecurringFreq[] = ["Weekly", "Monthly", "Quarterly", "Yearly"];

function asRole(v: any): Role {
  return String(v).toUpperCase() === "STAFF" ? "Staff" : "CEO";
}
function asTxType(v: any): TxType {
  return TX_TYPES.includes(v) ? v : "Expense";
}
function asTxStatus(v: any): TxStatus {
  return TX_STATUSES.includes(v) ? v : "Planned";
}
function asCurrency(v: any, fallback: Currency): Currency {
  return CURRENCIES.includes(v) ? v : fallback;
}
function asMethod(v: any): PayMethod {
  return METHODS.includes(v) ? v : "Bank";
}
function asTag(v: any): TxTag {
  return TAGS.includes(v) ? v : "Other";
}
function asRecurring(v: any): Recurring | undefined {
  if (!v || typeof v !== "object") return undefined;
  const enabled = (v as any).enabled === true || String((v as any).enabled).toLowerCase() === "true";
  if (!enabled) return undefined;
  const freq = RECUR_FREQS.includes((v as any).freq) ? (v as any).freq : "Monthly";
  const nextRun = typeof (v as any).nextRun === "string" ? (v as any).nextRun : undefined;
  return { enabled: true, freq, nextRun };
}

/* =========================
   UTIL
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
function money(n: number, cur: string) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const parts = abs.toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${cur} ${parts.join(".")}`;
}
function daysBetween(aYMD: string, bYMD: string) {
  const a = new Date(aYMD + "T00:00:00");
  const b = new Date(bYMD + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
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

function defaultSettings(): FinanceSettings {
  return {
    defaultCurrency: "INR",
    overdueRuleDays: 0,
    showGst: true,
    showTds: true,
    lockStaffEdits: true,
  };
}
function defaultBudgetLine(month: string, currency: Currency): BudgetLine {
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

function normalizeTx(raw: any, defaultCurrency: Currency): FinanceTx | null {
  if (!raw || typeof raw !== "object") return null;
  const id = parseNum((raw as any).id, 0);
  if (!id) return null;

  const date = typeof (raw as any).date === "string" && (raw as any).date ? (raw as any).date : toYMD(new Date());
  const tx: FinanceTx = {
    id,
    createdAt: typeof (raw as any).createdAt === "string" ? (raw as any).createdAt : nowISO(),
    updatedAt: typeof (raw as any).updatedAt === "string" ? (raw as any).updatedAt : nowISO(),

    date,
    type: asTxType((raw as any).type),
    status: asTxStatus((raw as any).status),

    amount: parseNum((raw as any).amount, 0),
    currency: asCurrency((raw as any).currency, defaultCurrency),

    category: asTag((raw as any).category),
    subcategory: typeof (raw as any).subcategory === "string" ? (raw as any).subcategory : undefined,

    description: String((raw as any).description ?? ""),

    clientName: typeof (raw as any).clientName === "string" ? (raw as any).clientName : undefined,
    vendorName: typeof (raw as any).vendorName === "string" ? (raw as any).vendorName : undefined,
    eventTitle: typeof (raw as any).eventTitle === "string" ? (raw as any).eventTitle : undefined,
    eventId: typeof (raw as any).eventId === "string" ? (raw as any).eventId : undefined,

    paymentMethod: asMethod((raw as any).paymentMethod),
    referenceId: typeof (raw as any).referenceId === "string" ? (raw as any).referenceId : undefined,
    invoiceNo: typeof (raw as any).invoiceNo === "string" ? (raw as any).invoiceNo : undefined,

    gstRate: (raw as any).gstRate == null ? undefined : clamp(parseNum((raw as any).gstRate, 0), 0, 28),
    gstIncluded: typeof (raw as any).gstIncluded === "boolean" ? (raw as any).gstIncluded : undefined,

    tdsRate: (raw as any).tdsRate == null ? undefined : clamp(parseNum((raw as any).tdsRate, 0), 0, 20),
    dueDate: typeof (raw as any).dueDate === "string" ? (raw as any).dueDate : undefined,

    recurring: asRecurring((raw as any).recurring),

    notes: typeof (raw as any).notes === "string" ? (raw as any).notes : undefined,
  };

  return tx;
}

function calcTotals(t: FinanceTx) {
  const base = parseNum(t.amount, 0);
  const gstRate = clamp(parseNum(t.gstRate, 0), 0, 28);
  const gstAdd = t.gstIncluded ? 0 : base * (gstRate / 100);
  const subtotal = base + gstAdd;
  const tdsRate = clamp(parseNum(t.tdsRate, 0), 0, 20);
  const tds = subtotal * (tdsRate / 100);
  const net = subtotal - tds;
  return { base, gstRate, gstAdd, subtotal, tdsRate, tds, net };
}

/* =========================
   UI ATOMS (REAL APP LOOK)
========================= */
function Card({ title, right, children }: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-xs text-white/60">{right}</div>
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </div>
  );
}
function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 hover:bg-black/50 transition">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white tracking-tight">{value}</div>
      {sub ? <div className="mt-1 text-xs text-white/45">{sub}</div> : null}
    </div>
  );
}
function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "bad" | "warn" }) {
  const m =
    tone === "good"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
      : tone === "bad"
      ? "border-rose-400/25 bg-rose-400/10 text-rose-200"
      : tone === "warn"
      ? "border-amber-400/25 bg-amber-400/10 text-amber-200"
      : "border-white/15 bg-white/5 text-white/80";
  return <span className={cls("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]", m)}>{children}</span>;
}
function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const base = "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm transition border select-none";
  const v =
    variant === "primary"
      ? "border-white/15 bg-white/10 text-white hover:bg-black hover:border-white/25"
      : variant === "outline"
      ? "border-white/20 bg-transparent text-white/90 hover:bg-black"
      : variant === "danger"
      ? "border-rose-400/35 bg-rose-400/10 text-rose-200 hover:bg-black hover:border-rose-400/60"
      : "border-transparent bg-transparent text-white/80 hover:bg-black hover:text-white";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls(base, v, disabled && "opacity-50 pointer-events-none")}>
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
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-[#0b0b0b] shadow-2xl">
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
   CHARTS (NO LIBS)
========================= */
function SparkBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values.map((v) => Math.abs(v)));
  return (
    <div className="flex h-10 items-end gap-1">
      {values.map((v, i) => {
        const h = clamp((Math.abs(v) / max) * 100, 4, 100);
        const pos = v >= 0;
        return (
          <div
            key={i}
            title={String(v)}
            className={cls("w-2 rounded-sm", pos ? "bg-white/40" : "bg-white/20")}
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}
function ProgressRow({ label, value, max, right }: { label: string; value: number; max: number; right: string }) {
  const pct = max <= 0 ? 0 : clamp((value / max) * 100, 0, 100);
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="flex items-center justify-between text-xs text-white/65">
        <span>{label}</span>
        <span className="text-white/80">{right}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-white/35" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* =========================
   PAGE
========================= */
type Tab = "Dashboard" | "Transactions" | "Budgets" | "AR/AP" | "Reports" | "Import/Export" | "Audit" | "Settings";

export default function FinancePage() {
  const [mounted, setMounted] = useState(false);

  const [role, setRole] = useState<Role>("CEO");
  const [email, setEmail] = useState<string>("");

  const [txs, setTxs] = useState<FinanceTx[]>([]);
  const [budgets, setBudgets] = useState<BudgetLine[]>([]);
  const [settings, setSettings] = useState<FinanceSettings>(defaultSettings());
  const [audit, setAudit] = useState<AuditItem[]>([]);

  const [tab, setTab] = useState<Tab>("Dashboard");
  const [toast, setToast] = useState("");
  const toastRef = useRef<number | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [fType, setFType] = useState<TxType | "All">("All");
  const [fStatus, setFStatus] = useState<TxStatus | "All">("All");
  const [fCategory, setFCategory] = useState<TxTag | "All">("All");
  const [fCur, setFCur] = useState<Currency | "All">("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // selection
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const selectedIds = useMemo(
    () => Object.keys(selected).filter((k) => selected[Number(k)]).map((k) => Number(k)),
    [selected]
  );

  // modals
  const [openTxModal, setOpenTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<FinanceTx | null>(null);

  const [openBudgetModal, setOpenBudgetModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetLine | null>(null);

  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [invoiceTx, setInvoiceTx] = useState<FinanceTx | null>(null);

  const [importText, setImportText] = useState("");

  const isCEO = role === "CEO";
  const canEdit = isCEO || !settings.lockStaffEdits;

  function notify(msg: string) {
    setToast(msg);
    if (toastRef.current) window.clearTimeout(toastRef.current);
    toastRef.current = window.setTimeout(() => setToast(""), 2200);
  }
  function pushAudit(action: AuditAction, details: string) {
    const item: AuditItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      at: nowISO(),
      actorRole: role,
      actorEmail: email || undefined,
      action,
      details,
    };
    setAudit((prev) => [item, ...prev].slice(0, 800));
  }

  /* ============ LOAD ============ */
  useEffect(() => {
    setMounted(true);

    const loadedRole = asRole(localStorage.getItem(DB_AUTH_ROLE));
    const loadedEmail = localStorage.getItem(DB_AUTH_EMAIL) || "";
    setRole(loadedRole);
    setEmail(loadedEmail);

    const rawSet = safeJsonParse<FinanceSettings>(localStorage.getItem(DB_FIN_SETTINGS), defaultSettings());
    const s: FinanceSettings = { ...defaultSettings(), ...(rawSet || {}) };
    s.defaultCurrency = asCurrency((s as any).defaultCurrency, "INR");
    s.overdueRuleDays = clamp(parseNum((s as any).overdueRuleDays, 0), 0, 60);
    s.showGst = !!(s as any).showGst;
    s.showTds = !!(s as any).showTds;
    s.lockStaffEdits = (s as any).lockStaffEdits !== false;
    setSettings(s);

    const rawTx = safeJsonParse<any[]>(localStorage.getItem(DB_FIN), []);
    const normTx: FinanceTx[] = Array.isArray(rawTx)
      ? rawTx.map((t) => normalizeTx(t, s.defaultCurrency)).filter((x): x is FinanceTx => !!x)
      : [];
    setTxs(normTx);

    const rawBud = safeJsonParse<any[]>(localStorage.getItem(DB_FIN_BUDGETS), []);
    const normBud: BudgetLine[] = Array.isArray(rawBud)
      ? rawBud
          .filter((b) => b && typeof b === "object")
          .map((b) => {
            const month = typeof (b as any).month === "string" && (b as any).month ? (b as any).month : toYM(new Date());
            const currency = asCurrency((b as any).currency, s.defaultCurrency);
            const fx = (b as any).fixedCosts || {};
            return {
              id: parseNum((b as any).id, Date.now()),
              createdAt: typeof (b as any).createdAt === "string" ? (b as any).createdAt : nowISO(),
              updatedAt: typeof (b as any).updatedAt === "string" ? (b as any).updatedAt : nowISO(),
              month,
              currency,
              revenueTarget: parseNum((b as any).revenueTarget, 0),
              expenseCap: parseNum((b as any).expenseCap, 0),
              grossMarginTargetPct: clamp(parseNum((b as any).grossMarginTargetPct, 25), 0, 80),
              fixedCosts: {
                officeRentUtilities: parseNum(fx.officeRentUtilities, 0),
                salaries: parseNum(fx.salaries, 0),
                marketing: parseNum(fx.marketing, 0),
                internetMisc: parseNum(fx.internetMisc, 0),
                transportLogistics: parseNum(fx.transportLogistics, 0),
                adminCompliance: parseNum(fx.adminCompliance, 0),
              },
              notes: typeof (b as any).notes === "string" ? (b as any).notes : undefined,
            };
          })
      : [];
    setBudgets(normBud);

    const rawAud = safeJsonParse<any[]>(localStorage.getItem(DB_FIN_AUDIT), []);
    const normAud: AuditItem[] = Array.isArray(rawAud)
      ? rawAud
          .filter((a) => a && typeof a === "object")
          .map((a) => ({
            id: parseNum((a as any).id, Date.now()),
            at: typeof (a as any).at === "string" ? (a as any).at : nowISO(),
            actorRole: asRole((a as any).actorRole),
            actorEmail: typeof (a as any).actorEmail === "string" ? (a as any).actorEmail : undefined,
            action: String((a as any).action || "EXPORT") as AuditAction,
            details: String((a as any).details || ""),
          }))
      : [];
    setAudit(normAud);
  }, []);

  /* ============ SAVE ============ */
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(DB_FIN_SETTINGS, JSON.stringify(settings));
    } catch {}
  }, [settings, mounted]);

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
      localStorage.setItem(DB_FIN_AUDIT, JSON.stringify(audit));
    } catch {}
  }, [audit, mounted]);

  /* ============ AUTO: OVERDUE ============ */
  useEffect(() => {
    if (!mounted) return;
    const today = toYMD(new Date());
    let changed = false;

    const next: FinanceTx[] = txs.map((t): FinanceTx => {
      if (t.status === "Paid" || t.status === "Cancelled") return t;
      if (!t.dueDate) return t;
      const isOver = daysBetween(t.dueDate, today) > settings.overdueRuleDays;
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

  /* ============ AUTO: RECURRING ============ */
  useEffect(() => {
    if (!mounted) return;
    const today = toYMD(new Date());
    const created: FinanceTx[] = [];
    let made = 0;

    const updated: FinanceTx[] = txs.map((t): FinanceTx => {
      const r = t.recurring;
      if (!r?.enabled || !r.nextRun) return t;
      if (r.nextRun > today) return t;

      const newTx: FinanceTx = {
        ...t,
        id: Date.now() + Math.floor(Math.random() * 1000),
        createdAt: nowISO(),
        updatedAt: nowISO(),
        date: r.nextRun,
        status: "Planned",
        referenceId: "",
        invoiceNo: "",
        notes: (t.notes ? t.notes + "\n" : "") + `Auto-created from recurring (${r.freq}).`,
      };
      created.push(newTx);
      made++;

      let nextRun = r.nextRun;
      if (r.freq === "Weekly") nextRun = addDays(nextRun, 7);
      if (r.freq === "Monthly") nextRun = addMonths(nextRun, 1);
      if (r.freq === "Quarterly") nextRun = addMonths(nextRun, 3);
      if (r.freq === "Yearly") nextRun = addMonths(nextRun, 12);

      return { ...t, updatedAt: nowISO(), recurring: { ...r, nextRun } };
    });

    if (made > 0) {
      setTxs((prev) => [...created, ...updated]);
      pushAudit("AUTO_RECUR_CREATE", `Auto-created ${made} recurring transaction(s).`);
      notify(`Auto-created ${made} recurring`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  /* ============ DERIVED ============ */
  const baseCurrency = settings.defaultCurrency;
  const monthNow = toYM(new Date());
  const todayYMD = toYMD(new Date());

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
          t.category,
          t.status,
          t.type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return blob.includes(qq);
      })
      .sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)));
  }, [txs, q, fType, fStatus, fCategory, fCur, from, to]);

  const txThisMonth = useMemo(() => txs.filter((t) => t.date.slice(0, 7) === monthNow), [txs, monthNow]);

  const kpis = useMemo(() => {
    const sumNet = (rows: FinanceTx[]) => rows.reduce((s, t) => s + calcTotals(t).net, 0);

    const mIncome = sumNet(txThisMonth.filter((t) => t.type === "Income" && t.status !== "Cancelled"));
    const mExpense = sumNet(txThisMonth.filter((t) => t.type === "Expense" && t.status !== "Cancelled"));
    const mNet = mIncome - mExpense;

    const ar = sumNet(
      txs.filter((t) => t.type === "Income" && (t.status === "Planned" || t.status === "Pending" || t.status === "Overdue"))
    );
    const ap = sumNet(
      txs.filter((t) => t.type === "Expense" && (t.status === "Planned" || t.status === "Pending" || t.status === "Overdue"))
    );
    const overdueCount = txs.filter((t) => t.status === "Overdue").length;

    const cashIn = sumNet(txs.filter((t) => t.type === "Income" && t.status === "Paid"));
    const cashOut = sumNet(txs.filter((t) => t.type === "Expense" && t.status === "Paid"));
    const cash = cashIn - cashOut;

    const b = budgets.find((x) => x.month === monthNow) || null;
    const fixed =
      b
        ? b.fixedCosts.officeRentUtilities +
          b.fixedCosts.salaries +
          b.fixedCosts.marketing +
          b.fixedCosts.internetMisc +
          b.fixedCosts.transportLogistics +
          b.fixedCosts.adminCompliance
        : 265000;

    const runwayMonths = fixed > 0 ? cash / fixed : 0;

    return { mIncome, mExpense, mNet, ar, ap, overdueCount, cash, fixed, runwayMonths };
  }, [txThisMonth, txs, budgets, monthNow]);

  const monthSeries = useMemo(() => {
    const map = new Map<string, { inc: number; exp: number }>();
    for (const t of txs) {
      if (t.status === "Cancelled") continue;
      const ym = t.date.slice(0, 7);
      const cur = map.get(ym) || { inc: 0, exp: 0 };
      const v = calcTotals(t).net;
      if (t.type === "Income") cur.inc += v;
      else cur.exp += v;
      map.set(ym, cur);
    }
    const arr = Array.from(map.entries())
      .map(([month, v]) => ({ month, inc: v.inc, exp: v.exp, net: v.inc - v.exp }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
    return arr;
  }, [txs]);

  const topSpendThisMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txThisMonth) {
      if (t.status === "Cancelled") continue;
      if (t.type !== "Expense") continue;
      const key = t.category;
      m.set(key, (m.get(key) || 0) + calcTotals(t).net);
    }
    const arr = Array.from(m.entries()).map(([k, v]) => ({ k, v }));
    arr.sort((a, b) => b.v - a.v);
    return arr.slice(0, 8);
  }, [txThisMonth]);

  /* ============ ACTIONS ============ */
  function toggleSelect(id: number) {
    setSelected((p) => ({ ...p, [id]: !p[id] }));
  }
  function clearSelection() {
    setSelected({});
  }
  function selectAllFiltered() {
    const map: Record<number, boolean> = {};
    for (const t of filtered) map[t.id] = true;
    setSelected(map);
  }

  function openNewTx() {
    const tx: FinanceTx = {
      id: Date.now(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
      date: todayYMD,
      type: "Expense",
      status: "Planned",
      amount: 0,
      currency: baseCurrency,
      category: "Other",
      subcategory: "",
      description: "",
      clientName: "",
      vendorName: "",
      eventTitle: "",
      eventId: "",
      paymentMethod: "Bank",
      referenceId: "",
      invoiceNo: "",
      gstRate: 0,
      gstIncluded: false,
      tdsRate: 0,
      dueDate: "",
      recurring: undefined,
      notes: "",
    };
    setEditingTx(tx);
    setOpenTxModal(true);
  }

  function openEditTx(t: FinanceTx) {
    setEditingTx({ ...t, recurring: t.recurring ? { ...t.recurring } : undefined });
    setOpenTxModal(true);
  }

  function saveTx(tx: FinanceTx) {
    if (!canEdit) return notify("Edit locked for Staff.");
    if (!tx.description.trim()) return notify("Description required.");

    const clean: FinanceTx = {
      ...tx,
      type: asTxType(tx.type),
      status: asTxStatus(tx.status),
      currency: asCurrency(tx.currency, baseCurrency),
      category: asTag(tx.category),
      paymentMethod: asMethod(tx.paymentMethod),
      amount: parseNum(tx.amount, 0),
      gstRate: tx.gstRate == null ? undefined : clamp(parseNum(tx.gstRate, 0), 0, 28),
      tdsRate: tx.tdsRate == null ? undefined : clamp(parseNum(tx.tdsRate, 0), 0, 20),
      gstIncluded: !!tx.gstIncluded,
      updatedAt: nowISO(),
      recurring: asRecurring(tx.recurring),
    };

    setTxs((prev) => {
      const exists = prev.some((p) => p.id === clean.id);
      const next = exists ? prev.map((p) => (p.id === clean.id ? clean : p)) : [clean, ...prev];
      return next.sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)));
    });

    pushAudit(
      txs.some((p) => p.id === clean.id) ? "UPDATE_TX" : "CREATE_TX",
      `${clean.type} ${clean.status} • ${money(calcTotals(clean).net, clean.currency)} • ${clean.description}`
    );
    notify("Saved");
    setOpenTxModal(false);
    setEditingTx(null);
  }

  function deleteTx(id: number) {
    if (!canEdit) return notify("Edit locked for Staff.");
    const t = txs.find((x) => x.id === id);
    setTxs((prev) => prev.filter((p) => p.id !== id));
    pushAudit("DELETE_TX", t ? `Deleted • ${t.description}` : `Deleted tx ${id}`);
    notify("Deleted");
  }

  function bulkUpdateStatus(status: TxStatus) {
    if (!canEdit) return notify("Edit locked for Staff.");
    if (selectedIds.length === 0) return notify("Select rows first.");
    const set = new Set(selectedIds);
    setTxs((prev) => prev.map((t) => (set.has(t.id) ? { ...t, status, updatedAt: nowISO() } : t)));
    pushAudit("BULK_UPDATE", `Status → ${status} for ${selectedIds.length} tx`);
    notify("Bulk updated");
  }

  function bulkDelete() {
    if (!canEdit) return notify("Edit locked for Staff.");
    if (selectedIds.length === 0) return notify("Select rows first.");
    const set = new Set(selectedIds);
    setTxs((prev) => prev.filter((t) => !set.has(t.id)));
    pushAudit("BULK_UPDATE", `Deleted ${selectedIds.length} tx`);
    clearSelection();
    notify("Bulk deleted");
  }

  function openNewBudget() {
    setEditingBudget(defaultBudgetLine(toYM(new Date()), baseCurrency));
    setOpenBudgetModal(true);
  }

  function openEditBudget(b: BudgetLine) {
    setEditingBudget({ ...b, fixedCosts: { ...b.fixedCosts } });
    setOpenBudgetModal(true);
  }

  function saveBudget(b: BudgetLine) {
    if (!canEdit) return notify("Edit locked for Staff.");
    const clean: BudgetLine = {
      ...b,
      updatedAt: nowISO(),
      month: String(b.month || monthNow),
      currency: asCurrency(b.currency, baseCurrency),
      revenueTarget: parseNum(b.revenueTarget, 0),
      expenseCap: parseNum(b.expenseCap, 0),
      grossMarginTargetPct: clamp(parseNum(b.grossMarginTargetPct, 25), 0, 80),
      fixedCosts: {
        officeRentUtilities: parseNum(b.fixedCosts.officeRentUtilities, 0),
        salaries: parseNum(b.fixedCosts.salaries, 0),
        marketing: parseNum(b.fixedCosts.marketing, 0),
        internetMisc: parseNum(b.fixedCosts.internetMisc, 0),
        transportLogistics: parseNum(b.fixedCosts.transportLogistics, 0),
        adminCompliance: parseNum(b.fixedCosts.adminCompliance, 0),
      },
    };

    setBudgets((prev) => {
      const exists = prev.some((x) => x.id === clean.id || x.month === clean.month);
      const next = exists ? prev.map((x) => (x.id === clean.id || x.month === clean.month ? clean : x)) : [clean, ...prev];
      next.sort((a, b2) => b2.month.localeCompare(a.month));
      return next;
    });

    pushAudit("UPDATE_BUDGET", `Budget saved • ${clean.month}`);
    notify("Budget saved");
    setOpenBudgetModal(false);
    setEditingBudget(null);
  }

  function deleteBudget(id: number) {
    if (!canEdit) return notify("Edit locked for Staff.");
    const b = budgets.find((x) => x.id === id);
    setBudgets((prev) => prev.filter((x) => x.id !== id));
    pushAudit("DELETE_BUDGET", b ? `Deleted budget • ${b.month}` : `Deleted budget ${id}`);
    notify("Budget deleted");
  }

  function seedDemoData() {
    if (!canEdit) return notify("Edit locked for Staff.");
    const d = todayYMD;
    const demo: FinanceTx[] = [
      {
        id: Date.now() + 1,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        date: d,
        type: "Income",
        status: "Paid",
        amount: 250000,
        currency: baseCurrency,
        category: "Sales",
        description: "Wedding package (Gold)",
        clientName: "Client A",
        paymentMethod: "Bank",
        gstRate: 18,
        gstIncluded: false,
        tdsRate: 0,
        notes: "50% advance + milestone collection",
      },
      {
        id: Date.now() + 2,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        date: d,
        type: "Expense",
        status: "Pending",
        amount: 120000,
        currency: baseCurrency,
        category: "VendorPayment",
        description: "Decorator vendor settlement",
        vendorName: "Vendor X",
        paymentMethod: "UPI",
        dueDate: addDays(d, 7),
      },
      {
        id: Date.now() + 3,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        date: d,
        type: "Expense",
        status: "Paid",
        amount: 30000,
        currency: baseCurrency,
        category: "Marketing",
        description: "Meta Ads (lead gen)",
        paymentMethod: "Card",
      },
      {
        id: Date.now() + 4,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        date: d,
        type: "Expense",
        status: "Planned",
        amount: 150000,
        currency: baseCurrency,
        category: "Salary",
        description: "Salaries (month)",
        paymentMethod: "Bank",
        recurring: { enabled: true, freq: "Monthly", nextRun: addMonths(d, 1) },
      },
    ];
    setTxs((prev) => [...demo, ...prev]);
    if (!budgets.some((b) => b.month === monthNow)) setBudgets((prev) => [defaultBudgetLine(monthNow, baseCurrency), ...prev]);
    pushAudit("CREATE_TX", "Seeded demo finance data");
    notify("Demo added");
  }

  /* ============ EXPORTS ============ */
  const CSV_HEADERS = [
    "id",
    "date",
    "type",
    "status",
    "currency",
    "amount",
    "gstRate",
    "gstIncluded",
    "tdsRate",
    "totalNet",
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
    const lines: string[] = [CSV_HEADERS.join(",")];
    for (const t of rows) {
      const c = calcTotals(t);
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
        c.net,
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
    notify("CSV exported");
  }

  function exportExcelXls(which: "filtered" | "all") {
    const rows = (which === "all" ? txs : filtered).slice().sort((a, b) => a.date.localeCompare(b.date));
    const head = CSV_HEADERS;
    const body = rows
      .map((t) => {
        const c = calcTotals(t);
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
          c.net,
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
        ];
        return `<tr>${vals.map((v) => `<td>${String(v ?? "").replace(/</g, "&lt;")}</td>`).join("")}</tr>`;
      })
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body>
      <table border="1"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${body}</tbody></table></body></html>`;
    downloadText(`eventura_finance_${which}_${toYMD(new Date())}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
    pushAudit("EXPORT", `Exported Excel (.xls) (${which}) rows=${rows.length}`);
    notify("Excel exported");
  }

  /* ============ INVOICE PRINT ============ */
  function openInvoice(t: FinanceTx) {
    setInvoiceTx(t);
    setOpenInvoiceModal(true);
  }
  function printInvoice() {
    if (!invoiceTx) return;
    const c = calcTotals(invoiceTx);
    const html = `<!doctype html>
<html><head><meta charset="utf-8"/>
<title>Invoice</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:24px;background:#fff;color:#111}
.card{border:1px solid #ddd;border-radius:12px;padding:16px}
.h1{font-size:18px;font-weight:700;margin:0 0 6px}
.muted{color:#666;font-size:12px}
.row{display:flex;justify-content:space-between;gap:12px;margin-top:10px}
.table{width:100%;border-collapse:collapse;margin-top:12px}
.table th,.table td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}
.right{text-align:right}
.badge{display:inline-block;border:1px solid #ddd;border-radius:999px;padding:4px 10px;font-size:12px}
</style></head>
<body>
<div class="card">
  <div class="row">
    <div>
      <div class="h1">Eventura — Invoice</div>
      <div class="muted">Date: ${invoiceTx.date}</div>
      <div class="muted">Invoice No: ${invoiceTx.invoiceNo || "-"}</div>
      <div class="muted">Reference: ${invoiceTx.referenceId || "-"}</div>
    </div>
    <div class="right">
      <div class="badge">${invoiceTx.status}</div>
      <div class="muted" style="margin-top:6px">Currency: ${invoiceTx.currency}</div>
    </div>
  </div>

  <div class="row">
    <div>
      <div class="muted">Billed To</div>
      <div><b>${invoiceTx.clientName || "Client"}</b></div>
      <div class="muted">${invoiceTx.eventTitle || ""}</div>
    </div>
    <div>
      <div class="muted">Description</div>
      <div><b>${(invoiceTx.description || "").replace(/</g, "&lt;")}</b></div>
      <div class="muted">Category: ${invoiceTx.category}${invoiceTx.subcategory ? " / " + invoiceTx.subcategory : ""}</div>
    </div>
  </div>

  <table class="table">
    <thead><tr><th>Item</th><th class="right">Amount</th></tr></thead>
    <tbody>
      <tr><td>Base</td><td class="right">${money(c.base, invoiceTx.currency)}</td></tr>
      <tr><td>GST (${c.gstRate}%)</td><td class="right">${money(c.gstAdd, invoiceTx.currency)}</td></tr>
      <tr><td>TDS (${c.tdsRate}%)</td><td class="right">-${money(c.tds, invoiceTx.currency)}</td></tr>
      <tr><td><b>Net Total</b></td><td class="right"><b>${money(c.net, invoiceTx.currency)}</b></td></tr>
    </tbody>
  </table>

  <div class="muted" style="margin-top:10px">Notes: ${(invoiceTx.notes || "-").replace(/</g, "&lt;")}</div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return notify("Popup blocked. Allow popups to print invoice.");
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  /* ============ IMPORT (CSV/JSON) ============ */
  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result || ""));
      notify("File loaded");
    };
    reader.readAsText(file);
  }

  function exportJSONBackup() {
    const payload = { version: 3, exportedAt: nowISO(), settings, budgets, txs, audit };
    downloadText(`eventura_finance_backup_${toYMD(new Date())}.json`, JSON.stringify(payload, null, 2), "application/json");
    pushAudit("EXPORT", `Exported JSON backup`);
    notify("JSON exported");
  }

  function importJSONBackup() {
    if (!canEdit) return notify("Edit locked for Staff.");
    try {
      const obj = JSON.parse(importText || "{}");

      const rawSet = obj.settings ? (obj.settings as any) : null;
      const s: FinanceSettings = { ...defaultSettings(), ...(rawSet || {}) };
      s.defaultCurrency = asCurrency((s as any).defaultCurrency, "INR");
      s.overdueRuleDays = clamp(parseNum((s as any).overdueRuleDays, 0), 0, 60);
      s.showGst = !!(s as any).showGst;
      s.showTds = !!(s as any).showTds;
      s.lockStaffEdits = (s as any).lockStaffEdits !== false;

      const rawTx = Array.isArray(obj.txs) ? (obj.txs as any[]) : [];
      const normTx: FinanceTx[] = rawTx.map((t) => normalizeTx(t, s.defaultCurrency)).filter((x): x is FinanceTx => !!x);

      const rawBud = Array.isArray(obj.budgets) ? (obj.budgets as any[]) : [];
      const normBud: BudgetLine[] = rawBud
        .filter((b) => b && typeof b === "object")
        .map((b) => {
          const month = typeof (b as any).month === "string" && (b as any).month ? (b as any).month : toYM(new Date());
          const currency = asCurrency((b as any).currency, s.defaultCurrency);
          const fx = (b as any).fixedCosts || {};
          return {
            id: parseNum((b as any).id, Date.now()),
            createdAt: typeof (b as any).createdAt === "string" ? (b as any).createdAt : nowISO(),
            updatedAt: typeof (b as any).updatedAt === "string" ? (b as any).updatedAt : nowISO(),
            month,
            currency,
            revenueTarget: parseNum((b as any).revenueTarget, 0),
            expenseCap: parseNum((b as any).expenseCap, 0),
            grossMarginTargetPct: clamp(parseNum((b as any).grossMarginTargetPct, 25), 0, 80),
            fixedCosts: {
              officeRentUtilities: parseNum(fx.officeRentUtilities, 0),
              salaries: parseNum(fx.salaries, 0),
              marketing: parseNum(fx.marketing, 0),
              internetMisc: parseNum(fx.internetMisc, 0),
              transportLogistics: parseNum(fx.transportLogistics, 0),
              adminCompliance: parseNum(fx.adminCompliance, 0),
            },
            notes: typeof (b as any).notes === "string" ? (b as any).notes : undefined,
          };
        });

      const rawAud = Array.isArray(obj.audit) ? (obj.audit as any[]) : [];
      const normAud: AuditItem[] = rawAud
        .filter((a) => a && typeof a === "object")
        .map((a) => ({
          id: parseNum((a as any).id, Date.now()),
          at: typeof (a as any).at === "string" ? (a as any).at : nowISO(),
          actorRole: asRole((a as any).actorRole),
          actorEmail: typeof (a as any).actorEmail === "string" ? (a as any).actorEmail : undefined,
          action: String((a as any).action || "IMPORT") as AuditAction,
          details: String((a as any).details || ""),
        }));

      setSettings(s);
      setTxs(normTx);
      setBudgets(normBud);
      setAudit(normAud);

      pushAudit("IMPORT", `Imported JSON backup (tx=${normTx.length}, budgets=${normBud.length})`);
      notify("Imported JSON");
    } catch {
      notify("Invalid JSON");
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

  function importCSVText() {
    if (!canEdit) return notify("Edit locked for Staff.");
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
      const recFreq = RECUR_FREQS.includes(getCell(cols, "recurringFreq") as any)
        ? (getCell(cols, "recurringFreq") as RecurringFreq)
        : "Monthly";
      const recNext = getCell(cols, "recurringNextRun") || "";

      const rawObj: any = {
        id: parseNum(getCell(cols, "id"), Date.now() + i),
        createdAt: getCell(cols, "createdAt") || nowISO(),
        updatedAt: nowISO(),
        date: getCell(cols, "date") || todayYMD,
        type: getCell(cols, "type"),
        status: getCell(cols, "status"),
        currency: getCell(cols, "currency") || baseCurrency,
        amount: parseNum(getCell(cols, "amount"), 0),
        gstRate: parseNum(getCell(cols, "gstRate"), 0),
        gstIncluded: String(getCell(cols, "gstIncluded")).toLowerCase() === "true",
        tdsRate: parseNum(getCell(cols, "tdsRate"), 0),
        category: getCell(cols, "category"),
        subcategory: getCell(cols, "subcategory") || undefined,
        description: getCell(cols, "description") || "",
        clientName: getCell(cols, "clientName") || undefined,
        vendorName: getCell(cols, "vendorName") || undefined,
        eventTitle: getCell(cols, "eventTitle") || undefined,
        eventId: getCell(cols, "eventId") || undefined,
        paymentMethod: getCell(cols, "paymentMethod"),
        referenceId: getCell(cols, "referenceId") || undefined,
        invoiceNo: getCell(cols, "invoiceNo") || undefined,
        dueDate: getCell(cols, "dueDate") || undefined,
        recurring: recEnabled ? { enabled: true, freq: recFreq, nextRun: recNext || undefined } : undefined,
        notes: getCell(cols, "notes") || undefined,
      };

      const norm = normalizeTx(rawObj, baseCurrency);
      if (norm && norm.description.trim()) next.push(norm);
    }

    setTxs((prev) => {
      const map = new Map<number, FinanceTx>();
      for (const p of prev) map.set(p.id, p);
      for (const n of next) map.set(n.id, n);
      const arr = Array.from(map.values());
      arr.sort((a, b) => (a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)));
      return arr;
    });

    pushAudit("IMPORT", `Imported CSV rows=${next.length}`);
    notify("Imported CSV");
  }

  /* ============ AR/AP ============ */
  const arap = useMemo(() => {
    const receivables = txs.filter(
      (t) => t.type === "Income" && (t.status === "Planned" || t.status === "Pending" || t.status === "Overdue")
    );
    const payables = txs.filter(
      (t) => t.type === "Expense" && (t.status === "Planned" || t.status === "Pending" || t.status === "Overdue")
    );

    function group(rows: FinanceTx[], by: "clientName" | "vendorName") {
      const m = new Map<string, { name: string; total: number; overdue: number; nextDue?: string }>();
      for (const t of rows) {
        const name = String((t as any)[by] || "Unknown");
        const cur = m.get(name) || { name, total: 0, overdue: 0, nextDue: undefined };
        const v = calcTotals(t).net;
        cur.total += v;
        if (t.status === "Overdue") cur.overdue += v;
        const dd = t.dueDate || t.date;
        if (!cur.nextDue || dd < cur.nextDue) cur.nextDue = dd;
        m.set(name, cur);
      }
      const arr = Array.from(m.values());
      arr.sort((a, b) => b.total - a.total);
      return arr;
    }

    return { receivables, payables, byClient: group(receivables, "clientName"), byVendor: group(payables, "vendorName") };
  }, [txs]);

  /* ============ SETTINGS UPDATE ============ */
  function updateSettings(patch: Partial<FinanceSettings>) {
    if (!isCEO) return notify("Only CEO can change settings.");
    const next: FinanceSettings = { ...settings, ...patch };
    next.defaultCurrency = asCurrency((next as any).defaultCurrency, "INR");
    next.overdueRuleDays = clamp(parseNum((next as any).overdueRuleDays, 0), 0, 60);
    next.showGst = !!(next as any).showGst;
    next.showTds = !!(next as any).showTds;
    next.lockStaffEdits = (next as any).lockStaffEdits !== false;
    setSettings(next);
    pushAudit("SETTINGS_UPDATE", "Settings updated");
    notify("Settings saved");
  }

  /* =========================
     NAV
  ========================= */
  const tabs: { key: Tab; label: string }[] = [
    { key: "Dashboard", label: "Dashboard" },
    { key: "Transactions", label: "Transactions" },
    { key: "Budgets", label: "Budgets" },
    { key: "AR/AP", label: "AR / AP" },
    { key: "Reports", label: "Reports" },
    { key: "Import/Export", label: "Import / Export" },
    { key: "Audit", label: "Audit" },
    { key: "Settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Top App Header */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
              <div className="text-xs text-white/60">Eventura OS</div>
              <div className="text-sm font-semibold tracking-tight">Finance</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill>{role}</Pill>
              <Pill>{email || "no-email"}</Pill>
              <Pill>Tx {txs.length}</Pill>
              <Pill>Budgets {budgets.length}</Pill>
              {!canEdit ? <Pill tone="warn">Staff view-only</Pill> : <Pill tone="good">Edit enabled</Pill>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Btn variant="outline" onClick={() => exportExcelXls("filtered")}>
              Export Excel
            </Btn>
            <Btn variant="outline" onClick={() => exportCSV("filtered")}>
              Export CSV
            </Btn>
            <Btn variant="outline" onClick={exportJSONBackup}>
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

        {/* Top Tabs */}
        <div className="mx-auto max-w-7xl px-4 pb-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cls(
                  "rounded-xl border px-3 py-2 text-sm transition",
                  tab === t.key
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-white/10 bg-black/30 text-white/75 hover:bg-black hover:text-white hover:border-white/20"
                )}
              >
                {t.label}
              </button>
            ))}
            <div className="flex-1" />
            <Btn onClick={openNewTx} disabled={!canEdit}>
              + New Transaction
            </Btn>
            <Btn variant="outline" onClick={seedDemoData} disabled={!canEdit}>
              Seed Demo
            </Btn>
          </div>

          {toast ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85">{toast}</div>
          ) : null}
        </div>
      </div>

      {/* Page */}
      <div className="mx-auto max-w-7xl px-4 py-5">
        {/* DASHBOARD */}
        {tab === "Dashboard" ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Kpi label="This Month Income" value={money(kpis.mIncome, baseCurrency)} />
              <Kpi label="This Month Expense" value={money(kpis.mExpense, baseCurrency)} />
              <Kpi label="This Month Net" value={money(kpis.mNet, baseCurrency)} sub="Income - Expense (after GST/TDS)" />
              <Kpi label="Overdue Items" value={String(kpis.overdueCount)} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
              {/* Cash + AR/AP */}
              <div className="md:col-span-5">
                <Card title="Cash & Runway" right={<Pill>{baseCurrency}</Pill>}>
                  <div className="grid grid-cols-1 gap-3">
                    <Kpi label="Estimated Cash Balance" value={money(kpis.cash, baseCurrency)} sub="Paid income - paid expenses (all time)" />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Kpi label="Fixed Cost (Budget)" value={money(kpis.fixed, baseCurrency)} sub="Current month fixed costs" />
                      <Kpi label="Runway (months)" value={kpis.runwayMonths.toFixed(1)} sub="Cash / fixed cost" />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-xs text-white/60">Receivables (AR)</div>
                        <div className="mt-2 text-lg font-semibold">{money(kpis.ar, baseCurrency)}</div>
                        <div className="mt-2 text-xs text-white/45">Planned/Pending/Overdue Income</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-xs text-white/60">Payables (AP)</div>
                        <div className="mt-2 text-lg font-semibold">{money(kpis.ap, baseCurrency)}</div>
                        <div className="mt-2 text-xs text-white/45">Planned/Pending/Overdue Expense</div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Trend */}
              <div className="md:col-span-7">
                <Card title="P&L Trend (Last 12 months)" right={<Pill>{monthNow}</Pill>}>
                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-white/60">Net per month (spark bars)</div>
                        <div className="text-xs text-white/60">{monthSeries.length} months</div>
                      </div>
                      <div className="mt-3">
                        <SparkBars values={monthSeries.map((m) => m.net)} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                        {monthSeries.slice(-4).map((m) => (
                          <div key={m.month} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                            <div className="text-[11px] text-white/60">{m.month}</div>
                            <div className="mt-1 text-sm font-semibold">{money(m.net, baseCurrency)}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Card title="Top Spend (This Month)">
                        {topSpendThisMonth.length === 0 ? (
                          <div className="text-sm text-white/60">No expense data this month.</div>
                        ) : (
                          <div className="grid gap-2">
                            {(() => {
                              const max = Math.max(...topSpendThisMonth.map((x) => x.v), 1);
                              return topSpendThisMonth.map((x) => (
                                <ProgressRow
                                  key={x.k}
                                  label={x.k}
                                  value={x.v}
                                  max={max}
                                  right={money(x.v, baseCurrency)}
                                />
                              ));
                            })()}
                          </div>
                        )}
                      </Card>

                      <Card title="Quick Controls">
                        <div className="grid gap-3">
                          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                            <div className="text-xs text-white/60">New transaction</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Btn onClick={openNewTx} disabled={!canEdit}>
                                + Add
                              </Btn>
                              <Btn variant="outline" onClick={() => setTab("Transactions")}>
                                Open Ledger
                              </Btn>
                              <Btn variant="outline" onClick={() => setTab("Budgets")}>
                                Budgets
                              </Btn>
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                            <div className="text-xs text-white/60">Exports</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Btn variant="outline" onClick={() => exportExcelXls("all")}>
                                Excel (All)
                              </Btn>
                              <Btn variant="outline" onClick={() => exportCSV("all")}>
                                CSV (All)
                              </Btn>
                              <Btn variant="outline" onClick={exportJSONBackup}>
                                JSON Backup
                              </Btn>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        ) : null}

        {/* TRANSACTIONS (REAL LEDGER TABLE) */}
        {tab === "Transactions" ? (
          <div className="grid gap-4">
            <Card title="Ledger Filters" right={<span className="text-white/60">Showing {filtered.length} rows</span>}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-4">
                  <div className="text-xs text-white/60">Search</div>
                  <Input value={q} onChange={setQ} placeholder="client/vendor/event/invoice/notes..." />
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-white/60">Type</div>
                  <Select value={fType} onChange={(v) => setFType(v as any)} options={[{ value: "All", label: "All" }, ...TX_TYPES.map((t) => ({ value: t, label: t }))]} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-white/60">Status</div>
                  <Select value={fStatus} onChange={(v) => setFStatus(v as any)} options={[{ value: "All", label: "All" }, ...TX_STATUSES.map((s) => ({ value: s, label: s }))]} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-white/60">Category</div>
                  <Select value={fCategory} onChange={(v) => setFCategory(v as any)} options={[{ value: "All", label: "All" }, ...TAGS.map((c) => ({ value: c, label: c }))]} />
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-white/60">Currency</div>
                  <Select value={fCur} onChange={(v) => setFCur(v as any)} options={[{ value: "All", label: "All" }, ...CURRENCIES.map((c) => ({ value: c, label: c }))]} />
                </div>

                <div className="md:col-span-2">
                  <div className="text-xs text-white/60">From</div>
                  <Input value={from} onChange={setFrom} type="date" />
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-white/60">To</div>
                  <Input value={to} onChange={setTo} type="date" />
                </div>

                <div className="md:col-span-8 flex flex-wrap items-end justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="outline" onClick={selectAllFiltered}>
                      Select all
                    </Btn>
                    <Btn variant="outline" onClick={clearSelection}>
                      Clear
                    </Btn>
                    <Pill>Selected {selectedIds.length}</Pill>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Btn variant="outline" onClick={() => bulkUpdateStatus("Paid")} disabled={!canEdit}>
                      Mark Paid
                    </Btn>
                    <Btn variant="outline" onClick={() => bulkUpdateStatus("Pending")} disabled={!canEdit}>
                      Mark Pending
                    </Btn>
                    <Btn variant="outline" onClick={() => bulkUpdateStatus("Overdue")} disabled={!canEdit}>
                      Mark Overdue
                    </Btn>
                    <Btn variant="outline" onClick={() => bulkUpdateStatus("Cancelled")} disabled={!canEdit}>
                      Cancel
                    </Btn>
                    <Btn variant="danger" onClick={bulkDelete} disabled={!canEdit}>
                      Delete
                    </Btn>
                  </div>
                </div>
              </div>
            </Card>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {/* Sticky header */}
              <div className="grid grid-cols-12 gap-2 border-b border-white/10 bg-black/60 px-3 py-2 text-xs text-white/60">
                <div className="col-span-1">Sel</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-3">Description</div>
                <div className="col-span-2 text-right">Net</div>
              </div>

              {filtered.length === 0 ? (
                <div className="p-6 text-sm text-white/60">No transactions found.</div>
              ) : (
                <div className="divide-y divide-white/10">
                  {filtered.map((t) => {
                    const c = calcTotals(t);
                    const party = t.type === "Income" ? t.clientName || "-" : t.vendorName || "-";
                    const statusTone: "neutral" | "good" | "bad" | "warn" =
                      t.status === "Paid" ? "good" : t.status === "Overdue" ? "bad" : t.status === "Pending" ? "warn" : "neutral";
                    const netTone: "neutral" | "good" | "bad" = t.type === "Income" ? "good" : "bad";

                    return (
                      <div key={t.id} className="grid grid-cols-12 gap-2 px-3 py-3 hover:bg-black/50 transition">
                        <div className="col-span-1 flex items-center">
                          <input type="checkbox" checked={!!selected[t.id]} onChange={() => toggleSelect(t.id)} />
                        </div>

                        <div className="col-span-2">
                          <div className="text-sm font-semibold">{t.date}</div>
                          <div className="mt-1 text-xs text-white/50">{t.dueDate ? `Due: ${t.dueDate}` : "—"}</div>
                        </div>

                        <div className="col-span-2 flex flex-col gap-1">
                          <Pill tone={t.type === "Income" ? "good" : "bad"}>{t.type}</Pill>
                          <div className="text-xs text-white/50">{t.category}</div>
                        </div>

                        <div className="col-span-2 flex flex-col gap-1">
                          <Pill tone={statusTone}>{t.status}</Pill>
                          <div className="text-xs text-white/50">{t.currency}</div>
                        </div>

                        <div className="col-span-3">
                          <div className="text-sm text-white/90">{t.description || "-"}</div>
                          <div className="mt-1 text-xs text-white/50">
                            {party}
                            {t.eventTitle ? ` • ${t.eventTitle}` : ""}
                            {t.invoiceNo ? ` • Inv ${t.invoiceNo}` : ""}
                          </div>
                        </div>

                        <div className="col-span-2 text-right">
                          <div className="flex justify-end">
                            <Pill tone={netTone}>{money(c.net, t.currency)}</Pill>
                          </div>
                          <div className="mt-2 flex justify-end gap-2">
                            <Btn variant="ghost" onClick={() => openInvoice(t)} disabled={t.type !== "Income"}>
                              Invoice
                            </Btn>
                            <Btn variant="outline" onClick={() => openEditTx(t)} disabled={!canEdit}>
                              Edit
                            </Btn>
                            <Btn variant="danger" onClick={() => deleteTx(t.id)} disabled={!canEdit}>
                              Delete
                            </Btn>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* BUDGETS */}
        {tab === "Budgets" ? (
          <div className="grid gap-4">
            <Card
              title="Budgets (Monthly)"
              right={
                <div className="flex gap-2">
                  <Btn onClick={openNewBudget} disabled={!canEdit}>
                    + New Budget
                  </Btn>
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Kpi label="Current Month" value={monthNow} />
                <Kpi label="Fixed Cost (Current)" value={money(kpis.fixed, baseCurrency)} />
                <Kpi label="Runway" value={`${kpis.runwayMonths.toFixed(1)} months`} />
              </div>
            </Card>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="grid grid-cols-12 border-b border-white/10 bg-black/60 px-3 py-2 text-xs text-white/60">
                <div className="col-span-2">Month</div>
                <div className="col-span-3">Targets</div>
                <div className="col-span-3">Fixed Costs</div>
                <div className="col-span-2">Actual (Month)</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {budgets.length === 0 ? (
                <div className="p-6 text-sm text-white/60">No budgets. Create one for {monthNow}.</div>
              ) : (
                <div className="divide-y divide-white/10">
                  {budgets
                    .slice()
                    .sort((a, b) => b.month.localeCompare(a.month))
                    .map((b) => {
                      const monthTx = txs.filter((t) => t.date.slice(0, 7) === b.month && t.status !== "Cancelled");
                      const actIncome = monthTx.filter((t) => t.type === "Income").reduce((s, t) => s + calcTotals(t).net, 0);
                      const actExpense = monthTx.filter((t) => t.type === "Expense").reduce((s, t) => s + calcTotals(t).net, 0);
                      const fixed =
                        b.fixedCosts.officeRentUtilities +
                        b.fixedCosts.salaries +
                        b.fixedCosts.marketing +
                        b.fixedCosts.internetMisc +
                        b.fixedCosts.transportLogistics +
                        b.fixedCosts.adminCompliance;

                      return (
                        <div key={b.id} className="grid grid-cols-12 items-center px-3 py-3 hover:bg-black/50 transition">
                          <div className="col-span-2">
                            <div className="text-sm font-semibold">{b.month}</div>
                            <div className="mt-1 text-xs text-white/50">{b.currency}</div>
                          </div>
                          <div className="col-span-3 text-xs text-white/75">
                            <div>Revenue: <b>{money(b.revenueTarget, b.currency)}</b></div>
                            <div>Expense Cap: <b>{money(b.expenseCap, b.currency)}</b></div>
                            <div>GM Target: <b>{b.grossMarginTargetPct}%</b></div>
                          </div>
                          <div className="col-span-3 text-xs text-white/75">
                            <div>Fixed Total: <b>{money(fixed, b.currency)}</b></div>
                            <div className="text-white/50">Salaries: {money(b.fixedCosts.salaries, b.currency)}</div>
                          </div>
                          <div className="col-span-2 text-xs text-white/75">
                            <div>Income: <b>{money(actIncome, b.currency)}</b></div>
                            <div>Expense: <b>{money(actExpense, b.currency)}</b></div>
                          </div>
                          <div className="col-span-2 flex justify-end gap-2">
                            <Btn variant="outline" onClick={() => openEditBudget(b)} disabled={!canEdit}>
                              Edit
                            </Btn>
                            <Btn variant="danger" onClick={() => deleteBudget(b.id)} disabled={!canEdit}>
                              Delete
                            </Btn>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* AR/AP */}
        {tab === "AR/AP" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Receivables (AR) by Client" right={<Pill>{money(kpis.ar, baseCurrency)}</Pill>}>
              <div className="grid gap-2">
                {arap.byClient.length === 0 ? (
                  <div className="text-sm text-white/60">No receivables.</div>
                ) : (
                  arap.byClient.slice(0, 20).map((x) => (
                    <div key={x.name} className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">{x.name}</div>
                        <div className="text-sm font-semibold">{money(x.total, baseCurrency)}</div>
                      </div>
                      <div className="mt-1 text-xs text-white/55">
                        Overdue: {money(x.overdue, baseCurrency)} • Next due: {x.nextDue || "—"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card title="Payables (AP) by Vendor" right={<Pill>{money(kpis.ap, baseCurrency)}</Pill>}>
              <div className="grid gap-2">
                {arap.byVendor.length === 0 ? (
                  <div className="text-sm text-white/60">No payables.</div>
                ) : (
                  arap.byVendor.slice(0, 20).map((x) => (
                    <div key={x.name} className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">{x.name}</div>
                        <div className="text-sm font-semibold">{money(x.total, baseCurrency)}</div>
                      </div>
                      <div className="mt-1 text-xs text-white/55">
                        Overdue: {money(x.overdue, baseCurrency)} • Next due: {x.nextDue || "—"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        ) : null}

        {/* REPORTS */}
        {tab === "Reports" ? (
          <div className="grid gap-4">
            <Card title="Monthly P&L (Last 12 months)" right={<Pill>{baseCurrency}</Pill>}>
              <div className="grid gap-2">
                {monthSeries.length === 0 ? (
                  <div className="text-sm text-white/60">No data.</div>
                ) : (
                  monthSeries.map((m) => {
                    const max = Math.max(...monthSeries.map((x) => Math.max(x.inc, x.exp, Math.abs(x.net))), 1);
                    return (
                      <div key={m.month} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm font-semibold">{m.month}</div>
                          <div className="flex gap-2">
                            <Pill tone="good">Income {money(m.inc, baseCurrency)}</Pill>
                            <Pill tone="bad">Expense {money(m.exp, baseCurrency)}</Pill>
                            <Pill tone={m.net >= 0 ? "good" : "bad"}>Net {money(m.net, baseCurrency)}</Pill>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          <ProgressRow label="Income" value={m.inc} max={max} right={`${Math.round((m.inc / max) * 100)}%`} />
                          <ProgressRow label="Expense" value={m.exp} max={max} right={`${Math.round((m.exp / max) * 100)}%`} />
                          <ProgressRow label={m.net >= 0 ? "Profit" : "Loss"} value={Math.abs(m.net)} max={max} right={`${Math.round((Math.abs(m.net) / max) * 100)}%`} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>
        ) : null}

        {/* IMPORT/EXPORT */}
        {tab === "Import/Export" ? (
          <div className="grid gap-4">
            <Card title="Import / Export (CSV / JSON)" right={<Pill tone="warn">CEO / Editors only import</Pill>}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs text-white/60">Paste CSV or JSON</div>
                  <TextArea value={importText} onChange={setImportText} rows={14} placeholder="Paste CSV/JSON..." />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn onClick={importJSONBackup} disabled={!canEdit}>
                      Import JSON
                    </Btn>
                    <Btn onClick={importCSVText} disabled={!canEdit}>
                      Import CSV
                    </Btn>
                    <Btn variant="outline" onClick={() => setImportText("")}>
                      Clear
                    </Btn>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-white/60">Upload file</div>
                  <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-4">
                    <input
                      type="file"
                      accept=".csv,.json,text/plain"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f);
                      }}
                    />
                    <div className="mt-3 text-xs text-white/55">
                      Supported CSV headers:
                      <div className="mt-2 rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-white/70">
                        {CSV_HEADERS.join(", ")}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn variant="outline" onClick={() => exportCSV("all")}>
                      Export CSV (All)
                    </Btn>
                    <Btn variant="outline" onClick={() => exportExcelXls("all")}>
                      Export Excel (All)
                    </Btn>
                    <Btn variant="outline" onClick={exportJSONBackup}>
                      Export JSON
                    </Btn>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ) : null}

        {/* AUDIT */}
        {tab === "Audit" ? (
          <div className="grid gap-4">
            <Card title="Audit Log" right={<Pill>Entries {audit.length}</Pill>}>
              <div className="grid gap-2">
                {audit.length === 0 ? (
                  <div className="text-sm text-white/60">No audit entries yet.</div>
                ) : (
                  audit.slice(0, 150).map((a) => (
                    <div key={a.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm">
                          <b>{a.action}</b> • {a.actorRole} {a.actorEmail ? `(${a.actorEmail})` : ""}
                        </div>
                        <div className="text-xs text-white/55">{new Date(a.at).toLocaleString()}</div>
                      </div>
                      <div className="mt-1 text-sm text-white/85">{a.details}</div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        ) : null}

        {/* SETTINGS */}
        {tab === "Settings" ? (
          <div className="grid gap-4">
            <Card title="Finance Settings" right={<Pill>{isCEO ? "CEO" : "Staff"}</Pill>}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <div className="text-xs text-white/60">Default Currency</div>
                  <Select
                    value={settings.defaultCurrency}
                    disabled={!isCEO}
                    onChange={(v) => updateSettings({ defaultCurrency: v as Currency })}
                    options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  />
                </div>

                <div>
                  <div className="text-xs text-white/60">Overdue rule (days after due date)</div>
                  <Input
                    value={String(settings.overdueRuleDays)}
                    disabled={!isCEO}
                    onChange={(v) => updateSettings({ overdueRuleDays: clamp(parseNum(v, 0), 0, 60) })}
                    type="number"
                  />
                </div>

                <div>
                  <div className="text-xs text-white/60">Show GST</div>
                  <Select
                    value={settings.showGst ? "true" : "false"}
                    disabled={!isCEO}
                    onChange={(v) => updateSettings({ showGst: v === "true" })}
                    options={[
                      { value: "true", label: "Enabled" },
                      { value: "false", label: "Disabled" },
                    ]}
                  />
                </div>

                <div>
                  <div className="text-xs text-white/60">Show TDS</div>
                  <Select
                    value={settings.showTds ? "true" : "false"}
                    disabled={!isCEO}
                    onChange={(v) => updateSettings({ showTds: v === "true" })}
                    options={[
                      { value: "true", label: "Enabled" },
                      { value: "false", label: "Disabled" },
                    ]}
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="text-xs text-white/60">Lock Staff edits</div>
                  <Select
                    value={settings.lockStaffEdits ? "true" : "false"}
                    disabled={!isCEO}
                    onChange={(v) => updateSettings({ lockStaffEdits: v === "true" })}
                    options={[
                      { value: "true", label: "Locked (Staff view-only)" },
                      { value: "false", label: "Unlocked (Staff can edit)" },
                    ]}
                  />
                  <div className="mt-2 text-xs text-white/50">When locked, Staff can view/export but cannot add/edit/delete/import.</div>
                </div>
              </div>
            </Card>
          </div>
        ) : null}
      </div>

      {/* =========================
         TX MODAL
      ========================= */}
      <Modal
        open={openTxModal}
        title={editingTx ? (txs.some((x) => x.id === editingTx.id) ? "Edit Transaction" : "New Transaction") : "Transaction"}
        onClose={() => {
          setOpenTxModal(false);
          setEditingTx(null);
        }}
        footer={
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/55">{canEdit ? "Editing enabled" : "Editing locked (Staff)"}</div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => { setOpenTxModal(false); setEditingTx(null); }}>
                Cancel
              </Btn>
              <Btn onClick={() => editingTx && saveTx(editingTx)} disabled={!canEdit}>
                Save
              </Btn>
            </div>
          </div>
        }
      >
        {editingTx ? (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <div className="text-xs text-white/60">Date</div>
                <Input value={editingTx.date} onChange={(v) => setEditingTx({ ...editingTx, date: v })} type="date" disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Type</div>
                <Select
                  value={editingTx.type}
                  onChange={(v) => setEditingTx({ ...editingTx, type: asTxType(v) })}
                  options={TX_TYPES.map((t) => ({ value: t, label: t }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <div className="text-xs text-white/60">Status</div>
                <Select
                  value={editingTx.status}
                  onChange={(v) => setEditingTx({ ...editingTx, status: asTxStatus(v) })}
                  options={TX_STATUSES.map((s) => ({ value: s, label: s }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <div className="text-xs text-white/60">Currency</div>
                <Select
                  value={editingTx.currency}
                  onChange={(v) => setEditingTx({ ...editingTx, currency: asCurrency(v, baseCurrency) })}
                  options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <div className="text-xs text-white/60">Amount</div>
                <Input value={String(editingTx.amount)} onChange={(v) => setEditingTx({ ...editingTx, amount: parseNum(v, 0) })} type="number" disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Category</div>
                <Select
                  value={editingTx.category}
                  onChange={(v) => setEditingTx({ ...editingTx, category: asTag(v) })}
                  options={TAGS.map((c) => ({ value: c, label: c }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <div className="text-xs text-white/60">Subcategory</div>
                <Input value={editingTx.subcategory || ""} onChange={(v) => setEditingTx({ ...editingTx, subcategory: v })} disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Payment Method</div>
                <Select
                  value={editingTx.paymentMethod}
                  onChange={(v) => setEditingTx({ ...editingTx, paymentMethod: asMethod(v) })}
                  options={METHODS.map((m) => ({ value: m, label: m }))}
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-white/60">Description</div>
                <Input value={editingTx.description} onChange={(v) => setEditingTx({ ...editingTx, description: v })} disabled={!canEdit} placeholder="What is this for?" />
              </div>
              <div>
                <div className="text-xs text-white/60">{editingTx.type === "Income" ? "Client Name" : "Vendor Name"}</div>
                <Input
                  value={editingTx.type === "Income" ? editingTx.clientName || "" : editingTx.vendorName || ""}
                  onChange={(v) =>
                    setEditingTx(editingTx.type === "Income" ? { ...editingTx, clientName: v } : { ...editingTx, vendorName: v })
                  }
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <div className="text-xs text-white/60">Event Title</div>
                <Input value={editingTx.eventTitle || ""} onChange={(v) => setEditingTx({ ...editingTx, eventTitle: v })} disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Invoice No</div>
                <Input value={editingTx.invoiceNo || ""} onChange={(v) => setEditingTx({ ...editingTx, invoiceNo: v })} disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Reference ID</div>
                <Input value={editingTx.referenceId || ""} onChange={(v) => setEditingTx({ ...editingTx, referenceId: v })} disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Due Date</div>
                <Input value={editingTx.dueDate || ""} onChange={(v) => setEditingTx({ ...editingTx, dueDate: v })} type="date" disabled={!canEdit} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {settings.showGst ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs text-white/60">GST</div>
                  <div className="mt-2 grid gap-2">
                    <Input
                      value={String(editingTx.gstRate ?? 0)}
                      onChange={(v) => setEditingTx({ ...editingTx, gstRate: clamp(parseNum(v, 0), 0, 28) })}
                      type="number"
                      disabled={!canEdit}
                      placeholder="GST rate %"
                    />
                    <label className="flex items-center gap-2 text-xs text-white/65">
                      <input
                        type="checkbox"
                        checked={!!editingTx.gstIncluded}
                        onChange={(e) => setEditingTx({ ...editingTx, gstIncluded: e.target.checked })}
                        disabled={!canEdit}
                      />
                      GST included in amount
                    </label>
                  </div>
                </div>
              ) : (
                <div />
              )}

              {settings.showTds ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs text-white/60">TDS</div>
                  <div className="mt-2">
                    <Input
                      value={String(editingTx.tdsRate ?? 0)}
                      onChange={(v) => setEditingTx({ ...editingTx, tdsRate: clamp(parseNum(v, 0), 0, 20) })}
                      type="number"
                      disabled={!canEdit}
                      placeholder="TDS rate %"
                    />
                  </div>
                </div>
              ) : (
                <div />
              )}

              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="text-xs text-white/60">Recurring</div>
                <div className="mt-2 grid gap-2">
                  <label className="flex items-center gap-2 text-xs text-white/65">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={!!editingTx.recurring?.enabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        if (!enabled) setEditingTx({ ...editingTx, recurring: undefined });
                        else setEditingTx({ ...editingTx, recurring: { enabled: true, freq: "Monthly", nextRun: addMonths(todayYMD, 1) } });
                      }}
                    />
                    Enable recurring
                  </label>

                  <Select
                    value={editingTx.recurring?.freq || "Monthly"}
                    disabled={!canEdit || !editingTx.recurring?.enabled}
                    onChange={(v) => {
                      const freq: RecurringFreq = RECUR_FREQS.includes(v as any) ? (v as RecurringFreq) : "Monthly";
                      setEditingTx({ ...editingTx, recurring: { enabled: true, freq, nextRun: editingTx.recurring?.nextRun || addMonths(todayYMD, 1) } });
                    }}
                    options={RECUR_FREQS.map((f) => ({ value: f, label: f }))}
                  />
                  <Input
                    value={editingTx.recurring?.nextRun || ""}
                    disabled={!canEdit || !editingTx.recurring?.enabled}
                    onChange={(v) => setEditingTx({ ...editingTx, recurring: { enabled: true, freq: editingTx.recurring?.freq || "Monthly", nextRun: v } })}
                    type="date"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-white/60">Notes</div>
              <TextArea value={editingTx.notes || ""} onChange={(v) => setEditingTx({ ...editingTx, notes: v })} rows={4} disabled={!canEdit} />
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">Computed</div>
                <Pill>
                  {(() => {
                    const c = calcTotals(editingTx);
                    return `Net: ${money(c.net, editingTx.currency)}`;
                  })()}
                </Pill>
              </div>
              <div className="mt-2 text-xs text-white/60">
                {(() => {
                  const c = calcTotals(editingTx);
                  return `Base ${money(c.base, editingTx.currency)} • GST ${money(c.gstAdd, editingTx.currency)} • TDS -${money(c.tds, editingTx.currency)}`;
                })()}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* =========================
         BUDGET MODAL
      ========================= */}
      <Modal
        open={openBudgetModal}
        title={editingBudget ? `Budget • ${editingBudget.month}` : "Budget"}
        onClose={() => {
          setOpenBudgetModal(false);
          setEditingBudget(null);
        }}
        footer={
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/55">{canEdit ? "Editing enabled" : "Editing locked (Staff)"}</div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => { setOpenBudgetModal(false); setEditingBudget(null); }}>
                Cancel
              </Btn>
              <Btn onClick={() => editingBudget && saveBudget(editingBudget)} disabled={!canEdit}>
                Save Budget
              </Btn>
            </div>
          </div>
        }
      >
        {editingBudget ? (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-xs text-white/60">Month</div>
                <Input value={editingBudget.month} onChange={(v) => setEditingBudget({ ...editingBudget, month: v })} disabled={!canEdit} placeholder="YYYY-MM" />
              </div>
              <div>
                <div className="text-xs text-white/60">Currency</div>
                <Select value={editingBudget.currency} onChange={(v) => setEditingBudget({ ...editingBudget, currency: asCurrency(v, baseCurrency) })} options={CURRENCIES.map((c) => ({ value: c, label: c }))} disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">GM Target %</div>
                <Input value={String(editingBudget.grossMarginTargetPct)} onChange={(v) => setEditingBudget({ ...editingBudget, grossMarginTargetPct: clamp(parseNum(v, 25), 0, 80) })} type="number" disabled={!canEdit} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-white/60">Revenue Target</div>
                <Input value={String(editingBudget.revenueTarget)} onChange={(v) => setEditingBudget({ ...editingBudget, revenueTarget: parseNum(v, 0) })} type="number" disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Expense Cap</div>
                <Input value={String(editingBudget.expenseCap)} onChange={(v) => setEditingBudget({ ...editingBudget, expenseCap: parseNum(v, 0) })} type="number" disabled={!canEdit} />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-sm font-semibold">Fixed Costs</div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {(
                  [
                    ["officeRentUtilities", "Office Rent & Utilities"],
                    ["salaries", "Salaries"],
                    ["marketing", "Marketing"],
                    ["internetMisc", "Internet & Misc"],
                    ["transportLogistics", "Transport & Logistics"],
                    ["adminCompliance", "Admin & Compliance"],
                  ] as Array<[keyof BudgetLine["fixedCosts"], string]>
                ).map(([k, label]) => (
                  <div key={k}>
                    <div className="text-xs text-white/60">{label}</div>
                    <Input
                      value={String(editingBudget.fixedCosts[k])}
                      onChange={(v) => setEditingBudget({ ...editingBudget, fixedCosts: { ...editingBudget.fixedCosts, [k]: parseNum(v, 0) } })}
                      type="number"
                      disabled={!canEdit}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs text-white/60">Notes</div>
              <TextArea value={editingBudget.notes || ""} onChange={(v) => setEditingBudget({ ...editingBudget, notes: v })} rows={4} disabled={!canEdit} />
            </div>
          </div>
        ) : null}
      </Modal>

      {/* =========================
         INVOICE MODAL
      ========================= */}
      <Modal
        open={openInvoiceModal}
        title="Invoice Preview"
        onClose={() => {
          setOpenInvoiceModal(false);
          setInvoiceTx(null);
        }}
        footer={
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/55">Printable invoice for Income transactions</div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => setOpenInvoiceModal(false)}>
                Close
              </Btn>
              <Btn onClick={printInvoice} disabled={!invoiceTx || invoiceTx.type !== "Income"}>
                Print
              </Btn>
            </div>
          </div>
        }
      >
        {invoiceTx ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-base font-semibold">Eventura — Invoice</div>
                <div className="text-xs text-white/60">Date: {invoiceTx.date}</div>
              </div>
              <div className="flex gap-2">
                <Pill>{invoiceTx.status}</Pill>
                <Pill>{invoiceTx.currency}</Pill>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="text-xs text-white/60">Billed To</div>
                <div className="text-sm font-semibold">{invoiceTx.clientName || "Client"}</div>
                <div className="text-xs text-white/55">{invoiceTx.eventTitle || ""}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="text-xs text-white/60">Details</div>
                <div className="text-sm font-semibold">{invoiceTx.description}</div>
                <div className="text-xs text-white/55">
                  Category: {invoiceTx.category}
                  {invoiceTx.subcategory ? ` / ${invoiceTx.subcategory}` : ""}
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-sm">
              {(() => {
                const c = calcTotals(invoiceTx);
                return (
                  <div className="grid gap-1">
                    <div className="flex justify-between"><span>Base</span><b>{money(c.base, invoiceTx.currency)}</b></div>
                    <div className="flex justify-between"><span>GST</span><b>{money(c.gstAdd, invoiceTx.currency)}</b></div>
                    <div className="flex justify-between"><span>TDS</span><b>-{money(c.tds, invoiceTx.currency)}</b></div>
                    <div className="mt-2 flex justify-between text-base"><span>Net Total</span><b>{money(c.net, invoiceTx.currency)}</b></div>
                  </div>
                );
              })()}
            </div>

            <div className="mt-2 text-xs text-white/55">
              Invoice No: {invoiceTx.invoiceNo || "—"} • Reference: {invoiceTx.referenceId || "—"}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}