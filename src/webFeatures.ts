/**
 * Thin adapter over the `web-features` dataset.
 *
 * Exposes a feature's Baseline status by id, guarding the `kind` discriminator
 * (entries can be `moved`/`split` with no `status`) and allowing an injectable
 * dataset so callers/tests stay deterministic and independent of the installed
 * `web-features` version.
 */
import { features as realFeatures } from "web-features";

export type Baseline = "high" | "low" | false;

/** Browser keys used by `web-features` `status.support`. */
export type SupportKey =
  | "chrome"
  | "chrome_android"
  | "edge"
  | "firefox"
  | "firefox_android"
  | "safari"
  | "safari_ios";

export interface FeatureStatus {
  baseline: Baseline;
  /** ISO `YYYY-MM-DD` (Newly available); may be `≤`-prefixed in the dataset. */
  baseline_low_date?: string;
  /** ISO `YYYY-MM-DD` (Widely available); may be absent. */
  baseline_high_date?: string;
  /** Minimum supporting version per browser. */
  support?: Partial<Record<SupportKey, string>>;
}

export type Dataset = Record<string, { kind?: string; status?: FeatureStatus }>;

/** Strip the `web-features` "≤" range prefix so the date can be parsed. */
export function normalizeBaselineDate(date: string | undefined): string | undefined {
  return date ? date.replace(/^≤/, "") : undefined;
}

/**
 * Look up a feature's status by id. Returns `undefined` for unknown ids and for
 * non-`feature` entries (e.g. `kind: "moved"`).
 */
export function getStatus(
  id: string,
  dataset: Dataset = realFeatures as unknown as Dataset,
): FeatureStatus | undefined {
  const entry = dataset[id];
  if (!entry || (entry.kind !== undefined && entry.kind !== "feature")) {
    return undefined;
  }
  return entry.status;
}
