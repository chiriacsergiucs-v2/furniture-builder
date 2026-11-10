# UI audit 04 — Aligning and arranging: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Aligning and arranging (`src/ui/info/features.ts:302-397`, 20 feature lines)
- ADR: [ADR-250](../adr/ADR-250-ui-audit-aligning-along-each-wall-alone-on-a-phone.md)
- Method: code reading with file:line citations; reproductions run as throwaway tests outside the repo (vitest with
  a scratch config, core and store in node). No repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. Several pieces are selected with Shift/Ctrl on desktop
or the plan's **Select** toggle on a phone (`src/ui/Project.tsx:1863-1864`); the Selection card is `SelectionCard`
(`src/ui/Selection.tsx:19-201`). One piece's tools are `ArrangeFields` (`src/ui/Project.tsx:1195-1262`). On a phone
**Snap** sits behind the plan's Options (`Project.tsx:1865-1871`).

| #   | Feature line (features.ts)                      | Sub-flow: entry → steps → end state                                                                                                   | Code                                                                                                              | Covering test                                                                    | P/D |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --- |
| 1   | Snap to neighbours and walls (:305)             | Plan → drag a piece → preview and hint → drop → snapped whole-mm position, one undo step; Snap off or Alt → exact drop               | `Project.tsx:1792,1869,2133-2167`, `src/core/snap.ts:264,508`, `src/store/useSnap.ts:8-45`                       | `tests/snap.test.ts`, `tools/plan-snap/find-it.mjs`                             | P D |
| 2   | Snap centre to centre (:312)                    | Drag a wall unit over a base unit → "centre" label → drop centred                                                                     | `src/core/snap.ts:264`                                                                                            | `tests/align.test.ts:220-266`                                                    | P D |
| 3   | Connected pieces (:313)                         | Snapped drop touching a neighbour → connection stored; drag moves both; select two → **Connected** toggle; seam tick on the plan      | `Selection.tsx:207-241`, `designStore.ts:1822-1834`, `src/core/connections.ts:262,352,513`, `Project.tsx:781-800` | `tests/connections.test.ts`, `tests/find-it/connections.test.tsx`               | P D |
| 4   | Connection kinds (:320)                         | Two pieces side by side, in a corner or stacked → Connected → piece card "Connected to {names}" with the kind                          | `connections.ts:179-209`, `Project.tsx:724-737`                                                                   | `tests/connections-typed.test.ts`, `tests/find-it/connections-typed.test.tsx`   | P D |
| 5   | Against the wall (:327)                         | Piece card → **Against the wall** → drag slides along the wall; Alt takes it off                                                      | `Project.tsx:743-773`, `designStore.ts:1836-1852`, `connections.ts:247,527`                                       | `tests/connections-typed.test.ts`, `tests/find-it/connections-typed.test.tsx`   | P D |
| 6   | Compatibility rules (:334)                      | Drag next to a piece a rule refuses → refusal named while dragging; Checks list the rule                                              | `src/core/compat.ts:77,308,378`                                                                                   | `tests/compat.test.ts`, `tools/compat-rules/find-it.mjs`                         | P D |
| 7   | Align left, centre, right, back and front (:340) | Select 2+ → "Align to {name}:" → Left … Front → `alignSelection` → one undo step; skipped pieces named                               | `Selection.tsx:131-171`, `designStore.ts:1462-1475`, `src/core/align.ts:142-199`                                  | `tests/align.test.ts:35-79`, `tools/align-distribute/find-it.mjs`               | P D |
| 8   | Align tops and bottoms (:345)                   | As 7, Top / Bottom → wall units and stacked pieces move up or down; floor pieces named                                                | `align.ts:73-114,169-176`                                                                                         | `tests/research-batch-2.test.ts`                                                 | P D |
| 9   | Distribute evenly (:346)                        | Select 3+ → **Distribute evenly** → ends stay, equal gaps → "Gaps now … mm."                                                          | `Selection.tsx:161-169`, `designStore.ts:1477-1491`, `align.ts:229-301`                                           | `tests/align.test.ts:81-127,268-289`                                             | P D |
| 10  | Distribute each row (:347)                      | As 9 over base and wall units → each row of 3+ spaced; a short row named                                                              | `align.ts:244-284`                                                                                                | `tests/align.test.ts:154`                                                        | P D |
| 11  | Wall unit heights snap (:348)                   | Front view or 3D → drag a wall unit up/down → snaps to the worktop line or another wall unit, hint names it                           | `src/core/height.ts:35,80`                                                                                        | `tests/kitchen-corners.test.ts`, `tools/kitchen-corners/find-it.mjs`            | P D |
| 12  | Angled pieces snap along turned faces (:353)    | Drag an angled piece near one at the same angle → face to face, gap under 1 mm                                                        | `snap.ts:264`                                                                                                     | `tests/kitchen-corners.test.ts:734-788`                                          | P D |
| 13  | Mirrored copies match to the mm (:358)          | Mirror → remainder kept on the same physical part                                                                                     | `src/core/arrange.ts:54-78`                                                                                       | `tests/kitchen-corners.test.ts`, `tests/arrange.test.ts:196`                     | P D |
| 14  | Groups align and distribute as one block (:359) | Select a group and pieces → Align / Distribute → the group moves by its outer box; its own members named                             | `align.ts:142-217`, `src/core/groupMove.ts:70`                                                                    | `tests/group-size.test.ts:164-250`                                               | P D |
| 15  | Duplicate a piece (:364)                        | Piece card → **Duplicate** (Ctrl+D) → copy touching on the right in room x, else left → copy selected                                 | `Project.tsx:1203-1215`, `designStore.ts:1249-1255`, `arrange.ts:192-218`                                         | `tests/arrange.test.ts:62-110`, `tools/arrange/find-it.mjs`                     | P D |
| 16  | Mirror a piece (:365)                           | Piece card → **Mirror** → hinges, pedestals, order swap; locked or nothing to mirror says why                                         | `Project.tsx:1249-1252`, `designStore.ts:1338-1362`, `arrange.ts:87,283-301`                                      | `tests/arrange.test.ts:174-340`                                                  | P D |
| 17  | Mirror a run or a selection (:371)              | Piece ⋯ More actions → **Mirror the run (n pieces)**; or Selection → **Mirror** → positions reflect, each piece mirrored              | `Project.tsx:1041-1058`, `Selection.tsx:91-100`, `designStore.ts:1363-1370,1429-1441`, `arrange.ts:323-370`, `src/core/selection.ts:310-321` | `tests/arrange.test.ts:341-420`, `tests/group-repairs.test.ts`, `tests/rotation.test.ts` | P D |
| 18  | Linked copies (:378)                            | Piece card → **Linked** → linked copy; "Linked: n copies" + **Change all copies**                                                     | `Project.tsx:1153-1188,1216-1227`, `designStore.ts:618-624,805,1281-1291`, `src/core/linked.ts:44-63,71`          | `tests/linked.test.ts`                                                           | P D |
| 19  | Link identical pieces (:384)                    | Piece card → **Link n identical pieces** → one link group, one undo step                                                              | `Project.tsx:1175-1185`, `designStore.ts:1256`, `linked.ts:151-182`                                               | `tests/connections-typed.test.ts`, `tests/find-it/connections-typed.test.tsx`   | P D |
| 20  | Mirror a lounger or a daybed (:390)             | Lounger piece → Mirror → backrest and side panel at the other end                                                                     | `arrange.ts:38-52,87`                                                                                             | `tests/connections-typed.test.ts:486-487`                                        | P D |

## Bug hunt

Each check was applied to every sub-flow: empty / error / storage failure / undo-redo / reload, double tap, edge input
(locked, grouped, angled, L/U room), i18n, accessibility, 390 px, ADR-004 and ADR-008, selector stability and
persistence. Only what failed is listed. Classes: **Proven** (reproduced, output quoted), **Code-evident** (cited, not
run), **Suspected**.

### D04-F1 — Align and Distribute work in room x on pieces that stand along a side wall (Proven, major)

ADR-099 asks for Left, Centre, Right "along the wall", Back and Front "in depth", and Distribute "along the wall
only" (user answer). `alignItems` and `distributeItems` always use room x for "along" and room z for "depth"
(`align.ts:177-191`, `align.ts:266-283`). Since ADR-205 item 1, base units turned a quarter (`rotationY` 90/270) stand
along the side walls, where "along the wall" is z and "depth" is x.
Reproduction, three base units on the left wall (`rotationY` 90, backs at x 0, along z), through the store:
`D04-F1 store distribute says: "Gaps now -563 · -563 mm."` (nothing moved; the gaps said are not gaps) and
`D04-F1 store align back says: "" boxes [[0,0],[30,0],[15,0]] errors [ 'pieces-overlap', 'pieces-overlap', 'pieces-overlap' ]`
— Back moved all three along the wall onto each other, one undo step, no message. Core alone:
`D04-F1 align back [[0,0],[0,0],[0,0]]`. The errors are shown (ADR-008 holds), but the action did the wrong thing.

### D04-F2 — Duplicate and Mirror the run treat a side-wall run as room x (Proven, minor; FLOW 02: intended by ADR-069, needs a user decision)

`duplicateItem` places the copy "on its right in the room's x" (`arrange.ts:186-218`, ADR-069 line 23-25) and
`touchingRun` finds runs "touching along x" (`arrange.ts:323-345`, ADR-069 line 33). On a side wall:
`D04-F1 duplicate of the last side-wall piece at [578,1200] original at [0,1200]` — the copy stands in the room, off
the wall; `D04-F1 touchingRun on a side wall of 3 touching: 1` against `… on the back wall of 3 touching: 3`, so
**Mirror the run** is not offered for a side-wall run (`Project.tsx:1041`). Both follow ADR-069's words, written before
side-wall runs existed (ADR-205 item 1).

### D04-F3 — On a phone a connected piece cannot be dragged alone, and every hint names only Alt (Code-evident, major)

A drag carries the connected set unless `alone` is true, and `alone` comes only from `e.altKey`
(`Project.tsx:2141,2159`; store `designStore.ts:1058-1065`). Snap off does not set it. The hints say "Alt while
dragging moves one alone" (`Selection.tsx:233`), "Alt while dragging moves it away and takes it off the wall"
(`Project.tsx:762`) and "hold Alt to place freely" (`Project.tsx:1876`). A phone has no Alt key. The only touch path
is Select on → tap both pieces → **Connected** off (`Selection.tsx:190-192`), which no hint names; the piece card's
"Connected to …" note has no control (`Project.tsx:724-737`). Arrow keys carry the set too (`Project.tsx:2074-2075`).

### D04-F4 — An align that changes nothing says nothing (Proven, polish)

`alignSelection` commits nothing and returns `skippedText(res)`, which is '' when nothing was skipped
(`designStore.ts:1462-1475`, `align.ts:304-305`); the card shows no message (`Selection.tsx:194-198`). Reproduction:
`D04-F4 align back on aligned row says: "" steps added 0`. Distribute does say "Gaps now 0 · 0 mm." in the same case.
A tap with no visible change and no word reads as a dead button.

### D04-F5 — Piece names in align and distribute messages stay English in Russian (Proven, minor; FLOW 02: moved to ADR-264)

The messages take `pieceName` (`align.ts:87,160-165,261`; `src/core/project.ts:791-797`), which returns the stored
English name, while the card heading translates it with `tr()` (`Selection.tsx:138`). Reproduction with the Russian
dictionary loaded: `D04-F5 name "Base cabinet" tr -> "Нижний шкаф"` and
`D04-F5 ru message: Не сдвинуто: Base cabinet (изделие 2) закреплено — снимите закрепление, чтобы переместить.`
`pieceName` is used by 37 core messages across many domains (`grep -c` over `src/core/*.ts`), so the fix is one
place for all of them.

### D04-F6 — The five arrange buttons may cut Russian labels at 390 px (Rejected in FLOW 02: not reproduced)

`.arrange-tools` is five equal columns with `white-space: nowrap` and an ellipsis (`src/styles.css:2120-2136`); the
Russian labels "Дублировать" and "Повернуть ↺" / "Повернуть ↻" (`src/core/i18n/ru/project.ts:98`,
`src/core/i18n/ru/project.ts:266-267`) are 11 characters at 13 px (`styles.css:57`). Both turn buttons could show the
same "Поверн…". Not reproduced: no browser in the sandbox (jsdom has no layout).

## Checked, no finding

- Snap toggle storage: reads and writes are in try/catch and default to on (`useSnap.ts:16-37`).
- Selectors in `Selection.tsx:20-33` and `Project.tsx:1196-1199,1154-1157,744-745` return store fields or actions;
  derived lists are in `useMemo` (`Selection.tsx:36-39,219-222`).
- ADR-004: the Selection card and arrange toolbar compute no geometry; checks come from core (`connectionCheck`,
  `commonPanelCheck`, `identicalPieces`).
- Locked and turn-locked pieces: Align, Distribute and Mirror name them (`align.ts:44-46,96-99`,
  `arrange.ts:283-292`); a refused group mirror says why (`selection.ts:310-321`).
- Undo: Align and Distribute are one step and none when nothing moved (`tests/align.test.ts:268-289`, reproduced
  `steps added 0`).
- Every visible text in the files read goes through `t()`/`tr()` with a Russian entry; the gap is F5's interpolated
  names.
- Duplicating a selection overlaps a piece already right of it (reproduced: copies at x 1200 and 1800 over a piece at
  1200); that is Selection's duplicate (ADR-097, domain 05), not this domain's, and the overlap is diagnosed.
