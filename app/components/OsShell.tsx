"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";

const CEO_EMAIL = "hardikvekariya799@gmail.com";

type NavItem = { label: string; href: string; icon: string; ceoOnly?: boolean };

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "Events", href: "/events", icon: "📅" },
  { label: "Vendors", href: "/vendors", icon: "🤝" },
  { label: "HR", href: "/hr", icon: "👥" },
  { label: "Reports", href: "/reports", icon: "📈" },
  { label: "AI", href: "/ai", icon: "✨" },
  { label: "Finance", href: "/finance", icon: "💰", ceoOnly: true }, // CEO only
  { label: "Settings", href: "/settings", icon: "⚙️", ceoOnly: true }, // CEO only
];

export default function OsShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string>("");
  const isLogin = pathname === "/login";

  const isCEO = useMemo(() => email.toLowerCase() === CEO_EMAIL.toLowerCase(), [email]);

  useEffect(() => {
    (async () => {
      try {
        const supabase = supabaseClient();
        const { data } = await supabase.auth.getUser();

        if (!data.user) {
          if (!isLogin) router.replace("/login");
          setReady(true);
          return;
        }

        setEmail(data.user.email || "");
        setReady(true);
      } catch {
        if (!isLogin) router.replace("/login");
        setReady(true);
      }
    })();
  }, [router, isLogin]);

  async function logout() {
    try {
      const supabase = supabaseClient();
      await supabase.auth.signOut();
    } catch {}
    router.replace("/login");
  }

  // Don’t wrap login page in shell
  if (isLogin) return <>{children}</>;

  if (!ready) {
    return (
      <div className="os-bg">
        <div className="os-center">
          <div className="os-card">
            <div className="os-title">Eventura OS</div>
            <div className="os-muted">Loading…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="os-bg">
      <div className="os-shell">
        {/* Sidebar */}
        <aside className="os-sidebar">
          <div className="os-brand">
            <div className="os-logo">E</div>
            <div>
              <div className="os-brand-title">Eventura OS</div>
              <div className="os-brand-sub">Royal Ops Suite</div>
            </div>
          </div>

          <nav className="os-nav">
            {NAV.filter((i) => (i.ceoOnly ? isCEO : true)).map((i) => {
              const active = pathname === i.href;
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  className={`os-nav-item ${active ? "active" : ""}`}
                >
                  <span className="os-ic">{i.icon}</span>
                  <span>{i.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="os-side-footer">
            <div className="os-user">
              <div className="os-user-dot" />
              <div>
                <div className="os-user-name">{isCEO ? "CEO" : "Staff"}</div>
                <div className="os-user-email">{email || "—"}</div>
              </div>
            </div>

            <button className="os-btn os-btn-outline" onClick={logout}>
              Logout
            </button>

            <div className="os-founders">
              <div className="os-muted2">CEO: Hardik Vekariya</div>
              <div className="os-muted2">Cofounder: Shubh Parekh</div>
              <div className="os-muted2">Digital Head: Dixit Bhuva</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="os-main">
          <div className="os-topbar">
            <div className="os-top-left">
              <div className="os-pill">Events that speak your style</div>
            </div>
            <div className="os-top-right">
              <div className="os-kpi-mini">
                <span className="dot" />
                <span>Live</span>
              </div>
            </div>
          </div>

          <div className="os-content">{children}</div>
        </main>
      </div>
    </div>
  );
}
