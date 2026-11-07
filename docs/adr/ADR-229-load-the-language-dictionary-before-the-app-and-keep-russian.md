# ADR-229: Load the language dictionary before the app and keep Russian lazy for English

- Status: Pending
- Date: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N234

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-11** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

Verified by the review: 345 module-scope `t()` calls in 44 files run while the static `App` graph evaluates, before
the body of `src/main.tsx`; the Russian dictionary is 391 KB raw of the `index` chunk, loaded for English users too.
`langInit.ts` sets the language first, but a lazy dictionary only works if `App` itself is imported after it. ADR-153
(English by default, Russian on request; a key without a Russian entry fails `pnpm typecheck`) is unchanged.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- `src/main.tsx` reads the chosen language (as `langInit.ts` does), awaits `loadDictionary(lang)` — a dynamic
  `import('./core/i18n/ru')` for Russian, nothing for English — then `await import('./ui/App')` and renders.
- `src/core/i18n/index.ts` imports the Russian dictionary only as `import type` for `Key`, so missing entries still
  fail `pnpm typecheck`; the runtime dictionary is set by `loadDictionary`.
- Switching language in More → Language loads the dictionary before re-rendering (or reloads, as today if it does).
- Tests load the Russian dictionary in their setup where they switch to Russian.
- `tests/bundle-cyrillic.test.ts` reads `dist/assets/index-*.js` and asserts fewer than a budget of Cyrillic bytes
  (skips with a message without `dist`; the CI `build` job runs it).

## Alternatives considered

- **Keep one bundle** — 391 KB for every English user on every load.
- **Split dictionaries per page** — a key-ownership change across 16 areas (ADR-153); larger.
- **Lazy print dictionaries too** — kept as G-496, measured after this one.

## Scope

- In scope: the `main.tsx` boot order, the lazy Russian UI dictionary, the type-only `Key`, the bundle test.
- Out of scope: lazy print dictionaries (G-496).

## Consequences

- Positive: `index` gzip about −80 KB (−11 %, estimate) for English users.
- Negative / risks: an English text captured at module scope while Russian is chosen; the find-it language test and
  a Russian boot test catch it.
- Harder to change later: the boot becomes async; a module that calls `t()` at import time must stay behind `App`.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [ ] (test first) `tests/i18n.test.ts` passes unchanged; removing a Russian entry still fails `pnpm typecheck`.
- [ ] (test first) jsdom find-it `language.test.tsx` at 390 and 1280 px: after More → Language → Russian, Russian
      labels are found by role and text (green before and after).
- [ ] (test first) a boot test with Russian stored renders Russian module-scope labels on first paint.
- [ ] `tests/bundle-cyrillic.test.ts` passes with the budget; `index` gzip before and after in the backlog row.
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).
