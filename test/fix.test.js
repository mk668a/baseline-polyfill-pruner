import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  detectIndent,
  removeDependencies,
  applyFix,
  findImportSites,
} from "../dist/fix.js";

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}/`, import.meta.url));

// --- detectIndent ---
test("detectIndent reads 2-space, 4-space, and tab indentation", () => {
  assert.equal(detectIndent('{\n  "a": 1\n}'), 2);
  assert.equal(detectIndent('{\n    "a": 1\n}'), 4);
  assert.equal(detectIndent('{\n\t"a": 1\n}'), "\t");
  assert.equal(detectIndent("{}"), 2); // no body -> default
});

// --- removeDependencies (pure, format-preserving) ---
test("removeDependencies preserves indentation, key order, and trailing newline", () => {
  const raw = [
    "{",
    '  "name": "demo",',
    '  "dependencies": {',
    '    "keep-me": "^1.0.0",',
    '    "array.prototype.flat": "^1.3.0"',
    "  }",
    "}",
    "",
  ].join("\n");

  const { content, removed, changed } = removeDependencies(raw, ["array.prototype.flat"]);
  assert.deepEqual(removed, ["array.prototype.flat"]);
  assert.equal(changed, true);
  assert.match(content, /"keep-me": "\^1\.0\.0"/);
  assert.doesNotMatch(content, /array\.prototype\.flat/);
  assert.ok(content.startsWith('{\n  "name": "demo"'), "indentation preserved");
  assert.ok(content.endsWith("}\n"), "trailing newline preserved");
});

test("removeDependencies removes a name from every dependency field", () => {
  const raw = JSON.stringify(
    {
      dependencies: { "array.prototype.flat": "^1.3.0" },
      devDependencies: { "array.prototype.flat": "^1.3.0", typescript: "^5" },
    },
    null,
    2,
  );
  const { content, removed } = removeDependencies(raw, ["array.prototype.flat"]);
  assert.deepEqual(removed, ["array.prototype.flat"]);
  const parsed = JSON.parse(content);
  assert.equal(parsed.dependencies["array.prototype.flat"], undefined);
  assert.equal(parsed.devDependencies["array.prototype.flat"], undefined);
  assert.equal(parsed.devDependencies.typescript, "^5"); // unrelated dep untouched
});

test("removeDependencies is a no-op when the name is absent", () => {
  const raw = '{\n  "dependencies": {\n    "keep-me": "^1.0.0"\n  }\n}\n';
  const { content, changed, removed } = removeDependencies(raw, ["not-here"]);
  assert.equal(changed, false);
  assert.deepEqual(removed, []);
  assert.equal(content, JSON.stringify(JSON.parse(raw), null, 2) + "\n");
});

// --- applyFix (filesystem round-trip) ---
test("applyFix writes the updated manifest back to disk", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bpp-fix-"));
  try {
    await writeFile(
      join(dir, "package.json"),
      '{\n  "name": "tmp",\n  "dependencies": {\n    "array.prototype.flat": "^1.3.0"\n  }\n}\n',
    );
    const result = await applyFix(dir, ["array.prototype.flat"]);
    assert.deepEqual(result.removed, ["array.prototype.flat"]);
    const after = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    assert.equal(after.dependencies["array.prototype.flat"], undefined);
    assert.equal(after.name, "tmp");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// --- findImportSites ---
test("findImportSites finds import, require, and dynamic-import sites", async () => {
  const sites = await findImportSites(fixture("with-imports"), [
    "array.prototype.flat",
    "left-pad",
  ]);
  const flatSites = sites.filter((s) => s.packageName === "array.prototype.flat");
  const padSites = sites.filter((s) => s.packageName === "left-pad");
  assert.ok(flatSites.length >= 2, "static + dynamic import of array.prototype.flat");
  assert.equal(padSites.length, 1, "require of left-pad");
  assert.ok(sites.every((s) => s.file === "src/app.jsx"), "paths are relative to cwd");
});

test("findImportSites returns nothing for an unused package", async () => {
  const sites = await findImportSites(fixture("with-imports"), ["not-imported-anywhere"]);
  assert.deepEqual(sites, []);
});

test("findImportSites returns [] when given no package names", async () => {
  assert.deepEqual(await findImportSites(fixture("with-imports"), []), []);
});
