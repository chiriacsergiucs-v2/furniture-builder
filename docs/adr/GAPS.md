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
- list open gaps by title: `pnpm gaps list`;
- mark the gaps of shipped ADRs Done: `pnpm gaps sync`.

**Fields of each gap:**

- Heading: the gap's name. Its title, used when listing, is `G-NNN HH:MM Name` (ADR-151).
- `Id`: a UUID, the gap's key. Never changes.
- `Number`: `G-NNN HH:MM`, the next free number and the UTC hour and minute it was added (gaps before
  ADR-151 have 12:00). ADRs, the backlog and replies cite the `G-NNN`; two branches may add the same one.
- `Origin`: the ADR or area, when, and who chose the gap.
- `Request`: the user's words. Text that is not a quote says so.
- `Suggested pick`: the option closest to the request, with estimates (`CLAUDE.md`, rule of 2026-10-25).

## Gaps

### Board pictures only in 3D

- Id: 2548bd9c-da0e-45fc-852e-9e142fd899db
- Number: G-001 12:00
- Status: Open
- Origin: ADR-048, 2026-10-24 06:54 UTC; agent scoped it out
- Missing: Board pictures show only in 3D and the inspector. Cut sheets, the plan, catalog pictures and the front-view SVG download use a plain average colour. Doors and drawer fronts in the front view are outlines only.
- Request: “Render the furniture according to the selected material's color and structure”, then “any image as color/background for the material”.
- Questions: Fill which drawings with the picture: plan, front view, SVG download, catalog pictures, cut sheets?
- Suggested pick: Fill every 2D drawing with the picture as an SVG <pattern> (the data URL is already stored), rotated with the grain. Fill fronts in the front view. Use the same fill in catalog snapshots and the SVG download. Cut sheets keep a light tint, for legibility when printed. (estimate: effort +30%, value +25%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): text partly wrong. The front view already fills carcass panels with the picture, rotated with the grain (src/ui/Elevation.tsx:51-61, :147-164, since 009173a). Still plain colour: fronts in the front view (outlines), the SVG download (patterns stripped, src/ui/shell/files.ts:30-34), catalog snapshots (src/core/snapshot.ts:266), the plan and cut sheets.

### Decor list not in exports

- Id: 93f545bf-b2e8-4b3b-b695-349ac71a93cb
- Number: G-002 12:00
- Status: Open
- Origin: ADR-048, 2026-10-24 08:27 UTC; agent scoped it out
- Missing: The decor list is not in exported files. It has to be imported again on each device.
- Request: “Render the furniture according to the selected material's color and structure”, then “any image as color/background for the material”.
- Questions: Embed only the decors a design uses, or offer the whole list too?
- Suggested pick: Embed the decors a design uses in its export (the pictures already are), plus an optional “Include my whole decor list” checkbox. Needs a schemaVersion bump with old readers kept. (estimate: effort +10%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): origin is ADR-049 (the decor list, Dexie v6 decors), not ADR-048. Boards made from decors already travel in exported files with their code (src/core/materials.ts:286-293). Only exporting the whole decor list remains.

### Materials fields overlap at 375 px

- Id: 83273351-d0ab-455d-bac2-027081dfca93
- Number: G-003 12:00
- Status: Open
- Origin: ADR-048, 2026-10-24 08:27 UTC; agent scoped it out
- Missing: At 375 px, Materials “Thickness” overlaps “Has grain”. Not re-checked since ADR-079 moved Materials inline.
- Request: Phone-first (CLAUDE.md: no overlap or sideways scroll at 390 px) (context, not a quote)
- Questions: None; it is a bug.
- Suggested pick: Re-check at 375 px and fix the field grid. It is a bug, not a choice. (estimate: effort +1%, value +3%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still likely (not checked in a browser): the phone materials row is 36px 1fr (src/styles.css:2333-2335). Materials now lives in the Settings dialog (ADR-080, src/ui/Settings.tsx), not inline.

### Oxlint as in reserv

- Id: bea31038-5b79-4fa8-8249-e6fca5096e7a
- Number: G-004 12:00
- Status: Open
- Origin: ADR-053, 2026-10-24 15:25 UTC; agent scoped it out
- Missing: Linting stayed on ESLint; reserv uses oxlint.
- Request: “All three”: ADR format, skills and CI the same as reserv.
- Questions: Switch to oxlint now, or keep ESLint on purpose (then acknowledge)?
- Suggested pick: Switch to oxlint with reserv's config, and keep ESLint only for any rule oxlint lacks. (estimate: effort +5%, value +5%)

### Fusion export never run in Fusion

- Id: 2a416de0-f918-47bf-984f-a78e64f7fdc1
- Number: G-005 12:00
- Status: Open
- Origin: ADR-021, 2026-10-24 15:37 UTC; blocked by the environment
- Missing: The Fusion 360 export has never been run inside Fusion (N03).
- Request: Export to Fusion 360 (context, not a quote)
- Questions: Can you run the script once in Fusion 360 on two sample designs?
- Suggested pick: You run the script once in Fusion on two sample designs. Claude adds a checklist of what to compare (part count, sizes, names). (estimate: effort +2%, value +15%)

### Server-only research features

- Id: 1acf9250-6cad-427e-ba8b-c90127cb1f09
- Number: G-006 12:00
- Status: Open
- Origin: Research, 2026-10-24 15:37 UTC; user decision
- Missing: Personal codes for saved designs, online model libraries and a live cross-brand catalogue would need a server, which ADR-002 forbids.
- Request: Research features (context, not a quote)
- Questions: Keep ruled out by ADR-002 (acknowledge), or open a new ADR to change ADR-002?
- Suggested pick: Keep these out unless you decide to change ADR-002. It is listed here only so you know they are not available.

### Connector engine and stored connections

- Id: 3097ca76-48c8-422d-bde7-26f5eacd5929
- Number: G-007 12:00
- Status: Open
- Origin: Research, 2026-10-24 15:42 UTC; agent default, accepted by the user
- Missing: The high-effort group was set aside as “leave for later”: compatibility engine, semantic connectors, assembly graph, composition layer, connector authoring. ADR-070 snaps only to edges and walls.
- Request: “Verify, then Quick wins, then Medium effort”; later “guided snapping” and “cross-family composition”.
- Questions: Write one ADR for stored connections between pieces (side by side, on top, in corner, against wall)?
- Suggested pick: One ADR for stored connections between pieces (side by side, on top, in corner, against wall). Snap, Mirror a run, run parts and Merge would all read them, so pieces move together and the plan explains why. (estimate: effort +60%, value +35%)

### AR, plan review, shared structural elements

- Id: f929b096-fe60-4637-a689-e27cbdb2d2d4
- Number: G-008 12:00
- Status: Open
- Origin: Research, 2026-10-24 15:42 UTC; agent default, accepted by the user
- Missing: AR placement, professional plan review and shared structural elements were also set aside as “leave for later”.
- Request: Features from the competitor research (context, not a quote)
- Questions: Which first: WebXR AR, a review pack, or shared side panels?
- Suggested pick: AR: WebXR with the existing three.js scene (Android Chrome, offline, no new service), plus a USDZ export for iPhone Quick Look. Review: a “review pack” of print sheets plus the design file. Shared elements: one shared side panel between touching cabinets, building on ADR-047. (estimate: effort +50%, value +20%)

### Supplier feeds and ordering

- Id: 152c4f89-2d93-484a-a44b-d943f7dc86a5
- Number: G-009 12:00
- Status: Open
- Origin: ADR-063, 2026-10-24 15:51 UTC; user decision
- Missing: Supplier price feeds, live stock and ordering are Deferred. They need a paid service and a change to ADR-002.
- Request: “Put to pending any that require non-free services”.
- Questions: Build the offline step (supplier price-file column maps and order files)? Which suppliers first?
- Suggested pick: An offline middle step that needs no service: a column map for each supplier's own price-list file (Egger, Kronospan, Kastamonu, Fundermax) into the ADR-062 price list, and an order file per supplier from the shopping list. This covers most of the value with no backend. (estimate: effort +25%, value +40% of what live feeds give)

### Worktop joints and corner runs

- Id: 814ef509-b03a-4cdd-ad13-39445cb96081
- Number: G-010 12:00
- Status: Open
- Origin: ADR-054, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: No worktop joints and no corner runs. Out of scope.
- Request: Kitchen runs with plinth, filler, sink front (context, not a quote)
- Questions: Mitred or butt joint as the default? Corner runs first?
- Suggested pick: Corner runs: an L run where the worktop is mitred or butt-jointed (the user picks), with the joint drawn on the plan and listed in the cut list. Corner cabinets already exist (ADR-025). (estimate: effort +40%, value +30%)

### Handle projection and exact swing arcs in the check

- Id: 5bb566a8-0213-498e-a4a7-040a8f60a801
- Number: G-011 12:00
- Status: Open
- Origin: ADR-057, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: No handle projection; door swings are not exact arcs in the check (drawn arcs were fixed, the check still uses a box).
- Request: Opening clearance for doors, drawers, flaps (context, not a quote)
- Questions: Use the handle depth from the handle schedule and the real arc on the hinge side?
- Suggested pick: Check the real quarter-circle on the hinge side plus the handle depth from the handle schedule (ADR-024). This also unblocks the ADR-071 “reverse the hinge” repair. (estimate: effort +25%, value +20%)

### Angled walls and plan tracing

- Id: 64515578-8869-451b-b948-c3576d262156
- Number: G-012 12:00
- Status: Open
- Origin: ADR-058/059, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: No angled walls, no tracing over a picture of a plan.
- Request: Room and floor plan (context, not a quote)
- Questions: Tracing over a picture now? Angled walls need a new ADR against ADR-003/004; wanted?
- Suggested pick: Tracing: put a picture of your plan under the drawing at a scale you set from one known wall, then draw over it. Angled walls clash with ADR-003/004 (axis-aligned) and would need a new ADR; ask first. (estimate: effort +20% (tracing), value +15%)

### Templates from selected pieces

- Id: b96dbac5-5ecf-41bb-9ded-7d9c1ebef0cb
- Number: G-013 12:00
- Status: Done (merged into G-032)
- Origin: ADR-060, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: A template can only be made from a whole project, not from selected pieces.
- Request: Reusable project templates (context, not a quote)
- Questions: Build together with multi-select (G-032)?
- Suggested pick: “Save selection as template”. It needs multi-select, which ADR-069 also left out, so build both together. (estimate: effort +15%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): merged into G-032 (it needs multi-select).

### Undo across reloads and in the library

- Id: 17cbdb15-08b3-4819-a42c-c173dc84a520
- Number: G-014 12:00
- Status: Open
- Origin: ADR-051, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: Undo is lost on reload, and there is no undo in the library (deleting saved pieces).
- Request: Undo and redo for project changes (context, not a quote)
- Questions: Keep undo per project on the device? A 30-day Recently deleted list for the library?
- Suggested pick: Keep the undo stack per project in IndexedDB (new Dexie version). Make library deletes go to a 30-day “Recently deleted” list instead of being final. (estimate: effort +20%, value +15%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still valid; the library is now the Projects page (ADR-078). Dexie v8 has no undo table and there is no Recently deleted list.

### Egger catalogue import

- Id: 346a0e44-6bcd-442a-9fcd-4b0046a2318d
- Number: G-015 12:00
- Status: Open
- Origin: Catalog, 2026-10-24 17:15 UTC; blocked by the environment
- Missing: The Egger catalogue import is not done: the pack has no thickness or colour, and egger.com is blocked.
- Request: “Use this to fill in Egger catalogue”.
- Questions: Which thicknesses per board type (for example PAL 18 / 25 mm) should the 276 rows get?
- Suggested pick: Import the 276 rows now with code, name and type. Take thickness from one list you confirm (for example, PAL 18 / 25 mm) and leave colour to the pictures you add. Nothing invented (ADR-010). (estimate: effort +10%, value +30%)

### Export blocking never tried in a browser

- Id: 62df0b6f-d75d-4978-adc1-55f2a19cc5c9
- Number: G-016 12:00
- Status: Open
- Origin: ADR-062/064, 2026-10-24 17:52 UTC; agent scoped it out
- Missing: Exports blocked by errors are in the code but were never tried in a browser.
- Request: Errors block export (ADR-008) (context, not a quote)
- Questions: None; add the find-it step.
- Suggested pick: Add a find-it step: make an error, check that CSV and Print are disabled, and that the message says why. (estimate: effort +2%, value +5%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. tools/editor-modes/find-it.mjs:202-216 checks CSV and Print are disabled on an error and tools/edge-band/find-it.mjs:218-221 checks CSV is blocked (both pass per N88). Not checked: the message saying why (src/ui/Output.tsx:139), and that the Shopping list CSV and Print are blocked.

### Drag a catalog item onto the plan

- Id: 364d3f95-ae41-4fa5-a2f0-c0510b79ceb8
- Number: G-017 12:00
- Status: Open
- Origin: ADR-065, 2026-10-24 18:55 UTC; user decision
- Missing: No dragging a catalog item from Add a piece onto the plan (option 2). You chose option 1.
- Request: “Drag and drop is implemented?”
- Questions: Build option 2 now, reusing the drag code?
- Suggested pick: Option 2 reuses the same pointer code: hold a catalog card and drop it on the plan, with the snap preview from ADR-070. (estimate: effort +25%, value +20%)

### Turn by dragging; Esc selection bug

- Id: 4ce41bfa-2d74-46aa-ad0e-f562c29404cd
- Number: G-018 12:00
- Status: Open
- Origin: ADR-065, 2026-10-24 18:55 UTC; agent scoped it out
- Missing: No turning by dragging. After Esc cancels a drag, releasing still selects the piece.
- Request: Drag and drop on the plan (context, not a quote)
- Questions: A 90-degree turn handle on the selected piece?
- Suggested pick: A turn handle on the selected piece that steps 90° (ADR-003 keeps whole angles). Fix the Esc bug. (estimate: effort +10%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. ADR-069 added Turn 90° buttons and R / Shift+R. No turn handle on the plan. The Esc bug is most likely still there: the piece's onClick still calls select() (src/ui/Project.tsx:1011); not reproduced.

### Textures in Realistic mode

- Id: fe9eaa41-fc0a-47cc-a121-f71071a4497c
- Number: G-019 12:00
- Status: Done (3a9dafe)
- Origin: ADR-067, 2026-10-24 19:55 UTC; agent default, accepted by the user
- Missing: No textures, so Realistic mode uses plain finishes (matte, satin, gloss).
- Request: “Realistic looks … rendering high quality 3D designs … to sell designed kitchens”.
- Questions: Use your own board pictures (ADR-048) as textures?
- Suggested pick: Use your own board pictures (ADR-048) as textures in Realistic mode, to scale with the grain direction. This needs no bundled files and no licence question. (estimate: effort +20%, value +35%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): resolved: Realistic mode has used the user's board pictures as textures since it shipped (src/viewer/Viewer3D.tsx:701, 715-717; UVs follow the grain). Bundled wood-grain textures were not the suggested pick and stay out (ADR-067).

### Appliances, sinks, edge profiles, client sheet

- Id: 5db26692-9bcb-4f61-8907-b17ca72723a9
- Number: G-020 12:00
- Status: Open
- Origin: ADR-067/068, 2026-10-24 19:55 UTC; agent default, accepted by the user
- Missing: No appliances, sinks or worktop edge profiles. No client sheet with render and price.
- Request: “To sell designed kitchens”.
- Questions: Client sheet first? Which licence for bundled appliance models (CC0)?
- Suggested pick: Client sheet: one printable page with the PNG render, the piece list and the ADR-062 price. Appliances come through ADR-076 imports plus a few CC0 models once you pick that licence. Edge profiles: three profile choices drawn on the worktop. (estimate: effort +45%, value +40%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. Appliances and sinks can be imported as .glb (ADR-076); appliance niches (ADR-036) and a sink base exist. Remaining: client sheet, worktop edge profiles, bundled CC0 models (licence question).

### Blender / glTF export

- Id: 0a2ff6ac-dada-40c3-8955-289f2cf71e02
- Number: G-021 12:00
- Status: Open
- Origin: ADR-068, 2026-10-24 19:55 UTC; agent default, accepted by the user
- Missing: No Blender or glTF export.
- Request: High-quality renders (context, not a quote)
- Questions: Add Export scene (.glb) with three.js GLTFExporter?
- Suggested pick: three.js already ships GLTFExporter, so no new dependency: “Export scene (.glb)” with materials and pictures, ready for Blender. (estimate: effort +10%, value +15%)

### Render not checked on a laptop GPU

- Id: 2ea5fd26-af87-4fbd-9a95-5f6f33a9f161
- Number: G-022 12:00
- Status: Open
- Origin: ADR-067/068, 2026-10-24 20:43 UTC; blocked by the environment
- Missing: Not checked on a laptop GPU; the full 256-sample render and Save PNG were not run by script; no find-it at 390 px. The path tracer is pinned to a deprecated WebGL build (0.0.27).
- Request: Laptop, preview quality (context, not a quote)
- Questions: Can you run the render once on your laptop? Plan the WebGPU path-tracer upgrade?
- Suggested pick: Run the full render find-it on a machine with a GPU. Write an ADR for the WebGPU path-tracer upgrade before the WebGL build stops working. (estimate: effort +5%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved per documents: ADR-068 records the user's full 256/256 render and Save PNG on a laptop; N88 ran the scripted full render and Save PNG at 1280 px and 18/18 at 390 px. Remaining: three-gpu-pathtracer still pinned at 0.0.27 on WebGL, no WebGPU ADR.

### No outline on selection in Realistic mode

- Id: 861689c6-762d-45bf-a9fc-3f09be6a90e6
- Number: G-023 12:00
- Status: Done (ADR-087)
- Origin: ADR-067, 2026-10-24 20:59 UTC; agent scoped it out
- Missing: In Realistic mode a selected piece shows only a green tint, with no outline.
- Request: Select pieces in 3D (ADR-014) (context, not a quote)
- Questions: None; add the outline pass.
- Suggested pick: Add an outline pass in Realistic mode, the same as Preview mode. (estimate: effort +5%, value +5%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): duplicate of G-064 (Done, ADR-087): SelectionOutline is drawn in Simple and Realistic (src/viewer/Viewer3D.tsx:647-681), checked by tools/selection-look/find-it.mjs.

### Research marks not readable

- Id: 88f8d796-78d4-4f41-9c02-fff9a7e555d0
- Number: G-024 12:00
- Status: Open
- Origin: Research, 2026-10-24 21:22 UTC; blocked by the environment
- Missing: “List my Interested features” is unanswered: the marks are only in your browser.
- Request: “List all features … I marked as interested”.
- Questions: Can you export research-decisions-<date>.json?
- Suggested pick: You export research-decisions-<date>.json once; then Claude reconciles it with the ADRs. (estimate: effort 0%, value needs your file)

### Cross-family composition and room presets

- Id: 537d7c0c-3f58-4791-98ec-50bbc25f3619
- Number: G-025 12:00
- Status: Open
- Origin: Research, 2026-10-24 21:28 UTC; agent scoped it out
- Missing: No ADR was written for “cross-family composition” or “kitchen / wardrobe / desk as presets”. They were not shown to be already covered.
- Request: The 14 features you selected at 21:28 (context, not a quote)
- Questions: Check each against the app and write ADRs for what is missing?
- Suggested pick: Check each against the app with find-it. Write an ADR for whatever is missing (likely: one project mixing a kitchen run with a desk, and room presets that place several pieces at once). (estimate: effort +30%, value +20%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved; text partly wrong. Cross-family composition was already checked (N48, tools/ensemble/find-it.mjs: base cabinet + wardrobe + daybed). Remaining: built-in room presets that place several pieces; a kitchen run plus a desk in one project not checked.

### Free-angle rotation

- Id: bd4a1c1c-b0b6-4010-b11f-5b8ec2477bb4
- Number: G-026 12:00
- Status: Open
- Origin: Research, 2026-10-24 21:29 UTC; user decision
- Missing: Free-angle rotation is ruled out by ADR-003/004 (axis-aligned, whole mm).
- Request: “Predictable rotate”.
- Questions: Keep 90-degree turns only (acknowledge)?
- Suggested pick: 90° turns cover “predictable”. Free angles need a new ADR; not recommended unless you have angled rooms.

### Bottom sheet drag, mode bar, old find-it scripts

- Id: 9bb5f4d5-8e26-49a0-a4e0-d6f5d9eeb7c6
- Number: G-027 12:00
- Status: Open
- Origin: ADR-079, 2026-10-24 23:07 UTC; agent scoped it out
- Missing: On a phone the bottom sheet opens only by tapping (no drag). On desktop the mode bar takes a whole row (now two modes, Compose and Build & Preview, since ADR-080). The old find-it scripts (home, ensemble, look-render, materials, shapes, plan-drag at 375 px, and now editor-modes and plan-snap) fail on the new shell.
- Request: “Help with the sticky bars top and bottom, they occupy too much”.
- Questions: Three stops for the sheet (peek, half, full)? Mode switch in the top bar on desktop?
- Suggested pick: Drag handle with three stops (peek, half, full). Move the mode switch into the top bar on desktop. Update the old scripts so every earlier feature is found again in the new shell. (estimate: effort +25%, value +25%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. The old find-it scripts were fixed (N88, G-060 Done). Remaining: the phone sheet still opens only by tap (src/ui/App.tsx:673-681); the desktop mode switch is still its own row.

### Mobila sample files still in the repo

- Id: 5983fd52-7ba3-43c4-8d43-7d760aeaf932
- Number: G-028 12:00
- Status: Open
- Origin: D02, 2026-10-24 23:15 UTC; agent default, accepted by the user
- Missing: “Built in the app” is gone from the screens, but the Mobila sample files stay in docs/samples/ and the tests. The question was asked and never answered.
- Request: “Remove completely the Built in the app feature”.
- Questions: Delete the files too, keeping only the test fixtures ADR-041 needs?
- Suggested pick: Read literally, “completely” means the files too. Move the samples ADR-041's tests need into tests/fixtures/ and delete the rest. Your call. (estimate: effort +3%, value matches your words)

### Light acceptance never retired

- Id: 8a4468b9-3ef5-4e36-8665-958d2d16bd17
- Number: G-029 12:00
- Status: Open
- Origin: Light acceptance, 2026-10-24 23:34 UTC; agent scoped it out
- Missing: Your decision to drop light acceptance was never applied. Its ADR sits unmerged on branch ccr-137ce6a6-cq7441, and its numbers ADR-080 and N75 are now taken on main by the Settings ADR. main still allows “Acceptance: light”.
- Request: “Remove the idea of find-it pending, I changed my mind”.
- Questions: Merge the unmerged ADR under the next free numbers, then catch up every pending find-it?
- Suggested pick: Give it the next free ADR and backlog numbers, merge it, then run every pending find-it (see the ADR-080 row). (estimate: effort +5%, value matches your words)

### Back cut-outs over pipes and outlets

- Id: 859a13dc-8f56-4681-bce5-a50b47a56553
- Number: G-030 12:00
- Status: Open
- Origin: ADR-072, 2026-10-24 23:58 UTC; agent scoped it out
- Missing: No automatic cut-out in a back panel over a pipe or outlet, and no electrical rules. Templates don't keep pipes and outlets. No test for a worktop or plinth over a pipe.
- Request: Pipes and outlets checked against the pieces (context, not a quote)
- Questions: Cut the back as a shaped part at the zone? Templates carry room features?
- Suggested pick: Make the back a shaped part with a rectangular cut-out at the zone (ADR-040 already does shaped parts), listed on the cut list and printed sheet. Templates carry room features. Add the missing test. (estimate: effort +35%, value +30%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): text partly wrong: templates already keep pipes and outlets when the room is included (src/core/projectTemplate.ts:97, :203), untested. Remaining: shaped back with a cut-out, electrical rules, the worktop/plinth-over-pipe test.

### ADR-072 defaults unconfirmed

- Id: 2f3a22b8-abdb-42d5-8398-16ffd037b408
- Number: G-031 12:00
- Status: Open
- Origin: ADR-072, 2026-10-24 23:58 UTC; agent default, accepted by the user
- Missing: Unconfirmed defaults: a tall unit is 1,600 mm or more; a zone reaches 50 mm from the wall.
- Request: Pipes and outlets checked against the pieces (context, not a quote)
- Questions: Is a tall unit 1,600 mm or more? Does a zone reach 50 mm from the wall?
- Suggested pick: Confirm them, or give your values. (estimate: effort 0%, value needs you)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): the Origin says accepted by the user, but the two questions were never answered (no answer in product-context.md). Code still uses TALL_UNIT_HEIGHT=1600 and NEAR_WALL=50 (src/core/room.ts).

### Multi-select, fixed-hand mirroring, 1 mm drift

- Id: d6b81111-9d1d-4de9-8d80-49d6099f3f51
- Number: G-032 12:00
- Status: Open
- Origin: ADR-069, 2026-10-25 00:01 UTC; agent scoped it out
- Missing: No multi-select or groups. The lounger backrest and daybed side panel can't be mirrored. Mirrored pieces can be ±1 mm off.
- Request: “Duplicate, mirror and predictable rotate operations”.
- Questions: Store a hand side on the lounger and daybed? Symmetric rounding for mirrored copies? Multi-select gesture?
- Suggested pick: Store a hand (left or right) on those two pieces so they mirror. Use symmetric rounding for mirrored copies so they match to the mm. Add multi-select (Shift-click or long-press) for duplicate, mirror and move together. (estimate: effort +40%, value +30%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still valid. Absorbs G-013 (Save selection as template), which needs multi-select.

### Snapping in the front view and 3D

- Id: c960d313-d8b6-4662-b838-00b80308b299
- Number: G-033 12:00
- Status: Open
- Origin: ADR-070, 2026-10-25 00:07 UTC; agent scoped it out
- Missing: No snapping in the front view or 3D. Snaps are not stored. The “Won't snap” hint is checked only in unit tests.
- Request: “Guided snapping”.
- Questions: Front-view height snaps first (worktop line, wall-unit line)?
- Suggested pick: Front-view snapping to heights (worktop line, wall-unit line), using the same rules. Stored snaps come from the connections ADR above. Add the hint to find-it. (estimate: effort +30%, value +20%)

### Hinge repair, filler repair, 3D preview

- Id: 7eb0b6b4-e091-4771-8689-1c52d941fffd
- Number: G-034 12:00
- Status: Open
- Origin: ADR-071, 2026-10-25 00:10 UTC; agent default, accepted by the user
- Missing: No “Reverse the hinge” repair. The filler repair shows only with automatic refresh off. No outline or preview in 3D.
- Request: “Explainable warnings with repairs”.
- Questions: Clearance follows the hinge side (needs G-011), or drop the hinge repair?
- Suggested pick: Make the clearance follow the hinge side (see the ADR-057 row), then offer the hinge repair. Let a repair add a filler that automatic refresh keeps. Draw the problem box and the dashed preview in 3D. (estimate: effort +35%, value +30%)

### Mouldings, sink and hob cut-outs, templates

- Id: fd1c8f96-2525-40c0-8b0f-af9c93496010
- Number: G-035 12:00
- Status: Open
- Origin: ADR-075, 2026-10-25 00:13 UTC; agent scoped it out
- Missing: No profiled mouldings and no sink or hob cut-outs. Templates don't keep trims or worktops. The ceiling filler has not been made in a browser.
- Request: “Shared worktops”, “fillers, plinths, end panels and trim”, for kitchens.
- Questions: Cut-outs from sizes you enter? Templates carry run requests?
- Suggested pick: Sink and hob cut-outs on the worktop from sizes you enter (no invented appliance sizes), on the cut list and the print. Templates carry run requests. Add a ceiling filler to find-it. (estimate: effort +35%, value +30%)

### Clearance zones in 3D and templates

- Id: ca34cc18-cf05-49d9-91a6-4ab7346585f0
- Number: G-036 12:00
- Status: Open
- Origin: ADR-073, 2026-10-25 00:14 UTC; agent scoped it out
- Missing: Clearance zones are not drawn in 3D and are not saved in templates. No separate installation zone on the plan.
- Request: “Collision and clearance”.
- Questions: Draw zones as translucent volumes in 3D? Draw the installation arc on the plan?
- Suggested pick: Draw zones as translucent volumes in 3D, with the same toggle. Draw the installation zone (tilt-up arc) on the plan. Templates carry zones. (estimate: effort +25%, value +20%)

### Chair depth and service sizes

- Id: 4872d9d7-0f7f-403a-9fa1-69e89b99b7b2
- Number: G-037 12:00
- Status: Open
- Origin: ADR-073, 2026-10-25 00:14 UTC; agent default, accepted by the user
- Missing: No chair depth or service-zone sizes: you enter them each time.
- Request: “Collision and clearance”.
- Questions: What chair depth and service-zone sizes do you use?
- Suggested pick: Give your usual values once and they become per-project defaults. (estimate: effort 0%, value needs you)

### Band-list import and colour matching

- Id: 7a74e08c-8226-41fc-8763-64e00e8a8ed6
- Number: G-038 12:00
- Status: Open
- Origin: ADR-077, 2026-10-25 00:15 UTC; agent scoped it out
- Missing: No supplier band-list import, tolerances, edgebander settings or band colour matching.
- Request: “Check the European standards for ABS, apply them accordingly”.
- Questions: Import a supplier band list as CSV and match bands to the board decor?
- Suggested pick: No EN standard sets band sizes; that finding stands. Closer: import a band list (CSV, like decors) and match the band to the board's decor code and picture. (estimate: effort +20%, value +20%)

### ADR-077 open decisions

- Id: d4d54cd8-19ff-4f82-b50a-e132002883a6
- Number: G-039 12:00
- Status: Open
- Origin: ADR-077, 2026-10-25 00:15 UTC; agent default, accepted by the user
- Missing: Open: carry over the old per-board banding prices? Preset thickness list or typed only? The allowance is stored per band, not per board.
- Request: “Check the European standards for ABS, apply them accordingly”.
- Questions: Carry over old banding prices? Keep the preset thickness list? Allowance per band?
- Suggested pick: Recommended (closest to the request): keep the preset list (the common supplier sizes you asked to apply), carry over prices, allowance per band (that is how edgebanders work). Confirm. (estimate: effort +5%, value +10%)

### 3D model placement and templates

- Id: cb270972-b82f-4c04-8313-c57203ad6a71
- Number: G-040 12:00
- Status: Open
- Origin: ADR-076, 2026-10-25 00:16 UTC; agent scoped it out
- Missing: Imported models can't be dragged, hung on a wall or put on another piece. Templates don't keep them. Nothing is bundled.
- Request: “Import 3D models and model libraries”.
- Questions: Floor, wall and on-a-piece placement with drag and snap? Bundle CC0 models?
- Suggested pick: Give models the same placement (floor, wall, on a piece) and drag or snap as pieces. Templates carry them. For “libraries”: a small bundled set of CC0 models (fridge, oven, sink, hob) once you agree that licence. (estimate: effort +35%, value +35%)

### ADR-076 models list

- Id: ce1fe2bd-9bf1-43d8-9ee7-60630ee6a73b
- Number: G-041 12:00
- Status: Open
- Origin: ADR-076, 2026-10-25 00:16 UTC; agent default, accepted by the user
- Missing: Models are stored in a separate Project.models list, not on project items as the ADR says.
- Request: “Import 3D models and model libraries”.
- Questions: Keep the separate Project.models list and write it into the ADR?
- Suggested pick: Keep it (it lets one model be used many times), but write it into the ADR before shipping. Confirm. (estimate: effort 0%, value needs you)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): ADR-076 is already Implemented, so the suggested pick (write it into the ADR before shipping) can no longer be done; record the answer here or in a new small ADR. Code uses Project.models (src/core/project.ts:159).

### Project fasteners panel and Romanian labels

- Id: ab708f50-2bbf-4549-9c21-1eee651e7aaa
- Number: G-042 12:00
- Status: Open
- Origin: ADR-074, 2026-10-25 00:16 UTC; agent scoped it out
- Missing: No Fasteners panel in a project's own Configure view. Fastener lines in the Romanian CSV are in English (breaks ADR-020). No drilling patterns.
- Request: “Hardware and fastener completeness”.
- Questions: Add the project-level panel? Draw drilling positions only from your values?
- Suggested pick: Add the project-level panel. Translate the fastener labels (a bug). Draw drilling positions only from the values you enter, labelled as guidance (ADR-010). (estimate: effort +30%, value +25%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved. A piece's Fasteners panel is reachable from a project via Inside this piece › Size, boards and construction (ADR-090). Remaining: Fasteners in the project's own Settings dialog; the Romanian shopping CSV still writes fastener lines and footer in English (src/core/fasteners.ts, src/core/shopping.ts:32-33); drilling patterns.

### Duplicate backlog id D02

- Id: 2f51b2fc-499f-4cd4-bc38-cd5a94fc9469
- Number: G-043 12:00
- Status: Open
- Origin: Backlog, 2026-10-25 06:52 UTC; agent scoped it out
- Missing: Two backlog rows share the id D02: ADR-029, and “Built in the app”. Still not fixed on main.
- Request: Ids are never renumbered (CLAUDE.md) (context, not a quote)
- Questions: Renumber the later row to D03? (Ids are never renumbered, so this needs your decision.)
- Suggested pick: Give the later row (“Built in the app”) D03 and fix every reference. (estimate: effort +1%, value bookkeeping)

### Catalog feed and brand filter

- Id: c669ae6d-a12c-42a2-a70e-27c5d366d54c
- Number: G-044 12:00
- Status: Open
- Origin: ADR-029/052/027, 2026-10-25 06:52 UTC; user decision
- Missing: The catalog feed (N16) and the brand filter (N14) will not be built: you have no access to IKEA data.
- Request: “Mark 029 as won't do”.
- Questions: Feed the brand filter from your decor imports instead of IKEA (new ADR)?
- Suggested pick: The brand filter could be fed by your Egger / Kronospan decor imports (by manufacturer) instead of IKEA. It would need a new ADR replacing ADR-027's IKEA dependency. (estimate: effort +15%, value +15%)

### ADR-069 to 079 shipped with open gaps

- Id: 0ebe50ad-b78c-4959-b6d0-136307956cab
- Number: G-045 12:00
- Status: Open
- Origin: ADR-069..079, 2026-10-25 10:25 UTC; agent scoped it out
- Missing: Eleven ADRs were shipped (N64 to N74 Done) with the gaps above still open and their open questions unanswered. Find-it was not re-run after the merge, and nothing was checked on the live site.
- Request: “Merge all mergeable, push, list what is left”.
- Questions: Re-run every find-it on main? Answer the open questions above?
- Suggested pick: Re-run every find-it script on the production build of main. Answer the open questions above. Then open one follow-up ADR per group of gaps, so the gaps are tracked and not lost behind Done. (estimate: effort +10%, value +15%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved per N88: every find-it script passed on a local production build after merging main. Remaining: the open questions in G-027 and G-030 to G-042, follow-up ADRs, the live check (G-047).

### Settings dialog built as light

- Id: 6473f7f6-d12c-4cd4-9fd1-df9174d43ddb
- Number: G-046 12:00
- Status: Done (catch-up find-it 2026-10-28, tests/find-it/catch-up-editor.test.tsx)
- Origin: ADR-080, 2026-10-25 10:31 UTC; agent scoped it out
- Missing: The Settings dialog ADR (Configure moves into a modal, view captions behind an info icon) was built as light acceptance, against your 23:29 decision. N75 is Partially done, “find-it pending”, and not checked in a browser.
- Request: “Add a tooltip icon with the text on hover on desktop and on click on mobile”; earlier, “Remove the idea of find-it pending”.
- Questions: Write and run its find-it now?
- Suggested pick: Write and run its find-it (About the plan, About the front view, Settings, Compose, Build & Preview) at phone and desktop widths, then ship it. (estimate: effort +10%, value +15%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved per N88: tools/editor-modes checks Settings, Compose, Build & Preview (156/156) and tools/plan-snap checks About the plan (50/50). Remaining: no script checks About the front view or Settings for <name>; N75 stays Partially done.

### Nothing live-verified

- Id: d2cc5ea6-9bf2-4118-99ab-ed591f9ab2a3
- Number: G-047 12:00
- Status: Open
- Origin: Verification, all sessions; blocked by the environment
- Missing: Nothing has been live-verified: the deployed site, a real phone and a screen reader were never checked. github.io is refused by this environment.
- Request: “R1: evidence from the running app the user will use”.
- Questions: Allow chiriacsergiucs-v2.github.io in the environment network policy? Run the phone and screen-reader check together?
- Suggested pick: Allow chiriacsergiucs-v2.github.io in this environment's network policy, so the find-it scripts can run against the live URL. Phone and screen-reader checks need you, about 15 minutes with a short script Claude writes. (estimate: effort +5%, value +20%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): still valid (github.io unreachable from this environment). Absorbs G-048: touch and 3D were checked only in Chromium emulation; one guided session on the user's phone covers both.

### Touch and 3D checked only in emulation

- Id: 62266f65-5d95-4a12-bf21-4c28cd7c19f1
- Number: G-048 12:00
- Status: Done (merged into G-047)
- Origin: Verification, all sessions; blocked by the environment
- Missing: Pieces of the 3D work and the touch features were checked only in desktop Chromium emulation.
- Request: Phone-first (context, not a quote)
- Questions: One guided session on your phone?
- Suggested pick: Same as the row above: one session on your phone, guided by a checklist. (estimate: effort +3%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): merged into G-047 (the same real-phone session).

### G ids on pre-ADR-082 notes

- Id: 9c075d86-1107-416f-82f5-64e4f60b5c4c
- Number: G-049 12:00
- Status: Open
- Origin: ADR-082, 2026-10-25; agent scoped it out
- Missing: Backlog notes and ADRs written before ADR-082 do not cite G ids; the seed G-001 to G-048 covers their gaps, but the old text does not link to it.
- Request: “Configure the project so everytime something is "not implemented" it is being saved into adrs folder into "Gaps"”
- Questions: Add G ids to the old backlog Gap notes and Open questions too?
- Suggested pick: Yes: one pass adding the matching G id next to each old Gap note and open question, so every gap is findable from both sides (estimate: effort +15%, value +10%)

### No gaps page in the app

- Id: 99418d12-72d0-45a1-8fb7-332df5c88235
- Number: G-050 12:00
- Status: Done (ADR-101)
- Origin: ADR-082, 2026-10-25; agent scoped it out
- Missing: The ledger is a repo file only; the app does not show it.
- Request: “items from it can be used to add as a new adr or mark as acknowledged and accepted”
- Questions: Is the file enough, or do you want a page (in the app, or an artifact) where you can mark gaps acknowledged or promote them?
- Suggested pick: The file, edited through Claude ("acknowledge G-012", "make ADR from G-007"); a page only if you want to triage on the phone without a session (estimate for a page: effort +40%, value +15%)

### Tap on the innermost selected space

- Id: 93e50296-762a-45e7-973c-f42f9c68ffce
- Number: G-051 12:00
- Status: Done (ADR-083)
- Origin: ADR-083, 2026-10-25, open question (Claude default)
- Missing: What a tap on the already selected innermost space does
- Request: The flow of selecting the furniture, then the middle (given there are 2 dividers), then having a horizontal divider, then selecting the bottom one to adjust shelves is a painful horrible user experience. Adjust the selecting to go from bigger to smaller. 1 click = entire furniture, second click selects the smaller frame, third again the smaller within, iteratively.
- Questions: Stay on the innermost space, or wrap back to the whole piece?
- Suggested pick: Stay on the innermost space, so a repeated tap while adjusting shelves never loses the selection (estimate)
- Answer: User 2026-10-25: "1 wrap back" — wrap back to the whole piece; built in ADR-083.

### Drill-down across project and piece

- Id: ce73d78d-2aea-4607-a952-3ac1edd1a7ed
- Number: G-052 12:00
- Status: Done (ADR-083)
- Origin: ADR-083, 2026-10-25, open question (Claude default)
- Missing: Drill-down from the project plan/3D into a piece's spaces
- Request: The flow of selecting the furniture, then the middle (given there are 2 dividers), then having a horizontal divider, then selecting the bottom one to adjust shelves is a painful horrible user experience. Adjust the selecting to go from bigger to smaller. 1 click = entire furniture, second click selects the smaller frame, third again the smaller within, iteratively.
- Questions: In a project, does the 2nd tap on a selected piece open it in the editor with the bay under the tap selected, or keep today's separate edit step?
- Suggested pick: Continue drilling into the piece (2nd tap opens it with the bay selected): closest to '1 click = entire furniture'; estimate +30 % work, +25 % of value
- Answer: User 2026-10-25: "2 yes" — the 2nd tap on a selected piece opens it with the space under the tap selected; built in ADR-083.

### Step back up one level without the breadcrumb

- Id: dc839e71-59d8-425b-9c60-9c4106e5bb9f
- Number: G-053 12:00
- Status: Open
- Origin: ADR-083, 2026-10-25, out of scope (Claude)
- Missing: Going one level back up with a gesture (Esc / long press)
- Request: The flow of selecting the furniture, then the middle (given there are 2 dividers), then having a horizontal divider, then selecting the bottom one to adjust shelves is a painful horrible user experience. Adjust the selecting to go from bigger to smaller. 1 click = entire furniture, second click selects the smaller frame, third again the smaller within, iteratively.
- Questions: Is a 'go up one level' gesture wanted besides the breadcrumb?
- Suggested pick: Esc on desktop goes up one level; estimate +5 % work

### Count stepper not over the 3D view

- Id: be77afbb-2aa6-4f1e-9435-a422091b84f9
- Number: G-054 12:00
- Status: Done (ADR-085)
- Origin: ADR-084, 2026-10-25; agent scoped it out
- Missing: No stepper over the 3D view; ADR-014 says the 3D viewer only selects, never edits.
- Request: “Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber - … Placement: above the selected piece”
- Questions: Show the stepper over the 3D view too (needs a new ADR changing ADR-014)?
- Suggested pick: No: the stepper floats over the front drawing, which is shown next to 3D in Both (ADR-081); 3D stays select-only (estimate for 3D: effort +40%, value +10%)

### Count stepper only for cabinet spaces

- Id: 479629b6-2906-42ee-92f4-72bec745afb6
- Number: G-055 12:00
- Status: Acknowledged (2026-10-25)
- Origin: ADR-084, 2026-10-25; agent scoped it out
- Missing: Products without spaces (frame, panel set, single panel) and project-plan items get no stepper; desk pedestals and corner wings get it through their cabinet spaces only.
- Request: “Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber - … Placement: above the selected piece”
- Questions: Which counts outside cabinet spaces should step (e.g. frame slats, panel-set copies, desk pedestals)?
- Suggested pick: Name the ones you use; each is a small add once the stepper exists (estimate per family: effort +10%, value +5%)

### Which bay the divider stepper adds or removes

- Id: 1bc049d4-10c2-4de9-b0e6-b7dacf182ada
- Number: G-056 12:00
- Status: Open
- Origin: ADR-084, 2026-10-25; agent scoped it out
- Missing: Open question default: + on dividers adds the new bay at the end (right / bottom) with 2 shelves, like the existing Add button; - removes the last bay with its contents (undo restores it); - at 1 divider leaves one space holding the first bay's contents.
- Request: “Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber - … Placement: above the selected piece”
- Questions: Where does + add and - remove: at the end, or next to the selected bay? What goes in a new bay: empty, or a copy of its neighbour?
- Suggested pick: End, with 2 shelves like the existing Add button (consistent with what the app does today; next-to-selection is estimated +15% effort for +5% value)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): partly resolved; text out of date. ADR-089 decided a new bay is empty (src/core/counts.ts:89-99), so the 2-shelves default is gone, and ADR-086 changed what + acts on. Still unconfirmed: whether + adds at the end or next to the selection, and what - removes.

### Acceptance level for the count stepper

- Id: 3b7a9483-541b-41f2-9408-0bcb0d5e03d2
- Number: G-057 12:00
- Status: Done (ADR-084)
- Origin: ADR-084, 2026-10-25; agent scoped it out
- Missing: Open question default: full acceptance (find-it script at 390 and 1280 px).
- Request: “Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber - … Placement: above the selected piece”
- Questions: Full find-it acceptance or light (ADR-066)?
- Suggested pick: Full: the request is a visible control and R3 is the default (light saves an estimated 20% effort, adds no value)

### Quick counts card still covers the 3D model on phones

- Id: e2cbf845-b310-4608-a9e1-a1f1e0040879
- Number: G-058 12:00
- Status: Open
- Origin: UI critique 2026-10-26 (N82), finding 3; agent chose not to move the card (it would reverse ADR-084/085)
- Missing: On a phone in Build & Preview the Quick counts card (two rows, ~150 px with 44 px buttons) still covers most of the 3D model; in the drawing the card's band still shifts the drawing down on the first selection
- Request: Fix them directly (findings 1-6 of the UI critique; finding 3: the count card covers the top of the drawing, shows twice in Both). Not a quote for the finding text.
- Questions: Collapse the card to a 'Quick counts' button over 3D on phones? Reserve the card band before the first selection so the drawing never moves?
- Suggested pick: Collapsible card over 3D on phones, open by default, closest to ADR-085's 'same card over 3D' (est. +30 % work vs nothing, +20 % of finding 2/3 value)
- Note: 2026-10-26, ADR-087 (G-070, user "Dock under 3D") docks the phone 3D card under the stage, so it no longer covers the model; the drawing part (the card's band shifting the drawing on the first selection) is still open.

### UI critique findings 7-20 not fixed

- Id: 1db7d01f-e906-415d-a27c-f90246e99b37
- Number: G-059 12:00
- Status: Done (20b2b27)
- Origin: UI critique 2026-10-26 (N82); the user asked to fix findings 1-6 only
- Missing: Findings 7-20 and the minor ones: one-yellow rule broken (Create project, New piece, Next, Done, catalog Open, active nav), desktop left panel titled Compose in Build & Preview, whole-piece editing split across card / Settings / Edit the interior, catalog counts disagree (118 vs 108, Living room 31 vs 33), wall cabinets first under Living room, Romanian subtitles in the English UI, Projects row Delete icon wraps to its own line, white band behind the catalog filter row, steps rail cut off at 390 px, empty project shows blank 3D and 'No problems found', crowded catalog header on phones, '1 shelf' label over the door line, brand mark looks like a menu, unexplained I/C badges, wizard asks size before type, Skip unclear, empty phone app bar on Projects/Catalog, hardware Item column wraps, repeated 'Edge band: not named yet', 'Clean up unused pictures' as prominent as Import
- Request: Run critique this design for the entire ui/ux; then 'Fix them directly' (answered for findings 1-6)
- Questions: Which of these to fix next, and in what order?
- Suggested pick: Fix 13, 14, 16, 18 next (layout bugs and a misleading message, closest to a broken UI; est. small each)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): resolved by a9e5780, merged in PR #71 (20b2b27), except findings 8, 9 and 12 (G-073). The catalog-counts item is not confirmed in a browser (only an N ready items label was added); tracked as its own gap.

### Five find-it scripts stale since ADR-080

- Id: d107eadf-3bd1-40ec-9125-b6aa18a54082
- Number: G-060 12:00
- Status: Done (N88, 2026-10-26)
- Origin: Found 2026-10-26 while checking N82; predates it (same failures on main 4b1141b)
- Missing: Five find-it scripts are stale since ADR-080: look-render (waits for a 'Materials' button), editor-modes (expects a 'Configure' mode), trims (radio 'Configure'), clearances ('Chair space depth' not found), plan-snap (no status in the room plan)
- Request: Not a user request: R3 requires find-it scripts to pass against the production build
- Questions: Update the five scripts to the ADR-080 layout (Settings dialog instead of Configure/Materials)?
- Suggested pick: Update all five scripts to the current UI (est. small each; restores R3 evidence for ADR-067/068, ADR-079, trims, clearances, plan snap)
- Answer: User 2026-10-26: "fix G-060 stale find-it scripts"; all 28 find-it scripts pass on the production build (N88).

### Dragging pieces never tried in a browser

- Id: 09191449-5935-436f-a5f3-d2e138e85bb2
- Number: G-061 12:00
- Status: Done (ef0c832)
- Origin: ADR-065, 2026-10-24 19:10 UTC; user decision
- Missing: Dragging a piece on the plan (mouse, touch, arrow keys) is merged and deployed but was never tried in a browser; find-it was skipped. N60 says Done while its text says not verified.
- Request: “Skip find-it for this onw”
- Questions: Run a find-it for dragging now, or keep N60 as Partially done until someone tries it?
- Suggested pick: Add a find-it: mouse drag at 1440 px changes From left, Undo restores; touch drag at 375 px with no sideways scroll; set N60 by the result. (estimate: effort +3%, value +6%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): resolved before this gap was written: ef0c832 (2026-10-24) added tools/plan-drag/find-it.mjs and fixed touch drag; N60 26/26, N88 28/28. Only the live / real-phone check remains (G-047).

### Which selection design

- Id: a89e8d1a-6083-4ec7-8584-28d872a8536c
- Number: G-062 12:00
- Status: Done (ADR-087)
- Origin: ADR-087, 2026-10-26, open question (Claude default)
- Missing: Which of the five selection designs (A-E) is built
- Request: The highlight of the selected item need to be more obvious, suggest 5 designs that can be applied so it is clearer which part of the piece is selected, or if it is entirely selected
- Questions: Pick one of A outline+ghost, B subtree tint, C glass volume, D corner brackets+label, E nested level outlines (or a mix)
- Suggested pick: A, outline round the selected space and the rest faded: answers both 'which part' and 'entirely selected' at a glance; estimate equal work to B-D, +10 % value over B
- Answer: User 2026-10-26: "A" — design A, outline round the selected space and the rest faded; moved into ADR-087.

### Selection look in the front drawing

- Id: fd421b6f-cff2-4a92-948a-48ba016e63a8
- Number: G-063 12:00
- Status: Done (ADR-087)
- Origin: ADR-087, 2026-10-26, open question (Claude default)
- Missing: Whether the chosen selection design also applies to the front drawing
- Request: The highlight of the selected item need to be more obvious, suggest 5 designs that can be applied so it is clearer which part of the piece is selected, or if it is entirely selected
- Questions: Same design in the front drawing, or 3D only?
- Suggested pick: Both views, so the selection reads the same everywhere (estimate +25 % work, +30 % value)
- Answer: User 2026-10-26: "Yes" — the same look in the front drawing; moved into ADR-087.

### Selection look in Realistic mode

- Id: c047036e-8c62-499d-9dbf-63fb38deec33
- Number: G-064 12:00
- Status: Done (ADR-087)
- Origin: ADR-087, 2026-10-26, out of scope
- Missing: The new selection look in Realistic mode beyond the current tint; pictures stay without selection
- Request: The highlight of the selected item need to be more obvious, suggest 5 designs that can be applied so it is clearer which part of the piece is selected, or if it is entirely selected
- Questions: Should Realistic mode show the full selection design too?
- Suggested pick: Yes, same design in Realistic (estimate +15 % work)
- Answer: User 2026-10-26: "Yes, same as Simple" — design A (outline and fade) in Realistic too; moved into ADR-087.

### What the project panel shows for a selected space

- Id: 55344126-0b1c-482c-a9c3-b2693bfaec68
- Number: G-065 12:00
- Status: Done (ADR-088)
- Origin: ADR-088, 2026-10-26, open question (Claude default)
- Missing: Which controls the project editor shows when a space inside a piece is selected
- Request: one more ADR, which would keep the project editor open while we click on the item second time (yes editing of ), and it gives us the opportunity to add or remove shelves and change its structure. the item is triggered, but we should be kept on the edit of the project view.
- Questions: Show the space's own panel (Contents, Doors and handles, Divide this space, Layouts) inside the project editor, or only the quick-count card over 3D?
- Suggested pick: The space's full panel plus the quick-count card: 'add or remove shelves and change its structure' needs Contents and Divide (estimate +40 % work, +50 % value over the card only)
- Answer: User 2026-10-26: "Agree" — the space's full panel plus the quick-count card in the project editor; moved into ADR-088.

### Second tap on the plan

- Id: 57a4f1ba-181a-4fb5-9fea-cd37131139be
- Number: G-066 12:00
- Status: Done (ADR-088)
- Origin: ADR-088, 2026-10-26, open question (Claude default)
- Missing: What a 2nd tap on a selected piece does on the plan, which has no height
- Request: one more ADR, which would keep the project editor open while we click on the item second time (yes editing of ), and it gives us the opportunity to add or remove shelves and change its structure. the item is triggered, but we should be kept on the edit of the project view.
- Questions: On the plan: select the piece's interior and stay in the project, or keep opening the piece editor?
- Suggested pick: Stay in the project and select the piece's interior, same as 3D (estimate)
- Answer: User 2026-10-26: "Select" — on the plan the 2nd tap selects the piece's interior and stays in the project; moved into ADR-088.

### Where a new divided part's content comes from

- Id: fc5d1a2d-ccdb-4625-9534-b36a1f6302eb
- Number: G-067 12:00
- Status: Done (ADR-089)
- Origin: ADR-089, 2026-10-26, open question (Claude default)
- Missing: What a new part made by a divider holds
- Request: Add a horizontal divider (image 4) adds the divider, but somehow it decided to add also two shells in it. This is not wanted behavior.
- Questions: New part empty, or a copy of the neighbouring part?
- Suggested pick: Empty: the user said the added shelves are not wanted
- Answer: User 2026-10-26: "Empty" — a new part starts empty; moved into ADR-089.

### Empty new part for every way of dividing

- Id: 3ea0ba30-ed11-459a-b0e4-62fb15972f87
- Number: G-068 12:00
- Status: Done (ADR-089)
- Origin: ADR-089, 2026-10-26, open question (Claude default)
- Missing: Whether vertical dividers, the Divide buttons and the Parts counter also add empty parts
- Request: Add a horizontal divider (image 4) adds the divider, but somehow it decided to add also two shells in it. This is not wanted behavior.
- Questions: Apply 'new part starts empty' to every divider add (quick-count vertical and horizontal, Side by side, Stacked, Parts +), or only the horizontal quick count?
- Suggested pick: Every way of dividing, so the same action never behaves two ways (estimate +5 % work)
- Answer: User 2026-10-26: "Yes" — every way of dividing adds empty parts; moved into ADR-089.

### Quick-count card heading naming the selection

- Id: 883bc6b0-40d5-40b9-8508-61f7028d9027
- Number: G-069 12:00
- Status: Done (ADR-087)
- Origin: ADR-087, 2026-10-26, cut while building (Claude)
- Missing: A heading on the quick-count card naming what it acts on (e.g. Whole cabinet)
- Request: The highlight of the selected item need to be more obvious, suggest 5 designs that can be applied so it is clearer which part of the piece is selected, or if it is entirely selected
- Questions: Worth a heading if the card must then be made smaller on phones, or is the outline enough?
- Suggested pick: Outline only (built); revisit with a smaller phone card: a heading made the card cover the tap point in the 390 px 3D view (estimate)
- Answer: User 2026-10-26: "Yes, every card" — a heading on every quick-count card, once the phone card no longer covers the 3D view; moved into ADR-087.

### Quick-count card covers much of the phone 3D view

- Id: 9f0e3f10-5488-434d-9c95-8d201964c62d
- Number: G-070 12:00
- Status: Done (ADR-087)
- Origin: ADR-087, 2026-10-26, out of scope (seen while testing, from ADR-085)
- Missing: A placement or size of the quick-count card that leaves the piece visible in the short 390 px 3D view
- Request: The highlight of the selected item need to be more obvious, suggest 5 designs that can be applied so it is clearer which part of the piece is selected, or if it is entirely selected
- Questions: Smaller card on phones, a card docked under the 3D view, or a taller 3D view?
- Suggested pick: Dock the card under the 3D view on phones, so the piece and its outline stay in sight (estimate +10 % work)
- Answer: User 2026-10-26: "Dock under 3D" — on phones the card sits in a bar under the 3D view; moved into ADR-087.

### Selected space not marked in the project's 2D views

- Id: 8e16c683-6f13-4ce1-9708-ab2c49b9390e
- Number: G-071 12:00
- Status: Done (ADR-088)
- Origin: ADR-088, 2026-10-26, out of scope (Claude)
- Missing: Outline of the selected space inside a project piece on the plan and in the room front view (taps drill there, the 3D view and the panel show it)
- Request: one more ADR, which would keep the project editor open while we click on the item second time (yes editing of ), and it gives us the opportunity to add or remove shelves and change its structure. the item is triggered, but we should be kept on the edit of the project view.
- Questions: Mark the selected space on the room front view too (the plan, seen from above, cannot show a space's height)?
- Suggested pick: Outline it on the room front view, as in the piece's front drawing (estimate +10 % work)
- Answer: User 2026-10-26: "Room front + plan" — outline the space on the room front view and its width × depth footprint on the plan; moved into ADR-088.

### Piece-wide settings from the project panel

- Id: 1c31fbce-cece-4796-bbe8-cb794f6d2825
- Number: G-072 12:00
- Status: Done (ADR-090)
- Origin: ADR-088, 2026-10-26, out of scope (Claude)
- Missing: Size, materials and carcass settings of a project piece edited from the project panel; they stay behind Edit this piece
- Request: one more ADR, which would keep the project editor open while we click on the item second time (yes editing of ), and it gives us the opportunity to add or remove shelves and change its structure. the item is triggered, but we should be kept on the edit of the project view.
- Questions: Should the project panel also edit a piece's size, boards and carcass, or is Edit this piece enough for those?
- Suggested pick: Keep them behind Edit this piece; the request was shelves and structure (estimate)
- Answer: User 2026-10-26: "Go 068" — build it; moved into ADR-090.

### UI critique findings 8, 9 and 12 left as they are

- Id: 4b0c3083-e506-495d-905e-72789802b0c5
- Number: G-073 12:00
- Status: Open
- Origin: UI critique follow-up 2026-10-26 (N87); user decision for 8 and 9, ADR-033 for 12
- Missing: Finding 8 (desktop Build & Preview only swaps the centre view; the left panel stays Compose), finding 9 (whole-piece editing split across the Quick counts card, Settings and 'Edit the interior') and finding 12 (Romanian family and variant names under the English ones in the catalog and Start from, ADR-033)
- Request: Findings 8 + 9: 'Skip 8 and 9'. Finding 12: no request; the names are ADR-033's decision.
- Questions: Write an ADR for 8 and 9 later? Keep the Romanian names (ADR-033) or show them only in search?
- Suggested pick: Keep 12 as ADR-033 decided (no change); for 8 and 9, an ADR when you want the editor layout revisited (closest to the critique; est. +40 % work over a small fix, +60 % of 8/9 value)

### Remember whether the results panel was open across reloads

- Id: b6e6ff1b-ff6a-4aae-b575-2d1a04e5a313
- Number: G-074 12:00
- Status: Acknowledged (2026-10-26)
- Origin: ADR-091 out of scope
- Missing: The results panel always starts collapsed after a reload; its open/closed state and tab are not saved
- Request: They should be a collapsed view, onclick showing only, so the views with renders are kept as main
- Questions: Should the app remember an open results panel after a reload?
- Suggested pick: No: always start collapsed, closest to 'collapsed view, onclick showing only'
- Answer: User 2026-10-26: "Always collapsed".

### Results collapse at desktop width too

- Id: 98f0f1de-601a-4a9f-94da-7fcc7ddfb768
- Number: G-075 12:00
- Status: Done (ADR-091)
- Origin: ADR-091 open question
- Missing: Unconfirmed default: the results tabs collapse at every width, not only on phones
- Request: They should be a collapsed view, onclick showing only, so the views with renders are kept as main
- Questions: Collapse at desktop width too, or only on phones?
- Suggested pick: Every width: the request names no width and keeps the render views main everywhere
- Answer: User 2026-10-26: "Only phones"; built in ADR-091 (desktop keeps a tab open).

### Research app records go stale as ADRs ship

- Id: 6c0db3e5-1535-4d2c-8984-1f90f0be50c8
- Number: G-076 12:00
- Status: Open
- Origin: ADR-092 (2026-10-26, Claude: not asked for)
- Missing: The research page's app records (src/core/research/ensemble-2026-10-23.app.ts) are not updated when a later ADR ships; the next-adr / ship-adr skills do not touch them, so new work shows as Not Started until someone re-checks.
- Request: Text that is not a quote: follows from "mark implemented ones" (2026-10-26).
- Questions: Should ship-adr update the research app record of the feature an ADR names, or should the research page be re-checked on request only?
- Suggested pick: ship-adr updates the record (closest to keeping 'implemented' marked; about +5 % work per shipped ADR, +100 % of the freshness value; estimates).

### Free-angle rotation of project pieces

- Id: 95b47d36-8c06-4a76-8c98-1df8c7750054
- Number: G-077 12:00
- Status: Done (ADR-121)
- Origin: ADR-093 (2026-10-26, the user chose 90° steps)
- Missing: Free-angle rotation of project pieces; pieces still turn in 90° steps (ADR-022/ADR-004 kept).
- Request: "New adr to override the conflicts for 4 and make it ready" (2026-10-26)
- Questions: Override ADR-022/ADR-004 for free angles later?
- Suggested pick: Free angles with oriented-box checks (closest to the research; about 3x the work of ADR-093, +40 % of the feature's value; estimates).

### Change height by dragging in 3D

- Id: 950512a1-da6b-4f81-ab12-80206775fb7f
- Number: G-078 12:00
- Status: Done (ADR-122)
- Origin: ADR-093 (2026-10-26, the user chose floor plane only)
- Missing: Changing a piece's height by dragging in 3D; height comes from placement.
- Request: "New adr to override the conflicts for 4 and make it ready" (2026-10-26)
- Questions: Add a vertical handle later?
- Suggested pick: Keep height from placement (the user's answer); a handle only if asked.

### Drop a catalog item into the 3D view

- Id: 9d1e13f7-83fd-4e22-a4ff-c40ac0c07fc9
- Number: G-079 12:00
- Status: Open
- Origin: ADR-094 (2026-10-26, Claude: not asked for)
- Missing: Dropping a catalog item into the 3D view.
- Request: "New adr 6" (2026-10-26)
- Questions: Drop into 3D too, once ADR-093 exists?
- Suggested pick: Drop onto the 3D floor plane with ADR-093's projection (about +30 % of ADR-094's work, +15 % value; estimates).

### Piece list open by default on desktop

- Id: ae0f856e-6bdd-47d8-aef9-4525f7820fad
- Number: G-080 12:00
- Status: Done (ADR-094)
- Origin: ADR-094 open question (2026-10-26)
- Missing: Whether the piece list is open by default on desktop; default closed.
- Request: "New adr 6" (2026-10-26)
- Questions: Open by default on desktop?
- Suggested pick: Closed, opened with Add a piece (keeps the plan wide; open by default costs the same).

### Lock a piece's sizes and parameters

- Id: a2c502a8-d956-4c50-9061-8c4dc3a1da98
- Number: G-081 12:00
- Status: Done (ADR-122)
- Origin: ADR-095 (2026-10-26, Claude: not asked for)
- Missing: Locking a piece's sizes and other parameters (the research's locked parameters); the lock covers placement only.
- Request: "New adr 8" (2026-10-26)
- Questions: Lock sizes and boards too?
- Suggested pick: Lock named parameters (closest to the research; about +40 % of ADR-095's work, +20 % value; estimates).

### Delete a locked piece

- Id: ec3c41ea-f318-4b62-b530-508b7079d18e
- Number: G-082 12:00
- Status: Done (ADR-095)
- Origin: ADR-095 open question (2026-10-26)
- Missing: Whether a locked piece may be deleted; default yes after confirmation.
- Request: "New adr 8" (2026-10-26)
- Questions: Allow deleting a locked piece?
- Suggested pick: Yes with the usual confirmation (no extra work).

### Restore an older version of a project

- Id: f08efaa7-1ffc-4529-b270-f7272fb46458
- Number: G-083 12:00
- Status: Done (ADR-123)
- Origin: ADR-096 (2026-10-26, Claude: not asked for)
- Missing: A history of older project versions to go back to (research: version recovery).
- Request: "New adr 9" (2026-10-26)
- Questions: Keep older versions of a project to restore?
- Suggested pick: Keep the last N saves per project in IndexedDB with Restore (about 20 points; closest to the research's version recovery).

### Newer-template notice in the Library

- Id: 89655068-ddb4-44c1-b054-74d193f2806d
- Number: G-084 12:00
- Status: Done (ADR-096)
- Origin: ADR-096 open question (2026-10-26)
- Missing: Whether saved designs in the Library show the newer-template notice; default yes.
- Request: "New adr 9" (2026-10-26)
- Questions: Show the notice in the Library too?
- Suggested pick: Yes (about +10 % of ADR-096's work).

### Mirror a selection of pieces

- Id: 182092be-d6c5-42f3-b0fc-3916901346e3
- Number: G-085 12:00
- Status: Done (ADR-121)
- Origin: ADR-097 (2026-10-26, Claude: not asked for)
- Missing: Mirroring a selection of pieces.
- Request: "New adr 2" (2026-10-26)
- Questions: Mirror a selection as Mirror the run does?
- Suggested pick: Mirror the selection about its centre (reuses ADR-069; about +10 % of ADR-097's work).

### First tap on a grouped piece

- Id: e69a3fa5-61f7-4aa3-852d-4a55667c2594
- Number: G-086 12:00
- Status: Done (ADR-097)
- Origin: ADR-097 open question (2026-10-26)
- Missing: Whether the first tap on a grouped piece selects the group; default yes, second tap the piece.
- Request: "New adr 2" (2026-10-26)
- Questions: Group first or piece first?
- Suggested pick: Group first, as ADR-083 does whole-to-part (no extra work).

### Keep a piece's own edits when replacing it

- Id: 7615b9ee-5f5f-4daf-b201-db0aec9bed8f
- Number: G-087 12:00
- Status: Done (ADR-124)
- Origin: ADR-098 (2026-10-26, Claude: not asked for)
- Missing: Carrying the old piece's own edits onto the replacing design.
- Request: "New adr 5" (2026-10-26)
- Questions: Try to map edits (shelves, drawers) onto the new design?
- Suggested pick: Not mapped; the confirmation says edits are replaced (mapping is unreliable across space trees).

### Compatible width when replacing

- Id: a21baee2-b0d0-47fa-bc2f-aadb52d7663b
- Number: G-088 12:00
- Status: Done (ADR-098)
- Origin: ADR-098 open question (2026-10-26)
- Missing: Which width counts as compatible; default the same width, others behind a switch.
- Request: "New adr 5" (2026-10-26)
- Questions: Same width only, or a tolerance?
- Suggested pick: Same width, others behind Show other widths (closest to the research's 600 to 600 example).

### Align the heights of wall units

- Id: 19b534bf-dea5-426a-9450-9a430e19142f
- Number: G-089 12:00
- Status: Done (ADR-122)
- Origin: ADR-099 (2026-10-26, Claude: not asked for)
- Missing: Aligning heights (top or bottom of wall units).
- Request: "New adr 7" (2026-10-26)
- Questions: Align tops/bottoms of wall units too?
- Suggested pick: Add Top/Bottom align for wall units (about +15 % of ADR-099's work).

### Distribute along the depth

- Id: d63c452f-a9dc-4b95-b1db-1adab8828b31
- Number: G-090 12:00
- Status: Done (ADR-099)
- Origin: ADR-099 open question (2026-10-26)
- Missing: Whether Distribute works along the depth too; default along the wall only.
- Request: "New adr 7" (2026-10-26)
- Questions: Distribute along the depth too?
- Suggested pick: Along the wall only (pieces stand against walls; depth distribution is rare).

### Persistent connections between pieces

- Id: ca28a9ce-e1a9-4fe3-9b82-5b57ef7fb328
- Number: G-091 12:00
- Status: Open
- Origin: ADR-100 (2026-10-26, Claude: not asked for)
- Missing: Persistent connections between pieces (research: connection hierarchy / assembly graph); rules apply while snapping and in checks only.
- Request: "New adr 3" (2026-10-26)
- Questions: Store connections so rules hold after placing?
- Suggested pick: Store connections as a graph (about 40 points; makes the engine 'prevent invalid connections' as the research states).

### User-written compatibility rules

- Id: 171b9237-45bf-4b61-a702-529f5d7dfe16
- Number: G-092 12:00
- Status: Open
- Origin: ADR-100 (2026-10-26, Claude: not asked for)
- Missing: Rules the user writes or edits.
- Request: "New adr 3" (2026-10-26)
- Questions: Let users add or edit compatibility rules?
- Suggested pick: Not yet; the rule list is shown read-only (editing rules needs a rule editor, about 25 points).

### Tolerance for depth and height differences

- Id: 9d0bf1e5-d56c-4f30-bbb4-901c5180ad81
- Number: G-093 12:00
- Status: Done (ADR-100)
- Origin: ADR-100 open question (2026-10-26)
- Missing: Whether small depth or height differences pass without a warning; default any difference warns.
- Request: "New adr 3" (2026-10-26)
- Questions: Allow a tolerance (mm) before warning?
- Suggested pick: Any difference warns until the user names a tolerance (never invent a physical value, ADR-010).

### Stop hook not yet observed in a live session

- Id: c26d609c-19d7-42bc-a75e-5d4570fbc5e5
- Number: G-094 12:00
- Status: Open
- Origin: ADR-082, 2026-10-26; the Stop hook was tested with sample inputs only (Done when), not observed in a live Claude Code session
- Missing: Evidence that the Stop hook in .claude/settings.json fires and asks once in a real Claude Code session (a worker subagent gets SubagentStop, not Stop, so it could not observe it)
- Request: “How to configure to have it always up to date? Hook?”
- Questions: Should someone end a real top-level session with a reply that lists skipped items and confirm the hook asks once?
- Suggested pick: Yes: one manual check in the next top-level session that ends with a Skipped this iteration list (estimate: effort +2%, value +10% of the hook's request)

### Catalog counts agreement unconfirmed

- Id: 342513a8-2e2f-429f-8eea-fdec0098a40b
- Number: G-095 12:00
- Status: Open
- Origin: Gap re-check 2026-10-26 (G-059); agent found it
- Missing: UI critique said the catalog counts disagree (118 vs 108, Living room 31 vs 33). a9e5780 added an 'N ready items' label (src/ui/Catalog.tsx:196); nobody has confirmed in a browser that the numbers now agree.
- Request: Run critique this design for the entire ui/ux; then 'Fix them directly' (G-059)
- Questions: None; it is a check.
- Suggested pick: Add a find-it step that compares the catalog total with the sum of its category counts at 390 and 1280 px; fix if they differ. (estimate: effort +2%, value +3%)

### Empty Brands list promises a cancelled feed

- Id: 20e6ceee-e453-4004-b39a-72cf28780549
- Number: G-096 12:00
- Status: Open
- Origin: Gap re-check 2026-10-26 (G-044); agent found it
- Missing: When Brands is empty, src/ui/Catalog.tsx:539-540 says 'The weekly catalog feed (Mondays, IKEA first) adds them once it can reach the manufacturers' sites.' That feed was cancelled (ADR-027/029/052 Deferred, won't do), so the text is misleading.
- Request: Catalog feed and brand filter (G-044) (context, not a quote)
- Questions: Replace the text with how brand products get in today (import), or hide the Brands source while it is empty?
- Suggested pick: Replace the text with what is true now: no brand products are bundled; import your own. Closest to the current app; no new feature. (estimate: effort +1%, value +3%)

### Fastener notes point to a removed screen

- Id: cc98ef4f-a29d-4ba1-8ed1-c1c652422263
- Number: G-097 12:00
- Status: Open
- Origin: Gap re-check 2026-10-26 (G-042); agent found it
- Missing: The shopping-list footer (src/core/shopping.ts:33) and fastener guidance (src/core/fasteners.ts:298) tell the user to go to 'Materials › Fasteners', which no longer exists since ADR-080 moved Configure into the Settings dialog.
- Request: Hardware and fastener completeness (G-042) (context, not a quote)
- Questions: None; it is a wording bug. Fix together with the Romanian labels in G-042?
- Suggested pick: Point both to the current path (Settings › Fasteners, or the piece's Size, boards and construction), and translate them in the Romanian CSV with G-042. (estimate: effort +1%, value +3%)

### ADR-082 still Pending though built

- Id: 21876fe6-8ab1-4333-b919-6362211808d7
- Number: G-098 12:00
- Status: Done (ec9c7a8)
- Origin: Gap re-check 2026-10-26; agent found it
- Missing: The gaps ledger (docs/adr/GAPS.md), pnpm gaps and the Stop hook exist and are in use, but ADR-082 is still Pending in docs/adr/ and was never shipped.
- Request: Gaps ledger (ADR-082, user rule 2026-10-25) (context, not a quote)
- Questions: Ship ADR-082 now (ship-adr), after checking its Done-when list?
- Suggested pick: Check ADR-082's Done-when list against the repo, then ship it with ship-adr. (estimate: effort +2%, value +2%)

### Group gaps by origin

- Id: 610c96b3-72c1-494a-a68a-2e5ecb700c38
- Number: G-099 12:00
- Status: Open
- Origin: ADR-101, 2026-10-26; user did not pick it
- Missing: The gaps page has no grouping by origin (the ADR or area a gap came from).
- Request: “Add a gaps page, similar to reseaech” — offered options: Search + status filter, Group by origin, Overview counts, Full detail per gap
- Questions: Add grouping by origin later?
- Suggested pick: Leave it out (the user picked the other three); the search finds an ADR id in the Origin field. (estimate for grouping: effort +10%, value +5%)

### Gap marks not in a file

- Id: e517beb7-823f-423c-86a7-1d3e252edcfa
- Number: G-100 12:00
- Status: Open
- Origin: ADR-101, 2026-10-26; agent scoped it out
- Missing: Marks made on the gaps page cannot be exported or imported as a file; they live on one device. Copy decisions is the only way out.
- Request: “Mark + hand to Claude”
- Questions: Export and import the marks as a file, like research marks?
- Suggested pick: Export / import a JSON of marks, like Research's Import & export (estimate: effort +10%, value +5%)

### Ledger not editable from the app

- Id: 392eff78-c6f0-4749-88ca-5e010d0d222e
- Number: G-101 12:00
- Status: Open
- Origin: ADR-101, 2026-10-26; ADR-002 (no backend, no tokens)
- Missing: The page cannot write docs/adr/GAPS.md; decisions go through Claude via Copy decisions, and the page shows the ledger of the deployed build.
- Request: Items “can be used to add as a new adr or mark as acknowledged and accepted” (G-050)
- Questions: None while ADR-002 holds.
- Suggested pick: Keep the hand-over to Claude (estimate for a GitHub-token write path: effort +60%, value +15%, and it breaks ADR-002)

### Alternatives for a piece that sits on another piece

- Id: 436c700c-a4c8-4788-9435-5f25ab172d4b
- Number: G-102 12:00
- Status: Done (user answer 2026-10-26 "Same width only for stacked pieces")
- Origin: ADR-098 implementation (2026-10-26, Claude: defaulted)
- Missing: Which catalog items count as the same placement kind for a piece placed on or above another piece; built: every standing and wall-hung item (the piece keeps its on-another-piece placement).
- Request: New adr 5 (2026-10-26): compatible = same placement kind (floor, wall, on another piece)
- Questions: For a piece on another piece, offer every item, or only standing items, or only items of the same family?
- Suggested pick: Every item, since the placement carries over (as built; narrowing to standing items is about +5 % of ADR-098's work)

### Family rule for your own templates

- Id: 976d35a0-9f5f-4d41-ae97-3920d4dfb16a
- Number: G-103 12:00
- Status: Open
- Origin: ADR-100 (2026-10-26, Claude: not asked for)
- Missing: The family rule reads the shipped catalog families only; a piece from one of your own templates (own-… families, stored on this device) has no known room group, so the family rule never refuses or warns for it.
- Request: New adr 3
- Questions: Should pieces from your own templates follow the family rule too (their template's rooms)?
- Suggested pick: Yes: record the template's rooms on the inserted piece's catalog origin (a design document change, ADR-011; about +10 % of ADR-100's work, closes the rule for every piece).

### Repairs for compatibility warnings

- Id: b1b9b631-76c6-4b09-84b3-b83d21e4bac0
- Number: G-104 12:00
- Status: Open
- Origin: ADR-100 (2026-10-26, Claude: not asked for)
- Missing: The depth, height and family warnings offer no previewed repair (ADR-071); each rule's repairs list is empty because no existing repair fixes them.
- Request: New adr 3
- Questions: Offer repairs such as 'Make Base cabinet 560 deep like its neighbour' or 'Move the bed away'?
- Suggested pick: Add a 'match the neighbour's depth/height' repair (closest to fixing the warning; about +20 % of ADR-100's work).

### Move display-only 3D models in the 3D view

- Id: 7989ba8c-b2c2-4470-930c-b4f542085e72
- Number: G-105 12:00
- Status: Open
- Origin: ADR-093 (2026-10-26, Claude: skipped this iteration)
- Missing: Move mode drags project pieces only; display-only 3D models (ADR-076) still move by their fields or on the Plan.
- Request: New adr to override the conflicts for 4 and make it ready
- Questions: Should Move in 3D also drag and turn display-only 3D models?
- Suggested pick: Yes, the same Move and Turn (closest to direct manipulation in 2D/3D; about +15 % work for +10 % of the request, estimates).

### Resizing a base moves a locked piece on it

- Id: 6f3dee15-42ae-418a-a42e-fb0463a82edf
- Number: G-106 12:00
- Status: Open
- Origin: ADR-095 (2026-10-26, Claude: found while building)
- Missing: A locked piece placed on or above another piece still follows its base when the base's size changes in the piece editor (moving or turning the base is refused; resizing is not a move).
- Request: Not a quote: ADR-095 'Nothing moves it for the user'
- Questions: Should resizing a base keep a locked piece on it where it is (leaving its base), or refuse the resize?
- Suggested pick: Refuse the resize with the reason, as a move of the base is refused (about +10 % of ADR-095's work).

### Keep mine for saved single pieces

- Id: bd08fed2-299c-4ca4-b5cc-59cadec63b7f
- Number: G-107 12:00
- Status: Open
- Origin: ADR-096 (2026-10-26, Claude: scoped while building)
- Missing: Saved single pieces in the Library (Projects → Single pieces) show 'Template updated (revision a → b)', but Keep mine and Replace are offered on project pieces only; a saved single piece has no field to remember a kept revision.
- Request: Answer to 'Show the notice in the Library too?': "Library too" (2026-10-26)
- Questions: Should a saved single piece also offer Keep mine (a design-document field) and Replace with the new revision?
- Suggested pick: Notice only, as built (the answer asked for the notice); Keep mine on saved designs needs an optional Design field (about +20 % of ADR-096's work, +10 % value; estimates).

### Multi-select in the front view and 3D

- Id: c22eea65-ff6f-46ef-bd40-711ad70654b8
- Number: G-108 12:00
- Status: Open
- Origin: ADR-097 (2026-10-26, Claude: scoped while building)
- Missing: Shift/Ctrl/Cmd-click adds pieces to the selection on the plan and in the project's piece list; in the room front view and in 3D a click still selects one piece.
- Request: New adr 2 (2026-10-26): Desktop: Shift- or Ctrl/Cmd-click adds or removes a piece
- Questions: Add Shift/Ctrl-click to the room front view and to 3D too?
- Suggested pick: Yes, the same toggle in both views (about +10 % of ADR-097's work, +10 % value; estimates).

### Cycling stacked pieces on the plan replaces opening them

- Id: 2ea80937-98f8-4cc2-8e8c-d0e892955654
- Number: G-109 12:00
- Status: Open
- Origin: ADR-097 (2026-10-26, Claude: defaulted while building)
- Missing: On the plan, a tap on the same spot over stacked pieces selects the next piece under it (ADR-097) instead of opening the selected piece's interior (ADR-083, G-066); stacked pieces open from the room front view, 3D or the card.
- Request: New adr 2 (2026-10-26): tapping the same spot again selects the next piece under the pointer
- Questions: Over stacked pieces on the plan, should a further tap cycle (as built) or open the piece, with cycling on another gesture?
- Suggested pick: Cycle as built (the ADR's words); opening stays one tap away in the front view (no extra work).

### Distribute across rows and centre-snap rules

- Id: 65f80a15-8354-43e1-93ab-9a015f84894b
- Number: G-110 12:00
- Status: Open
- Origin: ADR-099 (2026-10-26, Claude: defaulted while building)
- Missing: Distribute evenly over pieces at different heights (wall units and base units together, or a piece on another) is refused with the reason instead of spacing each row; centre snapping is offered only between pieces above and below each other (never at the same height) and the ADR-100 join rules do not apply to it (an alignment, not a join).
- Request: New adr 7 (2026-10-26): Distribute evenly (three or more selected pieces, along the wall)
- Questions: With a mixed selection, distribute each row on its own instead of refusing? Should the join rules also limit centre snapping?
- Suggested pick: Distribute each row on its own (closest to 'tidy runs in one tap'; about +15 % of ADR-099's work, +10 % value; estimates); keep the join rules for joins only.

### Keep proportions switch is not saved

- Id: 3243ec5f-bc53-404a-a965-3a6ddd146d77
- Number: G-111 12:00
- Status: Done (user answer 2026-10-27 "Screen only, on each time")
- Origin: ADR-102 (2026-10-27, Claude: defaulted while drafting)
- Missing: The Keep proportions switch is screen state only: it starts on each time a model is selected and is not saved in the project.
- Request: Width and height of an item must be editable adr; answer 'Yes, on by default' (Keep proportions switch)
- Questions: Should the switch remember its setting per model in the saved project (a project schemaVersion bump)?
- Suggested pick: Screen state only, on each time (the answer 'on by default'; saving it adds a schema change for little value; estimate +25 % effort, +5 % value).
- Answer: User 2026-10-27: "Screen only, on each time" — kept as built in ADR-102.

### Resize a 3D model by dragging in the 3D view

- Id: ffa5eda3-e2d0-43f8-874d-f604b9d37d8e
- Number: G-112 12:00
- Status: Done (ADR-102)
- Origin: ADR-102 (2026-10-27, Claude: out of scope)
- Missing: Resizing an imported 3D model with handles in the 3D view; sizes are typed in the fields only.
- Request: Width and height of an item must be editable adr
- Questions: Should the 3D view get resize handles for models?
- Suggested pick: Typed fields only (the request is to make the sizes editable; handles would be an exception to ADR-014's select-only viewer).

### Fill a wall: corner and L walls

- Id: 736f8cfd-7157-4aac-921c-28cbb4ecf05f
- Number: G-113 12:00
- Status: Open
- Origin: ADR-103, 2026-10-27; Claude scoped it out
- Missing: Fill a wall works on one straight wall only; corner and L-shaped walls are not filled.
- Request: a reverse furniture building, total width, to the mix of furniture pieces that fill that space (context: corners not mentioned)
- Questions: Should Fill a wall also fill corner or L walls, with a corner cabinet at the joint?
- Suggested pick: Fill each straight wall with ADR-103, then join two walls with a catalog corner cabinet (ADR-025). (estimate: effort +40%, value +15%)

### Fill a wall: room openings shape the mix

- Id: 9615aea2-a631-45a2-9d39-65d88295f46e
- Number: G-114 12:00
- Status: Open
- Origin: ADR-103, 2026-10-27; Claude scoped it out
- Missing: Room windows, doors, pipes and outlets do not shape the suggested mixes; they are checked only after the project is made.
- Request: a reverse furniture building, total width, to the mix of furniture pieces that fill that space (context: room openings not mentioned)
- Questions: Should Fill a wall read the project room (ADR-058) and avoid windows, doors and outlets?
- Suggested pick: Start Fill a wall from a wall of the project room and skip mixes that clash with its openings, using the existing room checks. (estimate: effort +30%, value +15%)

### Fill a wall: when the wall row appears

- Id: a66ae476-b9a6-472b-88aa-2efc926d5888
- Number: G-115 12:00
- Status: Done (ADR-104)
- Origin: ADR-104, 2026-10-27; open question defaulted by Claude
- Missing: Whether every mix gets a wall row, or a Refine choice decides (any / always / never).
- Request: Wall cabinets above (answer to: Which kinds of pieces may appear in a mix?)
- Questions: Should the wall row appear in every mix, in some mixes, or be chosen in Refine (any / always / never)?
- Suggested pick: Refine choice 'Wall cabinets: any / always / never', default any, so the first 4 cards show mixes with and without a wall row. (estimate: effort +3%, value +10%)

### Fill a wall: carcasses with 3 or more equal fronts

- Id: 9beab713-7690-47a1-8ae4-829438bf054c
- Number: G-116 12:00
- Status: Open
- Origin: ADR-103, 2026-10-27; Claude cut it while building
- Missing: Equal fronts puts 1 or 2 fronts on a carcass only (a door front has 1 or 2 leaves); carcasses with 3 or more fronts are not suggested, so fronts under 200 mm wide (with the 400 mm min) give no mix.
- Request: 6 equal front panels, what's behind is to be configured (answer: Equal fronts, any carcass widths)
- Questions: Should a carcass carry 3 or more equal fronts (with dividers inside), for narrow fronts?
- Suggested pick: Allow 3–4 fronts per carcass, built as equal bays with a divider and one door each, so narrow fronts still fill the wall. (estimate: effort +10%, value +5%)

### Fill a wall: tall cabinet height

- Id: 0f3802d5-fe4c-43e1-99bd-feb7b22fa857
- Number: G-117 12:00
- Status: Open
- Origin: ADR-103, 2026-10-27; default chosen by Claude while building
- Missing: Tall cabinets are always the catalog height (2200 mm, ADR-036 typical value); there is no tall-height field. A wall lower than that gets the warning on every mix with a tall cabinet.
- Request: allow with a warning items like tall cabinets, above this height
- Questions: Should Refine have a tall cabinet height field, or should tall cabinets follow the entered height?
- Suggested pick: Add a Tall cabinet height field in Refine, catalog value prefilled; the warning stays when it is above the entered height. (estimate: effort +3%, value +10%)

### Fill a wall: a width per base kind

- Id: 1c3f4899-877b-4e3c-96a7-837564cef140
- Number: G-118 12:00
- Status: Open
- Origin: ADR-103, 2026-10-27; Claude narrowed it while building
- Missing: All base kinds in one mix share one width (tall cabinets may have their own round width); mixes such as an 800 drawer base next to 600 shelf bases are not suggested.
- Request: So basically a mix and match (answer: Equal per kind, exact split)
- Questions: Should each base kind (open shelves, drawers, door + shelves) get its own width in a mix?
- Suggested pick: Also try one round width per base kind (steps of 50 mm), ranked after the shared width, so the cards show such mixes too. (estimate: effort +10%, value +15%)

### Doubled rails on a rails top

- Id: 237af397-da26-47c0-a89a-d96d6d6b206d
- Number: G-119 12:00
- Status: Open
- Origin: ADR-105, 2026-10-27, Claude default
- Missing: A doubled top on a rails top (two rails) is not built: the rails stay single and a warning says so.
- Request: Add the doubled top support … 2 panels
- Questions: Should 'Doubled' also double the two rails of a rails top, or stay a panel-top option only?
- Suggested pick: Panel top only (default used): the user's answer was '2 panels', a rails top has no panel; doubling rails is a separate request (+5 % work, +0 % of this request).

### Glue and screws for the doubled top

- Id: 3a56f79f-a1fd-4364-abb3-e82ffb5803a3
- Number: G-120 12:00
- Status: Open
- Origin: ADR-105, 2026-10-27, Claude (ADR-010)
- Missing: No glue or screw line in the hardware list for joining the two top layers; the layers count as a carcass joint in the fastener tally only.
- Request: Add the doubled top support … 2 panels
- Questions: Which glue and screws (length, spacing) join the two layers? Not known; ADR-010 forbids inventing them.
- Suggested pick: Leave it to the user's own fastener choice for carcass joints until they name a glue and screw (0 % work now).

### Doubled bottom, sides or shelves

- Id: 72698f6c-d13f-456a-88af-034c789f0bff
- Number: G-121 12:00
- Status: Open
- Origin: ADR-105, 2026-10-27, Claude scope
- Missing: Only the top can be doubled; a doubled bottom, side or shelf is not built.
- Request: Add the doubled top support
- Questions: Do you also want a doubled bottom or doubled sides?
- Suggested pick: Top only, as asked (0 % extra work).

### Fill a wall: at most 40 pieces per mix

- Id: 8936f5c8-6116-44fa-a899-13b9d5637ad5
- Number: G-122 12:00
- Status: Open
- Origin: ADR-103 review, 2026-10-27; Claude added the bound
- Missing: A mix has at most 40 pieces (Equal fronts at most 80 fronts), so a tiny min width cannot freeze the page; beyond that the wizard says so instead of suggesting.
- Request: suggest a good width per piece ... resulting in a few pieces of furniture mixed (context: no limit was asked for)
- Questions: Is 40 pieces per wall enough, or should the limit be higher?
- Suggested pick: Keep 40: a 400 mm min fills a 16 m wall; longer runs are better as several walls. (estimate: effort 0%, value 0%)

### Fill a wall: wall cabinet depth

- Id: ac5d3094-286c-4cd1-9d52-a2755df63a3c
- Number: G-123 12:00
- Status: Open
- Origin: ADR-104, 2026-10-27; default chosen by Claude while building
- Missing: Wall cabinets keep the catalog depth (320 mm carcass); there is no wall cabinet depth field.
- Request: Wall cabinets above (answer to: Which kinds of pieces may appear in a mix?)
- Questions: Should Refine have a wall cabinet depth field?
- Suggested pick: Add Wall cabinet depth in Refine, catalog value prefilled. (estimate: effort +2%, value +5%)

### Fill a wall: wall row reaching into the base row

- Id: 2bfdc1ef-f5ec-46e2-a1c2-57fef7bade32
- Number: G-124 12:00
- Status: Open
- Origin: ADR-104, 2026-10-27; Claude changed the agreed handling while building (ADR-008)
- Missing: The ADR said a wall cabinet reaching into the base row would be warned and still offered. It overlaps the base cabinet, which projects report as an error (pieces-overlap), and mixes with errors are never offered. Such wall rows are now dropped and the Suggestions step says by how much and to lower the wall cabinet height.
- Request: Catalog height, Refine field (answer to: How tall are the wall cabinets themselves?)
- Questions: When the wall cabinets would reach into the base row, should the wizard drop the wall row (now), shorten the wall cabinets to fit, or offer the mix with the overlap error shown?
- Suggested pick: Shorten the wall cabinets to the room left above the base row (never below the catalog minimum), labelled on the card, so a wall row still appears. (estimate: effort +5%, value +10%)

### Width and depth card over the project view for a selected piece

- Id: 25b92da7-97e8-4474-b4c5-60f1ba5820a7
- Number: G-125 12:00
- Status: Done (ADR-109)
- Origin: ADR-106
- Missing: In a project, a piece selected but not opened (Inside this piece) gets Width and Depth in its Selected piece card only; no floating card over the project drawing or 3D (the quick-count card shows there only for an opened piece, ADR-088).
- Request: Add the posibility to change width/depth when whole cabinet or whole piece is selected; answer: Card + side panel
- Questions: Should a selected project piece also get a floating Width/Depth card over the project plan, elevation and 3D?
- Suggested pick: Yes, a floating card over the project views (closest to 'Card + side panel'; estimate +60 % work, +15 % of value)

### No width/depth fields for a bed or a set of loose panels

- Id: 5ee9b193-0d32-42a7-a030-9d4b66f66116
- Number: G-126 12:00
- Status: Open
- Origin: ADR-106
- Missing: A bed's size comes from its mattress and a set of loose panels has no outside size, so neither shows Width/Depth when selected; a filler/cover panel shows Width only (it has no depth).
- Request: Add the posibility to change width/depth when whole cabinet or whole piece is selected
- Questions: Should a bed show its mattress size there instead, and loose panels nothing?
- Suggested pick: Bed: show the mattress width and length there (closest to the request; estimate +10 % work, +5 % of value)

### Fill a wall: the over-hood cabinet is not placed over a hood

- Id: 099512fe-5c9f-48da-b0e9-403d6f135c27
- Number: G-127 12:00
- Status: Open
- Origin: ADR-104, 2026-10-27, review nit
- Missing: The over-hood wall variant (no bottom) is dealt into the wall row at any position; nothing ties it to a hood or hob below.
- Request: Yes, every catalog wall variant
- Questions: Should the over-hood cabinet appear only above a hob or hood, or stay anywhere in the row?
- Suggested pick: Anywhere, as answered ('every catalog wall variant', 0 % extra work).

### Save a project piece back over an existing template

- Id: c3554d38-65eb-47e0-93bf-d02781df5ea8
- Number: G-128 12:00
- Status: Open
- Origin: ADR-107, 2026-10-27, Claude scope
- Missing: Saving a project piece always makes a new catalog template; it never overwrites the template the piece came from.
- Request: New adr to add the possibility to save a new piece to catalog when created it inside a project
- Questions: Do you also want 'Update the template' to write a project piece's changes back into its existing template as a new revision?
- Suggested pick: New template only, as asked (0 % extra work).

### Save a group or several pieces as one catalog item

- Id: 40c69abf-3b41-4a25-876d-9da5a61f48f2
- Number: G-129 12:00
- Status: Open
- Origin: ADR-107, 2026-10-27, Claude scope
- Missing: Only one piece at a time is saved to the catalog; a group or multi-selection is not saved as one item (project templates, ADR-060, cover whole projects).
- Request: New adr to add the possibility to save a new piece to catalog when created it inside a project
- Questions: Should a selected group of pieces be savable as one catalog item?
- Suggested pick: One piece at a time, as asked (0 % extra work).

### jsdom find-it cannot check layout

- Id: 6e1ef6e6-0252-4f42-9a64-0814f9059630
- Number: G-130 12:00
- Status: Open
- Origin: ADR-108 (Open question)
- Missing: jsdom applies no CSS, so the 390 px no-side-scroll rule and bounding-box checks are not tested by the default find-it
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Which ADRs must still run the browser script for layout?
- Suggested pick: ADRs that change layout or CSS set Acceptance browser; others stay jsdom

### jsdom find-it cannot render the 3D view

- Id: af351ece-67ef-4c71-9d09-70c255e46365
- Number: G-131 12:00
- Status: Open
- Origin: ADR-108 (Out of scope)
- Missing: The three.js viewer does not render in jsdom; 3D features are not found by the default find-it
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Should ADRs that touch the 3D view always use Acceptance browser?
- Suggested pick: Yes: ADRs touching the 3D view or Move mode use browser

### Existing browser find-it scripts are not ported to jsdom

- Id: 12896a7a-3d6a-4870-9e82-78aa2fc72b3d
- Number: G-132 12:00
- Status: Open
- Origin: ADR-108 (Out of scope)
- Missing: The 42 tools/*/find-it.mjs scripts stay; no jsdom versions for shipped ADRs
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Port any of them?
- Suggested pick: No; keep them as the browser regression set

### Light ADR catch-up mode after ADR-108

- Id: 30b08dd3-23d2-4fc1-8184-b7a0d2525c7f
- Number: G-133 12:00
- Status: Open
- Origin: ADR-108 (Open question)
- Missing: Undecided whether catch-up acceptance for light ADRs runs jsdom or the browser script
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Catch up acceptance with jsdom or browser?
- Suggested pick: jsdom, unless the ADR is layout or 3D

### Clearances wraps to a second row of the project plan toolbar on a phone

- Id: 7f60a932-d341-4a9f-ae74-b03217cb7462
- Number: G-134 12:00
- Status: Done (ADR-112)
- Origin: ADR-109
- Missing: At 390 px the plan toolbar holds Doors and fronts, Snap and Select on one row; Clearances wraps to a second row.
- Request: i dont see doors text moved with other; answer: Same row as Snap (Recommended)
- Questions: Should all four plan controls fit one row on a phone (shorter labels or icons), or is the wrap fine?
- Suggested pick: Keep the wrap (closest to the request: Doors and fronts is in Snap's row); one row would need shorter labels (estimate +20 % work, +5 % of value)

### jsdom find-it cannot tap the drawing by position

- Id: 4261b864-ef2a-4cc3-931e-c2b11cba8276
- Number: G-135 12:00
- Status: Open
- Origin: ADR-108 (found while building)
- Missing: The drawing hit-tests taps by screen position (getScreenCTM), which jsdom has no layout for; jsdom tests use each space's keyboard route (Enter), which runs the same tap at the space's centre, so a tap off-centre is not tested
- Request: "Move to B as default, keep the priginal as a flag to be abke to tevert"
- Questions: Is the keyboard route enough for drawing taps, or should tap-position work use Acceptance browser?
- Suggested pick: Keyboard route in jsdom; ADRs that change tap hit-testing use browser

### Link pieces that are already 100% identical

- Id: 095813c0-d1fd-48eb-8047-a57461edaf57
- Number: G-136 12:00
- Status: Open
- Origin: ADR-111, 2026-10-27, user choice
- Missing: Only copies made with 'Add a linked copy' are linked; identical pieces added separately, by Duplicate or by adding the same item again stay independent (user picked explicit links and only 'Add a linked copy').
- Request: use a piece, a item created by the user, added to the project, added multiple times, and give the possibility to bulk update the width/height/drawers, just like it would be 1 piece, with 2 symlinks to it, change to 1 changes all the other, including internal, and it should be propagated further to the ones in the 100% same.
- Questions: Should 'Link N identical pieces' link existing identical pieces, or should Duplicate / adding the same item again make linked copies?
- Suggested pick: 'Link N identical pieces' on the card: closest to 'propagated further to the ones in the 100% same' (est. +20 % work).

### Linked copies across projects and templates

- Id: 5d3edeb1-b77f-418a-a02b-84db1d1db4a9
- Number: G-137 12:00
- Status: Open
- Origin: ADR-111, 2026-10-27, Claude scope
- Missing: Links live inside one project; a change does not reach copies in other projects, saved designs or catalog templates (earlier request 2026-10-27, replaced by the user).
- Request: give the possibility to update the original template, and it should be propagated further to the ones in the templates.
- Questions: Should a change also reach the template and copies in other projects?
- Suggested pick: One project only, as in the current request (0 % extra work).

### How an info button shows its text

- Id: f40d0aba-5e86-45d2-8a25-35d343b97b3e
- Number: G-138 12:00
- Status: Acknowledged (2026-10-27)
- Origin: ADR-113
- Missing: The way the moved intro text opens is a default the user has not confirmed: tap or click the ⓘ button opens a small popover under it; tap outside, Escape or a second tap closes it
- Request: Move info text from Project to a tooltip, apply same to other similar UX occurences
- Questions: Popover on tap (also on hover on desktop), or hover-only tooltip?
- Suggested pick: Popover on tap and click, Escape closes (closest to the request: a hover-only tooltip cannot open on a phone)

### Heading scale for drawings and print sheets

- Id: 5d44c4a9-aacb-45a6-b145-108fe1d94400
- Number: G-139 12:00
- Status: Acknowledged (2026-10-27)
- Origin: ADR-116
- Missing: Text sizes inside SVG drawings and the printed sheets keep their own sizes
- Request: Run a critique for listings, headers, text, button sizes, gaps, groupings
- Questions: Should drawing labels and print sheets follow the app heading scale?
- Suggested pick: Keep their sizes (print is Romanian sheets with their own layout, ADR-020)

### Catalog density on desktop

- Id: 43d45272-01f4-4401-8270-dc71a9a87018
- Number: G-140 12:00
- Status: Done (ADR-119)
- Origin: ADR-118
- Missing: The Catalog is 36 785 px tall at 1280 px; ADR-118 makes only the phone layout compact
- Request: Run a critique for listings, headers, text, button sizes, gaps, groupings; answer Catalog density + wizard
- Questions: Compact cards and folded family details on desktop too?
- Suggested pick: Yes, same disclosure on desktop (closest to the request; estimate +15 % work, +20 % of value)

### Lower-severity critique items not picked

- Id: ca4cee4b-9f95-4b22-bc3c-f18fbefd008b
- Number: G-141 12:00
- Status: Done (ADR-120)
- Origin: docs/retros/2026-10-27-ui-critique.md
- Missing: Mixed checkbox/pressed toggles in the plan toolbar; Width/Depth and counts three times on desktop; Projects row names wrap beside three icon buttons; editor name field cut without ellipsis; 'Back to the editor' chevron points right; ADR numbers in UI text; Romanian names inside English descriptions; Projects groupings (Import beside list heading, Fill a wall twice); 'front faces you' lone line
- Request: Run a critique for listings, headers, text, button sizes, gaps, groupings
- Questions: Build these in a follow-up ADR?
- Suggested pick: One follow-up ADR for all of them (estimate +25 % work, +15 % of value)

### Count card can cover part of a piece that fills the front view

- Id: 5aa2b7e5-2aea-40f5-a310-7fc9fad3a918
- Number: G-142 12:00
- Status: Acknowledged (2026-10-27)
- Origin: ADR-112 (found while building)
- Missing: At 390 px in a project, when the whole selected piece fills the front view no corner is free: the card covers about 6 % of the piece (the plinth corner); a 3-row card cannot avoid a centre bay; taps on the drawing under the card hit the card
- Request: Increment/decrement card must be inside the rendered 2d view, not over
- Questions: Accept the small overlap, or shrink the drawing only in that case, or move the card outside the drawing when no corner is free?
- Suggested pick: Accept the overlap (closest to the request: the card stays inside the view and the drawing keeps its size)

### Count card hidden while the bottom sheet is open

- Id: 7f8b2567-f65c-4645-9d41-3721c5cf91f9
- Number: G-143 12:00
- Status: Acknowledged (2026-10-27)
- Origin: ADR-112 (found while building)
- Missing: On a phone the floating count card is hidden while the bottom sheet is open (the sheet holds the same counters); before, a single piece already did this, now the project front view does too
- Request: Force 2d view to maintain it's size, bottom cars can cover it partially, but not push it
- Questions: Keep the card hidden while the sheet is open, or show it in the visible part of the stage?
- Suggested pick: Keep hidden (the sheet shows the same counters; no duplicate)

### Wording changed while moving intro text

- Id: dfb8764f-36f4-4533-bfc8-add8d9e70c4e
- Number: G-144 12:00
- Status: Acknowledged (2026-10-27)
- Origin: ADR-113 (found while building)
- Missing: Catalog checkbox now 'I check safety-regulated items myself' (examples moved to its info); '(ADR-036)' dropped from a panel intro; shopping hint now 'Your prices, saved on this device.'; the quantity info shows at any quantity; wizard per-field help kept visible
- Request: Move info text from Project to a tooltip, apply same to other similar UX occurences
- Questions: Approve these three wording changes and the two choices?
- Suggested pick: Approve (shorter labels fit one row; the ADR number is not user text)

### Phone catalog cards cut text with no way to read it

- Id: 043d7507-562f-4925-9717-d7d3ed577bed
- Number: G-145 12:00
- Status: Done (ADR-119)
- Origin: ADR-118 (found while building)
- Missing: At 390 px each catalog card's text lines (variant names, sizes/parts line, 'You choose: …') are cut to one line with an ellipsis and cannot be expanded; source and grouping switches read 'Saved', 'Room', 'Type'; room chips and 'also called' moved behind 'About this family'; wizard Cancel removed at every width
- Request: Run a critique for listings, headers, text, button sizes, gaps, groupings; answer Catalog density + wizard
- Questions: Should cut card text expand on tap (or show in the item detail), and are the short labels and Cancel removal fine?
- Suggested pick: Full text in the item's detail view on tap (closest to the request: compact list, nothing unreachable; estimate +10 % work, +10 % of value)

### Where a cut catalog card's full text shows

- Id: c4332d5a-f323-4121-953c-54181f391f9b
- Number: G-146 12:00
- Status: Acknowledged (2026-10-27)
- Origin: ADR-119
- Missing: The Catalog has no item detail view (tapping a card opens the item), so G-145's pick needs a place for the full text
- Request: accept gap picks
- Questions: A More toggle that expands the card in place, or the text in an info popover?
- Suggested pick: More toggle in place (closest to the request: the text is on the card, one tap, works on touch and keyboard)

### Lower-severity critique fixes not agreed

- Id: 9359655b-bf9c-4ee7-ae03-a0d1063deade
- Number: G-147 12:00
- Status: Acknowledged (2026-10-27)
- Origin: ADR-120
- Missing: The nine fixes in ADR-120 are the critique's proposals; none is agreed
- Request: accept gap picks (G-141: one follow-up ADR for all of them)
- Questions: Accept the nine fixes as written in ADR-120, or change any?
- Suggested pick: Accept as written (each is the critique's fix for the item it names)

### ADR ids and Back link left on the Gaps and Research pages; Select lost its tooltip

- Id: 7f995865-0529-4452-81c6-3183753c4e78
- Number: G-148 12:00
- Status: Open
- Origin: ADR-120 (found while building)
- Missing: The Gaps page search placeholder still names ADR-072 and the Research page lists ADR ids (they are the content); Gaps and Research always show 'Back to the editor', not only with a design open; the Select checkbox lost the tooltip the old button had
- Request: accept as written (ADR-120: no ADR numbers in UI text; Back to the editor only when a design is open)
- Questions: Remove ADR ids from those two pages and hide Back there too, and give Select an info tip?
- Suggested pick: Keep the ids on Gaps and Research (they are the page's subject); hide Back there too; add an info tip to Select (estimate +5 % work, +5 % of value)

### Typed rotation: exact checks or bounding boxes

- Id: 9d538e21-9aff-4027-b1e8-eb45675df367
- Number: G-149 12:00
- Status: Done (ADR-121)
- Origin: ADR-121 (open question)
- Missing: Typed rotation in whole degrees is not built; every check, snap and drawing assumes axis-aligned boxes (quarter turns only)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Any whole degree with exact rotated-box checks, any whole degree with each turned piece checked by its enclosing box, or a typed field limited to 0/90/180/270?
- Suggested pick: Any whole degree with exact rotated-box checks (closest to the research's typed rotation; estimate +60 % work over enclosing boxes, +25 % of value: no false overlap errors)

### Review pack: what it holds and how it leaves the device

- Id: 6dd68b0b-c2b0-4b72-877b-3e4b37d185a1
- Number: G-150 12:00
- Status: Done (ADR-121)
- Origin: ADR-121 (open question)
- Missing: No single package to hand a project to a professional for review
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Contents (project file, parts CSV, SVG drawings, a printable HTML summary) and delivery: a .zip download, the device Share sheet with download fallback, or print only?
- Suggested pick: A .zip download plus the device Share sheet where offered (closest to handing a plan over; Share hands files to the OS, the app makes no request; estimate +15 % work, +20 % of value)

### Align Top/Bottom with floor pieces selected

- Id: 708db717-08fd-4111-8bc3-aa2b02f86de8
- Number: G-151 12:00
- Status: Done (ADR-122)
- Origin: ADR-122 (open question)
- Missing: Align Top and Bottom do not exist; a floor piece's height cannot move without resizing it
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Skip floor pieces and say why, or resize them to reach the line?
- Suggested pick: Skip them and say why (alignment moves pieces, as ADR-099; resizing is a separate action)

### Size lock: separate or part of Lock

- Id: d823b978-75d4-4587-a05c-832670669ac1
- Number: G-152 12:00
- Status: Done (ADR-122)
- Origin: ADR-122 (open question)
- Missing: A piece's sizes cannot be locked (G-081)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: A separate Lock size toggle, or one Lock that covers position and size?
- Suggested pick: Separate Lock size (the research names locked parameters apart from pinned positions; estimate +10 % work, +15 % of value)

### Height drag in 3D: which pieces

- Id: 2379850f-3bfe-4ecc-bfda-d6af7d8ae3e0
- Number: G-153 12:00
- Status: Done (ADR-122)
- Origin: ADR-122 (open question)
- Missing: No vertical drag in 3D Move mode (G-078)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Only wall-placed pieces, or also floor pieces (which would then become raised)?
- Suggested pick: Wall-placed pieces only (height comes from placement, ADR-031; floor pieces stay on the floor)

### Section view: which cut planes

- Id: 948aa4a6-7cab-4a69-8825-2575b500b225
- Number: G-154 12:00
- Status: Done (ADR-122)
- Origin: ADR-122 (open question)
- Missing: No section, cutaway or isolate in the 3D view
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: One front-to-back cut, or a cut along any of the three axes?
- Suggested pick: Any of the three axes (closest to 'cut through the ensemble'; estimate +15 % work, +20 % of value)

### Project versions: when one is kept

- Id: 0582e8c5-0b9f-4bc9-85eb-9bc4cd7ec062
- Number: G-155 12:00
- Status: Done (ADR-123)
- Origin: ADR-123 (open question)
- Missing: No history of older project versions (G-083)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Automatic (one version each time a project is opened for editing, plus Save a version by hand), by hand only, or on every change?
- Suggested pick: Automatic per editing session plus by hand (closest to 'stronger recovery': nothing to remember; estimate +10 % work, +30 % of value)

### Project versions: how many are kept

- Id: 79e6bdf9-20c6-474f-9756-ac002481566e
- Number: G-156 12:00
- Status: Done (ADR-123)
- Origin: ADR-123 (open question)
- Missing: Keeping versions grows storage; removing old ones deletes saved data, which needs the user's decision (ADR-012)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Keep every version until the user deletes it, or keep the last N and drop older ones automatically?
- Suggested pick: Keep every version until the user deletes it (nothing deleted without the user, ADR-012)

### Undo log: labelled snapshots or inverse commands

- Id: f4e0af09-c018-4344-b472-a40495385828
- Number: G-157 12:00
- Status: Done (ADR-123)
- Origin: ADR-123 (open question)
- Missing: Undo is a list of unlabelled snapshots; no named steps, no step list, no explicit transactions
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Labelled snapshots grouped into transactions, or a log of inverse commands?
- Suggested pick: Labelled snapshots grouped into transactions (gives the named log and atomic steps the research describes; inverse commands estimate +80 % work, under +5 % of value)

### Style suggestions: where they come from

- Id: ad2132ee-7021-4c61-838d-c2855579cf7e
- Number: G-158 12:00
- Status: Done (ADR-123)
- Origin: ADR-123 (open question)
- Missing: No style or material suggestions
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Built-in named styles (board and handle combinations from the shipped lists), combinations from the user's own projects, or both?
- Suggested pick: Both (estimate +30 % work over built-in only, +40 % of value: suggestions match what the user actually uses)

### Design codes: link or text

- Id: 05812917-cfe2-4567-82a0-c1282d40b2e4
- Number: G-159 12:00
- Status: Done (ADR-124)
- Origin: ADR-124 (open question)
- Missing: No code to share or reopen a design or project elsewhere
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: A link that opens the app with the design, plus the text code, or the text code only?
- Suggested pick: Link plus text code (closest to IKEA-style codes that reopen a design; estimate +10 % work, +25 % of value)

### Replace: which own edits carry over

- Id: c767ab16-27d5-4bca-9861-7153a0971f3c
- Number: G-160 12:00
- Status: Done (ADR-124)
- Origin: ADR-124 (open question)
- Missing: Replacing a piece drops its own edits (G-087)
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Every changed setting that also exists on the new design (listing the rest), or only size and boards?
- Suggested pick: Every changed setting that exists on the new design, with a list of what could not carry (closest to G-087; estimate +40 % work, +50 % of value)

### Template references: default and fallback

- Id: b8ad633a-05e9-4ebd-8646-d11c25203a11
- Number: G-161 12:00
- Status: Done (ADR-124)
- Origin: ADR-124 (open question)
- Missing: Project pieces are full copies (ADR-022); none refers to its template and stores only its changes
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: New catalog pieces refer to their template with a kept copy as fallback, refer with no copy (only changes stored), or opt in per piece?
- Suggested pick: Refer by default and keep a copy as fallback (closest to the research while a missing template never loses a piece, ADR-012; estimate +20 % work over no copy, same value)

### Project-wide settings: which ones

- Id: cb7bc46e-3134-4d5a-960c-2b74611facec
- Number: G-162 12:00
- Status: Done (ADR-124)
- Origin: ADR-124 (open question)
- Missing: No project-wide parameters that every piece follows unless it overrides them
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Which settings: carcass, front and back boards and banding; handle type; front overlay; plinth height — all, or a subset?
- Suggested pick: All of them (the settings the catalog families share; estimate +40 % work over boards only, +60 % of value)

### Run sinks: what is generated

- Id: b643f477-bb4a-4c78-8b66-9d68cc2f1edd
- Number: G-163 12:00
- Status: Done (ADR-125)
- Origin: ADR-125 (open question)
- Missing: Sinks are not generated for a run
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: A sink cut-out in the run worktop over a chosen base, sized by the user, plus a shopping line — or a sink as a 3D item too?
- Suggested pick: Cut-out sized by the user, a cut-list note and a shopping line (no sink sizes invented, ADR-010)

### Run handles: where the line sits

- Id: 8a3f2d73-733c-42b8-9f9b-accb54013a74
- Number: G-164 12:00
- Status: Done (ADR-125)
- Origin: ADR-125 (open question)
- Missing: Handles are chosen per piece; nothing lines them up across a run
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: One handle type and one height line for every front in the run: line at the top of fronts, centred, or a height in mm the user enters?
- Suggested pick: A height in mm the user enters, with top-of-front as a one-tap choice (closest to a generated, aligned handle line)

### Rapier: trial or adopt

- Id: 0a540a4b-9f7d-4670-afc5-3b03d8f7c966
- Number: G-165 12:00
- Status: Done (ADR-125)
- Origin: ADR-125 (open question)
- Missing: No spatial query engine; checks are hand-written box tests
- Request: Check which features are left in the features reasearch, and that we dont have, for all missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features
- Questions: Run a measured trial (decision recorded, nothing shipped unless it wins), or adopt Rapier for the checks now?
- Suggested pick: Measured trial first (the research says 'evaluate'; a new WASM dependency needs its licence, size and offline behaviour checked)

### Angled pieces snap and measure by their enclosing box

- Id: 82b08b20-76c8-4973-8c78-037eedf8261a
- Number: G-170 12:00
- Status: Open
- Origin: ADR-121 (found while building)
- Missing: A piece typed at an angle snaps to neighbours and walls by the axis-aligned box around it, not its turned faces; the mm amounts in overlap and blocked-opening messages are measured on those boxes. Detection itself is exact.
- Request: Accept default, /batch all ready
- Questions: Snap angled pieces face to face along their turned sides, and measure overlaps exactly?
- Suggested pick: Snap along turned faces and measure exactly (closest to typed rotation 'while snapping keeps working'; estimate +40 % work on ADR-121's rotation part, +15 % of value)

### Angled pieces are not part of runs

- Id: 75cb62a7-7e12-4fb0-814b-c97323a2cd14
- Number: G-171 12:00
- Status: Open
- Origin: ADR-121 (found while building)
- Missing: A piece at an angle is left out of runs: no shared worktop, run plinth, fillers, covers, trims or side-by-side compatibility rules for it
- Request: Accept default, /batch all ready
- Questions: Should run parts follow an angled piece (a worktop cut at an angle), or is leaving it out right?
- Suggested pick: Leave it out (run parts are straight boards along a wall, ADR-036; an angled worktop is a new cut shape)

### 3D outlines of an angled piece are drawn unturned

- Id: 4893327f-6360-4e9d-a910-a7d8f33e9e48
- Number: G-172 12:00
- Status: Open
- Origin: ADR-121 (found while building)
- Missing: In the 3D view, the selection outline of a space inside an angled piece and the Move-mode ghost are drawn as the unturned or enclosing boxes; the boards themselves are drawn turned
- Request: Accept default, /batch all ready
- Questions: Turn the selection outline and the Move ghost with the piece?
- Suggested pick: Turn them (estimate +5 % work, +5 % of value)

### Selected space hides its piece's boards in 3D

- Id: a880efb4-5fa2-4486-963b-ec8b9511b636
- Number: G-173 12:00
- Status: Open
- Origin: ADR-121 (found while building)
- Missing: With a space selected inside a piece, that piece's boards do not draw in the 3D view; only the selection outline shows. Also on main (happens at 0° and with the always-on render loop)
- Request: Accept default, /batch all ready
- Questions: Fix it in this PR or in a separate change?
- Suggested pick: Fix it in this PR, since this PR touches Viewer3D (estimate +5 % work)

### Lock parameters other than size

- Id: 5add5c28-9909-4f5e-8905-2102b6738a10
- Number: G-180 12:00
- Status: Open
- Origin: ADR-122 (found while building)
- Missing: Lock size covers width, height and depth only; boards, construction and insides of a size-locked piece stay editable (the research's locked parameters, G-081, beyond size)
- Request: Accept default
- Questions: Should other parameters (boards, construction, insides) be lockable too, and one by one or together?
- Suggested pick: Leave as is until asked (the user's pick was a separate Lock size)

### Move/Section toggle sometimes ignores the first tap after a touch drag or while the 3D view settles

- Id: c4115984-d617-422b-ac91-e80753dc0ca9
- Number: G-181 12:00
- Status: Open
- Origin: ADR-122 (found while checking)
- Missing: In the production-build find-it run, Move and Section sometimes stayed off after one tap: right after a touch drag on a phone, or while the 3D view was settling after the look changed; the script now taps again until the toggle reads pressed
- Request: Push, merge
- Questions: Trace and fix the dropped tap, or keep the retry in the find-it script?
- Suggested pick: Trace and fix (estimate +10 % work)

### Versions of a deleted project

- Id: 51627d71-7e3d-4b5c-add2-da892fc020b5
- Number: G-190 12:00
- Status: Open
- Origin: ADR-123 (found while building)
- Missing: Deleting a project leaves its kept versions on the device; nothing lists or removes them (G-156: nothing removes versions without the user)
- Request: Accept default, /batch all ready (G-156: keep every version until the user deletes it)
- Questions: When a project is deleted, ask whether to delete its versions too, keep them silently, or list orphaned versions somewhere to restore or delete?
- Suggested pick: Ask on delete, defaulting to keep (closest to G-156: nothing removed without the user's decision)

### Project-wide settings and the size lock

- Id: c03943e6-afed-4eca-a562-3024669936b6
- Number: G-200 12:00
- Status: Done (ADR-122)
- Origin: ADR-124 (found while building)
- Missing: Project settings and Replace do not check ADR-122's size lock: ADR-122 is not on main when ADR-124 is built
- Request: Accept default, /batch all ready
- Questions: When both are merged: should a size-locked piece refuse project settings that change its size (plinth height) and Replace?
- Suggested pick: Refuse and name the piece, as ADR-122 says for Fill-a-wall, Replace and linked edits

### Pictures and 3D models in design codes

- Id: 60ee6717-744b-4271-8a45-ba8fceb35f9f
- Number: G-201 12:00
- Status: Open
- Origin: ADR-124 (scope)
- Missing: A design code carries the document only; board pictures and display-only 3D models stay on this device (a project file carries them)
- Request: Accept default, /batch all ready
- Questions: Should codes also carry pictures and 3D models (much longer codes), or stay document-only?
- Suggested pick: Document-only (codes stay short enough to paste; the project file carries the rest)

### Replace and the outer size

- Id: a7ce8a43-d432-4bc8-9a24-7e1751a75741
- Number: G-202 12:00
- Status: Open
- Origin: ADR-124 (found while building)
- Missing: Replace never carries the piece's own outer width, height or depth; this narrows the accepted G-160 pick 'every changed setting'
- Request: Accept default, /batch all ready
- Questions: Carry size too (neighbours may then overlap; those become diagnostics), or keep the catalog item's size?
- Suggested pick: Carry size too (closest to the pick; estimate +10 % work, +15 % of value)

### Wizard and template pieces and the project settings

- Id: 72f15520-1674-4d97-9c8d-f6c7bd2c8dc5
- Number: G-203 12:00
- Status: Open
- Origin: ADR-124 (found while building)
- Missing: Pieces added from the wizard or by inserting a template do not take the project settings; only Add a piece does
- Request: Accept default, /batch all ready
- Questions: Should they take the project settings like Add a piece?
- Suggested pick: They take them, like Add a piece (estimate +5 % work)

### Project templates drop run handles and sinks

- Id: 79733d96-98e2-48c3-b1b3-516aed5cfceb
- Number: G-210 12:00
- Status: Open
- Origin: ADR-125 (found while building)
- Missing: Saving a project as a project template (ADR-060) keeps neither its run handles nor its sinks; a project made from it has none
- Request: Accept default, /batch all ready (ADR-125: run sinks and handles)
- Questions: Should project templates keep run handles and sinks (with the piece ids remapped)?
- Suggested pick: Keep them, remapped like run-part keys (closest to a reusable kitchen layout)

### Run handles not shown inside the piece editor

- Id: 2797b60d-e5ee-4cc1-aa0f-ff694dfd2e7b
- Number: G-211 12:00
- Status: Open
- Origin: ADR-125 (found while building)
- Missing: Opening one piece of a handled run shows and edits its own handles; the run's handle shows only in the project views, cut list and hardware
- Request: Accept default, /batch all ready (ADR-125: run sinks and handles)
- Questions: Should the piece editor show the run's handle (read-only) with a note that the run sets it?
- Suggested pick: Show it read-only with 'Set by Handles for this run' (no change to the piece's own design)

### Sink cut-out not drawn

- Id: 3f75de31-d63e-47e6-a8e7-5a21ff7f9d10
- Number: G-212 12:00
- Status: Open
- Origin: ADR-125 (found while building)
- Missing: The sink cut-out is a cut-list note, a shopping line and checks; it is not drawn on the plan, the front view or in 3D (worktop cut-outs were already not drawn)
- Request: Accept default, /batch all ready (ADR-125: run sinks and handles)
- Questions: Draw the cut-out outline on the plan and in 3D?
- Suggested pick: Outline on the plan only (where the worktop is drawn from above)

### Paid backend allowed

- Id: ad7bc1df-a6f3-4a7b-8e87-e05c3f8d5014
- Number: G-213 12:00
- Status: Done (ADR-126)
- Origin: ADR-126, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on whether the online features may use a paid plan; ADR-002 says the owner wants no paid dependency.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Free tier only, or a paid plan up to a monthly amount you set?
- Suggested pick: Free tier only until a limit is reached, then you decide (keeps ADR-002's no-paid-dependency wish; estimate effort +0 %; risk: free-tier pauses and limits, unverified)
- Note: Answered by the user 2026-10-28: Free tier only.

### Who can create an account

- Id: 02460c70-bcce-4d42-9611-b1aaedbdf1db
- Number: G-214 12:00
- Status: Done (ADR-126)
- Origin: ADR-126, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on who may sign up.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Only you (allow-list of emails), people you invite, or anyone (public sign-up)?
- Suggested pick: Anyone (closest to “user accounts” and share links; estimate effort +15 % for abuse limits and GDPR work, value +30 % over owner-only)
- Note: Answered by the user 2026-10-28: Anyone (public sign-up).

### How online code is loaded

- Id: 01dd2510-876d-463e-b377-646d4eb08463
- Number: G-215 12:00
- Status: Done (ADR-126)
- Origin: ADR-126, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on whether the online client code is in the main bundle.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Load the online client in a lazy chunk only after the user opts in, or ship it in the main bundle?
- Suggested pick: Lazy chunk after opt-in (closest to an offline core; estimate effort +5 %)
- Note: Answered by the user 2026-10-28: Lazy chunk after opt-in.

### Opening a share link asks first

- Id: e1855db5-9c0c-4e31-b146-166236fe9efa
- Number: G-216 12:00
- Status: Done (ADR-126)
- Origin: ADR-126, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on whether opening a share link contacts the server at once.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Fetch the shared item as soon as the link opens, or ask “Load this shared item from the server?” first?
- Suggested pick: Ask first, like ADR-124's #open= links (estimate effort +2 %)
- Note: Answered by the user 2026-10-28: Load at once (no ask).

### Backend vendor not chosen

- Id: 275b567a-bbd0-477a-b884-3fa22b532e34
- Number: G-217 12:00
- Status: Done (ADR-127)
- Origin: ADR-127, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No backend, auth provider or database is chosen.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Supabase, Cloudflare D1 with a Worker (plus an auth provider), Turso or Neon (plus an auth provider), Firebase, or self-hosted PocketBase / Appwrite?
- Suggested pick: Supabase: the only candidate in the earlier research that offers Google sign-in, email/password with reset and a database in one service, i.e. items 3, 4 and 5 (estimate: least extra work among candidates covering all six items; risk: free projects pause after 1 week idle, unverified)
- Note: Answered by the user 2026-10-28: Supabase.

### Data region

- Id: 75381ddb-a94b-4799-9e23-7e2038f50abe
- Number: G-218 12:00
- Status: Done (ADR-127)
- Origin: ADR-127, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No data region chosen.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: An EU region, or any region the vendor offers?
- Suggested pick: An EU region (users in Romania, GDPR; estimate effort +0 %)
- Note: Answered by the user 2026-10-28: EU region.

### Owner of the backend account and keys

- Id: 2ce2378b-7554-4ffc-b37d-912e309a13ab
- Number: G-219 12:00
- Status: Done (ADR-127)
- Origin: ADR-127, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No owner of the vendor account, billing and keys.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Your personal account, or a company account?
- Suggested pick: Your own account, keys held by you (closest to a single-owner app); only you can answer
- Note: Answered by the user 2026-10-28: My personal account.

### Vendor facts unverified

- Id: c21f033e-c656-4c7d-b7d6-2b21d634ae49
- Number: G-220 12:00
- Status: Done (ADR-127)
- Origin: ADR-127, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Free-tier quotas, idle pauses, prices, licences and telemetry of every candidate are unknown or come from unverified secondary research (2026-10-27/28).
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Verify each fact on the vendor's own pages, with URL and date, before choosing?
- Suggested pick: Yes, recorded in ADR-127 before approval (estimate effort +5 %)
- Note: Answered by the user 2026-10-28: Yes, verify vendor facts.

### Which records go to the account

- Id: 8aee74f5-0cc0-446f-9c2d-5f71bfe6a7b8
- Number: G-221 12:00
- Status: Done (ADR-128)
- Origin: ADR-128, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on which saved data is stored in the account.
- Request: “New adr for save user templates and created pieces in db”
- Questions: Library pieces and your templates only (your words), plus the board pictures they use, or also projects, project templates, prices, decors and 3D models? Does “created pieces” include pieces inside projects?
- Suggested pick: Pieces and templates plus the pictures they use (a piece without its pictures opens with plain colours; estimate effort +15 %, value +20 %)
- Note: Answered by the user 2026-10-28: Pieces, templates + pictures; created pieces = library pieces only (not pieces inside projects).

### Where the local-to-account link is kept

- Id: ee05bd56-d579-4c73-826c-4ef58ae0808f
- Number: G-222 12:00
- Status: Done (ADR-128)
- Origin: ADR-128, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on where a local row records its account copy.
- Request: “New adr for save user templates and created pieces in db”
- Questions: A separate Dexie table (next free version, documents unchanged), or a field in the design document (schemaVersion 4)?
- Suggested pick: Separate table: the link is per device and per account and must not travel in exported files or design codes (estimate effort +0 %)
- Note: Answered by the user 2026-10-28: Separate table.

### Per-account limits

- Id: 1783a0d4-97d3-4caa-846a-b59a6fbf1ad2
- Number: G-223 12:00
- Status: Done (ADR-128)
- Origin: ADR-128, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No caps on the number or size of account records.
- Request: “New adr for save user templates and created pieces in db”
- Questions: Which per-account count and size caps?
- Suggested pick: validateDesign's caps per document plus a total size cap set once the vendor's free quota is known (unknown today)
- Note: Answered by the user 2026-10-28: Design caps + total cap.

### Designs saved before sign-in

- Id: 07cf98ad-cafb-46b8-a095-62c692bb698d
- Number: G-224 12:00
- Status: Done (ADR-129)
- Origin: ADR-129, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on what happens to local designs at the first sign-in.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Ask once (Upload all / Choose / Not now), upload everything silently, or upload nothing?
- Suggested pick: Ask once; nothing moves without your decision (estimate effort +5 %)
- Note: Answered by the user 2026-10-28: Upload all silently.

### Edits while offline and signed in

- Id: 022c4bfe-262a-4140-9958-f4523e0eb3e1
- Number: G-225 12:00
- Status: Done (ADR-129)
- Origin: ADR-129, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No offline policy for account items.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Save locally and send later, or block editing account items while offline?
- Suggested pick: Save locally and send later (closest to offline-first; estimate effort +20 %)
- Note: Answered by the user 2026-10-28: Save locally, upload later.

### Same item changed on two devices

- Id: 713a7f0f-60fb-410a-bb94-9609629da85e
- Number: G-226 12:00
- Status: Done (ADR-129)
- Origin: ADR-129, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No conflict policy between devices.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Keep both (the second saved as a copy named after its device), last save wins, or ask with a compare?
- Suggested pick: Keep both: never loses work; last save wins would rewrite a saved design without your decision (estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Keep both.

### Signing out on a shared device

- Id: 6b3dcd09-9449-44b5-ad22-cda27daf505d
- Number: G-227 12:00
- Status: Done (ADR-129)
- Origin: ADR-129, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on local copies after sign-out.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Keep the local copies, offer to remove them (with confirmation), or remove them automatically?
- Suggested pick: Offer to remove, default keep (estimate effort +3 %)
- Note: Answered by the user 2026-10-28: Offer to remove, default keep.

### Deleting an item that is in the account

- Id: 18c2b39a-084a-4a41-932b-b4ff1e5e3de6
- Number: G-228 12:00
- Status: Done (ADR-129)
- Origin: ADR-129, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on how a delete reaches other devices.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Delete everywhere at once, move to an account Trash kept for N days (you pick N), or delete only on this device?
- Suggested pick: Account Trash; N is your choice (estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Account Trash, 7 days.

### Data controller and contact

- Id: 1351a283-7599-4c77-a794-6b3443a75bbe
- Number: G-229 12:00
- Status: Done (ADR-130)
- Origin: ADR-130, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: The privacy notice has no controller name or contact.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Who is named as controller (you as a person, or a company) and which contact email?
- Suggested pick: The person or company that owns the backend account (ADR-127); only you can answer
- Note: Answered by the user 2026-10-28: Controller: the user as a person; contact Beliserii@gmail.com.

### Consent for sign-in storage

- Id: 38cfda70-2510-48f6-b1d7-9499beef32b1
- Number: G-230 12:00
- Status: Done (ADR-130)
- Origin: ADR-130, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on a consent banner for the session stored on the device.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: A consent banner, or a line at sign-in explaining the strictly necessary session storage?
- Suggested pick: A line at sign-in, no banner (engineering guidance, not legal advice; to be checked)
- Note: Answered by the user 2026-10-28: Line at sign-in, no banner.

### Privacy notice language

- Id: 4e0c51e8-13e1-44ea-951c-a4d869e1e452
- Number: G-231 12:00
- Status: Done (ADR-130)
- Origin: ADR-130, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No language chosen for the privacy notice.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Romanian, English or both?
- Suggested pick: Both: the app UI is English (ADR-020) and users are in Romania (estimate effort +5 %)
- Note: Answered by the user 2026-10-28: English.

### Retention after account deletion

- Id: 5d4a3f1a-b46e-49d6-83e3-50a71ddce75b
- Number: G-232 12:00
- Status: Done (ADR-130)
- Origin: ADR-130, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No retention period; the vendor's backup period is unknown.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Delete at once (vendor backups age out), or keep N days so a deletion can be undone?
- Suggested pick: Delete at once and state the vendor's backup period once known
- Note: Answered by the user 2026-10-28: Delete at once.

### Privacy notice not reviewed by a lawyer

- Id: 7768cb1c-3348-4264-9c56-6754d2275822
- Number: G-233 12:00
- Status: Done (ADR-130)
- Origin: ADR-130, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Nobody with legal training has reviewed the notice or the GDPR approach.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts, with templates and pieces saved in a database and shareable”
- Questions: Have the notice reviewed before public sign-up opens?
- Suggested pick: Yes, before public sign-up
- Note: Answered by the user 2026-10-28: No legal review.

### Where the sign-in session is kept

- Id: a669950c-ac3c-4efe-a8ca-317ff83d6aea
- Number: G-234 12:00
- Status: Done (ADR-131)
- Origin: ADR-131, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on session storage.
- Request: “New adr for login using that persistent storage”
- Questions: IndexedDB or localStorage on the device (survives restarts and offline starts), memory only (sign in on every visit), or an httpOnly cookie (needs a server on the same site; GitHub Pages cannot set one)?
- Suggested pick: Device storage, protected by a strict CSP (closest to “login using that persistent storage”; estimate effort +0 %)
- Note: Answered by the user 2026-10-28: On the device.

### Rate-limit values

- Id: 0cf47fb0-3ee9-4eab-8360-c59865ea3cc6
- Number: G-235 12:00
- Status: Done (ADR-131)
- Origin: ADR-131, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No rate-limit numbers for sign-in, share-link creation and share-link opening.
- Request: “New adr share link to templates/pieces”
- Questions: Which limits per account and per address?
- Suggested pick: Vendor defaults for sign-in; own share-link limits set once the vendor is known (values unknown today)
- Note: Answered by the user 2026-10-28: Vendor defaults first.

### Who can open a share link

- Id: 867c43f9-3e97-4af9-9126-f215b971067c
- Number: G-236 12:00
- Status: Done (ADR-132)
- Origin: ADR-132, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No access model for share links.
- Request: “New adr share link to templates/pieces”
- Questions: Anyone with the link (unlisted), signed-in users only, named people, or a public gallery?
- Suggested pick: Anyone with the link (closest to “share link”; estimate effort +0 %)
- Note: Answered by the user 2026-10-28: Anyone with the link.

### Share-link expiry and revoking

- Id: ef2f2b3f-1f3f-4805-bef0-4ca9c0cc8b11
- Number: G-237 12:00
- Status: Done (ADR-132)
- Origin: ADR-132, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on expiry or revoking.
- Request: “New adr share link to templates/pieces”
- Questions: No expiry, an expiry the owner sets, or a fixed expiry? Can the owner stop a link?
- Suggested pick: No expiry by default; the owner can stop a link (estimate effort +5 %)
- Note: Answered by the user 2026-10-28: No expiry, owner can stop.

### What a share link shows

- Id: 46593cee-8632-4dce-b893-9f611f00bcd4
- Number: G-238 12:00
- Status: Done (ADR-132)
- Origin: ADR-132, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on snapshot or latest version.
- Request: “New adr share link to templates/pieces”
- Questions: The item as it was when shared, or always its latest saved version?
- Suggested pick: Latest saved version: the link points at the item in the database (estimate effort +5 %)
- Note: Answered by the user 2026-10-28: Latest saved version.

### When to ask the browser to keep data

- Id: 8826fe78-e263-494a-ae13-1c0cb65d925e
- Number: G-239 12:00
- Status: Done (ADR-133)
- Origin: ADR-133, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on when navigator.storage.persist() is called.
- Request: “new ADR for persistent storage and folder backup”
- Questions: At the first save automatically, or only from a button in Settings?
- Suggested pick: At the first save, with the state shown in Settings (closest to “persistent storage”; estimate effort +2 %)
- Note: Answered by the user 2026-10-28: At the first save.

### What a backup holds

- Id: 2182233e-0f01-4cdf-8557-081dde9d6825
- Number: G-240 12:00
- Status: Done (ADR-133)
- Origin: ADR-133, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on backup contents.
- Request: “new ADR for persistent storage and folder backup”
- Questions: Everything you made (all saved tables: pieces, projects, templates, pictures, 3D models, decors, prices, versions), or pieces, projects and templates only?
- Suggested pick: Everything (estimate effort +10 %, value +25 %)
- Note: Answered by the user 2026-10-28: Everything.

### Backup layout

- Id: 3b009261-ceff-4281-b11d-d027d4b0c555
- Number: G-241 12:00
- Status: Done (ADR-133)
- Origin: ADR-133, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No backup layout chosen.
- Request: “new ADR for persistent storage and folder backup”
- Questions: One importable file per item in subfolders, or one .zip?
- Suggested pick: One file per item, readable and copyable (closest to “folder backup”; estimate effort +5 %)
- Note: Answered by the user 2026-10-28: One file per item.

### When backups run

- Id: dd3a4633-6ad9-4696-860a-b42ab4e54be9
- Number: G-242 12:00
- Status: Done (ADR-133)
- Origin: ADR-133, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No backup trigger chosen.
- Request: “new ADR for persistent storage and folder backup”
- Questions: Manual Back up now, automatic after changes while the app is open, or both?
- Suggested pick: Both (estimate effort +15 %)
- Note: Answered by the user 2026-10-28: Both.

### Browsers without folder access

- Id: c756d1ad-1e31-4ad7-8c51-e7a6cce622e6
- Number: G-243 12:00
- Status: Done (ADR-133)
- Origin: ADR-133, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Folder access (showDirectoryPicker) is missing on some browsers, e.g. iPhone Safari and Firefox (to verify on MDN when building).
- Request: “new ADR for persistent storage and folder backup”
- Questions: Download a .zip backup there, or offer nothing?
- Suggested pick: A .zip download with the same layout (ADR-121 zip; estimate effort +5 %)
- Note: Answered by the user 2026-10-28: .zip download.

### Restoring a backup

- Id: 88d789a3-c85b-4bd9-b474-d3af62684066
- Number: G-244 12:00
- Status: Done (ADR-133)
- Origin: ADR-133, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No restore rule.
- Request: “new ADR for persistent storage and folder backup”
- Questions: Restore as new copies (new ids, ADR-011), or by id replacing existing rows?
- Suggested pick: New copies, skipping items identical to one already saved; replacing would rewrite saved designs
- Note: Answered by the user 2026-10-28: New copies.

### What 'login using that persistent storage' means

- Id: be7c8fe7-f0b7-44a9-88ac-3e1068890d46
- Number: G-245 12:00
- Status: Done (ADR-134)
- Origin: ADR-134, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Item 2 has two readings and no Decision for that part.
- Request: “New adr for login using that persistent storage”
- Questions: (A) a local profile or lock on this device with no server, or (B) the account sign-in of ADR-135/136 kept in persistent storage so it survives restarts and offline starts?
- Suggested pick: B: items 3 and 4 are logins to an account (estimate: B +10 % on top of ADR-131; A +25 % as a separate feature, and a real lock needs encryption)
- Note: Answered by the user 2026-10-28: B: account session kept on the device.

### Reading A: lock or profiles

- Id: 56bbbde9-b153-484f-8df8-0ac981efe911
- Number: G-246 12:00
- Status: Done (ADR-134)
- Origin: ADR-134, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: If reading A is chosen, its form is open.
- Request: “New adr for login using that persistent storage”
- Questions: A PIN/passphrase lock (needs the saved data encrypted to protect anything), or several local profiles each with its own designs?
- Suggested pick: Only if A is chosen: a passphrase lock with encrypted storage (closest to “login”)
- Note: Answered by the user 2026-10-28: Not applicable (reading B chosen).

### Google sign-in: redirect or popup

- Id: 655bf7cc-f188-4eb6-ab2e-e36a40cd6a88
- Number: G-247 12:00
- Status: Done (ADR-135)
- Origin: ADR-135, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No sign-in flow chosen.
- Request: “New adr for gmail login”
- Questions: Full-page redirect or popup?
- Suggested pick: Redirect: works in the installed app and on phones that block popups (estimate effort +0 %)
- Note: Answered by the user 2026-10-28: Full-page redirect.

### Google OAuth client and consent screen

- Id: 2c2b5924-229b-470d-81a9-3d8e59bc5e0a
- Number: G-248 12:00
- Status: Done (ADR-135)
- Origin: ADR-135, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No Google Cloud OAuth client or consent screen exists; Google's verification requirements are unknown.
- Request: “New adr for gmail login”
- Questions: Who registers the OAuth client and consent screen (app name, privacy notice link)?
- Suggested pick: You, under the account of ADR-127
- Note: Answered by the user 2026-10-28: The user, under the same personal account.

### Same email by Google and by password

- Id: 4e1d7c1b-31b1-4a60-bf29-44e7473d3631
- Number: G-249 12:00
- Status: Done (ADR-135)
- Origin: ADR-135, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No rule for one email used with both sign-in methods.
- Request: “New adr for gmail login”
- Questions: Link them when the email is verified, keep separate accounts, or ask?
- Suggested pick: Link when verified (estimate effort +0-5 %)
- Note: Answered by the user 2026-10-28: Link when verified, then revised with G-254: no linking; Google and password logins with one email stay separate.

### Email provider for reset emails

- Id: 95be800d-f44f-4522-8e01-3e558a5c29ec
- Number: G-250 12:00
- Status: Done (ADR-136)
- Origin: ADR-136, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Forgot/reset password and email verification need an email sender; none is chosen.
- Request: “New adr for ui login (including gmail)/logout/forgot password/reset password”
- Questions: The backend's built-in email (limits unknown), or your own sender through SMTP (e.g. Brevo, Resend, Amazon SES; facts unknown)?
- Suggested pick: Your own sender set in the backend, after checking its free limits (reset mail must arrive; estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Supabase built-in email.

### Where Account sits

- Id: 574e722e-e443-4764-857c-4bdec6cecd35
- Number: G-251 12:00
- Status: Done (ADR-136)
- Origin: ADR-136, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No place chosen for the Account entry.
- Request: “New adr for ui login (including gmail)/logout/forgot password/reset password”
- Questions: An Account icon button in the top bar, an item in the ⋯ menu, or Settings?
- Suggested pick: Top bar icon button, visible at 390 and 1280 px (estimate effort +3 %)
- Note: Answered by the user 2026-10-28: Top bar icon.

### Create account screen

- Id: 043e9ae1-c5d6-4072-9253-fe652054dbfc
- Number: G-252 12:00
- Status: Done (ADR-136)
- Origin: ADR-136, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Item 4 names login, logout, forgot and reset, not sign-up.
- Request: “New adr for ui login (including gmail)/logout/forgot password/reset password”
- Questions: Include Create account with email and password, or allow new accounts only through Google?
- Suggested pick: Include it: forgot and reset password imply email accounts (estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Yes, Create account.

### Password rules

- Id: c8b62822-2b2c-472e-8a61-ed437b9195fa
- Number: G-253 12:00
- Status: Done (ADR-136)
- Origin: ADR-136, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No password rule chosen.
- Request: “New adr for ui login (including gmail)/logout/forgot password/reset password”
- Questions: The provider's default, or a minimum length you set?
- Suggested pick: The provider's default, shown under the field
- Note: Answered by the user 2026-10-28: Supabase default.

### Email verification

- Id: 41de7f4e-338a-4139-b6f6-82d39efd9e4a
- Number: G-254 12:00
- Status: Done (ADR-136)
- Origin: ADR-136, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on verifying the email before the first sign-in.
- Request: “New adr for ui login (including gmail)/logout/forgot password/reset password”
- Questions: Require verification, or not?
- Suggested pick: Require it (stops sign-ups with someone else's email; estimate effort +5 %)
- Note: Answered by the user 2026-10-28: No email verification.

### Automatic or per item

- Id: 8c10390a-285f-412e-98f0-7b60c00f2e67
- Number: G-255 12:00
- Status: Done (ADR-137)
- Origin: ADR-137, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on how items reach the account.
- Request: “New adr for save user templates and created pieces in db”
- Questions: While signed in, every saved piece and template goes to the account automatically, or only those marked Save to account?
- Suggested pick: Automatic, with Keep on this device only per item (closest to “save ... in db”; estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Automatic, with Keep on this device only.

### Edited shipped templates

- Id: bd95d0f6-1afd-41dc-a917-a969ef038445
- Number: G-256 12:00
- Status: Done (ADR-137)
- Origin: ADR-137, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on local templates that shadow shipped ones (ADR-034).
- Request: “New adr for save user templates and created pieces in db”
- Questions: Save your edits of shipped templates to the account too?
- Suggested pick: Yes: they are your templates (estimate effort +2 %)
- Note: Answered by the user 2026-10-28: Yes.

### Share links beside design codes

- Id: bb9af2cf-62ff-4250-82e2-22b1cf8b2e61
- Number: G-257 12:00
- Status: Done (ADR-138)
- Origin: ADR-138, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No decision on Copy code (ADR-124) once share links exist.
- Request: “New adr share link to templates/pieces”
- Questions: Keep Copy code beside Share link, or replace it?
- Suggested pick: Keep both: codes work offline and without an account (estimate effort +0 %)
- Note: Answered by the user 2026-10-28: Keep both.

### Share-link form

- Id: dcf470ea-dfe2-4e2a-918d-ba7776b7b084
- Number: G-258 12:00
- Status: Done (ADR-138)
- Origin: ADR-138, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No link form chosen.
- Request: “New adr share link to templates/pieces”
- Questions: A fragment link …/furniture-builder/#share=<id> (never sent to GitHub Pages), or a path …/s/<id> (needs a 404.html redirect on Pages)?
- Suggested pick: Fragment (estimate effort +0 %)
- Note: Answered by the user 2026-10-28: #share=<id>.

### List of your shared links

- Id: db9e1c86-3b8f-49cd-87b2-e3289807fcc6
- Number: G-259 12:00
- Status: Done (ADR-138)
- Origin: ADR-138, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No overview of shared links.
- Request: “New adr share link to templates/pieces”
- Questions: A Shared links list in Account with Stop sharing, or only per item?
- Suggested pick: Per item plus the list (estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Per item + list.

### Where sync status shows

- Id: f63fb2a5-7112-4afe-8336-d516b80d0597
- Number: G-260 12:00
- Status: Done (ADR-139)
- Origin: ADR-139, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Proposed by Claude, not requested.
- Request: Task 2026-10-28: “propose further architecture and UX ADRs” (proposed by Claude, not requested)
- Questions: Beside the save status in the top bar, as a badge per item in lists, or both?
- Suggested pick: Both (estimate effort +10 %)
- Note: Answered by the user 2026-10-28: Both.

### When the device-only banner shows

- Id: 01fe5a0e-d411-4c24-bada-95ba613b1495
- Number: G-261 12:00
- Status: Done (ADR-140)
- Origin: ADR-140, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Proposed by Claude, not requested.
- Request: Task 2026-10-28: “propose further architecture and UX ADRs” (proposed by Claude, not requested)
- Questions: Always while nothing is backed up or in an account (dismissible for N days you choose), or once only?
- Suggested pick: Dismissible, back after N days you choose
- Note: Answered by the user 2026-10-28: Dismissible, back after 7 days.

### Backup reminder interval

- Id: 9b6f8d10-d62b-4852-8b2e-44cbafb8ae90
- Number: G-262 12:00
- Status: Done (ADR-141)
- Origin: ADR-141, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Proposed by Claude, not requested.
- Request: Task 2026-10-28: “propose further architecture and UX ADRs” (proposed by Claude, not requested)
- Questions: A fixed interval, or a Settings choice (including Off) starting at a value you pick?
- Suggested pick: A Settings choice; the starting value is yours
- Note: Answered by the user 2026-10-28: Settings choice with Off, starting at 30 days.

### Several accounts on one device

- Id: ed9a0c73-5e36-4746-9247-a01d78bf94f5
- Number: G-263 12:00
- Status: Done (ADR-142)
- Origin: ADR-142, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Proposed by Claude, not requested.
- Request: Task 2026-10-28: “propose further architecture and UX ADRs” (proposed by Claude, not requested)
- Questions: Several accounts with separate account copies, or one account at a time?
- Suggested pick: Several, each with its own account copies; device-only items stay visible to all (estimate effort +20 %)
- Note: Answered by the user 2026-10-28: Several accounts.

### What the shared-item preview shows

- Id: c2fc6d1b-dd2b-4f37-a3df-5c0065039bcc
- Number: G-264 12:00
- Status: Done (ADR-143)
- Origin: ADR-143, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Proposed by Claude, not requested.
- Request: Task 2026-10-28: “propose further architecture and UX ADRs” (proposed by Claude, not requested)
- Questions: Name, front view and part count; plus 3D; or plus the full cut list?
- Suggested pick: Name, front view and part count, then Open a copy (estimate effort +0 %)
- Note: Answered by the user 2026-10-28: Name, front view, parts, plus 3D.

### 2D label for Front too

- Id: 1bd97ab8-f0ce-4431-9a10-f1752dd6710a
- Number: G-265 12:00
- Status: Done (ADR-144)
- Origin: ADR-144, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: The piece editor labels the drawing Front, not Plan; the request names only Plan.
- Request: User 2026-10-28: "ADR to have the views container same in compose and build and preview. Same 2D(rename it to 2D from Plan), 3D and both toggle"
- Questions: Rename Front to 2D too, or only Plan?
- Suggested pick: Both become 2D: one label in every container (closest to 'same'; estimate effort +2 %)

### View kept across modes

- Id: 9d1a8e91-064e-48b9-9192-bc1aad4f8c21
- Number: G-266 12:00
- Status: Done (ADR-144)
- Origin: ADR-144, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: Today changing mode resets the view to that mode's default (ADR-081).
- Request: User 2026-10-28: "ADR to have the views container same in compose and build and preview. Same 2D(rename it to 2D from Plan), 3D and both toggle"
- Questions: Keep one chosen view across Compose and Build & Preview, or keep a separate default per mode?
- Suggested pick: One chosen view kept across modes (closest to 'same'; estimate effort +3 %)

### View switch in phone Compose

- Id: 97a4e283-4458-4416-a0a5-e26a73bfb4a8
- Number: G-267 12:00
- Status: Done (ADR-144)
- Origin: ADR-144, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: On a phone Compose has no View switch and never mounts 3D (ADR-079, ADR-081).
- Request: User 2026-10-28: "ADR to have the views container same in compose and build and preview. Same 2D(rename it to 2D from Plan), 3D and both toggle"
- Questions: Show 2D, 3D and Both in phone Compose too (the 3D canvas then mounts there when chosen), or keep phone Compose 2D only?
- Suggested pick: Show them in phone Compose too (closest to 'same'; estimate effort +10 %, risk: 3D on a phone while composing is slower)

### One default view

- Id: 11c4475f-a995-4847-8007-b51eac814850
- Number: G-268 12:00
- Status: Done (ADR-144)
- Origin: ADR-144, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: No single default view for both modes.
- Request: User 2026-10-28: "ADR to have the views container same in compose and build and preview. Same 2D(rename it to 2D from Plan), 3D and both toggle"
- Questions: Default view for both modes: 2D below 1500 px and Both from 1500 px; 3D below 1500 px; or Both everywhere?
- Suggested pick: 2D below 1500 px and Both from 1500 px (keeps the editing drawing first, ADR-014; estimate effort +0 %)

### Phone view tools in both modes

- Id: ead600b9-3876-41fe-aaf1-6a2c69aaa569
- Number: G-269 12:00
- Status: Done (ADR-144)
- Origin: ADR-144, 2026-10-28; open question in the ADR (Claude wrote the ADR, nothing chosen)
- Missing: On a phone the view tools sit behind an Options button only in Build & Preview.
- Request: User 2026-10-28: "ADR to have the views container same in compose and build and preview. Same 2D(rename it to 2D from Plan), 3D and both toggle"
- Questions: Use the Options button on a phone in both modes, or inline tools in both? Answer 2026-10-28: "in options all except Fronts, Select, Move, Turn 90 both of them"
- Suggested pick: The Options button in both modes on a phone (keeps the stage height; estimate effort +2 %)

### Front-view wall background: which wall and area

- Id: 4181425c-23b3-402f-863d-54c63cabb6d8
- Number: G-270 12:00
- Status: Done (ADR-145)
- Origin: ADR-145 (open question)
- Missing: Front view: which wall's background is drawn behind a piece, and over what area
- Request: Set wall background; answers 2026-10-28: colour or picture, 3D view and front view, per wall, toggle solid/see-through
- Questions: Use the wall the piece's back stands against (back on the wall line, same tolerance as wall snapping, ADR-070), or let the user pick the wall in the front view? Fill the whole drawing area or only the wall height above the floor?
- Suggested pick: The wall the piece's back stands against; fill from the floor to the room height across the drawing; no background when the piece stands against no wall or the project has no room. Closest to 'the wall behind the piece'.

### Wall picture tile size

- Id: 2dbb5ef5-44d7-4a95-bb4b-521783e024cc
- Number: G-271 12:00
- Status: Done (ADR-145)
- Origin: ADR-145 (open question)
- Missing: Size one copy of a wall picture covers before it repeats
- Request: Set wall background; answers 2026-10-28: colour or picture, 3D view and front view, per wall, toggle solid/see-through
- Questions: Set by the user in mm (width × height), like board pictures (ADR-048)? What starting size?
- Suggested pick: User-set width × height in mm, like ADR-048; the picture starts at its own aspect ratio, 1000 mm wide, and the field says to set the real size (a starting value, not a spec).

### Wall toggle: saved or per device

- Id: 946e29cb-9343-462e-a3ad-a265e9bc7db7
- Number: G-272 12:00
- Status: Done (ADR-145)
- Origin: ADR-145 (open question)
- Missing: Where the solid / see-through toggle lives and what it starts as
- Request: Set wall background; answers 2026-10-28: colour or picture, 3D view and front view, per wall, toggle solid/see-through
- Questions: Saved in the project (same on every device and in exports), or a view setting on this device only? Start solid or see-through?
- Suggested pick: A 3D view setting on this device ('Solid walls'), starting see-through as today; the front view always shows the background. Keeps the project document smaller and today's look unchanged.

### Wall backgrounds outside 3D and front view

- Id: bddf401a-2369-48d1-9e36-23c0a3c90215
- Number: G-273 12:00
- Status: Open
- Origin: ADR-145 (out of scope)
- Missing: Wall backgrounds on the 2D floor plan, the SVG download, catalog snapshots and cut sheets
- Request: Set wall background; answers 2026-10-28: colour or picture, 3D view and front view, per wall, toggle solid/see-through
- Questions: Show the wall colour on the plan too?
- Suggested pick: Colour strip along each wall on the plan only; the others stay as they are.

### Floor background

- Id: 5873604d-84c7-4026-844d-f317581dce33
- Number: G-274 12:00
- Status: Open
- Origin: ADR-145 (out of scope)
- Missing: Floor colour or picture
- Request: Set wall background; answers 2026-10-28: colour or picture, 3D view and front view, per wall, toggle solid/see-through
- Questions: Set the floor like the walls?
- Suggested pick: Same picker for the floor in a later ADR, reusing this one's code.

### Wall background in the single-piece front view

- Id: be260ae1-133c-419a-970e-f88efdcf4d2a
- Number: G-275 12:00
- Status: Open
- Origin: ADR-145 (found while building)
- Missing: The wall background shows in the project's front view (the whole room seen from the front); the front view of a single piece, opened from the project, shows no wall behind it
- Request: Set wall background adr; answers 2026-10-28: 3D view and front view
- Questions: Show the wall the piece stands against behind it in the single-piece front view too?
- Suggested pick: Yes: the same floor-to-room-height fill behind the piece when it is opened from a project with a room (estimate: effort +10%, value +10%)

### Reset emails and the built-in sender

- Id: 86e617e4-23a4-41e1-97d2-462c26a3fe2f
- Number: G-276 12:00
- Status: Open
- Origin: ADR-136, 2026-10-28; found while building (Claude)
- Missing: Supabase's built-in email sender reportedly sends only to the project team's addresses, about 2 emails per hour (web search 2026-10-28; supabase.com not reachable from the build session). With public sign-up (G-214) and the built-in sender (G-250), password-reset emails will not reach other users.
- Request: “New adr for ui login (including gmail)/logout/forgot password/reset password”; answer G-250: Supabase built-in email
- Questions: Keep the built-in sender (resets only for team addresses), or set a custom SMTP sender in Supabase?
- Suggested pick: A custom SMTP sender in Supabase (no app change; estimate effort +2 %, value: forgot password works for everyone)

### Supabase project not set up

- Id: f5241964-b0e3-4c70-9cc3-8007c424bb0a
- Number: G-277 12:00
- Status: Open
- Origin: ADR-127, 2026-10-28; found while building (Claude)
- Missing: No Supabase project exists yet: the migration is not applied, Google sign-in is not registered, and the repository variables SUPABASE_URL and SUPABASE_ANON_KEY are not set, so the deployed app is built without accounts. Online features are tested with an in-memory backend and the SQL rules on a local PostgreSQL, never against Supabase itself.
- Request: Task 2026-10-28: “takes Furniture Builder from device-only storage to user accounts”; answers G-217 Supabase, G-219 my personal account
- Questions: Create the Supabase project and Google client (docs/supabase-setup.md), then let a session test sign-in, sync and share links against it?
- Suggested pick: Yes: follow docs/supabase-setup.md, then run a live check (estimate 1 hour of your time)
- Note: 2026-10-28: the user created the project `https://nllwhcxvcbtjfkdhsyse.supabase.co` and gave its publishable key; both are set in `deploy.yml`. Still open: the migration, Google sign-in and the email settings in the dashboard, and a live check.

### Account and share-link limits

- Id: ed8708cc-fa90-4b69-ba48-81cc2bb6ee96
- Number: G-278 12:00
- Status: Open
- Origin: ADR-128, ADR-132, 2026-10-28; Claude chose values
- Missing: Values chosen while building, not by the user: one item at most 2 MB, one account at most 25 MB (about 20 full accounts in the 500 MB free database), at most 30 new share links per account per hour, at most 120 opens per link per hour.
- Request: Answers G-223 “Design caps + total cap”, G-235 “Vendor defaults first”
- Questions: Keep these limits, or set your own?
- Suggested pick: Keep them until a limit is hit (estimate effort +0 %)

### No Trash list to restore from

- Id: 77841ead-0f1d-4153-81aa-a977c2a4a7d6
- Number: G-279 12:00
- Status: Open
- Origin: ADR-129, 2026-10-28; found while building (Claude)
- Missing: Deleted account items go to the Trash for 7 days on the server, but the app has no Trash list to restore them from.
- Request: Answer G-228: “Account Trash”, 7 days
- Questions: Add a Trash list in Account with Restore?
- Suggested pick: Yes, in Account (estimate effort +10 %)

### Conflict copies are not named after a device

- Id: bdd70679-fa2f-483e-a6b4-813ff190bd73
- Number: G-280 12:00
- Status: Open
- Origin: ADR-129, 2026-10-28; found while building (Claude)
- Missing: On a conflict, the account's version is kept as a copy named “… (from your account)”, not after the other device: devices have no names.
- Request: Answer G-226: “Keep both … the second is saved as a copy named after its device”
- Questions: Name devices (asked once per device), or keep “(from your account)”?
- Suggested pick: Keep “(from your account)” (estimate effort +0 %; naming devices +5 %)

### Switching accounts needs a sign-in

- Id: 1d942d52-0cf4-422c-b71c-e53140cf1df9
- Number: G-281 12:00
- Status: Open
- Origin: ADR-142, 2026-10-28; found while building (Claude)
- Missing: Supabase keeps one session per browser, so Switch to … signs out and asks for the other account's password (the email is filled in); it is not a one-tap switch.
- Request: Answer G-263: “Several (Recommended)”
- Questions: Keep sign-out-and-sign-in, or keep several sessions at once (one Supabase client per account)?
- Suggested pick: Keep it (estimate effort +0 %; several sessions +25 %)

### Restored copies lose version and template links

- Id: db9b3a09-595f-4a74-b348-e01fd9a67bb7
- Number: G-282 12:00
- Status: Open
- Origin: ADR-133, 2026-10-28; found while building (Claude)
- Missing: Restore gives every restored piece, project and template a new id (G-244), so kept project versions and template links in the backup point at the old ids and stay apart from the restored copies.
- Request: Answer G-244: “New copies (Recommended)”
- Questions: Keep new ids always, or keep the old id when nothing on this device uses it?
- Suggested pick: Keep the old id when it is free (closer to a full restore; estimate effort +3 %)

### Where the four straighten corners are placed

- Id: dbddd949-9a06-41e9-a186-e7b66c58ef2f
- Number: G-283 12:00
- Status: Done (ADR-146)
- Origin: ADR-146 (open question)
- Missing: Where the user marks the wall's corners in an angled photo
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: A: a Straighten dialog over the whole photo, four handles dragged onto the wall's corners in the photo; B: in 3D, each corner of the picture dragged freely on the wall
- Suggested pick: A — it is what the user picked (handles onto the wall's corners in the photo); the whole photo stays visible, also the parts beyond the wall. B is ~+20 % work (estimate) for no more of the request

### What happens to the repeating picture

- Id: f49eb607-376c-4c9a-a532-19adc24529bc
- Number: G-284 12:00
- Status: Done (ADR-146)
- Origin: ADR-146 (open question)
- Missing: Whether a wall picture still repeats (ADR-145) once it can fill the wall
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: A: a Repeat / Fill wall choice, a new picture starts as Repeat (today); B: a new picture starts as Fill wall, Repeat kept; C: drop Repeat, every picture fills its rectangle once
- Suggested pick: B — fill one wall exactly is what the user asked; tiles (ADR-145) keep working. A and C: no extra work

### Front view follows the fitted picture

- Id: 2ba43314-117f-4f59-bc3f-cb97d8fbb0a0
- Number: G-285 12:00
- Status: Done (ADR-146)
- Origin: ADR-146 (open question)
- Missing: Whether the project front view (ADR-145) draws the shifted, stretched, straightened picture
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: A: yes, the same rectangle and straightening; B: no, the front view keeps repeating tiles
- Suggested pick: A — the user asked for the front view background in ADR-145, and a fitted wall looks wrong if the front view differs; ~+15 % work (estimate), +20 % of value (estimate)

### Snapping and proportions while dragging

- Id: 3f54397c-3308-4915-b3b6-ffb72b481c4e
- Number: G-286 12:00
- Status: Done (ADR-146)
- Origin: ADR-146 (open question)
- Missing: How a dragged picture edge snaps, and whether stretching keeps the picture's proportions
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: Snap: A: edges snap to the wall ends, floor and ceiling, off with the Snap toggle and Alt (ADR-070); B: no snap. Proportions: C: free stretch, D: kept, E: free, Shift keeps them
- Suggested pick: A + C — fill one wall exactly needs edges that land on the wall ends; stretch means free. ~+10 % work for A (estimate)

### Lens distortion of wall photos

- Id: 4ac47335-4552-43d0-8df0-c3342d744e04
- Number: G-287 12:00
- Status: Open
- Origin: ADR-146 (out of scope)
- Missing: Correcting curved lines from wide-angle lenses (barrel distortion); straightening fixes the angle only
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: Is barrel correction needed for your photos?
- Suggested pick: Not asked; only if photos show curved wall edges after straightening

### Adjust the wall picture from the front view

- Id: 1a4f06df-820b-4138-91d8-c5ef2ff3ca7e
- Number: G-288 12:00
- Status: Open
- Origin: ADR-146 (out of scope)
- Missing: Dragging the wall picture in the 2D front view; only the 3D view adjusts it
- Request: User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective part, so I can wrap it correctly."; answers: straighten an angled photo, fill one wall exactly, drag on the wall in 3D
- Questions: Should the front view also drag the picture?
- Suggested pick: Not asked; the user chose dragging in 3D

### Move to actions on the 2D plan

- Id: 033ee333-2fef-44e9-b195-281d8fedb70f
- Number: G-289 12:00
- Status: Open
- Origin: ADR-147, 2026-10-29; out of scope
- Missing: No overlay bar of Move to buttons over the 2D plan; they are in the piece panel and the 3D Move toolbar
- Request: add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest left piece, snap to closest right piece, and any other snaps you think would be appropriate
- Questions: Add a floating Move to bar over the plan?
- Suggested pick: Not now; the user picked panel + 3D

### Group width for pieces not in columns

- Id: 03bf03ad-d64e-4ea3-834f-5e23dc4bc0fb
- Number: G-290 12:00
- Status: Open
- Origin: ADR-148, 2026-10-29; scope (Claude)
- Missing: A group whose pieces overlap in x without sharing the same span (e.g. a wall unit straddling two base units) refuses a Width change.
- Request: add the possibility to set the width, height and depth of grouped items, add the possibility to block group items from being moved separately.
- Questions: Refuse, or scale every position around the left edge (pieces may stop touching by 1 mm)?
- Suggested pick: Scale positions around the left edge, rounding shared edges once (closer to the request; estimate effort +25 %, value +10 %)
- Answer: 2026-10-29 (user) "Refuse (as in ADR)"; ADR-148 refuses with the reason

### Vertical moves of a grouped piece do not carry the group

- Id: 93519f7f-f243-4c08-809f-3e399648b091
- Number: G-291 12:00
- Status: Done (ADR-148)
- Origin: ADR-148, 2026-10-29; scope (Claude)
- Missing: The wall-height drag in 3D, the From floor field and the gap tool move one grouped piece up/down or along alone.
- Request: add the possibility to set the width, height and depth of grouped items, add the possibility to block group items from being moved separately.
- Questions: Should vertical moves and the gap tool also move the whole group?
- Suggested pick: Yes, move the whole group (closer to 'block group items from being moved separately'; estimate effort +20 %)
- Answer: 2026-10-29 (user) "Yes, move group"; built in ADR-148

### Mirror of one grouped piece alone

- Id: 6182ef0b-874e-43fd-a141-363efe935806
- Number: G-292 12:00
- Status: Done (ADR-148)
- Origin: ADR-148, 2026-10-29; scope (Claude)
- Missing: Mirroring a single grouped piece from its own card is not routed to the group.
- Request: add the possibility to set the width, height and depth of grouped items, add the possibility to block group items from being moved separately.
- Questions: Mirror the whole group, or allow a single piece to mirror in place?
- Suggested pick: Mirror the whole group (closer to the request; estimate effort +5 %)
- Answer: 2026-10-29 (user) "Mirror the group"; built in ADR-148

### Repairs and Mirror the run move a grouped piece alone

- Id: 53a0394e-717a-442e-af53-8038aa91dbab
- Number: G-293 12:00
- Status: Open
- Origin: ADR-148, 2026-10-29; scope (Claude)
- Missing: Automatic repairs from the problem banner and Mirror the run can still move one grouped piece without its group.
- Request: add the possibility to set the width, height and depth of grouped items, add the possibility to block group items from being moved separately.
- Questions: Should repairs and Mirror the run also carry or refuse grouped pieces?
- Suggested pick: Carry the whole group, refusing a repair the group cannot follow (closer to the request; estimate effort +10 %)

### Move to for several selected pieces

- Id: 4aad9625-c678-41f9-addc-ce8c65aa155b
- Number: G-294 12:00
- Status: Open
- Origin: ADR-147, 2026-10-29; out of scope
- Missing: Move to actions move only the selected piece, not a multi-selection
- Request: add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest left piece, snap to closest right piece, and any other snaps you think would be appropriate
- Questions: Should Move to move every selected piece as one block?
- Suggested pick: Yes, as one block (closest to how drag moves a selection; estimate +20 % work)

### Move to for a stacked piece

- Id: ec2ea405-bf88-4651-9885-cc7f0daf6287
- Number: G-295 12:00
- Status: Done (ADR-147)
- Origin: ADR-147, 2026-10-29; open question
- Missing: How sideways and ceiling moves work for a piece placed above another
- Request: add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest left piece, snap to closest right piece, and any other snaps you think would be appropriate
- Questions: (a) move along its base via offsetX, lift off for ceiling; (b) lift off and move freely; (c) disabled
- Suggested pick: (a), keeps it on its base (estimate +10 % work)
- Answer: User 2026-10-29: "Slide along base" — sideways moves change its offset on the piece below; To ceiling lifts it off.

### Align top or front: which neighbour

- Id: dd512b05-05df-4183-a2c4-9420f8480fd2
- Number: G-296 12:00
- Status: Done (ADR-147)
- Origin: ADR-147, 2026-10-29; open question
- Missing: Which neighbour Align top and Align front use
- Request: add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest left piece, snap to closest right piece, and any other snaps you think would be appropriate
- Questions: (a) separate left and right buttons; (b) the nearer neighbour, left on a tie
- Suggested pick: (a), says exactly which piece (estimate +5 % work)
- Answer: User 2026-10-29: "Left / right buttons" — Align top and Align front each for the left and the right neighbour.

### Move to for a freely turned piece

- Id: 24bd2aae-dccf-4901-8427-be8eba1504eb
- Number: G-297 12:00
- Status: Done (ADR-147)
- Origin: ADR-147, 2026-10-29; open question
- Missing: What Move to does for a piece turned by a free angle (ADR-121)
- Request: add a move action for a piece, snap to closest wall, snap to closest ceiling, snap to closest left piece, snap to closest right piece, and any other snaps you think would be appropriate
- Questions: (a) all actions disabled; (b) vertical actions only
- Suggested pick: (b), keeps ceiling and floor working (estimate +3 % work)
- Answer: User 2026-10-29: "Vertical only" — To ceiling and Down work; the other actions are off, "turned freely".

### Research data stale after research batches 1-5

- Id: ed49e8be-a00b-4921-97f8-25b1bfb9f388
- Number: G-298 12:00
- Status: Open
- Origin: ADR-149 (merged with main 2026-10-29)
- Missing: Research features built by ADR-121..125 (research batches 1-5: on-demand rendering, typed rotation, version history, design codes, sinks and handles, spatial query engine and others) are still listed as not built in the research data
- Request: "Re-validate, remove implemented ones"
- Questions: Re-validate again against ADR-121..125 and delete those features too?
- Suggested pick: Yes, re-check and delete them the same way as ADR-149 (estimate: effort +20% of ADR-149, value: keeps the list to what is left)
