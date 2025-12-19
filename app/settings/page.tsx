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
type Theme =
  | "Royal Gold"
  | "Midnight Purple"
  | "Emerald Night"
  | "Ocean Blue"
  | "Ruby Noir"
  | "Carbon Black"
  | "Ivory Light";
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

/* ✅ Theme tokens (this makes themes ACTUALLY apply) */
function readThemeFromDom(): Theme {
  if (typeof document === "undefined") return "Royal Gold";
  const t = document.documentElement.getAttribute("data-ev-theme") as Theme | null;
  return t || "Royal Gold";
}
function ThemeTokens(theme: Theme) {
  // Keep it simple: return a palette used by styles.
  const base = {
    text: "#F9FAFB",
    muted: "#9CA3AF",
    bg: "#050816",
    panel: "rgba(11,16,32,0.60)",
    panel2: "rgba(11,16,32,0.85)",
    border: "rgba(255,255,255,0.10)",
    soft: "rgba(255,255,255,0.04)",
    inputBg: "rgba(255,255,255,0.06)",
    dangerBg: "rgba(248,113,113,0.10)",
    dangerBd: "rgba(248,113,113,0.30)",
    dangerTx: "#FCA5A5",
  };

  switch (theme) {
    case "Midnight Purple":
      return {
        ...base,
        glow1: "rgba(139,92,246,0.22)",
        glow2: "rgba(212,175,55,0.14)",
        accentBg: "rgba(139,92,246,0.16)",
        accentBd: "rgba(139,92,246,0.30)",
        accentTx: "#DDD6FE",
      };
    case "Emerald Night":
      return {
        ...base,
        glow1: "rgba(16,185,129,0.18)",
        glow2: "rgba(212,175,55,0.12)",
        accentBg: "rgba(16,185,129,0.16)",
        accentBd: "rgba(16,185,129,0.30)",
        accentTx: "#A7F3D0",
      };
    case "Ocean Blue":
      return {
        ...base,
        glow1: "rgba(59,130,246,0.22)",
        glow2: "rgba(34,211,238,0.14)",
        accentBg: "rgba(59,130,246,0.16)",
        accentBd: "rgba(59,130,246,0.30)",
        accentTx: "#BFDBFE",
      };
    case "Ruby Noir":
      return {
        ...base,
        glow1: "rgba(244,63,94,0.18)",
        glow2: "rgba(212,175,55,0.10)",
        accentBg: "rgba(244,63,94,0.14)",
        accentBd: "rgba(244,63,94,0.26)",
        accentTx: "#FDA4AF",
      };
    case "Carbon Black":
      return {
        ...base,
        bg: "#03040A",
        glow1: "rgba(255,255,255,0.10)",
        glow2: "rgba(212,175,55,0.10)",
        accentBg: "rgba(212,175,55,0.14)",
        accentBd: "rgba(212,175,55,0.28)",
        accentTx: "#FDE68A",
      };
    case "Ivory Light":
      return {
        ...base,
        text: "#111827",
        muted: "#4B5563",
        bg: "#F9FAFB",
        panel: "rgba(255,255,255,0.78)",
        panel2: "rgba(255,255,255,0.92)",
        border: "rgba(17,24,39,0.12)",
        soft: "rgba(17,24,39,0.04)",
        inputBg: "rgba(17,24,39,0.04)",
        dangerBg: "rgba(248,113,113,0.10)",
        dangerBd: "rgba(248,113,113,0.30)",
        dangerTx: "#B91C1C",
        glow1: "rgba(212,175,55,0.16)",
        glow2: "rgba(59,130,246,0.14)",
        accentBg: "rgba(212,175,55,0.16)",
        accentBd: "rgba(212,175,55,0.28)",
        accentTx: "#92400E",
      };
    case "Royal Gold":
    default:
      return {
        ...base,
        glow1: "rgba(255,215,110,0.18)",
        glow2: "rgba(120,70,255,0.18)",
        accentBg: "rgba(212,175,55,0.12)",
        accentBd: "rgba(212,175,55,0.22)",
        accentTx: "#FDE68A",
      };
  }
}

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
type NavItem = { label: string; href: string; icon: string };
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

  // get user email from Supabase session
  useEffect(() => {
    (async () => {
      try {
        if (!supabase) {
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
      if (typeof window !== "undefined") {
        localStorage.removeItem("eventura_email");
        document.cookie = `eventura_email=; Path=/; Max-Age=0`;
      }
      router.push("/login");
    }
  }

  /* ✅ Theme read + tokens */
  const theme = readThemeFromDom();
  const T = ThemeTokens(theme);

  const S = makeStyles(T);

  return (
    <div style={S.app}>
      <aside style={{ ...S.sidebar, width: sidebarIconsOnly ? 76 : 260 }}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          {!sidebarIconsOnly ? (
            <div>
              <div style={S.brandName}>Eventura OS</div>
              <div style={S.brandSub}>{theme}</div>
            </div>
          ) : null}
        </div>

        <nav style={S.nav}>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} style={S.navItem as any}>
              <span style={S.navIcon}>{item.icon}</span>
              {!sidebarIconsOnly ? <span style={S.navLabel}>{item.label}</span> : null}
            </Link>
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
              <div style={S.kpiMiniValue}>{theme}</div>
            </div>
          </div>
        </div>

        <div style={S.grid}>
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
              S={S}
            />
          </section>

          <section style={S.panel}>
            {isCEO ? (
              <>
                <div style={S.panelTitle}>CEO Control Center</div>

                <div style={S.kpiRow}>
                  <KPI label="All Tasks" value={tasks.length} S={S} />
                  <KPI label="Staff Tasks" value={staffTasks.length} S={S} />
                  <KPI label="CEO Tasks" value={ceoTasks.length} S={S} />
                </div>

                <div style={S.sectionTitle}>Next Modules</div>
                <div style={S.quickGrid}>
                  <QuickCard title="Events" text="Pipeline + calendar + statuses" href="/events" S={S} />
                  <QuickCard title="Finance" text="Income/Expense + AI insights" href="/finance" S={S} />
                  <QuickCard title="Vendors" text="Preferred vendors + pricing" href="/vendors" S={S} />
                  <QuickCard title="HR" text="Team + workload + KPI" href="/hr" S={S} />
                </div>

                <div style={S.noteBox}>
                  Themes now apply ✅ (switch theme in Settings and come back here)
                </div>
              </>
            ) : (
              <>
                <div style={S.panelTitle}>Staff Workspace</div>

                <div style={S.kpiRow}>
                  <KPI label="My Tasks" value={myTasks.length} S={S} />
                  <KPI label="Completed" value={myTasks.filter((t) => t.status === "Complete").length} S={S} />
                  <KPI label="In progress" value={myTasks.filter((t) => t.status === "In progress").length} S={S} />
                </div>

                <div style={S.noteBox}>Update your task status. Use Events tab to see events.</div>
              </>
            )}
          </section>
        </div>

        {loading ? <div style={S.loadingBar}>Loading session…</div> : null}
      </main>
    </div>
  );
}

/* ================= COMPONENTS ================= */
function TaskList({
  tasks,
  showAssigned,
  onUpdate,
  onDelete,
  S,
}: {
  tasks: TaskItem[];
  showAssigned: boolean;
  onUpdate: (id: string, patch: Partial<TaskItem>) => void;
  onDelete: (id: string) => void;
  S: Record<string, React.CSSProperties>;
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

function KPI({
  label,
  value,
  S,
}: {
  label: string;
  value: number;
  S: Record<string, React.CSSProperties>;
}) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
    </div>
  );
}

function QuickCard({
  title,
  text,
  href,
  S,
}: {
  title: string;
  text: string;
  href: string;
  S: Record<string, React.CSSProperties>;
}) {
  return (
    <Link href={href} style={S.quickCard as any}>
      <div style={{ fontWeight: 950 }}>{title}</div>
      <div style={S.smallMuted}>{text}</div>
    </Link>
  );
}

/* ================= STYLES BUILDER ================= */
function makeStyles(T: ReturnType<typeof ThemeTokens>): Record<string, React.CSSProperties> {
  return {
    app: {
      minHeight: "100vh",
      display: "flex",
      background: `radial-gradient(1200px 800px at 20% 10%, ${T.glow1}, transparent 60%),
                   radial-gradient(900px 700px at 80% 20%, ${T.glow2}, transparent 55%),
                   ${T.bg}`,
      color: T.text,
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
    },

    sidebar: {
      position: "sticky",
      top: 0,
      height: "100vh",
      padding: 12,
      borderRight: `1px solid ${T.border}`,
      background: T.panel2,
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
      background: `linear-gradient(135deg, ${T.accentBg}, rgba(255,255,255,0.06))`,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
    },
    brandName: { fontWeight: 950, lineHeight: 1.1 },
    brandSub: { color: T.muted, fontSize: 12, marginTop: 2 },

    nav: { display: "grid", gap: 8 },
    navItem: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 10px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.border}`,
      background: T.soft,
      transition: "transform 120ms ease, background 120ms ease, border 120ms ease",
    },
    navIcon: { fontSize: 18, width: 22, textAlign: "center" },
    navLabel: { fontWeight: 900, fontSize: 13 },

    sidebarFooter: { marginTop: "auto", display: "grid", gap: 10 },
    userBox: {
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.soft,
    },
    userLabel: { fontSize: 12, color: T.muted, fontWeight: 900 },
    userEmail: { fontSize: 13, fontWeight: 900, marginTop: 6, wordBreak: "break-word" },
    roleBadge: {
      marginTop: 10,
      display: "inline-flex",
      alignItems: "center",
      padding: "5px 10px",
      borderRadius: 999,
      background: T.accentBg,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
      fontWeight: 950,
      width: "fit-content",
    },
    roleBadgeSmall: {
      display: "inline-flex",
      justifyContent: "center",
      padding: "6px 8px",
      borderRadius: 999,
      background: T.accentBg,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
      fontWeight: 950,
    },
    signOutBtn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.dangerBd}`,
      background: T.dangerBg,
      color: T.dangerTx,
      fontWeight: 950,
      cursor: "pointer",
    },

    main: { flex: 1, padding: 16, maxWidth: 1300, margin: "0 auto", width: "100%" },
    header: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      padding: 12,
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel,
      backdropFilter: "blur(10px)",
    },
    headerRight: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
    h1: { fontSize: 26, fontWeight: 950 },
    muted: { color: T.muted, fontSize: 13, marginTop: 6 },

    rolePill: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontWeight: 950,
      background: T.accentBg,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
    },

    kpiMini: {
      minWidth: 120,
      padding: 10,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.soft,
    },
    kpiMiniLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiMiniValue: { marginTop: 6, fontWeight: 950 },

    grid: { marginTop: 12, display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 },
    panel: {
      padding: 14,
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel,
      backdropFilter: "blur(10px)",
    },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    addBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.accentBd}`,
      background: T.soft,
      display: "grid",
      gap: 10,
    },

    input: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
    },
    textarea: {
      width: "100%",
      minHeight: 70,
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
      resize: "vertical",
    },

    rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
    inline: { display: "flex", alignItems: "center", gap: 10 },
    smallMuted: { color: T.muted, fontSize: 12 },
    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35 },

    select: {
      padding: "8px 10px",
      borderRadius: 12,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontWeight: 900,
    },
    option: { backgroundColor: "#0B1020", color: "#F9FAFB" },

    primaryBtnSmall: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.accentBd}`,
      background: `linear-gradient(135deg, ${T.accentBg}, rgba(255,255,255,0.06))`,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
    },

    taskCard: {
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.soft,
    },
    taskNote: { marginTop: 8, color: T.muted, fontSize: 13, lineHeight: 1.35 },
    assignedPill: {
      fontSize: 12,
      padding: "5px 10px",
      borderRadius: 999,
      background: T.accentBg,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
      fontWeight: 950,
    },
    dltBtn: {
      fontSize: 12,
      padding: "7px 10px",
      borderRadius: 12,
      border: `1px solid ${T.dangerBd}`,
      background: T.dangerBg,
      color: T.dangerTx,
      fontWeight: 950,
      cursor: "pointer",
    },

    kpiRow: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
    kpi: {
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.soft,
    },
    kpiLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiValue: { marginTop: 6, fontSize: 22, fontWeight: 950 },

    sectionTitle: { marginTop: 14, fontWeight: 950, fontSize: 13, color: T.text },
    quickGrid: { marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    quickCard: {
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      textDecoration: "none",
    },
    noteBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.accentBd}`,
      background: T.accentBg,
      color: T.text,
      fontSize: 13,
      lineHeight: 1.35,
    },

    loadingBar: {
      marginTop: 12,
      padding: 10,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.muted,
      fontSize: 12,
    },
  };
}
