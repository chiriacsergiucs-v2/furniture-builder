# ADR-207: Connect pieces with typed and stacked connections and editable assembly steps

- Status: Implemented
- Date: 2026-11-06
- Implemented: 2026-11-06
- Depends on: ADR-069, ADR-111, ADR-168, ADR-174, ADR-185, ADR-190
- Design: docs/ui-design.md (§4 Screens: project selected-items card, plan; Build & Preview results, Assembly tab)
- Backlog: N212
- Acceptance: browser

## Context

User (2026-11-06): "Do the same for next 50 gaps with no questions, same split/grouping for batches, add to this pr
the created adrs, no implementation yet. Exclude any Online service or account sync ones." The user accepted the
gaps' suggested picks for the first 50 gaps and asked for the same here, so each gap's Suggested pick below is the
decision. Requests: G-007 "Verify, then Quick wins, then Medium effort", later "guided snapping" and "cross-family
composition"; G-329 "Validate all High demand features … create adrs"; G-331 (not a quote) record, re-check and move
together; G-354 "Add the possibility to have a common bottom or top between multiple items."; G-352 "Re-check
assembly steps, both ui and pdf, they seem to not have the expected assembly relevant info and steps."; G-344 "Ordered
step list + 3D highlight"; G-136 "change to 1 changes all the other, including internal, and it should be propagated
further to the ones in the 100% same"; G-404 "Duplicate, mirror and predictable rotate operations".

Change control: ADR-168 stores untyped side-by-side pairs; this ADR adds a kind, and an absent kind stays a side
connection. [ADR-190](../adr-done/ADR-190-neighbours-share-one-side-panel.md) shares sides between cabinets only and
names corners and desks for a later ADR (G-354); this ADR extends it and leaves cabinet pairs as built. ADR-069's
refusal to mirror the lounger and daybed ("left open") is replaced by a stored end. Nothing invents a fixing, load or
drilling value (ADR-010). Documents change (ADR-011): ADR-204/205/206 already plan project 21, design 9 and template
3, so this ADR takes the next free numbers, **project 22, design 10, template 4** (renumbered up if those move).

## Decision

1. **Typed connections (G-007, G-329).** `Connection.kind?: 'side' | 'corner' | 'stacked' | 'wall'` (absent =
   side); a wall connection holds one item id and `wall` (index of `room.outline`). Each kind has its own check in
   `connectionCheck`: **side** as ADR-168; **corner**, two pieces turned a quarter apart whose plan outlines share an
   edge and whose heights overlap; **stacked** (G-331), one piece over another: an `above` placement on it, or a
   wall unit whose plan outline overlaps a floor piece's and whose underside is at or above its top; **wall**, the
   piece's back lies on that wall, within its length. Rules get `CompatRule.joins?: kinds` (absent = side, so every
   rule of ADR-100 keeps applying to side joins exactly as today); `same-mount` also runs on corner joins.
2. **Made, moved, mirrored, merged.** A snap that lands a piece in any of these positions makes the connection
   (ADR-168's step); **Connected** picks the kind the check finds (side, corner, stacked), and a new **Against the
   wall** toggle on the single-piece card makes a wall connection. The connected set moves as one (stacked pieces
   keep their height); a wall-connected piece slides along its wall; Alt moves alone and disconnects at drop.
   **Mirror a run** takes stacked-connected pieces too. **Merge** (ADR-047) gives the merged pieces' other
   connections to the new piece. `connection-broken` names the kind's reason. **Connected to:** lists each name with
   its kind (side by side, in the corner, stacked, against wall {n}); corner seams draw as side seams do (ADR-179).
3. **Shared sides with blind corners and desks (G-354).** `sharedSideCheck` also accepts a blind corner unit at its
   straight end (the end away from `side`) and a desk at a gable end, with ADR-190's other conditions (a desk's depth
   is its gable depth, its plinth 0). A blind corner follows ADR-190 (the right member's side is shared). A desk
   gable stops under the worktop, so with a desk the cabinet's side is always the shared one and the desk drops its
   gable (`omitGable`); desk with desk is refused. L-shape and diagonal corners and pedestal ends are refused with
   the reason (G-421).
4. **Fit hardware lights its panels (G-352).** `HardwareItem.panelIds?` (model only, not saved): the generators tag
   each hinge with the side or divider its plates fix to and each runner pair with the two panels of its opening.
   `stepLitIds` adds them for the carcass and plate halves, so **Fit hardware to the sides** gets **Show step**.
5. **Editable steps (G-344).** `Design.assembly?: { order: StepId[]; names?: Partial<Record<StepId, string>> }`.
   Each step gets **Move step up**, **Move step down** and **Rename step**; each piece **Reset the steps** (deletes
   the field). Steps the order does not name keep their generated place after their generated predecessor; unknown
   ids are ignored; an empty name restores the generated title. App and print use the same order and the user's
   names as typed; the guidance line stays (ADR-174). One undo step each; linked copies share it (ADR-111).
6. **Link identical pieces (G-136).** `sameDesign(a, b)` in `linked.ts`: equal after ignoring the design id and
   renumbering every other id in order of appearance. The card shows **Link {n} identical pieces** when other pieces
   are identical and not in its link group; a tap gives them all one `linkId` (link groups that join take it too),
   one undo step. No schema change (ADR-111's field).
7. **Lounger and daybed ends (G-404).** `backrest.end?` and `bed.sidePanelEnd?` (`'right'`; absent = left). The
   generators build at that end, `mirrorDesign` swaps it, and the frame editor gets **Backrest end** and **Side
   panel end** (Left, Right). The two "cannot be mirrored yet" refusals are deleted with their translations. Gesture
   check (code read 2026-11-06): Shift/Ctrl-click and the **Select** toggle select several pieces in every view
   (ADR-097, ADR-159); long-press does not exist and is not added (G-423).

**Documents (ADR-011).** Project 22: connection `kind` and `wall`. Design 10: `assembly`, `end`, `sidePanelEnd`.
Template 4: connection `kind` and `wall` (a wall connection to a wall the target room lacks is dropped on insert, in
the notice). Older versions load unchanged; the new fields in an older version are invalid. No saved file is
rewritten; no Dexie version.

**Texts.** `t()` with `ru/<area>.ts` entries: kind names, Against the wall, the new check reasons and refusals
(the widened "{name} is not a cabinet, a blind corner unit or a desk."), the four step buttons, Link {n} identical
pieces, Backrest end, Side panel end. No new `pt()` text. `features.ts` gains a line per item (ADR-158).

## Alternatives considered

- **Derive kinds from geometry each build** — two pieces placed near by chance would count as joined (ADR-168).
- **Desk gable shared like a cabinet side** — a gable ends under the worktop and cannot carry a cabinet's top.
- **Link identical pieces on Duplicate** — G-136's pick is the card action, closest to "the 100% same".

## Scope

- In scope: items 1–7, store actions, tests, a 30,000-run fuzz, the browser find-it.
- Out of scope: run parts reading connections (G-420); L-shape and diagonal corners and desk pedestal ends sharing a
  side (G-421); merging assembly steps (G-422); a long-press gesture (G-423); connector authoring (G-424).

## Consequences

- Positive: a wall unit moves and mirrors with its base; the card says why pieces move together; a corner unit or
  desk saves a board; the sequence is the user's own.
- Negative / risks: connected rows move as larger blocks (Alt frees one); three schema bumps.
- Harder to change later: the connection kinds and the stored step order.

## Done when

- [x] Each kind's check accepts its case and names the reason otherwise; a snap makes side, corner, stacked and wall
      connections; ADR-100 rules run on side joins as before (tests).
- [x] Moving a base carries its stacked wall unit, a wall connection slides along its wall, Alt frees; Mirror a run
      takes stacked pieces; Merge keeps the others' connections; `connection-broken` per kind (store tests, fuzz).
- [x] Project 20–21, design 8–9 and template 2–3 files load unchanged; project 22, design 10 and template 4 validate
      the new fields (tests).
- [x] A blind corner beside a cabinet and a desk beside a cabinet each give one side less with outlines unchanged;
      L-shape, pedestal end and desk with desk are refused with the reason (`tests/shared-sides.test.ts`).
- [x] Fit hardware to the sides lights the hinge side and both runner sides; a moved and renamed step shows in the
      tab and the print, and Reset restores the generated steps (tests).
- [x] Link 3 identical pieces links all three; a lounger and a daybed mirror to the right end and back (tests).
- [x] `tools/connections-typed/find-it.mjs` passes on the production build at 390 and 1280 px: **Against the wall**,
      **stacked**, **Link 2 identical pieces**, **Move step up**, **Reset the steps**, **Show step** on Fit hardware
      lighting 3D, **Backrest end**; no page errors.
- [x] Every new text has its `t()` entry, deleted texts lose theirs, and all CI checks pass.
