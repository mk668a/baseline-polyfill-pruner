#!/usr/bin/env node
/**
 * baseline-prune — CLI entry point.
 *
 * Usage:
 *   baseline-prune [--diff] [--fix] [--json] [--cwd <dir>]
 *
 * --diff (default) reports removable polyfills without changing files.
 * --fix removes them from package.json (format-preserving) and prints the
 * import sites that still reference them. --json emits a machine-readable,
 * read-only report (used by the GitHub Action to build a PR body).
 */
import { findPruneCandidates, type PruneCandidate } from "./index.js";
import { applyFix, findImportSites } from "./fix.js";

const VERSION = "0.1.0";

const HELP = `baseline-prune — remove polyfills/deps that Baseline says you no longer need

Usage:
  baseline-prune [options]

Options:
  --diff        Show removable polyfill dependencies without changing files (default).
  --fix         Remove them from package.json and list remaining import sites.
  --json        Print a read-only JSON report (candidates + import sites); never writes.
  --cwd <dir>   Project root containing package.json (default: current directory).
  -v, --version Print version.
  -h, --help    Show this help.

How it works:
  A polyfill becomes a removal candidate once the web feature it shims reaches
  Baseline "Widely available" AND your browserslist targets all support it.
`;

function getFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

async function emitJson(cwd: string, candidates: PruneCandidate[]): Promise<void> {
  const importSites = await findImportSites(
    cwd,
    candidates.map((c) => c.packageName),
  );
  const report = { version: VERSION, cwd, candidates, importSites };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

async function runFix(cwd: string, candidates: PruneCandidate[]): Promise<void> {
  const names = candidates.map((c) => c.packageName);
  const result = await applyFix(cwd, names);

  for (const candidate of candidates) {
    console.log(`removed  ${candidate.packageName}  — ${candidate.reason}`);
  }
  console.log(`\n✓ Removed ${result.removed.length} dependenc(ies) from package.json.`);

  const sites = await findImportSites(cwd, names);
  if (sites.length === 0) {
    console.log("✓ No remaining import sites found — you should be done.");
    return;
  }
  console.log(`\n⚠  ${sites.length} import site(s) still reference the removed package(s).`);
  console.log("   Remove these manually, then run your build/tests:");
  for (const site of sites) {
    console.log(`   - ${site.file}:${site.line}  (${site.packageName})`);
  }
}

function printDiff(candidates: PruneCandidate[]): void {
  for (const candidate of candidates) {
    console.log(`would remove  ${candidate.packageName}  — ${candidate.reason}`);
  }
  console.log(`\n✓ ${candidates.length} removable polyfill(s) found.`);
  console.log("   Run with --fix to apply.");
}

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);

  if (args.includes("-h") || args.includes("--help")) {
    console.log(HELP);
    return 0;
  }
  if (args.includes("-v") || args.includes("--version")) {
    console.log(VERSION);
    return 0;
  }

  const cwd = getFlagValue(args, "--cwd") ?? process.cwd();
  const asJson = args.includes("--json");
  const apply = args.includes("--fix");

  const candidates = await findPruneCandidates({ cwd });

  if (asJson) {
    // --json is read-only by contract; it never mutates, even with --fix.
    await emitJson(cwd, candidates);
    return 0;
  }

  if (candidates.length === 0) {
    console.log("✓ No removable polyfills found — your dependencies look lean.");
    return 0;
  }

  if (apply) {
    await runFix(cwd, candidates);
  } else {
    printDiff(candidates);
  }
  return 0;
}

main(process.argv)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`baseline-prune: ${message}`);
    process.exitCode = 1;
  });
