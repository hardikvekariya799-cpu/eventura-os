"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

type StaffRow = {
  id: number;
  name: string;
  role: string;
  status: string;
  city: string | null;
  monthly_salary: number | null;
  workload: number;
  rating: number | null;
  created_at: string;
};

const ROLES = [
  "Event Manager",
  "Decor Specialist",
  "Logistics",
  "Marketing",
  "Sales",
  "Accountant",
  "Operations",
];

const STATUSES = ["Core", "Freelancer", "Trainee", "Inactive"];

export default function HRPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string>("");

  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // form
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [status, setStatus] = useState(STATUSES[0]);
  const [city, setCity] = useState("");
  const [monthlySalary, setMonthlySalary] = useState("");
  const [workload, setWorkload] = useState("0"); // 0-100
  const [rating, setRating] = useState(""); // 0-5

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
          window.history.replaceState({}, document.title, "/hr");
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
        .from("staff")
        .select("*")
        .order("id", { ascending: false });

      if (error) throw error;
      setRows((data as StaffRow[]) ?? []);
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Failed to load staff"}`);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setRole(ROLES[0]);
    setStatus(STATUSES[0]);
    setCity("");
    setMonthlySalary("");
    setWorkload("0");
    setRating("");
  }

  function startEdit(r: StaffRow) {
    setEditingId(r.id);
    setName(r.name ?? "");
    setRole(r.role ?? ROLES[0]);
    setStatus(r.status ?? STATUSES[0]);
    setCity(r.city ?? "");
    setMonthlySalary(
      r.monthly_salary === null || r.monthly_salary === undefined
        ? ""
        : String(r.monthly_salary)
    );
    setWorkload(String(r.workload ?? 0));
    setRating(r.rating === null || r.rating === undefined ? "" : String(r.rating));
  }

  async function saveStaff() {
    setLoading(true);
    setMsg("");
    try {
      if (!name.trim()) throw new Error("Name is required");
      if (!role.trim()) throw new Error("Role is required");

      const salaryNum =
        monthlySalary.trim() === ""
          ? null
          : Number.isFinite(Number(monthlySalary))
          ? Number(monthlySalary)
          : null;
      if (monthlySalary.trim() !== "" && salaryNum === null) {
        throw new Error("Monthly salary must be a number");
      }

      const workloadNum = Number(workload);
      if (!Number.isFinite(workloadNum) || workloadNum < 0 || workloadNum > 100) {
        throw new Error("Workload must be between 0 and 100");
      }

      const ratingNum =
        rating.trim() === ""
          ? null
          : Number.isFinite(Number(rating))
          ? Number(rating)
          : null;
      if (rating.trim() !== "" && (ratingNum === null || ratingNum < 0 || ratingNum > 5)) {
        throw new Error("Rating must be between 0 and 5");
      }

      const supabase = supabaseClient();
      const payload = {
        name: name.trim(),
        role: role.trim(),
        status: status.trim(),
        city: city.trim() ? city.trim() : null,
        monthly_salary: salaryNum,
        workload: workloadNum,
        rating: ratingNum,
      };

      if (isEditing && editingId !== null) {
        const { error } = await supabase.from("staff").update(payload).eq("id", editingId);
        if (error) throw error;
        setMsg("✅ Staff updated");
      } else {
        const { error } = await supabase.from("staff").insert({
          ...payload,
          created_by: userId || null,
        });
        if (error) throw error;
        setMsg("✅ Staff added");
      }

      resetForm();
      await refresh();
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Save failed"}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteStaff(id: number) {
    const ok = confirm("Delete this staff member? This cannot be undone.");
    if (!ok) return;

    setLoading(true);
    setMsg("");
    try {
      const supabase = supabaseClient();
      const { error } = await supabase.from("staff").delete().eq("id", id);
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
    const headers = [
      "id",
      "name",
      "role",
      "status",
      "city",
      "monthly_salary",
      "workload",
      "rating",
      "created_at",
    ];

    const escape = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      const needsWrap = /[",\n]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needsWrap ? `"${escaped}"` : escaped;
    };

    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.id,
          r.name,
          r.role,
          r.status,
          r.city ?? "",
          r.monthly_salary ?? "",
          r.workload ?? "",
          r.rating ?? "",
          r.created_at ?? "",
        ].map(escape).join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const yyyy = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `eventura_hr_${yyyy}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  const stats = useMemo(() => {
    const total = rows.length;
    const core = rows.filter((r) => r.status === "Core").length;
    const freelancers = rows.filter((r) => r.status === "Freelancer").length;
    const avgWorkload =
      total === 0 ? 0 : Math.round(rows.reduce((a, r) => a + (r.workload || 0), 0) / total);
    return { total, core, freelancers, avgWorkload };
  }, [rows]);

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
          <h1 style={{ fontSize: 28, margin: 0 }}>HR</h1>
          <p style={{ color: "#6b7280", marginTop: 6 }}>
            Staff management + Download CSV.
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

      {/* KPI */}
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <Kpi title="Total Staff" value={String(stats.total)} />
        <Kpi title="Core" value={String(stats.core)} />
        <Kpi title="Freelancers" value={String(stats.freelancers)} />
        <Kpi title="Avg Workload" value={`${stats.avgWorkload}%`} />
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
          {isEditing ? `Edit Staff #${editingId}` : "Add Staff Member"}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
          </Field>

          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
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

          <Field label="City (optional)">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Surat / Ahmedabad" style={inputStyle} />
          </Field>

          <Field label="Monthly Salary (₹) optional">
            <input value={monthlySalary} onChange={(e) => setMonthlySalary(e.target.value)} placeholder="e.g., 30000" style={inputStyle} />
          </Field>

          <Field label="Workload 0-100">
            <input value={workload} onChange={(e) => setWorkload(e.target.value)} placeholder="0-100" style={inputStyle} />
          </Field>

          <Field label="Rating 0-5 (optional)">
            <input value={rating} onChange={(e) => setRating(e.target.value)} placeholder="0-5" style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={saveStaff}
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            {loading ? "Saving..." : isEditing ? "Update" : "Add"}
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
          Staff List ({rows.length})
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>City</Th>
                <Th>Salary</Th>
                <Th>Workload</Th>
                <Th>Rating</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: 14, color: "#6b7280" }}>
                    No staff yet. Add your first staff member above.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <Td>{r.id}</Td>
                    <Td style={{ fontWeight: 900 }}>{r.name}</Td>
                    <Td>{r.role}</Td>
                    <Td>{r.status}</Td>
                    <Td>{r.city ?? "-"}</Td>
                    <Td>{r.monthly_salary ? `₹${Number(r.monthly_salary).toLocaleString("en-IN")}` : "-"}</Td>
                    <Td>{r.workload}%</Td>
                    <Td>{r.rating ?? "-"}</Td>
                    <Td>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => startEdit(r)} style={smallBtn}>
                          Edit
                        </button>
                        <button onClick={() => deleteStaff(r.id)} style={smallBtnDanger}>
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
