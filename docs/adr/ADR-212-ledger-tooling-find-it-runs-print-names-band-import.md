# ADR-212: Ledger tooling, faster find-it runs, print names and band-list import

- Status: Pending
- Date: 2026-11-06
- Depends on: ADR-077, ADR-092, ADR-101, ADR-108, ADR-201, ADR-202
- Design: docs/ui-design.md (§3 Button, Dialog; §4 Materials dialog, Gaps page)
- Backlog: N217

## Context

User (2026-11-06): "Do the same for next 50 gaps with no questions, same split/grouping for batches": having
accepted the first 50 gaps' suggested picks, the user accepted these too, so each pick is the decision.
Requests: G-076 follows from "mark implemented ones" (not a quote); G-100 "Mark + hand to Claude"; G-049 "Configure
the project so everytime something is "not implemented" it is being saved into adrs folder into "Gaps""; G-041
"Import 3D models and model libraries"; G-371 "all of these 4 + Suggestions A(all) and B(all)", then "Stop 193";
G-377 follows from G-370's pick (not a quote); G-381 translate with the print (user 2026-11-05); G-038 "Check the
European standards for ABS, apply them accordingly".

Change control: [ADR-076](../adr-done/ADR-076-import-3d-models-from-the-device-as-display-only-items.md) says
"`ProjectItem` gains an optional `model` (instead of a `design`)". The code keeps models in `Project.models`
(`src/core/project.ts`, project schemaVersion 5); implemented ADRs are not edited, so item 4 records it here.
G-100's pick says "like Research's Import & export", which ADR-110 removed from the Research page; the Gaps page
gets its own. Ship pull requests merge without CI on them (user rule 2026-10-29), so item 1 runs checks locally.

## Decision

1. **ship-adr updates the research record (G-076).** An ADR that builds a research feature names it in an optional
   header `- Research: <feature id>, …` (template and `new-adr` skill). `ship-adr.sh` lists the named ids and stops
   on one not in `src/core/research/ensemble-2026-10-23.features.ts`. The skill step: a built feature is deleted as
   ADR-149/152/184 did (feature row, app status, merged-children references and its Russian `data-research*.ts`
   entries); a partly built one gets this ADR as evidence and a new `missing`; `APP_CHECKED` becomes the ship date.
   Before the ship commit it runs `pnpm typecheck` and the research tests (`tests/research-built-rows.test.ts`,
   `tests/i18n-research*.test.ts`). `scripts/check-docs.py` checks each `Research:` id exists (a `scripts/` test).
2. **Gap marks in a file (G-100).** The Gaps page gets **Export marks** (downloads `gap-marks-<date>.json`:
   `{ kind: 'furniture-builder-gap-marks', version: 1, exportedAt, marks: GapMark[] }`) and **Import marks**. Import
   validates every row with `validateGapMark` (ADR-011) and never throws; per gap the newer `updatedAt` wins; rows
   that are invalid or name a gap not in the ledger are skipped and counted ("Imported N marks, skipped M"). Same
   `gapMarks` table, no Dexie version. The Gaps page is not translated (user 2026-10-29), so no `t()` entries.
3. **G ids on old notes (G-049).** One pass: each backlog gap note and each open question in a pending ADR written
   before ADR-082 gets the matching G id (from `GAPS.md` or `GAPS-archive.md`). Implemented ADRs are not edited, so
   their unlinked open questions get their G ids in their backlog row. A note with no gap gets one (`pnpm gaps add`).
4. **3D models list recorded (G-041).** As built: display-only models live in `Project.models` (`ModelItem[]`,
   project schemaVersion 5), not on `ProjectItem`, so one imported model can be placed many times. No code change.
5. **Cheaper find-it runs (G-371).** Measure each lever alone against today's `pnpm test` (find-it files' summed
   duration from `vitest run --reporter=json`, three runs each): `userEvent.setup({ delay: null })` in
   `tests/find-it/setup.tsx`; find-it as its own Vitest project (`jsdom`, `isolate: false`); a cheaper module reset
   than `vi.resetModules()`. Apply a lever only if it saves at least 5 % and every find-it file passes three
   consecutive full runs. `renderApp` keeps the bare-app start (fresh modules, IndexedDB, URL; ADR-108). Numbers
   go in N217.
6. **Rapier devDependency removed (G-377).** `pnpm remove @dimforge/rapier3d-compat` in the change that deletes
   `tests/rapier-trial.test.ts` (ADR-201, G-370), else as this ADR's first commit; `@types/three`'s 0.12.0 copy stays.
7. **Print names in the parts CSV and shopping title (G-381).** `cutlistCsvRo(rows, pieceNames?)` takes a map from
   stored piece name to `printPieceName(design)` (ADR-202) and swaps the `Piece:` prefix of each label; Output and
   the review pack pass it. A single piece's printed shopping list title uses `printPieceName`; project names and
   renamed pieces print as typed (G-304). No new keys.
8. **Band list import (G-038, part).** Materials dialog → **Import band list (CSV)**, beside the decor list, parsed
   like it (`parseBandList`, `src/core/materials.ts`; never throws). Columns: manufacturer, type, code, decor, name,
   thickness, width, color. Type abs, pvc, pp, melamine, veneer, else `other`; thickness in mm with one decimal,
   stored in tenths (0.4 → 4, ADR-077); width whole mm; decor optional. Only what the file holds is used (ADR-010).
   Stored in a new `bands` table, the next free Dexie version (12 at writing), additive; a new import replaces the
   list (ADR-012). The band editor's **From your band list** shows **Matching bands** first (decor or code equals the
   board's decor code, band at least as wide as the board) beside the board's picture (ADR-048), then **Other bands
   in your list** by closeness to the board colour. A pick fills the existing `EdgeBand` fields (kind, thickness,
   width, code); no design document change. `t()` entries with Russian lines: those four labels, the list summary
   ('Band list: {list}, {n|# band|# bands}.', 'Band list: none.'), 'About the band list', the column hint and
   'The file has a header row but no bands.'. Feature tree line "Band list import" (ADR-158).

## Alternatives considered

- **Update research records in `next-adr`** — the pick names ship-adr; the record should change when work ships.
- **Gap marks in an account** — online sync is excluded from this batch; a file works offline.
- **Band rows inside the decor table** — mixes two lists with different columns and breaks `Decor` readers.

## Scope

- In scope: items 1–8, their tests, skill and docs changes, jsdom find-it for the visible items.
- Out of scope: band tolerances and edgebander settings (G-460).

## Consequences

- Positive: research rows and old notes stay linked; marks move between devices; prints speak one language.
- Negative / risks: ship commits now edit `src/core` when an ADR names a research row; a Dexie version.
- Harder to change later: the `- Research:` header and the gap-marks file shape.

## Done when

- [ ] `ship-adr.sh` and `pnpm docs:check` reject an unknown `Research:` id (scripts tests); skill updated (G-076)
- [ ] Export marks and Import marks round-trip, keep the newer mark and count skipped rows (tests) (G-100)
- [ ] Old backlog gap notes and pending ADR open questions name their G ids; `pnpm docs:check` passes (G-049, G-041)
- [ ] Each find-it lever's measured time is in N217; applied ones pass three consecutive full runs (G-371)
- [ ] `@dimforge/rapier3d-compat` is gone from `package.json`; install, test and build pass (G-377)
- [ ] A catalog piece's parts CSV labels and shopping title follow the print language in ro, ru, en (tests) (G-381)
- [ ] `parseBandList` reads tenths, skips bad rows with problems; old storage rows load after the upgrade (G-038)
- [ ] jsdom find-it at 390 and 1280 px finds Export marks, Import band list (CSV) and Matching bands
