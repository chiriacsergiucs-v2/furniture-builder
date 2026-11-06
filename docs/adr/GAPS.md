# Gaps — everything asked for or implied that is not built (ADR-082)

Every item that is not built goes here in the same change that leaves it out. That covers a _Skipped this
iteration_ item, an _Out of scope_ line, an open question answered with a default, and a requirement that was cut.
`pnpm docs:check` checks this file.

**Statuses:**

- `Open`: recorded, not decided.
- `Acknowledged (YYYY-MM-DD)`: the user accepted the gap as it is. Only the user sets this.
- `ADR-NNN`: the gap moved into that ADR. The `ship-adr` skill marks it Done when that ADR ships.
- `Done (<commit or ADR-NNN>)`: built and on `main` (the ship commit reaches `main` with the ADR), or
  `Done (obsolete: <reason>)` when it no longer applies. Done gaps move to [GAPS-archive.md](GAPS-archive.md)
  (user 2026-11-04), so this file lists only what is left; their ids stay valid there.

**Helpers:**

- add a gap: `pnpm gaps add --origin "ADR-NNN" --missing "…" --request "…" --questions "…" --pick "…" "Title"`;
- list open gaps: `pnpm gaps list`;
- mark the gaps of shipped ADRs Done and archive them: `pnpm gaps sync`;
- move Done gaps to the archive: `pnpm gaps archive`.

**Fields of each gap:**

- `Origin`: the ADR or area, when, and who chose the gap.
- `Request`: the user's words. Text that is not a quote says so.
- `Suggested pick`: the option closest to the request, with estimates (`CLAUDE.md`, rule of 2026-10-25).

## Gaps

### G-001: Board pictures only in 3D

- Status: ADR-206
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

### G-003: Materials fields overlap at 375 px

- Status: ADR-202
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

### G-004: Oxlint as in reserv

- Status: Open
- Origin: ADR-053, 2026-10-24 15:25 UTC; agent scoped it out
- Missing: Linting stayed on ESLint; reserv uses oxlint.
- Request: “All three”: ADR format, skills and CI the same as reserv.
- Questions: Switch to oxlint now, or keep ESLint on purpose (then acknowledge)?
- Suggested pick: Switch to oxlint with reserv's config, and keep ESLint only for any rule oxlint lacks. (estimate: effort +5%, value +5%)
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: Linting uses ESLint while reserv uses oxlint.
- Fix: Switch to oxlint with reserv's config, keeping ESLint only for rules oxlint lacks.
- Conflicts: ADR-053: decision says ESLint stays; the user named only pnpm, Prettier, Node 24.

### G-005: Fusion export never run in Fusion

- Status: Open
- Origin: ADR-021, 2026-10-24 15:37 UTC; blocked by the environment
- Missing: The Fusion 360 export has never been run inside Fusion (N03).
- Request: Export to Fusion 360 (context, not a quote)
- Questions: Can you run the script once in Fusion 360 on two sample designs?
- Suggested pick: You run the script once in Fusion on two sample designs. Claude adds a checklist of what to compare (part count, sizes, names). (estimate: effort +2%, value +15%)
- Work: Low
- Impact: Medium
- Necessity: Medium
- Issue: The Fusion 360 export script has never been run inside Fusion, so its output is unverified.
- Fix: User runs the script on two sample designs; Claude supplies a comparison checklist (parts, sizes, names).
- Conflicts: none

### G-006: Server-only research features

- Status: Open
- Origin: Research, 2026-10-24 15:37 UTC; user decision
- Missing: Personal codes are built (design codes ADR-124, account storage ADR-137, share links ADR-138) and ADR-126 now allows opt-in online features; online model libraries and a live cross-brand catalogue are still not built.
- Request: Research features (context, not a quote)
- Questions: Keep ruled out by ADR-002 (acknowledge), or open a new ADR to change ADR-002?
- Suggested pick: Keep these out unless you decide to change ADR-002. It is listed here only so you know they are not available.
- Work: High
- Impact: Low-medium
- Necessity: Low
- Issue: Online model libraries and a live cross-brand catalogue are not built.
- Fix: Keep them out unless the user decides otherwise; acknowledge the gap.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-007: Connector engine and stored connections

- Status: ADR-207
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

- Status: ADR-208
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

### G-009: Supplier feeds and ordering

- Status: Open
- Origin: ADR-063, 2026-10-24 15:51 UTC; user decision
- Missing: Column maps for other suppliers' price files, order files, live feeds, stock and online ordering are not built (ADR-063 Deferred); the Regency export refresh exists (ADR-172).
- Request: “Put to pending any that require non-free services”.
- Questions: Build the offline step (supplier price-file column maps and order files)? Which suppliers first?
- Suggested pick: An offline middle step that needs no service: a column map for each supplier's own price-list file (Egger, Kronospan, Kastamonu, Fundermax) into the ADR-062 price list, and an order file per supplier from the shopping list. This covers most of the value with no backend. (estimate: effort +25%, value +40% of what live feeds give)
- Work: Medium
- Impact: Medium
- Necessity: Low-medium
- Issue: No import maps for other suppliers' price files and no per-supplier order files.
- Fix: Offline column maps for Egger, Kronospan, Kastamonu, Fundermax price files and per-supplier order files.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: Re-checked 2026-11-05 on main c4a15bd (code read, no browser): Missing text updated to the current code.

### G-010: Worktop joints and corner runs

- Status: ADR-205
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

### G-011: Handle projection and exact swing arcs in the check

- Status: Open
- Origin: ADR-057, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: No handle projection; door swings are not exact arcs in the check (drawn arcs were fixed, the check still uses a box).
- Request: Opening clearance for doors, drawers, flaps (context, not a quote)
- Questions: Use the handle depth from the handle schedule and the real arc on the hinge side?
- Suggested pick: Check the real quarter-circle on the hinge side plus the handle depth from the handle schedule (ADR-024). This also unblocks the ADR-071 “reverse the hinge” repair. (estimate: effort +25%, value +20%)
- Work: Medium
- Impact: Medium
- Necessity: Medium
- Issue: Door clearance check uses a box, not the real swing arc, and ignores handle projection.
- Fix: Check the hinge-side quarter-circle plus a user-entered handle depth from the handle schedule.
- Conflicts: ADR-057: decided clearances are axis-aligned boxes; an arc check changes that decision.

### G-012: Angled walls and plan tracing

- Status: ADR-208
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

### G-014: Undo across reloads and in the library

- Status: Open
- Origin: ADR-051, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: Restorable project versions exist (ADR-123), but the undo stack is still lost on reload and deleting saved projects/designs on the Projects page has no undo or Recently deleted list.
- Request: Undo and redo for project changes (context, not a quote)
- Questions: Keep undo per project on the device? A 30-day Recently deleted list for the library?
- Suggested pick: Keep the undo stack per project in IndexedDB (new Dexie version). Make library deletes go to a 30-day “Recently deleted” list instead of being final. (estimate: effort +20%, value +15%)
- Work: Medium
- Impact: Medium
- Necessity: Medium
- Issue: Undo history is lost on reload, and deleting saved projects or designs is final.
- Fix: Store undo per project in a new Dexie version; send library deletes to a 30-day Recently deleted list.
- Conflicts: ADR-051: decided project history is not saved and starts empty on open.
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still valid; the library is now the Projects page (ADR-078). Dexie v8 has no undo table and there is no Recently deleted list.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-015: Egger catalogue import

- Status: Open
- Origin: Catalog, 2026-10-24 17:15 UTC; blocked by the environment
- Missing: The Egger catalogue import is not done: the pack has no thickness or colour, and egger.com is blocked.
- Request: “Use this to fill in Egger catalogue”.
- Questions: Which thicknesses per board type (for example PAL 18 / 25 mm) should the 276 rows get?
- Suggested pick: Import the 276 rows now with code, name and type. Take thickness from one list you confirm (for example, PAL 18 / 25 mm) and leave colour to the pictures you add. Nothing invented (ADR-010). (estimate: effort +10%, value +30%)
- Work: Low-medium
- Impact: Low-medium
- Necessity: Low
- Issue: The 276-row Egger pack was never imported; it lacks thickness and colour.
- Fix: Import rows with code, name, type and user-confirmed thicknesses; or acknowledge as covered by Regency catalog.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Egger boards with thickness and pictures are now pickable through the bundled Regency seller catalog (ADR-161, ADR-162; src/core/sellers/regency.json); the 276-row pack itself is not imported. May be obsolete; the user decides.

### G-016: Export blocking never tried in a browser

- Status: ADR-201
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

### G-020: Appliances, sinks, edge profiles, client sheet

- Status: ADR-206
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

- Status: ADR-206
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

- Status: ADR-208
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

### G-025: Cross-family composition and room presets

- Status: ADR-210
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

### G-027: Bottom sheet drag, mode bar, old find-it scripts

- Status: ADR-211
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

### G-028: Mobila sample files still in the repo

- Status: Open
- Origin: D02, 2026-10-24 23:15 UTC; agent default, accepted by the user
- Missing: “Built in the app” is gone from the screens, but the Mobila sample files stay in docs/samples/ and the tests. The question was asked and never answered.
- Request: “Remove completely the Built in the app feature”.
- Questions: Delete the files too, keeping only the test fixtures ADR-041 needs?
- Suggested pick: Read literally, “completely” means the files too. Move the samples ADR-041's tests need into tests/fixtures/ and delete the rest. Your call. (estimate: effort +3%, value matches your words)
- Work: Low
- Impact: Low
- Necessity: Low-medium
- Issue: Mobila sample files remain in the repo though the user asked to remove the feature completely.
- Fix: Move samples the tests need into tests/fixtures and delete the rest, if the user confirms.
- Conflicts: none

### G-030: Back cut-outs over pipes and outlets

- Status: ADR-205
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

### G-031: ADR-072 defaults unconfirmed

- Status: Open
- Origin: ADR-072, 2026-10-24 23:58 UTC; agent default, accepted by the user
- Missing: Unconfirmed defaults: a tall unit is 1,600 mm or more; a zone reaches 50 mm from the wall.
- Request: Pipes and outlets checked against the pieces (context, not a quote)
- Questions: Is a tall unit 1,600 mm or more? Does a zone reach 50 mm from the wall?
- Suggested pick: Confirm them, or give your values. (estimate: effort 0%, value needs you)
- Work: Low
- Impact: Low-medium
- Necessity: Medium
- Issue: Tall-unit 1600 mm and 50 mm near-wall thresholds in the pipe checks were never confirmed by the user.
- Fix: User confirms or gives the two values; update the constants if changed.
- Conflicts: none
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): the Origin says accepted by the user, but the two questions were never answered (no answer in product-context.md). Code still uses TALL_UNIT_HEIGHT=1600 and NEAR_WALL=50 (src/core/room.ts).

### G-032: Multi-select, fixed-hand mirroring, 1 mm drift

- Status: ADR-205
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

- Status: ADR-205
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

- Status: ADR-209
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

- Status: ADR-205
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

- Status: ADR-205
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

### G-037: Chair depth and service sizes

- Status: Open
- Origin: ADR-073, 2026-10-25 00:14 UTC; agent default, accepted by the user
- Missing: No chair depth or service-zone sizes: you enter them each time.
- Request: “Collision and clearance”.
- Questions: What chair depth and service-zone sizes do you use?
- Suggested pick: Give your usual values once and they become per-project defaults. (estimate: effort 0%, value needs you)
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Chair depth and service-zone sizes must be entered each time; no default.
- Fix: User gives usual values once; store them as per-project defaults.
- Conflicts: none

### G-038: Band-list import and colour matching

- Status: ADR-212
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

### G-039: ADR-077 open decisions

- Status: Open
- Origin: ADR-077, 2026-10-25 00:15 UTC; agent default, accepted by the user
- Missing: Open: carry over the old per-board banding prices? Preset thickness list or typed only? The allowance is stored per band, not per board.
- Request: “Check the European standards for ABS, apply them accordingly”.
- Questions: Carry over old banding prices? Keep the preset thickness list? Allowance per band?
- Suggested pick: Recommended (closest to the request): keep the preset list (the common supplier sizes you asked to apply), carry over prices, allowance per band (that is how edgebanders work). Confirm. (estimate: effort +5%, value +10%)
- Work: Low
- Impact: Low
- Necessity: Low-medium
- Issue: Three built defaults from the edge-band ADR were never confirmed: old prices, preset thicknesses, per-band allowance.
- Fix: User confirms: keep preset thickness list, carry over banding prices, keep the allowance per band.
- Conflicts: none

### G-040: 3D model placement and templates

- Status: ADR-208
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

### G-041: ADR-076 models list

- Status: ADR-212
- Origin: ADR-076, 2026-10-25 00:16 UTC; agent default, accepted by the user
- Missing: Models are stored in a separate Project.models list, not on project items as the ADR says.
- Request: “Import 3D models and model libraries”.
- Questions: Keep the separate Project.models list and write it into the ADR?
- Suggested pick: Keep it (it lets one model be used many times), but write it into the ADR before shipping. Confirm. (estimate: effort 0%, value needs you)
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Models live in a separate Project.models list, unlike the shipped ADR text; the choice is unrecorded.
- Fix: Record the separate models list as the decision, here or in a small new ADR.
- Conflicts: none
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): ADR-076 is already Implemented, so the suggested pick (write it into the ADR before shipping) can no longer be done; record the answer here or in a new small ADR. Code uses Project.models (src/core/project.ts:159).

### G-042: Project fasteners panel and Romanian labels

- Status: ADR-202
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

### G-043: Duplicate backlog id D02

- Status: Open
- Origin: Backlog, 2026-10-25 06:52 UTC; agent scoped it out
- Missing: Two backlog rows share the id D02: ADR-029, and “Built in the app”. Still not fixed on main.
- Request: Ids are never renumbered (CLAUDE.md) (context, not a quote)
- Questions: Renumber the later row to D03? (Ids are never renumbered, so this needs your decision.)
- Suggested pick: Give the later row (“Built in the app”) D03 and fix every reference. (estimate: effort +1%, value bookkeeping)
- Work: Low
- Impact: Low
- Necessity: Low-medium
- Issue: Two backlog rows share id D02, so references to D02 are ambiguous.
- Fix: With the user's approval, give the later row D03 and update every reference.
- Conflicts: none

### G-044: Catalog feed and brand filter

- Status: ADR-210
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

### G-045: ADR-069 to 079 shipped with open gaps

- Status: Open
- Origin: ADR-069..079, 2026-10-25 10:25 UTC; agent scoped it out
- Missing: The open questions in G-027 and G-030 to G-042 are still unanswered, and nothing was checked on the live site (G-047); find-it was re-run after the merge (N88).
- Request: “Merge all mergeable, push, list what is left”.
- Questions: Re-run every find-it on main? Answer the open questions above?
- Suggested pick: Re-run every find-it script on the production build of main. Answer the open questions above. Then open one follow-up ADR per group of gaps, so the gaps are tracked and not lost behind Done. (estimate: effort +10%, value +15%)
- Work: Medium
- Impact: Low-medium
- Necessity: Low-medium
- Issue: ADR-069 to 079 shipped with open questions unanswered and nothing checked on the live site.
- Fix: Answer the listed open questions, open one follow-up ADR per gap group, do the live check.
- Conflicts: none
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved per N88: every find-it script passed on a local production build after merging main. Remaining: the open questions in G-027 and G-030 to G-042, follow-up ADRs, the live check (G-047).
- Note: Re-checked 2026-11-05 on main c4a15bd (code read, no browser): Missing text updated to the current code.

### G-047: Nothing live-verified

- Status: Open
- Origin: Verification, all sessions; blocked by the environment
- Missing: Nothing has been live-verified: the deployed site, a real phone and a screen reader were never checked. github.io is refused by this environment.
- Request: “R1: evidence from the running app the user will use”.
- Questions: Allow chiriacsergiucs-v2.github.io in the environment network policy? Run the phone and screen-reader check together?
- Suggested pick: Allow chiriacsergiucs-v2.github.io in this environment's network policy, so the find-it scripts can run against the live URL. Phone and screen-reader checks need you, about 15 minutes with a short script Claude writes. (estimate: effort +5%, value +20%)
- Work: Low
- Impact: Medium
- Necessity: Medium
- Issue: Nothing was ever checked on the deployed site, a real phone or a screen reader.
- Fix: Allow github.io in the environment network policy; run one guided phone and screen-reader session with the user.
- Conflicts: none
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still valid (github.io unreachable from this environment). Absorbs G-048: touch and 3D were checked only in Chromium emulation; one guided session on the user's phone covers both.

### G-049: G ids on pre-ADR-082 notes

- Status: ADR-212
- Origin: ADR-082, 2026-10-25; agent scoped it out
- Missing: Backlog notes and ADRs written before ADR-082 do not cite G ids; the seed G-001 to G-048 covers their gaps, but the old text does not link to it.
- Request: “Configure the project so everytime something is "not implemented" it is being saved into adrs folder into "Gaps"”
- Questions: Add G ids to the old backlog Gap notes and Open questions too?
- Suggested pick: Yes: one pass adding the matching G id next to each old Gap note and open question, so every gap is findable from both sides (estimate: effort +15%, value +10%)
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: Gap notes and open questions written before the gaps ledger do not link to their G ids.
- Fix: One pass adding the matching G id beside each old backlog gap note and open question.
- Conflicts: none

### G-053: Step back up one level without the breadcrumb

- Status: ADR-203
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

### G-055: Count stepper only for cabinet spaces

- Status: Acknowledged (2026-10-25)
- Origin: ADR-084, 2026-10-25; agent scoped it out
- Missing: Products without spaces (frame, panel set, single panel) and project-plan items get no stepper; desk pedestals and corner wings get it through their cabinet spaces only.
- Request: “Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber - … Placement: above the selected piece”
- Questions: Which counts outside cabinet spaces should step (e.g. frame slats, panel-set copies, desk pedestals)?
- Suggested pick: Name the ones you use; each is a small add once the stepper exists (estimate per family: effort +10%, value +5%)
- Work: Medium
- Impact: Low
- Necessity: Low
- Issue: The count stepper only works inside cabinet spaces, not frames, panel sets or project-plan items.
- Fix: User names which families to support; add each as a small stepper extension.
- Conflicts: none

### G-056: Which bay the divider stepper adds or removes

- Status: Open
- Origin: ADR-084, 2026-10-25; agent scoped it out
- Missing: stepDividers still adds an empty bay at the end and removes the last bay (src/core/counts.ts:97-108); nothing is added or removed next to the selection.
- Request: “Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber - … Placement: above the selected piece”
- Questions: Where does + add and - remove: at the end, or next to the selected bay? What goes in a new bay: empty, or a copy of its neighbour?
- Suggested pick: End, with 2 shelves like the existing Add button (consistent with what the app does today; next-to-selection is estimated +15% effort for +5% value)
- Work: Low
- Impact: Low
- Necessity: Low-medium
- Issue: Unconfirmed whether the divider + and - should act at the end or next to the selected bay.
- Fix: User confirms the current behaviour: add an empty bay at the end, remove the last bay.
- Conflicts: none
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved; text out of date. ADR-089 decided a new bay is empty (src/core/counts.ts:89-99), so the 2-shelves default is gone, and ADR-086 changed what + acts on. Still unconfirmed: whether + adds at the end or next to the selection, and what - removes.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.
- Note: Re-checked 2026-11-05 on main c4a15bd (code read, no browser): Missing text updated to the current code.

### G-073: UI critique findings 8, 9 and 12 left as they are

- Status: Open
- Origin: UI critique follow-up 2026-10-26 (N87); user decision for 8 and 9, ADR-033 for 12
- Missing: Finding 8 (desktop Build & Preview only swaps the centre view; the left panel stays Compose), finding 9 (whole-piece editing split across the Quick counts card, Settings and 'Edit the interior') and finding 12 (Romanian family and variant names under the English ones in the catalog and Start from, ADR-033)
- Request: Findings 8 + 9: 'Skip 8 and 9'. Finding 12: no request; the names are ADR-033's decision.
- Questions: Write an ADR for 8 and 9 later? Keep the Romanian names (ADR-033) or show them only in search?
- Suggested pick: Keep 12 as ADR-033 decided (no change); for 8 and 9, an ADR when you want the editor layout revisited (closest to the critique; est. +40 % work over a small fix, +60 % of 8/9 value)
- Work: Medium-high
- Impact: Low-medium
- Necessity: Low
- Issue: UI critique findings on desktop panel layout and split whole-piece editing were skipped by the user.
- Fix: Keep the Romanian names; write an editor-layout ADR for findings 8 and 9 when the user wants it.
- Conflicts: none

### G-076: Research app records go stale as ADRs ship

- Status: ADR-212
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

### G-079: Drop a catalog item into the 3D view

- Status: Open
- Origin: ADR-094 (2026-10-26, Claude: not asked for)
- Missing: Dropping a catalog item into the 3D view.
- Request: "New adr 6" (2026-10-26)
- Questions: Drop into 3D too, once ADR-093 exists?
- Suggested pick: Drop onto the 3D floor plane with ADR-093's projection (about +30 % of ADR-094's work, +15 % value; estimates).
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: Catalog items can be dropped onto the plan but not into the 3D view.
- Fix: Drop onto the 3D floor plane using the 3D Move mode's pointer projection and snapping.
- Conflicts: ADR-093: overrides 3D select-only for moving and turning pieces only, not adding them

### G-092: User-written compatibility rules

- Status: Open
- Origin: ADR-100 (2026-10-26, Claude: not asked for)
- Missing: Rules the user writes or edits.
- Request: "New adr 3" (2026-10-26)
- Questions: Let users add or edit compatibility rules?
- Suggested pick: Not yet; the rule list is shown read-only (editing rules needs a rule editor, about 25 points).
- Work: Medium-high
- Impact: Low
- Necessity: Low
- Issue: Users cannot add or edit compatibility rules; the rule list is read-only.
- Fix: Keep the rules read-only for now; a rule editor would come in its own ADR.
- Conflicts: none

### G-094: Stop hook not yet observed in a live session

- Status: Open
- Origin: ADR-082, 2026-10-26; the Stop hook was tested with sample inputs only (Done when), not observed in a live Claude Code session
- Missing: Evidence that the Stop hook in .claude/settings.json fires and asks once in a real Claude Code session (a worker subagent gets SubagentStop, not Stop, so it could not observe it)
- Request: “How to configure to have it always up to date? Hook?”
- Questions: Should someone end a real top-level session with a reply that lists skipped items and confirm the hook asks once?
- Suggested pick: Yes: one manual check in the next top-level session that ends with a Skipped this iteration list (estimate: effort +2%, value +10% of the hook's request)
- Work: Low
- Impact: Low
- Necessity: Low-medium
- Issue: The gaps Stop hook was tested only with sample input, never seen firing in a real session.
- Fix: End one real top-level session with a skipped list and confirm the hook asks once.
- Conflicts: none

### G-095: Catalog counts agreement unconfirmed

- Status: ADR-201
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

- Status: ADR-202
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

### G-099: Group gaps by origin

- Status: Open
- Origin: ADR-101, 2026-10-26; user did not pick it
- Missing: The gaps page has no grouping by origin (the ADR or area a gap came from).
- Request: “Add a gaps page, similar to reseaech” — offered options: Search + status filter, Group by origin, Overview counts, Full detail per gap
- Questions: Add grouping by origin later?
- Suggested pick: Leave it out (the user picked the other three); the search finds an ADR id in the Origin field. (estimate for grouping: effort +10%, value +5%)
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: The gaps page cannot group gaps by the ADR or area they came from.
- Fix: Leave it out as the user chose; search on the Origin field covers it.
- Conflicts: none

### G-100: Gap marks not in a file

- Status: ADR-212
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

### G-101: Ledger not editable from the app

- Status: Open
- Origin: ADR-101, 2026-10-26; ADR-002 (no backend, no tokens)
- Missing: The page cannot write docs/adr/GAPS.md; decisions go through Copy decisions. (ADR-126 now permits opt-in online features, so 'while ADR-002 holds' is outdated; no ledger write path exists.)
- Request: Items “can be used to add as a new adr or mark as acknowledged and accepted” (G-050)
- Questions: None while ADR-002 holds.
- Suggested pick: Keep the hand-over to Claude (estimate for a GitHub-token write path: effort +60%, value +15%, and it breaks ADR-002)
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: The gaps page cannot write the ledger; decisions go out only through Copy decisions.
- Fix: Keep the Copy decisions hand-over to Claude; no ledger write path.
- Conflicts: none
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-103: Family rule for your own templates

- Status: ADR-210
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

- Status: ADR-204
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

- Status: ADR-203
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

- Status: ADR-203
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

### G-107: Keep mine for saved single pieces

- Status: Open
- Origin: ADR-096 (2026-10-26, Claude: scoped while building)
- Missing: Saved single pieces in the Library (Projects → Single pieces) show 'Template updated (revision a → b)', but Keep mine and Replace are offered on project pieces only; a saved single piece has no field to remember a kept revision.
- Request: Answer to 'Show the notice in the Library too?': "Library too" (2026-10-26)
- Questions: Should a saved single piece also offer Keep mine (a design-document field) and Replace with the new revision?
- Suggested pick: Notice only, as built (the answer asked for the notice); Keep mine on saved designs needs an optional Design field (about +20 % of ADR-096's work, +10 % value; estimates).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Saved single pieces show 'Template updated' but offer no Keep mine or Replace, unlike project pieces.
- Fix: Keep the notice only as built; Keep mine later needs an optional Design field and a schema bump.
- Conflicts: none

### G-109: Cycling stacked pieces on the plan replaces opening them

- Status: Open
- Origin: ADR-097 (2026-10-26, Claude: defaulted while building)
- Missing: On the plan, a tap on the same spot over stacked pieces selects the next piece under it (ADR-097) instead of opening the selected piece's interior (ADR-083, G-066); stacked pieces open from the room front view, 3D or the card.
- Request: New adr 2 (2026-10-26): tapping the same spot again selects the next piece under the pointer
- Questions: Over stacked pieces on the plan, should a further tap cycle (as built) or open the piece, with cycling on another gesture?
- Suggested pick: Cycle as built (the ADR's words); opening stays one tap away in the front view (no extra work).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: On the plan, re-tapping stacked pieces cycles to the next piece instead of opening the selected piece.
- Fix: Keep cycling as built; opening stays one tap away in the front view, 3D or card.
- Conflicts: none

### G-110: Distribute across rows and centre-snap rules

- Status: ADR-205
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

### G-116: Fill a wall: carcasses with 3 or more equal fronts

- Status: ADR-204
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

- Status: ADR-204
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

- Status: ADR-204
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

### G-119: Doubled rails on a rails top

- Status: Open
- Origin: ADR-105, 2026-10-27, Claude default
- Missing: A doubled top on a rails top (two rails) is not built: the rails stay single and a warning says so.
- Request: Add the doubled top support … 2 panels
- Questions: Should 'Doubled' also double the two rails of a rails top, or stay a panel-top option only?
- Suggested pick: Panel top only (default used): the user's answer was '2 panels', a rails top has no panel; doubling rails is a separate request (+5 % work, +0 % of this request).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Doubled top on a rails top keeps single rails and only shows a warning.
- Fix: Keep doubled top as a panel-top option only, as built; doubling rails is a separate request.
- Conflicts: none

### G-120: Glue and screws for the doubled top

- Status: Open
- Origin: ADR-105, 2026-10-27, Claude (ADR-010)
- Missing: No glue or screw line in the hardware list for joining the two top layers; the layers count as a carcass joint in the fastener tally only.
- Request: Add the doubled top support … 2 panels
- Questions: Which glue and screws (length, spacing) join the two layers? Not known; ADR-010 forbids inventing them.
- Suggested pick: Leave it to the user's own fastener choice for carcass joints until they name a glue and screw (0 % work now).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: No glue or screw line joins the two doubled top layers in the hardware list.
- Fix: Leave it to the user's carcass fastener choice until they name a glue and screw spec.
- Conflicts: none

### G-121: Doubled bottom, sides or shelves

- Status: Open
- Origin: ADR-105, 2026-10-27, Claude scope
- Missing: Only the top can be doubled; a doubled bottom, side or shelf is not built.
- Request: Add the doubled top support
- Questions: Do you also want a doubled bottom or doubled sides?
- Suggested pick: Top only, as asked (0 % extra work).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Only the cabinet top can be doubled; bottoms, sides and shelves cannot.
- Fix: Keep top only, as the user asked.
- Conflicts: none

### G-122: Fill a wall: at most 40 pieces per mix

- Status: Open
- Origin: ADR-103 review, 2026-10-27; Claude added the bound
- Missing: A mix has at most 40 pieces (Equal fronts at most 80 fronts), so a tiny min width cannot freeze the page; beyond that the wizard says so instead of suggesting.
- Request: suggest a good width per piece ... resulting in a few pieces of furniture mixed (context: no limit was asked for)
- Questions: Is 40 pieces per wall enough, or should the limit be higher?
- Suggested pick: Keep 40: a 400 mm min fills a 16 m wall; longer runs are better as several walls. (estimate: effort 0%, value 0%)
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Fill a wall caps a mix at 40 pieces (80 fronts) and says so beyond that.
- Fix: Keep the 40-piece limit; longer runs are better split into several walls.
- Conflicts: none

### G-123: Fill a wall: wall cabinet depth

- Status: ADR-204
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

### G-124: Fill a wall: wall row reaching into the base row

- Status: Open
- Origin: ADR-104, 2026-10-27; Claude changed the agreed handling while building (ADR-008)
- Missing: The ADR said a wall cabinet reaching into the base row would be warned and still offered. It overlaps the base cabinet, which projects report as an error (pieces-overlap), and mixes with errors are never offered. Such wall rows are now dropped and the Suggestions step says by how much and to lower the wall cabinet height.
- Request: Catalog height, Refine field (answer to: How tall are the wall cabinets themselves?)
- Questions: When the wall cabinets would reach into the base row, should the wizard drop the wall row (now), shorten the wall cabinets to fit, or offer the mix with the overlap error shown?
- Suggested pick: Shorten the wall cabinets to the room left above the base row (never below the catalog minimum), labelled on the card, so a wall row still appears. (estimate: effort +5%, value +10%)
- Work: Low-medium
- Impact: Medium
- Necessity: Medium
- Issue: Wall rows that would reach into the base row are dropped, so low walls get no wall row.
- Fix: Shorten wall cabinets to the room above the base row, never below catalog minimum, labelled on the card.
- Conflicts: ADR-104: decided overlapping wall rows are not offered and nothing is clamped; user chose height field

### G-126: No width/depth fields for a bed or a set of loose panels

- Status: ADR-211
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

### G-127: Fill a wall: the over-hood cabinet is not placed over a hood

- Status: Open
- Origin: ADR-104, 2026-10-27, review nit
- Missing: The over-hood wall variant (no bottom) is dealt into the wall row at any position; nothing ties it to a hood or hob below.
- Request: Yes, every catalog wall variant
- Questions: Should the over-hood cabinet appear only above a hob or hood, or stay anywhere in the row?
- Suggested pick: Anywhere, as answered ('every catalog wall variant', 0 % extra work).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: The over-hood wall cabinet can land anywhere in a Fill a wall row, not above a hob.
- Fix: Keep it anywhere in the row, as the user answered 'every catalog wall variant'.
- Conflicts: none

### G-128: Save a project piece back over an existing template

- Status: Open
- Origin: ADR-107, 2026-10-27, Claude scope
- Missing: Saving a project piece always makes a new catalog template; it never overwrites the template the piece came from.
- Request: New adr to add the possibility to save a new piece to catalog when created it inside a project
- Questions: Do you also want 'Update the template' to write a project piece's changes back into its existing template as a new revision?
- Suggested pick: New template only, as asked (0 % extra work).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Saving a project piece to the catalog always makes a new template, never updates its source.
- Fix: Keep new-template-only, as asked; an 'Update the template' revision write is a separate request.
- Conflicts: none

### G-129: Save a group or several pieces as one catalog item

- Status: Open
- Origin: ADR-107, 2026-10-27, Claude scope
- Missing: Only one piece at a time is saved to the catalog; a group or multi-selection is not saved as one item (project templates, ADR-060, cover whole projects).
- Request: New adr to add the possibility to save a new piece to catalog when created it inside a project
- Questions: Should a selected group of pieces be savable as one catalog item?
- Suggested pick: One piece at a time, as asked (0 % extra work).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: A group or multi-selection of pieces cannot be saved as one catalog item.
- Fix: Keep one piece at a time, as asked; project templates already cover whole projects.
- Conflicts: none

### G-135: jsdom find-it cannot tap the drawing by position

- Status: Open
- Origin: ADR-108 (found while building)
- Missing: The drawing hit-tests taps by screen position (getScreenCTM), which jsdom has no layout for; jsdom tests use each space's keyboard route (Enter), which runs the same tap at the space's centre, so a tap off-centre is not tested
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Is the keyboard route enough for drawing taps, or should tap-position work use Acceptance browser?
- Suggested pick: Keyboard route in jsdom; ADRs that change tap hit-testing use browser
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: jsdom find-it cannot tap the drawing at a position; only the centre via keyboard is tested.
- Fix: Keep the keyboard route in jsdom; ADRs changing tap hit-testing use browser acceptance.
- Conflicts: none

### G-136: Link pieces that are already 100% identical

- Status: ADR-207
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

### G-137: Linked copies across projects and templates

- Status: Open
- Origin: ADR-111, 2026-10-27, Claude scope
- Missing: Links live inside one project; a change does not reach copies in other projects, saved designs or catalog templates (earlier request 2026-10-27, replaced by the user).
- Request: give the possibility to update the original template, and it should be propagated further to the ones in the templates.
- Questions: Should a change also reach the template and copies in other projects?
- Suggested pick: One project only, as in the current request (0 % extra work).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Linked-copy changes stay inside one project; templates, saved designs and other projects are not updated.
- Fix: Keep links within one project, as in the current request.
- Conflicts: none

### G-139: Heading scale for drawings and print sheets

- Status: Acknowledged (2026-10-27)
- Origin: ADR-116
- Missing: Text sizes inside SVG drawings and the printed sheets keep their own sizes
- Request: Run a critique for listings, headers, text, button sizes, gaps, groupings
- Questions: Should drawing labels and print sheets follow the app heading scale?
- Suggested pick: Keep their sizes (print is Romanian sheets with their own layout, ADR-020)
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: SVG drawing labels and print sheets keep their own text sizes, not the app heading scale.
- Fix: Keep their sizes; print sheets have their own layout.
- Conflicts: none

### G-142: Count card can cover part of a piece that fills the front view

- Status: Acknowledged (2026-10-27)
- Origin: ADR-112 (found while building)
- Missing: At 390 px in a project, when the whole selected piece fills the front view no corner is free: the card covers about 6 % of the piece (the plinth corner); a 3-row card cannot avoid a centre bay; taps on the drawing under the card hit the card
- Request: Increment/decrement card must be inside the rendered 2d view, not over
- Questions: Accept the small overlap, or shrink the drawing only in that case, or move the card outside the drawing when no corner is free?
- Suggested pick: Accept the overlap (closest to the request: the card stays inside the view and the drawing keeps its size)
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: At 390 px the count card covers about 6% of a piece filling the front view.
- Fix: Accept the small overlap; the card stays inside the view and the drawing keeps its size.
- Conflicts: none

### G-143: Count card hidden while the bottom sheet is open

- Status: Acknowledged (2026-10-27)
- Origin: ADR-112 (found while building)
- Missing: On a phone the floating count card is hidden while the bottom sheet is open (the sheet holds the same counters); before, a single piece already did this, now the project front view does too
- Request: Force 2d view to maintain it's size, bottom cars can cover it partially, but not push it
- Questions: Keep the card hidden while the sheet is open, or show it in the visible part of the stage?
- Suggested pick: Keep hidden (the sheet shows the same counters; no duplicate)
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: On a phone the floating count card hides while the bottom sheet is open.
- Fix: Keep it hidden; the sheet shows the same counters.
- Conflicts: none

### G-144: Wording changed while moving intro text

- Status: Acknowledged (2026-10-27)
- Origin: ADR-113 (found while building)
- Missing: Not approved yet: the catalog checkbox 'I check safety-regulated items myself', '(ADR-036)' dropped from a panel intro, quantity info at any quantity, and wizard help kept visible (the shopping hint was rewritten, ADR-160/161).
- Request: Move info text from Project to a tooltip, apply same to other similar UX occurences
- Questions: Approve these three wording changes and the two choices?
- Suggested pick: Approve (shorter labels fit one row; the ADR number is not user text)
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Several wording changes made while moving intro text to info buttons await user approval.
- Fix: Get the user's approval of the changed labels and choices; revert any they reject.
- Conflicts: none
- Note: Re-checked 2026-11-05 on main c4a15bd (code read, no browser): Missing text updated to the current code.

### G-148: ADR ids and Back link left on the Gaps and Research pages; Select lost its tooltip

- Status: ADR-211
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

### G-170: Angled pieces snap and measure by their enclosing box

- Status: ADR-205
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

### G-171: Angled pieces are not part of runs

- Status: Open
- Origin: ADR-121 (found while building)
- Missing: A piece at an angle is left out of runs: no shared worktop, run plinth, fillers, covers, trims or side-by-side compatibility rules for it
- Request: Accept default, /batch all ready
- Questions: Should run parts follow an angled piece (a worktop cut at an angle), or is leaving it out right?
- Suggested pick: Leave it out (run parts are straight boards along a wall, ADR-036; an angled worktop is a new cut shape)
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Angled pieces are left out of runs: no shared worktop, plinth, fillers or trims.
- Fix: Leave angled pieces out of runs; run parts are straight boards along a wall.
- Conflicts: none

### G-172: 3D outlines of an angled piece are drawn unturned

- Status: ADR-203
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

### G-181: Move/Section toggle sometimes ignores the first tap after a touch drag or while the 3D view settles

- Status: ADR-201
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

- Status: ADR-203
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

### G-201: Pictures and 3D models in design codes

- Status: Open
- Origin: ADR-124 (scope)
- Missing: A design code carries the document only; board pictures and display-only 3D models stay on this device (a project file carries them)
- Request: Accept default, /batch all ready
- Questions: Should codes also carry pictures and 3D models (much longer codes), or stay document-only?
- Suggested pick: Document-only (codes stay short enough to paste; the project file carries the rest)
- Work: Medium
- Impact: Low
- Necessity: Low
- Issue: Design codes carry only the document; board pictures and 3D models stay on the device.
- Fix: Keep codes document-only; the project file carries pictures and models.
- Conflicts: none

### G-202: Replace and the outer size

- Status: Open
- Origin: ADR-124 (found while building)
- Missing: Replace never carries the piece's own outer width, height or depth; this narrows the accepted G-160 pick 'every changed setting'
- Request: Accept default, /batch all ready
- Questions: Carry size too (neighbours may then overlap; those become diagnostics), or keep the catalog item's size?
- Suggested pick: Carry size too (closest to the pick; estimate +10 % work, +15 % of value)
- Work: Low-medium
- Impact: Low-medium
- Necessity: Low-medium
- Issue: Replace never carries the piece's own outer width, height or depth to the new item.
- Fix: Carry the piece's own size on Replace too; resulting overlaps show as diagnostics.
- Conflicts: ADR-124: Decision says outer sizes are the new item's and listed as not kept.

### G-210: Project templates drop run handles and sinks

- Status: ADR-204
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

- Status: ADR-203
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

- Status: ADR-205
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

### G-273: Wall backgrounds outside 3D and front view

- Status: ADR-208
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

- Status: ADR-208
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

- Status: ADR-208
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

### G-276: Reset emails and the built-in sender

- Status: Open
- Origin: ADR-136, 2026-10-28; found while building (Claude)
- Missing: Supabase's built-in email sender reportedly sends only to the project team's addresses, about 2 emails per hour (web search 2026-10-28; supabase.com not reachable from the build session). With public sign-up (G-214) and the built-in sender (G-250), password-reset emails will not reach other users.
- Request: “New adr for ui login (including gmail)/logout/forgot password/reset password”; answer G-250: Supabase built-in email
- Questions: Keep the built-in sender (resets only for team addresses), or set a custom SMTP sender in Supabase?
- Suggested pick: A custom SMTP sender in Supabase (no app change; estimate effort +2 %, value: forgot password works for everyone)
- Work: Low
- Impact: High
- Necessity: High
- Issue: Supabase's built-in sender only mails team addresses, so password resets will not reach real users.
- Fix: Configure a custom SMTP sender in the Supabase dashboard; no app change.
- Conflicts: ADR-136: Decision says reset mails come from Supabase's built-in email (G-250).

### G-277: Supabase project not set up

- Status: Open
- Origin: ADR-127, 2026-10-28; found while building (Claude)
- Missing: Supabase migration not applied, Google sign-in not registered, email settings not set, no live check; the project URL and key are in .github/workflows/deploy.yml:30-31.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts”; answers G-217 Supabase, G-219 my personal account
- Questions: Create the Supabase project and Google client (docs/supabase-setup.md), then let a session test sign-in, sync and share links against it?
- Suggested pick: Yes: follow docs/supabase-setup.md, then run a live check (estimate 1 hour of your time)
- Work: Low-medium
- Impact: High
- Necessity: High
- Issue: Supabase migration, Google sign-in and email settings are not set up; online features untested live.
- Fix: Follow docs/supabase-setup.md in the dashboard, then run a live sign-in, sync and share check.
- Conflicts: none
- Note: 2026-10-28: the user created the project `https://nllwhcxvcbtjfkdhsyse.supabase.co` and gave its publishable key; both are set in `deploy.yml`. Still open: the migration, Google sign-in and the email settings in the dashboard, and a live check.
- Note: Re-checked 2026-11-05 on main c4a15bd (code read, no browser): Missing text updated to the current code.

### G-278: Account and share-link limits

- Status: Open
- Origin: ADR-128, ADR-132, 2026-10-28; Claude chose values
- Missing: Values chosen while building, not by the user: one item at most 2 MB, one account at most 25 MB (about 20 full accounts in the 500 MB free database), at most 30 new share links per account per hour, at most 120 opens per link per hour.
- Request: Answers G-223 “Design caps + total cap”, G-235 “Vendor defaults first”
- Questions: Keep these limits, or set your own?
- Suggested pick: Keep them until a limit is hit (estimate effort +0 %)
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Account size and share-link rate limits were chosen by Claude, not confirmed by the user.
- Fix: Keep the current limits until one is hit, then let the user set new values.
- Conflicts: none

### G-279: No Trash list to restore from

- Status: Open
- Origin: ADR-129, 2026-10-28; found while building (Claude)
- Missing: Deleted account items go to the Trash for 7 days on the server, but the app has no Trash list to restore them from.
- Request: Answer G-228: “Account Trash”, 7 days
- Questions: Add a Trash list in Account with Restore?
- Suggested pick: Yes, in Account (estimate effort +10 %)
- Work: Medium
- Impact: Medium
- Necessity: Medium
- Issue: Deleted account items sit in a 7-day server Trash but the app offers no way to restore them.
- Fix: Add a Trash list with Restore in the Account screen.
- Conflicts: none

### G-280: Conflict copies are not named after a device

- Status: Open
- Origin: ADR-129, 2026-10-28; found while building (Claude)
- Missing: On a conflict, the account's version is kept as a copy named “… (from your account)”, not after the other device: devices have no names.
- Request: Answer G-226: “Keep both … the second is saved as a copy named after its device”
- Questions: Name devices (asked once per device), or keep “(from your account)”?
- Suggested pick: Keep “(from your account)” (estimate effort +0 %; naming devices +5 %)
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Conflict copies are named '(from your account)', not after the other device as the user asked.
- Fix: Keep the '(from your account)' name; naming devices would cost about 5 % more.
- Conflicts: ADR-129: user chose the conflict copy named after its device (G-226).

### G-281: Switching accounts needs a sign-in

- Status: Open
- Origin: ADR-142, 2026-10-28; found while building (Claude)
- Missing: Supabase keeps one session per browser, so Switch to … signs out and asks for the other account's password (the email is filled in); it is not a one-tap switch.
- Request: Answer G-263: “Several (Recommended)”
- Questions: Keep sign-out-and-sign-in, or keep several sessions at once (one Supabase client per account)?
- Suggested pick: Keep it (estimate effort +0 %; several sessions +25 %)
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Switching accounts signs out and asks for the other account's password; not a one-tap switch.
- Fix: Keep sign-out-and-sign-in; several simultaneous Supabase sessions would cost about 25 % more.
- Conflicts: none

### G-282: Restored copies lose version and template links

- Status: Open
- Origin: ADR-133, 2026-10-28; found while building (Claude)
- Missing: Restore gives every restored piece, project and template a new id (G-244), so kept project versions and template links in the backup point at the old ids and stay apart from the restored copies.
- Request: Answer G-244: “New copies (Recommended)”
- Questions: Keep new ids always, or keep the old id when nothing on this device uses it?
- Suggested pick: Keep the old id when it is free (closer to a full restore; estimate effort +3 %)
- Work: Low-medium
- Impact: Low-medium
- Necessity: Low-medium
- Issue: Restored items get new ids, so backed-up versions and template links no longer point at them.
- Fix: On restore, keep the item's old id when nothing on this device already uses it.
- Conflicts: ADR-133: restore makes new copies with new ids, per user answer G-244.

### G-287: Lens distortion of wall photos

- Status: Open
- Origin: ADR-146 (out of scope)
- Missing: Correcting curved lines from wide-angle lenses (barrel distortion); straightening fixes the angle only
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: Is barrel correction needed for your photos?
- Suggested pick: Not asked; only if photos show curved wall edges after straightening
- Work: High
- Impact: Low
- Necessity: Low
- Issue: Wall photos cannot be corrected for wide-angle barrel distortion; only the angle is straightened.
- Fix: Add barrel correction only if the user's photos still show curved wall edges.
- Conflicts: none

### G-288: Adjust the wall picture from the front view

- Status: Open
- Origin: ADR-146 (out of scope)
- Missing: Dragging the wall picture in the 2D front view; only the 3D view adjusts it
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: Should the front view also drag the picture?
- Suggested pick: Not asked; the user chose dragging in 3D
- Work: Medium
- Impact: Low
- Necessity: Low
- Issue: The wall picture can only be dragged into place in the 3D view, not in the front view.
- Fix: Leave as is; the user chose 3D dragging. Add front-view drag only if asked.
- Conflicts: none

### G-289: Move to actions on the 2D plan

- Status: Open
- Origin: ADR-147, 2026-10-29; out of scope
- Missing: No overlay bar of Move to buttons over the 2D plan; they are in the piece panel and the 3D Move toolbar
- Request: add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest left piece, snap to closest right piece, and any other snaps you think would be appropriate
- Questions: Add a floating Move to bar over the plan?
- Suggested pick: Not now; the user picked panel + 3D
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: Move to snap actions are not available as a floating bar over the 2D plan.
- Fix: Not now; the user picked the piece panel and 3D toolbar. Add a plan bar on request.
- Conflicts: none

### G-301: Third UI language

- Status: Open
- Origin: ADR-153 (out of scope)
- Missing: A third UI language (Romanian or other)
- Request: add support for Russian language, have it toggle, also translate all the existing content ...
- Questions: Add a Romanian UI too?
- Suggested pick: Not asked; leave until requested
- Work: High
- Impact: Low-medium
- Necessity: Low
- Issue: The app UI has only English and Russian; no Romanian or third language.
- Fix: Leave until the user asks; then add a Romanian dictionary like the Russian one.
- Conflicts: none

### G-305: Written guides

- Status: Open
- Origin: ADR-158 (out of scope)
- Missing: Written guides on the Information and guides page
- Request: add a page where you list all the features that the app currently supports
- Questions: Which guides should the page hold?
- Suggested pick: Ask the user when guides are wanted
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: The Information and guides page has the feature tree but no written guides.
- Fix: Ask the user which guides they want, then write them.
- Conflicts: none

### G-306: CSV separator per print language

- Status: Open
- Origin: ADR-157 (open question)
- Missing: The CSV column separator per print language (semicolon in all three today)
- Request: add support for Russian language ... also translate all the existing content
- Questions: Should the English CSV use commas, as English Excel expects?
- Suggested pick: Ask the user; semicolons stay until answered
- Work: Low
- Impact: Low-medium
- Necessity: Low-medium
- Issue: The parts CSV uses semicolons in every print language, though English Excel expects commas.
- Fix: Ask the user; if yes, use commas for English CSV and keep semicolons otherwise.
- Conflicts: none

### G-308: Selection box in the front view and the 3D view

- Status: ADR-211
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

### G-311: Rotation (°) field hidden

- Status: Open
- Origin: ADR-160 (side panel critique, 2026-10-30)
- Missing: The typed rotation field (ADR-121) is hidden from the selected-piece card; angles other than quarter turns cannot be typed.
- Request: Agree with all, implement, fix, remove the how many completely, there already is rotation in toolbar, no more need for the 4 buttons, also remove the rotation degree input, hidden for now
- Questions: When and where should the typed angle come back (a link under Position, the More menu)?
- Suggested pick: A small 'Exact angle…' link under Position, as in the critique.
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: The typed rotation angle field is hidden from the selected-piece card, by user choice.
- Fix: Keep hidden until the user wants it; then add an 'Exact angle...' link under Position.
- Conflicts: none
- Answer (user, 2026-10-30): "Keep hidden"; stays open until the user wants it back.

### G-312: Seller catalogs are a bundled snapshot

- Status: Open
- Origin: ADR-161, 2026-10-30; agent scoped it out
- Missing: Seller prices and stock are a snapshot bundled in the app build (Regency export of 2026-10-29). The app never updates them itself; ADR-172 added a hand-started workflow (.github/workflows/seller-prices.yml) that takes an export URL and opens a pull request, and a newer file still needs a release. Nothing runs on a schedule. Live feeds stay ADR-063 (Deferred).
- Request: Import these as products for materials, keep it regency agnostic, more sellers will follow
- Questions: Refresh seller data how often, and by whom?
- Suggested pick: Re-run the converter on each new export the user provides and release (estimate: effort 5 %, value: prices stay current)
- Work: Low
- Impact: Medium
- Necessity: Low-medium
- Issue: Seller prices and stock are a bundled snapshot that only changes with a new release.
- Fix: Re-run the seller-price workflow on each new export the user provides, then release.
- Conflicts: none
- Note: Re-checked 2026-11-05 on main 0c26d0b (code read, no browser): Missing text updated to the current code.

### G-313: Extra seller items only per piece

- Status: ADR-210
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

- Status: ADR-206
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

### G-315: Band and hardware pictures not shipped

- Status: Open
- Origin: ADR-162, 2026-10-30; agent scoped it out
- Missing: Only board and worktop pictures ship with the app. Edge band and hardware pictures still load from regencycompany.ro (lists only, never in 3D).
- Request: You didnt use the image i provided to render
- Questions: Ship band and hardware pictures too?
- Suggested pick: Only if bands get a 3D look of their own (estimate: effort +15 %, value +5 %)
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: Edge band and hardware pictures still load from the seller's site; only board and worktop pictures ship.
- Fix: Extend the picture download workflow to bands and hardware, only if bands get their own 3D look.
- Conflicts: none

### G-316: Seller pictures not seen before shipping

- Status: ADR-206
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

### G-324: Formula functions

- Status: ADR-206
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

- Status: ADR-209
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

### G-329: Typed connectors and assembly graph

- Status: ADR-207
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

### G-331: No stacked or cross-level connections

- Status: ADR-207
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

### G-332: No turn gizmo in 3D

- Status: Open
- Origin: ADR-169, 2026-11-04; agent scoped it out
- Missing: Turning by dragging exists on the plan only; 3D Move mode turns by quarter-turn buttons (ADR-093).
- Request: “Free-angle turn handle” (user 2026-11-04)
- Questions: A turn gizmo in 3D Move mode too?
- Suggested pick: A ring gizmo in 3D with the same snap rules (estimate: effort +60%, value +20%).
- Work: Medium-high
- Impact: Low-medium
- Necessity: Low
- Issue: 3D Move mode turns only by quarter-turn buttons; free-angle dragging exists on the plan only.
- Fix: Add a ring turn gizmo in 3D Move mode with the plan's snap rules.
- Conflicts: ADR-169: records that 3D Move mode stays at quarter turns, by choice.

### G-333: Templates store whole copies, not deltas

- Status: Open
- Origin: ADR-170, 2026-11-04; agent scoped it out
- Missing: A template stores a full copy of each piece, not only the parameters that differ from a catalog item (research: existing-template instancing).
- Request: “Keep copies; add connections, variables, bindings, project settings” (user 2026-11-04)
- Questions: Store only the differing parameters?
- Suggested pick: Not while templates keep copies (ADR-060); revisit with G-334 (estimate: effort +80%, value +10%).
- Work: High
- Impact: Low
- Necessity: Low
- Issue: Project templates store full copies of each piece instead of only parameters differing from catalog items.
- Fix: Store per-piece parameter deltas against catalog items; only if templates stop keeping copies.
- Conflicts: ADR-060: templates store embedded design copies; user kept copies again in ADR-170.

### G-335: Variables in catalog designs and the stand-alone editor

- Status: ADR-210
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

### G-337: Locks on boards, construction and insides

- Status: ADR-211
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

### G-340: No price change report between exports

- Status: ADR-206
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

- Status: ADR-210
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

- Status: ADR-210
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

- Status: ADR-206
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

- Status: ADR-207
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

### G-346: Connections in 3D Move mode not checked in a browser

- Status: ADR-201
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

- Status: ADR-201
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

- Status: ADR-204
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

### G-351: move-3d find-it fails on main at 1440 px

- Status: ADR-201
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

- Status: ADR-207
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

- Status: ADR-202
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

- Status: ADR-207
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

### G-355: Shared side with inset and sliding fronts

- Status: Open
- Origin: ADR-190
- Missing: At a shared side, inset fronts and sliding doors keep their own rule (no half overlay).
- Request: Add the possibility to have a common bottom or top between multiple items.
- Questions: Should sliding doors or inset fronts change at a shared side?
- Suggested pick: Keep their rule: an inset front never covers a side; a sliding door runs in its own track.
- Work: Medium
- Impact: Low
- Necessity: Low
- Issue: Inset fronts and sliding doors at a shared side keep their own rule, with no half overlay.
- Fix: Keep as is unless asked; inset fronts never cover a side, sliding doors run in their own track.
- Conflicts: none

### G-356: Wizard draft survives closing the dialog

- Status: ADR-211
- Origin: ADR-191, 2026-11-05; agent scoped it out
- Missing: The wizard's answers live only while the dialog is open. Confirming before a close (ADR-191) stops accidental loss; a draft that survives closing the dialog (Continue where you left off) is not built.
- Request: Not asked; the critique of 2026-11-05 noted the loss and the user chose the grouped ADR as proposed (confirm on close).
- Questions: Should a closed wizard keep its draft for the session, or until the piece is created?
- Suggested pick: Keep the draft in the store for the session; the Type step offers Continue or Start over. (estimate: effort +8 %, value +10 % over confirm-on-close)

### G-357: Doors choice is a dropdown on desktop

- Status: ADR-202
- Origin: ADR-191, 2026-11-05; agent scoped it out
- Missing: The Doors field on a desktop is a dropdown (five options; the segmented control takes four), so sliding and per-compartment doors are hidden behind a click while the cards promote them. Not changed by ADR-191.
- Request: Not asked; noted during the critique of 2026-11-05 and left out of the fourteen findings.
- Questions: Allow a five-option segmented control on desktop and wrap it on a phone?
- Suggested pick: Segmented up to five options at 1280 px, wrapping at 390 px. (estimate: effort +2 %, value +3 %)

### G-358: Start-new rows share one glyph

- Status: ADR-211
- Origin: ADR-193, 2026-11-05; design critique, agent scoped it out
- Missing: The Project, Fill a wall and Fill the room rows of Start something new share one 'project' glyph (Low).
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Give each row its own glyph?
- Suggested pick: A wall glyph for Fill a wall and a room-plan glyph for Fill the room. (estimate: effort +1 %, value +1 %)

### G-359: Open in wizard inside a project

- Status: ADR-203
- Origin: ADR-194, 2026-11-05; design critique, agent scoped it out
- Missing: Open in wizard is hidden for a wizard-made piece inside a project (Settings hides it there).
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Offer Open in wizard for a project piece, updating it in place in the project?
- Suggested pick: Offer it; Update piece replaces the project item's design. (estimate: effort +6 %, value +5 %)

### G-360: Wizard Review rows repeat long labels

- Status: ADR-202
- Origin: ADR-194, 2026-11-05; design critique, agent scoped it out
- Missing: Review rows repeat long field labels, e.g. 'Width of each compartment (0 = share the rest): 0 mm'.
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Give fields a short Review label?
- Suggested pick: An optional short label per field for Review. (estimate: effort +2 %, value +2 %)

### G-361: Arrow keys on Segmented controls

- Status: ADR-202
- Origin: ADR-194, 2026-11-05; design critique, agent scoped it out
- Missing: Segmented controls have no arrow-key movement anywhere in the app.
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Add roving tabindex and arrow keys to Segmented app-wide?
- Suggested pick: Yes, in the shared control, one change for every screen. (estimate: effort +3 %, value +3 %)

### G-362: Catalog item counts differ from room chips

- Status: ADR-202
- Origin: ADR-195, 2026-11-05; design critique, agent scoped it out
- Missing: The Catalog header says 118 items while the room chips sum to 183, because a family is listed under every room (ADR-032).
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Say 'in N families, listed under several rooms' or count per room only?
- Suggested pick: Keep the header; add a hint that a family can sit in several rooms. (estimate: effort +1 %, value +2 %)

### G-363: Imported templates shadow silently

- Status: ADR-203
- Origin: ADR-195, 2026-11-05; design critique, agent scoped it out
- Missing: Two imported templates that shadow the same shipped family: the last one wins silently (local.ts:85).
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Warn on import, or keep both as separate families?
- Suggested pick: Warn on import and ask which one to keep. (estimate: effort +3 %, value +3 %)

### G-364: Shelf pins in a diagonal corner

- Status: Open
- Origin: ADR-196, 2026-11-05; design critique, agent scoped it out
- Missing: Pin rows on five-sided boards: adjustable shelves in a diagonal corner (ADR-196 makes them an error instead).
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Support pin rows on the diagonal's straight sides?
- Suggested pick: Keep the error until a diagonal pin layout is decided with you. (estimate: effort +10 %, value +3 %)

### G-365: Handle side on a turned corner wing

- Status: ADR-203
- Origin: ADR-196, 2026-11-05; design critique, agent scoped it out
- Missing: Which edge 'left' means for handle holes on a turned wing-B front of an L-corner was not verified.
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Check handle hole sides on turned wing-B fronts?
- Suggested pick: A test that builds an L-corner with a left handle and checks the hole side. (estimate: effort +2 %, value +2 %)

### G-366: Hardware notes built from English fragments

- Status: ADR-202
- Origin: ADR-196, 2026-11-05; design critique, agent scoped it out
- Missing: Hardware notes are assembled from English fragments (hingeBand), so the Russian schedule mixes languages.
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Move the notes to whole t() sentences?
- Suggested pick: Whole sentences per note in t(), with Russian entries. (estimate: effort +4 %, value +3 %)

### G-368: CI runs only the tests related to a core-only change

- Status: ADR-201
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

### G-369: Drop the duplicate push-to-main CI run

- Status: Open
- Origin: ADR-197 CI analysis 2026-11-05
- Missing: Suggestion D: once deploy waits on CI (ADR-197), the push-to-main CI run re-verifies a tree that was already green on its pull request. The main run is kept.
- Request: Suggest improvements. Triggering less often the ci optimisations? Tests running by domain of change? Do all parts of the app need tests? Gaps/features/docs/unnecessary overcovering tests? (the user chose "all of these 4 + Suggestions A(all) and B(all)"; this suggestion was left out)
- Questions: Keep the main run (the safety net for ff pushes straight to main), or verify main only through the deploy?
- Suggested pick: Keep the main run while ff pushes straight to main. (estimate: no extra work; value 0 % until ff stops)
- Work: Low
- Impact: Low-medium
- Necessity: Low
- Issue: Every merge runs the full checks on the pull request and again on main.
- Fix: Keep while ff pushes straight to main; revisit if ff stops.
- Conflicts: ADR-197 deploy waits on the main CI run

### G-370: Review find-it tests that re-test logic through the UI

- Status: ADR-201
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

### G-371: Cheaper find-it runs (stopped before it was built)

- Status: ADR-212
- Origin: ADR-197 CI analysis 2026-11-05
- Missing: Find-it files take 192 of the 217 s of test CPU. Not measured or applied: userEvent.setup({ delay: null }), find-it as its own vitest project with jsdom and isolate: false, a cheaper module reset; each keeps the bare-app start (ADR-108). The user stopped the ADR before it was built.
- Request: "all of these 4 + Suggestions A(all) and B(all)" (item 3: cheaper find-it mounts); then "Stop 193" (the cheaper find-it ADR, never registered)
- Questions: Resume the cheaper find-it runs later?
- Suggested pick: Resume after ADR-197 lands, measuring first. (estimate: 20-50 % less find-it CPU, unmeasured)
- Work: Medium
- Impact: Medium
- Necessity: Low-medium
- Issue: Find-it tests dominate test CPU; each mounts the bare app with full module isolation and typed input delays.
- Fix: Measure each lever, then apply the ones that keep the bare-app start (ADR-108).
- Conflicts: none

### G-372: Wall picture: stale notice on a deliberate change or leaving the page

- Status: Open
- Origin: Review of PR #169 (ADR-198..200), 2026-11-05
- Missing: src/ui/WallBackground.tsx pick(): the 'prepared picture was not applied' error notice fires when the user switches the wall to None/Colour during an upload, or leaves the page (global notice shows on another page).
- Request: Check PR 169 code, it was written by a chatgpt
- Questions: Show the stale notice only when the wall or background changed outside this control?
- Suggested pick: Only notify when the operation was not cancelled by this control or unmount (closest to ADR-200's intent; est. +5 % work, removes a false error).
- Work: Low
- Impact: Low
- Necessity: Low-medium

### G-373: Size-lock note shows unrelated design notices

- Status: Open
- Origin: Review of PR #169 (ADR-198..200), 2026-11-05
- Missing: src/ui/Inspector.tsx SizeLockNote now renders any design-store notice (move refused, plan notices) in the size-lock info box, even for unlocked pieces.
- Request: Check PR 169 code, it was written by a chatgpt
- Questions: Is showing every refusal notice in the inspector intended, or only size-lock refusals?
- Suggested pick: Show the note only when an axis is locked or the notice is a size-lock refusal (matches ADR-122/199 wording; est. small change).
- Work: Low
- Impact: Low
- Necessity: Low

### G-374: Escape on More may not close it in Safari

- Status: Open
- Origin: Review of PR #169 (ADR-198..200), 2026-11-05
- Missing: src/ui/shell/MoreMenu.tsx listens for Escape on the menu element only; Safari does not focus <summary> on click, so Escape likely does nothing while editor shortcuts stay blocked. Not tested in Safari.
- Request: Check PR 169 code, it was written by a chatgpt
- Questions: Listen on window again but only act when More is open?
- Suggested pick: Window listener gated on details.open, keeping preventDefault/stopPropagation (keeps ADR-198 behaviour in all browsers; est. small change).
- Work: Low
- Impact: Low-medium
- Necessity: Low-medium

### G-375: Template list refresh skipped while a read is pending

- Status: Open
- Origin: Review of PR #169 (ADR-198..200), 2026-11-05
- Missing: src/ui/ProjectTemplates.tsx refresh() returns early when a read is in flight, so a delete or rename finishing during a Retry read can leave a stale row.
- Request: Check PR 169 code, it was written by a chatgpt
- Questions: Queue one follow-up read instead of dropping it?
- Suggested pick: Mark a pending re-read and run it after the current read (fixes the race fully; est. small change).
- Work: Low
- Impact: Low
- Necessity: Low

### G-376: Include the room starts ticked in Save as project template

- Status: Open
- Origin: Review of PR #169 (ADR-198..200), 2026-11-05
- Missing: ADR-200 approved an explicit Include room checkbox; the default (ticked) was chosen by the implementer, not the user.
- Request: Check PR 169 code, it was written by a chatgpt
- Questions: Should Include the room start ticked or unticked?
- Suggested pick: No recommendation until the user picks: ticked keeps the room (most complete template); unticked matches the old Cancel-path result. Both are a one-line change.
- Work: Low
- Impact: Low
- Necessity: Medium

### G-377: Remove the Rapier devDependency once its trial test is gone

- Status: ADR-212
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

- Status: ADR-209
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

- Status: ADR-212
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

- Status: ADR-211
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

- Status: ADR-211
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

- Status: ADR-210
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

- Status: ADR-207
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

- Status: ADR-209
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

### G-406: Electrical rules for outlets

- Status: Open
- Origin: ADR-205, 2026-11-06; remainder of G-030 (not in its suggested pick)
- Missing: No electrical rules: distances of outlets from sinks, hobs or water are not checked.
- Request: Pipes and outlets checked against the pieces (context, not a quote)
- Questions: Which rules, and from which regulation? The app must not invent them (ADR-010).
- Suggested pick: Only the distances the user enters, checked as warnings and labelled as the user's rule. (estimate: effort +20%, value +10%)
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: Outlets are not checked against sinks, hobs or water.
- Fix: Add distances that the user enters, checked as warnings, with no built-in values.
- Conflicts: none

### G-407: Typed position for sink and hob cut-outs

- Status: ADR-209
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

- Status: ADR-209
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

### G-409: Worktop joint fixings

- Status: Open
- Origin: ADR-205, 2026-11-06; agent scoped it out
- Missing: A mitred or butt worktop joint lists no fixings (worktop connector bolts, biscuits). Their type and count are supplier values (ADR-010).
- Request: Kitchen runs with plinth, filler, sink front (G-010 context, not a quote)
- Questions: List a "Worktop joint fixings (your choice)" line under To choose before buying?
- Suggested pick: Yes: one line per joint, with no count or size. (estimate: effort +5%, value +5%)
- Work: Low
- Impact: Low
- Necessity: Low-medium
- Issue: Worktop joints have no fixing line in the shopping list.
- Fix: Add one user-chosen shopping line per worktop joint.

### G-412: Worktop edge profiles and bundled appliance models

- Status: ADR-209
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

- Status: ADR-208
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

- Status: ADR-209
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

### G-420: Run parts read connections

- Status: Open
- Origin: ADR-207, 2026-11-06; remainder of G-007 (the coordinator kept ADR-207 to its size)
- Missing: Suggest run parts (ADR-061) groups runs from touching pieces only; it does not read stored connections.
- Request: “Verify, then Quick wins, then Medium effort”; later “guided snapping” and “cross-family composition”.
- Questions: Should run parts treat side- and corner-connected pieces as one run?
- Suggested pick: Build runs from side and corner connections when they exist, else from touching pieces as today. (estimate: effort +15%, value +10%)
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: Run parts ignore stored connections.
- Fix: Let groupRuns read side and corner connections.
- Conflicts: none

### G-421: L-shape and diagonal corners and desk pedestal ends share no side

- Status: Open
- Origin: ADR-207, 2026-11-06; remainder of G-354
- Missing: Only a blind corner's straight end and a desk gable end can share a side; L-shape and diagonal corner units and a desk's pedestal end keep both sides.
- Request: Add the possibility to have a common bottom or top between multiple items.
- Questions: Should the wing ends of L-shape and diagonal corners and a desk's pedestal side be shared with a neighbouring cabinet?
- Suggested pick: Share the wing ends of L-shape corners and a pedestal's outer side, as ADR-190 does for cabinets. (estimate: effort +25%, value +10%)
- Work: Medium-high
- Impact: Low
- Necessity: Low
- Issue: L-shape and diagonal corners and desk pedestal ends cannot share a side.
- Fix: Extend sharedSideCheck and the corner and desk builds to those ends.
- Conflicts: none

### G-422: Merge assembly steps

- Status: Open
- Origin: ADR-207, 2026-11-06; remainder of G-344 (its pick names an editable order with a reset)
- Missing: Steps can be reordered and renamed but not merged into one step.
- Request: “Ordered step list + 3D highlight” (user 2026-11-04)
- Questions: Let the user merge two neighbouring steps into one?
- Suggested pick: Merge with the next step, saved in the design's step order, undone by Reset the steps. (estimate: effort +15%, value +5%)
- Work: Medium
- Impact: Low
- Necessity: Low
- Issue: Two assembly steps cannot be merged.
- Fix: Store merged step pairs with the step order and show them as one step.
- Conflicts: none

### G-423: Long-press to select several pieces

- Status: Open
- Origin: ADR-207, 2026-11-06; remainder of G-404 (gesture check)
- Missing: There is no long-press gesture; on a phone the Select toggle adds pieces (ADR-097, ADR-159).
- Request: “Duplicate, mirror and predictable rotate operations”.
- Questions: Add a long-press on a piece that turns Select on and adds the piece?
- Suggested pick: Not needed while the Select toggle covers the phone; add it if users miss it. (estimate: effort +10%, value +5%)
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: A phone user cannot start selecting several pieces by holding a piece.
- Fix: Long-press on the plan, front view and 3D turns Select on and adds the piece.
- Conflicts: none

### G-424: Connector authoring

- Status: Open
- Origin: ADR-207, 2026-11-06; remainder of G-007
- Missing: Connection kinds are fixed in code (side, corner, stacked, wall); the user cannot define connector points or kinds.
- Request: “Verify, then Quick wins, then Medium effort”; later “guided snapping” and “cross-family composition”.
- Questions: Let the user define connector points on a piece and the rules between them?
- Suggested pick: Not yet; the four built-in kinds cover the requests so far. (estimate: effort +60%, value +10%)
- Work: High
- Impact: Low
- Necessity: Low
- Issue: Connector points and kinds cannot be authored.
- Fix: A connector editor storing points and rules per piece, in its own ADR.
- Conflicts: none

### G-428: Angled walls

- Status: Open
- Origin: ADR-208, 2026-11-06; remainder of G-012 (ADR-208 takes only tracing over a plan picture)
- Missing: Every room wall is parallel to x or z; a wall at another angle cannot be drawn or traced.
- Request: Room and floor plan (context, not a quote)
- Questions: Angled walls need a new ADR against ADR-003/004 (axis-aligned boxes); wanted?
- Suggested pick: Ask first; if wanted, a new ADR for angled walls that keeps pieces axis-aligned to their own wall. (estimate: effort +40%, value +10%)
- Work: High
- Impact: Low-medium
- Necessity: Low
- Issue: Rooms with an angled wall cannot be drawn.
- Fix: A new ADR for angled walls, against ADR-003/004, once the user wants it.
- Conflicts: ADR-003, ADR-004, ADR-059 (walls parallel to x or z)

### G-429: Render run on a laptop GPU

- Status: Open
- Origin: ADR-208, 2026-11-06; remainder of G-022 (ADR-208 takes the WebGPU path-tracer plan)
- Missing: The full render find-it has not been run on a machine with a real GPU since the WebGPU engine was planned.
- Request: Laptop, preview quality (context, not a quote)
- Questions: Can you run the render once on your laptop after ADR-208 ships?
- Suggested pick: Run the full render find-it on a machine with a GPU, on both engines, and record it in the backlog. (estimate: effort +5%, value +10%)
- Work: Low
- Impact: Low-medium
- Necessity: Low
- Issue: The render is checked only in a GPU-less browser.
- Fix: The user runs the render on a laptop GPU and the result is recorded.
- Conflicts: none

### G-430: Bundled CC0 3D models

- Status: Open
- Origin: ADR-208, 2026-11-06; remainder of G-040 (ADR-208 takes placement, drag, snap and templates for models)
- Missing: No 3D models ship with the app; models come only as .glb or .gltf imports (ADR-076).
- Request: “Import 3D models and model libraries”.
- Questions: Which licence for bundled models (CC0)? Which models (fridge, oven, sink, hob)?
- Suggested pick: A small bundled set of CC0 models (fridge, oven, sink, hob) once you agree that licence; one answer also settles G-412's appliance models. (estimate: effort +15%, value +15%)
- Work: Medium
- Impact: Medium
- Necessity: Low
- Issue: There is no ready model library.
- Fix: Bundle a few CC0 models in the app once the licence is chosen.
- Conflicts: none

### G-431: Board pictures in catalog pictures and cut sheets

- Status: Open
- Origin: ADR-208, 2026-11-06; remainder of G-413 (ADR-208 takes the 2D plan only)
- Missing: Catalog snapshots (src/core/snapshot.ts) and the cut sheets draw boards in their average colour.
- Request: “Render the furniture according to the selected material's color and structure”.
- Questions: Fill catalog pictures and cut sheets with the board picture, against ADR-048's average colour?
- Suggested pick: Keep the average colour as ADR-048 decided; a new ADR only if you want pictures there. (estimate: effort +10%, value +5%)
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: Catalog pictures and cut sheets show boards as plain colour.
- Fix: A new ADR if catalog pictures or cut sheets should show the board picture.
- Conflicts: ADR-048 (catalog pictures and cut sheets use the average colour)

### G-436: Reverse-the-hinge repair

- Status: Open
- Origin: ADR-209, 2026-11-06; remainder of G-034 (the coordinator split it: the repair needs G-011)
- Missing: A door blocked by a neighbour has no "Reverse the hinge" repair. The ADR-057 clearance is a box as deep as the door is wide on both sides, so reversing the hinge never clears it.
- Request: “Explainable warnings with repairs”.
- Questions: Build the hinge-side clearance (G-011, which changes ADR-057's box decision) and then this repair?
- Suggested pick: Once G-011 is decided, offer the hinge repair for single doors. (estimate: effort +10%, value +10%)
- Work: Low-medium
- Impact: Low-medium
- Necessity: Low-medium
- Issue: Reversing the hinge is not offered as a repair.
- Fix: After G-011, add the hinge repair to `repairsFor`.
- Conflicts: ADR-057 (clearances are axis-aligned boxes on both hinge sides)

### G-437: Bundled CC0 appliance models

- Status: Open
- Origin: ADR-209, 2026-11-06; remainder of G-412 (ADR-209 takes only the worktop edge profiles)
- Missing: No appliance models ship with the app; appliances come only as .glb imports (ADR-076).
- Request: “To sell designed kitchens”.
- Questions: Bundle a few appliance models under the CC0 licence? Which ones?
- Suggested pick: A few CC0 appliance models once you pick that licence and the models. (estimate: effort +15%, value +10%)
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: A kitchen shows no appliances unless the user imports a model.
- Fix: Bundle a few CC0 appliance models as display-only items once the licence is chosen.
- Conflicts: none

### G-438: Sink and hob cut-outs in the room front view

- Status: Open
- Origin: ADR-209, 2026-11-06; remainder of G-408 (its suggested pick was the 3D view only)
- Missing: The room front view does not mark sink and hob cut-outs on the worktop.
- Request: Accept default, /batch all ready (ADR-125: run sinks and handles)
- Questions: Draw each cut-out as dashed hidden lines in the worktop's front view?
- Suggested pick: Dashed lines at the cut-out's width on the worktop edge. (estimate: effort +5%, value +3%)
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Cut-outs are not seen in the front view.
- Fix: Draw each cut-out's width dashed on the worktop in the room front view.
- Conflicts: none

### G-439: Drilling positions for joints other than carcass joints

- Status: Open
- Origin: ADR-209, 2026-11-06; agent scoped it out (remainder of G-380)
- Missing: Drilling positions from the user's values are drawn for carcass joints only, not for back fixings, hanging points, worktop fixings or feet.
- Request: “Hardware and fastener completeness”.
- Questions: Which values would you enter for each of those joint types (for example distance from the edge for back fixings)?
- Suggested pick: Back fixings next, around the back's perimeter, from an edge distance you enter. (estimate: effort +10%, value +5%)
- Work: Low-medium
- Impact: Low
- Necessity: Low
- Issue: Only carcass joints show drilling positions.
- Fix: Add user-value drilling positions to the other joint types, one at a time.

### G-444: No layout optimisation of room mixes

- Status: Open
- Origin: ADR-210, 2026-11-06; split from G-341 (its pick covers the budget and style filters only)
- Missing: Fill the room ranks mixes by ADR-103 and ADR-173's rules; no search moves pieces between walls or trades widths to improve a whole-room layout.
- Request: “Fill the room” (user 2026-11-04)
- Questions: Should Fill the room optimise the whole layout (work triangle, fewest fillers) rather than rank per wall?
- Suggested pick: Rank whole-room mixes by fewest fillers and corner warnings first, after ADR-210 ships (estimate: effort +30%, value +10%).
- Work: Medium-high
- Impact: Low-medium
- Necessity: Low
- Issue: Room mixes are ranked per wall; the whole layout is never optimised.
- Fix: Add a whole-room ranking pass over the built mixes.
- Conflicts: none

### G-445: No peninsulas, and no islands outside rectangle rooms

- Status: Open
- Origin: ADR-210, 2026-11-06; split from G-342 (its pick names an island option only)
- Missing: Fill the room offers an island in rectangle rooms only (ADR-210); no peninsula joined to a run, no island in L or U rooms.
- Request: “Fill the room” (user 2026-11-04)
- Questions: Offer a peninsula off the end of a run, and islands in L and U rooms?
- Suggested pick: A peninsula option on Refine, a base run square to a wall's run end, with the same walkway width (estimate: effort +30%, value +10%).
- Work: Medium-high
- Impact: Low-medium
- Necessity: Low
- Issue: Peninsulas are never suggested and islands only fit rectangle rooms.
- Fix: Add a peninsula option and island placement for L and U rooms.
- Conflicts: none

### G-446: Fill the room fills kitchen walls only

- Status: Open
- Origin: ADR-210, 2026-11-06; agent scoped it out (G-025's pick adds room presets, not new wizard room types)
- Missing: Fill the room suggests kitchen cabinets only; bedroom (wardrobes) and office (desk, bookcases) walls come only from ADR-210's fixed room presets.
- Request: The 14 features you selected at 21:28 (context, not a quote)
- Questions: Should Fill the room offer a room type (Kitchen, Bedroom, Home office) that fills walls with that room's families?
- Suggested pick: A Room type choice on the Room step, filling walls from the families of that room (estimate: effort +40%, value +15%).
- Work: Medium-high
- Impact: Medium
- Necessity: Low
- Issue: Fill the room cannot fill a bedroom or office.
- Fix: Add a room type to Fill the room that picks the families it fills with.

### G-452: Desktop mode switch in the top bar

- Status: Open
- Origin: ADR-211, 2026-11-06; split from G-027 by the coordinator (conflicts with ADR-079)
- Missing: On desktop the Compose / Build & Preview switch is still its own row under the app bar (src/ui/App.tsx).
- Request: “Help with the sticky bars top and bottom, they occupy too much”.
- Questions: Move the desktop mode switch into the top bar, replacing ADR-079's "segmented control under the app bar"?
- Suggested pick: Move it into the top bar on desktop through a new ADR that replaces that ADR-079 sentence (estimate: effort +5 %, value +5 %).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: The desktop mode switch takes its own row.
- Fix: A new ADR moving the switch into the top bar on desktop.
- Conflicts: ADR-079: decided the mode control sits under the app bar.

### G-453: Lock a piece's insides

- Status: Open
- Origin: ADR-211, 2026-11-06; remainder of G-337 (its pick covers boards and construction only)
- Missing: A piece's insides (spaces, dividers, shelves, drawers, doors) cannot be locked against changes.
- Request: “Separate locks per parameter” (user 2026-11-04).
- Questions: Add a Lock insides toggle that refuses changes to the piece's spaces?
- Suggested pick: Add Lock insides beside Lock boards and Lock construction when a real project needs it (estimate: effort +15 %, value +5 %).
- Work: Medium
- Impact: Low
- Necessity: Low
- Issue: A piece's insides cannot be locked.
- Fix: A Lock insides toggle in More actions, refused like the other locks.
- Conflicts: none

### G-454: Versions of deleted projects with no project open

- Status: Open
- Origin: ADR-211, 2026-11-06; agent scoped it out (G-389's pick puts the list in History, inside an open project)
- Missing: With no project open (for example after deleting every project) the versions of deleted projects cannot be reached.
- Request: Accept default, /batch all ready (G-156: keep every version until the user deletes it).
- Questions: Also show the Versions of deleted projects list on the Projects page?
- Suggested pick: Show the same list, with Restore as a new project and Delete, under the Projects page's list (estimate: effort +4 %, value +3 %).
- Work: Low
- Impact: Low
- Necessity: Low
- Issue: Kept versions of deleted projects need an open project to be reached.
- Fix: The same list on the Projects page.

### G-460: Band tolerances and edgebander settings

- Status: Open
- Origin: ADR-212, 2026-11-06; agent scoped it out (remainder of G-038)
- Missing: No band tolerances (thickness or width deviation, overhang to trim) and no edgebander settings; ADR-212 takes over only the band-list CSV import and its decor match.
- Request: “Check the European standards for ABS, apply them accordingly”.
- Questions: Add fields for tolerances and edgebander settings, filled only from values you type or your band list holds?
- Suggested pick: Add them only as fields you fill, labelled guidance, nothing shipped (ADR-010). (estimate: effort +15%, value +5%)
- Work: Medium
- Impact: Low
- Necessity: Low
- Issue: Band tolerances and edgebander settings are not recorded anywhere.
- Fix: Add user-filled tolerance and edgebander fields to the band spec, labelled guidance (ADR-010).
- Conflicts: none

### G-461: Default L and U rooms give no Fill the room mix

- Status: Open
- Origin: ADR-193, 2026-11-06; agent found it while building (not caused by ADR-193)
- Missing: The default L room (3600 x 3000, cut 1500 x 1500) and the U room (offset 600) give no mix in Fill the room: Wall 2 has no stretch of 400 mm, then 'Every mix tried had a problem in the room (60 tried)'. Same with tallPosition left/right, so it predates ADR-193; the find-it uses Use this mix on the rectangle instead.
- Request: Not a quote: ADR-193 Done-when only asks 'Rectangle -> L shows 6 ticked walls'; the user's request was 'a critique of design ... high and medium issues and fixes per flow'.
- Questions: Should the default L and U rooms give mixes? Which problem blocks them (corner reservations on the 1500 mm walls, or a clash the model reports as an error)?
- Suggested pick: Find which error rejects every L/U mix (run suggestRoomMixes on the default L and list the error codes), then fix that cause in a new ADR so the default L and U rooms give cards. Closest to the user's wish for working flows. (estimate: effort +15% of ADR-193, value +10%)
- Work: Medium
- Impact: Medium

### G-462: Fill the room starts U and Alcove with an offset the size check rejects

- Status: Acknowledged (2026-11-06)
- Origin: ADR-193, 2026-11-06; agent kept the existing start value (no default invented)
- Missing: Fill the room starts with Cut offset 0. With ADR-193's size check (offset inside the room) a U or Alcove at offset 0 is named as an error on Next ('Cut offset must be a whole number of mm above 0.'), because at 0 a wall has no length and the outline folds back. The user must type an offset before a U or Alcove can go on.
- Request: Not a quote: ADR-193 item 2, 'cut and offset inside the room'; the start value was not part of the decision.
- Questions: Which start value should Cut offset have for U and Alcove (for example the Project room editor's 1000 mm, or centred: (width - cut width) / 2)?
- Suggested pick: Start Cut offset at the Project room editor's 1000 mm, so the default U and Alcove pass Next without typing; the same value the app already uses for a project's room. (estimate: effort +2% of ADR-193, value +5%)
- Work: Low
- Impact: Low-medium
- Fix: Keep the Cut offset start value at 0 (user 2026-11-06); the size check names it for U and Alcove until the user types a valid offset.

### G-463: Arrow keys choose a type in the wizard

- Status: Acknowledged (2026-11-06)
- Origin: ADR-194, 2026-11-06; built by the agent, choice not asked
- Missing: On the Type step the arrow keys move the focus between the type radios without choosing one; Space or Enter chooses. The WAI-ARIA radio pattern also checks the radio on arrow keys, but choosing a type drops the Size answers it cannot use and resets the steps (ADR-191), so arrowing past a type would lose answers.
- Request: ADR-194 item 7 (approved 2026-11-06): "the type radiogroup gets a roving tabindex with arrow keys"
- Questions: Should the arrow keys also choose the type they land on (WAI-ARIA radio pattern), accepting that passing a type drops answers it cannot use?
- Suggested pick: Keep focus-only arrows: closest to the request without losing answers while moving. (estimate: effort +0 %, value +0 %)
- Work: Low
- Impact: Low
- Necessity: Low
- Fix: Arrow keys only move focus between types; Space or Enter chooses (user 2026-11-06).

### G-464: Real-device AR check of ADR-208

- Status: Open
- Origin: ADR-208 tests, 2026-11-06; agent could not run it
- Missing: The real-device AR check was not done: View in AR on an Android phone and AR Quick Look (rel=ar from a blob URL) on an iPhone. AR was only tested with a stubbed navigator.xr in jsdom and Chromium.
- Request: Not asked in words; ADR-208 Done when lists the check on a real Android phone and an iPhone (user: 'Build only adrs 201-212').
- Questions: Can you open the live page on an Android phone and an iPhone and try View in AR and Export for AR (.usdz)?
- Suggested pick: You run the two device checks after the merge and tell Claude the result; Claude records it in N213. (estimate: effort +0 % for Claude, value +10 %: the only proof AR works)

### G-465: WebGPU render path not run on a real adapter

- Status: Open
- Origin: ADR-208 tests, 2026-11-06; agent could not run it
- Missing: The render check on the WebGPU path was not run: headless Chromium has no WebGPU adapter. Only the WebGL 2 path reached 8 samples at 390 and 1280 px; the switch to WebGPU is unit-tested with a stubbed navigator.gpu.
- Request: Not asked in words; ADR-208 Done when asks for 8 samples on both render engines.
- Questions: Can you run Render on a laptop or phone with WebGPU and report Engine: WebGPU and the sample count?
- Suggested pick: You run it once on a WebGPU device. (estimate: effort +0 % for Claude, value +4 %)

### G-466: find-it helper leaks Dexie data between widths

- Status: Open
- Origin: ADR-212 tests, 2026-11-06; agent found it
- Missing: tests/find-it/setup.tsx renderApp sets a fresh indexedDB, but Dexie keeps the first factory it saw (vi.resetModules does not reset node_modules), so saved data leaks between the 390 and 1280 px runs in one file, against ADR-108 (each run starts with empty storage). Two find-it files work around it in their own beforeEach.
- Request: Not asked; ADR-108 rule: each find-it run starts from the bare app.
- Questions: None; it is a test-helper bug. Other find-it tests may depend on the leaked data.
- Suggested pick: Set Dexie.dependencies.indexedDB to a fresh factory in renderApp, then fix any find-it test that relied on leftover data. (estimate: effort +4 %, value +3 %)

### G-467: Door near a corner is blocked by the neighbouring wall run

- Status: Open
- Origin: ADR-204 tests, 2026-11-06; agent found it
- Missing: In Fill the room, a door placed 100 mm from a corner is blocked by the neighbouring wall's run: a Blind corner base or a tall cabinet stands in its opening. freeStretches in src/core/roomfill.ts (ADR-173) frees a door's range only on the door's own wall. A fix needs a door swing depth, which is not known (ADR-010).
- Request: Not asked; found while testing ADR-204 (doors and windows in Fill the room, G-348).
- Questions: How deep a clear zone should a door keep on the neighbouring wall, in mm?
- Suggested pick: You give a swing depth (or say to use the door width); Claude frees that range on the neighbouring wall. (estimate: effort +6 %, value +6 %)

### G-468: removeChild error with a selected model in 3D Move mode

- Status: Open
- Origin: ADR-203 tests, 2026-11-06; agent found it
- Missing: With a 3D model selected in Move mode, the page logs NotFoundError: Failed to execute 'removeChild' on 'Node' when the 3D view opens or closes or Move is turned off. It may come from ResizeHandles in src/viewer/Viewer3D.tsx (ADR-102) rather than ADR-203; not proven. The app keeps working. tools/piece-safety/find-it.mjs 'no page errors' fails at 390 and 1280 px because of it.
- Request: Not asked; found while testing ADR-203 (G-105, models in 3D Move mode).
- Questions: None; it is a bug.
- Suggested pick: Reproduce with the piece-safety script, find which unmount removes the node twice, and fix it. (estimate: effort +5 %, value +5 %)

### G-469: Enter chooses the destructive button in two ADR-203 dialogs

- Status: Open
- Origin: ADR-203 tests, 2026-11-06; agent found it
- Missing: The shared confirm dialog focuses the non-default button, so Enter chooses 'Delete versions' (project delete) or 'Use the imported one' (template import) although ADR-203 makes 'Keep them' / 'Keep mine' the default (Esc and Keep delete nothing).
- Request: Not asked; ADR-203 Decision: Keep is the default and nothing is deleted without the user's explicit choice (ADR-012).
- Questions: Should Enter on these two dialogs choose the Keep button?
- Suggested pick: Focus the Keep button first in both dialogs, so Enter keeps. (estimate: effort +2 %, value +4 %)

### G-470: Client sheet: occasional second page and table at the page edge

- Status: Open
- Origin: ADR-206 tests, 2026-11-06; agent found it
- Missing: The client sheet (Parts > Client sheet) came out as 2 PDF pages on one run; every later run gave 1 page; cause not found. Also, in the 390 px PDF the sheet's table reaches the right page edge.
- Request: Not asked; ADR-206 Done when says the client sheet prints one A4 page.
- Questions: None; it is a bug.
- Suggested pick: Reproduce with tools/prints-exports/find-it.mjs on repeated runs, find the layout race (the sheet prints 50 ms after it is asked for), and give the table a page margin. (estimate: effort +4 %, value +4 %)

### G-471: Catalog page is taller than the 15000 px script limit

- Status: Open
- Origin: ADR-201 tests, 2026-11-06; agent found it
- Missing: tools/catalog-compact/find-it.mjs 'Catalog page under 15000 px tall' fails: the catalog page is 15198 px tall at 1280 px (it failed before ADR-201 too). The limit was not changed because it is a user decision.
- Request: Not asked; the script's own limit.
- Questions: Raise the limit to 16000 px, or shorten the catalog page?
- Suggested pick: Raise the limit to the current height plus a margin and record it, since the page grows with the catalog. (estimate: effort +1 %, value +1 %)

### G-472: Core-only test selection: saving unproven

- Status: Open
- Origin: ADR-201 tests, 2026-11-06; agent found it
- Missing: G-368 (CI runs only related tests on core-only PRs) is unproven: no CI run id exists for a core-only PR, and for widely imported core files the saving can be under 10 % (src/core/sizeLock.ts selects 136 of 151 test files; shareCode.ts selects 45). ADR-201 says to ask the user when the saving is under 10 %.
- Request: Not asked in words; ADR-201 Decision for G-368: measure, and ask the user if the saving is under 10 %.
- Questions: Keep the core-only selection (it saves little for widely imported files), or drop it and keep the full suite on every PR?
- Suggested pick: Keep it: it saves 70 to 90 % on narrow core changes and costs nothing otherwise. Record a CI run id once a core-only PR runs. (estimate: effort +0 %, value +3 %)
