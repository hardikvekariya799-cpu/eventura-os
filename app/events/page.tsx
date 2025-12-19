"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

/* ================== SUPABASE SAFE ================== */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/* ================== ROLE ================== */
type Role = "CEO" | "Staff";
const CEO_EMAIL = process.env.NEXT_PUBLIC_CEO_EMAIL || "hardikvekariya799@gmail.com";

function roleFromEmail(email: string | null | undefined): Role {
  if (!email) return "Staff";
  return email.toLowerCase() === CEO_EMAIL.toLowerCase() ? "CEO" : "Staff";
}

/* ================== EVENT TYPES ================== */
type EventStatus = "Lead" | "Tentative" | "Confirmed" | "Completed" | "Cancelled";

type EventItem = {
  id: string;
  createdAt: string;

  title: string;
  date: string; // YYYY-MM-DD
  city: string;

  clientName: string;
  clientPhone: string;

  status: EventStatus;

  budget: number; // total budget
  advancePaid: number; // paid
  notes?: string;
};

const LS_EVENTS = "eventura_os_events_v2";

/* ================== HELPERS ================== */
function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function money(n: number) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "CAD" }).format(n);
  } catch {
    return `$${(n || 0).toFixed(2)}`;
  }
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
function saveEvents(events: EventItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_EVENTS, JSON.stringify(events));
}
function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function toCSV(rows: any[]) {
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const out = [headers.map(esc).join(",")];
  for (const r of rows) out.push(headers.map((h) => esc(r[h])).join(","));
  return out.join("\n");
}

/* ================== PAGE ================== */
export default function EventsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("Staff");

  const isCEO = role === "CEO";

  const [events, setEvents] = useState<EventItem[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<EventStatus | "All">("All");
  const [cityFilter, setCityFilter] = useState<string>("All");

  // modal editor
  const [editing, setEditing] = useState<EventItem | null>(null);

  const [form, setForm] = useState({
    title: "",
    date: todayISO(),
    city: "Surat",
    clientName: "",
    clientPhone: "",
    status: "Lead" as EventStatus,
    budget: 0,
    advancePaid: 0,
    notes: "",
  });

  // boot
  useEffect(() => {
    setEvents(loadEvents());
  }, []);

  // persist
  useEffect(() => {
    saveEvents(events);
  }, [events]);

  // auth
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");

      // If no supabase, still allow viewing local events, but show warning
      if (!supabase) {
        setEmail("(no-supabase-env)");
        setRole("CEO"); // allow editing locally if env missing (so you can keep working)
        setErr(
          "⚠️ Supabase env missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). Events still work locally."
        );
        setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const sessionEmail = data.session?.user?.email ?? null;

      if (!sessionEmail) {
        window.location.href = "/login";
        return;
      }

      setEmail(sessionEmail);
      setRole(roleFromEmail(sessionEmail));
      setLoading(false);
    })();
  }, []);

  const cities = useMemo(() => {
    const set = new Set(events.map((e) => (e.city || "").trim()).filter(Boolean));
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [events]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = [...events];

    // filters
    if (statusFilter !== "All") list = list.filter((e) => e.status === statusFilter);
    if (cityFilter !== "All") list = list.filter((e) => (e.city || "") === cityFilter);

    // search
    if (s) {
      list = list.filter((e) => {
        return (
          e.title.toLowerCase().includes(s) ||
          e.clientName.toLowerCase().includes(s) ||
          e.clientPhone.toLowerCase().includes(s) ||
          e.city.toLowerCase().includes(s) ||
          e.status.toLowerCase().includes(s)
        );
      });
    }

    // sort by date
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    return list;
  }, [events, q, statusFilter, cityFilter]);

  const totals = useMemo(() => {
    const totalBudget = filtered.reduce((sum, e) => sum + num(e.budget), 0);
    const totalAdvance = filtered.reduce((sum, e) => sum + num(e.advancePaid), 0);
    return { totalBudget, totalAdvance, totalRemaining: totalBudget - totalAdvance };
  }, [filtered]);

  function resetForm() {
    setForm({
      title: "",
      date: todayISO(),
      city: "Surat",
      clientName: "",
      clientPhone: "",
      status: "Lead",
      budget: 0,
      advancePaid: 0,
      notes: "",
    });
  }

  function addEvent() {
    if (!isCEO) return;

    const title = form.title.trim();
    if (!title) {
      setErr("❌ Event title is required.");
      return;
    }

    const item: EventItem = {
      id: uid(),
      createdAt: new Date().toISOString(),
      title,
      date: form.date || todayISO(),
      city: (form.city || "Surat").trim(),
      clientName: (form.clientName || "").trim(),
      clientPhone: (form.clientPhone || "").trim(),
      status: form.status,
      budget: num(form.budget),
      advancePaid: num(form.advancePaid),
      notes: (form.notes || "").trim() || undefined,
    };

    setEvents((prev) => [item, ...prev]);
    resetForm();
    setErr("");
  }

  function deleteEvent(id: string) {
    if (!isCEO) return;
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function openEdit(e: EventItem) {
    if (!isCEO) return;
    setEditing(e);
  }

  function saveEdit() {
    if (!isCEO || !editing) return;

    const cleaned: EventItem = {
      ...editing,
      title: editing.title.trim(),
      city: (editing.city || "Surat").trim(),
      clientName: (editing.clientName || "").trim(),
      clientPhone: (editing.clientPhone || "").trim(),
      budget: num(editing.budget),
      advancePaid: num(editing.advancePaid),
      notes: (editing.notes || "").trim() || undefined,
    };

    if (!cleaned.title) {
      setErr("❌ Event title is required.");
      return;
    }

    setEvents((prev) => prev.map((x) => (x.id === cleaned.id ? cleaned : x)));
    setEditing(null);
    setErr("");
  }

  function exportCSV() {
    const rows = filtered.map((e) => ({
      id: e.id,
      date: e.date,
      title: e.title,
      city: e.city,
      status: e.status,
      clientName: e.clientName,
      clientPhone: e.clientPhone,
      budget: e.budget,
      advancePaid: e.advancePaid,
      remaining: num(e.budget) - num(e.advancePaid),
      notes: e.notes || "",
      createdAt: e.createdAt,
    }));
    const csv = toCSV(rows);
    downloadText(`eventura-events-${todayISO()}.csv`, csv || "No data");
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.h1}>Events</div>
          <div style={styles.muted}>Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, maxWidth: 1100 }}>
        <div style={styles.topRow}>
          <div>
            <div style={styles.h1}>Events</div>
            <div style={styles.muted}>
              Logged in: <b>{email}</b> • Role:{" "}
              <span style={styles.rolePill}>{role}</span>
            </div>
          </div>

          <div style={styles.inline}>
            <button style={styles.ghostBtn} onClick={exportCSV}>
              Export CSV
            </button>
          </div>
        </div>

        {err ? <div style={styles.err}>{err}</div> : null}

        <div style={styles.grid2}>
          {/* LEFT: ADD + LIST */}
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Event Pipeline</div>

            {/* Add form */}
            {isCEO ? (
              <div style={styles.addBox}>
                <div style={styles.row2}>
                  <div>
                    <div style={styles.label}>Date</div>
                    <input
                      style={styles.input}
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div style={styles.label}>Status</div>
                    <select
                      style={styles.select}
                      value={form.status}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, status: e.target.value as EventStatus }))
                      }
                    >
                      <option>Lead</option>
                      <option>Tentative</option>
                      <option>Confirmed</option>
                      <option>Completed</option>
                      <option>Cancelled</option>
                    </select>
                  </div>
                </div>

                <div style={styles.label}>Event Title</div>
                <input
                  style={styles.input}
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Wedding / Engagement / Corporate Event"
                />

                <div style={styles.row2}>
                  <div>
                    <div style={styles.label}>City</div>
                    <input
                      style={styles.input}
                      value={form.city}
                      onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <div style={styles.label}>Budget</div>
                    <input
                      style={styles.input}
                      type="number"
                      value={form.budget}
                      onChange={(e) => setForm((p) => ({ ...p, budget: num(e.target.value) }))}
                    />
                  </div>
                </div>

                <div style={styles.row2}>
                  <div>
                    <div style={styles.label}>Client Name</div>
                    <input
                      style={styles.input}
                      value={form.clientName}
                      onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
                      placeholder="Client full name"
                    />
                  </div>
                  <div>
                    <div style={styles.label}>Client Phone</div>
                    <input
                      style={styles.input}
                      value={form.clientPhone}
                      onChange={(e) => setForm((p) => ({ ...p, clientPhone: e.target.value }))}
                      placeholder="+91..."
                    />
                  </div>
                </div>

                <div style={styles.row2}>
                  <div>
                    <div style={styles.label}>Advance Paid</div>
                    <input
                      style={styles.input}
                      type="number"
                      value={form.advancePaid}
                      onChange={(e) => setForm((p) => ({ ...p, advancePaid: num(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <div style={styles.label}>Remaining (auto)</div>
                    <input
                      style={{ ...styles.input, opacity: 0.8 }}
                      value={money(num(form.budget) - num(form.advancePaid))}
                      readOnly
                    />
                  </div>
                </div>

                <div style={styles.label}>Notes</div>
                <textarea
                  style={styles.textarea}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Venue, guest count, theme, vendor notes…"
                />

                <div style={styles.rowBetween}>
                  <div style={styles.smallNote}>Saved locally (works immediately).</div>
                  <button style={styles.primaryBtnSmall} onClick={addEvent}>
                    Add Event
                  </button>
                </div>
              </div>
            ) : (
              <div style={styles.noteBox}>
                Staff can view events. CEO can add/edit/delete.
              </div>
            )}

            {/* Filters */}
            <div style={styles.filters}>
              <input
                style={styles.input}
                placeholder="Search (title, client, city, phone, status)…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div style={styles.row2}>
                <select
                  style={styles.select}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="All">All Status</option>
                  <option>Lead</option>
                  <option>Tentative</option>
                  <option>Confirmed</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>

                <select
                  style={styles.select}
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                >
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c === "All" ? "All Cities" : c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* List */}
            {filtered.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {filtered.map((e) => {
                  const remaining = num(e.budget) - num(e.advancePaid);
                  return (
                    <div key={e.id} style={styles.itemCard}>
                      <div style={styles.rowBetween}>
                        <div style={{ fontWeight: 950 }}>{e.title}</div>
                        <span style={pill(e.status)}>{e.status}</span>
                      </div>

                      <div style={styles.smallMuted}>
                        {e.date} • {e.city} • Budget: {money(num(e.budget))}
                      </div>
                      <div style={styles.smallMuted}>
                        Advance: {money(num(e.advancePaid))} • Remaining: {money(remaining)}
                      </div>
                      <div style={styles.smallMuted}>
                        Client: {e.clientName || "-"} • {e.clientPhone || "-"}
                      </div>

                      {e.notes ? <div style={styles.taskNote}>{e.notes}</div> : null}

                      {isCEO ? (
                        <div style={styles.rowBetween}>
                          <div style={styles.inline}>
                            <button style={styles.ghostBtn} onClick={() => openEdit(e)}>
                              Edit
                            </button>
                            <button style={styles.dltBtn} onClick={() => deleteEvent(e.id)}>
                              Delete
                            </button>
                          </div>
                          <div style={styles.smallMuted}>
                            {new Date(e.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={styles.muted}>No events found.</div>
            )}
          </div>

          {/* RIGHT: SUMMARY */}
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Summary</div>

            <div style={styles.kpiRow}>
              <KPI label="Events" value={filtered.length} />
              <KPI label="Budget" value={money(totals.totalBudget)} />
              <KPI label="Advance" value={money(totals.totalAdvance)} />
            </div>

            <div style={{ ...styles.kpiRow, marginTop: 10 }}>
              <KPI label="Remaining" value={money(totals.totalRemaining)} />
              <KPI label="Confirmed" value={filtered.filter((x) => x.status === "Confirmed").length} />
              <KPI label="Leads" value={filtered.filter((x) => x.status === "Lead").length} />
            </div>

            <div style={styles.sectionTitle}>Workflow</div>
            <div style={styles.noteBox}>
              <b>Lead</b> → inquiry  
              <br />
              <b>Tentative</b> → negotiation  
              <br />
              <b>Confirmed</b> → booking fixed + advance received  
              <br />
              <b>Completed</b> → event done + final payment  
              <br />
              <b>Cancelled</b> → dropped
            </div>

            <div style={styles.sectionTitle}>Next Upgrade</div>
            <div style={styles.noteBox}>
              Next we will connect Events to Supabase tables so events sync on all devices.
            </div>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editing ? (
        <div style={styles.modalOverlay} onClick={() => setEditing(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Edit Event</div>

            <div style={styles.label}>Title</div>
            <input
              style={styles.input}
              value={editing.title}
              onChange={(e) => setEditing((p) => (p ? { ...p, title: e.target.value } : p))}
            />

            <div style={styles.row2}>
              <div>
                <div style={styles.label}>Date</div>
                <input
                  style={styles.input}
                  type="date"
                  value={editing.date}
                  onChange={(e) => setEditing((p) => (p ? { ...p, date: e.target.value } : p))}
                />
              </div>
              <div>
                <div style={styles.label}>Status</div>
                <select
                  style={styles.select}
                  value={editing.status}
                  onChange={(e) =>
                    setEditing((p) => (p ? { ...p, status: e.target.value as EventStatus } : p))
                  }
                >
                  <option>Lead</option>
                  <option>Tentative</option>
                  <option>Confirmed</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
              </div>
            </div>

            <div style={styles.row2}>
              <div>
                <div style={styles.label}>City</div>
                <input
                  style={styles.input}
                  value={editing.city}
                  onChange={(e) => setEditing((p) => (p ? { ...p, city: e.target.value } : p))}
                />
              </div>
              <div>
                <div style={styles.label}>Budget</div>
                <input
                  style={styles.input}
                  type="number"
                  value={editing.budget}
                  onChange={(e) =>
                    setEditing((p) => (p ? { ...p, budget: num(e.target.value) } : p))
                  }
                />
              </div>
            </div>

            <div style={styles.row2}>
              <div>
                <div style={styles.label}>Advance Paid</div>
                <input
                  style={styles.input}
                  type="number"
                  value={editing.advancePaid}
                  onChange={(e) =>
                    setEditing((p) => (p ? { ...p, advancePaid: num(e.target.value) } : p))
                  }
                />
              </div>
              <div>
                <div style={styles.label}>Remaining (auto)</div>
                <input
                  style={{ ...styles.input, opacity: 0.8 }}
                  readOnly
                  value={money(num(editing.budget) - num(editing.advancePaid))}
                />
              </div>
            </div>

            <div style={styles.row2}>
              <div>
                <div style={styles.label}>Client Name</div>
                <input
                  style={styles.input}
                  value={editing.clientName}
                  onChange={(e) =>
                    setEditing((p) => (p ? { ...p, clientName: e.target.value } : p))
                  }
                />
              </div>
              <div>
                <div style={styles.label}>Client Phone</div>
                <input
                  style={styles.input}
                  value={editing.clientPhone}
                  onChange={(e) =>
                    setEditing((p) => (p ? { ...p, clientPhone: e.target.value } : p))
                  }
                />
              </div>
            </div>

            <div style={styles.label}>Notes</div>
            <textarea
              style={styles.textarea}
              value={editing.notes || ""}
              onChange={(e) => setEditing((p) => (p ? { ...p, notes: e.target.value } : p))}
            />

            <div style={styles.modalActions}>
              <button style={styles.ghostBtn} onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button style={styles.primaryBtnSmall} onClick={saveEdit}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ================== UI ================== */
function KPI({ label, value }: { label: string; value: any }) {
  return (
    <div style={styles.kpi}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}
function pillStyle(bg: string, border: string, color: string): React.CSSProperties {
  return {
    fontSize: 12,
    padding: "5px 10px",
    borderRadius: 999,
    fontWeight: 900,
    background: bg,
    border,
    color,
    whiteSpace: "nowrap",
  };
}
function pill(status: string): React.CSSProperties {
  if (status === "Confirmed" || status === "Completed") {
    return pillStyle("rgba(34,197,94,0.12)", "1px solid rgba(34,197,94,0.22)", "#BBF7D0");
  }
  if (status === "Lead") {
    return pillStyle("rgba(96,165,250,0.12)", "1px solid rgba(96,165,250,0.22)", "#BFDBFE");
  }
  if (status === "Tentative") {
    return pillStyle("rgba(234,179,8,0.12)", "1px solid rgba(234,179,8,0.22)", "#FDE68A");
  }
  if (status === "Cancelled") {
    return pillStyle("rgba(248,113,113,0.12)", "1px solid rgba(248,113,113,0.22)", "#FCA5A5");
  }
  return pillStyle("rgba(255,255,255,0.06)", "1px solid rgba(255,255,255,0.14)", "#E5E7EB");
}

/* ================== STYLES ================== */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 16,
    background:
      "radial-gradient(1200px 800px at 20% 10%, rgba(255,215,110,0.18), transparent 60%), radial-gradient(900px 700px at 80% 20%, rgba(120,70,255,0.18), transparent 55%), #050816",
    color: "#F9FAFB",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
  },
  card: {
    width: "100%",
    maxWidth: 1100,
    margin: "0 auto",
    background: "rgba(11,16,32,0.92)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
    backdropFilter: "blur(10px)",
  },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  h1: { fontSize: 26, fontWeight: 950 },
  muted: { color: "#9CA3AF", fontSize: 13, marginTop: 6 },
  smallMuted: { color: "#9CA3AF", fontSize: 12 },
  rolePill: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 900,
    background: "rgba(139,92,246,0.16)",
    border: "1px solid rgba(139,92,246,0.30)",
    color: "#DDD6FE",
  },
  err: {
    marginTop: 12,
    marginBottom: 12,
    padding: 10,
    borderRadius: 12,
    background: "rgba(248,113,113,0.12)",
    border: "1px solid rgba(248,113,113,0.28)",
    color: "#FCA5A5",
    fontSize: 13,
    lineHeight: 1.4,
  },
  grid2: { marginTop: 12, display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 },
  panel: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
  },
  panelTitle: { fontSize: 14, fontWeight: 950, marginBottom: 10, color: "#FDE68A" },
  addBox: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(212,175,55,0.07)",
    border: "1px solid rgba(212,175,55,0.18)",
    marginBottom: 12,
    display: "grid",
    gap: 10,
  },
  label: { fontSize: 12, color: "#9CA3AF", fontWeight: 800, marginBottom: 6 },
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
  textarea: {
    width: "100%",
    minHeight: 80,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#F9FAFB",
    outline: "none",
    fontSize: 14,
    resize: "vertical",
  },
  select: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#F9FAFB",
    outline: "none",
    fontWeight: 800,
  },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  inline: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  primaryBtnSmall: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(212,175,55,0.35)",
    background: "linear-gradient(135deg, rgba(212,175,55,0.32), rgba(139,92,246,0.22))",
    color: "#FFF",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#E5E7EB",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dltBtn: {
    fontSize: 12,
    padding: "9px 10px",
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.30)",
    background: "rgba(248,113,113,0.10)",
    color: "#FCA5A5",
    fontWeight: 900,
    cursor: "pointer",
  },
  filters: { display: "grid", gap: 10, marginBottom: 12 },
  itemCard: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(11,16,32,0.70)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  taskNote: { marginTop: 8, color: "#C7CFDD", fontSize: 13, lineHeight: 1.35 },
  kpiRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 },
  kpi: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  kpiLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: 800 },
  kpiValue: { marginTop: 6, fontSize: 16, fontWeight: 950 },
  sectionTitle: { marginTop: 14, fontWeight: 950, color: "#E5E7EB", fontSize: 13 },
  noteBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    background: "rgba(139,92,246,0.10)",
    border: "1px solid rgba(139,92,246,0.22)",
    color: "#E9D5FF",
    fontSize: 13,
    lineHeight: 1.35,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 50,
  },
  modal: {
    width: "100%",
    maxWidth: 720,
    background: "rgba(11,16,32,0.96)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
  },
  modalTitle: { fontSize: 16, fontWeight: 950, color: "#FDE68A", marginBottom: 10 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 },
  smallNote: { fontSize: 12, color: "#A7B0C0" },
};
