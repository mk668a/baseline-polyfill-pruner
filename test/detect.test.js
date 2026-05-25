import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { decide } from "../dist/detect.js";
import { targetsSupport } from "../dist/targets.js";
import { normalizeBaselineDate, getStatus } from "../dist/webFeatures.js";
import { readDeclaredDeps } from "../dist/packageJson.js";
import { findPruneCandidates } from "../dist/index.js";

const NOW = new Date("2026-01-01T00:00:00Z");
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}/`, import.meta.url));

// --- normalizeBaselineDate ---
test("normalizeBaselineDate strips the ≤ range prefix", () => {
  assert.equal(normalizeBaselineDate("≤2020-01-01"), "2020-01-01");
  assert.equal(normalizeBaselineDate("2020-01-01"), "2020-01-01");
  assert.equal(normalizeBaselineDate(undefined), undefined);
});

// --- getStatus (injected dataset) ---
test("getStatus: feature found, moved/missing => undefined", () => {
  const ds = { foo: { kind: "feature", status: { baseline: "high" } }, bar: { kind: "moved" } };
  assert.equal(getStatus("foo", ds)?.baseline, "high");
  assert.equal(getStatus("bar", ds), undefined);
  assert.equal(getStatus("missing", ds), undefined);
});

// --- decide ---
test("decide: baseline high => removable, reason names the date", () => {
  const v = decide("array-flat", { baseline: "high", baseline_high_date: "2023-01-01" }, NOW);
  assert.equal(v.removable, true);
  assert.match(v.reason, /Widely available/);
  assert.match(v.reason, /2023-01-01/);
});
test("decide: baseline low => not removable", () => {
  assert.equal(decide("x", { baseline: "low" }, NOW).removable, false);
});
test("decide: non-baseline => not removable", () => {
  assert.equal(decide("x", { baseline: false }, NOW).removable, false);
});
test("decide: absent baseline flag falls back to the 30-month rule (≤ date)", () => {
  const v = decide("x", { baseline: undefined, baseline_low_date: "≤2018-01-01" }, NOW);
  assert.equal(v.removable, true);
});
test("decide: malformed baseline_low_date is skipped, never thrown", () => {
  assert.doesNotThrow(() =>
    decide("x", { baseline: undefined, baseline_low_date: "not-a-date" }, NOW),
  );
  assert.equal(
    decide("x", { baseline: undefined, baseline_low_date: "not-a-date" }, NOW).removable,
    false,
  );
});

// --- targetsSupport ---
const targets = (entries, hadConfig = true) => ({ entries, hadConfig });
test("targetsSupport: target newer than support floor => true", () => {
  assert.equal(
    targetsSupport({ baseline: "high", support: { chrome: "100" } }, targets([{ id: "chrome", version: "120" }])),
    true,
  );
});
test("targetsSupport: target older than support floor => false", () => {
  assert.equal(
    targetsSupport({ baseline: "high", support: { chrome: "125" } }, targets([{ id: "chrome", version: "120" }])),
    false,
  );
});
test("targetsSupport: untracked browser (ie) => false", () => {
  assert.equal(
    targetsSupport({ baseline: "high", support: { chrome: "1" } }, targets([{ id: "ie", version: "11" }])),
    false,
  );
});
test("targetsSupport: browserslist id maps (ios_saf→safari_ios) and range low-end satisfies floor", () => {
  assert.equal(
    targetsSupport({ baseline: "high", support: { safari_ios: "16" } }, targets([{ id: "ios_saf", version: "16.4" }])),
    true,
  );
});
test("targetsSupport: missing support entry for a target => false", () => {
  assert.equal(
    targetsSupport({ baseline: "high", support: { chrome: "1" } }, targets([{ id: "firefox", version: "120" }])),
    false,
  );
});
test("targetsSupport: two-digit minor compares numerically (16.10 > 16.4)", () => {
  // parseFloat would read 16.10 as 16.1 < 16.4 and wrongly mark this unsupported.
  assert.equal(
    targetsSupport({ baseline: "high", support: { safari_ios: "16.4" } }, targets([{ id: "ios_saf", version: "16.10" }])),
    true,
  );
});
test("targetsSupport: empty targets => false (no vacuous truth)", () => {
  assert.equal(targetsSupport({ baseline: "high", support: { chrome: "1" } }, targets([])), false);
});
test("targetsSupport: non-numeric version (Safari TP) => false", () => {
  assert.equal(
    targetsSupport({ baseline: "high", support: { safari: "16" } }, targets([{ id: "safari", version: "TP" }])),
    false,
  );
});

// --- readDeclaredDeps ---
test("readDeclaredDeps collects deps with their field", async () => {
  const { deps } = await readDeclaredDeps(fixture("removable"));
  assert.deepEqual(deps, [{ name: "array.prototype.flat", field: "dependencies" }]);
});
test("readDeclaredDeps gives a friendly error when package.json is missing", async () => {
  await assert.rejects(
    () => readDeclaredDeps(fixture("does-not-exist")),
    /No package\.json found at/,
  );
});

// --- findPruneCandidates (integration, injected dataset) ---
const DATASET = {
  "array-flat": {
    kind: "feature",
    status: {
      baseline: "high",
      baseline_high_date: "2023-01-01",
      support: {
        chrome: "69", chrome_android: "69", edge: "79",
        firefox: "62", firefox_android: "62", safari: "12", safari_ios: "12",
      },
    },
  },
};

test("findPruneCandidates: removable dep with supporting targets is returned", async () => {
  const out = await findPruneCandidates({ cwd: fixture("removable"), now: NOW, dataset: DATASET });
  assert.equal(out.length, 1);
  assert.equal(out[0].packageName, "array.prototype.flat");
  assert.equal(out[0].featureId, "array-flat");
});
test("findPruneCandidates: target-needed (ie 11) suppresses the removal", async () => {
  const out = await findPruneCandidates({ cwd: fixture("target-needed"), now: NOW, dataset: DATASET });
  assert.equal(out.length, 0);
});
test("findPruneCandidates: dep not in the registry is ignored", async () => {
  const out = await findPruneCandidates({ cwd: fixture("unknown-dep"), now: NOW, dataset: DATASET });
  assert.equal(out.length, 0);
});
test("findPruneCandidates: a dep in two fields yields a single candidate", async () => {
  const out = await findPruneCandidates({ cwd: fixture("dup-fields"), now: NOW, dataset: DATASET });
  assert.equal(out.length, 1);
  assert.equal(out[0].packageName, "array.prototype.flat");
});
