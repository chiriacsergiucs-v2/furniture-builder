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

### G-002: Decor list not in exports

- Status: Open
- Origin: ADR-048, 2026-10-24 08:27 UTC; agent scoped it out
- Missing: The decor list is not in exported files. It has to be imported again on each device.
- Request: “Render the furniture according to the selected material's color and structure”, then “any image as color/background for the material”.
- Questions: Embed only the decors a design uses, or offer the whole list too?
- Suggested pick: Embed the decors a design uses in its export (the pictures already are), plus an optional “Include my whole decor list” checkbox. Needs a schemaVersion bump with old readers kept. (estimate: effort +10%, value +10%)

### G-003: Materials fields overlap at 375 px

- Status: Open
- Origin: ADR-048, 2026-10-24 08:27 UTC; agent scoped it out
- Missing: At 375 px, Materials “Thickness” overlaps “Has grain”. Not re-checked since ADR-079 moved Materials inline.
- Request: Phone-first (CLAUDE.md: no overlap or sideways scroll at 390 px) (context, not a quote)
- Questions: None; it is a bug.
- Suggested pick: Re-check at 375 px and fix the field grid. It is a bug, not a choice. (estimate: effort +1%, value +3%)

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

- Status: Open
- Origin: ADR-060, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: A template can only be made from a whole project, not from selected pieces.
- Request: Reusable project templates (context, not a quote)
- Questions: Build together with multi-select (G-032)?
- Suggested pick: “Save selection as template”. It needs multi-select, which ADR-069 also left out, so build both together. (estimate: effort +15%, value +10%)

### G-014: Undo across reloads and in the library

- Status: Open
- Origin: ADR-051, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: Undo is lost on reload, and there is no undo in the library (deleting saved pieces).
- Request: Undo and redo for project changes (context, not a quote)
- Questions: Keep undo per project on the device? A 30-day Recently deleted list for the library?
- Suggested pick: Keep the undo stack per project in IndexedDB (new Dexie version). Make library deletes go to a 30-day “Recently deleted” list instead of being final. (estimate: effort +20%, value +15%)

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

### G-019: Textures in Realistic mode

- Status: Open
- Origin: ADR-067, 2026-10-24 19:55 UTC; agent default, accepted by the user
- Missing: No textures, so Realistic mode uses plain finishes (matte, satin, gloss).
- Request: “Realistic looks … rendering high quality 3D designs … to sell designed kitchens”.
- Questions: Use your own board pictures (ADR-048) as textures?
- Suggested pick: Use your own board pictures (ADR-048) as textures in Realistic mode, to scale with the grain direction. This needs no bundled files and no licence question. (estimate: effort +20%, value +35%)

### G-020: Appliances, sinks, edge profiles, client sheet

- Status: Open
- Origin: ADR-067/068, 2026-10-24 19:55 UTC; agent default, accepted by the user
- Missing: No appliances, sinks or worktop edge profiles. No client sheet with render and price.
- Request: “To sell designed kitchens”.
- Questions: Client sheet first? Which licence for bundled appliance models (CC0)?
- Suggested pick: Client sheet: one printable page with the PNG render, the piece list and the ADR-062 price. Appliances come through ADR-076 imports plus a few CC0 models once you pick that licence. Edge profiles: three profile choices drawn on the worktop. (estimate: effort +45%, value +40%)

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

### G-023: No outline on selection in Realistic mode

- Status: Open
- Origin: ADR-067, 2026-10-24 20:59 UTC; agent scoped it out
- Missing: In Realistic mode a selected piece shows only a green tint, with no outline.
- Request: Select pieces in 3D (ADR-014) (context, not a quote)
- Questions: None; add the outline pass.
- Suggested pick: Add an outline pass in Realistic mode, the same as Preview mode. (estimate: effort +5%, value +5%)

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

### G-031: ADR-072 defaults unconfirmed

- Status: Open
- Origin: ADR-072, 2026-10-24 23:58 UTC; agent default, accepted by the user
- Missing: Unconfirmed defaults: a tall unit is 1,600 mm or more; a zone reaches 50 mm from the wall.
- Request: Pipes and outlets checked against the pieces (context, not a quote)
- Questions: Is a tall unit 1,600 mm or more? Does a zone reach 50 mm from the wall?
- Suggested pick: Confirm them, or give your values. (estimate: effort 0%, value needs you)

### G-032: Multi-select, fixed-hand mirroring, 1 mm drift

- Status: Open
- Origin: ADR-069, 2026-10-25 00:01 UTC; agent scoped it out
- Missing: No multi-select or groups. The lounger backrest and daybed side panel can't be mirrored. Mirrored pieces can be ±1 mm off.
- Request: “Duplicate, mirror and predictable rotate operations”.
- Questions: Store a hand side on the lounger and daybed? Symmetric rounding for mirrored copies? Multi-select gesture?
- Suggested pick: Store a hand (left or right) on those two pieces so they mirror. Use symmetric rounding for mirrored copies so they match to the mm. Add multi-select (Shift-click or long-press) for duplicate, mirror and move together. (estimate: effort +40%, value +30%)

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

### G-042: Project fasteners panel and Romanian labels

- Status: Open
- Origin: ADR-074, 2026-10-25 00:16 UTC; agent scoped it out
- Missing: No Fasteners panel in a project's own Configure view. Fastener lines in the Romanian CSV are in English (breaks ADR-020). No drilling patterns.
- Request: “Hardware and fastener completeness”.
- Questions: Add the project-level panel? Draw drilling positions only from your values?
- Suggested pick: Add the project-level panel. Translate the fastener labels (a bug). Draw drilling positions only from the values you enter, labelled as guidance (ADR-010). (estimate: effort +30%, value +25%)

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

### G-046: Settings dialog built as light

- Status: Open
- Origin: ADR-080, 2026-10-25 10:31 UTC; agent scoped it out
- Missing: The Settings dialog ADR (Configure moves into a modal, view captions behind an info icon) was built as light acceptance, against your 23:29 decision. N75 is Partially done, “find-it pending”, and not checked in a browser.
- Request: “Add a tooltip icon with the text on hover on desktop and on click on mobile”; earlier, “Remove the idea of find-it pending”.
- Questions: Write and run its find-it now?
- Suggested pick: Write and run its find-it (About the plan, About the front view, Settings, Compose, Build & Preview) at phone and desktop widths, then ship it. (estimate: effort +10%, value +15%)

### G-047: Nothing live-verified

- Status: Open
- Origin: Verification, all sessions; blocked by the environment
- Missing: Nothing has been live-verified: the deployed site, a real phone and a screen reader were never checked. github.io is refused by this environment.
- Request: “R1: evidence from the running app the user will use”.
- Questions: Allow chiriacsergiucs-v2.github.io in the environment network policy? Run the phone and screen-reader check together?
- Suggested pick: Allow chiriacsergiucs-v2.github.io in this environment's network policy, so the find-it scripts can run against the live URL. Phone and screen-reader checks need you, about 15 minutes with a short script Claude writes. (estimate: effort +5%, value +20%)

### G-048: Touch and 3D checked only in emulation

- Status: Open
- Origin: Verification, all sessions; blocked by the environment
- Missing: Pieces of the 3D work and the touch features were checked only in desktop Chromium emulation.
- Request: Phone-first (context, not a quote)
- Questions: One guided session on your phone?
- Suggested pick: Same as the row above: one session on your phone, guided by a checklist. (estimate: effort +3%, value +10%)

### G-049: G ids on pre-ADR-082 notes

- Status: Open
- Origin: ADR-082, 2026-10-25; agent scoped it out
- Missing: Backlog notes and ADRs written before ADR-082 do not cite G ids; the seed G-001 to G-048 covers their gaps, but the old text does not link to it.
- Request: “Configure the project so everytime something is "not implemented" it is being saved into adrs folder into "Gaps"”
- Questions: Add G ids to the old backlog Gap notes and Open questions too?
- Suggested pick: Yes: one pass adding the matching G id next to each old Gap note and open question, so every gap is findable from both sides (estimate: effort +15%, value +10%)

### G-050: No gaps page in the app

- Status: Open
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

### G-059: UI critique findings 7-20 not fixed

- Status: Open
- Origin: UI critique 2026-10-26 (N82); the user asked to fix findings 1-6 only
- Missing: Findings 7-20 and the minor ones: one-yellow rule broken (Create project, New piece, Next, Done, catalog Open, active nav), desktop left panel titled Compose in Build & Preview, whole-piece editing split across card / Settings / Edit the interior, catalog counts disagree (118 vs 108, Living room 31 vs 33), wall cabinets first under Living room, Romanian subtitles in the English UI, Projects row Delete icon wraps to its own line, white band behind the catalog filter row, steps rail cut off at 390 px, empty project shows blank 3D and 'No problems found', crowded catalog header on phones, '1 shelf' label over the door line, brand mark looks like a menu, unexplained I/C badges, wizard asks size before type, Skip unclear, empty phone app bar on Projects/Catalog, hardware Item column wraps, repeated 'Edge band: not named yet', 'Clean up unused pictures' as prominent as Import
- Request: Run critique this design for the entire ui/ux; then 'Fix them directly' (answered for findings 1-6)
- Questions: Which of these to fix next, and in what order?
- Suggested pick: Fix 13, 14, 16, 18 next (layout bugs and a misleading message, closest to a broken UI; est. small each)

### G-060: Five find-it scripts stale since ADR-080

- Status: Open
- Origin: Found 2026-10-26 while checking N82; predates it (same failures on main 4b1141b)
- Missing: Five find-it scripts are stale since ADR-080: look-render (waits for a 'Materials' button), editor-modes (expects a 'Configure' mode), trims (radio 'Configure'), clearances ('Chair space depth' not found), plan-snap (no status in the room plan)
- Request: Not a user request: R3 requires find-it scripts to pass against the production build
- Questions: Update the five scripts to the ADR-080 layout (Settings dialog instead of Configure/Materials)?
- Suggested pick: Update all five scripts to the current UI (est. small each; restores R3 evidence for ADR-067/068, ADR-079, trims, clearances, plan snap)

### G-061: Dragging pieces never tried in a browser

- Status: Open
- Origin: ADR-065, 2026-10-24 19:10 UTC; user decision
- Missing: Dragging a piece on the plan (mouse, touch, arrow keys) is merged and deployed but was never tried in a browser; find-it was skipped. N60 says Done while its text says not verified.
- Request: “Skip find-it for this onw”
- Questions: Run a find-it for dragging now, or keep N60 as Partially done until someone tries it?
- Suggested pick: Add a find-it: mouse drag at 1440 px changes From left, Undo restores; touch drag at 375 px with no sideways scroll; set N60 by the result. (estimate: effort +3%, value +6%)
