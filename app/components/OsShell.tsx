"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

/* ================= SUPABASE (safe) ================= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/* ================= SETTINGS (shared) ================= */
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

const DEFAULT_SETTINGS: AppSettings = {
  ceoEmail: "hardikvekariya799@gmail.com",
  staffEmail: "eventurastaff@gmail.com",
  theme: "Royal Gold",
  sidebarMode: "Icons + Text",
  compactTables: false,
  confirmDeletes: true,
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

function applyThemeToDom(s: AppSettings) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-ev-theme", s.theme);
  document.documentElement.setAttribute("data-ev-sidebar", s.sidebarMode);
  document.documentElement.setAttribute("data-ev-compact", s.compactTables ? "1" : "0");
}

function setSessionEmail(email: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("eventura_email", email);
  document.cookie = `eventura_email=${encodeURIComponent(email)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function getFallbackEmail(): string {
  if (typeof window === "undefined") return "";
  const fromLS = localStorage.getItem("eventura_email") || "";
  if (fromLS) return fromLS;
  const m = document.cookie.match(/(?:^|;\s*)eventura_email=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

type NavItem = { label: string; href: string; icon: string };

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "Events", href: "/events", icon: "📅" },
  { label: "Finance", href: "/finance", icon: "💰" },
  { label: "Vendors", href: "/vendors", icon: "🏷️" },
  { label: "AI", href: "/ai", icon: "🤖" },
  { label: "HR", href: "/hr", icon: "🧑‍🤝‍🧑" },
  { label: "Reports", href: "/reports", icon: "📈" },
  // ✅ IMPORTANT: Settings is a REAL LINK now (NOT a theme button)
  { label: "Settings", href: "/settings", icon: "⚙️" },
];

export default function OsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [email, setEmail] = useState<string>("");

  // Load settings + apply theme globally
  useEffect(() => {
    const s = safeLoad<AppSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
    const merged = { ...DEFAULT_SETTINGS, ...s };
    setSettings(merged);
    applyThemeToDom(merged);
  }, []);

  // Keep theme applied even if settings changed in another tab
  useEffect(() => {
    const id = setInterval(() => {
      const s = safeLoad<AppSettings>(LS_SETTINGS, DEFAULT_SETTINGS);
      applyThemeToDom({ ...DEFAULT_SETTINGS, ...s });
    }, 1200);
    return () => clearInterval(id);
  }, []);

  // Get email from session (for header area)
  useEffect(() => {
    (async () => {
      if (!supabase) {
        setEmail(getFallbackEmail());
        return;
      }
      const { data } = await supabase.auth.getSession();
      const e = data.session?.user?.email || "";
      if (e) {
        setEmail(e);
        setSessionEmail(e);
      } else {
        setEmail(getFallbackEmail());
      }

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        const em = session?.user?.email || "";
        if (em) {
          setEmail(em);
          setSessionEmail(em);
        }
      });
      return () => sub.subscription.unsubscribe();
    })();
  }, []);

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

  const sidebarIconsOnly = settings.sidebarMode === "Icons Only";

  return (
    <div style={S.app}>
      <aside style={{ ...S.sidebar, width: sidebarIconsOnly ? 76 : 260 }}>
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
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...S.navItem,
                  ...(active ? S.navActive : null),
                }}
                title={item.label}
              >
                <span style={S.navIcon}>{item.icon}</span>
                {!sidebarIconsOnly ? <span style={S.navLabel}>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div style={S.sidebarFooter}>
          {!sidebarIconsOnly ? (
            <div style={S.userBox}>
              <div style={S.userLabel}>Signed in</div>
              <div style={S.userEmail}>{email || "Unknown"}</div>
            </div>
          ) : null}

          <button style={S.signOutBtn} onClick={signOut}>
            {sidebarIconsOnly ? "⎋" : "Sign Out"}
          </button>
        </div>
      </aside>

      <main style={S.main}>{children}</main>
    </div>
  );
}

/* ================= STYLES ================= */
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

  sidebar: {
    position: "sticky",
    top: 0,
    height: "100vh",
    padding: 12,
    borderRight: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,32,0.88)",
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
    background: "rgba(212,175,55,0.14)",
    border: "1px solid rgba(212,175,55,0.28)",
    color: "#FDE68A",
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
    color: "#F9FAFB",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  navActive: {
    border: "1px solid rgba(212,175,55,0.32)",
    background: "rgba(212,175,55,0.12)",
    color: "#FDE68A",
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

  signOutBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(248,113,113,0.30)",
    background: "rgba(248,113,113,0.10)",
    color: "#FCA5A5",
    fontWeight: 950,
    cursor: "pointer",
  },

  main: { flex: 1, padding: 16, width: "100%" },
};
