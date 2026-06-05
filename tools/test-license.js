#!/usr/bin/env node
// Proves the license round-trip: keys signed by Node verify under the SAME noble-ed25519
// verifier the app uses in the browser. Covers tamper, wrong key, expiry, device binding.
const crypto = require("crypto");

(async () => {
  const ed = await import("@noble/ed25519");

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pubHex = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url").toString("hex");

  function sign(payload) {
    const enc = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.sign(null, Buffer.from(enc, "utf8"), privateKey).toString("base64url");
    return "FLUENT-" + enc + "." + sig;
  }
  // mirror of www/license.js verify(), using noble (the browser path)
  function b64urlToBytes(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return new Uint8Array(Buffer.from(s, "base64")); }
  function hexToBytes(h) { return new Uint8Array(Buffer.from(h, "hex")); }
  const utf8 = (s) => new TextEncoder().encode(s);
  async function verify(str, deviceId, pub) {
    str = str.replace(/^FLUENT-/, "");
    const dot = str.indexOf("."); const encP = str.slice(0, dot), encS = str.slice(dot + 1);
    const ok = await ed.verifyAsync(b64urlToBytes(encS), utf8(encP), hexToBytes(pub));
    if (!ok) return { ok: false, reason: "signature" };
    const p = JSON.parse(Buffer.from(b64urlToBytes(encP)).toString());
    if (p.x && Date.now() > p.x * 1000) return { ok: false, reason: "expired" };
    if (p.d && p.d !== deviceId) return { ok: false, reason: "device" };
    return { ok: true, payload: p };
  }

  let pass = 0, fail = 0;
  const t = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };

  const L = sign({ v: 1, n: "Rudaw", e: "r@x.com", d: "", x: 0, iat: 1 });
  t("valid key verifies", (await verify(L, "anydev", pubHex)).ok);

  const bad = L.slice(0, -2) + (L.slice(-2) === "aa" ? "bb" : "aa");
  t("tampered signature rejected", !(await verify(bad, "anydev", pubHex)).ok);

  const otherPub = Buffer.from(crypto.generateKeyPairSync("ed25519").publicKey.export({ format: "jwk" }).x, "base64url").toString("hex");
  t("wrong public key rejected", !(await verify(L, "anydev", otherPub)).ok);

  const E = sign({ v: 1, n: "x", d: "", x: Math.floor(Date.now() / 1000) - 10, iat: 1 });
  t("expired key rejected", (await verify(E, "anydev", pubHex)).reason === "expired");

  const D = sign({ v: 1, n: "x", d: "dev-123", x: 0, iat: 1 });
  t("device-bound key ok on its device", (await verify(D, "dev-123", pubHex)).ok);
  t("device-bound key rejected elsewhere", (await verify(D, "dev-999", pubHex)).reason === "device");

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
