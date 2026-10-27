# Gaps — everything asked for or implied that is not built (ADR-082)

Every item that is not built goes here in the same change that leaves it out. That covers a _Skipped this
iteration_ item, an _Out of scope_ line, an open question answered with a default, and a requirement that was cut.
`pnpm docs:check` checks this file.

**Statuses:**

- `Open`: recorded, not decided.
- `Acknowledged (YYYY-MM-DD)`: the user accepted the gap as it is. Only the user sets this.
- `ADR-NNN`: the gap moved into that ADR. The `ship-adr` skill marks it Done when that ADR ships.
- `Done (<commit or ADR-NNN>)`: built and on `main` (the ship commit reaches `main` with the ADR).

**Helpers:**

- add a gap: `pnpm gaps add --origin "ADR-NNN" --missing "…" --request "…" --questions "…" --pick "…" "Title"`;
- list open gaps: `pnpm gaps list`;
- mark the gaps of shipped ADRs Done: `pnpm gaps sync`.

**Fields of each gap:**

- `Origin`: the ADR or area, when, and who chose the gap.
- `Request`: the user's words. Text that is not a quote says so.
- `Suggested pick`: the option closest to the request, with estimates (`CLAUDE.md`, rule of 2026-10-25).

## Gaps

### G-001: Board pictures only in 3D

- Status: Open
- Origin: ADR-048, 2026-10-24 06:54 UTC; agent scoped it out
- Missing: Board pictures show only in 3D and the inspector. Cut sheets, the plan, catalog pictures and the front-view SVG download use a plain average colour. Doors and drawer fronts in the front view are outlines only.
- Request: “Render the furniture according to the selected material's color and structure”, then “any image as color/background for the material”.
- Questions: Fill which drawings with the picture: plan, front view, SVG download, catalog pictures, cut sheets?
- Suggested pick: Fill every 2D drawing with the picture as an SVG <pattern> (the data URL is already stored), rotated with the grain. Fill fronts in the front view. Use the same fill in catalog snapshots and the SVG download. Cut sheets keep a light tint, for legibility when printed. (estimate: effort +30%, value +25%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): text partly wrong. The front view already fills carcass panels with the picture, rotated with the grain (src/ui/Elevation.tsx:51-61, :147-164, since 009173a). Still plain colour: fronts in the front view (outlines), the SVG download (patterns stripped, src/ui/shell/files.ts:30-34), catalog snapshots (src/core/snapshot.ts:266), the plan and cut sheets.

### G-002: Decor list not in exports

- Status: Open
- Origin: ADR-048, 2026-10-24 08:27 UTC; agent scoped it out
- Missing: The decor list is not in exported files. It has to be imported again on each device.
- Request: “Render the furniture according to the selected material's color and structure”, then “any image as color/background for the material”.
- Questions: Embed only the decors a design uses, or offer the whole list too?
- Suggested pick: Embed the decors a design uses in its export (the pictures already are), plus an optional “Include my whole decor list” checkbox. Needs a schemaVersion bump with old readers kept. (estimate: effort +10%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): origin is ADR-049 (the decor list, Dexie v6 decors), not ADR-048. Boards made from decors already travel in exported files with their code (src/core/materials.ts:286-293). Only exporting the whole decor list remains.

### G-003: Materials fields overlap at 375 px

- Status: Open
- Origin: ADR-048, 2026-10-24 08:27 UTC; agent scoped it out
- Missing: At 375 px, Materials “Thickness” overlaps “Has grain”. Not re-checked since ADR-079 moved Materials inline.
- Request: Phone-first (CLAUDE.md: no overlap or sideways scroll at 390 px) (context, not a quote)
- Questions: None; it is a bug.
- Suggested pick: Re-check at 375 px and fix the field grid. It is a bug, not a choice. (estimate: effort +1%, value +3%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still likely (not checked in a browser): the phone materials row is 36px 1fr (src/styles.css:2333-2335). Materials now lives in the Settings dialog (ADR-080, src/ui/Settings.tsx), not inline.

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
- Missing: Personal codes for saved designs, online model libraries and a live cross-brand catalogue would need a server, which ADR-002 forbids.
- Request: Research features (context, not a quote)
- Questions: Keep ruled out by ADR-002 (acknowledge), or open a new ADR to change ADR-002?
- Suggested pick: Keep these out unless you decide to change ADR-002. It is listed here only so you know they are not available.

### G-007: Connector engine and stored connections

- Status: Open
- Origin: Research, 2026-10-24 15:42 UTC; agent default, accepted by the user
- Missing: The high-effort group was set aside as “leave for later”: compatibility engine, semantic connectors, assembly graph, composition layer, connector authoring. ADR-070 snaps only to edges and walls.
- Request: “Verify, then Quick wins, then Medium effort”; later “guided snapping” and “cross-family composition”.
- Questions: Write one ADR for stored connections between pieces (side by side, on top, in corner, against wall)?
- Suggested pick: One ADR for stored connections between pieces (side by side, on top, in corner, against wall). Snap, Mirror a run, run parts and Merge would all read them, so pieces move together and the plan explains why. (estimate: effort +60%, value +35%)

### G-008: AR, plan review, shared structural elements

- Status: Open
- Origin: Research, 2026-10-24 15:42 UTC; agent default, accepted by the user
- Missing: AR placement, professional plan review and shared structural elements were also set aside as “leave for later”.
- Request: Features from the competitor research (context, not a quote)
- Questions: Which first: WebXR AR, a review pack, or shared side panels?
- Suggested pick: AR: WebXR with the existing three.js scene (Android Chrome, offline, no new service), plus a USDZ export for iPhone Quick Look. Review: a “review pack” of print sheets plus the design file. Shared elements: one shared side panel between touching cabinets, building on ADR-047. (estimate: effort +50%, value +20%)

### G-009: Supplier feeds and ordering

- Status: Open
- Origin: ADR-063, 2026-10-24 15:51 UTC; user decision
- Missing: Supplier price feeds, live stock and ordering are Deferred. They need a paid service and a change to ADR-002.
- Request: “Put to pending any that require non-free services”.
- Questions: Build the offline step (supplier price-file column maps and order files)? Which suppliers first?
- Suggested pick: An offline middle step that needs no service: a column map for each supplier's own price-list file (Egger, Kronospan, Kastamonu, Fundermax) into the ADR-062 price list, and an order file per supplier from the shopping list. This covers most of the value with no backend. (estimate: effort +25%, value +40% of what live feeds give)

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

### G-013: Templates from selected pieces

- Status: Done (merged into G-032)
- Origin: ADR-060, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: A template can only be made from a whole project, not from selected pieces.
- Request: Reusable project templates (context, not a quote)
- Questions: Build together with multi-select (G-032)?
- Suggested pick: “Save selection as template”. It needs multi-select, which ADR-069 also left out, so build both together. (estimate: effort +15%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): merged into G-032 (it needs multi-select).

### G-014: Undo across reloads and in the library

- Status: Open
- Origin: ADR-051, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: Undo is lost on reload, and there is no undo in the library (deleting saved pieces).
- Request: Undo and redo for project changes (context, not a quote)
- Questions: Keep undo per project on the device? A 30-day Recently deleted list for the library?
- Suggested pick: Keep the undo stack per project in IndexedDB (new Dexie version). Make library deletes go to a 30-day “Recently deleted” list instead of being final. (estimate: effort +20%, value +15%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still valid; the library is now the Projects page (ADR-078). Dexie v8 has no undo table and there is no Recently deleted list.

### G-015: Egger catalogue import

- Status: Open
- Origin: Catalog, 2026-10-24 17:15 UTC; blocked by the environment
- Missing: The Egger catalogue import is not done: the pack has no thickness or colour, and egger.com is blocked.
- Request: “Use this to fill in Egger catalogue”.
- Questions: Which thicknesses per board type (for example PAL 18 / 25 mm) should the 276 rows get?
- Suggested pick: Import the 276 rows now with code, name and type. Take thickness from one list you confirm (for example, PAL 18 / 25 mm) and leave colour to the pictures you add. Nothing invented (ADR-010). (estimate: effort +10%, value +30%)

### G-016: Export blocking never tried in a browser

- Status: Open
- Origin: ADR-062/064, 2026-10-24 17:52 UTC; agent scoped it out
- Missing: Exports blocked by errors are in the code but were never tried in a browser.
- Request: Errors block export (ADR-008) (context, not a quote)
- Questions: None; add the find-it step.
- Suggested pick: Add a find-it step: make an error, check that CSV and Print are disabled, and that the message says why. (estimate: effort +2%, value +5%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. tools/editor-modes/find-it.mjs:202-216 checks CSV and Print are disabled on an error and tools/edge-band/find-it.mjs:218-221 checks CSV is blocked (both pass per N88). Not checked: the message saying why (src/ui/Output.tsx:139), and that the Shopping list CSV and Print are blocked.

### G-017: Drag a catalog item onto the plan

- Status: Open
- Origin: ADR-065, 2026-10-24 18:55 UTC; user decision
- Missing: No dragging a catalog item from Add a piece onto the plan (option 2). You chose option 1.
- Request: “Drag and drop is implemented?”
- Questions: Build option 2 now, reusing the drag code?
- Suggested pick: Option 2 reuses the same pointer code: hold a catalog card and drop it on the plan, with the snap preview from ADR-070. (estimate: effort +25%, value +20%)

### G-018: Turn by dragging; Esc selection bug

- Status: Open
- Origin: ADR-065, 2026-10-24 18:55 UTC; agent scoped it out
- Missing: No turning by dragging. After Esc cancels a drag, releasing still selects the piece.
- Request: Drag and drop on the plan (context, not a quote)
- Questions: A 90-degree turn handle on the selected piece?
- Suggested pick: A turn handle on the selected piece that steps 90° (ADR-003 keeps whole angles). Fix the Esc bug. (estimate: effort +10%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. ADR-069 added Turn 90° buttons and R / Shift+R. No turn handle on the plan. The Esc bug is most likely still there: the piece's onClick still calls select() (src/ui/Project.tsx:1011); not reproduced.

### G-019: Textures in Realistic mode

- Status: Done (3a9dafe)
- Origin: ADR-067, 2026-10-24 19:55 UTC; agent default, accepted by the user
- Missing: No textures, so Realistic mode uses plain finishes (matte, satin, gloss).
- Request: “Realistic looks … rendering high quality 3D designs … to sell designed kitchens”.
- Questions: Use your own board pictures (ADR-048) as textures?
- Suggested pick: Use your own board pictures (ADR-048) as textures in Realistic mode, to scale with the grain direction. This needs no bundled files and no licence question. (estimate: effort +20%, value +35%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): resolved: Realistic mode has used the user's board pictures as textures since it shipped (src/viewer/Viewer3D.tsx:701, 715-717; UVs follow the grain). Bundled wood-grain textures were not the suggested pick and stay out (ADR-067).

### G-020: Appliances, sinks, edge profiles, client sheet

- Status: Open
- Origin: ADR-067/068, 2026-10-24 19:55 UTC; agent default, accepted by the user
- Missing: No appliances, sinks or worktop edge profiles. No client sheet with render and price.
- Request: “To sell designed kitchens”.
- Questions: Client sheet first? Which licence for bundled appliance models (CC0)?
- Suggested pick: Client sheet: one printable page with the PNG render, the piece list and the ADR-062 price. Appliances come through ADR-076 imports plus a few CC0 models once you pick that licence. Edge profiles: three profile choices drawn on the worktop. (estimate: effort +45%, value +40%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. Appliances and sinks can be imported as .glb (ADR-076); appliance niches (ADR-036) and a sink base exist. Remaining: client sheet, worktop edge profiles, bundled CC0 models (licence question).

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
- Missing: Not checked on a laptop GPU; the full 256-sample render and Save PNG were not run by script; no find-it at 390 px. The path tracer is pinned to a deprecated WebGL build (0.0.27).
- Request: Laptop, preview quality (context, not a quote)
- Questions: Can you run the render once on your laptop? Plan the WebGPU path-tracer upgrade?
- Suggested pick: Run the full render find-it on a machine with a GPU. Write an ADR for the WebGPU path-tracer upgrade before the WebGL build stops working. (estimate: effort +5%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved per documents: ADR-068 records the user's full 256/256 render and Save PNG on a laptop; N88 ran the scripted full render and Save PNG at 1280 px and 18/18 at 390 px. Remaining: three-gpu-pathtracer still pinned at 0.0.27 on WebGL, no WebGPU ADR.

### G-023: No outline on selection in Realistic mode

- Status: Done (ADR-087)
- Origin: ADR-067, 2026-10-24 20:59 UTC; agent scoped it out
- Missing: In Realistic mode a selected piece shows only a green tint, with no outline.
- Request: Select pieces in 3D (ADR-014) (context, not a quote)
- Questions: None; add the outline pass.
- Suggested pick: Add an outline pass in Realistic mode, the same as Preview mode. (estimate: effort +5%, value +5%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): duplicate of G-064 (Done, ADR-087): SelectionOutline is drawn in Simple and Realistic (src/viewer/Viewer3D.tsx:647-681), checked by tools/selection-look/find-it.mjs.

### G-024: Research marks not readable

- Status: Open
- Origin: Research, 2026-10-24 21:22 UTC; blocked by the environment
- Missing: “List my Interested features” is unanswered: the marks are only in your browser.
- Request: “List all features … I marked as interested”.
- Questions: Can you export research-decisions-<date>.json?
- Suggested pick: You export research-decisions-<date>.json once; then Claude reconciles it with the ADRs. (estimate: effort 0%, value needs your file)

### G-025: Cross-family composition and room presets

- Status: Open
- Origin: Research, 2026-10-24 21:28 UTC; agent scoped it out
- Missing: No ADR was written for “cross-family composition” or “kitchen / wardrobe / desk as presets”. They were not shown to be already covered.
- Request: The 14 features you selected at 21:28 (context, not a quote)
- Questions: Check each against the app and write ADRs for what is missing?
- Suggested pick: Check each against the app with find-it. Write an ADR for whatever is missing (likely: one project mixing a kitchen run with a desk, and room presets that place several pieces at once). (estimate: effort +30%, value +20%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved; text partly wrong. Cross-family composition was already checked (N48, tools/ensemble/find-it.mjs: base cabinet + wardrobe + daybed). Remaining: built-in room presets that place several pieces; a kitchen run plus a desk in one project not checked.

### G-026: Free-angle rotation

- Status: Open
- Origin: Research, 2026-10-24 21:29 UTC; user decision
- Missing: Free-angle rotation is ruled out by ADR-003/004 (axis-aligned, whole mm).
- Request: “Predictable rotate”.
- Questions: Keep 90-degree turns only (acknowledge)?
- Suggested pick: 90° turns cover “predictable”. Free angles need a new ADR; not recommended unless you have angled rooms.

### G-027: Bottom sheet drag, mode bar, old find-it scripts

- Status: Open
- Origin: ADR-079, 2026-10-24 23:07 UTC; agent scoped it out
- Missing: On a phone the bottom sheet opens only by tapping (no drag). On desktop the mode bar takes a whole row (now two modes, Compose and Build & Preview, since ADR-080). The old find-it scripts (home, ensemble, look-render, materials, shapes, plan-drag at 375 px, and now editor-modes and plan-snap) fail on the new shell.
- Request: “Help with the sticky bars top and bottom, they occupy too much”.
- Questions: Three stops for the sheet (peek, half, full)? Mode switch in the top bar on desktop?
- Suggested pick: Drag handle with three stops (peek, half, full). Move the mode switch into the top bar on desktop. Update the old scripts so every earlier feature is found again in the new shell. (estimate: effort +25%, value +25%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. The old find-it scripts were fixed (N88, G-060 Done). Remaining: the phone sheet still opens only by tap (src/ui/App.tsx:673-681); the desktop mode switch is still its own row.

### G-028: Mobila sample files still in the repo

- Status: Open
- Origin: D02, 2026-10-24 23:15 UTC; agent default, accepted by the user
- Missing: “Built in the app” is gone from the screens, but the Mobila sample files stay in docs/samples/ and the tests. The question was asked and never answered.
- Request: “Remove completely the Built in the app feature”.
- Questions: Delete the files too, keeping only the test fixtures ADR-041 needs?
- Suggested pick: Read literally, “completely” means the files too. Move the samples ADR-041's tests need into tests/fixtures/ and delete the rest. Your call. (estimate: effort +3%, value matches your words)

### G-029: Light acceptance never retired

- Status: Open
- Origin: Light acceptance, 2026-10-24 23:34 UTC; agent scoped it out
- Missing: Your decision to drop light acceptance was never applied. Its ADR sits unmerged on branch ccr-137ce6a6-cq7441, and its numbers ADR-080 and N75 are now taken on main by the Settings ADR. main still allows “Acceptance: light”.
- Request: “Remove the idea of find-it pending, I changed my mind”.
- Questions: Merge the unmerged ADR under the next free numbers, then catch up every pending find-it?
- Suggested pick: Give it the next free ADR and backlog numbers, merge it, then run every pending find-it (see the ADR-080 row). (estimate: effort +5%, value matches your words)

### G-030: Back cut-outs over pipes and outlets

- Status: Open
- Origin: ADR-072, 2026-10-24 23:58 UTC; agent scoped it out
- Missing: No automatic cut-out in a back panel over a pipe or outlet, and no electrical rules. Templates don't keep pipes and outlets. No test for a worktop or plinth over a pipe.
- Request: Pipes and outlets checked against the pieces (context, not a quote)
- Questions: Cut the back as a shaped part at the zone? Templates carry room features?
- Suggested pick: Make the back a shaped part with a rectangular cut-out at the zone (ADR-040 already does shaped parts), listed on the cut list and printed sheet. Templates carry room features. Add the missing test. (estimate: effort +35%, value +30%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): text partly wrong: templates already keep pipes and outlets when the room is included (src/core/projectTemplate.ts:97, :203), untested. Remaining: shaped back with a cut-out, electrical rules, the worktop/plinth-over-pipe test.

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
- Missing: No multi-select or groups. The lounger backrest and daybed side panel can't be mirrored. Mirrored pieces can be ±1 mm off.
- Request: “Duplicate, mirror and predictable rotate operations”.
- Questions: Store a hand side on the lounger and daybed? Symmetric rounding for mirrored copies? Multi-select gesture?
- Suggested pick: Store a hand (left or right) on those two pieces so they mirror. Use symmetric rounding for mirrored copies so they match to the mm. Add multi-select (Shift-click or long-press) for duplicate, mirror and move together. (estimate: effort +40%, value +30%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still valid. Absorbs G-013 (Save selection as template), which needs multi-select.

### G-033: Snapping in the front view and 3D

- Status: Open
- Origin: ADR-070, 2026-10-25 00:07 UTC; agent scoped it out
- Missing: No snapping in the front view or 3D. Snaps are not stored. The “Won't snap” hint is checked only in unit tests.
- Request: “Guided snapping”.
- Questions: Front-view height snaps first (worktop line, wall-unit line)?
- Suggested pick: Front-view snapping to heights (worktop line, wall-unit line), using the same rules. Stored snaps come from the connections ADR above. Add the hint to find-it. (estimate: effort +30%, value +20%)

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
- Missing: No profiled mouldings and no sink or hob cut-outs. Templates don't keep trims or worktops. The ceiling filler has not been made in a browser.
- Request: “Shared worktops”, “fillers, plinths, end panels and trim”, for kitchens.
- Questions: Cut-outs from sizes you enter? Templates carry run requests?
- Suggested pick: Sink and hob cut-outs on the worktop from sizes you enter (no invented appliance sizes), on the cut list and the print. Templates carry run requests. Add a ceiling filler to find-it. (estimate: effort +35%, value +30%)

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
- Missing: No supplier band-list import, tolerances, edgebander settings or band colour matching.
- Request: “Check the European standards for ABS, apply them accordingly”.
- Questions: Import a supplier band list as CSV and match bands to the board decor?
- Suggested pick: No EN standard sets band sizes; that finding stands. Closer: import a band list (CSV, like decors) and match the band to the board's decor code and picture. (estimate: effort +20%, value +20%)

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
- Missing: No Fasteners panel in a project's own Configure view. Fastener lines in the Romanian CSV are in English (breaks ADR-020). No drilling patterns.
- Request: “Hardware and fastener completeness”.
- Questions: Add the project-level panel? Draw drilling positions only from your values?
- Suggested pick: Add the project-level panel. Translate the fastener labels (a bug). Draw drilling positions only from the values you enter, labelled as guidance (ADR-010). (estimate: effort +30%, value +25%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. A piece's Fasteners panel is reachable from a project via Inside this piece › Size, boards and construction (ADR-090). Remaining: Fasteners in the project's own Settings dialog; the Romanian shopping CSV still writes fastener lines and footer in English (src/core/fasteners.ts, src/core/shopping.ts:32-33); drilling patterns.

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
- Missing: The catalog feed (N16) and the brand filter (N14) will not be built: you have no access to IKEA data.
- Request: “Mark 029 as won't do”.
- Questions: Feed the brand filter from your decor imports instead of IKEA (new ADR)?
- Suggested pick: The brand filter could be fed by your Egger / Kronospan decor imports (by manufacturer) instead of IKEA. It would need a new ADR replacing ADR-027's IKEA dependency. (estimate: effort +15%, value +15%)

### G-045: ADR-069 to 079 shipped with open gaps

- Status: Open
- Origin: ADR-069..079, 2026-10-25 10:25 UTC; agent scoped it out
- Missing: Eleven ADRs were shipped (N64 to N74 Done) with the gaps above still open and their open questions unanswered. Find-it was not re-run after the merge, and nothing was checked on the live site.
- Request: “Merge all mergeable, push, list what is left”.
- Questions: Re-run every find-it on main? Answer the open questions above?
- Suggested pick: Re-run every find-it script on the production build of main. Answer the open questions above. Then open one follow-up ADR per group of gaps, so the gaps are tracked and not lost behind Done. (estimate: effort +10%, value +15%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved per N88: every find-it script passed on a local production build after merging main. Remaining: the open questions in G-027 and G-030 to G-042, follow-up ADRs, the live check (G-047).

### G-046: Settings dialog built as light

- Status: Open
- Origin: ADR-080, 2026-10-25 10:31 UTC; agent scoped it out
- Missing: The Settings dialog ADR (Configure moves into a modal, view captions behind an info icon) was built as light acceptance, against your 23:29 decision. N75 is Partially done, “find-it pending”, and not checked in a browser.
- Request: “Add a tooltip icon with the text on hover on desktop and on click on mobile”; earlier, “Remove the idea of find-it pending”.
- Questions: Write and run its find-it now?
- Suggested pick: Write and run its find-it (About the plan, About the front view, Settings, Compose, Build & Preview) at phone and desktop widths, then ship it. (estimate: effort +10%, value +15%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved per N88: tools/editor-modes checks Settings, Compose, Build & Preview (156/156) and tools/plan-snap checks About the plan (50/50). Remaining: no script checks About the front view or Settings for <name>; N75 stays Partially done.

### G-047: Nothing live-verified

- Status: Open
- Origin: Verification, all sessions; blocked by the environment
- Missing: Nothing has been live-verified: the deployed site, a real phone and a screen reader were never checked. github.io is refused by this environment.
- Request: “R1: evidence from the running app the user will use”.
- Questions: Allow chiriacsergiucs-v2.github.io in the environment network policy? Run the phone and screen-reader check together?
- Suggested pick: Allow chiriacsergiucs-v2.github.io in this environment's network policy, so the find-it scripts can run against the live URL. Phone and screen-reader checks need you, about 15 minutes with a short script Claude writes. (estimate: effort +5%, value +20%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still valid (github.io unreachable from this environment). Absorbs G-048: touch and 3D were checked only in Chromium emulation; one guided session on the user's phone covers both.

### G-048: Touch and 3D checked only in emulation

- Status: Done (merged into G-047)
- Origin: Verification, all sessions; blocked by the environment
- Missing: Pieces of the 3D work and the touch features were checked only in desktop Chromium emulation.
- Request: Phone-first (context, not a quote)
- Questions: One guided session on your phone?
- Suggested pick: Same as the row above: one session on your phone, guided by a checklist. (estimate: effort +3%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): merged into G-047 (the same real-phone session).

### G-049: G ids on pre-ADR-082 notes

- Status: Open
- Origin: ADR-082, 2026-10-25; agent scoped it out
- Missing: Backlog notes and ADRs written before ADR-082 do not cite G ids; the seed G-001 to G-048 covers their gaps, but the old text does not link to it.
- Request: “Configure the project so everytime something is "not implemented" it is being saved into adrs folder into "Gaps"”
- Questions: Add G ids to the old backlog Gap notes and Open questions too?
- Suggested pick: Yes: one pass adding the matching G id next to each old Gap note and open question, so every gap is findable from both sides (estimate: effort +15%, value +10%)

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

- Status: Open
- Origin: ADR-083, 2026-10-25, out of scope (Claude)
- Missing: Going one level back up with a gesture (Esc / long press)
- Request: The flow of selecting the furniture, then the middle (given there are 2 dividers), then having a horizontal divider, then selecting the bottom one to adjust shelves is a painful horrible user experience. Adjust the selecting to go from bigger to smaller. 1 click = entire furniture, second click selects the smaller frame, third again the smaller within, iteratively.
- Questions: Is a 'go up one level' gesture wanted besides the breadcrumb?
- Suggested pick: Esc on desktop goes up one level; estimate +5 % work

### G-054: Count stepper not over the 3D view

- Status: Done (ADR-085)
- Origin: ADR-084, 2026-10-25; agent scoped it out
- Missing: No stepper over the 3D view; ADR-014 says the 3D viewer only selects, never edits.
- Request: “Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber - … Placement: above the selected piece”
- Questions: Show the stepper over the 3D view too (needs a new ADR changing ADR-014)?
- Suggested pick: No: the stepper floats over the front drawing, which is shown next to 3D in Both (ADR-081); 3D stays select-only (estimate for 3D: effort +40%, value +10%)

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
- Missing: Open question default: + on dividers adds the new bay at the end (right / bottom) with 2 shelves, like the existing Add button; - removes the last bay with its contents (undo restores it); - at 1 divider leaves one space holding the first bay's contents.
- Request: “Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber - … Placement: above the selected piece”
- Questions: Where does + add and - remove: at the end, or next to the selected bay? What goes in a new bay: empty, or a copy of its neighbour?
- Suggested pick: End, with 2 shelves like the existing Add button (consistent with what the app does today; next-to-selection is estimated +15% effort for +5% value)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved; text out of date. ADR-089 decided a new bay is empty (src/core/counts.ts:89-99), so the 2-shelves default is gone, and ADR-086 changed what + acts on. Still unconfirmed: whether + adds at the end or next to the selection, and what - removes.

### G-057: Acceptance level for the count stepper

- Status: Done (ADR-084)
- Origin: ADR-084, 2026-10-25; agent scoped it out
- Missing: Open question default: full acceptance (find-it script at 390 and 1280 px).
- Request: “Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber - … Placement: above the selected piece”
- Questions: Full find-it acceptance or light (ADR-066)?
- Suggested pick: Full: the request is a visible control and R3 is the default (light saves an estimated 20% effort, adds no value)

### G-058: Quick counts card still covers the 3D model on phones

- Status: Open
- Origin: UI critique 2026-10-26 (N82), finding 3; agent chose not to move the card (it would reverse ADR-084/085)
- Missing: On a phone in Build & Preview the Quick counts card (two rows, ~150 px with 44 px buttons) still covers most of the 3D model; in the drawing the card's band still shifts the drawing down on the first selection
- Request: Fix them directly (findings 1-6 of the UI critique; finding 3: the count card covers the top of the drawing, shows twice in Both). Not a quote for the finding text.
- Questions: Collapse the card to a 'Quick counts' button over 3D on phones? Reserve the card band before the first selection so the drawing never moves?
- Suggested pick: Collapsible card over 3D on phones, open by default, closest to ADR-085's 'same card over 3D' (est. +30 % work vs nothing, +20 % of finding 2/3 value)
- Note: 2026-10-26, ADR-087 (G-070, user "Dock under 3D") docks the phone 3D card under the stage, so it no longer covers the model; the drawing part (the card's band shifting the drawing on the first selection) is still open.

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

### G-075: Results collapse at desktop width too

- Status: Done (ADR-091)
- Origin: ADR-091 open question
- Missing: Unconfirmed default: the results tabs collapse at every width, not only on phones
- Request: They should be a collapsed view, onclick showing only, so the views with renders are kept as main
- Questions: Collapse at desktop width too, or only on phones?
- Suggested pick: Every width: the request names no width and keeps the render views main everywhere
- Answer: User 2026-10-26: "Only phones"; built in ADR-091 (desktop keeps a tab open).

### G-076: Research app records go stale as ADRs ship

- Status: Open
- Origin: ADR-092 (2026-10-26, Claude: not asked for)
- Missing: The research page's app records (src/core/research/ensemble-2026-10-23.app.ts) are not updated when a later ADR ships; the next-adr / ship-adr skills do not touch them, so new work shows as Not Started until someone re-checks.
- Request: Text that is not a quote: follows from "mark implemented ones" (2026-10-26).
- Questions: Should ship-adr update the research app record of the feature an ADR names, or should the research page be re-checked on request only?
- Suggested pick: ship-adr updates the record (closest to keeping 'implemented' marked; about +5 % work per shipped ADR, +100 % of the freshness value; estimates).

### G-077: Free-angle rotation of project pieces

- Status: ADR-121
- Origin: ADR-093 (2026-10-26, the user chose 90° steps)
- Missing: Free-angle rotation of project pieces; pieces still turn in 90° steps (ADR-022/ADR-004 kept).
- Request: "New adr to override the conflicts for 4 and make it ready" (2026-10-26)
- Questions: Override ADR-022/ADR-004 for free angles later?
- Suggested pick: Free angles with oriented-box checks (closest to the research; about 3x the work of ADR-093, +40 % of the feature's value; estimates).

### G-078: Change height by dragging in 3D

- Status: ADR-122
- Origin: ADR-093 (2026-10-26, the user chose floor plane only)
- Missing: Changing a piece's height by dragging in 3D; height comes from placement.
- Request: "New adr to override the conflicts for 4 and make it ready" (2026-10-26)
- Questions: Add a vertical handle later?
- Suggested pick: Keep height from placement (the user's answer); a handle only if asked.

### G-079: Drop a catalog item into the 3D view

- Status: Open
- Origin: ADR-094 (2026-10-26, Claude: not asked for)
- Missing: Dropping a catalog item into the 3D view.
- Request: "New adr 6" (2026-10-26)
- Questions: Drop into 3D too, once ADR-093 exists?
- Suggested pick: Drop onto the 3D floor plane with ADR-093's projection (about +30 % of ADR-094's work, +15 % value; estimates).

### G-080: Piece list open by default on desktop

- Status: Done (ADR-094)
- Origin: ADR-094 open question (2026-10-26)
- Missing: Whether the piece list is open by default on desktop; default closed.
- Request: "New adr 6" (2026-10-26)
- Questions: Open by default on desktop?
- Suggested pick: Closed, opened with Add a piece (keeps the plan wide; open by default costs the same).

### G-081: Lock a piece's sizes and parameters

- Status: ADR-122
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

- Status: ADR-123
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

- Status: ADR-121
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

- Status: ADR-124
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

- Status: ADR-122
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

- Status: Open
- Origin: ADR-100 (2026-10-26, Claude: not asked for)
- Missing: Persistent connections between pieces (research: connection hierarchy / assembly graph); rules apply while snapping and in checks only.
- Request: "New adr 3" (2026-10-26)
- Questions: Store connections so rules hold after placing?
- Suggested pick: Store connections as a graph (about 40 points; makes the engine 'prevent invalid connections' as the research states).

### G-092: User-written compatibility rules

- Status: Open
- Origin: ADR-100 (2026-10-26, Claude: not asked for)
- Missing: Rules the user writes or edits.
- Request: "New adr 3" (2026-10-26)
- Questions: Let users add or edit compatibility rules?
- Suggested pick: Not yet; the rule list is shown read-only (editing rules needs a rule editor, about 25 points).

### G-093: Tolerance for depth and height differences

- Status: Done (ADR-100)
- Origin: ADR-100 open question (2026-10-26)
- Missing: Whether small depth or height differences pass without a warning; default any difference warns.
- Request: "New adr 3" (2026-10-26)
- Questions: Allow a tolerance (mm) before warning?
- Suggested pick: Any difference warns until the user names a tolerance (never invent a physical value, ADR-010).

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
- Missing: UI critique said the catalog counts disagree (118 vs 108, Living room 31 vs 33). a9e5780 added an 'N ready items' label (src/ui/Catalog.tsx:196); nobody has confirmed in a browser that the numbers now agree.
- Request: Run critique this design for the entire ui/ux; then 'Fix them directly' (G-059)
- Questions: None; it is a check.
- Suggested pick: Add a find-it step that compares the catalog total with the sum of its category counts at 390 and 1280 px; fix if they differ. (estimate: effort +2%, value +3%)

### G-096: Empty Brands list promises a cancelled feed

- Status: Open
- Origin: Gap re-check 2026-10-26 (G-044); agent found it
- Missing: When Brands is empty, src/ui/Catalog.tsx:539-540 says 'The weekly catalog feed (Mondays, IKEA first) adds them once it can reach the manufacturers' sites.' That feed was cancelled (ADR-027/029/052 Deferred, won't do), so the text is misleading.
- Request: Catalog feed and brand filter (G-044) (context, not a quote)
- Questions: Replace the text with how brand products get in today (import), or hide the Brands source while it is empty?
- Suggested pick: Replace the text with what is true now: no brand products are bundled; import your own. Closest to the current app; no new feature. (estimate: effort +1%, value +3%)

### G-097: Fastener notes point to a removed screen

- Status: Open
- Origin: Gap re-check 2026-10-26 (G-042); agent found it
- Missing: The shopping-list footer (src/core/shopping.ts:33) and fastener guidance (src/core/fasteners.ts:298) tell the user to go to 'Materials › Fasteners', which no longer exists since ADR-080 moved Configure into the Settings dialog.
- Request: Hardware and fastener completeness (G-042) (context, not a quote)
- Questions: None; it is a wording bug. Fix together with the Romanian labels in G-042?
- Suggested pick: Point both to the current path (Settings › Fasteners, or the piece's Size, boards and construction), and translate them in the Romanian CSV with G-042. (estimate: effort +1%, value +3%)

### G-098: ADR-082 still Pending though built

- Status: Done (ec9c7a8)
- Origin: Gap re-check 2026-10-26; agent found it
- Missing: The gaps ledger (docs/adr/GAPS.md), pnpm gaps and the Stop hook exist and are in use, but ADR-082 is still Pending in docs/adr/ and was never shipped.
- Request: Gaps ledger (ADR-082, user rule 2026-10-25) (context, not a quote)
- Questions: Ship ADR-082 now (ship-adr), after checking its Done-when list?
- Suggested pick: Check ADR-082's Done-when list against the repo, then ship it with ship-adr. (estimate: effort +2%, value +2%)

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
- Missing: The page cannot write docs/adr/GAPS.md; decisions go through Claude via Copy decisions, and the page shows the ledger of the deployed build.
- Request: Items “can be used to add as a new adr or mark as acknowledged and accepted” (G-050)
- Questions: None while ADR-002 holds.
- Suggested pick: Keep the hand-over to Claude (estimate for a GitHub-token write path: effort +60%, value +15%, and it breaks ADR-002)

### G-102: Alternatives for a piece that sits on another piece

- Status: Done (user answer 2026-10-26 "Same width only for stacked pieces")
- Origin: ADR-098 implementation (2026-10-26, Claude: defaulted)
- Missing: Which catalog items count as the same placement kind for a piece placed on or above another piece; built: every standing and wall-hung item (the piece keeps its on-another-piece placement).
- Request: New adr 5 (2026-10-26): compatible = same placement kind (floor, wall, on another piece)
- Questions: For a piece on another piece, offer every item, or only standing items, or only items of the same family?
- Suggested pick: Every item, since the placement carries over (as built; narrowing to standing items is about +5 % of ADR-098's work)

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
- Missing: Move mode drags project pieces only; display-only 3D models (ADR-076) still move by their fields or on the Plan.
- Request: New adr to override the conflicts for 4 and make it ready
- Questions: Should Move in 3D also drag and turn display-only 3D models?
- Suggested pick: Yes, the same Move and Turn (closest to direct manipulation in 2D/3D; about +15 % work for +10 % of the request, estimates).

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

### G-108: Multi-select in the front view and 3D

- Status: Open
- Origin: ADR-097 (2026-10-26, Claude: scoped while building)
- Missing: Shift/Ctrl/Cmd-click adds pieces to the selection on the plan and in the project's piece list; in the room front view and in 3D a click still selects one piece.
- Request: New adr 2 (2026-10-26): Desktop: Shift- or Ctrl/Cmd-click adds or removes a piece
- Questions: Add Shift/Ctrl-click to the room front view and to 3D too?
- Suggested pick: Yes, the same toggle in both views (about +10 % of ADR-097's work, +10 % value; estimates).

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

- Status: Open
- Origin: ADR-103, 2026-10-27; Claude scoped it out
- Missing: Fill a wall works on one straight wall only; corner and L-shaped walls are not filled.
- Request: a reverse furniture building, total width, to the mix of furniture pieces that fill that space (context: corners not mentioned)
- Questions: Should Fill a wall also fill corner or L walls, with a corner cabinet at the joint?
- Suggested pick: Fill each straight wall with ADR-103, then join two walls with a catalog corner cabinet (ADR-025). (estimate: effort +40%, value +15%)

### G-114: Fill a wall: room openings shape the mix

- Status: Open
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

### G-125: Width and depth card over the project view for a selected piece

- Status: Done (ADR-109)
- Origin: ADR-106
- Missing: In a project, a piece selected but not opened (Inside this piece) gets Width and Depth in its Selected piece card only; no floating card over the project drawing or 3D (the quick-count card shows there only for an opened piece, ADR-088).
- Request: Add the posibility to change width/depth when whole cabinet or whole piece is selected; answer: Card + side panel
- Questions: Should a selected project piece also get a floating Width/Depth card over the project plan, elevation and 3D?
- Suggested pick: Yes, a floating card over the project views (closest to 'Card + side panel'; estimate +60 % work, +15 % of value)

### G-126: No width/depth fields for a bed or a set of loose panels

- Status: Open
- Origin: ADR-106
- Missing: A bed's size comes from its mattress and a set of loose panels has no outside size, so neither shows Width/Depth when selected; a filler/cover panel shows Width only (it has no depth).
- Request: Add the posibility to change width/depth when whole cabinet or whole piece is selected
- Questions: Should a bed show its mattress size there instead, and loose panels nothing?
- Suggested pick: Bed: show the mattress width and length there (closest to the request; estimate +10 % work, +5 % of value)

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

### G-130: jsdom find-it cannot check layout

- Status: Open
- Origin: ADR-108 (Open question)
- Missing: jsdom applies no CSS, so the 390 px no-side-scroll rule and bounding-box checks are not tested by the default find-it
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Which ADRs must still run the browser script for layout?
- Suggested pick: ADRs that change layout or CSS set Acceptance browser; others stay jsdom

### G-131: jsdom find-it cannot render the 3D view

- Status: Open
- Origin: ADR-108 (Out of scope)
- Missing: The three.js viewer does not render in jsdom; 3D features are not found by the default find-it
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Should ADRs that touch the 3D view always use Acceptance browser?
- Suggested pick: Yes: ADRs touching the 3D view or Move mode use browser

### G-132: Existing browser find-it scripts are not ported to jsdom

- Status: Open
- Origin: ADR-108 (Out of scope)
- Missing: The 42 tools/*/find-it.mjs scripts stay; no jsdom versions for shipped ADRs
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Port any of them?
- Suggested pick: No; keep them as the browser regression set

### G-133: Light ADR catch-up mode after ADR-108

- Status: Open
- Origin: ADR-108 (Open question)
- Missing: Undecided whether catch-up acceptance for light ADRs runs jsdom or the browser script
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Catch up acceptance with jsdom or browser?
- Suggested pick: jsdom, unless the ADR is layout or 3D

### G-134: Clearances wraps to a second row of the project plan toolbar on a phone

- Status: Done (ADR-112)
- Origin: ADR-109
- Missing: At 390 px the plan toolbar holds Doors and fronts, Snap and Select on one row; Clearances wraps to a second row.
- Request: i dont see doors text moved with other; answer: Same row as Snap (Recommended)
- Questions: Should all four plan controls fit one row on a phone (shorter labels or icons), or is the wrap fine?
- Suggested pick: Keep the wrap (closest to the request: Doors and fronts is in Snap's row); one row would need shorter labels (estimate +20 % work, +5 % of value)

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

### G-145: Phone catalog cards cut text with no way to read it

- Status: Done (ADR-119)
- Origin: ADR-118 (found while building)
- Missing: At 390 px each catalog card's text lines (variant names, sizes/parts line, 'You choose: …') are cut to one line with an ellipsis and cannot be expanded; source and grouping switches read 'Saved', 'Room', 'Type'; room chips and 'also called' moved behind 'About this family'; wizard Cancel removed at every width
- Request: Run a critique for listings, headers, text, button sizes, gaps, groupings; answer Catalog density + wizard
- Questions: Should cut card text expand on tap (or show in the item detail), and are the short labels and Cancel removal fine?
- Suggested pick: Full text in the item's detail view on tap (closest to the request: compact list, nothing unreachable; estimate +10 % work, +10 % of value)

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

### G-149: Typed rotation: exact checks or bounding boxes

- Status: ADR-121
- Origin: ADR-121 (open question)
- Missing: Typed rotation in whole degrees is not built; every check, snap and drawing assumes axis-aligned boxes (quarter turns only)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Any whole degree with exact rotated-box checks, any whole degree with each turned piece checked by its enclosing box, or a typed field limited to 0/90/180/270?
- Suggested pick: Any whole degree with exact rotated-box checks (closest to the research's typed rotation; estimate +60 % work over enclosing boxes, +25 % of value: no false overlap errors)

### G-150: Review pack: what it holds and how it leaves the device

- Status: ADR-121
- Origin: ADR-121 (open question)
- Missing: No single package to hand a project to a professional for review
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Contents (project file, parts CSV, SVG drawings, a printable HTML summary) and delivery: a .zip download, the device Share sheet with download fallback, or print only?
- Suggested pick: A .zip download plus the device Share sheet where offered (closest to handing a plan over; Share hands files to the OS, the app makes no request; estimate +15 % work, +20 % of value)

### G-151: Align Top/Bottom with floor pieces selected

- Status: Open
- Origin: ADR-122 (open question)
- Missing: Align Top and Bottom do not exist; a floor piece's height cannot move without resizing it
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Skip floor pieces and say why, or resize them to reach the line?
- Suggested pick: Skip them and say why (alignment moves pieces, as ADR-099; resizing is a separate action)

### G-152: Size lock: separate or part of Lock

- Status: Open
- Origin: ADR-122 (open question)
- Missing: A piece's sizes cannot be locked (G-081)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: A separate Lock size toggle, or one Lock that covers position and size?
- Suggested pick: Separate Lock size (the research names locked parameters apart from pinned positions; estimate +10 % work, +15 % of value)

### G-153: Height drag in 3D: which pieces

- Status: Open
- Origin: ADR-122 (open question)
- Missing: No vertical drag in 3D Move mode (G-078)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Only wall-placed pieces, or also floor pieces (which would then become raised)?
- Suggested pick: Wall-placed pieces only (height comes from placement, ADR-031; floor pieces stay on the floor)

### G-154: Section view: which cut planes

- Status: Open
- Origin: ADR-122 (open question)
- Missing: No section, cutaway or isolate in the 3D view
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: One front-to-back cut, or a cut along any of the three axes?
- Suggested pick: Any of the three axes (closest to 'cut through the ensemble'; estimate +15 % work, +20 % of value)

### G-155: Project versions: when one is kept

- Status: ADR-123
- Origin: ADR-123 (open question)
- Missing: No history of older project versions (G-083)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Automatic (one version each time a project is opened for editing, plus Save a version by hand), by hand only, or on every change?
- Suggested pick: Automatic per editing session plus by hand (closest to 'stronger recovery': nothing to remember; estimate +10 % work, +30 % of value)

### G-156: Project versions: how many are kept

- Status: ADR-123
- Origin: ADR-123 (open question)
- Missing: Keeping versions grows storage; removing old ones deletes saved data, which needs the user's decision (ADR-012)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Keep every version until the user deletes it, or keep the last N and drop older ones automatically?
- Suggested pick: Keep every version until the user deletes it (nothing deleted without the user, ADR-012)

### G-157: Undo log: labelled snapshots or inverse commands

- Status: ADR-123
- Origin: ADR-123 (open question)
- Missing: Undo is a list of unlabelled snapshots; no named steps, no step list, no explicit transactions
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Labelled snapshots grouped into transactions, or a log of inverse commands?
- Suggested pick: Labelled snapshots grouped into transactions (gives the named log and atomic steps the research describes; inverse commands estimate +80 % work, under +5 % of value)

### G-158: Style suggestions: where they come from

- Status: ADR-123
- Origin: ADR-123 (open question)
- Missing: No style or material suggestions
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Built-in named styles (board and handle combinations from the shipped lists), combinations from the user's own projects, or both?
- Suggested pick: Both (estimate +30 % work over built-in only, +40 % of value: suggestions match what the user actually uses)

### G-159: Design codes: link or text

- Status: Open
- Origin: ADR-124 (open question)
- Missing: No code to share or reopen a design or project elsewhere
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: A link that opens the app with the design, plus the text code, or the text code only?
- Suggested pick: Link plus text code (closest to IKEA-style codes that reopen a design; estimate +10 % work, +25 % of value)

### G-160: Replace: which own edits carry over

- Status: Open
- Origin: ADR-124 (open question)
- Missing: Replacing a piece drops its own edits (G-087)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Every changed setting that also exists on the new design (listing the rest), or only size and boards?
- Suggested pick: Every changed setting that exists on the new design, with a list of what could not carry (closest to G-087; estimate +40 % work, +50 % of value)

### G-161: Template references: default and fallback

- Status: Open
- Origin: ADR-124 (open question)
- Missing: Project pieces are full copies (ADR-022); none refers to its template and stores only its changes
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: New catalog pieces refer to their template with a kept copy as fallback, refer with no copy (only changes stored), or opt in per piece?
- Suggested pick: Refer by default and keep a copy as fallback (closest to the research while a missing template never loses a piece, ADR-012; estimate +20 % work over no copy, same value)

### G-162: Project-wide settings: which ones

- Status: Open
- Origin: ADR-124 (open question)
- Missing: No project-wide parameters that every piece follows unless it overrides them
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Which settings: carcass, front and back boards and banding; handle type; front overlay; plinth height — all, or a subset?
- Suggested pick: All of them (the settings the catalog families share; estimate +40 % work over boards only, +60 % of value)

### G-163: Run sinks: what is generated

- Status: ADR-125
- Origin: ADR-125 (open question)
- Missing: Sinks are not generated for a run
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: A sink cut-out in the run worktop over a chosen base, sized by the user, plus a shopping line — or a sink as a 3D item too?
- Suggested pick: Cut-out sized by the user, a cut-list note and a shopping line (no sink sizes invented, ADR-010)

### G-164: Run handles: where the line sits

- Status: ADR-125
- Origin: ADR-125 (open question)
- Missing: Handles are chosen per piece; nothing lines them up across a run
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: One handle type and one height line for every front in the run: line at the top of fronts, centred, or a height in mm the user enters?
- Suggested pick: A height in mm the user enters, with top-of-front as a one-tap choice (closest to a generated, aligned handle line)

### G-165: Rapier: trial or adopt

- Status: ADR-125
- Origin: ADR-125 (open question)
- Missing: No spatial query engine; checks are hand-written box tests
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Run a measured trial (decision recorded, nothing shipped unless it wins), or adopt Rapier for the checks now?
- Suggested pick: Measured trial first (the research says 'evaluate'; a new WASM dependency needs its licence, size and offline behaviour checked)

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

### G-190: Versions of a deleted project

- Status: Open
- Origin: ADR-123 (found while building)
- Missing: Deleting a project leaves its kept versions on the device; nothing lists or removes them (G-156: nothing removes versions without the user)
- Request: Accept default, /batch all ready (G-156: keep every version until the user deletes it)
- Questions: When a project is deleted, ask whether to delete its versions too, keep them silently, or list orphaned versions somewhere to restore or delete?
- Suggested pick: Ask on delete, defaulting to keep (closest to G-156: nothing removed without the user's decision)

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
