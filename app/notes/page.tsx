"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

/* ================== STORAGE KEYS ================== */
const LS_EMAIL = "eventura_email";
const LS_SETTINGS = "eventura_os_settings_v3";
const NOTES_KEY = "eventura_notes_v1";

/* ================== TYPES ================== */
type Theme =
  | "Royal Gold"
  | "Midnight Purple"
  | "Emerald Night"
  | "Ocean Blue"
  | "Ruby Noir"
  | "Carbon Black"
  | "Ivory Light";

type AppSettings = {
  theme?: Theme;
  highContrast?: boolean;
  compactTables?: boolean;
  ceoEmail?: string;
};

type Priority = "Low" | "Medium" | "High" | "Critical";
type NoteStatus = "Active" | "Done" | "Archived";

type NoteItem = {
  id: string;
  title: string;
  body: string;
  tags: string; // comma separated
  priority: Priority;
  status: NoteStatus;
  pinned: boolean;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
};

/* ================== SAFE HELPERS ================== */
function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return safeParse<T>(localStorage.getItem(key), fallback);
}
function safeWrite(key: string, value: any) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}
function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function nowISO() {
  return new Date().toISOString();
}
function todayYMD(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
function exportJSON(filename: string, obj: any) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function exportCSV(filename: string, rows: Record<string, any>[]) {
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: any) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function wordCount(s: string) {
  const t = (s || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}
function normalizeTags(s: string) {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 15)
    .join(", ");
}

/* ================== THEME TOKENS ================== */
function ThemeTokens(theme: Theme = "Royal Gold", highContrast?: boolean) {
  const hc = !!highContrast;
  const base = {
    text: "#F9FAFB",
    muted: "#9CA3AF",
    bg: "#050816",
    panel: "rgba(11,16,32,0.60)",
    panel2: "rgba(11,16,32,0.85)",
    border: hc ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.10)",
    soft: hc ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
    inputBg: hc ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
    hoverBlack: "rgba(0,0,0,0.65)",
    okBg: "rgba(34,197,94,0.12)",
    okBd: hc ? "rgba(34,197,94,0.45)" : "rgba(34,197,94,0.28)",
    okTx: "#86EFAC",
    warnBg: "rgba(245,158,11,0.12)",
    warnBd: hc ? "rgba(245,158,11,0.45)" : "rgba(245,158,11,0.28)",
    warnTx: "#FCD34D",
    badBg: "rgba(248,113,113,0.10)",
    badBd: hc ? "rgba(248,113,113,0.55)" : "rgba(248,113,113,0.30)",
    badTx: "#FCA5A5",
  };

  switch (theme) {
    case "Midnight Purple":
      return { ...base, glow1: "rgba(139,92,246,0.22)", glow2: "rgba(212,175,55,0.14)", accentBg: "rgba(139,92,246,0.16)", accentBd: hc ? "rgba(139,92,246,0.55)" : "rgba(139,92,246,0.30)", accentTx: "#DDD6FE" };
    case "Emerald Night":
      return { ...base, glow1: "rgba(16,185,129,0.18)", glow2: "rgba(212,175,55,0.12)", accentBg: "rgba(16,185,129,0.16)", accentBd: hc ? "rgba(16,185,129,0.55)" : "rgba(16,185,129,0.30)", accentTx: "#A7F3D0" };
    case "Ocean Blue":
      return { ...base, glow1: "rgba(59,130,246,0.22)", glow2: "rgba(34,211,238,0.14)", accentBg: "rgba(59,130,246,0.16)", accentBd: hc ? "rgba(59,130,246,0.55)" : "rgba(59,130,246,0.30)", accentTx: "#BFDBFE" };
    case "Ruby Noir":
      return { ...base, glow1: "rgba(244,63,94,0.18)", glow2: "rgba(212,175,55,0.10)", accentBg: "rgba(244,63,94,0.14)", accentBd: hc ? "rgba(244,63,94,0.50)" : "rgba(244,63,94,0.26)", accentTx: "#FDA4AF" };
    case "Carbon Black":
      return { ...base, bg: "#03040A", glow1: "rgba(255,255,255,0.10)", glow2: "rgba(212,175,55,0.10)", accentBg: "rgba(212,175,55,0.14)", accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)", accentTx: "#FDE68A" };
    case "Ivory Light":
      return {
        ...base,
        text: "#111827",
        muted: "#4B5563",
        bg: "#F9FAFB",
        panel: "rgba(255,255,255,0.78)",
        panel2: "rgba(255,255,255,0.92)",
        border: hc ? "rgba(17,24,39,0.22)" : "rgba(17,24,39,0.12)",
        soft: hc ? "rgba(17,24,39,0.07)" : "rgba(17,24,39,0.04)",
        inputBg: hc ? "rgba(17,24,39,0.08)" : "rgba(17,24,39,0.04)",
        glow1: "rgba(212,175,55,0.16)",
        glow2: "rgba(59,130,246,0.14)",
        accentBg: "rgba(212,175,55,0.16)",
        accentBd: hc ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.28)",
        accentTx: "#92400E",
        okTx: "#166534",
        warnTx: "#92400E",
        hoverBlack: "rgba(0,0,0,0.08)",
      };
    default:
      return { ...base, glow1: "rgba(255,215,110,0.18)", glow2: "rgba(120,70,255,0.18)", accentBg: "rgba(212,175,55,0.12)", accentBd: hc ? "rgba(212,175,55,0.50)" : "rgba(212,175,55,0.22)", accentTx: "#FDE68A" };
  }
}

/* ================== PAGE ================== */
export default function NotesPage() {
  const [email, setEmail] = useState("");
  const [settings, setSettings] = useState<AppSettings>({});
  const [msg, setMsg] = useState("");

  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("All");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "All">("All");
  const [statusFilter, setStatusFilter] = useState<NoteStatus | "All">("All");
  const [showLocked, setShowLocked] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [quickTitle, setQuickTitle] = useState("");

  const [draft, setDraft] = useState<{
    title: string;
    body: string;
    tags: string;
    priority: Priority;
    status: NoteStatus;
    pinned: boolean;
    locked: boolean;
  }>({
    title: "",
    body: "",
    tags: "",
    priority: "Medium",
    status: "Active",
    pinned: false,
    locked: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    setEmail(localStorage.getItem(LS_EMAIL) || "");
    setSettings(safeLoad<AppSettings>(LS_SETTINGS, {}));
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toast(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(""), 1400);
  }

  function hydrate() {
    const raw = safeLoad<any[]>(NOTES_KEY, []);
    const norm: NoteItem[] = (Array.isArray(raw) ? raw : [])
      .map((n) => ({
        id: String(n?.id ?? uid()),
        title: String(n?.title ?? "").slice(0, 140),
        body: String(n?.body ?? ""),
        tags: normalizeTags(String(n?.tags ?? "")),
        priority: (String(n?.priority ?? "Medium") as Priority) || "Medium",
        status: (String(n?.status ?? "Active") as NoteStatus) || "Active",
        pinned: !!n?.pinned,
        locked: !!n?.locked,
        createdAt: String(n?.createdAt ?? nowISO()),
        updatedAt: String(n?.updatedAt ?? nowISO()),
      }))
      .filter((x) => x.title || x.body);

    setNotes(sortNotes(norm));
  }

  function persist(next: NoteItem[], toastMsg?: string) {
    const sorted = sortNotes(next);
    setNotes(sorted);
    safeWrite(NOTES_KEY, sorted);
    if (toastMsg) toast(toastMsg);
  }

  function sortNotes(list: NoteItem[]) {
    const pRank: Record<Priority, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.status !== b.status) {
        if (a.status === "Active") return -1;
        if (b.status === "Active") return 1;
      }
      if (pRank[a.priority] !== pRank[b.priority]) return pRank[b.priority] - pRank[a.priority];
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  const T = ThemeTokens((settings.theme as Theme) || "Royal Gold", settings.highContrast);
  const S = useMemo(() => makeStyles(T, !!settings.compactTables), [T, settings.compactTables]);

  const isCEO = useMemo(() => {
    const ceo = (settings.ceoEmail || "hardikvekariya799@gmail.com").toLowerCase();
    return (email || "").toLowerCase() === ceo;
  }, [email, settings.ceoEmail]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      (n.tags || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((t) => set.add(t));
    }
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [notes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (statusFilter !== "All" && n.status !== statusFilter) return false;
      if (priorityFilter !== "All" && n.priority !== priorityFilter) return false;
      if (tagFilter !== "All") {
        const tags = (n.tags || "").toLowerCase().split(",").map((x) => x.trim());
        if (!tags.includes(tagFilter.toLowerCase())) return false;
      }
      if (n.locked && !showLocked) {
        // still allow listing by title, but hide content in UI
      }
      if (!q) return true;
      const blob = [n.title, n.body, n.tags, n.priority, n.status].join(" ").toLowerCase();
      return blob.includes(q);
    });
  }, [notes, search, tagFilter, priorityFilter, statusFilter, showLocked]);

  const stats = useMemo(() => {
    const total = notes.length;
    const active = notes.filter((n) => n.status === "Active").length;
    const done = notes.filter((n) => n.status === "Done").length;
    const pinned = notes.filter((n) => n.pinned).length;
    return { total, active, done, pinned };
  }, [notes]);

  function openAdd(template?: "meeting" | "client" | "follow") {
    setEditingId(null);
    const base = {
      title: "",
      body: "",
      tags: "",
      priority: "Medium" as Priority,
      status: "Active" as NoteStatus,
      pinned: false,
      locked: false,
    };

    if (template === "meeting") {
      base.title = `Meeting Notes — ${todayYMD()}`;
      base.body = `Agenda:\n- \n\nDecisions:\n- \n\nAction Items:\n- [ ] \n`;
      base.tags = "meeting, internal";
    }
    if (template === "client") {
      base.title = `Client Notes — ${todayYMD()}`;
      base.body = `Client:\nEvent:\nBudget:\nKey Requirements:\n- \n\nNext Steps:\n- \n`;
      base.tags = "client, lead";
      base.priority = "High";
    }
    if (template === "follow") {
      base.title = `Follow Up — ${todayYMD()}`;
      base.body = `Who:\nReason:\nMessage:\n\nFollow-up Date:\n`;
      base.tags = "follow-up, urgent";
      base.priority = "High";
    }

    setDraft(base);
    setOpenForm(true);
  }

  function openEdit(id: string) {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    setEditingId(id);
    setDraft({
      title: n.title,
      body: n.body,
      tags: n.tags || "",
      priority: n.priority,
      status: n.status,
      pinned: n.pinned,
      locked: n.locked,
    });
    setOpenForm(true);
  }

  function closeForm() {
    setOpenForm(false);
    setEditingId(null);
  }

  function saveDraft() {
    const title = String(draft.title || "").trim().slice(0, 140);
    const body = String(draft.body || "");
    const tags = normalizeTags(draft.tags || "");

    if (!title && !body.trim()) return toast("❌ Add title or note text");

    const existing = editingId ? notes.find((x) => x.id === editingId) : null;

    const item: NoteItem = {
      id: editingId || uid(),
      title: title || "(Untitled)",
      body,
      tags,
      priority: draft.priority,
      status: draft.status,
      pinned: !!draft.pinned,
      locked: !!draft.locked,
      createdAt: existing?.createdAt || nowISO(),
      updatedAt: nowISO(),
    };

    const next = editingId ? notes.map((x) => (x.id === editingId ? item : x)) : [item, ...notes];
    persist(next, editingId ? "✅ Updated" : "✅ Added");
    closeForm();
  }

  function removeNote(id: string) {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const ok = confirm(`Delete note: "${n.title}" ?`);
    if (!ok) return;
    persist(notes.filter((x) => x.id !== id), "🗑️ Deleted");
  }

  function togglePin(id: string) {
    persist(
      notes.map((x) => (x.id === id ? { ...x, pinned: !x.pinned, updatedAt: nowISO() } : x)),
      "✅ Saved"
    );
  }

  function toggleLock(id: string) {
    persist(
      notes.map((x) => (x.id === id ? { ...x, locked: !x.locked, updatedAt: nowISO() } : x)),
      "✅ Saved"
    );
  }

  function setStatus(id: string, status: NoteStatus) {
    persist(
      notes.map((x) => (x.id === id ? { ...x, status, updatedAt: nowISO() } : x)),
      "✅ Saved"
    );
  }

  function exportAllJSON() {
    exportJSON(`eventura_notes_${todayYMD()}.json`, {
      version: "eventura-notes-v1",
      exportedAt: nowISO(),
      notes,
    });
    toast("✅ Exported JSON");
  }

  function exportAllCSV() {
    exportCSV(`eventura_notes_${todayYMD()}.csv`, notes.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      tags: n.tags,
      priority: n.priority,
      status: n.status,
      pinned: n.pinned,
      locked: n.locked,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      words: wordCount(n.body),
    })));
    toast("✅ Exported CSV");
  }

  function quickAdd() {
    const t = quickTitle.trim();
    if (!t) return;
    const item: NoteItem = {
      id: uid(),
      title: t.slice(0, 140),
      body: "",
      tags: "",
      priority: "Medium",
      status: "Active",
      pinned: false,
      locked: false,
      createdAt: nowISO(),
      updatedAt: nowISO(),
    };
    persist([item, ...notes], "✅ Added");
    setQuickTitle("");
  }

  return (
    <div style={S.app}>
      <aside style={S.sidebar}>
        <div style={S.brandRow}>
          <div style={S.logoCircle}>E</div>
          <div>
            <div style={S.brandName}>Eventura</div>
            <div style={S.brandSub}>Notes</div>
          </div>
        </div>

        <nav style={S.nav}>
          <Link href="/dashboard" style={S.navItem as any}>📊 Dashboard</Link>
          <Link href="/events" style={S.navItem as any}>📅 Events</Link>
          <Link href="/finance" style={S.navItem as any}>💰 Finance</Link>
          <Link href="/vendors" style={S.navItem as any}>🏷️ Vendors</Link>
          <Link href="/hr" style={S.navItem as any}>🧑‍🤝‍🧑 HR</Link>
          <Link href="/notes" style={S.navActive as any}>📝 Notes</Link>
          <Link href="/reports" style={S.navItem as any}>📈 Reports</Link>
          <Link href="/settings" style={S.navItem as any}>⚙️ Settings</Link>
        </nav>

        <div style={S.sidebarFooter}>
          <div style={S.userBox}>
            <div style={S.userLabel}>Signed in</div>
            <div style={S.userEmail}>{email || "Unknown"}</div>
            <div style={S.roleBadge}>{isCEO ? "CEO" : "Staff"}</div>
          </div>
          <div style={S.smallNote}>
            Auto-save: <b>ON</b> • Total: <b>{stats.total}</b>
          </div>
        </div>
      </aside>

      <main style={S.main}>
        <div style={S.header}>
          <div>
            <div style={S.h1}>Notes (Advanced)</div>
            <div style={S.muted}>Create • Edit • Delete • Pin • Search • Export • Auto timestamps</div>
          </div>

          <div style={S.headerRight}>
            <button style={S.secondaryBtn} onClick={hydrate}>Refresh</button>
            <button style={S.secondaryBtn} onClick={exportAllJSON}>Export JSON</button>
            <button style={S.secondaryBtn} onClick={exportAllCSV}>Export CSV</button>
            <button style={S.primaryBtn} onClick={() => openAdd()}>+ New Note</button>
          </div>
        </div>

        {msg ? <div style={S.msg}>{msg}</div> : null}

        {/* Quick Add */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Quick Add</div>
          <div style={S.quickRow}>
            <input
              style={{ ...S.input, width: "100%" }}
              placeholder="Type title and press Enter…"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") quickAdd();
              }}
            />
            <button style={S.primaryBtn} onClick={quickAdd}>Add</button>
          </div>

          <div style={S.templateRow}>
            <button style={S.secondaryBtn} onClick={() => openAdd("meeting")}>Template: Meeting</button>
            <button style={S.secondaryBtn} onClick={() => openAdd("client")}>Template: Client</button>
            <button style={S.secondaryBtn} onClick={() => openAdd("follow")}>Template: Follow-up</button>
          </div>
        </section>

        {/* Filters */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Filters</div>

          <div style={S.filtersGrid}>
            <div style={S.fieldWide}>
              <div style={S.smallMuted}>Search</div>
              <input
                style={{ ...S.input, width: "100%" }}
                placeholder="title, body, tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Tag</div>
              <select style={S.select} value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                {allTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Priority</div>
              <select style={S.select} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)}>
                <option value="All">All</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div style={S.field}>
              <div style={S.smallMuted}>Status</div>
              <select style={S.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Done">Done</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          <div style={S.rowBetween}>
            <div style={S.smallNote}>
              Active: <b>{stats.active}</b> • Done: <b>{stats.done}</b> • Pinned: <b>{stats.pinned}</b>
            </div>

            <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900, color: T.muted }}>
              <input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} />
              Show locked content
            </label>
          </div>
        </section>

        {/* Notes List */}
        <section style={S.panel}>
          <div style={S.panelTitle}>Your Notes</div>

          {!filtered.length ? (
            <div style={S.empty}>No notes found. Create one using “New Note” or Quick Add.</div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {filtered.slice(0, 250).map((n) => (
                <div key={n.id} style={S.noteCard}>
                  <div style={S.rowBetween}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      {n.pinned ? <span style={S.pillAccent}>📌 Pinned</span> : null}
                      <span style={pillPriority(n.priority, S)}>{n.priority}</span>
                      <span style={pillStatus(n.status, S)}>{n.status}</span>
                      {n.locked ? <span style={S.pillWarn}>🔒 Locked</span> : null}
                      {n.tags ? <span style={S.pill}>🏷 {n.tags}</span> : null}
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button style={S.secondaryBtn} onClick={() => togglePin(n.id)}>{n.pinned ? "Unpin" : "Pin"}</button>
                      <button style={S.secondaryBtn} onClick={() => toggleLock(n.id)}>{n.locked ? "Unlock" : "Lock"}</button>
                      <button style={S.secondaryBtn} onClick={() => openEdit(n.id)}>Edit</button>
                      <button style={S.dangerBtn} onClick={() => removeNote(n.id)}>Delete</button>
                    </div>
                  </div>

                  <div style={S.noteTitle}>{n.title}</div>

                  <div style={S.noteBody}>
                    {n.locked && !showLocked ? (
                      <div style={S.lockedBox}>Locked content hidden. Turn on “Show locked content”.</div>
                    ) : (
                      <pre style={S.pre}>{n.body || "—"}</pre>
                    )}
                  </div>

                  <div style={S.noteMetaRow}>
                    <div style={S.smallMuted}>
                      Words: <b>{wordCount(n.body)}</b> • Updated: <b>{new Date(n.updatedAt).toLocaleString()}</b>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button style={S.miniBtn} onClick={() => setStatus(n.id, "Active")}>Active</button>
                      <button style={S.miniBtn} onClick={() => setStatus(n.id, "Done")}>Done</button>
                      <button style={S.miniBtn} onClick={() => setStatus(n.id, "Archived")}>Archive</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Modal */}
        {openForm ? (
          <div style={S.modalOverlay} onClick={closeForm}>
            <div style={S.modal} onClick={(e) => e.stopPropagation()}>
              <div style={S.modalHeader}>
                <div style={S.modalTitle}>{editingId ? "Edit Note" : "New Note"}</div>
                <button style={S.secondaryBtn} onClick={closeForm}>Close</button>
              </div>

              <div style={S.modalGrid}>
                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Title</div>
                  <input
                    style={{ ...S.input, width: "100%" }}
                    value={draft.title}
                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                    placeholder="e.g. Vendor payment reminder"
                  />
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Priority</div>
                  <select style={S.select} value={draft.priority} onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as Priority }))}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Status</div>
                  <select style={S.select} value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as NoteStatus }))}>
                    <option value="Active">Active</option>
                    <option value="Done">Done</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Pinned</div>
                  <label style={S.checkRow}>
                    <input type="checkbox" checked={draft.pinned} onChange={(e) => setDraft((d) => ({ ...d, pinned: e.target.checked }))} />
                    Pin this note
                  </label>
                </div>

                <div style={S.field}>
                  <div style={S.smallMuted}>Locked</div>
                  <label style={S.checkRow}>
                    <input type="checkbox" checked={draft.locked} onChange={(e) => setDraft((d) => ({ ...d, locked: e.target.checked }))} />
                    Hide content on screen
                  </label>
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Tags (comma separated)</div>
                  <input
                    style={{ ...S.input, width: "100%" }}
                    value={draft.tags}
                    onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                    placeholder="client, payment, urgent"
                  />
                </div>

                <div style={S.fieldWide}>
                  <div style={S.smallMuted}>Note</div>
                  <textarea
                    style={S.textarea}
                    value={draft.body}
                    onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                    placeholder="Write your important notes here..."
                  />
                </div>
              </div>

              <div style={S.modalFooter}>
                <button style={S.primaryBtn} onClick={saveDraft}>
                  {editingId ? "Save Changes" : "Add Note"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div style={S.footerNote}>✅ Auto-save • ✅ Search/Filters • ✅ Pin/Lock • ✅ Export • ✅ Deploy-safe</div>
      </main>
    </div>
  );
}

/* ================== PILL STYLES ================== */
function pillPriority(p: Priority, S: any) {
  if (p === "Critical") return S.pillBad;
  if (p === "High") return S.pillWarn;
  if (p === "Medium") return S.pillAccent;
  return S.pill;
}
function pillStatus(s: NoteStatus, S: any) {
  if (s === "Done") return S.pillOk;
  if (s === "Archived") return S.pill;
  return S.pillAccent;
}

/* ================== STYLES ================== */
function makeStyles(T: any, compact: boolean): Record<string, CSSProperties> {
  return {
    app: {
      minHeight: "100vh",
      display: "flex",
      background: `radial-gradient(1200px 800px at 20% 10%, ${T.glow1}, transparent 60%),
                   radial-gradient(900px 700px at 80% 20%, ${T.glow2}, transparent 55%),
                   ${T.bg}`,
      color: T.text,
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
    },

    sidebar: {
      width: 290,
      position: "sticky",
      top: 0,
      height: "100vh",
      padding: 12,
      borderRight: `1px solid ${T.border}`,
      background: T.panel2,
      backdropFilter: "blur(10px)",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    },

    brandRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 8px" },
    logoCircle: {
      width: 40,
      height: 40,
      borderRadius: 14,
      display: "grid",
      placeItems: "center",
      fontWeight: 950,
      background: `linear-gradient(135deg, ${T.accentBg}, rgba(255,255,255,0.06))`,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
    },
    brandName: { fontWeight: 950, lineHeight: 1.1 },
    brandSub: { color: T.muted, fontSize: 12, marginTop: 2 },

    nav: { display: "grid", gap: 8, marginTop: 6 },
    navItem: {
      display: "block",
      padding: "12px 12px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.border}`,
      background: T.soft,
      fontWeight: 900,
      fontSize: 13,
      transition: "transform 120ms ease, background 120ms ease, border-color 120ms ease",
    },
    navActive: {
      display: "block",
      padding: "12px 12px",
      borderRadius: 14,
      textDecoration: "none",
      color: T.text,
      border: `1px solid ${T.accentBd}`,
      background: T.accentBg,
      fontWeight: 950,
      fontSize: 13,
    },

    sidebarFooter: { marginTop: "auto", display: "grid", gap: 10 },
    userBox: { padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft },
    userLabel: { fontSize: 12, color: T.muted, fontWeight: 900 },
    userEmail: { fontSize: 13, fontWeight: 900, marginTop: 6, wordBreak: "break-word" },
    roleBadge: {
      marginTop: 10,
      display: "inline-flex",
      padding: "5px 10px",
      borderRadius: 999,
      background: T.accentBg,
      border: `1px solid ${T.accentBd}`,
      color: T.accentTx,
      fontWeight: 950,
      width: "fit-content",
    },

    main: { flex: 1, padding: 16, maxWidth: 1500, margin: "0 auto", width: "100%" },

    header: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      border: `1px solid ${T.border}`,
      background: T.panel,
      backdropFilter: "blur(10px)",
    },
    headerRight: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },

    h1: { fontSize: 26, fontWeight: 950 },
    muted: { color: T.muted, fontSize: 13, marginTop: 6 },
    smallMuted: { color: T.muted, fontSize: 12 },
    smallNote: { color: T.muted, fontSize: 12, lineHeight: 1.35 },

    msg: { marginTop: 12, padding: 10, borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontSize: 13 },

    primaryBtn: { padding: "12px 14px", borderRadius: 14, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, cursor: "pointer" },
    secondaryBtn: { padding: "12px 14px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontWeight: 950, cursor: "pointer" },
    dangerBtn: { padding: "12px 14px", borderRadius: 14, border: `1px solid ${T.badBd}`, background: T.badBg, color: T.badTx, fontWeight: 950, cursor: "pointer" },
    miniBtn: { padding: "8px 10px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.soft, color: T.text, fontWeight: 950, cursor: "pointer", fontSize: 12 },

    panel: { marginTop: 12, padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel, backdropFilter: "blur(10px)" },
    panelTitle: { fontWeight: 950, color: T.accentTx },

    quickRow: { marginTop: 12, display: "flex", gap: 10, alignItems: "center" },
    templateRow: { marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" },

    filtersGrid: { marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "1fr 240px 240px 240px", alignItems: "end" },
    field: { display: "grid", gap: 6 },
    fieldWide: { display: "grid", gap: 6 },

    input: { width: 240, padding: compact ? "10px 10px" : "12px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, outline: "none", fontSize: 14 },
    select: { width: 240, padding: compact ? "10px 10px" : "12px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, outline: "none", fontSize: 14 },

    textarea: {
      width: "100%",
      minHeight: 240,
      resize: "vertical",
      padding: "12px 12px",
      borderRadius: 14,
      border: `1px solid ${T.border}`,
      background: T.inputBg,
      color: T.text,
      outline: "none",
      fontSize: 14,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace',
      lineHeight: 1.45,
    },

    rowBetween: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginTop: 12 },

    noteCard: { padding: 14, borderRadius: 18, border: `1px solid ${T.border}`, background: T.soft },
    noteTitle: { marginTop: 12, fontSize: 16, fontWeight: 950 },
    noteBody: { marginTop: 10 },
    pre: {
      margin: 0,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.55,
      color: T.text,
    },

    noteMetaRow: {
      marginTop: 12,
      paddingTop: 12,
      borderTop: `1px solid ${T.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
    },

    pill: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillAccent: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.accentBd}`, background: T.accentBg, color: T.accentTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillOk: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.okBd}`, background: T.okBg, color: T.okTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillWarn: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.warnBd}`, background: T.warnBg, color: T.warnTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },
    pillBad: { padding: "6px 10px", borderRadius: 999, border: `1px solid ${T.badBd}`, background: T.badBg, color: T.badTx, fontWeight: 950, fontSize: 12, whiteSpace: "nowrap" },

    lockedBox: { padding: 12, borderRadius: 14, border: `1px solid ${T.border}`, background: "rgba(0,0,0,0.35)", color: T.muted, fontWeight: 900 },

    empty: { marginTop: 12, padding: 12, borderRadius: 16, border: `1px solid ${T.border}`, background: T.soft, color: T.muted, fontWeight: 900 },

    checkRow: { display: "flex", gap: 10, alignItems: "center", fontWeight: 900, color: T.muted },

    modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", padding: 14, zIndex: 50 },
    modal: { width: "min(1100px, 100%)", borderRadius: 18, border: `1px solid ${T.border}`, background: T.panel2, backdropFilter: "blur(10px)", padding: 14 },
    modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
    modalTitle: { fontWeight: 950, fontSize: 18, color: T.accentTx },
    modalGrid: { marginTop: 12, display: "grid", gridTemplateColumns: "1fr 220px 220px 220px 220px", gap: 10, alignItems: "end" },
    modalFooter: { marginTop: 12, display: "flex", justifyContent: "flex-end" },

    footerNote: { color: T.muted, fontSize: 12, textAlign: "center", padding: 10 },
  };
}
