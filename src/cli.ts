#!/usr/bin/env node
/**
 * baseline-prune — CLI entry point.
 *
 * Usage:
 *   baseline-prune [--diff] [--fix] [--cwd <dir>]
 *
 * Status: skeleton. Argument parsing and output framing are wired; the actual
 * candidate detection lives behind `findPruneCandidates`, which is not yet
 * implemented (prints a clear notice instead of crashing).
 */
import { findPruneCandidates, NotImplementedError } from "./index.js";

const VERSION = "0.0.0";

const HELP = `baseline-prune — remove polyfills/deps that Baseline says you no longer need

Usage:
  baseline-prune [options]

Options:
  --diff        Show removable polyfill dependencies without changing files (default).
  --fix         Apply removals to package.json and import sites.
  --cwd <dir>   Project root containing package.json (default: current directory).
  -v, --version Print version.
  -h, --help    Show this help.

How it works:
  A polyfill becomes a removal candidate once the web feature it shims reaches
  Baseline "Widely available" (its baseline_low_date + 30 months is in the past).
`;

function getFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    console.log(HELP);
    return 0;
  }
  if (args.includes("-v") || args.includes("--version")) {
    console.log(VERSION);
    return 0;
  }

  const apply = args.includes("--fix");
  const cwd = getFlagValue(args, "--cwd") ?? process.cwd();

  try {
    const candidates = await findPruneCandidates({ cwd });
    if (candidates.length === 0) {
      console.log("✓ No removable polyfills found — your dependencies look lean.");
      return 0;
    }
    for (const candidate of candidates) {
      const verb = apply ? "REMOVE     " : "would remove";
      console.log(`${verb}  ${candidate.packageName}  — ${candidate.reason}`);
    }
    return 0;
  } catch (error) {
    if (error instanceof NotImplementedError) {
      console.error(
        "🚧  baseline-prune is an early skeleton: candidate detection is not implemented yet.",
      );
      return 0;
    }
    throw error;
  }
}

main(process.argv)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
