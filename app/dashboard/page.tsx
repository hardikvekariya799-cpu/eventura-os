"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Role = "CEO" | "Staff";
type TaskStatus = "Not Started" | "In progress" | "Complete";

type TaskItem = {
  id: string;
  title: string;
  note?: string;
  status: TaskStatus;
  assignedTo: Role;
  createdAt: string;
};

const CEO_EMAIL = process.env.NEXT_PUBLIC_CEO_EMAIL || "hardikvekariya799@gmail.com";
const STAFF_EMAIL = process.env.NEXT_PUBLIC_STAFF_EMAIL || "eventurastaff@gmail.com";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const LS_TASKS = "eventura_os_tasks_v1";

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function roleFromEmail(email: string | null | undefined): Role {
  if (!email) return "Staff";
  return email.toLowerCase() === CEO_EMAIL.toLowerCase() ? "CEO" : "Staff";
}
function loadTasks(): TaskItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_TASKS);
    return raw ? (JSON.parse(raw) as TaskItem[]) : [];
  } catch {
    return [];
  }
}
function saveTasks(tasks: TaskItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("Staff");

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newAssign, setNewAssign] = useState<Role>("Staff");

  useEffect(() => {
    setTasks(loadTasks());
  }, []);
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");

      if (!supabase) {
        setErr("Supabase env missing on Vercel.");
        setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const sessionEmail = data.session?.user?.email ?? null;

      if (!sessionEmail) {
        // Not signed in → go login
        window.location.href = "/login";
        return;
      }

      setEmail(sessionEmail);
      setRole(roleFromEmail(sessionEmail));
      setLoading(false);
    })();
  }, []);

  const myTasks = useMemo(() => tasks.filter((t) => t.assignedTo === role), [tasks, role]);
  const staffTasks = useMemo(() => tasks.filter((t) => t.assignedTo === "Staff"), [tasks]);
  const ceoTasks = useMemo(() => tasks.filter((t) => t.assignedTo === "CEO"), [tasks]);

  function addTask() {
    setErr("");
    const title = newTitle.trim();
    if (!title) {
      setErr("Task title required.");
      return;
    }
    const item: TaskItem = {
      id: uid(),
      title,
      note: newNote.trim() || undefined,
      status: "Not Started",
      assignedTo: newAssign,
      createdAt: new Date().toISOString(),
    };
    setTasks((prev) => [item, ...prev]);
    setNewTitle("");
    setNewNote("");
  }

  function updateTask(id: string, patch: Partial<TaskItem>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function signOut() {
    setBusy(true);
    setErr("");
    try {
      if (!supabase) return;
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch (e: any) {
      setErr(e?.message || "Sign out failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.h1}>Eventura OS</div>
          <div style={styles.muted}>Loading dashboard…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, maxWidth: 1100 }}>
        <div style={styles.topRow}>
          <div>
            <div style={styles.h1}>Eventura OS Dashboard</div>
            <div style={styles.muted}>
              Logged in as <b>{email}</b> • Role: <span style={styles.rolePill}>{role}</span>
            </div>
          </div>
          <button style={styles.ghostBtn} onClick={signOut} disabled={busy}>
            {busy ? "Signing out…" : "Sign Out"}
          </button>
        </div>

        {err ? <div style={styles.err}>{err}</div> : null}

        <div style={styles.grid2}>
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Tasks</div>

            {role === "CEO" ? (
              <div style={styles.addBox}>
                <input
                  style={styles.input}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Add a task (Follow up leads, vendor booking, budget review)"
                />
                <textarea
                  style={styles.textarea}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Notes (optional)"
                />
                <div style={styles.rowBetween}>
                  <div style={styles.inline}>
                    <span style={styles.muted}>Assign to:</span>
                    <select
                      style={styles.select}
                      value={newAssign}
                      onChange={(e) => setNewAssign(e.target.value as Role)}
                    >
                      <option value="Staff">Staff</option>
                      <option value="CEO">CEO</option>
                    </select>
                  </div>
                  <button style={styles.primaryBtnSmall} onClick={addTask}>
                    Add Task
                  </button>
                </div>
                <div style={styles.smallNote}>CEO can create tasks for Staff (saved locally for now).</div>
              </div>
            ) : (
              <div style={styles.smallNote}>Staff can update status & delete their tasks.</div>
            )}

            <TaskList
              tasks={role === "CEO" ? tasks : myTasks}
              canAssign={role === "CEO"}
              onUpdate={updateTask}
              onDelete={deleteTask}
            />
          </div>

          <div style={styles.panel}>
            {role === "CEO" ? (
              <>
                <div style={styles.panelTitle}>CEO Control Center</div>
                <div style={styles.kpiRow}>
                  <KPI label="All Tasks" value={tasks.length} />
                  <KPI label="Staff Tasks" value={staffTasks.length} />
                  <KPI label="CEO Tasks" value={ceoTasks.length} />
                </div>
                <div style={styles.sectionTitle}>Next Modules</div>
                <div style={styles.noteBox}>
                  Leads • Finance • HR • Vendors — we can add them now (same style).
                </div>
              </>
            ) : (
              <>
                <div style={styles.panelTitle}>Staff Workspace</div>
                <div style={styles.kpiRow}>
                  <KPI label="My Tasks" value={myTasks.length} />
                  <KPI label="Completed" value={myTasks.filter((t) => t.status === "Complete").length} />
                  <KPI label="In progress" value={myTasks.filter((t) => t.status === "In progress").length} />
                </div>
                <div style={styles.sectionTitle}>Today Focus</div>
                <div style={styles.noteBox}>Update tasks as you work. Ask CEO for new tasks.</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskList({
  tasks,
  canAssign,
  onUpdate,
  onDelete,
}: {
  tasks: TaskItem[];
  canAssign: boolean;
  onUpdate: (id: string, patch: Partial<TaskItem>) => void;
  onDelete: (id: string) => void;
}) {
  if (!tasks.length) return <div style={styles.muted}>No tasks yet.</div>;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {tasks.map((t) => (
        <div key={t.id} style={styles.taskCard}>
          <div style={styles.rowBetween}>
            <div style={{ fontWeight: 900 }}>{t.title}</div>
            <div style={styles.inline}>
              {canAssign ? <span style={styles.assignedPill}>Assigned: {t.assignedTo}</span> : null}
              <button style={styles.dltBtn} onClick={() => onDelete(t.id)}>Delete</button>
            </div>
          </div>

          {t.note ? <div style={styles.taskNote}>{t.note}</div> : null}

          <div style={styles.rowBetween}>
            <div style={styles.inline}>
              <span style={styles.muted}>Status:</span>
              <select
                style={styles.select}
                value={t.status}
                onChange={(e) => onUpdate(t.id, { status: e.target.value as TaskStatus })}
              >
                <option>Not Started</option>
                <option>In progress</option>
                <option>Complete</option>
              </select>
            </div>
            <div style={styles.smallMuted}>{new Date(t.createdAt).toLocaleString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.kpi}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 18,
    background:
      "radial-gradient(1200px 800px at 20% 10%, rgba(255,215,110,0.18), transparent 60%), radial-gradient(900px 700px at 80% 20%, rgba(120,70,255,0.18), transparent 55%), #050816",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#F9FAFB",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
  },
  card: {
    width: "100%",
    maxWidth: 520,
    background: "rgba(11,16,32,0.92)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
    backdropFilter: "blur(10px)",
  },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
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
    padding: 10,
    borderRadius: 12,
    background: "rgba(248,113,113,0.12)",
    border: "1px solid rgba(248,113,113,0.28)",
    color: "#FCA5A5",
    fontSize: 13,
    lineHeight: 1.4,
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
  smallNote: { marginTop: 10, fontSize: 12, color: "#A7B0C0", lineHeight: 1.35 },
  grid2: { marginTop: 14, display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 12 },
  panel: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
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
  rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  inline: { display: "flex", alignItems: "center", gap: 10 },
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
    minHeight: 70,
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
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#F9FAFB",
    outline: "none",
    fontWeight: 800,
  },
  primaryBtnSmall: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(212,175,55,0.35)",
    background: "linear-gradient(135deg, rgba(212,175,55,0.32), rgba(139,92,246,0.22))",
    color: "#FFF",
    fontWeight: 950,
    cursor: "pointer",
  },
  taskCard: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(11,16,32,0.70)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  taskNote: { marginTop: 8, color: "#C7CFDD", fontSize: 13, lineHeight: 1.35 },
  assignedPill: {
    fontSize: 12,
    padding: "5px 10px",
    borderRadius: 999,
    background: "rgba(96,165,250,0.14)",
    border: "1px solid rgba(96,165,250,0.22)",
    color: "#BFDBFE",
    fontWeight: 900,
  },
  dltBtn: {
    fontSize: 12,
    padding: "7px 10px",
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.30)",
    background: "rgba(248,113,113,0.10)",
    color: "#FCA5A5",
    fontWeight: 900,
    cursor: "pointer",
  },
  kpiRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 },
  kpi: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  kpiLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: 800 },
  kpiValue: { marginTop: 6, fontSize: 22, fontWeight: 950 },
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
};
