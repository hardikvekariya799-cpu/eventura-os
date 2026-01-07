"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/* ================= SUPABASE (safe) ================= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/* ================= STORAGE KEYS (DO NOT break other pages) ================= */
const LS_SETTINGS = "eventura_os_settings_v3";
const HR_READ_KEYS = ["eventura-hr-team", "eventura_os_hr_team_v2", "eventura_os_hr_v1", "eventura_hr_v1", "eventura-hr"];
const HR_SAVE_KEY = "eventura_os_hr_team_v3";
const HR_AUDIT_KEY = "eventura_os_hr_audit_v1";
const HR_BUDGET_KEY = "eventura_os_hr_budget_v1";
const HR_REVIEWS_KEY = "eventura_os_hr_reviews_v1";

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
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function inr(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
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

type HRBudgetConfig = {
  monthlyHRBudget: number; // overall budget for HR cost
  freelancerBudget: number; // monthly freelancer/contract cost planned
  annualRaisePct: number; // yearly increments (avg)
  hiringBufferPct: number; // monthly buffer for expected hiring cost
  bonusPct: number; // monthly bonus pool % on base payroll (optional)
};

const BUDGET_DEFAULTS: HRBudgetConfig = {
  monthlyHRBudget: 250000,
  freelancerBudget: 35000,
  annualRaisePct: 12,
  hiringBufferPct: 6,
  bonusPct: 2,
};

type PerformanceReview = {
  id: string;
  memberId: string;
  memberName: string;
  period: string; // e.g., "2026-Q1"
  score: number; // 0-100
  strengths: string;
  gaps: string;
  goals: string;
  raiseSuggestionPct: number; // 0-25
  createdAt: string;
  createdBy: string;
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

/* ================= AI / PERFORMANCE (local) ================= */
const MUST_HAVE_SKILLS = ["Client Handling", "Vendor Negotiation", "Budgeting", "Timeline Planning", "Decor Design", "Logistics"];

function perfScore(m: TeamMember) {
  const ratingPart = (m.rating / 5) * 55;
  const workloadIdeal = 65;
  const workloadPenalty = Math.abs(m.workload - workloadIdeal) * 0.35;
  const activityPart = clamp(m.eventsThisMonth * 4, 0, 20);
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
      detail: `${overloaded.length} people are at ≥80% workload. Redistribute tasks or add freelancers.`,
    });
  } else {
    insights.push({ title: "Workload looks stable", level: "OK", detail: "No staff above 80% workload in active team." });
  }

  if (underused.length) {
    insights.push({
      title: "Unused capacity",
      level: "WARN",
      detail: `${underused.length} people are at ≤25% workload. Assign more tasks or move to support roles.`,
    });
  }

  if (lowRating.length) {
    insights.push({
      title: "Performance coaching needed",
      level: "WARN",
      detail: `${lowRating.length} people have rating below 3.0. Plan coaching/training.`,
    });
  }

  const skillCounts = new Map<string, number>();
  for (const m of active) for (const s of m.skills) skillCounts.set(s, (skillCounts.get(s) ?? 0) + 1);

  const gaps = MUST_HAVE_SKILLS.map((s) => ({ s, c: skillCounts.get(s) ?? 0 }))
    .sort((a, b) => a.c - b.c)
    .slice(0, 3);

  insights.push({
    title: "Top skill gaps",
    level: gaps[0]?.c === 0 ? "RISK" : "WARN",
    detail: gaps.map((g) => `${g.s} (${g.c})`).join(" • "),
  });

  return insights;
}

function normalizeSkillList(text: string) {
  return text
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function skillMatchScore(member: TeamMember, reqSkills: string[]) {
  if (!reqSkills.length) return 0;
  const set = new Set((member.skills || []).map((s) => s.toLowerCase()));
  let hit = 0;
  for (const r of reqSkills) if (set.has(r.toLowerCase())) hit++;
  return hit / reqSkills.length;
}

function suggestAssignment(
  team: TeamMember[],
  args: { reqSkills: string[]; city: string; role: string; maxWorkload: number; minRating: number; count: number }
) {
  const active = team.filter((m) => m.status !== "Inactive");
  const cityNeedle = args.city.trim().toLowerCase();
  const roleNeedle = args.role.trim();

  return active
    .filter((m) => (args.minRating ? (m.rating ?? 0) >= args.minRating : true))
    .filter((m) => (args.maxWorkload ? (m.workload ?? 0) <= args.maxWorkload : true))
    .filter((m) => (roleNeedle && roleNeedle !== "Any" ? m.role === (roleNeedle as any) : true))
    .map((m) => {
      const match = skillMatchScore(m, args.reqSkills);
      const cityBoost = cityNeedle && m.city?.toLowerCase() === cityNeedle ? 0.12 : 0;
      const workloadBonus = (100 - (m.workload ?? 0)) / 100;
      const score = perfScore(m) / 100;
      const final = match * 0.55 + score * 0.35 + workloadBonus * 0.10 + cityBoost;
      return { m, match, final };
    })
    .sort((a, b) => b.final - a.final)
    .slice(0, Math.max(1, args.count));
}

function buildTrainingPlan(team: TeamMember[]) {
  const active = team.filter((m) => m.status !== "Inactive");
  const plan: { person: string; focus: string[]; reason: string }[] = [];

  for (const m of active) {
    const missing = MUST_HAVE_SKILLS.filter((s) => !(m.skills || []).some((x) => x.toLowerCase() === s.toLowerCase()));
    const focus: string[] = [];
    if (m.rating > 0 && m.rating < 3) focus.push("Performance coaching + checklist SOP");
    if (m.workload >= 80) focus.push("Time management + delegation");
    if (missing.length) focus.push(...missing.slice(0, 3).map((x) => `Skill: ${x}`));

    if (focus.length) {
      plan.push({
        person: m.name,
        focus: Array.from(new Set(focus)).slice(0, 5),
        reason:
          (m.rating > 0 && m.rating < 3 ? "Low rating" : "") +
          (m.workload >= 80 ? (m.rating > 0 && m.rating < 3 ? ", high workload" : "High workload") : "") +
          (missing.length ? ((m.rating > 0 && m.rating < 3) || m.workload >= 80 ? ", skill gaps" : "Skill gaps") : ""),
      });
    }
  }
  plan.sort((a, b) => b.focus.length - a.focus.length);
  return plan;
}

function buildHiringPlan(team: TeamMember[]) {
  const active = team.filter((m) => m.status !== "Inactive");
  const byRole = new Map<string, TeamMember[]>();
  for (const m of active) byRole.set(m.role || "Other", [...(byRole.get(m.role || "Other") ?? []), m]);

  const needs: { role: string; priority: "Low" | "Medium" | "High"; suggestion: string; why: string }[] = [];

  for (const [role, arr] of byRole.entries()) {
    const headcount = arr.length;
    const overloadPeople = arr.filter((m) => (m.workload ?? 0) >= 80).length;
    const avgWorkload = headcount ? arr.reduce((a, b) => a + (b.workload ?? 0), 0) / headcount : 0;

    if (overloadPeople >= 2 || avgWorkload >= 75) {
      needs.push({
        role,
        priority: overloadPeople >= 3 || avgWorkload >= 82 ? "High" : "Medium",
        suggestion: `Add 1 Freelancer or 1 Junior (${role})`,
        why: `Overload: ${overloadPeople} at ≥80% • Avg ${Math.round(avgWorkload)}%`,
      });
    }
  }

  const skillCounts = new Map<string, number>();
  for (const m of active) for (const s of m.skills) skillCounts.set(s.toLowerCase(), (skillCounts.get(s.toLowerCase()) ?? 0) + 1);
  const missingSkills = MUST_HAVE_SKILLS.filter((s) => (skillCounts.get(s.toLowerCase()) ?? 0) === 0);

  if (missingSkills.length) {
    needs.push({
      role: "Other",
      priority: "High",
      suggestion: `Hire / Contract specialist for: ${missingSkills.join(", ")}`,
      why: "Zero coverage for key skills (business risk).",
    });
  }

  if (!needs.length) {
    needs.push({ role: "—", priority: "Low", suggestion: "No immediate hiring required", why: "No major overload or skill coverage risk detected." });
  }

  const pRank: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
  needs.sort((a, b) => pRank[b.priority] - pRank[a.priority]);
  return needs;
}

/* ================= SALARY / FORECAST / BUDGET / RAISES ================= */
function suggestedRaisePct(m: TeamMember) {
  const s = perfScore(m);
  if (m.status === "Inactive") return 0;
  if (m.status === "Freelancer") return 0;
  if (s >= 92 && m.rating >= 4.6) return 15;
  if (s >= 86 && m.rating >= 4.2) return 12;
  if (s >= 78 && m.rating >= 3.8) return 8;
  if (s >= 70 && m.rating >= 3.4) return 5;
  if (s >= 60 && m.rating >= 3.0) return 2;
  return 0;
}

function buildForecast(params: {
  basePayroll: number;
  freelancerBudget: number;
  hiringBufferPct: number;
  bonusPct: number;
  annualRaisePct: number;
  months: number[];
}) {
  const { basePayroll, freelancerBudget, hiringBufferPct, bonusPct, annualRaisePct, months } = params;
  const monthlyRaiseRate = (annualRaisePct / 100) / 12;
  const rows = months.map((m) => {
    const multiplier = Math.pow(1 + monthlyRaiseRate, m);
    const payroll = basePayroll * multiplier;
    const bonus = payroll * (bonusPct / 100);
    const hiringBuffer = payroll * (hiringBufferPct / 100);
    const total = payroll + freelancerBudget + bonus + hiringBuffer;
    return { monthOffset: m, payroll, freelancerBudget, bonus, hiringBuffer, total };
  });
  return rows;
}

function groupByRole(team: TeamMember[]) {
  const map = new Map<string, { headcount: number; payroll: number; avgScore: number; avgRating: number }>();
  for (const m of team) {
    if (m.status === "Inactive") continue;
    const key = m.role || "Other";
    const prev = map.get(key) ?? { headcount: 0, payroll: 0, avgScore: 0, avgRating: 0 };
    const addPayroll = m.status === "Freelancer" ? 0 : Math.max(0, m.monthlySalary || 0);
    const next = {
      headcount: prev.headcount + 1,
      payroll: prev.payroll + addPayroll,
      avgScore: prev.avgScore + perfScore(m),
      avgRating: prev.avgRating + (m.rating || 0),
    };
    map.set(key, next);
  }
  const rows = Array.from(map.entries()).map(([role, x]) => ({
    role,
    headcount: x.headcount,
    payroll: x.payroll,
    avgScore: x.headcount ? Math.round((x.avgScore / x.headcount) * 10) / 10 : 0,
    avgRating: x.headcount ? Math.round((x.avgRating / x.headcount) * 10) / 10 : 0,
  }));
  rows.sort((a, b) => b.payroll - a.payroll);
  return rows;
}

/* ================= HOVER HELPERS ================= */
function HoverNavLink({
  href,
  icon,
  label,
  active,
  iconsOnly,
  S,
  hoverKey,
  hovered,
  setHovered,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
  iconsOnly: boolean;
  S: Record<string, CSSProperties>;
  hoverKey: string;
  hovered: string | null;
  setHovered: (v: string | null) => void;
}) {
  const isHover = hovered === hoverKey;
  const style = active ? S.navActive : isHover ? S.navHover : S.navItem;

  return (
    <Link href={href} style={style as any} onMouseEnter={() => setHovered(hoverKey)} onMouseLeave={() => setHovered(null)}>
      <span style={S.navIcon}>{icon}</span>
      {!iconsOnly ? <span style={S.navLabel}>{label}</span> : null}
    </Link>
  );
}

function HoverRow({
  id,
  hoveredRow,
  setHoveredRow,
  style,
  hoverStyle,
  children,
}: {
  id: string;
  hoveredRow: string | null;
  setHoveredRow: (v: string | null) => void;
  style: CSSProperties;
  hoverStyle: CSSProperties;
  children: React.ReactNode;
}) {
  const isHover = hoveredRow === id;
  return (
    <div
      style={isHover ? { ...style, ...hoverStyle } : style}
      onMouseEnter={() => setHoveredRow(id)}
      onMouseLeave={() => setHoveredRow(null)}
    >
      {children}
    </div>
  );
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
  const [budget, setBudget] = useState<HRBudgetConfig>(BUDGET_DEFAULTS);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);

  // hover states (BLACK hover)
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Directory filters
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [cityFilter, setCityFilter] = useState<string>("All");
  const [skillFilter, setSkillFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"Updated" | "Name" | "Workload" | "Rating" | "Score" | "Salary">("Updated");

  // Editor modal
  const [openEditor, setOpenEditor] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Editor fields
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("Event Manager");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<StaffStatus>("Core");
  const [workload, setWorkload] = useState<number>(50);
  const [monthlySalary, setMonthlySalary] = useState<number>(0);
  const [eventsThisMonth, setEventsThisMonth] = useState<number>(0);
  const [rating, setRating] = useState<number>(4);
  const [skillsText, setSkillsText] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // AI planner
  const [planCity, setPlanCity] = useState("");
  const [planRole, setPlanRole] = useState<string>("Any");
  const [planSkills, setPlanSkills] = useState("Client Handling, Timeline Planning");
  const [planMaxWorkload, setPlanMaxWorkload] = useState<number>(70);
  const [planMinRating, setPlanMinRating] = useState<number>(3);
  const [planCount, setPlanCount] = useState<number>(3);

  // Performance review tool (create review)
  const [rvMemberId, setRvMemberId] = useState<string>("");
  const [rvPeriod, setRvPeriod] = useState<string>(() => {
    const d = new Date();
    const q = Math.floor(d.getMonth() / 3) + 1;
    return `${d.getFullYear()}-Q${q}`;
  });
  const [rvStrengths, setRvStrengths] = useState("");
  const [rvGaps, setRvGaps] = useState("");
  const [rvGoals, setRvGoals] = useState("");

  // Load settings + HR + budget + reviews
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

    setAudit(safeLoad<AuditLogItem[]>(HR_AUDIT_KEY, []));
    setBudget({ ...BUDGET_DEFAULTS, ...safeLoad<HRBudgetConfig>(HR_BUDGET_KEY, BUDGET_DEFAULTS) });
    setReviews(safeLoad<PerformanceReview[]>(HR_REVIEWS_KEY, []));
  }, []);

  // Session email
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

  useEffect(() => safeSave(HR_SAVE_KEY, team), [team]);
  useEffect(() => safeSave(HR_AUDIT_KEY, audit), [audit]);
  useEffect(() => safeSave(HR_BUDGET_KEY, budget), [budget]);
  useEffect(() => safeSave(HR_REVIEWS_KEY, reviews), [reviews]);

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
      if (sortBy === "Salary") return (b.monthlySalary ?? 0) - (a.monthlySalary ?? 0);
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });

    return rows;
  }, [team, q, roleFilter, statusFilter, cityFilter, skillFilter, sortBy]);

  const kpis = useMemo(() => {
    const total = team.length;
    const active = team.filter((m) => m.status !== "Inactive").length;

    const basePayroll = team
      .filter((m) => m.status === "Core" || m.status === "Trainee")
      .reduce((a, b) => a + (Number.isFinite(b.monthlySalary) ? Math.max(0, b.monthlySalary) : 0), 0);

    const avgWorkload = total ? Math.round((team.reduce((a, b) => a + (b.workload || 0), 0) / total) * 10) / 10 : 0;
    const avgRating = total ? Math.round((team.reduce((a, b) => a + (b.rating || 0), 0) / total) * 10) / 10 : 0;

    const overloaded = team.filter((m) => m.status !== "Inactive" && (m.workload ?? 0) >= 80).length;
    const underused = team.filter((m) => m.status !== "Inactive" && (m.workload ?? 0) <= 25).length;

    const salaryHeadcount = team.filter((m) => (m.status === "Core" || m.status === "Trainee") && (m.monthlySalary || 0) > 0).length;
    const avgSalary = salaryHeadcount ? Math.round(basePayroll / salaryHeadcount) : 0;

    return {
      total,
      active,
      avgWorkload,
      avgRating,
      basePayroll,
      avgSalary,
      payrollYear: basePayroll * 12,
      overloaded,
      underused,
    };
  }, [team]);

  const aiInsights = useMemo(() => buildAIInsights(team), [team]);
  const trainingPlan = useMemo(() => buildTrainingPlan(team), [team]);
  const hiringPlan = useMemo(() => buildHiringPlan(team), [team]);

  const assignment = useMemo(() => {
    const reqSkills = normalizeSkillList(planSkills);
    return suggestAssignment(team, {
      reqSkills,
      city: planCity,
      role: planRole,
      maxWorkload: clamp(Number(planMaxWorkload) || 0, 0, 100),
      minRating: clamp(Number(planMinRating) || 0, 0, 5),
      count: clamp(Number(planCount) || 3, 1, 10),
    });
  }, [team, planSkills, planCity, planRole, planMaxWorkload, planMinRating, planCount]);

  const roleBudgets = useMemo(() => groupByRole(team), [team]);

  const budgetSnapshot = useMemo(() => {
    const base = kpis.basePayroll;
    const bonus = base * (budget.bonusPct / 100);
    const hiringBuffer = base * (budget.hiringBufferPct / 100);
    const planned = base + bonus + hiringBuffer + budget.freelancerBudget;
    const utilization = budget.monthlyHRBudget > 0 ? (planned / budget.monthlyHRBudget) * 100 : 0;
    return { planned, utilization, bonus, hiringBuffer };
  }, [kpis.basePayroll, budget]);

  const salaryForecast = useMemo(() => {
    return buildForecast({
      basePayroll: kpis.basePayroll,
      freelancerBudget: budget.freelancerBudget,
      hiringBufferPct: budget.hiringBufferPct,
      bonusPct: budget.bonusPct,
      annualRaisePct: budget.annualRaisePct,
      months: [0, 1, 2, 3, 6, 12],
    });
  }, [kpis.basePayroll, budget]);

  const raiseEngine = useMemo(() => {
    const eligible = team.filter((m) => m.status === "Core" || m.status === "Trainee");
    const rows = eligible
      .map((m) => {
        const current = Math.max(0, m.monthlySalary || 0);
        const s = perfScore(m);
        const rp = suggestedRaisePct(m);
        const newSalary = current > 0 ? Math.round(current * (1 + rp / 100)) : 0;
        const delta = Math.max(0, newSalary - current);
        return {
          id: m.id,
          name: m.name,
          role: m.role,
          city: m.city,
          score: s,
          rating: m.rating,
          current,
          raisePct: rp,
          newSalary,
          delta,
        };
      })
      .sort((a, b) => b.raisePct - a.raisePct || b.score - a.score);

    const monthlyDelta = rows.reduce((a, b) => a + b.delta, 0);
    const annualDelta = monthlyDelta * 12;
    const newPayroll = kpis.basePayroll + monthlyDelta;

    return { rows, monthlyDelta, annualDelta, newPayroll };
  }, [team, kpis.basePayroll]);

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
      createdAt: editId ? team.find((x) => x.id === editId)?.createdAt || now : now,
      updatedAt: now,
    };

    setTeam((prev) => {
      const exists = prev.some((x) => x.id === item.id);
      const next = exists ? prev.map((x) => (x.id === item.id ? item : x)) : [item, ...prev];
      return next;
    });

    log(editId ? "EDIT" : "ADD", item.name, `role=${item.role}, status=${item.status}, salary=${item.monthlySalary}`);
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
      suggestedRaisePct: suggestedRaisePct(m),
      skills: (m.skills || []).join("; "),
      updatedAt: m.updatedAt,
    }));
    exportCSV(`eventura_hr_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  function exportHRJSON() {
    exportJSON(`eventura_hr_${new Date().toISOString().slice(0, 10)}.json`, {
      version: "eventura-hr-export-v2",
      exportedAt: new Date().toISOString(),
      keyUsed: keyInfo,
      savedKey: HR_SAVE_KEY,
      team,
      audit,
      budget,
      reviews,
    });
  }

  function exportAIPlans() {
    exportJSON(`eventura_hr_ai_${new Date().toISOString().slice(0, 10)}.json`, {
      version: "eventura-hr-ai-v2",
      exportedAt: new Date().toISOString(),
      assignmentInputs: {
        city: planCity,
        role: planRole,
        requiredSkills: normalizeSkillList(planSkills),
        maxWorkload: planMaxWorkload,
        minRating: planMinRating,
        count: planCount,
      },
      assignment: assignment.map((x) => ({
        name: x.m.name,
        role: x.m.role,
        city: x.m.city,
        workload: x.m.workload,
        rating: x.m.rating,
        score: perfScore(x.m),
        matchPct: Math.round(x.match * 100),
      })),
      trainingPlan,
      hiringPlan,
      raiseEngine,
      salaryForecast,
      budget,
    });
  }

  function applyRaisePlan() {
    if (!isCEO) return setMsg("❌ CEO only.");
    if (!confirm("Apply suggested raises to salary field for eligible members?")) return;
    const now = new Date().toISOString();
    const map = new Map(raiseEngine.rows.map((r) => [r.id, r]));
    setTeam((prev) =>
      prev.map((m) => {
        const r = map.get(m.id);
        if (!r) return m;
        if (!(m.status === "Core" || m.status === "Trainee")) return m;
        if (!Number.isFinite(m.monthlySalary) || m.monthlySalary <= 0) return m;
        if (r.raisePct <= 0) return m;
        return { ...m, monthlySalary: r.newSalary, updatedAt: now };
      })
    );
    log("BULK", "Salary Raises", `Applied raise plan • +${inr(raiseEngine.monthlyDelta)}/month`);
    setMsg(`✅ Raise plan applied • Payroll +${inr(raiseEngine.monthlyDelta)}/month`);
  }

  function addReview() {
    if (!isCEO) return setMsg("❌ CEO only.");
    const member = team.find((m) => m.id === rvMemberId);
    if (!member) return setMsg("❌ Select a member for review.");
    const score = perfScore(member);
    const rp = suggestedRaisePct(member);
    const item: PerformanceReview = {
      id: uid(),
      memberId: member.id,
      memberName: member.name,
      period: rvPeriod.trim() || "—",
      score,
      strengths: rvStrengths.trim(),
      gaps: rvGaps.trim(),
      goals: rvGoals.trim(),
      raiseSuggestionPct: rp,
      createdAt: new Date().toISOString(),
      createdBy: email || "Unknown",
    };
    setReviews((prev) => [item, ...prev].slice(0, 300));
    log("ADD", `Review: ${member.name}`, `period=${item.period}, score=${item.score}, raise=${item.raiseSuggestionPct}%`);
    setMsg("✅ Review saved");
    setRvStrengths("");
    setRvGaps("");
    setRvGoals("");
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

  const selectedMemberForReview = useMemo(() => team.find((m) => m.id === rvMemberId) || null, [team, rvMemberId]);

  return (
    <div style={S.app}>
      <aside style={{ ...S.sidebar, width: sidebarIconsOnly ? 76 : 280 }}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          {!sidebarIconsOnly ? (
            <div>
              <div style={S.brandName}>Eventura OS</div>
              <div style={S.brandSub}>HR • Salary • Performance</div>
            </div>
          ) : null}
        </div>

        <nav style={S.nav}>
          {NAV.map((item) => (
            <HoverNavLink
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={item.href === "/hr"}
              iconsOnly={sidebarIconsOnly}
              S={S}
              hoverKey={item.href}
              hovered={hoveredNav}
              setHovered={setHoveredNav}
            />
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
              Salary • Forecast • Budgeting • Performance Tools • <b>{email || "Unknown"}</b>
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
            <button style={S.secondaryBtn} onClick={exportAIPlans}>
              Export HR AI
            </button>
          </div>
        </div>

        {loading ? <div style={S.loadingBar}>Loading session…</div> : null}
        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* Executive KPIs */}
        <div style={S.grid3}>
          <section style={S.panel}>
            <div style={S.panelTitle}>People KPIs</div>
            <div style={S.kpiRow}>
              <KPI label="Team" value={String(kpis.total)} S={S} />
              <KPI label="Active" value={String(kpis.active)} S={S} />
              <KPI label="Avg Workload" value={`${kpis.avgWorkload}%`} S={S} />
              <KPI label="Avg Rating" value={String(kpis.avgRating)} S={S} />
            </div>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
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
            <div style={S.panelTitle}>Salary Snapshot</div>
            <div style={S.kpiRowMini}>
              <KPI label="Base Payroll / Month" value={inr(kpis.basePayroll)} S={S} />
              <KPI label="Avg Salary" value={inr(kpis.avgSalary)} S={S} />
              <KPI label="Payroll / Year" value={inr(kpis.payrollYear)} S={S} />
              <KPI label="Budget Utilization" value={`${Math.round(budgetSnapshot.utilization)}%`} S={S} />
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              <div style={S.noteBoxBlue}>
                Planned cost (payroll + bonus + buffer + freelancer): <b>{inr(budgetSnapshot.planned)}</b> / month
              </div>
              <div style={S.rowBetween}>
                <div style={S.smallMuted}>Monthly HR Budget</div>
                <div style={S.pill}>{inr(budget.monthlyHRBudget)}</div>
              </div>
              <div style={S.rowBetween}>
                <div style={S.smallMuted}>Freelancer Budget</div>
                <div style={S.pill}>{inr(budget.freelancerBudget)}</div>
              </div>
            </div>
          </section>

          <section style={S.panel}>
            <div style={S.panelTitle}>Auto Insights (Local)</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {aiInsights.slice(0, 4).map((x, idx) => (
                <HoverRow
                  key={idx}
                  id={`ai-${idx}`}
                  hoveredRow={hoveredRow}
                  setHoveredRow={setHoveredRow}
                  style={S.aiCard}
                  hoverStyle={S.aiCardHover}
                >
                  <div style={S.rowBetween}>
                    <div style={{ fontWeight: 950 }}>{x.title}</div>
                    <span style={{ ...S.aiBadge, ...(x.level === "OK" ? S.aiOK : x.level === "WARN" ? S.aiWARN : S.aiRISK) }}>
                      {x.level}
                    </span>
                  </div>
                  <div style={S.smallMuted}>{x.detail}</div>
                </HoverRow>
              ))}
            </div>
            <div style={S.smallNote}>No API calls • Deploy safe • Local calculations only.</div>
          </section>
        </div>

        {/* Budget + Forecast + Raise Engine */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Salary Budgeting • Forecast • Automated Performance Tool</div>

          <div style={S.grid2}>
            {/* Budget Controls */}
            <div style={S.box}>
              <div style={S.boxTitle}>Budget Controls</div>

              <div style={S.formGrid3}>
                <Field label="Monthly HR Budget (₹)">
                  <input
                    style={S.inputFull}
                    type="number"
                    value={budget.monthlyHRBudget}
                    onChange={(e) => setBudget((p) => ({ ...p, monthlyHRBudget: Math.max(0, Number(e.target.value) || 0) }))}
                    disabled={!isCEO}
                  />
                </Field>

                <Field label="Freelancer Budget / Month (₹)">
                  <input
                    style={S.inputFull}
                    type="number"
                    value={budget.freelancerBudget}
                    onChange={(e) => setBudget((p) => ({ ...p, freelancerBudget: Math.max(0, Number(e.target.value) || 0) }))}
                    disabled={!isCEO}
                  />
                </Field>

                <Field label="Annual Raise % (avg)">
                  <input
                    style={S.inputFull}
                    type="number"
                    value={budget.annualRaisePct}
                    onChange={(e) => setBudget((p) => ({ ...p, annualRaisePct: clamp(Number(e.target.value) || 0, 0, 40) }))}
                    disabled={!isCEO}
                  />
                </Field>

                <Field label="Hiring Buffer % (monthly)">
                  <input
                    style={S.inputFull}
                    type="number"
                    value={budget.hiringBufferPct}
                    onChange={(e) => setBudget((p) => ({ ...p, hiringBufferPct: clamp(Number(e.target.value) || 0, 0, 30) }))}
                    disabled={!isCEO}
                  />
                </Field>

                <Field label="Bonus Pool % (monthly)">
                  <input
                    style={S.inputFull}
                    type="number"
                    value={budget.bonusPct}
                    onChange={(e) => setBudget((p) => ({ ...p, bonusPct: clamp(Number(e.target.value) || 0, 0, 20) }))}
                    disabled={!isCEO}
                  />
                </Field>

                <Field label="Planned Cost / Budget">
                  <div style={S.metricBox}>
                    <div style={S.metricBig}>{Math.round(budgetSnapshot.utilization)}%</div>
                    <div style={S.smallMuted}>{inr(budgetSnapshot.planned)} / {inr(budget.monthlyHRBudget)}</div>
                  </div>
                </Field>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {budgetSnapshot.utilization >= 100 ? (
                  <div style={S.noteBoxDanger}>
                    Budget risk: planned cost exceeds budget by <b>{inr(budgetSnapshot.planned - budget.monthlyHRBudget)}</b> / month
                  </div>
                ) : budgetSnapshot.utilization >= 85 ? (
                  <div style={S.noteBoxWarn}>
                    Watch: budget utilization above 85%. Remaining buffer: <b>{inr(budget.monthlyHRBudget - budgetSnapshot.planned)}</b>
                  </div>
                ) : (
                  <div style={S.noteBoxOk}>
                    Budget healthy. Remaining buffer: <b>{inr(budget.monthlyHRBudget - budgetSnapshot.planned)}</b>
                  </div>
                )}

                <div style={S.rowBetween}>
                  <div style={S.smallMuted}>Bonus (planned)</div>
                  <div style={S.pill}>{inr(budgetSnapshot.bonus)}</div>
                </div>
                <div style={S.rowBetween}>
                  <div style={S.smallMuted}>Hiring Buffer (planned)</div>
                  <div style={S.pill}>{inr(budgetSnapshot.hiringBuffer)}</div>
                </div>
              </div>
            </div>

            {/* Forecast Table */}
            <div style={S.box}>
              <div style={S.boxTitle}>Salary Forecast (Auto)</div>
              <div style={S.smallMuted}>
                Uses base payroll + annual raises + bonus pool + hiring buffer + freelancer budget.
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={S.tableMiniHead}>
                  <div>Horizon</div>
                  <div>Payroll</div>
                  <div>Bonus</div>
                  <div>Buffer</div>
                  <div>Freelancer</div>
                  <div>Total</div>
                </div>
                {salaryForecast.map((r) => (
                  <HoverRow
                    key={r.monthOffset}
                    id={`fc-${r.monthOffset}`}
                    hoveredRow={hoveredRow}
                    setHoveredRow={setHoveredRow}
                    style={S.tableMiniRow}
                    hoverStyle={S.tableMiniRowHover}
                  >
                    <div style={{ fontWeight: 950 }}>
                      {r.monthOffset === 0 ? "Now" : `+${r.monthOffset} mo`}
                    </div>
                    <div style={S.muted}>{inr(r.payroll)}</div>
                    <div style={S.muted}>{inr(r.bonus)}</div>
                    <div style={S.muted}>{inr(r.hiringBuffer)}</div>
                    <div style={S.muted}>{inr(r.freelancerBudget)}</div>
                    <div><span style={S.scorePill}>{inr(r.total)}</span></div>
                  </HoverRow>
                ))}
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={S.noteBoxBlue}>
                  Forecast @ 12 months: <b>{inr(salaryForecast[salaryForecast.length - 1]?.total || 0)}</b> / month
                </div>
              </div>
            </div>
          </div>

          {/* Raise Engine */}
          <div style={{ ...S.box, marginTop: 12 }}>
            <div style={S.rowBetween}>
              <div>
                <div style={S.boxTitle}>Automated Performance Tool: Raise Engine</div>
                <div style={S.smallMuted}>
                  Suggests raise % from performance score + rating. (Core/Trainee only)
                </div>
              </div>

              <div style={S.row}>
                <div style={S.pill}>+{inr(raiseEngine.monthlyDelta)}/mo</div>
                <div style={S.pill}>+{inr(raiseEngine.annualDelta)}/yr</div>
                {isCEO ? (
                  <button style={S.primaryBtn} onClick={applyRaisePlan}>
                    Apply Raises
                  </button>
                ) : null}
              </div>
            </div>

            {!raiseEngine.rows.length ? (
              <div style={S.empty}>Add salary for Core/Trainee members to use raise engine.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={S.raiseHead}>
                  <div>Name</div>
                  <div>Role</div>
                  <div>Score</div>
                  <div>Current</div>
                  <div>Raise %</div>
                  <div>New</div>
                  <div>Δ</div>
                </div>
                {raiseEngine.rows.slice(0, 12).map((r) => (
                  <HoverRow
                    key={r.id}
                    id={`rs-${r.id}`}
                    hoveredRow={hoveredRow}
                    setHoveredRow={setHoveredRow}
                    style={S.raiseRow}
                    hoverStyle={S.raiseRowHover}
                  >
                    <div style={{ fontWeight: 950 }}>{r.name}</div>
                    <div style={S.muted}>{r.role}</div>
                    <div><span style={S.scorePill}>{r.score}</span></div>
                    <div style={S.muted}>{inr(r.current)}</div>
                    <div><span style={r.raisePct >= 10 ? S.pillStrong : S.pill}>{r.raisePct}%</span></div>
                    <div style={S.muted}>{inr(r.newSalary)}</div>
                    <div style={S.muted}>{inr(r.delta)}</div>
                  </HoverRow>
                ))}
                {raiseEngine.rows.length > 12 ? <div style={S.smallMuted}>… and {raiseEngine.rows.length - 12} more</div> : null}
              </div>
            )}
          </div>

          {/* Role budget */}
          <div style={{ ...S.box, marginTop: 12 }}>
            <div style={S.boxTitle}>Role-wise Salary & Performance</div>
            {!roleBudgets.length ? (
              <div style={S.empty}>No data.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <div style={S.roleHead}>
                  <div>Role</div>
                  <div>Headcount</div>
                  <div>Payroll</div>
                  <div>Avg Score</div>
                  <div>Avg Rating</div>
                </div>
                {roleBudgets.map((r) => (
                  <HoverRow
                    key={r.role}
                    id={`rb-${r.role}`}
                    hoveredRow={hoveredRow}
                    setHoveredRow={setHoveredRow}
                    style={S.roleRow}
                    hoverStyle={S.roleRowHover}
                  >
                    <div style={{ fontWeight: 950 }}>{r.role}</div>
                    <div style={S.muted}>{r.headcount}</div>
                    <div style={S.muted}>{inr(r.payroll)}</div>
                    <div><span style={S.scorePill}>{r.avgScore}</span></div>
                    <div style={S.muted}>{r.avgRating.toFixed(1)}</div>
                  </HoverRow>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* AI Planner */}
        <section style={S.panel}>
          <div style={S.panelTitle}>AI Planner (Assignment • Training • Hiring)</div>

          <div style={S.filters}>
            <input style={{ ...S.input, width: 220 }} value={planCity} onChange={(e) => setPlanCity(e.target.value)} placeholder="Event City (optional)" />
            <select style={S.select} value={planRole} onChange={(e) => setPlanRole(e.target.value)}>
              <option value="Any" style={S.option}>Role: Any</option>
              {roles.filter((r) => r !== "All").map((r) => (
                <option key={r} value={r} style={S.option}>{r}</option>
              ))}
            </select>
            <input style={{ ...S.input, width: 340 }} value={planSkills} onChange={(e) => setPlanSkills(e.target.value)} placeholder="Required skills (comma separated)" />
            <input style={{ ...S.input, width: 160 }} type="number" value={planMaxWorkload} onChange={(e) => setPlanMaxWorkload(clamp(Number(e.target.value) || 0, 0, 100))} placeholder="Max Workload" />
            <input style={{ ...S.input, width: 150 }} type="number" value={planMinRating} onChange={(e) => setPlanMinRating(clamp(Number(e.target.value) || 0, 0, 5))} placeholder="Min Rating" />
            <input style={{ ...S.input, width: 120 }} type="number" value={planCount} onChange={(e) => setPlanCount(clamp(Number(e.target.value) || 3, 1, 10))} placeholder="Top N" />
          </div>

          <div style={S.grid2}>
            <div style={S.box}>
              <div style={S.boxTitle}>Suggested Assignment (Top {planCount})</div>
              {!assignment.length ? (
                <div style={S.empty}>No matches.</div>
              ) : (
                <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                  {assignment.map((x) => (
                    <HoverRow
                      key={x.m.id}
                      id={`as-${x.m.id}`}
                      hoveredRow={hoveredRow}
                      setHoveredRow={setHoveredRow}
                      style={S.itemCard}
                      hoverStyle={S.itemCardHover}
                    >
                      <div style={S.rowBetween}>
                        <div style={{ fontWeight: 950 }}>{x.m.name}</div>
                        <span style={S.scorePill}>Score {perfScore(x.m)}</span>
                      </div>
                      <div style={S.smallMuted}>
                        {x.m.role} • {x.m.city || "—"} • Workload {x.m.workload}% • ⭐ {x.m.rating.toFixed(1)} • Match {Math.round(x.match * 100)}%
                      </div>
                      <div style={S.smallMuted}>Skills: {(x.m.skills || []).slice(0, 6).join(" • ") || "—"}</div>
                    </HoverRow>
                  ))}
                </div>
              )}
            </div>

            <div style={S.box}>
              <div style={S.boxTitle}>Hiring Plan (Auto)</div>
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {hiringPlan.map((h, idx) => (
                  <HoverRow
                    key={idx}
                    id={`hp-${idx}`}
                    hoveredRow={hoveredRow}
                    setHoveredRow={setHoveredRow}
                    style={S.itemCard}
                    hoverStyle={S.itemCardHover}
                  >
                    <div style={S.rowBetween}>
                      <div style={{ fontWeight: 950 }}>{h.suggestion}</div>
                      <span style={S.pill}>Priority: {h.priority}</span>
                    </div>
                    <div style={S.smallMuted}>{h.why}</div>
                  </HoverRow>
                ))}
              </div>
            </div>
          </div>

          <div style={{ ...S.box, marginTop: 12 }}>
            <div style={S.boxTitle}>Training Plan (Auto)</div>
            {!trainingPlan.length ? (
              <div style={S.empty}>No training actions detected.</div>
            ) : (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {trainingPlan.slice(0, 10).map((t, idx) => (
                  <HoverRow
                    key={idx}
                    id={`tp-${idx}`}
                    hoveredRow={hoveredRow}
                    setHoveredRow={setHoveredRow}
                    style={S.itemCard}
                    hoverStyle={S.itemCardHover}
                  >
                    <div style={S.rowBetween}>
                      <div style={{ fontWeight: 950 }}>{t.person}</div>
                      <span style={S.pill}>{t.reason}</span>
                    </div>
                    <div style={S.smallMuted}>{t.focus.join(" • ")}</div>
                  </HoverRow>
                ))}
                {trainingPlan.length > 10 ? <div style={S.smallMuted}>… and {trainingPlan.length - 10} more</div> : null}
              </div>
            )}
          </div>
        </section>

        {/* Performance Reviews */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Performance Reviews (CEO) • Coaching • Goals</div>

          <div style={S.grid2}>
            <div style={S.box}>
              <div style={S.boxTitle}>Create Review</div>

              <div style={S.formGrid2}>
                <Field label="Member">
                  <select style={S.selectFull} value={rvMemberId} onChange={(e) => setRvMemberId(e.target.value)} disabled={!isCEO}>
                    <option value="" style={S.option}>Select member…</option>
                    {team
                      .filter((m) => m.status !== "Inactive")
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((m) => (
                        <option key={m.id} value={m.id} style={S.option}>
                          {m.name} • {m.role}
                        </option>
                      ))}
                  </select>
                </Field>

                <Field label="Period (e.g., 2026-Q1)">
                  <input style={S.inputFull} value={rvPeriod} onChange={(e) => setRvPeriod(e.target.value)} disabled={!isCEO} />
                </Field>

                <Field label="Strengths">
                  <input style={S.inputFull} value={rvStrengths} onChange={(e) => setRvStrengths(e.target.value)} placeholder="What went well…" disabled={!isCEO} />
                </Field>

                <Field label="Gaps / Risks">
                  <input style={S.inputFull} value={rvGaps} onChange={(e) => setRvGaps(e.target.value)} placeholder="What must improve…" disabled={!isCEO} />
                </Field>

                <Field label="Goals (next period)">
                  <input style={S.inputFull} value={rvGoals} onChange={(e) => setRvGoals(e.target.value)} placeholder="3 goals…" disabled={!isCEO} />
                </Field>

                <Field label="Auto Result">
                  <div style={S.metricBox}>
                    <div style={S.metricBig}>
                      {selectedMemberForReview ? perfScore(selectedMemberForReview) : "—"}
                    </div>
                    <div style={S.smallMuted}>
                      Raise: <b>{selectedMemberForReview ? `${suggestedRaisePct(selectedMemberForReview)}%` : "—"}</b>
                      {" • "}
                      Salary: <b>{selectedMemberForReview ? inr(selectedMemberForReview.monthlySalary || 0) : "—"}</b>
                    </div>
                  </div>
                </Field>
              </div>

              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <button style={S.primaryBtn} onClick={addReview} disabled={!isCEO}>
                  Save Review
                </button>
              </div>
            </div>

            <div style={S.box}>
              <div style={S.boxTitle}>Recent Reviews</div>
              {!reviews.length ? (
                <div style={S.empty}>No reviews saved.</div>
              ) : (
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {reviews.slice(0, 8).map((r) => (
                    <HoverRow
                      key={r.id}
                      id={`rv-${r.id}`}
                      hoveredRow={hoveredRow}
                      setHoveredRow={setHoveredRow}
                      style={S.itemCard}
                      hoverStyle={S.itemCardHover}
                    >
                      <div style={S.rowBetween}>
                        <div style={{ fontWeight: 950 }}>{r.memberName}</div>
                        <span style={S.pill}>{r.period}</span>
                      </div>
                      <div style={S.smallMuted}>
                        Score <b>{r.score}</b> • Suggested raise <b>{r.raiseSuggestionPct}%</b> • {new Date(r.createdAt).toLocaleDateString()}
                      </div>
                      {r.strengths ? <div style={S.smallMuted}>✅ {r.strengths}</div> : null}
                      {r.gaps ? <div style={S.smallMuted}>⚠️ {r.gaps}</div> : null}
                      {r.goals ? <div style={S.smallMuted}>🎯 {r.goals}</div> : null}
                    </HoverRow>
                  ))}
                  {reviews.length > 8 ? <div style={S.smallMuted}>… and {reviews.length - 8} more</div> : null}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Team Directory */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Team Directory</div>

          <div style={S.filters}>
            <input style={{ ...S.input, width: 260 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, skill, notes…" />
            <select style={S.select} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              {roles.map((x) => (
                <option key={x} value={x} style={S.option}>{x === "All" ? "All Roles" : x}</option>
              ))}
            </select>
            <select style={S.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {["All", "Core", "Freelancer", "Trainee", "Inactive"].map((x) => (
                <option key={x} value={x} style={S.option}>{x === "All" ? "All Status" : x}</option>
              ))}
            </select>
            <select style={S.select} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              {cities.map((x) => (
                <option key={x} value={x} style={S.option}>{x === "All" ? "All Cities" : x}</option>
              ))}
            </select>
            <select style={S.select} value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}>
              {skills.map((x) => (
                <option key={x} value={x} style={S.option}>{x === "All" ? "All Skills" : x}</option>
              ))}
            </select>
            <select style={S.select} value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              {["Updated", "Name", "Workload", "Rating", "Score", "Salary"].map((x) => (
                <option key={x} value={x} style={S.option}>Sort: {x}</option>
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
                <div>Salary</div>
                <div>Raise</div>
                <div>Actions</div>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {filtered.map((m) => {
                  const raisePct = suggestedRaisePct(m);
                  const salary = m.status === "Freelancer" ? 0 : Math.max(0, m.monthlySalary || 0);
                  return (
                    <HoverRow
                      key={m.id}
                      id={`row-${m.id}`}
                      hoveredRow={hoveredRow}
                      setHoveredRow={setHoveredRow}
                      style={S.tableRow}
                      hoverStyle={S.tableRowHover}
                    >
                      <div>
                        <div style={{ fontWeight: 950 }}>{m.name}</div>
                        <div style={S.smallMuted}>
                          {m.skills?.length ? m.skills.slice(0, 5).join(" • ") : "—"}
                          {m.skills.length > 5 ? " • …" : ""}
                        </div>
                      </div>

                      <div style={S.muted}>{m.role}</div>
                      <div><span style={S.pill}>{m.status}</span></div>
                      <div style={S.muted}>{m.city || "—"}</div>

                      <div>
                        <div style={S.muted}>{m.workload}%</div>
                        <div style={S.miniBarWrap}>
                          <div style={{ ...S.miniBarFill, width: `${clamp(m.workload, 0, 100)}%` }} />
                        </div>
                      </div>

                      <div style={S.muted}>{m.rating.toFixed(1)}</div>
                      <div><span style={S.scorePill}>{perfScore(m)}</span></div>
                      <div style={S.muted}>{m.status === "Freelancer" ? "—" : inr(salary)}</div>
                      <div><span style={raisePct >= 10 ? S.pillStrong : S.pill}>{raisePct}%</span></div>

                      <div style={S.row}>
                        <button style={S.ghostBtn} onClick={() => openEdit(m)} disabled={!isCEO} title={!isCEO ? "CEO only" : ""}>
                          Edit
                        </button>
                        <button style={S.dangerBtn} onClick={() => deleteMember(m.id)} disabled={!isCEO} title={!isCEO ? "CEO only" : ""}>
                          Delete
                        </button>
                      </div>
                    </HoverRow>
                  );
                })}
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
                <HoverRow
                  key={a.id}
                  id={`au-${a.id}`}
                  hoveredRow={hoveredRow}
                  setHoveredRow={setHoveredRow}
                  style={S.auditRow}
                  hoverStyle={S.auditRowHover}
                >
                  <div style={{ fontWeight: 950 }}>{a.action}</div>
                  <div style={S.muted}>{a.target}</div>
                  <div style={S.smallMuted}>{new Date(a.at).toLocaleString()}</div>
                  <div style={S.smallMuted}>{a.by}</div>
                </HoverRow>
              ))}
              {audit.length > 12 ? <div style={S.smallMuted}>… and {audit.length - 12} more</div> : null}
            </div>
          )}
        </section>

        {/* Editor Modal */}
        {openEditor ? (
          <div style={S.modalOverlay} onMouseDown={() => setOpenEditor(false)}>
            <div style={S.modal} onMouseDown={(e) => e.stopPropagation()}>
              <div style={S.rowBetween}>
                <div style={{ fontWeight: 950, fontSize: 16 }}>{editId ? "Edit Team Member" : "Add Team Member"}</div>
                <button style={S.ghostBtn} onClick={() => setOpenEditor(false)}>Close</button>
              </div>

              <div style={S.formGrid2}>
                <Field label="Name">
                  <input style={S.inputFull} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                </Field>

                <Field label="Role">
                  <select style={S.selectFull} value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
                    {["Event Manager", "Decor Specialist", "Logistics", "Marketing", "Sales", "Accountant", "Operations", "Other"].map((x) => (
                      <option key={x} value={x} style={S.option}>{x}</option>
                    ))}
                  </select>
                </Field>

                <Field label="City">
                  <input style={S.inputFull} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Surat / Ahmedabad..." />
                </Field>

                <Field label="Status">
                  <select style={S.selectFull} value={status} onChange={(e) => setStatus(e.target.value as StaffStatus)}>
                    {["Core", "Freelancer", "Trainee", "Inactive"].map((x) => (
                      <option key={x} value={x} style={S.option}>{x}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Workload (0-100)">
                  <input style={S.inputFull} type="number" value={workload} onChange={(e) => setWorkload(clamp(Number(e.target.value) || 0, 0, 100))} />
                </Field>

                <Field label="Monthly Salary (₹) (Core/Trainee)">
                  <input style={S.inputFull} type="number" value={monthlySalary} onChange={(e) => setMonthlySalary(Math.max(0, Number(e.target.value) || 0))} />
                </Field>

                <Field label="Events this month">
                  <input style={S.inputFull} type="number" value={eventsThisMonth} onChange={(e) => setEventsThisMonth(Math.max(0, Number(e.target.value) || 0))} />
                </Field>

                <Field label="Rating (0-5)">
                  <input style={S.inputFull} type="number" value={rating} onChange={(e) => setRating(clamp(Number(e.target.value) || 0, 0, 5))} />
                </Field>

                <Field label="Skills (comma separated)">
                  <input style={S.inputFull} value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="Client Handling, Vendor Negotiation..." />
                </Field>

                <Field label="Notes">
                  <input style={S.inputFull} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes..." />
                </Field>
              </div>

              <div style={S.rowBetween}>
                <div style={S.smallMuted}>
                  Auto Score:{" "}
                  {perfScore({
                    id: "x",
                    name: name || "—",
                    role,
                    city,
                    status,
                    workload: clamp(Number(workload) || 0, 0, 100),
                    monthlySalary: Math.max(0, Number(monthlySalary) || 0),
                    eventsThisMonth: Math.max(0, Number(eventsThisMonth) || 0),
                    rating: clamp(Number(rating) || 0, 0, 5),
                    skills: normalizeSkillList(skillsText),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    notes: notes || undefined,
                  })}{" "}
                  • Suggested raise:{" "}
                  {suggestedRaisePct({
                    id: "x",
                    name: name || "—",
                    role,
                    city,
                    status,
                    workload: clamp(Number(workload) || 0, 0, 100),
                    monthlySalary: Math.max(0, Number(monthlySalary) || 0),
                    eventsThisMonth: Math.max(0, Number(eventsThisMonth) || 0),
                    rating: clamp(Number(rating) || 0, 0, 5),
                    skills: normalizeSkillList(skillsText),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    notes: notes || undefined,
                  })}
                  %
                </div>
                <button style={S.primaryBtn} onClick={saveMember}>
                  {editId ? "Save Changes" : "Add Member"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div style={S.footerNote}>✅ Advanced HR • ✅ Salary Forecast • ✅ Budgeting • ✅ Performance Tool • ✅ BLACK Hover • ✅ Deploy Safe</div>
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
    hoverBlack: "#000000",

    dangerBg: "rgba(248,113,113,0.10)",
    dangerBd: hc ? "rgba(248,113,113,0.55)" : "rgba(248,113,113,0.30)",
    dangerTx: "#FCA5A5",

    okBg: "rgba(34,197,94,0.12)",
    okBd: hc ? "rgba(34,197,94,0.45)" : "rgba(34,197,94,0.28)",
    okTx: "#86EFAC",

    warnBg: "rgba(245,158,11,0.12)",
    warnBd: hc ? "rgba(245,158,11,0.55)" : "rgba(245,158,11,0.35)",
    warnTx: "#FCD34D",

    blueBg: "rgba(59,130,246,0.12)",
    blueBd: hc ? "rgba(59,130,246,0.55)" : "rgba(59,130,246,0.30)",
    blueTx: "#BFDBFE",
  };

  switch (theme) {
    case "Midnight Purple":
      return {
        ...base,
        glow1: "rgba(139,92,246,0.22)",
        glow2: "rgba(212,175,55,0.14)",
        accentBg: "rgba(139,92,246,0.16)",
        accentBd: hc ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.30)",
        accentTx: "#DDD6FE",
      };
    case "Emerald Night":
      return {
        ...base,
        glow1: "rgba(16,185,129,0.18)",
        glow2: "rgba(212,175,55,0.12)",
        accentBg: "rgba(16,185,129,0.16)",
        accentBd: hc ? "rgba(16,185,129,0.55)" : "rgba(16,185,129,0.30)",
        accentTx: "#A7F3D0",
      };
    case "Ocean Blue":
      return {
        ...base,
        glow1: "rgba(59,130,246,0.22)",
        glow2: "rgba(34,211,238,0.14)",
        accentBg: "rgba(59,130,246,0.16)",
        accentBd: hc ? "rgba(59,130,246,0.55)" : "rgba(59,130,246,0.30)",
        accentTx: "#BFDBFE",
      };
    case "Ruby Noir":
      return {
        ...base,
        glow1: "rgba(244,63,94,0.18)",
        glow2: "rgba(212,175,55,0.10)",
        accentBg: "rgba(244,63,94,0.14)",
        accentBd: hc ? "rgba(244,63,94,0.50)" : "rgba(244,63,94,0.26)",
        accentTx: "#FDA4AF",
      };
    case "Carbon Black":
      return {
        ...base,
        bg: "#03040A",
        glow1: "rgba(255,255,255,0.10)",
        glow2: "rgba(212,175,55,0.10)",
        accentBg: "rgba(212,175,55,0.14)",
        accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)",
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
        border: hc ? "rgba(17,24,39,0.22)" : "rgba(17,24,39,0.12)",
        soft: hc ? "rgba(17,24,39,0.07)" : "rgba(17,24,39,0.04)",
        inputBg: hc ? "rgba(17,24,39,0.08)" : "rgba(17,24,39,0.04)",
        dangerTx: "#B91C1C",
        glow1: "rgba(212,175,55,0.16)",
        glow2: "rgba(59,130,246,0.14)",
        accentBg: "rgba(212,175,55,0.16)",
        accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)",
        accentTx: "#92400E",
        okTx: "#166534",
      };
    case "Royal Gold":
    default:
      return {
        ...base,
        glow1: "rgba(255,215,110,0.18)",
        glow2: "rgba(120,70,255,0.18)",
        accentBg: "rgba(212,175,55,0.12)",
        accentBd: hc ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)",
        accentTx: "#FDE68A",
      };
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
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
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
    navIcon: { fontSize: 18, width: 22, textAlign: "center" },
    navLabel: { fontWeight: 900, fontSize: 13 },

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
    navHover: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 10px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.border}`,
      background: T.hoverBlack,
    },
    navActive: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 10px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.accentBd}`,
      background: T.accentBg,
    },

    sidebarFooter: { marginTop: "auto", display: "grid", gap: 10 },
    userBox: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
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

    main: { flex: 1, padding: 16, maxWidth: 1400, margin: "0 auto", width: "100%" },

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
    smallMuted: { color: T.muted, fontSize: 12 },
    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35, marginTop: 10 },

    rolePill: {
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: 999,
      fontWeight: 950,
      background: T.accentBg,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
      marginLeft: 6,
    },

    msg: { marginTop: 12, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontSize: 13 },

    panel: { marginTop: 12, padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    grid2: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    grid3: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },

    kpiRow: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 },
    kpiRowMini: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 },
    kpi: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    kpiLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiValue: { marginTop: 6, fontSize: 18, fontWeight: 950 },

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
    pillStrong: { padding: "5px 10px", borderRadius: 999, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    scorePill: { padding: "5px 10px", borderRadius: 999, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },

    noteBoxOk: { padding: 12, borderRadius: 16, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontSize: 13, lineHeight: 1.35 },
    noteBoxWarn: { padding: 12, borderRadius: 16, border: `1px solid ${T.warnBd}`, background: T.warnBg, color: T.warnTx, fontSize: 13, lineHeight: 1.35 },
    noteBoxDanger: { padding: 12, borderRadius: 16, border: `1px solid ${T.dangerBd}`, background: T.dangerBg, color: T.dangerTx, fontSize: 13, lineHeight: 1.35 },
    noteBoxBlue: { padding: 12, borderRadius: 16, border: `1px solid ${T.blueBd}`, background: T.blueBg, color: T.blueTx, fontSize: 13, lineHeight: 1.35 },

    miniBarWrap: { marginTop: 6, height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" },
    miniBarFill: { height: "100%", borderRadius: 999, background: T.accentTx, opacity: 0.9 },

    box: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft, marginTop: 12 },
    boxTitle: { fontWeight: 950, marginBottom: 6 },

    itemCard: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)" },
    itemCardHover: { background: T.hoverBlack },

    aiCard: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    aiCardHover: { background: T.hoverBlack },

    aiBadge: { padding: "4px 10px", borderRadius: 999, fontWeight: 950, fontSize: 12, border: `1px solid ${T.border}` },
    aiOK: { background: T.okBg, color: T.okTx, border: `1px solid ${T.okBd}` },
    aiWARN: { background: T.warnBg, color: T.warnTx, border: `1px solid ${T.warnBd}` },
    aiRISK: { background: T.dangerBg, color: T.dangerTx, border: `1px solid ${T.dangerBd}` },

    tableWrap: { marginTop: 12, display: "grid", gap: 8 },
    tableHead: {
      display: "grid",
      gridTemplateColumns: "1.5fr 1.1fr 0.9fr 0.9fr 1fr 0.7fr 0.7fr 0.9fr 0.7fr 1.2fr",
      gap: 10,
      padding: 10,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      fontWeight: 950,
      color: T.muted,
      fontSize: 12,
    },
    tableRow: {
      display: "grid",
      gridTemplateColumns: "1.5fr 1.1fr 0.9fr 0.9fr 1fr 0.7fr 0.7fr 0.9fr 0.7fr 1.2fr",
      gap: 10,
      padding: 12,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      alignItems: "center",
    },
    tableRowHover: { background: T.hoverBlack },

    auditRow: { display: "grid", gridTemplateColumns: "90px 1fr 180px 1fr", gap: 10, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft },
    auditRowHover: { background: T.hoverBlack },

    modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", padding: 14, zIndex: 50 },
    modal: { width: "min(960px, 96vw)", borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel2, padding: 14, display: "grid", gap: 12 },

    formGrid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    formGrid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },

    metricBox: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: "rgba(255,255,255,0.03)" },
    metricBig: { fontSize: 22, fontWeight: 950 },

    tableMiniHead: {
      display: "grid",
      gridTemplateColumns: "0.8fr 1fr 1fr 1fr 1fr 1fr",
      gap: 10,
      padding: 10,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      fontWeight: 950,
      color: T.muted,
      fontSize: 12,
    },
    tableMiniRow: {
      display: "grid",
      gridTemplateColumns: "0.8fr 1fr 1fr 1fr 1fr 1fr",
      gap: 10,
      padding: 12,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      alignItems: "center",
    },
    tableMiniRowHover: { background: T.hoverBlack },

    raiseHead: {
      display: "grid",
      gridTemplateColumns: "1.4fr 1.2fr 0.8fr 1fr 0.8fr 1fr 0.9fr",
      gap: 10,
      padding: 10,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      fontWeight: 950,
      color: T.muted,
      fontSize: 12,
    },
    raiseRow: {
      display: "grid",
      gridTemplateColumns: "1.4fr 1.2fr 0.8fr 1fr 0.8fr 1fr 0.9fr",
      gap: 10,
      padding: 12,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      alignItems: "center",
    },
    raiseRowHover: { background: T.hoverBlack },

    roleHead: {
      display: "grid",
      gridTemplateColumns: "1.3fr 0.8fr 1fr 0.8fr 0.8fr",
      gap: 10,
      padding: 10,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      fontWeight: 950,
      color: T.muted,
      fontSize: 12,
    },
    roleRow: {
      display: "grid",
      gridTemplateColumns: "1.3fr 0.8fr 1fr 0.8fr 0.8fr",
      gap: 10,
      padding: 12,
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      alignItems: "center",
    },
    roleRowHover: { background: T.hoverBlack },

    loadingBar: { marginTop: 12, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.muted, fontSize: 12 },

    empty: { color: T.muted, fontSize: 13, padding: 10 },
    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 6, marginTop: 10 },
  };
}
