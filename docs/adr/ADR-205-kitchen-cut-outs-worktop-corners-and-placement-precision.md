# ADR-205: Kitchen cut-outs, worktop corners and placement precision

- Status: Pending
- Date: 2026-11-06
- Depends on: ADR-040, ADR-069, ADR-070, ADR-072, ADR-073, ADR-125
- Design: docs/ui-design.md (4. Screens: Project panel, Drawings)
- Backlog: N210
- Acceptance: browser

## Context

User (2026-11-06): "in groups of 7-10 gaps create adrs, no implementation". This ADR takes over nine gaps about
kitchen runs and placement. Their requests: G-212 "Accept default, /batch all ready (ADR-125: run sinks and handles)";
G-035 "Shared worktops", "fillers, plinths, end panels and trim", for kitchens; G-010 kitchen runs with plinth, filler,
sink front (context, not a quote); G-030 pipes and outlets checked against the pieces (context, not a quote); G-036
"Collision and clearance"; G-033 "Guided snapping"; G-110 "Distribute evenly (three or more selected pieces, along the
wall)"; G-170 "Accept default, /batch all ready"; G-032 "Duplicate, mirror and predictable rotate operations".

User accepted the gaps' suggested picks on 2026-11-06. Under G-010's pick the user chooses a mitred or butt joint for
each corner in the UI, and the app picks no default joint. G-035 and G-032 are taken over only in part (remainders G-405,
G-404).

Change control: ADR-069 accepted a ±1 mm drift on mirrored pieces ("keep the generator, accept ±1 mm"); this ADR
replaces that for mirrored copies only, and existing cut lists do not change. ADR-072 says "Nothing is cut
automatically"; the back cut-out below is made only when the user taps it, so that rule holds. ADR-099 refused a
selection that spans rows; this ADR replaces that refusal (G-110). Sizes are what the user types. No cut-out
clearance, appliance size or fixing is invented (ADR-010).

## Decision

1. **Worktop corners (G-010).** Runs (`groupRuns`) are also found along the side walls: floor base units turned a
   quarter (`rotationY` 90/270) are grouped along z, and their worktop runs along z. Two runs at right angles whose
   worktops overlap or meet in plan make a **corner**. The joint is stored in `Project.worktopJoints`
   (`{ id, a, b, kind: 'mitre' | 'butt', through? }`, where a and b are the worktops' `from` keys). There is **no
   default joint**: until the user picks one, the error `worktop-corner-joint` ("The worktops over {a} and {b} overlap at the corner: choose a
   mitred or butt joint.") blocks export (ADR-008). **Mitred**: both worktops reach the outer corner, and each one is a
   profiled part (ADR-040) cut along the line from the inner corner (where the front edges meet) to the outer corner.
   All points are whole mm. **Butt**: the worktop the user marks _Runs through_ reaches the outer corner, and the other
   stops at its front edge. The plan draws the joint line. Each cut-list row notes "mitre joint" or "butt joint
   against {other}". A joint is refreshed and pruned with its run parts (ADR-061). Existing run parts do not change,
   and a side-wall run gets parts only when the user asks for them (Suggest). Run parts panel: **Worktop corner**,
   **Mitred joint**, **Butt joint**, **Runs through**.
2. **Hob cut-outs and the cut-out outline (G-035, G-212).** **Hob** in Run parts works like Sink (ADR-125). It goes
   over a chosen base, with a width and depth the user types, stored as `Project.hobs` (same shape as `RunSink`).
   Hobs get the same three diagnostics with hob wording (`hob-no-worktop`, `hob-cutout-wide`, `hob-cutout-deep`).
   The worktop's cut-list row gets the note "hob cut-out W × D mm". Sink and hob notes move from the label into the
   row's notes column, so the printed sheet and CSV show them in the print language
   (`pt('decupaj chiuvetă {w} × {d} mm')`, `pt('decupaj plită {w} × {d} mm')`). The plan outlines each sink and hob
   cut-out dashed on its worktop, labelled with its size. A cut-out has no stored position, so the outline is centred on its base and on the
   worktop depth (G-407).
3. **Back cut-out at a pipe or outlet (G-030).** The `covers-service` warning on a back gets a repair, **Cut the back
   around it**, which the user taps. It stores the room feature id in `ProjectItem.backCuts`. In the project build,
   that back becomes a profiled part (ADR-040) with a cut-out exactly the size of the zone the user typed (no
   clearance added): a notch when the zone reaches an edge of the back, otherwise a hole
   (`PanelShape` profile gains `holes?: [Mm, Mm][][]`). The 3D view extrudes the holes, the cut list and print note
   "cut-out W × H mm at u/v mm from left/bottom" (`drillingRo`, `pt()`), and the warning goes away. A piece typed at
   an angle is refused, with the reason. Tests are added for a worktop over a pipe, a plinth over a pipe, and a
   template saved with its room that keeps its pipes and outlets.
4. **Clearance zones in 3D and templates (G-036).** The same **Clearances** toggle also draws every zone in `pm.zones`
   in 3D: a translucent box, coloured by its worst problem. The plan draws the installation zone as the floor strip in
   front of the unit, as deep as the unit is high (where it lies before it is tipped up), with a quarter arc of that
   radius drawn like a door swing. Template items carry `zones`.
5. **Height snapping (G-033).** In the room front view, a selected wall unit can be dragged up and down, through
   `setWallHeight` (ADR-122), as one undo step. Both that drag and the 3D height drag snap the unit's underside or top
   within `SNAP_RANGE` (60 mm, ADR-070) to these lines: the worktop line (the top of the run worktop, or of the base
   units below when there is no worktop), and the undersides and tops of the other wall units. The nearest line wins,
   with ties broken by the line's kind and then the piece id. **Snap** off or **Alt** places freely. A hint names the
   line: "Snapped to the worktop line, {h} mm" or "Snapped to {name}, {h} mm".
6. **Distribute each row (G-110).** `distributeItems` groups the selected blocks into rows (heights that overlap,
   chained). It spaces each row of three or more on its own. A row with fewer than three stays where it is, and the
   result names it in `skipped` ("{names}: fewer than three in this row"). The refusal "Distribute works on pieces in
   one row…" is deleted, with its translations. The join rules (ADR-100) stay for joins only; centre snapping does
   not use them.
7. **Angled pieces (G-170).** An angled piece's connectors are its turned faces. A face snaps to the parallel face of
   another piece turned to the same angle; against a wall, the nearest corner of the turned outline snaps to it. The
   snapped position is rounded to whole mm (ADR-003) away from the neighbour, so the pieces never overlap and the gap
   left is under 1 mm. The mm amounts in overlap and blocked-opening
   messages are measured on the turned boxes (separating-axis penetration, rounded up).
8. **Mirrored copies match to the mm (G-032, drift only).** `SplitSpace` gains `remainderFirst?: true`.
   `distribute` (geometry.ts) then gives the rounding remainder to the first flexible part instead of the last. `mirrorSpace` toggles the flag on
   every `x` split, so the remainder stays on the same physical part. A mirrored piece's parts then match the
   original's to the mm, and mirroring twice gives the same design back. Designs without the flag build as before.

**Documents (ADR-011).** Project `schemaVersion` 21 stores `worktopJoints`, `hobs` and `backCuts`. Design
`schemaVersion` 9 stores `remainderFirst`. Template `schemaVersion` 3 stores item `zones`. Every older version still
loads unchanged. Geometry comes only from `buildModel()`/the project build (ADR-004), in whole mm (ADR-003).

**Texts.** Each new UI string goes through `t()` with its entry in `src/core/i18n/ru/<area>.ts`. Each new print or CSV
string goes through `pt()` with its Russian and English entries in `print-text.ts`. Deleted strings lose their
entries. `src/core/features.ts` gains a line for each item above (ADR-158).

## Alternatives considered

- **Default to a butt joint at corners.** Rejected: the user chooses the joint, and the app picks none (G-010).
- **Cut the back around a pipe automatically.** Rejected: ADR-072 leaves each cut to the user.
- **Symmetric split rounding for every design.** Rejected: it would change the cut lists of existing designs. The
  flag changes only the pieces mirrored from now on.
- **Draw the cut-outs in 3D and in the front view as well.** Rejected: the suggested pick is the plan only (G-212).
  The rest is G-408.

## Scope

- In scope: items 1–8, the tests, a 30,000-run fuzz, and the browser find-it.
- Out of scope: hand sides for the lounger and daybed (G-404); profiled mouldings, run requests in templates, and the
  ceiling-filler find-it (G-405); electrical rules (G-406); a typed cut-out position (G-407); cut-outs drawn in 3D or
  the front view (G-408); worktop joint fixings (G-409); angled pieces in runs (G-171).

## Consequences

- Positive: kitchens can turn a corner with a joint that can be cut. Hobs and sinks are on the printed list, backs
  can be cut around pipes, and pieces line up and mirror exactly.
- Negative / risks: the runs found along the side walls touch every run-part path, so the run-part fuzz must cover
  quarter-turned pieces. The schema goes up in three documents.
- Harder to change later: the joint, hob, back-cut and split-flag records in saved files.

## Done when

- [ ] An L of two runs gets two worktops and the error `worktop-corner-joint` until a joint is picked. Mitred gives two
      profiled worktops that meet on the diagonal, and Butt gives one worktop through and one shortened. The
      cut-list notes and the plan joint line are covered by tests, and the run-part fuzz includes quarter-turned runs.
- [ ] A hob over a base appears with the size the user typed in the cut list, the CSV and the printed sheet (ro, ru,
      en), with its three diagnostics. The plan draws the sink and hob outlines (tests).
- [ ] Cut the back around it gives a back with a notch or a hole of the zone's size, notes it in the cut list and
      print, and clears the warning. The worktop-over-pipe, plinth-over-pipe and template-keeps-pipes tests pass.
- [ ] Clearances draws translucent zone boxes in 3D, and the plan draws the installation strip and arc. A template
      keeps the item zones (tests).
- [ ] The height drag in the front view and in 3D snaps to the worktop and wall-unit lines within 60 mm, and Snap off
      or Alt places freely (tests). Distribute spaces each row. An angled piece snaps along its turned faces with
      exact overlap amounts. A mirrored copy matches the original to the mm, and mirroring twice returns it (tests).
- [ ] Project schema 20, design schema 8 and template schema 2 files load unchanged (tests). The command
      `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts` passes, and every new text has its `t()`/`pt()` entries.
- [ ] `tools/kitchen-corners/find-it.mjs` passes against the production build at 390 and 1280 px. From the bare app
      it finds **Worktop corner**, **Mitred joint**, **Butt joint**, **Runs through**, **Hob**, **Cut the back around
      it**, **Snapped to the worktop line**, and the zones in 3D under **Clearances**.
- [ ] All CI checks pass.
