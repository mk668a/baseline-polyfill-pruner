/**
 * baseline-polyfill-pruner — programmatic API.
 *
 * Status: early skeleton. The Baseline rule (`isWidelyAvailable`) is real and
 * tested; the end-to-end candidate search (`findPruneCandidates`) is stubbed
 * and throws {@link NotImplementedError} until the `web-features` + package.json
 * wiring lands in the MVP.
 */

export {
  isWidelyAvailable,
  addMonths,
  WIDELY_AVAILABLE_OFFSET_MONTHS,
} from "./baseline.js";

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
}

/** Thrown by APIs that are declared but not implemented in this skeleton. */
export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}

/**
 * Seed registry mapping a polyfill/shim npm package to the `web-features` id
 * it polyfills. Removal is proposed once the mapped feature is Baseline
 * *Widely available*. Intentionally tiny for the skeleton; the MVP grows this
 * (and/or derives it from `module-replacements`-style metadata).
 */
export const POLYFILL_REGISTRY: Readonly<Record<string, string>> = Object.freeze({
  "@oddbird/css-anchor-positioning": "anchor-positioning",
  "@ungap/structured-clone": "structured-clone",
  "array.prototype.flat": "array-flat",
  "object.hasown": "object-hasown",
});

/**
 * Scan a project's package.json and return polyfill dependencies that Baseline
 * reports as Widely available (and therefore removable).
 *
 * @throws {@link NotImplementedError} — not implemented in the skeleton.
 */
export async function findPruneCandidates(
  _options: PruneOptions = {},
): Promise<PruneCandidate[]> {
  // TODO(mvp):
  //   1. Read <cwd>/package.json → collect dependencies + devDependencies.
  //   2. For each dep present in POLYFILL_REGISTRY, look up the feature in the
  //      `web-features` dataset and read `status.baseline_low_date`.
  //   3. Keep it when isWidelyAvailable(baseline_low_date, options.now).
  //   4. Return the candidates; `--fix` then edits package.json + import sites.
  throw new NotImplementedError(
    "findPruneCandidates is not implemented yet (skeleton)",
  );
}
