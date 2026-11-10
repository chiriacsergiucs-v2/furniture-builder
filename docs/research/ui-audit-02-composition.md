# UI audit 02 — Composition: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Composition (`src/ui/info/features.ts:120-238`, 19 feature lines)
- ADR: [ADR-248](../adr/ADR-248-ui-audit-composition-ask-before-dropping-contents.md)
- Method: code reading with file:line citations; reproductions run as throwaway jsdom tests outside the repo
  (vitest with a scratch config over `tests/find-it/setup.tsx`, at 1280 px unless noted). No repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. The space editor is `SpaceEditor`
(`src/ui/Inspector.tsx:413-655`), shown in Compose for a selected space (`Inspector.tsx:101-112`) and in a project
under "Inside this piece" (`src/ui/Project.tsx:445-456`, `InsideEditor`, `Inspector.tsx:164-190`). All edits go
through `updateSpace` (`src/store/designStore.ts:2140-2144`), one undo step each.

| #   | Feature line (features.ts)                          | Sub-flow: entry → steps → end state                                                                                                                                          | Code                                                                                                    | Covering test                                                                    | P/D |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --- |
| 1   | Divide a space side by side or stacked (:126)       | Compose → select a space → Divide this space → Side by side / Stacked → Division: Direction, Parts −/+, each part Share/Fixed + size → Remove dividers                        | `Inspector.tsx:473-490`, `SplitEditor` `:831-995`, `SizeShareField.tsx`, core `splitSpace`/`unsplit` `src/core/design.ts:562-583` | `tests/find-it/piece-editor-inputs.test.tsx`, `tests/editing-flows.test.ts`, `tests/core.test.ts` | P D |
| 2   | New parts start empty (:131)                        | Divide / Parts + / quick count + → new parts are `empty`                                                                                                                     | `design.ts:562-575`, `Inspector.tsx:864-880`, `src/core/counts.ts:101-104`                              | `tests/counts.test.ts`                                                           | P D |
| 3   | Bays and shelves layout (:133)                      | Settings → Bays and shelves → Bays / Shelves in each bay / Doors on each bay; a non-bay inside asks "Replace it with equal bays?"                                             | `BaysGroup` `Inspector.tsx:1943-1997`, mounted `:1057`, core `makeBays` `design.ts:625-660`             | `tests/mobila.test.ts` (core); no UI test found                                  | P D |
| 4   | Apply a layout preset (:139)                        | Select a space → Layouts (folded) → Apply a layout from the catalog → pick → `applyLayout` replaces the inside                                                               | `LayoutPicker` `src/ui/Editors.tsx:263-297`                                                             | `tests/templates-local.test.ts` (core); no UI test found                         | P D |
| 5   | Merge two touching cabinets (:145)                  | Project → select a piece → More: clearance, merge → Merge with left/right piece (disabled with reasons) → confirm → `mergeItems`                                             | `Project.tsx:525-536`, `MergeFields` `:1263-1320`, store `designStore.ts:1138-1151`, core `src/core/merge.ts` | `tests/merge.test.ts`, `tests/lock.test.ts`, `tests/editing-flows.test.ts`       | P D |
| 6   | Shelves, fixed or adjustable (:157)                 | Select a space → What goes here: Shelves (confirm when something is lost) → Shelves −/+ → Adjustable, on shelf pins                                                          | `Inspector.tsx:497-535`                                                                                 | `tests/find-it/model-diagnostics.test.tsx`                                       | P D |
| 7   | Drawers with equal or chosen heights (:163)         | What goes here: Drawers → Drawers −/+ → Drawer heights Equal/Choose → per drawer Share/Fixed + size                                                                          | `Inspector.tsx:536-545`, `DrawerHeights` `:738-829`                                                     | `tests/find-it/piece-editor-inputs.test.tsx`, `tests/core.test.ts`               | P D |
| 8   | Hanging rail (:167)                                 | What goes here: Hanging → Rail below top (mm)                                                                                                                                | `Inspector.tsx:594-603`                                                                                 | no UI test found                                                                 | P D |
| 9   | Drawers behind doors (:168)                         | A space with doors → select a drawers space inside → hint "inside other doors"; Doors and handles off                                                                        | `Inspector.tsx:609-640`, `insideDoors` `design.ts:524-527`                                              | `tests/inner-front.test.ts` (core)                                               | P D |
| 10  | Appliance niches (:170)                             | What goes here: Empty → Niche for a built-in appliance → Appliance + Niche width/height/depth → `appliance-fit` check                                                        | `ApplianceEditor` `Editors.tsx:181-260`, check `src/core/cabinet.ts:800-824`                            | `tests/constructions.test.ts` (core); no UI test found                           | P D |
| 11  | Fixed front with no drawer (:177)                   | Drawers with no doors → Top drawer is a fixed front (sink false front)                                                                                                       | `Inspector.tsx:548-556`                                                                                 | `tests/run-parts.test.ts` (core)                                                 | P D |
| 12  | Plus-minus counts on the drawing (:188)             | Compose → tap the drawing (whole piece, then one level per tap) → card: V./H. dividers, Shelves, Drawers, Doors −/+ → `stepCount`                                            | `CountStepper.tsx:32-112`, `Elevation.tsx:276`, store `designStore.ts:2145-2154`, core `counts.ts:115-142` | `tests/find-it/count-stepper.test.tsx`, `tests/counts.test.ts`                   | P D |
| 13  | Quick counts over the 3D view (:193)                | 3D or Both → card over the canvas, foldable on a phone (choice in localStorage)                                                                                              | `App.tsx:83`, `CountStepper.tsx:9-46`                                                                   | browser script only (`tools/count-stepper/find-it.mjs`)                          | P D |
| 14  | Quick counts over the project front view (:195)     | Project → select a piece (drilled) → card over the front view → same `stepCount` on the drilled piece                                                                        | `Project.tsx:2653-2660`, `:2919-2926`                                                                   | `tests/find-it/model-diagnostics.test.tsx`                                       | P D |
| 15  | Select from the whole piece inwards (:205)          | Tap the drawing: nothing → whole piece → top space → … (Enter on a leaf does the same)                                                                                       | `Elevation.tsx:126-185`, store `tapPiece` `designStore.ts:980`, core `drill` `src/core/selectPath.ts:28-42` | `tests/select-path.test.ts`, `count-stepper.test.tsx`                            | P D |
| 16  | Clear highlight of the selected space (:211)        | Selected space outlined, the rest faded, in the drawing and in 3D                                                                                                            | `selectionBox`/`inSelection` `selectPath.ts:63-75`, `Elevation.tsx`, `Viewer3D.tsx:1100`                | `tests/select-path.test.ts`                                                      | P D |
| 17  | Drill into a project piece (:217)                   | Project → Edit this piece → "Inside this piece": space editor + Size, boards and construction                                                                                | `editInPlace` `Project.tsx:559-566`, `:445-456`, store `selectItem` `designStore.ts:1371-1379`          | `tests/find-it/phone-editor.test.tsx`                                            | P D |
| 18  | Esc selects one level up (:223)                     | Piece editor: Esc → `parentOf` (space → around it → whole piece → nothing); phones: Up one level in the crumbs                                                               | `App.tsx:539-546`, `Inspector.tsx:370-392`, core `parentOf` `selectPath.ts:50-57`                       | `tests/find-it/editor-nav.test.tsx`, `tests/run-handles.test.ts`                 | D (Esc), P (button) |
| 19  | Outline turns with an angled piece (:230)           | Angled project piece → 3D selection outline and Move ghost turned like its boards                                                                                            | `Viewer3D.tsx:2101`, `:2455` (`yawed`)                                                                  | `tests/angled-outline.test.ts`                                                   | P D |

## Bug hunt

Each check below was applied to every sub-flow: empty / error / reload, undo/redo, double tap, edge input (0,
negative, huge, non-integer, locked, angled), i18n, accessibility (role, label, focus, invalid state), 390 px,
ADR-004 and ADR-008, selector stability, persistence. Only what failed is listed. Classes: **Proven** (reproduced,
output quoted), **Code-evident** (cited, not run), **Suspected**.

### D02-F1 — The quick count's "Fewer … dividers" drops a part and its contents without asking (Proven, major)

ADR-246 decided to "confirm before … a lower part count or Remove dividers, only when something would be lost"
(`docs/adr-done/ADR-246-ask-before-an-edit-drops-contents-and-hold-the-assistant-to.md`, Decision). The Parts counter
asks (`Inspector.tsx:852-863`). The quick-count card does the same edit through `stepDividers`
(`counts.ts:98-109`, "removing takes the last bay"), called by `stepCount` (`designStore.ts:2145-2151`) with no
question (`CountStepper.tsx:80-88`). The card is on the drawing, over 3D and over the project front view, so it is
the most visible way to remove a divider.
Reproduction: Sideboard → Edit the interior → Right → Drawers → whole piece → card "Fewer vertical dividers" →
`D02-F1 … with drawers [ 'shelves1', 'drawers3', 'drawers3' ] after Fewer vertical dividers [ 'shelves1', 'drawers3' ] open dialogs 0`;
the same edit with Parts −: `D02-F1 Parts counter asks: true`.

### D02-F2 — The niche toggle fills in appliance sizes nobody typed (Proven, major)

ADR-036 says "Mobila never defaults niche sizes" and rejects default niche sizes as an ADR-010 breach
(`docs/adr-done/ADR-036-kitchen-modules-tall-units-construction-flags-on-the-cabinet.md:26-28,43`). The toggle sets
`kind: 'oven'`, `h: Math.min(opening.h, 590)`, `d: Math.min(opening.d, 550)` (`Editors.tsx:205-214`); 590 and 550
are oven sizes written in code, and the hardware line then says "as entered" (`cabinet.ts:822`).
Reproduction: Sideboard → Left → Empty → Niche for a built-in appliance →
`D02-F2 opening { … w: 514, h: 684, d: 432 } appliance oven fields [ '514', '590', '432' ] hardware [ "niche 514×590×432 mm as entered — check every size …" ]`.
The 590 mm height comes from no drawing and no opening.

### D02-F3 — "Apply a layout from the catalog" replaces what is in a space without asking (Proven, minor)

`LayoutPicker` applies on the select's `change` (`Editors.tsx:279-285`) with no `askConfirm`, while the other
edits that drop contents ask (ADR-246; `Inspector.tsx:503-513`, `BaysGroup` `:1946-1953`). The tip says "Undo brings
it back" (`Editors.tsx:276`); ADR-246 rejected "rely on undo" ("the user is not told anything was lost").
Reproduction: Sideboard → Middle (3 drawers) → Layouts → first layout →
`D02-F3 before [ 'shelves1', 'drawers3', 'shelves1' ] after [ 'shelves1', 'shelves1', 'shelves1' ] layout Base cabinet, doors: 1 door + shelf open dialogs 0`.
Suspected on top: a closed `<select>` that fires `change` on each arrow key (Chromium on Windows) would apply every
layout the keyboard passes; not reproducible in jsdom.

### D02-F4 — Esc inside a drilled project piece leaves the piece instead of going up one level (Proven, minor)

The app's Esc clears the project selection whenever a project is open and the piece editor screen is not
(`App.tsx:541-545`); `selectItem(null)` also ends the drill (`designStore.ts:1371-1378`). Since ADR-241 "Edit this
piece" edits in place (the drill), so the same space editor with the same crumbs (`Inspector.tsx:164-176`) answers
Esc with "up one level" in the piece editor (ADR-203 item 8) and "leave the piece" in the project.
Reproduction: project with two pieces → Edit this piece → select its interior → Esc →
`D02-F4 after Esc: selectedItemId null drillItemId null selectedId 0186e27f Inside this piece shown false`.

### D02-F5 — The two "up" controls on a phone go to different levels (Proven, polish; Rejected in FLOW 02: each label names its target)

On a phone the crumbs have "Up one level" (`Inspector.tsx:382-391`, `parentOf` of the tap path, which skips a
cabinet's divided interior, `selectPath.ts:17-26`), and the bottom of the same panel has "Select the divided space
around this one" (`Inspector.tsx:647-651`, the tree parent). From a top part they disagree.
Reproduction (390 px): Sideboard → Middle →
`D02-F5 from Middle: Up one level -> null | Select the divided space around this one -> 6eab86df (interior root 6eab86df)`.
The crumbs list "Interior" between the whole cabinet and the part, so "Up one level" skips a level the path shows.

### D02-F6 — The sink-trap notch starts at 250 × 200 mm (Code-evident; Needs user decision in FLOW 02, ADR-010)

"Top drawer cut around a sink trap" sets `uCut: { width: 250, depth: 200 }` (`Inspector.tsx:559-565`), with the hint
"Measure your trap and pipes" (`:591`). The same numbers are in the kitchen catalog
(`src/core/catalog/kitchen.ts:219`). Whether a default notch size is allowed is a physical-fact question (ADR-010).

## Checked, no finding

- Esc in a size field: `MmField` (Notch width) — Esc restores the field and leaves the selection where it was
  (reproduced: `selected before d6520290 after Esc in Notch width d6520290`); split and drawer fields stop the event
  (`SizeShareField.tsx:53-57`).
- New parts start empty on Divide, Parts + and the quick count + (`design.ts:562-575`, `Inspector.tsx:864-880`,
  `counts.ts:101-104`), as ADR-089 decided.
- Invalid split and drawer sizes are kept, marked `aria-invalid` and explained (ADR-199, `SizeShareField.tsx:27-68`).
- Merge: refused merges are disabled with every reason listed (`Project.tsx:1278-1314`), confirmed before, and a
  store refusal sets the notice (`designStore.ts:1141-1146`); reason texts go through `t()` (`merge.ts:98-145`).
- Selector stability: the selectors in `Inspector.tsx`, `CountStepper.tsx` and `Project.tsx:2653-2660` return
  stored references or booleans; filters run in `useMemo` (`Inspector.tsx:426-427`, `:745-752`).
- ADR-004: the editors read sizes from the model (`opening.box`, `actual`); no geometry is computed in UI code apart
  from F2's caps.
- i18n: every visible text in the files read goes through `t()`/`tr()`; no untranslated literal found.
- Undo: every edit here is one `commit`; the quick count keeps the selection (`designStore.ts:2152-2154`).
- Outline turned with an angled piece (ADR-203 item 2): covered by `tests/angled-outline.test.ts`; the 3D view is not
  rendered in jsdom, so not re-run here.
