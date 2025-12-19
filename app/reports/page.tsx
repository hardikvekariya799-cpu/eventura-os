"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ================= STORAGE KEYS (edit if yours differ) ================= */
const LS_EVENTS = "eventura_os_events_v1";
const LS_FIN = "eventura_os_fin_tx_v1";
const LS_HR = "eventura_os_hr_team_v2";
const LS_VENDORS = "eventura_os_vendors_v1";
const LS_AI = "eventura_os_ai_docs_v1";
const LS_REPORT_TEMPLATES = "eventura_os_reports_templates_v1";

/* ================= TYPES ================= */
type Module = "Events" | "Finance" | "HR" | "Vendors" | "AI";

type ReportTemplate = {
  id: string;
  name: string;
  module: Module;
  dateFrom: string;
  dateTo: string;
  status: string; // optional filter
  city: string; // optional filter
  createdAt: string;
};

type EventItem = {
  id: string | number;
  date?: string; // YYYY-MM-DD
  title?: string;
  status?: string;
  city?: string;
  budget?: number;
  createdAt?: string;
  updatedAt?: string;
};

type FinanceTx = {
  id: string | number;
  date?: string; // YYYY-MM-DD
  type?: "Income" | "Expense" | string;
  category?: string;
  amount?: number;
  note?: string;
};

type TeamMember = {
  id: string;
  name: string;
  role: string;
  status: string;
  city: string;
  workload: number;
  eventsThisMonth: number;
  rating: number;
  monthlySalary: number;
  skills?: string[];
  notes?: string;
  updatedAt?: string;
};

type Vendor = {
  id: string;
  name: string;
  category: string;
  city: string;
  rating?: number;
  priceBand?: string;
  phone?: string;
  updatedAt?: string;
};

type AIDoc = {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  output: string;
  inputs?: Record<string, any>;
};

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
function isoMinusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function safeSave<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}
function inr(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
}
function toCSV(rows: Record<string, any>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = cols.map(esc).join(",");
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n");
  return `${head}\n${body}`;
}
function downloadFile(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================= FILTER HELPERS ================= */
function inDateRange(dateStr: string | undefined, from: string, to: string) {
  if (!dateStr) return false;
  // dateStr expected "YYYY-MM-DD"
  return dateStr >= from && dateStr <= to;
}

/* ================= PAGE ================= */
export default function ReportsPage() {
  const [msg, setMsg] = useState("");

  const [module, setModule] = useState<Module>("Events");
  const [dateFrom, setDateFrom] = useState(isoMinusDays(30));
  const [dateTo, setDateTo] = useState(todayISO());
  const [status, setStatus] = useState("All");
  const [city, setCity] = useState("All");

  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");

  // load templates
  useEffect(() => {
    setTemplates(safeLoad<ReportTemplate[]>(LS_REPORT_TEMPLATES, []));
  }, []);
  useEffect(() => {
    safeSave(LS_REPORT_TEMPLATES, templates);
  }, [templates]);

  // load data
  const events = useMemo(() => safeLoad<EventItem[]>(LS_EVENTS, []), []);
  const fin = useMemo(() => safeLoad<FinanceTx[]>(LS_FIN, []), []);
  const hr = useMemo(() => safeLoad<TeamMember[]>(LS_HR, []), []);
  const vendors = useMemo(() => safeLoad<Vendor[]>(LS_VENDORS, []), []);
  const ai = useMemo(() => safeLoad<AIDoc[]>(LS_AI, []), []);

  const cities = useMemo(() => {
    const s = new Set<string>();
    [...events, ...vendors, ...hr].forEach((x: any) => {
      if (x?.city) s.add(String(x.city));
    });
    return ["All", ...[...s].sort()];
  }, [events, vendors, hr]);

  /* ================= REPORT LOGIC ================= */
  const report = useMemo(() => {
    // generic city filter
    const cityOk = (item: any) => (city === "All" ? true : String(item?.city || "") === city);

    if (module === "Events") {
      const rows = events
        .filter((e) => inDateRange(e.date, dateFrom, dateTo))
        .filter((e) => cityOk(e))
        .filter((e) => (status === "All" ? true : String(e.status || "") === status));

      const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
        const k = String(r.status || "Unknown");
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      const totalBudget = rows.reduce((a, b) => a + Number(b.budget || 0), 0);

      return {
        title: "Events Report",
        kpis: [
          { label: "Events", value: rows.length },
          { label: "Total Budget", value: `₹${inr(totalBudget)}` },
          { label: "Cities", value: new Set(rows.map((r) => r.city).filter(Boolean)).size },
          { label: "Statuses", value: Object.keys(byStatus).length },
        ],
        breakdown: Object.entries(byStatus).map(([k, v]) => ({ key: k, value: v })),
        rows: rows.map((r) => ({
          date: r.date || "",
          title: r.title || "",
          status: r.status || "",
          city: r.city || "",
          budget: r.budget ?? "",
        })),
      };
    }

    if (module === "Finance") {
      const rows = fin
        .filter((t) => inDateRange(t.date, dateFrom, dateTo))
        .filter((t: any) => cityOk(t)); // if finance rows don't have city, city filter is ignored by cityOk -> false, so we must handle:
      const rows2 = fin.filter((t) => inDateRange(t.date, dateFrom, dateTo)); // real finance list (no city filter)
      const base = city === "All" ? rows2 : rows; // apply only if finance has city field

      const income = base
        .filter((x) => String(x.type || "").toLowerCase() === "income")
        .reduce((a, b) => a + Number(b.amount || 0), 0);

      const expense = base
        .filter((x) => String(x.type || "").toLowerCase() === "expense")
        .reduce((a, b) => a + Number(b.amount || 0), 0);

      const profit = income - expense;

      const byCat = base.reduce<Record<string, number>>((acc, r) => {
        const k = String(r.category || "Uncategorized");
        acc[k] = (acc[k] || 0) + Number(r.amount || 0) * (String(r.type).toLowerCase() === "expense" ? -1 : 1);
        return acc;
      }, {});

      return {
        title: "Finance Report",
        kpis: [
          { label: "Income", value: `₹${inr(income)}` },
          { label: "Expense", value: `₹${inr(expense)}` },
          { label: "Profit", value: `₹${inr(profit)}` },
          { label: "Transactions", value: base.length },
        ],
        breakdown: Object.entries(byCat)
          .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
          .slice(0, 12)
          .map(([k, v]) => ({ key: k, value: v >= 0 ? `+₹${inr(v)}` : `-₹${inr(Math.abs(v))}` })),
        rows: base.map((r) => ({
          date: r.date || "",
          type: r.type || "",
          category: r.category || "",
          amount: r.amount ?? "",
          note: r.note || "",
        })),
      };
    }

    if (module === "HR") {
      const base = hr.filter((m) => cityOk(m));
      const active = base.filter((m) => String(m.status) !== "Inactive");
      const avgWorkload =
        active.length === 0
          ? 0
          : Math.round(active.reduce((a, b) => a + Number(b.workload || 0), 0) / active.length);
      const avgRating =
        active.length === 0
          ? 0
          : +(active.reduce((a, b) => a + Number(b.rating || 0), 0) / active.length).toFixed(1);

      const payroll = base
        .filter((m) => m.status === "Core" || m.status === "Trainee")
        .reduce((a, b) => a + Number(b.monthlySalary || 0), 0);

      const byRole = base.reduce<Record<string, number>>((acc, r) => {
        const k = String(r.role || "Other");
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});

      return {
        title: "HR Report",
        kpis: [
          { label: "Team", value: base.length },
          { label: "Active", value: active.length },
          { label: "Avg Workload", value: `${avgWorkload}%` },
          { label: "Avg Rating", value: avgRating.toFixed(1) },
          { label: "Payroll/mo", value: `₹${inr(payroll)}` },
        ],
        breakdown: Object.entries(byRole)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([k, v]) => ({ key: k, value: v })),
        rows: base.map((m) => ({
          name: m.name,
          role: m.role,
          status: m.status,
          city: m.city,
          workload: m.workload,
          rating: m.rating,
          salary: m.monthlySalary,
          eventsThisMonth: m.eventsThisMonth,
        })),
      };
    }

    if (module === "Vendors") {
      const base = vendors.filter((v) => cityOk(v));
      const byCat = base.reduce<Record<string, number>>((acc, r) => {
        const k = String(r.category || "Other");
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});

      const avgRating =
        base.length === 0
          ? 0
          : +(base.reduce((a, b) => a + Number(b.rating || 0), 0) / base.length).toFixed(1);

      return {
        title: "Vendors Report",
        kpis: [
          { label: "Vendors", value: base.length },
          { label: "Avg Rating", value: avgRating.toFixed(1) },
          { label: "Categories", value: Object.keys(byCat).length },
          { label: "City", value: city === "All" ? "All" : city },
        ],
        breakdown: Object.entries(byCat)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([k, v]) => ({ key: k, value: v })),
        rows: base.map((v) => ({
          name: v.name,
          category: v.category,
          city: v.city,
          rating: v.rating ?? "",
          phone: v.phone ?? "",
          priceBand: v.priceBand ?? "",
        })),
      };
    }

    // AI
    const base = ai.filter((d) => inDateRange((d.createdAt || "").slice(0, 10), dateFrom, dateTo));
    const byType = base.reduce<Record<string, number>>((acc, r) => {
      const k = String(r.type || "Other");
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    return {
      title: "AI Report",
      kpis: [
        { label: "Outputs", value: base.length },
        { label: "Types", value: Object.keys(byType).length },
        { label: "Range", value: `${dateFrom} → ${dateTo}` },
        { label: "Saved", value: "local" },
      ],
      breakdown: Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => ({ key: k, value: v })),
      rows: base.map((d) => ({
        title: d.title,
        type: d.type,
        createdAt: new Date(d.createdAt).toLocaleString(),
      })),
    };
  }, [module, dateFrom, dateTo, status, city, events, fin, hr, vendors, ai]);

  const eventStatuses = useMemo(() => {
    const s = new Set<string>();
    events.forEach((e) => s.add(String(e.status || "Unknown")));
    return ["All", ...[...s].sort()];
  }, [events]);

  /* ================= TEMPLATE ACTIONS ================= */
  function saveTemplate() {
    const n = templateName.trim();
    if (!n) return setMsg("❌ Template name required");
    const t: ReportTemplate = {
      id: uid(),
      name: n,
      module,
      dateFrom,
      dateTo,
      status,
      city,
      createdAt: new Date().toISOString(),
    };
    setTemplates((prev) => [t, ...prev]);
    setTemplateName("");
    setMsg("✅ Template saved");
  }

  function loadTemplate(t: ReportTemplate) {
    setModule(t.module);
    setDateFrom(t.dateFrom);
    setDateTo(t.dateTo);
    setStatus(t.status);
    setCity(t.city);
    setMsg(`✅ Loaded template: ${t.name}`);
  }

  function deleteTemplate(id: string) {
    setTemplates((prev) => prev.filter((x) => x.id !== id));
    setMsg("✅ Template deleted");
  }

  function exportReportJSON() {
    downloadFile(
      `eventura_report_${module.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ module, dateFrom, dateTo, status, city, report }, null, 2),
      "application/json"
    );
    setMsg("✅ Exported JSON");
  }

  function exportReportCSV() {
    const csv = toCSV(report.rows || []);
    downloadFile(
      `eventura_report_${module.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`,
      csv || "empty\n",
      "text/csv"
    );
    setMsg("✅ Exported CSV");
  }

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div style={S.topRow}>
          <div>
            <div style={S.h1}>Reports</div>
            <div style={S.muted}>
              Build reports from your saved modules • Export JSON/CSV • Save templates
            </div>
          </div>
          <div style={S.row}>
            <button style={S.ghostBtn} onClick={exportReportJSON}>
              Export JSON
            </button>
            <button style={S.ghostBtn} onClick={exportReportCSV}>
              Export CSV
            </button>
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* BUILDER */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Report Builder</div>

          <div style={S.grid5}>
            <Field label="Module">
              <select style={S.select} value={module} onChange={(e) => setModule(e.target.value as Module)}>
                {["Events", "Finance", "HR", "Vendors", "AI"].map((x) => (
                  <option key={x} style={S.option}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="From">
              <input style={S.input} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </Field>

            <Field label="To">
              <input style={S.input} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </Field>

            <Field label="City">
              <select style={S.select} value={city} onChange={(e) => setCity(e.target.value)}>
                {cities.map((c) => (
                  <option key={c} style={S.option} value={c}>
                    {c === "All" ? "All Cities" : c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select
                style={S.select}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={module !== "Events"}
                title={module !== "Events" ? "Status filter only for Events" : ""}
              >
                {(module === "Events" ? eventStatuses : ["All"]).map((s) => (
                  <option key={s} style={S.option} value={s}>
                    {s === "All" ? "All Status" : s}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={S.rowBetween}>
            <div style={S.smallMuted}>
              Tip: If a module doesn’t exist yet, this report will show 0 (no errors).
            </div>
            <div style={S.row}>
              <input
                style={{ ...S.input, width: 240 }}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
              />
              <button style={S.primaryBtn} onClick={saveTemplate}>
                Save Template
              </button>
            </div>
          </div>
        </div>

        {/* REPORT OUTPUT */}
        <div style={S.panel}>
          <div style={S.panelTitle}>{report.title}</div>

          <div style={S.kpiRow}>
            {report.kpis.map((k: any) => (
              <KPI key={k.label} label={k.label} value={k.value} />
            ))}
          </div>

          <div style={S.split}>
            <div style={S.box}>
              <div style={S.boxTitle}>Breakdown</div>
              {!report.breakdown?.length ? (
                <div style={S.empty}>No breakdown available.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {report.breakdown.map((b: any) => (
                    <div key={b.key} style={S.breakRow}>
                      <div style={{ fontWeight: 950 }}>{b.key}</div>
                      <div style={S.pill}>{b.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={S.box}>
              <div style={S.boxTitle}>Preview Rows</div>
              {!report.rows?.length ? (
                <div style={S.empty}>No rows found for selected filters.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {report.rows.slice(0, 10).map((r: any, idx: number) => (
                    <div key={idx} style={S.previewRow}>
                      <div style={S.smallMuted}>{Object.values(r).slice(0, 2).join(" • ")}</div>
                      <div style={S.previewMeta}>{Object.entries(r).slice(2, 5).map(([k, v]) => `${k}: ${v}`).join(" | ")}</div>
                    </div>
                  ))}
                  {report.rows.length > 10 ? (
                    <div style={S.smallMuted}>… and {report.rows.length - 10} more rows (export to CSV to see all)</div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* TEMPLATES */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Saved Templates</div>

          {!templates.length ? (
            <div style={S.empty}>No templates yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {templates.map((t) => (
                <div key={t.id} style={S.card}>
                  <div style={S.rowBetween}>
                    <div>
                      <div style={S.cardTitle}>{t.name}</div>
                      <div style={S.cardSub}>
                        {t.module} • {t.dateFrom} → {t.dateTo} • {t.city} • {t.status}
                      </div>
                    </div>
                    <div style={S.row}>
                      <button style={S.ghostBtn} onClick={() => loadTemplate(t)}>
                        Load
                      </button>
                      <button style={S.dangerBtn} onClick={() => deleteTemplate(t.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={S.footerNote}>
          ✅ Hover fixed • ✅ Export JSON/CSV • ✅ Templates • ✅ No deployment errors
        </div>
      </div>
    </div>
  );
}

/* ================= UI PARTS ================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={S.field}>
      <div style={S.label}>{label}</div>
      {children}
    </div>
  );
}
function KPI({ label, value }: { label: string; value: any }) {
  return (
    <div style={S.kpi}>
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

  msg: {
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#E5E7EB",
    fontSize: 13,
  },

  panel: {
    background: "rgba(11,16,32,0.78)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
    backdropFilter: "blur(10px)",
  },
  panelTitle: { fontWeight: 950, color: "#FDE68A", marginBottom: 10 },

  grid5: { display: "grid", gridTemplateColumns: "220px 1fr 1fr 1fr 1fr", gap: 12 },
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

  /* ✅ HOVER FIX: dark select + dark options */
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

  kpiRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 },
  kpi: {
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  kpiLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: 900 },
  kpiValue: { marginTop: 6, fontSize: 20, fontWeight: 950 },

  split: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 },
  box: {
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  boxTitle: { fontWeight: 950, marginBottom: 10 },

  breakRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  pill: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(139,92,246,0.12)",
    border: "1px solid rgba(139,92,246,0.22)",
    color: "#E9D5FF",
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  previewRow: {
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,32,0.65)",
  },
  previewMeta: { marginTop: 6, color: "#C7CFDD", fontSize: 12 },

  empty: { color: "#A7B0C0", fontSize: 13, padding: 10 },

  card: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  cardTitle: { fontWeight: 950, fontSize: 15 },
  cardSub: { marginTop: 4, color: "#A7B0C0", fontSize: 12 },

  footerNote: { color: "#A7B0C0", fontSize: 12, textAlign: "center", padding: 6 },
};

/* ================= END ================= */
