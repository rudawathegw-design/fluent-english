#!/usr/bin/env node
// Emits version.json for an OTA release. Run by CI after zipping www/.
// Usage:  node tools/make-version.js <version> <zipFileName> [sha256] [notes...]
const a = process.argv.slice(2);
if (a.length < 2) {
  console.error("Usage: node tools/make-version.js <version> <zipFileName> [sha256] [notes...]");
  process.exit(1);
}
const version = a[0];
const file = a[1];
const sha256 = a[2] || null;
const notes = a.slice(3).join(" ") || ("Fluent " + version);
process.stdout.write(JSON.stringify({ version, file, sha256, notes, date: new Date().toISOString() }, null, 2) + "\n");
