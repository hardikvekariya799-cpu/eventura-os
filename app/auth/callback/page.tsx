"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "../../../lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Signing you in...");

  useEffect(() => {
    (async () => {
      try {
        const supabase = supabaseClient();

        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);

        if (error) {
          setMsg(
            `❌ Login failed: ${error.message}\n\nMost common reason: you opened the email link on a different device/browser than the one where you requested it.\n\nFix: request the link and open it on the SAME device/browser, OR use OTP code login on /login.`
          );
          return;
        }

        setMsg("✅ Signed in! Redirecting to dashboard...");
        router.replace("/dashboard");
      } catch (e: any) {
        setMsg(
          `❌ Login failed.\n\nTry again using the SAME device/browser, OR use OTP code login on /login.\n\nDetails: ${e?.message || "unknown error"}`
        );
      }
    })();
  }, [router]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Eventura OS</h1>
      <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", color: "#111827" }}>{msg}</pre>
      <p style={{ marginTop: 12, color: "#6b7280" }}>
        If this keeps failing, open /login and use OTP code login.
      </p>
    </main>
  );
}
