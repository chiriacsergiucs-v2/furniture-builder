# Cleanup and dedupe audit, 2026-11-09

User request (2026-11-09): "the codebase grows on a daily basis, i need a analysis and fixes proposed for 'no
regression' code cleanup and dedupe, all related tests or other resources including".

Base: `main` at the merge of PR #208. Measured with scripts kept outside the repo (Python and grep only; no package
was installed or run). The numbers are reproducible with the commands in _Method_.

## Size today

| Area        | Files | Lines  | Note                                                          |
| ----------- | ----- | ------ | ------------------------------------------------------------- |
| src/core    | 153   | 54 537 | `project.ts` 4 522, `cabinet.ts` 1 559, `design.ts` 1 523     |
| src/ui      | 81    | 31 611 | `Project.tsx` 3 421, `Inspector.tsx` 1 949                    |
| src/viewer  | 13    | 5 471  | `Viewer3D.tsx` 2 563                                          |
| src/store   | 29    | 4 522  | `designStore.ts` 2 092                                        |
| styles.css  | 1     | 7 713  |                                                               |
| tests       | 221   | 43 465 | 155 unit/storage files, 65 jsdom find-it files                |
| tools       | 83    | 21 913 | 78 browser find-it scripts, not run by CI                     |
| docs        | 263   | 26 577 | `backlog.md` 708 KB, `GAPS-archive.md` 229 KB, `GAPS.md` 112 KB |

476 commits in the last 14 days.

## Findings and proposed fixes

Each fix lists how "no regression" is proven. Tier 1 changes no behaviour at all; Tier 2 keeps behaviour and is
proven by the tests that already cover it; Tiers 3 and 4 touch test tooling and docs only.

### Tier 1: dead code (mechanical, typecheck + full suite)

1. **Seven exports used nowhere, not even in their own file:** `tableOf` (`src/ui/Account.tsx`),
   `occlusionBias` (`src/viewer/arPlace.ts`), `removeFromAccount` (`src/online/client.ts`), `edgeBandMeters`
   (`src/core/cutlist.ts`), `KIND_OF` (`src/core/sync.ts`), `MAX_COMP_DRAWERS` (`src/core/wizard/steps.ts`),
   `sellerCatalogs` (`src/core/sellers/index.ts`). Fix: delete them.
2. **64 exports used only inside their own file** (for example `SHEET_STOPS`, `LONG_PRESS_MS`, `REMINDER_KEY`,
   `FASTENER_PREFIX`, `mergeEdges`, `argProblem`). Fix: drop the `export` keyword. `ADR-236` did the same for 227
   core symbols; these appeared since.
3. **10 CSS selectors that no code produces:** `.bulk-bar`, `.cluster`, `.dim-text`, `.has-tools`, `.no-more`,
   `.on-home`, `.page-editor`, `.piece-banner`, `.mode-configure` (Configure left in ADR-080) and the rules that
   only style them. Kept on purpose: `room-outlet`/`room-pipe` (built as `room-${kind}`), `impl-*` (built in
   `Research.tsx`). Fix: delete the dead rules.
4. **One Russian entry with no English text left:** `'Your prices, saved on this device.'` in `ru/editors.ts` (the
   text became a longer sentence). Fix: delete it (translation rule: a deleted text deletes its entries). The second
   unmatched key, in `ru/variables.ts`, is built from parts and stays.

### Tier 2: duplicated code (behaviour kept, existing tests prove it)

5. **`RoomFill.tsx` (788 lines) and `WallFill.tsx` (505 lines)** share about 80 ten-line blocks: the step header,
   `MixCard`, `Field`, `Problems`, the issue-to-step mapping and the footer. Fix: one `src/ui/fill/` module with the
   shared parts; both dialogs keep their own form and `toInput`. Proof: `tests/find-it/roomfill.test.tsx`,
   `wall-fill` and `roomfill` unit tests, unchanged.
6. **`src/viewer/heightDrag.ts` and `modelResize.ts`** (129 and 133 lines) are the same preview store and drag hook
   with a different value. Fix: one generic `dragPreview<T>()`; both become a few lines. Proof:
   `tests/model-move-3d.test.ts`, `tests/model-size.test.ts` and the 3D find-it tests.
7. **`Variables.tsx`** repeats its row editor about 29 times as blocks (project variables, piece variables, value
   sets). Fix: one `VariableRow` used three times. Proof: `tests/find-it/piece-variables.test.tsx`,
   `tests/variables*.test.ts`.
8. **Smaller pairs:** `Inspector.tsx` (17 internal blocks), `Elevation.tsx` (12), `Project.tsx` (11),
   `Models3D.tsx`/`Project.tsx` (4), `roles.ts`/`MaterialDialog.tsx` (3), `Dialogs.tsx`/`WallBackground.tsx` (3).
   Fix: only where a shared helper is shorter than the copies; otherwise leave.

### Tier 3: tests and test tools

9. **Find-it test setup repeated in test files:** `common-panel`/`shared-sides` (8 blocks), `piece-safety`/
   `projects-duplicate` (8), `room-suggested-size`/`room-surfaces` (6); `move-to`/`move-to-block` unit tests (6). Fix:
   move the shared steps into `tests/find-it/setup.tsx` (its own rule says so) and a `tests/fixtures` helper.
10. **The 78 browser scripts in `tools/` (21 913 lines) are the biggest duplicate:**
    - Hundreds of copied steps: `model-size`, `models3d`, `piece-safety` and `room-surfaces` share 27 blocks;
      `align-distribute`, `multi-select` and `rotate-pack` share 10.
    - They are not run by CI. 35 of them still use **Build & Preview** on a phone or **Edit this piece** to reach the
      piece editor, which ADR-241 changed, so they would fail if run.
    - Since ADR-108, jsdom find-it is the default; browser scripts are needed only for `Acceptance: browser` work.
    - Fix, two steps:
      - (a) move the copied steps into `tools/lib/steps.mjs` (new piece, room preset, open sheet, open Cut list, open
        in the piece editor) and update the 35 stale scripts to use them;
      - (b) retire the scripts whose feature has a jsdom find-it test and no `Acceptance: browser` ADR. 17 have a
        jsdom test of the same name; the rest need checking one by one.
    - Retiring deletes files (git keeps them), so this step waits for your explicit yes.

### Tier 4: docs

11. **`docs/backlog.md` is 708 KB** (rows up to 2 782 characters). Every session reads it first (CLAUDE.md), so it
    costs time and context on each start. Fix: move Done rows older than 14 days into `docs/backlog-archive.md`,
    keep their ids (never renumbered), and teach `scripts/check-docs.py` to accept ids from both files, as
    `GAPS-archive.md` already does for gaps.
12. **`docs/adr/README.md` is 111 KB**, mostly table padding. Fix: let Prettier stop aligning that one table, or keep
    only Pending and Deferred ADRs there with a link to `docs/adr-done/`.

### Tier 5: large files (later, separately)

13. `src/core/project.ts` (4 522), `src/ui/Project.tsx` (3 421), `src/viewer/Viewer3D.tsx` (2 563) and
    `src/store/designStore.ts` (2 092) keep growing. Splitting them by area (runs, placement, room; card, panel, plan)
    is a pure move, but it touches most imports and conflicts with every open branch. Proposal: do it one file per pull
    request when no other branch is open, with no logic change in the same pull request.

## Keeping it from coming back

14. **Guard tests** in CI, each with an allow-list for intentional cases:
    - an export with no importer outside its file fails;
    - a CSS class that no code produces fails;
    - a Russian code entry with no English text left fails.
    These are local scripts like `tests/core-boundary.test.ts`, with no new dependency.
15. **A duplicate-window check** (`scripts/dups.py`, Python, like `check-docs.py`) that reports new duplicated
    10-line blocks in `src/`. Report-only at first; a fail threshold only once Tier 2 is done.

## Proposed order

| Step | Contents                        | Risk     | Proof                                     |
| ---- | ------------------------------- | -------- | ----------------------------------------- |
| 1    | Tier 1 (1–4) + guards 14        | none     | typecheck, lint, full suite, new guards   |
| 2    | Tier 2 (5–7)                    | low      | existing unit and find-it tests unchanged |
| 3    | Tier 3 (9, 10a)                 | low      | the touched tests pass; scripts run green |
| 4    | Tier 4 (11, 12)                 | none     | `pnpm docs:check`                         |
| 5    | 10b retire scripts, Tier 5, 15  | medium   | per step; needs your yes                  |

## Method

- Duplicates: ten-line windows of normalised, non-comment lines across `src`, `tests` and `tools` (i18n and research
  data excluded), hashed and grouped by the files that share them.
- Unused exports: every `export` in `src`, counted as a whole word across `src`, `tests` and `tools`.
- CSS: every class selector in `src/styles.css` searched as a whole word in `src` code; dynamic class names checked
  by hand.
- i18n: every key of `src/core/i18n/ru/*.ts` except `data-*`, searched literally in `src`.

## Built 2026-11-10 (user: "Build most logical and valuable, self decide an go")

- **Item 1:** the seven unused exports deleted, with the variable and import they alone used.
- **Item 2:** `export` dropped from the 64 symbols used only in their own file.
- **Item 3:** 15 dead CSS selectors removed. The new guard found five more than the first scan: `.visually-hidden`,
  `.view-tools`, `.start-row`, `.variant-picks`, `.support-reference`. The research matrix's `v${band}` and
  `c${complexity}` are on its allow-list.
- **Item 4:** two orphan Russian entries removed. The `ru/variables.ts` one was orphaned too: its English text had
  changed.
- **Item 14:** `tests/dead-code.test.ts`, three guards with allow-lists: unused exports, CSS no code produces,
  Russian entries with no English text.
- **Item 11, done differently:** the backlog was big because Prettier padded every table row to the longest one
  (2 743 characters each), not because of old rows.
  - The tables in `docs/backlog.md` and `docs/adr/README.md` are now unpadded: 710 KB → 257 KB and 110 KB → 52 KB,
    same text.
  - Both files are in `.prettierignore`, and `pnpm docs:check` refuses a padded cell.
  - Item 12 is covered by the same change.
- **Proof:** lint, typecheck, `pnpm docs:check`, build and `pnpm test` all pass (220 files, 1 877 tests).

Not built, and why:

- **Item 5 (RoomFill / WallFill):** most of the repeated code is a declarative list of fields with small real
  differences. Wall fill has Number of pieces and Equal fronts, and its last two fields show no problem text. One
  shared component would need flags for each difference, which is harder to read than the two lists.
- **Item 6 (heightDrag / modelResize):** the browser scripts that drive these drags (`model-size`,
  `research-batch-2`) already fail on `main` before they reach the drag, and no jsdom test can run a WebGL drag. The
  change cannot be proven safe today, so it waits for item 10a.
- **Items 7–10, 13, 15:** not started. 10b and 13 need your yes.
