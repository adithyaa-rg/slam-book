import { useState, useRef, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────────────────
// ██████████████████████   EASY SETUP CONFIG   ████████████████████████████████
// ─────────────────────────────────────────────────────────────────────────────
//
// HOW TO SET UP FIREBASE (takes 3 minutes, completely free):
//   1. Go to https://console.firebase.google.com and sign in with Google
//   2. Click "Add project" → name it anything → Continue (disable Analytics is fine)
//   3. Once created, click the </> (Web) icon to add a web app
//      → Register app (any nickname) → you'll see a firebaseConfig object
//      → Copy the values into CONFIG.firebase below
//   4. In the left sidebar → Build → Firestore Database → Create database
//      → Start in TEST MODE → choose any region → Enable
//   5. That's it! Firestore is now ready.
//
// HOW TO SET UP EMAILJS (takes 3 minutes):
//   1. Go to https://emailjs.com and sign up (free — 200 emails/month)
//   2. Dashboard → Email Services → Add Service → choose Gmail
//      • Connect your adithyaa2003@gmail.com account
//      • Note the Service ID (e.g. "service_abc123")
//   3. Dashboard → Email Templates → Create Template
//      • Set "To Email" to: adithyaa2003@gmail.com
//      • Paste this template body:
//
//        New memory from: {{from_name}}
//        Date: {{date}}
//        📝 Memory: {{memory}}
//        💬 Message: {{message}}
//        📎 Note: {{note}}
//
//      • Note the Template ID (e.g. "template_xyz789")
//   4. Dashboard → Account → Public Key → copy it
//   5. Paste all three below ↓
//
const CONFIG = {
  ownerName: "RG Adithyaa",
  tagline: "A personal archive of notes, memories, and future letters.",

  // ── Firebase config — copy from your Firebase console ─────────────────────
  firebase: {
    apiKey: "AIzaSyDvvOAiDGI9w018lh_WH7gTfKZhyORU_bs",
    authDomain: "slam-3198e.firebaseapp.com",
    projectId: "slam-3198e",
    storageBucket: "slam-3198e.firebasestorage.com",
    messagingSenderId: "81034722488",
    appId: "1:81034722488:web:1c5173ae0a988b4f1c484d",
    measurementId: "G-2VVW4WB8HX",
  },

  // ── EmailJS config ─────────────────────────────────────────────────────────
  emailjs: {
    serviceId: "service_1o9l95x",
    templateId: "template_lrdr1pl",
    publicKey: "cQdNm5FLtsyrIlcOx",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ██████████████████████   FIREBASE HELPERS   █████████████████████████████████
// ─────────────────────────────────────────────────────────────────────────────

let _app = null;
let _db = null;
let _storage = null;

// function getStorageInstance() {
//   if (_storage) return _storage;

//   if (!_app) {
//     _app = initializeApp(CONFIG.firebase);
//   }

//   _storage = getStorage(_app);
//   return _storage;
// }
// function getDB() {
//   if (_db) return _db;
//   if (!isConfigured()) throw new Error("Firebase not configured.");
//   _app = initializeApp(CONFIG.firebase);
//   _db = getFirestore(_app);
//   return _db;
// }
// function uploadSingleFile(item, onProgress) {
//   return new Promise((resolve, reject) => {
//     const storage = getStorageInstance();

//     const filename =
//       Date.now() + "_" + Math.random().toString(36).slice(2) + "_" + item.name;

//     const storageRef = ref(storage, `memories/${filename}`);

//     const uploadTask = uploadBytesResumable(storageRef, item.file);

//     uploadTask.on(
//       "state_changed",

//       (snapshot) => {
//         const percent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

//         onProgress(percent);
//       },

//       reject,

//       async () => {
//         const url = await getDownloadURL(uploadTask.snapshot.ref);

//         resolve({
//           name: item.name,
//           type: item.type,
//           url,
//         });
//       },
//     );
//   });
// }
function getDB() {
  if (_db) return _db;
  if (!isConfigured()) throw new Error("Firebase not configured.");

  if (!_app) {
    _app = initializeApp(CONFIG.firebase);
  }

  _db = getFirestore(_app);
  return _db;
}
const COLLECTION = "memories";

async function loadEntriesFromFirestore() {
  const db = getDB();
  const q = query(collection(db, COLLECTION), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ _docId: doc.id, ...doc.data() }));
}

async function saveEntryToFirestore(entry) {
  const db = getDB();
  const docRef = await addDoc(collection(db, COLLECTION), entry);
  return { _docId: docRef.id, ...entry };
}

// ─────────────────────────────────────────────────────────────────────────────
// ██████████████████████   EMAILJS HELPER   ███████████████████████████████████
// ─────────────────────────────────────────────────────────────────────────────

function isEmailConfigured() {
  const { serviceId, templateId, publicKey } = CONFIG.emailjs;
  return (
    serviceId !== "PASTE_YOUR_SERVICE_ID_HERE" &&
    templateId !== "PASTE_YOUR_TEMPLATE_ID_HERE" &&
    publicKey !== "PASTE_YOUR_PUBLIC_KEY_HERE"
  );
}

async function sendEmailNotification(entry) {
  if (!isEmailConfigured()) return;
  const { serviceId, templateId, publicKey } = CONFIG.emailjs;
  const templateParams = {
    from_name: entry.name,
    date: new Date(entry.date).toLocaleString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    memory: entry.memory || "(none)",
    message: entry.message || "(none)",
    note: entry.note || "(none)",
    to_email: "adithyaa2003@gmail.com",
  };
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: templateParams,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EmailJS send failed: ${res.status} — ${text}`);
  }
}
// ─────────────────────────────────────────────────────────────────────────────
// ██████████████████████   APP CODE   █████████████████████████████████████████
// ─────────────────────────────────────────────────────────────────────────────

const NAVY = "#1B2A41";
const PINK = "#F6D6D6";
const RED = "#C94C4C";
const CREAM = "#FFFDF7";
const SAGE = "#A3B18A";

const PALETTE = [PINK, SAGE, CREAM, "#EDE0D4", "#D4E6F1", "#E8D5C4"];
const EMOJIS = [
  "💌",
  "🌸",
  "✨",
  "🎵",
  "🌿",
  "🧡",
  "💛",
  "🦋",
  "📝",
  "🌙",
  "🎨",
  "🌻",
];

function rnd(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function fmtDate(s) {
  return new Date(s).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
function isConfigured() {
  return CONFIG.firebase.apiKey !== "PASTE_YOUR_API_KEY";
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&family=Patrick+Hand&family=Nunito:wght@400;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { overflow-x: hidden; }

.skip-link {
  position: absolute; top: -40px; left: 0; background: ${RED}; color: white;
  padding: 8px 16px; z-index: 9999; font-family: 'Nunito', sans-serif;
  border-radius: 0 0 8px 0; transition: top .2s;
}
.skip-link:focus { top: 0; }
:focus-visible { outline: 3px solid ${RED}; outline-offset: 3px; }

@keyframes floatUp {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-12px); }
}
.doodle {
  animation: floatUp 5s ease-in-out infinite;
  position: absolute; pointer-events: none; opacity: .18;
}

.btn-cta {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: ${RED}; color: white; border: none; border-radius: 999px;
  padding: 14px 32px; cursor: pointer;
  font-family: 'Caveat', cursive; font-size: 22px;
  box-shadow: 0 4px 14px rgba(201,76,76,.35);
  transition: transform .15s, box-shadow .15s; min-height: 48px;
}
.btn-cta:hover  { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(201,76,76,.4); }
.btn-cta:active { transform: translateY(0); }
.btn-cta:disabled { opacity: .6; cursor: not-allowed; transform: none; }

.btn-ghost {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: transparent; color: ${NAVY}; border: 2px solid ${NAVY}44;
  border-radius: 999px; padding: 12px 28px; cursor: pointer;
  font-family: 'Caveat', cursive; font-size: 20px; min-height: 48px;
  transition: background .15s, border-color .15s;
}
.btn-ghost:hover { background: ${NAVY}0d; border-color: ${NAVY}88; }
.btn-ghost:disabled { opacity: .6; cursor: not-allowed; }

.hand-input {
  width: 100%; border: none; border-bottom: 2px solid ${NAVY}22;
  background: transparent; padding: 10px 0; font-size: 24px;
  font-family: 'Caveat', cursive; color: ${NAVY}; transition: border-color .2s;
}
.hand-input:focus { outline: none; border-bottom-color: ${RED}; }

.hand-textarea {
  width: 100%; border: none; border-bottom: 2px dashed ${NAVY}22;
  background: transparent; padding: 10px 0; resize: none; font-size: 22px;
  line-height: 1.7; font-family: 'Caveat', cursive; color: ${NAVY};
  transition: border-color .2s;
}
.hand-textarea:focus { outline: none; border-bottom-color: ${RED}; }

.polaroid {
  background: white; padding: 12px 12px 34px;
  box-shadow: 0 4px 20px rgba(0,0,0,.1);
  transition: transform .2s, box-shadow .2s; border-radius: 4px;
}
.polaroid:hover {
  transform: translateY(-6px) rotate(0deg) !important;
  box-shadow: 0 12px 32px rgba(0,0,0,.18);
}

.upload-zone {
  border: 2px dashed ${NAVY}33; border-radius: 16px; padding: 32px;
  text-align: center; cursor: pointer; transition: border-color .2s, background .2s;
}
.upload-zone:hover, .upload-zone:focus-within {
  border-color: ${RED}; background: ${PINK}22;
}

.filter-pill {
  border-radius: 999px; border: 1.5px solid ${NAVY}22; padding: 8px 18px;
  background: white; cursor: pointer; font-family: 'Patrick Hand', cursive;
  font-size: 15px; transition: background .15s, border-color .15s, color .15s;
  min-height: 40px;
}
.filter-pill:hover  { border-color: ${NAVY}55; }
.filter-pill.active { background: ${NAVY}; color: white; border-color: ${NAVY}; }

.nav-pill {
  background: transparent; border: none; color: white; opacity: .65;
  cursor: pointer; font-family: 'Caveat', cursive; font-size: 18px;
  padding: 8px 14px; border-radius: 999px; min-height: 40px;
  transition: opacity .15s, background .15s;
}
.nav-pill:hover  { opacity: 1; }
.nav-pill.active { opacity: 1; background: rgba(255,255,255,.12); }

.badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: 'Patrick Hand', cursive; font-size: 12px;
  padding: 3px 10px; border-radius: 999px;
}
.badge-wall { background: ${SAGE}44; color: ${NAVY}; }

.toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  background: ${NAVY}; color: white; padding: 12px 24px; border-radius: 999px;
  font-family: 'Patrick Hand', cursive; font-size: 16px; z-index: 8000;
  animation: toastIn .3s ease;
}
@keyframes toastIn {
  from { opacity: 0; transform: translateX(-50%) translateY(12px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.field-group { margin-bottom: 30px; }
.field-label {
  display: block; font-family: 'Patrick Hand', cursive; font-size: 15px;
  color: ${NAVY}99; margin-bottom: 8px;
}
.field-error {
  color: ${RED}; font-family: 'Patrick Hand', cursive; font-size: 14px; margin-top: 6px;
}

.config-warn {
  background: #FEF3C7; border: 2px solid #F59E0B; border-radius: 14px;
  padding: 20px 24px; margin: 0 auto 32px; max-width: 680px;
  font-family: 'Patrick Hand', cursive; font-size: 16px;
  color: #92400E; line-height: 1.7;
}
.config-warn strong { display: block; font-size: 18px; margin-bottom: 6px; }

@media (max-width: 680px) {
  .nav-label { display: none; }
  .nav-pill  { font-size: 22px; padding: 8px; }
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
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="toast" role="status" aria-live="polite">
      {msg}
    </div>
  );
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
    <div
      className="lightbox-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.88)",
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: "fixed",
          top: 20,
          right: 24,
          background: "none",
          border: "none",
          color: "white",
          fontSize: 36,
          cursor: "pointer",
          zIndex: 9001,
          lineHeight: 1,
        }}
      >
        ×
      </button>
      <img
        src={src}
        alt="Memory"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "92vw", maxHeight: "92vh", borderRadius: 8 }}
      />
    </div>
  );
}

// ─── Config warning ───────────────────────────────────────────────────────────
function ConfigWarn() {
  if (isConfigured()) return null;
  return (
    <div className="config-warn">
      <strong>⚠️ Firebase not configured yet</strong>
      Open <code>SlamBook.jsx</code> and fill in your Firebase project details
      in the
      <code> CONFIG.firebase</code> block at the top. Sign up free at{" "}
      <strong>console.firebase.google.com</strong> — takes 3 minutes!
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  ["home", "🏠", "home"],
  ["write", "✏️", "write"],
  // ["gallery", "📸", "wall"],
  // ["timeline", "🕰", "timeline"],
];

function Nav({ page, setPage }) {
  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: NAVY,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 24px",
        boxShadow: "0 2px 12px rgba(0,0,0,.15)",
      }}
    >
      <button
        onClick={() => setPage("home")}
        style={{
          border: "none",
          background: "none",
          color: CREAM,
          fontFamily: "'Caveat',cursive",
          fontSize: 26,
          cursor: "pointer",
        }}
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
      <div style={{ fontSize: 28 }} aria-hidden="true">
        {icon}
      </div>
      <div
        style={{
          fontFamily: "'Caveat',cursive",
          fontSize: 40,
          color: NAVY,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "'Patrick Hand',cursive",
          color: NAVY + "88",
          fontSize: 15,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function HomePage({ setPage, entries }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: CREAM,
        position: "relative",
        overflow: "hidden",
        paddingTop: 90,
      }}
    >
      {DOODLES.map((d, i) => (
        <div
          key={i}
          className="doodle"
          aria-hidden="true"
          style={{
            left: d.x,
            top: d.y,
            fontSize: d.sz,
            color: d.col,
            animationDelay: `${d.delay}s`,
          }}
        >
          {d.ch}
        </div>
      ))}
      <main
        id="main-content"
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "80px 24px",
          textAlign: "center",
        }}
      >
        <ConfigWarn />
        <p
          style={{
            fontFamily: "'Patrick Hand',cursive",
            letterSpacing: 3,
            color: RED,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          PERSONAL MEMORY VAULT
        </p>
        <h1
          style={{
            fontFamily: "'Caveat',cursive",
            fontSize: "clamp(52px,10vw,96px)",
            color: NAVY,
            lineHeight: 1,
            marginBottom: 18,
          }}
        >
          {CONFIG.ownerName}'s
          <br />
          Digital Slam Book
        </h1>
        <p
          style={{
            maxWidth: 680,
            margin: "0 auto 40px",
            color: NAVY + "bb",
            lineHeight: 1.8,
            fontSize: 18,
          }}
        >
          {CONFIG.tagline}
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 56,
          }}
        >
          <button className="btn-cta" onClick={() => setPage("write")}>
            💌 Write Something
          </button>
          {/* <button className="btn-ghost" onClick={() => setPage("gallery")}>
            📸 Open Memory Wall
          </button>*/}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 48,
            flexWrap: "wrap",
          }}
          aria-label="Stats"
        >
          <Stat icon="💌" value={entries.length} label="memories" />
          <Stat
            icon="🌸"
            value={
              entries.filter((e) =>
                e.mediaPreviews?.some((p) => p.type === "image"),
              ).length
            }
            label="photo memories"
          />
        </div>
      </main>
    </div>
  );
}

// ─── Write ────────────────────────────────────────────────────────────────────
function FieldWrapper({ label, id, err, children }) {
  return (
    <div className="field-group" role="group" aria-labelledby={`lbl-${id}`}>
      <label id={`lbl-${id}`} className="field-label">
        {label}
      </label>
      {children}
      {err && (
        <p className="field-error" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
// async function uploadMedia(files) {
//   const storage = getStorageInstance();

//   return Promise.all(
//     files.map(async (item) => {
//       const filename =
//         Date.now() +
//         "_" +
//         Math.random().toString(36).slice(2) +
//         "_" +
//         item.name;

//       const storageRef = ref(storage, `memories/${filename}`);

//       await uploadBytes(storageRef, item.file);

//       const downloadURL = await getDownloadURL(storageRef);

//       return {
//         name: item.name,
//         type: item.type,
//         url: downloadURL,
//       };
//     }),
//   );
// }
function WritePage({ entries, setEntries, setPage, showToast }) {
  const [name, setName] = useState("");
  // const [uploadProgress, setUploadProgress] = useState(0);
  const [anonymous, setAnonymous] = useState(false);
  const [memory, setMemory] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const handleFiles = (fileList) => {
    // const previews = Array.from(fileList).map((f) => ({
    //   name: f.name,
    //   type: f.type.startsWith("image/") ? "image" : "other",
    //   url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
    // }));
    const previews = Array.from(fileList).map((f) => ({
      name: f.name,
      type: f.type.startsWith("image/") ? "image" : "other",
      url: null,
    }));
    setMediaPreviews(previews);
  };

  const submit = async () => {
    if (!memory.trim()) {
      setErrors({ memory: "Please share at least a short memory." });
      return;
    }
    if (!isConfigured()) {
      showToast("⚠️ Please configure Firebase first!");
      return;
    }
    setErrors({});
    setSaving(true);

    // const entry = {
    //   id: Date.now(),
    //   name: anonymous ? "Anonymous" : name || "Someone",
    //   visibility: anonymous ? "anonymous" : "named",
    //   type: "wall",
    //   memory,
    //   message,
    //   note,
    //   // We only store file names — actual files aren't uploaded to keep setup simple
    //   mediaPreviews: mediaPreviews.map((p) => ({
    //     name: p.name,
    //     type: p.type,
    //     url: null,
    //   })),
    //   emoji: rnd(EMOJIS),
    //   color: rnd(PALETTE),
    //   rot: Math.random() * 6 - 3,
    //   date: new Date().toISOString(),
    // };

    try {
      // const uploadedMedia =
      //   mediaPreviews.length > 0
      //     ? await Promise.all(
      //         mediaPreviews.map((item) =>
      //           uploadSingleFile(item, setUploadProgress),
      //         ),
      //       )
      //     : [];
      const entry = {
        id: Date.now(),
        name: anonymous ? "Anonymous" : name || "Someone",
        visibility: anonymous ? "anonymous" : "named",
        type: "wall",
        memory,
        message,
        note,
        // We only store file names — actual files aren't uploaded to keep setup simple
        // mediaPreviews: mediaPreviews.map((p) => ({
        //   name: p.name,
        //   type: p.type,
        //   url: null,
        // })),
        //
        mediaPreviews: mediaPreviews.map((p) => ({
          name: p.name,
          type: p.type,
          url: null,
        })),
        emoji: rnd(EMOJIS),
        color: rnd(PALETTE),
        rot: Math.random() * 6 - 3,
        date: new Date().toISOString(),
      };
      // 1️⃣ Save to Firestore
      const saved = await saveEntryToFirestore(entry);
      setEntries((prev) => [saved, ...prev]);

      // 2️⃣ Email notification (non-blocking)
      sendEmailNotification(entry)
        .then(() => {
          showToast(
            isEmailConfigured()
              ? "Memory saved & email sent ✨"
              : "Memory saved ✨",
          );
        })
        .catch((err) => {
          console.error("Email notification failed:", err);
          showToast("Memory saved ✨ (email failed — check EmailJS config)");
        });
      setName("");
      setAnonymous(false);
      setMemory("");
      setMessage("");
      setNote("");
      setMediaPreviews([]);
      setPage("home");
    } catch (err) {
      console.error("Firestore save failed:", err);

      console.error("FULL ERROR:", err);
      console.error("CODE:", err.code);
      console.error("MESSAGE:", err.message);

      showToast(`❌ ${err.message}`);

      // showToast("❌ Save failed — check your Firebase config.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: CREAM, paddingTop: 100 }}>
      <main
        id="main-content"
        style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}
      >
        <h1
          style={{
            fontFamily: "'Caveat',cursive",
            fontSize: 58,
            color: NAVY,
            marginBottom: 8,
          }}
        >
          write something 💌
        </h1>
        <p
          style={{
            fontFamily: "'Patrick Hand',cursive",
            color: NAVY + "88",
            marginBottom: 36,
          }}
        >
          Leave a memory, note, confession, or message for {CONFIG.ownerName}.
        </p>

        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              fontFamily: "'Patrick Hand',cursive",
              fontSize: 17,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: RED }}
            />
            Stay anonymous
          </label>
        </div>

        {!anonymous && (
          <FieldWrapper label="Your name" id="name">
            <input
              className="hand-input"
              placeholder="e.g. Priya"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Your name"
            />
          </FieldWrapper>
        )}

        <FieldWrapper
          label="A memory to share *"
          id="memory"
          err={errors.memory}
        >
          <textarea
            className="hand-textarea"
            rows={4}
            placeholder="That one time we…"
            value={memory}
            onChange={(e) => {
              setMemory(e.target.value);
              setErrors({});
            }}
            aria-required="true"
          />
        </FieldWrapper>

        <FieldWrapper label="A heartfelt message" id="message">
          <textarea
            className="hand-textarea"
            rows={4}
            placeholder="I want you to know…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </FieldWrapper>

        <FieldWrapper label="Anything else?" id="note">
          <textarea
            className="hand-textarea"
            rows={3}
            placeholder="P.S. …"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </FieldWrapper>

        {/* {mediaPreviews.length > 0 && (
          <div
            style={{
              marginBottom: 16,
              fontFamily: "'Patrick Hand',cursive",
              color: NAVY + "88",
              fontSize: 14,
            }}
          >
            {mediaPreviews.map((p, i) => (
              <div key={i}>📎 {p.name}</div>
            ))}
          </div>
        )}


        <button className="btn-cta" onClick={submit} disabled={saving}>
          {saving ? "Saving… ⏳" : "💌 Save Memory"}
        </button>*/}
        {mediaPreviews.length > 0 && (
          <div
            style={{
              marginBottom: 16,
              fontFamily: "'Patrick Hand',cursive",
              color: NAVY + "88",
              fontSize: 14,
            }}
          >
            {mediaPreviews.map((p, i) => (
              <div key={i}>📎 {p.name}</div>
            ))}
          </div>
        )}

        {/* {saving && (
          <>
            <div
              style={{
                width: "100%",
                background: "#eee",
                borderRadius: 10,
                marginBottom: 10,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: 10,
                  background: "#C94C4C",
                  transition: "width 0.2s",
                }}
              />
            </div>

            <p
              style={{
                fontFamily: "'Patrick Hand', cursive",
                marginBottom: 20,
              }}
            >
              Uploading... {Math.round(uploadProgress)}%
            </p>
          </>
        )}*/}

        <button className="btn-cta" onClick={submit} disabled={saving}>
          {saving ? "Saving… ⏳" : "💌 Save Memory"}
        </button>
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontFamily: "'Patrick Hand',cursive",
              fontSize: 14,
              fontWeight: 600,
              color: NAVY,
            }}
          >
            {e.name}
          </span>
        </div>
        <div
          style={{ fontSize: 36, textAlign: "center", margin: "10px 0 8px" }}
          aria-hidden="true"
        >
          {e.emoji}
        </div>
        <p
          style={{
            fontFamily: "'Caveat',cursive",
            fontSize: 22,
            lineHeight: 1.55,
            color: NAVY,
            marginBottom: 10,
          }}
        >
          "{e.memory}"
        </p>
        {e.message && (
          <p
            style={{
              fontStyle: "italic",
              color: NAVY + "bb",
              marginBottom: 10,
              lineHeight: 1.6,
              fontFamily: "'Patrick Hand',cursive",
            }}
          >
            {e.message}
          </p>
        )}
        {e.note && (
          <p
            style={{
              fontFamily: "'Patrick Hand',cursive",
              color: NAVY + "88",
              marginBottom: 8,
              fontSize: 14,
            }}
          >
            {e.note}
          </p>
        )}
        {/* {e.mediaPreviews?.length > 0 && (
          <p
            style={{
              fontFamily: "'Patrick Hand',cursive",
              color: NAVY + "66",
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            📎 {e.mediaPreviews.map((p) => p.name).join(", ")}
          </p>
        )}*/}
        {e.mediaPreviews?.length > 0 && (
          <div
            style={{
              fontFamily: "'Patrick Hand',cursive",
              color: NAVY + "66",
              fontSize: 13,
              marginBottom: 8,
            }}
          >
            📎 {e.mediaPreviews.map((p) => p.name).join(", ")}
          </div>
        )}
        <p
          style={{
            textAlign: "right",
            marginTop: 10,
            fontSize: 12,
            color: NAVY + "55",
            fontFamily: "'Patrick Hand',cursive",
          }}
        >
          <time dateTime={e.date}>{fmtDate(e.date)}</time>
        </p>
      </article>
    </div>
  );
}

function GalleryPage({ entries, setEntries, showToast }) {
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  const syncFromFirestore = useCallback(async () => {
    if (!isConfigured()) {
      showToast("⚠️ Configure Firebase first!");
      return;
    }
    setLoading(true);
    try {
      const loaded = await loadEntriesFromFirestore();
      setEntries(loaded);
      showToast(`Loaded ${loaded.length} memories ☁️`);
    } catch (err) {
      console.error(err);
      showToast("❌ Couldn't load from Firestore.");
    } finally {
      setLoading(false);
    }
  }, [setEntries, showToast]);

  useEffect(() => {
    syncFromFirestore();
  }, []);

  const shown = entries.filter((e) => {
    if (filter === "all") return true;
    if (filter === "anon") return e.visibility === "anonymous";
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: CREAM, paddingTop: 100 }}>
      <main
        id="main-content"
        style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}
      >
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h1
            style={{
              fontFamily: "'Caveat',cursive",
              fontSize: 56,
              color: NAVY,
            }}
          >
            memory wall 📸
          </h1>
          <div style={{ marginTop: 14 }}>
            <button
              className="btn-ghost"
              onClick={syncFromFirestore}
              disabled={loading}
              style={{ fontSize: 16, padding: "10px 22px" }}
            >
              {loading ? "Loading… ⏳" : "☁️ Refresh memories"}
            </button>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 20,
            }}
            role="group"
            aria-label="Filter memories"
          >
            {[
              ["all", "all"],
              ["anon", "anonymous"],
            ].map(([f, lbl]) => (
              <button
                key={f}
                className={`filter-pill${filter === f ? " active" : ""}`}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p
            style={{
              textAlign: "center",
              fontFamily: "'Patrick Hand',cursive",
              color: NAVY + "88",
              marginTop: 60,
              fontSize: 20,
            }}
          >
            Loading memories… ✨
          </p>
        ) : shown.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              fontFamily: "'Patrick Hand',cursive",
              color: NAVY + "88",
              marginTop: 60,
              fontSize: 20,
            }}
          >
            No memories here yet.
          </p>
        ) : (
          <div style={{ columns: "3 260px", columnGap: 22 }}>
            {shown.map((e) => (
              <MemoryCard key={e.id || e._docId} e={e} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
function TimelinePage({ entries }) {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.date) - new Date(b.date),
  );
  return (
    <div style={{ minHeight: "100vh", background: CREAM, paddingTop: 100 }}>
      <main
        id="main-content"
        style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px" }}
      >
        <h1
          style={{
            fontFamily: "'Caveat',cursive",
            fontSize: 56,
            color: NAVY,
            textAlign: "center",
            marginBottom: 50,
          }}
        >
          timeline 🕰
        </h1>
        <ol
          style={{ listStyle: "none", position: "relative", paddingLeft: 32 }}
        >
          <div
            style={{
              position: "absolute",
              left: 14,
              top: 0,
              bottom: 0,
              width: 2,
              background: NAVY + "18",
              borderRadius: 2,
            }}
            aria-hidden="true"
          />
          {sorted.length === 0 && (
            <p
              style={{
                fontFamily: "'Patrick Hand',cursive",
                color: NAVY + "88",
                fontSize: 18,
              }}
            >
              No memories yet.
            </p>
          )}
          {sorted.map((e) => (
            <li
              key={e.id || e._docId}
              style={{ position: "relative", marginBottom: 28 }}
            >
              <div
                style={{
                  position: "absolute",
                  left: -26,
                  top: 20,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: RED,
                  border: `2px solid ${CREAM}`,
                }}
                aria-hidden="true"
              />
              <article
                style={{
                  background: "white",
                  borderRadius: 18,
                  padding: "20px 24px",
                  boxShadow: "0 3px 16px rgba(0,0,0,.07)",
                  borderLeft: `4px solid ${RED}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Patrick Hand',cursive",
                      fontWeight: 600,
                      color: NAVY,
                    }}
                  >
                    {e.name}
                  </span>
                  <time
                    dateTime={e.date}
                    style={{
                      fontSize: 13,
                      color: RED,
                      fontFamily: "'Patrick Hand',cursive",
                    }}
                  >
                    {fmtDate(e.date)}
                  </time>
                </div>
                <p
                  style={{
                    fontFamily: "'Caveat',cursive",
                    fontSize: 23,
                    lineHeight: 1.6,
                    color: NAVY,
                  }}
                >
                  {e.memory}
                </p>
              </article>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function SettingsPage({ entries, showToast }) {
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "slam-book-export.json";
    a.click();
    showToast("📥 Exported!");
  };

  const Row = ({ label, value, status }) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 0",
        borderBottom: `1px solid ${NAVY}11`,
      }}
    >
      <span
        style={{
          fontFamily: "'Patrick Hand',cursive",
          color: NAVY,
          fontSize: 16,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "'Patrick Hand',cursive",
          color: status ? "#10B981" : "#EF4444",
          fontSize: 14,
        }}
      >
        {status ? "✅ " : "⚠️ "}
        {value}
      </span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: CREAM, paddingTop: 100 }}>
      <main
        id="main-content"
        style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px" }}
      >
        <h1
          style={{
            fontFamily: "'Caveat',cursive",
            fontSize: 52,
            color: NAVY,
            marginBottom: 8,
          }}
        >
          settings ⚙️
        </h1>
        <p
          style={{
            fontFamily: "'Patrick Hand',cursive",
            color: NAVY + "88",
            marginBottom: 36,
          }}
        >
          Edit the <code>CONFIG</code> block at the top of{" "}
          <code>SlamBook.jsx</code> to change these.
        </p>
        <section
          style={{
            background: "white",
            borderRadius: 18,
            padding: "24px 28px",
            boxShadow: "0 3px 16px rgba(0,0,0,.07)",
            marginBottom: 28,
          }}
        >
          <h2
            style={{
              fontFamily: "'Caveat',cursive",
              fontSize: 28,
              color: NAVY,
              marginBottom: 4,
            }}
          >
            Status
          </h2>
          <Row label="Owner name" value={CONFIG.ownerName} status={true} />
          <Row
            label="Firebase"
            value={isConfigured() ? "Connected ✓" : "Not configured"}
            status={isConfigured()}
          />
          <Row
            label="EmailJS"
            value={isEmailConfigured() ? "Connected ✓" : "Not configured"}
            status={isEmailConfigured()}
          />
          <Row
            label="Memories stored"
            value={`${entries.length} entries`}
            status={true}
          />
        </section>
        <section
          style={{
            background: "white",
            borderRadius: 18,
            padding: "24px 28px",
            boxShadow: "0 3px 16px rgba(0,0,0,.07)",
            marginBottom: 28,
          }}
        >
          <h2
            style={{
              fontFamily: "'Caveat',cursive",
              fontSize: 28,
              color: NAVY,
              marginBottom: 16,
            }}
          >
            Actions
          </h2>
          <button
            className="btn-ghost"
            onClick={handleExportJSON}
            style={{ justifyContent: "flex-start", gap: 12 }}
          >
            📥 Export all memories as JSON
          </button>
        </section>
        <div
          style={{
            background: "#EEF9F4",
            border: "1px solid #A7F3D0",
            borderRadius: 14,
            padding: "18px 22px",
            marginBottom: 16,
          }}
        >
          <p
            style={{
              fontFamily: "'Patrick Hand',cursive",
              color: "#065F46",
              fontSize: 15,
              lineHeight: 1.7,
            }}
          >
            🔥 <strong>Firebase Firestore</strong> stores each memory as a
            document in a<code> memories</code> collection. Free tier:{" "}
            <strong>50,000 reads &amp; 20,000 writes/day</strong>. Never
            expires. Keep your <code>apiKey</code> private — use Firebase
            security rules to restrict write access if you deploy publicly.
          </p>
        </div>
        <div
          style={{
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            borderRadius: 14,
            padding: "18px 22px",
          }}
        >
          <p
            style={{
              fontFamily: "'Patrick Hand',cursive",
              color: "#1E40AF",
              fontSize: 15,
              lineHeight: 1.7,
            }}
          >
            📧 <strong>EmailJS.com</strong> sends you an email every time
            someone saves a memory. Free tier: <strong>200 emails/month</strong>
            . See the CONFIG comment at the top of the file for setup
            instructions.
          </p>
        </div>
      </main>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function SlamBook() {
  const [page, setPage] = useState("home");
  const [entries, setEntries] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg) => setToast(msg), []);

  return (
    <>
      <style>{CSS}</style>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <div
        style={{
          fontFamily: "'Nunito',sans-serif",
          minHeight: "100vh",
          background: CREAM,
        }}
      >
        <Nav
          page={page}
          setPage={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />

        {page === "home" && <HomePage setPage={setPage} entries={entries} />}
        {page === "write" && (
          <WritePage
            entries={entries}
            setEntries={setEntries}
            setPage={setPage}
            showToast={showToast}
          />
        )}
        {page === "gallery" && (
          <GalleryPage
            entries={entries}
            setEntries={setEntries}
            showToast={showToast}
          />
        )}
        {page === "timeline" && <TimelinePage entries={entries} />}
        {page === "settings" && (
          <SettingsPage entries={entries} showToast={showToast} />
        )}

        {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
      </div>
    </>
  );
}
