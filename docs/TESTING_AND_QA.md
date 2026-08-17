# Testing & QA — What's Actually Verified Here

An honest accounting of this project's test coverage, current as of the
state verified below (`npm test`, exit code 0). No formal test framework is
used anywhere in this repo — everything described here is bespoke Node
scripts and manual browser checks. This document exists so that "tests
pass" and "CI is green" mean something specific and checkable, not a vague
assurance.

## TL;DR

- **No test framework.** No Jest, Vitest, Mocha, AVA, tap, or `node:test`. No coverage tool. No linter (no ESLint/Prettier config). Every check is a plain `.mjs` script run with `node`.
- **`npm test` runs in CI on every push/PR and gates the GitHub Pages deploy** (`.github/workflows/ci.yml`). All seven chained scripts can fail the build (`check()` + `process.exit(1)`).
- **Simulation correctness (math/invariants) is well covered** and CI-enforced: rule-kit export/import round-trips exactly, Langton's Ant is deterministic, hex direction ordering is verified, SEO metadata is checked line-by-line.
- **All rendering — 2D canvas, 3D/WebGL, every UI interaction — has zero automated coverage.** It's checked only when a human (or an agent, mid-session, on request) manually starts a server and runs a Playwright script. Nothing re-runs this automatically, ever.

## What CI actually enforces

`npm test` = `verify-seo.mjs && verify-library.mjs && verify-rulekit.mjs && verify-share-card.mjs && verify-langtons-ant.mjs && verify-presets.mjs && verify-favorites.mjs && regress-presets.mjs`, run on every push and pull request, required to pass before the Pages deploy job runs (`needs: test` in `ci.yml`).

**`verify-seo.mjs`** — checks across `index.html` (reading landing), `explorer.html` (classic 2D), `viewer3d.html`, `langtons-ant.html`: required assets exist and aren't empty, `og-image.png` stays under 300KB, titles/canonicals/JSON-LD/Open Graph/Twitter Card tags are present and correctly formed, title and description lengths stay in SEO-safe ranges, `robots.txt`/`sitemap.xml`/`site.webmanifest` are internally consistent (sitemap includes library, workbench, and explorer). Real assertions via a `check(label, ok)` helper that increments a `failed` counter and calls `process.exit(1)` if anything failed.

**`verify-library.mjs`** — `explorations/library.html` must match `scripts/generate-library.mjs` byte-for-byte (after newline normalize). Every favorite and preset must have a `gifs-v2/{id}.gif` and the card must point at it. Also pins `pageQuery`: `?preset=` wins, leftover `#preset=` still works, `#s=` is not parsed as a query.

**`verify-rulekit.mjs`** — exports a running simulation both with and without canvas state, re-imports it, and asserts: resolved params round-trip exactly; a no-state import starts at generation 0 with a fresh seed; a with-state import restores generation count and all four field arrays (density/energy/momX/momY) to within float tolerance; **stepping the re-imported engine one more generation produces output identical to stepping the original** (the strongest test in the suite — it doesn't just check the data restored, it checks the restored engine *behaves* identically going forward); malformed JSON and size-mismatched state are both rejected with clear errors. Real assertions, exits 1 on failure.

**`verify-langtons-ant.mjs`** — rule-string parsing and validation; **determinism** (two ants given the identical rule stay in exact lockstep — same position, heading, and visited-cell count — after 10,000 steps, which is what you'd want from a deterministic cellular automaton and is worth checking explicitly rather than assuming); the "no highway" finding is itself pinned as a regression check (displacement stays under a fixed bound at 50k steps, so if a future engine change accidentally made rule LR start drifting, this would catch it); Coral Echo's invariant that it shares Resonant Bloom's exact resolved parameters (only the seed shape differs) and survives 400 generations without dying or exploding. Real assertions, exits 1 on failure.

**`verify-share-card.mjs`** — assembler, compact formula, 1200×630 SVG contract, HTML escaping, share-text twin, `#s=` encode/decode, and log-spaced growth-strip selection. Real assertions, exits 1 on failure.

**`verify-presets.mjs`** — runs all 14 presets for 700 generations and **fails the build** if any dies or explodes (`aliveCells === 0` or `alive > 92%` at a 200-gen checkpoint).

**`verify-favorites.mjs`** — Pulsating Full is registered as a distinct kit (not stock Resonant Bloom params), its rule-kit JSON round-trips, and every favorite survives 700 generations without dying or exploding.

**`regress-presets.mjs`** — same survival check against the original v1 variants.

## The remaining gap

Preset and variant survival is now CI-enforced. Browser UI is still not.

## What has zero automated coverage

Playwright smokes exist for the classic explorer (`smoke-test.mjs`, `smoke-test-v2.mjs`, `smoke-test-rulekit.mjs`, `smoke-test-shell.mjs`, `smoke-test-coral-echo.mjs`), the 3D viewer, Langton's Ant, plus newer IA pages: `smoke-test-landing.mjs` (seed click, Library/Workbench jumps, `#s=` redirect) and `smoke-explore-workbench.mjs` (library card → crumb, Watch→Steer, mint tape). They need a static server (`npx serve .` reads `serve.json`, which turns off clean URLs so `?preset=` is not stripped).

`smoke-test-landing.mjs` and `smoke-explore-workbench.mjs` call `process.exit(1)` on failure. The older explorer smokes still mostly log errors and exit 0. None of the Playwright scripts run in CI:

- They require a static file server already running on a specific `localhost` port — nothing in CI starts one, and the scripts aren't invoked from `ci.yml` at all.
- Every one of them ends with `console.log('...errors:', errors.length ? errors : 'none')` — a report, not an assertion. A script that logs 5 console errors and one that logs `none` both exit 0.
- Screenshots are written to disk for a human to look at, then manually deleted afterward. There's no visual-regression diffing (no Percy/Chromatic/pixelmatch-against-a-baseline) — a rendering regression would only be caught if a human happens to look at a fresh screenshot and notices something's wrong compared to memory of how it used to look.

**Practical consequence:** the entire visual/interactive surface of this project — hex rendering, energy glow, momentum arrows, particle effects, the 3D scene and its camera controls, every button and slider in both HTML pages, the rule-kit UI flow, the Langton's Ant canvas — is verified only episodically, by hand, when someone (a developer or an agent acting on explicit instruction) decides to run one of these scripts and look at the output. It is not verified on a schedule, on every commit, or automatically in any sense.

## What doesn't exist at all

- **No unit tests in the conventional sense** (no framework, no `describe`/`it`, no isolated per-function test files). The closest equivalents are the `check()`-based scripts above, which test end-to-end behavior (e.g. "does a full round-trip preserve state") rather than individual functions in isolation.
- **No coverage measurement.** There's no way to know what fraction of `src/*.js` is exercised by any of the above without adding a coverage tool.
- **No linting or formatting enforcement.** No ESLint config, no Prettier config, nothing blocking a stylistically inconsistent or lint-flagged commit.
- **No cross-browser testing.** The Playwright scripts use Chromium exclusively (with `--use-gl=swiftshader`-style flags for the WebGL page, since CI-style headless environments have no GPU). Firefox, Safari, and mobile browsers are never exercised.
- **No accessibility testing.** No axe-core or equivalent; keyboard navigation, screen-reader compatibility, and color contrast are unverified.
- **No performance regression tracking.** FPS/perf work (e.g. the energy-glow rendering fix — see git history around `src/render.js`) was diagnosed and fixed ad hoc during a development session using one-off profiling scripts that were deleted afterward. There is no benchmark that runs automatically and would flag a future change that reintroduces a slowdown.
- **No fuzzing or property-based testing.** Rule-kit import validation is checked against exactly two malformed inputs (`verify-rulekit.mjs`); arbitrary malformed/adversarial JSON is not tried.

## Research/generation scripts (not tests, not meant to be)

`sweep.mjs`, `discover.mjs`, `discover-shell.mjs`, `analyze-langtons-ant.mjs`, `render-*.mjs`, `generate-gifs*.mjs`, `capture-readme-ui.mjs`, `render-readme-shots.mjs`, `generate-seo-assets.mjs` — these produce data tables, PNGs, and GIFs for human review during development (parameter sweeps, preset discovery, documentation assets). They have no pass/fail concept and were never meant to; listed here only so they aren't mistaken for missing tests.

## How to interpret a green CI run, honestly

A passing `npm test` / green CI check on this project currently tells you:

1. SEO metadata and required static assets are intact across all three pages.
2. Rule-kit export/import is byte-exact and round-trips a simulation's exact future behavior, not just its snapshot data.
3. Share-card assembly, SVG contract, and `#s=` tokens round-trip; growth-strip picks are log-spaced.
4. Langton's Ant is deterministic, the hex-grid "no highway" finding hasn't regressed, and Coral Echo's defining invariant still holds.
5. All 14 presets, authored favorites (Pulsating Full), and the v1 variants survive 700 generations without dying or exploding.

It does **not** currently tell you whether the landing, workbench, 2D explorer, 3D viewer, or Langton's Ant page still render or function correctly in a browser. Run `scripts/smoke-test-landing.mjs` and `scripts/smoke-explore-workbench.mjs` against a local server for that.

## If closing these gaps becomes a priority

In rough order of effort-to-value:

1. Wire at least one `smoke-test-*.mjs` into CI: start a static server as a CI step, run the script, and make it `process.exit(1)` when `errors.length > 0`. Even one script (e.g. `smoke-test.mjs` for the 2D page) would catch the class of bug this project has actually hit before (a broken import, a runtime exception on load).
2. Add a baseline visual-regression check (screenshot-diff against a committed reference image) for at least the default view of each of the three pages, so rendering regressions stop depending on a human noticing.
3. Everything else in "What doesn't exist at all" is a reasonable next tier, roughly in the order listed there.
