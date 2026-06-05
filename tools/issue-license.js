#!/usr/bin/env node
// Issues a signed license key for one user.
// Usage:  node tools/issue-license.js "Full Name" [email] [deviceId] [days]
//   deviceId  — lock the key to one device (from the app's gate screen). "" = any device.
//   days      — validity in days. 0 / omitted = never expires.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node tools/issue-license.js "Full Name" [email] [deviceId] [days]');
  process.exit(1);
}
const name = args[0];
const email = args[1] || "";
const device = args[2] || "";
const days = Number(args[3] || 0);

const keyPath = path.join(__dirname, "..", "keys", "license_private.pem");
if (!fs.existsSync(keyPath)) {
  console.error("Missing keys/license_private.pem — run `npm run license:keygen` first.");
  process.exit(1);
}
const priv = crypto.createPrivateKey(fs.readFileSync(keyPath));

const now = Math.floor(Date.now() / 1000);
const exp = days > 0 ? now + Math.round(days * 86400) : 0;
const payload = { v: 1, n: name, e: email, d: device || "", x: exp, iat: now };

const enc = Buffer.from(JSON.stringify(payload)).toString("base64url");
const sig = crypto.sign(null, Buffer.from(enc, "utf8"), priv).toString("base64url");
const license = "FLUENT-" + enc + "." + sig;

console.log(
  "\nLicense for " + name +
  (device ? " (device " + device + ")" : " (any device)") +
  (exp ? " — expires " + new Date(exp * 1000).toISOString().slice(0, 10) : " — no expiry") +
  ":\n"
);
console.log(license + "\n");
