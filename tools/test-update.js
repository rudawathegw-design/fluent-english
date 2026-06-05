#!/usr/bin/env node
// Unit-tests the OTA decision logic (version compare, pickUpdate, sha256) without a device.
const path = require("path");
const UC = require(path.join(__dirname, "..", "www", "update-core.js"));

(async () => {
  let pass = 0, fail = 0;
  const t = (n, c) => { if (c) { pass++; console.log("  ✓ " + n); } else { fail++; console.log("  ✗ " + n); } };

  t("1.0.1 > 1.0.0", UC.compareVersions("1.0.1", "1.0.0") === 1);
  t("1.0.0 == 1.0.0", UC.compareVersions("1.0.0", "1.0.0") === 0);
  t("1.10.0 > 1.2.0 (numeric, not lexical)", UC.compareVersions("1.10.0", "1.2.0") === 1);
  t("2.0 > 1.9.9", UC.compareVersions("2.0", "1.9.9") === 1);

  t("pickUpdate: newer wins", !!UC.pickUpdate({ version: "1.1.0", url: "u" }, "1.0.0"));
  t("pickUpdate: same → null", UC.pickUpdate({ version: "1.0.0", url: "u" }, "1.0.0") === null);
  t("pickUpdate: older → null", UC.pickUpdate({ version: "0.9.0", url: "u" }, "1.0.0") === null);
  t("pickUpdate: missing url → null", UC.pickUpdate({ version: "2.0.0" }, "1.0.0") === null);

  const sha = await UC.sha256Hex(new Uint8Array([1, 2, 3]));
  t("sha256([1,2,3]) matches known value",
    sha === "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81");

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})();
