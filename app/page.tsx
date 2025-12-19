"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createClient, User } from "@supabase/supabase-js";

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

export default function Page() {
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("hardikvekariya799@gmail.com");
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

  // boot
  useEffect(() => {
    setTasks(loadTasks());
  }, []);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  // auth bootstrap
  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      if (!supabase) {
        setLoading(false);
        setErr(
          "Supabase env missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local and Vercel."
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

      return () => {
        sub.subscription.unsubscribe();
      };
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

    // If profile missing (rare), create it client-side as fallback
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

      if (!email.trim() || !password.trim()) {
        throw new Error("Email and password required.");
      }

      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;

        // user must sign in right away (depending on email confirmation settings)
        // We keep it simple: try sign-in automatically.
        const { error: e2 } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (e2) throw e2;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
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
      setUser(null);
      setProfile(null);
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
        <div style={styles.card}>
          <div style={styles.h1}>Eventura OS</div>
          <div style={styles.muted}>Loading…</div>
        </div>
      </div>
    );
  }

  // AUTH SCREEN
  if (!user) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.topRow}>
            <div>
              <div style={styles.h1}>Eventura OS</div>
              <div style={styles.muted}>CEO & Staff Login (role-based)</div>
            </div>
            <div style={styles.badge}>Production Ready</div>
          </div>

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

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              style={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@eventura.com"
              autoComplete="email"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              type="password"
              autoComplete={authMode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          <button style={styles.primaryBtn} onClick={handleAuth} disabled={busy}>
            {busy ? "Please wait…" : authMode === "signup" ? "Create Account" : "Sign In"}
          </button>

          <div style={styles.smallNote}>
            CEO auto-detect: <b>hardikvekariya799@gmail.com</b> → CEO. Other emails → Staff.
          </div>
        </div>
      </div>
    );
  }

  // LOGGED IN, WAIT PROFILE
  if (!profile) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.h1}>Eventura OS</div>
          <div style={styles.muted}>Signed in. Loading your role…</div>
          {err ? <div style={styles.err}>{err}</div> : null}
          <button style={styles.ghostBtn} onClick={signOut} disabled={busy}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // DASHBOARD (SINGLE PAGE)
  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, maxWidth: 1100 }}>
        <div style={styles.topRow}>
          <div>
            <div style={styles.h1}>Eventura OS</div>
            <div style={styles.muted}>
              Logged in as <b>{profile.email}</b> • Role:{" "}
              <span style={styles.rolePill}>{profile.role}</span>
            </div>
          </div>
          <button style={styles.ghostBtn} onClick={signOut} disabled={busy}>
            Sign Out
          </button>
        </div>

        {err ? <div style={styles.err}>{err}</div> : null}

        <div style={styles.grid2}>
          {/* LEFT: TASKS */}
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Tasks</div>

            {role === "CEO" ? (
              <div style={styles.addBox}>
                <div style={styles.row}>
                  <input
                    style={{ ...styles.input, marginBottom: 0 }}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Add a task (example: Follow up leads, vendor booking, budget review)"
                  />
                </div>
                <div style={styles.row}>
                  <textarea
                    style={styles.textarea}
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Notes (optional)"
                  />
                </div>
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
                <div style={styles.smallNote}>
                  CEO can create tasks for Staff. (Stored locally for now so it works immediately.)
                </div>
              </div>
            ) : (
              <div style={styles.smallNote}>
                Staff can update status and delete their own tasks (local).
              </div>
            )}

            <TaskList
              tasks={role === "CEO" ? tasks : myTasks}
              canAssign={role === "CEO"}
              onUpdate={updateTask}
              onDelete={deleteTask}
            />
          </div>

          {/* RIGHT: ROLE VIEW */}
          <div style={styles.panel}>
            {role === "CEO" ? (
              <>
                <div style={styles.panelTitle}>CEO Control Center</div>
                <div style={styles.kpiRow}>
                  <KPI label="All Tasks" value={tasks.length} />
                  <KPI label="Staff Tasks" value={staffTasks.length} />
                  <KPI label="CEO Tasks" value={ceoTasks.length} />
                </div>

                <div style={styles.sectionTitle}>Quick Actions</div>
                <div style={styles.quickGrid}>
                  <QuickCard title="Lead Pipeline" text="Track hot leads, follow-ups, conversion." />
                  <QuickCard title="Finance Snapshot" text="Revenue, expenses, profit targets." />
                  <QuickCard title="HR & Team" text="Assign workload, performance, hiring." />
                  <QuickCard title="Vendor Hub" text="Preferred vendors, pricing, contracts." />
                </div>

                <div style={styles.sectionTitle}>CEO Notes</div>
                <div style={styles.noteBox}>
                  Your CEO access is automatic by email. You can create staff accounts using “Create
                  Account” (any other email will become Staff).
                </div>
              </>
            ) : (
              <>
                <div style={styles.panelTitle}>Staff Workspace</div>
                <div style={styles.kpiRow}>
                  <KPI label="My Tasks" value={myTasks.length} />
                  <KPI
                    label="Completed"
                    value={myTasks.filter((t) => t.status === "Complete").length}
                  />
                  <KPI
                    label="In progress"
                    value={myTasks.filter((t) => t.status === "In progress").length}
                  />
                </div>

                <div style={styles.sectionTitle}>Today Focus</div>
                <div style={styles.noteBox}>
                  Update your task status after completion. If you need a new task, ask CEO.
                </div>

                <div style={styles.sectionTitle}>Guidelines</div>
                <ul style={styles.ul}>
                  <li>Keep vendor follow-ups recorded in tasks.</li>
                  <li>Mark “In progress” while working, “Complete” after done.</li>
                  <li>Delete tasks only if created by mistake.</li>
                </ul>
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
  if (!tasks.length) {
    return <div style={styles.muted}>No tasks yet.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {tasks.map((t) => (
        <div key={t.id} style={styles.taskCard}>
          <div style={styles.rowBetween}>
            <div style={{ fontWeight: 800 }}>{t.title}</div>
            <div style={styles.inline}>
              {canAssign ? (
                <span style={styles.assignedPill}>Assigned: {t.assignedTo}</span>
              ) : null}
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
            <div style={styles.smallMuted}>
              {new Date(t.createdAt).toLocaleString()}
            </div>
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

function QuickCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.quickCard}>
      <div style={{ fontWeight: 900 }}>{title}</div>
      <div style={styles.smallMuted}>{text}</div>
    </div>
  );
}

/* ------------------- STYLES ------------------- */
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
  h1: { fontSize: 26, fontWeight: 950, letterSpacing: 0.2 },
  muted: { color: "#9CA3AF", fontSize: 13, marginTop: 6 },
  smallMuted: { color: "#9CA3AF", fontSize: 12 },
  badge: {
    fontSize: 12,
    fontWeight: 800,
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(212,175,55,0.14)",
    border: "1px solid rgba(212,175,55,0.28)",
    color: "#FDE68A",
    whiteSpace: "nowrap",
  },
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
  segActive: {
    background: "rgba(212,175,55,0.18)",
    color: "#FDE68A",
  },
  field: { marginTop: 14 },
  label: { display: "block", fontSize: 12, color: "#9CA3AF", marginBottom: 8, fontWeight: 800 },
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
  smallNote: { marginTop: 12, fontSize: 12, color: "#A7B0C0", lineHeight: 1.35 },
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
  },
  row: { display: "flex", gap: 10, marginTop: 10 },
  rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  inline: { display: "flex", alignItems: "center", gap: 10 },
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
  quickGrid: { marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  quickCard: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
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
  ul: { marginTop: 10, color: "#C7CFDD", fontSize: 13, lineHeight: 1.5 },
};
