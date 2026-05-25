import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isWidelyAvailable,
  addMonths,
  WIDELY_AVAILABLE_OFFSET_MONTHS,
} from "../dist/baseline.js";

test("WIDELY_AVAILABLE_OFFSET_MONTHS is 30 months", () => {
  assert.equal(WIDELY_AVAILABLE_OFFSET_MONTHS, 30);
});

test("addMonths advances calendar months (UTC)", () => {
  const result = addMonths(new Date("2023-05-01T00:00:00Z"), 30);
  assert.equal(result.getUTCFullYear(), 2025);
  assert.equal(result.getUTCMonth(), 10); // November (0-indexed)
});

test("isWidelyAvailable: low date + 30mo already passed => true", () => {
  assert.equal(isWidelyAvailable("2022-01-01", new Date("2026-01-01T00:00:00Z")), true);
});

test("isWidelyAvailable: low date + 30mo still in the future => false", () => {
  assert.equal(isWidelyAvailable("2025-01-01", new Date("2026-01-01T00:00:00Z")), false);
});

test("isWidelyAvailable: exactly 30 months => true (boundary)", () => {
  // 2023-07-01 + 30 months === 2026-01-01
  assert.equal(isWidelyAvailable("2023-07-01", new Date("2026-01-01T00:00:00Z")), true);
});

test("isWidelyAvailable accepts a Date as well as a string", () => {
  assert.equal(
    isWidelyAvailable(new Date("2020-01-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z")),
    true,
  );
});

test("isWidelyAvailable throws TypeError on an unparseable date", () => {
  assert.throws(() => isWidelyAvailable("not-a-date", new Date()), TypeError);
});
