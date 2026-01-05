"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ===== storage keys (NO UI debug shown) ===== */
const LS_EMAIL = "eventura_email";
const LS_SETTINGS = "eventura_os_settings_v3";

const EVENT_KEYS = ["eventura-events", "eventura_os_events_v1", "eventura_events_v1"];
const FIN_KEYS = ["eventura-finance-transactions", "eventura_os_fin_v1", "eventura_fin_v1", "eventura_os_fin_tx_v1"];
const HR_KEYS = ["eventura-hr-team", "eventura_os_hr_v1", "eventura_hr_v1", "eventura_os_hr_team_v2"];
const VENDOR_KEYS = ["eventura-vendors", "eventura_os_vendors_v1", "eventura_vendors_v1", "eventura-vendor-list"];

/* ===== types ===== */
type Theme =
  | "Royal Gold"
  | "Midnight Purple"
  | "Emerald Night"
  | "Ocean Blue"
  | "Ruby Noir"
  | "Carbon Black"
  | "Ivory Light";

type AppSettings = {
  theme?: Theme;
  highContrast?: boolean;
  compactTables?: boolean;
  hoverDark?: boolean;
  ceoEmail?: string;
};

type NormalEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  status: string;
  city?: string;
  budget?: number;
};

type NormalTx = {
  id: string;
  date: string; // YYYY-MM-DD
  type: "Income" | "Expense";
  amount: number;
  category?: string;
  note?: string;
  vendor?: string;
};

type NormalStaff = {
  id: string;
  name: string;
  role?: string;
  status?: string;
  city?: string;
  workload?: number;
  monthlySalary?: number;
  rating?: number;
};

type NormalVendor = {
  id: string;
  name: string;
  category?: string;
  city?: string;
  phone?: string;
  rating?: number;
  status?: string;
};

/* ===== helpers ===== */
function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadFirstKey<T>(keys: string[], fallback: T): T {
  if (typeof window === "undefined") return fallback;
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (!raw) continue;
    const parsed = safeParse<T>(raw, fallback);
    if (parsed && (Array.isArray(parsed) || typeof parsed === "object")) return parsed;
  }
  return fallback;
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
  return dateStr >= from && dateStr <= to; // YYYY-MM-DD safe lexicographic
}

function formatCurrency(amount: number, currency: "INR" | "CAD" | "USD" = "INR") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/* ===== normalizers ===== */
function normalizeEvents(raw: any): NormalEvent[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? `${x?.title ?? x?.name ?? "event"}-${x?.date ?? ""}`);
      const date = String(x?.date ?? x?.eventDate ?? "");
      const title = String(x?.title ?? x?.name ?? x?.eventName ?? "Untitled");
      const status = String(x?.status ?? x?.stage ?? "Unknown");
      const city = x?.city ? String(x.city) : undefined;
      const budget = Number.isFinite(Number(x?.budget)) ? Number(x.budget) : undefined;
      return { id, date, title, status, city, budget };
    })
    .filter((e) => e.date && e.title);
}

function normalizeFinance(raw: any): NormalTx[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? `${x?.date ?? ""}-${x?.type ?? ""}-${x?.amount ?? ""}`);
      const date = String(x?.date ?? x?.txDate ?? "");
      const t = String(x?.type ?? "").toLowerCase();
      const type: "Income" | "Expense" = t === "income" ? "Income" : "Expense";
      const amount = Number(x?.amount ?? x?.value ?? 0);
      const category = x?.category ? String(x.category) : undefined;
      const note = x?.note ? String(x.note) : undefined;
      const vendor = x?.vendor ? String(x.vendor) : undefined;
      return { id, date, type, amount: Number.isFinite(amount) ? amount : 0, category, note, vendor };
    })
    .filter((t) => t.date && t.amount > 0);
}

function normalizeHR(raw: any): NormalStaff[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? x?.name ?? Math.random().toString(16).slice(2));
      const name = String(x?.name ?? x?.fullName ?? "Unknown");
      const role = x?.role ? String(x.role) : undefined;
      const status = x?.status ? String(x.status) : undefined;
      const city = x?.city ? String(x.city) : undefined;
      const workload = Number.isFinite(Number(x?.workload)) ? Number(x.workload) : undefined;
      const monthlySalary = Number.isFinite(Number(x?.monthlySalary)) ? Number(x.monthlySalary) : undefined;
      const rating = Number.isFinite(Number(x?.rating)) ? Number(x.rating) : undefined;
      return { id, name, role, status, city, workload, monthlySalary, rating };
    })
    .filter((m) => m.name);
}

function normalizeVendors(raw: any): NormalVendor[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((x) => {
      const id = String(x?.id ?? x?._id ?? x?.name ?? Math.random().toString(16).slice(2));
      const name = String(x?.name ?? x?.vendorName ?? "Vendor");
      const category = x?.category ? String(x.category) : undefined;
      const city = x?.city ? String(x.city) : undefined;
      const phone = x?.phone ? String(x.phone) : undefined;
      const rating = Number.isFinite(Number(x?.rating)) ? Number(x.rating) : undefined;
      const status = x?.status ? String(x.status) : undefined;
      return { id, name, category, city, phone, rating, status };
    })
    .filter((v) => v.name);
}

/* ===== corporate tokens (less “game”, more business) ===== */
function tokens(theme: Theme = "Royal Gold", highContrast?: boolean) {
  const hc = !!highContrast;
  const base = {
    text: "#0B1220",
    muted: "#5B6472",
    bg: "#F3F5F8",
    panel: "#FFFFFF",
    border: hc ? "rgba(15,23,42,0.28)" : "rgba(15,23,42,0.14)",
    soft: "rgba(15,23,42,0.04)",
    shadow: "0 10px 30px rgba(15,23,42,0.08)",
    hover: "rgba(0,0,0,0.06)",
    hoverBlack: "rgba(0,0,0,0.10)",
    accent: "#B8922B",
    accentSoft: "rgba(184,146,43,0.12)",
    good: "#166534",
    warn: "#92400E",
    bad: "#B91C1C",
  };

  // keep your themes but still corporate
  if (theme === "Carbon Black") {
    return {
      ...base,
      text: "#F8FAFC",
      muted: "#94A3B8",
      bg: "#070A12",
      panel: "rgba(17,24,39,0.85)",
      border: hc ? "rgba(255,255,255,0.26)" : "rgba(255,255,255,0.12)",
      soft: "rgba(255,255,255,0.05)",
      shadow: "0 12px 36px rgba(0,0,0,0.50)",
      hover: "rgba(255,255,255,0.06)",
      hoverBlack: "rgba(0,0,0,0.55)",
      accent: "#D4AF37",
      accentSoft: "rgba(212,175,55,0.14)",
      good: "#86EFAC",
      warn: "#FCD34D",
      bad: "#FCA5A5",
    };
  }

  if (theme === "Ivory Light") return base;

  // other themes just adjust accent
  const accentMap: Record<string, string> = {
    "Royal Gold": "#B8922B",
    "Midnight Purple": "#6D28D9",
    "Emerald Night": "#059669",
    "Ocean Blue": "#2563EB",
    "Ruby Noir": "#E11D48",
  };
  const a = accentMap[theme] || base.accent;
  return { ...base, accent: a, accentSoft: hexToRgba(a, 0.12) };
}

function hexToRgba(hex: string, a: number) {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

/* ===== UI bits ===== */
function Pill({ text, tone, S }: { text: string; tone: "good" | "warn" | "bad" | "neutral"; S: Record<string, CSSProperties> }) {
  const st =
    tone === "good"
      ? S.pillGood
      : tone === "warn"
      ? S.pillWarn
      : tone === "bad"
      ? S.pillBad
      : S.pill;
  return <span style={st}>{text}</span>;
}

function StatCard({ title, value, sub, S }: { title: string; value: string; sub?: string; S: Record<string, CSSProperties> }) {
  return (
    <div style={S.statCard}>
      <div style={S.statTitle}>{title}</div>
      <div style={S.statValue}>{value}</div>
      {sub ? <div style={S.statSub}>{sub}</div> : null}
    </div>
  );
}

export default function DashboardPage() {
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<AppSettings>({});
  const [range, setRange] = useState<{ from: string; to: string }>({ from: isoMinusDays(30), to: todayYMD() });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEmail(localStorage.getItem(LS_EMAIL) || "");
    setSettings(safeParse<AppSettings>(localStorage.getItem(LS_SETTINGS), {}));
  }, []);

  const T = tokens((settings.theme as Theme) || "Ivory Light", settings.highContrast);
  const S = useMemo(() => makeStyles(T, settings.hoverDark !== false), [T, settings.hoverDark]);

  const rawEvents = useMemo(() => loadFirstKey<any[]>(EVENT_KEYS, []), []);
  const rawFin = useMemo(() => loadFirstKey<any[]>(FIN_KEYS, []), []);
  const rawHR = useMemo(() => loadFirstKey<any[]>(HR_KEYS, []), []);
  const rawVendors = useMemo(() => loadFirstKey<any[]>(VENDOR_KEYS, []), []);

  const events = useMemo(() => normalizeEvents(rawEvents), [rawEvents]);
  const txs = useMemo(() => normalizeFinance(rawFin), [rawFin]);
  const team = useMemo(() => normalizeHR(rawHR), [rawHR]);
  const vendors = useMemo(() => normalizeVendors(rawVendors), [rawVendors]);

  const isCEO = useMemo(() => {
    const ceo = (settings.ceoEmail || "hardikvekariya799@gmail.com").toLowerCase();
    return (email || "").toLowerCase() === ceo;
  }, [email, settings.ceoEmail]);

  const eventsInRange = useMemo(
    () => events.filter((e) => inRange(e.date, range.from, range.to)),
    [events, range.from, range.to]
  );
  const txsInRange = useMemo(
    () => txs.filter((t) => inRange(t.date, range.from, range.to)),
    [txs, range.from, range.to]
  );

  const finance = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of txsInRange) {
      if (t.type === "Income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }, [txsInRange]);

  const pipeline = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of eventsInRange) {
      const k = (e.status || "Unknown").trim() || "Unknown";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [eventsInRange]);

  const hr = useMemo(() => {
    const total = team.length;
    const active = team.filter((m) => String(m.status || "").toLowerCase() !== "inactive").length;
    const avgWorkload = total ? Math.round((team.reduce((a, b) => a + (b.workload ?? 0), 0) / total) * 10) / 10 : 0;
    const highLoad = team.filter((m) => (m.workload ?? 0) >= 80).length;
    return { total, active, avgWorkload, highLoad };
  }, [team]);

  const vendor = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter((v) => String(v.status || "").toLowerCase() !== "inactive").length;
    const rated = vendors.filter((v) => Number.isFinite(v.rating as any));
    const avgRating = rated.length ? +(rated.reduce((a, b) => a + (b.rating ?? 0), 0) / rated.length).toFixed(1) : 0;
    return { total, active, avgRating };
  }, [vendors]);

  const health = useMemo(() => {
    const risks: string[] = [];
    if (finance.net < 0) risks.push("Negative net cashflow in selected range");
    if (hr.highLoad > 0) risks.push(`High workload: ${hr.highLoad} team member(s)`);
    const unconfirmed = pipeline.find(([s]) => s.toLowerCase().includes("tent") || s.toLowerCase().includes("plan"));
    if (unconfirmed && unconfirmed[1] >= 3) risks.push("Many events are still tentative/planned");
    return risks;
  }, [finance.net, hr.highLoad, pipeline]);

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={S.brand}>
          <div style={S.brandLogo}>Eventura</div>
          <div style={S.brandTag}>Management Console</div>
        </div>

        <div style={S.nav}>
          <Link href="/dashboard" style={S.navItemActive as any}>Dashboard</Link>
          <Link href="/events" style={S.navItem as any}>Events</Link>
          <Link href="/finance" style={S.navItem as any}>Finance</Link>
          <Link href="/vendors" style={S.navItem as any}>Vendors</Link>
          <Link href="/hr" style={S.navItem as any}>HR</Link>
          <Link href="/reports" style={S.navItem as any}>Reports</Link>
          <Link href="/settings" style={S.navItem as any}>Settings</Link>
        </div>

        <div style={S.sideFooter}>
          <div style={S.identityCard}>
            <div style={S.identityTop}>
              <div style={S.avatar}>{(email || "E").slice(0, 1).toUpperCase()}</div>
              <div>
                <div style={S.identityName}>{isCEO ? "Hardik Vekariya" : "Team Member"}</div>
                <div style={S.identitySub}>{email || "Not signed in"}</div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <Pill text={isCEO ? "CEO Access" : "Staff Access"} tone={isCEO ? "good" : "neutral"} S={S} />
            </div>
          </div>
        </div>
      </aside>

      <main style={S.main}>
        <div style={S.topbar}>
          <div>
            <div style={S.pageTitle}>Dashboard</div>
            <div style={S.pageSub}>Company overview • quick decisions • action-focused</div>
          </div>

          <div style={S.range}>
            <div style={S.rangeItem}>
              <div style={S.smallLabel}>From</div>
              <input
                type="date"
                value={range.from}
                onChange={(e) => setRange((p) => ({ ...p, from: e.target.value }))}
                style={S.input}
              />
            </div>
            <div style={S.rangeItem}>
              <div style={S.smallLabel}>To</div>
              <input
                type="date"
                value={range.to}
                onChange={(e) => setRange((p) => ({ ...p, to: e.target.value }))}
                style={S.input}
              />
            </div>
          </div>
        </div>

        <div style={S.statsGrid}>
          <StatCard title="Events (range)" value={String(eventsInRange.length)} sub="Total scheduled in range" S={S} />
          <StatCard title="Net Cashflow" value={formatCurrency(finance.net)} sub={`Income ${formatCurrency(finance.income)} • Expense ${formatCurrency(finance.expense)}`} S={S} />
          <StatCard title="Team" value={`${hr.active}/${hr.total}`} sub={`Avg workload ${hr.avgWorkload}%`} S={S} />
          <StatCard title="Vendors" value={String(vendor.total)} sub={vendor.avgRating ? `Avg rating ${vendor.avgRating}` : "No ratings yet"} S={S} />
        </div>

        <div style={S.contentGrid}>
          {/* Left: pipeline + risks */}
          <section style={S.panel}>
            <div style={S.panelHeader}>
              <div style={S.panelTitle}>Event Pipeline</div>
              <div style={S.panelHint}>Status breakdown (range)</div>
            </div>

            {pipeline.length ? (
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                {pipeline.slice(0, 8).map(([st, c]) => {
                  const max = pipeline[0]?.[1] ?? c;
                  const pct = max ? Math.round((c / max) * 100) : 0;
                  const tone =
                    st.toLowerCase().includes("complete") ? "good" :
                    st.toLowerCase().includes("cancel") ? "bad" :
                    st.toLowerCase().includes("tent") || st.toLowerCase().includes("plan") ? "warn" : "neutral";
                  return (
                    <div key={st} style={S.row}>
                      <div style={S.rowLeft}>
                        <div style={S.rowTitle}>{st}</div>
                        <Pill text={`${c}`} tone={tone as any} S={S} />
                      </div>
                      <div style={S.barWrap}>
                        <div style={{ ...S.barFill, width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={S.empty}>No events found in this range.</div>
            )}

            <div style={S.divider} />

            <div style={S.panelHeader}>
              <div style={S.panelTitle}>Attention</div>
              <div style={S.panelHint}>Auto insights (safe rules)</div>
            </div>

            {health.length ? (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {health.map((r) => (
                  <div key={r} style={S.alertWarn}>
                    {r}
                  </div>
                ))}
              </div>
            ) : (
              <div style={S.alertGood}>No major risks detected for this range.</div>
            )}
          </section>

          {/* Right: recent activity */}
          <section style={S.panel}>
            <div style={S.panelHeader}>
              <div style={S.panelTitle}>Recent Activity</div>
              <div style={S.panelHint}>Latest events & transactions</div>
            </div>

            <div style={S.twoCol}>
              <div>
                <div style={S.blockTitle}>Recent Events</div>
                {eventsInRange.length ? (
                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {eventsInRange
                      .slice()
                      .sort((a, b) => (a.date < b.date ? 1 : -1))
                      .slice(0, 6)
                      .map((e) => (
                        <div key={e.id} style={S.item}>
                          <div style={S.itemTop}>
                            <div style={S.itemTitle}>{e.title}</div>
                            <Pill
                              text={e.status}
                              tone={
                                e.status.toLowerCase().includes("complete")
                                  ? "good"
                                  : e.status.toLowerCase().includes("cancel")
                                  ? "bad"
                                  : e.status.toLowerCase().includes("tent") || e.status.toLowerCase().includes("plan")
                                  ? "warn"
                                  : "neutral"
                              }
                              S={S}
                            />
                          </div>
                          <div style={S.itemSub}>
                            {e.date} • {e.city || "—"} {typeof e.budget === "number" ? `• Budget ${formatCurrency(e.budget)}` : ""}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div style={S.empty}>No events yet.</div>
                )}
              </div>

              <div>
                <div style={S.blockTitle}>Recent Finance</div>
                {txsInRange.length ? (
                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {txsInRange
                      .slice()
                      .sort((a, b) => (a.date < b.date ? 1 : -1))
                      .slice(0, 6)
                      .map((t) => (
                        <div key={t.id} style={S.item}>
                          <div style={S.itemTop}>
                            <div style={S.itemTitle}>
                              {t.type} • {t.category || "General"}
                            </div>
                            <Pill text={formatCurrency(t.amount)} tone={t.type === "Income" ? "good" : "warn"} S={S} />
                          </div>
                          <div style={S.itemSub}>
                            {t.date} {t.vendor ? `• ${t.vendor}` : ""} {t.note ? `• ${t.note}` : ""}
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div style={S.empty}>No transactions yet.</div>
                )}
              </div>
            </div>

            <div style={S.divider} />

            <div style={S.quickActions}>
              <div style={S.panelHeader}>
                <div style={S.panelTitle}>Quick Actions</div>
                <div style={S.panelHint}>Jump to modules</div>
              </div>

              <div style={S.actionGrid}>
                <Link href="/events" style={S.action as any}>Create / Update Events</Link>
                <Link href="/finance" style={S.action as any}>Add Income / Expense</Link>
                <Link href="/vendors" style={S.action as any}>Manage Vendors</Link>
                <Link href="/hr" style={S.action as any}>Team & Workload</Link>
              </div>
            </div>
          </section>
        </div>

        <div style={S.footer}>Eventura • Founder: Hardik Vekariya • Co-Founder: Shubh Parekh • Digital Head: Dixit Bhuva</div>
      </main>
    </div>
  );
}

/* ===== styles ===== */
function makeStyles(T: any, hoverBlack: boolean): Record<string, CSSProperties> {
  const hoverBg = hoverBlack ? T.hoverBlack : T.hover;

  return {
    app: {
      minHeight: "100vh",
      display: "flex",
      background: T.bg,
      color: T.text,
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
    },

    sidebar: {
      width: 280,
      borderRight: `1px solid ${T.border}`,
      background: T.panel,
      padding: 18,
      display: "flex",
      flexDirection: "column",
      gap: 16,
    },

    brand: { paddingBottom: 10, borderBottom: `1px solid ${T.border}` },
    brandLogo: { fontSize: 18, fontWeight: 950, letterSpacing: 0.2, color: T.text },
    brandTag: { marginTop: 4, fontSize: 12, color: T.muted, fontWeight: 700 },

    nav: { display: "grid", gap: 8 },
    navItem: {
      padding: "12px 12px",
      borderRadius: 12,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.border}`,
      background: "transparent",
      fontWeight: 850,
      fontSize: 13,
      transition: "background 120ms ease",
    },
    navItemActive: {
      padding: "12px 12px",
      borderRadius: 12,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.border}`,
      background: T.accentSoft,
      fontWeight: 950,
      fontSize: 13,
    },

    sideFooter: { marginTop: "auto" },
    identityCard: {
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: 14,
      background: T.soft,
    },
    identityTop: { display: "flex", gap: 12, alignItems: "center" },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 12,
      display: "grid",
      placeItems: "center",
      fontWeight: 950,
      background: T.accentSoft,
      color: T.text,
      border: `1px solid ${T.border}`,
    },
    identityName: { fontWeight: 950, fontSize: 13 },
    identitySub: { fontSize: 12, color: T.muted, marginTop: 2 },

    main: { flex: 1, padding: 22, maxWidth: 1400, margin: "0 auto", width: "100%" },

    topbar: {
      display: "flex",
      justifyContent: "space-between",
      gap: 14,
      alignItems: "flex-start",
      padding: 16,
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel,
      boxShadow: T.shadow,
    },

    pageTitle: { fontSize: 22, fontWeight: 950 },
    pageSub: { marginTop: 6, color: T.muted, fontSize: 13, fontWeight: 650 },

    range: { display: "flex", gap: 10, flexWrap: "wrap" },
    rangeItem: { display: "grid", gap: 6 },
    smallLabel: { fontSize: 12, color: T.muted, fontWeight: 800 },

    input: {
      padding: "10px 12px",
      borderRadius: 12,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      outline: "none",
      fontSize: 13,
    },

    statsGrid: {
      marginTop: 14,
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: 12,
    },
    statCard: {
      padding: 14,
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel,
      boxShadow: T.shadow,
    },
    statTitle: { fontSize: 12, color: T.muted, fontWeight: 900 },
    statValue: { marginTop: 8, fontSize: 20, fontWeight: 950, letterSpacing: 0.2 },
    statSub: { marginTop: 6, fontSize: 12, color: T.muted, fontWeight: 700 },

    contentGrid: {
      marginTop: 14,
      display: "grid",
      gridTemplateColumns: "1fr 1.35fr",
      gap: 12,
      alignItems: "start",
    },

    panel: {
      padding: 16,
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel,
      boxShadow: T.shadow,
    },
    panelHeader: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" },
    panelTitle: { fontWeight: 950, fontSize: 14 },
    panelHint: { color: T.muted, fontSize: 12, fontWeight: 700 },

    row: {
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: "10px 12px",
      background: T.soft,
    },
    rowLeft: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
    rowTitle: { fontWeight: 900, fontSize: 13 },

    barWrap: { marginTop: 10, height: 8, borderRadius: 999, background: "rgba(0,0,0,0.08)", overflow: "hidden" },
    barFill: { height: "100%", borderRadius: 999, background: T.accent },

    divider: { height: 1, background: T.border, margin: "14px 0" },

    twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 },

    blockTitle: { fontWeight: 950, fontSize: 13 },
    item: {
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: "10px 12px",
      background: T.soft,
      transition: "background 120ms ease",
    },
    itemTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
    itemTitle: { fontWeight: 900, fontSize: 13 },
    itemSub: { marginTop: 6, color: T.muted, fontSize: 12, fontWeight: 650 },

    empty: { marginTop: 10, color: T.muted, fontWeight: 700, fontSize: 13 },

    pill: {
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 900,
      border: `1px solid ${T.border}`,
      background: "transparent",
      whiteSpace: "nowrap",
    },
    pillGood: { padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900, border: `1px solid ${T.border}`, background: "rgba(22,101,52,0.10)", color: T.good, whiteSpace: "nowrap" },
    pillWarn: { padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900, border: `1px solid ${T.border}`, background: "rgba(146,64,14,0.10)", color: T.warn, whiteSpace: "nowrap" },
    pillBad: { padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 900, border: `1px solid ${T.border}`, background: "rgba(185,28,28,0.10)", color: T.bad, whiteSpace: "nowrap" },

    alertWarn: {
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: "10px 12px",
      background: "rgba(146,64,14,0.08)",
      color: T.text,
      fontWeight: 800,
      fontSize: 13,
    },
    alertGood: {
      marginTop: 12,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: "10px 12px",
      background: "rgba(22,101,52,0.08)",
      color: T.text,
      fontWeight: 800,
      fontSize: 13,
    },

    quickActions: {},
    actionGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
    action: {
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: "12px 12px",
      background: T.accentSoft,
      textDecoration: "none",
      color: T.text,
      fontWeight: 950,
      fontSize: 13,
      transition: "background 120ms ease",
    },

    footer: { marginTop: 16, textAlign: "center", color: T.muted, fontSize: 12, fontWeight: 700 },

    /* hover effects (BLACK hover option) */
    // applied by inline pseudo? we simulate via onMouse in next step if needed.
    // For now: use background blocks, and your browser will still look clean.
  };
}
