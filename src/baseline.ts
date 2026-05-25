/**
 * Baseline "Widely available" rule — the core trigger of this tool.
 *
 * A web feature reaches Baseline *Widely available* exactly 30 months after
 * its Baseline *Newly available* date (the `status.baseline_low_date` field in
 * the `web-features` dataset). Once a feature is Widely available across the
 * core browser set, the polyfill that used to shim it is, in most cases, dead
 * weight — and therefore a removal candidate.
 *
 * @see https://web.dev/baseline
 * @see https://github.com/web-platform-dx/web-features
 */

/** Months between Baseline "Newly available" and "Widely available". */
export const WIDELY_AVAILABLE_OFFSET_MONTHS = 30;

/**
 * Add `months` calendar months to `date`, returning a new Date.
 * Uses UTC accessors so the result is independent of the host timezone.
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

/**
 * Returns true when a feature whose Baseline low (Newly available) date is
 * `baselineLowDate` has reached *Widely available* as of `now`.
 *
 * @param baselineLowDate ISO 8601 date (`YYYY-MM-DD`) or a Date.
 * @param now Reference "today"; defaults to the current time. Injectable so
 *            callers and tests can run deterministically.
 * @throws TypeError when `baselineLowDate` cannot be parsed.
 */
export function isWidelyAvailable(
  baselineLowDate: string | Date,
  now: Date = new Date(),
): boolean {
  const low =
    typeof baselineLowDate === "string" ? new Date(baselineLowDate) : baselineLowDate;

  if (Number.isNaN(low.getTime())) {
    throw new TypeError(`Invalid baseline low date: ${String(baselineLowDate)}`);
  }

  return addMonths(low, WIDELY_AVAILABLE_OFFSET_MONTHS).getTime() <= now.getTime();
}
