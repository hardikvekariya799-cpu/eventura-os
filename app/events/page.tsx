"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ================== STORAGE ================== */
const LS_EMAIL = "eventura_email";
const LS_SETTINGS = "eventura_os_settings_v3";

const EV_KEYS_READ = ["eventura-events", "eventura_os_events_v1", "eventura_events_v1"];
const EV_KEY_WRITE = "eventura-events";

const FIN_KEY_WRITE = "eventura-finance-transactions"; // connect ONLY when needed (Create Finance Tx)

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

type EventStatus = "Lead" | "Tentative" | "Confirmed" | "In Progress" | "Completed" | "Cancelled";
type EventPackage = "Silver" | "Gold" | "Platinum" | "Custom";

type EventItem = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  city: string;
  clientName: string;
  clientPhone: string;
  status: EventStatus;
  package: EventPackage;
  guests: number;

  // Finance-related fields (only for analytics + optional push to Finance tab)
  totalBudget: number; // total booking value
  advanceReceived: number; // money already received
  vendorCostEstimate: number; // estimated direct cost (COGS)

  notes?: string;
  tags?: string;

  createdAt: string;
  updatedAt: string;
};

type TxType = "Income" | "Expense";
type PayMethod = "Cash" | "UPI" | "Bank" | "Card" | "Cheque" | "Other";

type FinanceTx = {
  id: string;
  date: string;
  type: TxType;
  amount: number;
  category: string;
  vendor?: string;
  note?: string;
  method?: PayMethod;
  tags?: string;
  createdAt: string;
  updatedAt: string;
};

/* ================== HELPERS ================== */
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
function writeEvents(list: EventItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(EV_KEY_WRITE, JSON.stringify(list));
}
function writeFinanceTx(list: FinanceTx[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FIN_KEY_WRITE, JSON.stringify(list));
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
function isoPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
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
function normalizeEvents(raw: any): EventItem[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: EventItem[] = [];
  for (const x of arr) {
    const date = String(x?.date ?? x?.eventDate ?? "").slice(0, 10);
    if (!date) continue;

    const statusRaw = String(x?.status ?? "Lead") as EventStatus;
    const status: EventStatus = (
      ["Lead", "Tentative", "Confirmed", "In Progress", "Completed", "Cancelled"].includes(statusRaw)
        ? statusRaw
        : "Lead"
    ) as EventStatus;

    const pkgRaw = String(x?.package ?? x?.pkg ?? "Custom") as EventPackage;
    const pkg: EventPackage = (["Silver", "Gold", "Platinum", "Custom"].includes(pkgRaw) ? pkgRaw : "Custom") as EventPackage;

    const id = String(x?.id ?? x?._id ?? uid());
    const title = String(x?.title ?? x?.name ?? "Event").trim() || "Event";
    const city = String(x?.city ?? "Surat").trim() || "Surat";
    const clientName = String(x?.clientName ?? x?.client ?? "").trim();
    const clientPhone = String(x?.clientPhone ?? x?.phone ?? "").trim();

    const guests = Math.max(0, Math.floor(parseAmount(x?.guests ?? x?.guestCount ?? 0)));
    const totalBudget = Math.max(0, parseAmount(x?.totalBudget ?? x?.budget ?? 0));
    const advanceReceived = Math.max(0, parseAmount(x?.advanceReceived ?? x?.advance ?? 0));
    const vendorCostEstimate = Math.max(0, parseAmount(x?.vendorCostEstimate ?? x?.cogs ?? x?.vendorCost ?? 0));

    const notes = x?.notes ? String(x.notes) : x?.note ? String(x.note) : undefined;
    const tags = x?.tags ? String(x.tags) : undefined;

    out.push({
      id,
      date,
      title,
      city,
      clientName,
      clientPhone,
      status,
      package: pkg,
      guests,
      totalBudget,
      advanceReceived,
      vendorCostEstimate,
      notes,
      tags,
      createdAt: String(x?.createdAt ?? nowISO()),
      updatedAt: String(x?.updatedAt ?? nowISO()),
    });
  }

  // De-dupe by id (keep latest)
  const m = new Map<string, EventItem>();
  for (const e of out) {
    const prev = m.get(e.id);
    if (!prev) m.set(e.id, e);
    else m.set(e.id, prev.updatedAt >= e.updatedAt ? prev : e);
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
    hoverSolidBlack: "#000000", // ✅ IMPORTANT: not transparent, not white
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
      return { ...base, glow1: "rgba(139,92,246,0.22)", glow2: "rgba(212,175,55,0.14)", accentBg: "rgba(139,92,246,0.16)", accentBd: hc ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.30)", accentTx: "#DDD6FE" };
    case "Emerald Night":
      return { ...base, glow1: "rgba(16,185,129,0.18)", glow2: "rgba(212,175,55,0.12)", accentBg: "rgba(16,185,129,0.16)", accentBd: hc ? "rgba(16,185,129,0.55)" : "rgba(16,185,129,0.30)", accentTx: "#A7F3D0" };
    case "Ocean Blue":
      return { ...base, glow1: "rgba(59,130,246,0.22)", glow2: "rgba(34,211,238,0.14)", accentBg: "rgba(59,130,246,0.16)", accentBd: hc ? "rgba(59,130,246,0.55)" : "rgba(59,130,246,0.30)", accentTx: "#BFDBFE" };
    case "Ruby Noir":
      return { ...base, glow1: "rgba(244,63,94,0.18)", glow2: "rgba(212,175,55,0.10)", accentBg: "rgba(244,63,94,0.14)", accentBd: hc ? "rgba(244,63,94,0.50)" : "rgba(244,63,94,0.26)", accentTx: "#FDA4AF" };
    case "Carbon Black":
      return { ...base, bg: "#03040A", glow1: "rgba(255,255,255,0.10)", glow2: "rgba(212,175,55,0.10)", accentBg: "rgba(212,175,55,0.14)", accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)", accentTx: "#FDE68A" };
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
        hoverSolidBlack: "#000000",
      };
    default:
      return { ...base, glow1: "rgba(255,215,110,0.18)", glow2: "rgba(120,70,255,0.18)", accentBg: "rgba(212,175,55,0.12)", accentBd: hc ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)", accentTx: "#FDE68A" };
  }
}

/* ================== PAGE ================== */
export default function EventsPage() {
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<AppSettings>({});
  const [keysUsed, setKeysUsed] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const [from, setFrom] = useState(todayYMD());
  const [to, setTo] = useState(isoPlusDays(60));

  const [events, setEvents] = useState<EventItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "All">("All");
  const [cityFilter, setCityFilter] = useState<string>("All");
  const [packageFilter, setPackageFilter] = useState<EventPackage | "All">("All");

  // Modal add/edit
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [draft, setDraft] = useState<{
    date: string;
    title: string;
    city: string;
    clientName: string;
    clientPhone: string;
    status: EventStatus;
    package: EventPackage;
    guests: string;
    totalBudget: string;
    advanceReceived: string;
    vendorCostEstimate: string;
    notes: string;
    tags: string;
  }>({
    date: todayYMD(),
    title: "",
    city: "Surat",
    clientName: "",
    clientPhone: "",
    status: "Lead",
    package: "Custom",
    guests: "",
    totalBudget: "",
    advanceReceived: "",
    vendorCostEstimate: "",
    notes: "",
    tags: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEmail(localStorage.getItem(LS_EMAIL) || "");
    setSettings(safeLoad<AppSettings>(LS_SETTINGS, {}));
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toast(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(""), 1500);
  }

  function hydrate() {
    const loaded = loadFirstKey<any[]>(EV_KEYS_READ, []);
    setKeysUsed(loaded.keyUsed);
    setEvents(normalizeEvents(loaded.data));
  }

  function persist(next: EventItem[], toastMsg?: string) {
    setEvents(next);
    writeEvents(next);
    if (toastMsg) toast(toastMsg);
  }

  const isCEO = useMemo(() => {
    const ceo = (settings.ceoEmail || "hardikvekariya799@gmail.com").toLowerCase();
    return (email || "").toLowerCase() === ceo;
  }, [email, settings.ceoEmail]);

  const T = ThemeTokens((settings.theme as Theme) || "Royal Gold", settings.highContrast);
  const S = useMemo(() => makeStyles(T, !!settings.compactTables), [T, settings.compactTables]);

  const currency = "INR" as const; // keep simple here; Finance tab controls currency

  const citiesAll = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) if (e.city) set.add(e.city);
    return Array.from(set).sort();
  }, [events]);

  const eventsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (!inRange(e.date, from, to)) return false;
      if (statusFilter !== "All" && e.status !== statusFilter) return false;
      if (cityFilter !== "All" && e.city !== cityFilter) return false;
      if (packageFilter !== "All" && e.package !== packageFilter) return false;

      if (!q) return true;
      const blob = [
        e.date,
        e.title,
        e.city,
        e.clientName,
        e.clientPhone,
        e.status,
        e.package,
        e.notes || "",
        e.tags || "",
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [events, from, to, search, statusFilter, cityFilter, packageFilter]);

  const kpis = useMemo(() => {
    let total = 0;
    let leads = 0;
    let confirmed = 0;
    let completed = 0;
    let cancelled = 0;

    let pipelineValue = 0;
    let expectedRevenue = 0; // confirmed + in progress + completed
    let advances = 0;
    let balanceDue = 0;
    let estCogs = 0;

    for (const e of eventsFiltered) {
      total += 1;
      if (e.status === "Lead" || e.status === "Tentative") leads += 1;
      if (e.status === "Confirmed" || e.status === "In Progress") confirmed += 1;
      if (e.status === "Completed") completed += 1;
      if (e.status === "Cancelled") cancelled += 1;

      const booking = e.totalBudget || 0;
      const adv = e.advanceReceived || 0;
      const bal = Math.max(0, booking - adv);
      const cogs = e.vendorCostEstimate || 0;

      // Pipeline: anything not cancelled
      if (e.status !== "Cancelled") pipelineValue += booking;

      // Expected revenue: confirmed + in progress + completed
      if (["Confirmed", "In Progress", "Completed"].includes(e.status)) expectedRevenue += booking;

      advances += adv;
      balanceDue += bal;
      estCogs += cogs;
    }

    const estGrossProfit = expectedRevenue - estCogs;

    return {
      total,
      leads,
      confirmed,
      completed,
      cancelled,
      pipelineValue,
      expectedRevenue,
      advances,
      balanceDue,
      estCogs,
      estGrossProfit,
    };
  }, [eventsFiltered]);

  function openAdd() {
    setEditingId(null);
    setDraft({
      date: todayYMD(),
      title: "",
      city: "Surat",
      clientName: "",
      clientPhone: "",
      status: "Lead",
      package: "Custom",
      guests: "",
      totalBudget: "",
      advanceReceived: "",
      vendorCostEstimate: "",
      notes: "",
      tags: "",
    });
    setOpenForm(true);
  }

  function openEdit(id: string) {
    const e = events.find((x) => x.id === id);
    if (!e) return;
    setEditingId(id);
    setDraft({
      date: e.date,
      title: e.title,
      city: e.city,
      clientName: e.clientName,
      clientPhone: e.clientPhone,
      status: e.status,
      package: e.package,
      guests: String(e.guests || ""),
      totalBudget: String(e.totalBudget || ""),
      advanceReceived: String(e.advanceReceived || ""),
      vendorCostEstimate: String(e.vendorCostEstimate || ""),
      notes: e.notes || "",
      tags: e.tags || "",
    });
    setOpenForm(true);
  }

  function closeForm() {
    setOpenForm(false);
    setEditingId(null);
  }

  function saveDraft() {
    const date = String(draft.date || "").slice(0, 10);
    const title = String(draft.title || "").trim();
    if (!date) return toast("❌ Date required");
    if (!title) return toast("❌ Title required");

    const next: EventItem = {
      id: editingId || uid(),
      date,
      title,
      city: String(draft.city || "Surat").trim() || "Surat",
      clientName: String(draft.clientName || "").trim(),
      clientPhone: String(draft.clientPhone || "").trim(),
      status: draft.status,
      package: draft.package,
      guests: Math.max(0, Math.floor(parseAmount(draft.guests))),
      totalBudget: Math.max(0, parseAmount(draft.totalBudget)),
      advanceReceived: Math.max(0, parseAmount(draft.advanceReceived)),
      vendorCostEstimate: Math.max(0, parseAmount(draft.vendorCostEstimate)),
      notes: draft.notes.trim() || undefined,
      tags: draft.tags.trim() || undefined,
      createdAt: editingId ? String(events.find((x) => x.id === editingId)?.createdAt ?? nowISO()) : nowISO(),
      updatedAt: nowISO(),
    };

    const list = editingId ? events.map((x) => (x.id === editingId ? next : x)) : [next, ...events];
    list.sort((a, b) => (a.date < b.date ? 1 : -1));
    persist(list, editingId ? "✅ Updated" : "✅ Added");
    closeForm();
  }

  function removeEvent(id: string) {
    const e = events.find((x) => x.id === id);
    if (!e) return;
    const ok = confirm(`Delete "${e.title}" on ${e.date}?`);
    if (!ok) return;
    persist(events.filter((x) => x.id !== id), "🗑️ Deleted");
  }

  function quickStatus(id: string, status: EventStatus) {
    const e = events.find((x) => x.id === id);
    if (!e) return;
    const next: EventItem = { ...e, status, updatedAt: nowISO() };
    const list = events.map((x) => (x.id === id ? next : x)).sort((a, b) => (a.date < b.date ? 1 : -1));
    persist(list, `✅ Status → ${status}`);
  }

  function exportRangeJSON() {
    exportJSON(`eventura_events_${from}_to_${to}.json`, {
      version: "eventura-events-advanced-v1",
      exportedAt: nowISO(),
      range: { from, to },
      kpis,
      events: eventsFiltered,
    });
    toast("✅ Exported JSON");
  }
  function exportRangeCSV() {
    exportCSV(`eventura_events_${from}_to_${to}.csv`, eventsFiltered);
    toast("✅ Exported CSV");
  }

  // ✅ Connect to Finance ONLY when user clicks: create finance tx from event
  function pushToFinance(e: EventItem, kind: "Advance" | "Full Revenue" | "Vendor Cost") {
    const finRaw = safeLoad<any[]>(FIN_KEY_WRITE, []);
    const fin = Array.isArray(finRaw) ? finRaw : [];

    const makeTx = (tx: Omit<FinanceTx, "id" | "createdAt" | "updatedAt">): FinanceTx => ({
      ...tx,
      id: uid(),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    });

    let tx: FinanceTx | null = null;

    if (kind === "Advance") {
      const amt = Math.max(0, e.advanceReceived || 0);
      if (amt <= 0) return toast("❌ Advance is 0");
      tx = makeTx({
        date: e.date,
        type: "Income",
        amount: amt,
        category: "Advance / Token Received",
        vendor: e.clientName || undefined,
        note: `Advance for ${e.title} (${e.city})`,
        method: "UPI",
        tags: `event:${e.title}${e.tags ? `,${e.tags}` : ""}`,
      });
    }

    if (kind === "Full Revenue") {
      const amt = Math.max(0, e.totalBudget || 0);
      if (amt <= 0) return toast("❌ Budget is 0");
      tx = makeTx({
        date: e.date,
        type: "Income",
        amount: amt,
        category: "Event Booking Revenue",
        vendor: e.clientName || undefined,
        note: `Booking revenue for ${e.title} (${e.city})`,
        method: "Bank",
        tags: `event:${e.title}${e.tags ? `,${e.tags}` : ""}`,
      });
    }

    if (kind === "Vendor Cost") {
      const amt = Math.max(0, e.vendorCostEstimate || 0);
      if (amt <= 0) return toast("❌ Vendor cost is 0");
      tx = makeTx({
        date: e.date,
        type: "Expense",
        amount: amt,
        category: "Decor Cost",
        vendor: "Vendors",
        note: `Estimated vendor cost for ${e.title} (${e.city})`,
        method: "Bank",
        tags: `event:${e.title}${e.tags ? `,${e.tags}` : ""}`,
      });
    }

    if (!tx) return;

    const next = [tx, ...fin];
    writeFinanceTx(next);
    toast("✅ Sent to Finance");
  }

  return (
    <div style={S.app}>
      {/* ✅ HARD GUARANTEE: hover stays black (not transparent/white) */}
      <style>{`
        :root { color-scheme: dark; }
        .ev-hoverBlack:hover { background: ${T.hoverSolidBlack} !important; }
        .ev-hoverBlack:hover * { color: ${T.text} !important; }
        .ev-btn:hover { background: ${T.hoverSolidBlack} !important; }
        .ev-card:hover { background: ${T.hoverSolidBlack} !important; }
        .ev-nav:hover { background: ${T.hoverSolidBlack} !important; }
      `}</style>

      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          <div>
            <div style={S.brandName}>Eventura</div>
            <div style={S.brandSub}>Events</div>
          </div>
        </div>

        <nav style={S.nav}>
          <Link href="/dashboard" className="ev-nav" style={S.navItem as any}>
            📊 Dashboard
          </Link>
          <Link href="/events" className="ev-nav" style={S.navActive as any}>
            📅 Events
          </Link>
          <Link href="/finance" className="ev-nav" style={S.navItem as any}>
            💰 Finance
          </Link>
          <Link href="/vendors" className="ev-nav" style={S.navItem as any}>
            🏷️ Vendors
          </Link>
          <Link href="/hr" className="ev-nav" style={S.navItem as any}>
            🧑‍🤝‍🧑 HR
          </Link>
          <Link href="/ai" className="ev-nav" style={S.navItem as any}>
            🤖 AI
          </Link>
          <Link href="/notes" className="ev-nav" style={S.navItem as any}>
            📝 Notes
          </Link>
          <Link href="/reports" className="ev-nav" style={S.navItem as any}>
            📈 Reports
          </Link>
          <Link href="/settings" className="ev-nav" style={S.navItem as any}>
            ⚙️ Settings
          </Link>
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
            <div style={S.h1}>Events (Advanced)</div>
            <div style={S.muted}>Pipeline • KPIs • Quick Status • Export • Optional Finance Sync</div>
          </div>

          <div style={S.headerRight}>
            <button className="ev-btn" style={S.secondaryBtn} onClick={hydrate}>
              Refresh
            </button>
            <button className="ev-btn" style={S.secondaryBtn} onClick={exportRangeJSON}>
              Export JSON
            </button>
            <button className="ev-btn" style={S.secondaryBtn} onClick={exportRangeCSV}>
              Export CSV
            </button>
            <button className="ev-btn" style={S.primaryBtn} onClick={openAdd}>
              + Add Event
            </button>
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
                placeholder="client, title, phone, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Status</div>
              <select style={S.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                <option value="All">All</option>
                <option value="Lead">Lead</option>
                <option value="Tentative">Tentative</option>
                <option value="Confirmed">Confirmed</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>City</div>
              <select style={S.select} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
                <option value="All">All</option>
                {citiesAll.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Package</div>
              <select style={S.select} value={packageFilter} onChange={(e) => setPackageFilter(e.target.value as any)}>
                <option value="All">All</option>
                <option value="Silver">Silver</option>
                <option value="Gold">Gold</option>
                <option value="Platinum">Platinum</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <div style={S.kpiGrid}>
          <div className="ev-card" style={S.kpiCard}>
            <div style={S.kpiLabel}>Total (Range)</div>
            <div style={S.kpiValue}>{kpis.total}</div>
            <div style={S.kpiSub}>Leads: {kpis.leads} • Confirmed: {kpis.confirmed}</div>
          </div>

          <div className="ev-card" style={S.kpiCard}>
            <div style={S.kpiLabel}>Pipeline Value</div>
            <div style={S.kpiValue}>{formatMoney(kpis.pipelineValue, currency)}</div>
            <div style={S.kpiSub}>Not cancelled</div>
          </div>

          <div className="ev-card" style={S.kpiCard}>
            <div style={S.kpiLabel}>Expected Revenue</div>
            <div style={S.kpiValue}>{formatMoney(kpis.expectedRevenue, currency)}</div>
            <div style={S.kpiSub}>Confirmed + In Progress + Completed</div>
          </div>

          <div className="ev-card" style={S.kpiCard}>
            <div style={S.kpiLabel}>Gross (Est.)</div>
            <div style={S.kpiValue}>{formatMoney(kpis.estGrossProfit, currency)}</div>
            <div style={S.kpiSub}>COGS est: {formatMoney(kpis.estCogs, currency)}</div>
          </div>
        </div>

        <div style={S.kpiGrid}>
          <div className="ev-card" style={S.kpiCard}>
            <div style={S.kpiLabel}>Advance Received</div>
            <div style={S.kpiValue}>{formatMoney(kpis.advances, currency)}</div>
            <div style={S.kpiSub}>Cash collected in range</div>
          </div>

          <div className="ev-card" style={S.kpiCard}>
            <div style={S.kpiLabel}>Balance Due</div>
            <div style={S.kpiValue}>{formatMoney(kpis.balanceDue, currency)}</div>
            <div style={S.kpiSub}>Budget - Advance</div>
          </div>

          <div className="ev-card" style={S.kpiCard}>
            <div style={S.kpiLabel}>Completed</div>
            <div style={S.kpiValue}>{kpis.completed}</div>
            <div style={S.kpiSub}>Cancelled: {kpis.cancelled}</div>
          </div>

          <div className="ev-card" style={S.kpiCard}>
            <div style={S.kpiLabel}>Action</div>
            <div style={S.kpiValue}>Export</div>
            <div style={S.kpiSub}>CSV/JSON from top buttons</div>
          </div>
        </div>

        {/* Events list */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Events</div>

          {!eventsFiltered.length ? (
            <div style={S.empty}>No events found in this range/filter.</div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {eventsFiltered.slice(0, 150).map((e) => {
                const bal = Math.max(0, (e.totalBudget || 0) - (e.advanceReceived || 0));
                const statusTone =
                  e.status === "Completed"
                    ? "ok"
                    : e.status === "Cancelled"
                      ? "bad"
                      : e.status === "Confirmed" || e.status === "In Progress"
                        ? "warn"
                        : "neutral";

                return (
                  <div key={e.id} className="ev-hoverBlack ev-card" style={S.card}>
                    <div style={S.rowBetween}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span
                          style={
                            statusTone === "ok"
                              ? S.pillOk
                              : statusTone === "bad"
                                ? S.pillBad
                                : statusTone === "warn"
                                  ? S.pillWarn
                                  : S.pill
                          }
                        >
                          {e.status}
                        </span>

                        <div style={{ fontWeight: 950, fontSize: 14 }}>{e.title}</div>
                        <span style={S.pill}>{e.city}</span>
                        <span style={S.pill}>{e.package}</span>
                        {e.clientName ? <span style={S.pill}>Client: {e.clientName}</span> : null}
                        {e.clientPhone ? <span style={S.pill}>📞 {e.clientPhone}</span> : null}
                        {e.tags ? <span style={S.pill}>Tags: {e.tags}</span> : null}
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span style={S.pillMoney}>{formatMoney(e.totalBudget || 0, currency)}</span>
                        <button className="ev-btn" style={S.secondaryBtn} onClick={() => openEdit(e.id)}>
                          Edit
                        </button>
                        <button className="ev-btn" style={S.dangerBtn} onClick={() => removeEvent(e.id)}>
                          Delete
                        </button>
                      </div>
                    </div>

                    <div style={S.metaLine}>
                      <span style={S.metaItem}>📅 {e.date}</span>
                      <span style={S.metaItem}>Guests: {e.guests || 0}</span>
                      <span style={S.metaItem}>Advance: {formatMoney(e.advanceReceived || 0, currency)}</span>
                      <span style={S.metaItem}>Balance: {formatMoney(bal, currency)}</span>
                      <span style={S.metaItem}>COGS est: {formatMoney(e.vendorCostEstimate || 0, currency)}</span>
                    </div>

                    {e.notes ? <div style={S.noteLine}>{e.notes}</div> : null}

                    <div style={S.actionsRow}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="ev-btn" style={S.miniBtn} onClick={() => quickStatus(e.id, "Lead")}>Lead</button>
                        <button className="ev-btn" style={S.miniBtn} onClick={() => quickStatus(e.id, "Tentative")}>Tentative</button>
                        <button className="ev-btn" style={S.miniBtn} onClick={() => quickStatus(e.id, "Confirmed")}>Confirm</button>
                        <button className="ev-btn" style={S.miniBtn} onClick={() => quickStatus(e.id, "In Progress")}>In Progress</button>
                        <button className="ev-btn" style={S.miniBtn} onClick={() => quickStatus(e.id, "Completed")}>Complete</button>
                        <button className="ev-btn" style={S.miniBtnBad} onClick={() => quickStatus(e.id, "Cancelled")}>Cancel</button>
                      </div>

                      {/* Connect to Finance ONLY when needed */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button className="ev-btn" style={S.miniBtn} onClick={() => pushToFinance(e, "Advance")}>
                          ➜ Finance: Advance
                        </button>
                        <button className="ev-btn" style={S.miniBtn} onClick={() => pushToFinance(e, "Full Revenue")}>
                          ➜ Finance: Revenue
                        </button>
                        <button className="ev-btn" style={S.miniBtn} onClick={() => pushToFinance(e, "Vendor Cost")}>
                          ➜ Finance: Vendor Cost
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Modal */}
        {openForm ? (
          <div style={S.modalOverlay} onClick={closeForm}>
            <div style={S.modal} onClick={(ev) => ev.stopPropagation()}>
              <div style={S.modalHeader}>
                <div style={S.modalTitle}>{editingId ? "Edit Event" : "Add Event"}</div>
                <button className="ev-btn" style={S.secondaryBtn} onClick={closeForm}>
                  Close
                </button>
              </div>

              <div style={S.modalGrid}>
                <Field label="Date">
                  <input style={S.input} type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
                </Field>

                <Field label="Status">
                  <select style={S.select} value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as EventStatus }))}>
                    <option value="Lead">Lead</option>
                    <option value="Tentative">Tentative</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </Field>

                <Field label="Package">
                  <select style={S.select} value={draft.package} onChange={(e) => setDraft((d) => ({ ...d, package: e.target.value as EventPackage }))}>
                    <option value="Silver">Silver</option>
                    <option value="Gold">Gold</option>
                    <option value="Platinum">Platinum</option>
                    <option value="Custom">Custom</option>
                  </select>
                </Field>

                <Field label="City">
                  <input style={S.input} value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
                </Field>

                <FieldWide label="Title">
                  <input style={{ ...S.input, width: "100%" }} placeholder="Wedding / Corporate / Pool party..." value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                </FieldWide>

                <FieldWide label="Client Name">
                  <input style={{ ...S.input, width: "100%" }} value={draft.clientName} onChange={(e) => setDraft((d) => ({ ...d, clientName: e.target.value }))} />
                </FieldWide>

                <Field label="Client Phone">
                  <input style={S.input} value={draft.clientPhone} onChange={(e) => setDraft((d) => ({ ...d, clientPhone: e.target.value }))} />
                </Field>

                <Field label="Guests">
                  <input style={S.input} inputMode="numeric" value={draft.guests} onChange={(e) => setDraft((d) => ({ ...d, guests: e.target.value }))} placeholder="e.g. 150" />
                </Field>

                <Field label="Total Budget">
                  <input style={S.input} inputMode="decimal" value={draft.totalBudget} onChange={(e) => setDraft((d) => ({ ...d, totalBudget: e.target.value }))} placeholder="e.g. 250000" />
                </Field>

                <Field label="Advance">
                  <input style={S.input} inputMode="decimal" value={draft.advanceReceived} onChange={(e) => setDraft((d) => ({ ...d, advanceReceived: e.target.value }))} placeholder="e.g. 50000" />
                </Field>

                <Field label="COGS Est.">
                  <input style={S.input} inputMode="decimal" value={draft.vendorCostEstimate} onChange={(e) => setDraft((d) => ({ ...d, vendorCostEstimate: e.target.value }))} placeholder="e.g. 120000" />
                </Field>

                <FieldWide label="Tags (comma separated)">
                  <input style={{ ...S.input, width: "100%" }} value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} placeholder="wedding, vip, urgent" />
                </FieldWide>

                <FieldWide label="Notes">
                  <input style={{ ...S.input, width: "100%" }} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="important info, venue details, timeline..." />
                </FieldWide>
              </div>

              <div style={S.modalFooter}>
                <button className="ev-btn" style={S.primaryBtn} onClick={saveDraft}>
                  {editingId ? "Save Changes" : "Add Event"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div style={S.footerNote}>✅ Advanced Events • ✅ Hover always solid black • ✅ Deploy-safe</div>
      </main>
    </div>
  );
}

/* ================== SMALL UI ================== */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 900 }}>{label}</div>
      {children}
    </div>
  );
}
function FieldWide({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6, gridColumn: "span 2" as any }}>
      <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 900 }}>{label}</div>
      {children}
    </div>
  );
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

    miniBtn: {
      padding: compact ? "8px 10px" : "9px 12px",
      borderRadius: 12,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
      fontSize: 12,
    },
    miniBtnBad: {
      padding: compact ? "8px 10px" : "9px 12px",
      borderRadius: 12,
      border: `1px solid ${T.badBd}`,
      background: T.badBg,
      color: T.badTx,
      fontWeight: 950,
      cursor: "pointer",
      fontSize: 12,
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

    kpiGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
    kpiCard: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },
    kpiLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiValue: { marginTop: 8, fontSize: 20, fontWeight: 950 },
    kpiSub: { marginTop: 6, color: T.muted, fontSize: 12, lineHeight: 1.3 },

    card: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },
    rowBetween: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },

    pill: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillOk: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillWarn: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.warnBd}`, background: T.warnBg, color: T.warnTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillBad: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.badBd}`, background: T.badBg, color: T.badTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillMoney: { padding: "8px 12px", borderRadius: 999, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, whiteSpace: "nowrap" },

    metaLine: { marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
    metaItem: { color: T.muted, fontSize: 12, fontWeight: 900 },
    noteLine: { marginTop: 10, color: T.text, fontSize: 13, opacity: 0.95 },

    actionsRow: { marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" },

    empty: { marginTop: 12, padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft, color: T.muted, fontWeight: 900 },

    modalOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.60)",
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
    modalGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" },
    modalFooter: { marginTop: 12, display: "flex", justifyContent: "flex-end" },

    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 10 },
  };
}
