# ADR-225: Give every diagnostic a stable code

- Status: Pending
- Date: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N230

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-07** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

`Diagnostic` in `src/core/types.ts` already has a `code: string` field, but it is not a stable id: about 80 literal
codes plus templated ones (`compat-${rule.id}`, `${kind}…`), some shared by different problems, and the type is a
plain `string`. 55 test assertions key on `message` text, and `clearance.ts` keys on English `panel.label` with
regexes (`/^Sliding door/`, `/flap/i`, `/^Lift-up/`, `/^Fixed front/`). ADR-008 (diagnostics), ADR-153 and ADR-156
(translated messages) stand. This changes the model shape, not the document: diagnostics are never persisted, so
there is no `schemaVersion` bump (ADR-011).

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- A `DiagnosticCode` string-literal union in `src/core/diagnosticCodes.ts` lists every code; `Diagnostic.code` is
  typed with it. Each kind of problem has one code; two different problems that share a code today get two.
  Templated codes (`compat-${rule.id}`) stay templated and are typed with a template-literal member
  (`` `compat-${string}` ``).
- `message` is unchanged and still translated in core (ADR-153). Checks and tests that compare `message` text compare
  `code` instead, where a code identifies the problem.
- `clearance.ts` label regexes are replaced by `panel.role` where the role alone decides; where only the label
  distinguishes (sliding, flap, lift-up, fixed front), the regex stays and G-492 records it.

## Alternatives considered

- **`{ code, params }` translated at the edge** — removes i18n from the model, but amends ADR-008 and ADR-153 and is
  ≈ +70 % work; kept as G-491.
- **A `kind` field on `Panel` for every label** — a model-shape change for one module; kept in G-492.
- **Leave codes as free strings** — tests keep keying on translated text.

## Scope

- In scope: `DiagnosticCode`, unique codes, tests keyed on code, role-based clearance where possible.
- Out of scope: translating at the edge and a model package (G-491); a panel kind field for the label-only cases
  (G-492).

## Consequences

- Positive: renaming a message no longer breaks a check or a test; a typo in a code is a type error.
- Negative / risks: a changed code that something keyed on (only `code` comparisons inside `src`, all checked).
- Harder to change later: codes become an API for tests; renaming one is a deliberate change.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [ ] (test first) golden: every diagnostic (`severity`, `code`, `message` in English and Russian) from the catalog
      variants and the sample projects written on `main`; after, identical except codes split on purpose (listed).
- [ ] (test first) a test asserts every emitted code is in `DiagnosticCode` and no two different messages share one.
- [ ] `tsc` fails on an unknown code literal (checked with a scratch line, removed).
- [ ] Tests that matched a message now match a code (count before and after in the backlog row).
- [ ] `clearance.ts` results are byte-identical for the catalog variants; each remaining regex cites G-492.
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).
