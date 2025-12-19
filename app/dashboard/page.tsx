"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/* ================= SUPABASE (safe) ================= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/* ================= SETTINGS ================= */
const LS_SETTINGS = "eventura_os_settings_v3";
type SidebarMode = "Icons + Text" | "Icons Only";
type Theme = "Royal Gold" | "Midnight Purple" | "Emerald Night";
type AppSettings = {
  ceoEmail: string;
  staffEmail: string;
  theme: Theme;
  sidebarMode: SidebarMode;
  compactTables: boolean;
  confirmDeletes: boolean;
};
const SETTINGS_DEFAULTS: AppSettings = {
  ceoEmail: "hardikvekariya799@gmail.com",
  staffEmail: "eventurastaff@gmail.com",
  theme: "Royal Gold",
  sidebarMode: "Icons + Text",
  compactTables: false,
  confirmDeletes: true,
};

/* ================= TASKS (LOCAL) ================= */
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
const LS_TASKS = "eventura_os_tasks_v1";

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
function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function setSessionEmail(email: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("eventura_email", email);
  document.cookie = `eventura_email=${encodeURIComponent(email)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
function roleFromSettings(email: string, s: AppSettings): Role {
  if (!email) return "Staff";
  return email.toLowerCase() === s.ceoEmail.toLowerCase() ? "CEO" : "Staff";
}

/* ================= NAV ================= */
type NavItem = {
  label: string;
  href: string;
  icon: string; // emoji icon (safe)
};
const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "Events", href: "/events", icon: "📅" },
  { label: "Finance", href: "/finance", icon: "💰" },
  { label: "Vendors", href: "/vendors", icon: "🏷️" },
  { label: "AI", href: "/ai", icon: "🤖" },
  { label: "HR", href: "/hr", icon: "🧑‍🤝‍🧑" },
  { label: "Reports", href: "/reports", icon: "📈" },
  { label: "Settings", href: "/settings", icon: "⚙️" },
];

export default function DashboardPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings>(SETTINGS_DEFAULTS);
  const [email, setEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newAssign, setNewAssign] = useState<Role>("Staff");

  // load settings + tasks
  useEffect(() => {
    const s = safeLoad<AppSettings>(LS_SETTINGS, SETTINGS_DEFAULTS);
    setSettings({ ...SETTINGS_DEFAULTS, ...s });
    setTasks(safeLoad<TaskItem[]>(LS_TASKS, []));
  }, []);

  // save tasks
  useEffect(() => {
    safeSave(LS_TASKS, tasks);
  }, [tasks]);

  // theme apply (global)
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-ev-theme", settings.theme);
      document.documentElement.setAttribute("data-ev-sidebar", settings.sidebarMode);
      document.documentElement.setAttribute("data-ev-compact", settings.compactTables ? "1" : "0");
    }
  }, [settings]);

  // get user email from Supabase session
  useEffect(() => {
    (async () => {
      try {
        if (!supabase) {
          // fallback from local storage
          const fallback = safeLoad<string>("eventura_email", "");
          setEmail(fallback);
          setLoading(false);
          return;
        }
        const { data } = await supabase.auth.getSession();
        const e = data.session?.user?.email || "";
        if (e) {
          setEmail(e);
          setSessionEmail(e);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const role = useMemo(() => roleFromSettings(email, settings), [email, settings]);
  const isCEO = role === "CEO";
  const sidebarIconsOnly = settings.sidebarMode === "Icons Only";

  const myTasks = useMemo(() => tasks.filter((t) => t.assignedTo === role), [tasks, role]);
  const staffTasks = useMemo(() => tasks.filter((t) => t.assignedTo === "Staff"), [tasks]);
  const ceoTasks = useMemo(() => tasks.filter((t) => t.assignedTo === "CEO"), [tasks]);

  function addTask() {
    const title = newTitle.trim();
    if (!title) return;
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
    const ok = !settings.confirmDeletes || confirm("Delete this task?");
    if (!ok) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function signOut() {
    try {
      if (supabase) await supabase.auth.signOut();
    } finally {
      // clear local marker too
      if (typeof window !== "undefined") {
        localStorage.removeItem("eventura_email");
        document.cookie = `eventura_email=; Path=/; Max-Age=0`;
      }
      router.push("/login");
    }
  }

  return (
    <div style={S.app}>
      {/* LEFT SIDEBAR */}
      <aside style={{ ...S.sidebar, width: sidebarIconsOnly ? 76 : 260 }}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          {!sidebarIconsOnly ? (
            <div>
              <div style={S.brandName}>Eventura OS</div>
              <div style={S.brandSub}>Royal Ops</div>
            </div>
          ) : null}
        </div>

        <nav style={S.nav}>
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              iconsOnly={sidebarIconsOnly}
            />
          ))}
        </nav>

        <div style={S.sidebarFooter}>
          {!sidebarIconsOnly ? (
            <div style={S.userBox}>
              <div style={S.userLabel}>Signed in</div>
              <div style={S.userEmail}>{email || "Unknown"}</div>
              <div style={S.roleBadge}>{role}</div>
            </div>
          ) : (
            <div style={S.roleBadgeSmall}>{role}</div>
          )}

          <button style={S.signOutBtn} onClick={signOut}>
            {sidebarIconsOnly ? "⎋" : "Sign Out"}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={S.h1}>Dashboard</div>
            <div style={S.muted}>
              Logged in as <b>{email || "Unknown"}</b> • Role:{" "}
              <span style={S.rolePill}>{role}</span>
            </div>
          </div>

          <div style={S.headerRight}>
            <div style={S.kpiMini}>
              <div style={S.kpiMiniLabel}>Tasks</div>
              <div style={S.kpiMiniValue}>{tasks.length}</div>
            </div>
            <div style={S.kpiMini}>
              <div style={S.kpiMiniLabel}>Theme</div>
              <div style={S.kpiMiniValue}>{settings.theme}</div>
            </div>
          </div>
        </div>

        {/* CONTENT GRID */}
        <div style={S.grid}>
          {/* TASKS */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Tasks</div>

            {isCEO ? (
              <div style={S.addBox}>
                <input
                  style={S.input}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Add a task (Follow up leads, vendor booking, budget review)"
                />
                <textarea
                  style={S.textarea}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Notes (optional)"
                />
                <div style={S.rowBetween}>
                  <div style={S.inline}>
                    <span style={S.smallMuted}>Assign to:</span>
                    <select
                      style={S.select}
                      value={newAssign}
                      onChange={(e) => setNewAssign(e.target.value as Role)}
                    >
                      <option style={S.option} value="Staff">
                        Staff
                      </option>
                      <option style={S.option} value="CEO">
                        CEO
                      </option>
                    </select>
                  </div>
                  <button style={S.primaryBtnSmall} onClick={addTask}>
                    Add Task
                  </button>
                </div>
                <div style={S.smallNote}>CEO can create tasks for Staff. Saved locally for now.</div>
              </div>
            ) : (
              <div style={S.smallNote}>Staff can update status + delete own tasks.</div>
            )}

            <TaskList
              tasks={isCEO ? tasks : myTasks}
              showAssigned={isCEO}
              onUpdate={updateTask}
              onDelete={deleteTask}
            />
          </section>

          {/* RIGHT SIDE */}
          <section style={S.panel}>
            {isCEO ? (
              <>
                <div style={S.panelTitle}>CEO Control Center</div>

                <div style={S.kpiRow}>
                  <KPI label="All Tasks" value={tasks.length} />
                  <KPI label="Staff Tasks" value={staffTasks.length} />
                  <KPI label="CEO Tasks" value={ceoTasks.length} />
                </div>

                <div style={S.sectionTitle}>Next Modules</div>
                <div style={S.quickGrid}>
                  <QuickCard title="Events" text="Pipeline + calendar + statuses" href="/events" />
                  <QuickCard title="Finance" text="Income/Expense + AI insights" href="/finance" />
                  <QuickCard title="Vendors" text="Preferred vendors + pricing" href="/vendors" />
                  <QuickCard title="HR" text="Team + workload + KPI" href="/hr" />
                </div>

                <div style={S.noteBox}>
                  Sidebar is now on the LEFT ✅ <br />
                  You can build each tab file one-by-one (events/page.tsx, finance/page.tsx, etc.)
                </div>
              </>
            ) : (
              <>
                <div style={S.panelTitle}>Staff Workspace</div>

                <div style={S.kpiRow}>
                  <KPI label="My Tasks" value={myTasks.length} />
                  <KPI label="Completed" value={myTasks.filter((t) => t.status === "Complete").length} />
                  <KPI
                    label="In progress"
                    value={myTasks.filter((t) => t.status === "In progress").length}
                  />
                </div>

                <div style={S.noteBox}>
                  Update your task status. Use Events tab to see assigned events.
                </div>
              </>
            )}
          </section>
        </div>

        {loading ? (
          <div style={S.loadingBar}>Loading session…</div>
        ) : null}
      </main>
    </div>
  );
}

/* ================= COMPONENTS ================= */
function NavLink({
  href,
  icon,
  label,
  iconsOnly,
}: {
  href: string;
  icon: string;
  label: string;
  iconsOnly: boolean;
}) {
  // no usePathname to avoid extra complexity; hover + layout is the focus
  return (
    <Link href={href} style={S.navItem as any}>
      <span style={S.navIcon}>{icon}</span>
      {!iconsOnly ? <span style={S.navLabel}>{label}</span> : null}
    </Link>
  );
}

function TaskList({
  tasks,
  showAssigned,
  onUpdate,
  onDelete,
}: {
  tasks: TaskItem[];
  showAssigned: boolean;
  onUpdate: (id: string, patch: Partial<TaskItem>) => void;
  onDelete: (id: string) => void;
}) {
  if (!tasks.length) return <div style={S.muted}>No tasks yet.</div>;

  return (
    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
      {tasks.map((t) => (
        <div key={t.id} style={S.taskCard}>
          <div style={S.rowBetween}>
            <div style={{ fontWeight: 950 }}>{t.title}</div>
            <div style={S.inline}>
              {showAssigned ? <span style={S.assignedPill}>{t.assignedTo}</span> : null}
              <button style={S.dltBtn} onClick={() => onDelete(t.id)}>
                Delete
              </button>
            </div>
          </div>

          {t.note ? <div style={S.taskNote}>{t.note}</div> : null}

          <div style={S.rowBetween}>
            <div style={S.inline}>
              <span style={S.smallMuted}>Status:</span>
              <select
                style={S.select}
                value={t.status}
                onChange={(e) => onUpdate(t.id, { status: e.target.value as any })}
              >
                <option style={S.option}>Not Started</option>
                <option style={S.option}>In progress</option>
                <option style={S.option}>Complete</option>
              </select>
            </div>
            <div style={S.smallMuted}>{new Date(t.createdAt).toLocaleString()}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
    </div>
  );
}

function QuickCard({ title, text, href }: { title: string; text: string; href: string }) {
  return (
    <Link href={href} style={S.quickCard as any}>
      <div style={{ fontWeight: 950 }}>{title}</div>
      <div style={S.smallMuted}>{text}</div>
    </Link>
  );
}

/* ================= STYLES (Hover fixed) ================= */
const S: Record<string, React.CSSProperties> = {
  app: {
    minHeight: "100vh",
    display: "flex",
    background:
      "radial-gradient(1200px 800px at 20% 10%, rgba(255,215,110,0.18), transparent 60%), radial-gradient(900px 700px at 80% 20%, rgba(120,70,255,0.18), transparent 55%), #050816",
    color: "#F9FAFB",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
  },

  /* Sidebar */
  sidebar: {
    position: "sticky",
    top: 0,
    height: "100vh",
    padding: 12,
    borderRight: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,32,0.85)",
    backdropFilter: "blur(10px)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  brandRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 8px" },
  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    fontWeight: 950,
    background: "linear-gradient(135deg, rgba(212,175,55,0.30), rgba(139,92,246,0.22))",
    border: "1px solid rgba(212,175,55,0.35)",
  },
  brandName: { fontWeight: 950, lineHeight: 1.1 },
  brandSub: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },

  nav: { display: "grid", gap: 8 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 10px",
    borderRadius: 14,
    textDecoration: "none",
    color: "#E5E7EB",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    transition: "transform 120ms ease, background 120ms ease, border 120ms ease",
  },
  navIcon: { fontSize: 18, width: 22, textAlign: "center" },
  navLabel: { fontWeight: 900, fontSize: 13 },

  sidebarFooter: { marginTop: "auto", display: "grid", gap: 10 },
  userBox: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  userLabel: { fontSize: 12, color: "#9CA3AF", fontWeight: 900 },
  userEmail: { fontSize: 13, fontWeight: 900, marginTop: 6, wordBreak: "break-word" },
  roleBadge: {
    marginTop: 10,
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    background: "rgba(139,92,246,0.14)",
    border: "1px solid rgba(139,92,246,0.22)",
    color: "#E9D5FF",
    fontWeight: 950,
    width: "fit-content",
  },
  roleBadgeSmall: {
    display: "inline-flex",
    justifyContent: "center",
    padding: "6px 8px",
    borderRadius: 999,
    background: "rgba(139,92,246,0.14)",
    border: "1px solid rgba(139,92,246,0.22)",
    color: "#E9D5FF",
    fontWeight: 950,
  },
  signOutBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(248,113,113,0.30)",
    background: "rgba(248,113,113,0.10)",
    color: "#FCA5A5",
    fontWeight: 950,
    cursor: "pointer",
  },

  /* Main */
  main: { flex: 1, padding: 16, maxWidth: 1300, margin: "0 auto", width: "100%" },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,32,0.60)",
    backdropFilter: "blur(10px)",
  },
  headerRight: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
  h1: { fontSize: 26, fontWeight: 950 },
  muted: { color: "#9CA3AF", fontSize: 13, marginTop: 6 },

  rolePill: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 950,
    background: "rgba(212,175,55,0.12)",
    border: "1px solid rgba(212,175,55,0.22)",
    color: "#FDE68A",
  },

  kpiMini: {
    minWidth: 120,
    padding: 10,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  kpiMiniLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: 900 },
  kpiMiniValue: { marginTop: 6, fontWeight: 950 },

  grid: { marginTop: 12, display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 },
  panel: {
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,32,0.60)",
    backdropFilter: "blur(10px)",
  },
  panelTitle: { fontWeight: 950, color: "#FDE68A" },

  addBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(212,175,55,0.18)",
    background: "rgba(212,175,55,0.07)",
    display: "grid",
    gap: 10,
  },

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

  rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  inline: { display: "flex", alignItems: "center", gap: 10 },
  smallMuted: { color: "#9CA3AF", fontSize: 12 },
  smallNote: { color: "#A7B0C0", fontSize: 12, lineHeight: 1.35 },

  /* ✅ hover fix: dark options */
  select: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#F9FAFB",
    outline: "none",
    fontWeight: 900,
  },
  option: { backgroundColor: "#0B1020", color: "#F9FAFB" },

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
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  taskNote: { marginTop: 8, color: "#C7CFDD", fontSize: 13, lineHeight: 1.35 },
  assignedPill: {
    fontSize: 12,
    padding: "5px 10px",
    borderRadius: 999,
    background: "rgba(96,165,250,0.14)",
    border: "1px solid rgba(96,165,250,0.22)",
    color: "#BFDBFE",
    fontWeight: 950,
  },
  dltBtn: {
    fontSize: 12,
    padding: "7px 10px",
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.30)",
    background: "rgba(248,113,113,0.10)",
    color: "#FCA5A5",
    fontWeight: 950,
    cursor: "pointer",
  },

  kpiRow: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
  kpi: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  kpiLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: 900 },
  kpiValue: { marginTop: 6, fontSize: 22, fontWeight: 950 },

  sectionTitle: { marginTop: 14, fontWeight: 950, fontSize: 13, color: "#E5E7EB" },
  quickGrid: { marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  quickCard: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "#F9FAFB",
    textDecoration: "none",
  },
  noteBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(139,92,246,0.22)",
    background: "rgba(139,92,246,0.10)",
    color: "#E9D5FF",
    fontSize: 13,
    lineHeight: 1.35,
  },

  loadingBar: {
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "#A7B0C0",
    fontSize: 12,
  },
};

/* ✅ CSS hover fix for nav links (keeps text visible) */
if (typeof document !== "undefined") {
  const id = "eventura_nav_hover_fix_v1";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.innerHTML = `
      a[style*="text-decoration: none"][style*="border-radius: 14px"]:hover {
        background: rgba(212,175,55,0.10) !important;
        border: 1px solid rgba(212,175,55,0.22) !important;
        transform: translateY(-1px);
        color: #FDE68A !important;
      }
      a[style*="text-decoration: none"][style*="border-radius: 14px"]:hover span {
        color: #FDE68A !important;
      }
    `;
    document.head.appendChild(style);
  }
}
