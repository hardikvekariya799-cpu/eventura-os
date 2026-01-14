"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ================== STORAGE KEYS ================== */
const LS_EMAIL = "eventura_email";
const LS_SETTINGS = "eventura_os_settings_v3";

const EVT_KEYS_READ = [
  "eventura-events",
  "eventura_os_events_v1",
  "eventura_events_v1",
  "eventura_os_evt_v1",
];
const EVT_KEY_WRITE = "eventura-events";

// Optional: write finance income ONLY when user clicks button (explicit)
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
type EventType = "Wedding" | "Corporate" | "Birthday" | "Engagement" | "Festival" | "Other";
type Priority = "Low" | "Medium" | "High" | "Urgent";

type EventItem = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  type: EventType;
  status: EventStatus;
  priority: Priority;

  clientName?: string;
  clientPhone?: string;
  city?: string;
  venue?: string;

  budget?: number; // total expected
  deposit?: number; // token/advance received
  assignedTo?: string;

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
  localStorage.setItem(EVT_KEY_WRITE, JSON.stringify(list));
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
function formatMoneyINR(amount: number) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "INR" }).format(amount);
  } catch {
    return `${amount.toFixed(0)} INR`;
  }
}

/* ================== NORMALIZER ================== */
function normalizeEvents(raw: any): EventItem[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: EventItem[] = [];

  for (const x of arr) {
    const id = String(x?.id ?? x?._id ?? uid());
    const date = String(x?.date ?? x?.eventDate ?? "").slice(0, 10);
    if (!date) continue;

    const statusRaw = String(x?.status ?? "Planned");
    const status: EventStatus =
      statusRaw === "Planned" ||
      statusRaw === "Confirmed" ||
      statusRaw === "In Progress" ||
      statusRaw === "Completed" ||
      statusRaw === "Cancelled"
        ? statusRaw
        : "Planned";

    const typeRaw = String(x?.type ?? "Other");
    const type: EventType =
      typeRaw === "Wedding" || typeRaw === "Corporate" || typeRaw === "Birthday" || typeRaw === "Engagement" || typeRaw === "Festival" || typeRaw === "Other"
        ? typeRaw
        : "Other";

    const prRaw = String(x?.priority ?? "Medium");
    const priority: Priority = prRaw === "Low" || prRaw === "Medium" || prRaw === "High" || prRaw === "Urgent" ? prRaw : "Medium";

    out.push({
      id,
      date,
      title: String(x?.title ?? x?.name ?? "Untitled").trim() || "Untitled",
      type,
      status,
      priority,
      clientName: x?.clientName ? String(x.clientName) : x?.client ? String(x.client) : undefined,
      clientPhone: x?.clientPhone ? String(x.clientPhone) : x?.phone ? String(x.phone) : undefined,
      city: x?.city ? String(x.city) : undefined,
      venue: x?.venue ? String(x.venue) : undefined,
      budget: Number.isFinite(parseAmount(x?.budget)) ? parseAmount(x?.budget) : undefined,
      deposit: Number.isFinite(parseAmount(x?.deposit)) ? parseAmount(x?.deposit) : undefined,
      assignedTo: x?.assignedTo ? String(x.assignedTo) : x?.owner ? String(x.owner) : undefined,
      notes: x?.notes ? String(x.notes) : undefined,
      tags: x?.tags ? String(x.tags) : undefined,
      createdAt: String(x?.createdAt ?? nowISO()),
      updatedAt: String(x?.updatedAt ?? nowISO()),
    });
  }

  // De-dupe by id (keep latest updatedAt)
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
    panel2: "rgba(11,16,32,0.88)",
    border: hc ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)",
    soft: hc ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
    inputBg: hc ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
    hoverBlack: "#000000", // PURE BLACK
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

  const [from, setFrom] = useState(isoMinusDays(30));
  const [to, setTo] = useState(isoPlusDays(90));

  const [events, setEvents] = useState<EventItem[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<EventType | "All">("All");
  const [cityFilter, setCityFilter] = useState<string>("All");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "All">("All");

  // Add/Edit modal
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [draft, setDraft] = useState<{
    date: string;
    title: string;
    type: EventType;
    status: EventStatus;
    priority: Priority;
    clientName: string;
    clientPhone: string;
    city: string;
    venue: string;
    budget: string;
    deposit: string;
    assignedTo: string;
    notes: string;
    tags: string;
  }>({
    date: todayYMD(),
    title: "",
    type: "Wedding",
    status: "Planned",
    priority: "Medium",
    clientName: "",
    clientPhone: "",
    city: "",
    venue: "",
    budget: "",
    deposit: "",
    assignedTo: "",
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
    const loaded = loadFirstKey<any[]>(EVT_KEYS_READ, []);
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
      if (typeFilter !== "All" && e.type !== typeFilter) return false;
      if (priorityFilter !== "All" && e.priority !== priorityFilter) return false;
      if (cityFilter !== "All" && (e.city || "") !== cityFilter) return false;

      if (!q) return true;
      const blob = [
        e.date,
        e.title,
        e.type,
        e.status,
        e.priority,
        e.clientName || "",
        e.clientPhone || "",
        e.city || "",
        e.venue || "",
        e.assignedTo || "",
        e.notes || "",
        e.tags || "",
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [events, from, to, search, statusFilter, typeFilter, cityFilter, priorityFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const total = eventsFiltered.length;
    const upcoming7 = eventsFiltered.filter((e) => e.date >= todayYMD() && e.date <= isoPlusDays(7) && e.status !== "Cancelled").length;
    const overdue = eventsFiltered.filter((e) => e.date < todayYMD() && e.status !== "Completed" && e.status !== "Cancelled").length;

    const pipelineBudget = eventsFiltered.reduce((a, e) => a + (e.status !== "Cancelled" ? Number(e.budget || 0) : 0), 0);
    const received = eventsFiltered.reduce((a, e) => a + (e.status !== "Cancelled" ? Number(e.deposit || 0) : 0), 0);
    const due = Math.max(0, pipelineBudget - received);

    const confirmed = eventsFiltered.filter((e) => e.status === "Confirmed" || e.status === "In Progress").length;
    const completed = eventsFiltered.filter((e) => e.status === "Completed").length;

    return { total, upcoming7, overdue, pipelineBudget, received, due, confirmed, completed };
  }, [eventsFiltered]);

  function openAdd() {
    setEditingId(null);
    setDraft({
      date: todayYMD(),
      title: "",
      type: "Wedding",
      status: "Planned",
      priority: "Medium",
      clientName: "",
      clientPhone: "",
      city: "",
      venue: "",
      budget: "",
      deposit: "",
      assignedTo: "",
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
      type: e.type,
      status: e.status,
      priority: e.priority,
      clientName: e.clientName || "",
      clientPhone: e.clientPhone || "",
      city: e.city || "",
      venue: e.venue || "",
      budget: e.budget != null ? String(e.budget) : "",
      deposit: e.deposit != null ? String(e.deposit) : "",
      assignedTo: e.assignedTo || "",
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
    const deposit = parseAmount(draft.deposit);

    const item: EventItem = {
      id: editingId || uid(),
      date,
      title,
      type: draft.type,
      status: draft.status,
      priority: draft.priority,
      clientName: draft.clientName.trim() || undefined,
      clientPhone: draft.clientPhone.trim() || undefined,
      city: draft.city.trim() || undefined,
      venue: draft.venue.trim() || undefined,
      budget: budget > 0 ? budget : undefined,
      deposit: deposit > 0 ? deposit : undefined,
      assignedTo: draft.assignedTo.trim() || undefined,
      notes: draft.notes.trim() || undefined,
      tags: draft.tags.trim() || undefined,
      createdAt: editingId ? String(events.find((x) => x.id === editingId)?.createdAt ?? nowISO()) : nowISO(),
      updatedAt: nowISO(),
    };

    const next = editingId ? events.map((x) => (x.id === editingId ? item : x)) : [item, ...events];
    next.sort((a, b) => (a.date < b.date ? 1 : -1));
    persist(next, editingId ? "✅ Updated" : "✅ Added");
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
    const next = events.map((x) => (x.id === id ? { ...x, status, updatedAt: nowISO() } : x));
    persist(next, "✅ Status updated");
  }

  function addIncomeToFinance(e: EventItem) {
    const budget = Number(e.budget || 0);
    const deposit = Number(e.deposit || 0);
    const amount = deposit > 0 ? deposit : budget;

    if (!amount || amount <= 0) return toast("❌ Add budget or deposit first");

    const existing = safeLoad<FinanceTx[]>(FIN_KEY_WRITE, []);
    const tx: FinanceTx = {
      id: uid(),
      date: e.date,
      type: "Income",
      amount: Math.abs(amount),
      category: "Event Booking Revenue",
      vendor: e.clientName || e.title,
      note: `From Events: ${e.title} (${e.status})`,
      method: "Other",
      tags: [e.type, e.city, e.tags].filter(Boolean).join(", "),
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };

    const next = [tx, ...(Array.isArray(existing) ? existing : [])];
    writeFinanceTx(next);
    toast("✅ Income added to Finance");
  }

  // “Auto” insights panel (no external connections)
  const insights = useMemo(() => {
    const list = eventsFiltered
      .filter((e) => e.status !== "Cancelled")
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .slice(0, 6);

    const overdue = eventsFiltered.filter((e) => e.date < todayYMD() && e.status !== "Completed" && e.status !== "Cancelled").slice(0, 6);

    return { next6: list, overdue6: overdue };
  }, [eventsFiltered]);

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
          <NavLink href="/dashboard" label="📊 Dashboard" S={S} active={false} />
          <NavLink href="/events" label="📅 Events" S={S} active />
          <NavLink href="/finance" label="💰 Finance" S={S} active={false} />
          <NavLink href="/vendors" label="🏷️ Vendors" S={S} active={false} />
          <NavLink href="/hr" label="🧑‍🤝‍🧑 HR" S={S} active={false} />
          <NavLink href="/reports" label="📈 Reports" S={S} active={false} />
          <NavLink href="/settings" label="⚙️ Settings" S={S} active={false} />
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
            <div style={S.muted}>
              Add/Edit/Delete • Filters • Auto Insights • <b>Pure Black</b> hover for dropdown menus/options
            </div>
          </div>

          <div style={S.headerRight}>
            <button style={S.secondaryBtn} onClick={hydrate}>
              Refresh
            </button>
            <button style={S.primaryBtn} onClick={openAdd}>
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
                placeholder="title, client, phone, city, venue, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Custom dropdowns (PURE BLACK hover) */}
            <div style={S.field}>
              <div style={S.smallMuted}>Status</div>
              <Dropdown
                value={statusFilter}
                options={["All", "Planned", "Confirmed", "In Progress", "Completed", "Cancelled"]}
                onChange={(v) => setStatusFilter(v as any)}
                S={S}
              />
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Type</div>
              <Dropdown
                value={typeFilter}
                options={["All", "Wedding", "Corporate", "Birthday", "Engagement", "Festival", "Other"]}
                onChange={(v) => setTypeFilter(v as any)}
                S={S}
              />
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Priority</div>
              <Dropdown value={priorityFilter} options={["All", "Low", "Medium", "High", "Urgent"]} onChange={(v) => setPriorityFilter(v as any)} S={S} />
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>City</div>
              <Dropdown
                value={cityFilter}
                options={["All", ...citiesAll]}
                onChange={(v) => setCityFilter(v)}
                S={S}
              />
            </div>
          </div>
        </section>

        {/* KPIs */}
        <div style={S.kpiGrid}>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Events (Filtered)</div>
            <div style={S.kpiValue}>{kpis.total}</div>
            <div style={S.kpiSub}>Confirmed/In Progress: {kpis.confirmed} • Completed: {kpis.completed}</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Upcoming 7 days</div>
            <div style={S.kpiValue}>{kpis.upcoming7}</div>
            <div style={S.kpiSub}>Auto reminder list below</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Overdue (not completed)</div>
            <div style={S.kpiValue}>{kpis.overdue}</div>
            <div style={S.kpiSub}>Fix status or reschedule</div>
          </div>
          <div style={S.kpiCard}>
            <div style={S.kpiLabel}>Pipeline</div>
            <div style={S.kpiValue}>{formatMoneyINR(kpis.pipelineBudget)}</div>
            <div style={S.kpiSub}>
              Received: {formatMoneyINR(kpis.received)} • Due: {formatMoneyINR(kpis.due)}
            </div>
          </div>
        </div>

        {/* Auto Insights */}
        <div style={S.grid2}>
          <section style={S.panel}>
            <div style={S.panelTitle}>Auto Insights</div>
            <div style={S.statement}>
              <InsightRow
                label="Next 7 days focus"
                value={`${kpis.upcoming7} event(s)`}
                S={S}
                strong
              />
              <InsightRow
                label="Overdue items"
                value={`${kpis.overdue} event(s)`}
                S={S}
                dim={kpis.overdue === 0}
              />
              <div style={S.hr} />
              <div style={S.smallNote}>
                Tip: Use the <b>Status</b> dropdown on each event card. Hover is always <b>pure black</b>.
              </div>
            </div>
          </section>

          <section style={S.panel}>
            <div style={S.panelTitle}>Reminders (Auto)</div>
            {!insights.next6.length ? (
              <div style={S.empty}>No upcoming events in this range.</div>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {insights.next6.map((e) => (
                  <div key={e.id} style={S.reminderCard}>
                    <div style={S.rowBetween}>
                      <div style={{ fontWeight: 950 }}>{e.date} • {e.title}</div>
                      <span style={pillByStatus(e.status, S)}>{e.status}</span>
                    </div>
                    <div style={S.smallMuted}>
                      {e.city ? `${e.city}` : "—"} {e.venue ? `• ${e.venue}` : ""} {e.clientName ? `• ${e.clientName}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Overdue list */}
        {insights.overdue6.length ? (
          <section style={S.panel}>
            <div style={S.panelTitle}>Overdue (Auto Flag)</div>
            <div style={S.smallNote}>These are in the past but not Completed/Cancelled.</div>
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {insights.overdue6.map((e) => (
                <div key={e.id} style={S.txCard}>
                  <div style={S.rowBetween}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={S.pillBad}>Overdue</span>
                      <div style={{ fontWeight: 950 }}>{e.title}</div>
                      <span style={S.pill}>{e.type}</span>
                      <span style={S.pill}>{e.priority}</span>
                      {e.city ? <span style={S.pill}>{e.city}</span> : null}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button style={S.secondaryBtn} onClick={() => openEdit(e.id)}>Edit</button>
                      <button style={S.primaryBtn} onClick={() => quickStatus(e.id, "Completed")}>Mark Completed</button>
                    </div>
                  </div>
                  <div style={S.smallMuted}>{e.date} • Current: {e.status}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Events List */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Events</div>

          {!eventsFiltered.length ? (
            <div style={S.empty}>No events found for this filter/range.</div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {eventsFiltered.slice(0, 200).map((e) => {
                const overdue = e.date < todayYMD() && e.status !== "Completed" && e.status !== "Cancelled";
                const due = Math.max(0, Number(e.budget || 0) - Number(e.deposit || 0));

                return (
                  <div key={e.id} style={S.txCard}>
                    <div style={S.rowBetween}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        {overdue ? <span style={S.pillBad}>Overdue</span> : null}
                        <span style={S.pill}>{e.type}</span>
                        <span style={S.pill}>{e.priority}</span>
                        <div style={{ fontWeight: 950 }}>{e.title}</div>
                        <span style={S.pill}>{e.date}</span>
                        {e.city ? <span style={S.pill}>{e.city}</span> : null}
                        {e.venue ? <span style={S.pill}>{e.venue}</span> : null}
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span style={pillByStatus(e.status, S)}>{e.status}</span>

                        <Dropdown
                          value="Change Status"
                          options={["Planned", "Confirmed", "In Progress", "Completed", "Cancelled"]}
                          onChange={(v) => quickStatus(e.id, v as EventStatus)}
                          S={S}
                          compact
                        />

                        <button style={S.secondaryBtn} onClick={() => openEdit(e.id)}>Edit</button>
                        <button style={S.dangerBtn} onClick={() => removeEvent(e.id)}>Delete</button>
                      </div>
                    </div>

                    <div style={S.cardGrid}>
                      <div style={S.cardMini}>
                        <div style={S.smallMuted}>Client</div>
                        <div style={S.cardMiniVal}>{e.clientName || "—"}</div>
                        <div style={S.smallMuted}>{e.clientPhone || ""}</div>
                      </div>

                      <div style={S.cardMini}>
                        <div style={S.smallMuted}>Budget</div>
                        <div style={S.cardMiniVal}>{formatMoneyINR(Number(e.budget || 0))}</div>
                        <div style={S.smallMuted}>Deposit: {formatMoneyINR(Number(e.deposit || 0))}</div>
                      </div>

                      <div style={S.cardMini}>
                        <div style={S.smallMuted}>Due</div>
                        <div style={S.cardMiniVal}>{formatMoneyINR(due)}</div>
                        <div style={S.smallMuted}>Recommended: collect 50%+ before execution</div>
                      </div>

                      <div style={S.cardMini}>
                        <div style={S.smallMuted}>Assigned</div>
                        <div style={S.cardMiniVal}>{e.assignedTo || "—"}</div>
                        <div style={S.smallMuted}>{e.tags ? `Tags: ${e.tags}` : "—"}</div>
                      </div>
                    </div>

                    {e.notes ? <div style={{ ...S.smallMuted, marginTop: 8 }}>{e.notes}</div> : null}

                    <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button style={S.secondaryBtn} onClick={() => addIncomeToFinance(e)}>
                        + Add Income to Finance
                      </button>
                      <Link
                        href="/finance"
                        style={S.linkBtn as any}
                        title="Go to Finance tab"
                      >
                        Open Finance
                      </Link>
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
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <div style={S.modalTitle}>{editingId ? "Edit Event" : "Add Event"}</div>
                <button style={S.secondaryBtn} onClick={closeForm}>Close</button>
              </div>

              <div style={S.modalGrid}>
                <div style={S.field}>
                  <div style={S.smallMuted}>Date</div>
                  <input style={S.input} type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Title</div>
                  <input style={{ ...S.input, width: "100%" }} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="e.g. Patel Wedding at Vesu" />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Type</div>
                  <Dropdown
                    value={draft.type}
                    options={["Wedding", "Corporate", "Birthday", "Engagement", "Festival", "Other"]}
                    onChange={(v) => setDraft((d) => ({ ...d, type: v as EventType }))}
                    S={S}
                  />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Status</div>
                  <Dropdown
                    value={draft.status}
                    options={["Planned", "Confirmed", "In Progress", "Completed", "Cancelled"]}
                    onChange={(v) => setDraft((d) => ({ ...d, status: v as EventStatus }))}
                    S={S}
                  />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Priority</div>
                  <Dropdown
                    value={draft.priority}
                    options={["Low", "Medium", "High", "Urgent"]}
                    onChange={(v) => setDraft((d) => ({ ...d, priority: v as Priority }))}
                    S={S}
                  />
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
                  <div style={S.smallMuted}>City</div>
                  <input style={{ ...S.input, width: "100%" }} value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} placeholder="Surat / Ahmedabad / ..." />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Venue</div>
                  <input style={{ ...S.input, width: "100%" }} value={draft.venue} onChange={(e) => setDraft((d) => ({ ...d, venue: e.target.value }))} placeholder="optional" />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Budget (₹)</div>
                  <input style={S.input} type="text" inputMode="decimal" value={draft.budget} onChange={(e) => setDraft((d) => ({ ...d, budget: e.target.value }))} placeholder="e.g. 500000" />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Deposit (₹)</div>
                  <input style={S.input} type="text" inputMode="decimal" value={draft.deposit} onChange={(e) => setDraft((d) => ({ ...d, deposit: e.target.value }))} placeholder="e.g. 100000" />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Assigned To</div>
                  <input style={{ ...S.input, width: "100%" }} value={draft.assignedTo} onChange={(e) => setDraft((d) => ({ ...d, assignedTo: e.target.value }))} placeholder="optional" />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Notes</div>
                  <input style={{ ...S.input, width: "100%" }} value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="important details..." />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Tags (comma separated)</div>
                  <input style={{ ...S.input, width: "100%" }} value={draft.tags} onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))} placeholder="wedding, urgent, premium" />
                </div>
              </div>

              <div style={S.modalFooter}>
                <button style={S.primaryBtn} onClick={saveDraft}>
                  {editingId ? "Save Changes" : "Add Event"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div style={S.footerNote}>✅ Deploy-safe • ✅ Pure Black hover on dropdown menus/options • ✅ Cross-tab write only when you click “Add Income to Finance”</div>
      </main>
    </div>
  );
}

/* ================== UI COMPONENTS ================== */
function NavLink({ href, label, S, active }: { href: string; label: string; S: any; active?: boolean }) {
  const [h, setH] = useState(false);
  const base = active ? S.navActive : S.navItem;
  const bg = h && !active ? S.hoverBlack : base.background;
  const bd = h && !active ? S.hoverBd : base.border;
  return (
    <Link
      href={href}
      style={{ ...base, background: bg, border: bd } as any}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {label}
    </Link>
  );
}

function Dropdown({
  value,
  options,
  onChange,
  S,
  compact,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  S: any;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(false);

  const btnStyle: CSSProperties = {
    ...(compact ? S.ddBtnCompact : S.ddBtn),
    background: h ? S.hoverBlack : (compact ? S.ddBtnCompact.background : S.ddBtn.background),
    border: h ? `1px solid ${S.hoverBdColor}` : (compact ? S.ddBtnCompact.border : S.ddBtn.border),
  };

  return (
    <div style={S.ddWrap}>
      <button
        type="button"
        style={btnStyle}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setH(true)}
        onMouseLeave={() => setH(false)}
      >
        <span style={{ fontWeight: 950 }}>{value}</span>
        <span style={{ opacity: 0.9 }}>▾</span>
      </button>

      {open ? (
        <div style={S.ddMenu} onMouseLeave={() => setOpen(false)}>
          {options.map((opt) => (
            <DDItem
              key={opt}
              label={opt}
              active={String(opt) === String(value)}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              S={S}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DDItem({ label, active, onClick, S }: { label: string; active?: boolean; onClick: () => void; S: any }) {
  const [h, setH] = useState(false);

  const bg = h
    ? "#000000" // PURE BLACK hover
    : active
    ? "rgba(255,255,255,0.06)" // active background
    : "transparent";

  const bd = h ? S.hoverBdColor : "transparent";

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

function pillByStatus(status: EventStatus, S: any): CSSProperties {
  if (status === "Completed") return S.pillOk;
  if (status === "Cancelled") return S.pillBad;
  if (status === "In Progress") return S.pillWarn;
  if (status === "Confirmed") return S.pillAccent;
  return S.pill;
}

function InsightRow({ label, value, S, strong, dim }: { label: string; value: string; S: any; strong?: boolean; dim?: boolean }) {
  return (
    <div style={S.row}>
      <div style={{ fontWeight: strong ? 950 : 900, opacity: dim ? 0.75 : 1 }}>{label}</div>
      <div style={{ fontWeight: strong ? 950 : 900 }}>{value}</div>
    </div>
  );
}

/* ================== STYLES ================== */
function makeStyles(T: any, compact: boolean): Record<string, CSSProperties> {
  const hoverBg = T.hoverBlack;
  const hoverBdColor = T.accentBd;

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

    msg: {
      marginTop: 12,
      padding: 10,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontSize: 13,
    },

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
    linkBtn: {
      padding: "12px 14px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontWeight: 950,
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
    },

    panel: {
      marginTop: 12,
      padding: 14,
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel,
      backdropFilter: "blur(10px)",
    },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    filtersGrid: {
      marginTop: 12,
      display: "grid",
      gap: 10,
      gridTemplateColumns: "220px 220px 1fr 220px 220px 220px 220px",
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

    kpiGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
    kpiCard: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },
    kpiLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiValue: { marginTop: 8, fontSize: 20, fontWeight: 950 },
    kpiSub: { marginTop: 6, color: T.muted, fontSize: 12, lineHeight: 1.3 },

    grid2: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

    statement: { marginTop: 12, display: "grid", gap: 10 },
    row: {
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
    },
    hr: { height: 1, background: T.border, margin: "4px 0" },

    empty: { marginTop: 12, padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft, color: T.muted, fontWeight: 900 },

    txCard: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },

    reminderCard: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },

    rowBetween: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },

    pill: {
      padding: "6px 10px",
      borderRadius: 999,
      border: `1px solid ${T.border}`,
      background: "transparent",
      fontWeight: 950,
      fontSize: 12,
      whiteSpace: "nowrap",
    },
    pillOk: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillWarn: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.warnBd}`, background: T.warnBg, color: T.warnTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillBad: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.badBd}`, background: T.badBg, color: T.badTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillAccent: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },

    cardGrid: { marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" },
    cardMini: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.02)" },
    cardMiniVal: { marginTop: 6, fontWeight: 950 },

    // Dropdown (custom) — PURE BLACK hover is handled in component state
    ddWrap: { position: "relative" },
    ddBtn: {
      width: 220,
      padding: compact ? "10px 10px" : "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    ddBtnCompact: {
      width: 180,
      padding: "10px 10px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 13,
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
      width: "max(220px, 100%)",
      zIndex: 60,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.panel2,
      boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
      padding: 8,
      display: "grid",
      gap: 6,
      backdropFilter: "blur(10px)",
      maxHeight: 320,
      overflow: "auto",
    },
    ddItem: {
      textAlign: "left",
      width: "100%",
      padding: "10px 10px",
      borderRadius: 12,
      color: T.text,
      background: "transparent",
      cursor: "pointer",
      fontWeight: 900,
      border: "1px solid transparent",
    },

    // hover helpers exposed for components
    hoverBlack: hoverBg,
    hoverBdColor: hoverBdColor,
    hoverBd: `1px solid ${hoverBdColor}`,

    modalOverlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.55)",
      display: "grid",
      placeItems: "center",
      padding: 14,
      zIndex: 80,
    },
    modal: {
      width: "min(1050px, 100%)",
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

    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 10 },
  };
}
