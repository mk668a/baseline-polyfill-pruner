/**
 * Hand-curated map: npm polyfill / shim package → the `web-features` id it
 * shims. A package becomes a removal candidate once its mapped feature is
 * Baseline *Widely available* AND the project's `browserslist` targets support
 * it (see `detect.ts` / `targets.ts`).
 *
 * Quality over quantity: every id here is validated against the live
 * `web-features` dataset by `test/registry.test.js`, so a typo or a removed
 * feature id fails CI instead of silently mis-flagging a user's dependency.
 *
 * Most entries are the `es-shims` ECMAScript ponyfills plus the well-known
 * DOM/CSS polyfills called out in the "polyfills gone rogue" discussion.
 */
export const POLYFILL_REGISTRY: Readonly<Record<string, string>> = Object.freeze({
  // --- ECMAScript Array ponyfills (es-shims) ---
  "array.prototype.flat": "array-flat",
  "array.prototype.flatmap": "array-flat",
  "array-includes": "array-includes",
  "array.prototype.at": "array-at",
  "array.prototype.findlast": "array-findlast",
  "array.prototype.findlastindex": "array-findlast",
  "array.from": "array-from",
  "array.prototype.find": "array-find",
  "array.prototype.fill": "array-fill",
  "array.of": "array-of",

  // --- ECMAScript String ponyfills (es-shims) ---
  "string.prototype.replaceall": "string-replaceall",
  "string.prototype.matchall": "string-matchall",
  "string.prototype.at": "string-at",

  // --- ECMAScript Promise / global ponyfills (es-shims) ---
  "promise.allsettled": "promise-allsettled",
  "promise.any": "promise-any",
  "promise.prototype.finally": "promise-finally",
  globalthis: "globalthis",

  // --- ECMAScript Object ponyfills ---
  "object.hasown": "object-hasown",

  // --- DOM / Web API polyfills ---
  "@ungap/structured-clone": "structured-clone",
  "whatwg-fetch": "fetch",
  "abortcontroller-polyfill": "aborting",
  "intersection-observer": "intersection-observer",
  "resize-observer-polyfill": "resize-observer",
  "focus-visible": "focus-visible",
  "smoothscroll-polyfill": "scroll-behavior",
  "dialog-polyfill": "dialog",
  "web-animations-js": "web-animations",
  "url-polyfill": "url",
  "@webcomponents/shadydom": "shadow-dom",

  // --- CSS polyfills (not yet Widely available — mapped for when they flip) ---
  "@oddbird/css-anchor-positioning": "anchor-positioning",
});
