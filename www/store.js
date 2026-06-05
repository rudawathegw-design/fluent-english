// FluentStore — durable key/value used for the license + applied content version.
// Uses Capacitor Preferences on a real device (survives WebView data clears), and
// falls back to localStorage in a plain browser (so it's testable without the app).
// Also provides getDeviceId() and a tiny toast() shared by the gate + updater.
(function () {
  var caps = function () {
    return (window.Capacitor && window.Capacitor.Plugins) || {};
  };

  var FluentStore = {
    async get(key) {
      try { var P = caps().Preferences; if (P) { var r = await P.get({ key: key }); return r && r.value != null ? r.value : null; } } catch (e) {}
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    async set(key, value) {
      try { var P = caps().Preferences; if (P) { await P.set({ key: key, value: String(value) }); return; } } catch (e) {}
      try { localStorage.setItem(key, String(value)); } catch (e) {}
    },
    async remove(key) {
      try { var P = caps().Preferences; if (P) { await P.remove({ key: key }); return; } } catch (e) {}
      try { localStorage.removeItem(key); } catch (e) {}
    }
  };

  async function getDeviceId() {
    try {
      var D = caps().Device;
      if (D) { var r = await D.getId(); return r.identifier || r.uuid || "device"; }
    } catch (e) {}
    // browser / test fallback — stable per browser profile
    var id = null;
    try { id = localStorage.getItem("fluent.deviceId"); } catch (e) {}
    if (!id) {
      id = "web-" + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem("fluent.deviceId", id); } catch (e) {}
    }
    return id;
  }

  function fluentToast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._ft);
    t._ft = setTimeout(function () { t.classList.remove("show"); }, 1900);
  }

  window.FluentStore = FluentStore;
  window.getDeviceId = getDeviceId;
  window.fluentToast = fluentToast;
})();
