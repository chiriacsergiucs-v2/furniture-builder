# ADR-251: UI audit — Aligning and arranging: along each piece's own wall, and alone on a phone

- Status: Implemented
- Date: 2026-11-10
- Implemented: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: N260
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 04, **Aligning and arranging** (`src/ui/info/features.ts:302-397`).
The full sub-flow map (20 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-04-aligning.md](../research/ui-audit-04-aligning.md).

Summary of the map: one piece is arranged from its card's toolbar (`src/ui/Project.tsx:1195-1262`) and ⋯ More
actions (`Project.tsx:1041-1058`); several pieces from the Selection card (`src/ui/Selection.tsx:19-201`), reached with
Shift/Ctrl or the plan's **Select** toggle on a phone (`Project.tsx:1864`); snapping and connections act on the plan
drag (`Project.tsx:2133-2167`). All are reachable at 390 and 1280 px.

[ADR-099](../adr-done/ADR-099-align-centres-and-distribute-pieces-evenly.md) defines Align and Distribute "along the
wall" (user answer). Since [ADR-205](../adr-done/ADR-205-kitchen-cut-outs-worktop-corners-and-placement-precision.md)
item 1, runs also stand along the side walls, where "along the wall" is room z; the core still uses room x. On a
phone, the only way to drag a connected piece alone is a key the phone does not have.

## Findings

| Id     | Class        | Severity | Finding                                                                                                                                                                       |
| ------ | ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D04-F1 | Proven       | major    | On a side wall Align Back stacks the pieces into each other (3 overlap errors) and Distribute moves nothing but says "Gaps now -563 · -563 mm." (`align.ts:177-191,266-283`). |
| D04-F2 | Proven       | minor    | Duplicate puts a side-wall piece's copy into the room and Mirror the run is not offered for a side-wall run (`arrange.ts:186-218,323-345`); needs a user decision.            |
| D04-F3 | Code-evident | major    | On a phone a connected piece cannot be dragged alone; `alone` is only `e.altKey` (`Project.tsx:2141,2159`) and every hint names only Alt.                                     |
| D04-F4 | Proven       | polish   | An align that changes nothing says nothing (`designStore.ts:1462-1475`); reproduced: message "", no undo step.                                                                |
| D04-F5 | Proven       | minor    | Piece names in align and distribute messages stay English in Russian (`pieceName`, `project.ts:791-797`). Moved to ADR-265.                                                   |
| D04-F6 | Rejected     | —        | The five arrange buttons may cut Russian labels at 390 px (`styles.css:2120-2136`); not reproduced, see Cross-examination.                                                    |

## Decision

One rule for arranging: **"along the wall" means along the wall the pieces stand on, and every drag option has a
touch path.**

1. **F1:** `alignItems` and `distributeItems` (`src/core/align.ts`) take their axes from the first selected piece's
   quarter turn: `rotationY` 0/180 → along = x, depth = z (as today); 90/270 → along = z, depth = x. Back and Front
   follow that piece's back (the side its back faces), Left and Right its own left and right as seen from the front.
   A selected piece or group whose quarter turn is on the other axis stays and is named in `skipped`: "{name} stands
   along another wall." Distribute sorts and spaces along the same axis; the "Gaps now" message lists only gaps it
   measured along that axis. Core only, no `src/core/types.ts` change; whole mm (ADR-003).
2. **F2:** decided by the user: see the last Decision item.
3. **F3:** a **Move alone** toggle beside **Snap** (inside Options on a phone, as Snap, ADR-144), off by default and
   kept for the session only. On, every plan drag and arrow-key move acts as Alt held for connections:
   `alone: e.altKey || moveAlone` (`Project.tsx:2141,2159`, `2074-2075`). The three hints
   (`Selection.tsx:233`, `Project.tsx:762`, `Project.tsx:1876`) say "Alt or Move alone". `t()` with Russian entries.
4. **F4:** when Align moves nothing and skips nothing, the card says "Already in line." (`t()` with its Russian
   entry); no undo step, as today.
5. **F5:** moved to ADR-265 (Language): one fix in `pieceName` reaches every message that names a piece.
6. **F6:** no change (rejected in the cross-examination).
7. **F2 (D04-F2, user 2026-11-10):** on a side wall, Duplicate places the copy beside the piece along its own wall, and Mirror the run finds the run touching along that wall; on the back wall nothing changes. This supersedes ADR-069's room-x rule for turned pieces.

## Alternatives considered

- **F1: refuse Align and Distribute for side-wall pieces** — honest, but leaves half a kitchen without the action
  ADR-099 gave the back wall.
- **F1: align to the selection's own axis (its longest extent)** — guesses; the first piece's turn is the rule
  ADR-099 already uses ("to the first selected piece").
- **F3: hint text only ("select both and turn Connected off")** — names the path, but every alone drag then costs
  Select, two taps, a toggle and a re-connect.

## Scope

- In scope: F1, F3, F4 as decided; tests for each.
- Out of scope: F2 until answered; F5 (ADR-265); angled pieces (`angle` set) in Align and Distribute keep today's
  room-x behaviour (angled pieces in runs are G-171, ADR-205).

## Consequences

- Positive: Align and Distribute work on the second and third wall of an L or U kitchen; a phone user can free one
  connected piece in one drag.
- Negative / risks: F1 changes what Back and Front mean for a piece turned 180° (an island facing the back wall);
  existing tests use unturned pieces and keep passing. Move alone left on makes later drags break connections; the
  plan hint shows "Move alone is on." while it is.

## Done when

- [x] Three base units on the left wall: Align Back puts their backs on the wall's line, Left/Right/Centre move them along z, Distribute spaces them along z and says the real gaps; a piece on another wall is named (core + store tests).
- [x] With Move alone on, a plan drag of one of two connected pieces moves it alone and disconnects it at drop; the three hints name Move alone in English and Russian (test).
- [x] An align that moves nothing says "Already in line." and adds no undo step (store test).
- [x] On a side wall, Duplicate puts the copy beside the piece on that wall with no overlap, and Mirror the run is offered for a run along it (test).
- [x] Find-it test passes from the bare app at phone and desktop widths: **Move alone** behind Options on a phone, **Already in line.** after a second Align.

Evidence: tests/audit-aligning.test.ts, tests/audit-extra.test.ts, tests/find-it/audit-aligning.test.tsx; tests/find-it/audit-rest.test.tsx, tests/audit-rest-components.test.tsx, tools/ui-audit-3d/find-it.mjs (plan drag with Move alone, 1280 and 390 px) (run 2026-11-10 in the sandbox: the full suite and the files above pass).

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates, for behaviour an implemented ADR intends, for
conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                                                | Proposer                                                                                                                                                                                                                                         | Verdict                    |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| D04-F1 | ADR-099 was written for the back wall; room x is what it built. The overlaps are shown, so ADR-008 holds.              | ADR-099's decision says "along the wall" and "depth", and the user answered "Along the wall only"; ADR-205 item 1 made side-wall runs. Reproduced: three overlap errors from one tap and a "Gaps now -563 · -563 mm." that is not true.          | Accepted                   |
| D04-F2 | ADR-069 lines 23-25 and 33 say room x and "touching along x" in so many words.                                         | True: it is intended by an implemented ADR, so it is not a bug here. It is also written before side-wall runs existed; whether to change it is the user's call.                                                                                  | Accepted (user 2026-11-10) |
| D04-F3 | ADR-168 and ADR-207 chose Alt; a phone can still Select both and turn Connected off. A new toggle is over-engineering. | ADR-168 line 45 names Alt as "the free-drag key of ADR-070", a desktop key; neither ADR names a touch path, and no hint does. The app is phone-first (CLAUDE.md). One toggle beside Snap reuses ADR-144's Options; hint-only is the alternative. | Accepted                   |
| D04-F4 | Nothing changed, so nothing to say; Distribute already reports.                                                        | A tap with no visible change and no word reads as a dead button; Distribute says "Gaps now 0 · 0 mm." in the same case, so Align is the odd one out. One `t()` key.                                                                              | Accepted                   |
| D04-F5 | Not this domain's: `pieceName` serves 37 core messages across moving, sizing, checks and more.                         | Agreed; the fix is one place (`tr()` on the stored name in `pieceName`) and belongs to the Language domain.                                                                                                                                      | Moved to ADR-265           |
| D04-F6 | No browser in the sandbox; jsdom has no layout, so the cut is a guess.                                                 | Could not be reproduced this round; the accessible names stay whole (the DOM text is complete), so screen readers are not affected.                                                                                                              | Rejected                   |

Decided without asking: F1 takes the first selected piece's quarter turn as the frame (ADR-099's "to the first
selected piece"); F3 keeps Move alone for the session only, like a held key.

## User decision (2026-11-10)

- **D04-F2:** Along the piece's own wall: Duplicate puts the copy beside the piece on its wall, and Mirror the run finds the run along that wall.
