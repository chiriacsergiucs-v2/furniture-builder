# Gaps archive — gaps that are Done (ADR-082)

Gaps that were built or no longer apply, moved here from [GAPS.md](GAPS.md) by `pnpm gaps archive` (and by
`pnpm gaps sync`). Kept so every G id cited in an ADR or the backlog still resolves. New ids continue after the
highest id in either file.

## Gaps

### G-002: Decor list not in exports

- Status: Done (ADR-133)
- Origin: ADR-048, 2026-10-24 08:27 UTC; agent scoped it out
- Missing: The decor list is not in exported files. It has to be imported again on each device.
- Request: “Render the furniture according to the selected material's color and structure”, then “any image as color/background for the material”.
- Questions: Embed only the decors a design uses, or offer the whole list too?
- Suggested pick: Embed the decors a design uses in its export (the pictures already are), plus an optional “Include my whole decor list” checkbox. Needs a schemaVersion bump with old readers kept. (estimate: effort +10%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): origin is ADR-049 (the decor list, Dexie v6 decors), not ADR-048. Boards made from decors already travel in exported files with their code (src/core/materials.ts:286-293). Only exporting the whole decor list remains.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): the folder and .zip backup carries the decor list and restore adds it on another device (src/core/backup.ts:22, :138-199).

### G-013: Templates from selected pieces

- Status: Done (merged into G-032)
- Origin: ADR-060, 2026-10-24 15:54 UTC; agent scoped it out
- Missing: A template can only be made from a whole project, not from selected pieces.
- Request: Reusable project templates (context, not a quote)
- Questions: Build together with multi-select (G-032)?
- Suggested pick: “Save selection as template”. It needs multi-select, which ADR-069 also left out, so build both together. (estimate: effort +15%, value +10%)
- Note: Re-checked 2026-10-26 on main 51e4f42 (code read, no browser): merged into G-032 (it needs multi-select).

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

### G-026: Free-angle rotation

- Status: Done (ADR-121)
- Origin: Research, 2026-10-24 21:29 UTC; user decision
- Missing: Free-angle rotation is ruled out by ADR-003/004 (axis-aligned, whole mm).
- Request: “Predictable rotate”.
- Questions: Keep 90-degree turns only (acknowledge)?
- Suggested pick: 90° turns cover “predictable”. Free angles need a new ADR; not recommended unless you have angled rooms.
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): pieces can stand at any whole-degree angle (src/core/project.ts:514-522); typing the angle is hidden, tracked by G-311.

### G-029: Light acceptance never retired

- Status: Done (obsolete: user 2026-10-28)
- Origin: Light acceptance, 2026-10-24 23:34 UTC; agent scoped it out
- Missing: Your decision to drop light acceptance was never applied. Its ADR sits unmerged on branch ccr-137ce6a6-cq7441, and its numbers ADR-080 and N75 are now taken on main by the Settings ADR. main still allows “Acceptance: light”.
- Request: “Remove the idea of find-it pending, I changed my mind”.
- Questions: Merge the unmerged ADR under the next free numbers, then catch up every pending find-it?
- Suggested pick: Give it the next free ADR and backlog numbers, merge it, then run every pending find-it (see the ADR-080 row). (estimate: effort +5%, value matches your words)
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): no longer applies: the user made every ADR light (“update all adrs te be light”, ADR-126, ADR-137); CLAUDE.md R3 keeps the ADR-066 exception.

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

### G-102: Alternatives for a piece that sits on another piece

- Status: Done (user answer 2026-10-26 "Same width only for stacked pieces")
- Origin: ADR-098 implementation (2026-10-26, Claude: defaulted)
- Missing: Which catalog items count as the same placement kind for a piece placed on or above another piece; built: every standing and wall-hung item (the piece keeps its on-another-piece placement).
- Request: New adr 5 (2026-10-26): compatible = same placement kind (floor, wall, on another piece)
- Questions: For a piece on another piece, offer every item, or only standing items, or only items of the same family?
- Suggested pick: Every item, since the placement carries over (as built; narrowing to standing items is about +5 % of ADR-098's work)

### G-108: Multi-select in the front view and 3D

- Status: Done (ADR-159)
- Origin: ADR-097 (2026-10-26, Claude: scoped while building)
- Missing: Shift/Ctrl/Cmd-click adds pieces to the selection on the plan and in the project's piece list; in the room front view and in 3D a click still selects one piece.
- Request: New adr 2 (2026-10-26): Desktop: Shift- or Ctrl/Cmd-click adds or removes a piece
- Questions: Add Shift/Ctrl-click to the room front view and to 3D too?
- Suggested pick: Yes, the same toggle in both views (about +10 % of ADR-097's work, +10 % value; estimates).
- Note: Re-checked 2026-11-04 on main d7bd2e8 (code read, no browser): Shift/Ctrl/Cmd-click selects several pieces in the front view and in 3D (src/ui/Project.tsx:1984-1992, src/viewer/Viewer3D.tsx:1434-1437).

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

### G-125: Width and depth card over the project view for a selected piece

- Status: Done (ADR-109)
- Origin: ADR-106
- Missing: In a project, a piece selected but not opened (Inside this piece) gets Width and Depth in its Selected piece card only; no floating card over the project drawing or 3D (the quick-count card shows there only for an opened piece, ADR-088).
- Request: Add the posibility to change width/depth when whole cabinet or whole piece is selected; answer: Card + side panel
- Questions: Should a selected project piece also get a floating Width/Depth card over the project plan, elevation and 3D?
- Suggested pick: Yes, a floating card over the project views (closest to 'Card + side panel'; estimate +60 % work, +15 % of value)

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

### G-180: Lock parameters other than size

- Status: Done (ADR-171)
- Origin: ADR-122 (found while building)
- Missing: Lock size covers width, height and depth only; boards, construction and insides of a size-locked piece stay editable (the research's locked parameters, G-081, beyond size)
- Request: Accept default
- Questions: Should other parameters (boards, construction, insides) be lockable too, and one by one or together?
- Suggested pick: Leave as is until asked (the user's pick was a separate Lock size)

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

### G-330: Connections shown only on the plan

- Status: Done (ADR-179)
- Origin: ADR-168, 2026-11-04; agent scoped it out
- Missing: Connections are shown on the plan (a tick on the shared edge) and on the card only; the front view and the 3D view do not highlight them.
- Request: Not a quote: the user chose record, re-check and move together
- Questions: Show connections in the front view and 3D?
- Suggested pick: A matching tick in the front view and a thin line in 3D (estimate: effort +15%, value +10%).

### G-334: Templates keep copies, not references

- Status: Done (obsolete: user decision 2026-11-05, templates keep copies (ADR-060))
- Origin: ADR-170, 2026-11-04; user decision
- Missing: Templates do not reference catalog items (ADR-060 chose copies; the research asks for references).
- Request: “Keep copies; add connections, variables, bindings, project settings” (user 2026-11-04)
- Questions: None; the user chose copies.
- Suggested pick: Keep copies (chosen). References would need a new ADR replacing ADR-060 (estimate: effort +150%, value +30%).

### G-336: Verified research rows not yet deleted from the data

- Status: Done (ADR-184)
- Origin: ADR-168, 2026-11-04; agent scoped it out
- Missing: The three research rows ADR-168 completes (Transactional undo/redo, Versioned save/reload, Connected items stay independently selectable) are marked Verified in the research data but stay listed; ADR-149 and ADR-152 deleted built features from the data in their own ADRs.
- Request: “Validate all High demand features … create adrs” (user 2026-11-04)
- Questions: Delete the three rows from the research data as ADR-152 did?
- Suggested pick: A small deletion ADR after ADR-168 to ADR-170 ship, covering all four High-demand rows at once (estimate: effort +5%, value +5%).

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

### G-345: No project-level assembly order

- Status: Done (ADR-178)
- Origin: ADR-174, 2026-11-04; agent scoped it out
- Missing: Steps are per piece; no project-level order (which piece first, run parts, worktops, common panels).
- Request: “Ordered step list + 3D highlight” (user 2026-11-04)
- Questions: Add a project order: pieces along the wall, then run parts?
- Suggested pick: A project section before the pieces: corner first, then along each wall, run parts last (estimate: effort +20%, value +15%).

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
