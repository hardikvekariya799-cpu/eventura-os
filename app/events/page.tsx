"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ================= TYPES ================= */
type EventStatus =
  | "Inquiry"
  | "Planned"
  | "Confirmed"
  | "In Progress"
  | "Completed"
  | "Cancelled";

type EventItem = {
  id: string;
  title: string;
  clientName: string;
  phone?: string;
  city: string;
  venue?: string;
  date: string; // YYYY-MM-DD
  guests?: number;
  budget?: number;
  status: EventStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

/* ================= STORAGE ================= */
const LS_EVENTS = "eventura_os_events_v1";

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function loadEvents(): EventItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_EVENTS);
    return raw ? (JSON.parse(raw) as EventItem[]) : [];
  } catch {
    return [];
  }
}

function saveEvents(items: EventItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_EVENTS, JSON.stringify(items));
}

/* ================= PAGE ================= */
export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | EventStatus>("All");

  // form
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Surat");
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [status, setStatus] = useState<EventStatus>("Planned");
  const [notes, setNotes] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");

  useEffect(() => {
    setEvents(loadEvents());
  }, []);

  useEffect(() => {
    saveEvents(events);
  }, [events]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return events
      .filter((e) => (statusFilter === "All" ? true : e.status === statusFilter))
      .filter((e) => {
        if (!s) return true;
        return (
          e.title.toLowerCase().includes(s) ||
          e.clientName.toLowerCase().includes(s) ||
          e.city.toLowerCase().includes(s) ||
          (e.venue || "").toLowerCase().includes(s) ||
          (e.phone || "").toLowerCase().includes(s)
        );
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [events, q, statusFilter]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setClientName("");
    setPhone("");
    setCity("Surat");
    setVenue("");
    setDate("");
    setGuests("");
    setBudget("");
    setStatus("Planned");
    setNotes("");
    setMsg("");
  }

  function startEdit(item: EventItem) {
    setEditingId(item.id);
    setTitle(item.title);
    setClientName(item.clientName);
    setPhone(item.phone || "");
    setCity(item.city);
    setVenue(item.venue || "");
    setDate(item.date);
    setGuests(item.guests?.toString() || "");
    setBudget(item.budget?.toString() || "");
    setStatus(item.status);
    setNotes(item.notes || "");
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function remove(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setMsg("✅ Event deleted");
    if (editingId === id) resetForm();
  }

  function upsert() {
    setMsg("");
    const t = title.trim();
    const c = clientName.trim();
    const d = date.trim();

    if (!t) return setMsg("❌ Event title required");
    if (!c) return setMsg("❌ Client name required");
    if (!d) return setMsg("❌ Date required");

    const now = new Date().toISOString();
    const gNum = guests.trim() ? Math.max(0, Number(guests)) : undefined;
    const bNum = budget.trim() ? Math.max(0, Number(budget)) : undefined;

    if (guests.trim() && Number.isNaN(Number(guests))) return setMsg("❌ Guests must be a number");
    if (budget.trim() && Number.isNaN(Number(budget))) return setMsg("❌ Budget must be a number");

    if (!editingId) {
      const item: EventItem = {
        id: uid(),
        title: t,
        clientName: c,
        phone: phone.trim() || undefined,
        city: city.trim() || "Surat",
        venue: venue.trim() || undefined,
        date: d,
        guests: gNum,
        budget: bNum,
        status,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      setEvents((prev) => [item, ...prev]);
      setMsg("✅ Event added");
      resetForm();
      return;
    }

    // update existing
    setEvents((prev) =>
      prev.map((e) =>
        e.id === editingId
          ? {
              ...e,
              title: t,
              clientName: c,
              phone: phone.trim() || undefined,
              city: city.trim() || "Surat",
              venue: venue.trim() || undefined,
              date: d,
              guests: gNum,
              budget: bNum,
              status,
              notes: notes.trim() || undefined,
              updatedAt: now,
            }
          : e
      )
    );
    setMsg("✅ Event updated");
    resetForm();
  }

  // ✅ IMPORTANT: status changes should overwrite saved data immediately
  function setEventStatus(id: string, next: EventStatus) {
    const now = new Date().toISOString();
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: next, updatedAt: now } : e))
    );
  }

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div style={S.topRow}>
          <div>
            <div style={S.h1}>Events</div>
            <div style={S.muted}>
              Add, update, and track statuses. Status always saves as the latest (Planned → Completed stays Completed).
            </div>
          </div>
          <button style={S.ghostBtn} onClick={resetForm}>
            Clear Form
          </button>
        </div>

        {/* FORM */}
        <div style={S.panel}>
          <div style={S.panelTitle}>{editingId ? "Edit Event" : "Create Event"}</div>

          <div style={S.grid2}>
            <Field label="Event Title">
              <input style={S.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wedding • Reception • Engagement" />
            </Field>
            <Field label="Client Name">
              <input style={S.input} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client full name" />
            </Field>

            <Field label="Phone (optional)">
              <input style={S.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91..." />
            </Field>
            <Field label="City">
              <input style={S.input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Surat / Ahmedabad / Rajkot" />
            </Field>

            <Field label="Venue (optional)">
              <input style={S.input} value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Farmhouse / Banquet / Hotel" />
            </Field>
            <Field label="Event Date">
              <input style={S.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>

            <Field label="Guests (optional)">
              <input style={S.input} value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="e.g. 250" />
            </Field>
            <Field label="Budget (optional)">
              <input style={S.input} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 500000" />
            </Field>

            <Field label="Status">
              {/* ✅ DARK SELECT: fixes white hover / unreadable dropdown */}
              <select style={S.select} value={status} onChange={(e) => setStatus(e.target.value as EventStatus)}>
                <option style={S.option}>Inquiry</option>
                <option style={S.option}>Planned</option>
                <option style={S.option}>Confirmed</option>
                <option style={S.option}>In Progress</option>
                <option style={S.option}>Completed</option>
                <option style={S.option}>Cancelled</option>
              </select>
            </Field>

            <Field label="Notes (optional)" full>
              <textarea style={S.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Decor theme, vendor requirements, payment notes..." />
            </Field>
          </div>

          <div style={S.rowBetween}>
            <div style={S.smallMuted}>
              {editingId ? "Editing existing event (updates overwrite saved data)." : "New event will be saved locally."}
            </div>
            <div style={S.row}>
              {editingId ? (
                <button style={S.dangerBtn} onClick={() => remove(editingId)}>
                  Delete
                </button>
              ) : null}
              <button style={S.primaryBtn} onClick={upsert}>
                {editingId ? "Save Changes" : "Add Event"}
              </button>
            </div>
          </div>

          {msg ? <div style={S.msg}>{msg}</div> : null}
        </div>

        {/* LIST */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Event List</div>

          <div style={S.filters}>
            <input style={S.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: title / client / city / venue / phone" />
            <select
              style={S.select}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              title="Filter by status"
            >
              <option style={S.option} value="All">
                All Status
              </option>
              <option style={S.option}>Inquiry</option>
              <option style={S.option}>Planned</option>
              <option style={S.option}>Confirmed</option>
              <option style={S.option}>In Progress</option>
              <option style={S.option}>Completed</option>
              <option style={S.option}>Cancelled</option>
            </select>
          </div>

          {!filtered.length ? (
            <div style={S.empty}>No events found.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((e) => (
                <div key={e.id} style={S.card}>
                  <div style={S.rowBetween}>
                    <div>
                      <div style={S.cardTitle}>{e.title}</div>
                      <div style={S.cardSub}>
                        {e.clientName} • {e.city} • {e.date}
                        {e.venue ? ` • ${e.venue}` : ""}
                      </div>
                    </div>

                    <div style={S.row}>
                      <button style={S.ghostBtn} onClick={() => startEdit(e)}>
                        Edit
                      </button>
                      <button style={S.dangerBtn} onClick={() => remove(e.id)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div style={S.metaGrid}>
                    <Meta label="Guests" value={e.guests ?? "—"} />
                    <Meta label="Budget" value={e.budget ?? "—"} />
                    <Meta label="Phone" value={e.phone ?? "—"} />
                    <Meta label="Updated" value={new Date(e.updatedAt).toLocaleString()} />
                  </div>

                  <div style={S.rowBetween}>
                    <div style={S.inline}>
                      <span style={S.smallMuted}>Status:</span>
                      {/* ✅ Dark dropdown + immediate save */}
                      <select
                        style={S.select}
                        value={e.status}
                        onChange={(x) => setEventStatus(e.id, x.target.value as EventStatus)}
                        title="Change status (auto-saves)"
                      >
                        <option style={S.option}>Inquiry</option>
                        <option style={S.option}>Planned</option>
                        <option style={S.option}>Confirmed</option>
                        <option style={S.option}>In Progress</option>
                        <option style={S.option}>Completed</option>
                        <option style={S.option}>Cancelled</option>
                      </select>
                      <span style={S.badge}>{e.status}</span>
                    </div>

                    {e.notes ? <div style={S.note}>{e.notes}</div> : <div style={S.smallMuted}>No notes</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={S.footerNote}>
          ✅ Hover/scroll readability fixed by dark dropdown styling. ✅ Status changes overwrite saved value immediately.
        </div>
      </div>
    </div>
  );
}

/* ================= SMALL UI HELPERS ================= */
function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...S.field, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={S.label}>{label}</div>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: any }) {
  return (
    <div style={S.meta}>
      <div style={S.metaLabel}>{label}</div>
      <div style={S.metaValue}>{String(value)}</div>
    </div>
  );
}

/* ================= STYLES ================= */
const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 16,
    background:
      "radial-gradient(1200px 800px at 20% 10%, rgba(255,215,110,0.18), transparent 60%), radial-gradient(900px 700px at 80% 20%, rgba(120,70,255,0.18), transparent 55%), #050816",
    color: "#F9FAFB",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
  },
  shell: { maxWidth: 1100, margin: "0 auto", display: "grid", gap: 12 },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  h1: { fontSize: 26, fontWeight: 950 },
  muted: { color: "#9CA3AF", fontSize: 13, marginTop: 6 },
  smallMuted: { color: "#9CA3AF", fontSize: 12 },

  panel: {
    background: "rgba(11,16,32,0.78)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
    backdropFilter: "blur(10px)",
  },
  panelTitle: { fontWeight: 950, color: "#FDE68A", marginBottom: 10 },

  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  field: { display: "grid", gap: 8 },
  label: { fontSize: 12, color: "#A7B0C0", fontWeight: 900 },

  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#F9FAFB",
    outline: "none",
    fontSize: 14,
  },

  /* ✅ FIX: dark select + prevent white hover unreadable */
  select: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#F9FAFB",
    outline: "none",
    fontSize: 14,
    fontWeight: 900,
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  },
  option: {
    backgroundColor: "#0B1020",
    color: "#F9FAFB",
  },

  textarea: {
    width: "100%",
    minHeight: 90,
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#F9FAFB",
    outline: "none",
    fontSize: 14,
    resize: "vertical",
  },

  row: { display: "flex", gap: 10, alignItems: "center" },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  inline: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },

  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(212,175,55,0.35)",
    background: "linear-gradient(135deg, rgba(212,175,55,0.32), rgba(139,92,246,0.22))",
    color: "#FFF",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  ghostBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#E5E7EB",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dangerBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(248,113,113,0.30)",
    background: "rgba(248,113,113,0.10)",
    color: "#FCA5A5",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  msg: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#E5E7EB",
    fontSize: 13,
  },

  filters: { display: "grid", gridTemplateColumns: "1fr 240px", gap: 10, marginBottom: 10 },
  empty: { color: "#A7B0C0", fontSize: 13, padding: 10 },

  card: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  cardTitle: { fontWeight: 950, fontSize: 16 },
  cardSub: { marginTop: 4, color: "#A7B0C0", fontSize: 12 },

  metaGrid: { marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 },
  meta: {
    padding: 10,
    borderRadius: 14,
    background: "rgba(11,16,32,0.70)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  metaLabel: { fontSize: 11, color: "#9CA3AF", fontWeight: 900 },
  metaValue: { marginTop: 6, fontSize: 13, fontWeight: 900 },

  badge: {
    fontSize: 12,
    fontWeight: 950,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(212,175,55,0.14)",
    border: "1px solid rgba(212,175,55,0.28)",
    color: "#FDE68A",
  },

  note: { color: "#C7CFDD", fontSize: 13, maxWidth: 520, textAlign: "right" },

  footerNote: { color: "#A7B0C0", fontSize: 12, textAlign: "center", padding: 6 },
};
