# ADR-282: Staggered rows from three span widths

- Status: Implemented
- Date: 2026-11-21
- Depends on: ADR-011, ADR-205
- Design: n/a
- Backlog: N365

## Context

The user (2026-11-21) wants "a cabinet with a few shelves which are connected between each other with dividers, and
they go at random distances", with the possibility to "configure each span or set a rule for all the shelves to have
three types of spans and be able to randomize them". Reference: a white bookcase of 3 rows and 6 compartments, one
divider per row at about 1/3, 3/5 and 1/3 of the width. A stacked split with a side-by-side split per row and fixed
sizes could already draw this (F03), but by hand only.

Answers (2026-11-21): the three types are widths in mm, starting at 20, 28 and 36 cm; the dividers per row are
variable; neighbouring rows are forced to stagger; the extending and L-corner carcass of the reference is out
(G-575); the rule is saved in the design with a schemaVersion bump; rows rarely fill exactly from three widths, so
"one span per row absorbs it".

## Decision

- `SplitSpace.stagger?: StaggerRule` on stacked splits only (`src/core/types.ts`, design schemaVersion 10):
  `widths: [Mm, Mm, Mm]`, `seed` (the last Randomize) and `kept` (rows, top = 0, the user set by hand).
  Versions 1 to 9 still load; `stagger` in a version below 10 is refused.
- `src/core/stagger.ts`: a seeded generator (mulberry32) fills each row with spans from the three widths plus one
  span that takes the rest, placed at a random position, within the smallest and largest width. Spans and dividers
  fill the inside exactly (integer mm, ADR-003). Up to 200 tries per row look for a row whose dividers do not
  overlap any divider of the row above (or a kept row below); two dividers line up when their faces overlap.
- The rows are written into the design, not generated in memory: `refreshStagger` runs in the store's commit, so a
  piece's width change rewrites the rows that are not kept, with the same seed. Selection, the size editor, the
  cut list and the 3D view keep working on ordinary splits. Each span keeps its id and contents when the count
  allows; new spans are empty.
- Checks independent of the generator (`staggerDiagnostics`, from the saved rows and the built model): a row not
  kept that is not the three widths plus one span within their range, or does not fill the inside exactly, is the
  error `stagger-fill` (export blocked, ADR-008); a divider lining up with the row above is the warning
  `stagger-aligned`. Nothing is stretched or clamped silently.
- UI: Divided space › Division of a stacked split: **Stagger the rows**, then **Staggered rows** with **Span width
  1–3**, **Randomize** (new seed), **Row N: set by hand** per row and **Stop staggering** (the rows stay as they are).

## Alternatives considered

- **Generate rows in memory from the rule** — the spans would not exist in the design, so they could not be
  selected, edited or kept by hand.
- **Randomize as a one-off action, nothing saved** — offered; the user picked the saved rule.
- **Strict exact fill or scaling every span** — strict fails at most widths (200/280/360 with 18 mm dividers never
  fill 782 mm); the user picked the absorbing span.

## Scope

- In scope: the rule, Randomize, forced stagger, rows kept by hand, the checks, the editor.
- Out of scope: the extending two-part carcass and the L-shaped corner (G-575); rewriting the rows after a width
  change made at project level (G-576, flagged by `stagger-fill` until the piece is edited).

## Consequences

- Positive: any stacked space of a cabinet, corner or desk unit can be staggered; old designs load unchanged.
- Negative / risks: editing a span of a row that is not kept is overwritten by the rule on the next commit; the
  row has to be kept by hand first.
- Harder to change later: the saved `stagger` shape (schemaVersion 10).

## Done when

- [x] Every row fills the inside exactly with the three widths plus one span within their range (`tests/stagger.test.ts`)
- [x] Neighbouring rows do not line up at 1200 mm and 5 rows (`tests/stagger.test.ts`)
- [x] The same seed gives the same rows; a second refresh changes nothing (`tests/stagger.test.ts`)
- [x] A kept row stays when the width changes; the others are rewritten (`tests/stagger.test.ts`)
- [x] A row the widths cannot fill is the error `stagger-fill`, never a stretched span (`tests/stagger.test.ts`)
- [x] schemaVersion 10 is required for `stagger`; a bad rule is refused; version 9 designs load (`tests/stagger.test.ts`)
- [x] Find-it at 390 and 1280 px: Bookcase › Edit the interior › Stacked › Stagger the rows › Randomize
      (`tests/find-it/staggered-rows.test.tsx`)
- [x] Every new text has its Russian entry (`pnpm typecheck`)
