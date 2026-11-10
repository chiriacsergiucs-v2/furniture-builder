# UI audit 07 — Construction: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Construction (`src/ui/info/features.ts:486-638`, 43 feature lines in five groups)
- ADR: [ADR-253](../adr/ADR-253-ui-audit-construction-typed-sizes-kept-as-typed.md)
- Method: code reading with file:line citations; reproductions run as throwaway jsdom tests outside the repo
  (vitest with a scratch config over `tests/find-it/setup.tsx`, at 1280 and 390 px). No repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. Every construction choice of a single piece is in the
piece's **Settings** (`src/ui/Settings.tsx:64-72`, `Inspector mode="configure"`); a project piece's are in "Size,
boards and construction" (`Settings.tsx:90-114`). Space choices (contents, fronts, handles) are in **Compose** after
selecting a space (`src/ui/Inspector.tsx:413-655`, `SpaceEditor`). Kitchen-run features live in the project's
Settings › Run parts (`src/ui/Project.tsx:251`, `RunParts` `Project.tsx:3102`) and under the project Compose panel
(`Project.tsx:3176-3178`). Model work is in `src/core` (`buildCabinet` `cabinet.ts:261`, `buildCorner` `corner.ts:438`,
`buildDesk` `desk.ts:38`, `buildFrame` `frame.ts:64`, `buildPanel` `panel.ts:18`, `buildPanelSet` `panelset.ts:45`).

### Carcass (:489-512)

| #   | Feature line                                   | Sub-flow: entry → steps → end state                                                                                        | Code                                                                                   | Covering test                                                           | P/D |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --- |
| 1   | Sides, top, bottom, plinth and back (:492)     | Settings › Construction › Top / Bottom / Back segments, Back set in, Plinth height / set back → `updateCabinet` → rebuilt | `Inspector.tsx:1083-1177`, store `designStore.ts:2015`, core `cabinet.ts:370-470`      | `tests/constructions.test.ts`, `tests/core.test.ts`                     | P D |
| 2   | Doubled top (:498)                             | Settings › Construction › Top layers › Doubled → two `top` panels                                                          | `Inspector.tsx:1102-1116`, `cabinet.ts:383-390,437-462`                                | `tests/constructions.test.ts:395-404`, fuzz                             | P D |
| 3   | Rails instead of a full top (:499)             | Top made of › Two rails → Rail depth → front and back rails                                                                | `Inspector.tsx:1093-1127`, `cabinet.ts:412-435`                                        | `tests/constructions.test.ts`                                           | P D |
| 4   | Cabinet with no bottom (:500)                  | Bottom › None → warning `no-bottom` for a floor cabinet                                                                    | `Inspector.tsx:1128-1137`, `cabinet.ts:463-470`                                        | `tests/constructions.test.ts`                                           | P D |
| 5   | Wall cabinets (:501)                           | Stands on › Wall brackets → Underside above the floor (ƒ bind) → brackets and rail in Hardware                            | `Inspector.tsx:1058-1082`, `cabinet.ts:505-522`                                        | `tests/constructions.test.ts`, `tests/corner-mount.test.ts`             | P D |
| 6   | Corner cabinets (:503)                         | New single piece › Blind corner › Settings › Type (Blind/L/Diagonal), Corner on the, sizes, Stands on                      | `Inspector.tsx:1301-1517`, `corner.ts:438-474`                                         | `tests/find-it/corner-mount.test.tsx`, `tests/corner-handle-side.test.ts` | P D |
| 7   | Tall cabinets (:509)                           | Catalog tall unit or a cabinet made tall → same Settings; anti-tip line in Hardware                                        | `Inspector.tsx:997-1230`, `rules.ts:160-162`                                           | `tests/constructions.test.ts`                                           | P D |

### Doors and fronts (:513-543)

| #   | Feature line                                  | Sub-flow                                                                                                         | Code                                                                    | Covering test                                                    | P/D |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- | --- |
| 8   | Hinged doors, one or a pair (:516)            | Compose › space › Doors and handles › Front Door/Pair › Hinges on                                                | `Editors.tsx:42-86`, `Inspector.tsx:609-642`                            | `tests/find-it/piece-editor-inputs.test.tsx` (hinge kept)        | P D |
| 9   | Overlay, half-overlay and inset fronts (:521) | Settings › Doors and drawer fronts                                                                               | `Inspector.tsx:1178-1188`                                               | `tests/constructions.test.ts`, `tests/core.test.ts`              | P D |
| 10  | Exact gaps between fronts (:526)              | Settings › Gap between fronts (Gap around fronts when inset)                                                     | `Inspector.tsx:1189-1199`, corner `:1505-1512`                          | `tests/core.test.ts`, fuzz                                       | P D |
| 11  | Sliding doors (:531)                          | Front › Sliding → count 2–4, Overlap, Track depth → track line in Hardware                                       | `Editors.tsx:88-122`, `cabinet.ts:685-693`                              | `tests/constructions.test.ts`                                    | P D |
| 12  | Lift-up and drop-down flaps (:532)            | Front › Flap → Opens → Fitting you chose → stay line, warning until named                                        | `Editors.tsx:124-157`, `cabinet.ts:714-727`                             | `tests/constructions.test.ts`                                    | P D |
| 13  | No doors or handles inside other doors (:537) | Inner space of a doored space → hint "This space is inside the doors…", no Front                                | `Inspector.tsx:620-632`                                                 | `tests/find-it/inside-doors.test.tsx`                            | P D |
| 14  | Front-only panels (:538)                      | New single piece › appliance door / cover panel → Used as, Width, Height, Board, Handle                          | `Editors.tsx:414-480`, `panel.ts:18-100`                                | `tests/diagnostic-golden.test.ts`, `tests/arrange.test.ts`       | P D |

### Drawers (:544-553)

| #   | Feature line                                         | Sub-flow                                                                                                                 | Code                                                      | Covering test                                           | P/D |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------- | --- |
| 15  | Drawer boxes with runner choice and clearances (:547) | Settings › Drawers and runners › Runner clearance each side, Height clearance, Space behind runner, Runner lengths you can buy | `Inspector.tsx:1233-1298`, `cabinet.ts:1270-1282`         | `tests/core.test.ts`, fuzz; no UI test of Runner lengths | P D |
| 16  | Drawer boxes without an inner front (:552)           | Drawers and runners › Box has an inner front off                                                                         | `Inspector.tsx:1267-1276`                                 | `tests/find-it/inner-front.test.tsx`                    | P D |

### Kitchen runs (:554-622)

| #     | Feature line                                                         | Sub-flow                                                                                                         | Code                                                                                         | Covering test                                                                    | P/D |
| ----- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --- |
| 17-19 | Run parts; one plinth; scribe allowance (:557-563)                    | Project Settings › Run parts → suggested worktop, plinth, fillers, covers, kept up to date; scribe setting       | `Project.tsx:3102`, core `refreshRunParts` `project.ts:3479`, scribe `project.ts:463,550`    | `tests/core.test.ts`, `tests/assembly.test.ts`                                   | P D |
| 20-21 | Worktop over chosen pieces; crown, pelmet, ceiling filler (:564-569) | Run parts › Add worktop over… / Add trim… → tick adjacent units → overhangs / trim height (no default)            | `RunRequests.tsx:347-531`, `:535-565`                                                        | `tests/trims-worktop.test.ts`, `tests/find-it/kitchen-follow-ups.test.tsx`       | P D |
| 22-23 | Handles for a whole run; shown in the piece editor (:570-576)         | Compose › Handles for this run… → Run, Handle, Hole centres, line → `setRunHandle`; piece editor shows it read-only | `RunRequests.tsx:692-930`, `Inspector.tsx:659-679`, `applyRunHandles` `project.ts:2373`      | `tests/find-it/run-handles.test.tsx`, `tests/find-it/piece-safety.test.tsx`      | P D |
| 24,29 | Sink and hob cut-outs (:577,:582)                                    | Add sink… / Add hob… → base, Cut-out width/depth (typed, no default) → listed with From left / From front        | `RunRequests.tsx:931-1000`, `:607-668`                                                       | `tests/find-it/run-handles.test.tsx`, `kitchen-follow-ups.test.tsx:140-155`      | P D |
| 25-26 | Runs along side walls; worktop corners (:578-583)                    | Turned base units form side runs → Worktop corner › Mitred / Butt joint (export blocked until chosen)            | `RunRequests.tsx:1012-1090`, `worktopCorners` `project.ts:2614`, `project.ts:2238-2280`      | `tests/kitchen-corners.test.ts`                                                  | P D |
| 27,30 | Cut-outs drawn on the plan / placed from left and front (:584-604)   | Plan marks; From left / From front, empty = centred                                                               | `RunRequests.tsx:1092`, `cutoutOutlines` `project.ts:2541`, `RunRequests.tsx:607-668`        | `kitchen-follow-ups.test.tsx:140-155`                                            | P D |
| 28    | Moulding profiles drawn or typed (:598)                              | Trim › Moulding profile text or tap-to-draw → validated profile                                                   | `RunRequests.tsx:181-298`                                                                    | `kitchen-follow-ups.test.tsx`                                                    | P D |
| 31    | Templates keep run requests (:599)                                   | Save project as template → new project → requests remapped                                                       | `remapRunRequests` `projectTemplate.ts:164`, `projectFromTemplate` `:286`                    | `tests/find-it/template-keeps.test.tsx`                                          | P D |
| 32    | Cut-outs as holes in the 3D worktop (:605)                           | Build & Preview › 3D                                                                                              | `src/viewer/Viewer3D.tsx:237`                                                                | `tests/fusion.test.ts` (core); 3D not in jsdom                                   | P D |
| 33    | Worktop edges square, rounded or bevelled (:606)                     | Run parts › worktop › Edge profile › Edge size (no default)                                                       | `RunRequests.tsx:133-179`                                                                    | `kitchen-follow-ups.test.tsx`                                                    | P D |
| 34    | Worktop overhangs and trim heights follow variables (:611)           | ƒ beside Front / Side overhang and Trim height                                                                    | `RunRequests.tsx:64-121`, `:300-345`                                                         | `tests/variables.test.ts`, `kitchen-follow-ups.test.tsx`                         | P D |

### Other kinds of furniture (:623-637)

| #   | Feature line                                       | Sub-flow                                                                                                       | Code                                       | Covering test                                         | P/D |
| --- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------- | --- |
| 35  | Desks with pedestals (:626)                        | New single piece › Desk → Settings → pedestals as spaces, drawer settings                                     | `Inspector.tsx:1793-1990`, `desk.ts:38`    | `tests/core.test.ts`, `tests/defaults.test.ts`        | P D |
| 36  | Tables, benches, stools, chairs and beds (:627)    | Settings → frame sizes, Top/Seat, back, rake, legs, rails, stretchers, mattress                               | `Editors.tsx:508-930`, `frame.ts:64`       | `tests/catalog-families-210.test.ts`, `tests/common-shapes.test.ts` | P D |
| 37  | Shaped parts (:632)                                | Raked backs (Back rake °), splayed legs, profiled fronts; whole mm                                             | `Editors.tsx:713-723`, `frame.ts`          | `tests/constructions.test.ts`, fuzz                   | P D |
| 38  | Loose panel sets (:633)                            | New single piece › Loose panels → Add panel → Name, Length, Width, Quantity, Board, Placed in the assembly     | `Inspector.tsx:1520-1705`, `panelset.ts:45` | `tests/catalog.test.ts`, `tests/assembly.test.ts`     | P D |

## Bug hunt

Each check below was applied to every sub-flow: empty / error / storage failure / undo / reload, double tap, edge
input (0, negative, huge, non-integer, locked, angled), i18n, accessibility (role, label, focus, invalid state),
390 px, ADR-004 and ADR-008, selector stability, persistence. Only what failed is listed.

### D07-F1 — A decimal point or comma is dropped, so "2.5" is saved as 25 mm (Proven, major)

`MmField` keeps only digits and "-" while typing (`src/ui/controls.tsx:81`), so "2.5" becomes "25" and "10,5" becomes
"105" before validation; both pass as whole numbers in range and are committed. Every Construction size uses
`MmField` (`Inspector.tsx:1030-1225`, `Editors.tsx:105-121`). The kitchen-run fields strip "." and "-" the same way:
Trim height (`RunRequests.tsx:556`), Cut-out width/depth (`:592`), From left / From front (`:656`); so do Clearances
(`Clearances.tsx:58`). The drawer front height field built by ADR-199 rejects "1.5" with "Enter a positive whole
number of millimetres." (`tests/find-it/piece-editor-inputs.test.tsx:55-59`), and the runner hint itself says
"12.5–13 mm is common" (`Inspector.tsx:1249`).

Reproduction (Sideboard › Settings, both widths):
`D07-F1 @1280 typed "2.5" field shows "25" aria-invalid=false; shelfSetback 20 -> 25` and
`D07-F1 @390 typed "10,5" in Plinth height; plinthHeight 80 -> 105`.

### D07-F2 — Text out of range disappears on blur, with its error (Proven, minor)

`MmField.commit` resets the text to the saved value when it is not valid (`controls.tsx:52-59`); Enter blurs
(`controls.tsx:83-86`). The error shows while typing and is gone after Tab or Enter, the field shows the old value,
and nothing says the edit was refused. ADR-199 rejected this pattern for split and drawer sizes: "resetting on blur
hides the mistake" (`docs/adr-done/ADR-199-fix-the-piece-editor-design-findings.md:31`).
Reproduction: `D07-F2 @1280 typed 300: error while typing=true; after Tab field="80" aria-invalid=false error
shown=false; plinthHeight 80 -> 80` (same at 390).

### D07-F3 — Runner lengths you can buy: wrong entries are dropped silently; wrong text stays shown (Proven, minor)

The field is uncontrolled (`Inspector.tsx:1284-1295`): on blur it keeps only positive integers and saves them, with no
error, no `aria-invalid` and no message for what it dropped; text with no valid number is not saved and stays in the
field. Reproduction: `typed "450, 5OO, 550.5, -300": runnerLengths [250,300,350,400,450,500,550,600] -> [450]
field="450, 5OO, 550.5, -300" aria-invalid=null` and `typed "abc": runnerLengths [450] field="abc"
aria-invalid=null alert=` (both widths). The loose-panel **Name** field has the same shape: an emptied name is not
saved and the field stays empty (`Inspector.tsx:1586-1597`, Code-evident).

### D07-F4 — Doubled, then Two rails: a warning about a control that is no longer shown (Proven, minor)

"Top layers" is shown only for a full-panel top (`Inspector.tsx:1102`); choosing Two rails keeps `topLayers: 2`
(`Inspector.tsx:1099`) and the model warns `top-layers-rails` (`cabinet.ts:384-388`). To clear it the user must go
back to A full panel, pick Single, then Two rails again. ADR-105 chose both the warning and the "shown when the top is
a full panel" rule (ADR-105 lines 36-37). Reproduction: `D07-F4 @390 topLayers=2 topKind=rails
warning=true Top layers control shown=false`.

### D07-F5 — Corner Type › Diagonal replaces what is inside without asking (Proven, minor)

`CornerEditor` swaps a non-shelves interior for one shelf and a door when Diagonal is chosen (`Inspector.tsx:1352-1366`),
because a diagonal holds shelves only (`corner.ts:166-171`). Every other replacement of a space asks first
(`Inspector.tsx:507-515`, `:855-860`, `:979-984`, `:1947-1951`). Reproduction: `D07-F5 interior before
{"kind":"drawers","count":3} after {"kind":"shelves","count":1,"front":{"kind":"doors","count":1}} confirm
asked=false`. Undo restores it.

## Checked, no finding

- Every visible text in `Inspector.tsx`, `Editors.tsx` and `RunRequests.tsx` goes through `t()`/`tr()` (a scan for
  literal JSX text and literal `label`/`title`/`placeholder`/`aria-label` found none).
- Selectors in the editors return store values or primitives; the drawer-front list filters in a `useMemo` outside
  the selector (`Inspector.tsx:739-745`), a projection of the model (ADR-004).
- Trim height, cut-out sizes and offsets show an inline error with `aria-invalid` for out-of-range numbers
  (`RunRequests.tsx:535-668`); only the stripping of "." and "-" is wrong (F1).
- Inner spaces of doored spaces: front and handles hidden with a hint (`Inspector.tsx:620-632`), covered by
  `tests/find-it/inside-doors.test.tsx`.
- Wall cabinet and hung corner: plinth fields hidden, hardware line asks for brackets
  (`tests/find-it/corner-mount.test.tsx`).
- Sliding defaults 30/80 mm are the ADR-037 user-confirmed defaults (ADR-037 line 66), not invented.
- The run handle in the piece editor is read-only and labelled "Set by Handles for this run" (`Inspector.tsx:659-679`).
