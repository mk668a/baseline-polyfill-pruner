#!/usr/bin/env node
/**
 * Turn a `baseline-prune --json` report into a pull-request body.
 *
 * Usage:  node scripts/pr-body.mjs <report.json>
 *
 * Reads the JSON report (candidates + import sites) and appends three outputs
 * to `$GITHUB_OUTPUT` for the composite Action to consume:
 *   - count:  number of removable packages (0 means "open no PR")
 *   - title:  the PR title
 *   - body:   the PR body (multiline)
 *
 * When `$GITHUB_OUTPUT` is unset (local runs) the body is printed to stdout.
 */
import { readFileSync, appendFileSync } from "node:fs";

const reportPath = process.argv[2];
if (!reportPath) {
  console.error("usage: pr-body.mjs <report.json>");
  process.exit(2);
}

/** @type {{candidates?: Array<object>, importSites?: Array<object>}} */
let report = { candidates: [], importSites: [] };
try {
  report = JSON.parse(readFileSync(reportPath, "utf8"));
} catch {
  // No report / unparseable → behave as "nothing to do" rather than fail the run.
}

const candidates = Array.isArray(report.candidates) ? report.candidates : [];
const importSites = Array.isArray(report.importSites) ? report.importSites : [];
const count = candidates.length;

const plural = count === 1 ? "polyfill" : "polyfills";
const title = `Drop ${count} ${plural} Baseline reports as widely available`;

const rows = candidates
  .map((c) => `| \`${c.packageName}\` | \`${c.featureId}\` | ${c.reason} |`)
  .join("\n");

let importSection;
if (importSites.length === 0) {
  importSection =
    "No remaining import sites were detected. Once CI is green this should be safe to merge.";
} else {
  const items = importSites
    .map((s) => `- [ ] \`${s.file}:${s.line}\` — \`${s.packageName}\``)
    .join("\n");
  importSection = [
    "This PR removes the dependencies from `package.json` only — it does **not**",
    "rewrite source. Remove these import sites and run your build before merging:",
    "",
    items,
  ].join("\n");
}

const body = [
  `## 🧹 Baseline says you can drop ${count} ${plural}`,
  "",
  "Each dependency below shims a web feature that is now **Baseline Widely",
  "available** and supported by this project's `browserslist` targets, so the",
  "polyfill is dead weight.",
  "",
  "| Package | Feature | Why |",
  "| --- | --- | --- |",
  rows,
  "",
  "### Import sites to clean up",
  "",
  importSection,
  "",
  "---",
  "Opened by [baseline-polyfill-pruner](https://github.com/mk668a/baseline-polyfill-pruner).",
].join("\n");

const out = process.env.GITHUB_OUTPUT;
if (out) {
  const delim = `BPP_EOF_${Date.now()}`;
  appendFileSync(out, `count=${count}\n`);
  appendFileSync(out, `title=${title}\n`);
  appendFileSync(out, `body<<${delim}\n${body}\n${delim}\n`);
} else {
  console.log(`count=${count}`);
  console.log(`title=${title}`);
  console.log("--- body ---");
  console.log(body);
}
