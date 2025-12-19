"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient, User } from "@supabase/supabase-js";

/* ================= AUTH / SUPABASE (SAFE) ================= */
type Role = "CEO" | "Staff";
type Profile = { id: string; email: string | null; role: Role };

type TaskItem = {
  id: string;
  title: string;
  note?: string;
  status: "Not Started" | "In progress" | "Complete";
  assignedTo: "CEO" | "Staff";
  createdAt: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const LS_TASKS = "eventura_os_tasks_v1";

function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
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

const NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Events", href: "/events" },
  { label: "Finance", href: "/finance" },
  { label: "Vendors", href: "/vendors" },
  { label: "AI", href: "/ai" },
  { label: "HR", href: "/hr" },
  { label: "Reports", href: "/reports" },
  { label: "Settings", href: "/settings" },
];

export default function DashboardPage() {
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [emailInput, setEmailInput] = useState("hardikvekariya799@gmail.com");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newAssign, setNewAssign] = useState<"CEO" | "Staff">("Staff");

  const role: Role | null = profile?.role ?? null;

  useEffect(() => {
    setTasks(loadTasks());
  }, []);
  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      if (!supabase) {
        setLoading(false);
        setErr(
          "Supabase env missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel."
        );
        return;
      }

      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);

      if (sessionUser) {
        await fetchProfile(sessionUser.id);
      }
      setLoading(false);

      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        setProfile(null);
        if (u) await fetchProfile(u.id);
      });

      return () => sub.subscription.unsubscribe();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchProfile(uid: string) {
    if (!supabase) return;
    setErr(null);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,role")
      .eq("id", uid)
      .maybeSingle();

    if (error) {
      setErr(error.message);
      return;
    }

    if (!data) {
      const me = (await supabase.auth.getUser()).data.user;
      const myEmail = me?.email ?? null;
      const myRole: Role =
        (myEmail || "").toLowerCase() === "hardikvekariya799@gmail.com" ? "CEO" : "Staff";

      const { data: inserted, error: insErr } = await supabase
        .from("profiles")
        .insert({ id: uid, email: myEmail, role: myRole })
        .select("id,email,role")
        .single();

      if (insErr) {
        setErr(insErr.message);
        return;
      }
      setProfile(inserted as Profile);
      return;
    }

    setProfile(data as Profile);
  }

  async function handleAuth() {
    setErr(null);
    setBusy(true);
    try {
      if (!supabase) throw new Error("Supabase not configured.");
      if (!emailInput.trim() || !password.trim()) throw new Error("Email and password required.");

      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email: emailInput.trim(), password });
        if (error) throw error;

        const { error: e2 } = await supabase.auth.signInWithPassword({
          email: emailInput.trim(),
          password,
        });
        if (e2) throw e2;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailInput.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e?.message || "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setErr(null);
    setBusy(true);
    try {
      if (!supabase) return;
      await supabase.auth.signOut();
      window.location.href = "/login";
    } finally {
      setBusy(false);
    }
  }

  const myTasks = useMemo(() => {
    if (!role) return [];
    return tasks.filter((t) => t.assignedTo === role);
  }, [tasks, role]);

  const staffTasks = useMemo(() => tasks.filter((t) => t.assignedTo === "Staff"), [tasks]);
  const ceoTasks = useMemo(() => tasks.filter((t) => t.assignedTo === "CEO"), [tasks]);

  function addTask() {
    setErr(null);
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

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerCard}>
          <div style={styles.h1}>Eventura OS</div>
          <div style={styles.muted}>Loading…</div>
        </div>
      </div>
    );
  }

  // Auth screen (if someone lands here not logged)
  if (!user) {
    return (
      <div style={styles.page}>
        <div style={styles.centerCard}>
          <div style={styles.h1}>Eventura OS</div>
          <div style={styles.muted}>Sign in to continue</div>
          {err ? <div style={styles.err}>{err}</div> : null}

          <div style={styles.segment}>
            <button
              style={{ ...styles.segBtn, ...(authMode === "signin" ? styles.segActive : null) }}
              onClick={() => setAuthMode("signin")}
              disabled={busy}
            >
              Sign In
            </button>
            <button
              style={{ ...styles.segBtn, ...(authMode === "signup" ? styles.segActive : null) }}
              onClick={() => setAuthMode("signup")}
              disabled={busy}
            >
              Create Account
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={styles.label}>Email</div>
            <input
              style={styles.input}
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={styles.label}>Password</div>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          <button style={styles.primaryBtn} onClick={handleAuth} disabled={busy}>
            {busy ? "Please wait…" : authMode === "signup" ? "Create Account" : "Sign In"}
          </button>
        </div>
      </div>
    );
  }

  // Main layout with LEFT SIDEBAR
  return (
    <div style={styles.shellPage}>
      {/* LEFT SIDEBAR */}
      <aside style={styles.sidebar}>
        <div style={styles.brandBox}>
          <div style={styles.brandTitle}>Eventura OS</div>
          <div style={styles.brandSub}>
            <span style={styles.dot} />
            {profile?.role || "Staff"} • {profile?.email || user.email}
          </div>
        </div>

        <div style={styles.nav}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} style={styles.navItem}>
              {item.label}
            </Link>
          ))}
        </div>

        <div style={{ marginTop: "auto" }}>
          <button style={styles.signoutBtn} onClick={signOut} disabled={busy}>
            {busy ? "Signing out…" : "Sign Out"}
          </button>
        </div>
      </aside>

      {/* RIGHT CONTENT */}
      <main style={styles.main}>
        <div style={styles.headerCard}>
          <div>
            <div style={styles.h1}>Dashboard</div>
            <div style={styles.muted}>
              Logged in as <b>{profile?.email || user.email}</b> • Role:{" "}
              <span style={styles.rolePill}>{profile?.role || "Staff"}</span>
            </div>
          </div>
        </div>

        {err ? <div style={styles.err}>{err}</div> : null}

        <div style={styles.grid2}>
          {/* TASKS */}
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
                      onChange={(e) => setNewAssign(e.target.value as any)}
                    >
                      <option value="Staff">Staff</option>
                      <option value="CEO">CEO</option>
                    </select>
                  </div>
                  <button style={styles.primaryBtnSmall} onClick={addTask}>
                    Add Task
                  </button>
                </div>

                <div style={styles.smallNote}>CEO can create tasks for Staff (saved locally).</div>
              </div>
            ) : (
              <div style={styles.smallNote}>Staff can update status and delete their tasks.</div>
            )}

            <TaskList
              tasks={role === "CEO" ? tasks : myTasks}
              canAssign={role === "CEO"}
              onUpdate={updateTask}
              onDelete={deleteTask}
            />
          </div>

          {/* KPI */}
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
                  Open the left sidebar and go to <b>Events</b>. We’ll build one tab at a time.
                </div>
              </>
            ) : (
              <>
                <div style={styles.panelTitle}>Staff Workspace</div>
                <div style={styles.kpiRow}>
                  <KPI label="My Tasks" value={myTasks.length} />
                  <KPI label="Completed" value={myTasks.filter((t) => t.status === "Complete").length} />
                  <KPI
                    label="In progress"
                    value={myTasks.filter((t) => t.status === "In progress").length}
                  />
                </div>
                <div style={styles.sectionTitle}>Today Focus</div>
                <div style={styles.noteBox}>Update tasks and check Events tab for new bookings.</div>
              </>
            )}
          </div>
        </div>
      </main>
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
    <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
      {tasks.map((t) => (
        <div key={t.id} style={styles.taskCard}>
          <div style={styles.rowBetween}>
            <div style={{ fontWeight: 800 }}>{t.title}</div>
            <div style={styles.inline}>
              {canAssign ? <span style={styles.assignedPill}>Assigned: {t.assignedTo}</span> : null}
              <button style={styles.dltBtn} onClick={() => onDelete(t.id)}>
                Delete
              </button>
            </div>
          </div>

          {t.note ? <div style={styles.taskNote}>{t.note}</div> : null}

          <div style={styles.rowBetween}>
            <div style={styles.inline}>
              <span style={styles.muted}>Status:</span>
              <select
                style={styles.select}
                value={t.status}
                onChange={(e) => onUpdate(t.id, { status: e.target.value as any })}
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

function KPI({ label, value }: { label: string; value: any }) {
  return (
    <div style={styles.kpi}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  );
}

/* ================= STYLES ================= */
const styles: Record<string, React.CSSProperties> = {
  shellPage: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    background:
      "radial-gradient(1200px 800px at 20% 10%, rgba(255,215,110,0.18), transparent 60%), radial-gradient(900px 700px at 80% 20%, rgba(120,70,255,0.18), transparent 55%), #050816",
    color: "#F9FAFB",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
  },
  sidebar: {
    padding: 14,
    borderRight: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,32,0.80)",
    backdropFilter: "blur(10px)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  brandBox: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  brandTitle: { fontSize: 18, fontWeight: 950, color: "#FDE68A" },
  brandSub: { marginTop: 8, fontSize: 12, color: "#A7B0C0", display: "flex", gap: 8, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 999, background: "rgba(34,197,94,0.8)" },

  nav: { display: "grid", gap: 10 },
  navItem: {
    textDecoration: "none",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "#E5E7EB",
    fontWeight: 900,
  },

  signoutBtn: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#E5E7EB",
    fontWeight: 900,
    cursor: "pointer",
  },

  main: { padding: 16 },
  headerCard: {
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,32,0.60)",
    backdropFilter: "blur(10px)",
    marginBottom: 12,
  },

  h1: { fontSize: 24, fontWeight: 950 },
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

  grid2: { display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 12 },
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

  rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  inline: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },

  label: { fontSize: 12, color: "#9CA3AF", fontWeight: 800, marginBottom: 8 },
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

  // fallback
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" },
  centerCard: {
    width: "100%",
    maxWidth: 520,
    background: "rgba(11,16,32,0.92)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 18,
  },
  segment: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 14,
    overflow: "hidden",
  },
  segBtn: {
    padding: "10px 12px",
    fontWeight: 900,
    fontSize: 13,
    background: "transparent",
    color: "#E5E7EB",
    border: "none",
    cursor: "pointer",
  },
  segActive: { background: "rgba(212,175,55,0.18)", color: "#FDE68A" },
  primaryBtn: {
    width: "100%",
    marginTop: 14,
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(212,175,55,0.35)",
    background: "linear-gradient(135deg, rgba(212,175,55,0.32), rgba(139,92,246,0.22))",
    color: "#FFF",
    fontWeight: 950,
    cursor: "pointer",
  },
};
