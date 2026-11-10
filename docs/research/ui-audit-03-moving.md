# UI audit 03 — Moving: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Moving (`src/ui/info/features.ts:239-301`, 10 feature lines)
- ADR: [ADR-250](../adr-done/ADR-250-ui-audit-moving-groups-turn-together-refusals-said.md)
- Method: code reading with file:line citations; reproductions run as throwaway jsdom and node tests outside the repo
  (vitest with a scratch config over `tests/find-it/setup.tsx`, at 1280 px). The 3D view is a stub in jsdom
  (`tests/find-it/setup.tsx:27`), so 3D findings are code-evident only. No repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. The plan is `ProjectPlan` (`src/ui/Project.tsx:1625-2360`);
the selected piece's card is in `ProjectInspector` (`src/ui/Project.tsx:168-560`); the 3D Move mode is
`src/viewer/pieceDrag.ts` and `src/viewer/heightDrag.ts`.

| #   | Feature line (features.ts)                 | Sub-flow: entry → steps → end state                                                                                                                                                 | Code                                                                                                                                                  | Covering test                                                                    | P/D |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --- |
| 1   | Drag a piece on the plan (:243)            | (a) Plan → press a piece → drag past 4 px → release → `moveItemBy` (snapped or 10 mm steps), one undo step; Esc cancels. (b) Focus a piece → arrow keys → `moveItemBy` 10/100 mm   | `Project.tsx:2045-2186`, `src/shared/planDrag.ts:41-87`, store `designStore.ts:1058-1071`, core `project.ts:863-882`                                  | `tests/drag.test.ts`, `tests/snap.test.ts`, `tools/plan-drag/find-it.mjs`        | P D |
| 2   | Move and turn pieces in the 3D view (:249) | 3D → Move → press a piece (selects it) → drag on its floor plane → release → `dropItemAt`; R / Shift+R turn                                                                         | `src/viewer/pieceDrag.ts:146-212`, `Viewer3D.tsx:529-568`, store `designStore.ts:1073-1085`                                                           | `tests/drag3d.test.ts`, `tools/move-3d/find-it.mjs`                              | P D |
| 3   | Change a wall unit's height in 3D (:251)   | 3D → Move → select a wall unit → drag the height handle → release → `setItemHeight` (one undo step)                                                                                 | `src/viewer/heightDrag.ts:38-129`, core `height.ts:27-60`, store `designStore.ts:1116-1126`                                                           | `tests/research-batch-2.test.ts`, `tools/research-batch-2/find-it.mjs`           | P D |
| 4   | Type an exact position (:256)              | Select a piece → Position → From left / From back (/ Above floor) → blur or Enter → `updateItem`; Gap to … on the left → `setGap`                                                   | `Project.tsx:1325-1460` (`PlacementFields`), gap `Project.tsx:494-516`, store `designStore.ts:1049-1057,1086-1095`                                   | `tests/project.test.ts`, `tests/group-size.test.ts:164-169`                      | P D |
| 5   | Turn 90° about the centre (:262)           | Card → Turn ↺ / Turn ↻ → `turnItem` → message under the toolbar; or plan R / Shift+R on the focused piece                                                                           | `Project.tsx:1195-1265`, `Project.tsx:2045-2059`, store `designStore.ts:1313-1325`, core `arrange.ts:234-245`                                         | `tests/arrange.test.ts`, `tools/arrange/find-it.mjs`                             | P D |
| 6   | Turn to any whole degree with a handle     | Select one piece → drag the round handle (snaps, Shift 15°) → release → `setRotation`; or focus the piece → [ / ]                                                                  | `Project.tsx:1843-1848`, `Project.tsx:2061-2068`, `Project.tsx:2335-2357`, store `designStore.ts:1326-1337`, core `arrange.ts:252-279`                | `tests/find-it/turn-handle.test.tsx`, `tools/turn-handle/find-it.mjs`            | P D |
| 7   | Move to a wall, corner, … neighbour (:275) | Card → Position → Move to → a working action → `moveItemTo` (one undo step); off actions fold under "N more are off"; several selected → Selection card → same, as one block        | `src/ui/MoveTo.tsx:12-71`, `Selection.tsx:180`, store `designStore.ts:1096-1109`, core `moveTo.ts:651-700`                                            | `tests/move-to.test.ts`, `tests/find-it/move-to-block.test.tsx`                  | P D |
| 8   | Place on the floor, wall or a piece (:282) | Card → Position → Placed: Floor · Wall · On a piece · Anywhere → `updateItem({ placement })` → fields for that kind                                                                | `Project.tsx:1325-1460`, store `designStore.ts:1049-1057`                                                                                             | `tests/mobila.test.ts`                                                           | P D |
| 9   | Lock a piece, its turn or sizes (:288)     | Card → Lock (icon) → `setLocked`; More actions → Lock turn / Lock width / … / Lock size → card shows the lock note and hides place and gap                                          | `Project.tsx:381-394`, `Project.tsx:470-479`, `Project.tsx:960-1000`, store `designStore.ts:1110-1115`                                               | `tests/lock.test.ts`, `tests/param-locks.test.ts`, `tests/find-it/param-locks.test.tsx` | P D |
| 10  | A locked piece on a base keeps the base (:295) | Resize a base with a locked piece on it → refused, notice names the locked piece                                                                                                | store `designStore.ts:2037-2060`, core `project.ts:840-857`                                                                                            | `tests/find-it/piece-safety.test.tsx`                                            | P D |

## Bug hunt

Each check below was applied to every sub-flow: empty / error / reload, double tap, edge input (0, negative, huge,
non-integer, locked, grouped, angled, L/U room), i18n, accessibility (role, label, focus, keyboard, `aria-invalid`),
390 px, ADR-004 and ADR-008, selector stability, persistence. Only what failed is listed. Classes: **Proven**
(reproduced, output quoted), **Code-evident** (cited, not run), **Suspected**.

### D03-F1 — The turn handle and [ / ] turn one piece of a group alone (Proven, major)

ADR-148 item 3 ("Always together") lists turning among the paths that must act on the whole group, about the group's
centre. `turnItem` does (`designStore.ts:1313-1325`, test `tests/group-size.test.ts:164-171`). `setRotation`
(`designStore.ts:1326-1337`) turns only the piece (`setItemRotation`, `arrange.ts:252-279`) and then `carryGroups`
moves the other members by the piece's centre shift, unturned (`groupMove.ts:70-120`). The handle is offered on a
single grouped piece (`turnPc`, `Project.tsx:1843-1848`: only locked and turn-locked pieces are left out), and [ / ]
call `setRotation` on any focused piece (`Project.tsx:2061-2068`).

Reproduction (store, two grouped base cabinets at x 0 and 600):
`D03-F1 setRotation 90 -> null [[90,0,11,-11],[0,0,611,-11]]` (one turned, the other only shifted);
`D03-F1 setRotation 1 -> null [[0,1,0,0],[0,0,600,0]]`; `D03-F1 turnItem -> [[90,0,311,289],[90,0,311,-311]]` (both turned).
Through the UI: focus the second piece on the plan → `]` → `D03-F1 after ] on grouped piece [[0,0,0,0],[0,1,600,0]]`;
`D03-F1 handle shown for single grouped piece: true`.

### D03-F2 — Position fields show a false range error for places other move paths make (Proven, minor)

The card fields have narrower limits than the core: "Gap to … on the left" `max={5000}` (`Project.tsx:500`), "Underside
above the floor" and "Above floor" `max={3000}` (`Project.tsx:1394-1399,1460-1465`), while a drag, Move to, the 3D height
drag and From left (±20000, `Project.tsx:1347-1366`) place pieces beyond them; `setWallHeight` accepts any whole mm ≥ 0
(`height.ts:45-56`). `MmField` validates the value it is given (`controls.tsx:50-51`), so an untouched field turns red.
Reproduction: second piece 5400 mm right of the first → `D03-F2 gap value 5400 aria-invalid= true error: Whole number from 0 to 5000.`;
wall unit lifted to 3200 mm (`setItemHeight`, as the 3D drag commits) → `D03-F2b setItemHeight 3200 -> null field 3200 aria-invalid= true | Whole number from 0 to 3000.`
The − / + steppers also clamp at the bound without a word (`controls.tsx:59`).

### D03-F3 — A Move to tap removes the tapped button and drops keyboard focus (Proven, minor)

In the card, Move to shows only the actions that work now (`onlyWorking`, `MoveTo.tsx:36`). An action that has just
worked is usually off afterwards ("Already touching …", `moveTo.ts:259`), so its button leaves the DOM and focus falls
to `<body>`. Reproduction: one working action → tap "To left piece" → `D03-F3 active after tap: BODY … button still in DOM: false`,
`move-to buttons after []`. A keyboard user loses their place in the card after every Move to.

### D03-F4 — A refused typed position or placement reverts the field and says nothing in the card (Proven, minor)

`updateItem` returns nothing (`designStore.ts:351,1049-1057`); a group member that cannot follow refuses the change
(`groupMove.ts:100-103`) and only the plan's notice says why (`Project.tsx:1905-1911`). The card's gap field next to it
shows its own refusal inline (`Project.tsx:505-509`), as ADR-244 asked for the gap. Reproduction: group the two pieces,
lock the first, type From left + 100 on the second → `D03-F4 x after 600 notice: Base cabinet, 1 door (piece 1) is locked — unlock it to move it. | in card: false | field value 600`.
The same holds for Placed (Floor · Wall · On a piece) on a grouped piece (`follow`, `groupMove.ts:31-50`).

### D03-F5 — In 3D Move mode, pressing a piece of a multi-selection drops the selection and drags one piece (Code-evident, major; Needs user decision in FLOW 02)

`usePieceDrag.press` calls `selectItem(id)` when the pressed piece is not `selectedItemId` (`src/viewer/pieceDrag.ts:168-171`),
which replaces a selection of several (`designStore.ts:1371-1374`; a lone `selectedItemId` resets `selectedItemIds`, `designStore.ts:636-639`); the drop is `dropItemAt` for that one id
(`pieceDrag.ts:210`, `designStore.ts:1073-1085`). On the plan, dragging any selected piece moves the whole selection
(`Project.tsx:2140-2160`, ADR-097 line 29). ADR-159 brought the shared Select to 3D but scoped only taps
(ADR-159 lines 30-34). Not run: the 3D view is a stub in jsdom.

## Checked, no finding

- Locked piece: drag, arrows, R, [ / ], Move to and the 3D drag all refuse with a named reason (`project.ts:840-857`,
  `arrange.ts:240,259`, `Project.tsx:1777-1786`); the Turn ↺ / ↻ buttons stay tappable and say why, as ADR-095 line 25
  decided.
- Arrow keys make one undo step per press (ADR-065 lines 43, 75) — intended.
- Plan drag: Esc, a second pointer and pointer cancel drop the gesture (`planDrag.ts:41-68`, `Project.tsx:1716-1745`).
- Typed values: `MmField` refuses non-integers and out-of-range text with "Whole number from … to …" and
  `aria-invalid` (`controls.tsx:50-101`); no silent clamp on typed input.
- Selectors in `ProjectPlan`, `MoveToButtons` and `Viewer3D` return primitives or store references; no `.filter`/`.map`
  inside a selector.
- The plan's label offsets for stacked pieces (`Project.tsx:2013-2021`) compare model bounds for text layout only;
  no geometry is made in the UI (ADR-004).
- Every visible text in the files read goes through `t()`/`tr()`; Move to labels have Russian entries
  (`src/core/i18n/ru/core2.ts:221-224`).
