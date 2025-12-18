"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  async function refreshUser() {
    try {
      const supabase = supabaseClient();
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
    } catch {
      setUserEmail(null);
    }
  }

  useEffect(() => {
    // Initial check
    refreshUser();

    // Listen for auth changes (when magic link completes)
    let sub: any = null;
    try {
      const supabase = supabaseClient();
      const { data } = supabase.auth.onAuthStateChange((_event) => {
        refreshUser();
      });
      sub = data.subscription;
    } catch {
      // ignore
    }

    return () => {
      if (sub) sub.unsubscribe();
    };
  }, []);

  async function sendLink() {
    setLoading(true);
    setMsg("");
    try {
      const supabase = supabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: "http://localhost:3000/dashboard",
        },
      });
      if (error) throw error;

      setMsg(
        "✅ Magic link sent!\n\nNow: open your email → click the Supabase link.\nAfter clicking, you should land on Dashboard."
      );
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Login failed"}`);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    setMsg("");
    try {
      const supabase = supabaseClient();
      await supabase.auth.signOut();
      setUserEmail(null);
      setMsg("✅ Logged out.");
    } catch (e: any) {
      setMsg(`❌ ${e?.message ?? "Logout failed"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Login</h1>
      <p style={{ color: "#4b5563", marginBottom: 16 }}>
        Eventura OS (CEO / Staff) – sign in with email magic link.
      </p>

      {/* STATUS CARD */}
      <div
        style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          Status: {userEmail ? "✅ Logged In" : "⏳ Not logged in"}
        </div>
        {userEmail ? (
          <div style={{ color: "#111827" }}>
            Logged in as: <b>{userEmail}</b>
          </div>
        ) : (
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Enter your email and click “Send magic link”.
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={refreshUser}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              cursor: "pointer",
              fontWeight: 700,
              background: "white",
            }}
          >
            Refresh Status
          </button>

          {userEmail ? (
            <>
              <button
                onClick={() => router.push("/dashboard")}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Go to Dashboard
              </button>
              <button
                onClick={logout}
                disabled={loading}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  cursor: "pointer",
                  fontWeight: 700,
                  background: "white",
                }}
              >
                {loading ? "..." : "Logout"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* LOGIN FORM */}
      {!userEmail ? (
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 14,
          }}
        >
          <label style={{ display: "block", fontSize: 14, marginBottom: 6 }}>
            Email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              marginBottom: 12,
            }}
          />

          <button
            onClick={sendLink}
            disabled={!email || loading}
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "none",
              cursor: !email || loading ? "not-allowed" : "pointer",
              fontWeight: 800,
              opacity: !email || loading ? 0.6 : 1,
            }}
          >
            {loading ? "Sending..." : "Send magic link"}
          </button>

          <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
            After you click the email link, come back here and press{" "}
            <b>Refresh Status</b> if needed.
          </div>
        </div>
      ) : null}

      {/* MESSAGE BOX */}
      {msg ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            background: "white",
            border: "1px solid #e5e7eb",
            whiteSpace: "pre-wrap",
          }}
        >
          {msg}
        </div>
      ) : null}
    </main>
  );
}
