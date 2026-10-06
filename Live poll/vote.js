/* ===== vote.js — the phone / voting card ===== */

const realtime = initAbly();
const channel = realtime ? realtime.channels.get(CHANNEL_NAME) : null;

let selected = null;          // which answer the person tapped (A/B/C)
let votingOpen = true;        // flipped by state broadcasts from the board
let gotState = false;

const $ = (id) => document.getElementById(id);

/* ---------- receive the board's state (question + open/closed) ---------- */
if (channel) {
  channel.subscribe("state", (msg) => {
    const s = msg.data;
    if (!s) return;
    gotState = true;
    $("qEn").textContent = s.question.en || "—";
    $("qTa").textContent = s.question.ta || "—";
    $("qSi").textContent = s.question.si || "—";
    $("lblA").textContent = s.answers.A;
    $("lblB").textContent = s.answers.B;
    $("lblC").textContent = s.answers.C;
    votingOpen = !!s.open;
    updateGate();
  });
}

function updateGate() {
  const btns = document.querySelectorAll(".answer");
  btns.forEach((b) => (b.disabled = !votingOpen));
  $("voteBtn").disabled = !votingOpen;
  if (!votingOpen) {
    setMsg("Voting closed — the presenter has closed this poll.", "warn");
  } else if ($("voteMsg").classList.contains("warn")) {
    setMsg("", "");
  }
}

function setMsg(text, cls) {
  const el = $("voteMsg");
  el.textContent = text;
  el.className = cls;
}

/* ---------- tap an answer ---------- */
document.querySelectorAll(".answer").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!votingOpen) return;
    selected = btn.dataset.choice;
    document.querySelectorAll(".answer").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    setMsg("Answer " + selected + " selected — tap Vote.", "");
  });
});

/* ---------- tap Vote ---------- */
$("voteBtn").addEventListener("click", () => {
  if (!votingOpen) return;
  if (!selected) { setMsg("Tap an answer first (A, B or C).", "warn"); return; }
  if (!channel) { setMsg("Cannot vote — realtime connection offline.", "warn"); return; }

  const voteBtn = $("voteBtn");
  voteBtn.disabled = true;

  channel.publish("vote", { choice: selected, ts: Date.now() })
    .then(() => {
      setMsg("Thank you, your vote is in.", "ok");
      voteBtn.disabled = false;
    })
    .catch((err) => {
      console.warn("Vote publish error:", err);
      setMsg("Could not send — check your connection and try again.", "warn");
      voteBtn.disabled = false;
    });
});

/* ---------- Gold: ask the presenter ---------- */
$("askBtn").addEventListener("click", () => {
  const text = $("askInput").value.trim();
  if (!text) return;
  if (!channel) { $("askMsg").textContent = "Connection offline."; return; }

  const askBtn = $("askBtn");
  askBtn.disabled = true;

  channel.publish("question", { text })
    .then(() => {
      $("askInput").value = "";
      $("askMsg").textContent = "Sent — watch the big screen.";
      askBtn.disabled = false;
      setTimeout(() => ($("askMsg").textContent = ""), 4000);
    })
    .catch(() => {
      $("askMsg").textContent = "Could not send. Try again.";
      askBtn.disabled = false;
    });
});
$("askInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("askBtn").click(); });

/* ---------- Gold: clap / heart ---------- */
function sendReaction(type) {
  if (!channel) return;
  channel.publish("reaction", { type }).catch((e) => console.warn("Reaction publish error:", e));
}
$("clapBtn").addEventListener("click", () => sendReaction("clap"));
$("heartBtn").addEventListener("click", () => sendReaction("heart"));

/* ---------- connection light + first sync ---------- */
if (realtime && realtime.connection) {
  realtime.connection.on("connected", () => {
    paintConnection($("connDot"), $("connLabel"), "connected");
    if (channel) channel.publish("request-state", {}).catch(() => {});   // ask board for current state
  });
  realtime.connection.on("connecting", () => paintConnection($("connDot"), $("connLabel"), "connecting"));
  realtime.connection.on("failed", () => paintConnection($("connDot"), $("connLabel"), "failed"));
  realtime.connection.on("disconnected", () => {
    paintConnection($("connDot"), $("connLabel"), "failed");
    setMsg("Connection lost — waiting to reconnect…", "warn");
  });
  realtime.connection.on("suspended", () => {
    paintConnection($("connDot"), $("connLabel"), "failed");
    setMsg("Connection suspended — waiting to reconnect…", "warn");
  });
} else {
  document.addEventListener("DOMContentLoaded", () => {
    paintConnection($("connDot"), $("connLabel"), "failed");
    setMsg("Realtime connection unavailable (Ably library not loaded).", "warn");
  });
}

// If no board answers, keep asking (board may not be open yet) and warn the user.
setTimeout(() => {
  if (!gotState) setMsg("No board yet — open board.html on the laptop first.", "warn");
}, 3000);
const retrySync = setInterval(() => {
  if (gotState) { clearInterval(retrySync); return; }
  if (channel) channel.publish("request-state", {}).catch(() => {});
}, 5000);

