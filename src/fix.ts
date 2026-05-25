/**
 * Phase 2 — Safe `--fix`.
 *
 * Removes a dependency from `package.json` while preserving the file's original
 * indentation, key order, and trailing newline, then locates (but never edits)
 * the import sites that still reference the removed package. Per the PRD, we do
 * NOT rewrite import sites automatically: a wrong AST edit breaks builds and
 * burns trust, so `--fix` hands the user a checklist instead.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join, extname, relative, sep } from "node:path";

import type { DependencyField } from "./index.js";

const DEPENDENCY_FIELDS: readonly DependencyField[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

/** A source location that still imports a removed package. */
export interface ImportSite {
  packageName: string;
  /** Path relative to the scanned root. */
  file: string;
  line: number;
}

export interface RemoveResult {
  /** Package names that were actually present and removed. */
  removed: string[];
  /** Whether the manifest text changed. */
  changed: boolean;
  /** The new `package.json` text (write this back yourself, or use `applyFix`). */
  content: string;
}

/**
 * Detect the indentation unit of a JSON document so re-serialization matches
 * the original. Returns a tab string or a space count; defaults to 2 spaces.
 */
export function detectIndent(raw: string): string | number {
  const match = raw.match(/\n([ \t]+)\S/);
  if (!match) return 2;
  const ws = match[1] ?? "";
  if (ws.includes("\t")) return "\t";
  return ws.length || 2;
}

/**
 * Pure transform: remove `names` from every dependency field of a parsed
 * `package.json`, preserving formatting. Does not touch the filesystem.
 */
export function removeDependencies(raw: string, names: readonly string[]): RemoveResult {
  const indent = detectIndent(raw);
  const pkg = JSON.parse(raw) as Record<string, unknown>;

  const removed: string[] = [];
  for (const field of DEPENDENCY_FIELDS) {
    const map = pkg[field];
    if (!map || typeof map !== "object") continue;
    const record = map as Record<string, unknown>;
    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(record, name)) {
        delete record[name];
        if (!removed.includes(name)) removed.push(name);
      }
    }
  }

  const trailingNewline = raw.endsWith("\n") ? "\n" : "";
  const content = JSON.stringify(pkg, null, indent) + trailingNewline;
  return { removed, changed: removed.length > 0, content };
}

/** Read `<cwd>/package.json`, remove `names`, and write it back if changed. */
export async function applyFix(cwd: string, names: readonly string[]): Promise<RemoveResult> {
  const path = join(cwd, "package.json");
  const raw = await readFile(path, "utf8");
  const result = removeDependencies(raw, names);
  if (result.changed) {
    await writeFile(path, result.content, "utf8");
  }
  return result;
}

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".vue",
  ".svelte",
  ".astro",
]);

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "out",
  ".cache",
]);

/** Escape a string for safe inclusion in a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a matcher for `import … from "pkg"`, `require("pkg")`, `import("pkg")`,
 * and bare `import "pkg"` — including subpath imports like `"pkg/sub"`.
 */
function importMatcher(packageName: string): RegExp {
  const pkg = escapeRegExp(packageName);
  return new RegExp(
    `(?:require\\(|import\\(|\\bfrom|\\bimport)\\s*\\(?\\s*['"\`]${pkg}(?:/[^'"\`]*)?['"\`]`,
  );
}

async function* walk(dir: string, root: string): AsyncGenerator<string> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // unreadable directory — skip rather than crash
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      yield* walk(full, root);
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      yield full;
    }
  }
}

/**
 * Scan source files under `cwd` for lines that still import any of
 * `packageNames`. Report-only — the result is a checklist for the user.
 */
export async function findImportSites(
  cwd: string,
  packageNames: readonly string[],
): Promise<ImportSite[]> {
  if (packageNames.length === 0) return [];
  const matchers = packageNames.map((name) => ({ name, re: importMatcher(name) }));
  const sites: ImportSite[] = [];

  for await (const file of walk(cwd, cwd)) {
    let text: string;
    try {
      text = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      for (const { name, re } of matchers) {
        if (re.test(line)) {
          const rel = relative(cwd, file).split(sep).join("/");
          sites.push({ packageName: name, file: rel, line: i + 1 });
        }
      }
    }
  }
  return sites;
}
