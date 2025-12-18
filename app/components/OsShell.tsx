"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";

/**
 * 🔥 TEMPORARY FORCE CEO MODE
 * Anyone who logs in will be treated as CEO
 * (No password reset, no email matching)
 */
const FORCE_CEO_MODE = true;

type NavItem = { label: string; href: string; icon: string; ceoOnly?: boolean };

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "Events", href: "/events", icon: "📅" },
  { label: "Vendors", href: "/vendors", icon: "🤝" },
  { label: "HR", href: "/hr", icon: "👥" },
  { label: "Reports", href: "/reports", icon: "📈" },
  { label: "AI", href: "/ai", icon: "✨" },
  { label: "Finance", href: "/finance", icon: "💰", ceoOnly: true },
  { label: "Settings", href: "/settings", icon: "⚙️", ceoOnly: true },
];

export default function OsShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");

  const isLogin = pathname === "/login";
  const isCEO = FORCE_CEO_MODE;

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

  if (isLogin) return <>{children}</>;

  if (!ready) {
    return <div style={{ padding: 24 }}>Loading Eventura OS…</div>;
  }

  return (
    <div className="os-shell">
      <aside className="os-sidebar">
        <h2>Eventura OS</h2>

        <nav>
          {NAV.filter((i) => (i.ceoOnly ? isCEO : true)).map((i) => (
            <Link key={i.href} href={i.href} style={{ display: "block", padding: 8 }}>
              {i.icon} {i.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 20 }}>
          <div><strong>Role:</strong> CEO</div>
          <div style={{ fontSize: 12 }}>{email}</div>
          <button onClick={logout} style={{ marginTop: 10 }}>Logout</button>
        </div>
      </aside>

      <main style={{ padding: 20, flex: 1 }}>{children}</main>
    </div>
  );
}
