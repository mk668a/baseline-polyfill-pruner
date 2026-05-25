/**
 * baseline-polyfill-pruner — programmatic API.
 *
 * `findPruneCandidates` scans a project's package.json, maps known polyfill
 * packages to `web-features` ids, and returns the ones Baseline reports as
 * Widely available — suppressing any the project's own `browserslist` targets
 * still need.
 */
import { readDeclaredDeps } from "./packageJson.js";
import { getStatus, normalizeBaselineDate, type Dataset } from "./webFeatures.js";
import { resolveTargets, targetsSupport } from "./targets.js";
import { decide } from "./detect.js";
import { POLYFILL_REGISTRY } from "./registry.js";

export {
  isWidelyAvailable,
  addMonths,
  WIDELY_AVAILABLE_OFFSET_MONTHS,
} from "./baseline.js";
export { POLYFILL_REGISTRY } from "./registry.js";

/** A dependency field in a consumer's package.json. */
export type DependencyField =
  | "dependencies"
  | "devDependencies"
  | "peerDependencies"
  | "optionalDependencies";

/** A polyfill/shim dependency that Baseline says is now safe to remove. */
export interface PruneCandidate {
  /** npm package name that is a removal candidate. */
  packageName: string;
  /** The `web-features` feature id this package polyfills. */
  featureId: string;
  /** Baseline low (Newly available) date of that feature, ISO `YYYY-MM-DD`. */
  baselineLowDate: string;
  /** Where the dependency is declared in package.json. */
  field: DependencyField;
  /** Human-readable justification for removal. */
  reason: string;
}

export interface PruneOptions {
  /** Project root that contains package.json. Defaults to `process.cwd()`. */
  cwd?: string;
  /** Reference "today"; defaults to now. Injectable for deterministic runs. */
  now?: Date;
  /** Override the `web-features` dataset (injectable for deterministic tests). */
  dataset?: Dataset;
}

/**
 * Scan a project's package.json and return polyfill dependencies that Baseline
 * reports as Widely available — excluding any the project's `browserslist`
 * targets still need.
 */
export async function findPruneCandidates(
  options: PruneOptions = {},
): Promise<PruneCandidate[]> {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();

  const { deps } = await readDeclaredDeps(cwd);
  const targets = resolveTargets(cwd);

  const candidates: PruneCandidate[] = [];
  const seen = new Set<string>();
  for (const { name, field } of deps) {
    // A package can appear in more than one dependency field — report it once.
    if (seen.has(name)) continue;
    const featureId = POLYFILL_REGISTRY[name];
    if (!featureId) continue;
    seen.add(name);

    const status = getStatus(featureId, options.dataset);
    if (!status) continue;

    const verdict = decide(featureId, status, now);
    if (!verdict.removable) continue;

    // Only suppress on an explicit config; with no browserslist config we trust
    // global Baseline "Widely available" alone.
    if (targets.hadConfig && !targetsSupport(status, targets)) continue;

    candidates.push({
      packageName: name,
      featureId,
      baselineLowDate: normalizeBaselineDate(status.baseline_low_date) ?? "",
      field,
      reason: verdict.reason,
    });
  }
  return candidates;
}
