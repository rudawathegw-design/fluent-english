#!/usr/bin/env node
// Generates the offline license keypair (and a separate update-signing keypair).
// Private keys are written to keys/ (git-ignored). The license PUBLIC key is printed
// and auto-pasted into www/license.js. Run once: `npm run license:keygen`.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const keysDir = path.join(__dirname, "..", "keys");
fs.mkdirSync(keysDir, { recursive: true });

function gen(name) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
  const jwk = publicKey.export({ format: "jwk" });
  const pubHex = Buffer.from(jwk.x, "base64url").toString("hex");
  fs.writeFileSync(path.join(keysDir, name + "_private.pem"), privPem);
  fs.writeFileSync(path.join(keysDir, name + "_public.hex"), pubHex + "\n");
  return pubHex;
}

const licensePub = gen("license");
const updatePub = gen("update");

console.log("Keypairs created in keys/ (git-ignored — keep these private & backed up).\n");
console.log("LICENSE public key (hex):\n  " + licensePub + "\n");
console.log("UPDATE  public key (hex):\n  " + updatePub + "\n");

// auto-patch the embedded public key in www/license.js
try {
  const lp = path.join(__dirname, "..", "www", "license.js");
  let s = fs.readFileSync(lp, "utf8");
  if (s.includes("__LICENSE_PUBLIC_KEY__")) {
    s = s.replace("__LICENSE_PUBLIC_KEY__", licensePub);
    fs.writeFileSync(lp, s);
    console.log("  ✓ www/license.js patched with the license public key.");
  } else {
    console.log("  ! www/license.js already had a key — update PUBLIC_KEY_HEX manually if needed:");
    console.log("    " + licensePub);
  }
} catch (e) {
  console.log("  ! Could not patch www/license.js automatically:", e.message);
}

console.log("\nNext: issue a key with  node tools/issue-license.js \"Name\" [email] [deviceId] [days]");
