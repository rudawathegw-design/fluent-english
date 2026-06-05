// Fluent desktop shell (Electron).
// Serves the shared web app (../www) over a secure custom scheme (app://) so ES modules,
// crypto.subtle and localStorage all work exactly as in the browser/Android build.
// Self-updates from GitHub Releases via electron-updater.
const { app, BrowserWindow, protocol, shell } = require("electron");
const path = require("path");
const fs = require("fs");

// In a packaged app the web assets live under resources/www; in dev they're ../www.
const WWW = app.isPackaged
  ? path.join(process.resourcesPath, "www")
  : path.join(__dirname, "..", "www");

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".ico": "image/x-icon", ".map": "application/json"
};

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 820,
    minWidth: 360,
    minHeight: 600,
    backgroundColor: "#F2EBDD",
    title: "Fluent",
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  win.loadURL("app://fluent/index.html");
  // open external links (YouTube, etc.) in the system browser, never inside the shell
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  protocol.handle("app", async (req) => {
    try {
      const u = new URL(req.url);
      let rel = decodeURIComponent(u.pathname).replace(/^\/+/, "");
      if (!rel) rel = "index.html";
      const file = path.normalize(path.join(WWW, rel));
      if (!file.startsWith(WWW)) return new Response("forbidden", { status: 403 });
      const data = await fs.promises.readFile(file);
      const ext = path.extname(file).toLowerCase();
      return new Response(data, { headers: { "content-type": MIME[ext] || "application/octet-stream" } });
    } catch (e) {
      return new Response("not found", { status: 404 });
    }
  });

  createWindow();

  // in-app updates: pulls the new installer from GitHub Releases and installs on quit
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  } catch (e) { /* updater optional in dev */ }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
