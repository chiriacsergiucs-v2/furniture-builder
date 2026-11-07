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

### G-041: ADR-076 models list

- Status: Open
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
- Note: 2026-11-06: ADR-212 shipped without this item; recording the separate Project.models list as the decision (a ledger edit) was skipped, so the gap is open again.

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

- Status: ADR-216
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

### G-470: Built-in template descriptions are shown nowhere in the app

- Status: ADR-216
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

### G-473: Mirrored copies can still drift 1 mm at the outer reveal

- Status: Open
- Origin: ADR-205 tests, 2026-11-06; agent found it
- Missing: After Mirror, a front placed by the outer reveal (half-overlay or inset fronts with an odd gap) can sit 1 mm off with the same size. This rounding predates ADR-205; the fuzz therefore accepts reflection within 1 mm and requires exact sizes. ADR-205 promises mirrored copies match to the mm.
- Request: Not asked in words; ADR-205 Decision G-032: mirrored copies match the original to the mm.
- Questions: Make the outer reveal round symmetrically too, which changes the 1 mm position of such fronts in new mirrored copies only?
- Suggested pick: Yes: apply the remainderFirst rounding to the outer reveal, for new mirrored copies only. (estimate: effort +5 %, value +4 %)

### G-474: Settings dialog scrolls sideways at 375 and 390 px

- Status: Open
- Origin: ADR-202 tests, 2026-11-06; agent found it
- Missing: At 375 and 390 px the Settings dialog itself scrolls sideways by 32 to 37 px; the page does not. Cause: the piece-size Depth field (.dims3 .mm.with-trailing, from commit a617fac0). Not caused by ADR-202, so not fixed.
- Request: Not asked; CLAUDE.md rule: no horizontal scroll at 390 px.
- Questions: None; it is a bug.
- Suggested pick: Let the Depth field shrink in the three-column size row so the dialog fits at 375 px. (estimate: effort +2 %, value +4 %)

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

### G-477: AR corner snap does not detect walls automatically

- Status: Open
- Origin: ADR-214, 2026-11-07
- Missing: The room corner is set by two floor taps; walls are not found from WebXR wall hits.
- Request: Enhance ar corners/floating/accuracy
- Questions: Add automatic wall detection with the two-tap fallback?
- Suggested pick: Leave it out until the two-tap snap is tried on a phone (estimate: work +60 %, value +5 %: plain walls are often not detected)
- Work: Medium-high
- Impact: Low

### G-478: AR corner snap has no wall gap or skirting offset

- Status: Open
- Origin: ADR-214, 2026-11-07
- Missing: In a room corner the furniture's back and side touch the tapped lines exactly; no gap for skirting boards or uneven walls.
- Request: Enhance ar corners/floating/accuracy
- Questions: Should corner snap leave a gap from the walls, and how many mm?
- Suggested pick: Use the fine-tune buttons (ADR-215) to move it off the wall; add an offset only if you ask (estimate: work +5 %, value +5 %)
- Work: Low
- Impact: Low

### G-479: AR has no depth occlusion or light estimation

- Status: Open
- Origin: ADR-213, 2026-11-07
- Missing: Real objects in front of the AR furniture do not hide it, and its lighting does not follow the room's light.
- Request: Enhance ar corners/floating/accuracy
- Questions: Add WebXR depth-sensing occlusion and light-estimation where the phone offers them?
- Suggested pick: Leave out for now (estimate: work +80 %, value +10 %; few phones offer depth sensing in the browser)
- Work: High
- Impact: Low-medium

### G-480: AR has no finger drag to move the furniture

- Status: Open
- Origin: ADR-215, 2026-11-07
- Missing: After placing, the furniture moves only with the 1 cm / 10 cm buttons, not by dragging it across the floor.
- Request: Enhance ar corners/floating/accuracy
- Questions: Add one-finger drag on top of the buttons?
- Suggested pick: Leave out (user picked buttons only, 2026-11-07; estimate: work +45 %, value +10 %)
- Work: Medium
- Impact: Low

### G-481: AR shows only overall dimensions, not per piece

- Status: Open
- Origin: ADR-215, 2026-11-07
- Missing: In a project, AR labels only the overall W x H x D of everything shown, not each piece.
- Request: Enhance ar corners/floating/accuracy
- Questions: Add per-piece dimension labels in AR?
- Suggested pick: Leave out (user picked overall W x H x D, 2026-11-07; estimate: work +30 %, value +10 %)
- Work: Medium
- Impact: Low

### G-482: Real-phone check of the AR grounding, corner and fine-tune work

- Status: Open
- Origin: ADR-213 to ADR-215, 2026-11-07; agent cannot run a real AR session
- Missing: Floor grounding, anchors, shadow, corner placement, fine-tune and dimension labels were tested only with a simulated WebXR, not on a phone.
- Request: Enhance ar corners/floating/accuracy
- Questions: Can you try View in AR on your Android phone after the merge and report what you see?
- Suggested pick: You run it after the deploy and tell Claude; Claude records it in the backlog (estimate: effort +0 % for Claude, value +15 %: the only proof AR works)
- Work: Low
- Impact: Medium-high

### G-483: Catalog cards: meta line still cut on most cards at 390 px

- Status: Acknowledged (2026-11-07)
- Origin: ADR-195 item 4, built 2026-11-06 (implementer could not meet the Done-when item; user not yet asked)
- Missing: Done-when 'At 390 px under 30 % of cards show More' is not met. With Open under the picture (column 1, rows 3–4) the text column is 214 px at 390 px (281 px at 1280), not the ≈240 px the ADR estimated, and the meta line (kind chip + size · parts · checks) needs 272 px at the median and 292 px at the 70th percentile (measured by tools/catalog-flows/find-it.mjs on the production build). Result: 178 of 183 cards (97.3 %) still show More at 390 px (was 182), 91 of 183 at 1280 px (was 98). The page stays under 30 000 px (29 734 px) and every card keeps one meta line.
- Request: Nearly every card is cut … Fix: Open under the picture (column 1, rows 3–4): ≈240 px for text, same height, one meta line (ADR-118), 'More' where still cut. Done when: At 390 px under 30 % of cards show 'More'; the page stays under 30 000 px; one meta line per card.
- Questions: Which change brings the meta line under ≈214 px: (a) a shorter facts line (for example size without ' mm' and the parts count moved to More), (b) the meta line on its own row under the picture and Open (the ADR's rejected alternative, ≈+24 px per card, page over 30 000 px), or (c) a smaller kind chip (no border, shorter words)? Or should the 30 % target change?
- Suggested pick: (a) a shorter facts line: closest to the request (readable cards at the same height, under 30 000 px) — estimate +10 % work on ADR-195, delivers the remaining ≈30 % of item 4's value; needs a new measurement to confirm it reaches under 30 %. (b) keeps every word but breaks the 30 000 px limit.
- Fix: User decision 2026-11-07: "Accept 73.8%, ship". Shipped with a 96 × 34 picture and the shortened meta line (kind chip, size without " mm", parts, checks; "default" on the picture): 135 of 183 cards (73.8 %) show More at 390 px, 39 of 183 (21.3 %) at 1280 px; page 29 772 px; one meta line per card.

### G-484: Start from shows template sizes that differ from the row they sit under

- Status: Open
- Origin: ADR-216, 2026-11-07; agent found it while building G-470
- Missing: Start from now shows each built-in template's description under the catalog row of the same id. For base-door, corner-blind and corner-l the catalog row builds a different piece than the template: 820 mm high (plinth included, buildModel bounds) while the template description says 720 (600 x 720 x 560, 1000 x 720 x 560, 900 x 900 x 720). The desk-pedestal and desk-gables rows build the same piece as their templates, but their summary gives W x H x D (1400 x 750 x 700, 1200 x 750 x 600) while the template text right under it gives W x D x H (1400 x 700 x 750, 1200 x 600 x 750).
- Request: Show them in Start from (user's answer for G-470, 2026-11-07)
- Questions: Should the three template descriptions be changed to the catalog rows' 820 mm height, should the templates' own height change to 820, or should the description stay the template's as built now? Should the two desk texts be written in W x H x D like the summaries?
- Suggested pick: Ask the user; closest to the request is to keep showing the descriptions and make the three texts state the height the row builds (820), read from the catalog piece, and write the desk texts as W x H x D. (estimate: effort +5% of ADR-216, value +5%)
- Work: Low
- Impact: Low-medium
