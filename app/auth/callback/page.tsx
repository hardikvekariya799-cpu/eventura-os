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

        // Exchange the "code" from the URL for a session cookie
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          setMsg("❌ Login failed. Please request a new magic link.");
          return;
        }

        // Clean URL and go to dashboard
        window.history.replaceState({}, document.title, "/dashboard");
        router.replace("/dashboard");
      } catch {
        setMsg("❌ Login failed. Please request a new magic link.");
      }
    })();
  }, [router]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Eventura OS</h1>
      <p style={{ marginTop: 10, color: "#6b7280" }}>{msg}</p>
    </main>
  );
}
