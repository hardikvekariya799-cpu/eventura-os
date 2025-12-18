"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

// ✅ CEO email (Finance access only)
const CEO_EMAIL = "hardikvekariya799@gmail.com";

type EventRow = { id: number; title: string; event_date: string };
type TxRow = {
  id: number;
  tx_date: string; // YYYY-MM-DD
  tx_type: "Income" | "Expense";
  category: string | null;
  description: string | null;
  amount: number;
  event_id: number | null;
  created_at: string;
};

const CATEGORIES = [
  "Client Payment",
  "Advance",
  "Venue",
  "Catering",
  "Decor",
  "Photography",
  "Entertainment",
  "Transport",
  "Staff",
  "Marketing",
  "Office",
  "Misc",
];

export default function FinancePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  const [events, setEvents] = useState<EventRow[]>([]);
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // form
  const [editingId, setEditingId] = useState<number | null>(null);
  const [txDate, setTxDate] = useState("");
  const [txType, setTxType] = useState<"Income" | "Expense">("Income");
  const [category, setCategory] = useState("Client Payment");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [eventId, setEventId] = useState<string>("");

  const isEditing = useMemo(() => editingId !== null, [editingId]);

  useEffect(() => {
    (async () => {
      try {
        const supabase = supabaseClient();

        // If Supabase redirects here with ?code=... (rare), exchange it
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(window.location.href);
          window.history.replaceState({}, document.title, "/finance");
        }

        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          router.replace("/login");
          return;
        }

        const email = (data.user.email || "").toLowerCase();
        setUserEmail(email);
        setUserId(data.user.id);

        // ✅ CEO-only guard
        if (email !== CEO_EMAIL.toLowerCase()) {
          router.replace("/dashboard?err=finance_denied");
          return;
        }

        setChecking(false);
        await loadEvents();
        await refresh();
      } catch {
        router.replace("/login");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadEvents() {
    try {
      const supabase = supabaseClient();
      const { data, error } = await supabase
        .from("events")
        .select("id,title,event_date")
        .order("event_date", { ascending: false });
      if (error) throw error;
      setEvents((data as EventRow[]) ?? []);
    } catch {
      setEvents([]);
    }
  }

  async function refresh() {
    setLoading(true);
    setMsg("");
    try {
      const supabase = supabaseClient();
      const { data, error } = await supabase
        .from("finance_transactions")
        .select("*")
        .order("tx_date", { ascending: false })
        .order("id", { ascending: false });

      if (error) throw error;
      setRows((data as TxRow[]) ?? []);
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Failed to load finance transactions"}`);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setTxDate("");
    setTxType("Income");
    setCategory("Client Payment");
    setDescription("");
    setAmount("");
    setEventId("");
  }

  function startEdit(r: TxRow) {
    setEditingId(r.id);
    setTxDate(r.tx_date ?? "");
    setTxType(r.tx_type);
    setCategory(r.category ?? "Misc");
    setDescription(r.description ?? "");
    setAmount(String(r.amount ?? ""));
    setEventId(r.event_id ? String(r.event_id) : "");
  }

  async function saveTx() {
    setLoading(true);
    setMsg("");
    try {
      if (!txDate.trim()) throw new Error("Date is required");
      if (!amount.trim()) throw new Error("Amount is required");

      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt < 0) throw new Error("Amount must be a valid number (>= 0)");

      const supabase = supabaseClient();
      const payload = {
        tx_date: txDate,
        tx_type: txType,
        category: category.trim() ? category.trim() : null,
        description: description.trim() ? description.trim() : null,
        amount: amt,
        event_id: eventId ? Number(eventId) : null,
      };

      if (isEditing && editingId !== null) {
        const { error } = await supabase.from("finance_transactions").update(payload).eq("id", editingId);
        if (error) throw error;
        setMsg("✅ Transaction updated");
      } else {
        const { error } = await supabase.from("finance_transactions").insert({
          ...payload,
          created_by: userId || null,
        });
        if (error) throw error;
        setMsg("✅ Transaction added");
      }

      resetForm();
      await refresh();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Save failed"}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteTx(id: number) {
    const ok = confirm("Delete this transaction? This cannot be undone.");
    if (!ok) return;

    setLoading(true);
    setMsg("");
    try {
      const supabase = supabaseClient();
      const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
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
    const headers = ["id", "tx_date", "tx_type", "category", "amount", "event_id", "description", "created_at"];

    const escape = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      const needsWrap = /[",\n]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needsWrap ? `"${escaped}"` : escaped;
    };

    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        [r.id, r.tx_date, r.tx_type, r.category ?? "", r.amount ?? "", r.event_id ?? "", r.description ?? "", r.created_at ?? ""]
          .map(escape)
          .join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const yyyy = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `eventura_finance_${yyyy}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const r of rows) {
      const amt = Number(r.amount || 0);
      if (r.tx_type === "Income") income += amt;
      else expense += amt;
    }
    return { income, expense, profit: income - expense };
  }, [rows]);

  if (checking) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
        <h1 style={{ fontSize: 22 }}>Checking access…</h1>
      </main>
    );
  }

  // extra safety (should never hit)
  if (userEmail.toLowerCase() !== CEO_EMAIL.toLowerCase()) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>Access denied</h1>
        <p style={{ color: "#6b7280", marginTop: 8 }}>Finance is CEO-only.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Finance (CEO Only)</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>Income / Expense tracking + Download CSV.</p>
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

      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <Kpi title="Total Income" value={`₹${totals.income.toLocaleString("en-IN")}`} />
        <Kpi title="Total Expenses" value={`₹${totals.expense.toLocaleString("en-IN")}`} />
        <Kpi title="Net Profit" value={`₹${totals.profit.toLocaleString("en-IN")}`} />
      </div>

      <div style={{ marginTop: 14, background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 14 }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>{isEditing ? `Edit Transaction #${editingId}` : "Add Transaction"}</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <Field label="Date">
            <input value={txDate} onChange={(e) => setTxDate(e.target.value)} type="date" style={inputStyle} />
          </Field>

          <Field label="Type">
            <select value={txType} onChange={(e) => setTxType(e.target.value as any)} style={inputStyle}>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </Field>

          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Amount (₹)">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g., 25000" style={inputStyle} />
          </Field>

          <Field label="Linked Event (optional)">
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={inputStyle}>
              <option value="">-- None --</option>
              {events.map((ev) => (
                <option key={ev.id} value={String(ev.id)}>
                  #{ev.id} • {ev.title} • {ev.event_date}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description (optional)">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Advance received / Decor payment"
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={saveTx} disabled={loading} style={{ padding: "12px 14px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 900 }}>
            {loading ? "Saving..." : isEditing ? "Update" : "Add"}
          </button>

          <button
            onClick={resetForm}
            disabled={loading}
            style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontWeight: 900 }}
          >
            Clear
          </button>
        </div>

        {msg ? (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#f9fafb", border: "1px solid #e5e7eb", whiteSpace: "pre-wrap" }}>
            {msg}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 14, background: "white", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: 12, fontWeight: 900, borderBottom: "1px solid #e5e7eb" }}>Transactions ({rows.length})</div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                <Th>ID</Th>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Category</Th>
                <Th>Amount</Th>
                <Th>Event</Th>
                <Th>Description</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 14, color: "#6b7280" }}>
                    No transactions yet. Add your first one above.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <Td>{r.id}</Td>
                    <Td>{r.tx_date}</Td>
                    <Td style={{ fontWeight: 900 }}>{r.tx_type}</Td>
                    <Td>{r.category ?? "-"}</Td>
                    <Td>₹{Number(r.amount).toLocaleString("en-IN")}</Td>
                    <Td>{r.event_id ? `#${r.event_id}` : "-"}</Td>
                    <Td>{r.description ?? "-"}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => startEdit(r)} style={smallBtn}>
                          Edit
                        </button>
                        <button onClick={() => deleteTx(r.id)} style={smallBtnDanger}>
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

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 13, color: "#6b7280" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{value}</div>
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
