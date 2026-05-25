/**
 * Reader for a consumer project's `package.json`.
 *
 * Returns the declared dependencies (across all dependency fields) together
 * with the original raw text — Phase 2 (`--fix`) needs the raw string to make
 * format-preserving edits, so we never discard it here.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { DependencyField } from "./index.js";

/** A single declared dependency and the field it was declared in. */
export interface DeclaredDep {
  name: string;
  field: DependencyField;
}

const DEPENDENCY_FIELDS: readonly DependencyField[] = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

/** Read `<cwd>/package.json` and collect its declared dependencies. */
export async function readDeclaredDeps(
  cwd: string,
): Promise<{ raw: string; deps: DeclaredDep[] }> {
  const path = join(cwd, "package.json");

  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`No package.json found at ${path}`);
    }
    throw cause;
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(raw) as Record<string, unknown>;
  } catch (cause) {
    throw new Error(`Failed to parse ${path}: ${(cause as Error).message}`);
  }

  const deps: DeclaredDep[] = [];
  for (const field of DEPENDENCY_FIELDS) {
    const map = pkg[field];
    if (map && typeof map === "object") {
      for (const name of Object.keys(map as Record<string, unknown>)) {
        deps.push({ name, field });
      }
    }
  }
  return { raw, deps };
}
