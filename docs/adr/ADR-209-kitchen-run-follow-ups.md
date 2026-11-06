# ADR-209: Kitchen run follow-ups: mouldings, cut-out positions, edge profiles, formulas and fasteners

- Status: Pending
- Date: 2026-11-06
- Depends on: ADR-071, ADR-075, ADR-202, ADR-204, ADR-205, ADR-206
- Design: docs/ui-design.md (4. Screens: Project panel, Output, the 3D view)
- Backlog: N214
- Acceptance: browser

## Context

User (2026-11-06): "Do the same for next 50 gaps with no questions, same split/grouping for batches, add to this pr
the created adrs, no implementation yet." The user had accepted the suggested picks of the first 50 gaps, so the
picks of these eight are accepted too. Requests: G-405 "Shared worktops", "fillers, plinths, end panels and trim";
G-407 cut-outs "from sizes you enter" (not a quote); G-408 "Accept default, /batch all ready (ADR-125: run sinks and
handles)"; G-412 "To sell designed kitchens"; G-325 the user named pieces only (not a quote); G-414 "Formulas too";
G-034 "Explainable warnings with repairs"; G-380 "Hardware and fastener completeness".

Builds on [ADR-205](ADR-205-kitchen-cut-outs-worktop-corners-and-placement-precision.md) (cut-outs, profile holes,
worktop joints), [ADR-202](ADR-202-fix-phone-layout-false-texts-translations-and-segmented-controls.md) (fastener
`pt()` labels), [ADR-206](ADR-206-prints-exports-and-seller-matching.md) (formula functions) and
[ADR-204](ADR-204-complete-templates-and-the-fill-a-wall-and-fill-the-room-wizards.md) (template schema 3).
Change control: ADR-071's default "the filler repair is offered only with automatic refresh off" is replaced (G-034).
G-414's pick reads "add them when a real project needs one"; the user put it in this batch, so it is built now. Taken
in part: G-412 (edge profiles; CC0 appliance models stay G-437), G-034 (the hinge repair needs G-011, which conflicts
with ADR-057's box clearances; it stays G-436), G-408 (3D; the front view stays G-438). No spacing, depth, diameter,
radius or screw is invented (ADR-010): every such number is the user's.

## Decision

1. **Mouldings with a profile (G-405).** A crown or pelmet request gains `profile?: [Mm, Mm][]`: a cross-section the
   user types as points ("0,0; 20,0; 20,45; 0,60") or taps on a whole-mm grid, with a live drawing. The strip's box
   takes the profile's bounding width and height; 3D extrudes the section along the run. A profile with fewer than
   three points, a repeated point or crossing edges is the error `trim-profile-invalid` ("The profile of {name}
   crosses itself or has fewer than three points."). Cut list and print: `pt('profil {w} × {h} mm, desenat de tine')`.
   Absent = today's plain strip.
2. **Templates keep run requests (G-405).** `ProjectTemplate.runRequests` over template refs, remapped with new ids
   by `projectFromTemplate` and `insertTemplate`, written at template `schemaVersion` 4 only when present.
3. **Cut-out positions (G-407).** `RunSink` and ADR-205's hobs gain optional `x` (from the base's left edge to the
   cut-out) and `z` (from the worktop's front edge), whole mm; absent = centred, as ADR-205. The plan outline, the
   wide/deep diagnostics (offset + size past the base or worktop) and the note use them:
   `pt('decupaj {what} {w} × {d} mm, la {x} mm de stânga și {z} mm de față')`. Run parts fields: **From left**,
   **From front**.
4. **Cut-outs as holes in 3D (G-408).** The project build gives each worktop with a cut-out a profile hole (ADR-205
   `holes`) per cut-out; 3D extrudes it. The cut-list row keeps ADR-205's cut-out note and adds no shape note.
5. **Worktop edge profiles (G-412, part).** `Project.worktopEdges`: one `{ key, kind, size? }` per worktop, kind
   `square`, `rounded` or `bevel`, keyed like ADR-205's joints and pruned with run parts. **Edge profile** in Run
   parts: Square, Rounded, Bevelled, and **Edge size (mm)**. Rounded or Bevelled without a size is the warning
   `worktop-edge-size` and draws square. 3D draws the front edge with the radius or bevel; cut list and print note `pt('cant rotunjit R{s} mm')`,
   `pt('cant teșit {s} mm')`. Absent = square.
6. **Run requests follow variables (G-325).** `RunRequest.bindings` (ADR-166 `Binding`) with targets `front`,
   `side` (worktop overhangs) and `height` (crown, pelmet); `applyBindings` writes the numbers on each commit and the
   same diagnostics apply. The request fields get the variable picker pieces have.
7. **Conditions and stepped rounding (G-414).** Formulas accept comparisons `<`, `<=`/`≤`, `>`, `>=`/`≥`, `=`,
   `<>`/`≠` (1 or 0), `if(c, a, b)` (a when c ≠ 0) and `round(x, step)` (the nearest multiple of step). `if` joins
   ADR-206's reserved names; a step ≤ 0 or wrong argument count is a diagnostic (ADR-008). Formulas stay text.
8. **Repair fillers kept, problems in 3D (G-034, part).** The filler repair adds a `RunRequest` of kind `filler`
   (`from: [door piece, neighbour]`, `width`); `planRuns` builds it beside the door's piece in its front plane, of
   its front board, so automatic refresh keeps it and moves it with the pieces, and the repair is offered with
   refresh on. Removing the filler removes its request. The selected problem's `box` is drawn in 3D as a translucent
   red box and the chosen repair's preview as dashed outlines, the plan's "After repair" label beside them.
9. **Project fasteners and drilling (G-380).** Project Settings shows **Fasteners** with the project's counts
   (`projectFastenerCounts`). A fastener choice gains optional `edge` (mm from each end of a joint to the first and
   last fixing, saved on this device; no Dexie version, no index). Only with `edge` typed, each carcass joint gets
   `per` positions along its contact line (one centred, else from `edge` to length − `edge`, split exactly,
   ADR-003) at the other board's mid-thickness, projected from `buildModel()` (ADR-004), never saved. Output › Cut
   list draws them as dots on the part's outline, labelled "Guidance: drilling positions from your values"; print
   `pt('găuri de fixare la {list} mm, orientativ, din valorile tale')`. No diameter, depth or screw is drawn.

**Documents (ADR-011).** Project `schemaVersion` 22 (the next free after ADR-204–206's 21) stores `profile`,
`bindings` and the `filler` kind on requests, sink and hob `x`/`z`, and `worktopEdges`. Template `schemaVersion` 4
stores `runRequests`. Every older version loads unchanged. **Texts.** New UI text uses `t()` with entries in
`ru/project.ts`, `ru/variables.ts` and `ru/core2.ts`; print text uses `pt()` with ru and en entries in
`print-text.ts`. `src/core/features.ts` gains lines for items 1, 3, 5, 7, 8 and 9 (ADR-158).

## Alternatives considered

- **Keep repair fillers in `runParts` with a "repair" flag** — refresh would still need to re-place them; a request
  already does that (ADR-075).
- **A fixed edge radius per profile** — a supplier value (ADR-010); the user types it.
- **Drilling spacing chosen by the app** — ADR-074 and ADR-010 forbid it.

## Scope

- In scope: items 1–9, unit tests, a 30,000-run fuzz, `tools/kitchen-follow-ups/find-it.mjs`.
- Out of scope: the reverse-the-hinge repair (G-436); bundled CC0 appliance models (G-437); cut-outs in the room
  front view (G-438); drilling positions for joints other than carcass joints (G-439).

## Consequences

- Positive: kitchens carry real moulding and edge shapes, placed cut-outs and repairs that survive a refresh.
- Negative / risks: two schema bumps; extruded sections and holes add 3D work on phones.
- Harder to change later: the reserved `if`, the profile and edge records in saved files.

## Done when

- [ ] A crown with a typed profile has its bounding size, note and 3D section; a crossing profile gives
      `trim-profile-invalid`; a template keeps run requests at version 4, ids new (tests).
- [ ] Offsets move the sink and hob outline, notes and diagnostics; absent stays centred; the 3D worktop has a hole
      per cut-out (tests).
- [ ] Rounded and Bevelled draw in 3D and print their note in ro, ru and en; no size gives `worktop-edge-size` (tests).
- [ ] A worktop overhang and a crown height bound to a variable follow it; `if` and `round(x, step)` evaluate, and a
      step of 0 is a diagnostic (tests).
- [ ] With automatic refresh on, the filler repair is offered, applies in one undo step and survives a refresh and a
      move of its pieces (tests).
- [ ] Project Settings shows Fasteners; drilling dots appear only once `edge` is typed, at exact positions (tests).
- [ ] Project schema 21 and template schema 3 files load unchanged; every new text has its entries; the fuzz
      `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts` passes.
- [ ] `tools/kitchen-follow-ups/find-it.mjs` passes on the production build at 390 and 1280 px: **From left**,
      **Edge profile**, the moulding profile, a **Ceiling filler** in 3D, the problem box in 3D, **Fasteners** in
      project Settings and "Guidance: drilling positions from your values"; all CI checks pass.
