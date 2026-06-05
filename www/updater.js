// updater.js — over-the-air content updates via @capgo/capacitor-updater (self-hosted / manual).
// Reads the GitHub "latest release" API, finds the new web bundle, and (on a real device)
// downloads + applies it, then reloads. In a plain browser it stays inert.
//
// SET THIS after you create your GitHub repo (see DISTRIBUTION.md):
//   https://api.github.com/repos/<OWNER>/<REPO>/releases/latest
(function () {
  var UPDATE_FEED = "https://api.github.com/repos/rudawathegw-design/fluent-english/releases/latest";
  var K_VER = "fluent.contentVersion";

  var S = function () { return window.FluentStore; };
  var cu = function () {
    return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater) || null;
  };
  var isNative = function () {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  };
  var toast = function (m) { if (window.fluentToast) window.fluentToast(m); };

  async function currentVersion() {
    try { var a = await S().get(K_VER); if (a) return a; } catch (e) {}
    try { var r = await fetch("build.json", { cache: "no-store" }); var j = await r.json(); return j.contentVersion || "1.0.0"; } catch (e) { return "1.0.0"; }
  }

  async function fetchMeta() {
    if (!/^https?:\/\//.test(UPDATE_FEED)) return null; // not configured yet
    var res = await fetch(UPDATE_FEED, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
    if (!res.ok) throw new Error("feed " + res.status);
    var rel = await res.json();
    var version = String(rel.tag_name || "").replace(/^v/, "");
    var assets = rel.assets || [];
    var zip = assets.find(function (a) { return /^fluent-www-.*\.zip$/i.test(a.name); }) ||
              assets.find(function (a) { return /\.zip$/i.test(a.name); });
    if (!version || !zip) return null;
    var m = /sha256:\s*([0-9a-f]{64})/i.exec(rel.body || "");
    var notes = (rel.body || "").split(/sha256:/i)[0].trim();
    return { version: version, url: zip.browser_download_url, sha256: m ? m[1].toLowerCase() : null, notes: notes };
  }

  async function check(opts) {
    opts = opts || {};
    if (!isNative()) { if (opts.manual) toast("Updates run inside the installed app"); return; }
    var CU = cu();
    if (!CU) { if (opts.manual) toast("Updater unavailable"); return; }
    try {
      if (opts.manual) toast("Checking for updates…");
      var meta = await fetchMeta();
      var cur = await currentVersion();
      if (!meta || !window.UpdateCore.pickUpdate(meta, cur)) {
        if (opts.manual) toast("You're on the latest version");
        return;
      }
      toast("Downloading update " + meta.version + "…");
      var bundle;
      try {
        bundle = await CU.download({ url: meta.url, version: meta.version, checksum: meta.sha256 || undefined });
      } catch (e) {
        // some plugin versions expect a different checksum format — retry relying on HTTPS transport
        bundle = await CU.download({ url: meta.url, version: meta.version });
      }
      await CU.set(bundle);
      await S().set(K_VER, meta.version);
      window.FLUENT_VERSION = meta.version;
      toast("Update ready — restarting…");
      setTimeout(function () { try { CU.reload(); } catch (e) { location.reload(); } }, 700);
    } catch (e) {
      console.error("[updater]", e);
      if (opts.manual) toast("Update check failed");
    }
  }

  async function init() {
    var CU = cu();
    if (CU) { try { await CU.notifyAppReady(); } catch (e) {} } // tell capgo the bundle booted OK (prevents rollback)
    var v = await currentVersion();
    window.FLUENT_VERSION = v;
    var el = document.getElementById("appVer");
    if (el) el.textContent = v;
    setTimeout(function () { check({ manual: false }); }, 1800);
  }

  window.FluentUpdater = { check: check, init: init, currentVersion: currentVersion };
})();
