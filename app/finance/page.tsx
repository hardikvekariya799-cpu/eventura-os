"use client";

import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/* ================= SUPABASE (safe) ================= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/* ================= STORAGE KEYS ================= */
const LS_SETTINGS = "eventura_os_settings_v3"; // keep same key (your working app)
const LS_FIN = "eventura-finance-transactions"; // keep stable + simple

/* ================= TYPES ================= */
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

type TxType = "Income" | "Expense";
type FinanceTx = {
  id: string;
  date: string; // YYYY-MM-DD
  type: TxType;
  amount: number;
  category: string;
  vendor?: string;
  note?: string;
  createdAt: string;
};

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

/* ================= DEFAULT SETTINGS (SAFE FALLBACK) ================= */
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

/* ================= LOCAL HELPERS ================= */
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
function roleFromSettings(email: string, s: AppSettings): Role {
  if (!email) return "Staff";
  return email.toLowerCase() === s.ceoEmail.toLowerCase() ? "CEO" : "Staff";
}
function clampMoney(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
function toYMD(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function formatCurrency(amount: number, currency = "INR") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/* ================= “AI” AUTO-CATEGORY (LOCAL HEURISTICS) ================= */
const CATEGORY_RULES: { category: string; words: string[] }[] = [
  { category: "Venue / Farmhouse", words: ["venue", "farmhouse", "banquet", "hall", "resort"] },
  { category: "Catering", words: ["cater", "food", "dinner", "lunch", "breakfast", "snacks"] },
  { category: "Decor", words: ["decor", "decoration", "flowers", "floral", "mandap", "stage"] },
  { category: "Photography", words: ["photo", "photography", "videography", "camera", "editor"] },
  { category: "Sound & Lights", words: ["dj", "sound", "light", "lights", "speaker", "music"] },
  { category: "Transport", words: ["transport", "cab", "bus", "tempo", "travel", "fuel", "petrol"] },
  { category: "Marketing", words: ["ad", "ads", "meta", "facebook", "instagram", "google", "promo"] },
  { category: "Staff / Payroll", words: ["salary", "payroll", "wages", "freelancer", "payment staff"] },
  { category: "Office", words: ["rent", "office", "stationery", "internet", "wifi", "electric"] },
  { category: "Client Payment", words: ["client", "booking", "advance", "deposit", "received"] },
  { category: "Vendor Payment", words: ["vendor", "payout", "settlement", "paid"] },
];

function autoCategory(type: TxType, vendor?: string, note?: string) {
  const text = `${vendor ?? ""} ${note ?? ""}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.words.some((w) => text.includes(w))) return rule.category;
  }
  return type === "Income" ? "Income (Other)" : "Expense (Other)";
}

/* ================= AI INSIGHTS ================= */
function groupByMonth(txs: FinanceTx[]) {
  const map = new Map<string, FinanceTx[]>();
  for (const t of txs) {
    const key = t.date.slice(0, 7); // YYYY-MM
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  const months = Array.from(map.keys()).sort();
  return { map, months };
}

function sumIncomeExpense(txs: FinanceTx[]) {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === "Income") income += t.amount;
    else expense += t.amount;
  }
  return { income: clampMoney(income), expense: clampMoney(expense), net: clampMoney(income - expense) };
}

function topCategories(txs: FinanceTx[], type: TxType, topN = 5) {
  const agg = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== type) continue;
    agg.set(t.category, (agg.get(t.category) ?? 0) + t.amount);
  }
  const arr = Array.from(agg.entries())
    .map(([k, v]) => ({ category: k, amount: clampMoney(v) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, topN);
  return arr;
}

function detectAnomalies(txs: FinanceTx[]) {
  // simple anomaly rules: large expense (top 5%), duplicate same amount+vendor same day, spike vs category average
  const expenses = txs.filter((t) => t.type === "Expense").slice().sort((a, b) => a.amount - b.amount);
  const threshold = expenses.length ? expenses[Math.floor(expenses.length * 0.95)].amount : Infinity;

  const seen = new Set<string>();
  const duplicates: FinanceTx[] = [];
  for (const t of txs) {
    const key = `${t.date}|${(t.vendor ?? "").toLowerCase()}|${t.amount}|${t.type}`;
    if (seen.has(key)) duplicates.push(t);
    seen.add(key);
  }

  const large = txs.filter((t) => t.type === "Expense" && t.amount >= threshold);

  // category spike: expense > 2.5x category median
  const catVals = new Map<string, number[]>();
  for (const t of txs) {
    if (t.type !== "Expense") continue;
    const a = catVals.get(t.category) ?? [];
    a.push(t.amount);
    catVals.set(t.category, a);
  }
  const med = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length ? (s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2) : 0;
  };
  const spikes: FinanceTx[] = [];
  for (const t of txs) {
    if (t.type !== "Expense") continue;
    const vals = catVals.get(t.category) ?? [];
    const m = med(vals);
    if (m > 0 && t.amount > 2.5 * m) spikes.push(t);
  }

  return { large, duplicates, spikes };
}

function forecastNextMonthNet(monthKeys: string[], monthNet: Record<string, number>) {
  // simple trend: average delta last 3 months
  const last = monthKeys.slice(-4);
  if (last.length < 2) return null;
  const nets = last.map((k) => monthNet[k] ?? 0);
  const deltas: number[] = [];
  for (let i = 1; i < nets.length; i++) deltas.push(nets[i] - nets[i - 1]);
  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const predicted = nets[nets.length - 1] + avgDelta;
  return clampMoney(predicted);
}

/* ================= THEME TOKENS (safe) ================= */
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

/* ================= PAGE ================= */
export default function FinancePage() {
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings>(SETTINGS_DEFAULTS);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  const [txs, setTxs] = useState<FinanceTx[]>([]);
  const [type, setType] = useState<TxType>("Expense");
  const [date, setDate] = useState<string>(toYMD(new Date()));
  const [amount, setAmount] = useState<string>("");
  const [vendor, setVendor] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  const [aiAsk, setAiAsk] = useState("");
  const [aiAnswer, setAiAnswer] = useState<string>("");
  const aiRef = useRef<HTMLDivElement | null>(null);

  // load settings + data
  useEffect(() => {
    const s = safeLoad<AppSettings>(LS_SETTINGS, SETTINGS_DEFAULTS);
    setSettings({ ...SETTINGS_DEFAULTS, ...s });
    setTxs(safeLoad<FinanceTx[]>(LS_FIN, []));
  }, []);

  // persist txs
  useEffect(() => {
    safeSave(LS_FIN, txs);
  }, [txs]);

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

  const role = useMemo(() => roleFromSettings(email, settings), [email, settings]);
  const isCEO = role === "CEO";
  const sidebarIconsOnly = settings.sidebarMode === "Icons Only";

  // tokens + styles
  const T = ThemeTokens(settings.theme, settings.highContrast);
  const S = makeStyles(T, settings);

  // auto category suggestion
  useEffect(() => {
    const suggested = autoCategory(type, vendor, note);
    setCategory((prev) => (prev.trim() ? prev : suggested));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, vendor, note]);

  function addTx() {
    const a = Number(amount);
    if (!date || !Number.isFinite(a) || a <= 0) return alert("Enter valid Date + Amount.");
    const finalCategory = (category || "").trim() || autoCategory(type, vendor, note);

    const tx: FinanceTx = {
      id: uid(),
      date,
      type,
      amount: clampMoney(a),
      category: finalCategory,
      vendor: vendor.trim() || undefined,
      note: note.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    setTxs((prev) => [tx, ...prev]);

    setAmount("");
    setVendor("");
    setNote("");
    setCategory("");
  }

  function updateTx(id: string, patch: Partial<FinanceTx>) {
    setTxs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function deleteTx(id: string) {
    const ok = !settings.confirmDeletes || confirm("Delete this transaction?");
    if (!ok) return;
    setTxs((prev) => prev.filter((t) => t.id !== id));
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

  // INSIGHTS
  const totals = useMemo(() => sumIncomeExpense(txs), [txs]);
  const expenseTop = useMemo(() => topCategories(txs, "Expense", 5), [txs]);
  const incomeTop = useMemo(() => topCategories(txs, "Income", 5), [txs]);
  const { map: byMonth, months } = useMemo(() => groupByMonth(txs), [txs]);

  const monthNet = useMemo(() => {
    const obj: Record<string, number> = {};
    for (const m of months) {
      const t = byMonth.get(m) ?? [];
      obj[m] = sumIncomeExpense(t).net;
    }
    return obj;
  }, [months, byMonth]);

  const forecast = useMemo(() => forecastNextMonthNet(months, monthNet), [months, monthNet]);

  const anomalies = useMemo(() => detectAnomalies(txs), [txs]);

  const currency = "INR"; // keep simple; later can read from settings.region if you add it globally

  function exportFinance() {
    const payload = {
      version: "eventura-finance-export-v1",
      exportedAt: new Date().toISOString(),
      transactions: txs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eventura_finance_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFinance(file: File) {
    try {
      const json = JSON.parse(await file.text());
      const list = (json?.transactions ?? json) as FinanceTx[];
      if (!Array.isArray(list)) return alert("Invalid file.");
      // basic sanitize
      const clean = list
        .filter((x) => x && typeof x === "object")
        .map((x) => ({
          id: String((x as any).id ?? uid()),
          date: String((x as any).date ?? toYMD(new Date())),
          type: ((x as any).type === "Income" ? "Income" : "Expense") as TxType,
          amount: clampMoney(Number((x as any).amount ?? 0)),
          category: String((x as any).category ?? "Other"),
          vendor: (x as any).vendor ? String((x as any).vendor) : undefined,
          note: (x as any).note ? String((x as any).note) : undefined,
          createdAt: String((x as any).createdAt ?? new Date().toISOString()),
        }))
        .filter((x) => x.amount > 0);
      setTxs(clean);
      alert("Imported ✅");
    } catch {
      alert("Import failed.");
    }
  }

  function resetFinance() {
    const ok = confirm("Reset all Finance transactions? (This will delete local finance data)");
    if (!ok) return;
    setTxs([]);
  }

  function askFinanceAI(question: string) {
    const q = question.trim().toLowerCase();
    if (!q) return;

    const last30 = (() => {
      const now = new Date();
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return txs.filter((t) => new Date(t.date) >= from);
    })();

    const last7 = (() => {
      const now = new Date();
      const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return txs.filter((t) => new Date(t.date) >= from);
    })();

    const topExpenseVendor = () => {
      const m = new Map<string, number>();
      for (const t of txs) {
        if (t.type !== "Expense") continue;
        const v = (t.vendor ?? "Unknown").trim() || "Unknown";
        m.set(v, (m.get(v) ?? 0) + t.amount);
      }
      const arr = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
      return arr.length ? { vendor: arr[0][0], amount: clampMoney(arr[0][1]) } : null;
    };

    const contains = (s: string) => q.includes(s);

    // quick answers
    if (contains("profit") || contains("net")) {
      setAiAnswer(`Net (Income - Expense) overall is ${formatCurrency(totals.net, currency)}.`);
      return;
    }
    if (contains("income")) {
      setAiAnswer(`Total Income overall is ${formatCurrency(totals.income, currency)}.`);
      return;
    }
    if (contains("expense") || contains("spend") || contains("spent")) {
      setAiAnswer(`Total Expense overall is ${formatCurrency(totals.expense, currency)}.`);
      return;
    }
    if (contains("last 30") || contains("last 30 days")) {
      const t = sumIncomeExpense(last30);
      setAiAnswer(
        `Last 30 days: Income ${formatCurrency(t.income, currency)}, Expense ${formatCurrency(
          t.expense,
          currency
        )}, Net ${formatCurrency(t.net, currency)}.`
      );
      return;
    }
    if (contains("last 7") || contains("last 7 days") || contains("weekly")) {
      const t = sumIncomeExpense(last7);
      setAiAnswer(
        `Last 7 days: Income ${formatCurrency(t.income, currency)}, Expense ${formatCurrency(
          t.expense,
          currency
        )}, Net ${formatCurrency(t.net, currency)}.`
      );
      return;
    }
    if (contains("top expense") || contains("biggest expense") || contains("largest expense")) {
      const best = topCategories(txs, "Expense", 1)[0];
      if (!best) return setAiAnswer("No expense data yet.");
      setAiAnswer(`Top Expense category is "${best.category}" = ${formatCurrency(best.amount, currency)}.`);
      return;
    }
    if (contains("top income") || contains("biggest income")) {
      const best = topCategories(txs, "Income", 1)[0];
      if (!best) return setAiAnswer("No income data yet.");
      setAiAnswer(`Top Income category is "${best.category}" = ${formatCurrency(best.amount, currency)}.`);
      return;
    }
    if (contains("vendor")) {
      const bestV = topExpenseVendor();
      if (!bestV) return setAiAnswer("No vendor expense data yet.");
      setAiAnswer(`Highest paid vendor is "${bestV.vendor}" = ${formatCurrency(bestV.amount, currency)}.`);
      return;
    }
    if (contains("forecast") || contains("predict") || contains("next month")) {
      if (forecast === null) return setAiAnswer("Not enough monthly history to forecast yet.");
      const lastM = months.length ? months[months.length - 1] : "N/A";
      setAiAnswer(
        `Forecast (simple trend): Next month net ≈ ${formatCurrency(forecast, currency)} (based on recent months, last is ${lastM}).`
      );
      return;
    }
    if (contains("alert") || contains("anomaly") || contains("risk")) {
      const parts = [
        `Large expenses: ${anomalies.large.length}`,
        `Duplicates: ${anomalies.duplicates.length}`,
        `Spikes vs category median: ${anomalies.spikes.length}`,
      ];
      setAiAnswer(`Alerts summary → ${parts.join(" • ")}. Check the Alerts panel below.`);
      return;
    }

    setAiAnswer(
      `Try: "profit", "total income", "total expense", "last 30 days", "largest expense", "top vendor", "forecast next month", "alerts".`
    );
  }

  useEffect(() => {
    if (!aiRef.current) return;
    aiRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [aiAnswer]);

  return (
    <div style={S.app}>
      <aside style={{ ...S.sidebar, width: sidebarIconsOnly ? 76 : 280 }}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          {!sidebarIconsOnly ? (
            <div>
              <div style={S.brandName}>Eventura OS</div>
              <div style={S.brandSub}>{settings.theme}</div>
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
            <div style={S.h1}>Finance</div>
            <div style={S.muted}>
              AI Finance insights • Logged in as <b>{email || "Unknown"}</b> • Role:{" "}
              <span style={S.rolePill}>{role}</span>
            </div>
          </div>

          <div style={S.headerRight}>
            <div style={S.kpiMini}>
              <div style={S.kpiMiniLabel}>Net</div>
              <div style={S.kpiMiniValue}>{formatCurrency(totals.net, currency)}</div>
            </div>
            <div style={S.kpiMini}>
              <div style={S.kpiMiniLabel}>Transactions</div>
              <div style={S.kpiMiniValue}>{txs.length}</div>
            </div>

            <button style={S.secondaryBtn} onClick={exportFinance}>
              Export
            </button>

            <label style={S.secondaryBtn as any}>
              Import
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importFinance(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>

            {isCEO ? (
              <button style={S.dangerBtn} onClick={resetFinance}>
                Reset
              </button>
            ) : null}
          </div>
        </div>

        {loading ? <div style={S.loadingBar}>Loading session…</div> : null}

        <div style={S.grid}>
          {/* Add Transaction */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Add Transaction</div>
            <div style={S.smallNote}>
              Auto “AI” suggests category based on Vendor/Note. (No external API — safe deploy.)
            </div>

            <div style={S.formGrid}>
              <Field label="Type" S={S}>
                <select style={S.select} value={type} onChange={(e) => setType(e.target.value as TxType)}>
                  <option style={S.option}>Expense</option>
                  <option style={S.option}>Income</option>
                </select>
              </Field>

              <Field label="Date" S={S}>
                <input style={S.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>

              <Field label="Amount" S={S}>
                <input
                  style={S.input}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="e.g. 25000"
                />
              </Field>

              <Field label="Vendor (optional)" S={S}>
                <input style={S.input} value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="e.g. ABC Decor" />
              </Field>

              <Field label="Note (optional)" S={S}>
                <input style={S.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. stage flowers advance" />
              </Field>

              <Field label="Category (auto)" S={S}>
                <input
                  style={S.input}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Auto suggested..."
                />
              </Field>
            </div>

            <div style={S.rowBetween}>
              <div style={S.smallNote}>
                Tip: Put keywords in Note like <b>decor</b>, <b>catering</b>, <b>dj</b> to auto-categorize.
              </div>
              <button style={S.primaryBtn} onClick={addTx}>
                Add
              </button>
            </div>
          </section>

          {/* AI Insights */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Auto AI Insights</div>

            <div style={S.kpiRow}>
              <KPI label="Income" value={formatCurrency(totals.income, currency)} S={S} />
              <KPI label="Expense" value={formatCurrency(totals.expense, currency)} S={S} />
              <KPI label="Net" value={formatCurrency(totals.net, currency)} S={S} />
            </div>

            <div style={S.sectionTitle}>Top categories</div>
            <div style={S.split2}>
              <div style={S.softBox}>
                <div style={S.softTitle}>Top Expenses</div>
                {expenseTop.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {expenseTop.map((x) => (
                      <div key={x.category} style={S.rowBetween}>
                        <div style={{ fontWeight: 950 }}>{x.category}</div>
                        <div style={S.muted}>{formatCurrency(x.amount, currency)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={S.muted}>No expense data yet.</div>
                )}
              </div>

              <div style={S.softBox}>
                <div style={S.softTitle}>Top Income</div>
                {incomeTop.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {incomeTop.map((x) => (
                      <div key={x.category} style={S.rowBetween}>
                        <div style={{ fontWeight: 950 }}>{x.category}</div>
                        <div style={S.muted}>{formatCurrency(x.amount, currency)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={S.muted}>No income data yet.</div>
                )}
              </div>
            </div>

            <div style={S.sectionTitle}>Forecast</div>
            <div style={S.noteBox}>
              {forecast === null
                ? "Add a few months of data to enable forecast."
                : `Next month net (trend forecast): ~ ${formatCurrency(forecast, currency)}.`}
            </div>
          </section>

          {/* Alerts */}
          <section style={S.panel}>
            <div style={S.panelTitle}>AI Alerts (Auto)</div>
            <div style={S.smallNote}>Detects large expenses, duplicates, and category spikes.</div>

            <div style={S.alertGrid}>
              <AlertCard title="Large expenses" count={anomalies.large.length} S={S} />
              <AlertCard title="Duplicates" count={anomalies.duplicates.length} S={S} />
              <AlertCard title="Spikes" count={anomalies.spikes.length} S={S} />
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {renderAlertList("Large expenses", anomalies.large, S, currency)}
              {renderAlertList("Duplicates", anomalies.duplicates, S, currency)}
              {renderAlertList("Spikes", anomalies.spikes, S, currency)}
            </div>
          </section>

          {/* Finance AI Assistant */}
          <section style={S.panel} ref={aiRef}>
            <div style={S.panelTitle}>Finance AI Assistant (Local)</div>
            <div style={S.smallNote}>
              Ask questions like: <b>profit</b>, <b>last 30 days</b>, <b>largest expense</b>, <b>top vendor</b>, <b>forecast next month</b>.
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input
                style={{ ...S.input, flex: 1, minWidth: 240 }}
                value={aiAsk}
                onChange={(e) => setAiAsk(e.target.value)}
                placeholder='Try: "profit", "last 30 days", "top expense", "forecast next month"'
              />
              <button
                style={S.primaryBtn}
                onClick={() => {
                  askFinanceAI(aiAsk);
                }}
              >
                Ask
              </button>
              <button
                style={S.secondaryBtn}
                onClick={() => {
                  setAiAsk("");
                  setAiAnswer("");
                }}
              >
                Clear
              </button>
            </div>

            {aiAnswer ? (
              <div style={S.aiBox}>
                <div style={{ fontWeight: 950 }}>Answer</div>
                <div style={{ marginTop: 8, color: T.text, lineHeight: 1.4 }}>{aiAnswer}</div>
              </div>
            ) : null}
          </section>

          {/* Transactions */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Transactions</div>
            <div style={S.smallNote}>
              {isCEO ? "CEO can edit + delete." : "Staff can view only (safe)."}
            </div>

            {!txs.length ? (
              <div style={S.muted}>No transactions yet.</div>
            ) : (
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {txs.map((t) => (
                  <div key={t.id} style={S.txCard}>
                    <div style={S.rowBetween}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={t.type === "Income" ? S.pillOk : S.pillWarn}>{t.type}</span>
                        <span style={{ fontWeight: 950 }}>{formatCurrency(t.amount, currency)}</span>
                        <span style={S.smallMuted}>{t.date}</span>
                      </div>

                      {isCEO ? (
                        <button style={S.dltBtn} onClick={() => deleteTx(t.id)}>
                          Delete
                        </button>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      <div style={S.rowBetween}>
                        <span style={S.smallMuted}>Category</span>
                        {isCEO ? (
                          <input
                            style={S.inputSmall}
                            value={t.category}
                            onChange={(e) => updateTx(t.id, { category: e.target.value })}
                          />
                        ) : (
                          <span style={{ fontWeight: 900 }}>{t.category}</span>
                        )}
                      </div>

                      <div style={S.rowBetween}>
                        <span style={S.smallMuted}>Vendor</span>
                        {isCEO ? (
                          <input
                            style={S.inputSmall}
                            value={t.vendor ?? ""}
                            onChange={(e) => updateTx(t.id, { vendor: e.target.value || undefined })}
                          />
                        ) : (
                          <span style={{ fontWeight: 900 }}>{t.vendor || "—"}</span>
                        )}
                      </div>

                      <div style={S.rowBetween}>
                        <span style={S.smallMuted}>Note</span>
                        {isCEO ? (
                          <input
                            style={S.inputSmall}
                            value={t.note ?? ""}
                            onChange={(e) => updateTx(t.id, { note: e.target.value || undefined })}
                          />
                        ) : (
                          <span style={{ fontWeight: 900 }}>{t.note || "—"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

/* ================= SMALL UI ================= */
function Field({
  label,
  children,
  S,
}: {
  label: string;
  children: React.ReactNode;
  S: Record<string, CSSProperties>;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.9 }}>{label}</div>
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

function AlertCard({
  title,
  count,
  S,
}: {
  title: string;
  count: number;
  S: Record<string, CSSProperties>;
}) {
  return (
    <div style={S.alertCard}>
      <div style={{ fontWeight: 950 }}>{title}</div>
      <div style={S.alertCount}>{count}</div>
    </div>
  );
}

function renderAlertList(title: string, list: FinanceTx[], S: Record<string, CSSProperties>, currency: string) {
  if (!list.length) return null;
  return (
    <div style={S.softBox}>
      <div style={S.softTitle}>{title}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {list.slice(0, 6).map((t) => (
          <div key={t.id} style={S.rowBetween}>
            <div style={{ display: "grid", gap: 2 }}>
              <div style={{ fontWeight: 950 }}>
                {t.category} • {t.vendor || "—"}
              </div>
              <div style={S.smallMuted}>
                {t.date} • {t.note || "—"}
              </div>
            </div>
            <div style={{ fontWeight: 950 }}>{formatCurrency(t.amount, currency)}</div>
          </div>
        ))}
      </div>
      {list.length > 6 ? <div style={{ marginTop: 10, ...S.smallMuted }}>+ {list.length - 6} more…</div> : null}
    </div>
  );
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

    kpiMini: {
      minWidth: 140,
      padding: 10,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.soft,
    },
    kpiMiniLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiMiniValue: { marginTop: 6, fontWeight: 950 },

    grid: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    panel: {
      padding: 14,
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel,
      backdropFilter: "blur(10px)",
    },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    formGrid: {
      marginTop: 12,
      display: "grid",
      gap: 12,
      gridTemplateColumns: "1fr 1fr",
    },

    input: {
      width: "100%",
      padding: compact ? "10px 10px" : "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
    },
    inputSmall: {
      width: "60%",
      minWidth: 220,
      padding: compact ? "8px 10px" : "10px 10px",
      borderRadius: 12,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 13,
    },
    select: {
      width: "100%",
      padding: compact ? "8px 10px" : "10px 10px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontWeight: 900,
    },
    option: { backgroundColor: "#0B1020", color: "#F9FAFB" },

    rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
    smallMuted: { color: T.muted, fontSize: 12 },
    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35 },

    primaryBtn: {
      padding: "10px 14px",
      borderRadius: 14,
      border: `1px solid ${T.accentBd}`,
      background: `linear-gradient(135deg, ${T.accentBg}, rgba(255,255,255,0.06))`,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
    },
    secondaryBtn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
    },
    dangerBtn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.dangerBd}`,
      background: T.dangerBg,
      color: T.dangerTx,
      fontWeight: 950,
      cursor: "pointer",
    },
    dltBtn: {
      fontSize: 12,
      padding: "9px 12px",
      borderRadius: 14,
      border: `1px solid ${T.dangerBd}`,
      background: T.dangerBg,
      color: T.dangerTx,
      fontWeight: 950,
      cursor: "pointer",
      height: "fit-content",
    },

    kpiRow: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
    kpi: {
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.soft,
    },
    kpiLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiValue: { marginTop: 6, fontSize: 18, fontWeight: 950 },

    sectionTitle: { marginTop: 14, fontWeight: 950, fontSize: 13, color: T.text },

    split2: { marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    softBox: {
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.soft,
    },
    softTitle: { fontWeight: 950, marginBottom: 10 },

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

    alertGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
    alertCard: {
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.soft,
      display: "grid",
      gap: 6,
    },
    alertCount: { fontWeight: 950, fontSize: 22 },

    aiBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.okBd}`,
      background: T.okBg,
    },

    txCard: {
      padding: 12,
      borderRadius: 16,
      border: `1px solid ${T.border}`,
      background: T.soft,
    },

    pillOk: {
      padding: "5px 10px",
      borderRadius: 999,
      border: `1px solid ${T.okBd}`,
      background: T.okBg,
      color: T.okTx,
      fontWeight: 950,
      fontSize: 12,
    },
    pillWarn: {
      padding: "5px 10px",
      borderRadius: 999,
      border: `1px solid ${T.accentBd}`,
      background: T.accentBg,
      color: T.accentTx,
      fontWeight: 950,
      fontSize: 12,
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
