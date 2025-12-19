"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/* ================= SUPABASE (safe) ================= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/* ================= STORAGE KEYS (DO NOT break other pages) ================= */
const LS_SETTINGS = "eventura_os_settings_v3";

// HR page will READ from any of these keys (first found), but will SAVE to the new key:
const HR_READ_KEYS = ["eventura-hr-team", "eventura_os_hr_team_v2", "eventura_os_hr_v1", "eventura_hr_v1", "eventura-hr"];
const HR_SAVE_KEY = "eventura_os_hr_team_v3"; // new safe key

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

/* ================= SETTINGS ================= */
type Role = "CEO" | "Staff";
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
  reducedMotion?: boolean;
  highContrast?: boolean;
};

const SETTINGS_DEFAULTS: AppSettings = {
  ceoEmail: "hardikvekariya799@gmail.com",
  staffEmail: "eventurastaff@gmail.com",
  theme: "Royal Gold",
  sidebarMode: "Icons + Text",
  compactTables: false,
  confirmDeletes: true,
  reducedMotion: false,
  highContrast: false,
};

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
function roleFromSettings(email: string, s: AppSettings): Role {
  if (!email) return "Staff";
  return email.toLowerCase() === s.ceoEmail.toLowerCase() ? "CEO" : "Staff";
}
function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function exportCSV(filename: string, rows: Record<string, any>[]) {
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function exportJSON(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/* ================= HR TYPES ================= */
type StaffStatus = "Core" | "Freelancer" | "Trainee" | "Inactive";
type StaffRole =
  | "Event Manager"
  | "Decor Specialist"
  | "Logistics"
  | "Marketing"
  | "Sales"
  | "Accountant"
  | "Operations"
  | "Other";

type TeamMember = {
  id: string;
  name: string;
  role: StaffRole;
  city: string;
  status: StaffStatus;
  workload: number; // 0-100
  monthlySalary: number; // 0 if freelancer
  eventsThisMonth: number;
  rating: number; // 0-5
  skills: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type AuditLogItem = {
  id: string;
  at: string;
  by: string;
  action: "ADD" | "EDIT" | "DELETE" | "BULK";
  target: string;
  detail?: string;
};

/* ================= READ old keys safely ================= */
function loadFirstKey<T>(keys: string[], fallback: T): { keyUsed: string | null; data: T } {
  if (typeof window === "undefined") return { keyUsed: null, data: fallback };
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as T;
      return { keyUsed: k, data: parsed };
    } catch {
      // keep trying
    }
  }
  return { keyUsed: null, data: fallback };
}
function normalizeHR(raw: any): TeamMember[] {
  const arr = Array.isArray(raw) ? raw : [];
  const now = new Date().toISOString();
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? uid());
      const name = String(x?.name ?? x?.fullName ?? "Unknown").trim() || "Unknown";
      const role = (String(x?.role ?? "Other") as StaffRole) || "Other";
      const city = String(x?.city ?? "").trim();
      const status = (String(x?.status ?? "Core") as StaffStatus) || "Core";
      const workload = Number.isFinite(Number(x?.workload)) ? clamp(Number(x.workload), 0, 100) : 0;
      const monthlySalary = Number.isFinite(Number(x?.monthlySalary)) ? Math.max(0, Number(x.monthlySalary)) : 0;
      const eventsThisMonth = Number.isFinite(Number(x?.eventsThisMonth)) ? Math.max(0, Number(x.eventsThisMonth)) : 0;
      const rating = Number.isFinite(Number(x?.rating)) ? clamp(Number(x.rating), 0, 5) : 0;
      const skills = Array.isArray(x?.skills) ? x.skills.map((s: any) => String(s)).filter(Boolean) : [];
      const notes = x?.notes ? String(x.notes) : x?.note ? String(x.note) : "";
      const createdAt = String(x?.createdAt ?? now);
      const updatedAt = String(x?.updatedAt ?? now);

      return {
        id,
        name,
        role,
        city,
        status,
        workload,
        monthlySalary,
        eventsThisMonth,
        rating,
        skills,
        notes: notes || undefined,
        createdAt,
        updatedAt,
      };
    })
    .filter((m) => m.name);
}

/* ================= AI (local, safe) =================
   "AI" = smart rules + scoring. No external API => no deploy risk.
*/
function perfScore(m: TeamMember) {
  // 0-100 score based on rating, workload balance, and activity
  const ratingPart = (m.rating / 5) * 55; // up to 55
  const workloadIdeal = 65; // ideal workload
  const workloadPenalty = Math.abs(m.workload - workloadIdeal) * 0.35; // penalty up to ~22
  const activityPart = clamp(m.eventsThisMonth * 4, 0, 20); // up to 20
  const statusAdj = m.status === "Inactive" ? -25 : m.status === "Trainee" ? -5 : 0;
  return clamp(Math.round(ratingPart + activityPart - workloadPenalty + statusAdj), 0, 100);
}
function buildAIInsights(team: TeamMember[]) {
  const insights: { title: string; level: "OK" | "WARN" | "RISK"; detail: string }[] = [];
  if (!team.length) {
    insights.push({ title: "No HR data yet", level: "WARN", detail: "Add at least one team member to get insights." });
    return insights;
  }

  const active = team.filter((m) => m.status !== "Inactive");
  const overloaded = active.filter((m) => m.workload >= 80);
  const underused = active.filter((m) => m.workload <= 25);
  const lowRating = active.filter((m) => m.rating > 0 && m.rating < 3);

  if (overloaded.length) {
    insights.push({
      title: "High workload risk",
      level: "RISK",
      detail: `${overloaded.length} people are at ≥80% workload. Consider redistributing tasks or adding freelancers.`,
    });
  } else {
    insights.push({ title: "Workload looks stable", level: "OK", detail: "No staff above 80% workload in active team." });
  }

  if (underused.length) {
    insights.push({
      title: "Unused capacity",
      level: "WARN",
      detail: `${underused.length} people are at ≤25% workload. Assign more tasks or move them to support other teams.`,
    });
  }

  if (lowRating.length) {
    insights.push({
      title: "Performance coaching needed",
      level: "WARN",
      detail: `${lowRating.length} people have rating below 3.0. Plan coaching, training or role-fit changes.`,
    });
  }

  // skill gaps (very useful for Eventura)
  const mustHaveSkills = ["Client Handling", "Vendor Negotiation", "Budgeting", "Timeline Planning", "Decor Design", "Logistics"];
  const skillCounts = new Map<string, number>();
  for (const m of active) for (const s of m.skills) skillCounts.set(s, (skillCounts.get(s) ?? 0) + 1);

  const gaps = mustHaveSkills
    .map((s) => ({ s, c: skillCounts.get(s) ?? 0 }))
    .sort((a, b) => a.c - b.c)
    .slice(0, 3);

  insights.push({
    title: "Top skill gaps",
    level: gaps[0]?.c === 0 ? "RISK" : "WARN",
    detail: gaps.map((g) => `${g.s} (${g.c})`).join(" • "),
  });

  // payroll guidance
  const payroll = active
    .filter((m) => m.status === "Core" || m.status === "Trainee")
    .reduce((a, b) => a + (Number.isFinite(b.monthlySalary) ? b.monthlySalary : 0), 0);

  insights.push({
    title: "Payroll snapshot",
    level: "OK",
    detail: payroll > 0 ? `Estimated monthly payroll: ₹${payroll.toLocaleString("en-IN")}` : "Payroll is ₹0 (check salary fields).",
  });

  return insights;
}

/* ================= PAGE ================= */
export default function HRPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings>(SETTINGS_DEFAULTS);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [keyInfo, setKeyInfo] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditLogItem[]>([]);
  const [msg, setMsg] = useState("");

  const [team, setTeam] = useState<TeamMember[]>([]);

  // UI states
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [cityFilter, setCityFilter] = useState<string>("All");
  const [skillFilter, setSkillFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"Updated" | "Name" | "Workload" | "Rating" | "Score">("Updated");

  const [openEditor, setOpenEditor] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // editor fields
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("Event Manager");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<StaffStatus>("Core");
  const [workload, setWorkload] = useState<number>(50);
  const [monthlySalary, setMonthlySalary] = useState<number>(0);
  const [eventsThisMonth, setEventsThisMonth] = useState<number>(0);
  const [rating, setRating] = useState<number>(4);
  const [skillsText, setSkillsText] = useState<string>(""); // comma separated
  const [notes, setNotes] = useState<string>("");

  // load settings + hr data
  useEffect(() => {
    const s = safeLoad<AppSettings>(LS_SETTINGS, SETTINGS_DEFAULTS);
    setSettings({ ...SETTINGS_DEFAULTS, ...s });

    const fromSaveKey = safeLoad<TeamMember[] | null>(HR_SAVE_KEY, null);
    if (fromSaveKey && Array.isArray(fromSaveKey)) {
      setKeyInfo(HR_SAVE_KEY);
      setTeam(normalizeHR(fromSaveKey));
    } else {
      const loaded = loadFirstKey<any[]>(HR_READ_KEYS, []);
      setKeyInfo(loaded.keyUsed);
      setTeam(normalizeHR(loaded.data));
    }

    setAudit(safeLoad<AuditLogItem[]>("eventura_os_hr_audit_v1", []));
  }, []);

  // session email
  useEffect(() => {
    (async () => {
      try {
        if (!supabase) {
          setEmail(safeLoad<string>("eventura_email", ""));
          return;
        }
        const { data } = await supabase.auth.getSession();
        setEmail(data.session?.user?.email || "");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const roleUser = useMemo(() => roleFromSettings(email, settings), [email, settings]);
  const isCEO = roleUser === "CEO";
  const sidebarIconsOnly = settings.sidebarMode === "Icons Only";

  const T = ThemeTokens(settings.theme, settings.highContrast);
  const S = makeStyles(T, settings);

  // persist team (always to new key)
  useEffect(() => {
    safeSave(HR_SAVE_KEY, team);
  }, [team]);

  useEffect(() => {
    safeSave("eventura_os_hr_audit_v1", audit);
  }, [audit]);

  const cities = useMemo(() => {
    const s = new Set<string>();
    for (const m of team) if (m.city) s.add(m.city);
    return ["All", ...Array.from(s).sort()];
  }, [team]);

  const roles = useMemo(() => {
    const s = new Set<string>();
    for (const m of team) if (m.role) s.add(m.role);
    return ["All", ...Array.from(s).sort()];
  }, [team]);

  const skills = useMemo(() => {
    const s = new Set<string>();
    for (const m of team) for (const sk of m.skills || []) s.add(sk);
    return ["All", ...Array.from(s).sort()];
  }, [team]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = team.slice();

    if (needle) {
      rows = rows.filter((m) => {
        const hay = `${m.name} ${m.role} ${m.city} ${m.status} ${(m.skills || []).join(" ")} ${m.notes || ""}`.toLowerCase();
        return hay.includes(needle);
      });
    }
    if (roleFilter !== "All") rows = rows.filter((m) => m.role === roleFilter);
    if (statusFilter !== "All") rows = rows.filter((m) => m.status === statusFilter);
    if (cityFilter !== "All") rows = rows.filter((m) => m.city === cityFilter);
    if (skillFilter !== "All") rows = rows.filter((m) => (m.skills || []).includes(skillFilter));

    rows.sort((a, b) => {
      if (sortBy === "Name") return a.name.localeCompare(b.name);
      if (sortBy === "Workload") return (b.workload ?? 0) - (a.workload ?? 0);
      if (sortBy === "Rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === "Score") return perfScore(b) - perfScore(a);
      // Updated
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });

    return rows;
  }, [team, q, roleFilter, statusFilter, cityFilter, skillFilter, sortBy]);

  const kpis = useMemo(() => {
    const total = team.length;
    const active = team.filter((m) => m.status !== "Inactive").length;
    const avgWorkload = total ? Math.round((team.reduce((a, b) => a + (b.workload || 0), 0) / total) * 10) / 10 : 0;
    const avgRating = total ? Math.round((team.reduce((a, b) => a + (b.rating || 0), 0) / total) * 10) / 10 : 0;

    const payroll = team
      .filter((m) => m.status === "Core" || m.status === "Trainee")
      .reduce((a, b) => a + (Number.isFinite(b.monthlySalary) ? b.monthlySalary : 0), 0);

    const overloaded = team.filter((m) => m.status !== "Inactive" && (m.workload ?? 0) >= 80).length;
    const underused = team.filter((m) => m.status !== "Inactive" && (m.workload ?? 0) <= 25).length;

    return {
      total,
      active,
      avgWorkload,
      avgRating,
      payroll,
      payrollYear: payroll * 12,
      overloaded,
      underused,
    };
  }, [team]);

  const aiInsights = useMemo(() => buildAIInsights(team), [team]);

  function log(action: AuditLogItem["action"], target: string, detail?: string) {
    const item: AuditLogItem = {
      id: uid(),
      at: new Date().toISOString(),
      by: email || "Unknown",
      action,
      target,
      detail,
    };
    setAudit((prev) => [item, ...prev].slice(0, 200));
  }

  function resetEditor() {
    setEditId(null);
    setName("");
    setRole("Event Manager");
    setCity("");
    setStatus("Core");
    setWorkload(50);
    setMonthlySalary(0);
    setEventsThisMonth(0);
    setRating(4);
    setSkillsText("");
    setNotes("");
  }

  function openAdd() {
    if (!isCEO) return setMsg("❌ Only CEO can add/edit HR.");
    resetEditor();
    setOpenEditor(true);
    setMsg("");
  }

  function openEdit(m: TeamMember) {
    if (!isCEO) return setMsg("❌ Only CEO can add/edit HR.");
    setEditId(m.id);
    setName(m.name);
    setRole(m.role);
    setCity(m.city);
    setStatus(m.status);
    setWorkload(m.workload);
    setMonthlySalary(m.monthlySalary);
    setEventsThisMonth(m.eventsThisMonth);
    setRating(m.rating);
    setSkillsText((m.skills || []).join(", "));
    setNotes(m.notes || "");
    setOpenEditor(true);
    setMsg("");
  }

  function saveMember() {
    if (!isCEO) return setMsg("❌ Only CEO can add/edit HR.");
    const n = name.trim();
    if (!n) return setMsg("❌ Name required");
    const now = new Date().toISOString();
    const skills = skillsText
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const item: TeamMember = {
      id: editId || uid(),
      name: n,
      role,
      city: city.trim(),
      status,
      workload: clamp(Number(workload) || 0, 0, 100),
      monthlySalary: Math.max(0, Number(monthlySalary) || 0),
      eventsThisMonth: Math.max(0, Number(eventsThisMonth) || 0),
      rating: clamp(Number(rating) || 0, 0, 5),
      skills,
      notes: notes.trim() || undefined,
      createdAt: editId ? (team.find((x) => x.id === editId)?.createdAt || now) : now,
      updatedAt: now,
    };

    setTeam((prev) => {
      const exists = prev.some((x) => x.id === item.id);
      const next = exists ? prev.map((x) => (x.id === item.id ? item : x)) : [item, ...prev];
      return next;
    });

    log(editId ? "EDIT" : "ADD", item.name, `role=${item.role}, status=${item.status}, workload=${item.workload}`);
    setMsg(editId ? "✅ Updated member" : "✅ Added member");
    setOpenEditor(false);
    resetEditor();
  }

  function deleteMember(id: string) {
    if (!isCEO) return setMsg("❌ Only CEO can delete HR.");
    const m = team.find((x) => x.id === id);
    if (!m) return;
    if (settings.confirmDeletes && !confirm(`Delete ${m.name}?`)) return;

    setTeam((prev) => prev.filter((x) => x.id !== id));
    log("DELETE", m.name);
    setMsg("✅ Deleted");
  }

  function exportHR() {
    const rows = team.map((m) => ({
      name: m.name,
      role: m.role,
      status: m.status,
      city: m.city,
      workload: m.workload,
      monthlySalary: m.monthlySalary,
      eventsThisMonth: m.eventsThisMonth,
      rating: m.rating,
      score: perfScore(m),
      skills: (m.skills || []).join("; "),
      updatedAt: m.updatedAt,
    }));
    exportCSV(`eventura_hr_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  function exportHRJSON() {
    exportJSON(`eventura_hr_${new Date().toISOString().slice(0, 10)}.json`, {
      version: "eventura-hr-export-v1",
      exportedAt: new Date().toISOString(),
      keyUsed: keyInfo,
      savedKey: HR_SAVE_KEY,
      team,
      audit,
    });
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

  return (
    <div style={S.app}>
      <aside style={{ ...S.sidebar, width: sidebarIconsOnly ? 76 : 280 }}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          {!sidebarIconsOnly ? (
            <div>
              <div style={S.brandName}>Eventura OS</div>
              <div style={S.brandSub}>HR • Advanced</div>
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
              <div style={S.roleBadge}>{roleUser}</div>
            </div>
          ) : (
            <div style={S.roleBadgeSmall}>{roleUser}</div>
          )}

          <button style={S.signOutBtn} onClick={signOut}>
            {sidebarIconsOnly ? "⎋" : "Sign Out"}
          </button>
        </div>
      </aside>

      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={S.h1}>HR Control Center</div>
            <div style={S.muted}>
              Smart HR • Skills • Capacity • Payroll • Auto “AI” insights • Logged in as <b>{email || "Unknown"}</b>
              <span style={S.rolePill}>{roleUser}</span>
            </div>
            <div style={{ marginTop: 8, ...S.smallMuted }}>
              Read key: <b>{keyInfo ?? "not found"}</b> • Save key: <b>{HR_SAVE_KEY}</b>
            </div>
          </div>

          <div style={S.headerRight}>
            {isCEO ? (
              <button style={S.primaryBtn} onClick={openAdd}>
                + Add Member
              </button>
            ) : null}
            <button style={S.secondaryBtn} onClick={exportHR}>
              Export CSV
            </button>
            <button style={S.secondaryBtn} onClick={exportHRJSON}>
              Export JSON
            </button>
          </div>
        </div>

        {loading ? <div style={S.loadingBar}>Loading session…</div> : null}
        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* KPIs */}
        <div style={S.grid2}>
          <section style={S.panel}>
            <div style={S.panelTitle}>HR KPIs</div>
            <div style={S.kpiRow}>
              <KPI label="Team" value={String(kpis.total)} S={S} />
              <KPI label="Active" value={String(kpis.active)} S={S} />
              <KPI label="Avg Workload" value={`${kpis.avgWorkload}%`} S={S} />
              <KPI label="Avg Rating" value={String(kpis.avgRating)} S={S} />
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={S.noteBox}>
                Payroll Est.: <b>₹{kpis.payroll.toLocaleString("en-IN")}</b> / month •{" "}
                <b>₹{kpis.payrollYear.toLocaleString("en-IN")}</b> / year
              </div>
              <div style={S.rowBetween}>
                <div style={S.smallMuted}>Overloaded (≥80%)</div>
                <div style={S.pill}>{kpis.overloaded}</div>
              </div>
              <div style={S.rowBetween}>
                <div style={S.smallMuted}>Underused (≤25%)</div>
                <div style={S.pill}>{kpis.underused}</div>
              </div>
            </div>
          </section>

          <section style={S.panel}>
            <div style={S.panelTitle}>Auto AI Insights (Local)</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {aiInsights.map((x, idx) => (
                <div key={idx} style={S.aiCard}>
                  <div style={S.rowBetween}>
                    <div style={{ fontWeight: 950 }}>{x.title}</div>
                    <span
                      style={{
                        ...S.aiBadge,
                        ...(x.level === "OK" ? S.aiOK : x.level === "WARN" ? S.aiWARN : S.aiRISK),
                      }}
                    >
                      {x.level}
                    </span>
                  </div>
                  <div style={S.smallMuted}>{x.detail}</div>
                </div>
              ))}
            </div>
            <div style={S.smallNote}>
              This “AI” is rule-based so deployment is safe (no API keys, no external calls).
            </div>
          </section>
        </div>

        {/* Filters */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Team Directory</div>

          <div style={S.filters}>
            <input style={{ ...S.input, width: 260 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, skill, notes…" />
            <select style={S.select} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              {roles.map((x) => (
                <option key={x} value={x} style={S.option}>
                  {x === "All" ? "All Roles" : x}
                </option>
              ))}
            </select>
            <select style={S.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {["All", "Core", "Freelancer", "Trainee", "Inactive"].map((x) => (
                <option key={x} value={x} style={S.option}>
                  {x === "All" ? "All Status" : x}
                </option>
              ))}
            </select>
            <select style={S.select} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              {cities.map((x) => (
                <option key={x} value={x} style={S.option}>
                  {x === "All" ? "All Cities" : x}
                </option>
              ))}
            </select>
            <select style={S.select} value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}>
              {skills.map((x) => (
                <option key={x} value={x} style={S.option}>
                  {x === "All" ? "All Skills" : x}
                </option>
              ))}
            </select>
            <select style={S.select} value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              {["Updated", "Name", "Workload", "Rating", "Score"].map((x) => (
                <option key={x} value={x} style={S.option}>
                  Sort: {x}
                </option>
              ))}
            </select>
          </div>

          {!filtered.length ? (
            <div style={S.empty}>No team members found.</div>
          ) : (
            <div style={S.tableWrap}>
              <div style={S.tableHead}>
                <div>Name</div>
                <div>Role</div>
                <div>Status</div>
                <div>City</div>
                <div>Workload</div>
                <div>Rating</div>
                <div>Score</div>
                <div>Actions</div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {filtered.map((m) => (
                  <div key={m.id} style={S.tableRow}>
                    <div>
                      <div style={{ fontWeight: 950 }}>{m.name}</div>
                      <div style={S.smallMuted}>
                        {m.skills?.length ? m.skills.slice(0, 5).join(" • ") : "—"}
                        {m.skills.length > 5 ? " • …" : ""}
                      </div>
                    </div>
                    <div style={S.muted}>{m.role}</div>
                    <div>
                      <span style={S.pill}>{m.status}</span>
                    </div>
                    <div style={S.muted}>{m.city || "—"}</div>
                    <div>
                      <div style={S.muted}>{m.workload}%</div>
                      <div style={S.miniBarWrap}>
                        <div style={{ ...S.miniBarFill, width: `${clamp(m.workload, 0, 100)}%` }} />
                      </div>
                    </div>
                    <div style={S.muted}>{m.rating.toFixed(1)}</div>
                    <div>
                      <span style={S.scorePill}>{perfScore(m)}</span>
                    </div>
                    <div style={S.row}>
                      <button style={S.ghostBtn} onClick={() => openEdit(m)} disabled={!isCEO} title={!isCEO ? "CEO only" : ""}>
                        Edit
                      </button>
                      <button style={S.dangerBtn} onClick={() => deleteMember(m.id)} disabled={!isCEO} title={!isCEO ? "CEO only" : ""}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Audit log */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Audit Log (Last 200)</div>
          {!audit.length ? (
            <div style={S.empty}>No changes logged yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {audit.slice(0, 12).map((a) => (
                <div key={a.id} style={S.auditRow}>
                  <div style={{ fontWeight: 950 }}>{a.action}</div>
                  <div style={S.muted}>{a.target}</div>
                  <div style={S.smallMuted}>{new Date(a.at).toLocaleString()}</div>
                  <div style={S.smallMuted}>{a.by}</div>
                </div>
              ))}
              {audit.length > 12 ? <div style={S.smallMuted}>… and {audit.length - 12} more</div> : null}
            </div>
          )}
        </section>

        {/* Editor Modal */}
        {openEditor ? (
          <div style={S.modalOverlay} onClick={() => setOpenEditor(false)}>
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
              <div style={S.rowBetween}>
                <div style={{ fontWeight: 950, fontSize: 16 }}>{editId ? "Edit Team Member" : "Add Team Member"}</div>
                <button style={S.ghostBtn} onClick={() => setOpenEditor(false)}>
                  Close
                </button>
              </div>

              <div style={S.formGrid}>
                <Field label="Name">
                  <input style={S.inputFull} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                </Field>
                <Field label="Role">
                  <select style={S.selectFull} value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
                    {["Event Manager", "Decor Specialist", "Logistics", "Marketing", "Sales", "Accountant", "Operations", "Other"].map((x) => (
                      <option key={x} value={x} style={S.option}>
                        {x}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="City">
                  <input style={S.inputFull} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Surat / Ahmedabad..." />
                </Field>
                <Field label="Status">
                  <select style={S.selectFull} value={status} onChange={(e) => setStatus(e.target.value as StaffStatus)}>
                    {["Core", "Freelancer", "Trainee", "Inactive"].map((x) => (
                      <option key={x} value={x} style={S.option}>
                        {x}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Workload (0-100)">
                  <input
                    style={S.inputFull}
                    type="number"
                    value={workload}
                    onChange={(e) => setWorkload(clamp(Number(e.target.value) || 0, 0, 100))}
                  />
                </Field>
                <Field label="Monthly Salary (₹)">
                  <input style={S.inputFull} type="number" value={monthlySalary} onChange={(e) => setMonthlySalary(Math.max(0, Number(e.target.value) || 0))} />
                </Field>
                <Field label="Events this month">
                  <input style={S.inputFull} type="number" value={eventsThisMonth} onChange={(e) => setEventsThisMonth(Math.max(0, Number(e.target.value) || 0))} />
                </Field>
                <Field label="Rating (0-5)">
                  <input style={S.inputFull} type="number" value={rating} onChange={(e) => setRating(clamp(Number(e.target.value) || 0, 0, 5))} />
                </Field>

                <Field label="Skills (comma separated)">
                  <input
                    style={S.inputFull}
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                    placeholder="Client Handling, Vendor Negotiation, Timeline Planning..."
                  />
                </Field>
                <Field label="Notes">
                  <input style={S.inputFull} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes..." />
                </Field>
              </div>

              <div style={S.rowBetween}>
                <div style={S.smallMuted}>Auto Score: {perfScore({
                  id: "x",
                  name: name || "—",
                  role,
                  city,
                  status,
                  workload: clamp(Number(workload) || 0, 0, 100),
                  monthlySalary: Math.max(0, Number(monthlySalary) || 0),
                  eventsThisMonth: Math.max(0, Number(eventsThisMonth) || 0),
                  rating: clamp(Number(rating) || 0, 0, 5),
                  skills: skillsText.split(",").map((x) => x.trim()).filter(Boolean),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  notes: notes || undefined
                })}</div>
                <button style={S.primaryBtn} onClick={saveMember}>
                  {editId ? "Save Changes" : "Add Member"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div style={S.footerNote}>✅ Advanced HR • ✅ Auto AI insights • ✅ No extra packages • ✅ Deploy safe</div>
      </main>
    </div>
  );
}

/* ================= UI ================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#A7B0C0" }}>{label}</div>
      {children}
    </div>
  );
}
function KPI({ label, value, S }: { label: string; value: string; S: Record<string, CSSProperties> }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
    </div>
  );
}

/* ================= THEME TOKENS ================= */
function ThemeTokens(theme: Theme, highContrast?: boolean) {
  const hc = !!highContrast;
  const base = {
    text: "#F9FAFB",
    muted: "#9CA3AF",
    bg: "#050816",
    panel: "rgba(11,16,32,0.60)",
    panel2: "rgba(11,16,32,0.85)",
    border: hc ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)",
    soft: hc ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
    inputBg: hc ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
    dangerBg: "rgba(248,113,113,0.10)",
    dangerBd: hc ? "rgba(248,113,113,0.55)" : "rgba(248,113,113,0.30)",
    dangerTx: "#FCA5A5",
    okBg: "rgba(34,197,94,0.12)",
    okBd: hc ? "rgba(34,197,94,0.45)" : "rgba(34,197,94,0.28)",
    okTx: "#86EFAC",
  };
  switch (theme) {
    case "Midnight Purple":
      return { ...base, glow1: "rgba(139,92,246,0.22)", glow2: "rgba(212,175,55,0.14)", accentBg: "rgba(139,92,246,0.16)", accentBd: hc ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.30)", accentTx: "#DDD6FE" };
    case "Emerald Night":
      return { ...base, glow1: "rgba(16,185,129,0.18)", glow2: "rgba(212,175,55,0.12)", accentBg: "rgba(16,185,129,0.16)", accentBd: hc ? "rgba(16,185,129,0.55)" : "rgba(16,185,129,0.30)", accentTx: "#A7F3D0" };
    case "Ocean Blue":
      return { ...base, glow1: "rgba(59,130,246,0.22)", glow2: "rgba(34,211,238,0.14)", accentBg: "rgba(59,130,246,0.16)", accentBd: hc ? "rgba(59,130,246,0.55)" : "rgba(59,130,246,0.30)", accentTx: "#BFDBFE" };
    case "Ruby Noir":
      return { ...base, glow1: "rgba(244,63,94,0.18)", glow2: "rgba(212,175,55,0.10)", accentBg: "rgba(244,63,94,0.14)", accentBd: hc ? "rgba(244,63,94,0.50)" : "rgba(244,63,94,0.26)", accentTx: "#FDA4AF" };
    case "Carbon Black":
      return { ...base, bg: "#03040A", glow1: "rgba(255,255,255,0.10)", glow2: "rgba(212,175,55,0.10)", accentBg: "rgba(212,175,55,0.14)", accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)", accentTx: "#FDE68A" };
    case "Ivory Light":
      return { ...base, text: "#111827", muted: "#4B5563", bg: "#F9FAFB", panel: "rgba(255,255,255,0.78)", panel2: "rgba(255,255,255,0.92)", border: hc ? "rgba(17,24,39,0.22)" : "rgba(17,24,39,0.12)", soft: hc ? "rgba(17,24,39,0.07)" : "rgba(17,24,39,0.04)", inputBg: hc ? "rgba(17,24,39,0.08)" : "rgba(17,24,39,0.04)", dangerTx: "#B91C1C", glow1: "rgba(212,175,55,0.16)", glow2: "rgba(59,130,246,0.14)", accentBg: "rgba(212,175,55,0.16)", accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)", accentTx: "#92400E", okTx: "#166534" };
    case "Royal Gold":
    default:
      return { ...base, glow1: "rgba(255,215,110,0.18)", glow2: "rgba(120,70,255,0.18)", accentBg: "rgba(212,175,55,0.12)", accentBd: hc ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)", accentTx: "#FDE68A" };
  }
}

/* ================= STYLES ================= */
function makeStyles(T: any, settings: AppSettings): Record<string, CSSProperties> {
  const compact = !!settings.compactTables;
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
    },
    navIcon: { fontSize: 18, width: 22, textAlign: "center" },
    navLabel: { fontWeight: 900, fontSize: 13 },

    sidebarFooter: { marginTop: "auto", display: "grid", gap: 10 },
    userBox: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    userLabel: { fontSize: 12, color: T.muted, fontWeight: 900 },
    userEmail: { fontSize: 13, fontWeight: 900, marginTop: 6, wordBreak: "break-word" },
    roleBadge: { marginTop: 10, display: "inline-flex", alignItems: "center", padding: "5px 10px", borderRadius: 999, background: T.accentBg, border: `1px solid ${T.accentBd}`, color: T.accentTx, fontWeight: 950, width: "fit-content" },
    roleBadgeSmall: { display: "inline-flex", justifyContent: "center", padding: "6px 8px", borderRadius: 999, background: T.accentBg, border: `1px solid ${T.accentBd}`, color: T.accentTx, fontWeight: 950 },

    signOutBtn: { padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.dangerBd}`, background: T.dangerBg, color: T.dangerTx, fontWeight: 950, cursor: "pointer" },

    main: { flex: 1, padding: 16, maxWidth: 1400, margin: "0 auto", width: "100%" },
    header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: 12, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    headerRight: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },

    h1: { fontSize: 26, fontWeight: 950 },
    muted: { color: T.muted, fontSize: 13, marginTop: 6 },
    smallMuted: { color: T.muted, fontSize: 12 },
    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35, marginTop: 10 },

    rolePill: { display: "inline-block", padding: "4px 10px", borderRadius: 999, fontWeight: 950, background: T.accentBg, border: `1px solid ${T.accentBd}`, color: T.accentTx, marginLeft: 6 },

    msg: { marginTop: 12, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontSize: 13 },

    panel: { marginTop: 12, padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    grid2: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

    kpiRow: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 },
    kpi: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    kpiLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiValue: { marginTop: 6, fontSize: 18, fontWeight: 950 },

    noteBox: { marginTop: 10, padding: 12, borderRadius: 16, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontSize: 13, lineHeight: 1.35 },

    filters: { marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },

    input: { width: 210, padding: compact ? "10px 10px" : "12px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, outline: "none", fontSize: 14 },
    inputFull: { width: "100%", padding: "12px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, outline: "none", fontSize: 14 },

    select: { width: 190, padding: compact ? "10px 10px" : "12px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, outline: "none", fontSize: 14, fontWeight: 900, appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
    selectFull: { width: "100%", padding: "12px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, outline: "none", fontSize: 14, fontWeight: 900, appearance: "none", WebkitAppearance: "none", MozAppearance: "none" },
    option: { backgroundColor: "#0B1020", color: "#F9FAFB" },

    row: { display: "flex", gap: 10, alignItems: "center" },
    rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },

    primaryBtn: { padding: "10px 14px", borderRadius: 14, border: `1px solid ${T.accentBd}`, background: `linear-gradient(135deg, ${T.accentBg}, rgba(255,255,255,0.06))`, color: T.text, fontWeight: 950, cursor: "pointer", whiteSpace: "nowrap" },
    secondaryBtn: { padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontWeight: 950, cursor: "pointer" },
    ghostBtn: { padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontWeight: 950, cursor: "pointer" },
    dangerBtn: { padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.dangerBd}`, background: T.dangerBg, color: T.dangerTx, fontWeight: 950, cursor: "pointer" },

    pill: { padding: "5px 10px", borderRadius: 999, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    scorePill: { padding: "5px 10px", borderRadius: 999, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },

    tableWrap: { marginTop: 12, display: "grid", gap: 8 },
    tableHead: { display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1fr 1fr 1fr 0.8fr 0.8fr 1.2fr", gap: 10, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, fontWeight: 950, color: T.muted, fontSize: 12 },
    tableRow: { display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1fr 1fr 1fr 0.8fr 0.8fr 1.2fr", gap: 10, padding: 12, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, alignItems: "center" },

    miniBarWrap: { marginTop: 6, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" },
    miniBarFill: { height: "100%", borderRadius: 999, background: T.accentTx, opacity: 0.9 },

    empty: { color: T.muted, fontSize: 13, padding: 10 },

    aiCard: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    aiBadge: { padding: "4px 10px", borderRadius: 999, fontWeight: 950, fontSize: 12, border: `1px solid ${T.border}` },
    aiOK: { background: T.okBg, color: T.okTx, border: `1px solid ${T.okBd}` },
    aiWARN: { background: "rgba(245,158,11,0.12)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.35)" },
    aiRISK: { background: T.dangerBg, color: T.dangerTx, border: `1px solid ${T.dangerBd}` },

    auditRow: { display: "grid", gridTemplateColumns: "90px 1fr 180px 1fr", gap: 10, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft },

    modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", padding: 14, zIndex: 50 },
    modal: { width: "min(920px, 96vw)", borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel2, padding: 14, display: "grid", gap: 12 },
    formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

    loadingBar: { marginTop: 12, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.muted, fontSize: 12 },

    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 6, marginTop: 10 },
  };
}
