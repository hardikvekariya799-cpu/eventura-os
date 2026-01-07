"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ================== STORAGE KEYS ================== */
const LS_EMAIL = "eventura_email";
const LS_SETTINGS = "eventura_os_settings_v3";

const EVENT_KEYS_READ = ["eventura-events", "eventura_os_events_v1", "eventura_events_v1"];
const EVENT_KEY_WRITE = "eventura-events"; // single source of truth

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

type EventStatus = "Planned" | "Confirmed" | "Completed" | "Cancelled" | "Tentative";

type EventItem = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  status: EventStatus;
  city?: string;
  venue?: string;
  budget?: number;
  guests?: number;
  note?: string;
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
  localStorage.setItem(EVENT_KEY_WRITE, JSON.stringify(list));
}

function nowISO() {
  return new Date().toISOString();
}

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
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
  return dateStr >= from && dateStr <= to; // YYYY-MM-DD lexicographic safe
}

function formatCurrency(amount: number, currency: "INR" | "CAD" | "USD" = "INR") {
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
    const date = String(x?.date ?? x?.eventDate ?? "");
    const title = String(x?.title ?? x?.name ?? x?.eventName ?? "").trim();
    const statusRaw = String(x?.status ?? x?.stage ?? "Planned").trim();
    const status = (["Planned", "Confirmed", "Completed", "Cancelled", "Tentative"].includes(statusRaw)
      ? statusRaw
      : "Planned") as EventStatus;

    if (!date || !title) continue;

    out.push({
      id,
      date,
      title,
      status,
      city: x?.city ? String(x.city) : undefined,
      venue: x?.venue ? String(x.venue) : undefined,
      budget: Number.isFinite(Number(x?.budget)) ? Number(x.budget) : undefined,
      guests: Number.isFinite(Number(x?.guests)) ? Number(x.guests) : undefined,
      note: x?.note ? String(x.note) : undefined,
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
  return Array.from(m.values());
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
    hoverBlack: "rgba(0,0,0,0.55)",
    dangerBg: "rgba(248,113,113,0.10)",
    dangerBd: hc ? "rgba(248,113,113,0.55)" : "rgba(248,113,113,0.30)",
    dangerTx: "#FCA5A5",
    okBg: "rgba(34,197,94,0.12)",
    okBd: hc ? "rgba(34,197,94,0.45)" : "rgba(34,197,94,0.28)",
    okTx: "#86EFAC",
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
        dangerTx: "#B91C1C",
        glow1: "rgba(212,175,55,0.16)",
        glow2: "rgba(59,130,246,0.14)",
        accentBg: "rgba(212,175,55,0.16)",
        accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)",
        accentTx: "#92400E",
        okTx: "#166534",
        hoverBlack: "rgba(0,0,0,0.08)",
      };
    default:
      return { ...base, glow1: "rgba(255,215,110,0.18)", glow2: "rgba(120,70,255,0.18)", accentBg: "rgba(212,175,55,0.12)", accentBd: hc ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)", accentTx: "#FDE68A" };
  }
}

/* ================== UI HELPERS ================== */
function HoverLink({
  href,
  active,
  icon,
  label,
  S,
  hoverKey,
  hovered,
  setHovered,
}: {
  href: string;
  active?: boolean;
  icon: string;
  label: string;
  S: any;
  hoverKey: string;
  hovered: string | null;
  setHovered: (v: string | null) => void;
}) {
  const isHover = hovered === hoverKey;
  const style = active ? S.navActive : isHover ? S.navHover : S.navItem;

  return (
    <Link
      href={href}
      style={style as any}
      onMouseEnter={() => setHovered(hoverKey)}
      onMouseLeave={() => setHovered(null)}
    >
      <span style={S.navIcon}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function Stat({ label, value, sub, S }: { label: string; value: string; sub?: string; S: any }) {
  return (
    <div style={S.statCard}>
      <div style={S.statLabel}>{label}</div>
      <div style={S.statValue}>{value}</div>
      {sub ? <div style={S.statSub}>{sub}</div> : null}
    </div>
  );
}

function Pill({ text, tone, S }: { text: string; tone: "ok" | "warn" | "bad" | "neutral"; S: any }) {
  const st = tone === "ok" ? S.pillOk : tone === "bad" ? S.pillBad : tone === "warn" ? S.pillWarn : S.pill;
  return <span style={st}>{text}</span>;
}

/* ================== PAGE ================== */
export default function EventsPage() {
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<AppSettings>({});
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [msg, setMsg] = useState("");

  const [from, setFrom] = useState(isoMinusDays(30));
  const [to, setTo] = useState(isoPlusDays(30));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "All">("All");

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [draft, setDraft] = useState<Partial<EventItem>>({
    date: todayYMD(),
    status: "Planned",
    title: "",
    city: "Surat",
    venue: "",
    budget: undefined,
    guests: undefined,
    note: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEmail(localStorage.getItem(LS_EMAIL) || "");
    setSettings(safeLoad<AppSettings>(LS_SETTINGS, {}));
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function hydrate() {
    const loaded = loadFirstKey<any[]>(EVENT_KEYS_READ, []);
    const normalized = normalizeEvents(loaded.data);
    // sort by date DESC
    normalized.sort((a, b) => (a.date < b.date ? 1 : -1));
    setEvents(normalized);
  }

  function persist(next: EventItem[], toast?: string) {
    setEvents(next);
    writeEvents(next);
    if (toast) {
      setMsg(toast);
      setTimeout(() => setMsg(""), 1200);
    }
  }

  const isCEO = useMemo(() => {
    const ceo = (settings.ceoEmail || "hardikvekariya799@gmail.com").toLowerCase();
    return (email || "").toLowerCase() === ceo;
  }, [email, settings.ceoEmail]);

  const T = ThemeTokens((settings.theme as Theme) || "Royal Gold", settings.highContrast);
  const S = useMemo(() => makeStyles(T, !!settings.compactTables), [T, settings.compactTables]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      const okRange = inRange(e.date, from, to);
      const okStatus = statusFilter === "All" ? true : e.status === statusFilter;
      const okSearch =
        !q ||
        e.title.toLowerCase().includes(q) ||
        String(e.city || "").toLowerCase().includes(q) ||
        String(e.venue || "").toLowerCase().includes(q) ||
        String(e.note || "").toLowerCase().includes(q);
      return okRange && okStatus && okSearch;
    });
  }, [events, from, to, search, statusFilter]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const completed = filtered.filter((e) => e.status === "Completed").length;
    const confirmed = filtered.filter((e) => e.status === "Confirmed").length;
    const planned = filtered.filter((e) => e.status === "Planned" || e.status === "Tentative").length;
    const budget = filtered.reduce((a, b) => a + (typeof b.budget === "number" ? b.budget : 0), 0);
    const guests = filtered.reduce((a, b) => a + (typeof b.guests === "number" ? b.guests : 0), 0);
    return { total, completed, confirmed, planned, budget, guests };
  }, [filtered]);

  const aiSuggestions = useMemo(() => {
    // local “AI-like” logic (no external AI)
    const lines: { tone: "ok" | "warn" | "bad"; text: string }[] = [];
    const upcoming7 = filtered.filter((e) => e.date >= todayYMD() && e.date <= isoPlusDays(7));
    const upcomingUnconfirmed = upcoming7.filter((e) => e.status === "Planned" || e.status === "Tentative").length;

    if (upcomingUnconfirmed > 0) {
      lines.push({
        tone: "warn",
        text: `${upcomingUnconfirmed} event(s) in next 7 days are not confirmed. Call vendors + lock venue today.`,
      });
    } else {
      lines.push({ tone: "ok", text: "Upcoming schedule looks stable (no urgent unconfirmed events)." });
    }

    const highBudget = filtered
      .filter((e) => typeof e.budget === "number")
      .slice()
      .sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0))[0];

    if (highBudget && (highBudget.budget ?? 0) > 0) {
      lines.push({
        tone: "ok",
        text: `Highest budget in range: "${highBudget.title}" (${formatCurrency(highBudget.budget ?? 0)}). Track approvals.`,
      });
    }

    const noVenue = filtered.filter((e) => !String(e.venue || "").trim() && (e.status === "Confirmed" || e.status === "Planned")).length;
    if (noVenue > 0) {
      lines.push({ tone: "warn", text: `${noVenue} event(s) missing venue. Add venue to avoid last-minute issues.` });
    }

    const tooManyPlanned = kpis.planned >= 5;
    if (tooManyPlanned) {
      lines.push({ tone: "bad", text: "Too many planned/tentative events. Focus on converting to Confirmed." });
    }

    return lines.slice(0, 5);
  }, [filtered, kpis.planned]);

  function openCreate() {
    setEditingId(null);
    setDraft({
      date: todayYMD(),
      status: "Planned",
      title: "",
      city: "Surat",
      venue: "",
      budget: undefined,
      guests: undefined,
      note: "",
    });
    setOpenForm(true);
  }

  function openEdit(id: string) {
    const e = events.find((x) => x.id === id);
    if (!e) return;
    setEditingId(id);
    setDraft({ ...e });
    setOpenForm(true);
  }

  function closeForm() {
    setOpenForm(false);
    setEditingId(null);
  }

  function saveDraft() {
    const title = String(draft.title || "").trim();
    const date = String(draft.date || "").trim();
    const status = (draft.status || "Planned") as EventStatus;

    if (!title || !date) {
      setMsg("❌ Title and Date are required");
      setTimeout(() => setMsg(""), 1200);
      return;
    }

    const base: EventItem = {
      id: editingId || uid(),
      title,
      date,
      status,
      city: String(draft.city || "").trim() || undefined,
      venue: String(draft.venue || "").trim() || undefined,
      budget: Number.isFinite(Number(draft.budget)) ? Number(draft.budget) : undefined,
      guests: Number.isFinite(Number(draft.guests)) ? Number(draft.guests) : undefined,
      note: String(draft.note || "").trim() || undefined,
      createdAt: editingId ? String((events.find((x) => x.id === editingId)?.createdAt ?? nowISO())) : nowISO(),
      updatedAt: nowISO(),
    };

    let next: EventItem[];
    if (editingId) {
      next = events.map((e) => (e.id === editingId ? base : e));
    } else {
      next = [base, ...events];
    }

    next.sort((a, b) => (a.date < b.date ? 1 : -1));
    persist(next, editingId ? "✅ Event updated" : "✅ Event added");
    closeForm();
  }

  function removeEvent(id: string) {
    const e = events.find((x) => x.id === id);
    if (!e) return;
    const ok = confirm(`Delete event: "${e.title}" ?`);
    if (!ok) return;
    const next = events.filter((x) => x.id !== id);
    persist(next, "🗑️ Deleted");
  }

  function updateStatus(id: string, status: EventStatus) {
    // ✅ Always save newest status (no old value)
    const next = events.map((e) => (e.id === id ? { ...e, status, updatedAt: nowISO() } : e));
    persist(next, "✅ Status updated");
  }

  return (
    <div style={S.app}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          <div>
            <div style={S.brandName}>Eventura</div>
            <div style={S.brandSub}>Events</div>
          </div>
        </div>

        <nav style={S.nav}>
          <HoverLink href="/dashboard" icon="📊" label="Dashboard" S={S} hoverKey="dash" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/events" active icon="📅" label="Events" S={S} hoverKey="events" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/finance" icon="💰" label="Finance" S={S} hoverKey="fin" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/vendors" icon="🏷️" label="Vendors" S={S} hoverKey="vendors" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/hr" icon="🧑‍🤝‍🧑" label="HR" S={S} hoverKey="hr" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/reports" icon="📈" label="Reports" S={S} hoverKey="reports" hovered={hoveredNav} setHovered={setHoveredNav} />
          <HoverLink href="/settings" icon="⚙️" label="Settings" S={S} hoverKey="settings" hovered={hoveredNav} setHovered={setHoveredNav} />
        </nav>

        <div style={S.sidebarFooter}>
          <div style={S.userBox}>
            <div style={S.userLabel}>Signed in</div>
            <div style={S.userEmail}>{email || "Unknown"}</div>
            <div style={S.roleBadge}>{isCEO ? "CEO" : "Staff"}</div>
          </div>
          <div style={S.smallNote}>Tip: Keep events updated → Reports becomes powerful.</div>
        </div>
      </aside>

      {/* Main */}
      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={S.h1}>Events Management</div>
            <div style={S.muted}>Professional • Fast • Deploy-safe • Black hover • Theme-aware</div>
          </div>

          <div style={S.headerRight}>
            <button style={S.secondaryBtn} onClick={() => { hydrate(); setMsg("✅ Refreshed"); setTimeout(() => setMsg(""), 900); }}>
              Refresh
            </button>
            {isCEO ? (
              <button style={S.primaryBtn} onClick={openCreate}>
                + Add Event
              </button>
            ) : (
              <div style={S.lockNote}>Staff can view + update status</div>
            )}
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* Filters */}
        <div style={S.filters}>
          <div style={S.filterRow}>
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
                placeholder="Search title, city, venue, notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={S.field}>
              <div style={S.smallMuted}>Status</div>
              <select style={S.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                <option value="All">All</option>
                <option value="Planned">Planned</option>
                <option value="Tentative">Tentative</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* KPI */}
        <div style={S.kpiGrid}>
          <Stat label="Events" value={String(kpis.total)} sub={`Range ${from} → ${to}`} S={S} />
          <Stat label="Confirmed" value={String(kpis.confirmed)} sub="Delivery locked" S={S} />
          <Stat label="Completed" value={String(kpis.completed)} sub="Revenue recognized" S={S} />
          <Stat label="Budget (range)" value={formatCurrency(kpis.budget)} sub={`Guests total ${kpis.guests || 0}`} S={S} />
        </div>

        {/* AI suggestions */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Smart Suggestions (Auto)</div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {aiSuggestions.map((x, i) => (
              <div key={i} style={S.suggestRow}>
                <Pill text={x.tone === "ok" ? "OK" : x.tone === "warn" ? "ATTN" : "RISK"} tone={x.tone} S={S} />
                <div style={S.suggestText}>{x.text}</div>
              </div>
            ))}
          </div>
        </section>

        {/* List */}
        <section style={S.panel}>
          <div style={S.panelTop}>
            <div>
              <div style={S.panelTitle}>Event List</div>
              <div style={S.smallNote}>Tip: Updating status is instant and saved.</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <button style={S.secondaryBtn} onClick={() => { setFrom(isoMinusDays(30)); setTo(isoPlusDays(30)); setSearch(""); setStatusFilter("All"); }}>
                Reset Filters
              </button>
            </div>
          </div>

          {!filtered.length ? (
            <div style={S.empty}>No events match your filters.</div>
          ) : (
            <div style={S.list}>
              {filtered.map((e) => {
                const tone: "ok" | "warn" | "bad" | "neutral" =
                  e.status === "Completed" ? "ok" : e.status === "Confirmed" ? "ok" : e.status === "Cancelled" ? "bad" : e.status === "Tentative" ? "warn" : "neutral";

                return (
                  <div key={e.id} style={S.card}>
                    <div style={S.cardTop}>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={S.cardTitleRow}>
                          <div style={S.cardTitle}>{e.title}</div>
                          <Pill text={e.status} tone={tone} S={S} />
                        </div>
                        <div style={S.meta}>
                          <span><b>Date:</b> {e.date}</span>
                          <span><b>City:</b> {e.city || "—"}</span>
                          <span><b>Venue:</b> {e.venue || "—"}</span>
                          <span><b>Budget:</b> {typeof e.budget === "number" ? formatCurrency(e.budget) : "—"}</span>
                          <span><b>Guests:</b> {typeof e.guests === "number" ? e.guests : "—"}</span>
                        </div>
                        {e.note ? <div style={S.note}>{e.note}</div> : null}
                        <div style={S.smallMuted}>Updated: {new Date(e.updatedAt).toLocaleString()}</div>
                      </div>

                      <div style={S.actions}>
                        <div style={S.smallMuted}>Status</div>
                        <select
                          style={S.select}
                          value={e.status}
                          onChange={(ev) => updateStatus(e.id, ev.target.value as EventStatus)}
                        >
                          <option value="Planned">Planned</option>
                          <option value="Tentative">Tentative</option>
                          <option value="Confirmed">Confirmed</option>
                          <option value="Completed">Completed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>

                        {isCEO ? (
                          <>
                            <button style={S.secondaryBtn} onClick={() => openEdit(e.id)}>Edit</button>
                            <button style={S.dangerBtn} onClick={() => removeEvent(e.id)}>Delete</button>
                          </>
                        ) : null}
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
          <div style={S.modalOverlay} onMouseDown={closeForm}>
            <div style={S.modal} onMouseDown={(e) => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <div style={S.modalTitle}>{editingId ? "Edit Event" : "Add Event"}</div>
                <button style={S.secondaryBtn} onClick={closeForm}>Close</button>
              </div>

              <div style={S.modalGrid}>
                <div style={S.field}>
                  <div style={S.smallMuted}>Title *</div>
                  <input style={S.input} value={draft.title || ""} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Date *</div>
                  <input style={S.input} type="date" value={String(draft.date || "")} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Status</div>
                  <select style={S.select} value={(draft.status as any) || "Planned"} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as any }))}>
                    <option value="Planned">Planned</option>
                    <option value="Tentative">Tentative</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>City</div>
                  <input style={S.input} value={draft.city || ""} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Venue</div>
                  <input style={{ ...S.input, width: "100%" }} value={draft.venue || ""} onChange={(e) => setDraft((d) => ({ ...d, venue: e.target.value }))} />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Budget</div>
                  <input
                    style={S.input}
                    type="number"
                    value={draft.budget ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, budget: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Guests</div>
                  <input
                    style={S.input}
                    type="number"
                    value={draft.guests ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, guests: e.target.value === "" ? undefined : Number(e.target.value) }))}
                  />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Notes</div>
                  <textarea
                    style={S.textarea}
                    value={draft.note || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                    placeholder="Add important notes (vendors, timing, client requirements...)"
                  />
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

        <div style={S.footerNote}>✅ Advanced Events • ✅ Black hover • ✅ Theme applied • ✅ Deploy-safe</div>
      </main>
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
    navIcon: { width: 22, display: "inline-block" },

    navItem: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 12px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.border}`,
      background: T.soft,
      fontWeight: 900,
      fontSize: 13,
      transition: "background 120ms ease, transform 120ms ease",
    },
    navHover: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 12px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.border}`,
      background: T.hoverBlack,
      fontWeight: 900,
      fontSize: 13,
      transform: "translateY(-1px)",
    },
    navActive: {
      display: "flex",
      alignItems: "center",
      gap: 10,
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
    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35 },

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
    lockNote: { padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.muted, fontWeight: 900, fontSize: 12 },

    msg: { marginTop: 12, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontSize: 13 },

    filters: { marginTop: 12, padding: 12, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },
    filterRow: { display: "grid", gridTemplateColumns: "220px 220px 1fr 220px", gap: 10, alignItems: "end" },

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
    textarea: {
      width: "100%",
      minHeight: 120,
      padding: "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
      resize: "vertical",
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
      border: `1px solid ${T.dangerBd}`,
      background: T.dangerBg,
      color: T.dangerTx,
      fontWeight: 950,
      cursor: "pointer",
    },

    kpiGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
    statCard: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    statLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    statValue: { marginTop: 8, fontSize: 20, fontWeight: 950 },
    statSub: { marginTop: 6, color: T.muted, fontSize: 12, lineHeight: 1.3 },

    panel: { marginTop: 12, padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    panelTitle: { fontWeight: 950, color: T.accentTx },
    panelTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" },

    suggestRow: { display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft },
    suggestText: { fontWeight: 850, lineHeight: 1.35, fontSize: 13 },

    list: { marginTop: 12, display: "grid", gap: 12 },
    card: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },
    cardTop: { display: "grid", gridTemplateColumns: "1fr 260px", gap: 12, alignItems: "start" },

    cardTitleRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
    cardTitle: { fontWeight: 950, fontSize: 16 },

    meta: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, color: T.muted, fontSize: 12 },
    note: { padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)", fontSize: 13, fontWeight: 850 },

    actions: { display: "grid", gap: 10, justifyItems: "stretch" },

    pill: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillOk: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillWarn: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillBad: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.dangerBd}`, background: T.dangerBg, color: T.dangerTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },

    empty: { marginTop: 12, padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft, color: T.muted, fontWeight: 900 },

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
      width: "min(980px, 100%)",
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel2,
      backdropFilter: "blur(10px)",
      padding: 14,
    },
    modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
    modalTitle: { fontWeight: 950, fontSize: 18, color: T.accentTx },
    modalGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 220px 220px", gap: 10, alignItems: "end" },
    modalFooter: { marginTop: 12, display: "flex", justifyContent: "flex-end" },

    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 10 },
  };
}
