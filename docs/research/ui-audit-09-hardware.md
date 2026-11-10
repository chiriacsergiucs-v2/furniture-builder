# UI audit 09 — Hardware: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Hardware (`src/ui/info/features.ts:751-784`, 5 feature lines)
- ADR: [ADR-256](../adr/ADR-256-ui-audit-hardware-typed-counts-and-names-kept.md)
- Method: code reading with file:line citations; reproductions run as throwaway tests outside the repo (vitest with a
  scratch config: jsdom over `tests/find-it/setup.tsx` at 1280 and 390 px, and a node test of `tr()` in Russian). No
  repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. The Hardware list is the **Hardware** tab of Results
(`src/ui/Output.tsx:44,84`, `Hardware` `:369-411`), fed by `useView().hardware` (`src/store/useView.ts:89,106`:
`hardwareSummary` `src/core/cutlist.ts:121-130` for a piece, `projectHardware` for a project). Fasteners are in a
piece's Settings (`src/ui/Settings.tsx:71,109`) and the project Settings (`src/ui/Project.tsx:255`), component
`FastenersPanel` (`src/ui/Fasteners.tsx:35-73`); the list is saved on the device (`src/store/fastenerStore.ts`).

| #   | Feature line (features.ts)                        | Sub-flow: entry → steps → end state                                                                                                                                       | Code                                                                                                                         | Covering test                                                                          | P/D |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --- |
| 1   | Hardware schedule (:754)                          | Results › Hardware → table Qty / Item / Size / Note, guidance tip; empty: "No hardware needed yet…"                                                                       | `Output.tsx:369-411`; lines from `cabinet.ts:210-225,505-522,685-693,714-727,780-890,1270-1290`, `corner.ts:376-450`, `rules.ts:160-162` | `tests/core.test.ts`, `tests/constructions.test.ts`, `tests/find-it/corner-mount.test.tsx` | P D |
| 2   | Handles: bar, knob or push to open (:760)         | Compose › space › Doors and handles › Handles on the doors/drawers › Bar (Hole centres, Position) / Knob / Push → handle or push-latch line                               | `Inspector.tsx:681-731`, `cabinet.ts:204-225`, `panel.ts:55-91`                                                              | `tests/core.test.ts`, `tests/find-it/run-handles.test.tsx`                             | P D |
| 3   | Fastener counts (:765)                            | Settings › Fasteners › per joint type: Your fastener, Per {one} → Hardware tab "Fasteners — guidance" table (Count, To buy)                                                | `Fasteners.tsx:35-232`, `fastenerCounts` `src/core/fasteners.ts:188`                                                         | `tests/fasteners.test.ts`, `tests/find-it/assembly-steps.test.tsx:55`                 | P D |
| 4   | Project fasteners and drilling positions (:771)   | Project Settings › Fasteners (project counts) › Carcass joint › From each end (mm) → Parts shows "Guidance: drilling positions from your values"; too-short joints counted | `Fasteners.tsx:164-183`, `projectFastenerCounts` `fasteners.ts:243`, `fixingSpots` `:340-351`, `Output.tsx:188-192`         | `tests/find-it/kitchen-follow-ups.test.tsx:157-189`                                    | P D |
| 5   | Hardware you choose yourself (:776)               | Sliding track line; Flap › Fitting you chose (warning until named); appliance niche and front fixing lines; wall brackets to choose                                        | `Editors.tsx:88-157`, `cabinet.ts:685-727,815-823`, `panel.ts:93-100`, `corner.ts:446-451`                                   | `tests/constructions.test.ts`, `tests/i18n-data.test.ts` (built-in texts only)         | P D |

## Bug hunt

Each check below was applied to every sub-flow: empty / error / storage failure / reload, double tap, edge input,
i18n, accessibility (role, label, focus, invalid state), 390 px, ADR-004 / ADR-008 / ADR-010, selector stability,
persistence. Only what failed is listed.

### D09-F1 — Fasteners: "1.5" per joint is saved as 15, "37.5" mm from each end as 375 (Proven, major)

`Per {one}` and `From each end (mm)` keep only digits while typing (`Fasteners.tsx:147,168`), so a decimal turns into a
ten-times-larger whole number that passes validation and is saved. "Per" multiplies **To buy** (`Fasteners.tsx:221`)
and the Shopping list; "From each end" places the guidance drilling dots. Same root cause as D07-F1 in another
component. Reproduction (Sideboard › Settings › Fasteners): `D09-F1 @1280 typed per "1.5" -> field "15"
aria-invalid=false; typed edge "37.5" -> field "375"; saved {"joint":"carcass-joint","name":"Confirmat
7x50","per":15,"edge":375}` (same at 390).

### D09-F2 — A fitting or screwed joint named by the user stays English in Russian (Proven, minor)

The flap line is built as `` `Flap fitting: ${fl.fitting}` `` (`cabinet.ts:718-720`) and a panel set's screwed joint as
`` `Screws: ${a.name} to ${b.name}` `` (`panelset.ts:137`); the Hardware tab and Shopping show them through
`tr(h.label)` with no parameters (`Output.tsx:403`, `Shopping.tsx:401`). The Russian keys exist with placeholders,
`'Flap fitting: {name}'` and `'Screws: {a} to {b}'` (`src/core/i18n/ru/data-parts.ts:220-221`), but `trLoose` only
fills numeric placeholders (`src/core/i18n/index.ts:110-124`) and the label is not a key. `tests/i18n-data.test.ts`
covers built-in designs only. Reproduction (`tr` in Russian): `MISSING | Flap fitting: Aventos HK | Flap fitting:
Aventos HK` and `MISSING | Screws: Side to Top | Screws: Side to Top`, while `Built-in hob`, sliding, niche and
side-clearance notes translate. Against the translation rule (CLAUDE.md, ADR-153).

### D09-F3 — After a failed save the fastener row still shows the unsaved name (Proven, minor)

`FastenerRow` copies the choice into local state once (`Fasteners.tsx:89-92`). When `saveFastener` fails, the store
re-reads what is saved (`fastenerStore.ts:39-41,53-58`) but the row keeps the typed name and count, so it looks
saved while the Hardware tab says "choose your fastener". The group alert is shown (`Fasteners.tsx:54-59`).
Reproduction (`saveFastener` rejecting): `D09-F3 @1280 after failed save: field="Confirmat 7x50" store
choice=undefined alert="The fastener could not be saved on this device."`

### D09-F4 — Hole centres shows "96 mm" for a valid design whose bar handle has other centres (Proven, minor)

The Hole centres select offers a fixed list (`Inspector.tsx:657,711-719`), a copy of `BAR_SPACINGS`
(`src/core/project.ts:308`). A design handle accepts any whole number from 16 to 2000 (`src/core/design.ts:1012-1013`).
With 150 the select shows its first option while the model and the Hardware line say 150. Reproduction (design with
`holeSpacing: 150`, loaded): `validate=[] … select shows "96 mm" value="96"; hardware: Bar handle, 150 mm centres`.

### D09-F5 — Fitting you chose is cut at 200 characters without a word (Code-evident, polish)

The flap fitting input has no `maxLength` and its blur saves `v.slice(0, 200)` (`Editors.tsx:141-152`); the loose-panel
Name uses `maxLength={200}` so nothing is cut unseen (`Inspector.tsx:1590`). ADR-008: never clamp silently.

## Checked, no finding

- ADR-010: hinge, shelf-pin and anti-tip lines say "typical" / "confirm with the … datasheet" (`cabinet.ts:228-247,870-872`,
  `rules.ts:160-162`); the hinge and runner names are the user-confirmed defaults (ADR-010 "Confirmation").
  Brackets, flap stays, sliding systems and appliance fixings are named "choose" or "user-specified" lines.
- Fasteners never invent a screw: the panel says so (`Fasteners.tsx:48-50`), the edge hint says "No diameter, depth or
  screw is given." (`Fasteners.tsx:176-179`); joints shorter than twice the edge are counted and said (`Output.tsx:188-192`).
- "Per" shows an inline error with `aria-invalid` for empty or 0 (`Fasteners.tsx:143-162`); "From each end" for
  values over 5000 (`:170-182`); only the decimal stripping is wrong (F1).
- A load failure of the list shows an alert and still mounts the rows (`fastenerStore.ts:28-36`, `Fasteners.tsx:54-72`).
- Selectors return store values; counts are memoised outside the selectors (`Fasteners.tsx:20-31,40`).
- Russian for built-in hardware lines (handles with any centres, appliance kinds, niche, sliding, flap stays, side
  clearance, anti-tip): all translate in the reproduction above. Backrest and recliner positions other than the
  built-in set do not, but the editor only picks among them (`Editors.tsx:730,802`), so they come only from a file.
