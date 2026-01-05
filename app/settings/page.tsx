"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ================== STORAGE KEYS (same across app) ================== */
const LS_EMAIL = "eventura_email";
const LS_ROLE = "eventura_role"; // optional if you store it
const LS_SETTINGS = "eventura_os_settings_v3";

// Data keys used by other tabs (for backup/export only)
const EVENT_KEYS = ["eventura-events", "eventura_os_events_v1", "eventura_events_v1"];
const FIN_KEYS = ["eventura-finance-transactions", "eventura_os_fin_v1", "eventura_fin_v1", "eventura_os_fin_tx_v1"];
const HR_KEYS = ["eventura-hr-team", "eventura_os_hr_v1", "eventura_hr_v1", "eventura_os_hr_team_v2"];
const VENDOR_KEYS = ["eventura-vendors", "eventura_os_vendors_v1", "eventura_vendors_v1", "eventura-vendor-list"];

/* ================== TYPES ================== */
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

  // Access
  ceoEmail?: string;
  staffEmail?: string;

  // UI prefs
  hoverDark?: boolean; // hover background black instead of transparent
};

/* ================== HELPERS ================== */
function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return safeParse<T>(localStorage.getItem(key), fallback);
}

function safeSave(key: string, value: any) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function loadFirstKey(keys: string[]) {
  if (typeof window === "undefined") return { keyUsed: null as string | null, raw: null as string | null };
  for (const k of keys) {
    const raw = localStorage.getItem(k);
    if (raw) return { keyUsed: k, raw };
  }
  return { keyUsed: null, raw: null };
}

function downloadJSON(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================== THEME TOKENS ================== */
function ThemeTokens(theme: Theme = "Royal Gold", highContrast?: boolean) {
  const hc = !!highContrast;

  const base = {
    text: "#F9FAFB",
    muted: "#9CA3AF",
    bg: "#050816",
    panel: "rgba(11,16,32,0.70)",
    panel2: "rgba(11,16,32,0.88)",
    border: hc ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)",
    soft: hc ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
    inputBg: hc ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.07)",
    okBg: "rgba(34,197,94,0.12)",
    okBd: hc ? "rgba(34,197,94,0.50)" : "rgba(34,197,94,0.28)",
    okTx: "#86EFAC",
    warnBg: "rgba(245,158,11,0.12)",
    warnBd: hc ? "rgba(245,158,11,0.50)" : "rgba(245,158,11,0.28)",
    warnTx: "#FCD34D",
  };

  switch (theme) {
    case "Midnight Purple":
      return {
        ...base,
        glow1: "rgba(139,92,246,0.24)",
        glow2: "rgba(212,175,55,0.14)",
        accentBg: "rgba(139,92,246,0.18)",
        accentBd: hc ? "rgba(139,92,246,0.60)" : "rgba(139,92,246,0.32)",
        accentTx: "#DDD6FE",
      };
    case "Emerald Night":
      return {
        ...base,
        glow1: "rgba(16,185,129,0.20)",
        glow2: "rgba(212,175,55,0.12)",
        accentBg: "rgba(16,185,129,0.18)",
        accentBd: hc ? "rgba(16,185,129,0.60)" : "rgba(16,185,129,0.32)",
        accentTx: "#A7F3D0",
      };
    case "Ocean Blue":
      return {
        ...base,
        glow1: "rgba(59,130,246,0.24)",
        glow2: "rgba(34,211,238,0.14)",
        accentBg: "rgba(59,130,246,0.18)",
        accentBd: hc ? "rgba(59,130,246,0.60)" : "rgba(59,130,246,0.32)",
        accentTx: "#BFDBFE",
      };
    case "Ruby Noir":
      return {
        ...base,
        glow1: "rgba(244,63,94,0.20)",
        glow2: "rgba(212,175,55,0.10)",
        accentBg: "rgba(244,63,94,0.16)",
        accentBd: hc ? "rgba(244,63,94,0.56)" : "rgba(244,63,94,0.28)",
        accentTx: "#FDA4AF",
      };
    case "Carbon Black":
      return {
        ...base,
        bg: "#03040A",
        glow1: "rgba(255,255,255,0.10)",
        glow2: "rgba(212,175,55,0.10)",
        accentBg: "rgba(212,175,55,0.16)",
        accentBd: hc ? "rgba(212,175,55,0.60)" : "rgba(212,175,55,0.30)",
        accentTx: "#FDE68A",
      };
    case "Ivory Light":
      return {
        ...base,
        text: "#111827",
        muted: "#4B5563",
        bg: "#F9FAFB",
        panel: "rgba(255,255,255,0.80)",
        panel2: "rgba(255,255,255,0.92)",
        border: hc ? "rgba(17,24,39,0.22)" : "rgba(17,24,39,0.12)",
        soft: hc ? "rgba(17,24,39,0.08)" : "rgba(17,24,39,0.05)",
        inputBg: hc ? "rgba(17,24,39,0.10)" : "rgba(17,24,39,0.06)",
        glow1: "rgba(212,175,55,0.16)",
        glow2: "rgba(59,130,246,0.14)",
        accentBg: "rgba(212,175,55,0.20)",
        accentBd: hc ? "rgba(212,175,55,0.60)" : "rgba(212,175,55,0.30)",
        accentTx: "#92400E",
        okTx: "#166534",
      };
    default:
      return {
        ...base,
        glow1: "rgba(255,215,110,0.18)",
        glow2: "rgba(120,70,255,0.18)",
        accentBg: "rgba(212,175,55,0.14)",
        accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.26)",
        accentTx: "#FDE68A",
      };
  }
}

/* ================== PAGE ================== */
export default function SettingsPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"CEO" | "Staff">("Staff");

  const [settings, setSettings] = useState<AppSettings>({
    theme: "Royal Gold",
    highContrast: false,
    compactTables: false,
    hoverDark: true,
    ceoEmail: "hardikvekariya799@gmail.com",
    staffEmail: "eventurastaff@gmail.com",
  });

  const [msg, setMsg] = useState("");

  useEffect(() => {
    const em = (localStorage.getItem(LS_EMAIL) || "").trim();
    setEmail(em);

    const storedRole = (localStorage.getItem(LS_ROLE) || "").toLowerCase();
    const isCeoByEmail = em.toLowerCase() === "hardikvekariya799@gmail.com";
    setRole(isCeoByEmail || storedRole === "ceo" ? "CEO" : "Staff");

    const s = safeLoad<AppSettings>(LS_SETTINGS, {});
    setSettings((prev) => ({
      ...prev,
      ...s,
      ceoEmail: s.ceoEmail || prev.ceoEmail,
      staffEmail: s.staffEmail || prev.staffEmail,
    }));
  }, []);

  const isCEO = useMemo(() => email.toLowerCase() === (settings.ceoEmail || "hardikvekariya799@gmail.com").toLowerCase(), [email, settings.ceoEmail]);

  const T = ThemeTokens((settings.theme as Theme) || "Royal Gold", settings.highContrast);
  const S = useMemo(() => makeStyles(T), [T]);

  function saveSettings(next: AppSettings) {
    setSettings(next);
    safeSave(LS_SETTINGS, next);
    setMsg("✅ Settings saved");
    window.setTimeout(() => setMsg(""), 1200);
  }

  function exportBackup() {
    // Pull latest raw data from LS (first existing key)
    const ev = loadFirstKey(EVENT_KEYS);
    const fi = loadFirstKey(FIN_KEYS);
    const hr = loadFirstKey(HR_KEYS);
    const ve = loadFirstKey(VENDOR_KEYS);

    const payload = {
      version: "eventura_local_backup_v1",
      exportedAt: new Date().toISOString(),
      accountEmail: email || "unknown",
      settings,
      keysUsed: {
        events: ev.keyUsed,
        finance: fi.keyUsed,
        hr: hr.keyUsed,
        vendors: ve.keyUsed,
      },
      raw: {
        events: ev.raw ? safeParse<any>(ev.raw, []) : [],
        finance: fi.raw ? safeParse<any>(fi.raw, []) : [],
        hr: hr.raw ? safeParse<any>(hr.raw, []) : [],
        vendors: ve.raw ? safeParse<any>(ve.raw, []) : [],
      },
    };

    downloadJSON(`eventura_backup_${new Date().toISOString().slice(0, 10)}.json`, payload);
    setMsg("✅ Backup exported (JSON)");
    window.setTimeout(() => setMsg(""), 1200);
  }

  function importBackup(file: File | null) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result || "{}"));

        // restore settings
        if (obj?.settings && typeof obj.settings === "object") {
          const next = { ...settings, ...obj.settings };
          safeSave(LS_SETTINGS, next);
          setSettings(next);
        }

        // restore raw data into the PRIMARY keys (first in list) to keep app consistent
        if (obj?.raw?.events) localStorage.setItem(EVENT_KEYS[0], JSON.stringify(obj.raw.events));
        if (obj?.raw?.finance) localStorage.setItem(FIN_KEYS[0], JSON.stringify(obj.raw.finance));
        if (obj?.raw?.hr) localStorage.setItem(HR_KEYS[0], JSON.stringify(obj.raw.hr));
        if (obj?.raw?.vendors) localStorage.setItem(VENDOR_KEYS[0], JSON.stringify(obj.raw.vendors));

        setMsg("✅ Backup imported (data restored)");
        window.setTimeout(() => setMsg(""), 1400);
      } catch {
        setMsg("❌ Invalid backup file");
        window.setTimeout(() => setMsg(""), 1600);
      }
    };
    reader.readAsText(file);
  }

  function clearLocalData() {
    if (!isCEO) {
      setMsg("❌ Only CEO can clear data");
      window.setTimeout(() => setMsg(""), 1500);
      return;
    }
    const ok = window.confirm("This will clear Events/Finance/HR/Vendors data in THIS browser only. Continue?");
    if (!ok) return;

    // Clear known keys only (safe)
    for (const k of [...EVENT_KEYS, ...FIN_KEYS, ...HR_KEYS, ...VENDOR_KEYS]) localStorage.removeItem(k);

    setMsg("✅ Cleared local data (this device)");
    window.setTimeout(() => setMsg(""), 1400);
  }

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          <div>
            <div style={S.brandName}>Eventura OS</div>
            <div style={S.brandSub}>Settings</div>
          </div>
        </div>

        <nav style={S.nav}>
          <Link href="/dashboard" style={S.navItem as any}>📊 Dashboard</Link>
          <Link href="/events" style={S.navItem as any}>📅 Events</Link>
          <Link href="/finance" style={S.navItem as any}>💰 Finance</Link>
          <Link href="/vendors" style={S.navItem as any}>🏷️ Vendors</Link>
          <Link href="/hr" style={S.navItem as any}>🧑‍🤝‍🧑 HR</Link>
          <Link href="/reports" style={S.navItem as any}>📈 Reports</Link>
          <Link href="/settings" style={{ ...(S.navItem as any), border: `1px solid ${T.accentBd}`, background: T.accentBg }}>
            ⚙️ Settings
          </Link>
        </nav>

        <div style={S.sidebarFooter}>
          <div style={S.userBox}>
            <div style={S.userLabel}>Signed in</div>
            <div style={S.userEmail}>{email || "Unknown"}</div>
            <div style={S.roleBadge}>{isCEO ? "CEO" : role}</div>
          </div>

          <div style={S.smallNote}>
            Storage:
            <div>Settings key: <b>{LS_SETTINGS}</b></div>
            <div>Data saved in this browser localStorage.</div>
          </div>
        </div>
      </aside>

      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={S.h1}>Settings</div>
            <div style={S.muted}>Deploy-safe • No cloud code • Saves instantly to localStorage</div>
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        <div style={S.grid}>
          {/* Appearance */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Appearance</div>

            <div style={S.row}>
              <div style={S.label}>Theme</div>
              <select
                style={S.select}
                value={(settings.theme as Theme) || "Royal Gold"}
                onChange={(e) => saveSettings({ ...settings, theme: e.target.value as Theme })}
              >
                <option>Royal Gold</option>
                <option>Midnight Purple</option>
                <option>Emerald Night</option>
                <option>Ocean Blue</option>
                <option>Ruby Noir</option>
                <option>Carbon Black</option>
                <option>Ivory Light</option>
              </select>
            </div>

            <div style={S.row}>
              <div style={S.label}>High contrast</div>
              <label style={S.switchWrap}>
                <input
                  type="checkbox"
                  checked={!!settings.highContrast}
                  onChange={(e) => saveSettings({ ...settings, highContrast: e.target.checked })}
                />
                <span style={S.switchText}>{settings.highContrast ? "On" : "Off"}</span>
              </label>
            </div>

            <div style={S.row}>
              <div style={S.label}>Compact tables</div>
              <label style={S.switchWrap}>
                <input
                  type="checkbox"
                  checked={!!settings.compactTables}
                  onChange={(e) => saveSettings({ ...settings, compactTables: e.target.checked })}
                />
                <span style={S.switchText}>{settings.compactTables ? "On" : "Off"}</span>
              </label>
            </div>

            <div style={S.row}>
              <div style={S.label}>Hover color</div>
              <label style={S.switchWrap}>
                <input
                  type="checkbox"
                  checked={settings.hoverDark !== false}
                  onChange={(e) => saveSettings({ ...settings, hoverDark: e.target.checked })}
                />
                <span style={S.switchText}>{settings.hoverDark !== false ? "Black hover" : "Soft hover"}</span>
              </label>
            </div>

            <div style={S.noteBox}>
              Tip: If you want hover black everywhere, we keep a single setting now (hoverDark).
              Other pages can read it later.
            </div>
          </section>

          {/* Access control */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Access Control</div>

            <div style={S.row}>
              <div style={S.label}>CEO Email</div>
              <input
                style={S.input}
                value={settings.ceoEmail || "hardikvekariya799@gmail.com"}
                onChange={(e) => saveSettings({ ...settings, ceoEmail: e.target.value.trim() })}
                placeholder="CEO email"
              />
            </div>

            <div style={S.row}>
              <div style={S.label}>Staff Email</div>
              <input
                style={S.input}
                value={settings.staffEmail || "eventurastaff@gmail.com"}
                onChange={(e) => saveSettings({ ...settings, staffEmail: e.target.value.trim() })}
                placeholder="Staff email"
              />
            </div>

            <div style={S.warnBox}>
              Security note: This is a local app (localStorage). If someone logs in on the same browser/device,
              they can see that browser’s data.
            </div>
          </section>

          {/* Backup */}
          <section style={S.panel}>
            <div style={S.panelTitle}>Backup (Easy)</div>

            <div style={S.smallNote}>
              Export your full data + settings into a JSON file (keep it in your email/Drive). Import anytime.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <button style={S.btn} onClick={exportBackup}>Export Backup JSON</button>

              <label style={S.fileBtn}>
                Import Backup JSON
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: "none" }}
                  onChange={(e) => importBackup(e.target.files?.[0] || null)}
                />
              </label>

              <button style={S.dangerBtn} onClick={clearLocalData} title="CEO only">
                Clear Local Data
              </button>
            </div>

            <div style={S.noteBox}>
              ✅ This does NOT use any server, Supabase, or cloud. So deployment won’t fail.
            </div>
          </section>

          {/* About */}
          <section style={S.panel}>
            <div style={S.panelTitle}>About</div>
            <div style={S.smallNote}>
              Founder: <b>Hardik Vekariya</b> • Co-Founder: <b>Shubh Parekh</b> • Digital Head: <b>Dixit Bhuva</b>
            </div>

            <div style={{ marginTop: 10, ...S.smallNote }}>
              Data location right now: <b>Browser localStorage</b> (per device/per browser).
              If you want “save on your email for security”, easiest is:
              <b> Export Backup JSON</b> and email it to yourself.
            </div>
          </section>
        </div>

        <div style={S.footerNote}>✅ Settings saved in localStorage • ✅ No duplicate imports • ✅ Turbopack safe</div>
      </main>
    </div>
  );
}

/* ================== STYLES ================== */
function makeStyles(T: any): Record<string, CSSProperties> {
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
      width: 280,
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
      display: "block",
      padding: "10px 12px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.border}`,
      background: T.soft,
      fontWeight: 900,
      fontSize: 13,
    },

    sidebarFooter: { marginTop: "auto", display: "grid", gap: 10 },
    userBox: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    userLabel: { fontSize: 12, color: T.muted, fontWeight: 900 },
    userEmail: { fontSize: 13, fontWeight: 900, marginTop: 6, wordBreak: "break-word" as any },
    roleBadge: {
      marginTop: 10,
      display: "inline-flex",
      padding: "5px 10px",
      borderRadius: 999,
      background: T.accentBg,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
      fontWeight: 950,
      width: "fit-content",
    },

    main: { flex: 1, padding: 16, maxWidth: 1200, margin: "0 auto", width: "100%" },
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

    h1: { fontSize: 26, fontWeight: 950 },
    muted: { color: T.muted, fontSize: 13, marginTop: 6 },
    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35 },

    msg: { marginTop: 12, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontSize: 13 },

    grid: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },

    panel: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    row: { marginTop: 12, display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, alignItems: "center" },
    label: { fontWeight: 900, fontSize: 13, color: T.text },

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

    select: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
    },

    switchWrap: { display: "inline-flex", alignItems: "center", gap: 10 },
    switchText: { fontWeight: 900, color: T.muted, fontSize: 13 },

    btn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
    },

    fileBtn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.soft,
      color: T.text,
      fontWeight: 950,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
    },

    dangerBtn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid rgba(248,113,113,0.40)`,
      background: "rgba(248,113,113,0.10)",
      color: "#FCA5A5",
      fontWeight: 950,
      cursor: "pointer",
    },

    noteBox: { marginTop: 12, padding: 12, borderRadius: 16, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontSize: 13, lineHeight: 1.35 },
    warnBox: { marginTop: 12, padding: 12, borderRadius: 16, border: `1px solid ${T.warnBd}`, background: T.warnBg, color: T.warnTx, fontSize: 13, lineHeight: 1.35 },

    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 10 },
  };
}
