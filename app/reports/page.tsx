"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* STORAGE KEYS */
const EVENT_KEYS = ["eventura-events", "eventura_os_events_v1", "eventura_events_v1"];
const FIN_KEYS = ["eventura-finance-transactions", "eventura_os_fin_v1", "eventura_fin_v1", "eventura_os_fin_tx_v1"];
const HR_KEYS = ["eventura-hr-team", "eventura_os_hr_v1", "eventura_hr_v1", "eventura_os_hr_team_v2"];
const VENDOR_KEYS = ["eventura-vendors", "eventura_os_vendors_v1", "eventura_vendors_v1", "eventura-vendor-list"];
const LS_SETTINGS = "eventura_os_settings_v3";

/* TYPES */
type Theme = "Royal Gold" | "Ivory Light";
type AppSettings = { theme?: Theme; highContrast?: boolean; compactTables?: boolean };

type KeysInfo = { events: string | null; finance: string | null; hr: string | null; vendors: string | null };

type NormalEvent = { id: string; date: string; title: string; status: string };
type NormalTx = { id: string; date: string; type: "Income" | "Expense"; amount: number };

/* SAFE HELPERS */
function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadFirstKey<T>(keys: string[], fallback: T): { keyUsed: string | null; data: T } {
  if (typeof window === "undefined") return { keyUsed: null, data: fallback };
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    const parsed = safeParse<T>(raw, fallback);
    if (parsed && (Array.isArray(parsed) || typeof parsed === "object")) return { keyUsed: k, data: parsed };
  }
  return { keyUsed: null, data: fallback };
}

function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return safeParse<T>(localStorage.getItem(key), fallback);
}

function todayYMD(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function isoMinusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function inRange(dateStr: string, from: string, to: string) {
  if (!dateStr) return false;
  return dateStr >= from && dateStr <= to;
}

function formatCurrency(amount: number, currency: "INR" | "CAD" | "USD" = "INR") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* NORMALIZERS */
function normalizeEvents(raw: any): NormalEvent[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => ({
      id: String(x?.id ?? x?._id ?? `${x?.title ?? "event"}-${x?.date ?? ""}`),
      date: String(x?.date ?? x?.eventDate ?? ""),
      title: String(x?.title ?? x?.name ?? "Untitled"),
      status: String(x?.status ?? x?.stage ?? "Unknown"),
    }))
    .filter((e) => e.date && e.title);
}

function normalizeFinance(raw: any): NormalTx[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const t = String(x?.type ?? "").toLowerCase();
      return {
        id: String(x?.id ?? x?._id ?? `${x?.date ?? ""}-${x?.type ?? ""}-${x?.amount ?? ""}`),
        date: String(x?.date ?? x?.txDate ?? ""),
        type: t === "income" ? "Income" : "Expense",
        amount: Number(x?.amount ?? x?.value ?? 0) || 0,
      };
    })
    .filter((t) => t.date && t.amount > 0);
}

/* THEME */
function ThemeTokens(theme: Theme) {
  if (theme === "Ivory Light") {
    return {
      text: "#111827",
      muted: "#4B5563",
      bg: "#F9FAFB",
      panel: "rgba(255,255,255,0.92)",
      border: "rgba(17,24,39,0.12)",
      soft: "rgba(17,24,39,0.04)",
      accentBg: "rgba(212,175,55,0.18)",
      accentBd: "rgba(212,175,55,0.35)",
      accentTx: "#92400E",
      hoverBg: "rgba(0,0,0,0.08)",
    };
  }
  return {
    text: "#F9FAFB",
    muted: "#9CA3AF",
    bg: "#050816",
    panel: "rgba(11,16,32,0.75)",
    border: "rgba(255,255,255,0.10)",
    soft: "rgba(255,255,255,0.04)",
    accentBg: "rgba(212,175,55,0.12)",
    accentBd: "rgba(212,175,55,0.22)",
    accentTx: "#FDE68A",
    hoverBg: "rgba(0,0,0,0.65)", // ✅ hover black
  };
}

export default function ReportsPage() {
  const [settings, setSettings] = useState<AppSettings>({});
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");

  const [keysInfo, setKeysInfo] = useState<KeysInfo>({ events: null, finance: null, hr: null, vendors: null });

  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [rawFin, setRawFin] = useState<any[]>([]);
  const [rawHR, setRawHR] = useState<any[]>([]);
  const [rawVendors, setRawVendors] = useState<any[]>([]);

  const [from, setFrom] = useState(isoMinusDays(30));
  const [to, setTo] = useState(todayYMD());

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEmail(localStorage.getItem("eventura_email") || "");
    setSettings(safeLoad<AppSettings>(LS_SETTINGS, {}));
    refreshRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshRead() {
    const e = loadFirstKey<any[]>(EVENT_KEYS, []);
    const f = loadFirstKey<any[]>(FIN_KEYS, []);
    const h = loadFirstKey<any[]>(HR_KEYS, []);
    const v = loadFirstKey<any[]>(VENDOR_KEYS, []);

    setKeysInfo({ events: e.keyUsed, finance: f.keyUsed, hr: h.keyUsed, vendors: v.keyUsed });

    setRawEvents(Array.isArray(e.data) ? e.data : []);
    setRawFin(Array.isArray(f.data) ? f.data : []);
    setRawHR(Array.isArray(h.data) ? h.data : []);
    setRawVendors(Array.isArray(v.data) ? v.data : []);

    setMsg("✅ Refreshed");
    setTimeout(() => setMsg(""), 1200);
  }

  const theme: Theme = (settings.theme as Theme) || "Royal Gold";
  const T = ThemeTokens(theme);
  const S = useMemo(() => makeStyles(T), [T]);

  const events = useMemo(() => normalizeEvents(rawEvents), [rawEvents]);
  const txs = useMemo(() => normalizeFinance(rawFin), [rawFin]);

  const eventsInRange = useMemo(() => events.filter((e) => inRange(e.date, from, to)), [events, from, to]);
  const txsInRange = useMemo(() => txs.filter((t) => inRange(t.date, from, to)), [txs, from, to]);

  const finTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of txsInRange) {
      if (t.type === "Income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }, [txsInRange]);

  function exportBackup() {
    const payload = {
      version: "eventura_backup_v1",
      exportedAt: new Date().toISOString(),
      ownerEmail: email || "",
      data: {
        eventsRaw: rawEvents,
        financeRaw: rawFin,
        hrRaw: rawHR,
        vendorsRaw: rawVendors,
        settings: safeLoad<AppSettings>(LS_SETTINGS, {}),
      },
    };
    downloadFile(`eventura_backup_${todayYMD()}.json`, JSON.stringify(payload, null, 2), "application/json");
    setMsg("✅ Backup downloaded. Email it to yourself.");
    setTimeout(() => setMsg(""), 1800);
  }

  async function importBackupFile(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed?.data) throw new Error("Invalid backup file");

      localStorage.setItem(EVENT_KEYS[0], JSON.stringify(parsed.data.eventsRaw ?? []));
      localStorage.setItem(FIN_KEYS[0], JSON.stringify(parsed.data.financeRaw ?? []));
      localStorage.setItem(HR_KEYS[0], JSON.stringify(parsed.data.hrRaw ?? []));
      localStorage.setItem(VENDOR_KEYS[0], JSON.stringify(parsed.data.vendorsRaw ?? []));
      localStorage.setItem(LS_SETTINGS, JSON.stringify(parsed.data.settings ?? {}));

      setSettings(safeLoad<AppSettings>(LS_SETTINGS, {}));
      refreshRead();
      setMsg("✅ Restore done.");
      setTimeout(() => setMsg(""), 1800);
    } catch (e: any) {
      setMsg("❌ Restore failed: " + (e?.message || "Unknown error"));
      setTimeout(() => setMsg(""), 2200);
    }
  }

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          <div>
            <div style={S.brandName}>Eventura OS</div>
            <div style={S.brandSub}>Reports</div>
          </div>
        </div>

        <nav style={S.nav}>
          <Link href="/dashboard" style={S.navItem as any}>📊 Dashboard</Link>
          <Link href="/events" style={S.navItem as any}>📅 Events</Link>
          <Link href="/finance" style={S.navItem as any}>💰 Finance</Link>
          <Link href="/vendors" style={S.navItem as any}>🏷️ Vendors</Link>
          <Link href="/hr" style={S.navItem as any}>🧑‍🤝‍🧑 HR</Link>
          <Link href="/reports" style={{ ...(S.navItem as any), border: `1px solid ${T.accentBd}`, background: T.accentBg }}>
            📈 Reports
          </Link>
          <Link href="/settings" style={S.navItem as any}>⚙️ Settings</Link>
        </nav>

        <div style={S.sidebarFooter}>
          <div style={S.userBox}>
            <div style={S.userLabel}>Signed in</div>
            <div style={S.userEmail}>{email || "Unknown"}</div>
          </div>

          <div style={S.smallNote}>
            Keys:
            <div>Events: <b>{keysInfo.events ?? "not found"}</b></div>
            <div>Finance: <b>{keysInfo.finance ?? "not found"}</b></div>
            <div>HR: <b>{keysInfo.hr ?? "not found"}</b></div>
            <div>Vendors: <b>{keysInfo.vendors ?? "not found"}</b></div>
          </div>
        </div>
      </aside>

      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={S.h1}>Company Reports</div>
            <div style={S.muted}>Deploy-safe • LocalStorage • Easy Email Backup</div>
          </div>

          <div style={S.headerRight}>
            <button style={S.btn} onClick={refreshRead}>Refresh</button>
            <button style={S.btnGold} onClick={exportBackup}>Backup</button>

            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importBackupFile(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <button style={S.btn} onClick={() => fileRef.current?.click()}>Restore</button>
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        <div style={S.rangeBar}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={S.smallMuted}>From</div>
              <input style={S.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={S.smallMuted}>To</div>
              <input style={S.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>

        <div style={S.grid}>
          <section style={S.panel}>
            <div style={S.panelTitle}>KPIs</div>
            <div style={S.kpiRow}>
              <div style={S.kpi}><div style={S.kpiLabel}>Events</div><div style={S.kpiValue}>{eventsInRange.length}</div></div>
              <div style={S.kpi}><div style={S.kpiLabel}>Income</div><div style={S.kpiValue}>{formatCurrency(finTotals.income)}</div></div>
              <div style={S.kpi}><div style={S.kpiLabel}>Expense</div><div style={S.kpiValue}>{formatCurrency(finTotals.expense)}</div></div>
              <div style={S.kpi}><div style={S.kpiLabel}>Net</div><div style={S.kpiValue}>{formatCurrency(finTotals.net)}</div></div>
            </div>
          </section>

          <section style={S.panel}>
            <div style={S.panelTitle}>Email Backup (Simple)</div>
            <div style={S.smallNote}>
              1) Click <b>Backup</b> (downloads file)<br />
              2) Attach the file in Gmail and send to yourself<br />
              3) Later download it from Gmail and click <b>Restore</b>
            </div>
          </section>
        </div>

        <div style={S.footerNote}>✅ Safe for deploy • ✅ No backend • ✅ No env</div>
      </main>
    </div>
  );
}

/* STYLES */
function makeStyles(T: any): Record<string, React.CSSProperties> {
  return {
    app: { minHeight: "100vh", display: "flex", background: T.bg, color: T.text, fontFamily: "system-ui, Segoe UI, Roboto, Arial" },

    sidebar: { width: 280, position: "sticky", top: 0, height: "100vh", padding: 12, borderRight: `1px solid ${T.border}`, background: T.panel, display: "flex", flexDirection: "column", gap: 12 },
    brandRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 8px" },
    logoCircle: { width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", fontWeight: 950, background: T.accentBg, border: `1px solid ${T.accentBd}`, color: T.accentTx },
    brandName: { fontWeight: 950, lineHeight: 1.1 },
    brandSub: { color: T.muted, fontSize: 12, marginTop: 2 },

    nav: { display: "grid", gap: 8 },
    navItem: { display: "block", padding: "10px 12px", borderRadius: 14, textDecoration: "none", color: T.text, border: `1px solid ${T.border}`, background: T.soft, fontWeight: 900, fontSize: 13 },

    sidebarFooter: { marginTop: "auto", display: "grid", gap: 10 },
    userBox: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    userLabel: { fontSize: 12, color: T.muted, fontWeight: 900 },
    userEmail: { fontSize: 13, fontWeight: 900, marginTop: 6, wordBreak: "break-word" },
    smallMuted: { color: T.muted, fontSize: 12 },
    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35 },

    main: { flex: 1, padding: 16, maxWidth: 1200, margin: "0 auto", width: "100%" },
    header: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: 12, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel },
    headerRight: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },

    h1: { fontSize: 26, fontWeight: 950 },
    muted: { color: T.muted, fontSize: 13, marginTop: 6 },

    msg: { marginTop: 12, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontSize: 13 },
    rangeBar: { marginTop: 12, padding: 12, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft, display: "grid", gap: 10 },

    input: { width: 210, padding: "12px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, outline: "none", fontSize: 14 },

    btn: { padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontWeight: 950, cursor: "pointer" },
    btnGold: { padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, cursor: "pointer" },

    grid: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    panel: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    kpiRow: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 },
    kpi: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    kpiLabel: { color: T.muted, fontSize: 12, fontWeight: 900 },
    kpiValue: { marginTop: 6, fontSize: 18, fontWeight: 950 },

    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 10 },
  };
}
