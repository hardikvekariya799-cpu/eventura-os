"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ================= TYPES ================= */
type StaffRole =
  | "Event Manager"
  | "Assistant Planner"
  | "Decor Specialist"
  | "Logistics"
  | "Marketing"
  | "Sales"
  | "Accountant"
  | "Operations"
  | "Client Support"
  | "Other";

type StaffStatus = "Core" | "Freelancer" | "Trainee" | "Inactive";

type TeamMember = {
  id: string;
  name: string;
  role: StaffRole;
  status: StaffStatus;
  city: string;

  workload: number; // 0-100
  eventsThisMonth: number; // 0-999
  rating: number; // 0-5
  monthlySalary: number; // 0 if freelancer

  skills: string[]; // tags
  notes?: string;

  createdAt: string;
  updatedAt: string;
};

const LS_HR = "eventura_os_hr_team_v2";

/* ================= HELPERS ================= */
function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function inr(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
}
function loadTeam(): TeamMember[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_HR);
    return raw ? (JSON.parse(raw) as TeamMember[]) : [];
  } catch {
    return [];
  }
}
function saveTeam(items: TeamMember[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_HR, JSON.stringify(items));
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

/* ================= PAGE ================= */
export default function HRPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [msg, setMsg] = useState("");

  // filters
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"All" | StaffRole>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | StaffStatus>("All");
  const [cityFilter, setCityFilter] = useState<"All" | string>("All");
  const [sortBy, setSortBy] = useState<
    "Updated" | "Name" | "Workload" | "Rating" | "Events" | "Salary"
  >("Updated");

  // form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("Event Manager");
  const [status, setStatus] = useState<StaffStatus>("Core");
  const [city, setCity] = useState("Surat");
  const [workload, setWorkload] = useState<string>("50");
  const [eventsThisMonth, setEventsThisMonth] = useState<string>("0");
  const [rating, setRating] = useState<string>("4");
  const [monthlySalary, setMonthlySalary] = useState<string>("0");
  const [skills, setSkills] = useState<string>(""); // comma separated
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    setTeam(loadTeam());
  }, []);

  useEffect(() => {
    saveTeam(team);
  }, [team]);

  const cities = useMemo(() => {
    const s = new Set<string>();
    team.forEach((m) => s.add(m.city));
    return ["All", ...[...s].sort()];
  }, [team]);

  const kpi = useMemo(() => {
    const total = team.length;
    const core = team.filter((m) => m.status === "Core").length;
    const freelancers = team.filter((m) => m.status === "Freelancer").length;
    const active = team.filter((m) => m.status !== "Inactive").length;

    const avgWorkload =
      total === 0 ? 0 : Math.round(team.reduce((a, b) => a + (b.workload || 0), 0) / total);

    const avgRating =
      total === 0 ? 0 : +(team.reduce((a, b) => a + (b.rating || 0), 0) / total).toFixed(1);

    const payroll = team
      .filter((m) => m.status === "Core" || m.status === "Trainee")
      .reduce((a, b) => a + (b.monthlySalary || 0), 0);

    const overloaded = team.filter((m) => m.workload >= 85 && m.status !== "Inactive").length;

    return { total, core, freelancers, active, avgWorkload, avgRating, payroll, overloaded };
  }, [team]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();

    const base = team
      .filter((m) => (roleFilter === "All" ? true : m.role === roleFilter))
      .filter((m) => (statusFilter === "All" ? true : m.status === statusFilter))
      .filter((m) => (cityFilter === "All" ? true : m.city === cityFilter))
      .filter((m) => {
        if (!s) return true;
        const blob = [
          m.name,
          m.role,
          m.status,
          m.city,
          m.skills.join(","),
          m.notes || "",
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(s);
      });

    const sorted = [...base].sort((a, b) => {
      if (sortBy === "Name") return a.name.localeCompare(b.name);
      if (sortBy === "Workload") return b.workload - a.workload;
      if (sortBy === "Rating") return b.rating - a.rating;
      if (sortBy === "Events") return b.eventsThisMonth - a.eventsThisMonth;
      if (sortBy === "Salary") return b.monthlySalary - a.monthlySalary;
      // Updated
      return a.updatedAt < b.updatedAt ? 1 : -1;
    });

    return sorted;
  }, [team, q, roleFilter, statusFilter, cityFilter, sortBy]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setRole("Event Manager");
    setStatus("Core");
    setCity("Surat");
    setWorkload("50");
    setEventsThisMonth("0");
    setRating("4");
    setMonthlySalary("0");
    setSkills("");
    setNotes("");
  }

  function startEdit(m: TeamMember) {
    setEditingId(m.id);
    setName(m.name);
    setRole(m.role);
    setStatus(m.status);
    setCity(m.city);
    setWorkload(String(m.workload));
    setEventsThisMonth(String(m.eventsThisMonth));
    setRating(String(m.rating));
    setMonthlySalary(String(m.monthlySalary));
    setSkills(m.skills.join(", "));
    setNotes(m.notes || "");
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function remove(id: string) {
    setTeam((prev) => prev.filter((m) => m.id !== id));
    setMsg("✅ Team member deleted");
    if (editingId === id) resetForm();
  }

  function upsert() {
    setMsg("");

    const n = name.trim();
    if (!n) return setMsg("❌ Name required");

    const w = Number(workload);
    const e = Number(eventsThisMonth);
    const r = Number(rating);
    const sal = Number(monthlySalary);

    if (Number.isNaN(w) || w < 0 || w > 100) return setMsg("❌ Workload must be 0–100");
    if (Number.isNaN(e) || e < 0) return setMsg("❌ Events must be 0+");
    if (Number.isNaN(r) || r < 0 || r > 5) return setMsg("❌ Rating must be 0–5");
    if (Number.isNaN(sal) || sal < 0) return setMsg("❌ Salary must be 0+");

    const skillList = skills
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 15);

    const now = new Date().toISOString();

    // If Freelancer -> salary forced 0 (clean)
    const fixedSalary = status === "Freelancer" ? 0 : sal;

    if (!editingId) {
      const item: TeamMember = {
        id: uid(),
        name: n,
        role,
        status,
        city: city.trim() || "Surat",
        workload: w,
        eventsThisMonth: e,
        rating: r,
        monthlySalary: fixedSalary,
        skills: skillList,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      setTeam((prev) => [item, ...prev]);
      setMsg("✅ Team member added");
      resetForm();
      return;
    }

    setTeam((prev) =>
      prev.map((m) =>
        m.id === editingId
          ? {
              ...m,
              name: n,
              role,
              status,
              city: city.trim() || "Surat",
              workload: w,
              eventsThisMonth: e,
              rating: r,
              monthlySalary: fixedSalary,
              skills: skillList,
              notes: notes.trim() || undefined,
              updatedAt: now,
            }
          : m
      )
    );

    setMsg("✅ Team member updated");
    resetForm();
  }

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div style={S.topRow}>
          <div>
            <div style={S.h1}>HR</div>
            <div style={S.muted}>
              Team directory • Workload • Ratings • Salary • Export (deploy-safe)
            </div>
          </div>
          <div style={S.row}>
            <button
              style={S.ghostBtn}
              onClick={() =>
                downloadJSON(`eventura_hr_${new Date().toISOString().slice(0, 10)}.json`, {
                  team,
                })
              }
              title="Download HR JSON"
            >
              Export
            </button>
            <button style={S.ghostBtn} onClick={resetForm}>
              Clear Form
            </button>
          </div>
        </div>

        {/* KPI */}
        <div style={S.kpiRow}>
          <KPI label="Total" value={kpi.total} />
          <KPI label="Active" value={kpi.active} />
          <KPI label="Avg Workload" value={`${kpi.avgWorkload}%`} />
          <KPI label="Avg Rating" value={kpi.avgRating.toFixed(1)} />
          <KPI label="Payroll (₹/mo)" value={`₹${inr(kpi.payroll)}`} />
          <KPI label="Overloaded" value={kpi.overloaded} warn={kpi.overloaded > 0} />
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* FORM */}
        <div style={S.panel}>
          <div style={S.panelTitle}>{editingId ? "Edit Team Member" : "Add Team Member"}</div>

          <div style={S.grid2}>
            <Field label="Full Name">
              <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            </Field>

            <Field label="Role">
              <select style={S.select} value={role} onChange={(e) => setRole(e.target.value as any)}>
                {[
                  "Event Manager",
                  "Assistant Planner",
                  "Decor Specialist",
                  "Logistics",
                  "Marketing",
                  "Sales",
                  "Accountant",
                  "Operations",
                  "Client Support",
                  "Other",
                ].map((x) => (
                  <option key={x} style={S.option}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status">
              <select style={S.select} value={status} onChange={(e) => setStatus(e.target.value as any)}>
                {["Core", "Freelancer", "Trainee", "Inactive"].map((x) => (
                  <option key={x} style={S.option}>
                    {x}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="City">
              <input style={S.input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Surat" />
            </Field>

            <Field label="Workload (0–100)">
              <input style={S.input} value={workload} onChange={(e) => setWorkload(e.target.value)} placeholder="50" />
            </Field>

            <Field label="Events This Month">
              <input
                style={S.input}
                value={eventsThisMonth}
                onChange={(e) => setEventsThisMonth(e.target.value)}
                placeholder="0"
              />
            </Field>

            <Field label="Rating (0–5)">
              <input style={S.input} value={rating} onChange={(e) => setRating(e.target.value)} placeholder="4" />
            </Field>

            <Field label="Monthly Salary (₹)">
              <input
                style={S.input}
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value)}
                placeholder="0"
              />
              <div style={S.smallNote}>
                Tip: If status = Freelancer, salary auto becomes 0 (clean).
              </div>
            </Field>

            <Field label="Skills (comma separated)" full>
              <input
                style={S.input}
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="planning, vendor management, excel, negotiation"
              />
            </Field>

            <Field label="Notes" full>
              <textarea
                style={S.textarea}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Performance notes, strengths, improvement points..."
              />
            </Field>
          </div>

          <div style={S.rowBetween}>
            <div style={S.smallMuted}>Saved locally (no errors). Next: connect to Supabase.</div>
            <div style={S.row}>
              {editingId ? (
                <button style={S.dangerBtn} onClick={() => remove(editingId)}>
                  Delete
                </button>
              ) : null}
              <button style={S.primaryBtn} onClick={upsert}>
                {editingId ? "Save Changes" : "Add Member"}
              </button>
            </div>
          </div>
        </div>

        {/* LIST */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Team Directory</div>

          <div style={S.filters}>
            <input
              style={S.input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search: name, role, city, skills, notes"
            />

            <select style={S.select} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)}>
              <option style={S.option} value="All">
                All Roles
              </option>
              {[
                "Event Manager",
                "Assistant Planner",
                "Decor Specialist",
                "Logistics",
                "Marketing",
                "Sales",
                "Accountant",
                "Operations",
                "Client Support",
                "Other",
              ].map((x) => (
                <option key={x} style={S.option}>
                  {x}
                </option>
              ))}
            </select>

            <select style={S.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option style={S.option} value="All">
                All Status
              </option>
              {["Core", "Freelancer", "Trainee", "Inactive"].map((x) => (
                <option key={x} style={S.option}>
                  {x}
                </option>
              ))}
            </select>

            <select style={S.select} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              {cities.map((c) => (
                <option key={c} style={S.option} value={c}>
                  {c === "All" ? "All Cities" : c}
                </option>
              ))}
            </select>

            <select style={S.select} value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              {["Updated", "Name", "Workload", "Rating", "Events", "Salary"].map((x) => (
                <option key={x} style={S.option}>
                  Sort: {x}
                </option>
              ))}
            </select>
          </div>

          {!filtered.length ? (
            <div style={S.empty}>No team members found.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((m) => (
                <div key={m.id} style={S.card}>
                  <div style={S.rowBetween}>
                    <div>
                      <div style={S.cardTitle}>{m.name}</div>
                      <div style={S.cardSub}>
                        {m.role} • {m.status} • {m.city}
                      </div>

                      <div style={S.pillRow}>
                        <span style={pill(m.workload >= 85 ? "danger" : m.workload >= 65 ? "warn" : "ok")}>
                          Workload: {m.workload}%
                        </span>
                        <span style={pill("ok")}>⭐ {m.rating.toFixed(1)}</span>
                        <span style={pill("ok")}>Events: {m.eventsThisMonth}</span>
                        <span style={pill("ok")}>₹{inr(m.monthlySalary)}/mo</span>
                      </div>

                      {m.skills.length ? (
                        <div style={S.tagLine}>
                          {m.skills.slice(0, 12).map((t) => (
                            <span key={t} style={S.tag}>
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {m.notes ? <div style={S.note}>{m.notes}</div> : null}
                    </div>

                    <div style={S.row}>
                      <button style={S.ghostBtn} onClick={() => startEdit(m)}>
                        Edit
                      </button>
                      <button style={S.dangerBtn} onClick={() => remove(m.id)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div style={S.smallMuted}>Updated: {new Date(m.updatedAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={S.footerNote}>
          ✅ Hover fixed for dropdown/options • ✅ Editable • ✅ Deletable • ✅ Saved locally
        </div>
      </div>
    </div>
  );
}

/* ================= UI PARTS ================= */
function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ ...S.field, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={S.label}>{label}</div>
      {children}
    </div>
  );
}

function KPI({ label, value, warn }: { label: string; value: any; warn?: boolean }) {
  return (
    <div style={{ ...S.kpi, ...(warn ? S.kpiWarn : null) }}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
    </div>
  );
}

function pill(kind: "ok" | "warn" | "danger") {
  const base: React.CSSProperties = {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 950,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#E5E7EB",
  };
  if (kind === "warn")
    return {
      ...base,
      background: "rgba(212,175,55,0.12)",
      border: "1px solid rgba(212,175,55,0.22)",
      color: "#FDE68A",
    };
  if (kind === "danger")
    return {
      ...base,
      background: "rgba(248,113,113,0.12)",
      border: "1px solid rgba(248,113,113,0.22)",
      color: "#FCA5A5",
    };
  return {
    ...base,
    background: "rgba(34,197,94,0.10)",
    border: "1px solid rgba(34,197,94,0.20)",
    color: "#BBF7D0",
  };
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
  smallNote: { marginTop: 6, color: "#A7B0C0", fontSize: 12, lineHeight: 1.35 },

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

  kpiRow: { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 },
  kpi: {
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  kpiWarn: {
    background: "rgba(248,113,113,0.10)",
    border: "1px solid rgba(248,113,113,0.22)",
  },
  kpiLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: 900 },
  kpiValue: { marginTop: 6, fontSize: 20, fontWeight: 950 },

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

  filters: { display: "grid", gridTemplateColumns: "1fr 220px 200px 200px 200px", gap: 10, marginBottom: 10 },
  empty: { color: "#A7B0C0", fontSize: 13, padding: 10 },

  card: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  cardTitle: { fontWeight: 950, fontSize: 15 },
  cardSub: { marginTop: 4, color: "#A7B0C0", fontSize: 12 },
  pillRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 },

  tagLine: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  tag: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(139,92,246,0.12)",
    border: "1px solid rgba(139,92,246,0.22)",
    color: "#E9D5FF",
    fontWeight: 900,
  },
  note: { marginTop: 10, color: "#C7CFDD", fontSize: 13, lineHeight: 1.35 },

  footerNote: { color: "#A7B0C0", fontSize: 12, textAlign: "center", padding: 6 },
};

/* ================= END ================= */
