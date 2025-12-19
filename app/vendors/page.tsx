"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ================= TYPES ================= */
type VendorCategory =
  | "Decor"
  | "Catering"
  | "Venue"
  | "Photography"
  | "Videography"
  | "DJ/Sound"
  | "Makeup"
  | "Mehndi"
  | "Transport"
  | "Lighting"
  | "Florist"
  | "Invitation/Print"
  | "Hotel"
  | "Security"
  | "Other";

type VendorStatus = "Active" | "Preferred" | "On Hold" | "Blacklisted";

type Vendor = {
  id: string;
  name: string;
  category: VendorCategory;
  city: string;
  phone?: string;
  email?: string;
  website?: string;
  priceMin?: number; // ₹
  priceMax?: number; // ₹
  rating: number; // 0-5
  status: VendorStatus;
  available: boolean;
  tags: string[]; // ["royal","budget","premium"]
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type EventType =
  | "Wedding"
  | "Engagement"
  | "Reception"
  | "Sangeet"
  | "Corporate"
  | "Birthday"
  | "Other";

const LS_VENDORS = "eventura_os_vendors_v1";

/* ================= HELPERS ================= */
function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function inr(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
}
function loadVendors(): Vendor[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_VENDORS);
    return raw ? (JSON.parse(raw) as Vendor[]) : [];
  } catch {
    return [];
  }
}
function saveVendors(items: Vendor[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_VENDORS, JSON.stringify(items));
}
function downloadJSON(filename: string, data: any) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================= “AI” MATCHER (LOCAL SMART) =================
   Recommends vendors based on:
   - category relevance to event type
   - city match
   - budget compatibility (priceMin/priceMax)
   - preferred status
   - rating
   - availability
*/
function recommendVendors(
  vendors: Vendor[],
  req: { eventType: EventType; city: string; budget: number; needed: VendorCategory[] }
) {
  const city = req.city.trim().toLowerCase();
  const budget = req.budget;

  function score(v: Vendor) {
    let s = 0;

    // must match needed categories
    if (!req.needed.includes(v.category)) return -999;

    // availability
    if (v.available) s += 15;
    else s -= 20;

    // status
    if (v.status === "Preferred") s += 15;
    if (v.status === "Active") s += 8;
    if (v.status === "On Hold") s -= 10;
    if (v.status === "Blacklisted") s -= 100;

    // rating (0-5)
    s += v.rating * 6;

    // city match
    if (v.city.trim().toLowerCase() === city) s += 12;
    else s += 3; // still possible if nearby

    // budget fit
    const min = v.priceMin ?? 0;
    const max = v.priceMax ?? Number.MAX_SAFE_INTEGER;

    if (budget >= min && budget <= max) s += 18;
    else if (budget < min) s -= 10;
    else if (budget > max) s -= 4;

    // event type hints
    const tags = v.tags.map((x) => x.toLowerCase());
    if (req.eventType === "Wedding" || req.eventType === "Reception") {
      if (tags.includes("premium")) s += 6;
      if (tags.includes("royal")) s += 6;
    }
    if (req.eventType === "Corporate") {
      if (tags.includes("corporate")) s += 8;
      if (tags.includes("professional")) s += 6;
    }
    if (tags.includes("budget")) s += 3;
    if (tags.includes("fast")) s += 2;

    return s;
  }

  const ranked = vendors
    .map((v) => ({ v, s: score(v) }))
    .filter((x) => x.s > -100)
    .sort((a, b) => b.s - a.s);

  // Group by category: pick top 3 each
  const out: Record<string, Vendor[]> = {};
  for (const cat of req.needed) {
    out[cat] = ranked.filter((x) => x.v.category === cat).slice(0, 3).map((x) => x.v);
  }
  return out;
}

/* ================= PAGE ================= */
export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [msg, setMsg] = useState("");

  // filters
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<"All" | VendorCategory>("All");
  const [cityFilter, setCityFilter] = useState<"All" | string>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | VendorStatus>("All");
  const [availabilityFilter, setAvailabilityFilter] = useState<"All" | "Available" | "Not Available">("All");

  // form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<VendorCategory>("Decor");
  const [city, setCity] = useState("Surat");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [rating, setRating] = useState<number>(4);
  const [status, setStatus] = useState<VendorStatus>("Active");
  const [available, setAvailable] = useState<boolean>(true);
  const [tags, setTags] = useState<string>(""); // comma separated
  const [notes, setNotes] = useState<string>("");

  // AI request
  const [aiEventType, setAiEventType] = useState<EventType>("Wedding");
  const [aiCity, setAiCity] = useState<string>("Surat");
  const [aiBudget, setAiBudget] = useState<string>("500000");
  const [aiNeedDecor, setAiNeedDecor] = useState(true);
  const [aiNeedCatering, setAiNeedCatering] = useState(true);
  const [aiNeedVenue, setAiNeedVenue] = useState(true);
  const [aiNeedPhoto, setAiNeedPhoto] = useState(true);
  const [aiNeedDJ, setAiNeedDJ] = useState(false);
  const [aiNeedMakeup, setAiNeedMakeup] = useState(false);

  useEffect(() => {
    setVendors(loadVendors());
  }, []);

  useEffect(() => {
    saveVendors(vendors);
  }, [vendors]);

  const cities = useMemo(() => {
    const s = new Set<string>();
    vendors.forEach((v) => s.add(v.city));
    return ["All", ...[...s].sort()];
  }, [vendors]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return vendors
      .filter((v) => (catFilter === "All" ? true : v.category === catFilter))
      .filter((v) => (cityFilter === "All" ? true : v.city === cityFilter))
      .filter((v) => (statusFilter === "All" ? true : v.status === statusFilter))
      .filter((v) => {
        if (availabilityFilter === "All") return true;
        return availabilityFilter === "Available" ? v.available : !v.available;
      })
      .filter((v) => {
        if (!s) return true;
        return (
          v.name.toLowerCase().includes(s) ||
          v.category.toLowerCase().includes(s) ||
          v.city.toLowerCase().includes(s) ||
          (v.phone || "").toLowerCase().includes(s) ||
          (v.email || "").toLowerCase().includes(s) ||
          v.tags.join(",").toLowerCase().includes(s) ||
          (v.notes || "").toLowerCase().includes(s)
        );
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [vendors, q, catFilter, cityFilter, statusFilter, availabilityFilter]);

  const kpis = useMemo(() => {
    const total = vendors.length;
    const preferred = vendors.filter((v) => v.status === "Preferred").length;
    const active = vendors.filter((v) => v.status === "Active").length;
    const availableCount = vendors.filter((v) => v.available).length;
    return { total, preferred, active, availableCount };
  }, [vendors]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setCategory("Decor");
    setCity("Surat");
    setPhone("");
    setEmail("");
    setWebsite("");
    setPriceMin("");
    setPriceMax("");
    setRating(4);
    setStatus("Active");
    setAvailable(true);
    setTags("");
    setNotes("");
    setMsg("");
  }

  function startEdit(v: Vendor) {
    setEditingId(v.id);
    setName(v.name);
    setCategory(v.category);
    setCity(v.city);
    setPhone(v.phone || "");
    setEmail(v.email || "");
    setWebsite(v.website || "");
    setPriceMin(v.priceMin?.toString() || "");
    setPriceMax(v.priceMax?.toString() || "");
    setRating(v.rating);
    setStatus(v.status);
    setAvailable(v.available);
    setTags(v.tags.join(", "));
    setNotes(v.notes || "");
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function remove(id: string) {
    setVendors((prev) => prev.filter((v) => v.id !== id));
    setMsg("✅ Vendor deleted");
    if (editingId === id) resetForm();
  }

  function upsert() {
    setMsg("");

    const n = name.trim();
    if (!n) return setMsg("❌ Vendor name required");

    const pMin = priceMin.trim() ? Number(priceMin) : undefined;
    const pMax = priceMax.trim() ? Number(priceMax) : undefined;

    if (priceMin.trim() && (Number.isNaN(pMin) || (pMin || 0) < 0)) return setMsg("❌ priceMin invalid");
    if (priceMax.trim() && (Number.isNaN(pMax) || (pMax || 0) < 0)) return setMsg("❌ priceMax invalid");
    if (pMin != null && pMax != null && pMin > pMax) return setMsg("❌ priceMin must be <= priceMax");

    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 12);

    const now = new Date().toISOString();

    if (!editingId) {
      const v: Vendor = {
        id: uid(),
        name: n,
        category,
        city: city.trim() || "Surat",
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        priceMin: pMin,
        priceMax: pMax,
        rating: Math.max(0, Math.min(5, rating)),
        status,
        available,
        tags: tagList,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      setVendors((prev) => [v, ...prev]);
      setMsg("✅ Vendor added");
      resetForm();
      return;
    }

    setVendors((prev) =>
      prev.map((x) =>
        x.id === editingId
          ? {
              ...x,
              name: n,
              category,
              city: city.trim() || "Surat",
              phone: phone.trim() || undefined,
              email: email.trim() || undefined,
              website: website.trim() || undefined,
              priceMin: pMin,
              priceMax: pMax,
              rating: Math.max(0, Math.min(5, rating)),
              status,
              available,
              tags: tagList,
              notes: notes.trim() || undefined,
              updatedAt: now,
            }
          : x
      )
    );

    setMsg("✅ Vendor updated");
    resetForm();
  }

  const aiNeeded = useMemo(() => {
    const list: VendorCategory[] = [];
    if (aiNeedDecor) list.push("Decor");
    if (aiNeedCatering) list.push("Catering");
    if (aiNeedVenue) list.push("Venue");
    if (aiNeedPhoto) list.push("Photography");
    if (aiNeedDJ) list.push("DJ/Sound");
    if (aiNeedMakeup) list.push("Makeup");
    if (!list.length) list.push("Other");
    return list;
  }, [aiNeedDecor, aiNeedCatering, aiNeedVenue, aiNeedPhoto, aiNeedDJ, aiNeedMakeup]);

  const aiResult = useMemo(() => {
    const b = Number(aiBudget);
    const budget = !aiBudget.trim() || Number.isNaN(b) ? 0 : b;
    return recommendVendors(vendors, { eventType: aiEventType, city: aiCity, budget, needed: aiNeeded });
  }, [vendors, aiEventType, aiCity, aiBudget, aiNeeded]);

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div style={S.topRow}>
          <div>
            <div style={S.h1}>Vendors</div>
            <div style={S.muted}>Directory • Preferred vendors • Smart matching • Export</div>
          </div>
          <div style={S.row}>
            <button
              style={S.ghostBtn}
              onClick={() => downloadJSON(`eventura_vendors_${new Date().toISOString().slice(0, 10)}.json`, { vendors })}
              title="Download vendors JSON"
            >
              Export
            </button>
            <button style={S.ghostBtn} onClick={resetForm}>
              Clear Form
            </button>
          </div>
        </div>

        {/* KPI */}
        <div style={S.kpiRow}>
          <KPI label="Total Vendors" value={kpis.total} />
          <KPI label="Preferred" value={kpis.preferred} />
          <KPI label="Active" value={kpis.active} />
          <KPI label="Available" value={kpis.availableCount} />
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* AI MATCH */}
        <div style={S.panel}>
          <div style={S.panelTitle}>AI Vendor Match</div>
          <div style={S.aiForm}>
            <Field label="Event Type">
              <select style={S.select} value={aiEventType} onChange={(e) => setAiEventType(e.target.value as any)}>
                {["Wedding", "Engagement", "Reception", "Sangeet", "Corporate", "Birthday", "Other"].map((t) => (
                  <option key={t} style={S.option}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="City">
              <input style={S.input} value={aiCity} onChange={(e) => setAiCity(e.target.value)} placeholder="Surat" />
            </Field>

            <Field label="Budget (₹)">
              <input style={S.input} value={aiBudget} onChange={(e) => setAiBudget(e.target.value)} placeholder="500000" />
            </Field>

            <div style={{ ...S.field, gridColumn: "1 / -1" }}>
              <div style={S.label}>Needed Vendors</div>
              <div style={S.checkRow}>
                <Check label="Decor" checked={aiNeedDecor} setChecked={setAiNeedDecor} />
                <Check label="Catering" checked={aiNeedCatering} setChecked={setAiNeedCatering} />
                <Check label="Venue" checked={aiNeedVenue} setChecked={setAiNeedVenue} />
                <Check label="Photography" checked={aiNeedPhoto} setChecked={setAiNeedPhoto} />
                <Check label="DJ/Sound" checked={aiNeedDJ} setChecked={setAiNeedDJ} />
                <Check label="Makeup" checked={aiNeedMakeup} setChecked={setAiNeedMakeup} />
              </div>
            </div>
          </div>

          <div style={S.aiGrid}>
            {Object.entries(aiResult).map(([cat, list]) => (
              <div key={cat} style={S.aiCard}>
                <div style={{ fontWeight: 950, color: "#FDE68A" }}>{cat}</div>
                {!list.length ? (
                  <div style={S.smallMuted}>No matching vendors found. Add more vendors in this category.</div>
                ) : (
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    {list.map((v) => (
                      <div key={v.id} style={S.aiPick}>
                        <div style={S.rowBetween}>
                          <div style={{ fontWeight: 950 }}>{v.name}</div>
                          <span style={S.badge}>{v.status}</span>
                        </div>
                        <div style={S.smallMuted}>
                          {v.city} • ⭐ {v.rating.toFixed(1)} •{" "}
                          {v.priceMin != null || v.priceMax != null
                            ? `₹${inr(v.priceMin ?? 0)} - ₹${inr(v.priceMax ?? v.priceMin ?? 0)}`
                            : "No price range"}
                        </div>
                        <div style={S.rowBetween}>
                          <div style={S.tagLine}>
                            {v.tags.slice(0, 6).map((t) => (
                              <span key={t} style={S.tag}>
                                {t}
                              </span>
                            ))}
                          </div>
                          <button style={S.ghostBtnSmall} onClick={() => startEdit(v)}>
                            Open
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={S.smallNote}>
            This “AI Match” is fast and local. Later we can add real AI: auto vendor negotiation script, pricing comparison, and contract checklist.
          </div>
        </div>

        {/* FORM */}
        <div style={S.panel}>
          <div style={S.panelTitle}>{editingId ? "Edit Vendor" : "Add Vendor"}</div>

          <div style={S.grid2}>
            <Field label="Vendor Name">
              <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vendor / Company name" />
            </Field>

            <Field label="Category">
              <select style={S.select} value={category} onChange={(e) => setCategory(e.target.value as any)}>
                {[
                  "Decor",
                  "Catering",
                  "Venue",
                  "Photography",
                  "Videography",
                  "DJ/Sound",
                  "Makeup",
                  "Mehndi",
                  "Transport",
                  "Lighting",
                  "Florist",
                  "Invitation/Print",
                  "Hotel",
                  "Security",
                  "Other",
                ].map((c) => (
                  <option key={c} style={S.option}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="City">
              <input style={S.input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Surat" />
            </Field>

            <Field label="Phone (optional)">
              <input style={S.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91..." />
            </Field>

            <Field label="Email (optional)">
              <input style={S.input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vendor@gmail.com" />
            </Field>

            <Field label="Website (optional)">
              <input style={S.input} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
            </Field>

            <Field label="Price Min (₹)">
              <input style={S.input} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="e.g. 50000" />
            </Field>

            <Field label="Price Max (₹)">
              <input style={S.input} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="e.g. 250000" />
            </Field>

            <Field label="Rating (0–5)">
              <input
                style={S.input}
                type="number"
                min={0}
                max={5}
                step={0.5}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              />
            </Field>

            <Field label="Status">
              <select style={S.select} value={status} onChange={(e) => setStatus(e.target.value as any)}>
                {["Active", "Preferred", "On Hold", "Blacklisted"].map((s) => (
                  <option key={s} style={S.option}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <div style={S.field}>
              <div style={S.label}>Availability</div>
              <div style={S.checkRow}>
                <button
                  style={{ ...S.toggleBtn, ...(available ? S.toggleOn : S.toggleOff) }}
                  onClick={() => setAvailable(true)}
                  type="button"
                >
                  Available
                </button>
                <button
                  style={{ ...S.toggleBtn, ...(!available ? S.toggleOn : S.toggleOff) }}
                  onClick={() => setAvailable(false)}
                  type="button"
                >
                  Not Available
                </button>
              </div>
            </div>

            <Field label="Tags (comma separated)" full>
              <input style={S.input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="royal, premium, budget, corporate, fast" />
            </Field>

            <Field label="Notes (optional)" full>
              <textarea style={S.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pricing notes, contact person, discount terms..." />
            </Field>
          </div>

          <div style={S.rowBetween}>
            <div style={S.smallMuted}>Saved locally (deploy-safe). Later we can sync to Supabase + file uploads.</div>
            <div style={S.row}>
              {editingId ? (
                <button style={S.dangerBtn} onClick={() => remove(editingId)}>
                  Delete
                </button>
              ) : null}
              <button style={S.primaryBtn} onClick={upsert}>
                {editingId ? "Save Changes" : "Add Vendor"}
              </button>
            </div>
          </div>
        </div>

        {/* LIST */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Vendor Directory</div>

          <div style={S.filters}>
            <input style={S.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: name / city / category / phone / tags / notes" />

            <select style={S.select} value={catFilter} onChange={(e) => setCatFilter(e.target.value as any)}>
              <option style={S.option} value="All">
                All Categories
              </option>
              {[
                "Decor",
                "Catering",
                "Venue",
                "Photography",
                "Videography",
                "DJ/Sound",
                "Makeup",
                "Mehndi",
                "Transport",
                "Lighting",
                "Florist",
                "Invitation/Print",
                "Hotel",
                "Security",
                "Other",
              ].map((c) => (
                <option key={c} style={S.option}>
                  {c}
                </option>
              ))}
            </select>

            <select style={S.select} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              {cities.map((c) => (
                <option key={c} style={S.option} value={c}>
                  {c === "All" ? "All Cities" : c}
                </option>
              ))}
            </select>

            <select style={S.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
              <option style={S.option} value="All">
                All Status
              </option>
              {["Active", "Preferred", "On Hold", "Blacklisted"].map((s) => (
                <option key={s} style={S.option}>
                  {s}
                </option>
              ))}
            </select>

            <select style={S.select} value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value as any)}>
              <option style={S.option} value="All">
                All Availability
              </option>
              <option style={S.option} value="Available">
                Available
              </option>
              <option style={S.option} value="Not Available">
                Not Available
              </option>
            </select>
          </div>

          {!filtered.length ? (
            <div style={S.empty}>No vendors found.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((v) => (
                <div key={v.id} style={S.card}>
                  <div style={S.rowBetween}>
                    <div>
                      <div style={S.cardTitle}>{v.name}</div>
                      <div style={S.cardSub}>
                        {v.category} • {v.city} • ⭐ {v.rating.toFixed(1)} •{" "}
                        {v.priceMin != null || v.priceMax != null
                          ? `₹${inr(v.priceMin ?? 0)} - ₹${inr(v.priceMax ?? v.priceMin ?? 0)}`
                          : "No price range"}
                      </div>
                      <div style={S.metaLine}>
                        <span style={S.badge}>{v.status}</span>
                        <span style={v.available ? S.availGood : S.availBad}>
                          {v.available ? "Available" : "Not Available"}
                        </span>
                      </div>
                      {v.tags.length ? (
                        <div style={S.tagLine}>
                          {v.tags.slice(0, 10).map((t) => (
                            <span key={t} style={S.tag}>
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {v.notes ? <div style={S.note}>{v.notes}</div> : null}
                    </div>

                    <div style={S.row}>
                      <button style={S.ghostBtn} onClick={() => startEdit(v)}>
                        Edit
                      </button>
                      <button style={S.dangerBtn} onClick={() => remove(v.id)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div style={S.smallMuted}>Updated: {new Date(v.updatedAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={S.footerNote}>✅ Hover fixed on dropdown/options. ✅ Vendor AI match included. ✅ Saved locally.</div>
      </div>
    </div>
  );
}

/* ================= UI HELPERS ================= */
function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ ...S.field, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={S.label}>{label}</div>
      {children}
    </div>
  );
}
function KPI({ label, value }: { label: string; value: number }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiLabel}>{label}</div>
      <div style={S.kpiValue}>{value}</div>
    </div>
  );
}
function Check({ label, checked, setChecked }: { label: string; checked: boolean; setChecked: (v: boolean) => void }) {
  return (
    <button
      type="button"
      style={{ ...S.checkBtn, ...(checked ? S.checkOn : S.checkOff) }}
      onClick={() => setChecked(!checked)}
    >
      {checked ? "✓ " : ""}{label}
    </button>
  );
}

/* ================= STYLES ================= */
const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: 16,
    background:
      "radial-gradient(1200px 800px at 20% 10%, rgba(255,215,110,0.18), transparent 60%), radial-gradient(900px 700px at 80% 20%, rgba(120,70,255,0.18), transparent 55%), #050816",
    color: "#F9FAFB",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
  },
  shell: { maxWidth: 1100, margin: "0 auto", display: "grid", gap: 12 },
  topRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  h1: { fontSize: 26, fontWeight: 950 },
  muted: { color: "#9CA3AF", fontSize: 13, marginTop: 6 },
  smallMuted: { color: "#9CA3AF", fontSize: 12 },
  smallNote: { marginTop: 10, color: "#A7B0C0", fontSize: 12, lineHeight: 1.35 },

  msg: {
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#E5E7EB",
    fontSize: 13,
  },

  panel: {
    background: "rgba(11,16,32,0.78)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 14,
    backdropFilter: "blur(10px)",
  },
  panelTitle: { fontWeight: 950, color: "#FDE68A", marginBottom: 10 },

  kpiRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 },
  kpi: {
    padding: 12,
    borderRadius: 16,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  kpiLabel: { color: "#9CA3AF", fontSize: 12, fontWeight: 900 },
  kpiValue: { marginTop: 6, fontSize: 22, fontWeight: 950 },

  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  field: { display: "grid", gap: 8 },
  label: { fontSize: 12, color: "#A7B0C0", fontWeight: 900 },

  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#F9FAFB",
    outline: "none",
    fontSize: 14,
  },

  /* ✅ HOVER FIX: dark select + dark options */
  select: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#F9FAFB",
    outline: "none",
    fontSize: 14,
    fontWeight: 900,
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  },
  option: { backgroundColor: "#0B1020", color: "#F9FAFB" },

  textarea: {
    width: "100%",
    minHeight: 90,
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#F9FAFB",
    outline: "none",
    fontSize: 14,
    resize: "vertical",
  },

  row: { display: "flex", gap: 10, alignItems: "center" },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },

  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(212,175,55,0.35)",
    background: "linear-gradient(135deg, rgba(212,175,55,0.32), rgba(139,92,246,0.22))",
    color: "#FFF",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  ghostBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#E5E7EB",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  ghostBtnSmall: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
    color: "#E5E7EB",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontSize: 12,
  },
  dangerBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(248,113,113,0.30)",
    background: "rgba(248,113,113,0.10)",
    color: "#FCA5A5",
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  filters: { display: "grid", gridTemplateColumns: "1fr 200px 180px 180px 200px", gap: 10, marginBottom: 10 },
  empty: { color: "#A7B0C0", fontSize: 13, padding: 10 },

  card: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  cardTitle: { fontWeight: 950, fontSize: 15 },
  cardSub: { marginTop: 4, color: "#A7B0C0", fontSize: 12 },
  metaLine: { display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" },
  note: { marginTop: 8, color: "#C7CFDD", fontSize: 13, lineHeight: 1.35 },

  badge: {
    fontSize: 12,
    fontWeight: 950,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(212,175,55,0.14)",
    border: "1px solid rgba(212,175,55,0.28)",
    color: "#FDE68A",
  },

  availGood: {
    fontSize: 12,
    fontWeight: 950,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.10)",
    border: "1px solid rgba(34,197,94,0.22)",
    color: "#BBF7D0",
  },
  availBad: {
    fontSize: 12,
    fontWeight: 950,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(248,113,113,0.10)",
    border: "1px solid rgba(248,113,113,0.22)",
    color: "#FCA5A5",
  },

  tagLine: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  tag: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(139,92,246,0.12)",
    border: "1px solid rgba(139,92,246,0.22)",
    color: "#E9D5FF",
    fontWeight: 900,
  },

  checkRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  checkBtn: {
    padding: "9px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#E5E7EB",
    fontWeight: 950,
    cursor: "pointer",
    fontSize: 12,
  },
  checkOn: { background: "rgba(212,175,55,0.16)", border: "1px solid rgba(212,175,55,0.25)", color: "#FDE68A" },
  checkOff: {},

  toggleBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#E5E7EB",
    fontWeight: 950,
    cursor: "pointer",
  },
  toggleOn: { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.22)", color: "#BBF7D0" },
  toggleOff: { opacity: 0.75 },

  aiForm: { display: "grid", gridTemplateColumns: "220px 220px 220px 1fr", gap: 12, alignItems: "end" },
  aiGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 },
  aiCard: { padding: 12, borderRadius: 16, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" },
  aiPick: { padding: 10, borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(11,16,32,0.60)" },

  footerNote: { color: "#A7B0C0", fontSize: 12, textAlign: "center", padding: 6 },
};

/* ================= END ================= */
