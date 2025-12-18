"use client";

import React, { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

type RoleTab = "CEO" | "Staff";

const CEO_EMAIL = "hardikvekariya799@gmail.com";
const STAFF_EMAIL = "eventurastaff@gmail.com";

// ✅ Set your desired passwords here (change anytime)
const DEFAULT_CEO_PASSWORD = "Hardik@9727";
const DEFAULT_STAFF_PASSWORD = "Eventura@79";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function setSessionEmail(email: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("eventura_email", email);
  document.cookie = `eventura_email=${encodeURIComponent(email)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export default function LoginPage() {
  const router = useRouter();

  const [tab, setTab] = useState<RoleTab>("CEO");
  const [password, setPassword] = useState<string>(DEFAULT_CEO_PASSWORD);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const email = useMemo(() => (tab === "CEO" ? CEO_EMAIL : STAFF_EMAIL), [tab]);

  function switchTab(next: RoleTab) {
    setTab(next);
    setMsg("");
    setPassword(next === "CEO" ? DEFAULT_CEO_PASSWORD : DEFAULT_STAFF_PASSWORD);
  }

  function hardBlockCrossLogin(selectedTab: RoleTab, usedEmail: string) {
    const ok =
      (selectedTab === "CEO" && usedEmail.toLowerCase() === CEO_EMAIL.toLowerCase()) ||
      (selectedTab === "Staff" && usedEmail.toLowerCase() === STAFF_EMAIL.toLowerCase());
    return ok;
  }

  async function createAccount() {
    setMsg("");
    if (!supabaseUrl || !supabaseAnonKey) {
      setMsg("❌ Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }

    if (!password || password.length < 6) {
      setMsg("❌ Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      // Create/Recreate user (since you deleted all users)
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        // If already exists, tell user to just sign in
        setMsg(`⚠️ ${error.message}`);
      } else {
        setMsg("✅ Account created. Now click Sign In.");
      }
    } catch (e: any) {
      setMsg(`❌ ${e?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  async function signIn() {
    setMsg("");
    if (!supabaseUrl || !supabaseAnonKey) {
      setMsg("❌ Supabase env missing: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY");
      return;
    }

    if (!password) {
      setMsg("❌ Enter password.");
      return;
    }

    setLoading(true);
    try {
      // Hard prevent cross login
      if (!hardBlockCrossLogin(tab, email)) {
        setMsg("❌ Cross-login blocked. Use the correct tab for this account.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMsg(`❌ ${error.message}`);
        return;
      }

      const signedEmail = data?.user?.email || email;

      // Double-check: do not allow cross role even if Supabase signs in
      if (!hardBlockCrossLogin(tab, signedEmail)) {
        await supabase.auth.signOut();
        setMsg("❌ Cross-login blocked. Wrong account for this tab.");
        return;
      }

      // ✅ This fixes “always staff” because OsShell reads this email
      setSessionEmail(signedEmail);

      setMsg("✅ Signed in. Redirecting...");
      router.push("/dashboard");
    } catch (e: any) {
      setMsg(`❌ ${e?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 520,
        }}
      >
        <div className="h1">Eventura OS Login</div>
        <div className="p" style={{ marginTop: 6 }}>
          Choose role tab. Emails are locked to prevent cross login.
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            className={tab === "CEO" ? "btn btnPrimary" : "btn"}
            onClick={() => switchTab("CEO")}
            disabled={loading}
            style={{ flex: 1 }}
          >
            CEO Login
          </button>
          <button
            className={tab === "Staff" ? "btn btnPrimary" : "btn"}
            onClick={() => switchTab("Staff")}
            disabled={loading}
            style={{ flex: 1 }}
          >
            Staff Login
          </button>
        </div>

        {/* Form */}
        <div style={{ marginTop: 14 }}>
          <label className="p">Email (locked)</label>
          <input className="input" value={email} readOnly style={{ marginTop: 6 }} />

          <label className="p" style={{ marginTop: 12, display: "block" }}>
            Password
          </label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={tab === "CEO" ? "Enter CEO password" : "Enter Staff password"}
            style={{ marginTop: 6 }}
          />

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="btn" onClick={createAccount} disabled={loading} style={{ flex: 1 }}>
              {loading ? "Working..." : "Create/Recreate Account"}
            </button>
            <button className="btn btnPrimary" onClick={signIn} disabled={loading} style={{ flex: 1 }}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>

          {msg ? (
            <div
              className="p"
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              {msg}
            </div>
          ) : null}

          <div className="p" style={{ marginTop: 12 }}>
            Default accounts:
            <br />
            <b>CEO:</b> {CEO_EMAIL}
            <br />
            <b>Staff:</b> {STAFF_EMAIL}
          </div>
        </div>
      </div>
    </div>
  );
}
