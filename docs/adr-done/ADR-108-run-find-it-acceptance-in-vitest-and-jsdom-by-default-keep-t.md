# ADR-108: Run find-it acceptance in Vitest and jsdom by default; keep the browser script as a flag

- Status: Implemented
- Date: 2026-10-27
- Implemented: 2026-10-27
- Depends on: ADR-015, ADR-066
- Design: n/a
- Backlog: N106
- Agreed: 2026-10-27 "Move to B as default, keep the priginal as a flag to be abke to tevert; Layout/CSS ADRs → browser; Yes, browser; No, keep as browser set; jsdom unless layout/3D"

## Context

User, 2026-10-27: "Find it seems expensive, Alternatives?", then, after four options (A generic browser runner,
B Vitest + jsdom + Testing Library, C accessibility snapshots, D light by default): "Move to B as default, keep
the priginal as a flag to be abke to tevert".

Today R3 (`CLAUDE.md`, [ADR-050](../adr-done/ADR-050-adopt-the-reserv-adr-layout-claude-skills-and-ci-conventions.md),
[ADR-066](../adr-done/ADR-066-light-acceptance-an-adr-may-ship-without-a-find-it-test-caug.md)) means one
hand-written Playwright script per visible ADR (`tools/*/find-it.mjs`, 42 scripts, ~9,700 lines), each run against
`pnpm build` + `pnpm preview` + Chromium, outside CI. [ADR-015](../adr-done/ADR-015-verification-pure-core-unit-tests-plus-seeded-fuzz-invariant.md)
says "no committed browser suite until the user asks for one"; jsdom tests are not a browser suite, and the user
asked for them here. ADR-015 and ADR-066 stay as they are; this ADR changes only R3's default.

## Decision

- **Default find-it = jsdom.** A visible ADR proves R3 with `tests/find-it/<area>.test.tsx`: Vitest with
  `// @vitest-environment jsdom`, renders `<App />` from the bare state (empty fake IndexedDB), finds features
  only by role and visible text (`@testing-library/react`, `@testing-library/user-event`), and runs at two widths
  by setting `window.innerWidth` and a `matchMedia` stub (phone 390, desktop 1280). It runs in `pnpm test`, so CI
  runs it on every push. No build, preview or Chromium.
- **Flag to revert:** ADR header `- Acceptance: browser` keeps today's rule: a `tools/<area>/find-it.mjs` script on
  the production build in Chromium. `- Acceptance: light` stays as in ADR-066. Omitted or `full` = jsdom.
- **Revert everything:** one line in `CLAUDE.md` R3 names the default; changing it back to `browser` restores the
  old rule for all new ADRs. The 42 existing scripts and the Playwright link step stay untouched.
- **Which mode:** an ADR that changes layout or CSS, or touches the 3D view or Move mode, sets `- Acceptance: browser`. Any other visible ADR uses jsdom; in jsdom the lazy viewer (ADR-014) is mocked.
- Dev dependencies: `jsdom`, `@testing-library/react`, `@testing-library/user-event` (all MIT, no telemetry).
  Nothing ships to the app.

## Alternatives considered

- **A. One generic Playwright runner + step lists** — keeps a real browser, but every run still needs build,
  preview and Chromium; the user picked B.
- **C. Accessibility snapshots** — shows what is on screen, not how to reach it.
- **D. Light by default** — finds problems late; pending rows pile up.
- **happy-dom instead of jsdom** — faster, but less complete DOM; jsdom is what Testing Library documents.

## Scope

- In scope: dev dependencies; Vitest config accepts `tests/**/*.test.tsx` with per-file jsdom; a shared helper
  `tests/find-it/setup.tsx` (render the bare app at a width, viewer mock); one example test porting an existing
  find-it (count-stepper, drawing card only); `- Acceptance: browser` in `scripts/check-docs.py`, the template,
  `CLAUDE.md` R3 and the skills that mention find-it (`new-adr`, `next-adr`, `implement-design`, `add-tests`,
  `verify`, `review`, `ship-adr`, `debug`).
- Out of scope: 3D view and Move mode in jsdom (G-131); porting the 42 existing scripts (G-132); off-centre
  taps on the drawing, which jsdom tests through the keyboard route (G-135).

## Consequences

- Positive: find-it runs in CI; no build or browser per ADR; tests are shorter (no waits, no screenshots).
- Negative / risks: jsdom applies no CSS, so layout (no side scroll at 390 px, sizes, overlap, CSS-only
  phone/desktop differences) is not checked by default (G-130); 3D is not checked (G-131). Code that branches
  on `matchMedia` is checked; code that differs only by `@media` CSS is not.
- Harder to change later: nothing; the flag restores the old rule.

## Done when

- [x] `pnpm test` runs `tests/find-it/count-stepper.test.tsx` from the bare app at 390 and 1280 px and finds
      "Quick counts" by visible text; it fails when that card is removed (shown once, then restored).
- [x] CI `verify` passes with the new tests on the PR head.
- [x] `scripts/check-docs.py` accepts `- Acceptance: light|full|browser` and rejects anything else.
- [x] `CLAUDE.md` R3, `docs/adr/_template.md` and the eight skills name jsdom as the default and
      `- Acceptance: browser` as the revert flag.
- [x] `node tools/count-stepper/find-it.mjs` still passes on the production build (the old path still works).

## Answered questions (2026-10-27)

- ADRs that change layout or CSS set `- Acceptance: browser`; others use jsdom (G-130).
- ADRs that touch the 3D view or Move mode set `- Acceptance: browser` (G-131).
- The 42 existing scripts are not ported; they stay the browser regression set (G-132).
- "Catch up acceptance" for light ADRs writes jsdom tests, unless the ADR is layout/CSS or 3D (G-133).
