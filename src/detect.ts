/**
 * Removability decision: turn a feature's Baseline status into a verdict.
 *
 * The authoritative signal is `status.baseline === "high"` (Widely available).
 * `isWidelyAvailable` (the tested 30-month rule) is kept only as a defensive
 * fallback for the rare case where the `baseline` flag is absent, and to phrase
 * the human-readable reason.
 */
import { isWidelyAvailable } from "./baseline.js";
import { normalizeBaselineDate, type FeatureStatus } from "./webFeatures.js";

export interface Verdict {
  removable: boolean;
  reason: string;
}

export function decide(featureId: string, status: FeatureStatus, now: Date): Verdict {
  if (status.baseline !== "high") {
    // Defensive fallback: only when the baseline flag is genuinely absent.
    const low = normalizeBaselineDate(status.baseline_low_date);
    let widelyByDate = false;
    if (status.baseline === undefined && low) {
      // A malformed date in the dataset must skip this feature, never crash the run.
      try {
        widelyByDate = isWidelyAvailable(low, now);
      } catch {
        widelyByDate = false;
      }
    }
    if (!widelyByDate) {
      return { removable: false, reason: `${featureId} is not Baseline Widely available yet` };
    }
  }

  const since =
    normalizeBaselineDate(status.baseline_high_date) ??
    normalizeBaselineDate(status.baseline_low_date);
  return {
    removable: true,
    reason: `${featureId} is Baseline Widely available${since ? ` (since ${since})` : ""}`,
  };
}
