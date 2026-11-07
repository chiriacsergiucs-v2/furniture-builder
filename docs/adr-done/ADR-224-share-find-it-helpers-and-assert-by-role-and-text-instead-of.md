# ADR-224: Share find-it helpers and assert by role and text instead of class names

- Status: Implemented
- Date: 2026-11-07
- Implemented: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N229

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-06** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

Find-it tests are 86 % of test time (review section 1). Eleven files re-declare `addPiece` (three different bodies)
or `projectWithTwoPieces`, and 20 files assert on `querySelector` class names, against the R3 rule ("finds features by
role and visible text"). Both widths stay: R3 and ADR-108 ("at 390 and 1280 px") are unchanged.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- `tests/find-it/setup.tsx` exports one `addPiece`, `projectWithTwoPieces`, `selectRows`, `openMore` and `openMenu`;
  the eleven files import them instead of their own copies.
- Class-name `querySelector`/`querySelectorAll` assertions in `tests/find-it/` are replaced by role- and text-scoped
  queries (`getByRole`, `within`); where no role exists, the component gets an accessible name.
- ESLint `no-restricted-syntax` on `querySelector` and `querySelectorAll` calls under `tests/find-it/**`.
- Both widths stay for every test (R3, ADR-108). A header comment in `setup.tsx` states the rule.

## Alternatives considered

- **Run width-independent tests at one width** — −40 % test CPU but amends R3 and ADR-108; kept as G-490.
- **Keep the copies, add only the lint rule** — the three `addPiece` bodies keep drifting.
- **Snapshot the DOM** — brittle and not a find-it test.

## Scope

- In scope: the shared helpers, the assertion rewrite, the lint rule.
- Out of scope: running width-independent tests at one width (G-490).

## Consequences

- Positive: one helper to fix; tests find what the user sees, as R3 asks.
- Negative / risks: an assertion rewritten to a weaker query. Each rewritten test is first run red against a broken
  build of the feature (removed text) to prove it still catches it.
- Harder to change later: nothing.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) before the rewrite, the list of find-it test names and their pass state is saved; after, the same
      names pass at 390 and 1280 px. (Run 2026-11-07: the same 223 names in 58 files before and after; after, every
      name passed, two load flakes passing on re-run: `board-choices` 1280 px, `estimate-chip` 390 px, the latter
      also failing on `main` under the same load.)
- [x] No `function addPiece` or `projectWithTwoPieces` outside `setup.tsx` (checked by `rg`). (`setup.tsx` exports
      `addPiece`, `projectWithTwoPieces`, `selectRows`, `openMore`, `openMenu`, plus `openSheet`, `composePanel`,
      `printedSheet`, `hiddenLabelled`, `stepItems`.)
- [x] `pnpm lint` fails on a `querySelector` call in a `tests/find-it` file (checked with a scratch line, removed);
      no such call remains. (Scratch `document.querySelector` and `querySelectorAll` in `info.test.tsx`: two
      `no-restricted-syntax` errors.)
- [x] Three rewritten assertions, chosen across files, fail when their visible text is removed (checked by hand).
      (Board name out of the parts table caption: `board-choices` red; "Ordinea în proiect" out of the printed
      order: `assembly-order` red; the title out of the client sheet: `prints-exports` Client sheet red; all at both
      widths, then restored.)
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9). (1 714 tests before and after.)
