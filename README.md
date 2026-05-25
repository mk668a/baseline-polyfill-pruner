# baseline-polyfill-pruner

> Remove polyfills and dependencies you no longer need — triggered by Web Platform **Baseline** data, not by guesswork.

**Status: 🚧 early skeleton.** The CLI runs and the core Baseline rule is implemented and tested, but end-to-end candidate detection (`--diff` / `--fix`) is not wired up yet. See [Roadmap](#roadmap).

## The problem

A polyfill is often *"needed when added, dead weight forever after."* Once the
web feature it shimmed ships everywhere, nothing actively tells you to delete
the dependency — so `@oddbird/css-anchor-positioning`, `@ungap/structured-clone`,
`array.prototype.flat`, and friends quietly live on in your bundle for years.

Renovate bumps their versions. Linters flag *some* of them. Neither says:
**"this whole dependency is safe to remove now."**

## The idea

The [`web-features`](https://github.com/web-platform-dx/web-features) dataset
records, for every web feature, its Baseline **Newly available** date
(`status.baseline_low_date`). A feature is considered Baseline **Widely
available** 30 months later. So:

```
baseline_low_date + 30 months <= today  →  Widely available  →  polyfill is a removal candidate
```

`baseline-polyfill-pruner` turns that date arithmetic into an actionable
removal: a `--diff` report today, and (planned) a one-shot `--fix` / Renovate
preset that opens the PR for you.

## Install

```sh
# not published yet — local dev only for now
npm install
npm run build
```

## Usage (planned)

```sh
npx baseline-prune --diff          # show removable polyfills
npx baseline-prune --fix           # remove them from package.json + imports
npx baseline-prune --cwd ./app     # target a specific project root
```

Today `--diff` / `--fix` print a "not implemented yet" notice; `--help` and
`--version` work.

## How it works

| Step | What happens |
|------|--------------|
| 1 | Read the target project's `package.json` dependencies |
| 2 | Match known polyfill packages against `web-features` ids (`POLYFILL_REGISTRY`) |
| 3 | Look up each feature's `status.baseline_low_date` |
| 4 | Keep it as a candidate when `isWidelyAvailable(baseline_low_date)` |
| 5 | `--fix` edits `package.json` and import sites (planned) |

The Baseline rule itself lives in [`src/baseline.ts`](src/baseline.ts) and is
covered by [`test/baseline.test.js`](test/baseline.test.js).

## Roadmap

- [x] Baseline "Widely available" rule (`isWidelyAvailable`) + tests
- [x] CLI argument parsing / output framing
- [ ] `web-features` lookup + `package.json` scan (`findPruneCandidates`)
- [ ] `--fix`: edit `package.json` and remove import sites
- [ ] Grow `POLYFILL_REGISTRY` (or derive from `module-replacements` metadata)
- [ ] Renovate preset / auto-PR mode

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
