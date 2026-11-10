# UI audit 05 — Selection and groups: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Selection and groups (`src/ui/info/features.ts:398-440`, 8 feature lines)
- ADR: [ADR-252](../adr/ADR-252-ui-audit-selection-groups-named-one-tap-one-group.md)
- Method: code reading with file:line citations; reproductions run as throwaway jsdom and core tests outside the
  repo (vitest with a scratch config over `tests/find-it/setup.tsx`, at 1280 px). No repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. The selection lives in the store (`selectedItemIds`,
`multiSelect`; `src/store/designStore.ts:1372-1402`); several selected pieces show the selection card
(`src/ui/Selection.tsx:19-196`) in the Compose panel (the bottom sheet on a phone).

| #   | Feature line (features.ts)                        | Sub-flow: entry → steps → end state                                                                                                                         | Code                                                                                                                  | Covering test                                                                                   | P/D                    |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | Select several pieces (:402)                      | (a) Shift/Ctrl-click a piece on the plan → `toggleItem`; (b) phone: Select on → tap pieces; (c) Ctrl/Cmd+A → `selectAll` (pieces and 3D models, ADR-246) → card | `Project.tsx:1864`, `:2112-2114`; `App.tsx:529-536`, guard `editorShortcuts.ts:2-20`; store `designStore.ts:1380-1402` | `tests/selection.test.ts`, `tests/editing-flows.test.ts`, `tools/multi-select/find-it.mjs`      | P (Select) D           |
| 2   | Select in the front view, 3D and the list (:408)  | One shared Select: front view checkbox, 3D toolbar button, Pieces list checkbox → taps add or remove whole pieces                                         | `Project.tsx:294`, `:347-352`, `:2540`, `:2698`; `Viewer3D.tsx:704-713`, `:1430`, `:2156`                             | `tools/multi-select-views/find-it.mjs`; `selectRows` in `tests/find-it/setup.tsx`               | P D                    |
| 3   | Selection box on the plan (:413)                  | Press on empty plan (mouse/pen, or touch with Select on) → drag → release → `itemsInBox` → `selectItems` (Shift/Ctrl adds)                                 | `Project.tsx:1925-1949`; core `selection.ts:239-255`                                                                  | `tests/selection.test.ts`, `tools/multi-select/find-it.mjs`                                     | P (Select) D           |
| 4   | Selection box in the front view (:415)            | The same in the front view → `itemsInFrontBox`                                                                                                              | `Project.tsx:2704-2743`; core `selection.ts:262-278`                                                                  | `tests/selection.test.ts`, browser script (ADR-211 line 99)                                      | P (Select) D           |
| 5   | About Select (:421)                               | ⓘ beside the list, plan and front-view Select → the text (plus the drag box on plan and front view)                                                       | `Project.tsx:295`, `:1865`, `:2699`, `:3436-3446`                                                                     | `tests/find-it/editor-nav.test.tsx`                                                             | P D                    |
| 6   | Up one level on a phone (:427)                    | Piece editor, a space selected → Up one level beside the path → the space around it; desktop: Esc                                                          | `Inspector.tsx:372-390`; Esc `App.tsx:541-548`                                                                        | `tests/find-it/editor-nav.test.tsx`                                                             | P (button) D (Esc)     |
| 7   | Cycle through overlapping pieces (:432)           | Plan: tap the same spot again over stacked pieces → `nextUnder` → the next piece; not for grouped pieces                                                   | `Project.tsx:2115-2129`; core `selection.ts:284-310` (`itemsAt`, `nextUnder`)                                            | `tests/selection.test.ts`                                                                       | P D                    |
| 8   | Keep pieces as named groups (:434)                | Select ≥ 2 → card → Group → `groupSelection` ("Group N") → Groups list → tap selects the group; Ungroup (card or list); first tap on a grouped piece selects the group | `Selection.tsx:98-107`, `:368-411`; store `designStore.ts:1493-1504`; core `selection.ts:196-228`                     | `tests/selection.test.ts`, `tests/find-it/group-size.test.tsx`, `group-repairs.test.tsx`        | P D                    |

## Bug hunt

Each check below was applied to every sub-flow: empty / error / undo / reload, double tap, edge input (locked,
grouped, 3D models, angled), i18n, accessibility (role, label, focus, keyboard), 390 px, ADR-004 and ADR-008, selector
stability, persistence. Only what failed is listed. Classes: **Proven** (reproduced, output quoted), **Code-evident**
(cited, not run), **Suspected**.

### D05-F1 — Group names are stored in English and shown untranslated (Proven, major)

`nextName` writes the literal `Group ${n}` into the project (`selection.ts:196-201`); the card title, its region
name, the Groups list and "Ungroup {name}" show `g.name` as it is (`Selection.tsx:48`, `:52`, `:392`, `:400`). Other default
names are written in the UI language (`t('New board')`, `Dialogs.tsx:732`). Reproduction: Russian UI,
two pieces → Group → `D05-F3 stored group name: Group 1 | undo step name: Сгруппировать 2 изделия` and
`"Group 1" on screen: 2`.

### D05-F2 — Group on a piece and a 3D model does nothing and says nothing (Proven, minor)

The card appears for any two selected ids (`Selection.tsx:39`), pieces or 3D models (ADR-246), and offers **Group**
(`:103-107`); `groupItems` keeps only pieces (`selection.ts:212-213`) and returns no group; `groupSelection` returns
null and the card ignores it (`designStore.ts:1493-1503`). The card also calls a piece and a model "2 pieces selected".
Reproduction: two base cabinets and a fridge model → select one cabinet and the fridge → Group →
`D05-F1 card name: 2 pieces selected` / `groups after Group: null | status: null | notice: null`.

### D05-F3 — A double tap on Group groups and then ungroups (Proven, minor)

Group and Ungroup swap in the same place (`Selection.tsx:98-107`); the second tap of a double tap lands on Ungroup.
Reproduction: two pieces selected → `user.dblClick(Group)` → `D05-F2 groups after a double tap on Group: 0 | history:
Group 2 pieces | Ungroup` (two undo steps, no group).

### D05-F4 — The selection box never takes a 3D model (Proven, minor)

`itemsInBox` and `itemsInFrontBox` walk `project.items` only (`selection.ts:249-254`, `:272-277`), though the front
view passes the models' boxes in (`Project.tsx:2523-2530`) and a tap, Select and Ctrl+A take models since ADR-246.
Reproduction (core): a project with only a fridge model at x 2000 → `D05-F4 plan box over everything: []`,
`front box over everything: []`.

### D05-F5 — The 3D view's Select has no About Select ⓘ (Code-evident, polish; rejected in FLOW 02)

`Viewer3D.tsx:704-713`: a toggle button with only a `title`; the feature line says "An ⓘ beside each Select"
(`features.ts:421-425`). ADR-211 item 8 gave the tip to "the three Select toggles" (list, plan, front view).

### D05-F6 — No control renames a group (Code-evident, minor; needs a user decision)

Not found in the repo: `groupItems` takes a `name` (`selection.ts:207-211`) but no caller passes one
(`designStore.ts:1496`), and the card and the Groups list show the name as text only (`Selection.tsx:52`, `:392`).
ADR-097 does not ask for renaming, so whether to add it is the user's choice.

## Checked, no finding

- Ctrl/Cmd+A, Delete and Ctrl+D never act from a text field, a dialog or the More menu (`editorShortcuts.ts:2-20`).
- A deleted or undone piece leaves the selection; the main piece falls to the next (`designStore.ts:873-883`,
  `:906-916`).
- With Select on, one selected piece keeps the Pieces list (`Project.tsx:269`), so a phone can tap a second row.
- Moves, turns, mirror and align carry whole groups and report a lock (`designStore.ts:1404-1490`, ADR-148, ADR-244).
- Selection boxes need Select on for touch, so a one-finger pan still works (`Project.tsx:1933`, `:2729`).
- Selectors in the files read return stable values; the card's `pieceIds` filter is in `useMemo`
  (`Selection.tsx:35-38`).
- Every other visible text in the files read goes through `t()`/`tr()`.
