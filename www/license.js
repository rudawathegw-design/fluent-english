// license.js — offline license gate (Ed25519, verified in-app with an embedded public key).
// Loaded as a module so it can import the bundled noble verifier. It decides whether to
// boot the app (window.bootApp), show a free trial, or block with the activation screen.
import * as ed from "./vendor/noble-ed25519.js";

// === Configuration =========================================================
// Replaced automatically by `npm run license:keygen`. Keep the matching PRIVATE
// key (keys/license_private.pem) safe and offline — it issues keys; this only verifies.
const PUBLIC_KEY_HEX = "4c7b14d7f4e303b9da4b38fd79f2a935d47c707cd52507846fcfcbc5aba4271b";
const TRIAL_DAYS = 7; // free days before a key is required. Set to 0 for a hard gate.
// ===========================================================================

const S = window.FluentStore;
const K_LICENSE = "fluent.license";
const K_TRIAL = "fluent.trialStart";

// --- byte helpers (browser) ---
function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s), b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}
function hexToBytes(h) {
  h = h.trim();
  const b = new Uint8Array(h.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(h.substr(i * 2, 2), 16);
  return b;
}
const utf8 = (s) => new TextEncoder().encode(s);

// --- core verify ---
async function verify(str, deviceId) {
  if (!str) return { ok: false, reason: "empty" };
  str = str.trim().replace(/\s+/g, "");
  if (str.startsWith("FLUENT-")) str = str.slice(7);
  const dot = str.indexOf(".");
  if (dot < 0) return { ok: false, reason: "format" };
  const encPayload = str.slice(0, dot), encSig = str.slice(dot + 1);
  let valid = false;
  try {
    valid = await ed.verifyAsync(b64urlToBytes(encSig), utf8(encPayload), hexToBytes(PUBLIC_KEY_HEX));
  } catch (e) { return { ok: false, reason: "error" }; }
  if (!valid) return { ok: false, reason: "signature" };
  let p;
  try { p = JSON.parse(new TextDecoder().decode(b64urlToBytes(encPayload))); }
  catch (e) { return { ok: false, reason: "payload" }; }
  if (p.x && Date.now() > p.x * 1000) return { ok: false, reason: "expired", payload: p };
  if (p.d && p.d !== deviceId) return { ok: false, reason: "device", payload: p };
  return { ok: true, payload: p };
}

async function trialStatus() {
  if (TRIAL_DAYS <= 0) return { active: false, daysLeft: 0, started: false };
  const start = await S.get(K_TRIAL);
  if (!start) return { active: true, daysLeft: TRIAL_DAYS, started: false };
  const left = Math.ceil(TRIAL_DAYS - (Date.now() - Number(start)) / 86400000);
  return { active: left > 0, daysLeft: Math.max(0, left), started: true };
}

// --- gate UI ---
function gateEl() { return document.getElementById("gate"); }
function ensureGate() {
  let g = gateEl();
  if (!g) { g = document.createElement("div"); g.id = "gate"; g.className = "gate"; document.body.appendChild(g); }
  return g;
}
function boot() {
  const g = gateEl();
  if (g) { g.classList.add("hidden"); setTimeout(() => { const x = gateEl(); if (x) x.remove(); }, 300); }
  if (window.bootApp) window.bootApp();
}

function showForm(deviceId, trial, msg) {
  const g = ensureGate();
  const trialBtn = (TRIAL_DAYS > 0 && !trial.started)
    ? `<button class="btn ghost" id="g-trial" style="width:100%;margin-top:10px">Start ${TRIAL_DAYS}-day free trial</button>` : "";
  const dismiss = trial.active
    ? `<button class="gate-dismiss" id="g-later">Maybe later — keep using the trial</button>` : "";
  const expiredNote = (trial.started && !trial.active)
    ? `<p class="gate-warn">Your free trial has ended. Enter a license key to keep going.</p>` : "";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  g.classList.remove("hidden");
  g.innerHTML = `
    <div class="gate-card">
      <div class="brand"><span class="dot"></span><h1>Fluent</h1></div>
      <p class="gate-lead">Enter your license key to unlock the app.</p>
      ${expiredNote}
      ${msg ? `<p class="gate-warn">${esc(msg)}</p>` : ""}
      <textarea id="g-key" placeholder="FLUENT-..." spellcheck="false" autocapitalize="off" autocorrect="off"></textarea>
      <button class="btn green" id="g-activate" style="width:100%">Activate</button>
      ${trialBtn}
      ${dismiss}
      <p class="gate-id">Your device ID:<br><code>${esc(deviceId)}</code>
        <span>Share this with your provider to receive a key locked to this device.</span></p>
    </div>`;

  g.querySelector("#g-activate").onclick = async () => {
    const val = g.querySelector("#g-key").value;
    const r = await verify(val, deviceId);
    if (r.ok) {
      await S.set(K_LICENSE, val.trim());
      if (window.fluentToast) window.fluentToast("License activated ✓");
      boot();
    } else {
      const m = {
        expired: "That key has expired.",
        device: "That key is locked to a different device.",
        signature: "Invalid license key.",
        format: "That doesn't look like a license key.",
        payload: "Corrupted license key."
      }[r.reason] || "Invalid license key.";
      showForm(deviceId, trial, m);
    }
  };
  const tb = g.querySelector("#g-trial");
  if (tb) tb.onclick = async () => {
    await S.set(K_TRIAL, String(Date.now()));
    if (window.fluentToast) window.fluentToast(`Free trial started — ${TRIAL_DAYS} days`);
    boot();
  };
  const lb = g.querySelector("#g-later");
  if (lb) lb.onclick = () => { g.classList.add("hidden"); };
}

// Allow the running app (e.g. a Settings button) to reopen the activation screen.
window.FluentLicense = {
  openGate: async () => {
    const id = window.__fluentDeviceId || await window.getDeviceId();
    showForm(id, await trialStatus(), "");
  }
};

// --- entry ---
(async function () {
  const deviceId = await window.getDeviceId();
  window.__fluentDeviceId = deviceId;

  const stored = await S.get(K_LICENSE);
  if (stored) {
    const r = await verify(stored, deviceId);
    if (r.ok) { boot(); return; }
  }

  const trial = await trialStatus();
  if (TRIAL_DAYS > 0 && !trial.started) {
    // first ever launch — start the free trial automatically so the user isn't blocked
    await S.set(K_TRIAL, String(Date.now()));
    if (window.fluentToast) window.fluentToast(`Free trial started — ${TRIAL_DAYS} days`);
    boot();
    return;
  }
  if (trial.active) { boot(); return; }

  // trial used up and no valid license → block
  showForm(deviceId, trial, "");
})();
