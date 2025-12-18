"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

const CEO_EMAIL = "hardikvekariya799@gmail.com";

export default function SettingsPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = supabaseClient();
      const { data } = await supabase.auth.getUser();
      const email = (data.user?.email || "").toLowerCase();
      if (!data.user) return router.replace("/login");
      if (email !== CEO_EMAIL.toLowerCase()) return router.replace("/dashboard?err=settings_denied");
      setOk(true);
    })();
  }, [router]);

  if (!ok) return <div className="os-card"><div className="os-muted">Checking access…</div></div>;

  return (
    <div className="os-card">
      <h1 className="os-title">Settings (CEO)</h1>
      <p className="os-sub">Access control, system preferences, branding, and exports.</p>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <div className="os-card">
          <div style={{ fontWeight: 900 }}>Access Control</div>
          <div className="os-muted" style={{ marginTop: 6 }}>Next: add Staff roles + permissions here.</div>
        </div>
        <div className="os-card">
          <div style={{ fontWeight: 900 }}>Branding</div>
          <div className="os-muted" style={{ marginTop: 6 }}>Logo, tagline, theme color presets.</div>
        </div>
        <div className="os-card">
          <div style={{ fontWeight: 900 }}>Data Exports</div>
          <div className="os-muted" style={{ marginTop: 6 }}>CSV exports already added — we’ll add PDF next.</div>
        </div>
      </div>
    </div>
  );
}
