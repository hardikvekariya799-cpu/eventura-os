"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ================= TYPES ================= */
type TxType = "Income" | "Expense";
type PaymentMethod = "Cash" | "UPI" | "Card" | "Bank" | "Cheque" | "Other";

type TxCategory =
  | "Client Payment"
  | "Advance"
  | "Package"
  | "Vendor Payment"
  | "Decor"
  | "Venue"
  | "Food/Catering"
  | "Logistics"
  | "Marketing"
  | "Salary"
  | "Rent"
  | "Utilities"
  | "Tools/Software"
  | "Misc";

type FinanceTx = {
  id: string;
  date: string; // YYYY-MM-DD
  type: TxType;
  amount: number;
  category: TxCategory;
  method: PaymentMethod;
  party: string; // client/vendor name
  reference?: string; // invoice/UTR
  notes?: string;
  eventTag?: string; // optional event name/id
  createdAt: string;
  updatedAt: string;
};

type BudgetPlan = {
  month: string; // YYYY-MM
  targetRevenue?: number;
  targetExpense?: number;
  reserveTarget?: number;
};

const LS_TX = "eventura_os_finance_tx_v1";
const LS_BUDGET = "eventura_os_finance_budget_v1";

/* ================= HELPERS ================= */
function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function monthKey(dateISO: string) {
  return dateISO.slice(0, 7);
}
function inr(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
}
function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key: string, value: any) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}
function downloadJSON(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================= AI (LOCAL “SMART” INSIGHTS) =================
   No API needed. Rules + heuristics based on your data.
   Later we can replace with real AI when you want.
*/
function buildAIInsights(txs: FinanceTx[], budget?: BudgetPlan | null) {
  const insights: { title: string; text: string; level: "ok" | "warn" | "bad" }[] = [];

  if (!txs.length) {
    insights.push({
      title: "Start tracking to unlock insights",
      text: "Add income and expenses. This Finance AI will automatically detect profit, overspending, and cashflow issues.",
      level: "ok",
    });
    return insights;
  }

  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthTx = txs.filter((t) => monthKey(t.date) === curMonth);
  const monthIncome = monthTx.filter((t) => t.type === "Income").reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTx.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
  const monthNet = monthIncome - monthExpense;

  // Top expense categories this month
  const expByCat = new Map<string, number>();
  monthTx
    .filter((t) => t.type === "Expense")
    .forEach((t) => expByCat.set(t.category, (expByCat.get(t.category) || 0) + t.amount));
  const topExp = [...expByCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Cashflow risk: consecutive expense streak > income streak in last 7 records
  const last7 = [...txs].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 7);
  const expenseCount = last7.filter((t) => t.type === "Expense").length;

  // Receivables hint: lots of "Advance" but few "Client Payment"
  const adv = monthTx.filter((t) => t.type === "Income" && t.category === "Advance").reduce((s, t) => s + t.amount, 0);
  const clientPay = monthTx
    .filter((t) => t.type === "Income" && t.category === "Client Payment")
    .reduce((s, t) => s + t.amount, 0);

  // Insights
  if (monthNet >= 0) {
    insights.push({
      title: "Profit is positive this month",
      text: `Net profit is ₹${inr(monthNet)} for ${curMonth}. Keep controlling vendor + decor costs to protect margin.`,
      level: "ok",
    });
  } else {
    insights.push({
      title: "You are negative this month",
      text: `Net is -₹${inr(Math.abs(monthNet))} for ${curMonth}. Reduce non-essential expenses and push pending client payments.`,
      level: "bad",
    });
  }

  if (topExp.length) {
    insights.push({
      title: "Top expense drivers (this month)",
      text: `Highest spends: ${topExp.map(([c, v]) => `${c} ₹${inr(v)}`).join(" • ")}.`,
      level: topExp[0][1] > Math.max(monthIncome * 0.4, 100000) ? "warn" : "ok",
    });
  }

  if (expenseCount >= 5) {
    insights.push({
      title: "Cashflow warning",
      text: "Last 7 entries have many expenses. Try collecting advances before releasing vendor payments.",
      level: "warn",
    });
  }

  if (adv > 0 && clientPay === 0) {
    insights.push({
      title: "Collections suggestion",
      text: "You received advances but no final client payments this month. Set reminders to convert advances into full payment on event completion.",
      level: "warn",
    });
  }

  if (budget?.targetRevenue) {
    if (monthIncome < budget.targetRevenue) {
      const gap = budget.targetRevenue - monthIncome;
      insights.push({
        title: "Revenue target gap",
        text: `You are ₹${inr(gap)} below your revenue target for ${curMonth}. Focus on lead follow-ups and closing packages.`,
        level: "warn",
      });
    } else {
      insights.push({
        title: "Revenue target achieved",
        text: `Nice — revenue target met for ${curMonth}. Consider increasing reserve or reinvesting in marketing.`,
        level: "ok",
      });
    }
  }

  return insights.slice(0, 8);
}

/* ================= PAGE ================= */
export default function FinancePage() {
  const [txs, setTxs] = useState<FinanceTx[]>([]);
  const [budgetPlans, setBudgetPlans] = useState<BudgetPlan[]>([]);

  // UI state
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | TxType>("All");
  const [monthFilter, setMonthFilter] = useState<"All" | string>("All");
  const [msg, setMsg] = useState<string>("");

  // form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState<TxType>("Income");
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<TxCategory>("Client Payment");
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [party, setParty] = useState<string>("");
  const [eventTag, setEventTag] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // budget form
  const [budgetMonth, setBudgetMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [targetRevenue, setTargetRevenue] = useState<string>("");
  const [targetExpense, setTargetExpense] = useState<string>("");
  const [reserveTarget, setReserveTarget] = useState<string>("");

  useEffect(() => {
    setTxs(loadJSON<FinanceTx[]>(LS_TX, []));
    setBudgetPlans(loadJSON<BudgetPlan[]>(LS_BUDGET, []));
  }, []);

  useEffect(() => {
    saveJSON(LS_TX, txs);
  }, [txs]);

  useEffect(() => {
    saveJSON(LS_BUDGET, budgetPlans);
  }, [budgetPlans]);

  const months = useMemo(() => {
    const set = new Set<string>();
    txs.forEach((t) => set.add(monthKey(t.date)));
    return ["All", ...[...set].sort((a, b) => (a < b ? 1 : -1))];
  }, [txs]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return txs
      .filter((t) => (typeFilter === "All" ? true : t.type === typeFilter))
      .filter((t) => (monthFilter === "All" ? true : monthKey(t.date) === monthFilter))
      .filter((t) => {
        if (!s) return true;
        return (
          t.party.toLowerCase().includes(s) ||
          t.category.toLowerCase().includes(s) ||
          t.method.toLowerCase().includes(s) ||
          (t.reference || "").toLowerCase().includes(s) ||
          (t.notes || "").toLowerCase().includes(s) ||
          (t.eventTag || "").toLowerCase().includes(s)
        );
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [txs, q, typeFilter, monthFilter]);

  const totals = useMemo(() => {
    const income = filtered.filter((t) => t.type === "Income").reduce((s, t) => s + t.amount, 0);
    const expense = filtered.filter((t) => t.type === "Expense").reduce((s, t) => s + t.amount, 0);
    const net = income - expense;
    return { income, expense, net };
  }, [filtered]);

  const monthSummary = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    txs.forEach((t) => {
      const m = monthKey(t.date);
      if (!map.has(m)) map.set(m, { income: 0, expense: 0 });
      const v = map.get(m)!;
      if (t.type === "Income") v.income += t.amount;
      else v.expense += t.amount;
    });
    return [...map.entries()]
      .map(([m, v]) => ({ month: m, income: v.income, expense: v.expense, net: v.income - v.expense }))
      .sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [txs]);

  const activeBudget = useMemo(() => {
    const b = budgetPlans.find((x) => x.month === (monthFilter === "All" ? new Date().toISOString().slice(0, 7) : monthFilter));
    return b || null;
  }, [budgetPlans, monthFilter]);

  const aiInsights = useMemo(() => buildAIInsights(txs, activeBudget), [txs, activeBudget]);

  function resetForm() {
    setEditingId(null);
    setDate(todayISO());
    setType("Income");
    setAmount("");
    setCategory("Client Payment");
    setMethod("UPI");
    setParty("");
    setEventTag("");
    setReference("");
    setNotes("");
    setMsg("");
  }

  function startEdit(t: FinanceTx) {
    setEditingId(t.id);
    setDate(t.date);
    setType(t.type);
    setAmount(String(t.amount));
    setCategory(t.category);
    setMethod(t.method);
    setParty(t.party);
    setEventTag(t.eventTag || "");
    setReference(t.reference || "");
    setNotes(t.notes || "");
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function remove(id: string) {
    setTxs((prev) => prev.filter((t) => t.id !== id));
    setMsg("✅ Transaction deleted");
    if (editingId === id) resetForm();
  }

  function upsert() {
    setMsg("");
    const a = Number(amount);
    if (!date) return setMsg("❌ Date required");
    if (!party.trim()) return setMsg("❌ Party (Client/Vendor name) required");
    if (!amount.trim() || Number.isNaN(a) || a <= 0) return setMsg("❌ Amount must be a positive number");

    const now = new Date().toISOString();
    if (!editingId) {
      const tx: FinanceTx = {
        id: uid(),
        date,
        type,
        amount: a,
        category,
        method,
        party: party.trim(),
        eventTag: eventTag.trim() || undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      setTxs((prev) => [tx, ...prev]);
      setMsg("✅ Transaction added");
      resetForm();
      return;
    }

    setTxs((prev) =>
      prev.map((t) =>
        t.id === editingId
          ? {
              ...t,
              date,
              type,
              amount: a,
              category,
              method,
              party: party.trim(),
              eventTag: eventTag.trim() || undefined,
              reference: reference.trim() || undefined,
              notes: notes.trim() || undefined,
              updatedAt: now,
            }
          : t
      )
    );
    setMsg("✅ Transaction updated");
    resetForm();
  }

  function saveBudget() {
    setMsg("");
    if (!budgetMonth) return setMsg("❌ Month required");
    const tr = targetRevenue.trim() ? Number(targetRevenue) : undefined;
    const te = targetExpense.trim() ? Number(targetExpense) : undefined;
    const rr = reserveTarget.trim() ? Number(reserveTarget) : undefined;

    if (targetRevenue.trim() && (Number.isNaN(tr) || (tr || 0) < 0)) return setMsg("❌ Target revenue invalid");
    if (targetExpense.trim() && (Number.isNaN(te) || (te || 0) < 0)) return setMsg("❌ Target expense invalid");
    if (reserveTarget.trim() && (Number.isNaN(rr) || (rr || 0) < 0)) return setMsg("❌ Reserve target invalid");

    setBudgetPlans((prev) => {
      const exists = prev.find((b) => b.month === budgetMonth);
      if (!exists) return [{ month: budgetMonth, targetRevenue: tr, targetExpense: te, reserveTarget: rr }, ...prev];
      return prev.map((b) => (b.month === budgetMonth ? { ...b, targetRevenue: tr, targetExpense: te, reserveTarget: rr } : b));
    });

    setMsg("✅ Budget saved");
  }

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div style={S.topRow}>
          <div>
            <div style={S.h1}>Finance</div>
            <div style={S.muted}>Income • Expense • Cashflow • Budget targets • AI insights (local)</div>
          </div>
          <div style={S.row}>
            <button
              style={S.ghostBtn}
              onClick={() => downloadJSON(`eventura_finance_${new Date().toISOString().slice(0, 10)}.json`, { txs, budgetPlans })}
              title="Download data as JSON"
            >
              Export
            </button>
            <button style={S.ghostBtn} onClick={resetForm}>
              Clear Form
            </button>
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* KPI */}
        <div style={S.kpiRow}>
          <KPI label="Revenue" value={`₹${inr(totals.income)}`} />
          <KPI label="Expense" value={`₹${inr(totals.expense)}`} />
          <KPI label="Net Profit" value={`${totals.net >= 0 ? "" : "-"}₹${inr(Math.abs(totals.net))}`} highlight={totals.net < 0 ? "bad" : "ok"} />
        </div>

        {/* AI INSIGHTS */}
        <div style={S.panel}>
          <div style={S.panelTitle}>AI Insights</div>
          <div style={S.aiGrid}>
            {aiInsights.map((i, idx) => (
              <div key={idx} style={{ ...S.aiCard, ...(i.level === "bad" ? S.aiBad : i.level === "warn" ? S.aiWarn : S.aiOk) }}>
                <div style={{ fontWeight: 950 }}>{i.title}</div>
                <div style={S.aiText}>{i.text}</div>
              </div>
            ))}
          </div>
          <div style={S.smallNote}>
            This is “local AI” (fast, no API). When you want real AI, we can connect OpenAI later for forecasting + invoice summaries.
          </div>
        </div>

        {/* ADD / EDIT */}
        <div style={S.panel}>
          <div style={S.panelTitle}>{editingId ? "Edit Transaction" : "Add Transaction"}</div>

          <div style={S.grid2}>
            <Field label="Date">
              <input style={S.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>

            <Field label="Type">
              <select style={S.select} value={type} onChange={(e) => setType(e.target.value as TxType)}>
                <option style={S.option}>Income</option>
                <option style={S.option}>Expense</option>
              </select>
            </Field>

            <Field label="Amount (₹)">
              <input style={S.input} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 250000" />
            </Field>

            <Field label="Category">
              <select style={S.select} value={category} onChange={(e) => setCategory(e.target.value as TxCategory)}>
                {[
                  "Client Payment",
                  "Advance",
                  "Package",
                  "Vendor Payment",
                  "Decor",
                  "Venue",
                  "Food/Catering",
                  "Logistics",
                  "Marketing",
                  "Salary",
                  "Rent",
                  "Utilities",
                  "Tools/Software",
                  "Misc",
                ].map((c) => (
                  <option key={c} style={S.option}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Payment Method">
              <select style={S.select} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {["Cash", "UPI", "Card", "Bank", "Cheque", "Other"].map((m) => (
                  <option key={m} style={S.option}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Party (Client/Vendor)">
              <input style={S.input} value={party} onChange={(e) => setParty(e.target.value)} placeholder="Client name / Vendor name" />
            </Field>

            <Field label="Event Tag (optional)">
              <input style={S.input} value={eventTag} onChange={(e) => setEventTag(e.target.value)} placeholder="e.g. Patel Wedding 2026" />
            </Field>

            <Field label="Reference (optional)">
              <input style={S.input} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Invoice/UTR/Receipt no." />
            </Field>

            <Field label="Notes (optional)" full>
              <textarea style={S.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Extra details…" />
            </Field>
          </div>

          <div style={S.rowBetween}>
            <div style={S.smallMuted}>Saved locally so it never breaks deploy. Later we’ll sync to Supabase.</div>
            <div style={S.row}>
              {editingId ? (
                <button style={S.dangerBtn} onClick={() => remove(editingId)}>
                  Delete
                </button>
              ) : null}
              <button style={S.primaryBtn} onClick={upsert}>
                {editingId ? "Save Changes" : "Add Transaction"}
              </button>
            </div>
          </div>
        </div>

        {/* BUDGET */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Monthly Budget Targets</div>
          <div style={S.budgetGrid}>
            <Field label="Month (YYYY-MM)">
              <input style={S.input} value={budgetMonth} onChange={(e) => setBudgetMonth(e.target.value)} placeholder="2026-04" />
            </Field>
            <Field label="Target Revenue (₹)">
              <input style={S.input} value={targetRevenue} onChange={(e) => setTargetRevenue(e.target.value)} placeholder="e.g. 800000" />
            </Field>
            <Field label="Target Expense (₹)">
              <input style={S.input} value={targetExpense} onChange={(e) => setTargetExpense(e.target.value)} placeholder="e.g. 450000" />
            </Field>
            <Field label="Reserve Target (₹)">
              <input style={S.input} value={reserveTarget} onChange={(e) => setReserveTarget(e.target.value)} placeholder="e.g. 150000" />
            </Field>
          </div>

          <div style={S.rowBetween}>
            <div style={S.smallMuted}>Budget helps Finance AI warn you early.</div>
            <button style={S.primaryBtn} onClick={saveBudget}>
              Save Budget
            </button>
          </div>

          {activeBudget ? (
            <div style={S.smallNote}>
              Active budget: <b>{activeBudget.month}</b> • Revenue target:{" "}
              <b>{activeBudget.targetRevenue ? `₹${inr(activeBudget.targetRevenue)}` : "—"}</b> • Expense target:{" "}
              <b>{activeBudget.targetExpense ? `₹${inr(activeBudget.targetExpense)}` : "—"}</b>
            </div>
          ) : (
            <div style={S.smallNote}>No active budget for this month filter.</div>
          )}
        </div>

        {/* FILTERS + LIST */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Transactions</div>

          <div style={S.filters}>
            <input style={S.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: party / category / method / reference / notes / event" />
            <select style={S.select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
              <option style={S.option} value="All">
                All Types
              </option>
              <option style={S.option}>Income</option>
              <option style={S.option}>Expense</option>
            </select>
            <select style={S.select} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value as any)}>
              {months.map((m) => (
                <option key={m} style={S.option} value={m}>
                  {m === "All" ? "All Months" : m}
                </option>
              ))}
            </select>
          </div>

          {!filtered.length ? (
            <div style={S.empty}>No transactions found.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((t) => (
                <div key={t.id} style={S.card}>
                  <div style={S.rowBetween}>
                    <div>
                      <div style={S.cardTitle}>
                        {t.type === "Income" ? "⬆️" : "⬇️"} {t.party} • ₹{inr(t.amount)}
                      </div>
                      <div style={S.cardSub}>
                        {t.date} • {t.category} • {t.method}
                        {t.eventTag ? ` • ${t.eventTag}` : ""}
                        {t.reference ? ` • Ref: ${t.reference}` : ""}
                      </div>
                      {t.notes ? <div style={S.note}>{t.notes}</div> : null}
                    </div>
                    <div style={S.row}>
                      <button style={S.ghostBtn} onClick={() => startEdit(t)}>
                        Edit
                      </button>
                      <button style={S.dangerBtn} onClick={() => remove(t.id)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div style={S.smallMuted}>Updated: {new Date(t.updatedAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MONTH SUMMARY */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Monthly Summary</div>
          {!monthSummary.length ? (
            <div style={S.empty}>No monthly summary yet.</div>
          ) : (
            <div style={S.summaryGrid}>
              {monthSummary.slice(0, 12).map((m) => (
                <div key={m.month} style={S.summaryCard}>
                  <div style={{ fontWeight: 950 }}>{m.month}</div>
                  <div style={S.smallMuted}>Revenue: ₹{inr(m.income)}</div>
                  <div style={S.smallMuted}>Expense: ₹{inr(m.expense)}</div>
                  <div style={{ marginTop: 6, fontWeight: 950, color: m.net >= 0 ? "#FDE68A" : "#FCA5A5" }}>
                    Net: {m.net >= 0 ? "" : "-"}₹{inr(Math.abs(m.net))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={S.footerNote}>✅ Hover fixed on dropdown/options. ✅ Data saves instantly (localStorage).</div>
      </div>
    </div>
  );
}

/* ================= UI HELPERS ================= */
function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ ...S.field, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={S.label}>{label}</div>
      {children}
    </div>
  );
}
function KPI({ label, value, highlight }: { label: string; value: string; highlight?: "ok" | "bad" }) {
  return (
    <div style={{ ...S.kpi, ...(highlight === "bad" ? S.kpiBad : null) }}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
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
  topRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  h1: { fontSize: 26, fontWeight: 950 },
  muted: { color: "#9CA3AF", fontSize: 13, marginTop: 6 },
  smallMuted: { color: "#9CA3AF", fontSize: 12 },
  smallNote: { marginTop: 8, color: "#A7B0C0", fontSize: 12 },

  panel: {
    background: "rgba(11,16,32,0.78)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
    backdropFilter: "blur(10px)",
  },
  panelTitle: { fontWeight: 950, color: "#FDE68A", marginBottom: 10 },

  msg: {
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#E5E7EB",
    fontSize: 13,
  },

  kpiRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
  kpi: {
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  kpiBad: {
    background: "rgba(248,113,113,0.10)",
    border: "1px solid rgba(248,113,113,0.28)",
  },
  kpiLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: 900 },
  kpiValue: { marginTop: 6, fontSize: 22, fontWeight: 950 },

  aiGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 },
  aiCard: { padding: 12, borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" },
  aiOk: { border: "1px solid rgba(212,175,55,0.22)", background: "rgba(212,175,55,0.06)" },
  aiWarn: { border: "1px solid rgba(96,165,250,0.22)", background: "rgba(96,165,250,0.06)" },
  aiBad: { border: "1px solid rgba(248,113,113,0.28)", background: "rgba(248,113,113,0.08)" },
  aiText: { marginTop: 6, color: "#C7CFDD", fontSize: 13, lineHeight: 1.35 },

  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  budgetGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 },
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

  /* ✅ HOVER FIX: dark select + dark options (no white unreadable dropdown) */
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
  option: { backgroundColor: "#0B1020", color: "#F9FAFB" },

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

  filters: { display: "grid", gridTemplateColumns: "1fr 220px 220px", gap: 10, marginBottom: 10 },
  empty: { color: "#A7B0C0", fontSize: 13, padding: 10 },

  card: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  cardTitle: { fontWeight: 950, fontSize: 15 },
  cardSub: { marginTop: 4, color: "#A7B0C0", fontSize: 12 },
  note: { marginTop: 8, color: "#C7CFDD", fontSize: 13, lineHeight: 1.35 },

  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 },
  summaryCard: { padding: 12, borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" },

  footerNote: { color: "#A7B0C0", fontSize: 12, textAlign: "center", padding: 6 },
};

/* ================= END ================= */
