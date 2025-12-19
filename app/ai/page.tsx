"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ================= TYPES ================= */
type EventType =
  | "Wedding"
  | "Engagement"
  | "Reception"
  | "Sangeet"
  | "Corporate"
  | "Birthday"
  | "Other";

type Tone = "Professional" | "Friendly" | "Luxury" | "Urgent";

type GeneratedDoc = {
  id: string;
  type:
    | "Proposal"
    | "Negotiation Script"
    | "Client Follow-up"
    | "Budget Optimization"
    | "Timeline Checklist";
  title: string;
  createdAt: string;
  inputs: Record<string, any>;
  output: string;
};

const LS_AI_DOCS = "eventura_os_ai_docs_v1";

/* ================= HELPERS ================= */
function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function inr(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(Math.round(n));
  }
}
function loadDocs(): GeneratedDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_AI_DOCS);
    return raw ? (JSON.parse(raw) as GeneratedDoc[]) : [];
  } catch {
    return [];
  }
}
function saveDocs(items: GeneratedDoc[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_AI_DOCS, JSON.stringify(items));
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
function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text);
}

/* ================= "AI" GENERATORS (LOCAL) ================= */
function tonePrefix(tone: Tone) {
  if (tone === "Luxury") return "Luxury / Premium tone";
  if (tone === "Urgent") return "Urgent but polite tone";
  if (tone === "Friendly") return "Friendly tone";
  return "Professional tone";
}

function genProposal(input: {
  brand: string;
  clientName: string;
  eventType: EventType;
  city: string;
  date: string;
  guests: number;
  budget: number;
  theme: string;
  tone: Tone;
}) {
  const { brand, clientName, eventType, city, date, guests, budget, theme, tone } = input;
  const heading = `${brand} — Event Proposal`;
  const sections = [
    `Client: ${clientName}`,
    `Event: ${eventType}`,
    `City: ${city}`,
    `Date: ${date || "TBD"}`,
    `Guests: ~${guests || 0}`,
    `Budget Range: ₹${inr(budget || 0)}`,
    `Theme: ${theme || "Elegant / Royal"}`,
  ].join("\n");

  const core = `
${heading}
${"-".repeat(55)}
${sections}

${tonePrefix(tone)}
Overview:
We will design a seamless, high-impact ${eventType.toLowerCase()} experience with a ${theme || "royal"} concept, premium vendor coordination, and end-to-end execution.

Deliverables (Included):
1) Concept & Theme Design (stage, entry, seating, lighting, florals)
2) Vendor Management (venue, decor, catering, photo/video, DJ/sound)
3) Timeline & On-ground Operations (setup, rehearsal, show flow)
4) Guest Experience (welcome, signage, hospitality desk)
5) Budget Control + Cost Optimization (weekly updates)
6) Final Execution & Wrap-up (handover + post-event checklist)

Suggested Event Flow:
- Welcome & entry experience
- Stage highlights + photo moments
- Entertainment blocks (if required)
- Dinner service coordination
- Grand finale / couple entry / closing

Budget Breakdown Suggestion (approx):
- Decor & Styling: 30–40%
- Venue & Logistics: 20–30%
- Catering: 25–35%
- Photo/Video: 8–12%
- Entertainment / DJ: 5–10%
- Contingency: 5%

Next Steps:
1) Confirm date & venue shortlisting
2) Freeze theme + stage concept
3) Vendor quotations (3 options per category)
4) Final cost sheet + booking schedule

Prepared by: ${brand}
Contact: (add your official phone/email)
`;
  return core.trim();
}

function genNegotiationScript(input: {
  vendorName: string;
  category: string;
  city: string;
  budget: number;
  tone: Tone;
}) {
  const { vendorName, category, city, budget, tone } = input;

  return `
Vendor Negotiation Script — ${category}
Vendor: ${vendorName} | City: ${city}
Target Budget: ₹${inr(budget)}

${tonePrefix(tone)}
Call / WhatsApp Script:
1) Greeting:
“Hi ${vendorName}, this is Eventura. We’re planning upcoming events in ${city} and your work looks strong.”

2) Requirement:
“We need ${category} for a premium event. Please share your best package options with inclusions.”

3) Price Anchoring:
“Our target range is around ₹${inr(budget)}. If you can match this with quality, we can confirm quickly.”

4) Value Exchange:
“We can give you repeat bookings + vendor listing priority for future events.”

5) Discount / Add-ons:
“Can you reduce 8–12% or include an add-on (extra lights / extra staff / premium props) at same price?”

6) Payment Terms:
“Advance 30–40% now, remaining after setup/check. Please confirm your policy.”

7) Closing:
“If you share final quotation today, we can lock it by evening.”

Bonus Questions:
- What is your cancellation policy?
- Do you handle logistics/setup/staff?
- Any previous wedding/corporate references?
`.trim();
}

function genClientFollowUp(input: {
  clientName: string;
  eventType: EventType;
  city: string;
  budget: number;
  tone: Tone;
}) {
  const { clientName, eventType, city, budget, tone } = input;

  const lines: string[] = [];
  if (tone === "Luxury") {
    lines.push(
      `Hi ${clientName}, this is Eventura ✨`,
      `We’ve prepared a premium concept for your ${eventType.toLowerCase()} in ${city} within ₹${inr(budget)}.`,
      `If you confirm today, we can block the best vendors and design slots.`,
      `Would you like Option A (Royal) or Option B (Modern Luxury)?`
    );
  } else if (tone === "Friendly") {
    lines.push(
      `Hi ${clientName}! 😊 Eventura here.`,
      `Quick update: we can plan your ${eventType.toLowerCase()} in ${city} under ₹${inr(budget)} with 2-3 theme choices.`,
      `When can we hop on a 10-min call today?`
    );
  } else if (tone === "Urgent") {
    lines.push(
      `Hi ${clientName}, Eventura here.`,
      `Important: vendor availability is filling fast for ${city}.`,
      `If you confirm today, we can lock pricing within ₹${inr(budget)}.`,
      `Can you confirm your preferred time for a quick call?`
    );
  } else {
    lines.push(
      `Hi ${clientName}, this is Eventura.`,
      `We have prepared a plan for your ${eventType.toLowerCase()} in ${city} within ₹${inr(budget)}.`,
      `Please share your preferred date/time for a short call to finalize theme + bookings.`
    );
  }

  lines.push("", "— Eventura", "Events that speak your style");
  return lines.join("\n");
}

function genBudgetOptimizer(input: {
  budget: number;
  guests: number;
  priority: "Luxury look" | "Low cost" | "Balanced";
}) {
  const { budget, guests, priority } = input;
  const perHead = guests > 0 ? Math.round(budget / guests) : 0;

  const tips: string[] = [];
  tips.push(`Budget Optimization Report`);
  tips.push(`Total Budget: ₹${inr(budget)} | Guests: ${guests} | Per-head: ₹${inr(perHead)}`);
  tips.push("");

  if (priority === "Luxury look") {
    tips.push(
      "Goal: keep luxury look while saving money",
      "- Reduce stage size but increase lighting + florals for premium feel",
      "- Use premium focal points (entry + stage) and keep other areas minimal",
      "- Negotiate vendor combo packages (photo+video / decor+lighting)",
      "- Limit expensive props; use fabric drapes + warm lighting"
    );
  } else if (priority === "Low cost") {
    tips.push(
      "Goal: reduce cost aggressively",
      "- Choose off-peak dates/time slots if possible",
      "- Replace fresh flowers with mix of artificial + limited fresh",
      "- Keep menu items limited but high quality",
      "- Reduce entertainment and use curated playlist instead of full DJ"
    );
  } else {
    tips.push(
      "Goal: balanced value",
      "- Split spend: 35% decor, 30% catering, 15% venue/logistics, 10% photo/video, 5% entertainment, 5% buffer",
      "- Collect 60–70% client payment before major vendor payouts",
      "- Always take 3 quotes per vendor category"
    );
  }

  tips.push("");
  tips.push("Quick Savings (usually 8–15%):");
  tips.push("- Early booking discounts");
  tips.push("- Bundle vendors (same supplier for multiple services)");
  tips.push("- Standardize common items (chairs, table covers, lights)");
  tips.push("");
  tips.push("Risk Control:");
  tips.push("- Keep 5% contingency");
  tips.push("- Written scope + cancellation terms");

  return tips.join("\n");
}

function genTimelineChecklist(input: { eventType: EventType; date: string; city: string; guests: number }) {
  const { eventType, date, city, guests } = input;
  const base = [
    `Timeline Checklist — ${eventType}`,
    `City: ${city} | Date: ${date || "TBD"} | Guests: ${guests || 0}`,
    "",
    "T-30 to T-21 days:",
    "- Finalize venue shortlisting + visit",
    "- Freeze theme moodboard + stage concept",
    "- Vendor quotations (3 options each): decor, catering, photo/video, DJ/sound",
    "- Confirm initial budget sheet + payment plan",
    "",
    "T-20 to T-14 days:",
    "- Vendor bookings (advance payments)",
    "- Final guest flow plan (entry → stage → dining)",
    "- Print/signage list (welcome boards, table numbers)",
    "",
    "T-13 to T-7 days:",
    "- Final menu tasting (if catering)",
    "- Logistics: transport, hotel rooms, helper staff",
    "- Confirm music playlist + show flow",
    "",
    "T-6 to T-2 days:",
    "- Final vendor reconfirmation call",
    "- Material checklist + loading plan",
    "- Emergency kit (tapes, tools, extension cords, lights)",
    "",
    "Event Day:",
    "- Setup supervision + QC checkpoints",
    "- Guest management & hospitality desk",
    "- Vendor coordination (timings + handover)",
    "- Payments/receipts tracking",
    "",
    "T+1 day:",
    "- Vendor settlements + feedback",
    "- Client wrap-up + photos delivery timeline",
  ];
  return base.join("\n");
}

/* ================= PAGE ================= */
export default function AIPage() {
  const [docs, setDocs] = useState<GeneratedDoc[]>([]);
  const [activeTool, setActiveTool] = useState<
    "Proposal" | "Negotiation" | "FollowUp" | "Budget" | "Timeline"
  >("Proposal");

  const [msg, setMsg] = useState("");

  // Proposal inputs
  const [brand, setBrand] = useState("Eventura");
  const [clientName, setClientName] = useState("");
  const [eventType, setEventType] = useState<EventType>("Wedding");
  const [city, setCity] = useState("Surat");
  const [date, setDate] = useState(todayISO());
  const [guests, setGuests] = useState<string>("300");
  const [budget, setBudget] = useState<string>("500000");
  const [theme, setTheme] = useState("Royal Gold");
  const [tone, setTone] = useState<Tone>("Luxury");

  // Negotiation inputs
  const [vendorName, setVendorName] = useState("");
  const [vendorCategory, setVendorCategory] = useState("Decor");
  const [vendorCity, setVendorCity] = useState("Surat");
  const [vendorBudget, setVendorBudget] = useState<string>("150000");
  const [vendorTone, setVendorTone] = useState<Tone>("Professional");

  // Follow-up inputs
  const [fuClient, setFuClient] = useState("");
  const [fuType, setFuType] = useState<EventType>("Wedding");
  const [fuCity, setFuCity] = useState("Surat");
  const [fuBudget, setFuBudget] = useState<string>("500000");
  const [fuTone, setFuTone] = useState<Tone>("Friendly");

  // Budget optimizer
  const [boBudget, setBoBudget] = useState<string>("500000");
  const [boGuests, setBoGuests] = useState<string>("300");
  const [boPriority, setBoPriority] = useState<"Luxury look" | "Low cost" | "Balanced">("Balanced");

  // Timeline
  const [tlType, setTlType] = useState<EventType>("Wedding");
  const [tlDate, setTlDate] = useState(todayISO());
  const [tlCity, setTlCity] = useState("Surat");
  const [tlGuests, setTlGuests] = useState<string>("300");

  useEffect(() => {
    setDocs(loadDocs());
  }, []);

  useEffect(() => {
    saveDocs(docs);
  }, [docs]);

  const recent = useMemo(() => [...docs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [docs]);

  function addDoc(doc: Omit<GeneratedDoc, "id" | "createdAt">) {
    const item: GeneratedDoc = {
      id: uid(),
      createdAt: new Date().toISOString(),
      ...doc,
    };
    setDocs((prev) => [item, ...prev]);
    setMsg("✅ Generated and saved");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteDoc(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setMsg("✅ Deleted");
  }

  function runTool() {
    setMsg("");

    if (activeTool === "Proposal") {
      const b = Number(budget);
      const g = Number(guests);
      if (!clientName.trim()) return setMsg("❌ Client name required");
      if (budget.trim() && Number.isNaN(b)) return setMsg("❌ Budget invalid");
      if (guests.trim() && Number.isNaN(g)) return setMsg("❌ Guests invalid");

      const out = genProposal({
        brand,
        clientName: clientName.trim(),
        eventType,
        city,
        date,
        guests: Number.isNaN(g) ? 0 : g,
        budget: Number.isNaN(b) ? 0 : b,
        theme,
        tone,
      });

      addDoc({
        type: "Proposal",
        title: `${clientName.trim()} • ${eventType} • Proposal`,
        inputs: { brand, clientName, eventType, city, date, guests, budget, theme, tone },
        output: out,
      });
      return;
    }

    if (activeTool === "Negotiation") {
      const b = Number(vendorBudget);
      if (!vendorName.trim()) return setMsg("❌ Vendor name required");
      if (vendorBudget.trim() && Number.isNaN(b)) return setMsg("❌ Budget invalid");

      const out = genNegotiationScript({
        vendorName: vendorName.trim(),
        category: vendorCategory,
        city: vendorCity,
        budget: Number.isNaN(b) ? 0 : b,
        tone: vendorTone,
      });

      addDoc({
        type: "Negotiation Script",
        title: `${vendorName.trim()} • ${vendorCategory}`,
        inputs: { vendorName, vendorCategory, vendorCity, vendorBudget, vendorTone },
        output: out,
      });
      return;
    }

    if (activeTool === "FollowUp") {
      const b = Number(fuBudget);
      if (!fuClient.trim()) return setMsg("❌ Client name required");
      if (fuBudget.trim() && Number.isNaN(b)) return setMsg("❌ Budget invalid");

      const out = genClientFollowUp({
        clientName: fuClient.trim(),
        eventType: fuType,
        city: fuCity,
        budget: Number.isNaN(b) ? 0 : b,
        tone: fuTone,
      });

      addDoc({
        type: "Client Follow-up",
        title: `${fuClient.trim()} • Follow-up`,
        inputs: { fuClient, fuType, fuCity, fuBudget, fuTone },
        output: out,
      });
      return;
    }

    if (activeTool === "Budget") {
      const b = Number(boBudget);
      const g = Number(boGuests);
      if (boBudget.trim() && Number.isNaN(b)) return setMsg("❌ Budget invalid");
      if (boGuests.trim() && Number.isNaN(g)) return setMsg("❌ Guests invalid");

      const out = genBudgetOptimizer({
        budget: Number.isNaN(b) ? 0 : b,
        guests: Number.isNaN(g) ? 0 : g,
        priority: boPriority,
      });

      addDoc({
        type: "Budget Optimization",
        title: `Budget Optimization • ₹${inr(Number.isNaN(b) ? 0 : b)}`,
        inputs: { boBudget, boGuests, boPriority },
        output: out,
      });
      return;
    }

    if (activeTool === "Timeline") {
      const g = Number(tlGuests);
      if (tlGuests.trim() && Number.isNaN(g)) return setMsg("❌ Guests invalid");

      const out = genTimelineChecklist({
        eventType: tlType,
        date: tlDate,
        city: tlCity,
        guests: Number.isNaN(g) ? 0 : g,
      });

      addDoc({
        type: "Timeline Checklist",
        title: `${tlType} • Timeline`,
        inputs: { tlType, tlDate, tlCity, tlGuests },
        output: out,
      });
      return;
    }
  }

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div style={S.topRow}>
          <div>
            <div style={S.h1}>AI Tools</div>
            <div style={S.muted}>
              Proposal • Negotiation • Follow-ups • Budget optimizer • Timeline generator (works without API)
            </div>
          </div>
          <div style={S.row}>
            <button
              style={S.ghostBtn}
              onClick={() =>
                downloadJSON(`eventura_ai_${new Date().toISOString().slice(0, 10)}.json`, { docs })
              }
              title="Download AI docs"
            >
              Export
            </button>
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* TOOL SELECT */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Choose Tool</div>
          <div style={S.toolRow}>
            <ToolBtn active={activeTool === "Proposal"} onClick={() => setActiveTool("Proposal")} label="Proposal" />
            <ToolBtn
              active={activeTool === "Negotiation"}
              onClick={() => setActiveTool("Negotiation")}
              label="Vendor Negotiation"
            />
            <ToolBtn
              active={activeTool === "FollowUp"}
              onClick={() => setActiveTool("FollowUp")}
              label="Client Follow-up"
            />
            <ToolBtn active={activeTool === "Budget"} onClick={() => setActiveTool("Budget")} label="Budget Optimizer" />
            <ToolBtn active={activeTool === "Timeline"} onClick={() => setActiveTool("Timeline")} label="Timeline/Checklist" />
          </div>
        </div>

        {/* TOOL FORMS */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Inputs</div>

          {activeTool === "Proposal" ? (
            <div style={S.grid2}>
              <Field label="Brand">
                <input style={S.input} value={brand} onChange={(e) => setBrand(e.target.value)} />
              </Field>
              <Field label="Client Name">
                <input style={S.input} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client full name" />
              </Field>
              <Field label="Event Type">
                <select style={S.select} value={eventType} onChange={(e) => setEventType(e.target.value as any)}>
                  {["Wedding", "Engagement", "Reception", "Sangeet", "Corporate", "Birthday", "Other"].map((t) => (
                    <option key={t} style={S.option}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tone">
                <select style={S.select} value={tone} onChange={(e) => setTone(e.target.value as any)}>
                  {["Professional", "Friendly", "Luxury", "Urgent"].map((t) => (
                    <option key={t} style={S.option}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="City">
                <input style={S.input} value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field label="Date">
                <input style={S.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Guests">
                <input style={S.input} value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="300" />
              </Field>
              <Field label="Budget (₹)">
                <input style={S.input} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="500000" />
              </Field>
              <Field label="Theme" full>
                <input style={S.input} value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="Royal Gold / Modern Luxury / Minimal Elegant" />
              </Field>
            </div>
          ) : null}

          {activeTool === "Negotiation" ? (
            <div style={S.grid2}>
              <Field label="Vendor Name">
                <input style={S.input} value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" />
              </Field>
              <Field label="Category">
                <input style={S.input} value={vendorCategory} onChange={(e) => setVendorCategory(e.target.value)} placeholder="Decor / Catering / Venue" />
              </Field>
              <Field label="City">
                <input style={S.input} value={vendorCity} onChange={(e) => setVendorCity(e.target.value)} />
              </Field>
              <Field label="Target Budget (₹)">
                <input style={S.input} value={vendorBudget} onChange={(e) => setVendorBudget(e.target.value)} placeholder="150000" />
              </Field>
              <Field label="Tone" full>
                <select style={S.select} value={vendorTone} onChange={(e) => setVendorTone(e.target.value as any)}>
                  {["Professional", "Friendly", "Luxury", "Urgent"].map((t) => (
                    <option key={t} style={S.option}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          {activeTool === "FollowUp" ? (
            <div style={S.grid2}>
              <Field label="Client Name">
                <input style={S.input} value={fuClient} onChange={(e) => setFuClient(e.target.value)} />
              </Field>
              <Field label="Event Type">
                <select style={S.select} value={fuType} onChange={(e) => setFuType(e.target.value as any)}>
                  {["Wedding", "Engagement", "Reception", "Sangeet", "Corporate", "Birthday", "Other"].map((t) => (
                    <option key={t} style={S.option}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="City">
                <input style={S.input} value={fuCity} onChange={(e) => setFuCity(e.target.value)} />
              </Field>
              <Field label="Budget (₹)">
                <input style={S.input} value={fuBudget} onChange={(e) => setFuBudget(e.target.value)} />
              </Field>
              <Field label="Tone" full>
                <select style={S.select} value={fuTone} onChange={(e) => setFuTone(e.target.value as any)}>
                  {["Professional", "Friendly", "Luxury", "Urgent"].map((t) => (
                    <option key={t} style={S.option}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          {activeTool === "Budget" ? (
            <div style={S.grid2}>
              <Field label="Total Budget (₹)">
                <input style={S.input} value={boBudget} onChange={(e) => setBoBudget(e.target.value)} />
              </Field>
              <Field label="Guests">
                <input style={S.input} value={boGuests} onChange={(e) => setBoGuests(e.target.value)} />
              </Field>
              <Field label="Priority" full>
                <select style={S.select} value={boPriority} onChange={(e) => setBoPriority(e.target.value as any)}>
                  {["Balanced", "Luxury look", "Low cost"].map((t) => (
                    <option key={t} style={S.option}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          {activeTool === "Timeline" ? (
            <div style={S.grid2}>
              <Field label="Event Type">
                <select style={S.select} value={tlType} onChange={(e) => setTlType(e.target.value as any)}>
                  {["Wedding", "Engagement", "Reception", "Sangeet", "Corporate", "Birthday", "Other"].map((t) => (
                    <option key={t} style={S.option}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date">
                <input style={S.input} type="date" value={tlDate} onChange={(e) => setTlDate(e.target.value)} />
              </Field>
              <Field label="City">
                <input style={S.input} value={tlCity} onChange={(e) => setTlCity(e.target.value)} />
              </Field>
              <Field label="Guests">
                <input style={S.input} value={tlGuests} onChange={(e) => setTlGuests(e.target.value)} />
              </Field>
            </div>
          ) : null}

          <div style={S.rowBetween}>
            <div style={S.smallMuted}>Generates text instantly and saves in this tab (localStorage).</div>
            <button style={S.primaryBtn} onClick={runTool}>
              Generate
            </button>
          </div>
        </div>

        {/* RECENT OUTPUTS */}
        <div style={S.panel}>
          <div style={S.panelTitle}>Generated Outputs</div>

          {!recent.length ? (
            <div style={S.empty}>No generated outputs yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {recent.map((d) => (
                <div key={d.id} style={S.card}>
                  <div style={S.rowBetween}>
                    <div>
                      <div style={S.cardTitle}>{d.title}</div>
                      <div style={S.cardSub}>
                        {d.type} • {new Date(d.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={S.row}>
                      <button
                        style={S.ghostBtn}
                        onClick={() => {
                          copyToClipboard(d.output);
                          setMsg("✅ Copied to clipboard");
                        }}
                      >
                        Copy
                      </button>
                      <button style={S.dangerBtn} onClick={() => deleteDoc(d.id)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <pre style={S.pre}>{d.output}</pre>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={S.footerNote}>✅ Hover fixed on dropdown/options. ✅ Works without API. ✅ Saved locally.</div>
      </div>
    </div>
  );
}

/* ================= UI PARTS ================= */
function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ ...S.field, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={S.label}>{label}</div>
      {children}
    </div>
  );
}

function ToolBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      style={{ ...S.toolBtn, ...(active ? S.toolBtnActive : null) }}
      onClick={onClick}
    >
      {label}
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

  toolRow: { display: "flex", flexWrap: "wrap", gap: 10 },
  toolBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#E5E7EB",
    fontWeight: 950,
    cursor: "pointer",
  },
  toolBtnActive: {
    border: "1px solid rgba(212,175,55,0.35)",
    background: "linear-gradient(135deg, rgba(212,175,55,0.20), rgba(139,92,246,0.18))",
    color: "#FDE68A",
  },

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

  empty: { color: "#A7B0C0", fontSize: 13, padding: 10 },

  card: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  cardTitle: { fontWeight: 950, fontSize: 15 },
  cardSub: { marginTop: 4, color: "#A7B0C0", fontSize: 12 },

  pre: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,32,0.70)",
    color: "#E5E7EB",
    whiteSpace: "pre-wrap",
    lineHeight: 1.35,
    fontSize: 13,
  },

  footerNote: { color: "#A7B0C0", fontSize: 12, textAlign: "center", padding: 6 },
};

/* ================= END ================= */
