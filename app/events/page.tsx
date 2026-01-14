"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ================== STORAGE KEYS ================== */
const LS_EMAIL = "eventura_email";
const LS_SETTINGS = "eventura_os_settings_v3";

const EVENTS_KEYS_READ = ["eventura-events", "eventura_os_events_v1", "eventura_events_v1"];
const EVENTS_KEY_WRITE = "eventura-events";

/* Finance (optional linkage: create token/advance tx from event) */
const FIN_KEYS_READ = [
  "eventura-finance-transactions",
  "eventura_os_fin_v1",
  "eventura_fin_v1",
  "eventura_os_fin_tx_v1",
];
const FIN_KEY_WRITE = "eventura-finance-transactions";

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

type EventStatus = "Planned" | "Confirmed" | "In Progress" | "Completed" | "Cancelled";
type EventType = "Wedding" | "Corporate" | "Birthday" | "Engagement" | "Festival" | "Exhibition" | "Other";
type Priority = "Low" | "Medium" | "High" | "Urgent";

type EventItem = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  city?: string;

  status: EventStatus;
  type: EventType;
  priority: Priority;

  budget?: number;
  advance?: number; // token received
  balanceDue?: number; // computed
  clientName?: string;
  clientPhone?: string;
  venue?: string;

  notes?: string;
  tags?: string;

  createdAt: string;
  updatedAt: string;
};

type TxType = "Income" | "Expense";
type PayMethod = "Cash" | "UPI" | "Bank" | "Card" | "Cheque" | "Other";
type FinanceTx = {
  id: string;
  date: string; // YYYY-MM-DD
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

/* ================== SAFE HELPERS ================== */
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
  localStorage.setItem(EVENTS_KEY_WRITE, JSON.stringify(list));
}
function writeFin(list: FinanceTx[]) {
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
function isoMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
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
function formatMoney(amount: number, currency: "INR" | "CAD" | "USD" = "INR") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/* ================== NORMALIZER ================== */
function normalizeEvents(raw: any): EventItem[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: EventItem[] = [];

  for (const x of arr) {
    const id = String(x?.id ?? x?._id ?? uid());
    const date = String(x?.date ?? x?.eventDate ?? "").slice(0, 10);
    const title = String(x?.title ?? x?.name ?? "").trim();
    if (!date || !title) continue;

    const statusRaw = String(x?.status ?? "Planned") as EventStatus;
    const status: EventStatus =
      statusRaw === "Planned" ||
      statusRaw === "Confirmed" ||
      statusRaw === "In Progress" ||
      statusRaw === "Completed" ||
      statusRaw === "Cancelled"
        ? statusRaw
        : "Planned";

    const typeRaw = String(x?.type ?? "Other") as EventType;
    const type: EventType =
      typeRaw === "Wedding" ||
      typeRaw === "Corporate" ||
      typeRaw === "Birthday" ||
      typeRaw === "Engagement" ||
      typeRaw === "Festival" ||
      typeRaw === "Exhibition" ||
      typeRaw === "Other"
        ? typeRaw
        : "Other";

    const prRaw = String(x?.priority ?? "Medium") as Priority;
    const priority: Priority = prRaw === "Low" || prRaw === "Medium" || prRaw === "High" || prRaw === "Urgent" ? prRaw : "Medium";

    const budget = parseAmount(x?.budget ?? 0);
    const advance = parseAmount(x?.advance ?? x?.token ?? 0);

    out.push({
      id,
      date,
      title,
      city: x?.city ? String(x.city) : undefined,
      status,
      type,
      priority,
      budget: budget > 0 ? budget : undefined,
      advance: advance > 0 ? advance : undefined,
      balanceDue: Math.max(0, (budget > 0 ? budget : 0) - (advance > 0 ? advance : 0)) || undefined,
      clientName: x?.clientName ? String(x.clientName) : undefined,
      clientPhone: x?.clientPhone ? String(x.clientPhone) : undefined,
      venue: x?.venue ? String(x.venue) : undefined,
      notes: x?.notes ? String(x.notes) : x?.note ? String(x.note) : undefined,
      tags: x?.tags ? String(x.tags) : undefined,
      createdAt: String(x?.createdAt ?? nowISO()),
      updatedAt: String(x?.updatedAt ?? nowISO()),
    });
  }

  // de-dupe by id (keep latest updatedAt)
  const m = new Map<string, EventItem>();
  for (const e of out) {
    const prev = m.get(e.id);
    if (!prev) m.set(e.id, e);
    else m.set(e.id, prev.updatedAt >= e.updatedAt ? prev : e);
  }

  return Array.from(m.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

function normalizeFin(raw: any): FinanceTx[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: FinanceTx[] = [];
  for (const x of arr) {
    const id = String(x?.id ?? x?._id ?? uid());
    const date = String(x?.date ?? x?.txDate ?? "").slice(0, 10);
    if (!date) continue;

    const t = String(x?.type ?? "").toLowerCase();
    const type: TxType = t === "income" ? "Income" : "Expense";

    const amount = parseAmount(x?.amount ?? x?.value ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    out.push({
      id,
      date,
      type,
      amount: Math.abs(amount),
      category: String(x?.category ?? "Other Income"),
      vendor: x?.vendor ? String(x.vendor) : undefined,
      note: x?.note ? String(x.note) : x?.notes ? String(x.notes) : undefined,
      method: x?.method ? (String(x.method) as PayMethod) : undefined,
      tags: x?.tags ? String(x.tags) : undefined,
      createdAt: String(x?.createdAt ?? nowISO()),
      updatedAt: String(x?.updatedAt ?? nowISO()),
    });
  }
  const m = new Map<string, FinanceTx>();
  for (const tx of out) {
    const prev = m.get(tx.id);
    if (!prev) m.set(tx.id, tx);
    else m.set(tx.id, prev.updatedAt >= tx.updatedAt ? prev : tx);
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

    // IMPORTANT: PURE BLACK HOVER (NOT TRANSPARENT)
    hoverBlack: "#000000",

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
      return {
        ...base,
        glow1: "rgba(139,92,246,0.22)",
        glow2: "rgba(212,175,55,0.14)",
        accentBg: "rgba(139,92,246,0.16)",
        accentBd: hc ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.30)",
        accentTx: "#DDD6FE",
      };
    case "Emerald Night":
      return {
        ...base,
        glow1: "rgba(16,185,129,0.18)",
        glow2: "rgba(212,175,55,0.12)",
        accentBg: "rgba(16,185,129,0.16)",
        accentBd: hc ? "rgba(16,185,129,0.55)" : "rgba(16,185,129,0.30)",
        accentTx: "#A7F3D0",
      };
    case "Ocean Blue":
      return {
        ...base,
        glow1: "rgba(59,130,246,0.22)",
        glow2: "rgba(34,211,238,0.14)",
        accentBg: "rgba(59,130,246,0.16)",
        accentBd: hc ? "rgba(59,130,246,0.55)" : "rgba(59,130,246,0.30)",
        accentTx: "#BFDBFE",
      };
    case "Ruby Noir":
      return {
        ...base,
        glow1: "rgba(244,63,94,0.18)",
        glow2: "rgba(212,175,55,0.10)",
        accentBg: "rgba(244,63,94,0.14)",
        accentBd: hc ? "rgba(244,63,94,0.50)" : "rgba(244,63,94,0.26)",
        accentTx: "#FDA4AF",
      };
    case "Carbon Black":
      return {
        ...base,
        bg: "#03040A",
        glow1: "rgba(255,255,255,0.10)",
        glow2: "rgba(212,175,55,0.10)",
        accentBg: "rgba(212,175,55,0.14)",
        accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)",
        accentTx: "#FDE68A",
      };
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

        // still pure black hover
        hoverBlack: "#000000",
      };
    default:
      return {
        ...base,
        glow1: "rgba(255,215,110,0.18)",
        glow2: "rgba(120,70,255,0.18)",
        accentBg: "rgba(212,175,55,0.12)",
        accentBd: hc ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)",
        accentTx: "#FDE68A",
      };
  }
}

/* ================== PAGE ================== */
export default function EventsPage() {
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<AppSettings>({});
  const [keysUsed, setKeysUsed] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const [from, setFrom] = useState(isoMinusDays(60));
  const [to, setTo] = useState(todayYMD());

  const [events, setEvents] = useState<EventItem[]>([]);
  const [finTxs, setFinTxs] = useState<FinanceTx[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<EventType | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "All">("All");

  // Modal add/edit
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [draft, setDraft] = useState<{
    date: string;
    title: string;
    city: string;
    venue: string;

    status: EventStatus;
    type: EventType;
    priority: Priority;

    budget: string;
    advance: string;

    clientName: string;
    clientPhone: string;

    notes: string;
    tags: string;
  }>({
    date: todayYMD(),
    title: "",
    city: "Surat",
    venue: "",
    status: "Planned",
    type: "Wedding",
    priority: "Medium",
    budget: "",
    advance: "",
    clientName: "",
    clientPhone: "",
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
    setTimeout(() => setMsg(""), 1400);
  }

  function hydrate() {
    const loaded = loadFirstKey<any[]>(EVENTS_KEYS_READ, []);
    setKeysUsed(loaded.keyUsed);
    setEvents(normalizeEvents(loaded.data));

    const finLoaded = loadFirstKey<any[]>(FIN_KEYS_READ, []);
    setFinTxs(normalizeFin(finLoaded.data));
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

  const eventsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (!inRange(e.date, from, to)) return false;
      if (statusFilter !== "All" && e.status !== statusFilter) return false;
      if (typeFilter !== "All" && e.type !== typeFilter) return false;
      if (priorityFilter !== "All" && e.priority !== priorityFilter) return false;

      if (!q) return true;
      const blob = [e.date, e.title, e.city || "", e.venue || "", e.status, e.type, e.priority, e.clientName || "", e.clientPhone || "", e.tags || "", e.notes || ""]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [events, from, to, search, statusFilter, typeFilter, priorityFilter]);

  const kpis = useMemo(() => {
    const total = eventsFiltered.length;
    const completed = eventsFiltered.filter((e) => e.status === "Completed").length;
    const upcoming = eventsFiltered.filter((e) => e.date >= todayYMD() && e.status !== "Cancelled").length;

    const budgetSum = eventsFiltered.reduce((a, e) => a + (e.budget || 0), 0);
    const advanceSum = eventsFiltered.reduce((a, e) => a + (e.advance || 0), 0);
    const balanceSum = eventsFiltered.reduce((a, e) => a + Math.max(0, (e.budget || 0) - (e.advance || 0)), 0);

    const urgent = eventsFiltered.filter((e) => e.priority === "Urgent").length;
    return { total, completed, upcoming, budgetSum, advanceSum, balanceSum, urgent };
  }, [eventsFiltered]);

  function openAdd() {
    setEditingId(null);
    setDraft({
      date: todayYMD(),
      title: "",
      city: "Surat",
      venue: "",
      status: "Planned",
      type: "Wedding",
      priority: "Medium",
      budget: "",
      advance: "",
      clientName: "",
      clientPhone: "",
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
      city: e.city || "",
      venue: e.venue || "",
      status: e.status,
      type: e.type,
      priority: e.priority,
      budget: e.budget ? String(e.budget) : "",
      advance: e.advance ? String(e.advance) : "",
      clientName: e.clientName || "",
      clientPhone: e.clientPhone || "",
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

    const budget = parseAmount(draft.budget);
    const advance = parseAmount(draft.advance);

    const nextItem: EventItem = {
      id: editingId || uid(),
      date,
      title,
      city: draft.city.trim() || undefined,
      venue: draft.venue.trim() || undefined,
      status: draft.status,
      type: draft.type,
      priority: draft.priority,
      budget: budget > 0 ? budget : undefined,
      advance: advance > 0 ? advance : undefined,
      balanceDue: Math.max(0, (budget > 0 ? budget : 0) - (advance > 0 ? advance : 0)) || undefined,
      clientName: draft.clientName.trim() || undefined,
      clientPhone: draft.clientPhone.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      tags: draft.tags.trim() || undefined,
      createdAt: editingId ? String(events.find((x) => x.id === editingId)?.createdAt ?? nowISO()) : nowISO(),
      updatedAt: nowISO(),
    };

    const next = editingId ? events.map((x) => (x.id === editingId ? nextItem : x)) : [nextItem, ...events];
    next.sort((a, b) => (a.date < b.date ? 1 : -1));
    persist(next, editingId ? "✅ Updated" : "✅ Added");
    closeForm();
  }

  function removeEvent(id: string) {
    const e = events.find((x) => x.id === id);
    if (!e) return;
    const ok = confirm(`Delete event: "${e.title}" on ${e.date}?`);
    if (!ok) return;
    persist(events.filter((x) => x.id !== id), "🗑️ Deleted");
  }

  function quickStatus(id: string, status: EventStatus) {
    const e = events.find((x) => x.id === id);
    if (!e) return;
    const next = events.map((x) => (x.id === id ? { ...x, status, updatedAt: nowISO() } : x));
    persist(next, "✅ Status updated");
  }

  function createAdvanceFinanceTx(e: EventItem) {
    const adv = Number(e.advance || 0);
    if (!adv || adv <= 0) return toast("❌ Add an Advance first");
    const tag = `event:${e.id}`;

    // prevent duplicates: same date + amount + tag + category
    const exists = finTxs.some(
      (t) => t.type === "Income" && t.category === "Advance / Token Received" && t.amount === adv && t.date === e.date && (t.tags || "").includes(tag)
    );
    if (exists) return toast("⚠️ Finance entry already exists");

    const tx: FinanceTx = {
      id: uid(),
      date: e.date,
      type: "Income",
      amount: adv,
      category: "Advance / Token Received",
      vendor: e.clientName || e.title,
      note: `Advance for: ${e.title}${e.city ? ` (${e.city})` : ""}`,
      method: "UPI",
      tags: `${tag}${e.tags ? `,${e.tags}` : ""}`,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    const nextFin = [tx, ...finTxs].sort((a, b) => (a.date < b.date ? 1 : -1));
    setFinTxs(nextFin);
    writeFin(nextFin);
    toast("✅ Added to Finance (Advance)");
  }

  const badge = useMemo(() => {
    const p = kpis.completed;
    const t = kpis.total;
    if (t === 0) return { txt: "No events in range", tone: "warn" as const };
    const rate = t > 0 ? Math.round((p / t) * 100) : 0;
    if (rate >= 60) return { txt: `Strong completion (${rate}%)`, tone: "ok" as const };
    if (rate >= 30) return { txt: `Medium completion (${rate}%)`, tone: "warn" as const };
    return { txt: `Low completion (${rate}%)`, tone: "bad" as const };
  }, [kpis.completed, kpis.total]);

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          <div>
            <div style={S.brandName}>Eventura</div>
            <div style={S.brandSub}>Events</div>
          </div>
        </div>

        <nav style={S.nav}>
          <NavLink href="/dashboard" label="📊 Dashboard" S={S} />
          <NavLink href="/events" label="📅 Events" S={S} active />
          <NavLink href="/finance" label="💰 Finance" S={S} />
          <NavLink href="/vendors" label="🏷️ Vendors" S={S} />
          <NavLink href="/hr" label="🧑‍🤝‍🧑 HR" S={S} />
          <NavLink href="/reports" label="📈 Reports" S={S} />
          <NavLink href="/settings" label="⚙️ Settings" S={S} />
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
            <div style={S.muted}>Custom dropdowns with PURE BLACK hover • Add/Edit/Delete • Quick status updates • Optional Finance linking</div>
          </div>

          <div style={S.headerRight}>
            <HoverBtn label="Refresh" kind="secondary" S={S} onClick={hydrate} />
            <HoverBtn label="+ Add Event" kind="primary" S={S} onClick={openAdd} />
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
                placeholder="title, client, city, venue, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Status</div>
              <Dropdown value={statusFilter} onChange={(v) => setStatusFilter(v as any)} options={["All", "Planned", "Confirmed", "In Progress", "Completed", "Cancelled"]} S={S} />
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Type</div>
              <Dropdown value={typeFilter} onChange={(v) => setTypeFilter(v as any)} options={["All", "Wedding", "Corporate", "Birthday", "Engagement", "Festival", "Exhibition", "Other"]} S={S} />
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Priority</div>
              <Dropdown value={priorityFilter} onChange={(v) => setPriorityFilter(v as any)} options={["All", "Low", "Medium", "High", "Urgent"]} S={S} />
            </div>
          </div>
        </section>

        {/* KPIs */}
        <div style={S.kpiGrid}>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Events (Range)</div>
            <div style={S.kpiValue}>{kpis.total}</div>
            <div style={S.kpiSub}>Upcoming: {kpis.upcoming}</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Budget Total (Range)</div>
            <div style={S.kpiValue}>{formatMoney(kpis.budgetSum, "INR")}</div>
            <div style={S.kpiSub}>Advance: {formatMoney(kpis.advanceSum, "INR")}</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Balance Due (Range)</div>
            <div style={S.kpiValue}>{formatMoney(kpis.balanceSum, "INR")}</div>
            <div style={S.kpiSub}>Urgent: {kpis.urgent}</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Completion</div>
            <div style={S.kpiValue}>{kpis.completed}</div>
            <div style={S.kpiSub}>
              <span style={badge.tone === "ok" ? S.badgeOk : badge.tone === "bad" ? S.badgeBad : S.badgeWarn}>{badge.txt}</span>
            </div>
          </div>
        </div>

        {/* Events List */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Events</div>

          {!eventsFiltered.length ? (
            <div style={S.empty}>No events found in this range/filter.</div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {eventsFiltered.slice(0, 150).map((e) => (
                <EventCard
                  key={e.id}
                  e={e}
                  S={S}
                  onEdit={() => openEdit(e.id)}
                  onDelete={() => removeEvent(e.id)}
                  onQuickStatus={(s) => quickStatus(e.id, s)}
                  onAddAdvanceToFinance={() => createAdvanceFinanceTx(e)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Modal */}
        {openForm ? (
          <div style={S.modalOverlay} onClick={closeForm}>
            <div style={S.modal} onClick={(ev) => ev.stopPropagation()}>
              <div style={S.modalHeader}>
                <div style={S.modalTitle}>{editingId ? "Edit Event" : "Add Event"}</div>
                <HoverBtn label="Close" kind="secondary" S={S} onClick={closeForm} />
              </div>

              <div style={S.modalGrid}>
                <div style={S.field}>
                  <div style={S.smallMuted}>Date</div>
                  <input style={S.input} type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Title</div>
                  <input style={{ ...S.input, width: "100%" }} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="e.g. Patel Wedding at Farmhouse" />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Status</div>
                  <Dropdown value={draft.status} onChange={(v) => setDraft((d) => ({ ...d, status: v as any }))} options={["Planned", "Confirmed", "In Progress", "Completed", "Cancelled"]} S={S} />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Type</div>
                  <Dropdown value={draft.type} onChange={(v) => setDraft((d) => ({ ...d, type: v as any }))} options={["Wedding", "Corporate", "Birthday", "Engagement", "Festival", "Exhibition", "Other"]} S={S} />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Priority</div>
                  <Dropdown value={draft.priority} onChange={(v) => setDraft((d) => ({ ...d, priority: v as any }))} options={["Low", "Medium", "High", "Urgent"]} S={S} />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>City</div>
                  <input style={S.input} value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} placeholder="Surat" />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Venue</div>
                  <input style={{ ...S.input, width: "100%" }} value={draft.venue} onChange={(e) => setDraft((d) => ({ ...d, venue: e.target.value }))} placeholder="optional" />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Budget (INR)</div>
                  <input style={S.input} type="text" inputMode="decimal" value={draft.budget} onChange={(e) => setDraft((d) => ({ ...d, budget: e.target.value }))} placeholder="e.g. 500000" />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Advance (INR)</div>
                  <input style={S.input} type="text" inputMode="decimal" value={draft.advance} onChange={(e) => setDraft((d) => ({ ...d, advance: e.target.value }))} placeholder="e.g. 50000" />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Client Name</div>
                  <input style={{ ...S.input, width: "100%" }} value={draft.clientName} onChange={(e) => setDraft((d) => ({ ...d, clientName: e.target.value }))} placeholder="optional" />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Client Phone</div>
                  <input style={{ ...S.input, width: "100%" }} value={draft.clientPhone} onChange={(e) => setDraft((d) => ({ ...d, clientPhone: e.target.value }))} placeholder="optional" />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Tags (comma separated)</div>
                  <input style={{ ...S.input, width: "100%" }} value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} placeholder="wedding, vip, urgent" />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Notes</div>
                  <textarea style={{ ...S.textarea, width: "100%" }} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="important notes / requirements..." />
                </div>
              </div>

              <div style={S.modalFooter}>
                <HoverBtn label={editingId ? "Save Changes" : "Add Event"} kind="primary" S={S} onClick={saveDraft} />
              </div>
            </div>
          </div>
        ) : null}

        <div style={S.footerNote}>
          ✅ Custom dropdowns (pure black hover) • ✅ Deploy-safe • ✅ Optional “Advance → Finance” link
        </div>
      </main>
    </div>
  );
}

/* ================== COMPONENTS ================== */
function NavLink({ href, label, S, active }: { href: string; label: string; S: any; active?: boolean }) {
  const [h, setH] = useState(false);
  const base = active ? S.navActive : S.navItem;
  const hovered = h ? { ...base, background: S.hoverBg, border: `1px solid ${S.hoverBd}` } : base;
  return (
    <Link
      href={href}
      style={hovered as any}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {label}
    </Link>
  );
}

function HoverBtn({ label, onClick, kind, S }: { label: string; onClick: () => void; kind: "primary" | "secondary" | "danger"; S: any }) {
  const [h, setH] = useState(false);
  const base = kind === "primary" ? S.primaryBtn : kind === "danger" ? S.dangerBtn : S.secondaryBtn;
  const hovered = h ? { ...base, background: S.hoverBg, border: `1px solid ${S.hoverBd}` } : base;
  return (
    <button
      style={hovered}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {label}
    </button>
  );
}

/**
 * Custom Dropdown (Fixes your issue)
 * - No native <select>
 * - Menu hover is PURE BLACK
 */
function Dropdown({
  value,
  onChange,
  options,
  S,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  S: any;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest?.("[data-dd-root='1']")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div style={{ position: "relative" }} data-dd-root="1">
      <button
        type="button"
        style={S.ddBtn}
        onClick={() => setOpen((s: boolean) => !s)}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
        <span style={{ opacity: 0.9 }}>▾</span>
      </button>

      {open ? (
        <div style={S.ddMenu}>
          {options.map((opt) => (
            <DDItem
              key={opt}
              label={opt}
              active={opt === value}
              S={S}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DDItem({ label, active, onClick, S }: { label: string; active?: boolean; onClick: () => void; S: any }) {
  const [h, setH] = useState(false);
  const bg = h ? S.ddHoverBg : active ? S.ddActiveBg : "transparent";
  const bd = h ? S.ddHoverBd : "transparent";
  return (
    <button
      type="button"
      style={{ ...S.ddItem, background: bg, border: `1px solid ${bd}` }}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {label}
    </button>
  );
}

function EventCard({
  e,
  S,
  onEdit,
  onDelete,
  onQuickStatus,
  onAddAdvanceToFinance,
}: {
  e: EventItem;
  S: any;
  onEdit: () => void;
  onDelete: () => void;
  onQuickStatus: (s: EventStatus) => void;
  onAddAdvanceToFinance: () => void;
}) {
  const [h, setH] = useState(false);
  const card = h ? { ...S.card, background: S.hoverCardBg, border: `1px solid ${S.hoverBd}` } : S.card;
  const budget = Number(e.budget || 0);
  const adv = Number(e.advance || 0);
  const bal = Math.max(0, budget - adv);

  const statusStyle =
    e.status === "Completed"
      ? S.pillOk
      : e.status === "Cancelled"
      ? S.pillBad
      : e.status === "Confirmed"
      ? S.pillOk2
      : e.status === "In Progress"
      ? S.pillWarn
      : S.pill;

  const prStyle =
    e.priority === "Urgent"
      ? S.pillBad
      : e.priority === "High"
      ? S.pillWarn
      : e.priority === "Low"
      ? S.pill
      : S.pillOk2;

  return (
    <div
      style={card}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      <div style={S.rowBetween}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={S.dateChip}>{e.date}</div>
          <div style={{ fontWeight: 950, fontSize: 15 }}>{e.title}</div>
          <span style={statusStyle}>{e.status}</span>
          <span style={S.pill}>{e.type}</span>
          <span style={prStyle}>Priority: {e.priority}</span>
          {e.city ? <span style={S.pill}>📍 {e.city}</span> : null}
          {e.venue ? <span style={S.pill}>🏛 {e.venue}</span> : null}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {budget > 0 ? <span style={S.moneyPill}>Budget {formatMoney(budget, "INR")}</span> : null}
          {adv > 0 ? <span style={S.moneyPill}>Advance {formatMoney(adv, "INR")}</span> : null}
          {budget > 0 ? <span style={S.moneyPill}>Balance {formatMoney(bal, "INR")}</span> : null}
        </div>
      </div>

      <div style={S.metaLine}>
        {e.clientName ? <span><b>Client:</b> {e.clientName}</span> : null}
        {e.clientPhone ? <span> • <b>Phone:</b> {e.clientPhone}</span> : null}
        {e.tags ? <span> • <b>Tags:</b> {e.tags}</span> : null}
      </div>

      {e.notes ? <div style={S.notes}>{e.notes}</div> : null}

      <div style={S.cardFooter}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <HoverBtn label="Planned" kind="secondary" S={S} onClick={() => onQuickStatus("Planned")} />
          <HoverBtn label="Confirmed" kind="secondary" S={S} onClick={() => onQuickStatus("Confirmed")} />
          <HoverBtn label="In Progress" kind="secondary" S={S} onClick={() => onQuickStatus("In Progress")} />
          <HoverBtn label="Completed" kind="secondary" S={S} onClick={() => onQuickStatus("Completed")} />
          <HoverBtn label="Cancelled" kind="secondary" S={S} onClick={() => onQuickStatus("Cancelled")} />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <HoverBtn label="Add Advance → Finance" kind="secondary" S={S} onClick={onAddAdvanceToFinance} />
          <HoverBtn label="Edit" kind="primary" S={S} onClick={onEdit} />
          <HoverBtn label="Delete" kind="danger" S={S} onClick={onDelete} />
        </div>
      </div>
    </div>
  );
}

/* ================== STYLES ================== */
function makeStyles(T: any, compact: boolean): Record<string, CSSProperties> {
  const hoverBg = T.hoverBlack; // PURE BLACK
  const hoverBd = T.accentBd;

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
    textarea: {
      minHeight: 110,
      padding: compact ? "10px 10px" : "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
      resize: "vertical",
    },

    kpiGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
    kpiCard: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },
    kpiLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiValue: { marginTop: 8, fontSize: 20, fontWeight: 950 },
    kpiSub: { marginTop: 6, color: T.muted, fontSize: 12, lineHeight: 1.3 },

    badgeOk: { display: "inline-flex", padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontWeight: 950, fontSize: 12 },
    badgeWarn: { display: "inline-flex", padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.warnBd}`, background: T.warnBg, color: T.warnTx, fontWeight: 950, fontSize: 12 },
    badgeBad: { display: "inline-flex", padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.badBd}`, background: T.badBg, color: T.badTx, fontWeight: 950, fontSize: 12 },

    empty: { marginTop: 12, padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft, color: T.muted, fontWeight: 900 },

    rowBetween: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },

    card: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },
    hoverCardBg: hoverBg,
    hoverBg,
    hoverBd,

    dateChip: {
      padding: "6px 10px",
      borderRadius: 999,
      border: `1px solid ${T.border}`,
      background: "transparent",
      fontWeight: 950,
      fontSize: 12,
      whiteSpace: "nowrap",
    },

    pill: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillOk: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillOk2: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillWarn: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.warnBd}`, background: T.warnBg, color: T.warnTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillBad: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.badBd}`, background: T.badBg, color: T.badTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },

    moneyPill: { padding: "8px 12px", borderRadius: 999, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, whiteSpace: "nowrap" },

    metaLine: { marginTop: 10, color: T.muted, fontSize: 12, fontWeight: 900, lineHeight: 1.4 },
    notes: { marginTop: 10, padding: 12, borderRadius: 14, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.02)", color: T.text, fontSize: 13, lineHeight: 1.45, fontWeight: 700 },

    cardFooter: { marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" },

    modalOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.55)",
      display: "grid",
      placeItems: "center",
      padding: 14,
      zIndex: 50,
    },
    modal: {
      width: "min(1100px, 100%)",
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel2,
      backdropFilter: "blur(10px)",
      padding: 14,
    },
    modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
    modalTitle: { fontWeight: 950, fontSize: 18, color: T.accentTx },
    modalGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "220px 1fr 220px 220px 220px", gap: 10, alignItems: "end" },
    modalFooter: { marginTop: 12, display: "flex", justifyContent: "flex-end" },

    // Custom Dropdown styles
    ddBtn: {
      width: 220,
      padding: compact ? "10px 10px" : "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
      fontWeight: 900,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    ddMenu: {
      position: "absolute",
      top: "calc(100% + 8px)",
      left: 0,
      width: 220,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.panel2,
      backdropFilter: "blur(10px)",
      padding: 8,
      display: "grid",
      gap: 6,
      zIndex: 60,
      boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
    },
    ddItem: {
      width: "100%",
      textAlign: "left",
      padding: "10px 10px",
      borderRadius: 12,
      border: "1px solid transparent",
      background: "transparent",
      color: T.text,
      cursor: "pointer",
      fontWeight: 950,
      fontSize: 13,
    },
    ddHoverBg: hoverBg,         // PURE BLACK hover
    ddHoverBd: T.accentBd,
    ddActiveBg: "rgba(255,255,255,0.06)",

    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 10 },
  };
}
