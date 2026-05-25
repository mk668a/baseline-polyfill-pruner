/**
 * The correctness gate: resolve the consumer project's `browserslist` targets
 * and decide whether those targets still need a given feature.
 *
 * Conservative by design — per the PRD, "when in doubt, don't remove." Any
 * target we can't positively prove supports the feature blocks the removal.
 */
import browserslist from "browserslist";

import type { FeatureStatus, SupportKey } from "./webFeatures.js";

/** Map browserslist (caniuse) browser ids → `web-features` support keys. */
const BROWSERSLIST_TO_SUPPORT: Record<string, SupportKey> = {
  chrome: "chrome",
  and_chr: "chrome_android",
  edge: "edge",
  firefox: "firefox",
  and_ff: "firefox_android",
  safari: "safari",
  ios_saf: "safari_ios",
};

export interface ResolvedTargets {
  /** `version` is the low end of the target range, kept as a raw string
   *  (e.g. `"16.4"`); `null` when browserslist emitted no parseable version. */
  entries: Array<{ id: string; version: string | null }>;
  /** Whether an actual browserslist config was found (vs. defaults). */
  hadConfig: boolean;
}

/** Parse a browserslist line like `"ios_saf 16.4-16.5"` → `{id, version}`. */
function parseEntry(line: string): { id: string; version: string | null } {
  const [id = "", ver = ""] = line.split(" ");
  const low = ver.split("-")[0] ?? "";
  return { id: id.toLowerCase(), version: low === "" ? null : low };
}

/**
 * Compare two dotted version strings segment-by-segment (numeric).
 * Returns <0 / 0 / >0 like a comparator, or `NaN` if either side has a
 * non-numeric segment (e.g. Safari `"TP"`, `"all"`) — callers treat NaN as
 * "cannot prove support" and keep the polyfill.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".");
  const pb = b.split(".");
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = Number.parseInt(pa[i] ?? "0", 10);
    const y = Number.parseInt(pb[i] ?? "0", 10);
    if (Number.isNaN(x) || Number.isNaN(y)) return Number.NaN;
    if (x !== y) return x - y;
  }
  return 0;
}

/** Resolve the project's browserslist targets from config at `cwd`. */
export function resolveTargets(cwd: string): ResolvedTargets {
  let hadConfig = false;
  try {
    hadConfig = Boolean(browserslist.findConfig(cwd));
  } catch {
    hadConfig = false;
  }

  let entries: ResolvedTargets["entries"] = [];
  try {
    entries = browserslist(undefined, { path: cwd }).map(parseEntry);
  } catch {
    entries = [];
  }

  return { entries, hadConfig };
}

/**
 * True only when EVERY declared target is known to support the feature.
 * Anything unprovable (untracked browser, missing support entry, unparseable
 * version, or a target older than the support floor) returns `false`.
 */
export function targetsSupport(status: FeatureStatus, targets: ResolvedTargets): boolean {
  if (!status.support) return false;
  // No resolvable targets (e.g. a config that errored or matched nothing) is not
  // proof of support — vacuous truth here would green-light an unsafe removal.
  if (targets.entries.length === 0) return false;

  for (const target of targets.entries) {
    const key = BROWSERSLIST_TO_SUPPORT[target.id];
    if (!key) return false; // untracked browser (ie, op_mini, samsung…) → keep polyfill
    const min = status.support[key];
    if (!min) return false; // feature unsupported in a targeted browser → keep
    if (target.version === null) return false; // no version → conservative
    // `web-features` may prefix a support floor with "≤" (supported at-or-before
    // this version, exact unknown); requiring target ≥ that floor stays safe.
    const cmp = compareVersions(target.version, min.replace(/^≤/, ""));
    if (Number.isNaN(cmp) || cmp < 0) return false; // unparseable or below floor → keep
  }
  return true;
}
