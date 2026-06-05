// update-core.js — pure, environment-agnostic update helpers.
// UMD-ish: usable both as a browser <script> (window.UpdateCore) and in Node (require),
// so the version-compare + checksum logic can be unit-tested without a device.
(function (root, factory) {
  var mod = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = mod;
  else root.UpdateCore = mod;
})(typeof self !== "undefined" ? self : this, function () {
  function parse(v) {
    return String(v == null ? "0" : v).split(".").map(function (n) { return parseInt(n, 10) || 0; });
  }
  function compareVersions(a, b) {
    var pa = parse(a), pb = parse(b), len = Math.max(pa.length, pb.length);
    for (var i = 0; i < len; i++) {
      var x = pa[i] || 0, y = pb[i] || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }
  // Returns meta if it is strictly newer than currentVersion and has what we need, else null.
  function pickUpdate(meta, currentVersion) {
    if (!meta || !meta.version || !meta.url) return null;
    return compareVersions(meta.version, currentVersion) > 0 ? meta : null;
  }
  async function sha256Hex(bytes) {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      var buf = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    }
    var createHash = require("crypto").createHash;
    return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  }
  return { compareVersions: compareVersions, pickUpdate: pickUpdate, sha256Hex: sha256Hex, parse: parse };
});
