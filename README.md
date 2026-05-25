# baseline-polyfill-pruner

> Delete the polyfills you no longer need — triggered by Web Platform **Baseline** data, not by guesswork.

A polyfill is often *"needed when added, dead weight forever after."* Once the
web feature it shimmed ships everywhere, nothing tells you to delete the
dependency — so `@oddbird/css-anchor-positioning`, `@ungap/structured-clone`,
`array.prototype.flat`, and friends quietly live on in your `package.json` and
your bundle for years. Renovate bumps their versions. Linters flag *some* of
them. Neither says: **"this whole dependency is safe to remove now."**

`baseline-polyfill-pruner` does. It runs as a CLI or, better, as a **GitHub
Action that opens a PR the moment a polyfill becomes removable.**

## How it works

The [`web-features`](https://github.com/web-platform-dx/web-features) dataset
records each feature's Baseline status. A polyfill becomes a **removal
candidate** when:

1. its mapped feature is Baseline **Widely available** (`status.baseline === "high"`,
   i.e. ~30 months past `baseline_low_date`), **and**
2. your project's own [`browserslist`](https://browsersl.ist) targets *all*
   support that feature.

Step 2 is a hard correctness gate. Baseline "Widely available" is a *global*
statement; if your `browserslist` still targets `ie 11` or an old Safari, the
polyfill is kept. **When in doubt, it does not remove** — a missed removal is
harmless, a wrong one breaks your build.

```
baseline-high(feature)  AND  browserslist-targets-all-support(feature)
        →  polyfill is dead weight  →  removal candidate
```

## Install

```sh
npm install --save-dev baseline-polyfill-pruner
# or run ad-hoc:
npx baseline-polyfill-pruner --diff
```

## CLI usage

```sh
baseline-prune --diff           # report removable polyfills (default, no writes)
baseline-prune --fix            # remove them from package.json + list import sites
baseline-prune --json           # machine-readable report (read-only)
baseline-prune --cwd ./app      # target a specific project root
```

`--diff` (dry run):

```
would remove  array.prototype.flat  — array-flat is Baseline Widely available (since 2022-07-15)

✓ 1 removable polyfill(s) found.
   Run with --fix to apply.
```

`--fix` removes the dependency from `package.json` (preserving your
indentation, key order, and trailing newline) and then prints every import site
that still references it:

```
removed  array.prototype.flat  — array-flat is Baseline Widely available (since 2022-07-15)

✓ Removed 1 dependenc(ies) from package.json.

⚠  2 import site(s) still reference the removed package(s).
   Remove these manually, then run your build/tests:
   - src/list.js:2  (array.prototype.flat)
   - src/list.js:8  (array.prototype.flat)
```

> **`--fix` never rewrites your source.** It edits `package.json` and hands you
> a checklist. Automatic import-site rewriting (AST codemod) is intentionally
> out of scope — a wrong edit breaks builds and burns trust.

## GitHub Action (the point)

The value of this tool is *calendar-driven*: a polyfill becomes removable on
the day Baseline flips, and nobody remembers to re-check. Run it on a schedule
and it opens the PR for you:

```yaml
# .github/workflows/baseline-prune.yml
name: Baseline polyfill prune
on:
  schedule:
    - cron: "0 9 * * 1" # Mondays
  workflow_dispatch: {}
permissions:
  contents: write
  pull-requests: write
jobs:
  prune:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: mk668a/baseline-polyfill-pruner@v1
```

The Action runs the engine, applies `--fix`, and opens a PR titled *"Drop N
polyfills Baseline reports as widely available"* with a rationale table and the
import-site checklist in the body. See
[`examples/workflows/baseline-prune.yml`](examples/workflows/baseline-prune.yml).

## What it maps

A hand-curated, **CI-validated** registry maps ~30 well-known polyfills (the
`es-shims` ECMAScript ponyfills plus DOM/CSS polyfills like
`intersection-observer`, `dialog-polyfill`, `whatwg-fetch`, `@ungap/structured-clone`)
to their `web-features` ids. Every id is checked against the live dataset by
[`test/registry.test.js`](test/registry.test.js), so a renamed or mistyped
feature id fails CI instead of mis-flagging your dependency. Quality over
quantity by design.

## Why not just…

| Tool | What it does | Gap this fills |
|------|--------------|----------------|
| [`eslint-plugin-depend`](https://github.com/es-tooling/eslint-plugin-depend) | Lints for redundant deps | **Lint-only, no autofix, no Baseline** — its [autofix request (#40)](https://github.com/es-tooling/eslint-plugin-depend/issues/40) has been open ~17 months |
| [`module-replacements-codemods`](https://github.com/es-tooling/module-replacements-codemods) | Codemods deps → native | **Doesn't key off Baseline status** |
| Renovate / Dependabot | *Bump* versions | Never say "this whole dep is now removable" |

The combination of a **live Baseline trigger + an automatic removal PR** is the
thing none of them do. (Context: HN's
["Speeding up the JS ecosystem – Polyfills gone rogue"](https://news.ycombinator.com/item?id=37602923).)

## Roadmap

- [x] Baseline "Widely available" rule (`isWidelyAvailable`) + tests
- [x] `package.json` scan + `web-features` lookup (`findPruneCandidates`)
- [x] `browserslist` target-awareness gate (no false positives)
- [x] `--fix`: remove from `package.json`, report import sites
- [x] CI-validated registry (~30 polyfills)
- [x] GitHub Action / auto-PR
- [ ] Auto-derive the registry from `module-replacements` metadata
- [ ] `engines.node`-aware removal for Node-targeted polyfills
- [ ] Monorepo / workspace fan-out
- [ ] Renovate preset

## Development

```sh
npm install
npm run typecheck
npm test        # builds, then runs node --test
```

This project uses **no LLM at runtime** — `web-features` is a static dataset.
AI is used only at development time.

## License

[MIT](LICENSE) © 2026 mk668a
