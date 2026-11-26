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
- Missing: The Fusion 360 export has never been run inside Fusion (N03). The checklist half is done (N401, docs/fusion-check.md); the run in Fusion needs the user.
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

### G-031: ADR-072 defaults unconfirmed

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; the pick confirms the ADR-072 defaults as built
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

### G-039: ADR-077 open decisions

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

- Status: Open
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
- Note: 2026-11-06: ADR-212 shipped without this item; the one pass adding G ids to old backlog gap notes and pending ADR open questions was skipped, so the gap is open again.

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

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

### G-101: Ledger not editable from the app

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

### G-107: Keep mine for saved single pieces

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

### G-119: Doubled rails on a rails top

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

### G-127: Fill a wall: the over-hood cabinet is not placed over a hood

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

### G-137: Linked copies across projects and templates

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

### G-171: Angled pieces are not part of runs

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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
- Missing: Supabase migration not applied, Google sign-in not registered, email settings not set, no live check; the project URL and key are in .github/workflows/deploy.yml:55-56.
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
- Note: Re-checked 2026-11-07 on main 9f4e59b (code read, no browser): Missing text updated to the current code.

### G-278: Account and share-link limits

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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
- Missing: Seller prices and stock are a snapshot bundled in the app build (Regency export of 2026-10-29). The app never updates them itself; ADR-172 added a hand-started workflow (.github/workflows/seller-prices.yml) that takes an export URL and opens a pull request, and a newer file still needs a release. Nothing runs on a schedule. Live feeds were rejected (ADR-063, Rejected 2026-11-07).
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

### G-364: Shelf pins in a diagonal corner

- Status: Open
- Origin: ADR-196, 2026-11-05; design critique, agent scoped it out
- Missing: Pin rows on five-sided boards: adjustable shelves in a diagonal corner (ADR-196 makes them an error instead).
- Request: Not asked; noted in the 2026-11-05 design critique ("critique of design … 1 adr with high and medium issues and fixes per flow") and left out of the ADR.
- Questions: Support pin rows on the diagonal's straight sides?
- Suggested pick: Keep the error until a diagonal pin layout is decided with you. (estimate: effort +10 %, value +3 %)

### G-369: Drop the duplicate push-to-main CI run

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
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

### G-371: Cheaper find-it runs (stopped before it was built)

- Status: Open
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
- Note: 2026-11-06: ADR-212 shipped without this item; the find-it speed levers were not measured or applied, so the gap is open again.

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

### G-420: Run parts read connections

- Status: Open
- Origin: ADR-207, 2026-11-06; remainder of G-007 (the coordinator kept ADR-207 to its size)
- Missing: Suggest run parts (ADR-061) groups runs with groupRuns (src/core/project.ts:2201): base pieces turned the same way, in line, with gaps up to 150 mm; it does not read stored connections.
- Request: “Verify, then Quick wins, then Medium effort”; later “guided snapping” and “cross-family composition”.
- Questions: Should run parts treat side- and corner-connected pieces as one run?
- Suggested pick: Build runs from side and corner connections when they exist, else from touching pieces as today. (estimate: effort +15%, value +10%)
- Work: Medium
- Impact: Low-medium
- Necessity: Low
- Issue: Run parts ignore stored connections.
- Fix: Let groupRuns read side and corner connections.
- Conflicts: none
- Note: Re-checked 2026-11-07 on main 9f4e59b (code read, no browser): Missing text updated to the current code.

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
- Missing: AR opened on the user's phone, but taps did nothing (user 2026-11-07, fixed in eec2be62). Placing furniture after that fix and AR Quick Look on an iPhone are not checked on a real device.
- Request: Not asked in words; ADR-208 Done when lists the check on a real Android phone and an iPhone (user: 'Build only adrs 201-212').
- Questions: Can you open the live page on an Android phone and an iPhone and try View in AR and Export for AR (.usdz)?
- Suggested pick: You run the two device checks after the merge and tell Claude the result; Claude records it in N213. (estimate: effort +0 % for Claude, value +10 %: the only proof AR works)
- Note: Re-checked 2026-11-07 on main 9f4e59b (code read, no browser): Missing text updated after the AR tap fix.

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

### G-472: Core-only test selection: saving unproven

- Status: Open
- Origin: ADR-201 tests, 2026-11-06; agent found it
- Missing: G-368 (CI runs only related tests on core-only PRs) is unproven: no CI run id exists for a core-only PR, and for widely imported core files the saving can be under 10 % (src/core/sizeLock.ts selects 136 of 151 test files; shareCode.ts selects 45). ADR-201 says to ask the user when the saving is under 10 %.
- Request: Not asked in words; ADR-201 Decision for G-368: measure, and ask the user if the saving is under 10 %.
- Questions: Keep the core-only selection (it saves little for widely imported files), or drop it and keep the full suite on every PR?
- Suggested pick: Keep it: it saves 70 to 90 % on narrow core changes and costs nothing otherwise. Record a CI run id once a core-only PR runs. (estimate: effort +0 %, value +3 %)

### G-473: Mirrored copies can still drift 1 mm at the outer reveal

- Status: Open
- Origin: ADR-205 tests, 2026-11-06; agent found it
- Missing: After Mirror, a front placed by the outer reveal (half-overlay or inset fronts with an odd gap) can sit 1 mm off with the same size. This rounding predates ADR-205; the fuzz therefore accepts reflection within 1 mm and requires exact sizes. ADR-205 promises mirrored copies match to the mm.
- Request: Not asked in words; ADR-205 Decision G-032: mirrored copies match the original to the mm.
- Questions: Make the outer reveal round symmetrically too, which changes the 1 mm position of such fronts in new mirrored copies only?
- Suggested pick: Yes: apply the remainderFirst rounding to the outer reveal, for new mirrored copies only. (estimate: effort +5 %, value +4 %)

### G-475: Client sheet: occasional second page and table at the page edge

- Status: Open
- Origin: ADR-206 tests, 2026-11-06; agent found it
- Missing: The client sheet (Parts > Client sheet) came out as 2 PDF pages on one run; every later run gave 1 page; cause not found. Also, in the 390 px PDF the sheet's table reaches the right page edge.
- Request: Not asked; ADR-206 Done when says the client sheet prints one A4 page.
- Questions: None; it is a bug.
- Suggested pick: Reproduce with tools/prints-exports/find-it.mjs on repeated runs, find the layout race (the sheet prints 50 ms after it is asked for), and give the table a page margin. (estimate: effort +4 %, value +4 %)

### G-476: Mirrored sliding doors are not a mirror image

- Status: Open
- Origin: ADR-205 tests, 2026-11-06; CI found it on PR #188
- Missing: Mirror does not keep sliding doors symmetric: the first sliding door always runs in the front plane and takes the rounding remainder, so a mirrored set of sliding doors differs by 1 mm in two widths and by one door plane. The mirror fuzz test leaves sliding fronts out of its reflection check.
- Request: Not asked in words; ADR-205 Decision G-032: mirrored copies match the original to the mm.
- Questions: Should Mirror also reverse the door planes and the width remainder of a sliding set (a real mirror image), or keep the planes as the design convention?
- Suggested pick: Reverse both for new mirrored copies: widths by remainderFirst, and the plane parity from the right. (estimate: effort +5 %, value +3 %)

### G-482: Real-phone check of the AR grounding, corner and fine-tune work

- Status: Open
- Origin: ADR-213 to ADR-215, 2026-11-07; agent cannot run a real AR session
- Missing: Floor grounding, anchors, shadow, corner placement, fine-tune and dimension labels were tested only with a simulated WebXR, not on a phone.
- Request: Enhance ar corners/floating/accuracy
- Questions: Can you try View in AR on your Android phone after the merge and report what you see?
- Suggested pick: You run it after the deploy and tell Claude; Claude records it in the backlog (estimate: effort +0 % for Claude, value +15 %: the only proof AR works)
- Work: Low
- Impact: Medium-high

### G-484: Start from shows template sizes that differ from the row they sit under

- Status: Open
- Origin: ADR-216, 2026-11-07; agent found it while building G-470
- Missing: Start from now shows each built-in template's description under the catalog row of the same id. For base-door, corner-blind and corner-l the catalog row builds a different piece than the template: 820 mm high (plinth included, buildModel bounds) while the template description says 720 (600 x 720 x 560, 1000 x 720 x 560, 900 x 900 x 720). The desk-pedestal and desk-gables rows build the same piece as their templates, but their summary gives W x H x D (1400 x 750 x 700, 1200 x 750 x 600) while the template text right under it gives W x D x H (1400 x 700 x 750, 1200 x 600 x 750).
- Request: Show them in Start from (user's answer for G-470, 2026-11-07)
- Questions: Should the three template descriptions be changed to the catalog rows' 820 mm height, should the templates' own height change to 820, or should the description stay the template's as built now? Should the two desk texts be written in W x H x D like the summaries?
- Suggested pick: Ask the user; closest to the request is to keep showing the descriptions and make the three texts state the height the row builds (820), read from the catalog piece, and write the desk texts as W x H x D. (estimate: effort +5% of ADR-216, value +5%)
- Work: Low
- Impact: Low-medium

### G-485: Import cycles in core and ui are not broken or linted

- Status: Open
- Origin: ADR-219 Out of scope, 2026-11-07 (architecture review I-01, section 2)
- Missing: ADR-219 enforces layer directions only. The 9-file core cycle around project.ts (arrange, common, compat, connections, groupMove, selection, sizeLock, variables), the shopping/fasteners/prices type cycle and the UI cycles (Dialogs, CountStepper/Inspector, Project/Settings) stay, and no import/no-cycle rule guards them.
- Request: current code structure/architecture modularity and overall design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall be introduced, ensure before and after testing tdd style
- Questions: Should the core cycle be broken (anti-candidate in review section 6: project.ts and its cycle are the model layer) and an import/no-cycle rule added?
- Suggested pick: Break the ui cycles and the shopping type cycle (ADR-236) and keep the project.ts cycle as one unit, closest to the review's anti-candidate note (estimate: effort +15 %, value +5 %)
- Work: Medium
- Impact: Low-medium

### G-486: The CI build job does not cache Vite build output

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
- Origin: ADR-220 Out of scope, 2026-11-07 (architecture review I-02)
- Missing: ADR-220 caches only the type-check state (node_modules/.tmp). The build job still runs a cold vite build; no build or Vitest result cache.
- Request: current code structure/architecture modularity and overall design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall be introduced, ensure before and after testing tdd style
- Questions: Is a build cache worth the risk of a stale bundle in CI?
- Suggested pick: Leave the build cold: CI is the source of truth and a stale bundle is a regression risk (estimate: effort +5 %, value +2 %)
- Work: Low
- Impact: Low

### G-487: The project cut list and hardware are not derived once in the store

- Status: Open
- Origin: ADR-221 Out of scope, 2026-11-07 (architecture review I-03)
- Missing: The review's third step, deriving projectCutlist/projectHardware once in commitProject and storing them, and deriving the view once instead of per mounted useView(), is not built; ADR-221 memoises placeItem and reads projectModel only.
- Request: current code structure/architecture modularity and overall design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall be introduced, ensure before and after testing tdd style
- Questions: Should the derived cut list and hardware move into the store after ADR-221 is measured?
- Suggested pick: Measure after ADR-221; build only if a 60-item edit still takes over 10 ms (estimate: effort +15 %, value +10 %)
- Work: Medium
- Impact: Low-medium

### G-488: Research data is not a generated lazy JSON file

- Status: Open
- Origin: ADR-222 Out of scope, 2026-11-07 (architecture review I-04, section 10 question 5)
- Missing: ADR-222 loads the research data through a dynamic import (a lazy chunk). The review's generated public/research/*.json, which removes the two ?raw edges and changes a data layout (ADR-043 lineage), is not built.
- Request: current code structure/architecture modularity and overall design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall be introduced, ensure before and after testing tdd style
- Questions: Is a generated public/research/*.json an acceptable home for the research data?
- Suggested pick: Keep the lazy chunk; it gives the same first-load saving with no data-layout change (estimate: JSON +25 % effort, +0-5 % value)
- Work: Medium
- Impact: Low

### G-490: Width-independent find-it tests still run at both widths

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
- Origin: ADR-224 Out of scope, 2026-11-07 (architecture review I-06, section 10 question 1)
- Missing: Running find-it tests whose rendered path does not depend on width at one width (about -40 % test CPU) is not built; it amends CLAUDE.md R3 and ADR-108, which stay unchanged.
- Request: current code structure/architecture modularity and overall design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall be introduced, ensure before and after testing tdd style
- Questions: May width-independent find-it tests run at one width (amends R3 and ADR-108)?
- Suggested pick: Keep both widths (R3 and ADR-108 unchanged) until the user decides; the saving is CPU time only (estimate: effort +10 %, value +5 %)
- Work: Low
- Impact: Low-medium
- Conflicts: ADR-108: find-it runs at 390 and 1280 px

### G-491: Diagnostics are still translated inside the model

- Status: Open
- Origin: ADR-225 Out of scope, 2026-11-07 (architecture review I-07, section 10 question 4)
- Missing: Diagnostic { code, params } translated at the edge (messageOf), t() out of the model files, materials labels resolved by the caller, and packages/model are not built; ADR-225 adds only a code field.
- Request: current code structure/architecture modularity and overall design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall be introduced, ensure before and after testing tdd style
- Questions: Accept translate-at-the-edge diagnostics (amends ADR-008 and the ADR-153 translation rule) and a model package?
- Suggested pick: Decide after ADR-225 ships; the code field already lets checks and tests stop keying on text (estimate: effort +60-80 %, value +10 %)
- Work: High
- Impact: Low-medium
- Conflicts: ADR-153: messages are translated where they are written

### G-492: Some checks still match English panel labels

- Status: Open
- Origin: ADR-225 Out of scope, 2026-11-07 (architecture review I-07)
- Missing: Label regexes in clearance.ts, build.ts, shape.ts, replace.ts and assembly.ts that have no panel role or kind field to key on stay as regexes after ADR-225.
- Request: current code structure/architecture modularity and overall design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall be introduced, ensure before and after testing tdd style
- Questions: Should Panel get a role field for every label a check matches (a model-shape change)?
- Suggested pick: Add the role field only where a check needs it, in a follow-up ADR (estimate: effort +20 %, value +5 %)
- Work: Medium
- Impact: Low

### G-494: Nesting is not a workspace package

- Status: Open
- Origin: ADR-228 Out of scope, 2026-11-07 (architecture review I-10, section 6)
- Missing: packages/nesting as a pnpm workspace package with its own tsc and Vitest project is not built; ADR-228 keeps it an internal module with a lint boundary.
- Request: current code structure/architecture modularity and overall design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall be introduced, ensure before and after testing tdd style
- Questions: Is a workspace package worth the extra build and CI setup?
- Suggested pick: Stay internal until a second consumer exists (estimate: effort +25 %, value +2 %)
- Work: Medium
- Impact: Low

### G-498: The design store is not split into slices

- Status: Open
- Origin: ADR-231 Out of scope, 2026-11-07 (architecture review I-13)
- Missing: projectSlice, selectionSlice and viewSlice with commit/commitProject as the only seams are not built; designStore.ts stays one file.
- Request: current code structure/architecture modularity and overall design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall be introduced, ensure before and after testing tdd style
- Questions: Split designStore.ts into slices once ADR-231's helpers are in?
- Suggested pick: Split after ADR-231 if the file is still over 1 500 lines (estimate: effort +20 %, value +3 %)
- Work: Medium
- Impact: Low

### G-499: The whole app, seller catalog included, is precached on first visit

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
- Origin: ADR-234 Out of scope, 2026-11-07 (architecture review I-16, section 10 question 3)
- Missing: Precaching the shell only and runtime-caching the seller catalog and path tracer on first use (first-visit download about -40 %) is not built: ADR-234 keeps offline before first use (ADR-002, ADR-161).
- Request: current code structure/architecture modularity and overall design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall be introduced, ensure before and after testing tdd style
- Questions: Is offline after first use enough for the seller catalog and the path tracer?
- Suggested pick: Keep offline before first use; the budget test stops unplanned growth (estimate: change +10 % effort, -40 % first download, risk: picker empty offline before first use)
- Work: Low
- Impact: Low-medium
- Conflicts: ADR-161: the seller catalog is an offline snapshot

### G-500: App.tsx is one 815-line component with no memoised children

- Status: Open
- Origin: ADR-236 Out of scope, 2026-11-07 (architecture review section 3 and Skipped)
- Missing: Splitting App.tsx (27 store subscriptions, 11 effects) and memo of RoomPlan/Panels are not built.
- Request: current code structure/architecture modularity and overall design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall be introduced, ensure before and after testing tdd style
- Questions: Split App.tsx and memoise the heavy children?
- Suggested pick: Split along the existing pages after ADR-222 makes them lazy (estimate: effort +20 %, value +5 %)
- Work: Medium
- Impact: Low-medium

### G-503: The Gaps page still imports the gaps ledger with ?raw

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
- Origin: ADR-219
- Missing: src/ui/Gaps.tsx imports docs/adr/GAPS.md?raw, outside the three data-loader folders ADR-219 allows; eslint.config.js and tests/core-boundary.test.ts carry it as a named allowance so the tree stays green
- Request: User, 2026-11-07: "No regressions shall be introduced"; ADR-219: ?raw imports outside catalog/brands, sellers and research fail
- Questions: Move the ledger import into a loader under src/core (or generated data) so the allowance can go, or keep the Gaps page's ?raw import as an accepted exception?
- Suggested pick: Keep the allowance until the research data leaves ?raw (review section 6 step 5), then move the ledger the same way: it is closest to ADR-219's rule without a behaviour change now
- Work: Low
- Impact: Low
- Necessity: Low

### G-504: Two find-it checks still read a class on an element found by role

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
- Origin: ADR-224 build, 2026-11-07 (architecture review I-06)
- Missing: tests/find-it/info-tip.test.tsx picks the info buttons among all buttons found by role by their info-btn class, and tests/find-it/editor-nav.test.tsx reads the sheet-open and sheet-full classes on the editor's main area (found by role): an info button has no role or name of its own that sets it apart, and the sheet stop is CSS layout. No querySelector remains.
- Request: current code structure/architecture modularity and overall design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall be introduced, ensure before and after testing tdd style
- Questions: Give InfoTip buttons something users can perceive that sets them apart (for example a shared name prefix already enforced, or aria-haspopup), and assert the sheet stop only through the Resize the sheet slider and the peek's aria-expanded?
- Suggested pick: Keep the two class reads (equal strictness, no change users see) until a role-based marker is chosen (estimate: effort +5 %, value +2 %)
- Work: Low
- Impact: Low

### G-507: Auto-merge not tried on this repo

- Status: Open
- Origin: Flow modes, 2026-11-15
- Missing: The cloud landing path for ff and auto (ready PR plus auto-merge) was never run. Checked 2026-11-15 (enable_pr_auto_merge on PR #219): GitHub answered "Auto-merge is not enabled for this repository"; branch protection is unchecked. Checked again 2026-11-16 on PR #248 (ready, CI green): same answer; the user must turn on Settings → General → Pull Requests → Allow auto-merge. Burst automerge merged #248 by hand instead
- Request: Suggest best approach to include a auto-pilot fast forward and the normal flow.
- Questions: Is Allow auto-merge enabled on the repository, and which checks are required?
- Suggested pick: Enable Allow auto-merge, then test on one ready docs-only PR (estimate: effort +5 %, value +10 %)
- Work: Low
- Impact: Medium
- Necessity: Medium

### G-509: UI audit does not cover 3D, the wizard steps, other dialogs, dark theme or saved-data states

- Status: Open
- Origin: UI flow audit, 2026-11-15 (G-508)
- Missing: Pass 3 (N317) captured the 3D view, the Information and Gaps pages, signed-out Account, Share and Assistant (from a placeholder-backend build), and a seeded project (plan, piece list, Settings, results, room tools): 96 screens, 12,560 texts read for contrast; F-11 and F-18 checked line by line. Still not covered: signed-in Account, making and stopping share links and Assistant replies (need a real account and remote requests), error and repair states in the browser, drag and placement gestures, Move mode, Render and AR export. The Research page no longer exists (#227).
- Request: Apl to explain the ui architecture, layout, placed, screen wiewport on mobile and desktop, components positions ... Full report with details and behaviour of those details in the UIUX perspective to be prepared for a professional architect and the leading auditor company to optimize existing flows.
- Questions: Should a second pass seed saved projects and capture the wizard, Settings, Material, the 3D view and the dark theme?
- Suggested pick: A second capture pass with a seeded project, the wizard steps, Settings, Material and dark theme, plus a citation check of the Reported findings (estimate: effort +40 %, value +30 %)
- Work: Medium
- Impact: Medium
- Necessity: Medium

### G-521: Warnings on the cut sheet: piece, board and hardware names inside a warning stay in the app language

- Status: Open
- Origin: G-516 fix, 2026-11-16 (N324)
- Missing: G-516 prints part labels in the print language. A piece name ({name}), a board name ({board}) and a hardware name inside a warning still print as the app made them: a piece name needs its Design (printPieceName), board and hardware names have no print entries.
- Request: Print each cut-sheet warning in the print language (ADR-265).
- Questions: Should board and hardware names get Romanian, Russian and English print entries (a judgement on names, ADR-010)?
- Suggested pick: Pass the Design with the warning and add print entries for built-in board and hardware names.
- Work: Medium
- Impact: Low
- Necessity: Low

### G-523: Two backlog rows share id N326

- Status: Open
- Origin: Docs session 2026-11-16 (N327)
- Missing: Two backlog rows share id N326 (More menu F-01/F-02 and disabled reasons F-04); ids are never renumbered, so the clash needs the user's decision
- Request: Docs: mark fixed audit findings; F-11
- Questions: Which N326 row keeps the id, or is a new id given to the second?
- Suggested pick: Leave both as they are until the user decides
- Work: Low
- Impact: Low

### G-527: Three more backlog ids shared by two rows

- Status: Open
- Origin: Catch-up 2026-11-17 (N330), skip-review gap 3
- Missing: Backlog ids N164, N281 and N302 are each used by two rows (G-523 covers N326); ids are never renumbered, so the clash needs the user's decision
- Request: Run it (catch-up of the burst debt, all in 1 PR, cover every gap added on the way)
- Questions: Which row keeps each of N164, N281 and N302, or does the second get a new id?
- Suggested pick: Leave the ids as they are and keep the listed exceptions in scripts/check-docs.py until the user decides

### G-529: Main CI red after the navbar change (234f34d)

- Status: Open
- Origin: Catch-up 2026-11-17 (N330), PR #281 CI
- Missing: main commit 234f34d (Simplify the navbar: merge sync into Account, rename to Cut List, move Gaps to Information) made CI red on main: tests/find-it/accounts.test.tsx fails at 1280 and 390 px (no button named Your account, Uploading…, … In your account). The same failure is in PR #281 (test shard 3 and verify) although this PR does not touch it. The browser scripts were verified on d189439, before that commit, and were not re-run against it. Cost: M
- Request: Run it (catch-up of the burst debt, all in 1 PR, cover every gap added on the way)
- Questions: Fix tests/find-it/accounts.test.tsx and the browser scripts for the new navbar in a separate change?
- Suggested pick: Update the accounts find-it test to the merged Account button, then run pnpm regress against main (not built here: the cause is the navbar change, not this pull request)

### G-530: Value cycle build, variables, project in core

- Status: Open
- Origin: architect-review 2026-11-17
- Missing: src/core/build.ts imports ./variables (build.ts:11), variables.ts:22 imports ./project, project.ts:8 imports ./build: a value-import cycle through a model file. ADR-219 and tests/core-boundary.test.ts only block a direct ./project import from model files, so the cycle passes. 20 more value cycles exist (14 around project.ts, i18n/print and ro, 5 in ui, Viewer3D and ViewerScene).
- Request: Recotd to gaps, the fix all items (architect-review run 2026-11-17)
- Questions: Break the cycle in the code (move the shared pieces out of variables.ts) or widen the ADR-219 rule to cover transitive imports?
- Suggested pick: Decide with a new ADR; the model files are build.ts, cabinet.ts and the others listed in eslint.config.js
- Work: Medium
- Impact: Medium
- Necessity: Low-medium

### G-534: Architecture checks the review could not cover

- Status: Open
- Origin: architect-review 2026-11-17
- Missing: Not checked: integer millimetres across the 161 Math.round, floor and trunc calls in src/core (ADR-003); the integer, size and thickness checks in src/core/build.ts above line 150 (ADR-008); the 30000-case fuzz run; the quick-count card exception (ADR-085); the service worker and content security policy; supabase/functions/assistant; runtime lazy mount of the 3D view.
- Request: Recotd to gaps, the fix all items (architect-review run 2026-11-17)
- Questions: None
- Suggested pick: Run each check and record its result in a dated report under docs/research
- Work: Medium
- Impact: Medium
- Necessity: Medium

### G-536: Seller pictures load by default against the written network rule (bug-hunt H-1)

- Status: Open
- Origin: bug-hunt 2026-11-17 H-1, .tmp/current/bug-hunting-report.md
- Missing: CLAUDE.md network rule does not name the ADR-161 seller-picture exception; src/ui/ProductPicker.tsx:56 defaults pictures on
- Request: Reconcile the rule with ADR-161 or change the default to off
- Questions: Keep pictures on by default (ADR-161), or make them opt-in?
- Suggested pick: ADR for the exception, or change the default (user decides)
- Work: Low
- Impact: Medium
- Necessity: Medium

### G-537: Print path does not translate built-in material name 'Worktop 38' (bug-hunt M-1 follow-up)

- Status: Open
- Origin: bug-hunt 2026-11-17 M-1
- Missing: Russian entry added for the UI (data-parts.ts). Print paths still show the English name: src/core/ro.ts:408, src/ui/PrintSheet.tsx:103,301,323, src/core/shopping.ts:162; print.ts:49-53 says print never looks up names
- Request: Translate built-in material names on print
- Questions: Translate built-in names in print and CSV, or keep them as stored?
- Suggested pick: Call-site change across PrintSheet, ro.ts, shopping.ts (user decides)
- Work: Medium
- Impact: Low
- Necessity: Low

### G-539: Russian key conflicts with different wording (reuse H1)

- Status: Open
- Origin: reuse health 2026-11-18 H1, .tmp/current/reuse-hunting-report.md
- Missing: 10 keys defined twice with different Russian values: width (editors.ts:300 vs project.ts:325), More 3D actions (prints.ts:27 vs surfaces.ts:39), and 8 data keys in data-parts, data-catalog, data-wizard
- Request: Pick one Russian wording per key or use @@context keys
- Questions: Which Russian wording for each conflicting key?
- Suggested pick: User picks wording (excluded from the fix)
- Work: Low
- Impact: Low
- Necessity: Low

### G-540: Store and tool helper extractions skipped (reuse M2, M3)

- Status: Open
- Origin: reuse health 2026-11-18 M2, M3
- Missing: M2 createExternalValue not extracted: localStorage bodies differ (useLook width default, module-load reads). M3 find-it variants with failed++, ok:!!ok, ok+detail and string width not unified; closing summary in 4 wordings
- Request: Extract the differing helpers
- Questions: Accept a larger extraction under ADR-016?
- Suggested pick: Decide per helper (user)
- Work: Medium
- Impact: Low
- Necessity: Low

### G-541: Remaining duplicates skipped (reuse L5, L7, B1-B3)

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
- Origin: reuse health 2026-11-18 L5, L7, boundary-blocked
- Missing: L7: assistant.ts isInt and wallfill.ts whole differ from guards.ts; seller origin string in src/online and tools/sellers (tools cannot import src); test picture bases kept literal. B1: Deno assistant function copies cannot import src/. B2 Viewer3D FRONT now uses core panelRoles. B3 tools/sellers pictureExt standalone
- Request: Consolidate where layers allow
- Questions: Allow tools or Deno to import shared code?
- Suggested pick: Keep duplicated (boundary)
- Work: Low
- Impact: Low
- Necessity: Low

### G-542: Picture and row validation on file import and restore (security M-1, M-4)

- Status: Open
- Origin: security health 2026-11-18 M-1, M-4, .tmp/current/security-scan-report.md
- Missing: File pictures stored without decoding or re-encoding (src/persist/images.ts:128); backup restore inserts non-design rows with only a string check (src/core/backup.ts:211-219)
- Request: Route file pictures through the decode/re-encode path; validate rows per table
- Questions: Approach for stricter picture and row validation on import and restore?
- Suggested pick: User approves approach (ADR-011 implication)
- Work: Medium
- Impact: Medium
- Necessity: Medium

### G-543: Hosted Supabase auth settings: confirmations and password length (security M-5)

- Status: Open
- Origin: security health 2026-11-18 M-5
- Missing: supabase/config.toml:227 enable_confirmations=false; line 183 minimum_password_length=6; assistant cost is per account
- Request: Enable confirmations, raise password minimum, add account-independent assistant budget, check hosted project
- Questions: Apply hosted settings in the Supabase dashboard?
- Suggested pick: User decides (hosted change)
- Work: Low
- Impact: Medium
- Necessity: Medium

### G-544: Security low items: migration grants, workflow pins, dev dependency advisories, localhost redirect (security L-2, L-4, L-5, L-6)

- Status: Open
- Origin: security health 2026-11-18 L-2, L-4, L-5, L-6
- Missing: L-2 records write grant (supabase/migrations/20261028000000_accounts.sql:100); L-4 workflow actions pinned to tags and CLI latest (.github/workflows/deploy-assistant.yml:34); L-5 dev-only advisories (see dependency health); L-6 localhost redirect in supabase/config.toml:164
- Request: Route writes through save_record; pin actions to SHAs; upgrade dev deps; remove localhost redirect outside dev
- Questions: Approve migration and workflow changes?
- Suggested pick: User decides per item
- Work: Medium
- Impact: Low
- Necessity: Low

### G-545: Dependency upgrades deferred (health-deps): vitest 4, typescript 7, vite 8, three-mesh-bvh peer

- Status: Open
- Origin: dependency health 2026-11-18, .tmp/current/dependency-report.md and CHANGES
- Missing: vitest 4.1.12 fails seller-pictures BASE_URL expectation (tests/find-it/seller-pictures.test.tsx); typescript 7.0.2 typecheck and build fail (src/core/account.ts:98, tests/helpers/warningKeys.ts compiler API); vite 8.3.8 emits a static import of react-three into the main bundle (tests/bundle-boundary.test.ts, ADR-222); three-gpu-pathtracer 0.0.28 wants three-mesh-bvh >=0.9.17 (installed 0.9.16)
- Request: Fix each blocker, then upgrade
- Questions: Which deferred upgrade should be done next, and does the three-mesh-bvh bump (not approved) go ahead?
- Suggested pick: User decides order
- Work: High
- Impact: Medium
- Necessity: Medium

### G-546: MAX_SHELVES and MAX_DRAWERS have two values (dead-code finding, intent unconfirmed)

- Status: Open
- Origin: cleanup health 2026-11-18, .tmp/current/dead-code-report.md items 2-3
- Missing: src/core/design.ts:755-757 exports MAX_SHELVES=50, MAX_DRAWERS=20; src/core/counts.ts:32-33 has private 12 and 10. Export removed only; values kept
- Request: Confirm which limit each name means, then merge or rename
- Questions: Are these two limits intended to differ (UI slider vs validation)?
- Suggested pick: User decides
- Work: Low
- Impact: Low
- Necessity: Low

### G-547: H1 leftovers: Seating, Sleeping and lying, stored Wardrobe name (context-key pass)

- Status: Open
- Origin: reuse health 2026-11-18 H1, context-key pass
- Missing: FUNCTION_LABEL (src/core/catalog/types.ts:23-24) is stored in designs as catalog.category (src/core/wizard/steps.ts:358-362); stored Wardrobe names (storage.ts:56, registry.ts:136). Plain keys Seating and Sleeping and lying keep two Russian wordings in data-catalog and data-wizard
- Request: Separate stored labels from display labels, then tag
- Questions: Change stored category labels, or keep them as they are?
- Suggested pick: User decides (stored data)
- Work: Medium
- Impact: Low
- Necessity: Low

### G-548: The types.ts and project.ts hubs are not split

- Status: Open
- Origin: ADR-279 Out of scope, 2026-11-19 (Claude, under the user's autopilot)
- Missing: src/core/types.ts (141 importers) and src/core/project.ts (2614 lines, 83 importers) are hubs; a kernel package cannot be cut while every domain imports them
- Request: This repo and architecture structure seems to be way too interdependent
- Questions: Split types.ts by domain, and project.ts into project model, validation and templates?
- Suggested pick: Split types.ts into kernel types plus one type file per domain; split project.ts along its existing projectX siblings (estimate: effort +20 %, value +15 %)
- Work: Medium
- Impact: Medium

### G-549: The other workspace packages are not extracted

- Status: Open
- Origin: ADR-279 Out of scope, 2026-11-19 (Claude, under the user's autopilot)
- Missing: The nesting engine and i18n (ADR-280) are packages. Not extracted, in order: kernel, catalog, model (design, cabinet, desk, build), cutlist, hardware, room, shopping, persist, online, viewer
- Request: Suggest a way to have multiple packages, each managed on its own, which are then reused / used, integrated into the main app with the full functionality
- Questions: One ADR per package in the order above?
- Suggested pick: One ADR per package in the order above, each following the ADR-279 recipe (estimate: effort +10 % per package, value +5 % each)
- Work: High
- Impact: Medium

### G-550: Audit advisories left after dependency health

- Status: Open
- Origin: catch-up 2026-11-19, pnpm audit
- Missing: pnpm audit: 2 critical (tinypool via vitest 3, prototype pollution RCE), 3 moderate (vitest, @vitest/mocker x2). Fix needs vitest 4, blocked by G-545. Also missing from G-545: plugin-react 6.3.0 upgrade
- Request: Upgrade vitest to a patched version, then re-run pnpm audit
- Questions: Do the vitest 4 fix (seller-pictures BASE_URL expectation) now?
- Suggested pick: Fix vitest 4 first
- Work: Medium
- Impact: Medium
- Necessity: Medium

### G-551: N343 find-it marker cannot be met

- Status: Open
- Origin: catch-up 2026-11-19, N343 marker
- Missing: N343 find-it marker is mis-specified: the three-mesh-bvh peer warning (installed 0.9.16, pathtracer wants >=0.9.17) is an install message, not visible UI text. Evidence: pnpm-lock.yaml:2838. 0.9.17 and 0.9.18 exist on npm
- Request: Replace the N343 find-it marker with a lockfile check, or bump three-mesh-bvh
- Questions: Approve the three-mesh-bvh bump to 0.9.18?
- Suggested pick: Ask user to approve the bump
- Work: Low
- Impact: Low
- Necessity: Low

### G-553: Live-verify for the Common thickness picker (N350)

- Status: Open
- Origin: N350, burst 2026-11-19
- Missing: live-verify after merge (find-it paid: tests/find-it/common-thickness.test.tsx)
- Request: Add 16 and 22 mm PAL thickness choices
- Questions: None
- Suggested pick: open the live URL after merge and find "Common thickness (mm)"
- Work: Low
- Impact: Low
- Necessity: Medium

### G-554: Live-verify the i18n package move (N351)

- Status: Open
- Origin: N351, ADR-280, burst 2026-11-19
- Missing: Open the live URL after deploy and switch More › Language to Русский; check a printed sheet is Romanian
- Request: Continue ADR-279 split
- Questions: None
- Suggested pick: Open the live URL after merge and switch the language
- Work: Low
- Impact: Low
- Necessity: Medium

### G-555: Catalog tiles: layout not seen in a browser

- Status: Open
- Origin: N352, user request 2026-11-19 (catalog redesign)
- Missing: live-verify only. Paid 2026-11-20 on the production build (Chromium): `pnpm regress catalog`, `shapes` and `template-revision` pass; 2 columns at 390 px, 4 at 1280 px, no sideways scroll; Wardrobe tiles seen in screenshots. Not done: the published URL
- Request: After deploy, open the live Catalog and find the Wardrobe tiles (picture, name, size; no Add button)
- Questions: none
- Suggested pick: Run pnpm regress when the user asks (browser-on-demand)
- Work: Low
- Impact: Medium
- Necessity: Medium

### G-556: Browser scripts editor-modes and ui-polish fail on main

- Status: Open
- Origin: N352, found by pnpm regress 2026-11-20
- Missing: tools/editor-modes/find-it.mjs fails at 390 px 'places Editor · Cut list visible'; tools/ui-polish/find-it.mjs fails at 390 px 'phone bar shows Furniture Builder', 'brand visible on the Catalog page', 'Projects rows: buttons on the row line'. Both fail the same on the commit before PR 299, so not caused by it
- Request: Repair both scripts or the app, whichever is stale
- Questions: none
- Suggested pick: Repair the scripts against the current UI
- Work: Medium
- Impact: Low
- Necessity: Low

### G-557: Variants for sink-base, desk and chest

- Status: Open
- Origin: ADR-281, user 2026-11-20 (cut from the ADR)
- Missing: No new shipped variants for sink-base, desk and chest: six truly different designs do not exist with today's generators (desk is gables or pedestals only; sink-base and chest differ by count and width)
- Request: Add variants to these three families once a generator capability makes them genuinely different (e.g. new desk or sink options)
- Questions: none
- Suggested pick: Revisit when a new capability lands
- Work: Medium
- Impact: Low
- Necessity: Low

### G-565: Re-encode or sniff pictures inside imported files

- Status: Open
- Origin: Security health check round 1, 2026-11-19 (L-2)
- Missing: src/persist/images.ts:105-135 stores pictures from imported design or project files without matching declared type to bytes and without a picture-count cap (suspicion, not exploited)
- Request: /health-security, loop prompt; user approved Medium only
- Questions: Is a picture-count cap acceptable, and what value (not a physical fact)?
- Suggested pick: Sniff magic bytes and cap the count (Work Medium, Value Low)
- Work: Medium
- Impact: Low
- Necessity: Low

### G-569: Share find-it helpers in tools/lib/harness.mjs

- Status: Open
- Origin: Reuse health check round 1, 2026-11-20 (H4); the user chose to stop the goal loop before it was built
- Missing: 85 tools/_/find-it_.mjs scripts copy noSideScroll (52 files), btn (34), shot (about 61), the closing summary and process.exit (71), pageerror and console collection (76) and the context setup (78); tools/lib/harness.mjs holds only makeChecker, launchBrowser, previewUrl, outDir
- Request: /health-reuse, loop prompt; user picked H4 among the high items, then said to stop the goal after the push
- Questions: Run pnpm regress after each batch (on request only per CLAUDE.md)? How many scripts per batch?
- Suggested pick: Add noSideScroll, btn, shotter, finish and trackErrors to harness.mjs and convert a few scripts at a time (Work High, Value Medium)
- Work: High
- Impact: Medium
- Necessity: Low

### G-570: Reuse findings M1 to M10

- Status: Open
- Origin: Reuse health check round 1, 2026-11-20 (medium)
- Missing: Fastener limits and whole-count rule copied core/UI; counter bounds hard-coded in Inspector; box axis accessors in 7 core files; isTile, hex colour regex and isInt copies; Fill-a-wall and Fill-the-room shared JSX and 4 SVG data-URL helpers; repeated JSX in 5 UI files; ROLE_ORDER copies MATERIAL_ROLES; localStorage try/catch in about 16 files; find-it test setup copies; CSV import preamble copies
- Request: /health-reuse, loop prompt; user approved high items only
- Questions: M3 touches geometry (fuzz required); M8 must not rename storage keys
- Suggested pick: Follow the agent's order: M7, M1, M2, M4, M3 with fuzz, then M5, M6, M8, M9, M10 (Work Medium, Value Low-medium)
- Work: Medium
- Impact: Low-medium
- Necessity: Low

### G-573: Legacy rows and ADRs that fail the 2026-11-20 evidence gates

- Status: Open
- Origin: Retro 2026-11-20 (P4, P10); agent scoped it out: the gates exempt rows below N361/F19/D04 and ADRs numbered below 281
- Note: 2026-11-20 (N362): the backlog part is done. All 86 old Done rows had merge evidence on main (a merged PR or the ADR's ship commit), so they stay Done with that evidence appended, the old wording reads "at build time", every old burst marker names its blocker and cost, and the backlog exemption is gone. Left: the ADR part.
- Note: 2026-11-20 (N363, user pick "Re-check each box"): 22 of the 35 boxes are met by runs today; the per-box record is `docs/research/2026-11-20-g573-adr-box-recheck.md`. The 13 left: ADR-080 popovers close on outside tap or Esc, plan and front view both visible at 390 px in a project, a Width change redraws, a Settings-for change shows after reopening, "not clamped"; ADR-081 the switch in a project, Front removes the canvas; ADR-129 the first-sign-in question; ADR-137 "Save to account"; ADR-142 switch account and back (each needs a new check, cost S); ADR-201 needs the first core-only pull request; ADR-208 needs a browser with a WebGPU adapter, and the user's phones for AR.
- Missing: 22 implemented ADRs with unchecked Done-when items and no G id (ADR-080 7, ADR-081 5, ADR-111, 116, 120, 129-144, 201, 208); implemented ADRs are not edited, so they stay exempt (ADRs numbered below 281)
- Request: User picked 'P4/P10 docs:check gates' from the retro 2026-11-20
- Questions: Statuses change only with evidence: re-verify each row (merged PR, CI run) or turn it Partially done? Which ADR boxes get a G id versus a re-check?
- Suggested pick: Check each row against git log for its merge commit; Done stays only with a merge sha, else Partially done; then drop the legacy cut-off
- Work: Medium
- Impact: Medium
- Necessity: Low-medium

### G-574: CLAUDE.md rules without an incident citation

- Status: Open
- Note: 2026-11-20, user pick "When next changed": a rule gets its citation when it is next changed (the CLAUDE.md rule "Rules cite their incident"); the 8 rules with no incident in the repo wait for the user's reasons.
- Origin: Retro 2026-11-20 (P7); agent scoped it out
- Missing: Existing rules in CLAUDE.md and the skills do not name the incident they answer; the retro traced some (docs/retros/2026-11-20-recurring-patterns.md) and found none in the repo for 8 (translation rule, Gaps page untranslated, feature tree on request, no auto-babysit, sync pending only, regress on request, browser-on-demand, screenshots last)
- Request: User picked 'P7 rules cite incidents' from the retro 2026-11-20
- Questions: Annotate all rules now or as each is next changed? The 8 with no incident in the repo need the user's reason
- Suggested pick: Cite as each rule is next changed (the rule says so); ask the user for the 8 reasons once
- Work: Medium
- Impact: Low-medium
- Necessity: Low

### G-575: Extending and L-corner bookcase not modelled

- Status: Open
- Origin: ADR-282 (user 2026-11-21)
- Missing: Telescoping two-part carcass (60–120 cm) and the L-shaped corner layout of the reference bookcase
- Request: I would like to build a cabinet with a few shelves which are connected between each other with dividers, and they go at random distances
- Questions: Wanted later? How is the sliding overlap fixed?
- Suggested pick: Not now (user answer: 'No, dividers only')
- Work: High
- Impact: Low-medium
- Necessity: Low

### G-576: Staggered rows not refreshed on project-level resizes

- Status: Open
- Origin: ADR-282
- Missing: Staggered rows are rewritten on edits of the piece itself; a width change made from the project (group size, project variable) leaves the rows stale until the piece is next edited, flagged by the stagger-fill check
- Request: configure each span or set a rule for all the shelves to have three types of spans and be able to randomize them
- Questions: Rewrite staggered rows on project-level resizes too?
- Suggested pick: Yes, apply refreshStagger in the project commit
- Work: Low-medium
- Impact: Low-medium
- Necessity: Low-medium

### G-579: Canvas-native editor study: device and user checks not run

- Status: Open
- Origin: Design spec 2026-11-22 (N366)
- Missing: 30 fps orbit on a mid-range phone; 5-user usability test; keyboard docking on iOS Safari installed PWA; multi-select and loading mockups not drawn
- Request: Prompt defaults: fps target, 5-user test, mockups of all states
- Questions: Run them on ADR-283's build or before it?
- Suggested pick: On ADR-283's build (blocker: no device or test users in the session)
- Work: Medium
- Impact: Medium
- Necessity: Medium

### G-581: Stacked fix: live-verify and a real Android device check

- Status: Open
- Origin: N374, PR #315 (2026-11-22)
- Missing: The fix is checked only in Chromium phone emulation on a local build; not on the live URL and not on a real Android phone
- Request: Editing a piece does not allow to move to stacked, nothing happens, android
- Questions: Does the fix behave on the user's phone?
- Suggested pick: After merge, open the live URL on Android: Edit Bookcase › Divide this space › Stacked shows Division with Stacked chosen
- Work: Low
- Impact: Medium
- Necessity: Medium

### G-583: Catalog rework: web research and published spec/prototype skipped

- Status: Open
- Origin: ADR-291, ui-rework steps 3 and 7
- Missing: No 8–12 product research with links, no weighted scoring and doubt rounds, no published spec or interactive prototype; the concept was picked from three previews in a question.
- Request: Ui rework the catalog part, something seems like verybad ui/ux, replace it with something absolutely different, same toggle approach. / Run it, catalog scope is both
- Questions: Run the research and publish the spec now, or accept the pick as made?
- Suggested pick: Accept the pick; run research only if the finder is to become the default
- Work: Medium
- Impact: Low
- Necessity: Low

### G-584: Start from dialog and the Materials seller-band select keep the old layout

- Status: Open
- Origin: ADR-291 scope
- Missing: New › Start from (Catalog.tsx StartFrom) and project Add a piece keep their own grouped list; the Materials dialog still offers seller bands as a select (MaterialDialog.tsx:486), a second band picker.
- Request: Ui rework the catalog part, something seems like verybad ui/ux, replace it with something absolutely different, same toggle approach. / Run it, catalog scope is both
- Questions: Bring Start from and the Materials band select into the finder too?
- Suggested pick: Yes: Start from reuses the finder grid; the Materials select opens the product picker
- Work: Medium
- Impact: Medium
- Necessity: Low-medium

### G-588: Appearance dialog: colours and control height not editable

- Status: Open
- Origin: N378, PR #317, 2026-11-22
- Missing: Colour tokens and --control-h are not in the Appearance dialog: the dark set overrides colours, touch targets stay 44 px (ADR-114)
- Request: Make the entire website variables for theming are cobfigurable in ui, font size, gaps, paddings and other relevant info
- Questions: Should colours be editable per light and dark set? Allow --control-h below 44 px on touch screens?
- Suggested pick: Add editable accent and primary colours for light and dark, keep --control-h fixed
- Work: Medium
- Impact: Medium
- Necessity: Low

### G-589: Phone capture of room, 3D, results, Gaps and Research states

- Status: Open
- Origin: N379 UI review 2026-11-23
- Missing: tools/capture/flows3.mjs at 390 px reaches the phone canvas project, piece list and populated Settings, but piece-selected, room-_, 3d-_, results-parts, copy-code, info and gaps time out after them (stale phone selectors); Research has no entry anywhere. Those departments were reviewed at 1280 px and from code only.
- Request: Scheduled UI review: capture every department at 390 and 1280 px
- Questions: Should the Research capture state be removed, since no Research entry exists in the app?
- Suggested pick: Update flows3 phone steps to the canvas chip rail in the next review run
- Work: Medium
- Impact: Low-medium

### G-591: Room divider: Open both sides on corner units

- Status: Open
- Origin: ADR-292
- Missing: Open both sides (twoFaced) applies to cabinets only; corner units keep front-only banding.
- Request: User 2026-11-24: "unable to create furniture that can be used as room dividers with partial walls on and shelves"
- Questions: Extend twoFaced to blind and L-shape corners?
- Suggested pick: Later: no request for a corner divider yet
- Work: Medium
- Impact: Low
- Necessity: Low

### G-592: Room divider: racking check for back-less pieces

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
- Origin: ADR-292
- Missing: No diagnostic when a tall piece has no back; the height figure is a physical fact not in the repo (ADR-010).
- Request: User 2026-11-24: "unable to create furniture that can be used as room dividers with partial walls on and shelves"
- Questions: Warn above what height?
- Suggested pick: No warning until the user gives a figure (user 2026-11-24)
- Work: Low
- Impact: Medium
- Necessity: Medium

### G-593: Room divider: infill on shelves, drawers or hanging spaces

- Status: Open
- Origin: ADR-293
- Missing: A closed panel (infill) is allowed on Empty cells only.
- Request: User 2026-11-24: "unable to create furniture that can be used as room dividers with partial walls on and shelves"
- Questions: Allow an infill behind shelves or drawers?
- Suggested pick: Later: Empty cells cover the reference piece
- Work: Medium
- Impact: Low
- Necessity: Low

### G-594: Room divider: grooves for an infill panel

- Status: Open
- Origin: ADR-293
- Missing: Infills are fixed between panels with a fixing to choose; no groove option.
- Request: User 2026-11-24: "unable to create furniture that can be used as room dividers with partial walls on and shelves"
- Questions: Offer grooved infills?
- Suggested pick: Later: no request
- Work: Medium
- Impact: Low
- Necessity: Low

### G-595: Room divider: printed rear sheet in the review pack

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
- Origin: ADR-294
- Missing: The Rear elevation is on screen only; the review pack prints the front.
- Request: User 2026-11-24: "unable to create furniture that can be used as room dividers with partial walls on and shelves"
- Questions: Print the rear elevation too?
- Suggested pick: Later: screen first
- Work: Low
- Impact: Low-medium
- Necessity: Low

### G-596: Phone middle-ground editor: device check on a real Android phone

- Status: Open
- Origin: ADR-295, N385
- Missing: The middle-ground panel, 3D counters and drag were checked only in headless Chromium (SwiftShader); no check on the user's Android phone in Chrome
- Request: user 2026-11-26: fix the mobile UI (Android Chrome)
- Questions: none
- Suggested pick: User opens the live URL on the phone after merge and reports
- Work: Low
- Impact: Medium
- Necessity: Medium-high

### G-600: Five browser find-it scripts stale after the navbar change

- Status: Open
- Origin: pnpm regress, catch-up 2026-11-26 (N366 debt): 86 of 94 pass after the harness sheet-editor default
- Missing: tools/gaps and tools/editor-nav look for Gaps in the More menu (moved to Information, 234f34d); tools/ui-polish looks for the Furniture Builder brand mark (dropped, 234f34d) and fails 3 more phone checks (G-556); tools/control-rule waits for a Build & Preview radio that no longer exists; tools/wall-background times out on Add a piece at 390 px after 11 passes. tools/catalog-flows fails only the known G-586 height check. Also, after ADR-295 (phone editor middle ground, no chip rail) merged: tools/catch-up/live-verify.mjs fails at 390 px N373 'the canvas editor shows (Editor actions, Selection path)' and N286 'structure tree follows the selection' (click timeout), on the production preview of main plus N386, 2026-11-26.
- Request: catch up burst debt
- Questions: Repair each script to the current navigation, or retire the ones whose screens were redesigned (ui-polish, control-rule)?
- Suggested pick: Repair gaps, editor-nav and wall-background; retire ui-polish and control-rule checks that the newer scripts cover

### G-601: Project room drawings collapse to 20 px high at short landscape (844x390)

- Status: Open
- Origin: N385 / ADR-295, G-604 check (tools/mobile-middle/find-it.mjs); same on main
- Missing: At 844x390 the work area is 275 px high and split stage/output (max-width 1180 px rule); the stage tools and the place banner leave the plan and front view 20 px each, and the plan's tool row overlaps the output tabs
- Request: User 2026-11-26: the 3D view and controls must fit at 390x844 and 844x390
- Questions: In short landscape, should the output (Cut List) panel leave the stage column, or should the work area scroll with a minimum stage height?
- Suggested pick: Short landscape: give the stage a minimum height and let the work column scroll
- Work: Medium
- Impact: Medium
- Necessity: Medium

### G-602: 3D drag: first frame of a drag is a 52-56 ms long task under SwiftShader

- Status: Open
- Origin: ADR-295, goal runner loop 4 (C8)
- Missing: The pixel-ratio change at drag start resizes the canvas (11 ms) and the pointerdown raycast takes 13 ms; with SwiftShader GPU wait the first drag frame is 52-56 ms in 2 of 3 runs. Average fps target (>=50) is met.
- Request: User 2026-11-26: drag >=50 fps with 4x CPU throttle and no long task >50 ms over a 3 s drag
- Questions: None
- Suggested pick: Draw drag frames into a reduced-size render target allocated once and copied to the canvas, so a drag never resizes the canvas
- Work: Medium
- Impact: Low-medium
- Necessity: Medium

### G-603: 3D view: matrixAutoUpdate off for static meshes

- Status: Acknowledged (2026-11-26)
- Origin: ADR-295, goal runner loop 4
- Missing: updateMatrixWorld still runs each frame (about 0.1 ms); turning it off on r3f-managed meshes risks stale transforms Decided 2026-11-26 under the S-leftover rule: no change, 0.1 ms per frame is worth less than the stale-transform risk.
- Request: ADR-295 decision 9 (drag fix)
- Questions: None
- Suggested pick: Leave until a profile shows it matters
- Work: Low
- Impact: Low
- Necessity: Low

### G-605: 3D drag review leftovers: FloorShadow and press-tracking glue untested, StrictMode twins, thin-line width

- Status: Open
- Origin: ADR-295, code-reviewer re-review of c61d8d0
- Missing: No test for the FloorShadow freeze/thaw, the orbitEvents buttons filter or the Fit press wiring; in dev StrictMode the thin twins are emptied by the simulated unmount; the thin twin is 1 device px while the fat line is 1 CSS px
- Request: User 2026-11-26: review reports no open issues
- Questions: None (touch slop answered 2026-11-26: a wobbling touch tap still selects; built, mouse-only slop)
- Suggested pick: Add jsdom tests for the glue; build twins in an effect
- Work: Low-medium
- Impact: Low
- Necessity: Medium

### G-606: Four diagnostic codes still cover more than one wording

- Status: Acknowledged (2026-11-23)
- Answer (user, 2026-11-23): build every Low-work gap with its suggested pick; this pick keeps it as it is
- Origin: ADR-296 implementation, 2026-11-26 (G-505 remainder)
- Missing: After ADR-296 split outside-room, taller-than-room and room-island, four codes keep more than one wording (SAME_PROBLEM in tests/diagnostic-codes.test.ts): worktop-corner-joint (no joint vs butt joint without the part that runs through), worktop-edge-size (no size vs too large), drawer-low (all drawers vs one box) and corner-size (diagonal, blind and L corner sizes). Splitting them changes what repairs, checks and tests key on.
- Request: G-505: current code structure/architecture modularity ... No regressions shall be introduced, ensure before and after testing tdd style
- Questions: Should any of these four codes be split further?
- Suggested pick: Leave them as one code each: each is one problem said per place (estimate: effort +0 %, value +0 %)
- Work: Low
- Impact: Low
