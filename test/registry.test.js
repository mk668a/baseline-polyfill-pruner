import { test } from "node:test";
import assert from "node:assert/strict";

import { features } from "web-features";
import { POLYFILL_REGISTRY } from "../dist/index.js";

// CI gate: a typo or a feature id that web-features renamed/removed must fail
// the build here rather than silently mis-flag (or never flag) a user's dep.

test("registry maps at least 25 polyfills", () => {
  assert.ok(
    Object.keys(POLYFILL_REGISTRY).length >= 25,
    `expected >= 25 entries, got ${Object.keys(POLYFILL_REGISTRY).length}`,
  );
});

test("every registry feature id exists in web-features as a real feature", () => {
  const dangling = [];
  for (const [pkg, id] of Object.entries(POLYFILL_REGISTRY)) {
    const entry = features[id];
    if (!entry) {
      dangling.push(`${pkg} -> ${id} (missing)`);
      continue;
    }
    const kind = entry.kind ?? "feature";
    if (kind !== "feature") {
      dangling.push(`${pkg} -> ${id} (kind=${kind})`);
      continue;
    }
    if (!entry.status) {
      dangling.push(`${pkg} -> ${id} (no status)`);
    }
  }
  assert.deepEqual(dangling, [], `dangling registry ids:\n${dangling.join("\n")}`);
});
