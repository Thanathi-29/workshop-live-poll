/* ===== board.js — the laptop / projector screen =====
 * The board is the SOURCE OF TRUTH for the tally.
 * Phones publish 'vote' messages; the board counts them and broadcasts
 * the full state so every screen (and any late-joining phone) stays in sync.
 */

const realtime = initAbly();
const channel = realtime ? realtime.channels.get(CHANNEL_NAME) : null;

const state = {
  question: {
    en: "Have you used a sensor before?",
    ta: "",
    si: ""
  },
  answers: { A: "Yes, with a kit", B: "Yes, at work", C: "No, never" },
  tally: { A: 0, B: 0, C: 0 },
  total: 0,
  open: true
};

const $ = (id) => document.getElementById(id);

/* ---------- rendering ---------- */
function render() {
  $("qEn").textContent = state.question.en || "—";
  $("qTa").textContent = state.question.ta || "—";
  $("qSi").textContent = state.question.si || "—";

  const max = Math.max(state.tally.A, state.tally.B, state.tally.C, 1);
  for (const c of CHOICES) {
    $("lbl" + c).textContent = state.answers[c];
    $("cnt" + c).textContent = state.tally[c];
    // grow proportionally to the leading answer so bars always visibly move
    const pct = state.tally[c] === 0 ? 0 : Math.max(6, (state.tally[c] / max) * 100);
    $("fill" + c).style.width = pct + "%";
  }
  $("totalCnt").textContent = state.total;

  const badge = $("statusBadge");
  badge.textContent = state.open ? "VOTING OPEN" : "VOTING CLOSED";
  badge.className = "badge " + (state.open ? "open" : "closed");
}

function broadcastState() {
  if (!channel) return;
  // publish on 'state' — every phone subscribes to it
  channel.publish("state", state).catch((e) => console.warn("state publish failed", e));
}

/* ---------- listen to phones ---------- */
if (channel) {
  channel.subscribe("vote", (msg) => {
    if (!state.open) return;                       // votes after close are ignored
    const choice = msg.data && msg.data.choice;
    if (!CHOICES.includes(choice)) return;         // only A/B/C count
    state.tally[choice] += 1;
    state.total += 1;
    render();
    broadcastState();                              // everyone sees the new bars
  });

  channel.subscribe("request-state", () => {
    broadcastState();                              // late joiner asks -> we answer
  });

  channel.subscribe("question", (msg) => {
    const text = (msg.data && msg.data.text || "").toString().trim().slice(0, 160);
    if (!text) return;
    const list = $("questionList");
    const empty = list.querySelector(".empty-note");
    if (empty) empty.remove();
    const li = document.createElement("li");
    li.textContent = text;
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = new Date(msg.timestamp).toLocaleTimeString();
    li.appendChild(who);
    list.prepend(li);
  });

  channel.subscribe("reaction", (msg) => {
    const kind = msg.data && msg.data.type === "heart" ? "❤️" : "👏";
    const span = document.createElement("span");
    span.className = "reaction-pop";
    span.textContent = kind;
    span.style.left = (10 + Math.random() * 75) + "%";
    $("reactionLayer").appendChild(span);
    setTimeout(() => span.remove(), 3100);         // auto-clean so screen stays clear
  });
}

/* ---------- connection light ---------- */
if (realtime && realtime.connection) {
  realtime.connection.on("connected", () => {
    paintConnection($("connDot"), $("connLabel"), "connected");
    broadcastState();
  });
  realtime.connection.on("connecting", () => paintConnection($("connDot"), $("connLabel"), "connecting"));
  realtime.connection.on("failed", () => paintConnection($("connDot"), $("connLabel"), "failed"));
  realtime.connection.on("disconnected", () => paintConnection($("connDot"), $("connLabel"), "disconnected"));
  realtime.connection.on("suspended", () => paintConnection($("connDot"), $("connLabel"), "suspended"));
} else {
  document.addEventListener("DOMContentLoaded", () => {
    paintConnection($("connDot"), $("connLabel"), "failed");
  });
}

/* ---------- presenter controls ---------- */

$("setQBtn").addEventListener("click", () => {
  const en = $("qInput").value.trim();
  if (!en) { setStatus("Type a question first."); return; }
  state.question.en = en;
  state.answers.A = $("aInput").value.trim() || state.answers.A;
  state.answers.B = $("bInput").value.trim() || state.answers.B;
  state.answers.C = $("cInput").value.trim() || state.answers.C;
  state.question.ta = $("taInput").value.trim();
  state.question.si = $("siInput").value.trim();
  render();
  broadcastState();
  setStatus("Question is on every screen.");
  if (!state.question.ta || !state.question.si) doTranslate();  // auto-translate if empty
});

$("translateBtn").addEventListener("click", doTranslate);

async function doTranslate() {
  const en = $("qInput").value.trim() || state.question.en;
  if (!en) { setStatus("Type a question first."); return; }
  setStatus("Translating…");
  try {
    const [ta, si] = await Promise.all([translate(en, "ta"), translate(en, "si")]);
    $("taInput").value = ta;
    $("siInput").value = si;
    state.question.en = en;
    state.question.ta = ta;
    state.question.si = si;
    render();
    broadcastState();
    setStatus("Translated — check the Tamil/Sinhala, edit if needed, then 'Put on screen'.");
  } catch (e) {
    console.error(e);
    setStatus("Translation failed — type Tamil/Sinhala by hand.");
  }
}

/* Multi-tier free translation: Google Translate GTX (primary) + MyMemory (fallback) */
async function translate(text, target) {
  // 1. Primary: Google Translate GTX Free Endpoint (No API key, fast, supports Tamil & Sinhala)
  try {
    const gurl = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=" +
      encodeURIComponent(target) + "&dt=t&q=" + encodeURIComponent(text);
    const gres = await fetch(gurl);
    if (gres.ok) {
      const gdata = await gres.json();
      if (gdata && gdata[0] && Array.isArray(gdata[0])) {
        const out = gdata[0].map((item) => item[0]).join("").trim();
        if (out && out.toLowerCase() !== text.toLowerCase()) {
          return out;
        }
      }
    }
  } catch (e) {
    console.warn("Google GTX translate failed, falling back to MyMemory:", e);
  }

  // 2. Secondary Fallback: MyMemory Free Translation API
  try {
    const murl = "https://api.mymemory.translated.net/get?q=" +
      encodeURIComponent(text) + "&langpair=en|" + encodeURIComponent(target);
    const mres = await fetch(murl);
    if (mres.ok) {
      const mdata = await mres.json();
      const out = mdata && mdata.responseData && mdata.responseData.translatedText;
      if (out && !mdata.quotaFinished && !out.startsWith("MYMEMORY WARNING")) {
        return out.trim();
      }
    }
  } catch (e) {
    console.warn("MyMemory translate failed:", e);
  }

  throw new Error("Translation failed on all free providers.");
}

$("taInput").addEventListener("change", () => { state.question.ta = $("taInput").value; render(); broadcastState(); });
$("siInput").addEventListener("change", () => { state.question.si = $("siInput").value; render(); broadcastState(); });
$("aInput").addEventListener("change", () => { state.answers.A = $("aInput").value; render(); broadcastState(); });
$("bInput").addEventListener("change", () => { state.answers.B = $("bInput").value; render(); broadcastState(); });
$("cInput").addEventListener("change", () => { state.answers.C = $("cInput").value; render(); broadcastState(); });

$("openBtn").addEventListener("click", () => { state.open = true; render(); broadcastState(); setStatus("Voting is OPEN."); });
$("closeBtn").addEventListener("click", () => { state.open = false; render(); broadcastState(); setStatus("Voting is CLOSED."); });
$("resetBtn").addEventListener("click", () => {
  state.tally = { A: 0, B: 0, C: 0 };
  state.total = 0;
  render();
  broadcastState();
  setStatus("Counts reset.");
});

function setStatus(t) { $("setStatus").textContent = t; }

/* ---------- QR code for phones ---------- */
let autoDetectedVoteUrl = "";

async function detectNetworkIp() {
  try {
    const res = await fetch("/api/ip");
    if (res.ok) {
      const data = await res.json();
      if (data && data.voteUrl) {
        autoDetectedVoteUrl = data.voteUrl;
        if (!$("customUrlInput").value) {
          $("customUrlInput").value = autoDetectedVoteUrl;
        }
        renderQR();
      }
    }
  } catch (e) {
    // If not using server.js or offline, fall back to current location or custom input
  }
}

function renderQR() {
  const customInput = $("customUrlInput") ? $("customUrlInput").value.trim() : "";
  let href = "";

  if (customInput) {
    href = customInput;
  } else if (autoDetectedVoteUrl) {
    href = autoDetectedVoteUrl;
  } else {
    href = location.href.split("#")[0].split("?")[0];
    if (/\/$/.test(href)) href += "vote.html";
    else if (/index\.html?$/.test(href)) href = href.replace(/index\.html?$/, "vote.html");
    else href = href.replace(/board\.html$/, "vote.html");

    // If opening file:// or localhost, replace with local IP tip
    if (location.protocol === "file:") {
      href = "http://192.168.8.151:3000/vote.html";
    } else if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      const port = location.port ? ":" + location.port : "";
      href = "http://192.168.8.151" + port + "/vote.html";
    }
  }

  $("qrUrl").textContent = href;
  if ($("customUrlInput") && !$("customUrlInput").value && href) {
    $("customUrlInput").placeholder = href;
  }

  const box = $("qrcode");
  box.innerHTML = "";

  let qrCreated = false;
  if (typeof QRCode !== "undefined") {
    try {
      new QRCode(box, { text: href, width: 200, height: 200 });
      qrCreated = true;
    } catch (e) {
      console.warn("QRCode library failed, using QR API fallback:", e);
    }
  }

  if (!qrCreated) {
    // Fallback: render using free public QR code generator API
    const img = document.createElement("img");
    img.src = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(href);
    img.alt = "QR code to join vote";
    img.width = 200;
    img.height = 200;
    img.style.display = "block";
    img.style.borderRadius = "6px";
    box.appendChild(img);
  }
}

if ($("customUrlInput")) {
  $("customUrlInput").addEventListener("input", renderQR);
}

/* ---------- boot ---------- */
$("qInput").value = state.question.en;
render();
renderQR();
detectNetworkIp();

if (channel) {
  channel.publish("request-state", {}).catch(() => {});   // sync with anyone already live
}

/* Silver: show Tamil + Sinhala straight away, without waiting for a click */
if (!state.question.ta || !state.question.si) doTranslate();


