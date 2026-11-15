# Furniture Builder

Design cabinets, chests, wardrobes and desks to the millimetre, see them in 3D and get the parts list.
Runs in the browser, works offline, keeps everything on your device.

**Live:** https://chiriacsergiucs-v2.github.io/furniture-builder/

## How it works

1. **Projects · Catalog · Editor** (bottom bar on phones). **New** → **Start from** a catalog template (cabinets, chest,
   bookcase, sideboard, wardrobe, wall, blind, L-shaped and diagonal corners, kitchen modules, desks, tables, benches,
   beds), the **New piece** wizard, **Fill a wall**, **Fill the room**, a **Room preset**, or a **project** with several
   pieces.
2. In **Compose**, tap a space in the front view: shelves (fixed or adjustable on 32 mm pin rows), drawers (equal or
   chosen heights), hanging, empty; add doors and handles, or divide it side by side or stacked. Select from the whole
   piece inwards, one level per tap. **Settings** sets size, construction, overlay / half overlay / inset fronts, wall
   mounting and **Material** (one control for a part, the piece, a group or the whole project).
3. In a **project**, draw the room (rectangle, L, U, alcove; doors, windows, pipes and outlets), place pieces on the plan
   or in 3D, snap and connect them, align, mirror, group and lock them, bind sizes to variables, and fill walls.
   Editing a piece there never changes your saved pieces.
4. Results tabs under the views: **Parts**, **Sheets** (heuristic layouts on your stock sheets), **Hardware**,
   **Assembly**, **Shopping** (with a running cost estimate) and **Checks** update as you edit.
5. When Checks is clear: **Parts CSV**, **Print** (A4 cutting sheet with sheet plans, assembly steps and client sheet;
   save as PDF from the dialog), **Export** → front-view SVG, Fusion 360 script (not yet tested in Fusion), .glb scene,
   .usdz for AR, review pack, design or project file. **Render** makes a photo-quality picture; **View in AR** places
   a piece in your room.
6. Everything is saved on this device and works offline. Optionally sign in to keep pieces and templates in your
   account, share links, and use the assistant. The theme follows your system; the sun / moon button switches it.
   **More → Language** switches the app between English and Russian; **Print language** sets Romanian (default),
   Russian or English for printed sheets and the parts CSV.

Sizes are finished sizes; banded edges are marked L/W. Defaults: 4 mm saw cut, 10 mm sheet trim, PAL/HDF 2800 × 2070,
MDF 2440 × 1220 (Materials). Hinge, pin and bracket counts are common guidance — the maker's datasheet decides.

## Features

Built features by area, with the ADRs that built them. Sources: the Information and guides page
(`src/ui/info/features.ts`, ADR-158), which has no lines for the assistant or for the behaviour rules of ADR-241 to
ADR-266, so those are added from the implemented ADRs. Not listed: pending or deferred ADRs (ADR-217, ADR-242,
ADR-265) and rejected ones (ADR-063).

### Creating

- **Start a new single piece** — Pick a template from the catalog to start from. (ADR-032, ADR-078)
- **New-piece wizard** — Answer the size, construction and contents questions; only the chosen type's questions are asked. (ADR-044, ADR-046, ADR-191, ADR-194)
- **Suggested combinations in the wizard** — Cards with variations of your answers, kept only when they build without errors. (ADR-045, ADR-194)
- **Reopen a piece in the wizard** — The answers stay with the piece, so you can change them later. (ADR-046, ADR-194)
- **Keep a closed wizard as a draft** — A closed New piece wizard keeps its answers until you close the app; Continue where you left off or Start over. (ADR-211)
- **Reopen a project piece in the wizard** — Open in wizard in its Settings; Update piece replaces it in the project only. (ADR-203)
- **Create a project** — Several pieces placed in one room. (ADR-022, ADR-078, ADR-193)
- **Create a project from a project template** — Copies of the pieces with their positions, run-part recipe, connections, variables, bindings, run handles and sinks; pieces inserted into a project take its settings. (ADR-060, ADR-123, ADR-170, ADR-200, ADR-204)
- **Fill a wall** — Enter a wall width and pick a suggested mix of tall, base and wall cabinets that fills it exactly; Refine sets the tall cabinet height and wall cabinet depth, mixes may give each base kind its own width, and equal fronts may share carcasses of up to 4 fronts. (ADR-103, ADR-104, ADR-193, ADR-204)
- **Make a new piece inside a project** (ADR-107)
- **Fill the room** — Pick a room shape with its doors and windows, or use the project’s room: suggested mixes for every ticked wall at once, doors and windows kept free, a corner cabinet at each inside corner with a wall corner cabinet above it, wall rows split at windows; each mix checked as a project. Refine adds a budget ceiling, a style and an island with your walkway width; each mix shows its estimate. (ADR-173, ADR-177, ADR-193, ADR-204, ADR-210)
- **Fill the room in L and U rooms** — A wall too short for a corner cabinet at both ends keeps one and leaves the other corner empty, both ends tried; runs stay out of the corner cabinets and of a narrow arm already filled. (ADR-216)
- **Template descriptions in Start from** — New… → Start from shows each built-in template’s description under its row. (ADR-216)
- **Room presets** — New… → Room preset: a bedroom, a home office, or a kitchen and desk, ready in a 3600 × 3000 room. (ADR-210)
- **One tap makes one saved thing** — Creating a project, room preset or wizard piece is guarded against a second tap, saved before it opens, and a failure is said where you tapped (ADR-248)
- **Fill the room beside existing pieces** — In a project that already has pieces, each suggested mix is checked together with them; when none fits it says so and tells you to untick filled walls (ADR-248)

### Composition

#### Dividing spaces

- **Divide a space side by side or stacked** — Fixed millimetre sizes or shares, split exactly in whole millimetres. (ADR-005, ADR-003, ADR-199, ADR-196)
- **New parts start empty** (ADR-089)
- **Bays and shelves layout** — Lay the whole inside out as equal bays with the same shelves and doors. (ADR-031)
- **Apply a layout preset** — Replace the selected space with the inside of a catalog variant. (ADR-033)
- **Merge two touching cabinets** — The two become one cabinet with a divider where they met; any other difference refuses the merge. (ADR-047)

#### Contents

- **Shelves, fixed or adjustable** — Adjustable shelves get 32 mm pin-row notes on the sides. (ADR-023, ADR-196)
- **Drawers with equal or chosen heights** (ADR-005, ADR-023, ADR-196)
- **Hanging rail** (ADR-005)
- **Drawers behind doors** (ADR-005, ADR-006)
- **Appliance niches** — An empty space sized from the appliance's drawing, checked against the opening. (ADR-036)
- **Fixed front with no drawer** — A false front, for example on a sink base. (ADR-054)

#### Quick counts

- **Plus-minus counts on the drawing** — Dividers, shelves, drawers and doors of the selected space only. (ADR-084, ADR-086, ADR-112)
- **Quick counts over the 3D view** (ADR-085)
- **Quick counts over the project front view** (ADR-109)

#### Selecting inside a piece

- **Select from the whole piece inwards** — Each tap selects one level smaller under the tap. (ADR-083)
- **Clear highlight of the selected space** — An outline round it and the rest faded, in the drawing and in 3D. (ADR-087)
- **Drill into a project piece** — Edit its spaces, size, boards and construction without leaving the project. (ADR-088, ADR-090)
- **Esc selects one level up** — In the piece editor: a space, then the space around it, then the whole piece, then nothing. (ADR-203)
- **Outline turns with an angled piece** — The 3D selection outline and the Move ghost are turned like its boards. (ADR-203)
- **Ask before an edit drops contents** — Changing What goes here, lowering Parts, Remove dividers, the quick count − on dividers, applying a layout preset and choosing a diagonal corner ask first when something would be lost; an empty part goes in one tap (ADR-246, ADR-249, ADR-254)
- **Esc inside a project piece** — Selects the space around the selected one; only the whole piece clears the selection (ADR-249)
- **Appliance niche starts at the measured opening** — Kind Other; with no opening the toggle stays off (ADR-249)
- **Edit this piece stays in the project** — The plan and the other pieces stay open; More actions › Open in the piece editor opens the full editor (ADR-241)
- **Rename a project piece** — More actions › Rename… (ADR-245)
- **Change all copies remembered** — The choice is kept on this device (ADR-245)
- **Editing state kept** — Template edits, reloads and piece renames keep the open project and its undo history; edit history is off in the full piece editor, with a title saying to go back to the project (ADR-245)
- **Delete and duplicate a multi-selection** — Delete asks, Ctrl+D duplicates it as a block, Ctrl+A takes 3D models too, and Enter no longer means Remove in a confirm (ADR-246)

### Moving

- **Drag a piece on the plan** — Whole millimetres in 10 mm steps; Esc cancels. The arrow keys move a focused piece 10 mm, 100 mm with Shift. (ADR-065)
- **Move and turn pieces in the 3D view** (ADR-093)
- **Change a wall unit's height by dragging in 3D** (ADR-122)
- **Type an exact position** — From the left, from the back and the gap to the piece on the left. (ADR-022)
- **Turn 90° about the centre** — Turn ↺ and ↻ in the toolbar, or R and Shift+R. (ADR-069, ADR-160)
- **Turn to any whole degree with a handle** — Drag the round handle in front of the selected piece; it snaps to quarter turns, Shift steps by 15°, [ and ] turn by 1°. (ADR-169, ADR-160)
- **Move to a wall, corner, ceiling, floor or neighbour** — One tap slides it to a wall, corner or neighbour, up to the ceiling or down, centres it, or matches a neighbour's top or front. Several selected pieces move as one block. (ADR-147, ADR-182)
- **Place on the floor, on the wall or on another piece** — A piece on another piece follows it. (ADR-031)
- **Lock a piece in place, its turn, or each of its sizes** — Lock keeps it where it is; Lock turn, Lock width, Lock height, Lock depth and Lock size (all three) in More actions. A locked value outranks variables, Replace, linked copies and project settings. (ADR-095, ADR-122, ADR-171)
- **A locked piece on a base keeps the base from being resized** — Unlock it to resize the piece under it; unlocked pieces on it follow. (ADR-203)
- **Locks hold in every flow** — Remove (alone or in a selection), Merge and Mirror the run refuse a piece whose lock forbids it and name it (ADR-243)
- **A grouped piece turns with its group** — Turning one piece of a group is refused with the reason and the turn handle is hidden for it (ADR-250)
- **Position fields take every place the app makes** — Gap, underside and above-floor fields accept 0 to 20000 and show a refusal under the fields; after a Move to tap, focus moves to the Move to group (ADR-250)
- **Move a multi-selection in 3D** — Pressing a selected piece in Move mode drags all of the selection as one undo step (ADR-250)
- **Move alone** — A toggle beside Snap makes every plan drag and arrow-key move act as Alt held (ADR-251)

### Aligning and arranging

- **Snap to neighbours and walls** — A preview while dragging; at equal distance a locked neighbour wins; the Snap box or Alt places freely. (ADR-070, ADR-180)
- **Snap centre to centre** (ADR-099)
- **Connected pieces** — A snap joins two touching pieces; they move together, the seam is marked on the plan, the front view and in 3D, and a pair that no longer touches is warned about. (ADR-168, ADR-179)
- **Connection kinds** — A snap or Connected joins pieces side by side, in a corner or stacked (a wall unit over its base), each checked its own way; Connected to names each kind. (ADR-207)
- **Against the wall** — A piece connected against its wall slides along it; Alt moves it away. Connected and stacked pieces move, mirror and merge together. (ADR-207)
- **Compatibility rules** — Checked when snapping and in the project checks. (ADR-100)
- **Align left, centre, right, back and front** (ADR-099)
- **Align tops and bottoms** (ADR-122)
- **Distribute evenly** (ADR-099)
- **Distribute each row** (ADR-205)
- **Wall unit heights snap to the worktop and wall units** (ADR-205)
- **Angled pieces snap along their turned faces** (ADR-205)
- **Mirrored copies match to the mm** (ADR-205)
- **Groups align and distribute as one block** (ADR-099, ADR-148)
- **Duplicate a piece** (ADR-069)
- **Mirror a piece** — Swaps left and right inside the piece: hinges, pedestals and handles. (ADR-069)
- **Mirror a run or a selection** — Positions reflect about the centre and each piece is mirrored; groups touching the run mirror with it, and a group that cannot mirror refuses with the reason. (ADR-069, ADR-121, ADR-176)
- **Linked copies** — Change one copy and every linked copy changes. (ADR-111)
- **Link identical pieces** — Pieces that are exactly the same are linked in one tap from the card. (ADR-207)
- **Mirror a lounger or a daybed** — The backrest and the side panel are built at the left or the right end. (ADR-207)
- **Align and distribute along each piece's own wall** — Axes follow the first selected piece's turn; pieces standing along another wall are skipped and named; "Already in line." when nothing moves (ADR-251)

### Selection and groups

- **Select several pieces** — Shift- or Ctrl-click, Select on a phone, or Ctrl+A. (ADR-097)
- **Select several pieces in the front view, 3D and the piece list** — One Select box shared by every view. (ADR-159)
- **Selection box on the plan** (ADR-097)
- **Selection box in the front view** — A drag on empty space selects every piece it touches; Shift, Ctrl or Cmd adds. (ADR-211)
- **About Select** — An ⓘ beside each Select says what a tap, a click and a drag do. (ADR-211)
- **Up one level on a phone** — A button beside the path selects the space around the selected one. (ADR-211)
- **Cycle through overlapping pieces** (ADR-097)
- **Keep pieces as named groups** — Grouped pieces move together. (ADR-097, ADR-148)
- **Group names in your language** — New groups are named "Group n" (Russian "Группа n"); Group shows only with two or more pieces selected, 3D models are left out and the card says so, and a double tap makes one group (ADR-252)
- **Selection box takes 3D models** — The plan and front-view boxes also select placed models the rectangle touches (ADR-252)

### Sizing

- **Width, height and depth of the whole piece where it is selected** (ADR-106, ADR-148)
- **Size, boards and construction of a project piece** (ADR-090)
- **Mattress size where a bed is selected** — Mattress width and length beside the selected bed, as in its Settings. (ADR-211)
- **Lock boards and Lock construction** — Each keeps its part of the piece until unlocked; size and place still change. (ADR-211)
- **Lock size** — Nothing changes the piece's width, height or depth until you unlock it. (ADR-122, ADR-199)
- **Size a group as a whole** — Width split proportionally or equally; height and depth set on every piece. (ADR-148)
- **Exact whole-millimetre splits** — Leftover millimetres go one each to the first parts. (ADR-003)
- **A typed size stays until valid** — An invalid number stays on screen marked invalid with the allowed range until you fix it or press Escape; − / + step from the stored value (ADR-253)
- **Locks name only sizes the piece has** — Lock offers only the piece's own sizes; a bed names its locked mattress fields (ADR-253)
- **Group size reports what was kept** — A group resize says "Kept: …" for what it could not change (ADR-253)
- **Refused edits are reported truthfully** — A change a lock refused is never counted as applied; applying a material, finish or style to a group or project skips locked pieces and lists them as "{name}: locked"; the lock chip and plan badge include boards and construction locks (ADR-244)

### Construction

#### Carcass

- **Sides, top, bottom, plinth and back** — Top on or between the sides, bottom between or under them, back nailed on, set in or none. (ADR-004, ADR-031)
- **Doubled top** (ADR-105)
- **Rails instead of a full top** (ADR-036)
- **Cabinet with no bottom** (ADR-036)
- **Wall cabinets** (ADR-025)
- **Corner cabinets** — Blind, L-shaped and diagonal corners, on the floor or hung on the wall (you choose the brackets). (ADR-025, ADR-040, ADR-177, ADR-196)
- **Tall cabinets** (ADR-036)

#### Doors and fronts

- **Hinged doors, one or a pair** (ADR-006, ADR-199)
- **Overlay, half-overlay and inset fronts** (ADR-024)
- **Exact gaps between fronts** (ADR-006, ADR-196)
- **Sliding doors** (ADR-037)
- **Lift-up and drop-down flaps** (ADR-037, ADR-196)
- **No doors or handles inside other doors** ()
- **Front-only panels** — An integrated appliance door or a cover panel with no carcass. (ADR-036)

#### Drawers

- **Drawer boxes with runner choice and clearances** (ADR-005, ADR-010)
- **Drawer boxes without an inner front** (ADR-192)

#### Kitchen runs

- **Run parts: worktop, plinth, fillers and covers** — Suggested along a run of base units and kept up to date. (ADR-036, ADR-061)
- **One plinth for the whole run** (ADR-054)
- **Scribe allowance for fillers** (ADR-054)
- **Worktop over chosen pieces, with overhangs** (ADR-075)
- **Crown, pelmet and ceiling filler** (ADR-075)
- **Handles for a whole run** (ADR-125)
- **Run handle shown in the piece editor** — Its kind and hole centres, read-only, under Set by Handles for this run. (ADR-203)
- **Sink cut-out in the run worktop** (ADR-125)
- **Runs along the side walls** (ADR-205)
- **Worktop corners with a mitred or butt joint** (ADR-205)
- **Hob cut-out in the run worktop** (ADR-205)
- **Sink and hob cut-outs drawn on the plan** (ADR-205)
- **Moulding profiles drawn or typed** (ADR-209)
- **Templates keep run requests** (ADR-209)
- **Sink and hob cut-outs placed from the left and the front** (ADR-209)
- **Cut-outs as holes in the 3D worktop** (ADR-209)
- **Worktop edges square, rounded or bevelled** (ADR-209)
- **Worktop overhangs and trim heights follow variables** (ADR-209)

#### Other kinds of furniture

- **Desks with pedestals** (ADR-007, ADR-026)
- **Tables, benches, stools, chairs and beds** (ADR-038, ADR-196)
- **Shaped parts** — Raked backs, splayed legs and profiled fronts, still in whole millimetres. (ADR-040)
- **Loose panel sets** — Parts known only by their cut sizes. (ADR-041)
- **Typed construction sizes kept exactly** — Decimals such as 2.5 are refused out loud, not rounded; runner lengths and loose-panel names stay on screen marked invalid until valid (ADR-254)

### Boards and edges

- **Boards: name, thickness, grain and colour** (ADR-019)
- **One Material control everywhere** — Material in the header bar: a board on one part, the item, the group or the whole project, on any part roles. (ADR-055, ADR-163)
- **One PAL 18 board for every part by default** — New pieces start on one board; the wizard offers the project's boards and your decor list. (ADR-164)
- **A common top or bottom across items** — Select items standing side by side: Common top or Common bottom makes one panel across them. (ADR-165)
- **Run parts and edge bands in the Material dialog** — Worktop, fillers, plinth and trims of a run; an edge band per part role or per part. (ADR-188)
- **Common top across gaps, corner units and desks** — One top over a gap, round an L or diagonal corner (cut to template) and over a desk. (ADR-189)
- **Neighbours share one side panel** — Select cabinets side by side: Shared sides leaves one side per joint; fronts meet over its middle. (ADR-190)
- **Shared sides with blind corners and desks** — A blind corner unit shares its straight end with a cabinet; a desk beside a cabinet leaves its gable out. (ADR-207)
- **Stock sheets, trim and kerf** (ADR-019)
- **Solid timber stock** (ADR-038)
- **Manufacturer and type labels** (ADR-049)
- **Import your own decor list (CSV)** (ADR-049)
- **Boards and edge bands from a seller** — Bundled seller products (Regency first): same thickness and decor first, you pick; pictures not shipped with the app load online from the seller’s site. (ADR-161)
- **Seller board pictures shipped with the app** — A seller board shows its decor in 3D and the front view, without asking the seller’s site. (ADR-162)
- **A picture from your device on a board** (ADR-048)
- **Matte, satin or gloss finish** (ADR-067)
- **Edge band per board** — Type, thickness, width and code, on the cut list and shopping list. (ADR-077)
- **Band list import** — Import your band list (CSV); each board’s edge band offers matching bands first, then the others by colour. (ADR-212)
- **Own board for any single part** — In Material, scope Part; a part the piece no longer builds is listed to clear. (ADR-151, ADR-163)
- **Style suggestions** — In the Material dialog: board and handle combinations, labelled as suggestions. (ADR-123, ADR-163)
- **Project-wide settings** — Handle, front overlay and plinth height that pieces follow; Material with scope Project sets the carcass, front and back boards. (ADR-124, ADR-163)
- **Board changes told truly** — A refused clear says "Nothing changed: {why}"; an empty board name goes back to the stored one; a removed part's board is named and cleared by number; band thickness shows its error (ADR-255)
- **Back to the group's board** — In Material, scope Part: Use its group's board again (ADR-246)

### Hardware

- **Hardware schedule** — Hinges, runners, rails and brackets, with typical values labelled as guidance. (ADR-010)
- **Handles: bar, knob or push to open** (ADR-024, ADR-196)
- **Fastener counts** — Counted from the model as guidance; you name the fasteners you use. (ADR-074)
- **Project fasteners and drilling positions** (ADR-209)
- **Hardware you choose yourself** — Sliding tracks, flap stays and appliance fixings wait for your choice, never invented. (ADR-037, ADR-010)
- **Typed counts and names kept as typed** — Decimals are refused with the reason; fastener rows show what is really saved; the handle hole centres field shows the value the model uses even if it is not in the list; names you give appear inside translated sentences (ADR-256)

### Room and walls

- **Room size, doors, windows and obstacles** (ADR-058, ADR-200)
- **Draw the floor plan** — Rectangle, L, U and alcove shapes, every wall length editable. (ADR-059)
- **Pipes and outlets** (ADR-072)
- **Wall colour or picture** — Set per wall under Walls in the room; shown on the walls in 3D and behind the pieces against it in the room front view. Solid walls in 3D makes the walls opaque. (ADR-145)
- **Fit, shift and straighten a wall picture** (ADR-146)
- **Wall colour bands on the plan** — A 50 mm band inside each wall with a background, in the wall's colour. (ADR-208)
- **Floor colour or picture** — Set under Walls in the room; shown on the floor in 3D and under the pieces on the plan. (ADR-208)
- **Wall behind a single piece** — A piece opened from a project with a room shows the wall its back stands against in its own front view. (ADR-208)
- **Board pictures on the plan** — Each piece on the plan shows the picture of its highest panel's board. (ADR-208)
- **Trace a plan picture** — Add a picture of the floor plan, set its scale from two taps and a known length, and draw the room over it. (ADR-208)
- **Opening clearances** — Doors and drawers need free space in front. (ADR-057)
- **Chair, installation and service clearances** (ADR-073)
- **Clearance zones in 3D** (ADR-205)
- **Backs cut around pipes and outlets** (ADR-205)
- **Room size errors at the field** — Each wrong value is named under the field where it was typed; the room outline is still set and the problems stay (ADR-257)
- **Room features named in your language and numbered with the lowest free number** — A repeated corner adds no wall; a second scale tap on the same point asks for a different one; the floor picture input is named for replacing (ADR-257)

### Checks and problems

- **Problems checked on their own; errors block export** (ADR-008, ADR-196)
- **Overlap and room checks** (ADR-022, ADR-058)
- **Construction guidance** — Shelf span, door width, anti-tip and more, labelled as guidance. (ADR-035)
- **Select the problem** — Tapping a check selects the pieces and shows where it is. (ADR-071)
- **Previewed repairs** — A repair moves the whole group and connected pieces together; one they cannot follow is shown refused, with the reason. A depth or height mismatch between neighbours is repaired by matching one to the other; pieces whose families share no room, by moving one along its wall. (ADR-071, ADR-176, ADR-204, ADR-210)
- **Repair fillers kept by automatic refresh; the problem in 3D** (ADR-209)
- **Piece warnings in the project checks** — Each piece's warnings are listed with the piece name wherever the project's checks are read; they never block (ADR-258)
- **Honest repair banner** — A problem with no repair says "This problem has no automatic repair"; the Checks tab names its count and the banner takes focus when a check is tapped (ADR-258)

### Views

#### Drawings

- **Compose and Build & Preview modes** (ADR-079, ADR-080)
- **Front drawing with sizes** (ADR-014)
- **Project plan and room front view with sizes** (ADR-022)
- **2D, 3D or both side by side** — One View switch in Compose and Build & Preview; the chosen view stays when the mode changes. (ADR-081, ADR-144)

#### 3D view

- **3D preview, select by click** (ADR-014)
- **Exploded 3D view** (ADR-014)
- **Realistic look** — Board finishes, room light and soft shadows. (ADR-067)
- **Render a photo-quality picture** — Saved as PNG; best on a laptop, a phone may be slow. (ADR-068)
- **Export scene (.glb)** — The 3D scene with its boards and their pictures as one binary glTF file, for Blender or another renderer; made on this device. (ADR-206)
- **WebGPU rendering** — Render uses the WebGPU path tracer when the device has WebGPU, WebGL 2 otherwise. (ADR-208)
- **View in AR and export for AR** — From the 3D toolbar ⋯: View in AR on phones that offer it, and a .usdz file for AR Quick Look. (ADR-208)
- **AR furniture sits on the real floor** — Steady floor-only hits, anchors so it does not drift, a soft shadow under it, sharper edges. (ADR-213)
- **Place in AR by a corner or into a room corner** — A footprint outline, a Point switch (Centre, Back-left, Back-right) and Room corner by two floor taps. (ADR-214)
- **Fine-tune in AR and see its size** — Move 1 cm or 10 cm, turn 1° or 15°, Place again, and W × H × D labels in mm. (ADR-215)
- **AR walls, wall gap, real objects, room light, drag and per-piece sizes** — Room corner in one tap when both walls are seen, a wall gap, real objects hide it, the room light, one-finger drag, Sizes per piece. (ADR-218)
- **Section view and Isolate** (ADR-122)
- **Draws only when something changes** (ADR-121)

#### Imported 3D models

- **Import GLB and glTF models** — Display-only items, checked against the pieces and the room. (ADR-076)
- **Width, height and depth of a model** (ADR-102)
- **Move and turn a model in 3D** — Drag it in Move mode, with Snap, and turn it 90° about its centre. (ADR-203)
- **Place and drag 3D models** — On the floor, on the wall or on a piece; dragged with snapping on the plan and in Move mode; kept in project templates. (ADR-208)
- **Cut list place on phones** — The bottom bar reads Projects · Catalog · Editor · Cut list; its badge counts errors or warnings (ADR-241)
- **Settings and Material inside the phone sheet** — The sheet goes to full height and the dialog takes its body; closing returns it to half (ADR-247)
- **Render stops when closed** — Close, Cancel or a new Start disposes the job; without WebGL a hint explains and points the 3D and Both buttons to it (ADR-259)
- **One 3D ⋯ menu** — Export scene (.glb), View in AR and Export for AR sit together; model side fields stay inside 1 to 10 000 mm with Keep proportions (ADR-259)

### Output

#### Results

- **Results tabs under the views** — Parts, Sheets, Hardware, Assembly, Shopping and Checks; Parts shows the number of parts and Checks the number of problems; on a phone they stay folded until you tap a tab. (ADR-079, ADR-091, ADR-174)
- **Assembly steps** — Steps per piece, labelled guidance: prepare the parts, fit hardware to the sides, assemble, then fit drawers and doors. Each step has an instruction, its parts, joints, fasteners and hardware; identical drawers are listed once. Show step lights the parts in 3D; printed with each piece’s front view in the print language. (ADR-174, ADR-185, ADR-186)
- **Show the hardware step in 3D** — Fit hardware to the sides lights the sides and dividers its hinges and runners go on. (ADR-207)
- **Your own assembly steps** — Move steps up and down and rename them; the tab and the print follow; Reset the steps brings the generated ones back. (ADR-207)
- **Project assembly order** — A project’s Assembly tab and printed sheet open with the order of its pieces: corner cabinets, base pieces wall by wall from the corner, wall pieces, then run parts; labelled guidance. (ADR-178)

#### Cut list

- **Cut list with finished sizes and edge-band marks** (ADR-009)
- **Grouped parts, area and band metres** (ADR-009)
- **Parts CSV** (ADR-020)
- **Lengths list for solid stock** (ADR-038)

#### Sheets

- **Sheet layouts** — Parts nested on your stock sheets, checked by an independent validator. (ADR-018)

#### Shopping and costs

- **Running cost estimate** — A chip in the editor header with the estimate of what is shown, updated on every change; tap it to open the Shopping list. (ADR-172)
- **Shopping list** — Boards, banding, hardware, run parts and what is still to choose. (ADR-064)
- **Shopping list CSV** (ADR-064)
- **Unit price on each Shopping list row** — Under each line total, the unit price it comes from (your price or the seller’s); “—” when a row has no price. Also a column on the printed list and in the CSV. (ADR-181)
- **Cost estimate from your price list** (ADR-062)
- **Seller products for hardware and seller prices** — Your own price wins; otherwise the seller price, with its date. Add seller product puts any seller product on a piece’s shopping list. (ADR-161)
- **Project seller items** — Add seller product in the project view puts a product on the project’s own shopping list; it travels in project templates. (ADR-210)

#### Printing and files

- **Print sheets or save as PDF** (ADR-020)
- **Download drawings as SVG** (ADR-020)
- **Fusion 360 script** — Rebuilds the model as named solid boxes; not verified inside Fusion. (ADR-021)
- **Review pack for a professional** — Summary, parts CSV, drawings and the project file in one .zip. (ADR-121)
- **Client sheet** — One A4 page to sell from: a picture, the pieces with their sizes and the estimated price, with the lines that have no price counted. (ADR-206)
- **Exports blocked on errors** — Print assembly steps, Front view drawing and Fusion 360 script are disabled while the design has an error, with the reason "Fix the problems listed under Checks first" (ADR-260)
- **Print speaks the print language only** — The shopping list print uses print-language units, a decimal comma and an estimate line; the shopping CSV is named after the design; the cutting sheet's piece names follow the CSV (ADR-260)
- **Output failures said** — A failed price import says the prices could not be saved on this device; a failed review pack says why; the price chip says "Prices could not be read" (ADR-260)

### Projects

- **Several pieces in one room, with combined lists** (ADR-022)
- **Projects page** — Open, duplicate and delete projects and single pieces. (ADR-078)
- **Ask about kept versions when deleting a project** — Keep them is the default; only readable versions are deleted. (ADR-203)
- **Versions of deleted projects** — Under History: restore one as a new project, or delete it with a tap. (ADR-211)
- **Resize the phone sheet** — Drag the handle to collapsed, half or full screen; arrow keys step. (ADR-211)
- **Own glyphs for Fill a wall and Fill the room** (ADR-211)
- **Back to the editor only with a design open** — On the Gaps and Research pages, as in the Catalog. (ADR-211)
- **Add a piece from a list with pictures** (ADR-094)
- **Tap the plan to place** (ADR-056)
- **Drag a catalog item onto the plan** (ADR-094)
- **Insert a project template** (ADR-123)
- **Replace a piece with a compatible one** — Your own changes are kept where the new piece has the same setting. (ADR-098, ADR-124)
- **Template updated notices** (ADR-096)
- **Template references** — A catalog piece keeps only what differs from its template. (ADR-124)
- **Undo and redo with named steps** (ADR-051, ADR-123, ADR-198)
- **Edit history** (ADR-123)
- **Version history** (ADR-123, ADR-200)
- **Save as a project template** (ADR-060, ADR-200)
- **Project variables and formulas** — Bind a size, a division or a position to a named value; change it once. Formula fields keep the full keyboard. (ADR-166, ADR-195)
- **Variables in a piece** — A piece’s own variables in its settings; its width, height, depth and underside height bind to them, also inside projects and catalog templates. (ADR-210)
- **Formula functions** — min, max, floor, ceil and round in variables and bindings; values in a call are separated by a comma or a semicolon. (ADR-206)
- **Formulas with comparisons, if and stepped rounding** (ADR-209)
- **Value sets** — Duplicate every bound piece with other values, with the room; set 1’s run parts, run handles and sinks are copied onto each set and kept in step; save a set as a project. (ADR-167, ADR-175)
- **Side panel ordered by use** — Add a piece at the top, previous and next piece, one toolbar, a More actions menu and Delete to remove. (ADR-117, ADR-160)
- **Quick actions on the phone sheet** — Edit, duplicate and turn the selected piece with the sheet closed. (ADR-160)
- **Failed writes said** — A failed delete says whether the project, the piece or its kept versions failed; Value sets save once per tap and retry the same project; "Updated from the saved piece" shows only when the update really happened (ADR-261)

### Catalog and templates

- **Browse by room or type, with search** — Group chips and headings count the items the search shows. (ADR-032, ADR-195)
- **1–5 variants per family** (ADR-033)
- **Catalog pictures** (ADR-042)
- **Compact cards with More** — Open under the picture, so the text has the card’s width. (ADR-118, ADR-119, ADR-195)
- **Edit templates on this device** — Shipped templates never change; reset or compare with the shipped one. One save is one revision; Cancel keeps the draft; a failed save or read is shown. (ADR-034, ADR-195)
- **Save a design as a template** — Name, room and type, with a link to the new family. (ADR-034, ADR-195)
- **Choose which edit to keep on template import** — An imported template for a family you edited asks; Keep mine is the default. (ADR-203)
- **Save a project piece to the catalog** (ADR-107)
- **Safety-regulated items** — A bunk bed or cradle card says you check it yourself, with "I check it myself". (ADR-035, ADR-195)
- **Catalog origin kept on copies** (ADR-028)
- **Brands** — A chip per manufacturer of your decor list, with its count: its decors and the saved pieces with its boards. (ADR-210)
- **Family rule for your own templates** — A piece from your own template keeps its rooms, so pieces of rooms apart are warned about. (ADR-210)
- **Reference entries for upholstered pieces** (ADR-039)
- **An import never loses an edit** — Use the imported one saves first and removes your other edits of that family only when the save worked; unreadable files and saved-piece reads say so; card and variant controls name their item (ADR-262)
- **Catalog page by category, brand and Saved on this device** — Browse furniture grouped by category or brand, or what is saved on this device (ADR-027)

### Saving, backup and sharing

- **Autosave on this device** (ADR-012)
- **Works offline, as an installed app** (ADR-002, ADR-126)
- **Import and export files** — Designs and projects, with their pictures and 3D models. (ADR-011, ADR-078)
- **Design codes and links** (ADR-124)
- **Keep saved data persistent** (ADR-133)
- **Back up to a folder or a .zip, and restore** — Restoring adds new copies; nothing saved is overwritten or deleted. (ADR-133)
- **Backup reminder** (ADR-141)
- **Only-on-this-device notice** (ADR-140)
- **Clean up unused pictures** (ADR-048, ADR-078)
- **Share links** — Signed in, a link to a piece or template; anyone with it opens a copy until you stop sharing. (ADR-132, ADR-138)
- **Preview a shared item** (ADR-143)
- **Failures said, nothing lost** — A stopped restore says how many items were restored; a missing backup says so; Clean up unused pictures also checks kept project versions; opening a shared item makes one copy per tap; file exports say when pictures or models could not be read (ADR-263)
- **Explicit autosave and changed-rows backup** — Every save emits its own change; a folder backup writes only changed rows and deletions (ADR-235)
- **Offline before first use, with a size budget** — The precache lists the app, seller catalog and viewer chunks and a test holds it to a size budget (ADR-234)

### Account

- **Sign in with Google** (ADR-135)
- **Email and password, forgot and reset** (ADR-136)
- **Stay signed in** (ADR-134)
- **Save pieces and templates to your account** — Signed in, saved pieces and templates upload by themselves; Keep on this device only opts one out, and In your account lists those not on this device. (ADR-128, ADR-137)
- **Sync status** (ADR-129, ADR-139)
- **Conflicts never lose work** (ADR-129)
- **Several accounts on one device** (ADR-142)
- **Privacy notice, data export and account deletion** (ADR-130)
- **Account actions that fail say so** — Deleting the account stops automatic upload only after the server confirms; a failed Keep on this device only says it could not be taken out of your account; typing clears the password mismatch; a copy is named "{name} (from your account)" (ADR-264)
- **Secure sessions and content security policy** — Online requests contact only the allowed origins (ADR-131, ADR-233)

### Assistant

- **Chat assistant** — Signed in, in a build with a backend, you write what you want and the assistant asks back when something is unclear. It reaches an AI model only through the backend's `assistant` function, which holds the provider key and a daily cap (ADR-239)
- **Every editor action as a previewed change** — Anything doable by hand (size, divide, contents, doors, materials, adding, moving and turning pieces) is a catalog action; a plan is checked whole, previewed, then applied as one undo step (ADR-240)
- **Field limits enforced** — The assistant is refused saw cuts outside 0–20 mm and variables with empty or duplicate names; a refusal fails the plan's preview with the reason; in a project its saw cut sets the project's saw cut (ADR-246)
- **Refusals reach the assistant** — A refused merge, mirror, gap, Against the wall, Align or Distribute sets a notice, so a plan sees it (ADR-244)

### Language

- **English or Russian** (ADR-153)
- **Every screen translated** (ADR-154)
- **Catalog, wizard and research translated** (ADR-155)
- **Problem messages translated** (ADR-156)
- **Print language: Romanian, Russian or English** (ADR-157)

### Information

- **Information and guides page** (ADR-158)
- **Feature Research** — Research features still left to build, and competitors. (ADR-043, ADR-092, ADR-110, ADR-149, ADR-152, ADR-184)
- **Gaps page** — Gaps with rough work, impact and necessity ratings, filters, and an issue and a fix line each. (ADR-101, ADR-187)
- **Gap marks in a file** — Export marks and Import marks move your gap marks between devices; the newer mark wins. (ADR-212)
- **Info buttons** (ADR-080, ADR-113)
- **Arrow keys in segmented controls** — Tab reaches the chosen option; the arrow keys, Home and End move and choose, in every segmented control. (ADR-202)
- **Light and dark themes** (ADR-030)
- **Honest information pages** — Back to the editor shows only with a design open; Import marks says how many marks were kept because yours are newer; Research and Gaps keep unsaved ids until they are saved (ADR-266)
- **One control height and heading scale** — Controls share one height and button labels never wrap; headings and spacing follow shared tokens (ADR-114, ADR-115, ADR-116, ADR-120)

### Under the hood

No screen of their own; each line states its ADR's title.

- **Stack and tooling** — React 19, TypeScript strict, Vite 7, Zustand, react-three-fiber, Dexie (ADR-013); pnpm, Prettier and Node 24 (ADR-053); the reserv ADR layout and skills (ADR-050) (ADR-013, ADR-050, ADR-053)
- **Clean break** — Rebuilt from zero, no data from the previous app (ADR-001)
- **Verification and process** — Core unit tests plus seeded fuzz; find-it acceptance in Vitest and jsdom, with a browser script as a flag; light acceptance; the gaps ledger; smallest-slice process (ADR-015, ADR-016, ADR-066, ADR-082, ADR-108, ADR-201, ADR-224)
- **CI** — Parallel jobs, test shards, docs-only runs, caches, a deploy that waits on CI, incremental type-checking (ADR-197, ADR-220)
- **Catalog feed** — A scheduled search-and-extract job with a local PDF extractor, gated by a pull request (ADR-029, ADR-052)
- **Backend choice** — Backend, sign-in provider and database (ADR-127); secure sessions, content security policy and online requests (ADR-131, ADR-233)
- **Architecture** — Lint-enforced layer boundaries (ADR-219); persistence behind the store (ADR-223); a viewer free of UI imports (ADR-230); room and seating sizing rules in core (ADR-232); a simpler design store (ADR-231); stable diagnostic codes (ADR-225); nesting as an internal module with golden layouts (ADR-228); saved rows validated before duplicating (ADR-227); one commit path for project changes (ADR-226)
- **Performance** — Memoised placed pieces (ADR-221); split bundle with lazy pages and research data (ADR-222); shared viewer materials and merged panel edges (ADR-238); language dictionary loaded before the app, Russian lazy for English (ADR-229)
- **Housekeeping** — Agent contracts stay runtime-neutral (ADR-017); research tests and dead code removed (ADR-150, ADR-236); browser test dependency declared (ADR-237); feature-tree details completed (ADR-183); layout bug fixes from the 2026-10-27 critique (ADR-115, ADR-120)

## Develop

```sh
pnpm install --frozen-lockfile
pnpm dev        # http://localhost:5173/furniture-builder/
pnpm test           # unit, fuzz and storage tests
pnpm lint && pnpm typecheck && pnpm build
pnpm docs:check # ADRs, their index and every ADR / backlog id
```

`FUZZ_N=50000 pnpm exec vitest run tests/fuzz.test.ts` runs a deep geometry fuzz.

## Layout

```
src/core      pure TypeScript model: geometry, generators, checks, cut list, nesting, projects, rooms, wizard,
              i18n, print output, Fusion export, design document
src/store     Zustand store: design, derived model, selection, undo/redo
src/persist   IndexedDB (Dexie) storage
src/online    opt-in accounts, account storage, share links, assistant client (dynamic imports only)
src/ui        React UI: front elevation, inspector, parts/hardware/checks, dialogs
src/viewer    lazy three.js preview, render and AR
supabase      backend functions (assistant) and setup
tools         catalog extractor and find-it acceptance scripts
tests         core, fuzz and storage tests
docs          backlog (single ledger), ADRs (docs/adr, docs/adr-done), product context, UI design
scripts       docs check (ADRs, index, ids)
```

Decisions are in `docs/adr/` (pending) and `docs/adr-done/` (implemented); the workflow is in `CLAUDE.md`. MIT licensed.
