"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

type EventRow = {
  id: number;
  title: string;
  event_date: string; // YYYY-MM-DD
  city: string | null;
  status: string;
  budget: number | null;
  created_at: string;
  created_by: string | null;
};

const STATUSES = ["Tentative", "Confirmed", "Completed", "Cancelled"];

export default function EventsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string>("");

  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  // form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("Tentative");
  const [budget, setBudget] = useState<string>("");

  const isEditing = useMemo(() => editingId !== null, [editingId]);

  useEffect(() => {
    (async () => {
      try {
        const supabase = supabaseClient();

        // Magic-link safety
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(window.location.href);
          window.history.replaceState({}, document.title, "/events");
        }

        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          router.replace("/login");
          return;
        }

        setUserId(data.user.id);
        setChecking(false);
        await refresh();
      } catch {
        router.replace("/login");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function refresh() {
    setLoading(true);
    setMsg("");
    try {
      const supabase = supabaseClient();
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("event_date", { ascending: true });

      if (error) throw error;
      setRows((data as EventRow[]) ?? []);
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Failed to load events"}`);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setEventDate("");
    setCity("");
    setStatus("Tentative");
    setBudget("");
  }

  function startEdit(r: EventRow) {
    setEditingId(r.id);
    setTitle(r.title ?? "");
    setEventDate(r.event_date ?? "");
    setCity(r.city ?? "");
    setStatus(r.status ?? "Tentative");
    setBudget(r.budget === null || r.budget === undefined ? "" : String(r.budget));
  }

  async function saveEvent() {
    setLoading(true);
    setMsg("");

    try {
      if (!title.trim()) throw new Error("Title is required");
      if (!eventDate.trim()) throw new Error("Event date is required");

      const supabase = supabaseClient();
      const budgetNum =
        budget.trim() === ""
          ? null
          : Number.isFinite(Number(budget))
          ? Number(budget)
          : null;

      if (budget.trim() !== "" && budgetNum === null) {
        throw new Error("Budget must be a number");
      }

      if (isEditing && editingId !== null) {
        const { error } = await supabase
          .from("events")
          .update({
            title: title.trim(),
            event_date: eventDate,
            city: city.trim() ? city.trim() : null,
            status,
            budget: budgetNum,
          })
          .eq("id", editingId);

        if (error) throw error;
        setMsg("✅ Event updated");
      } else {
        const { error } = await supabase.from("events").insert({
          title: title.trim(),
          event_date: eventDate,
          city: city.trim() ? city.trim() : null,
          status,
          budget: budgetNum,
          created_by: userId || null,
        });

        if (error) throw error;
        setMsg("✅ Event added");
      }

      resetForm();
      await refresh();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Save failed"}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteEvent(id: number) {
    const ok = confirm("Delete this event? This cannot be undone.");
    if (!ok) return;

    setLoading(true);
    setMsg("");
    try {
      const supabase = supabaseClient();
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;

      setMsg("✅ Deleted");
      await refresh();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Delete failed"}`);
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    // CSV export for current rows
    const headers = ["id", "event_date", "title", "city", "status", "budget", "created_at"];
    const escape = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      // escape quotes and wrap if needed
      const needsWrap = /[",\n]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needsWrap ? `"${escaped}"` : escaped;
    };

    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.id,
          r.event_date,
          r.title,
          r.city ?? "",
          r.status,
          r.budget ?? "",
          r.created_at ?? "",
        ].map(escape).join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const yyyy = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `eventura_events_${yyyy}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  if (checking) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
        <h1 style={{ fontSize: 22 }}>Checking login…</h1>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Events</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Add / Edit / Delete events + Download CSV.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={downloadCSV}
            disabled={rows.length === 0}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: rows.length === 0 ? "not-allowed" : "pointer",
              fontWeight: 900,
              opacity: rows.length === 0 ? 0.6 : 1,
            }}
          >
            Download CSV
          </button>

          <button
            onClick={refresh}
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* FORM */}
      <div
        style={{
          marginTop: 14,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 10 }}>
          {isEditing ? `Edit Event #${editingId}` : "Add New Event"}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Patel Wedding"
              style={inputStyle}
            />
          </Field>

          <Field label="Event Date">
            <input
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              type="date"
              style={inputStyle}
            />
          </Field>

          <Field label="City">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Surat / Ahmedabad"
              style={inputStyle}
            />
          </Field>

          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Budget (₹)">
            <input
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g., 500000"
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={saveEvent}
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            {loading ? "Saving..." : isEditing ? "Update Event" : "Add Event"}
          </button>

          <button
            onClick={resetForm}
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Clear
          </button>
        </div>

        {msg ? (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              whiteSpace: "pre-wrap",
            }}
          >
            {msg}
          </div>
        ) : null}
      </div>

      {/* TABLE */}
      <div
        style={{
          marginTop: 14,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 12, fontWeight: 900, borderBottom: "1px solid #e5e7eb" }}>
          Event List ({rows.length})
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                <Th>ID</Th>
                <Th>Date</Th>
                <Th>Title</Th>
                <Th>City</Th>
                <Th>Status</Th>
                <Th>Budget</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 14, color: "#6b7280" }}>
                    No events yet. Add your first event above.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <Td>{r.id}</Td>
                    <Td>{r.event_date}</Td>
                    <Td style={{ fontWeight: 800 }}>{r.title}</Td>
                    <Td>{r.city ?? "-"}</Td>
                    <Td>{r.status}</Td>
                    <Td>{r.budget ? `₹${Number(r.budget).toLocaleString("en-IN")}` : "-"}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => startEdit(r)} style={smallBtn}>
                          Edit
                        </button>
                        <button onClick={() => deleteEvent(r.id)} style={smallBtnDanger}>
                          Delete
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: 12, fontSize: 12, color: "#6b7280" }}>{children}</th>;
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: 12, ...style }}>{children}</td>;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e7eb",
};

const smallBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
  fontWeight: 800,
};

const smallBtnDanger: React.CSSProperties = {
  ...smallBtn,
  border: "1px solid #fecaca",
};
