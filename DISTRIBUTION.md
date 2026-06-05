# Fluent — build, license & update guide

This turns the `Fluent` web app into a self-updating, licensed Android APK **without the Play
Store**. You build in the cloud (GitHub Actions), license users with offline signed keys, and ship
new versions over-the-air (OTA) straight into the installed app.

---

## 0. One-time local setup (already done if you used the assistant)

```bash
npm install                 # installs Capacitor + plugins (Node only)
npm run license:keygen      # creates keys/ and embeds the license PUBLIC key in www/license.js
```

`keys/` holds your PRIVATE keys. It is git-ignored. **Back it up somewhere safe and never commit
it.** If you lose it you can't issue keys that work with the published app (you'd have to ship a new
public key via an OTA update).

---

## 1. Put the project on GitHub

1. Create a new repository (private is fine).
2. Push this folder to it.
3. Edit **`www/updater.js`** → set `UPDATE_FEED` to:
   ```
   https://api.github.com/repos/<OWNER>/<REPO>/releases/latest
   ```
   (replace `<OWNER>/<REPO>`). Commit & push. This is how the app finds new versions.

---

## 2. Create the signing keystore (once)

A stable keystore lets each new APK install over the previous one.

1. GitHub → **Actions** → **generate-keystore** → *Run workflow*.
2. Download the **keystore-bundle** artifact. It contains `secrets.txt` and `keystore.base64.txt`.
3. GitHub → **Settings → Secrets and variables → Actions** → add 4 secrets:
   - `ANDROID_KEYSTORE_BASE64` — the full contents of `keystore.base64.txt`
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS` — from `secrets.txt`
4. **Save `keystore.base64.txt` + the passwords in your own backup.** Losing them means future
   APKs can't upgrade installed ones.

Until these secrets exist, `build` still works but produces a **debug-signed** APK — fine for
testing/sideloading, just not for final distribution.

---

## 3. Cut a release (build the APK + OTA bundle)

```bash
git tag v1.0.0
git push origin v1.0.0
```

The `build` workflow then:
- builds & signs `fluent-1.0.0.apk`,
- builds the OTA bundle `fluent-www-1.0.0.zip` (+ `version.json` with its SHA-256),
- publishes all three to a **GitHub Release**.

Send people the `.apk` to install the first time (they must allow "Install unknown apps" once).

### Shipping an update later
Change anything under `www/`, bump the tag, push:
```bash
git tag v1.0.1
git push origin v1.0.1
```
Installed apps poll the latest release on launch, download the new bundle, verify it, and reload —
**no reinstall, no Play Store.** Ship a fresh APK only when native code/permissions change.

---

## 4. Issue license keys

```bash
# any device, never expires
node tools/issue-license.js "Ahmed Ali" ahmed@example.com

# locked to one device (device ID is shown on the app's activation screen)
node tools/issue-license.js "Ahmed Ali" ahmed@example.com web-3f9 a1b2c3...

# time-limited (e.g. 365 days)
node tools/issue-license.js "Ahmed Ali" ahmed@example.com "" 365
```

It prints a `FLUENT-…` key. The user pastes it into the app's activation screen. Verification is
fully offline. There's a built-in **7-day free trial** (change `TRIAL_DAYS` in `www/license.js`;
set `0` for a hard gate).

**Notes & limits**
- Offline keys can't be remotely revoked — use expiry (`days`) and device-binding to control reach.
- Trial resets on reinstall (it's device-local). Device-bound keys are the real control.
- To rotate keys: run `license:keygen` again and ship the new `www/license.js` as an OTA update.

---

## 5. Verify locally before any phone

```bash
npm run test:crypto    # license sign/verify, tamper, expiry, device-binding
node tools/test-update.js   # OTA version-compare + checksum logic
```

Then end-to-end on a device: install the APK → activate with an issued key → push a new tag → watch
the app update itself with your saved words/streak intact.

---

## File map
| Path | Purpose |
|---|---|
| `www/` | the app (this is what updates over the air) |
| `www/license.js` | offline license gate (embedded public key, trial) |
| `www/updater.js` | OTA updater — **set `UPDATE_FEED` here** |
| `tools/keygen.js` / `issue-license.js` | make keys / issue licenses |
| `keys/` | your PRIVATE keys (git-ignored — back up!) |
| `.github/workflows/build.yml` | cloud build + release on tag |
| `.github/workflows/generate-keystore.yml` | one-off signing-key generator |
| `capacitor.config.json` | app id/name + updater config |
