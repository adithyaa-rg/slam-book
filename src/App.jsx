import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ██████████████████████   EASY SETUP CONFIG   ████████████████████████████████
// ─────────────────────────────────────────────────────────────────────────────
// Edit ONLY this section to personalize your Slam Book and connect services.
// Everything below it is the app code — you don't need to touch that.

const CONFIG = {
  // ── Personal ─────────────────────────────────────────────────────────────
  ownerName: "Adithyaa",
  tagline: "A personal archive of notes, memories, and future letters.",

  // ── Time Capsule default unlock date (YYYY-MM-DD) ─────────────────────────
  defaultCapsuleUnlockDate: "2027-01-01",

  // ── Email / Mailing ───────────────────────────────────────────────────────
  // When a time capsule unlocks, the app can email a reminder.
  // Set up a free EmailJS account at https://www.emailjs.com and paste IDs here.
  email: {
    enabled: false,            // flip to true once you add the IDs below
    serviceId: "service_1o9l95x",   // e.g. "service_abc123"
    templateId: "template_scp855x", // e.g. "template_xyz789"
    publicKey: "cQdNm5FLtsyrIlcOx",   // e.g. "Abcdef1234567890"
    recipientEmail: "adithyaa2003@gmail.com",      // where capsule emails go
  },

  // ── Google Drive backup ───────────────────────────────────────────────────
  // Backs up entries as JSON to your Drive. Uses Google Identity Services.
  // Steps:
  //   1. Go to console.cloud.google.com → create a project
  //   2. Enable "Google Drive API" and "Google Identity" APIs
  //   3. Create OAuth 2.0 credentials (Web App), add this page's URL to origins
  //   4. Paste the Client ID below and flip enabled to true
  googleDrive: {
    enabled: true,
    clientId: "577415369913-5vpsor6i2gpfe5oaq86i1n8h9iogmrq8.apps.googleusercontent.com.apps.googleusercontent.com",
    backupFileName: "slam-book-backup.json",
  },

  // ── Auto-email schedule ───────────────────────────────────────────────────
  // Controls when the app checks if any capsule has unlocked and sends emails.
  // This runs in-browser on page load; for reliable server-side scheduling,
  // set up a cron job that hits your backend, or use a service like Zapier.
  checkCapsulesOnLoad: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// ██████████████████████   APP CODE BELOW   ███████████████████████████████████
// (No need to edit past this line unless you want to change the UI itself)
// ─────────────────────────────────────────────────────────────────────────────

const NAVY = "#1B2A41";
const PINK = "#F6D6D6";
const RED = "#C94C4C";
const CREAM = "#FFFDF7";
const SAGE = "#A3B18A";

const PALETTE = [PINK, SAGE, CREAM, "#EDE0D4", "#D4E6F1", "#E8D5C4"];
const EMOJIS = ["💌", "🌸", "✨", "🎵", "🌿", "🧡", "💛", "🦋", "📝", "🌙", "🎨", "🌻"];

const SEED = [

];

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function fmtDate(s) {
  return new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}
function isLocked(unlockDate) {
  return unlockDate && new Date(unlockDate) > new Date();
}

// ─── Google Drive helper ──────────────────────────────────────────────────────
async function backupToGoogleDrive(entries) {
  if (!CONFIG.googleDrive.enabled) return;
  try {
    const { google } = window;
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.googleDrive.clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: async (resp) => {
        if (resp.error) return;
        const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
        const meta = JSON.stringify({ name: CONFIG.googleDrive.backupFileName, mimeType: "application/json" });
        const form = new FormData();
        form.append("metadata", new Blob([meta], { type: "application/json" }));
        form.append("file", blob);
        await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: { Authorization: `Bearer ${resp.access_token}` },
          body: form,
        });
        alert("✅ Backed up to Google Drive!");
      },
    });
    tokenClient.requestAccessToken();
  } catch (e) {
    console.error("Google Drive backup failed:", e);
  }
}

// ─── EmailJS capsule notification helper ─────────────────────────────────────
async function sendCapsuleEmail(entry) {
  if (!CONFIG.email.enabled) return;
  const { emailjs } = window;
  if (!emailjs) return;
  await emailjs.send(
    CONFIG.email.serviceId,
    CONFIG.email.templateId,
    {
      to_email: CONFIG.email.recipientEmail,
      from_name: entry.name,
      memory: entry.memory,
      message: entry.message,
      unlock_date: fmtDate(entry.unlockDate),
      owner_name: CONFIG.ownerName,
    },
    CONFIG.email.publicKey
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Patrick+Hand&family=Nunito:wght@400;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { overflow-x: hidden; }

/* Accessibility: skip link */
.skip-link {
  position: absolute; top: -40px; left: 0; background: ${RED}; color: white;
  padding: 8px 16px; z-index: 9999; font-family: 'Nunito', sans-serif; border-radius: 0 0 8px 0;
  transition: top .2s;
}
.skip-link:focus { top: 0; }

/* Focus ring for keyboard nav */
:focus-visible {
  outline: 3px solid ${RED};
  outline-offset: 3px;
}

@keyframes floatUp {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-12px); }
}
.doodle {
  animation: floatUp 5s ease-in-out infinite;
  position: absolute;
  pointer-events: none;
  opacity: .18;
  aria-hidden: true;
}

/* Buttons */
.btn-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: ${RED}; color: white; border: none; border-radius: 999px;
  padding: 14px 32px; cursor: pointer;
  font-family: 'Caveat', cursive; font-size: 22px;
  box-shadow: 0 4px 14px rgba(201,76,76,.35);
  transition: transform .15s, box-shadow .15s;
  min-height: 48px; /* touch-friendly */
}
.btn-cta:hover  { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(201,76,76,.4); }
.btn-cta:active { transform: translateY(0); }

.btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: transparent; color: ${NAVY}; border: 2px solid ${NAVY}44;
  border-radius: 999px; padding: 12px 28px; cursor: pointer;
  font-family: 'Caveat', cursive; font-size: 20px; min-height: 48px;
  transition: background .15s, border-color .15s;
}
.btn-ghost:hover { background: ${NAVY}0d; border-color: ${NAVY}88; }

.btn-icon {
  display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: none; cursor: pointer;
  color: ${NAVY}88; border-radius: 8px; padding: 6px; min-height: 36px; min-width: 36px;
  transition: background .15s, color .15s;
}
.btn-icon:hover { background: ${NAVY}0d; color: ${NAVY}; }

/* Inputs */
.hand-input {
  width: 100%; border: none; border-bottom: 2px solid ${NAVY}22;
  background: transparent; padding: 10px 0; font-size: 24px;
  font-family: 'Caveat', cursive; color: ${NAVY};
  transition: border-color .2s;
}
.hand-input:focus { outline: none; border-bottom-color: ${RED}; }

.hand-textarea {
  width: 100%; border: none; border-bottom: 2px dashed ${NAVY}22;
  background: transparent; padding: 10px 0; resize: none; font-size: 22px;
  line-height: 1.7; font-family: 'Caveat', cursive; color: ${NAVY};
  transition: border-color .2s;
}
.hand-textarea:focus { outline: none; border-bottom-color: ${RED}; }

/* Polaroid card */
.polaroid {
  background: white; padding: 12px 12px 34px;
  box-shadow: 0 4px 20px rgba(0,0,0,.1);
  transition: transform .2s, box-shadow .2s;
  border-radius: 4px;
}
.polaroid:hover { transform: translateY(-6px) rotate(0deg) !important; box-shadow: 0 12px 32px rgba(0,0,0,.18); }

/* Upload zone */
.upload-zone {
  border: 2px dashed ${NAVY}33; border-radius: 16px; padding: 32px;
  text-align: center; cursor: pointer; transition: border-color .2s, background .2s;
}
.upload-zone:hover, .upload-zone:focus-within { border-color: ${RED}; background: ${PINK}22; }

/* Filter pills */
.filter-pill {
  border-radius: 999px; border: 1.5px solid ${NAVY}22; padding: 8px 18px;
  background: white; cursor: pointer; font-family: 'Patrick Hand', cursive;
  font-size: 15px; transition: background .15s, border-color .15s, color .15s;
  min-height: 40px;
}
.filter-pill:hover { border-color: ${NAVY}55; }
.filter-pill.active { background: ${NAVY}; color: white; border-color: ${NAVY}; }

/* Nav */
.nav-pill {
  background: transparent; border: none; color: white; opacity: .65;
  cursor: pointer; font-family: 'Caveat', cursive; font-size: 18px;
  padding: 8px 14px; border-radius: 999px; min-height: 40px;
  transition: opacity .15s, background .15s;
}
.nav-pill:hover  { opacity: 1; }
.nav-pill.active { opacity: 1; background: rgba(255,255,255,.12); }

/* Image grid in card */
.media-grid { display: grid; gap: 6px; margin-top: 10px; }
.media-grid.cols-1 { grid-template-columns: 1fr; }
.media-grid.cols-2 { grid-template-columns: 1fr 1fr; }
.media-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
.media-img {
  width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 6px;
  cursor: pointer; transition: opacity .15s;
}
.media-img:hover { opacity: .85; }

/* Lightbox */
.lightbox-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.88); z-index: 9000;
  display: flex; align-items: center; justify-content: center;
}
.lightbox-overlay img { max-width: 92vw; max-height: 92vh; border-radius: 8px; }
.lightbox-close {
  position: fixed; top: 20px; right: 24px; background: none; border: none;
  color: white; font-size: 36px; cursor: pointer; z-index: 9001; line-height: 1;
}

/* Badge */
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: 'Patrick Hand', cursive; font-size: 12px;
  padding: 3px 10px; border-radius: 999px;
}
.badge-capsule { background: ${NAVY}18; color: ${NAVY}; }
.badge-wall    { background: ${SAGE}44; color: ${NAVY}; }

/* Config banner */
.config-notice {
  background: #FEF3CD; border-left: 4px solid #F59E0B;
  padding: 12px 18px; border-radius: 0 8px 8px 0;
  font-family: 'Patrick Hand', cursive; font-size: 14px; color: #78350F;
  margin-bottom: 20px;
}

/* Toast */
.toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  background: ${NAVY}; color: white; padding: 12px 24px; border-radius: 999px;
  font-family: 'Patrick Hand', cursive; font-size: 16px; z-index: 8000;
  animation: toastIn .3s ease;
}
@keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

/* Responsive nav */
@media (max-width: 680px) {
  .nav-label { display: none; }
  .nav-pill   { font-size: 22px; padding: 8px; }
}
`;

const DOODLES = [
  { ch: "✿", x: "5%", y: "22%", sz: 40, col: RED, delay: 0 },
  { ch: "♫", x: "90%", y: "16%", sz: 36, col: NAVY, delay: 1.5 },
  { ch: "❤", x: "92%", y: "70%", sz: 32, col: RED, delay: 1 },
  { ch: "✦", x: "14%", y: "85%", sz: 26, col: NAVY, delay: 2.5 },
];

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return <div className="toast" role="status" aria-live="polite">{msg}</div>;
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div className="lightbox-overlay" onClick={onClose} role="dialog" aria-label="Image preview" aria-modal="true">
      <button className="lightbox-close" onClick={onClose} aria-label="Close image preview">×</button>
      <img src={src} alt="Memory photo" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

// ─── Media grid ───────────────────────────────────────────────────────────────
function MediaGrid({ previews }) {
  const [lightbox, setLightbox] = useState(null);
  if (!previews || previews.length === 0) return null;

  const imgPreviews = previews.filter((p) => p.type === "image");
  const otherFiles = previews.filter((p) => p.type !== "image");
  const cols = imgPreviews.length === 1 ? "cols-1" : imgPreviews.length === 2 ? "cols-2" : "cols-3";

  return (
    <>
      {imgPreviews.length > 0 && (
        <div className={`media-grid ${cols}`}>
          {imgPreviews.map((p, i) => (
            <img
              key={i}
              src={p.url}
              alt={p.name}
              className="media-img"
              onClick={() => setLightbox(p.url)}
              onKeyDown={(e) => e.key === "Enter" && setLightbox(p.url)}
              tabIndex={0}
              role="button"
              aria-label={`View photo: ${p.name}`}
            />
          ))}
        </div>
      )}
      {otherFiles.map((p, i) => (
        <div key={i} style={{ background: "rgba(255,255,255,.5)", borderRadius: 999, padding: "4px 10px", marginTop: 6, fontSize: 13 }}>
          📎 {p.name}
        </div>
      ))}
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  ["home", "🏠", "home"],
  ["write", "✏️", "write"],
  ["gallery", "📸", "wall"],
  ["timeline", "🕰", "timeline"],
  ["open-later", "🔒", "capsule"],
];

function Nav({ page, setPage }) {
  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: NAVY, display: "flex", justifyContent: "space-between",
        alignItems: "center", padding: "12px 24px",
        boxShadow: "0 2px 12px rgba(0,0,0,.15)",
      }}
    >
      <button
        onClick={() => setPage("home")}
        style={{ border: "none", background: "none", color: CREAM, fontFamily: "'Caveat',cursive", fontSize: 26, cursor: "pointer" }}
        aria-label="Memory Vault home"
      >
        💌 memory vault
      </button>

      <div style={{ display: "flex", gap: 4 }} role="list">
        {NAV_ITEMS.map(([p, icon, label]) => (
          <button
            key={p}
            className={`nav-pill${page === p ? " active" : ""}`}
            onClick={() => setPage(p)}
            aria-current={page === p ? "page" : undefined}
            role="listitem"
          >
            <span aria-hidden="true">{icon}</span>{" "}
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────
function Stat({ icon, value, label }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 28 }} aria-hidden="true">{icon}</div>
      <div style={{ fontFamily: "'Caveat',cursive", fontSize: 40, color: NAVY, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontFamily: "'Patrick Hand',cursive", color: NAVY + "88", fontSize: 15 }}>{label}</div>
    </div>
  );
}

function HomePage({ setPage, entries }) {
  return (
    <div style={{ minHeight: "100vh", background: CREAM, position: "relative", overflow: "hidden", paddingTop: 90 }}>
      {DOODLES.map((d, i) => (
        <div
          key={i} className="doodle" aria-hidden="true"
          style={{ left: d.x, top: d.y, fontSize: d.sz, color: d.col, animationDelay: `${d.delay}s` }}
        >
          {d.ch}
        </div>
      ))}

      <main id="main-content" style={{ maxWidth: 900, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <p style={{ fontFamily: "'Patrick Hand',cursive", letterSpacing: 3, color: RED, marginBottom: 16, fontSize: 13 }}>
          PERSONAL MEMORY VAULT
        </p>

        <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: "clamp(52px,10vw,96px)", color: NAVY, lineHeight: 1, marginBottom: 18 }}>
          {CONFIG.ownerName}'s<br />Digital Slam Book
        </h1>

        <p style={{ maxWidth: 680, margin: "0 auto 40px", color: NAVY + "bb", lineHeight: 1.8, fontSize: 18 }}>
          {CONFIG.tagline}
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap", marginBottom: 56 }}>
          <button className="btn-cta" onClick={() => setPage("write")}>💌 Write Something</button>
          <button className="btn-ghost" onClick={() => setPage("gallery")}>📸 Open Memory Wall</button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 48, flexWrap: "wrap" }} aria-label="Stats">
          <Stat icon="💌" value={entries.length} label="memories" />
          <Stat icon="🔒" value={entries.filter(e => e.type === "capsule").length} label="time capsules" />
          <Stat icon="🌸" value={entries.filter(e => e.mediaPreviews?.some(p => p.type === "image")).length} label="photo memories" />
        </div>
      </main>
    </div>
  );
}

// ─── Write ────────────────────────────────────────────────────────────────────
function WritePage({ entries, setEntries, setPage, showToast }) {
  const [form, setForm] = useState({
    name: "", anonymous: false, type: "wall",
    unlockDate: CONFIG.defaultCapsuleUnlockDate,
    memory: "", message: "", note: "", mediaPreviews: [],
  });
  const [errors, setErrors] = useState({});
  const fileRef = useRef();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleFiles = (fileList) => {
    const previews = Array.from(fileList).map(f => ({
      name: f.name,
      type: f.type.startsWith("image/") ? "image" : "other",
      url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
    }));
    set("mediaPreviews", previews);
  };

  const validate = () => {
    const e = {};
    if (!form.memory.trim()) e.memory = "Please share at least a short memory.";
    return e;
  };

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const entry = {
      id: Date.now(),
      name: form.anonymous ? "Anonymous" : form.name || "Someone",
      visibility: form.anonymous ? "anonymous" : "named",
      type: form.type,
      unlockDate: form.unlockDate,
      memory: form.memory,
      message: form.message,
      note: form.note,
      mediaPreviews: form.mediaPreviews,
      emoji: rnd(EMOJIS),
      color: rnd(PALETTE),
      rot: Math.random() * 6 - 3,
      date: new Date().toISOString(),
    };
    setEntries([entry, ...entries]);
    showToast("Memory saved ✨");
    setPage(form.type === "wall" ? "gallery" : "open-later");
  };

  const F = ({ label, id, err, children }) => (
    <div style={{ marginBottom: 30 }} role="group" aria-labelledby={`lbl-${id}`}>
      <label id={`lbl-${id}`} style={{ display: "block", fontFamily: "'Patrick Hand',cursive", fontSize: 15, color: NAVY + "99", marginBottom: 8 }}>
        {label}
      </label>
      {children}
      {err && <p style={{ color: RED, fontFamily: "'Patrick Hand',cursive", fontSize: 14, marginTop: 6 }} role="alert">{err}</p>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: CREAM, paddingTop: 100 }}>
      <main id="main-content" style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 58, color: NAVY, marginBottom: 8 }}>write something 💌</h1>
        <p style={{ fontFamily: "'Patrick Hand',cursive", color: NAVY + "88", marginBottom: 36 }}>
          Leave a memory, note, confession, or future message for {CONFIG.ownerName}.
        </p>

        {/* Anonymous toggle */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "flex", gap: 12, alignItems: "center", fontFamily: "'Patrick Hand',cursive", fontSize: 17, cursor: "pointer" }}>
            <input
              type="checkbox" checked={form.anonymous}
              onChange={e => set("anonymous", e.target.checked)}
              style={{ width: 20, height: 20, accentColor: RED }}
            />
            Stay anonymous
          </label>
        </div>

        {!form.anonymous && (
          <F label="Your name" id="name">
            <input className="hand-input" placeholder="e.g. Priya" value={form.name} onChange={e => set("name", e.target.value)} aria-label="Your name" />
          </F>
        )}

        {/* Where to post */}
        <F label="Where should this go?" id="type">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[["wall", "📸 Public Wall"], ["capsule", "🔒 Time Capsule"]].map(([v, label]) => (
              <button
                key={v}
                className={`filter-pill${form.type === v ? " active" : ""}`}
                onClick={() => set("type", v)}
                aria-pressed={form.type === v}
              >
                {label}
              </button>
            ))}
          </div>
        </F>

        {form.type === "capsule" && (
          <F label="Open on this date" id="unlockDate">
            <input
              type="date" value={form.unlockDate} className="hand-input"
              onChange={e => set("unlockDate", e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              aria-label="Capsule unlock date"
            />
          </F>
        )}

        <F label="A memory to share" id="memory" err={errors.memory}>
          <textarea
            className="hand-textarea" rows={4}
            placeholder="That one time we..."
            value={form.memory}
            onChange={e => { set("memory", e.target.value); setErrors({}); }}
            aria-required="true"
            aria-describedby={errors.memory ? "err-memory" : undefined}
          />
        </F>

        <F label="A heartfelt message" id="message">
          <textarea className="hand-textarea" rows={4} placeholder="I want you to know..." value={form.message} onChange={e => set("message", e.target.value)} />
        </F>

        <F label="Anything else?" id="note">
          <textarea className="hand-textarea" rows={3} placeholder="P.S. …" value={form.note} onChange={e => set("note", e.target.value)} />
        </F>

        {/* Upload */}
        <div
          className="upload-zone"
          style={{ marginBottom: 28 }}
          onClick={() => fileRef.current.click()}
          onKeyDown={e => e.key === "Enter" && fileRef.current.click()}
          tabIndex={0}
          role="button"
          aria-label="Upload photos, videos, or other files"
        >
          <p style={{ fontFamily: "'Patrick Hand',cursive", fontSize: 18, color: NAVY + "bb" }}>
            📎 Add photos, videos, audio, files
          </p>
          <p style={{ fontFamily: "'Patrick Hand',cursive", fontSize: 13, color: NAVY + "66", marginTop: 6 }}>Click or press Enter to browse</p>
          <input hidden multiple type="file" ref={fileRef} onChange={e => handleFiles(e.target.files)} accept="image/*,video/*,audio/*" />
        </div>

        {/* Preview uploaded images */}
        {form.mediaPreviews.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <MediaGrid previews={form.mediaPreviews} />
          </div>
        )}

        <button className="btn-cta" onClick={submit}>💌 Save Memory</button>
      </main>
    </div>
  );
}

// ─── Gallery ──────────────────────────────────────────────────────────────────
function MemoryCard({ e }) {
  return (
    <div style={{ breakInside: "avoid", marginBottom: 24 }}>
      <article
        className="polaroid"
        style={{ background: e.color, transform: `rotate(${e.rot}deg)` }}
        aria-label={`Memory from ${e.name}`}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontFamily: "'Patrick Hand',cursive", fontSize: 14, fontWeight: 600, color: NAVY }}>{e.name}</span>
          <span className={`badge ${e.type === "capsule" ? "badge-capsule" : "badge-wall"}`}>
            {e.type === "capsule" ? "🔒 capsule" : "📸 wall"}
          </span>
        </div>

        {/* Photos first if any */}
        <MediaGrid previews={e.mediaPreviews} />

        <div style={{ fontSize: 36, textAlign: "center", margin: "10px 0 8px" }} aria-hidden="true">{e.emoji}</div>

        <p style={{ fontFamily: "'Caveat',cursive", fontSize: 22, lineHeight: 1.55, color: NAVY, marginBottom: 10 }}>
          "{e.memory}"
        </p>

        {e.message && (
          <p style={{ fontStyle: "italic", color: NAVY + "bb", marginBottom: 10, lineHeight: 1.6, fontFamily: "'Patrick Hand',cursive" }}>
            {e.message}
          </p>
        )}

        {e.note && (
          <p style={{ fontFamily: "'Patrick Hand',cursive", color: NAVY + "88", marginBottom: 8, fontSize: 14 }}>
            {e.note}
          </p>
        )}

        <p style={{ textAlign: "right", marginTop: 10, fontSize: 12, color: NAVY + "55", fontFamily: "'Patrick Hand',cursive" }}>
          <time dateTime={e.date}>{fmtDate(e.date)}</time>
        </p>
      </article>
    </div>
  );
}

function GalleryPage({ entries }) {
  const [filter, setFilter] = useState("all");

  const shown = entries.filter(e => {
    if (filter === "all") return true;
    if (filter === "wall") return e.type === "wall";
    if (filter === "capsule") return e.type === "capsule";
    if (filter === "anon") return e.visibility === "anonymous";
    if (filter === "photos") return e.mediaPreviews?.some(p => p.type === "image");
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: CREAM, paddingTop: 100 }}>
      <main id="main-content" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 56, color: NAVY }}>memory wall 📸</h1>

          <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 20 }} role="group" aria-label="Filter memories">
            {[["all", "all"], ["wall", "public wall"], ["capsule", "time capsule"], ["anon", "anonymous"], ["photos", "📸 with photos"]].map(([f, label]) => (
              <button
                key={f}
                className={`filter-pill${filter === f ? " active" : ""}`}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {shown.length === 0 ? (
          <p style={{ textAlign: "center", fontFamily: "'Patrick Hand',cursive", color: NAVY + "88", marginTop: 60, fontSize: 20 }}>
            No memories here yet. <button className="btn-cta" style={{ fontSize: 18, padding: "10px 22px" }} onClick={() => { }}>Write one ✏️</button>
          </p>
        ) : (
          <div style={{ columns: "3 260px", columnGap: 22 }}>
            {shown.map(e => <MemoryCard key={e.id} e={e} />)}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
function TimelinePage({ entries }) {
  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div style={{ minHeight: "100vh", background: CREAM, paddingTop: 100 }}>
      <main id="main-content" style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 56, color: NAVY, textAlign: "center", marginBottom: 50 }}>
          timeline 🕰
        </h1>

        <ol style={{ listStyle: "none", position: "relative", paddingLeft: 32 }}>
          <div style={{ position: "absolute", left: 14, top: 0, bottom: 0, width: 2, background: NAVY + "18", borderRadius: 2 }} aria-hidden="true" />

          {sorted.map((e, idx) => (
            <li key={e.id} style={{ position: "relative", marginBottom: 28 }}>
              <div
                style={{
                  position: "absolute", left: -26, top: 20,
                  width: 14, height: 14, borderRadius: "50%",
                  background: e.type === "capsule" ? NAVY : RED, border: `2px solid ${CREAM}`,
                }}
                aria-hidden="true"
              />
              <article
                style={{
                  background: "white", borderRadius: 18, padding: "20px 24px",
                  boxShadow: "0 3px 16px rgba(0,0,0,.07)",
                  borderLeft: `4px solid ${e.type === "capsule" ? NAVY : RED}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                  <span style={{ fontFamily: "'Patrick Hand',cursive", fontWeight: 600, color: NAVY }}>{e.name}</span>
                  <time dateTime={e.date} style={{ fontSize: 13, color: RED, fontFamily: "'Patrick Hand',cursive" }}>{fmtDate(e.date)}</time>
                </div>
                <p style={{ fontFamily: "'Caveat',cursive", fontSize: 23, lineHeight: 1.6, color: NAVY }}>{e.memory}</p>
                <MediaGrid previews={e.mediaPreviews} />
              </article>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}

// ─── Time Capsule ─────────────────────────────────────────────────────────────
function OpenLaterPage({ entries, showToast }) {
  const capsules = entries.filter(e => e.type === "capsule");
  const locked = capsules.filter(e => isLocked(e.unlockDate));
  const unlocked = capsules.filter(e => !isLocked(e.unlockDate));

  return (
    <div style={{ minHeight: "100vh", background: NAVY, paddingTop: 100 }}>
      <main id="main-content" style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 50 }}>
          <div style={{ fontSize: 60 }} aria-hidden="true">🔒</div>
          <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 56, color: CREAM }}>time capsule</h1>
          <p style={{ color: CREAM + "99", marginTop: 10, fontFamily: "'Patrick Hand',cursive" }}>Messages meant for the future.</p>

          {/* Config notice if email not set up */}

        </div>

        {unlocked.length > 0 && (
          <section aria-label="Unlocked capsules" style={{ marginBottom: 40 }}>
            <h2 style={{ fontFamily: "'Patrick Hand',cursive", color: SAGE, fontSize: 18, marginBottom: 16, letterSpacing: 1 }}>
              ✅ UNLOCKED
            </h2>
            {unlocked.map(e => <CapsuleCard key={e.id} e={e} locked={false} />)}
          </section>
        )}

        {locked.length > 0 && (
          <section aria-label="Locked capsules">
            <h2 style={{ fontFamily: "'Patrick Hand',cursive", color: CREAM + "77", fontSize: 18, marginBottom: 16, letterSpacing: 1 }}>
              🔒 SEALED
            </h2>
            {locked.map(e => <CapsuleCard key={e.id} e={e} locked={true} />)}
          </section>
        )}

        {capsules.length === 0 && (
          <p style={{ textAlign: "center", color: CREAM + "55", fontFamily: "'Patrick Hand',cursive", marginTop: 40, fontSize: 18 }}>
            No capsules yet. Write one — your future self will thank you.
          </p>
        )}
      </main>
    </div>
  );
}

function CapsuleCard({ e, locked }) {
  const daysLeft = e.unlockDate
    ? Math.ceil((new Date(e.unlockDate) - new Date()) / 86400000)
    : null;

  return (
    <article
      style={{
        background: "rgba(255,255,255,.07)", borderRadius: 20, padding: 28, marginBottom: 22,
        border: `1px solid rgba(255,255,255,${locked ? ".06" : ".18"})`,
      }}
      aria-label={`Capsule from ${e.name}${locked ? ", sealed" : ", unlocked"}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <span style={{ color: CREAM, fontFamily: "'Patrick Hand',cursive", fontWeight: 600 }}>{e.name}</span>
        <span style={{ color: locked ? "#F59E0B" : SAGE, fontSize: 13, fontFamily: "'Patrick Hand',cursive" }}>
          {locked ? `🔒 unlocks ${fmtDate(e.unlockDate)} · ${daysLeft} days` : `✅ unlocked ${fmtDate(e.unlockDate)}`}
        </span>
      </div>

      {locked ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 44 }} aria-hidden="true">🔒</div>
          <p style={{ color: CREAM + "66", fontFamily: "'Patrick Hand',cursive", marginTop: 10 }}>
            This message is sealed until {fmtDate(e.unlockDate)}.
          </p>
        </div>
      ) : (
        <>
          <p style={{ fontFamily: "'Caveat',cursive", fontSize: 24, color: CREAM, lineHeight: 1.7, marginBottom: 12 }}>
            {e.memory}
          </p>
          {e.message && (
            <p style={{ color: CREAM + "cc", lineHeight: 1.7, fontFamily: "'Patrick Hand',cursive" }}>{e.message}</p>
          )}
          <MediaGrid previews={e.mediaPreviews} />
        </>
      )}
    </article>
  );
}

// ─── Settings / Config page ───────────────────────────────────────────────────
function SettingsPage({ entries, showToast }) {
  const handleDriveBackup = async () => {
    if (!CONFIG.googleDrive.enabled) {
      showToast("⚙️ Enable Google Drive in CONFIG.googleDrive first");
      return;
    }
    await backupToGoogleDrive(entries);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "slam-book-export.json";
    a.click();
    showToast("📥 Exported to JSON!");
  };

  const Row = ({ label, value, status }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${NAVY}11` }}>
      <span style={{ fontFamily: "'Patrick Hand',cursive", color: NAVY, fontSize: 16 }}>{label}</span>
      <span style={{ fontFamily: "'Patrick Hand',cursive", color: status ? "#10B981" : "#EF4444", fontSize: 14 }}>
        {status ? "✅ " : "⚠️ "}{value}
      </span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: CREAM, paddingTop: 100 }}>
      <main id="main-content" style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontFamily: "'Caveat',cursive", fontSize: 52, color: NAVY, marginBottom: 8 }}>settings ⚙️</h1>
        <p style={{ fontFamily: "'Patrick Hand',cursive", color: NAVY + "88", marginBottom: 36 }}>
          Edit the <code>CONFIG</code> block at the top of the file to change these settings.
        </p>

        <section style={{ background: "white", borderRadius: 18, padding: "24px 28px", boxShadow: "0 3px 16px rgba(0,0,0,.07)", marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Caveat',cursive", fontSize: 28, color: NAVY, marginBottom: 4 }}>Status</h2>
          <Row label="Owner name" value={CONFIG.ownerName} status={true} />
          <Row label="Email reminders" value={CONFIG.email.enabled ? CONFIG.email.recipientEmail : "Not configured"} status={CONFIG.email.enabled} />
          <Row label="Google Drive" value={CONFIG.googleDrive.enabled ? "Connected" : "Not configured"} status={CONFIG.googleDrive.enabled} />
          <Row label="Capsule unlock date" value={CONFIG.defaultCapsuleUnlockDate} status={true} />
        </section>

        <section style={{ background: "white", borderRadius: 18, padding: "24px 28px", boxShadow: "0 3px 16px rgba(0,0,0,.07)", marginBottom: 28 }}>
          <h2 style={{ fontFamily: "'Caveat',cursive", fontSize: 28, color: NAVY, marginBottom: 16 }}>Actions</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <button className="btn-ghost" onClick={handleExportJSON} style={{ justifyContent: "flex-start", gap: 12 }}>
              📥 Export all memories as JSON
            </button>
            <button className="btn-ghost" onClick={handleDriveBackup} style={{ justifyContent: "flex-start", gap: 12 }}>
              ☁️ Backup to Google Drive
              {!CONFIG.googleDrive.enabled && <span style={{ fontSize: 12, color: NAVY + "66" }}>(set up CONFIG first)</span>}
            </button>
          </div>
        </section>

        <div style={{ background: "#EEF9F4", border: "1px solid #A7F3D0", borderRadius: 14, padding: "18px 22px" }}>
          <p style={{ fontFamily: "'Patrick Hand',cursive", color: "#065F46", fontSize: 15, lineHeight: 1.7 }}>
            📋 <strong>How to set up emailing:</strong><br />
            1. Sign up at <a href="https://emailjs.com" style={{ color: "#059669" }}>emailjs.com</a> (free tier works)<br />
            2. Create a service + email template<br />
            3. Paste your IDs into <code>CONFIG.email</code> and set <code>enabled: true</code>
          </p>
        </div>
      </main>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
const ALL_PAGES = ["home", "write", "gallery", "timeline", "open-later", "settings"];

export default function SlamBook() {
  const [page, setPage] = useState("home");
  const [entries, setEntries] = useState(SEED);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => setToast(msg), []);

  // Check capsules on load and send emails if enabled
  useEffect(() => {
    if (!CONFIG.checkCapsulesOnLoad || !CONFIG.email.enabled) return;
    entries.forEach(e => {
      if (e.type === "capsule" && !isLocked(e.unlockDate) && !e._emailSent) {
        sendCapsuleEmail(e);
      }
    });
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <a href="#main-content" className="skip-link">Skip to content</a>

      <div style={{ fontFamily: "'Nunito',sans-serif", minHeight: "100vh", background: CREAM }}>
        <Nav
          page={page}
          setPage={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />

        {page === "home" && <HomePage setPage={setPage} entries={entries} />}
        {page === "write" && <WritePage entries={entries} setEntries={setEntries} setPage={setPage} showToast={showToast} />}
        {page === "gallery" && <GalleryPage entries={entries} />}
        {page === "timeline" && <TimelinePage entries={entries} />}
        {page === "open-later" && <OpenLaterPage entries={entries} showToast={showToast} />}
        {page === "settings" && <SettingsPage entries={entries} showToast={showToast} />}

        {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
      </div>
    </>
  );
}
