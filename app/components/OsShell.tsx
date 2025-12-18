"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/* ================= CONFIG ================= */

type Role = "CEO" | "Staff";
const CEO_EMAIL = "hardikvekariya799@gmail.com";

/* ================= HELPERS ================= */

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : "";
}

/* ================= COMPONENT ================= */

export default function OsShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [email, setEmail] = useState("");

  const role: Role = useMemo(() => {
    return email.toLowerCase() === CEO_EMAIL.toLowerCase() ? "CEO" : "Staff";
  }, [email]);

  /* ===== Load session ===== */
  useEffect(() => {
    const lsEmail =
      typeof window !== "undefined"
        ? window.localStorage.getItem("eventura_email") || ""
        : "";

    const ckEmail = getCookie("eventura_email");
    const finalEmail = (lsEmail || ckEmail).trim();

    if (!finalEmail) {
      router.push("/login");
      return;
    }

    setEmail(finalEmail);
  }, [router]);

  /* ===== Navigation ===== */
  const navItems = useMemo(() => {
    const common = [
      { href: "/dashboard", label: "Dashboard", group: "Core" },
      { href: "/events", label: "Events", group: "Core" },
      { href: "/tasks", label: "Tasks", group: "Core" },
      { href: "/vendors", label: "Vendors", group: "Operations" },
      { href: "/hr", label: "HR", group: "Operations" },
    ];

    const ceoOnly = [
      { href: "/finance", label: "Finance", group: "CEO Only" },
      { href: "/reports", label: "Reports", group: "CEO Only" },
      { href: "/settings", label: "Settings", group: "CEO Only" },
    ];

    return role === "CEO" ? [...common, ...ceoOnly] : common;
  }, [role]);

  const groupedNav = useMemo(() => {
    const map: Record<string, typeof navItems> = {};
    navItems.forEach((item) => {
      if (!map[item.group]) map[item.group] = [];
      map[item.group].push(item);
    });
    return map;
  }, [navItems]);

  /* ===== Logout ===== */
  function logout() {
    try {
      localStorage.removeItem("eventura_email");
      document.cookie = "eventura_email=; Path=/; Max-Age=0";
    } catch {}
    router.push("/login");
  }

  /* ================= RENDER ================= */

  return (
    <div className="osShell">
      {/* ===== SIDEBAR ===== */}
      <aside className="osPanel osSidebar">
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="h2">Eventura OS</div>
          <div className="p" style={{ marginTop: 6 }}>
            {email}
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <span className="chip">{role}</span>
            {role === "Staff" && <span className="chip chipWarn">Restricted</span>}
          </div>
        </div>

        {Object.keys(groupedNav).map((group) => (
          <div key={group}>
            <div className="navGroupTitle">{group}</div>
            {groupedNav[group].map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  pathname.startsWith(item.href + "/"));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={active ? "navItem navItemActive" : "navItem"}
                >
                  {item.label}
                  {role === "CEO" &&
                    (item.href === "/finance" ||
                      item.href === "/settings") && (
                      <span className="badge">CEO</span>
                    )}
                </Link>
              );
            })}
          </div>
        ))}

        <div style={{ marginTop: 16 }}>
          <button className="btn btnGhost" onClick={logout} style={{ width: "100%" }}>
            Logout
          </button>
        </div>
      </aside>

      {/* ===== MAIN ===== */}
      <main className="osMain">
        <div className="osTopbar">
          <div>
            <div className="h1">Eventura OS</div>
            <div className="p">Access Level: {role}</div>
          </div>

          {role === "CEO" ? (
            <button
              className="btn btnPrimary"
              onClick={() => router.push("/events/new")}
            >
              + New Event
            </button>
          ) : (
            <button className="btn" onClick={() => router.push("/tasks")}>
              View Tasks
            </button>
          )}
        </div>

        {/* CONTENT WRAPPER – prevents white background */}
        <div className="card">{children}</div>
      </main>
    </div>
  );
}
