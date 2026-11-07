# Gaps archive — gaps that are Done (ADR-082)

Gaps that were built or no longer apply, moved here from [GAPS.md](GAPS.md) by `pnpm gaps archive` (and by
`pnpm gaps sync`). Kept so every G id cited in an ADR or the backlog still resolves. New ids continue after the
highest id in either file.

## Gaps

### G-001: Board pictures only in 3D

- Status: Done (ADR-206)
- Origin: ADR-048, 2026-10-24 06:54 UTC; agent scoped it out
- Missing: Front-view carcass panels already show the board picture; still plain colour or outline: door/drawer fronts in the front view, the front-view SVG download (patterns stripped, src/ui/shell/files.ts:31), catalog snapshots (src/core/snapshot.ts:273,312), the plan and cut sheets.
- Request: “Render the furniture according to the selected material's color and structure”, then “any image as color/background for the material”.
- Questions: Fill which drawings with the picture: plan, front view, SVG download, catalog pictures, cut sheets?
- Suggested pick: Fill every 2D drawing with the picture as an SVG <pattern> (the data URL is already stored), rotated with the grain. Fill fronts in the front view. Use the same fill in catalog snapshots and the SVG download. Cut sheets keep a light tint, for legibility when printed. (estimate: effort +30%, value +25%)
- Work: Medium
- Impact: Medium
- Necessity: Low-medium
- Issue: Board pictures show only on front-view carcass panels; fronts, SVG download, catalog pictures and plan stay plain colour.
- Fix: Fill fronts, plan and SVG download with the picture as a grain-rotated SVG pattern; keep cut sheets tinted.
- Conflicts: ADR-048: decided catalog pictures and cut sheets use the picture's average colour.
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): text partly wrong. The front view already fills carcass panels with the picture, rotated with the grain (src/ui/Elevation.tsx:51-61, :147-164, since 009173a). Still plain colour: fronts in the front view (outlines), the SVG download (patterns stripped, src/ui/shell/files.ts:30-34), catalog snapshots (src/core/snapshot.ts:266), the plan and cut sheets.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: 2026-11-06: ADR-206 takes over fronts in the front view and the front-view SVG download; the plan, catalog pictures and cut sheets moved to G-413 (ADR-048 decided the average colour for catalog pictures and cut sheets).

### G-002: Decor list not in exports

- Status: Done (ADR-133)
- Origin: ADR-048, 2026-10-24 08:27 UTC; agent scoped it out
- Missing: The decor list is not in exported files. It has to be imported again on each device.
- Request: “Render the furniture according to the selected material's color and structure”, then “any image as color/background for the material”.
- Questions: Embed only the decors a design uses, or offer the whole list too?
- Suggested pick: Embed the decors a design uses in its export (the pictures already are), plus an optional “Include my whole decor list” checkbox. Needs a schemaVersion bump with old readers kept. (estimate: effort +10%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): origin is ADR-049 (the decor list, Dexie v6 decors), not ADR-048. Boards made from decors already travel in exported files with their code (src/core/materials.ts:286-293). Only exporting the whole decor list remains.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): the folder and .zip backup carries the decor list and restore adds it on another device (src/core/backup.ts:22, :138-199).

### G-003: Materials fields overlap at 375 px

- Status: Done (ADR-202)
- Origin: ADR-048, 2026-10-24 08:27 UTC; agent scoped it out
- Missing: At phone width the Materials row (Dialogs.tsx:362-390) collapses to a 36px 1fr grid (styles.css:2670-2672), so "Thickness" likely overlaps "Has grain"; not checked in a browser.
- Request: Phone-first (CLAUDE.md: no overlap or sideways scroll at 390 px) (context, not a quote)
- Questions: None; it is a bug.
- Suggested pick: Re-check at 375 px and fix the field grid. It is a bug, not a choice. (estimate: effort +1%, value +3%)
- Work: Low
- Impact: Low-medium
- Necessity: Medium-high
- Issue: On a phone the Materials fields likely overlap (Thickness over Has grain); never checked in a browser.
- Fix: Check at 375 px and fix the phone field grid in the Settings materials row.
- Conflicts: none
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still likely (not checked in a browser): the phone materials row is 36px 1fr (src/styles.css:2333-2335). Materials now lives in the Settings dialog (ADR-080, src/ui/Settings.tsx), not inline.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-007: Connector engine and stored connections

- Status: Done (ADR-207)
- Origin: Research, 2026-10-24 15:42 UTC; agent default, accepted by the user
- Missing: Semantic connectors (typed joint points), an assembly graph beyond side-by-side pairs, and connector authoring are not built (stored side-by-side connections exist: ADR-168, ADR-170, ADR-179; see G-092, G-329).
- Request: “Verify, then Quick wins, then Medium effort”; later “guided snapping” and “cross-family composition”.
- Questions: Write one ADR for stored connections between pieces (side by side, on top, in corner, against wall)?
- Suggested pick: One ADR for stored connections between pieces (side by side, on top, in corner, against wall). Snap, Mirror a run, run parts and Merge would all read them, so pieces move together and the plan explains why. (estimate: effort +60%, value +35%)
- Work: High
- Impact: Medium
- Necessity: Low-medium
- Issue: No typed connectors, on-top or corner connections, assembly graph or connector authoring; only side-by-side connections exist.
- Fix: One ADR extending stored connections to on-top, corner and against-wall, read by snap, mirror and merge.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: Re-checked 2026-11-05 on main c4a15bd (code read, no browser): Missing text updated to the current code.
- Note: 2026-11-06: ADR-207 takes over typed connections (side, corner, stacked, against wall) read by snap, move, Mirror a run and Merge. Run parts reading connections moved to G-420; connector authoring to G-424.

### G-008: AR, plan review, shared structural elements

- Status: Done (ADR-208)
- Origin: Research, 2026-10-24 15:42 UTC; agent default, accepted by the user
- Missing: A professional review pack (ADR-121) and common top/bottom panels (ADR-165) exist; AR placement and shared side panels between pieces are still not built.
- Request: Features from the competitor research (context, not a quote)
- Questions: Which first: WebXR AR, a review pack, or shared side panels?
- Suggested pick: AR: WebXR with the existing three.js scene (Android Chrome, offline, no new service), plus a USDZ export for iPhone Quick Look. Review: a “review pack” of print sheets plus the design file. Shared elements: one shared side panel between touching cabinets, building on ADR-047. (estimate: effort +50%, value +20%)
- Work: High
- Impact: Low-medium
- Necessity: Low
- Issue: No AR placement and no side panel shared between touching cabinets.
- Fix: WebXR AR from the three.js scene plus USDZ export; one shared side panel between touching cabinets.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: 2026-11-06: ADR-208 takes over WebXR AR and the USDZ export. Shared side panels were built by ADR-190 and the review pack by ADR-121, so nothing else remains.

### G-010: Worktop joints and corner runs

- Status: Done (ADR-205)
- Origin: ADR-054, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: No worktop joints and no corner runs. Out of scope.
- Request: Kitchen runs with plinth, filler, sink front (context, not a quote)
- Questions: Mitred or butt joint as the default? Corner runs first?
- Suggested pick: Corner runs: an L run where the worktop is mitred or butt-jointed (the user picks), with the joint drawn on the plan and listed in the cut list. Corner cabinets already exist (ADR-025). (estimate: effort +40%, value +30%)
- Work: Medium-high
- Impact: Medium
- Necessity: Medium
- Issue: Kitchen runs cannot turn a corner and worktops have no joints.
- Fix: L-shaped corner runs with a user-picked mitred or butt worktop joint, drawn on the plan and cut list.
- Conflicts: none

### G-012: Angled walls and plan tracing

- Status: Done (ADR-208)
- Origin: ADR-058/059, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: No angled walls, no tracing over a picture of a plan.
- Request: Room and floor plan (context, not a quote)
- Questions: Tracing over a picture now? Angled walls need a new ADR against ADR-003/004; wanted?
- Suggested pick: Tracing: put a picture of your plan under the drawing at a scale you set from one known wall, then draw over it. Angled walls clash with ADR-003/004 (axis-aligned) and would need a new ADR; ask first. (estimate: effort +20% (tracing), value +15%)
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: Rooms cannot have angled walls, and a plan picture cannot be traced over.
- Fix: Put a plan picture under the drawing, scaled from one known wall, and trace over it.
- Conflicts: none
- Note: 2026-11-06: ADR-208 takes over only tracing over a picture of a plan. Angled walls moved to G-428.

### G-013: Templates from selected pieces

- Status: Done (merged into G-032)
- Origin: ADR-060, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: A template can only be made from a whole project, not from selected pieces.
- Request: Reusable project templates (context, not a quote)
- Questions: Build together with multi-select (G-032)?
- Suggested pick: “Save selection as template”. It needs multi-select, which ADR-069 also left out, so build both together. (estimate: effort +15%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): merged into G-032 (it needs multi-select).

### G-016: Export blocking never tried in a browser

- Status: Done (ADR-201)
- Origin: ADR-062/064, 2026-10-24 17:52 UTC; agent scoped it out
- Missing: Not checked by any find-it: the blocked-export message (src/ui/Output.tsx:140-146) and the blocked Shopping list CSV and Print (src/ui/Shopping.tsx:202-279).
- Request: Errors block export (ADR-008) (context, not a quote)
- Questions: None; add the find-it step.
- Suggested pick: Add a find-it step: make an error, check that CSV and Print are disabled, and that the message says why. (estimate: effort +2%, value +5%)
- Work: Low
- Impact: Low-medium
- Necessity: Medium
- Issue: No acceptance test checks the blocked-export reason message or the blocked Shopping list CSV and Print.
- Fix: Add a find-it step: cause an error, check CSV and Print disabled and the reason shown.
- Conflicts: none
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. tools/editor-modes/find-it.mjs:202-216 checks CSV and Print are disabled on an error and tools/edge-band/find-it.mjs:218-221 checks CSV is blocked (both pass per N88). Not checked: the message saying why (src/ui/Output.tsx:139), and that the Shopping list CSV and Print are blocked.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-017: Drag a catalog item onto the plan

- Status: Done (ADR-094)
- Origin: ADR-065, 2026-10-24 18:55 UTC; user decision
- Missing: No dragging a catalog item from Add a piece onto the plan (option 2). You chose option 1.
- Request: “Drag and drop is implemented?”
- Questions: Build option 2 now, reusing the drag code?
- Suggested pick: Option 2 reuses the same pointer code: hold a catalog card and drop it on the plan, with the snap preview from ADR-070. (estimate: effort +25%, value +20%)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): dragging a catalog item onto the plan adds the piece (src/ui/pieceDrag.ts, src/ui/Project.tsx:1374).

### G-018: Turn by dragging; Esc selection bug

- Status: Done (ADR-169)
- Origin: ADR-065, 2026-10-24 18:55 UTC; agent scoped it out
- Missing: No turning by dragging (no turn handle on the plan). After Esc cancels a plan drag, the following click likely still selects the piece (Esc at Project.tsx:1313-1317 does not suppress the click at Project.tsx:1604-1612); not reproduced.
- Request: Drag and drop on the plan (context, not a quote)
- Questions: A 90-degree turn handle on the selected piece?
- Suggested pick: A turn handle on the selected piece that steps 90° (ADR-003 keeps whole angles). Fix the Esc bug. (estimate: effort +10%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. ADR-069 added Turn 90° buttons and R / Shift+R. No turn handle on the plan. The Esc bug is most likely still there: the piece's onClick still calls select() (src/ui/Project.tsx:1011); not reproduced.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-019: Textures in Realistic mode

- Status: Done (3a9dafe)
- Origin: ADR-067, 2026-10-24 19:55 UTC; agent default, accepted by the user
- Missing: No textures, so Realistic mode uses plain finishes (matte, satin, gloss).
- Request: “Realistic looks … rendering high quality 3D designs … to sell designed kitchens”.
- Questions: Use your own board pictures (ADR-048) as textures?
- Suggested pick: Use your own board pictures (ADR-048) as textures in Realistic mode, to scale with the grain direction. This needs no bundled files and no licence question. (estimate: effort +20%, value +35%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): resolved: Realistic mode has used the user's board pictures as textures since it shipped (src/viewer/Viewer3D.tsx:701, 715-717; UVs follow the grain). Bundled wood-grain textures were not the suggested pick and stay out (ADR-067).

### G-020: Appliances, sinks, edge profiles, client sheet

- Status: Done (ADR-206)
- Origin: ADR-067/068, 2026-10-24 19:55 UTC; agent default, accepted by the user
- Missing: Remaining: a client sheet with render and price, worktop edge profiles, bundled CC0 appliance models.
- Request: “To sell designed kitchens”.
- Questions: Client sheet first? Which licence for bundled appliance models (CC0)?
- Suggested pick: Client sheet: one printable page with the PNG render, the piece list and the ADR-062 price. Appliances come through ADR-076 imports plus a few CC0 models once you pick that licence. Edge profiles: three profile choices drawn on the worktop. (estimate: effort +45%, value +40%)
- Work: Medium-high
- Impact: Medium
- Necessity: Low-medium
- Issue: No client sheet with render and price, no worktop edge profiles, no bundled appliance models.
- Fix: One printable client sheet with render, piece list and price; three drawn edge profiles; CC0 models once licensed.
- Conflicts: none
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. Appliances and sinks can be imported as .glb (ADR-076); appliance niches (ADR-036) and a sink base exist. Remaining: client sheet, worktop edge profiles, bundled CC0 models (licence question).
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: 2026-11-06: ADR-206 takes over the printable client sheet (render, piece list, price); worktop edge profiles and bundled CC0 appliance models moved to G-412.

### G-021: Blender / glTF export

- Status: Done (ADR-206)
- Origin: ADR-068, 2026-10-24 19:55 UTC; agent default, accepted by the user
- Missing: No Blender or glTF export.
- Request: High-quality renders (context, not a quote)
- Questions: Add Export scene (.glb) with three.js GLTFExporter?
- Suggested pick: three.js already ships GLTFExporter, so no new dependency: “Export scene (.glb)” with materials and pictures, ready for Blender. (estimate: effort +10%, value +15%)
- Work: Low-medium
- Impact: Low-medium
- Necessity: Low
- Issue: The 3D scene cannot be exported to Blender or glTF.
- Fix: Add Export scene (.glb) using three.js GLTFExporter with materials and pictures.
- Conflicts: none

### G-022: Render not checked on a laptop GPU

- Status: Done (ADR-208)
- Origin: ADR-067/068, 2026-10-24 20:43 UTC; blocked by the environment
- Missing: Remaining: three-gpu-pathtracer still pinned at 0.0.27 on WebGL; no WebGPU path-tracer ADR.
- Request: Laptop, preview quality (context, not a quote)
- Questions: Can you run the render once on your laptop? Plan the WebGPU path-tracer upgrade?
- Suggested pick: Run the full render find-it on a machine with a GPU. Write an ADR for the WebGPU path-tracer upgrade before the WebGL build stops working. (estimate: effort +5%, value +10%)
- Work: Low-medium
- Impact: Low-medium
- Necessity: Low
- Issue: The path tracer is pinned to an old WebGL version with no upgrade plan.
- Fix: Write an ADR for a WebGPU path-tracer upgrade before the WebGL build stops working.
- Conflicts: none
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved per documents: ADR-068 records the user's full 256/256 render and Save PNG on a laptop; N88 ran the scripted full render and Save PNG at 1280 px and 18/18 at 390 px. Remaining: three-gpu-pathtracer still pinned at 0.0.27 on WebGL, no WebGPU ADR.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: 2026-11-06: ADR-208 takes over the WebGPU path-tracer upgrade plan. Running the render on the user's laptop moved to G-429.

### G-023: No outline on selection in Realistic mode

- Status: Done (ADR-087)
- Origin: ADR-067, 2026-10-24 20:59 UTC; agent scoped it out
- Missing: In Realistic mode a selected piece shows only a green tint, with no outline.
- Request: Select pieces in 3D (ADR-014) (context, not a quote)
- Questions: None; add the outline pass.
- Suggested pick: Add an outline pass in Realistic mode, the same as Preview mode. (estimate: effort +5%, value +5%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): duplicate of G-064 (Done, ADR-087): SelectionOutline is drawn in Simple and Realistic (src/viewer/Viewer3D.tsx:647-681), checked by tools/selection-look/find-it.mjs.

### G-024: Research marks not readable

- Status: Done (obsolete: ADR-110)
- Origin: Research, 2026-10-24 21:22 UTC; blocked by the environment
- Missing: “List my Interested features” is unanswered: the marks are only in your browser.
- Request: “List all features … I marked as interested”.
- Questions: Can you export research-decisions-<date>.json?
- Suggested pick: You export research-decisions-<date>.json once; then Claude reconciles it with the ADRs. (estimate: effort 0%, value needs your file)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): no longer applies: the user removed the research decisions download and upload on purpose (ADR-110, “Remove all, including spec export”).

### G-025: Cross-family composition and room presets

- Status: Done (ADR-210)
- Origin: Research, 2026-10-24 21:28 UTC; agent scoped it out
- Missing: No wardrobe or desk room presets that place several pieces, and a kitchen run plus a desk in one project is unchecked; Fill the room fills kitchen walls (ADR-173, ADR-177).
- Request: The 14 features you selected at 21:28 (context, not a quote)
- Questions: Check each against the app and write ADRs for what is missing?
- Suggested pick: Check each against the app with find-it. Write an ADR for whatever is missing (likely: one project mixing a kitchen run with a desk, and room presets that place several pieces at once). (estimate: effort +30%, value +20%)
- Work: Medium
- Impact: Medium
- Necessity: Low-medium
- Issue: No room presets that place several pieces; a kitchen run plus a desk in one project is unchecked.
- Fix: Find-it check of mixed projects, then an ADR for multi-piece room presets.
- Conflicts: none
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved; text partly wrong. Cross-family composition was already checked (N48, tools/ensemble/find-it.mjs: base cabinet + wardrobe + daybed). Remaining: built-in room presets that place several pieces; a kitchen run plus a desk in one project not checked.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: Re-checked 2026-11-05 on main c4a15bd (code read, no browser): Missing text updated to the current code.
- Note: ADR-210 adds room presets and checks a kitchen run with a desk; Fill the room for other rooms is G-446.

### G-026: Free-angle rotation

- Status: Done (ADR-121)
- Origin: Research, 2026-10-24 21:29 UTC; user decision
- Missing: Free-angle rotation is ruled out by ADR-003/004 (axis-aligned, whole mm).
- Request: “Predictable rotate”.
- Questions: Keep 90-degree turns only (acknowledge)?
- Suggested pick: 90° turns cover “predictable”. Free angles need a new ADR; not recommended unless you have angled rooms.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): pieces can stand at any whole-degree angle (src/core/project.ts:514-522); typing the angle is hidden, tracked by G-311.

### G-027: Bottom sheet drag, mode bar, old find-it scripts

- Status: Done (ADR-211)
- Origin: ADR-079, 2026-10-24 23:07 UTC; agent scoped it out
- Missing: Remaining: the phone bottom sheet opens only by tap (App.tsx:746-757, no drag); on desktop the Compose / Build & Preview switch is still its own row (App.tsx:687-708).
- Request: “Help with the sticky bars top and bottom, they occupy too much”.
- Questions: Three stops for the sheet (peek, half, full)? Mode switch in the top bar on desktop?
- Suggested pick: Drag handle with three stops (peek, half, full). Move the mode switch into the top bar on desktop. Update the old scripts so every earlier feature is found again in the new shell. (estimate: effort +25%, value +25%)
- Work: Medium
- Impact: Medium
- Necessity: Low-medium
- Issue: The phone bottom sheet opens only by tap, and the desktop mode switch takes its own row.
- Fix: Drag handle with peek, half and full stops; move the desktop mode switch into the top bar.
- Conflicts: ADR-079: decided the mode control sits under the app bar.
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. The old find-it scripts were fixed (N88, G-060 Done). Remaining: the phone sheet still opens only by tap (src/ui/App.tsx:673-681); the desktop mode switch is still its own row.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: 2026-11-06: ADR-211 takes over the bottom-sheet drag (peek, half and full stops); the desktop mode switch in the top bar conflicts with ADR-079 and stays in G-452.

### G-029: Light acceptance never retired

- Status: Done (obsolete: user 2026-10-28)
- Origin: Light acceptance, 2026-10-24 23:34 UTC; agent scoped it out
- Missing: Your decision to drop light acceptance was never applied. Its ADR sits unmerged on branch ccr-137ce6a6-cq7441, and its numbers ADR-080 and N75 are now taken on main by the Settings ADR. main still allows “Acceptance: light”.
- Request: “Remove the idea of find-it pending, I changed my mind”.
- Questions: Merge the unmerged ADR under the next free numbers, then catch up every pending find-it?
- Suggested pick: Give it the next free ADR and backlog numbers, merge it, then run every pending find-it (see the ADR-080 row). (estimate: effort +5%, value matches your words)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): no longer applies: the user made every ADR light (“update all adrs te be light”, ADR-126, ADR-137); CLAUDE.md R3 keeps the ADR-066 exception.

### G-030: Back cut-outs over pipes and outlets

- Status: Done (ADR-205)
- Origin: ADR-072, 2026-10-24 23:58 UTC; agent scoped it out
- Missing: Remaining: a shaped back panel with a cut-out over a pipe or outlet, electrical rules, and a test for a worktop or plinth over a pipe.
- Request: Pipes and outlets checked against the pieces (context, not a quote)
- Questions: Cut the back as a shaped part at the zone? Templates carry room features?
- Suggested pick: Make the back a shaped part with a rectangular cut-out at the zone (ADR-040 already does shaped parts), listed on the cut list and printed sheet. Templates carry room features. Add the missing test. (estimate: effort +35%, value +30%)
- Work: Medium-high
- Impact: Medium
- Necessity: Low-medium
- Issue: Back panels cannot be cut out around pipes or outlets; no electrical rules or pipe-under-worktop test.
- Fix: Shaped back with a rectangular cut-out at the zone, on cut list and print; add the missing test.
- Conflicts: none
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): text partly wrong: templates already keep pipes and outlets when the room is included (src/core/projectTemplate.ts:97, :203), untested. Remaining: shaped back with a cut-out, electrical rules, the worktop/plinth-over-pipe test.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: 2026-11-06: ADR-205 builds the shaped back, the worktop and plinth over pipe tests, and the template test. Electrical rules were not in the suggested pick and moved to G-406.

### G-032: Multi-select, fixed-hand mirroring, 1 mm drift

- Status: Done (ADR-205)
- Origin: ADR-069, 2026-10-25 00:01 UTC; agent scoped it out
- Missing: Multi-select and groups are built (ADR-097, ADR-159); remaining: the lounger backrest and daybed side panel cannot be mirrored (arrange.ts:131-135), and mirrored pieces may be ±1 mm off.
- Request: “Duplicate, mirror and predictable rotate operations”.
- Questions: Store a hand side on the lounger and daybed? Symmetric rounding for mirrored copies? Multi-select gesture?
- Suggested pick: Store a hand (left or right) on those two pieces so they mirror. Use symmetric rounding for mirrored copies so they match to the mm. Add multi-select (Shift-click or long-press) for duplicate, mirror and move together. (estimate: effort +40%, value +30%)
- Work: Medium
- Impact: Low-medium
- Necessity: Low-medium
- Issue: Lounger backrest and daybed side cannot be mirrored, and mirrored pieces may be 1 mm off.
- Fix: Store a hand side on those two pieces and use symmetric rounding for mirrored copies.
- Conflicts: none
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still valid. Absorbs G-013 (Save selection as template), which needs multi-select.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: 2026-11-06: ADR-205 takes over only the 1 mm drift (mirrored copies match to the mm). The stored hand side on the lounger and daybed and the multi-select gesture moved to G-404.

### G-033: Snapping in the front view and 3D

- Status: Done (ADR-205)
- Origin: ADR-070, 2026-10-25 00:07 UTC; agent scoped it out
- Missing: No height snapping in the front view or the 3D height drag (worktop or wall-unit lines); src/core/height.ts dragHeight only rounds. Snapped drops are stored as connections (ADR-168).
- Request: “Guided snapping”.
- Questions: Front-view height snaps first (worktop line, wall-unit line)?
- Suggested pick: Front-view snapping to heights (worktop line, wall-unit line), using the same rules. Stored snaps come from the connections ADR above. Add the hint to find-it. (estimate: effort +30%, value +20%)
- Work: Medium
- Impact: Low-medium
- Necessity: Low-medium
- Issue: Height drags in the front view and 3D only round; they do not snap to worktop or wall-unit lines.
- Fix: Snap height drags to the worktop and wall-unit lines with the existing snap rules and a hint.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: Re-checked 2026-11-05 on main c4a15bd (code read, no browser): Missing text updated to the current code.

### G-034: Hinge repair, filler repair, 3D preview

- Status: Done (ADR-209)
- Origin: ADR-071, 2026-10-25 00:10 UTC; agent default, accepted by the user
- Missing: No “Reverse the hinge” repair. The filler repair shows only with automatic refresh off. No outline or preview in 3D.
- Request: “Explainable warnings with repairs”.
- Questions: Clearance follows the hinge side (needs G-011), or drop the hinge repair?
- Suggested pick: Make the clearance follow the hinge side (see the ADR-057 row), then offer the hinge repair. Let a repair add a filler that automatic refresh keeps. Draw the problem box and the dashed preview in 3D. (estimate: effort +35%, value +30%)
- Work: Medium
- Impact: Medium
- Necessity: Medium
- Issue: No Reverse the hinge repair, filler repair only without auto refresh, no problem outline or preview in 3D.
- Fix: Hinge-side clearance then the hinge repair; fillers kept by auto refresh; draw box and preview in 3D.
- Conflicts: none
- Note: 2026-11-06: ADR-209 takes over the fillers kept by automatic refresh and the problem box and repair preview in 3D; the reverse-the-hinge repair needs G-011, which conflicts with ADR-057, and moved to G-436.

### G-035: Mouldings, sink and hob cut-outs, templates

- Status: Done (ADR-205)
- Origin: ADR-075, 2026-10-25 00:13 UTC; agent scoped it out
- Missing: Sink cut-outs exist (ADR-125); remaining: profiled mouldings, hob cut-outs, templates keeping requested trims/worktops (runRequests), and a browser check of the ceiling filler.
- Request: “Shared worktops”, “fillers, plinths, end panels and trim”, for kitchens.
- Questions: Cut-outs from sizes you enter? Templates carry run requests?
- Suggested pick: Sink and hob cut-outs on the worktop from sizes you enter (no invented appliance sizes), on the cut list and the print. Templates carry run requests. Add a ceiling filler to find-it. (estimate: effort +35%, value +30%)
- Work: Medium
- Impact: Medium
- Necessity: Low-medium
- Issue: No profiled mouldings or hob cut-outs; templates drop requested trims and worktops; ceiling filler unchecked.
- Fix: Hob cut-outs from user-entered sizes on cut list and print; templates carry run requests; ceiling filler find-it.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: 2026-11-06: ADR-205 takes over only the sink and hob cut-outs from user-entered sizes on the cut list and print. Profiled mouldings, run requests in templates and the ceiling-filler find-it moved to G-405.

### G-036: Clearance zones in 3D and templates

- Status: Done (ADR-205)
- Origin: ADR-073, 2026-10-25 00:14 UTC; agent scoped it out
- Missing: Clearance zones are not drawn in 3D and are not saved in templates. No separate installation zone on the plan.
- Request: “Collision and clearance”.
- Questions: Draw zones as translucent volumes in 3D? Draw the installation arc on the plan?
- Suggested pick: Draw zones as translucent volumes in 3D, with the same toggle. Draw the installation zone (tilt-up arc) on the plan. Templates carry zones. (estimate: effort +25%, value +20%)
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: Clearance zones are not drawn in 3D, not kept in templates, and installation has no plan arc.
- Fix: Translucent zone volumes in 3D under the same toggle, tilt-up arc on the plan, templates carry zones.
- Conflicts: none

### G-038: Band-list import and colour matching

- Status: Done (ADR-212)
- Origin: ADR-077, 2026-10-25 00:15 UTC; agent scoped it out
- Missing: Bands from the bundled seller catalog are matched to the board decor code (ADR-161); remaining: importing a supplier band list as CSV, tolerances and edgebander settings.
- Request: “Check the European standards for ABS, apply them accordingly”.
- Questions: Import a supplier band list as CSV and match bands to the board decor?
- Suggested pick: No EN standard sets band sizes; that finding stands. Closer: import a band list (CSV, like decors) and match the band to the board's decor code and picture. (estimate: effort +20%, value +20%)
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: No way to import a supplier's edge-band list as CSV; tolerances and edgebander settings are not covered.
- Fix: Import a band list as CSV like decors, matching each band to the board's decor code and picture.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: 2026-11-06: ADR-212 takes over only the band-list CSV import and its match to the board's decor code; tolerances and edgebander settings moved to G-460.

### G-040: 3D model placement and templates

- Status: Done (ADR-208)
- Origin: ADR-076, 2026-10-25 00:16 UTC; agent scoped it out
- Missing: Imported models can't be dragged, hung on a wall or put on another piece. Templates don't keep them. Nothing is bundled.
- Request: “Import 3D models and model libraries”.
- Questions: Floor, wall and on-a-piece placement with drag and snap? Bundle CC0 models?
- Suggested pick: Give models the same placement (floor, wall, on a piece) and drag or snap as pieces. Templates carry them. For “libraries”: a small bundled set of CC0 models (fridge, oven, sink, hob) once you agree that licence. (estimate: effort +35%, value +35%)
- Work: High
- Impact: Medium
- Necessity: Low-medium
- Issue: Imported 3D models cannot be dragged, wall-hung or set on a piece; templates drop them; none bundled.
- Fix: Give models the same placement, drag and snap as pieces, keep them in templates, later bundle CC0 models.
- Conflicts: none
- Note: 2026-11-06: ADR-208 takes over placement, drag, snap and templates for models. Bundling CC0 models moved to G-430.

### G-042: Project fasteners panel and Romanian labels

- Status: Done (ADR-202)
- Origin: ADR-074, 2026-10-25 00:16 UTC; agent scoped it out
- Missing: Remaining: Fasteners in the project's own Settings dialog (Settings.tsx:62-71), fastener lines and footer of the shopping CSV in the print language (shopping.ts:51-53, 288-318 use t(), not pt()), drilling patterns.
- Request: “Hardware and fastener completeness”.
- Questions: Add the project-level panel? Draw drilling positions only from your values?
- Suggested pick: Add the project-level panel. Translate the fastener labels (a bug). Draw drilling positions only from the values you enter, labelled as guidance (ADR-010). (estimate: effort +30%, value +25%)
- Work: Medium
- Impact: Medium
- Necessity: Medium
- Issue: No fasteners panel in project Settings; shopping CSV fastener lines stay English; no drilling patterns drawn.
- Fix: Add the project fasteners panel, route fastener CSV text through pt(), draw drilling only from user values.
- Conflicts: none
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. A piece's Fasteners panel is reachable from a project via Inside this piece › Size, boards and construction (ADR-090). Remaining: Fasteners in the project's own Settings dialog; the Romanian shopping CSV still writes fastener lines and footer in English (src/core/fasteners.ts, src/core/shopping.ts:32-33); drilling patterns.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: 2026-11-06: ADR-202 takes over only the fastener CSV and print text (pt()); the project-level fasteners panel and drilling positions moved to G-380.

### G-044: Catalog feed and brand filter

- Status: Done (ADR-210)
- Origin: ADR-029/052/027, 2026-10-25 06:52 UTC; user decision
- Missing: Feed (N16) and brand filter (N14) not built (user: won't do); note the Brands tab still promises "The weekly catalog feed … adds them" (Catalog.tsx:618).
- Request: “Mark 029 as won't do”.
- Questions: Feed the brand filter from your decor imports instead of IKEA (new ADR)?
- Suggested pick: The brand filter could be fed by your Egger / Kronospan decor imports (by manufacturer) instead of IKEA. It would need a new ADR replacing ADR-027's IKEA dependency. (estimate: effort +15%, value +15%)
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: Catalog feed and brand filter were cancelled by the user; the brand filter has no data source.
- Fix: Optionally feed the brand filter from the user's decor imports by manufacturer, in a new ADR.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: ADR-210 feeds the brand filter from the decor list, offline; the feed stays won't do (ADR-029, user 2026-10-25).

### G-046: Settings dialog built as light

- Status: Done (catch-up find-it 2026-10-28, tests/find-it/catch-up-editor.test.tsx)
- Origin: ADR-080, 2026-10-25 10:31 UTC; agent scoped it out
- Missing: The Settings dialog ADR (Configure moves into a modal, view captions behind an info icon) was built as light acceptance, against your 23:29 decision. N75 is Partially done, “find-it pending”, and not checked in a browser.
- Request: “Add a tooltip icon with the text on hover on desktop and on click on mobile”; earlier, “Remove the idea of find-it pending”.
- Questions: Write and run its find-it now?
- Suggested pick: Write and run its find-it (About the plan, About the front view, Settings, Compose, Build & Preview) at phone and desktop widths, then ship it. (estimate: effort +10%, value +15%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved per N88: tools/editor-modes checks Settings, Compose, Build & Preview (156/156) and tools/plan-snap checks About the plan (50/50). Remaining: no script checks About the front view or Settings for <name>; N75 stays Partially done.

### G-048: Touch and 3D checked only in emulation

- Status: Done (merged into G-047)
- Origin: Verification, all sessions; blocked by the environment
- Missing: Pieces of the 3D work and the touch features were checked only in desktop Chromium emulation.
- Request: Phone-first (context, not a quote)
- Questions: One guided session on your phone?
- Suggested pick: Same as the row above: one session on your phone, guided by a checklist. (estimate: effort +3%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): merged into G-047 (the same real-phone session).

### G-050: No gaps page in the app

- Status: Done (ADR-101)
- Origin: ADR-082, 2026-10-25; agent scoped it out
- Missing: The ledger is a repo file only; the app does not show it.
- Request: “items from it can be used to add as a new adr or mark as acknowledged and accepted”
- Questions: Is the file enough, or do you want a page (in the app, or an artifact) where you can mark gaps acknowledged or promote them?
- Suggested pick: The file, edited through Claude ("acknowledge G-012", "make ADR from G-007"); a page only if you want to triage on the phone without a session (estimate for a page: effort +40%, value +15%)

### G-051: Tap on the innermost selected space

- Status: Done (ADR-083)
- Origin: ADR-083, 2026-10-25, open question (Claude default)
- Missing: What a tap on the already selected innermost space does
- Request: The flow of selecting the furniture, then the middle (given there are 2 dividers), then having a horizontal divider, then selecting the bottom one to adjust shelves is a painful horrible user experience. Adjust the selecting to go from bigger to smaller. 1 click = entire furniture, second click selects the smaller frame, third again the smaller within, iteratively.
- Questions: Stay on the innermost space, or wrap back to the whole piece?
- Suggested pick: Stay on the innermost space, so a repeated tap while adjusting shelves never loses the selection (estimate)
- Answer: User 2026-10-25: "1 wrap back" — wrap back to the whole piece; built in ADR-083.

### G-052: Drill-down across project and piece

- Status: Done (ADR-083)
- Origin: ADR-083, 2026-10-25, open question (Claude default)
- Missing: Drill-down from the project plan/3D into a piece's spaces
- Request: The flow of selecting the furniture, then the middle (given there are 2 dividers), then having a horizontal divider, then selecting the bottom one to adjust shelves is a painful horrible user experience. Adjust the selecting to go from bigger to smaller. 1 click = entire furniture, second click selects the smaller frame, third again the smaller within, iteratively.
- Questions: In a project, does the 2nd tap on a selected piece open it in the editor with the bay under the tap selected, or keep today's separate edit step?
- Suggested pick: Continue drilling into the piece (2nd tap opens it with the bay selected): closest to '1 click = entire furniture'; estimate +30 % work, +25 % of value
- Answer: User 2026-10-25: "2 yes" — the 2nd tap on a selected piece opens it with the space under the tap selected; built in ADR-083.

### G-053: Step back up one level without the breadcrumb

- Status: Done (ADR-203)
- Origin: ADR-083, 2026-10-25, out of scope (Claude)
- Missing: Going one level back up with a gesture (Esc / long press)
- Request: The flow of selecting the furniture, then the middle (given there are 2 dividers), then having a horizontal divider, then selecting the bottom one to adjust shelves is a painful horrible user experience. Adjust the selecting to go from bigger to smaller. 1 click = entire furniture, second click selects the smaller frame, third again the smaller within, iteratively.
- Questions: Is a 'go up one level' gesture wanted besides the breadcrumb?
- Suggested pick: Esc on desktop goes up one level; estimate +5 % work
- Work: Low
- Impact: Low-medium
- Necessity: Low
- Issue: Selection can go up one level only through the breadcrumb; no key or gesture does it.
- Fix: On desktop, Esc goes up one level instead of clearing the selection.
- Conflicts: none

### G-054: Count stepper not over the 3D view

- Status: Done (ADR-085)
- Origin: ADR-084, 2026-10-25; agent scoped it out
- Missing: No stepper over the 3D view; ADR-014 says the 3D viewer only selects, never edits.
- Request: “Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber - … Placement: above the selected piece”
- Questions: Show the stepper over the 3D view too (needs a new ADR changing ADR-014)?
- Suggested pick: No: the stepper floats over the front drawing, which is shown next to 3D in Both (ADR-081); 3D stays select-only (estimate for 3D: effort +40%, value +10%)

### G-057: Acceptance level for the count stepper

- Status: Done (ADR-084)
- Origin: ADR-084, 2026-10-25; agent scoped it out
- Missing: Open question default: full acceptance (find-it script at 390 and 1280 px).
- Request: “Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber - … Placement: above the selected piece”
- Questions: Full find-it acceptance or light (ADR-066)?
- Suggested pick: Full: the request is a visible control and R3 is the default (light saves an estimated 20% effort, adds no value)

### G-058: Quick counts card still covers the 3D model on phones

- Status: Done (ADR-112)
- Origin: UI critique 2026-10-26 (N82), finding 3; agent chose not to move the card (it would reverse ADR-084/085)
- Missing: On a phone in Build & Preview the Quick counts card (two rows, ~150 px with 44 px buttons) still covers most of the 3D model; in the drawing the card's band still shifts the drawing down on the first selection
- Request: Fix them directly (findings 1-6 of the UI critique; finding 3: the count card covers the top of the drawing, shows twice in Both). Not a quote for the finding text.
- Questions: Collapse the card to a 'Quick counts' button over 3D on phones? Reserve the card band before the first selection so the drawing never moves?
- Suggested pick: Collapsible card over 3D on phones, open by default, closest to ADR-085's 'same card over 3D' (est. +30 % work vs nothing, +20 % of finding 2/3 value)
- Note: 2026-10-26, ADR-087 (G-070, user "Dock under 3D") docks the phone 3D card under the stage, so it no longer covers the model; the drawing part (the card's band shifting the drawing on the first selection) is still open.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): the count card is compact and laid over the drawing; the drawing keeps its size and scale on the first selection.

### G-059: UI critique findings 7-20 not fixed

- Status: Done (20b2b27)
- Origin: UI critique 2026-10-26 (N82); the user asked to fix findings 1-6 only
- Missing: Findings 7-20 and the minor ones: one-yellow rule broken (Create project, New piece, Next, Done, catalog Open, active nav), desktop left panel titled Compose in Build & Preview, whole-piece editing split across card / Settings / Edit the interior, catalog counts disagree (118 vs 108, Living room 31 vs 33), wall cabinets first under Living room, Romanian subtitles in the English UI, Projects row Delete icon wraps to its own line, white band behind the catalog filter row, steps rail cut off at 390 px, empty project shows blank 3D and 'No problems found', crowded catalog header on phones, '1 shelf' label over the door line, brand mark looks like a menu, unexplained I/C badges, wizard asks size before type, Skip unclear, empty phone app bar on Projects/Catalog, hardware Item column wraps, repeated 'Edge band: not named yet', 'Clean up unused pictures' as prominent as Import
- Request: Run critique this design for the entire ui/ux; then 'Fix them directly' (answered for findings 1-6)
- Questions: Which of these to fix next, and in what order?
- Suggested pick: Fix 13, 14, 16, 18 next (layout bugs and a misleading message, closest to a broken UI; est. small each)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): resolved by a9e5780, merged in PR #71 (20b2b27), except findings 8, 9 and 12 (G-073). The catalog-counts item is not confirmed in a browser (only an N ready items label was added); tracked as its own gap.

### G-060: Five find-it scripts stale since ADR-080

- Status: Done (N88, 2026-10-26)
- Origin: Found 2026-10-26 while checking N82; predates it (same failures on main 4b1141b)
- Missing: Five find-it scripts are stale since ADR-080: look-render (waits for a 'Materials' button), editor-modes (expects a 'Configure' mode), trims (radio 'Configure'), clearances ('Chair space depth' not found), plan-snap (no status in the room plan)
- Request: Not a user request: R3 requires find-it scripts to pass against the production build
- Questions: Update the five scripts to the ADR-080 layout (Settings dialog instead of Configure/Materials)?
- Suggested pick: Update all five scripts to the current UI (est. small each; restores R3 evidence for ADR-067/068, ADR-079, trims, clearances, plan snap)
- Answer: User 2026-10-26: "fix G-060 stale find-it scripts"; all 28 find-it scripts pass on the production build (N88).

### G-061: Dragging pieces never tried in a browser

- Status: Done (ef0c832)
- Origin: ADR-065, 2026-10-24 19:10 UTC; user decision
- Missing: Dragging a piece on the plan (mouse, touch, arrow keys) is merged and deployed but was never tried in a browser; find-it was skipped. N60 says Done while its text says not verified.
- Request: “Skip find-it for this onw”
- Questions: Run a find-it for dragging now, or keep N60 as Partially done until someone tries it?
- Suggested pick: Add a find-it: mouse drag at 1440 px changes From left, Undo restores; touch drag at 375 px with no sideways scroll; set N60 by the result. (estimate: effort +3%, value +6%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): resolved before this gap was written: ef0c832 (2026-10-24) added tools/plan-drag/find-it.mjs and fixed touch drag; N60 26/26, N88 28/28. Only the live / real-phone check remains (G-047).

### G-062: Which selection design

- Status: Done (ADR-087)
- Origin: ADR-087, 2026-10-26, open question (Claude default)
- Missing: Which of the five selection designs (A-E) is built
- Request: The highlight of the selected item need to be more obvious, suggest 5 designs that can be applied so it is clearer which part of the piece is selected, or if it is entirely selected
- Questions: Pick one of A outline+ghost, B subtree tint, C glass volume, D corner brackets+label, E nested level outlines (or a mix)
- Suggested pick: A, outline round the selected space and the rest faded: answers both 'which part' and 'entirely selected' at a glance; estimate equal work to B-D, +10 % value over B
- Answer: User 2026-10-26: "A" — design A, outline round the selected space and the rest faded; moved into ADR-087.

### G-063: Selection look in the front drawing

- Status: Done (ADR-087)
- Origin: ADR-087, 2026-10-26, open question (Claude default)
- Missing: Whether the chosen selection design also applies to the front drawing
- Request: The highlight of the selected item need to be more obvious, suggest 5 designs that can be applied so it is clearer which part of the piece is selected, or if it is entirely selected
- Questions: Same design in the front drawing, or 3D only?
- Suggested pick: Both views, so the selection reads the same everywhere (estimate +25 % work, +30 % value)
- Answer: User 2026-10-26: "Yes" — the same look in the front drawing; moved into ADR-087.

### G-064: Selection look in Realistic mode

- Status: Done (ADR-087)
- Origin: ADR-087, 2026-10-26, out of scope
- Missing: The new selection look in Realistic mode beyond the current tint; pictures stay without selection
- Request: The highlight of the selected item need to be more obvious, suggest 5 designs that can be applied so it is clearer which part of the piece is selected, or if it is entirely selected
- Questions: Should Realistic mode show the full selection design too?
- Suggested pick: Yes, same design in Realistic (estimate +15 % work)
- Answer: User 2026-10-26: "Yes, same as Simple" — design A (outline and fade) in Realistic too; moved into ADR-087.

### G-065: What the project panel shows for a selected space

- Status: Done (ADR-088)
- Origin: ADR-088, 2026-10-26, open question (Claude default)
- Missing: Which controls the project editor shows when a space inside a piece is selected
- Request: one more ADR, which would keep the project editor open while we click on the item second time (yes editing of ), and it gives us the opportunity to add or remove shelves and change its structure. the item is triggered, but we should be kept on the edit of the project view.
- Questions: Show the space's own panel (Contents, Doors and handles, Divide this space, Layouts) inside the project editor, or only the quick-count card over 3D?
- Suggested pick: The space's full panel plus the quick-count card: 'add or remove shelves and change its structure' needs Contents and Divide (estimate +40 % work, +50 % value over the card only)
- Answer: User 2026-10-26: "Agree" — the space's full panel plus the quick-count card in the project editor; moved into ADR-088.

### G-066: Second tap on the plan

- Status: Done (ADR-088)
- Origin: ADR-088, 2026-10-26, open question (Claude default)
- Missing: What a 2nd tap on a selected piece does on the plan, which has no height
- Request: one more ADR, which would keep the project editor open while we click on the item second time (yes editing of ), and it gives us the opportunity to add or remove shelves and change its structure. the item is triggered, but we should be kept on the edit of the project view.
- Questions: On the plan: select the piece's interior and stay in the project, or keep opening the piece editor?
- Suggested pick: Stay in the project and select the piece's interior, same as 3D (estimate)
- Answer: User 2026-10-26: "Select" — on the plan the 2nd tap selects the piece's interior and stays in the project; moved into ADR-088.

### G-067: Where a new divided part's content comes from

- Status: Done (ADR-089)
- Origin: ADR-089, 2026-10-26, open question (Claude default)
- Missing: What a new part made by a divider holds
- Request: Add a horizontal divider (image 4) adds the divider, but somehow it decided to add also two shells in it. This is not wanted behavior.
- Questions: New part empty, or a copy of the neighbouring part?
- Suggested pick: Empty: the user said the added shelves are not wanted
- Answer: User 2026-10-26: "Empty" — a new part starts empty; moved into ADR-089.

### G-068: Empty new part for every way of dividing

- Status: Done (ADR-089)
- Origin: ADR-089, 2026-10-26, open question (Claude default)
- Missing: Whether vertical dividers, the Divide buttons and the Parts counter also add empty parts
- Request: Add a horizontal divider (image 4) adds the divider, but somehow it decided to add also two shells in it. This is not wanted behavior.
- Questions: Apply 'new part starts empty' to every divider add (quick-count vertical and horizontal, Side by side, Stacked, Parts +), or only the horizontal quick count?
- Suggested pick: Every way of dividing, so the same action never behaves two ways (estimate +5 % work)
- Answer: User 2026-10-26: "Yes" — every way of dividing adds empty parts; moved into ADR-089.

### G-069: Quick-count card heading naming the selection

- Status: Done (ADR-087)
- Origin: ADR-087, 2026-10-26, cut while building (Claude)
- Missing: A heading on the quick-count card naming what it acts on (e.g. Whole cabinet)
- Request: The highlight of the selected item need to be more obvious, suggest 5 designs that can be applied so it is clearer which part of the piece is selected, or if it is entirely selected
- Questions: Worth a heading if the card must then be made smaller on phones, or is the outline enough?
- Suggested pick: Outline only (built); revisit with a smaller phone card: a heading made the card cover the tap point in the 390 px 3D view (estimate)
- Answer: User 2026-10-26: "Yes, every card" — a heading on every quick-count card, once the phone card no longer covers the 3D view; moved into ADR-087.

### G-070: Quick-count card covers much of the phone 3D view

- Status: Done (ADR-087)
- Origin: ADR-087, 2026-10-26, out of scope (seen while testing, from ADR-085)
- Missing: A placement or size of the quick-count card that leaves the piece visible in the short 390 px 3D view
- Request: The highlight of the selected item need to be more obvious, suggest 5 designs that can be applied so it is clearer which part of the piece is selected, or if it is entirely selected
- Questions: Smaller card on phones, a card docked under the 3D view, or a taller 3D view?
- Suggested pick: Dock the card under the 3D view on phones, so the piece and its outline stay in sight (estimate +10 % work)
- Answer: User 2026-10-26: "Dock under 3D" — on phones the card sits in a bar under the 3D view; moved into ADR-087.

### G-071: Selected space not marked in the project's 2D views

- Status: Done (ADR-088)
- Origin: ADR-088, 2026-10-26, out of scope (Claude)
- Missing: Outline of the selected space inside a project piece on the plan and in the room front view (taps drill there, the 3D view and the panel show it)
- Request: one more ADR, which would keep the project editor open while we click on the item second time (yes editing of ), and it gives us the opportunity to add or remove shelves and change its structure. the item is triggered, but we should be kept on the edit of the project view.
- Questions: Mark the selected space on the room front view too (the plan, seen from above, cannot show a space's height)?
- Suggested pick: Outline it on the room front view, as in the piece's front drawing (estimate +10 % work)
- Answer: User 2026-10-26: "Room front + plan" — outline the space on the room front view and its width × depth footprint on the plan; moved into ADR-088.

### G-072: Piece-wide settings from the project panel

- Status: Done (ADR-090)
- Origin: ADR-088, 2026-10-26, out of scope (Claude)
- Missing: Size, materials and carcass settings of a project piece edited from the project panel; they stay behind Edit this piece
- Request: one more ADR, which would keep the project editor open while we click on the item second time (yes editing of ), and it gives us the opportunity to add or remove shelves and change its structure. the item is triggered, but we should be kept on the edit of the project view.
- Questions: Should the project panel also edit a piece's size, boards and carcass, or is Edit this piece enough for those?
- Suggested pick: Keep them behind Edit this piece; the request was shelves and structure (estimate)
- Answer: User 2026-10-26: "Go 068" — build it; moved into ADR-090.

### G-074: Remember whether the results panel was open across reloads

- Status: Done (obsolete: user decision 2026-11-05, results tabs stay collapsed, as answered)
- Origin: ADR-091 out of scope
- Missing: The results panel always starts collapsed after a reload; its open/closed state and tab are not saved
- Request: They should be a collapsed view, onclick showing only, so the views with renders are kept as main
- Questions: Should the app remember an open results panel after a reload?
- Suggested pick: No: always start collapsed, closest to 'collapsed view, onclick showing only'
- Answer: User 2026-10-26: "Always collapsed".

### G-075: Results collapse at desktop width too

- Status: Done (ADR-091)
- Origin: ADR-091 open question
- Missing: Unconfirmed default: the results tabs collapse at every width, not only on phones
- Request: They should be a collapsed view, onclick showing only, so the views with renders are kept as main
- Questions: Collapse at desktop width too, or only on phones?
- Suggested pick: Every width: the request names no width and keeps the render views main everywhere
- Answer: User 2026-10-26: "Only phones"; built in ADR-091 (desktop keeps a tab open).

### G-076: Research app records go stale as ADRs ship

- Status: Done (ADR-212)
- Origin: ADR-092 (2026-10-26, Claude: not asked for)
- Missing: The research app records (src/core/research/ensemble-2026-10-23.app.ts) are refreshed only by one-off re-check ADRs (ADR-149, ADR-152); ship-adr/next-adr still do not update them when an ADR ships.
- Request: Text that is not a quote: follows from "mark implemented ones" (2026-10-26).
- Questions: Should ship-adr update the research app record of the feature an ADR names, or should the research page be re-checked on request only?
- Suggested pick: ship-adr updates the record (closest to keeping 'implemented' marked; about +5 % work per shipped ADR, +100 % of the freshness value; estimates).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Research records go stale between ADR ships; only one-off re-check ADRs refresh them.
- Fix: Have ship-adr update or delete the research row of the feature an ADR builds.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-077: Free-angle rotation of project pieces

- Status: Done (ADR-121)
- Origin: ADR-093 (2026-10-26, the user chose 90° steps)
- Missing: Free-angle rotation of project pieces; pieces still turn in 90° steps (ADR-022/ADR-004 kept).
- Request: "New adr to override the conflicts for 4 and make it ready" (2026-10-26)
- Questions: Override ADR-022/ADR-004 for free angles later?
- Suggested pick: Free angles with oriented-box checks (closest to the research; about 3x the work of ADR-093, +40 % of the feature's value; estimates).

### G-078: Change height by dragging in 3D

- Status: Done (ADR-122)
- Origin: ADR-093 (2026-10-26, the user chose floor plane only)
- Missing: Changing a piece's height by dragging in 3D; height comes from placement.
- Request: "New adr to override the conflicts for 4 and make it ready" (2026-10-26)
- Questions: Add a vertical handle later?
- Suggested pick: Keep height from placement (the user's answer); a handle only if asked.

### G-080: Piece list open by default on desktop

- Status: Done (ADR-094)
- Origin: ADR-094 open question (2026-10-26)
- Missing: Whether the piece list is open by default on desktop; default closed.
- Request: "New adr 6" (2026-10-26)
- Questions: Open by default on desktop?
- Suggested pick: Closed, opened with Add a piece (keeps the plan wide; open by default costs the same).

### G-081: Lock a piece's sizes and parameters

- Status: Done (ADR-122)
- Origin: ADR-095 (2026-10-26, Claude: not asked for)
- Missing: Locking a piece's sizes and other parameters (the research's locked parameters); the lock covers placement only.
- Request: "New adr 8" (2026-10-26)
- Questions: Lock sizes and boards too?
- Suggested pick: Lock named parameters (closest to the research; about +40 % of ADR-095's work, +20 % value; estimates).

### G-082: Delete a locked piece

- Status: Done (ADR-095)
- Origin: ADR-095 open question (2026-10-26)
- Missing: Whether a locked piece may be deleted; default yes after confirmation.
- Request: "New adr 8" (2026-10-26)
- Questions: Allow deleting a locked piece?
- Suggested pick: Yes with the usual confirmation (no extra work).

### G-083: Restore an older version of a project

- Status: Done (ADR-123)
- Origin: ADR-096 (2026-10-26, Claude: not asked for)
- Missing: A history of older project versions to go back to (research: version recovery).
- Request: "New adr 9" (2026-10-26)
- Questions: Keep older versions of a project to restore?
- Suggested pick: Keep the last N saves per project in IndexedDB with Restore (about 20 points; closest to the research's version recovery).

### G-084: Newer-template notice in the Library

- Status: Done (ADR-096)
- Origin: ADR-096 open question (2026-10-26)
- Missing: Whether saved designs in the Library show the newer-template notice; default yes.
- Request: "New adr 9" (2026-10-26)
- Questions: Show the notice in the Library too?
- Suggested pick: Yes (about +10 % of ADR-096's work).

### G-085: Mirror a selection of pieces

- Status: Done (ADR-121)
- Origin: ADR-097 (2026-10-26, Claude: not asked for)
- Missing: Mirroring a selection of pieces.
- Request: "New adr 2" (2026-10-26)
- Questions: Mirror a selection as Mirror the run does?
- Suggested pick: Mirror the selection about its centre (reuses ADR-069; about +10 % of ADR-097's work).

### G-086: First tap on a grouped piece

- Status: Done (ADR-097)
- Origin: ADR-097 open question (2026-10-26)
- Missing: Whether the first tap on a grouped piece selects the group; default yes, second tap the piece.
- Request: "New adr 2" (2026-10-26)
- Questions: Group first or piece first?
- Suggested pick: Group first, as ADR-083 does whole-to-part (no extra work).

### G-087: Keep a piece's own edits when replacing it

- Status: Done (ADR-124)
- Origin: ADR-098 (2026-10-26, Claude: not asked for)
- Missing: Carrying the old piece's own edits onto the replacing design.
- Request: "New adr 5" (2026-10-26)
- Questions: Try to map edits (shelves, drawers) onto the new design?
- Suggested pick: Not mapped; the confirmation says edits are replaced (mapping is unreliable across space trees).

### G-088: Compatible width when replacing

- Status: Done (ADR-098)
- Origin: ADR-098 open question (2026-10-26)
- Missing: Which width counts as compatible; default the same width, others behind a switch.
- Request: "New adr 5" (2026-10-26)
- Questions: Same width only, or a tolerance?
- Suggested pick: Same width, others behind Show other widths (closest to the research's 600 to 600 example).

### G-089: Align the heights of wall units

- Status: Done (ADR-122)
- Origin: ADR-099 (2026-10-26, Claude: not asked for)
- Missing: Aligning heights (top or bottom of wall units).
- Request: "New adr 7" (2026-10-26)
- Questions: Align tops/bottoms of wall units too?
- Suggested pick: Add Top/Bottom align for wall units (about +15 % of ADR-099's work).

### G-090: Distribute along the depth

- Status: Done (ADR-099)
- Origin: ADR-099 open question (2026-10-26)
- Missing: Whether Distribute works along the depth too; default along the wall only.
- Request: "New adr 7" (2026-10-26)
- Questions: Distribute along the depth too?
- Suggested pick: Along the wall only (pieces stand against walls; depth distribution is rare).

### G-091: Persistent connections between pieces

- Status: Done (ADR-168)
- Origin: ADR-100 (2026-10-26, Claude: not asked for)
- Missing: Persistent connections between pieces (research: connection hierarchy / assembly graph); rules apply while snapping and in checks only.
- Request: "New adr 3" (2026-10-26)
- Questions: Store connections so rules hold after placing?
- Suggested pick: Store connections as a graph (about 40 points; makes the engine 'prevent invalid connections' as the research states).

### G-093: Tolerance for depth and height differences

- Status: Done (ADR-100)
- Origin: ADR-100 open question (2026-10-26)
- Missing: Whether small depth or height differences pass without a warning; default any difference warns.
- Request: "New adr 3" (2026-10-26)
- Questions: Allow a tolerance (mm) before warning?
- Suggested pick: Any difference warns until the user names a tolerance (never invent a physical value, ADR-010).

### G-095: Catalog counts agreement unconfirmed

- Status: Done (ADR-201)
- Origin: Gap re-check 2026-10-26 (G-059); agent found it
- Missing: The 'N ready items' label (src/ui/Catalog.tsx:236) exists, but no check (find-it or browser) has confirmed the total equals the sum of the category counts at 390 and 1280 px.
- Request: Run critique this design for the entire ui/ux; then 'Fix them directly' (G-059)
- Questions: None; it is a check.
- Suggested pick: Add a find-it step that compares the catalog total with the sum of its category counts at 390 and 1280 px; fix if they differ. (estimate: effort +2%, value +3%)
- Work: Low
- Impact: Low
- Necessity: Low-medium
- Issue: Nothing checks that the catalog's ready-items total equals the sum of its category counts.
- Fix: Add a find-it step comparing total and category sum at 390 and 1280 px; fix any mismatch.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-096: Empty Brands list promises a cancelled feed

- Status: Done (ADR-202)
- Origin: Gap re-check 2026-10-26 (G-044); agent found it
- Missing: Same text, now at src/ui/Catalog.tsx:618 (Russian entry src/core/i18n/ru/catalog.ts:47).
- Request: Catalog feed and brand filter (G-044) (context, not a quote)
- Questions: Replace the text with how brand products get in today (import), or hide the Brands source while it is empty?
- Suggested pick: Replace the text with what is true now: no brand products are bundled; import your own. Closest to the current app; no new feature. (estimate: effort +1%, value +3%)
- Work: Low
- Impact: Low-medium
- Necessity: Medium
- Issue: The empty Brands list promises a weekly IKEA feed that the user cancelled.
- Fix: Replace the text, and its Russian entry, with: no brand products bundled; import your own.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-097: Fastener notes point to a removed screen

- Status: Done (4025b89: the notes name Settings › Fasteners in the app, the print and Russian)
- Origin: Gap re-check 2026-10-26 (G-042); agent found it
- Missing: Fastener notes point to 'Materials › Fasteners', a screen that no longer exists (the list is under Settings › Fasteners, src/ui/Settings.tsx:70): src/core/shopping.ts:53, src/core/fasteners.ts:319, src/core/assembly.ts:506,524 and the print line, with their Russian and print entries.
- Request: Hardware and fastener completeness (G-042) (context, not a quote)
- Questions: None; it is a wording bug. Fix together with the Romanian labels in G-042?
- Suggested pick: Point both to the current path (Settings › Fasteners, or the piece's Size, boards and construction), and translate them in the Romanian CSV with G-042. (estimate: effort +1%, value +3%)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: Re-checked 2026-11-05 on main c4a15bd (code read, no browser): Missing text updated to the current code.

### G-098: ADR-082 still Pending though built

- Status: Done (ec9c7a8)
- Origin: Gap re-check 2026-10-26; agent found it
- Missing: The gaps ledger (docs/adr/GAPS.md), pnpm gaps and the Stop hook exist and are in use, but ADR-082 is still Pending in docs/adr/ and was never shipped.
- Request: Gaps ledger (ADR-082, user rule 2026-10-25) (context, not a quote)
- Questions: Ship ADR-082 now (ship-adr), after checking its Done-when list?
- Suggested pick: Check ADR-082's Done-when list against the repo, then ship it with ship-adr. (estimate: effort +2%, value +2%)

### G-100: Gap marks not in a file

- Status: Done (ADR-212)
- Origin: ADR-101, 2026-10-26; agent scoped it out
- Missing: Marks made on the gaps page cannot be exported or imported as a file; they live on one device. Copy decisions is the only way out.
- Request: “Mark + hand to Claude”
- Questions: Export and import the marks as a file, like research marks?
- Suggested pick: Export / import a JSON of marks, like Research's Import & export (estimate: effort +10%, value +5%)
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: Marks on the gaps page stay on one device and cannot be exported or imported.
- Fix: Add JSON export and import of gap marks, like the Research page's import and export.
- Conflicts: none

### G-102: Alternatives for a piece that sits on another piece

- Status: Done (user answer 2026-10-26 "Same width only for stacked pieces")
- Origin: ADR-098 implementation (2026-10-26, Claude: defaulted)
- Missing: Which catalog items count as the same placement kind for a piece placed on or above another piece; built: every standing and wall-hung item (the piece keeps its on-another-piece placement).
- Request: New adr 5 (2026-10-26): compatible = same placement kind (floor, wall, on another piece)
- Questions: For a piece on another piece, offer every item, or only standing items, or only items of the same family?
- Suggested pick: Every item, since the placement carries over (as built; narrowing to standing items is about +5 % of ADR-098's work)

### G-103: Family rule for your own templates

- Status: Done (ADR-210)
- Origin: ADR-100 (2026-10-26, Claude: not asked for)
- Missing: The family rule reads the shipped catalog families only; a piece from one of your own templates (own-… families, stored on this device) has no known room group, so the family rule never refuses or warns for it.
- Request: New adr 3
- Questions: Should pieces from your own templates follow the family rule too (their template's rooms)?
- Suggested pick: Yes: record the template's rooms on the inserted piece's catalog origin (a design document change, ADR-011; about +10 % of ADR-100's work, closes the rule for every piece).
- Work: Medium
- Impact: Low-medium
- Necessity: Low-medium
- Issue: Pieces from the user's own templates have no room group, so the family rule never checks them.
- Fix: Store the template's rooms on the inserted piece's catalog origin, with a schema bump.
- Conflicts: none

### G-104: Repairs for compatibility warnings

- Status: Done (ADR-204)
- Origin: ADR-100 (2026-10-26, Claude: not asked for)
- Missing: The depth, height and family warnings offer no previewed repair (ADR-071); each rule's repairs list is empty because no existing repair fixes them.
- Request: New adr 3
- Questions: Offer repairs such as 'Make Base cabinet 560 deep like its neighbour' or 'Move the bed away'?
- Suggested pick: Add a 'match the neighbour's depth/height' repair (closest to fixing the warning; about +20 % of ADR-100's work).
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: Depth, height and family compatibility warnings offer no previewed repair.
- Fix: Add a previewed repair that sets the piece's depth or height to match its neighbour.
- Conflicts: none

### G-105: Move display-only 3D models in the 3D view

- Status: Done (ADR-203)
- Origin: ADR-093 (2026-10-26, Claude: skipped this iteration)
- Missing: Move mode in 3D drags and turns project pieces only; display-only 3D models can be resized there (ADR-102) but not moved or turned.
- Request: New adr to override the conflicts for 4 and make it ready
- Questions: Should Move in 3D also drag and turn display-only 3D models?
- Suggested pick: Yes, the same Move and Turn (closest to direct manipulation in 2D/3D; about +15 % work for +10 % of the request, estimates).
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: In 3D Move mode, display-only 3D models can be resized but not moved or turned.
- Fix: Give models the same 3D Move drag and Turn buttons as project pieces.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-106: Resizing a base moves a locked piece on it

- Status: Done (ADR-203)
- Origin: ADR-095 (2026-10-26, Claude: found while building)
- Missing: A locked piece placed on or above another piece still follows its base when the base's size changes in the piece editor (moving or turning the base is refused; resizing is not a move).
- Request: Not a quote: ADR-095 'Nothing moves it for the user'
- Questions: Should resizing a base keep a locked piece on it where it is (leaving its base), or refuse the resize?
- Suggested pick: Refuse the resize with the reason, as a move of the base is refused (about +10 % of ADR-095's work).
- Work: Low-medium
- Impact: Medium
- Necessity: Medium-high
- Issue: Resizing a base piece still moves a locked piece sitting on it, which breaks the lock rule.
- Fix: Refuse the base resize with a reason, as moving the base is already refused.
- Conflicts: none

### G-108: Multi-select in the front view and 3D

- Status: Done (ADR-159)
- Origin: ADR-097 (2026-10-26, Claude: scoped while building)
- Missing: Shift/Ctrl/Cmd-click adds pieces to the selection on the plan and in the project's piece list; in the room front view and in 3D a click still selects one piece.
- Request: New adr 2 (2026-10-26): Desktop: Shift- or Ctrl/Cmd-click adds or removes a piece
- Questions: Add Shift/Ctrl-click to the room front view and to 3D too?
- Suggested pick: Yes, the same toggle in both views (about +10 % of ADR-097's work, +10 % value; estimates).
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Shift/Ctrl/Cmd-click selects several pieces in the front view and in 3D (src/ui/Project.tsx:1984-1992, src/viewer/Viewer3D.tsx:1434-1437).

### G-110: Distribute across rows and centre-snap rules

- Status: Done (ADR-205)
- Origin: ADR-099 (2026-10-26, Claude: defaulted while building)
- Missing: Distribute evenly over pieces at different heights (wall units and base units together, or a piece on another) is refused with the reason instead of spacing each row; centre snapping is offered only between pieces above and below each other (never at the same height) and the ADR-100 join rules do not apply to it (an alignment, not a join).
- Request: New adr 7 (2026-10-26): Distribute evenly (three or more selected pieces, along the wall)
- Questions: With a mixed selection, distribute each row on its own instead of refusing? Should the join rules also limit centre snapping?
- Suggested pick: Distribute each row on its own (closest to 'tidy runs in one tap'; about +15 % of ADR-099's work, +10 % value; estimates); keep the join rules for joins only.
- Work: Medium
- Impact: Low-medium
- Necessity: Low-medium
- Issue: Distribute evenly refuses a mixed selection of wall and base rows instead of spacing each row.
- Fix: Distribute each height row separately in distributeItems; keep join rules for joins only.
- Conflicts: none

### G-111: Keep proportions switch is not saved

- Status: Done (user answer 2026-10-27 "Screen only, on each time")
- Origin: ADR-102 (2026-10-27, Claude: defaulted while drafting)
- Missing: The Keep proportions switch is screen state only: it starts on each time a model is selected and is not saved in the project.
- Request: Width and height of an item must be editable adr; answer 'Yes, on by default' (Keep proportions switch)
- Questions: Should the switch remember its setting per model in the saved project (a project schemaVersion bump)?
- Suggested pick: Screen state only, on each time (the answer 'on by default'; saving it adds a schema change for little value; estimate +25 % effort, +5 % value).
- Answer: User 2026-10-27: "Screen only, on each time" — kept as built in ADR-102.

### G-112: Resize a 3D model by dragging in the 3D view

- Status: Done (ADR-102)
- Origin: ADR-102 (2026-10-27, Claude: out of scope)
- Missing: Resizing an imported 3D model with handles in the 3D view; sizes are typed in the fields only.
- Request: Width and height of an item must be editable adr
- Questions: Should the 3D view get resize handles for models?
- Suggested pick: Typed fields only (the request is to make the sizes editable; handles would be an exception to ADR-014's select-only viewer).

### G-113: Fill a wall: corner and L walls

- Status: Done (ADR-173)
- Origin: ADR-103, 2026-10-27; Claude scoped it out
- Missing: Fill a wall works on one straight wall only; corner and L-shaped walls are not filled.
- Request: a reverse furniture building, total width, to the mix of furniture pieces that fill that space (context: corners not mentioned)
- Questions: Should Fill a wall also fill corner or L walls, with a corner cabinet at the joint?
- Suggested pick: Fill each straight wall with ADR-103, then join two walls with a catalog corner cabinet (ADR-025). (estimate: effort +40%, value +15%)

### G-114: Fill a wall: room openings shape the mix

- Status: Done (ADR-173)
- Origin: ADR-103, 2026-10-27; Claude scoped it out
- Missing: Room windows, doors, pipes and outlets do not shape the suggested mixes; they are checked only after the project is made.
- Request: a reverse furniture building, total width, to the mix of furniture pieces that fill that space (context: room openings not mentioned)
- Questions: Should Fill a wall read the project room (ADR-058) and avoid windows, doors and outlets?
- Suggested pick: Start Fill a wall from a wall of the project room and skip mixes that clash with its openings, using the existing room checks. (estimate: effort +30%, value +15%)

### G-115: Fill a wall: when the wall row appears

- Status: Done (ADR-104)
- Origin: ADR-104, 2026-10-27; open question defaulted by Claude
- Missing: Whether every mix gets a wall row, or a Refine choice decides (any / always / never).
- Request: Wall cabinets above (answer to: Which kinds of pieces may appear in a mix?)
- Questions: Should the wall row appear in every mix, in some mixes, or be chosen in Refine (any / always / never)?
- Suggested pick: Refine choice 'Wall cabinets: any / always / never', default any, so the first 4 cards show mixes with and without a wall row. (estimate: effort +3%, value +10%)

### G-116: Fill a wall: carcasses with 3 or more equal fronts

- Status: Done (ADR-204)
- Origin: ADR-103, 2026-10-27; Claude cut it while building
- Missing: Equal fronts puts 1 or 2 fronts on a carcass only (a door front has 1 or 2 leaves); carcasses with 3 or more fronts are not suggested, so fronts under 200 mm wide (with the 400 mm min) give no mix.
- Request: 6 equal front panels, what's behind is to be configured (answer: Equal fronts, any carcass widths)
- Questions: Should a carcass carry 3 or more equal fronts (with dividers inside), for narrow fronts?
- Suggested pick: Allow 3–4 fronts per carcass, built as equal bays with a divider and one door each, so narrow fronts still fill the wall. (estimate: effort +10%, value +5%)
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: Fill a wall puts at most 2 equal fronts per carcass, so narrow equal fronts give no mix.
- Fix: Allow 3-4 fronts per carcass as equal bays with dividers and one door each.
- Conflicts: none

### G-117: Fill a wall: tall cabinet height

- Status: Done (ADR-204)
- Origin: ADR-103, 2026-10-27; default chosen by Claude while building
- Missing: Tall cabinets are always the catalog height (2200 mm, ADR-036 typical value); there is no tall-height field. A wall lower than that gets the warning on every mix with a tall cabinet.
- Request: allow with a warning items like tall cabinets, above this height
- Questions: Should Refine have a tall cabinet height field, or should tall cabinets follow the entered height?
- Suggested pick: Add a Tall cabinet height field in Refine, catalog value prefilled; the warning stays when it is above the entered height. (estimate: effort +3%, value +10%)
- Work: Low
- Impact: Medium
- Necessity: Medium
- Issue: Fill a wall tall cabinets are always 2200 mm; lower walls warn on every mix with one.
- Fix: Add a Tall cabinet height field in Refine, catalog value prefilled; keep the warning above entered height.
- Conflicts: none

### G-118: Fill a wall: a width per base kind

- Status: Done (ADR-204)
- Origin: ADR-103, 2026-10-27; Claude narrowed it while building
- Missing: All base kinds in one mix share one width (tall cabinets may have their own round width); mixes such as an 800 drawer base next to 600 shelf bases are not suggested.
- Request: So basically a mix and match (answer: Equal per kind, exact split)
- Questions: Should each base kind (open shelves, drawers, door + shelves) get its own width in a mix?
- Suggested pick: Also try one round width per base kind (steps of 50 mm), ranked after the shared width, so the cards show such mixes too. (estimate: effort +10%, value +15%)
- Work: Medium
- Impact: Medium
- Necessity: Low-medium
- Issue: All base kinds in a Fill a wall mix share one width, so mixed-width runs are never suggested.
- Fix: Also try one round width per base kind in 50 mm steps, ranked after the shared width.
- Conflicts: none

### G-123: Fill a wall: wall cabinet depth

- Status: Done (ADR-204)
- Origin: ADR-104, 2026-10-27; default chosen by Claude while building
- Missing: Wall cabinets keep the catalog depth (320 mm carcass); there is no wall cabinet depth field.
- Request: Wall cabinets above (answer to: Which kinds of pieces may appear in a mix?)
- Questions: Should Refine have a wall cabinet depth field?
- Suggested pick: Add Wall cabinet depth in Refine, catalog value prefilled. (estimate: effort +2%, value +5%)
- Work: Low
- Impact: Low-medium
- Necessity: Low-medium
- Issue: Fill a wall wall cabinets always use the catalog 320 mm depth; no depth field.
- Fix: Add a Wall cabinet depth field in Refine, catalog value prefilled.
- Conflicts: none

### G-125: Width and depth card over the project view for a selected piece

- Status: Done (ADR-109)
- Origin: ADR-106
- Missing: In a project, a piece selected but not opened (Inside this piece) gets Width and Depth in its Selected piece card only; no floating card over the project drawing or 3D (the quick-count card shows there only for an opened piece, ADR-088).
- Request: Add the posibility to change width/depth when whole cabinet or whole piece is selected; answer: Card + side panel
- Questions: Should a selected project piece also get a floating Width/Depth card over the project plan, elevation and 3D?
- Suggested pick: Yes, a floating card over the project views (closest to 'Card + side panel'; estimate +60 % work, +15 % of value)

### G-126: No width/depth fields for a bed or a set of loose panels

- Status: Done (ADR-211)
- Origin: ADR-106
- Missing: A bed and a set of loose panels show no size fields when selected (src/core/pieceSize.ts:49-63); a filler/cover panel shows Width and Height (no depth).
- Request: Add the posibility to change width/depth when whole cabinet or whole piece is selected
- Questions: Should a bed show its mattress size there instead, and loose panels nothing?
- Suggested pick: Bed: show the mattress width and length there (closest to the request; estimate +10 % work, +5 % of value)
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: A selected bed or set of loose panels shows no size fields in the whole-piece size group.
- Fix: Show the bed's mattress width and length there; loose panels stay without fields.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-130: jsdom find-it cannot check layout

- Status: Done (obsolete: ADR-108)
- Origin: ADR-108 (Open question)
- Missing: jsdom applies no CSS, so the 390 px no-side-scroll rule and bounding-box checks are not tested by the default find-it
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Which ADRs must still run the browser script for layout?
- Suggested pick: ADRs that change layout or CSS set Acceptance browser; others stay jsdom
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): answered in ADR-108: layout and CSS ADRs set Acceptance: browser (CLAUDE.md R3).

### G-131: jsdom find-it cannot render the 3D view

- Status: Done (obsolete: ADR-108)
- Origin: ADR-108 (Out of scope)
- Missing: The three.js viewer does not render in jsdom; 3D features are not found by the default find-it
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Should ADRs that touch the 3D view always use Acceptance browser?
- Suggested pick: Yes: ADRs touching the 3D view or Move mode use browser
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): answered in ADR-108: 3D and Move mode ADRs set Acceptance: browser (CLAUDE.md R3).

### G-132: Existing browser find-it scripts are not ported to jsdom

- Status: Done (obsolete: ADR-108)
- Origin: ADR-108 (Out of scope)
- Missing: The 42 tools/*/find-it.mjs scripts stay; no jsdom versions for shipped ADRs
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Port any of them?
- Suggested pick: No; keep them as the browser regression set
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): answered in ADR-108: the browser scripts stay as they are (“No, keep as browser set”).

### G-133: Light ADR catch-up mode after ADR-108

- Status: Done (obsolete: ADR-108)
- Origin: ADR-108 (Open question)
- Missing: Undecided whether catch-up acceptance for light ADRs runs jsdom or the browser script
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Catch up acceptance with jsdom or browser?
- Suggested pick: jsdom, unless the ADR is layout or 3D
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): answered in ADR-108: jsdom unless the ADR touches layout or 3D (CLAUDE.md R3).

### G-134: Clearances wraps to a second row of the project plan toolbar on a phone

- Status: Done (ADR-112)
- Origin: ADR-109
- Missing: At 390 px the plan toolbar holds Doors and fronts, Snap and Select on one row; Clearances wraps to a second row.
- Request: i dont see doors text moved with other; answer: Same row as Snap (Recommended)
- Questions: Should all four plan controls fit one row on a phone (shorter labels or icons), or is the wrap fine?
- Suggested pick: Keep the wrap (closest to the request: Doors and fronts is in Snap's row); one row would need shorter labels (estimate +20 % work, +5 % of value)

### G-136: Link pieces that are already 100% identical

- Status: Done (ADR-207)
- Origin: ADR-111, 2026-10-27, user choice
- Missing: Only copies made with 'Add a linked copy' are linked; identical pieces added separately, by Duplicate or by adding the same item again stay independent (user picked explicit links and only 'Add a linked copy').
- Request: use a piece, a item created by the user, added to the project, added multiple times, and give the possibility to bulk update the width/height/drawers, just like it would be 1 piece, with 2 symlinks to it, change to 1 changes all the other, including internal, and it should be propagated further to the ones in the 100% same.
- Questions: Should 'Link N identical pieces' link existing identical pieces, or should Duplicate / adding the same item again make linked copies?
- Suggested pick: 'Link N identical pieces' on the card: closest to 'propagated further to the ones in the 100% same' (est. +20 % work).
- Work: Medium
- Impact: Medium
- Necessity: Low-medium
- Issue: Identical pieces added separately or by Duplicate stay independent; only 'Add a linked copy' links.
- Fix: Add 'Link N identical pieces' on the card, giving existing identical pieces one shared linkId.
- Conflicts: none

### G-138: How an info button shows its text

- Status: Done (ADR-113; re-checked 2026-11-05 on main c4a15bd, code read)
- Origin: ADR-113
- Missing: The way the moved intro text opens is a default the user has not confirmed: tap or click the ⓘ button opens a small popover under it; tap outside, Escape or a second tap closes it
- Request: Move info text from Project to a tooltip, apply same to other similar UX occurences
- Questions: Popover on tap (also on hover on desktop), or hover-only tooltip?
- Suggested pick: Popover on tap and click, Escape closes (closest to the request: a hover-only tooltip cannot open on a phone)

### G-140: Catalog density on desktop

- Status: Done (ADR-119)
- Origin: ADR-118
- Missing: The Catalog is 36 785 px tall at 1280 px; ADR-118 makes only the phone layout compact
- Request: Run a critique for listings, headers, text, button sizes, gaps, groupings; answer Catalog density + wizard
- Questions: Compact cards and folded family details on desktop too?
- Suggested pick: Yes, same disclosure on desktop (closest to the request; estimate +15 % work, +20 % of value)

### G-141: Lower-severity critique items not picked

- Status: Done (ADR-120)
- Origin: docs/retros/2026-10-27-ui-critique.md
- Missing: Mixed checkbox/pressed toggles in the plan toolbar; Width/Depth and counts three times on desktop; Projects row names wrap beside three icon buttons; editor name field cut without ellipsis; 'Back to the editor' chevron points right; ADR numbers in UI text; Romanian names inside English descriptions; Projects groupings (Import beside list heading, Fill a wall twice); 'front faces you' lone line
- Request: Run a critique for listings, headers, text, button sizes, gaps, groupings
- Questions: Build these in a follow-up ADR?
- Suggested pick: One follow-up ADR for all of them (estimate +25 % work, +15 % of value)

### G-145: Phone catalog cards cut text with no way to read it

- Status: Done (ADR-119)
- Origin: ADR-118 (found while building)
- Missing: At 390 px each catalog card's text lines (variant names, sizes/parts line, 'You choose: …') are cut to one line with an ellipsis and cannot be expanded; source and grouping switches read 'Saved', 'Room', 'Type'; room chips and 'also called' moved behind 'About this family'; wizard Cancel removed at every width
- Request: Run a critique for listings, headers, text, button sizes, gaps, groupings; answer Catalog density + wizard
- Questions: Should cut card text expand on tap (or show in the item detail), and are the short labels and Cancel removal fine?
- Suggested pick: Full text in the item's detail view on tap (closest to the request: compact list, nothing unreachable; estimate +10 % work, +10 % of value)

### G-146: Where a cut catalog card's full text shows

- Status: Done (ADR-119; re-checked 2026-11-05 on main c4a15bd, code read)
- Origin: ADR-119
- Missing: The Catalog has no item detail view (tapping a card opens the item), so G-145's pick needs a place for the full text
- Request: accept gap picks
- Questions: A More toggle that expands the card in place, or the text in an info popover?
- Suggested pick: More toggle in place (closest to the request: the text is on the card, one tap, works on touch and keyboard)

### G-147: Lower-severity critique fixes not agreed

- Status: Done (ADR-120; re-checked 2026-11-05 on main c4a15bd, code read)
- Origin: ADR-120
- Missing: The nine fixes in ADR-120 are the critique's proposals; none is agreed
- Request: accept gap picks (G-141: one follow-up ADR for all of them)
- Questions: Accept the nine fixes as written in ADR-120, or change any?
- Suggested pick: Accept as written (each is the critique's fix for the item it names)

### G-148: ADR ids and Back link left on the Gaps and Research pages; Select lost its tooltip

- Status: Done (ADR-211)
- Origin: ADR-120 (found while building)
- Missing: The Gaps page search placeholder still names ADR-072 and the Research page lists ADR ids (they are the content); Gaps and Research always show 'Back to the editor', not only with a design open; the Select checkbox lost the tooltip the old button had
- Request: accept as written (ADR-120: no ADR numbers in UI text; Back to the editor only when a design is open)
- Questions: Remove ADR ids from those two pages and hide Back there too, and give Select an info tip?
- Suggested pick: Keep the ids on Gaps and Research (they are the page's subject); hide Back there too; add an info tip to Select (estimate +5 % work, +5 % of value)
- Work: Low
- Impact: Low
- Necessity: Low-medium
- Issue: Gaps and Research always show Back to the editor; Select checkbox lost its tooltip.
- Fix: Keep ADR ids on those pages, show Back only with a design open, add an info tip to Select.
- Conflicts: none

### G-149: Typed rotation: exact checks or bounding boxes

- Status: Done (ADR-121)
- Origin: ADR-121 (open question)
- Missing: Typed rotation in whole degrees is not built; every check, snap and drawing assumes axis-aligned boxes (quarter turns only)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Any whole degree with exact rotated-box checks, any whole degree with each turned piece checked by its enclosing box, or a typed field limited to 0/90/180/270?
- Suggested pick: Any whole degree with exact rotated-box checks (closest to the research's typed rotation; estimate +60 % work over enclosing boxes, +25 % of value: no false overlap errors)

### G-150: Review pack: what it holds and how it leaves the device

- Status: Done (ADR-121)
- Origin: ADR-121 (open question)
- Missing: No single package to hand a project to a professional for review
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Contents (project file, parts CSV, SVG drawings, a printable HTML summary) and delivery: a .zip download, the device Share sheet with download fallback, or print only?
- Suggested pick: A .zip download plus the device Share sheet where offered (closest to handing a plan over; Share hands files to the OS, the app makes no request; estimate +15 % work, +20 % of value)

### G-151: Align Top/Bottom with floor pieces selected

- Status: Done (ADR-122)
- Origin: ADR-122 (open question)
- Missing: Align Top and Bottom do not exist; a floor piece's height cannot move without resizing it
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Skip floor pieces and say why, or resize them to reach the line?
- Suggested pick: Skip them and say why (alignment moves pieces, as ADR-099; resizing is a separate action)

### G-152: Size lock: separate or part of Lock

- Status: Done (ADR-122)
- Origin: ADR-122 (open question)
- Missing: A piece's sizes cannot be locked (G-081)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: A separate Lock size toggle, or one Lock that covers position and size?
- Suggested pick: Separate Lock size (the research names locked parameters apart from pinned positions; estimate +10 % work, +15 % of value)

### G-153: Height drag in 3D: which pieces

- Status: Done (ADR-122)
- Origin: ADR-122 (open question)
- Missing: No vertical drag in 3D Move mode (G-078)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Only wall-placed pieces, or also floor pieces (which would then become raised)?
- Suggested pick: Wall-placed pieces only (height comes from placement, ADR-031; floor pieces stay on the floor)

### G-154: Section view: which cut planes

- Status: Done (ADR-122)
- Origin: ADR-122 (open question)
- Missing: No section, cutaway or isolate in the 3D view
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: One front-to-back cut, or a cut along any of the three axes?
- Suggested pick: Any of the three axes (closest to 'cut through the ensemble'; estimate +15 % work, +20 % of value)

### G-155: Project versions: when one is kept

- Status: Done (ADR-123)
- Origin: ADR-123 (open question)
- Missing: No history of older project versions (G-083)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Automatic (one version each time a project is opened for editing, plus Save a version by hand), by hand only, or on every change?
- Suggested pick: Automatic per editing session plus by hand (closest to 'stronger recovery': nothing to remember; estimate +10 % work, +30 % of value)

### G-156: Project versions: how many are kept

- Status: Done (ADR-123)
- Origin: ADR-123 (open question)
- Missing: Keeping versions grows storage; removing old ones deletes saved data, which needs the user's decision (ADR-012)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Keep every version until the user deletes it, or keep the last N and drop older ones automatically?
- Suggested pick: Keep every version until the user deletes it (nothing deleted without the user, ADR-012)

### G-157: Undo log: labelled snapshots or inverse commands

- Status: Done (ADR-123)
- Origin: ADR-123 (open question)
- Missing: Undo is a list of unlabelled snapshots; no named steps, no step list, no explicit transactions
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Labelled snapshots grouped into transactions, or a log of inverse commands?
- Suggested pick: Labelled snapshots grouped into transactions (gives the named log and atomic steps the research describes; inverse commands estimate +80 % work, under +5 % of value)

### G-158: Style suggestions: where they come from

- Status: Done (ADR-123)
- Origin: ADR-123 (open question)
- Missing: No style or material suggestions
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Built-in named styles (board and handle combinations from the shipped lists), combinations from the user's own projects, or both?
- Suggested pick: Both (estimate +30 % work over built-in only, +40 % of value: suggestions match what the user actually uses)

### G-159: Design codes: link or text

- Status: Done (ADR-124)
- Origin: ADR-124 (open question)
- Missing: No code to share or reopen a design or project elsewhere
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: A link that opens the app with the design, plus the text code, or the text code only?
- Suggested pick: Link plus text code (closest to IKEA-style codes that reopen a design; estimate +10 % work, +25 % of value)

### G-160: Replace: which own edits carry over

- Status: Done (ADR-124)
- Origin: ADR-124 (open question)
- Missing: Replacing a piece drops its own edits (G-087)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Every changed setting that also exists on the new design (listing the rest), or only size and boards?
- Suggested pick: Every changed setting that exists on the new design, with a list of what could not carry (closest to G-087; estimate +40 % work, +50 % of value)

### G-161: Template references: default and fallback

- Status: Done (ADR-124)
- Origin: ADR-124 (open question)
- Missing: Project pieces are full copies (ADR-022); none refers to its template and stores only its changes
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: New catalog pieces refer to their template with a kept copy as fallback, refer with no copy (only changes stored), or opt in per piece?
- Suggested pick: Refer by default and keep a copy as fallback (closest to the research while a missing template never loses a piece, ADR-012; estimate +20 % work over no copy, same value)

### G-162: Project-wide settings: which ones

- Status: Done (ADR-124)
- Origin: ADR-124 (open question)
- Missing: No project-wide parameters that every piece follows unless it overrides them
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Which settings: carcass, front and back boards and banding; handle type; front overlay; plinth height — all, or a subset?
- Suggested pick: All of them (the settings the catalog families share; estimate +40 % work over boards only, +60 % of value)

### G-163: Run sinks: what is generated

- Status: Done (ADR-125)
- Origin: ADR-125 (open question)
- Missing: Sinks are not generated for a run
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: A sink cut-out in the run worktop over a chosen base, sized by the user, plus a shopping line — or a sink as a 3D item too?
- Suggested pick: Cut-out sized by the user, a cut-list note and a shopping line (no sink sizes invented, ADR-010)

### G-164: Run handles: where the line sits

- Status: Done (ADR-125)
- Origin: ADR-125 (open question)
- Missing: Handles are chosen per piece; nothing lines them up across a run
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: One handle type and one height line for every front in the run: line at the top of fronts, centred, or a height in mm the user enters?
- Suggested pick: A height in mm the user enters, with top-of-front as a one-tap choice (closest to a generated, aligned handle line)

### G-165: Rapier: trial or adopt

- Status: Done (ADR-125)
- Origin: ADR-125 (open question)
- Missing: No spatial query engine; checks are hand-written box tests
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Run a measured trial (decision recorded, nothing shipped unless it wins), or adopt Rapier for the checks now?
- Suggested pick: Measured trial first (the research says 'evaluate'; a new WASM dependency needs its licence, size and offline behaviour checked)

### G-170: Angled pieces snap and measure by their enclosing box

- Status: Done (ADR-205)
- Origin: ADR-121 (found while building)
- Missing: A piece typed at an angle snaps to neighbours and walls by the axis-aligned box around it, not its turned faces; the mm amounts in overlap and blocked-opening messages are measured on those boxes. Detection itself is exact.
- Request: Accept default, /batch all ready
- Questions: Snap angled pieces face to face along their turned sides, and measure overlaps exactly?
- Suggested pick: Snap along turned faces and measure exactly (closest to typed rotation 'while snapping keeps working'; estimate +40 % work on ADR-121's rotation part, +15 % of value)
- Work: Medium-high
- Impact: Low-medium
- Necessity: Low-medium
- Issue: Angled pieces snap and report overlap amounts by their enclosing box, not their turned faces.
- Fix: Snap along turned faces and measure overlaps exactly on the rotated boxes.
- Conflicts: none

### G-172: 3D outlines of an angled piece are drawn unturned

- Status: Done (ADR-203)
- Origin: ADR-121 (found while building)
- Missing: In the 3D view, the selection outline of a space inside an angled piece and the Move-mode ghost are drawn as the unturned or enclosing boxes; the boards themselves are drawn turned
- Request: Accept default, /batch all ready
- Questions: Turn the selection outline and the Move ghost with the piece?
- Suggested pick: Turn them (estimate +5 % work, +5 % of value)
- Work: Low
- Impact: Low
- Necessity: Low-medium
- Issue: In 3D, an angled piece's selection outline and Move ghost are drawn unturned.
- Fix: Apply the piece's turn to the selection outline and the Move-mode ghost.
- Conflicts: none

### G-173: Selected space hides its piece's boards in 3D

- Status: Done (obsolete: dropped by the user 2026-11-05, "Drop g 173")
- Origin: ADR-121 (found while building)
- Missing: With a space selected inside a piece, that piece's boards do not draw in the 3D view; only the selection outline shows. Also on main (happens at 0° and with the always-on render loop)
- Request: Accept default, /batch all ready
- Questions: Fix it in this PR or in a separate change?
- Suggested pick: Fix it in this PR, since this PR touches Viewer3D (estimate +5 % work)
- Work: Low
- Impact: Medium
- Necessity: Medium-high
- Issue: Selecting a space inside a piece may hide its boards in 3D; now faded, unverified in browser.
- Fix: Check in a browser; if boards still vanish, keep them drawn (faded) with the selection outline.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): no fix found after 0b8fc21; the 3D view fades rather than hides boards (src/viewer/Viewer3D.tsx:1471-1477). Needs a browser run to tell whether it still happens.
- Note: Re-checked 2026-11-05 on main c4a15bd (code read, no browser): boards now fade (Viewer3D isFaded, opacity 0.28) rather than hide; no fix commit found. Needs a browser check to close.

### G-180: Lock parameters other than size

- Status: Done (ADR-171)
- Origin: ADR-122 (found while building)
- Missing: Lock size covers width, height and depth only; boards, construction and insides of a size-locked piece stay editable (the research's locked parameters, G-081, beyond size)
- Request: Accept default
- Questions: Should other parameters (boards, construction, insides) be lockable too, and one by one or together?
- Suggested pick: Leave as is until asked (the user's pick was a separate Lock size)

### G-181: Move/Section toggle sometimes ignores the first tap after a touch drag or while the 3D view settles

- Status: Done (ADR-201)
- Origin: ADR-122 (found while checking)
- Missing: In the production-build find-it run, Move and Section sometimes stayed off after one tap: right after a touch drag on a phone, or while the 3D view was settling after the look changed; the script now taps again until the toggle reads pressed
- Request: Push, merge
- Questions: Trace and fix the dropped tap, or keep the retry in the find-it script?
- Suggested pick: Trace and fix (estimate +10 % work)
- Work: Medium
- Impact: Medium
- Necessity: Medium
- Issue: Move and Section toggles in 3D sometimes ignore the first tap after a touch drag or re-render.
- Fix: Trace the dropped tap in the 3D toolbar and fix it; then drop the retry from the find-it script.
- Conflicts: none

### G-190: Versions of a deleted project

- Status: Done (ADR-203)
- Origin: ADR-123 (found while building)
- Missing: Deleting a project leaves its kept versions on the device; nothing lists or removes them (G-156: nothing removes versions without the user)
- Request: Accept default, /batch all ready (G-156: keep every version until the user deletes it)
- Questions: When a project is deleted, ask whether to delete its versions too, keep them silently, or list orphaned versions somewhere to restore or delete?
- Suggested pick: Ask on delete, defaulting to keep (closest to G-156: nothing removed without the user's decision)
- Work: Low-medium
- Impact: Low-medium
- Necessity: Medium
- Issue: Deleting a project leaves its kept versions on the device, unlisted and impossible to remove or restore.
- Fix: On project delete, ask whether to delete its versions too, defaulting to keep them.
- Conflicts: none

### G-200: Project-wide settings and the size lock

- Status: Done (ADR-122)
- Origin: ADR-124 (found while building)
- Missing: Project settings and Replace do not check ADR-122's size lock: ADR-122 is not on main when ADR-124 is built
- Request: Accept default, /batch all ready
- Questions: When both are merged: should a size-locked piece refuse project settings that change its size (plinth height) and Replace?
- Suggested pick: Refuse and name the piece, as ADR-122 says for Fill-a-wall, Replace and linked edits

### G-203: Wizard and template pieces and the project settings

- Status: Done (ADR-170)
- Origin: ADR-124 (found while building)
- Missing: Pieces inserted from a project template (insertTemplate) do not take the project settings; pieces from the wizard's "Add to project" already do (they go through addPiece, designStore.ts:779).
- Request: Accept default, /batch all ready
- Questions: Should they take the project settings like Add a piece?
- Suggested pick: They take them, like Add a piece (estimate +5 % work)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-210: Project templates drop run handles and sinks

- Status: Done (ADR-204)
- Origin: ADR-125 (found while building)
- Missing: Saving a project as a project template (ADR-060) keeps neither its run handles nor its sinks; a project made from it has none
- Request: Accept default, /batch all ready (ADR-125: run sinks and handles)
- Questions: Should project templates keep run handles and sinks (with the piece ids remapped)?
- Suggested pick: Keep them, remapped like run-part keys (closest to a reusable kitchen layout)
- Work: Medium
- Impact: Medium
- Necessity: Medium
- Issue: Project templates drop run handles and sinks, so projects made from them have none.
- Fix: Save run handles and sinks in project templates, remapping piece ids like run-part keys.
- Conflicts: none

### G-211: Run handles not shown inside the piece editor

- Status: Done (ADR-203)
- Origin: ADR-125 (found while building)
- Missing: Opening one piece of a handled run shows and edits its own handles; the run's handle shows only in the project views, cut list and hardware
- Request: Accept default, /batch all ready (ADR-125: run sinks and handles)
- Questions: Should the piece editor show the run's handle (read-only) with a note that the run sets it?
- Suggested pick: Show it read-only with 'Set by Handles for this run' (no change to the piece's own design)
- Work: Low-medium
- Impact: Low-medium
- Necessity: Medium
- Issue: The piece editor shows the piece's own handles, not the run handle that actually applies.
- Fix: Show the run's handle read-only in the piece editor with 'Set by Handles for this run'.
- Conflicts: none

### G-212: Sink cut-out not drawn

- Status: Done (ADR-205)
- Origin: ADR-125 (found while building)
- Missing: The sink cut-out is a cut-list note, a shopping line and checks; it is not drawn on the plan, the front view or in 3D (worktop cut-outs were already not drawn)
- Request: Accept default, /batch all ready (ADR-125: run sinks and handles)
- Questions: Draw the cut-out outline on the plan and in 3D?
- Suggested pick: Outline on the plan only (where the worktop is drawn from above)
- Work: Low-medium
- Impact: Low-medium
- Necessity: Low-medium
- Issue: The sink cut-out is only a cut-list note and checks; it is not drawn anywhere.
- Fix: Draw the sink cut-out outline on the worktop in the 2D plan.
- Conflicts: none

### G-213: Paid backend allowed

- Status: Done (ADR-126)
- Origin: ADR-126, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on whether the online features may use a paid plan; ADR-002 says the owner wants no paid dependency.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Free tier only, or a paid plan up to a monthly amount you set?
- Suggested pick: Free tier only until a limit is reached, then you decide (keeps ADR-002's no-paid-dependency wish; estimate effort +0 %; risk: free-tier pauses and limits, unverified)
- Note: Answered by the user 2026-10-28: Free tier only.

### G-214: Who can create an account

- Status: Done (ADR-126)
- Origin: ADR-126, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on who may sign up.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Only you (allow-list of emails), people you invite, or anyone (public sign-up)?
- Suggested pick: Anyone (closest to “user accounts” and share links; estimate effort +15 % for abuse limits and GDPR work, value +30 % over owner-only)
- Note: Answered by the user 2026-10-28: Anyone (public sign-up).

### G-215: How online code is loaded

- Status: Done (ADR-126)
- Origin: ADR-126, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on whether the online client code is in the main bundle.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Load the online client in a lazy chunk only after the user opts in, or ship it in the main bundle?
- Suggested pick: Lazy chunk after opt-in (closest to an offline core; estimate effort +5 %)
- Note: Answered by the user 2026-10-28: Lazy chunk after opt-in.

### G-216: Opening a share link asks first

- Status: Done (ADR-126)
- Origin: ADR-126, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on whether opening a share link contacts the server at once.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Fetch the shared item as soon as the link opens, or ask “Load this shared item from the server?” first?
- Suggested pick: Ask first, like ADR-124's #open= links (estimate effort +2 %)
- Note: Answered by the user 2026-10-28: Load at once (no ask).

### G-217: Backend vendor not chosen

- Status: Done (ADR-127)
- Origin: ADR-127, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No backend, auth provider or database is chosen.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Supabase, Cloudflare D1 with a Worker (plus an auth provider), Turso or Neon (plus an auth provider), Firebase, or self-hosted PocketBase / Appwrite?
- Suggested pick: Supabase: the only candidate in the earlier research that offers Google sign-in, email/password with reset and a database in one service, i.e. items 3, 4 and 5 (estimate: least extra work among candidates covering all six items; risk: free projects pause after 1 week idle, unverified)
- Note: Answered by the user 2026-10-28: Supabase.

### G-218: Data region

- Status: Done (ADR-127)
- Origin: ADR-127, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No data region chosen.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: An EU region, or any region the vendor offers?
- Suggested pick: An EU region (users in Romania, GDPR; estimate effort +0 %)
- Note: Answered by the user 2026-10-28: EU region.

### G-219: Owner of the backend account and keys

- Status: Done (ADR-127)
- Origin: ADR-127, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No owner of the vendor account, billing and keys.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Your personal account, or a company account?
- Suggested pick: Your own account, keys held by you (closest to a single-owner app); only you can answer
- Note: Answered by the user 2026-10-28: My personal account.

### G-220: Vendor facts unverified

- Status: Done (ADR-127)
- Origin: ADR-127, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Free-tier quotas, idle pauses, prices, licences and telemetry of every candidate are unknown or come from unverified secondary research (2026-10-27/28).
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Verify each fact on the vendor's own pages, with URL and date, before choosing?
- Suggested pick: Yes, recorded in ADR-127 before approval (estimate effort +5 %)
- Note: Answered by the user 2026-10-28: Yes, verify vendor facts.

### G-221: Which records go to the account

- Status: Done (ADR-128)
- Origin: ADR-128, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on which saved data is stored in the account.
- Request: “New adr for save user templates and created pieces in db”
- Questions: Library pieces and your templates only (your words), plus the board pictures they use, or also projects, project templates, prices, decors and 3D models? Does “created pieces” include pieces inside projects?
- Suggested pick: Pieces and templates plus the pictures they use (a piece without its pictures opens with plain colours; estimate effort +15 %, value +20 %)
- Note: Answered by the user 2026-10-28: Pieces, templates + pictures; created pieces = library pieces only (not pieces inside projects).

### G-222: Where the local-to-account link is kept

- Status: Done (ADR-128)
- Origin: ADR-128, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on where a local row records its account copy.
- Request: “New adr for save user templates and created pieces in db”
- Questions: A separate Dexie table (next free version, documents unchanged), or a field in the design document (schemaVersion 4)?
- Suggested pick: Separate table: the link is per device and per account and must not travel in exported files or design codes (estimate effort +0 %)
- Note: Answered by the user 2026-10-28: Separate table.

### G-223: Per-account limits

- Status: Done (ADR-128)
- Origin: ADR-128, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No caps on the number or size of account records.
- Request: “New adr for save user templates and created pieces in db”
- Questions: Which per-account count and size caps?
- Suggested pick: validateDesign's caps per document plus a total size cap set once the vendor's free quota is known (unknown today)
- Note: Answered by the user 2026-10-28: Design caps + total cap.

### G-224: Designs saved before sign-in

- Status: Done (ADR-129)
- Origin: ADR-129, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on what happens to local designs at the first sign-in.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Ask once (Upload all / Choose / Not now), upload everything silently, or upload nothing?
- Suggested pick: Ask once; nothing moves without your decision (estimate effort +5 %)
- Note: Answered by the user 2026-10-28: Upload all silently.

### G-225: Edits while offline and signed in

- Status: Done (ADR-129)
- Origin: ADR-129, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No offline policy for account items.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Save locally and send later, or block editing account items while offline?
- Suggested pick: Save locally and send later (closest to offline-first; estimate effort +20 %)
- Note: Answered by the user 2026-10-28: Save locally, upload later.

### G-226: Same item changed on two devices

- Status: Done (ADR-129)
- Origin: ADR-129, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No conflict policy between devices.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Keep both (the second saved as a copy named after its device), last save wins, or ask with a compare?
- Suggested pick: Keep both: never loses work; last save wins would rewrite a saved design without your decision (estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Keep both.

### G-227: Signing out on a shared device

- Status: Done (ADR-129)
- Origin: ADR-129, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on local copies after sign-out.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Keep the local copies, offer to remove them (with confirmation), or remove them automatically?
- Suggested pick: Offer to remove, default keep (estimate effort +3 %)
- Note: Answered by the user 2026-10-28: Offer to remove, default keep.

### G-228: Deleting an item that is in the account

- Status: Done (ADR-129)
- Origin: ADR-129, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on how a delete reaches other devices.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Delete everywhere at once, move to an account Trash kept for N days (you pick N), or delete only on this device?
- Suggested pick: Account Trash; N is your choice (estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Account Trash, 7 days.

### G-229: Data controller and contact

- Status: Done (ADR-130)
- Origin: ADR-130, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: The privacy notice has no controller name or contact.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Who is named as controller (you as a person, or a company) and which contact email?
- Suggested pick: The person or company that owns the backend account (ADR-127); only you can answer
- Note: Answered by the user 2026-10-28: Controller: the user as a person; contact Beliserii@gmail.com.

### G-230: Consent for sign-in storage

- Status: Done (ADR-130)
- Origin: ADR-130, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on a consent banner for the session stored on the device.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: A consent banner, or a line at sign-in explaining the strictly necessary session storage?
- Suggested pick: A line at sign-in, no banner (engineering guidance, not legal advice; to be checked)
- Note: Answered by the user 2026-10-28: Line at sign-in, no banner.

### G-231: Privacy notice language

- Status: Done (ADR-130)
- Origin: ADR-130, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No language chosen for the privacy notice.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Romanian, English or both?
- Suggested pick: Both: the app UI is English (ADR-020) and users are in Romania (estimate effort +5 %)
- Note: Answered by the user 2026-10-28: English.

### G-232: Retention after account deletion

- Status: Done (ADR-130)
- Origin: ADR-130, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No retention period; the vendor's backup period is unknown.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Delete at once (vendor backups age out), or keep N days so a deletion can be undone?
- Suggested pick: Delete at once and state the vendor's backup period once known
- Note: Answered by the user 2026-10-28: Delete at once.

### G-233: Privacy notice not reviewed by a lawyer

- Status: Done (ADR-130)
- Origin: ADR-130, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Nobody with legal training has reviewed the notice or the GDPR approach.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Have the notice reviewed before public sign-up opens?
- Suggested pick: Yes, before public sign-up
- Note: Answered by the user 2026-10-28: No legal review.

### G-234: Where the sign-in session is kept

- Status: Done (ADR-131)
- Origin: ADR-131, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on session storage.
- Request: “New adr for login using that persistent storage”
- Questions: IndexedDB or localStorage on the device (survives restarts and offline starts), memory only (sign in on every visit), or an httpOnly cookie (needs a server on the same site; GitHub Pages cannot set one)?
- Suggested pick: Device storage, protected by a strict CSP (closest to “login using that persistent storage”; estimate effort +0 %)
- Note: Answered by the user 2026-10-28: On the device.

### G-235: Rate-limit values

- Status: Done (ADR-131)
- Origin: ADR-131, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No rate-limit numbers for sign-in, share-link creation and share-link opening.
- Request: “New adr share link to templates/pieces”
- Questions: Which limits per account and per address?
- Suggested pick: Vendor defaults for sign-in; own share-link limits set once the vendor is known (values unknown today)
- Note: Answered by the user 2026-10-28: Vendor defaults first.

### G-236: Who can open a share link

- Status: Done (ADR-132)
- Origin: ADR-132, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No access model for share links.
- Request: “New adr share link to templates/pieces”
- Questions: Anyone with the link (unlisted), signed-in users only, named people, or a public gallery?
- Suggested pick: Anyone with the link (closest to “share link”; estimate effort +0 %)
- Note: Answered by the user 2026-10-28: Anyone with the link.

### G-237: Share-link expiry and revoking

- Status: Done (ADR-132)
- Origin: ADR-132, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on expiry or revoking.
- Request: “New adr share link to templates/pieces”
- Questions: No expiry, an expiry the owner sets, or a fixed expiry? Can the owner stop a link?
- Suggested pick: No expiry by default; the owner can stop a link (estimate effort +5 %)
- Note: Answered by the user 2026-10-28: No expiry, owner can stop.

### G-238: What a share link shows

- Status: Done (ADR-132)
- Origin: ADR-132, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on snapshot or latest version.
- Request: “New adr share link to templates/pieces”
- Questions: The item as it was when shared, or always its latest saved version?
- Suggested pick: Latest saved version: the link points at the item in the database (estimate effort +5 %)
- Note: Answered by the user 2026-10-28: Latest saved version.

### G-239: When to ask the browser to keep data

- Status: Done (ADR-133)
- Origin: ADR-133, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on when navigator.storage.persist() is called.
- Request: “new ADR for persistent storage and folder backup”
- Questions: At the first save automatically, or only from a button in Settings?
- Suggested pick: At the first save, with the state shown in Settings (closest to “persistent storage”; estimate effort +2 %)
- Note: Answered by the user 2026-10-28: At the first save.

### G-240: What a backup holds

- Status: Done (ADR-133)
- Origin: ADR-133, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on backup contents.
- Request: “new ADR for persistent storage and folder backup”
- Questions: Everything you made (all saved tables: pieces, projects, templates, pictures, 3D models, decors, prices, versions), or pieces, projects and templates only?
- Suggested pick: Everything (estimate effort +10 %, value +25 %)
- Note: Answered by the user 2026-10-28: Everything.

### G-241: Backup layout

- Status: Done (ADR-133)
- Origin: ADR-133, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No backup layout chosen.
- Request: “new ADR for persistent storage and folder backup”
- Questions: One importable file per item in subfolders, or one .zip?
- Suggested pick: One file per item, readable and copyable (closest to “folder backup”; estimate effort +5 %)
- Note: Answered by the user 2026-10-28: One file per item.

### G-242: When backups run

- Status: Done (ADR-133)
- Origin: ADR-133, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No backup trigger chosen.
- Request: “new ADR for persistent storage and folder backup”
- Questions: Manual Back up now, automatic after changes while the app is open, or both?
- Suggested pick: Both (estimate effort +15 %)
- Note: Answered by the user 2026-10-28: Both.

### G-243: Browsers without folder access

- Status: Done (ADR-133)
- Origin: ADR-133, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Folder access (showDirectoryPicker) is missing on some browsers, e.g. iPhone Safari and Firefox (to verify on MDN when building).
- Request: “new ADR for persistent storage and folder backup”
- Questions: Download a .zip backup there, or offer nothing?
- Suggested pick: A .zip download with the same layout (ADR-121 zip; estimate effort +5 %)
- Note: Answered by the user 2026-10-28: .zip download.

### G-244: Restoring a backup

- Status: Done (ADR-133)
- Origin: ADR-133, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No restore rule.
- Request: “new ADR for persistent storage and folder backup”
- Questions: Restore as new copies (new ids, ADR-011), or by id replacing existing rows?
- Suggested pick: New copies, skipping items identical to one already saved; replacing would rewrite saved designs
- Note: Answered by the user 2026-10-28: New copies.

### G-245: What 'login using that persistent storage' means

- Status: Done (ADR-134)
- Origin: ADR-134, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Item 2 has two readings and no Decision for that part.
- Request: “New adr for login using that persistent storage”
- Questions: (A) a local profile or lock on this device with no server, or (B) the account sign-in of ADR-135/136 kept in persistent storage so it survives restarts and offline starts?
- Suggested pick: B: items 3 and 4 are logins to an account (estimate: B +10 % on top of ADR-131; A +25 % as a separate feature, and a real lock needs encryption)
- Note: Answered by the user 2026-10-28: B: account session kept on the device.

### G-246: Reading A: lock or profiles

- Status: Done (ADR-134)
- Origin: ADR-134, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: If reading A is chosen, its form is open.
- Request: “New adr for login using that persistent storage”
- Questions: A PIN/passphrase lock (needs the saved data encrypted to protect anything), or several local profiles each with its own designs?
- Suggested pick: Only if A is chosen: a passphrase lock with encrypted storage (closest to “login”)
- Note: Answered by the user 2026-10-28: Not applicable (reading B chosen).

### G-247: Google sign-in: redirect or popup

- Status: Done (ADR-135)
- Origin: ADR-135, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No sign-in flow chosen.
- Request: “New adr for gmail login”
- Questions: Full-page redirect or popup?
- Suggested pick: Redirect: works in the installed app and on phones that block popups (estimate effort +0 %)
- Note: Answered by the user 2026-10-28: Full-page redirect.

### G-248: Google OAuth client and consent screen

- Status: Done (ADR-135)
- Origin: ADR-135, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No Google Cloud OAuth client or consent screen exists; Google's verification requirements are unknown.
- Request: “New adr for gmail login”
- Questions: Who registers the OAuth client and consent screen (app name, privacy notice link)?
- Suggested pick: You, under the account of ADR-127
- Note: Answered by the user 2026-10-28: The user, under the same personal account.

### G-249: Same email by Google and by password

- Status: Done (ADR-135)
- Origin: ADR-135, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No rule for one email used with both sign-in methods.
- Request: “New adr for gmail login”
- Questions: Link them when the email is verified, keep separate accounts, or ask?
- Suggested pick: Link when verified (estimate effort +0-5 %)
- Note: Answered by the user 2026-10-28: Link when verified, then revised with G-254: no linking; Google and password logins with one email stay separate.

### G-250: Email provider for reset emails

- Status: Done (ADR-136)
- Origin: ADR-136, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Forgot/reset password and email verification need an email sender; none is chosen.
- Request: “New adr for ui login (including gmail)/logout/forgot password/reset password”
- Questions: The backend's built-in email (limits unknown), or your own sender through SMTP (e.g. Brevo, Resend, Amazon SES; facts unknown)?
- Suggested pick: Your own sender set in the backend, after checking its free limits (reset mail must arrive; estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Supabase built-in email.

### G-251: Where Account sits

- Status: Done (ADR-136)
- Origin: ADR-136, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No place chosen for the Account entry.
- Request: “New adr for ui login (including gmail)/logout/forgot password/reset password”
- Questions: An Account icon button in the top bar, an item in the ⋯ menu, or Settings?
- Suggested pick: Top bar icon button, visible at 390 and 1280 px (estimate effort +3 %)
- Note: Answered by the user 2026-10-28: Top bar icon.

### G-252: Create account screen

- Status: Done (ADR-136)
- Origin: ADR-136, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Item 4 names login, logout, forgot and reset, not sign-up.
- Request: “New adr for ui login (including gmail)/logout/forgot password/reset password”
- Questions: Include Create account with email and password, or allow new accounts only through Google?
- Suggested pick: Include it: forgot and reset password imply email accounts (estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Yes, Create account.

### G-253: Password rules

- Status: Done (ADR-136)
- Origin: ADR-136, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No password rule chosen.
- Request: “New adr for ui login (including gmail)/logout/forgot password/reset password”
- Questions: The provider's default, or a minimum length you set?
- Suggested pick: The provider's default, shown under the field
- Note: Answered by the user 2026-10-28: Supabase default.

### G-254: Email verification

- Status: Done (ADR-136)
- Origin: ADR-136, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on verifying the email before the first sign-in.
- Request: “New adr for ui login (including gmail)/logout/forgot password/reset password”
- Questions: Require verification, or not?
- Suggested pick: Require it (stops sign-ups with someone else's email; estimate effort +5 %)
- Note: Answered by the user 2026-10-28: No email verification.

### G-255: Automatic or per item

- Status: Done (ADR-137)
- Origin: ADR-137, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on how items reach the account.
- Request: “New adr for save user templates and created pieces in db”
- Questions: While signed in, every saved piece and template goes to the account automatically, or only those marked Save to account?
- Suggested pick: Automatic, with Keep on this device only per item (closest to “save ... in db”; estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Automatic, with Keep on this device only.

### G-256: Edited shipped templates

- Status: Done (ADR-137)
- Origin: ADR-137, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on local templates that shadow shipped ones (ADR-034).
- Request: “New adr for save user templates and created pieces in db”
- Questions: Save your edits of shipped templates to the account too?
- Suggested pick: Yes: they are your templates (estimate effort +2 %)
- Note: Answered by the user 2026-10-28: Yes.

### G-257: Share links beside design codes

- Status: Done (ADR-138)
- Origin: ADR-138, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on Copy code (ADR-124) once share links exist.
- Request: “New adr share link to templates/pieces”
- Questions: Keep Copy code beside Share link, or replace it?
- Suggested pick: Keep both: codes work offline and without an account (estimate effort +0 %)
- Note: Answered by the user 2026-10-28: Keep both.

### G-258: Share-link form

- Status: Done (ADR-138)
- Origin: ADR-138, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No link form chosen.
- Request: “New adr share link to templates/pieces”
- Questions: A fragment link …/furniture-builder/#share=<id> (never sent to GitHub Pages), or a path …/s/<id> (needs a 404.html redirect on Pages)?
- Suggested pick: Fragment (estimate effort +0 %)
- Note: Answered by the user 2026-10-28: #share=<id>.

### G-259: List of your shared links

- Status: Done (ADR-138)
- Origin: ADR-138, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No overview of shared links.
- Request: “New adr share link to templates/pieces”
- Questions: A Shared links list in Account with Stop sharing, or only per item?
- Suggested pick: Per item plus the list (estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Per item + list.

### G-260: Where sync status shows

- Status: Done (ADR-139)
- Origin: ADR-139, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Proposed by Claude, not requested.
- Request: Task 2026-10-28: “propose further architecture and UX ADRs” (proposed by Claude, not requested)
- Questions: Beside the save status in the top bar, as a badge per item in lists, or both?
- Suggested pick: Both (estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Both.

### G-261: When the device-only banner shows

- Status: Done (ADR-140)
- Origin: ADR-140, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Proposed by Claude, not requested.
- Request: Task 2026-10-28: “propose further architecture and UX ADRs” (proposed by Claude, not requested)
- Questions: Always while nothing is backed up or in an account (dismissible for N days you choose), or once only?
- Suggested pick: Dismissible, back after N days you choose
- Note: Answered by the user 2026-10-28: Dismissible, back after 7 days.

### G-262: Backup reminder interval

- Status: Done (ADR-141)
- Origin: ADR-141, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Proposed by Claude, not requested.
- Request: Task 2026-10-28: “propose further architecture and UX ADRs” (proposed by Claude, not requested)
- Questions: A fixed interval, or a Settings choice (including Off) starting at a value you pick?
- Suggested pick: A Settings choice; the starting value is yours
- Note: Answered by the user 2026-10-28: Settings choice with Off, starting at 30 days.

### G-263: Several accounts on one device

- Status: Done (ADR-142)
- Origin: ADR-142, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Proposed by Claude, not requested.
- Request: Task 2026-10-28: “propose further architecture and UX ADRs” (proposed by Claude, not requested)
- Questions: Several accounts with separate account copies, or one account at a time?
- Suggested pick: Several, each with its own account copies; device-only items stay visible to all (estimate effort +20 %)
- Note: Answered by the user 2026-10-28: Several accounts.

### G-264: What the shared-item preview shows

- Status: Done (ADR-143)
- Origin: ADR-143, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Proposed by Claude, not requested.
- Request: Task 2026-10-28: “propose further architecture and UX ADRs” (proposed by Claude, not requested)
- Questions: Name, front view and part count; plus 3D; or plus the full cut list?
- Suggested pick: Name, front view and part count, then Open a copy (estimate effort +0 %)
- Note: Answered by the user 2026-10-28: Name, front view, parts, plus 3D.

### G-265: 2D label for Front too

- Status: Done (ADR-144)
- Origin: ADR-144, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: The piece editor labels the drawing Front, not Plan; the request names only Plan.
- Request: User 2026-10-28: "ADR to have the views container same in compose and build and preview. Same 2D(rename it to 2D from Plan), 3D and both toggle"
- Questions: Rename Front to 2D too, or only Plan?
- Suggested pick: Both become 2D: one label in every container (closest to 'same'; estimate effort +2 %)

### G-266: View kept across modes

- Status: Done (ADR-144)
- Origin: ADR-144, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Today changing mode resets the view to that mode's default (ADR-081).
- Request: User 2026-10-28: "ADR to have the views container same in compose and build and preview. Same 2D(rename it to 2D from Plan), 3D and both toggle"
- Questions: Keep one chosen view across Compose and Build & Preview, or keep a separate default per mode?
- Suggested pick: One chosen view kept across modes (closest to 'same'; estimate effort +3 %)

### G-267: View switch in phone Compose

- Status: Done (ADR-144)
- Origin: ADR-144, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: On a phone Compose has no View switch and never mounts 3D (ADR-079, ADR-081).
- Request: User 2026-10-28: "ADR to have the views container same in compose and build and preview. Same 2D(rename it to 2D from Plan), 3D and both toggle"
- Questions: Show 2D, 3D and Both in phone Compose too (the 3D canvas then mounts there when chosen), or keep phone Compose 2D only?
- Suggested pick: Show them in phone Compose too (closest to 'same'; estimate effort +10 %, risk: 3D on a phone while composing is slower)

### G-268: One default view

- Status: Done (ADR-144)
- Origin: ADR-144, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No single default view for both modes.
- Request: User 2026-10-28: "ADR to have the views container same in compose and build and preview. Same 2D(rename it to 2D from Plan), 3D and both toggle"
- Questions: Default view for both modes: 2D below 1500 px and Both from 1500 px; 3D below 1500 px; or Both everywhere?
- Suggested pick: 2D below 1500 px and Both from 1500 px (keeps the editing drawing first, ADR-014; estimate effort +0 %)

### G-269: Phone view tools in both modes

- Status: Done (ADR-144)
- Origin: ADR-144, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: On a phone the view tools sit behind an Options button only in Build & Preview.
- Request: User 2026-10-28: "ADR to have the views container same in compose and build and preview. Same 2D(rename it to 2D from Plan), 3D and both toggle"
- Questions: Use the Options button on a phone in both modes, or inline tools in both? Answer 2026-10-28: "in options all except Fronts, Select, Move, Turn 90 both of them"
- Suggested pick: The Options button in both modes on a phone (keeps the stage height; estimate effort +2 %)

### G-270: Front-view wall background: which wall and area

- Status: Done (ADR-145)
- Origin: ADR-145 (open question)
- Missing: Front view: which wall's background is drawn behind a piece, and over what area
- Request: Set wall background; answers 2026-10-28: colour or picture, 3D view and front view, per wall, toggle solid/see-through
- Questions: Use the wall the piece's back stands against (back on the wall line, same tolerance as wall snapping, ADR-070), or let the user pick the wall in the front view? Fill the whole drawing area or only the wall height above the floor?
- Suggested pick: The wall the piece's back stands against; fill from the floor to the room height across the drawing; no background when the piece stands against no wall or the project has no room. Closest to 'the wall behind the piece'.

### G-271: Wall picture tile size

- Status: Done (ADR-145)
- Origin: ADR-145 (open question)
- Missing: Size one copy of a wall picture covers before it repeats
- Request: Set wall background; answers 2026-10-28: colour or picture, 3D view and front view, per wall, toggle solid/see-through
- Questions: Set by the user in mm (width × height), like board pictures (ADR-048)? What starting size?
- Suggested pick: User-set width × height in mm, like ADR-048; the picture starts at its own aspect ratio, 1000 mm wide, and the field says to set the real size (a starting value, not a spec).

### G-272: Wall toggle: saved or per device

- Status: Done (ADR-145)
- Origin: ADR-145 (open question)
- Missing: Where the solid / see-through toggle lives and what it starts as
- Request: Set wall background; answers 2026-10-28: colour or picture, 3D view and front view, per wall, toggle solid/see-through
- Questions: Saved in the project (same on every device and in exports), or a view setting on this device only? Start solid or see-through?
- Suggested pick: A 3D view setting on this device ('Solid walls'), starting see-through as today; the front view always shows the background. Keeps the project document smaller and today's look unchanged.

### G-273: Wall backgrounds outside 3D and front view

- Status: Done (ADR-208)
- Origin: ADR-145 (out of scope)
- Missing: Wall backgrounds on the 2D floor plan, the SVG download, catalog snapshots and cut sheets
- Request: Set wall background; answers 2026-10-28: colour or picture, 3D view and front view, per wall, toggle solid/see-through
- Questions: Show the wall colour on the plan too?
- Suggested pick: Colour strip along each wall on the plan only; the others stay as they are.
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: Wall backgrounds do not show on the 2D plan, SVG download, catalog snapshots or cut sheets.
- Fix: Draw a colour strip along each wall on the plan only; leave other outputs unchanged.
- Conflicts: none

### G-274: Floor background

- Status: Done (ADR-208)
- Origin: ADR-145 (out of scope)
- Missing: Floor colour or picture
- Request: Set wall background; answers 2026-10-28: colour or picture, 3D view and front view, per wall, toggle solid/see-through
- Questions: Set the floor like the walls?
- Suggested pick: Same picker for the floor in a later ADR, reusing this one's code.
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: The floor cannot be given a colour or picture as the walls can.
- Fix: A later ADR adding the same colour/picture picker for the floor, reusing the wall code.
- Conflicts: none

### G-275: Wall background in the single-piece front view

- Status: Done (ADR-208)
- Origin: ADR-145 (found while building)
- Missing: The wall background shows in the project's front view (the whole room seen from the front); the front view of a single piece, opened from the project, shows no wall behind it
- Request: Set wall background adr; answers 2026-10-28: 3D view and front view
- Questions: Show the wall the piece stands against behind it in the single-piece front view too?
- Suggested pick: Yes: the same floor-to-room-height fill behind the piece when it is opened from a project with a room (estimate: effort +10%, value +10%)
- Work: Low-medium
- Impact: Low-medium
- Necessity: Low-medium
- Issue: A single piece opened from a project shows no wall background behind it in its front view.
- Fix: Fill the wall finish floor-to-room-height behind the piece when opened from a project with a room.
- Conflicts: none

### G-283: Where the four straighten corners are placed

- Status: Done (ADR-146)
- Origin: ADR-146 (open question)
- Missing: Where the user marks the wall's corners in an angled photo
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: A: a Straighten dialog over the whole photo, four handles dragged onto the wall's corners in the photo; B: in 3D, each corner of the picture dragged freely on the wall
- Suggested pick: A — it is what the user picked (handles onto the wall's corners in the photo); the whole photo stays visible, also the parts beyond the wall. B is ~+20 % work (estimate) for no more of the request

### G-284: What happens to the repeating picture

- Status: Done (ADR-146)
- Origin: ADR-146 (open question)
- Missing: Whether a wall picture still repeats (ADR-145) once it can fill the wall
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: A: a Repeat / Fill wall choice, a new picture starts as Repeat (today); B: a new picture starts as Fill wall, Repeat kept; C: drop Repeat, every picture fills its rectangle once
- Suggested pick: B — fill one wall exactly is what the user asked; tiles (ADR-145) keep working. A and C: no extra work

### G-285: Front view follows the fitted picture

- Status: Done (ADR-146)
- Origin: ADR-146 (open question)
- Missing: Whether the project front view (ADR-145) draws the shifted, stretched, straightened picture
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: A: yes, the same rectangle and straightening; B: no, the front view keeps repeating tiles
- Suggested pick: A — the user asked for the front view background in ADR-145, and a fitted wall looks wrong if the front view differs; ~+15 % work (estimate), +20 % of value (estimate)

### G-286: Snapping and proportions while dragging

- Status: Done (ADR-146)
- Origin: ADR-146 (open question)
- Missing: How a dragged picture edge snaps, and whether stretching keeps the picture's proportions
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: Snap: A: edges snap to the wall ends, floor and ceiling, off with the Snap toggle and Alt (ADR-070); B: no snap. Proportions: C: free stretch, D: kept, E: free, Shift keeps them
- Suggested pick: A + C — fill one wall exactly needs edges that land on the wall ends; stretch means free. ~+10 % work for A (estimate)

### G-290: Group width for pieces not in columns

- Status: Done (obsolete: user decision 2026-11-05, a Width change is refused with the reason, as answered (ADR-148))
- Origin: ADR-148, 2026-10-29; scope (Claude)
- Missing: A group whose pieces overlap in x without sharing the same span (e.g. a wall unit straddling two base units) refuses a Width change.
- Request: add the possibility to set the width, height and depth of grouped items, add the possibility to block group items from being moved separately.
- Questions: Refuse, or scale every position around the left edge (pieces may stop touching by 1 mm)?
- Suggested pick: Scale positions around the left edge, rounding shared edges once (closer to the request; estimate effort +25 %, value +10 %)
- Answer: 2026-10-29 (user) "Refuse (as in ADR)"; ADR-148 refuses with the reason

### G-291: Vertical moves of a grouped piece do not carry the group

- Status: Done (ADR-148)
- Origin: ADR-148, 2026-10-29; scope (Claude)
- Missing: The wall-height drag in 3D, the From floor field and the gap tool move one grouped piece up/down or along alone.
- Request: add the possibility to set the width, height and depth of grouped items, add the possibility to block group items from being moved separately.
- Questions: Should vertical moves and the gap tool also move the whole group?
- Suggested pick: Yes, move the whole group (closer to 'block group items from being moved separately'; estimate effort +20 %)
- Answer: 2026-10-29 (user) "Yes, move group"; built in ADR-148

### G-292: Mirror of one grouped piece alone

- Status: Done (ADR-148)
- Origin: ADR-148, 2026-10-29; scope (Claude)
- Missing: Mirroring a single grouped piece from its own card is not routed to the group.
- Request: add the possibility to set the width, height and depth of grouped items, add the possibility to block group items from being moved separately.
- Questions: Mirror the whole group, or allow a single piece to mirror in place?
- Suggested pick: Mirror the whole group (closer to the request; estimate effort +5 %)
- Answer: 2026-10-29 (user) "Mirror the group"; built in ADR-148

### G-293: Repairs and Mirror the run move a grouped piece alone

- Status: Done (ADR-176)
- Origin: ADR-148, 2026-10-29; scope (Claude)
- Missing: Automatic repairs from the problem banner and Mirror the run can still move one grouped piece without its group.
- Request: add the possibility to set the width, height and depth of grouped items, add the possibility to block group items from being moved separately.
- Questions: Should repairs and Mirror the run also carry or refuse grouped pieces?
- Suggested pick: Carry the whole group, refusing a repair the group cannot follow (closer to the request; estimate effort +10 %)

### G-294: Move to for several selected pieces

- Status: Done (ADR-182)
- Origin: ADR-147, 2026-10-29; out of scope
- Missing: Move to actions move only the selected piece, not a multi-selection
- Request: add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest left piece, snap to closest right piece, and any other snaps you think would be appropriate
- Questions: Should Move to move every selected piece as one block?
- Suggested pick: Yes, as one block (closest to how drag moves a selection; estimate +20 % work)

### G-295: Move to for a stacked piece

- Status: Done (ADR-147)
- Origin: ADR-147, 2026-10-29; open question
- Missing: How sideways and ceiling moves work for a piece placed above another
- Request: add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest left piece, snap to closest right piece, and any other snaps you think would be appropriate
- Questions: (a) move along its base via offsetX, lift off for ceiling; (b) lift off and move freely; (c) disabled
- Suggested pick: (a), keeps it on its base (estimate +10 % work)
- Answer: User 2026-10-29: "Slide along base" — sideways moves change its offset on the piece below; To ceiling lifts it off.

### G-296: Align top or front: which neighbour

- Status: Done (ADR-147)
- Origin: ADR-147, 2026-10-29; open question
- Missing: Which neighbour Align top and Align front use
- Request: add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest left piece, snap to closest right piece, and any other snaps you think would be appropriate
- Questions: (a) separate left and right buttons; (b) the nearer neighbour, left on a tie
- Suggested pick: (a), says exactly which piece (estimate +5 % work)
- Answer: User 2026-10-29: "Left / right buttons" — Align top and Align front each for the left and the right neighbour.

### G-297: Move to for a freely turned piece

- Status: Done (ADR-147)
- Origin: ADR-147, 2026-10-29; open question
- Missing: What Move to does for a piece turned by a free angle (ADR-121)
- Request: add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest left piece, snap to closest right piece, and any other snaps you think would be appropriate
- Questions: (a) all actions disabled; (b) vertical actions only
- Suggested pick: (b), keeps ceiling and floor working (estimate +3 % work)
- Answer: User 2026-10-29: "Vertical only" — To ceiling and Down work; the other actions are off, "turned freely".

### G-298: Research data stale after research batches 1-5

- Status: Done (ADR-152)
- Origin: ADR-149 (merged with main 2026-10-29)
- Missing: Research features built by ADR-121..125 (research batches 1-5: on-demand rendering, typed rotation, version history, design codes, sinks and handles, spatial query engine and others) are still listed as not built in the research data
- Request: "Re-validate, remove implemented ones"
- Questions: Re-validate again against ADR-121..125 and delete those features too?
- Suggested pick: Yes, re-check and delete them the same way as ADR-149 (estimate: effort +20% of ADR-149, value: keeps the list to what is left)

### G-299: Part boards find-it test

- Status: Done (PR #132)
- Origin: N152 (PR #132, light acceptance)
- Missing: jsdom find-it test for Settings → Part boards: pick a board for one part, see it in the Parts list, the lost-part warning and Clear
- Request: Ff any piece of the item can have own material changed.
- Questions: Write the jsdom find-it now in PR #132, or wait for 'catch up acceptance'?
- Suggested pick: Write it now in PR #132 (closest to the request: proves the feature is reachable). Estimate +15 % work, +10 % value (evidence, not new behaviour).
- Note: User 2026-10-29: "2 write". Built: `tests/find-it/part-boards.test.tsx` (390 and 1280 px), passes locally.

### G-300: Distribute evenly with grouped pieces

- Status: Done (user 2026-10-29 "fix distribute too"; built in N154)
- Origin: Bug fix 2026-10-29 (align with groups, N154)
- Missing: Distribute evenly still moves each selected piece on its own; when several selected pieces share a group, the group is carried by the first member's offset, so the gaps may not come out equal. Not checked.
- Request: The align is bugged because when I select a piece and I press align left, it moves to the right.
- Questions: Should Distribute evenly treat a group as one block, like Align?
- Suggested pick: Group = one block, the same as the Align answer of 2026-10-29.

### G-302: Lint for untranslated text

- Status: Done (obsolete: user decision 2026-11-05, no lint rule; CLAUDE.md and the type check only)
- Origin: ADR-153 (out of scope)
- Missing: A lint rule that flags English text written outside t()
- Request: add a implementation rule/constraint to also add translation on any text added/modified/deleted
- Questions: Add the hardcoded-string lint?
- Suggested pick: User chose CLAUDE.md + type check only (2026-10-29)

### G-303: Gaps page not translated

- Status: Done (obsolete: user decision 2026-11-05, the Gaps page stays English)
- Origin: ADR-154 (out of scope)
- Missing: The Gaps page (labels and entries) stays English
- Request: add support for Russian language, have it toggle, also translate all the existing content ...
- Questions: Translate the Gaps page?
- Suggested pick: User 2026-10-29: Ignore gaps

### G-304: User-typed names not translated

- Status: Done (obsolete: user decision 2026-11-05, user-typed names are not translated)
- Origin: ADR-155 (out of scope)
- Missing: Names the user typed (pieces, projects, boards) are not translated
- Request: add support for Russian language, have it toggle, also translate all the existing content ...
- Questions: Translate user-typed names?
- Suggested pick: No: they are the user's own text

### G-307: Plan layer filter (All / Floor / Wall) for stacked pieces

- Status: Done (obsolete: user decision 2026-11-05, the plan keeps no layer filter)
- Origin: ADR-159
- Missing: A layer filter on the plan so taps and box select reach only floor or only wall pieces where they overlap.
- Request: The select is broken, wall and floor items are overlapping, correct select impossible (picked 'Layer filter', then 'Keep plan as is', 2026-10-29)
- Questions: Build a plan layer filter at all, now that the front view, 3D and the piece list select several pieces?
- Suggested pick: None suggested: the user's latest answer keeps the plan as is.

### G-308: Selection box in the front view and the 3D view

- Status: Done (ADR-211)
- Origin: ADR-159
- Missing: Dragging on empty space in the room front view or the 3D view does not draw a selection box; only taps (Select on, or Shift/Ctrl-click) add pieces there.
- Request: Add the select to 3d, so i can click on them to multiselect
- Questions: Should the front view and 3D also get a drag-to-box selection?
- Suggested pick: Front view only (3D drags orbit the camera); closest to the plan's existing box.
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: Dragging empty space in the room front view or 3D view draws no selection box.
- Fix: Add a drag-to-box selection in the front view only, like the plan's box.
- Conflicts: none

### G-309: Single-piece Inspector not reordered

- Status: Done (ADR-160)
- Origin: ADR-160 (side panel critique, 2026-10-30)
- Missing: The side panel of a single piece outside a project (Inspector) keeps its old order; ADR-160 reorders only the project panel.
- Request: Agree with all, implement, fix, remove the how many completely, there already is rotation in toolbar, no more need for the 4 buttons, also remove the rotation degree input, hidden for now
- Questions: Should the single-piece Inspector get the same treatment (action toolbar, More menu, open first group)?
- Suggested pick: Yes, in a follow-up ADR; it is the same panel when no project is open.
- Answer (user, 2026-10-30): "Flatten + order"; built in ADR-160.

### G-310: Build & Preview side panel content undecided

- Status: Done (obsolete: built as answered; the side panel shows the Compose panel in every mode, src/ui/App.tsx:803-808; user 2026-11-05)
- Origin: ADR-160 (side panel critique, 2026-10-30)
- Missing: In Build & Preview the side panel shows the same Compose panel; the critique asked whether that is intended and the user did not answer.
- Request: Agree with all, implement, fix, remove the how many completely, there already is rotation in toolbar, no more need for the 4 buttons, also remove the rotation degree input, hidden for now
- Questions: Should Build & Preview show a different side panel (for example finishes and checks only)?
- Suggested pick: Keep the same panel until the user says what Build & Preview should show.
- Answer (user, 2026-10-30): "Same as Compose".

### G-313: Extra seller items only per piece

- Status: Done (ADR-210)
- Origin: ADR-161, 2026-10-30; agent scoped it out
- Missing: In a project view, a seller product cannot be added as an extra item; open a piece to add it there. Hardware links chosen in the project view are written to every piece that has that hardware line.
- Request: Match products to parts in app
- Questions: Should a project hold its own extra seller items?
- Suggested pick: Add project-level extra items (estimate: effort +20 %, value +10 %)
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: A project cannot hold its own extra seller items; they must be added to a single piece.
- Fix: Add project-level extra seller items to the project document (needs an ADR and schema bump).
- Conflicts: none

### G-314: Fasteners and run parts not matched

- Status: Done (ADR-206)
- Origin: ADR-161, 2026-10-30; agent scoped it out
- Missing: Screws, dowels, cams (fasteners, ADR-074) and run parts (plinths, fillers, cornices) are not matched to seller products.
- Request: Match products to parts in app
- Questions: Match fasteners and run parts to seller products too?
- Suggested pick: Yes: a product button on fastener lines and on run parts (estimate: effort +25 %, value +10 %)
- Work: Medium
- Impact: Medium
- Necessity: Low-medium
- Issue: Fasteners and run parts (plinths, fillers, cornices) cannot be matched to seller products.
- Fix: Add a product picker button on fastener lines and run parts, as on hardware lines.
- Conflicts: none

### G-316: Seller pictures not seen before shipping

- Status: Done (ADR-206)
- Origin: ADR-162, 2026-10-30; agent scoped it out
- Missing: The board pictures are now downloaded and shipped (public/sellers/regency, 1 453 files) and a 16-picture sample was checked by eye, but none has been seen as a board texture in 3D in a browser.
- Request: You didnt use the image i provided to render
- Questions: Are the seller's pictures good board textures (whole panel photo vs decor swatch)?
- Suggested pick: Check a few boards in 3D after the first download; adjust the tile size if needed (estimate: effort 5 %)
- Work: Low
- Impact: Medium
- Necessity: Medium
- Issue: Shipped seller board pictures were never seen as board textures in 3D in a browser.
- Fix: Open a few seller boards in 3D on the production build; adjust the texture tile size if needed.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-317: Run-part boards in the Material dialog

- Status: Done (ADR-188)
- Origin: ADR-163
- Missing: The worktop, filler and cover boards of a run are not offered in the Material dialog; they keep their own select under Run parts.
- Request: Adjusting the material used MUST be always available.
- Questions: Should run-part boards join the Material dialog as a Worktop / Fillers role with scope Group?
- Suggested pick: Add them as roles in a later ADR (closest to 'always available').
- Work: Medium
- Impact: Medium
- Necessity: Medium
- Issue: Run worktops, fillers and cover boards cannot be changed from the Material dialog; they use a separate select.
- Fix: Add Worktop and Fillers roles with Group scope to the Material dialog in a later ADR.
- Conflicts: none

### G-318: Edge band per role in the Material dialog

- Status: Done (ADR-188)
- Origin: ADR-163
- Missing: The Material dialog changes boards only; the edge band of a role stays the board's band (ADR-077).
- Request: Not only piece/carcass, but any other combination or piece separately.
- Questions: Should a role also take an edge-band choice?
- Suggested pick: Add an edge-band select per role in a later ADR.
- Work: Medium
- Impact: Medium
- Necessity: Low-medium
- Issue: The Material dialog changes boards only; a role's edge band always follows its board's band.
- Fix: Add an edge-band select per role in the Material dialog, stored as a per-role band override.
- Conflicts: none

### G-319: App-wide Materials list

- Status: Done (obsolete: user decision 2026-11-05, no app-wide Materials list; project boards and the decor list)
- Origin: ADR-164
- Missing: No app-wide Materials list on the device; board choices come from the project's boards and the decor list.
- Request: The pal chosen at the beginning should be the same one from the Materials section.
- Questions: Should the device keep one Materials list every project draws from (new Dexie table)?
- Suggested pick: Keep project boards + decor list (the user's pick); an app-wide list only on request.

### G-320: Common panel across a gap

- Status: Done (ADR-189)
- Origin: ADR-165
- Missing: A common top or bottom needs touching items; a gap between items is not bridged.
- Request: Add the possibility to have a common bottom or top between multiple items.
- Questions: Should one panel bridge a gap between items?
- Suggested pick: Touching items only (the user's pick).
- Note: Reopened by the user 2026-11-05 ('Build them: PR #151 wins'); built by ADR-189/ADR-190.

### G-321: Shared side between neighbours

- Status: Done (ADR-190)
- Origin: ADR-165
- Missing: Items under a common top or bottom keep their own two sides; no shared side between neighbours.
- Request: Add the possibility to have a common bottom or top between multiple items.
- Questions: Should neighbours also share one side panel?
- Suggested pick: Own sides (the user's pick); a shared side in a later ADR.
- Note: Reopened by the user 2026-11-05 ('Build them: PR #151 wins'); built by ADR-189/ADR-190.

### G-322: Common panel on corner cabinets and desks

- Status: Done (ADR-189)
- Origin: ADR-165
- Missing: Only cabinets join a common top or bottom; corner cabinets, desks and frames are refused with the reason.
- Request: Add the possibility to have a common bottom or top between multiple items.
- Questions: Should corner cabinets and desks join a common panel?
- Suggested pick: Cabinets first; corners and desks in a later ADR.
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: Only plain cabinets can share a common top or bottom; corner cabinets and desks are refused.
- Fix: Extend the common-panel check and build to corner cabinets and desks in a later ADR.
- Conflicts: none

### G-323: Variables outside projects

- Status: Done (ADR-170)
- Origin: ADR-166, 2026-10-30; agent scoped it out
- Missing: Variables and bindings live in a project only: the stand-alone design editor has none, a design saved to the catalog loses its bindings, and a project template (ADR-060, templateFromProject) also drops both the variables and the bindings, although ADR-166 says it keeps them.
- Request: Not a quote: the user asked for variables "within the project".
- Questions: Should a saved design or the catalog carry bindings as parameters?
- Suggested pick: Keep bindings in project templates only (built); add variables to catalog designs as a later ADR (estimate: effort +40%, value +15%).
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-324: Formula functions

- Status: Done (ADR-206)
- Origin: ADR-166, 2026-10-30; agent scoped it out
- Missing: Formulas know only + − × ÷ and parentheses: no min, max, round, floor or conditions.
- Request: Formulas too (user answer 2026-10-30).
- Questions: Which functions are needed: min/max, round to a sheet thickness, if?
- Suggested pick: Add min, max, floor, ceil and round when a real project needs one (estimate: effort +10%, value +10%).
- Work: Low-medium
- Impact: Low-medium
- Necessity: Low
- Issue: Formulas support only arithmetic and parentheses; no min, max, rounding or conditions.
- Fix: Add min, max, floor, ceil and round to the formula parser when a real project needs them.
- Conflicts: none

### G-325: Variables on run parts

- Status: Done (ADR-209)
- Origin: ADR-166, 2026-10-30; agent scoped it out
- Missing: Run parts, worktops, run handles and sinks (ADR-036, ADR-075, ADR-125) cannot be bound to a variable; they follow the pieces they are derived from.
- Request: Not a quote: the user named pieces only.
- Questions: Should a run request (a worktop length or overhang) take a formula?
- Suggested pick: Bind run-request sizes the same way as piece sizes (estimate: effort +15%, value +10%).
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: Run parts such as worktop length or overhang cannot be bound to a project variable.
- Fix: Allow bindings on run-request sizes the same way as piece sizes.
- Conflicts: none

### G-326: Run requests not duplicated per set

- Status: Done (ADR-175)
- Origin: ADR-167, 2026-10-30; agent scoped it out
- Missing: Run requests, run handles and sinks on set-1 pieces are not copied to the set-N duplicates inside the project (syncSets); only "save a set as a separate project" (projectFromSet) carries them over.
- Request: Not a quote: the user asked for the pieces and the room to be duplicated.
- Questions: Copy run requests, run handles and sinks to each set?
- Suggested pick: Copy them with the pieces, keyed by the duplicate ids (estimate: effort +20%, value +15%).
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-327: Unbound pieces stay out of a set

- Status: Done (ADR-167)
- Origin: ADR-167, 2026-10-30; agent scoped it out
- Missing: Only pieces with a binding (and their linked copies) are duplicated into a set; a piece without bindings is not in the set and is only shown once, in set 1.
- Request: "it would duplicate the existing pieces that use that variable, but with the new values".
- Questions: Should pieces placed on a bound piece (ADR-031) or grouped with one (ADR-097) follow it into the set?
- Suggested pick: Duplicate a piece whose base is a bound piece too (estimate: effort +15%, value +15%).

### G-328: Feature tree details left short

- Status: Done (ADR-183)
- Origin: N170 (ff), 2026-11-04; agent left them out
- Missing: Seven feature-tree lines keep correct but incomplete details: Drag a piece on the plan (arrow keys), Wall colour or picture (where it shows, Solid walls), 2D, 3D or both (one switch in both modes), Share links, Save pieces and templates to your account, Boards and edge bands from a seller (seller pictures load online), Seller products for hardware (Add seller product).
- Request: “Sync features and gaps with latest changes, remove implemented, validate still listed, remove obsolete”
- Questions: Add the longer details to these seven lines?
- Suggested pick: Add them with their Russian entries (estimate: effort +10%, value +5%).

### G-329: Typed connectors and assembly graph

- Status: Done (ADR-207)
- Origin: ADR-168, 2026-11-04; agent scoped it out
- Missing: Connector types and a typed assembly graph (research model): connections are untyped pairs of side-by-side pieces.
- Request: “Validate all High demand features … create adrs” (user 2026-11-04); the research row names a connection hierarchy
- Questions: Add connector types (side, top, back) with their own rules?
- Suggested pick: Not yet; untyped pairs cover undo, save and templates. Typed connectors when a rule needs them (estimate: effort +50%, value +15%).
- Work: High
- Impact: Low-medium
- Necessity: Low
- Issue: Connections are untyped pairs; there are no connector types or a typed assembly graph.
- Fix: Add typed connectors (side, top, back) with their own rules only when a rule needs them.
- Conflicts: none

### G-330: Connections shown only on the plan

- Status: Done (ADR-179)
- Origin: ADR-168, 2026-11-04; agent scoped it out
- Missing: Connections are shown on the plan (a tick on the shared edge) and on the card only; the front view and the 3D view do not highlight them.
- Request: Not a quote: the user chose record, re-check and move together
- Questions: Show connections in the front view and 3D?
- Suggested pick: A matching tick in the front view and a thin line in 3D (estimate: effort +15%, value +10%).

### G-331: No stacked or cross-level connections

- Status: Done (ADR-207)
- Origin: ADR-168, 2026-11-04; agent scoped it out
- Missing: Only side-by-side touching pieces on one floor level connect; a wall unit over a base unit, stacked pieces or pieces across floor levels do not.
- Request: Not a quote: the user chose record, re-check and move together
- Questions: Connect stacked pieces (wall unit over base) too?
- Suggested pick: Add a 'stacked' connection kind once typed connectors exist (G-329) (estimate: effort +30%, value +20%).
- Work: Medium-high
- Impact: Medium
- Necessity: Low
- Issue: Only side-by-side pieces on one level connect; stacked pieces like wall-over-base units do not.
- Fix: Add a stacked connection kind after typed connectors exist.
- Conflicts: none

### G-334: Templates keep copies, not references

- Status: Done (obsolete: user decision 2026-11-05, templates keep copies (ADR-060))
- Origin: ADR-170, 2026-11-04; user decision
- Missing: Templates do not reference catalog items (ADR-060 chose copies; the research asks for references).
- Request: “Keep copies; add connections, variables, bindings, project settings” (user 2026-11-04)
- Questions: None; the user chose copies.
- Suggested pick: Keep copies (chosen). References would need a new ADR replacing ADR-060 (estimate: effort +150%, value +30%).

### G-335: Variables in catalog designs and the stand-alone editor

- Status: Done (ADR-210)
- Origin: ADR-170, 2026-11-04; agent scoped it out
- Missing: Variables and bindings live in projects and project templates only; the stand-alone design editor and catalog designs have none (the rest of G-323).
- Request: Not a quote: the user asked for variables “within the project”
- Questions: Should a catalog design carry bindings as parameters?
- Suggested pick: A later ADR adds variables to catalog designs (estimate: effort +40%, value +15%).
- Work: Medium-high
- Impact: Low-medium
- Necessity: Low
- Issue: Catalog designs and the stand-alone design editor have no variables or bindings.
- Fix: A later ADR adds variables and bindings as parameters of catalog designs.
- Conflicts: none

### G-336: Verified research rows not yet deleted from the data

- Status: Done (ADR-184)
- Origin: ADR-168, 2026-11-04; agent scoped it out
- Missing: The three research rows ADR-168 completes (Transactional undo/redo, Versioned save/reload, Connected items stay independently selectable) are marked Verified in the research data but stay listed; ADR-149 and ADR-152 deleted built features from the data in their own ADRs.
- Request: “Validate all High demand features … create adrs” (user 2026-11-04)
- Questions: Delete the three rows from the research data as ADR-152 did?
- Suggested pick: A small deletion ADR after ADR-168 to ADR-170 ship, covering all four High-demand rows at once (estimate: effort +5%, value +5%).

### G-337: Locks on boards, construction and insides

- Status: Done (ADR-211)
- Origin: ADR-171, 2026-11-04; agent scoped it out
- Missing: Boards, construction and insides of a piece cannot be locked (the rest of G-180).
- Request: “Separate locks per parameter” (user 2026-11-04)
- Questions: Lock boards, construction or insides too, one by one or together?
- Suggested pick: Lock boards and construction as two more toggles once asked (estimate: effort +25%, value +10%).
- Work: Medium
- Impact: Low
- Necessity: Low
- Issue: A piece's boards, construction and insides cannot be locked against changes.
- Fix: Add Lock boards and Lock construction toggles to the Lock menu when asked.
- Conflicts: none
- Note: 2026-11-06: ADR-211 takes over Lock boards and Lock construction (the suggested pick); locking the insides stays in G-453.

### G-338: Snap ranking ignores locks

- Status: Done (ADR-180)
- Origin: ADR-171, 2026-11-04; agent scoped it out
- Missing: Snap ranking does not prefer locked neighbours (research: 'snap ranking considers user locks').
- Request: “Separate locks per parameter” (user 2026-11-04)
- Questions: Rank a locked neighbour's side above an unlocked one when both are in range?
- Suggested pick: A tie-break in ADR-070's ranking: locked first (estimate: effort +5%, value +5%).

### G-339: No per-row price column

- Status: Done (ADR-181)
- Origin: ADR-172, 2026-11-04; agent scoped it out
- Missing: No price per row in the Parts table; only the running total and the Shopping list.
- Request: “Running estimate + scheduled seller price refresh” (user 2026-11-04)
- Questions: Add a price column to Parts?
- Suggested pick: A price column on the Shopping list rows only, where the prices live (estimate: effort +10%, value +10%).

### G-340: No price change report between exports

- Status: Done (ADR-206)
- Origin: ADR-172, 2026-11-04; agent scoped it out
- Missing: A refreshed seller export replaces prices silently: no report of what changed between two exports.
- Request: “You upload a new export; the workflow converts it” (user 2026-11-04)
- Questions: Should the pull request list changed prices and dropped products?
- Suggested pick: The workflow writes a short change summary into the pull request body (estimate: effort +10%, value +15%).
- Work: Low-medium
- Impact: Medium
- Necessity: Low-medium
- Issue: A refreshed seller export replaces prices silently, with no report of changed or dropped products.
- Fix: The price workflow writes a summary of changed prices and dropped products into the pull request body.
- Conflicts: none

### G-341: No budget or style filters on room mixes

- Status: Done (ADR-210)
- Origin: ADR-173, 2026-11-04; agent scoped it out
- Missing: The research children Budget and style filters and Layout optimisation are not built; mixes are ranked by ADR-103's rules only.
- Request: “Fill the room” (user 2026-11-04)
- Questions: Filter mixes by a budget (ADR-172 estimate) or a style (ADR-123)?
- Suggested pick: A budget ceiling and a style pick on Refine, after ADR-172 (estimate: effort +30%, value +20%).
- Work: Medium-high
- Impact: Medium
- Necessity: Low
- Issue: Fill the room mixes cannot be filtered by budget or style; no layout optimisation.
- Fix: Add a budget ceiling and a style pick on the Refine step, using the cost estimate.
- Conflicts: none
- Note: ADR-210 takes over the budget ceiling and style pick; layout optimisation stays open as G-444.

### G-342: No islands or peninsulas in room mixes

- Status: Done (ADR-210)
- Origin: ADR-173, 2026-11-04; agent scoped it out
- Missing: Islands and peninsulas are not suggested; only pieces along walls.
- Request: “Fill the room” (user 2026-11-04)
- Questions: Suggest an island when the room is wide enough?
- Suggested pick: An island option on Refine with the clearance rules of ADR-073 (estimate: effort +40%, value +15%).
- Work: Medium-high
- Impact: Low-medium
- Necessity: Low
- Issue: Fill the room suggests pieces along walls only, never islands or peninsulas.
- Fix: Add an island option on Refine, checked against the clearance rules.
- Conflicts: none
- Note: ADR-210 takes over islands in rectangle rooms; peninsulas and islands in L and U rooms stay open as G-445.

### G-343: No per-step pictures in the assembly print

- Status: Done (ADR-206)
- Origin: ADR-174, 2026-11-04; agent scoped it out
- Missing: The printed assembly sheet shows one front view of the piece and a table of steps (src/ui/Assembly.tsx:218-261); no step has a picture or marked parts.
- Request: “Ordered step list + 3D highlight” (user 2026-11-04)
- Questions: Render one exploded picture per step into the print?
- Suggested pick: Use ADR-121's on-demand render per step once asked (estimate: effort +40%, value +20%).
- Work: Medium-high
- Impact: Medium
- Necessity: Low-medium
- Issue: The printed assembly sheet has one front view and a step table; no per-step pictures.
- Fix: Render one exploded 3D picture per step into the print with the on-demand renderer.
- Conflicts: none
- Note: Re-checked 2026-11-05 on main 0c26d0b (code read, no browser): Missing text updated to the current code.

### G-344: Assembly steps are not editable

- Status: Done (ADR-207)
- Origin: ADR-174, 2026-11-04; agent scoped it out
- Missing: The assembly sequence cannot be edited: steps cannot be reordered, merged or renamed.
- Request: “Ordered step list + 3D highlight” (user 2026-11-04)
- Questions: Let the user reorder or rename steps, saved with the design?
- Suggested pick: An editable order saved on the design, with a reset (estimate: effort +35%, value +20%).
- Work: Medium-high
- Impact: Low-medium
- Necessity: Low
- Issue: Assembly steps cannot be reordered, merged or renamed by the user.
- Fix: Save an editable step order on the design, with a reset to the generated order.
- Conflicts: none
- Note: 2026-11-06: ADR-207 takes over reordering, renaming and a reset. Merging steps moved to G-422.

### G-345: No project-level assembly order

- Status: Done (ADR-178)
- Origin: ADR-174, 2026-11-04; agent scoped it out
- Missing: Steps are per piece; no project-level order (which piece first, run parts, worktops, common panels).
- Request: “Ordered step list + 3D highlight” (user 2026-11-04)
- Questions: Add a project order: pieces along the wall, then run parts?
- Suggested pick: A project section before the pieces: corner first, then along each wall, run parts last (estimate: effort +20%, value +15%).

### G-346: Connections in 3D Move mode not checked in a browser

- Status: Done (ADR-201)
- Origin: ADR-168, 2026-11-04; agent, at ship time
- Missing: Moving a connected piece in 3D Move mode (dropItemAt) is covered by a store test only; it was not checked in a browser (the browser find-it drags on the plan).
- Request: “ship ADR-168” (user 2026-11-04)
- Questions: Add a 3D Move mode drag to tools/connections/find-it.mjs (as tools/move-3d/find-it.mjs does)?
- Suggested pick: Extend the script with one 3D drag of a connected piece and an Alt drag (estimate: effort +10%, value +5%).
- Work: Low
- Impact: Low
- Necessity: Low-medium
- Issue: Moving a connected piece in 3D Move mode was tested only in the store, not in a browser.
- Fix: Add one 3D drag of a connected piece and an Alt drag to the connections browser script.
- Conflicts: none

### G-347: accounts find-it at 390 px is timing-sensitive under the full suite

- Status: Done (ADR-201)
- Origin: N171/N172 full test runs, 2026-11-04; agent
- Missing: tests/find-it/accounts.test.tsx at 390 px fails under the full local suite (the 'In your account' badge is not found in time) in two of three full runs on 2026-11-04, while it passes when run alone and in CI.
- Request: Not a quote: the suite is the source of truth (CLAUDE.md)
- Questions: Raise the badge's waitFor timeout, or split the long find-it into two tests?
- Suggested pick: Wrap the badge lookup in findByText with a longer timeout at 390 px (estimate: effort +2%, value +5%).
- Work: Low
- Impact: Low-medium
- Necessity: Medium
- Issue: The accounts find-it test at 390 px fails intermittently under the full local suite.
- Fix: Use findByText with a longer timeout for the account badge at 390 px, or split the test.
- Conflicts: none

### G-348: Fill the room: openings only through a project's room

- Status: Done (ADR-204)
- Origin: ADR-173, 2026-11-04; agent scoped it out
- Missing: Fill the room from the New dialog takes a ready shape and sizes only; doors and windows come only through a project's own room (Project ⋯ → Fill the room…).
- Request: “Fill the room” (user 2026-11-04)
- Questions: Add doors and windows to the Room step of the dialog?
- Suggested pick: Reuse the room editor's feature list in the dialog (estimate: effort +25%, value +15%).
- Work: Medium
- Impact: Medium
- Necessity: Low-medium
- Issue: Fill the room from the New dialog cannot add doors or windows; only a project's room can.
- Fix: Reuse the room editor's doors and windows list in the dialog's Room step.
- Conflicts: none

### G-349: Fill the room: wall row leaves out whole cabinets at a window

- Status: Done (ADR-177)
- Origin: ADR-173, 2026-11-04; agent scoped it out
- Missing: A wall cabinet that would overlap a window is left out whole; the row does not stop exactly at the window's edge, so a gap wider than the window can stay open.
- Request: “Fill the room” (user 2026-11-04)
- Questions: Split the wall row at the window so cabinets reach its edges?
- Suggested pick: Fill the stretches beside the window as their own wall rows (estimate: effort +15%, value +10%).

### G-350: Fill the room: no wall corner cabinet

- Status: Done (ADR-177)
- Origin: ADR-173, 2026-11-04; agent scoped it out
- Missing: No wall corner cabinet at an inside corner: the wall rows start after the corner cabinet's depth and leave the corner above it empty.
- Request: “Fill the room” (user 2026-11-04)
- Questions: Place a wall corner cabinet (corner-blind-wall) in the corner?
- Suggested pick: Add the catalog's wall corner cabinet over each corner cabinet (estimate: effort +20%, value +15%).

### G-351: move-3d find-it fails on main at 1440 px

- Status: Done (ADR-201)
- Origin: ADR-179 build, 2026-11-05; found by the agent
- Missing: tools/move-3d/find-it.mjs fails at 1440 px on the production build of main 0c26d0b and of this branch: 'Turn 90° ↺ turned the piece' reads an empty rotation, then the 3D canvas wait times out (20 s).
- Request: Not a quote: found while running the browser find-it scripts for ADR-179.
- Questions: Fix the script's turn check and 3D wait, or the app if the turn really fails?
- Suggested pick: Debug it on main first (debug skill); fix the cause (estimate: effort +5%, value +5%).
- Work: Low-medium
- Impact: Medium
- Necessity: High
- Issue: The 3D Move browser test fails on main at 1440 px: turn reads empty, canvas wait times out.
- Fix: Debug on main; fix the app if turning really fails, otherwise fix the script's checks.
- Conflicts: none

### G-352: Fit hardware step cannot be shown in 3D

- Status: Done (ADR-207)
- Origin: ADR-185, 2026-11-05; agent scoped it out
- Missing: The Fit hardware to the sides step has no Show step button: the model does not record which side panel each hinge plate or runner carcass half is fixed to, so nothing can be lit in 3D.
- Request: Re-check assembly steps, both ui and pdf, they seem to not have the expected assembly relevant info and steps.
- Questions: Record which panel each hinge and runner goes on in the model so the step can light them?
- Suggested pick: Tag each hinge and runner pair with its side panel in the generators, then light those panels (estimate: effort +15%, value +5%).
- Work: Medium
- Impact: Low
- Necessity: Low
- Issue: The Fit hardware step has no Show step button; the model does not record each hinge's side panel.
- Fix: Tag each hinge and runner pair with its side panel in the generators and light those panels.
- Conflicts: none

### G-353: Catalog piece names untranslated on prints

- Status: Done (ADR-202)
- Origin: ADR-185, 2026-11-05; agent left it out
- Missing: Piece names on the printed assembly sheet print as named (catalog defaults are English), so a Romanian or Russian print shows English piece names such as 'Base cabinet, 1 door'.
- Request: Translate with the print (user 2026-11-05, for the fastener menu name); user-typed names are not translated (G-304).
- Questions: Translate catalog default piece names on prints when the user has not renamed the piece?
- Suggested pick: Translate a piece name only while it equals its catalog template's default name (estimate: effort +10%, value +5%).
- Work: Low-medium
- Impact: Low-medium
- Necessity: Medium
- Issue: Romanian or Russian assembly prints show English catalog piece names like 'Base cabinet, 1 door'.
- Fix: Translate a piece name on prints while it still equals its catalog template's default name.
- Conflicts: none

### G-354: Shared side with corner units and desks

- Status: Done (ADR-207)
- Origin: ADR-190
- Missing: Corner units and desks keep both sides; only two cabinets can share a side.
- Request: Add the possibility to have a common bottom or top between multiple items.
- Questions: Should a blind corner's straight side or a desk gable be shared with a neighbouring cabinet?
- Suggested pick: Cabinets only (the user's pick); corners and desks in a later ADR.
- Work: Medium-high
- Impact: Low-medium
- Necessity: Low
- Issue: Corner units and desks cannot share a side with a neighbouring cabinet; only two cabinets can.
- Fix: Let a blind corner's straight side or a desk gable be shared, in a later ADR.
- Conflicts: none
- Note: 2026-11-06: ADR-207 takes over a blind corner's straight end and a desk gable. L-shape and diagonal corners and desk pedestal ends moved to G-421.

### G-356: Wizard draft survives closing the dialog

- Status: Done (ADR-211)
- Origin: ADR-191, 2026-11-05; agent scoped it out
- Missing: The wizard's answers live only while the dialog is open. Confirming before a close (ADR-191) stops accidental loss; a draft that survives closing the dialog (Continue where you left off) is not built.
- Request: Not asked; the critique of 2026-11-05 noted the loss and the user chose the grouped ADR as proposed (confirm on close).
- Questions: Should a closed wizard keep its draft for the session, or until the piece is created?
- Suggested pick: Keep the draft in the store for the session; the Type step offers Continue or Start over. (estimate: effort +8 %, value +10 % over confirm-on-close)

### G-357: Doors choice is a dropdown on desktop

- Status: Done (ADR-202)
- Origin: ADR-191, 2026-11-05; agent scoped it out
- Missing: The Doors field on a desktop is a dropdown (five options; the segmented control takes four), so sliding and per-compartment doors are hidden behind a click while the cards promote them. Not changed by ADR-191.
- Request: Not asked; noted during the critique of 2026-11-05 and left out of the fourteen findings.
- Questions: Allow a five-option segmented control on desktop and wrap it on a phone?
- Suggested pick: Segmented up to five options at 1280 px, wrapping at 390 px. (estimate: effort +2 %, value +3 %)

### G-358: Start-new rows share one glyph

- Status: Done (ADR-211)
- Origin: ADR-193, 2026-11-05; design critique, agent scoped it out
- Missing: The Project, Fill a wall and Fill the room rows of Start something new share one 'project' glyph (Low).
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Give each row its own glyph?
- Suggested pick: A wall glyph for Fill a wall and a room-plan glyph for Fill the room. (estimate: effort +1 %, value +1 %)

### G-359: Open in wizard inside a project

- Status: Done (ADR-203)
- Origin: ADR-194, 2026-11-05; design critique, agent scoped it out
- Missing: Open in wizard is hidden for a wizard-made piece inside a project (Settings hides it there).
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Offer Open in wizard for a project piece, updating it in place in the project?
- Suggested pick: Offer it; Update piece replaces the project item's design. (estimate: effort +6 %, value +5 %)

### G-360: Wizard Review rows repeat long labels

- Status: Done (ADR-202)
- Origin: ADR-194, 2026-11-05; design critique, agent scoped it out
- Missing: Review rows repeat long field labels, e.g. 'Width of each compartment (0 = share the rest): 0 mm'.
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Give fields a short Review label?
- Suggested pick: An optional short label per field for Review. (estimate: effort +2 %, value +2 %)

### G-361: Arrow keys on Segmented controls

- Status: Done (ADR-202)
- Origin: ADR-194, 2026-11-05; design critique, agent scoped it out
- Missing: Segmented controls have no arrow-key movement anywhere in the app.
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Add roving tabindex and arrow keys to Segmented app-wide?
- Suggested pick: Yes, in the shared control, one change for every screen. (estimate: effort +3 %, value +3 %)

### G-362: Catalog item counts differ from room chips

- Status: Done (ADR-202)
- Origin: ADR-195, 2026-11-05; design critique, agent scoped it out
- Missing: The Catalog header says 118 items while the room chips sum to 183, because a family is listed under every room (ADR-032).
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Say 'in N families, listed under several rooms' or count per room only?
- Suggested pick: Keep the header; add a hint that a family can sit in several rooms. (estimate: effort +1 %, value +2 %)

### G-363: Imported templates shadow silently

- Status: Done (ADR-203)
- Origin: ADR-195, 2026-11-05; design critique, agent scoped it out
- Missing: Two imported templates that shadow the same shipped family: the last one wins silently (local.ts:85).
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Warn on import, or keep both as separate families?
- Suggested pick: Warn on import and ask which one to keep. (estimate: effort +3 %, value +3 %)

### G-365: Handle side on a turned corner wing

- Status: Done (ADR-203)
- Origin: ADR-196, 2026-11-05; design critique, agent scoped it out
- Missing: Which edge 'left' means for handle holes on a turned wing-B front of an L-corner was not verified.
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Check handle hole sides on turned wing-B fronts?
- Suggested pick: A test that builds an L-corner with a left handle and checks the hole side. (estimate: effort +2 %, value +2 %)

### G-366: Hardware notes built from English fragments

- Status: Done (ADR-202)
- Origin: ADR-196, 2026-11-05; design critique, agent scoped it out
- Missing: Hardware notes are assembled from English fragments (hingeBand), so the Russian schedule mixes languages.
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Move the notes to whole t() sentences?
- Suggested pick: Whole sentences per note in t(), with Russian entries. (estimate: effort +4 %, value +3 %)

### G-367: Design critiques of shell, piece editor and project

- Status: Done (ADR-200)
- Origin: Design critique batch, 2026-11-05; implementation approved 2026-11-06
- Missing: Shipping the approved fixes through ADR-200; implementation and local verification are complete. This branch implements and verifies ADR-198, ADR-199, ADR-200, with production checks at 390 × 844 and 1280 × 900 and inspected light/dark screenshots.
- Request: "run a /batch for 1 through 7 with a critique of design … 1 adr … per flow (7 total adrs)"; "Implement ADR-s 198, 199, 200"; "Yes" to all twelve fixes.
- Questions: None: all twelve fixes were accepted. Merge and deployment have not been requested.
- Suggested pick: The accepted fixes are built; review the implementation pull requests, then ship on the user's instruction. No approved fix was omitted.

### G-368: CI runs only the tests related to a core-only change

- Status: Done (ADR-201)
- Origin: ADR-197 CI analysis 2026-11-05
- Missing: Suggestion C, tests by domain of change: a pull request that touches only src/core still runs the whole suite. vitest --changed origin/main (or a related-files filter) could run only the related tests there. The find-it files all import App, so any src/ui change still runs all 37 of them.
- Request: Suggest improvements. Triggering less often the ci optimisations? Tests running by domain of change? Do all parts of the app need tests? Gaps/features/docs/unnecessary overcovering tests? (the user chose "all of these 4 + Suggestions A(all) and B(all)"; this suggestion was left out)
- Questions: Run only the related tests on pull requests and the full suite on main only?
- Suggested pick: Full suite on main; related tests only on pull requests that touch src/core alone. (estimate: work +15 %, saves about 60 % of the test CPU on those pull requests)
- Work: Medium
- Impact: Medium
- Necessity: Low-medium
- Issue: A core-only pull request runs all 143 test files.
- Fix: In the CI test job, use vitest --changed against the base on core-only pull requests; keep the full suite on main.
- Conflicts: none

### G-370: Review find-it tests that re-test logic through the UI

- Status: Done (ADR-201)
- Origin: ADR-197 CI analysis 2026-11-05
- Missing: Suggestion E, over-coverage review: find-it/research-batch-4 (10.4 s, 6 tests) asserts research rows through the UI; find-it/connections (13.3 s) and find-it/variables (9.2 s) look like logic re-tested through the UI; tests/rapier-trial.test.ts is permanently skipped.
- Request: Suggest improvements. Triggering less often the ci optimisations? Tests running by domain of change? Do all parts of the app need tests? Gaps/features/docs/unnecessary overcovering tests? (the user chose "all of these 4 + Suggestions A(all) and B(all)"; this suggestion was left out)
- Questions: Move the logic assertions to core tests, keep one click path per find-it file, and delete rapier-trial?
- Suggested pick: Yes. (estimate: work +25 %, about 15 % less find-it CPU)
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: Some find-it files assert model logic through the UI, which is slow; one test file is always skipped.
- Fix: Move logic assertions to tests/ core tests, keep one click path per find-it file, delete tests/rapier-trial.test.ts.
- Conflicts: none

### G-377: Remove the Rapier devDependency once its trial test is gone

- Status: Done (ADR-212)
- Origin: ADR-201, 2026-11-06; agent scoped it out
- Missing: ADR-201 deletes tests/rapier-trial.test.ts (G-370), the only file that imports @dimforge/rapier3d-compat; the devDependency and its lockfile entry would stay, unused. ADR-125 added it as a devDependency for the trial only.
- Request: Not a quote: follows from G-370's pick, "Move the logic assertions to core tests, keep one click path per find-it file, and delete rapier-trial" (accepted 2026-11-06).
- Questions: Remove the devDependency with the trial file, or keep it for a later re-run of the trial?
- Suggested pick: Remove it in the same change as the trial file (estimate: effort +2%, value +2%; smaller install).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Deleting the Rapier trial test leaves an unused devDependency in package.json and the lockfile.
- Fix: pnpm remove @dimforge/rapier3d-compat in the change that deletes tests/rapier-trial.test.ts.

### G-380: Project fasteners panel and drilling positions

- Status: Done (ADR-209)
- Origin: ADR-202, 2026-11-06; agent scoped it out (remainder of G-042)
- Missing: Fasteners in the project's own Settings dialog (Settings.tsx:62-71) and drilling patterns drawn only from the values the user enters. ADR-202 takes over only the fastener CSV and print text of G-042.
- Request: “Hardware and fastener completeness”.
- Questions: Add the project-level panel? Draw drilling positions only from your values?
- Suggested pick: Add the project-level panel. Draw drilling positions only from the values you enter, labelled as guidance (ADR-010). (estimate: effort +25%, value +20%)
- Work: Medium
- Impact: Medium
- Necessity: Medium
- Issue: No fasteners panel in project Settings; no drilling patterns drawn.
- Fix: Add the project fasteners panel; draw drilling only from user values, labelled as guidance.
- Conflicts: none
- Note: 2026-11-06: ADR-209 draws drilling positions for carcass joints; the other joint types moved to G-439.

### G-381: Piece names in the parts CSV and shopping list title

- Status: Done (ADR-212)
- Origin: ADR-202, 2026-11-06; agent scoped it out
- Missing: ADR-202 prints untouched catalog piece names in the print language on the assembly sheet and the cut sheet's pieces table only; the parts CSV ("Piece: part" names) and the shopping list title keep the name as stored.
- Request: Translate with the print (user 2026-11-05, for the fastener menu name); user-typed names are not translated (G-304).
- Questions: Use the same print name in the parts CSV and the shopping list title?
- Suggested pick: Yes, the same printPieceName() wherever a piece name is printed or exported. (estimate: effort +3%, value +3%)
- Work: Low
- Impact: Low
- Necessity: Low-medium
- Issue: The parts CSV and shopping list title show English catalog piece names on a Romanian or Russian export.
- Fix: Route those names through printPieceName() too.

### G-388: Go up one selection level on a phone

- Status: Done (ADR-211)
- Origin: ADR-203, 2026-11-06, out of scope (Claude)
- Missing: ADR-203 makes Esc go up one selection level on desktop; a phone has no gesture for it besides the breadcrumb.
- Request: The flow of selecting the furniture, then the middle (given there are 2 dividers), then having a horizontal divider, then selecting the bottom one to adjust shelves is a painful horrible user experience. Adjust the selecting to go from bigger to smaller. 1 click = entire furniture, second click selects the smaller frame, third again the smaller within, iteratively.
- Questions: Add a phone gesture or button to go up one level, besides the breadcrumb?
- Suggested pick: An "Up one level" button next to the breadcrumb on phones (estimate: effort +3 %, value +3 %).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: On a phone, going one selection level up needs the breadcrumb.
- Fix: Add an "Up one level" button on phones that selects the parent level.
- Conflicts: none

### G-389: Versions left by projects deleted earlier

- Status: Done (ADR-211)
- Origin: ADR-203, 2026-11-06, out of scope (Claude)
- Missing: ADR-203 asks about versions only when a project is deleted from now on; versions of projects deleted before it stay on the device, unlisted.
- Request: Accept default, /batch all ready (G-156: keep every version until the user deletes it)
- Questions: List versions whose project is gone, to restore or delete them?
- Suggested pick: A "Versions of deleted projects" list in History with Restore as a new project and Delete (estimate: effort +8 %, value +5 %).
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: Versions of projects deleted before ADR-203 take space and cannot be reached.
- Fix: List versions with no project in History, each with Restore and Delete.
- Note: 2026-11-06: ADR-211 puts the list in History as picked; reaching it with no project open is G-454.

### G-396: No repair for the family warning

- Status: Done (ADR-210)
- Origin: ADR-204, 2026-11-06; agent scoped it out (G-104's pick covers depth and height only)
- Missing: The family compatibility warning (ADR-100) still offers no previewed repair (ADR-071); only the depth and height warnings get "match the neighbour" repairs.
- Request: Not a quote: G-104 asked "Offer repairs such as 'Make Base cabinet 560 deep like its neighbour' or 'Move the bed away'?"
- Questions: Offer a repair that moves one of the two pieces away until they no longer touch side by side?
- Suggested pick: Move the later-placed piece sideways just clear of the other, reusing the overlap repair's moves (estimate: effort +10%, value +5%).
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: The family warning names pieces from rooms that do not belong together but offers no fix.
- Fix: Offer a previewed move that takes one piece clear of the other.

### G-404: Hand side for the lounger and daybed, multi-select gesture

- Status: Done (ADR-207)
- Origin: ADR-205, 2026-11-06; remainder of G-032 (the coordinator split it: ADR-205 takes only the 1 mm drift)
- Missing: The lounger backrest and the daybed side panel are always built at the left end, so Mirror refuses them (arrange.ts). The multi-select gesture part of G-032 was not reviewed again; multi-select and groups are already built (ADR-097, ADR-159).
- Request: “Duplicate, mirror and predictable rotate operations”.
- Questions: Store a hand (left or right) on the lounger and daybed? Does any multi-select gesture still need to be added?
- Suggested pick: Store a hand on those two pieces so that they mirror, and check whether Shift-click and long-press already cover the gesture. (estimate: effort +20%, value +15%)
- Work: Low-medium
- Impact: Low
- Necessity: Low-medium
- Issue: The lounger backrest and the daybed side panel cannot be mirrored.
- Fix: Add a stored hand side that the generators read, and that mirrorDesign swaps.
- Conflicts: none
- Note: 2026-11-06: ADR-207 takes over the stored end for the lounger and daybed and the gesture check (Shift/Ctrl-click and Select cover every view). A long-press gesture moved to G-423.

### G-405: Profiled mouldings, run requests in templates, ceiling-filler find-it

- Status: Done (ADR-209)
- Origin: ADR-205, 2026-11-06; remainder of G-035 (the coordinator split it: ADR-205 takes only the sink and hob cut-outs)
- Missing: Mouldings are plain strips with no profile. Project templates drop the requested trims and worktops (runRequests). The ceiling filler has not been checked in a browser.
- Request: “Shared worktops”, “fillers, plinths, end panels and trim”, for kitchens.
- Questions: Should templates carry run requests? Which moulding profiles are needed (shapes from the user, never invented)?
- Suggested pick: Make templates carry run requests, and add a ceiling filler to a browser find-it. Mouldings get profiles that the user draws or types. (estimate: effort +25%, value +20%)
- Work: Medium
- Impact: Low-medium
- Necessity: Low-medium
- Issue: Templates lose requested trims and worktops, mouldings have no profile, and the ceiling filler has not been checked in a browser.
- Fix: Keep runRequests in project templates, add user profiles to mouldings, and add a ceiling-filler browser find-it.
- Conflicts: none

### G-407: Typed position for sink and hob cut-outs

- Status: Done (ADR-209)
- Origin: ADR-205, 2026-11-06; agent scoped it out
- Missing: Sink and hob cut-outs store only their width and depth. ADR-205 draws them centred on their base and on the worktop depth, and no offset can be typed.
- Request: Sink and hob cut-outs on the worktop from sizes you enter (G-035 suggested pick, not a quote)
- Questions: Add optional offsets from the base's left edge and from the worktop's front edge?
- Suggested pick: Two optional offsets in mm; absent means centred, as today. (estimate: effort +10%, value +10%)
- Work: Low
- Impact: Low-medium
- Necessity: Low-medium
- Issue: A cut-out cannot be placed off-centre.
- Fix: Add optional x and z offsets to RunSink and the hobs, and use them in the outline and the cut-list note.
- Conflicts: none

### G-408: Sink and hob cut-outs drawn in 3D and the front view

- Status: Done (ADR-209)
- Origin: ADR-205, 2026-11-06; the rest of G-212 (its suggested pick was the plan only)
- Missing: The sink and hob cut-outs are outlined on the plan only, not in 3D or in the room front view.
- Request: Accept default, /batch all ready (ADR-125: run sinks and handles)
- Questions: Draw the cut-out as a hole in the 3D worktop?
- Suggested pick: Extrude the worktop with the cut-out as a hole in 3D (the ADR-205 profile holes). (estimate: effort +10%, value +5%)
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: Cut-outs show only on the plan.
- Fix: Give the worktop a profile hole for each cut-out in the project build.
- Conflicts: none
- Note: 2026-11-06: ADR-209 takes over the 3D holes (the suggested pick); the room front view moved to G-438.

### G-412: Worktop edge profiles and bundled appliance models

- Status: Done (ADR-209)
- Origin: ADR-206, 2026-11-06; split from G-020 by the coordinator (ADR-206 takes only the client sheet)
- Missing: Worktops have no edge profile choice; no appliance models are bundled (appliances come only as .glb imports, ADR-076).
- Request: “To sell designed kitchens”.
- Questions: Which three edge profiles? Which licence for bundled appliance models (CC0)?
- Suggested pick: Three profile choices drawn on the worktop; a few CC0 appliance models once you pick that licence. (estimate: effort +30%, value +20%)
- Work: Medium
- Impact: Medium
- Necessity: Low-medium
- Issue: Worktops cannot show an edge profile and no appliance models ship with the app.
- Fix: Add three drawn worktop edge profiles; bundle a few CC0 appliance models once the licence is chosen.
- Conflicts: none
- Note: 2026-11-06: ADR-209 takes over the worktop edge profiles; the bundled CC0 appliance models moved to G-437.

### G-413: Board pictures in the plan, catalog pictures and cut sheets

- Status: Done (ADR-208)
- Origin: ADR-206, 2026-11-06; split from G-001 by the coordinator
- Missing: The plan, catalog snapshots (src/core/snapshot.ts) and the cut sheets draw boards in plain colour.
- Request: “Render the furniture according to the selected material's color and structure”.
- Questions: Fill the plan and catalog pictures with the board picture, against ADR-048's average colour for catalog pictures and cut sheets?
- Suggested pick: Fill the plan with the picture pattern; keep the average colour on catalog pictures and cut sheets as ADR-048 decided. (estimate: effort +10%, value +5%)
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: The plan, catalog pictures and cut sheets show boards as plain colour, not their picture.
- Fix: Fill the plan with the board picture pattern; a new ADR if catalog pictures or cut sheets should change.
- Conflicts: ADR-048 (catalog pictures and cut sheets use the average colour)
- Note: 2026-11-06: ADR-208 takes over board pictures on the 2D plan only. Catalog pictures and cut sheets moved to G-431 (ADR-048 keeps the average colour there).

### G-414: Formula conditions and stepped rounding

- Status: Done (ADR-209)
- Origin: ADR-206, 2026-11-06; agent scoped it out (G-324's pick names min, max, floor, ceil and round only)
- Missing: Formulas have no conditions (if) and no rounding to a step such as a sheet thickness.
- Request: Formulas too (user answer 2026-10-30).
- Questions: Add if(condition, a, b) and round(x, step)?
- Suggested pick: Add them when a real project needs one. (estimate: effort +10%, value +5%)
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: Formulas cannot branch or round to a step.
- Fix: Add if(condition, a, b) and round(x, step) to the formula parser.
- Conflicts: none

### G-461: Default L and U rooms give no Fill the room mix

- Status: Done (ADR-216)
- Origin: ADR-193, 2026-11-06; agent found it while building (not caused by ADR-193)
- Missing: The default L room (3600 x 3000, cut 1500 x 1500) and the U room (offset 600) give no mix in Fill the room: Wall 2 has no stretch of 400 mm, then 'Every mix tried had a problem in the room (60 tried)'. Same with tallPosition left/right, so it predates ADR-193; the find-it uses Use this mix on the rectangle instead.
- Request: Not a quote: ADR-193 Done-when only asks 'Rectangle -> L shows 6 ticked walls'; the user's request was 'a critique of design ... high and medium issues and fixes per flow'.
- Questions: Should the default L and U rooms give mixes? Which problem blocks them (corner reservations on the 1500 mm walls, or a clash the model reports as an error)?
- Suggested pick: Find which error rejects every L/U mix (run suggestRoomMixes on the default L and list the error codes), then fix that cause in a new ADR so the default L and U rooms give cards. Closest to the user's wish for working flows. (estimate: effort +15% of ADR-193, value +10%)
- Work: Medium
- Impact: Medium

### G-469: Enter chooses the destructive button in two ADR-203 dialogs

- Status: Done (user 2026-11-06: "keep Enter on Keep in both dialogs"; commit 9a094917)
- Origin: ADR-203 tests, 2026-11-06; agent found it
- Missing: The shared confirm dialog focuses the non-default button, so Enter chooses 'Delete versions' (project delete) or 'Use the imported one' (template import) although ADR-203 makes 'Keep them' / 'Keep mine' the default (Esc and Keep delete nothing).
- Request: Not asked; ADR-203 Decision: Keep is the default and nothing is deleted without the user's explicit choice (ADR-012).
- Questions: Should Enter on these two dialogs choose the Keep button?
- Suggested pick: Focus the Keep button first in both dialogs, so Enter keeps. (estimate: effort +2 %, value +4 %)

### G-470: Built-in template descriptions are shown nowhere in the app

- Status: Done (ADR-216)
- Origin: ADR-196 item 7 (blind corner template text), found while building 2026-11-06
- Missing: The built-in templates' descriptions in src/core/design.ts (templates) are not rendered by any screen: TemplateButton in src/ui/Templates.tsx is unused and the New single piece dialog lists catalog items instead. ADR-196 corrected the blind corner text to read cornerDefaults('blind') (610 mm), proven by tests/constructions.test.ts, but there is no visible place to find it in a find-it test.
- Request: "Split the entire app into domains or flows … critique of design … 1 adr with high and medium issues and fixes per flow" (ADR-196 item 7: the description reads the defaults)
- Questions: Should the built-in template descriptions be shown somewhere (the Templates source of the catalog, or Fill the room), or be removed as unused data?
- Suggested pick: Ask the user; closest to the request: keep the corrected text and show nothing new until the user asks (no UI change was asked by ADR-196).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: The built-in templates' descriptions are kept in the code but no screen shows them, so a corrected text has no place to be seen.
- Fix: Ask the user whether to show the built-in templates' descriptions somewhere or remove them as unused data.
- Conflicts: none
