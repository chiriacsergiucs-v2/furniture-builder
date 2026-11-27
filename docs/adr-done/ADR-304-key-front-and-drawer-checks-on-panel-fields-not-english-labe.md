# ADR-304: Key front and drawer checks on panel fields, not English labels

- Status: Implemented
- Date: 2026-11-27
- Implemented: 2026-11-27
- Depends on: ADR-011, ADR-225
- Design: n/a
- Backlog: N433

## Context

User, 2026-11-07 (the architecture review): "current code structure/architecture modularity and overall design
analysis ... No regressions shall be introduced, ensure before and after testing tdd style". User, 2026-11-27: "Also do
the medium work" and "Auto-accept if confidence > 85%"; G-492's suggested pick: "Add the role field only where a check
needs it, in a follow-up ADR".

[ADR-225](../adr-done/ADR-225-give-every-diagnostic-a-stable-code.md) replaced `clearance.ts` label regexes by
`panel.role` where the role decides, and kept four (`/^Sliding door/`, `/flap/i`, `/^Lift-up/`, `/^Fixed front/`) plus
the hinge side (`label === 'Door left'`) because only the English label tells those panels apart (G-492). The same
label-as-key tests sit in `assembly.ts` (`/^Drawer (\d+)\b/`, the drawer a box part belongs to), `fusion.ts` (the same,
for the Fusion groups), `rules.ts` (`/^Door/`, a hinged door) and `project.ts` (`/flap/i`, a flap's clearance zone).
`build.ts`, `shape.ts` and `replace.ts`, named by the review, no longer test a label: they only show it in messages.

`Panel` is generated geometry and is never saved (ADR-011), so this changes the model shape, not the design document.

## Decision

Decided by Claude under the user's auto-accept, 2026-11-27.

- `Panel` gets three optional fields, set by the generators in `src/core` only where a check needs them:
  `front?: 'hinged' | 'sliding' | 'flap-up' | 'flap-down' | 'fixed'` (doors and drawer fronts the role does not tell
  apart), `hinge?: 'left' | 'right'` (a door of a pair) and `drawer?: number` (the drawer, from 1 at the top, of a
  drawer box part or front).
- `buildCabinet` sets them through one extra argument of its `add` helper; the diagonal corner door sets
  `front: 'hinged'`. Appliance fronts (`panel.ts`) set none, as their labels matched none of the regexes.
- The checks read the fields: `localClearances` and its hinge side, the assembly's drawer boxes, `fusionGroups`, the
  `door-wide` rule and the project's clearance zone kind. Labels stay as names only.
- No `schemaVersion` bump: nothing saved changes.

## Alternatives considered

- **Extend `PanelRole` (`sliding-door`, `flap`, `fixed-front`)** — every `role === 'door'` reader (cut list groups,
  materials, bands, finishes, assembly steps) would need the new roles; a much wider change for the same checks.
- **A `kind` field naming every part** — the review's first idea; most labels are not keyed on by any check.
- **Keep the regexes** — a renamed label silently changes a check; the model cannot be language-free (G-491).

## Scope

- In scope: the three fields, the generators that set them, the six checks switched, a golden and an oracle test.
- Out of scope: `baseLabel` grouping of identical parts by name (a name, not a check) and translating diagnostics
  at the edge (G-491).

## Consequences

- Positive: renaming or translating a part label no longer changes a clearance, a drawer box, a Fusion group, a rule
  or a zone; the fields are typed.
- Negative / risks: a new generator that makes doors or drawers must set the fields; the oracle test covers every
  catalog variant and template, the fuzz run every random design.
- Harder to change later: the fields become part of the model shape that checks read.

## Done when

- [x] (test first) `tests/panel-front-kind.test.ts` golden, written on the unchanged source: opening clearances with
      the door swing, drawer boxes, Fusion groups, wide doors and project zone kinds for every catalog variant (also
      ×0.25, ×3 and with a fixed top front), every template, every sample and a project of every variant; unchanged
      after the switch. Evidence: written with `WRITE_GOLDEN=1` before any source change, stable across two runs
      (random ids numbered), passing after (2026-11-27).
- [x] (test first) the same file: every panel's `front`, `hinge` and `drawer` say what the old regexes said of its
      label, and every kind of front occurs. Evidence: it failed before the fields existed (a single door's `front`
      was missing) and passes after.
- [x] No panel-label regex is left in `clearance.ts`, `assembly.ts`, `fusion.ts`, `rules.ts` or `project.ts`.
      Evidence: a grep for `.label` with `test(`, `exec(` or `===` in those files finds none.
- [x] `tests/diagnostic-golden.test.ts` (diagnostics and clearance goldens) passes unchanged. Evidence: the related
      run below.
- [x] `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts` passes. Evidence: 9 passed, exit 0.
- [x] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, related tests, `pnpm build` and `pnpm docs:check` pass.
      Evidence: the related run gave 300 files and 2308 tests passed; the other commands exit 0 (N433).
