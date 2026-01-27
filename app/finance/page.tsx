// app/finance/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* =========================================================
   Eventura Finance — Airtable-style LAYOUT (Sidebar + Toolbar)
   Deploy-safe: no external libs, strict typing, localStorage.
========================================================= */

/* =========================
   STORAGE KEYS
========================= */
const LS_TX = "eventura_fin_tx_v5";
const LS_VIEWS = "eventura_fin_views_v5";
const LS_PREF = "eventura_fin_prefs_v5";
const DB_AUTH_ROLE = "eventura-role"; // "CEO" | "Staff"
const DB_AUTH_EMAIL = "eventura-email";

/* =========================
   TYPES (STRICT)
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

type RecurringFreq = "Weekly" | "Monthly" | "Quarterly" | "Yearly";
type Recurring = { enabled: boolean; freq: RecurringFreq; nextRun?: string };

type FinanceTx = {
  id: number;
  createdAt: string;
  updatedAt: string;

  title: string;
  date: string; // YYYY-MM-DD
  eventType: EventType;

  type: TxType;
  status: TxStatus;

  amount: number;
  currency: Currency;

  category: TxTag;
  subcategory?: string;

  clientName?: string;
  vendorName?: string;
  eventTitle?: string;

  paymentMethod: PayMethod;
  referenceId?: string;
  invoiceNo?: string;

  dueDate?: string;

  gstRate?: number;
  gstIncluded?: boolean;

  tdsRate?: number;

  recurring?: Recurring;

  notes?: string;
};

type Layout = "Gallery" | "Table" | "Calendar" | "Reports";

type SortKey = "date" | "amount" | "status" | "category" | "title";
type SortDir = "asc" | "desc";

type ColorBy = "None" | "Status" | "Category" | "Type";

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
  from: string;
  to: string;

  sortKey: SortKey;
  sortDir: SortDir;

  visibleFields: Array<
    | "date"
    | "amount"
    | "status"
    | "type"
    | "category"
    | "eventType"
    | "clientVendor"
    | "eventTitle"
    | "invoice"
    | "dueDate"
  >;
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
const RECUR_FREQS: RecurringFreq[] = ["Weekly", "Monthly", "Quarterly", "Yearly"];

/* =========================
   SAFE COERCION
========================= */
function asRole(v: any): Role {
  return String(v).toUpperCase() === "STAFF" ? "Staff" : "CEO";
}
function asTxType(v: any): TxType {
  return TX_TYPES.includes(v) ? v : "Expense";
}
function asTxStatus(v: any): TxStatus {
  return TX_STATUSES.includes(v) ? v : "Planned";
}
function asCurrency(v: any): Currency {
  return CURRENCIES.includes(v) ? v : "INR";
}
function asMethod(v: any): PayMethod {
  return METHODS.includes(v) ? v : "Bank";
}
function asTag(v: any): TxTag {
  return TAGS.includes(v) ? v : "Other";
}
function asEventType(v: any): EventType {
  return EVENT_TYPES.includes(v) ? v : "Other";
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
function money(n: number, cur: Currency) {
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

/* =========================
   UI PRIMITIVES (black hover)
========================= */
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
  return <span className={cls("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px]", m)}>{children}</span>;
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
   VIEW DEFAULTS
========================= */
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
    eventType: "All",
    from: "",
    to: "",
    sortKey: "date",
    sortDir: "desc",
    visibleFields: ["date", "amount", "status", "category", "eventType", "clientVendor"],
    colorBy: "Status",
  };
}
function makeId() {
  return Math.random().toString(36).slice(2, 9) + "_" + Date.now().toString(36);
}

/* =========================
   NORMALIZE TX
========================= */
function normalizeTx(raw: any): FinanceTx | null {
  if (!raw || typeof raw !== "object") return null;
  const id = parseNum((raw as any).id, 0);
  if (!id) return null;

  const date = typeof (raw as any).date === "string" && (raw as any).date ? (raw as any).date : toYMD(new Date());
  const createdAt = typeof (raw as any).createdAt === "string" ? (raw as any).createdAt : nowISO();
  const updatedAt = typeof (raw as any).updatedAt === "string" ? (raw as any).updatedAt : nowISO();

  const tx: FinanceTx = {
    id,
    createdAt,
    updatedAt,

    title: String((raw as any).title ?? (raw as any).description ?? "Untitled"),
    date,
    eventType: asEventType((raw as any).eventType),

    type: asTxType((raw as any).type),
    status: asTxStatus((raw as any).status),

    amount: parseNum((raw as any).amount, 0),
    currency: asCurrency((raw as any).currency),

    category: asTag((raw as any).category),
    subcategory: typeof (raw as any).subcategory === "string" ? (raw as any).subcategory : undefined,

    clientName: typeof (raw as any).clientName === "string" ? (raw as any).clientName : undefined,
    vendorName: typeof (raw as any).vendorName === "string" ? (raw as any).vendorName : undefined,
    eventTitle: typeof (raw as any).eventTitle === "string" ? (raw as any).eventTitle : undefined,

    paymentMethod: asMethod((raw as any).paymentMethod),
    referenceId: typeof (raw as any).referenceId === "string" ? (raw as any).referenceId : undefined,
    invoiceNo: typeof (raw as any).invoiceNo === "string" ? (raw as any).invoiceNo : undefined,

    dueDate: typeof (raw as any).dueDate === "string" ? (raw as any).dueDate : undefined,

    gstRate: (raw as any).gstRate == null ? undefined : clamp(parseNum((raw as any).gstRate, 0), 0, 28),
    gstIncluded: typeof (raw as any).gstIncluded === "boolean" ? (raw as any).gstIncluded : undefined,

    tdsRate: (raw as any).tdsRate == null ? undefined : clamp(parseNum((raw as any).tdsRate, 0), 0, 20),

    recurring: asRecurring((raw as any).recurring),

    notes: typeof (raw as any).notes === "string" ? (raw as any).notes : undefined,
  };

  return tx;
}

/* =========================
   CARD COVER (SVG)
========================= */
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
function Cover({ seed, tone }: { seed: string; tone: string }) {
  const h = Math.abs(hash(seed + tone)) % 360;
  const h2 = (h + 40) % 360;
  const bg1 = `hsl(${h} 70% 45%)`;
  const bg2 = `hsl(${h2} 70% 55%)`;
  return (
    <div className="relative h-24 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 240" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`g_${h}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={bg1} stopOpacity="0.95" />
            <stop offset="1" stopColor={bg2} stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <rect width="600" height="240" fill={`url(#g_${h})`} />
        <path d="M0,170 C120,120 220,220 360,160 C480,100 520,120 600,80 L600,240 L0,240 Z" fill="black" opacity="0.20" />
      </svg>
      <div className="absolute left-3 top-3">
        <Pill tone="neutral">{tone}</Pill>
      </div>
    </div>
  );
}

/* =========================
   CSV EXPORT
========================= */
const CSV_HEADERS = [
  "id",
  "title",
  "date",
  "eventType",
  "type",
  "status",
  "amount",
  "currency",
  "category",
  "subcategory",
  "clientName",
  "vendorName",
  "eventTitle",
  "paymentMethod",
  "referenceId",
  "invoiceNo",
  "dueDate",
  "gstRate",
  "gstIncluded",
  "tdsRate",
  "recurringEnabled",
  "recurringFreq",
  "recurringNextRun",
  "notes",
  "createdAt",
  "updatedAt",
] as const;

/* =========================
   PAGE
========================= */
export default function FinancePage() {
  const [mounted, setMounted] = useState(false);

  const [role, setRole] = useState<Role>("CEO");
  const [email, setEmail] = useState<string>("");

  const [txs, setTxs] = useState<FinanceTx[]>([]);
  const [views, setViews] = useState<ViewDef[]>([defaultView()]);
  const [activeViewId, setActiveViewId] = useState<string>("main");

  const [toast, setToast] = useState("");
  const toastRef = useRef<number | null>(null);

  // modals
  const [openTx, setOpenTx] = useState(false);
  const [editing, setEditing] = useState<FinanceTx | null>(null);

  const [openViewsModal, setOpenViewsModal] = useState(false);
  const [openCardFields, setOpenCardFields] = useState(false);

  const [openImport, setOpenImport] = useState(false);
  const [importText, setImportText] = useState("");

  // sidebar on mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isCEO = role === "CEO";
  const canEdit = isCEO;

  function notify(msg: string) {
    setToast(msg);
    if (toastRef.current) window.clearTimeout(toastRef.current);
    toastRef.current = window.setTimeout(() => setToast(""), 1800);
  }

  /* ===== LOAD ===== */
  useEffect(() => {
    setMounted(true);

    const loadedRole = asRole(localStorage.getItem(DB_AUTH_ROLE));
    const loadedEmail = localStorage.getItem(DB_AUTH_EMAIL) || "";
    setRole(loadedRole);
    setEmail(loadedEmail);

    const rawTx = safeJsonParse<any[]>(localStorage.getItem(LS_TX), []);
    const norm: FinanceTx[] = Array.isArray(rawTx) ? rawTx.map((t) => normalizeTx(t)).filter((x): x is FinanceTx => !!x) : [];
    setTxs(norm);

    const rawViews = safeJsonParse<any[]>(localStorage.getItem(LS_VIEWS), []);
    if (Array.isArray(rawViews) && rawViews.length > 0) {
      const safeViews: ViewDef[] = rawViews
        .filter((v) => v && typeof v === "object")
        .map((v) => {
          const base = defaultView();
          const vv: any = v;
          const layout: Layout = ["Gallery", "Table", "Calendar", "Reports"].includes(vv.layout) ? vv.layout : "Gallery";
          const sortKey: SortKey = ["date", "amount", "status", "category", "title"].includes(vv.sortKey) ? vv.sortKey : "date";
          const sortDir: SortDir = vv.sortDir === "asc" ? "asc" : "desc";
          const colorBy: ColorBy = ["None", "Status", "Category", "Type"].includes(vv.colorBy) ? vv.colorBy : "Status";
          const visibleFields = Array.isArray(vv.visibleFields)
            ? (vv.visibleFields.filter((x: any) =>
                ["date", "amount", "status", "type", "category", "eventType", "clientVendor", "eventTitle", "invoice", "dueDate"].includes(
                  x
                )
              ) as ViewDef["visibleFields"])
            : base.visibleFields;

          return {
            ...base,
            id: typeof vv.id === "string" ? vv.id : makeId(),
            name: typeof vv.name === "string" ? vv.name : "View",
            layout,
            q: typeof vv.q === "string" ? vv.q : "",
            type: vv.type === "Income" || vv.type === "Expense" || vv.type === "All" ? vv.type : "All",
            status: TX_STATUSES.includes(vv.status) || vv.status === "All" ? vv.status : "All",
            category: TAGS.includes(vv.category) || vv.category === "All" ? vv.category : "All",
            currency: CURRENCIES.includes(vv.currency) || vv.currency === "All" ? vv.currency : "All",
            eventType: EVENT_TYPES.includes(vv.eventType) || vv.eventType === "All" ? vv.eventType : "All",
            from: typeof vv.from === "string" ? vv.from : "",
            to: typeof vv.to === "string" ? vv.to : "",
            sortKey,
            sortDir,
            visibleFields: visibleFields.length ? visibleFields : base.visibleFields,
            colorBy,
          };
        });

      setViews(safeViews);

      const pref = safeJsonParse<{ activeViewId?: string }>(localStorage.getItem(LS_PREF), {});
      const av = pref.activeViewId && safeViews.some((x) => x.id === pref.activeViewId) ? pref.activeViewId : safeViews[0].id;
      setActiveViewId(av);
    } else {
      setViews([defaultView()]);
      setActiveViewId("main");
    }
  }, []);

  /* ===== SAVE ===== */
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS_TX, JSON.stringify(txs));
    } catch {}
  }, [txs, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS_VIEWS, JSON.stringify(views));
      localStorage.setItem(LS_PREF, JSON.stringify({ activeViewId }));
    } catch {}
  }, [views, activeViewId, mounted]);

  /* ===== ACTIVE VIEW ===== */
  const activeView = useMemo(() => views.find((v) => v.id === activeViewId) || views[0] || defaultView(), [views, activeViewId]);

  /* ===== FILTERED / SORTED ===== */
  const filtered = useMemo(() => {
    const v = activeView;
    const qq = v.q.trim().toLowerCase();

    let rows = txs.filter((t) => {
      if (v.type !== "All" && t.type !== v.type) return false;
      if (v.status !== "All" && t.status !== v.status) return false;
      if (v.category !== "All" && t.category !== v.category) return false;
      if (v.currency !== "All" && t.currency !== v.currency) return false;
      if (v.eventType !== "All" && t.eventType !== v.eventType) return false;
      if (v.from && t.date < v.from) return false;
      if (v.to && t.date > v.to) return false;

      if (!qq) return true;
      const blob = [
        t.title,
        t.eventTitle,
        t.clientName,
        t.vendorName,
        t.category,
        t.status,
        t.type,
        t.invoiceNo,
        t.referenceId,
        t.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(qq);
    });

    rows.sort((a, b) => {
      const dir = v.sortDir === "asc" ? 1 : -1;
      if (v.sortKey === "date") return dir * a.date.localeCompare(b.date);
      if (v.sortKey === "amount") return dir * (a.amount - b.amount);
      if (v.sortKey === "status") return dir * a.status.localeCompare(b.status);
      if (v.sortKey === "category") return dir * a.category.localeCompare(b.category);
      return dir * a.title.localeCompare(b.title);
    });

    return rows;
  }, [txs, activeView]);

  /* ===== KPI ===== */
  const monthNow = toYM(new Date());
  const kpi = useMemo(() => {
    const monthRows = txs.filter((t) => t.date.slice(0, 7) === monthNow && t.status !== "Cancelled");
    const inc = monthRows.filter((t) => t.type === "Income").reduce((s, t) => s + t.amount, 0);
    const exp = monthRows.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
    const net = inc - exp;

    const ar = txs
      .filter((t) => t.type === "Income" && (t.status === "Planned" || t.status === "Pending" || t.status === "Overdue"))
      .reduce((s, t) => s + t.amount, 0);

    const ap = txs
      .filter((t) => t.type === "Expense" && (t.status === "Planned" || t.status === "Pending" || t.status === "Overdue"))
      .reduce((s, t) => s + t.amount, 0);

    const overdue = txs.filter((t) => t.status === "Overdue").length;

    return { inc, exp, net, ar, ap, overdue };
  }, [txs, monthNow]);

  /* ===== AUTO OVERDUE ===== */
  useEffect(() => {
    if (!mounted) return;
    const today = toYMD(new Date());
    let changed = false;

    const next: FinanceTx[] = txs.map((t) => {
      if (t.status === "Paid" || t.status === "Cancelled") return t;
      if (!t.dueDate) return t;
      if (t.dueDate <= today && t.status !== "Overdue") {
        const dd = daysBetween(t.dueDate, today);
        if (dd >= 1) {
          changed = true;
          return { ...t, status: "Overdue", updatedAt: nowISO() };
        }
      }
      return t;
    });

    if (changed) setTxs(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  /* =========================
     ACTIONS
  ========================= */
  function updateActiveView(patch: Partial<ViewDef>) {
    setViews((prev) => prev.map((x) => (x.id === activeViewId ? { ...x, ...patch } : x)));
  }

  function openNewTx() {
    const today = toYMD(new Date());
    const tx: FinanceTx = {
      id: Date.now(),
      createdAt: nowISO(),
      updatedAt: nowISO(),

      title: "",
      date: today,
      eventType: "Other",

      type: "Expense",
      status: "Planned",

      amount: 0,
      currency: "INR",

      category: "Other",
      subcategory: "",

      clientName: "",
      vendorName: "",
      eventTitle: "",

      paymentMethod: "Bank",
      referenceId: "",
      invoiceNo: "",

      dueDate: "",

      gstRate: 0,
      gstIncluded: false,

      tdsRate: 0,

      recurring: undefined,
      notes: "",
    };
    setEditing(tx);
    setOpenTx(true);
  }

  function openEditTx(t: FinanceTx) {
    setEditing({
      ...t,
      recurring: t.recurring ? { ...t.recurring } : undefined,
    });
    setOpenTx(true);
  }

  function saveTx(tx: FinanceTx) {
    if (!canEdit) return notify("Only CEO can edit.");
    if (!tx.title.trim()) return notify("Title required.");

    const clean: FinanceTx = {
      ...tx,
      updatedAt: nowISO(),
      title: String(tx.title || "").trim(),
      date: String(tx.date || toYMD(new Date())),
      eventType: asEventType(tx.eventType),
      type: asTxType(tx.type),
      status: asTxStatus(tx.status),
      amount: parseNum(tx.amount, 0),
      currency: asCurrency(tx.currency),
      category: asTag(tx.category),
      paymentMethod: asMethod(tx.paymentMethod),
      gstRate: tx.gstRate == null ? undefined : clamp(parseNum(tx.gstRate, 0), 0, 28),
      tdsRate: tx.tdsRate == null ? undefined : clamp(parseNum(tx.tdsRate, 0), 0, 20),
      gstIncluded: !!tx.gstIncluded,
      recurring: asRecurring(tx.recurring),
      subcategory: tx.subcategory ? String(tx.subcategory) : undefined,
      clientName: tx.clientName ? String(tx.clientName) : undefined,
      vendorName: tx.vendorName ? String(tx.vendorName) : undefined,
      eventTitle: tx.eventTitle ? String(tx.eventTitle) : undefined,
      referenceId: tx.referenceId ? String(tx.referenceId) : undefined,
      invoiceNo: tx.invoiceNo ? String(tx.invoiceNo) : undefined,
      dueDate: tx.dueDate ? String(tx.dueDate) : undefined,
      notes: tx.notes ? String(tx.notes) : undefined,
    };

    setTxs((prev) => {
      const exists = prev.some((p) => p.id === clean.id);
      return exists ? prev.map((p) => (p.id === clean.id ? clean : p)) : [clean, ...prev];
    });

    notify("Saved");
    setOpenTx(false);
    setEditing(null);
  }

  function deleteTx(id: number) {
    if (!canEdit) return notify("Only CEO can edit.");
    setTxs((prev) => prev.filter((p) => p.id !== id));
    notify("Deleted");
  }

  function exportCSV() {
    const rows = filtered.slice().sort((a, b) => a.date.localeCompare(b.date));
    const head = CSV_HEADERS.join(",");
    const lines = [head];

    for (const t of rows) {
      const vals = [
        t.id,
        t.title,
        t.date,
        t.eventType,
        t.type,
        t.status,
        t.amount,
        t.currency,
        t.category,
        t.subcategory ?? "",
        t.clientName ?? "",
        t.vendorName ?? "",
        t.eventTitle ?? "",
        t.paymentMethod,
        t.referenceId ?? "",
        t.invoiceNo ?? "",
        t.dueDate ?? "",
        t.gstRate ?? "",
        t.gstIncluded ? "true" : "false",
        t.tdsRate ?? "",
        t.recurring?.enabled ? "true" : "false",
        t.recurring?.freq ?? "",
        t.recurring?.nextRun ?? "",
        t.notes ?? "",
        t.createdAt,
        t.updatedAt,
      ].map(escCSV);

      lines.push(vals.join(","));
    }

    downloadText(`eventura_finance_${activeView.name.replace(/\s+/g, "_")}_${toYMD(new Date())}.csv`, lines.join("\n"), "text/csv;charset=utf-8");
    notify("CSV exported");
  }

  function exportExcelXls() {
    const rows = filtered.slice().sort((a, b) => a.date.localeCompare(b.date));
    const head = CSV_HEADERS as unknown as string[];
    const body = rows
      .map((t) => {
        const vals = [
          t.id,
          t.title,
          t.date,
          t.eventType,
          t.type,
          t.status,
          t.amount,
          t.currency,
          t.category,
          t.subcategory ?? "",
          t.clientName ?? "",
          t.vendorName ?? "",
          t.eventTitle ?? "",
          t.paymentMethod,
          t.referenceId ?? "",
          t.invoiceNo ?? "",
          t.dueDate ?? "",
          t.gstRate ?? "",
          t.gstIncluded ? "true" : "false",
          t.tdsRate ?? "",
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
    downloadText(`eventura_finance_${activeView.name.replace(/\s+/g, "_")}_${toYMD(new Date())}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
    notify("Excel exported");
  }

  function seedDemo() {
    if (!canEdit) return notify("Only CEO can edit.");
    const d = toYMD(new Date());
    const demo: FinanceTx[] = [
      {
        id: Date.now() + 1,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        title: "Wedding package (Gold) — Advance",
        date: d,
        eventType: "Wedding",
        type: "Income",
        status: "Paid",
        amount: 250000,
        currency: "INR",
        category: "ClientAdvance",
        clientName: "Client A",
        eventTitle: "Wedding — Surat",
        paymentMethod: "Bank",
        invoiceNo: "INV-0001",
        referenceId: "UTR-AXIS-1122",
        notes: "50% advance received.",
      },
      {
        id: Date.now() + 2,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        title: "Decorator vendor settlement",
        date: d,
        eventType: "Wedding",
        type: "Expense",
        status: "Pending",
        amount: 120000,
        currency: "INR",
        category: "VendorPayment",
        vendorName: "Vendor X",
        eventTitle: "Wedding — Surat",
        paymentMethod: "UPI",
        dueDate: addDays(d, 7),
      },
      {
        id: Date.now() + 3,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        title: "Meta Ads — Lead Gen",
        date: d,
        eventType: "Other",
        type: "Expense",
        status: "Paid",
        amount: 30000,
        currency: "INR",
        category: "Marketing",
        paymentMethod: "Card",
      },
      {
        id: Date.now() + 4,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        title: "Salaries (Monthly)",
        date: d,
        eventType: "Other",
        type: "Expense",
        status: "Planned",
        amount: 150000,
        currency: "INR",
        category: "Salary",
        paymentMethod: "Bank",
        recurring: { enabled: true, freq: "Monthly", nextRun: addMonths(d, 1) },
        notes: "Recurring payroll line",
      },
    ];
    setTxs((prev) => [...demo, ...prev]);
    notify("Demo added");
  }

  function createViewFromActive() {
    const v = activeView;
    const nv: ViewDef = { ...v, id: makeId(), name: v.name + " copy" };
    setViews((prev) => [nv, ...prev]);
    setActiveViewId(nv.id);
    notify("View created");
  }

  function renameActiveView(name: string) {
    updateActiveView({ name });
  }

  function deleteActiveView() {
    if (views.length <= 1) return notify("At least 1 view required.");
    const idx = views.findIndex((x) => x.id === activeViewId);
    const nextViews = views.filter((x) => x.id !== activeViewId);
    setViews(nextViews);
    const nextActive = nextViews[Math.max(0, idx - 1)]?.id || nextViews[0].id;
    setActiveViewId(nextActive);
    notify("View deleted");
  }

  /* ===== IMPORT ===== */
  function importJSON() {
    if (!canEdit) return notify("Only CEO can import.");
    try {
      const obj = JSON.parse(importText || "{}");
      const raw = Array.isArray(obj) ? obj : Array.isArray((obj as any).txs) ? (obj as any).txs : [];
      const norm: FinanceTx[] = raw.map((t: any) => normalizeTx(t)).filter((x: any) => !!x);
      if (norm.length === 0) return notify("No valid rows found.");
      setTxs((prev) => {
        const map = new Map<number, FinanceTx>();
        for (const p of prev) map.set(p.id, p);
        for (const n of norm) map.set(n.id, n);
        return Array.from(map.values());
      });
      notify(`Imported ${norm.length}`);
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

  function importCSV() {
    if (!canEdit) return notify("Only CEO can import.");
    const raw = importText || "";
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return notify("CSV needs header + rows.");

    const header = parseCSVLine(lines[0]);
    const idx = (k: string) => header.indexOf(k);
    const get = (cols: string[], k: string) => (idx(k) >= 0 ? cols[idx(k)] : "");

    const next: FinanceTx[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);

      const recEnabled = String(get(cols, "recurringEnabled")).toLowerCase() === "true";
      const recFreq = RECUR_FREQS.includes(get(cols, "recurringFreq") as any)
        ? (get(cols, "recurringFreq") as RecurringFreq)
        : "Monthly";
      const recNext = get(cols, "recurringNextRun") || "";

      const rawObj: any = {
        id: parseNum(get(cols, "id"), Date.now() + i),
        createdAt: get(cols, "createdAt") || nowISO(),
        updatedAt: nowISO(),
        title: get(cols, "title") || get(cols, "eventTitle") || "Untitled",
        date: get(cols, "date") || toYMD(new Date()),
        eventType: get(cols, "eventType") || "Other",
        type: get(cols, "type") || "Expense",
        status: get(cols, "status") || "Planned",
        amount: parseNum(get(cols, "amount"), 0),
        currency: get(cols, "currency") || "INR",
        category: get(cols, "category") || "Other",
        subcategory: get(cols, "subcategory") || undefined,
        clientName: get(cols, "clientName") || undefined,
        vendorName: get(cols, "vendorName") || undefined,
        eventTitle: get(cols, "eventTitle") || undefined,
        paymentMethod: get(cols, "paymentMethod") || "Bank",
        referenceId: get(cols, "referenceId") || undefined,
        invoiceNo: get(cols, "invoiceNo") || undefined,
        dueDate: get(cols, "dueDate") || undefined,
        gstRate: parseNum(get(cols, "gstRate"), 0),
        gstIncluded: String(get(cols, "gstIncluded")).toLowerCase() === "true",
        tdsRate: parseNum(get(cols, "tdsRate"), 0),
        recurring: recEnabled ? { enabled: true, freq: recFreq, nextRun: recNext || undefined } : undefined,
        notes: get(cols, "notes") || undefined,
      };

      const norm = normalizeTx(rawObj);
      if (norm && norm.title.trim()) next.push(norm);
    }

    if (next.length === 0) return notify("No valid rows found.");
    setTxs((prev) => {
      const map = new Map<number, FinanceTx>();
      for (const p of prev) map.set(p.id, p);
      for (const n of next) map.set(n.id, n);
      return Array.from(map.values());
    });
    notify(`Imported ${next.length}`);
  }

  function handleFileUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result || ""));
      notify("File loaded");
    };
    reader.readAsText(file);
  }

  /* =========================
     COLOR BY
  ========================= */
  function cardTone(t: FinanceTx): string {
    if (activeView.colorBy === "None") return "Eventura";
    if (activeView.colorBy === "Type") return t.type;
    if (activeView.colorBy === "Category") return t.category;
    return t.status;
  }

  /* =========================
     CALENDAR DATA
  ========================= */
  const calendar = useMemo(() => {
    const map = new Map<string, FinanceTx[]>();
    for (const t of filtered) {
      const arr = map.get(t.date) || [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return map;
  }, [filtered]);

  /* =========================
     REPORTS
  ========================= */
  const reports = useMemo(() => {
    const byCategory = new Map<string, { inc: number; exp: number }>();
    const byStatus = new Map<TxStatus, number>();
    for (const t of filtered) {
      if (t.status === "Cancelled") continue;
      const key = t.category;
      const cur = byCategory.get(key) || { inc: 0, exp: 0 };
      if (t.type === "Income") cur.inc += t.amount;
      else cur.exp += t.amount;
      byCategory.set(key, cur);
      byStatus.set(t.status, (byStatus.get(t.status) || 0) + 1);
    }
    const cats = Array.from(byCategory.entries())
      .map(([k, v]) => ({ k, inc: v.inc, exp: v.exp, net: v.inc - v.exp }))
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
    return { cats, byStatus };
  }, [filtered]);

  /* =========================
     SIDEBAR ITEM
  ========================= */
  function ViewItem({ v }: { v: ViewDef }) {
    const active = v.id === activeViewId;
    return (
      <button
        onClick={() => {
          setActiveViewId(v.id);
          setSidebarOpen(false);
        }}
        className={cls(
          "w-full rounded-xl border px-3 py-2 text-left transition",
          active ? "border-white/25 bg-white/10" : "border-white/10 bg-white/5 hover:bg-black hover:border-white/20"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-sm font-semibold text-white">{v.name}</div>
          <Pill>{v.layout}</Pill>
        </div>
        <div className="mt-1 text-[11px] text-white/55 truncate">
          {v.type}/{v.status}/{v.category} • {v.sortKey} {v.sortDir}
        </div>
      </button>
    );
  }

  /* =========================
     MAIN RENDER
  ========================= */
  return (
    <div className="min-h-screen bg-[#070707] text-white">
      {/* Top app bar */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-black"
              onClick={() => setSidebarOpen((s) => !s)}
            >
              ☰
            </button>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
                <div className="text-xs text-white/60">Eventura</div>
                <div className="text-sm font-semibold tracking-tight">Finance</div>
              </div>

              <div className="hidden lg:flex items-center gap-2">
                <Pill>{role}</Pill>
                <Pill>{email || "no-email"}</Pill>
                {!canEdit ? <Pill tone="warn">View-only</Pill> : <Pill tone="good">CEO edit</Pill>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Btn variant="outline" onClick={exportExcelXls}>
              Excel
            </Btn>
            <Btn variant="outline" onClick={exportCSV}>
              CSV
            </Btn>
            <Btn variant="outline" onClick={() => setOpenImport(true)} disabled={!canEdit}>
              Import
            </Btn>
            <Btn variant="outline" onClick={seedDemo} disabled={!canEdit}>
              Demo
            </Btn>
            <Btn onClick={openNewTx} disabled={!canEdit}>
              + Add
            </Btn>
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-black hover:text-white"
            >
              Back
            </Link>
          </div>
        </div>

        {/* KPI strip */}
        <div className="mx-auto max-w-[1400px] px-4 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill>Month {monthNow}</Pill>
            <Pill tone="good">Income {money(kpi.inc, "INR")}</Pill>
            <Pill tone="bad">Expense {money(kpi.exp, "INR")}</Pill>
            <Pill tone={kpi.net >= 0 ? "good" : "bad"}>Net {money(kpi.net, "INR")}</Pill>
            <Pill tone="warn">AR {money(kpi.ar, "INR")}</Pill>
            <Pill tone="warn">AP {money(kpi.ap, "INR")}</Pill>
            <Pill tone={kpi.overdue ? "bad" : "neutral"}>Overdue {kpi.overdue}</Pill>
            {toast ? <span className="ml-auto text-xs text-white/70">{toast}</span> : null}
          </div>
        </div>
      </div>

      {/* App shell: sidebar + content */}
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 md:grid-cols-[320px_1fr] gap-4 px-4 py-4">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:block">
          <div className="sticky top-[110px] grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Views</div>
                <Btn variant="ghost" onClick={() => setOpenViewsModal(true)}>
                  Manage
                </Btn>
              </div>
              <div className="mt-3 grid gap-2">
                {views.map((v) => (
                  <ViewItem key={v.id} v={v} />
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <Btn variant="outline" onClick={createViewFromActive}>
                  Duplicate
                </Btn>
                <Btn variant="outline" onClick={() => setOpenCardFields(true)}>
                  Cards
                </Btn>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-semibold">Filters</div>
              <div className="mt-3 grid gap-2">
                <Input value={activeView.q} onChange={(v) => updateActiveView({ q: v })} placeholder="Search..." />
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={activeView.type}
                    onChange={(v) => updateActiveView({ type: v as any })}
                    options={[{ value: "All", label: "Type: All" }, ...TX_TYPES.map((t) => ({ value: t, label: t }))]}
                  />
                  <Select
                    value={activeView.status}
                    onChange={(v) => updateActiveView({ status: v as any })}
                    options={[{ value: "All", label: "Status: All" }, ...TX_STATUSES.map((s) => ({ value: s, label: s }))]}
                  />
                </div>
                <Select
                  value={activeView.category}
                  onChange={(v) => updateActiveView({ category: v as any })}
                  options={[{ value: "All", label: "Category: All" }, ...TAGS.map((c) => ({ value: c, label: c }))]}
                />
                <Select
                  value={activeView.eventType}
                  onChange={(v) => updateActiveView({ eventType: v as any })}
                  options={[{ value: "All", label: "Event: All" }, ...EVENT_TYPES.map((c) => ({ value: c, label: c }))]}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input value={activeView.from} onChange={(v) => updateActiveView({ from: v })} type="date" />
                  <Input value={activeView.to} onChange={(v) => updateActiveView({ to: v })} type="date" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-semibold">Sort & Style</div>
              <div className="mt-3 grid gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={activeView.sortKey}
                    onChange={(v) => updateActiveView({ sortKey: v as SortKey })}
                    options={[
                      { value: "date", label: "Sort: Date" },
                      { value: "amount", label: "Sort: Amount" },
                      { value: "status", label: "Sort: Status" },
                      { value: "category", label: "Sort: Category" },
                      { value: "title", label: "Sort: Title" },
                    ]}
                  />
                  <Select
                    value={activeView.sortDir}
                    onChange={(v) => updateActiveView({ sortDir: v as SortDir })}
                    options={[
                      { value: "desc", label: "Desc" },
                      { value: "asc", label: "Asc" },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={activeView.layout}
                    onChange={(v) => updateActiveView({ layout: v as Layout })}
                    options={["Gallery", "Table", "Calendar", "Reports"].map((x) => ({ value: x, label: `Layout: ${x}` }))}
                  />
                  <Select
                    value={activeView.colorBy}
                    onChange={(v) => updateActiveView({ colorBy: v as ColorBy })}
                    options={[
                      { value: "None", label: "Color: None" },
                      { value: "Status", label: "Color: Status" },
                      { value: "Category", label: "Color: Category" },
                      { value: "Type", label: "Color: Type" },
                    ]}
                  />
                </div>

                <div className="text-xs text-white/55">
                  Rows: <b className="text-white/80">{filtered.length}</b>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Sidebar (mobile drawer) */}
        {sidebarOpen ? (
          <div className="md:hidden fixed inset-0 z-40 bg-black/70">
            <div className="absolute left-0 top-0 h-full w-[88%] max-w-[360px] border-r border-white/10 bg-[#0b0b0b] p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Finance Menu</div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/80 hover:bg-black"
                >
                  Close
                </button>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Views</div>
                  <Btn variant="ghost" onClick={() => setOpenViewsModal(true)}>
                    Manage
                  </Btn>
                </div>
                <div className="mt-3 grid gap-2">
                  {views.map((v) => (
                    <ViewItem key={v.id} v={v} />
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <Btn variant="outline" onClick={createViewFromActive}>
                    Duplicate
                  </Btn>
                  <Btn variant="outline" onClick={() => setOpenCardFields(true)}>
                    Cards
                  </Btn>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-sm font-semibold">Filters</div>
                <div className="mt-3 grid gap-2">
                  <Input value={activeView.q} onChange={(v) => updateActiveView({ q: v })} placeholder="Search..." />
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={activeView.type}
                      onChange={(v) => updateActiveView({ type: v as any })}
                      options={[{ value: "All", label: "Type: All" }, ...TX_TYPES.map((t) => ({ value: t, label: t }))]}
                    />
                    <Select
                      value={activeView.status}
                      onChange={(v) => updateActiveView({ status: v as any })}
                      options={[{ value: "All", label: "Status: All" }, ...TX_STATUSES.map((s) => ({ value: s, label: s }))]}
                    />
                  </div>
                  <Select
                    value={activeView.category}
                    onChange={(v) => updateActiveView({ category: v as any })}
                    options={[{ value: "All", label: "Category: All" }, ...TAGS.map((c) => ({ value: c, label: c }))]}
                  />
                  <Select
                    value={activeView.eventType}
                    onChange={(v) => updateActiveView({ eventType: v as any })}
                    options={[{ value: "All", label: "Event: All" }, ...EVENT_TYPES.map((c) => ({ value: c, label: c }))]}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={activeView.from} onChange={(v) => updateActiveView({ from: v })} type="date" />
                    <Input value={activeView.to} onChange={(v) => updateActiveView({ to: v })} type="date" />
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-sm font-semibold">Layout</div>
                <div className="mt-3 grid gap-2">
                  <Select
                    value={activeView.layout}
                    onChange={(v) => updateActiveView({ layout: v as Layout })}
                    options={["Gallery", "Table", "Calendar", "Reports"].map((x) => ({ value: x, label: x }))}
                  />
                  <Select
                    value={activeView.colorBy}
                    onChange={(v) => updateActiveView({ colorBy: v as ColorBy })}
                    options={[
                      { value: "None", label: "Color: None" },
                      { value: "Status", label: "Color: Status" },
                      { value: "Category", label: "Color: Category" },
                      { value: "Type", label: "Color: Type" },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Main content */}
        <main className="min-w-0">
          {/* Content header (Airtable-like toolbar row) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-white/60">Current view</div>
                <div className="truncate text-base font-semibold">{activeView.name}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Btn variant="outline" onClick={() => setOpenViewsModal(true)}>
                  Views
                </Btn>
                <Btn variant="outline" onClick={() => setOpenCardFields(true)}>
                  Customize cards
                </Btn>
                <Btn variant="outline" onClick={() => updateActiveView({ status: "Overdue" })}>
                  Show overdue
                </Btn>
                <Btn variant="outline" onClick={() => updateActiveView({ status: "All" })}>
                  Clear status
                </Btn>
              </div>
            </div>
          </div>

          {/* View content */}
          <div className="mt-4">
            {/* GALLERY */}
            {activeView.layout === "Gallery" ? (
              filtered.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-sm text-white/60">
                  No rows found. Click <b className="text-white/80">+ Add</b> to create a transaction.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((t) => {
                    const tone =
                      activeView.colorBy === "Type"
                        ? t.type
                        : activeView.colorBy === "Category"
                        ? t.category
                        : activeView.colorBy === "Status"
                        ? t.status
                        : "Eventura";

                    const statusTone = toneForStatus(t.status);
                    const typeTone = toneForType(t.type);
                    const catTone = toneForCategory(t.category);
                    const clientVendor = t.type === "Income" ? t.clientName : t.vendorName;

                    return (
                      <div
                        key={t.id}
                        className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-black/40 transition"
                      >
                        <div className="p-3">
                          <Cover seed={String(t.id)} tone={tone} />
                          <div className="mt-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-base font-semibold text-white">{t.title}</div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                <Pill tone={typeTone}>{t.type}</Pill>
                                <Pill tone={statusTone}>{t.status}</Pill>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={cls("text-sm font-semibold", t.type === "Income" ? "text-emerald-200" : "text-rose-200")}>
                                {money(t.amount, t.currency)}
                              </div>
                              <div className="mt-1 text-xs text-white/55">{t.date}</div>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                            {activeView.visibleFields.includes("category") ? (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/55">Category</span>
                                <Pill tone={catTone}>{t.category}</Pill>
                              </div>
                            ) : null}

                            {activeView.visibleFields.includes("eventType") ? (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/55">Event</span>
                                <span className="text-white/85">{t.eventType}</span>
                              </div>
                            ) : null}

                            {activeView.visibleFields.includes("clientVendor") ? (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/55">{t.type === "Income" ? "Client" : "Vendor"}</span>
                                <span className="truncate text-white/85">{clientVendor || "—"}</span>
                              </div>
                            ) : null}

                            {activeView.visibleFields.includes("eventTitle") ? (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/55">Event title</span>
                                <span className="truncate text-white/85">{t.eventTitle || "—"}</span>
                              </div>
                            ) : null}

                            {activeView.visibleFields.includes("invoice") ? (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/55">Invoice</span>
                                <span className="text-white/85">{t.invoiceNo || "—"}</span>
                              </div>
                            ) : null}

                            {activeView.visibleFields.includes("dueDate") ? (
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-white/55">Due</span>
                                <span className={cls("text-white/85", t.status === "Overdue" ? "text-rose-200" : "")}>
                                  {t.dueDate || "—"}
                                </span>
                              </div>
                            ) : null}
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="text-xs text-white/45">Updated {new Date(t.updatedAt).toLocaleString()}</div>
                            <div className="flex gap-2">
                              <Btn variant="outline" onClick={() => openEditTx(t)} disabled={!canEdit}>
                                Edit
                              </Btn>
                              <Btn variant="danger" onClick={() => deleteTx(t.id)} disabled={!canEdit}>
                                Delete
                              </Btn>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : null}

            {/* TABLE */}
            {activeView.layout === "Table" ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="grid grid-cols-12 gap-2 border-b border-white/10 bg-black/60 px-3 py-2 text-xs text-white/60">
                  <div className="col-span-4">Title</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>

                {filtered.length === 0 ? (
                  <div className="p-6 text-sm text-white/60">No rows found.</div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {filtered.map((t) => (
                      <div key={t.id} className="grid grid-cols-12 gap-2 px-3 py-3 hover:bg-black/50 transition">
                        <div className="col-span-4">
                          <div className="text-sm font-semibold">{t.title}</div>
                          <div className="mt-1 text-xs text-white/50">
                            {t.eventTitle || t.clientName || t.vendorName || "—"}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-sm">{t.date}</div>
                          <div className="mt-1 text-xs text-white/50">{t.dueDate ? `Due ${t.dueDate}` : "—"}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="flex flex-wrap gap-2">
                            <Pill tone={toneForType(t.type)}>{t.type}</Pill>
                            <Pill tone={toneForStatus(t.status)}>{t.status}</Pill>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <Pill tone={toneForCategory(t.category)}>{t.category}</Pill>
                        </div>
                        <div className="col-span-2 text-right">
                          <div className={cls("text-sm font-semibold", t.type === "Income" ? "text-emerald-200" : "text-rose-200")}>
                            {money(t.amount, t.currency)}
                          </div>
                          <div className="mt-2 flex justify-end gap-2">
                            <Btn variant="outline" onClick={() => openEditTx(t)} disabled={!canEdit}>
                              Edit
                            </Btn>
                            <Btn variant="danger" onClick={() => deleteTx(t.id)} disabled={!canEdit}>
                              Delete
                            </Btn>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* CALENDAR */}
            {activeView.layout === "Calendar" ? (
              calendar.size === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-sm text-white/60">
                  No rows in this date range.
                </div>
              ) : (
                <div className="grid gap-3">
                  {Array.from(calendar.entries())
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([date, items]) => (
                      <div key={date} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">{date}</div>
                          <Pill>{items.length} item(s)</Pill>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                          {items.map((t) => (
                            <div key={t.id} className="rounded-2xl border border-white/10 bg-black/30 p-3 hover:bg-black/50 transition">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold">{t.title}</div>
                                  <div className="mt-1 flex flex-wrap gap-2">
                                    <Pill tone={toneForType(t.type)}>{t.type}</Pill>
                                    <Pill tone={toneForStatus(t.status)}>{t.status}</Pill>
                                    <Pill tone={toneForCategory(t.category)}>{t.category}</Pill>
                                  </div>
                                </div>
                                <div className={cls("text-sm font-semibold", t.type === "Income" ? "text-emerald-200" : "text-rose-200")}>
                                  {money(t.amount, t.currency)}
                                </div>
                              </div>
                              <div className="mt-2 flex justify-end gap-2">
                                <Btn variant="outline" onClick={() => openEditTx(t)} disabled={!canEdit}>
                                  Edit
                                </Btn>
                                <Btn variant="danger" onClick={() => deleteTx(t.id)} disabled={!canEdit}>
                                  Delete
                                </Btn>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )
            ) : null}

            {/* REPORTS */}
            {activeView.layout === "Reports" ? (
              <div className="grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold">Reports</div>
                  <div className="mt-1 text-xs text-white/55">Based on current view filters.</div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">By Category</div>
                      <Pill>Top 12</Pill>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {reports.cats.slice(0, 12).map((c) => (
                        <div key={c.k} className="rounded-xl border border-white/10 bg-black/30 p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm">{c.k}</div>
                            <Pill tone={c.net >= 0 ? "good" : "bad"}>{money(c.net, "INR")}</Pill>
                          </div>
                          <div className="mt-1 text-xs text-white/55">
                            Income {money(c.inc, "INR")} • Expense {money(c.exp, "INR")}
                          </div>
                        </div>
                      ))}
                      {reports.cats.length === 0 ? <div className="text-sm text-white/60">No data.</div> : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Status Count</div>
                      <Pill>All rows</Pill>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {TX_STATUSES.map((s) => (
                        <div key={s} className="rounded-xl border border-white/10 bg-black/30 p-3 flex items-center justify-between">
                          <Pill tone={toneForStatus(s)}>{s}</Pill>
                          <div className="text-sm font-semibold">{reports.byStatus.get(s) || 0}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* Floating add button */}
      <button
        onClick={openNewTx}
        disabled={!canEdit}
        className={cls(
          "fixed bottom-6 right-6 z-40 rounded-full border border-white/15 bg-white/10 px-5 py-4 text-sm font-semibold text-white shadow-2xl hover:bg-black hover:border-white/25 transition",
          !canEdit && "opacity-50 pointer-events-none"
        )}
      >
        +
      </button>

      {/* ===== Cards fields modal ===== */}
      <Modal
        open={openCardFields}
        title="Customize cards"
        onClose={() => setOpenCardFields(false)}
        maxW="max-w-2xl"
        footer={
          <div className="flex justify-end">
            <Btn variant="outline" onClick={() => setOpenCardFields(false)}>
              Done
            </Btn>
          </div>
        }
      >
        <div className="grid gap-3">
          <div className="text-sm text-white/80">Choose which fields appear inside each Gallery card.</div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {(
              [
                ["date", "Date"],
                ["amount", "Amount"],
                ["status", "Status"],
                ["type", "Type"],
                ["category", "Category"],
                ["eventType", "Event Type"],
                ["clientVendor", "Client / Vendor"],
                ["eventTitle", "Event Title"],
                ["invoice", "Invoice No"],
                ["dueDate", "Due Date"],
              ] as Array<[ViewDef["visibleFields"][number], string]>
            ).map(([key, label]) => {
              const checked = activeView.visibleFields.includes(key);
              return (
                <label key={key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const on = e.target.checked;
                      const next = on
                        ? Array.from(new Set([...activeView.visibleFields, key]))
                        : activeView.visibleFields.filter((x) => x !== key);
                      updateActiveView({ visibleFields: next.length ? next : ["date", "amount", "status"] });
                    }}
                  />
                  <span className="text-sm text-white/85">{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* ===== Views modal ===== */}
      <Modal
        open={openViewsModal}
        title="Manage Views"
        onClose={() => setOpenViewsModal(false)}
        maxW="max-w-3xl"
        footer={
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/55">Views are saved automatically.</div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={createViewFromActive}>
                Duplicate view
              </Btn>
              <Btn variant="danger" onClick={deleteActiveView}>
                Delete view
              </Btn>
              <Btn onClick={() => setOpenViewsModal(false)}>Done</Btn>
            </div>
          </div>
        }
      >
        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-white/60">Active View Name</div>
            <div className="mt-2">
              <Input value={activeView.name} onChange={renameActiveView} />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-sm font-semibold">All Views</div>
            <div className="mt-3 grid gap-2">
              {views.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setActiveViewId(v.id)}
                  className={cls(
                    "w-full rounded-2xl border px-4 py-3 text-left transition",
                    v.id === activeViewId ? "border-white/25 bg-white/10" : "border-white/10 bg-black/30 hover:bg-black/50 hover:border-white/20"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{v.name}</div>
                    <Pill>{v.layout}</Pill>
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    Filter: {v.type}/{v.status}/{v.category} • Sort: {v.sortKey} {v.sortDir} • Color: {v.colorBy}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ===== Import modal ===== */}
      <Modal
        open={openImport}
        title="Import (JSON or CSV)"
        onClose={() => setOpenImport(false)}
        maxW="max-w-4xl"
        footer={
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/55">CEO only</div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={importJSON} disabled={!canEdit}>
                Import JSON
              </Btn>
              <Btn variant="outline" onClick={importCSV} disabled={!canEdit}>
                Import CSV
              </Btn>
              <Btn onClick={() => setOpenImport(false)}>Done</Btn>
            </div>
          </div>
        }
      >
        <div className="grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs text-white/60">Upload file</div>
            <div className="mt-2">
              <input
                type="file"
                accept=".csv,.json,text/plain"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60">Paste CSV / JSON</div>
            <TextArea value={importText} onChange={setImportText} rows={12} placeholder="Paste content here..." />
            <div className="mt-3 text-xs text-white/55">
              CSV headers supported:
              <div className="mt-2 rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-[11px] text-white/70">
                {CSV_HEADERS.join(", ")}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* ===== Tx modal ===== */}
      <Modal
        open={openTx}
        title={editing ? (txs.some((x) => x.id === editing.id) ? "Edit Transaction" : "New Transaction") : "Transaction"}
        onClose={() => {
          setOpenTx(false);
          setEditing(null);
        }}
        footer={
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/55">{canEdit ? "CEO can edit" : "View-only"}</div>
            <div className="flex gap-2">
              <Btn variant="outline" onClick={() => { setOpenTx(false); setEditing(null); }}>
                Cancel
              </Btn>
              <Btn onClick={() => editing && saveTx(editing)} disabled={!canEdit}>
                Save
              </Btn>
            </div>
          </div>
        }
      >
        {editing ? (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-white/60">Title</div>
                <Input
                  value={editing.title}
                  onChange={(v) => setEditing({ ...editing, title: v })}
                  disabled={!canEdit}
                  placeholder="Example: Decor vendor settlement"
                />
              </div>
              <div>
                <div className="text-xs text-white/60">Event Title</div>
                <Input value={editing.eventTitle || ""} onChange={(v) => setEditing({ ...editing, eventTitle: v })} disabled={!canEdit} placeholder="Wedding — Surat" />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <div className="text-xs text-white/60">Date</div>
                <Input value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} type="date" disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Event Type</div>
                <Select
                  value={editing.eventType}
                  onChange={(v) => setEditing({ ...editing, eventType: asEventType(v) })}
                  options={EVENT_TYPES.map((x) => ({ value: x, label: x }))}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <div className="text-xs text-white/60">Type</div>
                <Select value={editing.type} onChange={(v) => setEditing({ ...editing, type: asTxType(v) })} options={TX_TYPES.map((x) => ({ value: x, label: x }))} disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Status</div>
                <Select value={editing.status} onChange={(v) => setEditing({ ...editing, status: asTxStatus(v) })} options={TX_STATUSES.map((x) => ({ value: x, label: x }))} disabled={!canEdit} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <div className="text-xs text-white/60">Amount</div>
                <Input value={String(editing.amount)} onChange={(v) => setEditing({ ...editing, amount: parseNum(v, 0) })} type="number" disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Currency</div>
                <Select value={editing.currency} onChange={(v) => setEditing({ ...editing, currency: asCurrency(v) })} options={CURRENCIES.map((x) => ({ value: x, label: x }))} disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Category</div>
                <Select value={editing.category} onChange={(v) => setEditing({ ...editing, category: asTag(v) })} options={TAGS.map((x) => ({ value: x, label: x }))} disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Payment Method</div>
                <Select value={editing.paymentMethod} onChange={(v) => setEditing({ ...editing, paymentMethod: asMethod(v) })} options={METHODS.map((x) => ({ value: x, label: x }))} disabled={!canEdit} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-xs text-white/60">{editing.type === "Income" ? "Client Name" : "Vendor Name"}</div>
                <Input
                  value={editing.type === "Income" ? (editing.clientName || "") : (editing.vendorName || "")}
                  onChange={(v) => setEditing(editing.type === "Income" ? { ...editing, clientName: v } : { ...editing, vendorName: v })}
                  disabled={!canEdit}
                />
              </div>
              <div>
                <div className="text-xs text-white/60">Due Date</div>
                <Input value={editing.dueDate || ""} onChange={(v) => setEditing({ ...editing, dueDate: v })} type="date" disabled={!canEdit} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-xs text-white/60">Invoice No</div>
                <Input value={editing.invoiceNo || ""} onChange={(v) => setEditing({ ...editing, invoiceNo: v })} disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Reference ID</div>
                <Input value={editing.referenceId || ""} onChange={(v) => setEditing({ ...editing, referenceId: v })} disabled={!canEdit} />
              </div>
              <div>
                <div className="text-xs text-white/60">Subcategory</div>
                <Input value={editing.subcategory || ""} onChange={(v) => setEditing({ ...editing, subcategory: v })} disabled={!canEdit} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="text-xs text-white/60">GST</div>
                <div className="mt-2 grid gap-2">
                  <Input value={String(editing.gstRate ?? 0)} onChange={(v) => setEditing({ ...editing, gstRate: clamp(parseNum(v, 0), 0, 28) })} type="number" disabled={!canEdit} placeholder="GST rate %" />
                  <label className="flex items-center gap-2 text-xs text-white/65">
                    <input type="checkbox" checked={!!editing.gstIncluded} onChange={(e) => setEditing({ ...editing, gstIncluded: e.target.checked })} disabled={!canEdit} />
                    GST included in amount
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="text-xs text-white/60">TDS</div>
                <div className="mt-2">
                  <Input value={String(editing.tdsRate ?? 0)} onChange={(v) => setEditing({ ...editing, tdsRate: clamp(parseNum(v, 0), 0, 20) })} type="number" disabled={!canEdit} placeholder="TDS rate %" />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <div className="text-xs text-white/60">Recurring</div>
                <div className="mt-2 grid gap-2">
                  <label className="flex items-center gap-2 text-xs text-white/65">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={!!editing.recurring?.enabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        if (!enabled) setEditing({ ...editing, recurring: undefined });
                        else setEditing({ ...editing, recurring: { enabled: true, freq: "Monthly", nextRun: addMonths(editing.date, 1) } });
                      }}
                    />
                    Enable recurring
                  </label>

                  <Select
                    value={editing.recurring?.freq || "Monthly"}
                    disabled={!canEdit || !editing.recurring?.enabled}
                    onChange={(v) => {
                      const freq: RecurringFreq = RECUR_FREQS.includes(v as any) ? (v as RecurringFreq) : "Monthly";
                      setEditing({
                        ...editing,
                        recurring: { enabled: true, freq, nextRun: editing.recurring?.nextRun || addMonths(editing.date, 1) },
                      });
                    }}
                    options={RECUR_FREQS.map((f) => ({ value: f, label: f }))}
                  />

                  <Input
                    value={editing.recurring?.nextRun || ""}
                    disabled={!canEdit || !editing.recurring?.enabled}
                    onChange={(v) =>
                      setEditing({
                        ...editing,
                        recurring: { enabled: true, freq: editing.recurring?.freq || "Monthly", nextRun: v },
                      })
                    }
                    type="date"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-white/60">Notes</div>
              <TextArea value={editing.notes || ""} onChange={(v) => setEditing({ ...editing, notes: v })} rows={4} disabled={!canEdit} />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}