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

- Status: Open
- Origin: ADR-048, 2026-10-24 06:54 UTC; agent scoped it out
- Missing: Front-view carcass panels already show the board picture; still plain colour or outline: door/drawer fronts in the front view, the front-view SVG download (patterns stripped, src/ui/shell/files.ts:31), catalog snapshots (src/core/snapshot.ts:273,312), the plan and cut sheets.
- Request: “Render the furniture according to the selected material's color and structure”, then “any image as color/background for the material”.
- Questions: Fill which drawings with the picture: plan, front view, SVG download, catalog pictures, cut sheets?
- Suggested pick: Fill every 2D drawing with the picture as an SVG <pattern> (the data URL is already stored), rotated with the grain. Fill fronts in the front view. Use the same fill in catalog snapshots and the SVG download. Cut sheets keep a light tint, for legibility when printed. (estimate: effort +30%, value +25%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): text partly wrong. The front view already fills carcass panels with the picture, rotated with the grain (src/ui/Elevation.tsx:51-61, :147-164, since 009173a). Still plain colour: fronts in the front view (outlines), the SVG download (patterns stripped, src/ui/shell/files.ts:30-34), catalog snapshots (src/core/snapshot.ts:266), the plan and cut sheets.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-003: Materials fields overlap at 375 px

- Status: Open
- Origin: ADR-048, 2026-10-24 08:27 UTC; agent scoped it out
- Missing: At phone width the Materials row (Dialogs.tsx:362-390) collapses to a 36px 1fr grid (styles.css:2670-2672), so "Thickness" likely overlaps "Has grain"; not checked in a browser.
- Request: Phone-first (CLAUDE.md: no overlap or sideways scroll at 390 px) (context, not a quote)
- Questions: None; it is a bug.
- Suggested pick: Re-check at 375 px and fix the field grid. It is a bug, not a choice. (estimate: effort +1%, value +3%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still likely (not checked in a browser): the phone materials row is 36px 1fr (src/styles.css:2333-2335). Materials now lives in the Settings dialog (ADR-080, src/ui/Settings.tsx), not inline.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-004: Oxlint as in reserv

- Status: Open
- Origin: ADR-053, 2026-10-24 15:25 UTC; agent scoped it out
- Missing: Linting stayed on ESLint; reserv uses oxlint.
- Request: “All three”: ADR format, skills and CI the same as reserv.
- Questions: Switch to oxlint now, or keep ESLint on purpose (then acknowledge)?
- Suggested pick: Switch to oxlint with reserv's config, and keep ESLint only for any rule oxlint lacks. (estimate: effort +5%, value +5%)

### G-005: Fusion export never run in Fusion

- Status: Open
- Origin: ADR-021, 2026-10-24 15:37 UTC; blocked by the environment
- Missing: The Fusion 360 export has never been run inside Fusion (N03).
- Request: Export to Fusion 360 (context, not a quote)
- Questions: Can you run the script once in Fusion 360 on two sample designs?
- Suggested pick: You run the script once in Fusion on two sample designs. Claude adds a checklist of what to compare (part count, sizes, names). (estimate: effort +2%, value +15%)

### G-006: Server-only research features

- Status: Open
- Origin: Research, 2026-10-24 15:37 UTC; user decision
- Missing: Personal codes are built (design codes ADR-124, account storage ADR-137, share links ADR-138) and ADR-126 now allows opt-in online features; online model libraries and a live cross-brand catalogue are still not built.
- Request: Research features (context, not a quote)
- Questions: Keep ruled out by ADR-002 (acknowledge), or open a new ADR to change ADR-002?
- Suggested pick: Keep these out unless you decide to change ADR-002. It is listed here only so you know they are not available.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-007: Connector engine and stored connections

- Status: Open
- Origin: Research, 2026-10-24 15:42 UTC; agent default, accepted by the user
- Missing: Compatibility rules are built (ADR-100); stored connections between pieces, semantic connectors, an assembly graph and connector authoring are still not built (see G-091, G-092).
- Request: “Verify, then Quick wins, then Medium effort”; later “guided snapping” and “cross-family composition”.
- Questions: Write one ADR for stored connections between pieces (side by side, on top, in corner, against wall)?
- Suggested pick: One ADR for stored connections between pieces (side by side, on top, in corner, against wall). Snap, Mirror a run, run parts and Merge would all read them, so pieces move together and the plan explains why. (estimate: effort +60%, value +35%)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-008: AR, plan review, shared structural elements

- Status: Open
- Origin: Research, 2026-10-24 15:42 UTC; agent default, accepted by the user
- Missing: A professional review pack (ADR-121) and common top/bottom panels (ADR-165) exist; AR placement and shared side panels between pieces are still not built.
- Request: Features from the competitor research (context, not a quote)
- Questions: Which first: WebXR AR, a review pack, or shared side panels?
- Suggested pick: AR: WebXR with the existing three.js scene (Android Chrome, offline, no new service), plus a USDZ export for iPhone Quick Look. Review: a “review pack” of print sheets plus the design file. Shared elements: one shared side panel between touching cabinets, building on ADR-047. (estimate: effort +50%, value +20%)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-009: Supplier feeds and ordering

- Status: Open
- Origin: ADR-063, 2026-10-24 15:51 UTC; user decision
- Missing: A bundled seller catalog with prices exists (ADR-161); supplier price-file import maps, order files, live feeds, stock and ordering are not built (ADR-063 Deferred; ADR-126 now permits opt-in online).
- Request: “Put to pending any that require non-free services”.
- Questions: Build the offline step (supplier price-file column maps and order files)? Which suppliers first?
- Suggested pick: An offline middle step that needs no service: a column map for each supplier's own price-list file (Egger, Kronospan, Kastamonu, Fundermax) into the ADR-062 price list, and an order file per supplier from the shopping list. This covers most of the value with no backend. (estimate: effort +25%, value +40% of what live feeds give)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-010: Worktop joints and corner runs

- Status: Open
- Origin: ADR-054, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: No worktop joints and no corner runs. Out of scope.
- Request: Kitchen runs with plinth, filler, sink front (context, not a quote)
- Questions: Mitred or butt joint as the default? Corner runs first?
- Suggested pick: Corner runs: an L run where the worktop is mitred or butt-jointed (the user picks), with the joint drawn on the plan and listed in the cut list. Corner cabinets already exist (ADR-025). (estimate: effort +40%, value +30%)

### G-011: Handle projection and exact swing arcs in the check

- Status: Open
- Origin: ADR-057, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: No handle projection; door swings are not exact arcs in the check (drawn arcs were fixed, the check still uses a box).
- Request: Opening clearance for doors, drawers, flaps (context, not a quote)
- Questions: Use the handle depth from the handle schedule and the real arc on the hinge side?
- Suggested pick: Check the real quarter-circle on the hinge side plus the handle depth from the handle schedule (ADR-024). This also unblocks the ADR-071 “reverse the hinge” repair. (estimate: effort +25%, value +20%)

### G-012: Angled walls and plan tracing

- Status: Open
- Origin: ADR-058/059, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: No angled walls, no tracing over a picture of a plan.
- Request: Room and floor plan (context, not a quote)
- Questions: Tracing over a picture now? Angled walls need a new ADR against ADR-003/004; wanted?
- Suggested pick: Tracing: put a picture of your plan under the drawing at a scale you set from one known wall, then draw over it. Angled walls clash with ADR-003/004 (axis-aligned) and would need a new ADR; ask first. (estimate: effort +20% (tracing), value +15%)

### G-014: Undo across reloads and in the library

- Status: Open
- Origin: ADR-051, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: Restorable project versions exist (ADR-123), but the undo stack is still lost on reload and deleting saved projects/designs on the Projects page has no undo or Recently deleted list.
- Request: Undo and redo for project changes (context, not a quote)
- Questions: Keep undo per project on the device? A 30-day Recently deleted list for the library?
- Suggested pick: Keep the undo stack per project in IndexedDB (new Dexie version). Make library deletes go to a 30-day “Recently deleted” list instead of being final. (estimate: effort +20%, value +15%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still valid; the library is now the Projects page (ADR-078). Dexie v8 has no undo table and there is no Recently deleted list.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-015: Egger catalogue import

- Status: Open
- Origin: Catalog, 2026-10-24 17:15 UTC; blocked by the environment
- Missing: The Egger catalogue import is not done: the pack has no thickness or colour, and egger.com is blocked.
- Request: “Use this to fill in Egger catalogue”.
- Questions: Which thicknesses per board type (for example PAL 18 / 25 mm) should the 276 rows get?
- Suggested pick: Import the 276 rows now with code, name and type. Take thickness from one list you confirm (for example, PAL 18 / 25 mm) and leave colour to the pictures you add. Nothing invented (ADR-010). (estimate: effort +10%, value +30%)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Egger boards with thickness and pictures are now pickable through the bundled Regency seller catalog (ADR-161, ADR-162; src/core/sellers/regency.json); the 276-row pack itself is not imported. May be obsolete; the user decides.

### G-016: Export blocking never tried in a browser

- Status: Open
- Origin: ADR-062/064, 2026-10-24 17:52 UTC; agent scoped it out
- Missing: Not checked by any find-it: the blocked-export message (src/ui/Output.tsx:140-146) and the blocked Shopping list CSV and Print (src/ui/Shopping.tsx:202-279).
- Request: Errors block export (ADR-008) (context, not a quote)
- Questions: None; add the find-it step.
- Suggested pick: Add a find-it step: make an error, check that CSV and Print are disabled, and that the message says why. (estimate: effort +2%, value +5%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. tools/editor-modes/find-it.mjs:202-216 checks CSV and Print are disabled on an error and tools/edge-band/find-it.mjs:218-221 checks CSV is blocked (both pass per N88). Not checked: the message saying why (src/ui/Output.tsx:139), and that the Shopping list CSV and Print are blocked.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-020: Appliances, sinks, edge profiles, client sheet

- Status: Open
- Origin: ADR-067/068, 2026-10-24 19:55 UTC; agent default, accepted by the user
- Missing: Remaining: a client sheet with render and price, worktop edge profiles, bundled CC0 appliance models.
- Request: “To sell designed kitchens”.
- Questions: Client sheet first? Which licence for bundled appliance models (CC0)?
- Suggested pick: Client sheet: one printable page with the PNG render, the piece list and the ADR-062 price. Appliances come through ADR-076 imports plus a few CC0 models once you pick that licence. Edge profiles: three profile choices drawn on the worktop. (estimate: effort +45%, value +40%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. Appliances and sinks can be imported as .glb (ADR-076); appliance niches (ADR-036) and a sink base exist. Remaining: client sheet, worktop edge profiles, bundled CC0 models (licence question).
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-021: Blender / glTF export

- Status: Open
- Origin: ADR-068, 2026-10-24 19:55 UTC; agent default, accepted by the user
- Missing: No Blender or glTF export.
- Request: High-quality renders (context, not a quote)
- Questions: Add Export scene (.glb) with three.js GLTFExporter?
- Suggested pick: three.js already ships GLTFExporter, so no new dependency: “Export scene (.glb)” with materials and pictures, ready for Blender. (estimate: effort +10%, value +15%)

### G-022: Render not checked on a laptop GPU

- Status: Open
- Origin: ADR-067/068, 2026-10-24 20:43 UTC; blocked by the environment
- Missing: Remaining: three-gpu-pathtracer still pinned at 0.0.27 on WebGL; no WebGPU path-tracer ADR.
- Request: Laptop, preview quality (context, not a quote)
- Questions: Can you run the render once on your laptop? Plan the WebGPU path-tracer upgrade?
- Suggested pick: Run the full render find-it on a machine with a GPU. Write an ADR for the WebGPU path-tracer upgrade before the WebGL build stops working. (estimate: effort +5%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved per documents: ADR-068 records the user's full 256/256 render and Save PNG on a laptop; N88 ran the scripted full render and Save PNG at 1280 px and 18/18 at 390 px. Remaining: three-gpu-pathtracer still pinned at 0.0.27 on WebGL, no WebGPU ADR.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-025: Cross-family composition and room presets

- Status: Open
- Origin: Research, 2026-10-24 21:28 UTC; agent scoped it out
- Missing: Fill a wall (ADR-103/104) places a kitchen mix on one wall; there are still no built-in room presets (kitchen / wardrobe / desk) that place several pieces, and a kitchen run plus a desk in one project is unchecked.
- Request: The 14 features you selected at 21:28 (context, not a quote)
- Questions: Check each against the app and write ADRs for what is missing?
- Suggested pick: Check each against the app with find-it. Write an ADR for whatever is missing (likely: one project mixing a kitchen run with a desk, and room presets that place several pieces at once). (estimate: effort +30%, value +20%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved; text partly wrong. Cross-family composition was already checked (N48, tools/ensemble/find-it.mjs: base cabinet + wardrobe + daybed). Remaining: built-in room presets that place several pieces; a kitchen run plus a desk in one project not checked.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-027: Bottom sheet drag, mode bar, old find-it scripts

- Status: Open
- Origin: ADR-079, 2026-10-24 23:07 UTC; agent scoped it out
- Missing: Remaining: the phone bottom sheet opens only by tap (App.tsx:746-757, no drag); on desktop the Compose / Build & Preview switch is still its own row (App.tsx:687-708).
- Request: “Help with the sticky bars top and bottom, they occupy too much”.
- Questions: Three stops for the sheet (peek, half, full)? Mode switch in the top bar on desktop?
- Suggested pick: Drag handle with three stops (peek, half, full). Move the mode switch into the top bar on desktop. Update the old scripts so every earlier feature is found again in the new shell. (estimate: effort +25%, value +25%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. The old find-it scripts were fixed (N88, G-060 Done). Remaining: the phone sheet still opens only by tap (src/ui/App.tsx:673-681); the desktop mode switch is still its own row.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-028: Mobila sample files still in the repo

- Status: Open
- Origin: D02, 2026-10-24 23:15 UTC; agent default, accepted by the user
- Missing: “Built in the app” is gone from the screens, but the Mobila sample files stay in docs/samples/ and the tests. The question was asked and never answered.
- Request: “Remove completely the Built in the app feature”.
- Questions: Delete the files too, keeping only the test fixtures ADR-041 needs?
- Suggested pick: Read literally, “completely” means the files too. Move the samples ADR-041's tests need into tests/fixtures/ and delete the rest. Your call. (estimate: effort +3%, value matches your words)

### G-030: Back cut-outs over pipes and outlets

- Status: Open
- Origin: ADR-072, 2026-10-24 23:58 UTC; agent scoped it out
- Missing: Remaining: a shaped back panel with a cut-out over a pipe or outlet, electrical rules, and a test for a worktop or plinth over a pipe.
- Request: Pipes and outlets checked against the pieces (context, not a quote)
- Questions: Cut the back as a shaped part at the zone? Templates carry room features?
- Suggested pick: Make the back a shaped part with a rectangular cut-out at the zone (ADR-040 already does shaped parts), listed on the cut list and printed sheet. Templates carry room features. Add the missing test. (estimate: effort +35%, value +30%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): text partly wrong: templates already keep pipes and outlets when the room is included (src/core/projectTemplate.ts:97, :203), untested. Remaining: shaped back with a cut-out, electrical rules, the worktop/plinth-over-pipe test.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-031: ADR-072 defaults unconfirmed

- Status: Open
- Origin: ADR-072, 2026-10-24 23:58 UTC; agent default, accepted by the user
- Missing: Unconfirmed defaults: a tall unit is 1,600 mm or more; a zone reaches 50 mm from the wall.
- Request: Pipes and outlets checked against the pieces (context, not a quote)
- Questions: Is a tall unit 1,600 mm or more? Does a zone reach 50 mm from the wall?
- Suggested pick: Confirm them, or give your values. (estimate: effort 0%, value needs you)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): the Origin says accepted by the user, but the two questions were never answered (no answer in product-context.md). Code still uses TALL_UNIT_HEIGHT=1600 and NEAR_WALL=50 (src/core/room.ts).

### G-032: Multi-select, fixed-hand mirroring, 1 mm drift

- Status: Open
- Origin: ADR-069, 2026-10-25 00:01 UTC; agent scoped it out
- Missing: Multi-select and groups are built (ADR-097, ADR-159); remaining: the lounger backrest and daybed side panel cannot be mirrored (arrange.ts:131-135), and mirrored pieces may be ±1 mm off.
- Request: “Duplicate, mirror and predictable rotate operations”.
- Questions: Store a hand side on the lounger and daybed? Symmetric rounding for mirrored copies? Multi-select gesture?
- Suggested pick: Store a hand (left or right) on those two pieces so they mirror. Use symmetric rounding for mirrored copies so they match to the mm. Add multi-select (Shift-click or long-press) for duplicate, mirror and move together. (estimate: effort +40%, value +30%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still valid. Absorbs G-013 (Save selection as template), which needs multi-select.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-033: Snapping in the front view and 3D

- Status: Open
- Origin: ADR-070, 2026-10-25 00:07 UTC; agent scoped it out
- Missing: Remaining: no snapping in the front view (e.g. worktop or wall-unit lines), and snaps are not stored.
- Request: “Guided snapping”.
- Questions: Front-view height snaps first (worktop line, wall-unit line)?
- Suggested pick: Front-view snapping to heights (worktop line, wall-unit line), using the same rules. Stored snaps come from the connections ADR above. Add the hint to find-it. (estimate: effort +30%, value +20%)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-034: Hinge repair, filler repair, 3D preview

- Status: Open
- Origin: ADR-071, 2026-10-25 00:10 UTC; agent default, accepted by the user
- Missing: No “Reverse the hinge” repair. The filler repair shows only with automatic refresh off. No outline or preview in 3D.
- Request: “Explainable warnings with repairs”.
- Questions: Clearance follows the hinge side (needs G-011), or drop the hinge repair?
- Suggested pick: Make the clearance follow the hinge side (see the ADR-057 row), then offer the hinge repair. Let a repair add a filler that automatic refresh keeps. Draw the problem box and the dashed preview in 3D. (estimate: effort +35%, value +30%)

### G-035: Mouldings, sink and hob cut-outs, templates

- Status: Open
- Origin: ADR-075, 2026-10-25 00:13 UTC; agent scoped it out
- Missing: Sink cut-outs exist (ADR-125); remaining: profiled mouldings, hob cut-outs, templates keeping requested trims/worktops (runRequests), and a browser check of the ceiling filler.
- Request: “Shared worktops”, “fillers, plinths, end panels and trim”, for kitchens.
- Questions: Cut-outs from sizes you enter? Templates carry run requests?
- Suggested pick: Sink and hob cut-outs on the worktop from sizes you enter (no invented appliance sizes), on the cut list and the print. Templates carry run requests. Add a ceiling filler to find-it. (estimate: effort +35%, value +30%)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-036: Clearance zones in 3D and templates

- Status: Open
- Origin: ADR-073, 2026-10-25 00:14 UTC; agent scoped it out
- Missing: Clearance zones are not drawn in 3D and are not saved in templates. No separate installation zone on the plan.
- Request: “Collision and clearance”.
- Questions: Draw zones as translucent volumes in 3D? Draw the installation arc on the plan?
- Suggested pick: Draw zones as translucent volumes in 3D, with the same toggle. Draw the installation zone (tilt-up arc) on the plan. Templates carry zones. (estimate: effort +25%, value +20%)

### G-037: Chair depth and service sizes

- Status: Open
- Origin: ADR-073, 2026-10-25 00:14 UTC; agent default, accepted by the user
- Missing: No chair depth or service-zone sizes: you enter them each time.
- Request: “Collision and clearance”.
- Questions: What chair depth and service-zone sizes do you use?
- Suggested pick: Give your usual values once and they become per-project defaults. (estimate: effort 0%, value needs you)

### G-038: Band-list import and colour matching

- Status: Open
- Origin: ADR-077, 2026-10-25 00:15 UTC; agent scoped it out
- Missing: Bands from the bundled seller catalog are matched to the board decor code (ADR-161); remaining: importing a supplier band list as CSV, tolerances and edgebander settings.
- Request: “Check the European standards for ABS, apply them accordingly”.
- Questions: Import a supplier band list as CSV and match bands to the board decor?
- Suggested pick: No EN standard sets band sizes; that finding stands. Closer: import a band list (CSV, like decors) and match the band to the board's decor code and picture. (estimate: effort +20%, value +20%)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-039: ADR-077 open decisions

- Status: Open
- Origin: ADR-077, 2026-10-25 00:15 UTC; agent default, accepted by the user
- Missing: Open: carry over the old per-board banding prices? Preset thickness list or typed only? The allowance is stored per band, not per board.
- Request: “Check the European standards for ABS, apply them accordingly”.
- Questions: Carry over old banding prices? Keep the preset thickness list? Allowance per band?
- Suggested pick: Recommended (closest to the request): keep the preset list (the common supplier sizes you asked to apply), carry over prices, allowance per band (that is how edgebanders work). Confirm. (estimate: effort +5%, value +10%)

### G-040: 3D model placement and templates

- Status: Open
- Origin: ADR-076, 2026-10-25 00:16 UTC; agent scoped it out
- Missing: Imported models can't be dragged, hung on a wall or put on another piece. Templates don't keep them. Nothing is bundled.
- Request: “Import 3D models and model libraries”.
- Questions: Floor, wall and on-a-piece placement with drag and snap? Bundle CC0 models?
- Suggested pick: Give models the same placement (floor, wall, on a piece) and drag or snap as pieces. Templates carry them. For “libraries”: a small bundled set of CC0 models (fridge, oven, sink, hob) once you agree that licence. (estimate: effort +35%, value +35%)

### G-041: ADR-076 models list

- Status: Open
- Origin: ADR-076, 2026-10-25 00:16 UTC; agent default, accepted by the user
- Missing: Models are stored in a separate Project.models list, not on project items as the ADR says.
- Request: “Import 3D models and model libraries”.
- Questions: Keep the separate Project.models list and write it into the ADR?
- Suggested pick: Keep it (it lets one model be used many times), but write it into the ADR before shipping. Confirm. (estimate: effort 0%, value needs you)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): ADR-076 is already Implemented, so the suggested pick (write it into the ADR before shipping) can no longer be done; record the answer here or in a new small ADR. Code uses Project.models (src/core/project.ts:159).

### G-042: Project fasteners panel and Romanian labels

- Status: Open
- Origin: ADR-074, 2026-10-25 00:16 UTC; agent scoped it out
- Missing: Remaining: Fasteners in the project's own Settings dialog (Settings.tsx:62-71), fastener lines and footer of the shopping CSV in the print language (shopping.ts:51-53, 288-318 use t(), not pt()), drilling patterns.
- Request: “Hardware and fastener completeness”.
- Questions: Add the project-level panel? Draw drilling positions only from your values?
- Suggested pick: Add the project-level panel. Translate the fastener labels (a bug). Draw drilling positions only from the values you enter, labelled as guidance (ADR-010). (estimate: effort +30%, value +25%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. A piece's Fasteners panel is reachable from a project via Inside this piece › Size, boards and construction (ADR-090). Remaining: Fasteners in the project's own Settings dialog; the Romanian shopping CSV still writes fastener lines and footer in English (src/core/fasteners.ts, src/core/shopping.ts:32-33); drilling patterns.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-043: Duplicate backlog id D02

- Status: Open
- Origin: Backlog, 2026-10-25 06:52 UTC; agent scoped it out
- Missing: Two backlog rows share the id D02: ADR-029, and “Built in the app”. Still not fixed on main.
- Request: Ids are never renumbered (CLAUDE.md) (context, not a quote)
- Questions: Renumber the later row to D03? (Ids are never renumbered, so this needs your decision.)
- Suggested pick: Give the later row (“Built in the app”) D03 and fix every reference. (estimate: effort +1%, value bookkeeping)

### G-044: Catalog feed and brand filter

- Status: Open
- Origin: ADR-029/052/027, 2026-10-25 06:52 UTC; user decision
- Missing: Feed (N16) and brand filter (N14) not built (user: won't do); note the Brands tab still promises "The weekly catalog feed … adds them" (Catalog.tsx:618).
- Request: “Mark 029 as won't do”.
- Questions: Feed the brand filter from your decor imports instead of IKEA (new ADR)?
- Suggested pick: The brand filter could be fed by your Egger / Kronospan decor imports (by manufacturer) instead of IKEA. It would need a new ADR replacing ADR-027's IKEA dependency. (estimate: effort +15%, value +15%)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-045: ADR-069 to 079 shipped with open gaps

- Status: Open
- Origin: ADR-069..079, 2026-10-25 10:25 UTC; agent scoped it out
- Missing: Eleven ADRs were shipped (N64 to N74 Done) with the gaps above still open and their open questions unanswered. Find-it was not re-run after the merge, and nothing was checked on the live site.
- Request: “Merge all mergeable, push, list what is left”.
- Questions: Re-run every find-it on main? Answer the open questions above?
- Suggested pick: Re-run every find-it script on the production build of main. Answer the open questions above. Then open one follow-up ADR per group of gaps, so the gaps are tracked and not lost behind Done. (estimate: effort +10%, value +15%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved per N88: every find-it script passed on a local production build after merging main. Remaining: the open questions in G-027 and G-030 to G-042, follow-up ADRs, the live check (G-047).

### G-047: Nothing live-verified

- Status: Open
- Origin: Verification, all sessions; blocked by the environment
- Missing: Nothing has been live-verified: the deployed site, a real phone and a screen reader were never checked. github.io is refused by this environment.
- Request: “R1: evidence from the running app the user will use”.
- Questions: Allow chiriacsergiucs-v2.github.io in the environment network policy? Run the phone and screen-reader check together?
- Suggested pick: Allow chiriacsergiucs-v2.github.io in this environment's network policy, so the find-it scripts can run against the live URL. Phone and screen-reader checks need you, about 15 minutes with a short script Claude writes. (estimate: effort +5%, value +20%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still valid (github.io unreachable from this environment). Absorbs G-048: touch and 3D were checked only in Chromium emulation; one guided session on the user's phone covers both.

### G-049: G ids on pre-ADR-082 notes

- Status: Open
- Origin: ADR-082, 2026-10-25; agent scoped it out
- Missing: Backlog notes and ADRs written before ADR-082 do not cite G ids; the seed G-001 to G-048 covers their gaps, but the old text does not link to it.
- Request: “Configure the project so everytime something is "not implemented" it is being saved into adrs folder into "Gaps"”
- Questions: Add G ids to the old backlog Gap notes and Open questions too?
- Suggested pick: Yes: one pass adding the matching G id next to each old Gap note and open question, so every gap is findable from both sides (estimate: effort +15%, value +10%)

### G-053: Step back up one level without the breadcrumb

- Status: Open
- Origin: ADR-083, 2026-10-25, out of scope (Claude)
- Missing: Going one level back up with a gesture (Esc / long press)
- Request: The flow of selecting the furniture, then the middle (given there are 2 dividers), then having a horizontal divider, then selecting the bottom one to adjust shelves is a painful horrible user experience. Adjust the selecting to go from bigger to smaller. 1 click = entire furniture, second click selects the smaller frame, third again the smaller within, iteratively.
- Questions: Is a 'go up one level' gesture wanted besides the breadcrumb?
- Suggested pick: Esc on desktop goes up one level; estimate +5 % work

### G-055: Count stepper only for cabinet spaces

- Status: Acknowledged (2026-10-25)
- Origin: ADR-084, 2026-10-25; agent scoped it out
- Missing: Products without spaces (frame, panel set, single panel) and project-plan items get no stepper; desk pedestals and corner wings get it through their cabinet spaces only.
- Request: “Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber - … Placement: above the selected piece”
- Questions: Which counts outside cabinet spaces should step (e.g. frame slats, panel-set copies, desk pedestals)?
- Suggested pick: Name the ones you use; each is a small add once the stepper exists (estimate per family: effort +10%, value +5%)

### G-056: Which bay the divider stepper adds or removes

- Status: Open
- Origin: ADR-084, 2026-10-25; agent scoped it out
- Missing: Still unconfirmed: + adds an empty bay at the end (ADR-089) and − removes the last bay (counts.ts:97-109) rather than next to the selection.
- Request: “Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber - … Placement: above the selected piece”
- Questions: Where does + add and - remove: at the end, or next to the selected bay? What goes in a new bay: empty, or a copy of its neighbour?
- Suggested pick: End, with 2 shelves like the existing Add button (consistent with what the app does today; next-to-selection is estimated +15% effort for +5% value)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved; text out of date. ADR-089 decided a new bay is empty (src/core/counts.ts:89-99), so the 2-shelves default is gone, and ADR-086 changed what + acts on. Still unconfirmed: whether + adds at the end or next to the selection, and what - removes.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-073: UI critique findings 8, 9 and 12 left as they are

- Status: Open
- Origin: UI critique follow-up 2026-10-26 (N87); user decision for 8 and 9, ADR-033 for 12
- Missing: Finding 8 (desktop Build & Preview only swaps the centre view; the left panel stays Compose), finding 9 (whole-piece editing split across the Quick counts card, Settings and 'Edit the interior') and finding 12 (Romanian family and variant names under the English ones in the catalog and Start from, ADR-033)
- Request: Findings 8 + 9: 'Skip 8 and 9'. Finding 12: no request; the names are ADR-033's decision.
- Questions: Write an ADR for 8 and 9 later? Keep the Romanian names (ADR-033) or show them only in search?
- Suggested pick: Keep 12 as ADR-033 decided (no change); for 8 and 9, an ADR when you want the editor layout revisited (closest to the critique; est. +40 % work over a small fix, +60 % of 8/9 value)

### G-074: Remember whether the results panel was open across reloads

- Status: Acknowledged (2026-10-26)
- Origin: ADR-091 out of scope
- Missing: The results panel always starts collapsed after a reload; its open/closed state and tab are not saved
- Request: They should be a collapsed view, onclick showing only, so the views with renders are kept as main
- Questions: Should the app remember an open results panel after a reload?
- Suggested pick: No: always start collapsed, closest to 'collapsed view, onclick showing only'
- Answer: User 2026-10-26: "Always collapsed".

### G-076: Research app records go stale as ADRs ship

- Status: Open
- Origin: ADR-092 (2026-10-26, Claude: not asked for)
- Missing: The research app records (src/core/research/ensemble-2026-10-23.app.ts) are refreshed only by one-off re-check ADRs (ADR-149, ADR-152); ship-adr/next-adr still do not update them when an ADR ships.
- Request: Text that is not a quote: follows from "mark implemented ones" (2026-10-26).
- Questions: Should ship-adr update the research app record of the feature an ADR names, or should the research page be re-checked on request only?
- Suggested pick: ship-adr updates the record (closest to keeping 'implemented' marked; about +5 % work per shipped ADR, +100 % of the freshness value; estimates).
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-079: Drop a catalog item into the 3D view

- Status: Open
- Origin: ADR-094 (2026-10-26, Claude: not asked for)
- Missing: Dropping a catalog item into the 3D view.
- Request: "New adr 6" (2026-10-26)
- Questions: Drop into 3D too, once ADR-093 exists?
- Suggested pick: Drop onto the 3D floor plane with ADR-093's projection (about +30 % of ADR-094's work, +15 % value; estimates).

### G-092: User-written compatibility rules

- Status: Open
- Origin: ADR-100 (2026-10-26, Claude: not asked for)
- Missing: Rules the user writes or edits.
- Request: "New adr 3" (2026-10-26)
- Questions: Let users add or edit compatibility rules?
- Suggested pick: Not yet; the rule list is shown read-only (editing rules needs a rule editor, about 25 points).

### G-094: Stop hook not yet observed in a live session

- Status: Open
- Origin: ADR-082, 2026-10-26; the Stop hook was tested with sample inputs only (Done when), not observed in a live Claude Code session
- Missing: Evidence that the Stop hook in .claude/settings.json fires and asks once in a real Claude Code session (a worker subagent gets SubagentStop, not Stop, so it could not observe it)
- Request: “How to configure to have it always up to date? Hook?”
- Questions: Should someone end a real top-level session with a reply that lists skipped items and confirm the hook asks once?
- Suggested pick: Yes: one manual check in the next top-level session that ends with a Skipped this iteration list (estimate: effort +2%, value +10% of the hook's request)

### G-095: Catalog counts agreement unconfirmed

- Status: Open
- Origin: Gap re-check 2026-10-26 (G-059); agent found it
- Missing: The 'N ready items' label (src/ui/Catalog.tsx:236) exists, but no check (find-it or browser) has confirmed the total equals the sum of the category counts at 390 and 1280 px.
- Request: Run critique this design for the entire ui/ux; then 'Fix them directly' (G-059)
- Questions: None; it is a check.
- Suggested pick: Add a find-it step that compares the catalog total with the sum of its category counts at 390 and 1280 px; fix if they differ. (estimate: effort +2%, value +3%)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-096: Empty Brands list promises a cancelled feed

- Status: Open
- Origin: Gap re-check 2026-10-26 (G-044); agent found it
- Missing: Same text, now at src/ui/Catalog.tsx:618 (Russian entry src/core/i18n/ru/catalog.ts:47).
- Request: Catalog feed and brand filter (G-044) (context, not a quote)
- Questions: Replace the text with how brand products get in today (import), or hide the Brands source while it is empty?
- Suggested pick: Replace the text with what is true now: no brand products are bundled; import your own. Closest to the current app; no new feature. (estimate: effort +1%, value +3%)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-097: Fastener notes point to a removed screen

- Status: Open
- Origin: Gap re-check 2026-10-26 (G-042); agent found it
- Missing: Shopping footer (src/core/shopping.ts:52) and fastener guidance (src/core/fasteners.ts:312), plus their Russian entries (src/core/i18n/ru/core2.ts:334,421), still point to 'Materials › Fasteners'.
- Request: Hardware and fastener completeness (G-042) (context, not a quote)
- Questions: None; it is a wording bug. Fix together with the Romanian labels in G-042?
- Suggested pick: Point both to the current path (Settings › Fasteners, or the piece's Size, boards and construction), and translate them in the Romanian CSV with G-042. (estimate: effort +1%, value +3%)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-099: Group gaps by origin

- Status: Open
- Origin: ADR-101, 2026-10-26; user did not pick it
- Missing: The gaps page has no grouping by origin (the ADR or area a gap came from).
- Request: “Add a gaps page, similar to reseaech” — offered options: Search + status filter, Group by origin, Overview counts, Full detail per gap
- Questions: Add grouping by origin later?
- Suggested pick: Leave it out (the user picked the other three); the search finds an ADR id in the Origin field. (estimate for grouping: effort +10%, value +5%)

### G-100: Gap marks not in a file

- Status: Open
- Origin: ADR-101, 2026-10-26; agent scoped it out
- Missing: Marks made on the gaps page cannot be exported or imported as a file; they live on one device. Copy decisions is the only way out.
- Request: “Mark + hand to Claude”
- Questions: Export and import the marks as a file, like research marks?
- Suggested pick: Export / import a JSON of marks, like Research's Import & export (estimate: effort +10%, value +5%)

### G-101: Ledger not editable from the app

- Status: Open
- Origin: ADR-101, 2026-10-26; ADR-002 (no backend, no tokens)
- Missing: The page cannot write docs/adr/GAPS.md; decisions go through Copy decisions. (ADR-126 now permits opt-in online features, so 'while ADR-002 holds' is outdated; no ledger write path exists.)
- Request: Items “can be used to add as a new adr or mark as acknowledged and accepted” (G-050)
- Questions: None while ADR-002 holds.
- Suggested pick: Keep the hand-over to Claude (estimate for a GitHub-token write path: effort +60%, value +15%, and it breaks ADR-002)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-103: Family rule for your own templates

- Status: Open
- Origin: ADR-100 (2026-10-26, Claude: not asked for)
- Missing: The family rule reads the shipped catalog families only; a piece from one of your own templates (own-… families, stored on this device) has no known room group, so the family rule never refuses or warns for it.
- Request: New adr 3
- Questions: Should pieces from your own templates follow the family rule too (their template's rooms)?
- Suggested pick: Yes: record the template's rooms on the inserted piece's catalog origin (a design document change, ADR-011; about +10 % of ADR-100's work, closes the rule for every piece).

### G-104: Repairs for compatibility warnings

- Status: Open
- Origin: ADR-100 (2026-10-26, Claude: not asked for)
- Missing: The depth, height and family warnings offer no previewed repair (ADR-071); each rule's repairs list is empty because no existing repair fixes them.
- Request: New adr 3
- Questions: Offer repairs such as 'Make Base cabinet 560 deep like its neighbour' or 'Move the bed away'?
- Suggested pick: Add a 'match the neighbour's depth/height' repair (closest to fixing the warning; about +20 % of ADR-100's work).

### G-105: Move display-only 3D models in the 3D view

- Status: Open
- Origin: ADR-093 (2026-10-26, Claude: skipped this iteration)
- Missing: Move mode in 3D drags and turns project pieces only; display-only 3D models can be resized there (ADR-102) but not moved or turned.
- Request: New adr to override the conflicts for 4 and make it ready
- Questions: Should Move in 3D also drag and turn display-only 3D models?
- Suggested pick: Yes, the same Move and Turn (closest to direct manipulation in 2D/3D; about +15 % work for +10 % of the request, estimates).
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-106: Resizing a base moves a locked piece on it

- Status: Open
- Origin: ADR-095 (2026-10-26, Claude: found while building)
- Missing: A locked piece placed on or above another piece still follows its base when the base's size changes in the piece editor (moving or turning the base is refused; resizing is not a move).
- Request: Not a quote: ADR-095 'Nothing moves it for the user'
- Questions: Should resizing a base keep a locked piece on it where it is (leaving its base), or refuse the resize?
- Suggested pick: Refuse the resize with the reason, as a move of the base is refused (about +10 % of ADR-095's work).

### G-107: Keep mine for saved single pieces

- Status: Open
- Origin: ADR-096 (2026-10-26, Claude: scoped while building)
- Missing: Saved single pieces in the Library (Projects → Single pieces) show 'Template updated (revision a → b)', but Keep mine and Replace are offered on project pieces only; a saved single piece has no field to remember a kept revision.
- Request: Answer to 'Show the notice in the Library too?': "Library too" (2026-10-26)
- Questions: Should a saved single piece also offer Keep mine (a design-document field) and Replace with the new revision?
- Suggested pick: Notice only, as built (the answer asked for the notice); Keep mine on saved designs needs an optional Design field (about +20 % of ADR-096's work, +10 % value; estimates).

### G-109: Cycling stacked pieces on the plan replaces opening them

- Status: Open
- Origin: ADR-097 (2026-10-26, Claude: defaulted while building)
- Missing: On the plan, a tap on the same spot over stacked pieces selects the next piece under it (ADR-097) instead of opening the selected piece's interior (ADR-083, G-066); stacked pieces open from the room front view, 3D or the card.
- Request: New adr 2 (2026-10-26): tapping the same spot again selects the next piece under the pointer
- Questions: Over stacked pieces on the plan, should a further tap cycle (as built) or open the piece, with cycling on another gesture?
- Suggested pick: Cycle as built (the ADR's words); opening stays one tap away in the front view (no extra work).

### G-110: Distribute across rows and centre-snap rules

- Status: Open
- Origin: ADR-099 (2026-10-26, Claude: defaulted while building)
- Missing: Distribute evenly over pieces at different heights (wall units and base units together, or a piece on another) is refused with the reason instead of spacing each row; centre snapping is offered only between pieces above and below each other (never at the same height) and the ADR-100 join rules do not apply to it (an alignment, not a join).
- Request: New adr 7 (2026-10-26): Distribute evenly (three or more selected pieces, along the wall)
- Questions: With a mixed selection, distribute each row on its own instead of refusing? Should the join rules also limit centre snapping?
- Suggested pick: Distribute each row on its own (closest to 'tidy runs in one tap'; about +15 % of ADR-099's work, +10 % value; estimates); keep the join rules for joins only.

### G-116: Fill a wall: carcasses with 3 or more equal fronts

- Status: Open
- Origin: ADR-103, 2026-10-27; Claude cut it while building
- Missing: Equal fronts puts 1 or 2 fronts on a carcass only (a door front has 1 or 2 leaves); carcasses with 3 or more fronts are not suggested, so fronts under 200 mm wide (with the 400 mm min) give no mix.
- Request: 6 equal front panels, what's behind is to be configured (answer: Equal fronts, any carcass widths)
- Questions: Should a carcass carry 3 or more equal fronts (with dividers inside), for narrow fronts?
- Suggested pick: Allow 3–4 fronts per carcass, built as equal bays with a divider and one door each, so narrow fronts still fill the wall. (estimate: effort +10%, value +5%)

### G-117: Fill a wall: tall cabinet height

- Status: Open
- Origin: ADR-103, 2026-10-27; default chosen by Claude while building
- Missing: Tall cabinets are always the catalog height (2200 mm, ADR-036 typical value); there is no tall-height field. A wall lower than that gets the warning on every mix with a tall cabinet.
- Request: allow with a warning items like tall cabinets, above this height
- Questions: Should Refine have a tall cabinet height field, or should tall cabinets follow the entered height?
- Suggested pick: Add a Tall cabinet height field in Refine, catalog value prefilled; the warning stays when it is above the entered height. (estimate: effort +3%, value +10%)

### G-118: Fill a wall: a width per base kind

- Status: Open
- Origin: ADR-103, 2026-10-27; Claude narrowed it while building
- Missing: All base kinds in one mix share one width (tall cabinets may have their own round width); mixes such as an 800 drawer base next to 600 shelf bases are not suggested.
- Request: So basically a mix and match (answer: Equal per kind, exact split)
- Questions: Should each base kind (open shelves, drawers, door + shelves) get its own width in a mix?
- Suggested pick: Also try one round width per base kind (steps of 50 mm), ranked after the shared width, so the cards show such mixes too. (estimate: effort +10%, value +15%)

### G-119: Doubled rails on a rails top

- Status: Open
- Origin: ADR-105, 2026-10-27, Claude default
- Missing: A doubled top on a rails top (two rails) is not built: the rails stay single and a warning says so.
- Request: Add the doubled top support … 2 panels
- Questions: Should 'Doubled' also double the two rails of a rails top, or stay a panel-top option only?
- Suggested pick: Panel top only (default used): the user's answer was '2 panels', a rails top has no panel; doubling rails is a separate request (+5 % work, +0 % of this request).

### G-120: Glue and screws for the doubled top

- Status: Open
- Origin: ADR-105, 2026-10-27, Claude (ADR-010)
- Missing: No glue or screw line in the hardware list for joining the two top layers; the layers count as a carcass joint in the fastener tally only.
- Request: Add the doubled top support … 2 panels
- Questions: Which glue and screws (length, spacing) join the two layers? Not known; ADR-010 forbids inventing them.
- Suggested pick: Leave it to the user's own fastener choice for carcass joints until they name a glue and screw (0 % work now).

### G-121: Doubled bottom, sides or shelves

- Status: Open
- Origin: ADR-105, 2026-10-27, Claude scope
- Missing: Only the top can be doubled; a doubled bottom, side or shelf is not built.
- Request: Add the doubled top support
- Questions: Do you also want a doubled bottom or doubled sides?
- Suggested pick: Top only, as asked (0 % extra work).

### G-122: Fill a wall: at most 40 pieces per mix

- Status: Open
- Origin: ADR-103 review, 2026-10-27; Claude added the bound
- Missing: A mix has at most 40 pieces (Equal fronts at most 80 fronts), so a tiny min width cannot freeze the page; beyond that the wizard says so instead of suggesting.
- Request: suggest a good width per piece ... resulting in a few pieces of furniture mixed (context: no limit was asked for)
- Questions: Is 40 pieces per wall enough, or should the limit be higher?
- Suggested pick: Keep 40: a 400 mm min fills a 16 m wall; longer runs are better as several walls. (estimate: effort 0%, value 0%)

### G-123: Fill a wall: wall cabinet depth

- Status: Open
- Origin: ADR-104, 2026-10-27; default chosen by Claude while building
- Missing: Wall cabinets keep the catalog depth (320 mm carcass); there is no wall cabinet depth field.
- Request: Wall cabinets above (answer to: Which kinds of pieces may appear in a mix?)
- Questions: Should Refine have a wall cabinet depth field?
- Suggested pick: Add Wall cabinet depth in Refine, catalog value prefilled. (estimate: effort +2%, value +5%)

### G-124: Fill a wall: wall row reaching into the base row

- Status: Open
- Origin: ADR-104, 2026-10-27; Claude changed the agreed handling while building (ADR-008)
- Missing: The ADR said a wall cabinet reaching into the base row would be warned and still offered. It overlaps the base cabinet, which projects report as an error (pieces-overlap), and mixes with errors are never offered. Such wall rows are now dropped and the Suggestions step says by how much and to lower the wall cabinet height.
- Request: Catalog height, Refine field (answer to: How tall are the wall cabinets themselves?)
- Questions: When the wall cabinets would reach into the base row, should the wizard drop the wall row (now), shorten the wall cabinets to fit, or offer the mix with the overlap error shown?
- Suggested pick: Shorten the wall cabinets to the room left above the base row (never below the catalog minimum), labelled on the card, so a wall row still appears. (estimate: effort +5%, value +10%)

### G-126: No width/depth fields for a bed or a set of loose panels

- Status: Open
- Origin: ADR-106
- Missing: A bed and a set of loose panels show no size fields when selected (src/core/pieceSize.ts:49-63); a filler/cover panel shows Width and Height (no depth).
- Request: Add the posibility to change width/depth when whole cabinet or whole piece is selected
- Questions: Should a bed show its mattress size there instead, and loose panels nothing?
- Suggested pick: Bed: show the mattress width and length there (closest to the request; estimate +10 % work, +5 % of value)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-127: Fill a wall: the over-hood cabinet is not placed over a hood

- Status: Open
- Origin: ADR-104, 2026-10-27, review nit
- Missing: The over-hood wall variant (no bottom) is dealt into the wall row at any position; nothing ties it to a hood or hob below.
- Request: Yes, every catalog wall variant
- Questions: Should the over-hood cabinet appear only above a hob or hood, or stay anywhere in the row?
- Suggested pick: Anywhere, as answered ('every catalog wall variant', 0 % extra work).

### G-128: Save a project piece back over an existing template

- Status: Open
- Origin: ADR-107, 2026-10-27, Claude scope
- Missing: Saving a project piece always makes a new catalog template; it never overwrites the template the piece came from.
- Request: New adr to add the possibility to save a new piece to catalog when created it inside a project
- Questions: Do you also want 'Update the template' to write a project piece's changes back into its existing template as a new revision?
- Suggested pick: New template only, as asked (0 % extra work).

### G-129: Save a group or several pieces as one catalog item

- Status: Open
- Origin: ADR-107, 2026-10-27, Claude scope
- Missing: Only one piece at a time is saved to the catalog; a group or multi-selection is not saved as one item (project templates, ADR-060, cover whole projects).
- Request: New adr to add the possibility to save a new piece to catalog when created it inside a project
- Questions: Should a selected group of pieces be savable as one catalog item?
- Suggested pick: One piece at a time, as asked (0 % extra work).

### G-135: jsdom find-it cannot tap the drawing by position

- Status: Open
- Origin: ADR-108 (found while building)
- Missing: The drawing hit-tests taps by screen position (getScreenCTM), which jsdom has no layout for; jsdom tests use each space's keyboard route (Enter), which runs the same tap at the space's centre, so a tap off-centre is not tested
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Is the keyboard route enough for drawing taps, or should tap-position work use Acceptance browser?
- Suggested pick: Keyboard route in jsdom; ADRs that change tap hit-testing use browser

### G-136: Link pieces that are already 100% identical

- Status: Open
- Origin: ADR-111, 2026-10-27, user choice
- Missing: Only copies made with 'Add a linked copy' are linked; identical pieces added separately, by Duplicate or by adding the same item again stay independent (user picked explicit links and only 'Add a linked copy').
- Request: use a piece, a item created by the user, added to the project, added multiple times, and give the possibility to bulk update the width/height/drawers, just like it would be 1 piece, with 2 symlinks to it, change to 1 changes all the other, including internal, and it should be propagated further to the ones in the 100% same.
- Questions: Should 'Link N identical pieces' link existing identical pieces, or should Duplicate / adding the same item again make linked copies?
- Suggested pick: 'Link N identical pieces' on the card: closest to 'propagated further to the ones in the 100% same' (est. +20 % work).

### G-137: Linked copies across projects and templates

- Status: Open
- Origin: ADR-111, 2026-10-27, Claude scope
- Missing: Links live inside one project; a change does not reach copies in other projects, saved designs or catalog templates (earlier request 2026-10-27, replaced by the user).
- Request: give the possibility to update the original template, and it should be propagated further to the ones in the templates.
- Questions: Should a change also reach the template and copies in other projects?
- Suggested pick: One project only, as in the current request (0 % extra work).

### G-138: How an info button shows its text

- Status: Acknowledged (2026-10-27)
- Origin: ADR-113
- Missing: The way the moved intro text opens is a default the user has not confirmed: tap or click the ⓘ button opens a small popover under it; tap outside, Escape or a second tap closes it
- Request: Move info text from Project to a tooltip, apply same to other similar UX occurences
- Questions: Popover on tap (also on hover on desktop), or hover-only tooltip?
- Suggested pick: Popover on tap and click, Escape closes (closest to the request: a hover-only tooltip cannot open on a phone)

### G-139: Heading scale for drawings and print sheets

- Status: Acknowledged (2026-10-27)
- Origin: ADR-116
- Missing: Text sizes inside SVG drawings and the printed sheets keep their own sizes
- Request: Run a critique for listings, headers, text, button sizes, gaps, groupings
- Questions: Should drawing labels and print sheets follow the app heading scale?
- Suggested pick: Keep their sizes (print is Romanian sheets with their own layout, ADR-020)

### G-142: Count card can cover part of a piece that fills the front view

- Status: Acknowledged (2026-10-27)
- Origin: ADR-112 (found while building)
- Missing: At 390 px in a project, when the whole selected piece fills the front view no corner is free: the card covers about 6 % of the piece (the plinth corner); a 3-row card cannot avoid a centre bay; taps on the drawing under the card hit the card
- Request: Increment/decrement card must be inside the rendered 2d view, not over
- Questions: Accept the small overlap, or shrink the drawing only in that case, or move the card outside the drawing when no corner is free?
- Suggested pick: Accept the overlap (closest to the request: the card stays inside the view and the drawing keeps its size)

### G-143: Count card hidden while the bottom sheet is open

- Status: Acknowledged (2026-10-27)
- Origin: ADR-112 (found while building)
- Missing: On a phone the floating count card is hidden while the bottom sheet is open (the sheet holds the same counters); before, a single piece already did this, now the project front view does too
- Request: Force 2d view to maintain it's size, bottom cars can cover it partially, but not push it
- Questions: Keep the card hidden while the sheet is open, or show it in the visible part of the stage?
- Suggested pick: Keep hidden (the sheet shows the same counters; no duplicate)

### G-144: Wording changed while moving intro text

- Status: Acknowledged (2026-10-27)
- Origin: ADR-113 (found while building)
- Missing: Catalog checkbox now 'I check safety-regulated items myself' (examples moved to its info); '(ADR-036)' dropped from a panel intro; shopping hint now 'Your prices, saved on this device.'; the quantity info shows at any quantity; wizard per-field help kept visible
- Request: Move info text from Project to a tooltip, apply same to other similar UX occurences
- Questions: Approve these three wording changes and the two choices?
- Suggested pick: Approve (shorter labels fit one row; the ADR number is not user text)

### G-146: Where a cut catalog card's full text shows

- Status: Acknowledged (2026-10-27)
- Origin: ADR-119
- Missing: The Catalog has no item detail view (tapping a card opens the item), so G-145's pick needs a place for the full text
- Request: accept gap picks
- Questions: A More toggle that expands the card in place, or the text in an info popover?
- Suggested pick: More toggle in place (closest to the request: the text is on the card, one tap, works on touch and keyboard)

### G-147: Lower-severity critique fixes not agreed

- Status: Acknowledged (2026-10-27)
- Origin: ADR-120
- Missing: The nine fixes in ADR-120 are the critique's proposals; none is agreed
- Request: accept gap picks (G-141: one follow-up ADR for all of them)
- Questions: Accept the nine fixes as written in ADR-120, or change any?
- Suggested pick: Accept as written (each is the critique's fix for the item it names)

### G-148: ADR ids and Back link left on the Gaps and Research pages; Select lost its tooltip

- Status: Open
- Origin: ADR-120 (found while building)
- Missing: The Gaps page search placeholder still names ADR-072 and the Research page lists ADR ids (they are the content); Gaps and Research always show 'Back to the editor', not only with a design open; the Select checkbox lost the tooltip the old button had
- Request: accept as written (ADR-120: no ADR numbers in UI text; Back to the editor only when a design is open)
- Questions: Remove ADR ids from those two pages and hide Back there too, and give Select an info tip?
- Suggested pick: Keep the ids on Gaps and Research (they are the page's subject); hide Back there too; add an info tip to Select (estimate +5 % work, +5 % of value)

### G-170: Angled pieces snap and measure by their enclosing box

- Status: Open
- Origin: ADR-121 (found while building)
- Missing: A piece typed at an angle snaps to neighbours and walls by the axis-aligned box around it, not its turned faces; the mm amounts in overlap and blocked-opening messages are measured on those boxes. Detection itself is exact.
- Request: Accept default, /batch all ready
- Questions: Snap angled pieces face to face along their turned sides, and measure overlaps exactly?
- Suggested pick: Snap along turned faces and measure exactly (closest to typed rotation 'while snapping keeps working'; estimate +40 % work on ADR-121's rotation part, +15 % of value)

### G-171: Angled pieces are not part of runs

- Status: Open
- Origin: ADR-121 (found while building)
- Missing: A piece at an angle is left out of runs: no shared worktop, run plinth, fillers, covers, trims or side-by-side compatibility rules for it
- Request: Accept default, /batch all ready
- Questions: Should run parts follow an angled piece (a worktop cut at an angle), or is leaving it out right?
- Suggested pick: Leave it out (run parts are straight boards along a wall, ADR-036; an angled worktop is a new cut shape)

### G-172: 3D outlines of an angled piece are drawn unturned

- Status: Open
- Origin: ADR-121 (found while building)
- Missing: In the 3D view, the selection outline of a space inside an angled piece and the Move-mode ghost are drawn as the unturned or enclosing boxes; the boards themselves are drawn turned
- Request: Accept default, /batch all ready
- Questions: Turn the selection outline and the Move ghost with the piece?
- Suggested pick: Turn them (estimate +5 % work, +5 % of value)

### G-173: Selected space hides its piece's boards in 3D

- Status: Open
- Origin: ADR-121 (found while building)
- Missing: With a space selected inside a piece, that piece's boards do not draw in the 3D view; only the selection outline shows. Also on main (happens at 0° and with the always-on render loop)
- Request: Accept default, /batch all ready
- Questions: Fix it in this PR or in a separate change?
- Suggested pick: Fix it in this PR, since this PR touches Viewer3D (estimate +5 % work)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): no fix found after 0b8fc21; the 3D view fades rather than hides boards (src/viewer/Viewer3D.tsx:1471-1477). Needs a browser run to tell whether it still happens.

### G-181: Move/Section toggle sometimes ignores the first tap after a touch drag or while the 3D view settles

- Status: Open
- Origin: ADR-122 (found while checking)
- Missing: In the production-build find-it run, Move and Section sometimes stayed off after one tap: right after a touch drag on a phone, or while the 3D view was settling after the look changed; the script now taps again until the toggle reads pressed
- Request: Push, merge
- Questions: Trace and fix the dropped tap, or keep the retry in the find-it script?
- Suggested pick: Trace and fix (estimate +10 % work)

### G-190: Versions of a deleted project

- Status: Open
- Origin: ADR-123 (found while building)
- Missing: Deleting a project leaves its kept versions on the device; nothing lists or removes them (G-156: nothing removes versions without the user)
- Request: Accept default, /batch all ready (G-156: keep every version until the user deletes it)
- Questions: When a project is deleted, ask whether to delete its versions too, keep them silently, or list orphaned versions somewhere to restore or delete?
- Suggested pick: Ask on delete, defaulting to keep (closest to G-156: nothing removed without the user's decision)

### G-201: Pictures and 3D models in design codes

- Status: Open
- Origin: ADR-124 (scope)
- Missing: A design code carries the document only; board pictures and display-only 3D models stay on this device (a project file carries them)
- Request: Accept default, /batch all ready
- Questions: Should codes also carry pictures and 3D models (much longer codes), or stay document-only?
- Suggested pick: Document-only (codes stay short enough to paste; the project file carries the rest)

### G-202: Replace and the outer size

- Status: Open
- Origin: ADR-124 (found while building)
- Missing: Replace never carries the piece's own outer width, height or depth; this narrows the accepted G-160 pick 'every changed setting'
- Request: Accept default, /batch all ready
- Questions: Carry size too (neighbours may then overlap; those become diagnostics), or keep the catalog item's size?
- Suggested pick: Carry size too (closest to the pick; estimate +10 % work, +15 % of value)

### G-210: Project templates drop run handles and sinks

- Status: Open
- Origin: ADR-125 (found while building)
- Missing: Saving a project as a project template (ADR-060) keeps neither its run handles nor its sinks; a project made from it has none
- Request: Accept default, /batch all ready (ADR-125: run sinks and handles)
- Questions: Should project templates keep run handles and sinks (with the piece ids remapped)?
- Suggested pick: Keep them, remapped like run-part keys (closest to a reusable kitchen layout)

### G-211: Run handles not shown inside the piece editor

- Status: Open
- Origin: ADR-125 (found while building)
- Missing: Opening one piece of a handled run shows and edits its own handles; the run's handle shows only in the project views, cut list and hardware
- Request: Accept default, /batch all ready (ADR-125: run sinks and handles)
- Questions: Should the piece editor show the run's handle (read-only) with a note that the run sets it?
- Suggested pick: Show it read-only with 'Set by Handles for this run' (no change to the piece's own design)

### G-212: Sink cut-out not drawn

- Status: Open
- Origin: ADR-125 (found while building)
- Missing: The sink cut-out is a cut-list note, a shopping line and checks; it is not drawn on the plan, the front view or in 3D (worktop cut-outs were already not drawn)
- Request: Accept default, /batch all ready (ADR-125: run sinks and handles)
- Questions: Draw the cut-out outline on the plan and in 3D?
- Suggested pick: Outline on the plan only (where the worktop is drawn from above)

### G-273: Wall backgrounds outside 3D and front view

- Status: Open
- Origin: ADR-145 (out of scope)
- Missing: Wall backgrounds on the 2D floor plan, the SVG download, catalog snapshots and cut sheets
- Request: Set wall background; answers 2026-10-28: colour or picture, 3D view and front view, per wall, toggle solid/see-through
- Questions: Show the wall colour on the plan too?
- Suggested pick: Colour strip along each wall on the plan only; the others stay as they are.

### G-274: Floor background

- Status: Open
- Origin: ADR-145 (out of scope)
- Missing: Floor colour or picture
- Request: Set wall background; answers 2026-10-28: colour or picture, 3D view and front view, per wall, toggle solid/see-through
- Questions: Set the floor like the walls?
- Suggested pick: Same picker for the floor in a later ADR, reusing this one's code.

### G-275: Wall background in the single-piece front view

- Status: Open
- Origin: ADR-145 (found while building)
- Missing: The wall background shows in the project's front view (the whole room seen from the front); the front view of a single piece, opened from the project, shows no wall behind it
- Request: Set wall background adr; answers 2026-10-28: 3D view and front view
- Questions: Show the wall the piece stands against behind it in the single-piece front view too?
- Suggested pick: Yes: the same floor-to-room-height fill behind the piece when it is opened from a project with a room (estimate: effort +10%, value +10%)

### G-276: Reset emails and the built-in sender

- Status: Open
- Origin: ADR-136, 2026-10-28; found while building (Claude)
- Missing: Supabase's built-in email sender reportedly sends only to the project team's addresses, about 2 emails per hour (web search 2026-10-28; supabase.com not reachable from the build session). With public sign-up (G-214) and the built-in sender (G-250), password-reset emails will not reach other users.
- Request: “New adr for ui login (including gmail)/logout/forgot password/reset password”; answer G-250: Supabase built-in email
- Questions: Keep the built-in sender (resets only for team addresses), or set a custom SMTP sender in Supabase?
- Suggested pick: A custom SMTP sender in Supabase (no app change; estimate effort +2 %, value: forgot password works for everyone)

### G-277: Supabase project not set up

- Status: Open
- Origin: ADR-127, 2026-10-28; found while building (Claude)
- Missing: No Supabase project exists yet: the migration is not applied, Google sign-in is not registered, and the repository variables SUPABASE_URL and SUPABASE_ANON_KEY are not set, so the deployed app is built without accounts. Online features are tested with an in-memory backend and the SQL rules on a local PostgreSQL, never against Supabase itself.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts”; answers G-217 Supabase, G-219 my personal account
- Questions: Create the Supabase project and Google client (docs/supabase-setup.md), then let a session test sign-in, sync and share links against it?
- Suggested pick: Yes: follow docs/supabase-setup.md, then run a live check (estimate 1 hour of your time)
- Note: 2026-10-28: the user created the project `https://nllwhcxvcbtjfkdhsyse.supabase.co` and gave its publishable key; both are set in `deploy.yml`. Still open: the migration, Google sign-in and the email settings in the dashboard, and a live check.

### G-278: Account and share-link limits

- Status: Open
- Origin: ADR-128, ADR-132, 2026-10-28; Claude chose values
- Missing: Values chosen while building, not by the user: one item at most 2 MB, one account at most 25 MB (about 20 full accounts in the 500 MB free database), at most 30 new share links per account per hour, at most 120 opens per link per hour.
- Request: Answers G-223 “Design caps + total cap”, G-235 “Vendor defaults first”
- Questions: Keep these limits, or set your own?
- Suggested pick: Keep them until a limit is hit (estimate effort +0 %)

### G-279: No Trash list to restore from

- Status: Open
- Origin: ADR-129, 2026-10-28; found while building (Claude)
- Missing: Deleted account items go to the Trash for 7 days on the server, but the app has no Trash list to restore them from.
- Request: Answer G-228: “Account Trash”, 7 days
- Questions: Add a Trash list in Account with Restore?
- Suggested pick: Yes, in Account (estimate effort +10 %)

### G-280: Conflict copies are not named after a device

- Status: Open
- Origin: ADR-129, 2026-10-28; found while building (Claude)
- Missing: On a conflict, the account's version is kept as a copy named “… (from your account)”, not after the other device: devices have no names.
- Request: Answer G-226: “Keep both … the second is saved as a copy named after its device”
- Questions: Name devices (asked once per device), or keep “(from your account)”?
- Suggested pick: Keep “(from your account)” (estimate effort +0 %; naming devices +5 %)

### G-281: Switching accounts needs a sign-in

- Status: Open
- Origin: ADR-142, 2026-10-28; found while building (Claude)
- Missing: Supabase keeps one session per browser, so Switch to … signs out and asks for the other account's password (the email is filled in); it is not a one-tap switch.
- Request: Answer G-263: “Several (Recommended)”
- Questions: Keep sign-out-and-sign-in, or keep several sessions at once (one Supabase client per account)?
- Suggested pick: Keep it (estimate effort +0 %; several sessions +25 %)

### G-282: Restored copies lose version and template links

- Status: Open
- Origin: ADR-133, 2026-10-28; found while building (Claude)
- Missing: Restore gives every restored piece, project and template a new id (G-244), so kept project versions and template links in the backup point at the old ids and stay apart from the restored copies.
- Request: Answer G-244: “New copies (Recommended)”
- Questions: Keep new ids always, or keep the old id when nothing on this device uses it?
- Suggested pick: Keep the old id when it is free (closer to a full restore; estimate effort +3 %)

### G-287: Lens distortion of wall photos

- Status: Open
- Origin: ADR-146 (out of scope)
- Missing: Correcting curved lines from wide-angle lenses (barrel distortion); straightening fixes the angle only
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: Is barrel correction needed for your photos?
- Suggested pick: Not asked; only if photos show curved wall edges after straightening

### G-288: Adjust the wall picture from the front view

- Status: Open
- Origin: ADR-146 (out of scope)
- Missing: Dragging the wall picture in the 2D front view; only the 3D view adjusts it
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: Should the front view also drag the picture?
- Suggested pick: Not asked; the user chose dragging in 3D

### G-289: Move to actions on the 2D plan

- Status: Open
- Origin: ADR-147, 2026-10-29; out of scope
- Missing: No overlay bar of Move to buttons over the 2D plan; they are in the piece panel and the 3D Move toolbar
- Request: add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest left piece, snap to closest right piece, and any other snaps you think would be appropriate
- Questions: Add a floating Move to bar over the plan?
- Suggested pick: Not now; the user picked panel + 3D

### G-290: Group width for pieces not in columns

- Status: Open
- Origin: ADR-148, 2026-10-29; scope (Claude)
- Missing: A group whose pieces overlap in x without sharing the same span (e.g. a wall unit straddling two base units) refuses a Width change.
- Request: add the possibility to set the width, height and depth of grouped items, add the possibility to block group items from being moved separately.
- Questions: Refuse, or scale every position around the left edge (pieces may stop touching by 1 mm)?
- Suggested pick: Scale positions around the left edge, rounding shared edges once (closer to the request; estimate effort +25 %, value +10 %)
- Answer: 2026-10-29 (user) "Refuse (as in ADR)"; ADR-148 refuses with the reason

### G-294: Move to for several selected pieces

- Status: ADR-182
- Origin: ADR-147, 2026-10-29; out of scope
- Missing: Move to actions move only the selected piece, not a multi-selection
- Request: add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest left piece, snap to closest right piece, and any other snaps you think would be appropriate
- Questions: Should Move to move every selected piece as one block?
- Suggested pick: Yes, as one block (closest to how drag moves a selection; estimate +20 % work)

### G-301: Third UI language

- Status: Open
- Origin: ADR-153 (out of scope)
- Missing: A third UI language (Romanian or other)
- Request: add support for Russian language, have it toggle, also translate all the existing content ...
- Questions: Add a Romanian UI too?
- Suggested pick: Not asked; leave until requested

### G-302: Lint for untranslated text

- Status: Open
- Origin: ADR-153 (out of scope)
- Missing: A lint rule that flags English text written outside t()
- Request: add a implementation rule/constraint to also add translation on any text added/modified/deleted
- Questions: Add the hardcoded-string lint?
- Suggested pick: User chose CLAUDE.md + type check only (2026-10-29)

### G-303: Gaps page not translated

- Status: Open
- Origin: ADR-154 (out of scope)
- Missing: The Gaps page (labels and entries) stays English
- Request: add support for Russian language, have it toggle, also translate all the existing content ...
- Questions: Translate the Gaps page?
- Suggested pick: User 2026-10-29: Ignore gaps

### G-304: User-typed names not translated

- Status: Open
- Origin: ADR-155 (out of scope)
- Missing: Names the user typed (pieces, projects, boards) are not translated
- Request: add support for Russian language, have it toggle, also translate all the existing content ...
- Questions: Translate user-typed names?
- Suggested pick: No: they are the user's own text

### G-305: Written guides

- Status: Open
- Origin: ADR-158 (out of scope)
- Missing: Written guides on the Information and guides page
- Request: add a page where you list all the features that the app currently supports
- Questions: Which guides should the page hold?
- Suggested pick: Ask the user when guides are wanted

### G-306: CSV separator per print language

- Status: Open
- Origin: ADR-157 (open question)
- Missing: The CSV column separator per print language (semicolon in all three today)
- Request: add support for Russian language ... also translate all the existing content
- Questions: Should the English CSV use commas, as English Excel expects?
- Suggested pick: Ask the user; semicolons stay until answered

### G-307: Plan layer filter (All / Floor / Wall) for stacked pieces

- Status: Open
- Origin: ADR-159
- Missing: A layer filter on the plan so taps and box select reach only floor or only wall pieces where they overlap.
- Request: The select is broken, wall and floor items are overlapping, correct select impossible (picked 'Layer filter', then 'Keep plan as is', 2026-10-29)
- Questions: Build a plan layer filter at all, now that the front view, 3D and the piece list select several pieces?
- Suggested pick: None suggested: the user's latest answer keeps the plan as is.

### G-308: Selection box in the front view and the 3D view

- Status: Open
- Origin: ADR-159
- Missing: Dragging on empty space in the room front view or the 3D view does not draw a selection box; only taps (Select on, or Shift/Ctrl-click) add pieces there.
- Request: Add the select to 3d, so i can click on them to multiselect
- Questions: Should the front view and 3D also get a drag-to-box selection?
- Suggested pick: Front view only (3D drags orbit the camera); closest to the plan's existing box.

### G-311: Rotation (°) field hidden

- Status: Open
- Origin: ADR-160 (side panel critique, 2026-10-30)
- Missing: The typed rotation field (ADR-121) is hidden from the selected-piece card; angles other than quarter turns cannot be typed.
- Request: Agree with all, implement, fix, remove the how many completely, there already is rotation in toolbar, no more need for the 4 buttons, also remove the rotation degree input, hidden for now
- Questions: When and where should the typed angle come back (a link under Position, the More menu)?
- Suggested pick: A small 'Exact angle…' link under Position, as in the critique.
- Answer (user, 2026-10-30): "Keep hidden"; stays open until the user wants it back.

### G-312: Seller catalogs are a bundled snapshot

- Status: Open
- Origin: ADR-161, 2026-10-30; agent scoped it out
- Missing: Seller prices and stock are a snapshot bundled in the app build (Regency export of 2026-10-29). The app never updates them itself; ADR-172 added a hand-started workflow (.github/workflows/seller-prices.yml) that takes an export URL and opens a pull request, and a newer file still needs a release. Nothing runs on a schedule. Live feeds stay ADR-063 (Deferred).
- Request: Import these as products for materials, keep it regency agnostic, more sellers will follow
- Questions: Refresh seller data how often, and by whom?
- Suggested pick: Re-run the converter on each new export the user provides and release (estimate: effort 5 %, value: prices stay current)
- Note: Re-checked 2026-11-05 on main 0c26d0b (code read, no browser): Missing text updated to the current code.

### G-313: Extra seller items only per piece

- Status: Open
- Origin: ADR-161, 2026-10-30; agent scoped it out
- Missing: In a project view, a seller product cannot be added as an extra item; open a piece to add it there. Hardware links chosen in the project view are written to every piece that has that hardware line.
- Request: Match products to parts in app
- Questions: Should a project hold its own extra seller items?
- Suggested pick: Add project-level extra items (estimate: effort +20 %, value +10 %)

### G-314: Fasteners and run parts not matched

- Status: Open
- Origin: ADR-161, 2026-10-30; agent scoped it out
- Missing: Screws, dowels, cams (fasteners, ADR-074) and run parts (plinths, fillers, cornices) are not matched to seller products.
- Request: Match products to parts in app
- Questions: Match fasteners and run parts to seller products too?
- Suggested pick: Yes: a product button on fastener lines and on run parts (estimate: effort +25 %, value +10 %)

### G-315: Band and hardware pictures not shipped

- Status: Open
- Origin: ADR-162, 2026-10-30; agent scoped it out
- Missing: Only board and worktop pictures ship with the app. Edge band and hardware pictures still load from regencycompany.ro (lists only, never in 3D).
- Request: You didnt use the image i provided to render
- Questions: Ship band and hardware pictures too?
- Suggested pick: Only if bands get a 3D look of their own (estimate: effort +15 %, value +5 %)

### G-316: Seller pictures not seen before shipping

- Status: Open
- Origin: ADR-162, 2026-10-30; agent scoped it out
- Missing: The board pictures are now downloaded and shipped (public/sellers/regency, 1 453 files) and a 16-picture sample was checked by eye, but none has been seen as a board texture in 3D in a browser.
- Request: You didnt use the image i provided to render
- Questions: Are the seller's pictures good board textures (whole panel photo vs decor swatch)?
- Suggested pick: Check a few boards in 3D after the first download; adjust the tile size if needed (estimate: effort 5 %)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Missing text updated to the current code.

### G-317: Run-part boards in the Material dialog

- Status: Open
- Origin: ADR-163
- Missing: The worktop, filler and cover boards of a run are not offered in the Material dialog; they keep their own select under Run parts.
- Request: Adjusting the material used MUST be always available.
- Questions: Should run-part boards join the Material dialog as a Worktop / Fillers role with scope Group?
- Suggested pick: Add them as roles in a later ADR (closest to 'always available').

### G-318: Edge band per role in the Material dialog

- Status: Open
- Origin: ADR-163
- Missing: The Material dialog changes boards only; the edge band of a role stays the board's band (ADR-077).
- Request: Not only piece/carcass, but any other combination or piece separately.
- Questions: Should a role also take an edge-band choice?
- Suggested pick: Add an edge-band select per role in a later ADR.

### G-319: App-wide Materials list

- Status: Open
- Origin: ADR-164
- Missing: No app-wide Materials list on the device; board choices come from the project's boards and the decor list.
- Request: The pal chosen at the beginning should be the same one from the Materials section.
- Questions: Should the device keep one Materials list every project draws from (new Dexie table)?
- Suggested pick: Keep project boards + decor list (the user's pick); an app-wide list only on request.

### G-320: Common panel across a gap

- Status: Open
- Origin: ADR-165
- Missing: A common top or bottom needs touching items; a gap between items is not bridged.
- Request: Add the possibility to have a common bottom or top between multiple items.
- Questions: Should one panel bridge a gap between items?
- Suggested pick: Touching items only (the user's pick).

### G-321: Shared side between neighbours

- Status: Open
- Origin: ADR-165
- Missing: Items under a common top or bottom keep their own two sides; no shared side between neighbours.
- Request: Add the possibility to have a common bottom or top between multiple items.
- Questions: Should neighbours also share one side panel?
- Suggested pick: Own sides (the user's pick); a shared side in a later ADR.

### G-322: Common panel on corner cabinets and desks

- Status: Open
- Origin: ADR-165
- Missing: Only cabinets join a common top or bottom; corner cabinets, desks and frames are refused with the reason.
- Request: Add the possibility to have a common bottom or top between multiple items.
- Questions: Should corner cabinets and desks join a common panel?
- Suggested pick: Cabinets first; corners and desks in a later ADR.

### G-324: Formula functions

- Status: Open
- Origin: ADR-166, 2026-10-30; agent scoped it out
- Missing: Formulas know only + − × ÷ and parentheses: no min, max, round, floor or conditions.
- Request: Formulas too (user answer 2026-10-30).
- Questions: Which functions are needed: min/max, round to a sheet thickness, if?
- Suggested pick: Add min, max, floor, ceil and round when a real project needs one (estimate: effort +10%, value +10%).

### G-325: Variables on run parts

- Status: Open
- Origin: ADR-166, 2026-10-30; agent scoped it out
- Missing: Run parts, worktops, run handles and sinks (ADR-036, ADR-075, ADR-125) cannot be bound to a variable; they follow the pieces they are derived from.
- Request: Not a quote: the user named pieces only.
- Questions: Should a run request (a worktop length or overhang) take a formula?
- Suggested pick: Bind run-request sizes the same way as piece sizes (estimate: effort +15%, value +10%).

### G-328: Feature tree details left short

- Status: ADR-183
- Origin: N170 (ff), 2026-11-04; agent left them out
- Missing: Seven feature-tree lines keep correct but incomplete details: Drag a piece on the plan (arrow keys), Wall colour or picture (where it shows, Solid walls), 2D, 3D or both (one switch in both modes), Share links, Save pieces and templates to your account, Boards and edge bands from a seller (seller pictures load online), Seller products for hardware (Add seller product).
- Request: “Sync features and gaps with latest changes, remove implemented, validate still listed, remove obsolete”
- Questions: Add the longer details to these seven lines?
- Suggested pick: Add them with their Russian entries (estimate: effort +10%, value +5%).

### G-329: Typed connectors and assembly graph

- Status: Open
- Origin: ADR-168, 2026-11-04; agent scoped it out
- Missing: Connector types and a typed assembly graph (research model): connections are untyped pairs of side-by-side pieces.
- Request: “Validate all High demand features … create adrs” (user 2026-11-04); the research row names a connection hierarchy
- Questions: Add connector types (side, top, back) with their own rules?
- Suggested pick: Not yet; untyped pairs cover undo, save and templates. Typed connectors when a rule needs them (estimate: effort +50%, value +15%).

### G-331: No stacked or cross-level connections

- Status: Open
- Origin: ADR-168, 2026-11-04; agent scoped it out
- Missing: Only side-by-side touching pieces on one floor level connect; a wall unit over a base unit, stacked pieces or pieces across floor levels do not.
- Request: Not a quote: the user chose record, re-check and move together
- Questions: Connect stacked pieces (wall unit over base) too?
- Suggested pick: Add a 'stacked' connection kind once typed connectors exist (G-329) (estimate: effort +30%, value +20%).

### G-332: No turn gizmo in 3D

- Status: Open
- Origin: ADR-169, 2026-11-04; agent scoped it out
- Missing: Turning by dragging exists on the plan only; 3D Move mode turns by quarter-turn buttons (ADR-093).
- Request: “Free-angle turn handle” (user 2026-11-04)
- Questions: A turn gizmo in 3D Move mode too?
- Suggested pick: A ring gizmo in 3D with the same snap rules (estimate: effort +60%, value +20%).

### G-333: Templates store whole copies, not deltas

- Status: Open
- Origin: ADR-170, 2026-11-04; agent scoped it out
- Missing: A template stores a full copy of each piece, not only the parameters that differ from a catalog item (research: existing-template instancing).
- Request: “Keep copies; add connections, variables, bindings, project settings” (user 2026-11-04)
- Questions: Store only the differing parameters?
- Suggested pick: Not while templates keep copies (ADR-060); revisit with G-334 (estimate: effort +80%, value +10%).

### G-334: Templates keep copies, not references

- Status: Open
- Origin: ADR-170, 2026-11-04; user decision
- Missing: Templates do not reference catalog items (ADR-060 chose copies; the research asks for references).
- Request: “Keep copies; add connections, variables, bindings, project settings” (user 2026-11-04)
- Questions: None; the user chose copies.
- Suggested pick: Keep copies (chosen). References would need a new ADR replacing ADR-060 (estimate: effort +150%, value +30%).

### G-335: Variables in catalog designs and the stand-alone editor

- Status: Open
- Origin: ADR-170, 2026-11-04; agent scoped it out
- Missing: Variables and bindings live in projects and project templates only; the stand-alone design editor and catalog designs have none (the rest of G-323).
- Request: Not a quote: the user asked for variables “within the project”
- Questions: Should a catalog design carry bindings as parameters?
- Suggested pick: A later ADR adds variables to catalog designs (estimate: effort +40%, value +15%).

### G-336: Verified research rows not yet deleted from the data

- Status: ADR-184
- Origin: ADR-168, 2026-11-04; agent scoped it out
- Missing: The three research rows ADR-168 completes (Transactional undo/redo, Versioned save/reload, Connected items stay independently selectable) are marked Verified in the research data but stay listed; ADR-149 and ADR-152 deleted built features from the data in their own ADRs.
- Request: “Validate all High demand features … create adrs” (user 2026-11-04)
- Questions: Delete the three rows from the research data as ADR-152 did?
- Suggested pick: A small deletion ADR after ADR-168 to ADR-170 ship, covering all four High-demand rows at once (estimate: effort +5%, value +5%).

### G-337: Locks on boards, construction and insides

- Status: Open
- Origin: ADR-171, 2026-11-04; agent scoped it out
- Missing: Boards, construction and insides of a piece cannot be locked (the rest of G-180).
- Request: “Separate locks per parameter” (user 2026-11-04)
- Questions: Lock boards, construction or insides too, one by one or together?
- Suggested pick: Lock boards and construction as two more toggles once asked (estimate: effort +25%, value +10%).

### G-338: Snap ranking ignores locks

- Status: ADR-180
- Origin: ADR-171, 2026-11-04; agent scoped it out
- Missing: Snap ranking does not prefer locked neighbours (research: 'snap ranking considers user locks').
- Request: “Separate locks per parameter” (user 2026-11-04)
- Questions: Rank a locked neighbour's side above an unlocked one when both are in range?
- Suggested pick: A tie-break in ADR-070's ranking: locked first (estimate: effort +5%, value +5%).

### G-339: No per-row price column

- Status: ADR-181
- Origin: ADR-172, 2026-11-04; agent scoped it out
- Missing: No price per row in the Parts table; only the running total and the Shopping list.
- Request: “Running estimate + scheduled seller price refresh” (user 2026-11-04)
- Questions: Add a price column to Parts?
- Suggested pick: A price column on the Shopping list rows only, where the prices live (estimate: effort +10%, value +10%).

### G-340: No price change report between exports

- Status: Open
- Origin: ADR-172, 2026-11-04; agent scoped it out
- Missing: A refreshed seller export replaces prices silently: no report of what changed between two exports.
- Request: “You upload a new export; the workflow converts it” (user 2026-11-04)
- Questions: Should the pull request list changed prices and dropped products?
- Suggested pick: The workflow writes a short change summary into the pull request body (estimate: effort +10%, value +15%).

### G-341: No budget or style filters on room mixes

- Status: Open
- Origin: ADR-173, 2026-11-04; agent scoped it out
- Missing: The research children Budget and style filters and Layout optimisation are not built; mixes are ranked by ADR-103's rules only.
- Request: “Fill the room” (user 2026-11-04)
- Questions: Filter mixes by a budget (ADR-172 estimate) or a style (ADR-123)?
- Suggested pick: A budget ceiling and a style pick on Refine, after ADR-172 (estimate: effort +30%, value +20%).

### G-342: No islands or peninsulas in room mixes

- Status: Open
- Origin: ADR-173, 2026-11-04; agent scoped it out
- Missing: Islands and peninsulas are not suggested; only pieces along walls.
- Request: “Fill the room” (user 2026-11-04)
- Questions: Suggest an island when the room is wide enough?
- Suggested pick: An island option on Refine with the clearance rules of ADR-073 (estimate: effort +40%, value +15%).

### G-343: No per-step pictures in the assembly print

- Status: Open
- Origin: ADR-174, 2026-11-04; agent scoped it out
- Missing: The printed assembly sheet shows one front view of the piece and a table of steps (src/ui/Assembly.tsx:218-261); no step has a picture or marked parts.
- Request: “Ordered step list + 3D highlight” (user 2026-11-04)
- Questions: Render one exploded picture per step into the print?
- Suggested pick: Use ADR-121's on-demand render per step once asked (estimate: effort +40%, value +20%).
- Note: Re-checked 2026-11-05 on main 0c26d0b (code read, no browser): Missing text updated to the current code.

### G-344: Assembly steps are not editable

- Status: Open
- Origin: ADR-174, 2026-11-04; agent scoped it out
- Missing: The assembly sequence cannot be edited: steps cannot be reordered, merged or renamed.
- Request: “Ordered step list + 3D highlight” (user 2026-11-04)
- Questions: Let the user reorder or rename steps, saved with the design?
- Suggested pick: An editable order saved on the design, with a reset (estimate: effort +35%, value +20%).

### G-346: Connections in 3D Move mode not checked in a browser

- Status: Open
- Origin: ADR-168, 2026-11-04; agent, at ship time
- Missing: Moving a connected piece in 3D Move mode (dropItemAt) is covered by a store test only; it was not checked in a browser (the browser find-it drags on the plan).
- Request: “ship ADR-168” (user 2026-11-04)
- Questions: Add a 3D Move mode drag to tools/connections/find-it.mjs (as tools/move-3d/find-it.mjs does)?
- Suggested pick: Extend the script with one 3D drag of a connected piece and an Alt drag (estimate: effort +10%, value +5%).

### G-347: accounts find-it at 390 px is timing-sensitive under the full suite

- Status: Open
- Origin: N171/N172 full test runs, 2026-11-04; agent
- Missing: tests/find-it/accounts.test.tsx at 390 px fails under the full local suite (the 'In your account' badge is not found in time) in two of three full runs on 2026-11-04, while it passes when run alone and in CI.
- Request: Not a quote: the suite is the source of truth (CLAUDE.md)
- Questions: Raise the badge's waitFor timeout, or split the long find-it into two tests?
- Suggested pick: Wrap the badge lookup in findByText with a longer timeout at 390 px (estimate: effort +2%, value +5%).

### G-348: Fill the room: openings only through a project's room

- Status: Open
- Origin: ADR-173, 2026-11-04; agent scoped it out
- Missing: Fill the room from the New dialog takes a ready shape and sizes only; doors and windows come only through a project's own room (Project ⋯ → Fill the room…).
- Request: “Fill the room” (user 2026-11-04)
- Questions: Add doors and windows to the Room step of the dialog?
- Suggested pick: Reuse the room editor's feature list in the dialog (estimate: effort +25%, value +15%).

### G-351: move-3d find-it fails on main at 1440 px

- Status: Open
- Origin: ADR-179 build, 2026-11-05; found by the agent
- Missing: tools/move-3d/find-it.mjs fails at 1440 px on the production build of main 0c26d0b and of this branch: 'Turn 90° ↺ turned the piece' reads an empty rotation, then the 3D canvas wait times out (20 s).
- Request: Not a quote: found while running the browser find-it scripts for ADR-179.
- Questions: Fix the script's turn check and 3D wait, or the app if the turn really fails?
- Suggested pick: Debug it on main first (debug skill); fix the cause (estimate: effort +5%, value +5%).
