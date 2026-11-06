# ADR-193: Fix the Start something new, Fill a wall and Fill the room flows

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-008, ADR-078, ADR-103, ADR-104, ADR-153, ADR-173, ADR-177
- Design: docs/ui-design.md (section 4, Screens: dialogs and wizards)
- Backlog: N198
- Acceptance: browser

## Context

Critique of More → New… ("Start something new", Start from), Fill a wall and Fill the room; the New-piece wizard is
excluded (ADR-191). Code read of `src/ui/Dialogs.tsx`, `WallFill.tsx`, `RoomFill.tsx`, `ProductPicker.tsx`,
`src/core/wallfill.ts`, `roomfill.ts`; vitest probes; Playwright screenshots of the production build at 390 and
1280 px. User's request: "Split the entire app into domains or flows … critique of design … 1 adr with high and
medium issues and fixes per flow".

## Decision

1. **Every default room mix carries ~19 warnings (High).** For the default 3600 × 3000 room each card says "Door of
   Wall blind corner cannot open fully: it hits Tall cabinet …" ×3 "and 16 more": auto tall position (= left) puts
   the tall cabinet against the corner cabinet; `tallPosition: 'right'` gives 4. Fix: on auto, `suggestRoomMixes`
   tries the tall cabinet at both ends of each stretch (two signatures) and ADR-173's "fewest warnings" ranking
   picks the clear side. Fill a wall keeps ADR-103's auto.
2. **A wrong room size is never named (High).** Width "abc", 0 or −100 passes Next: Walls lists "Wall 1, NaN mm",
   Suggestions says "Wall 1 has no stretch … Every mix tried had a problem (6 tried)" (`checkRoom` checks walls and
   heights only). Fix: `checkRoomSizes` in `src/core/room.ts` (each size a whole mm above 0; cut and offset inside
   the room), run by `checkRoom` and on Next, which stays on Room and lists the errors (`role="alert"`,
   `aria-invalid` on the field); a diagnostic, never a clamp (ADR-008).
3. **Fill a wall reports input problems a step late, as status (Medium).** Width "abc" + Show suggestions opens
   Suggestions headed "ABC MM WALL · BEST 4", the error has `role="status"`, no field is marked, Enter does nothing
   (no form). Fix: each step is a `<form>` whose submit is the primary button; `checkWall` errors keep the user on
   the step, under the fields (`role="alert"`, `aria-invalid` + `aria-describedby`); the header shows the applied
   number only. Same in Fill the room.
4. **Step jumps leave Suggestions blank or stale (Medium).** Room → step "Refine" → Back shows only the footer
   (`result` null); in Fill a wall the same path shows cards for the 3000 mm default, not the typed width (`applied`
   starts as `START`). Fix: `applied` starts null in both; reaching Suggestions with nothing applied runs
   `suggest()`; the step counts as done only once applied.
5. **Ticked walls survive a shape change (Medium).** `walls` state outlives `form.shape`: U (8) → Rectangle (4)
   keeps indices 4–7, so Suggestions says "A ticked wall is not a wall of this room." while every box shown is
   ticked; Rectangle → L leaves the new walls unticked against the hint. Fix: a shape change resets `walls` to null.
6. **Fill the room never asks the cabinet depth before the cards (Medium).** Depth 560 and Tall cabinet depth sit
   in Refine; Fill a wall asks them first and ADR-173 puts "the heights of ADR-103's Wall step" on the Room step.
   Fix: both fields move to the Walls step (typed room and project room alike) under a "Cabinets" title.
7. **"Project with several pieces" hides a failed save (Medium).** `Dialogs.tsx` does `void saveProject(p)` and
   opens the project; a storage failure is silent (autosave runs only at the first change, App.tsx:415), while Fill
   a wall shows "The project could not be saved in this browser's storage." Fix: await in try/catch, show that alert
   in the dialog, open nothing, as Fill a wall does.
8. **The wizard footer overflows the dialog body on phones (Medium).** `.wizard-footer` margins and `bottom` use
   `--s-5` (20 px) while under 760 px the body padding is `--s-4` (16 px): at 390 px `.dialog-body` scrollWidth 358 >
   clientWidth 354 (measured), so the body scrolls sideways. Fix: the 760 px media query sets them to `--s-4`.
9. **Copy (Medium).** The Room hint shows "(ADR-059)" (RoomFill.tsx:301, ru viewer.ts:267); room card summaries
   start "wall 1: …" under labels "Wall 1:"; "checked by the model / as a project" is jargon. Fix: drop the id,
   capitalise "Wall {n}:", header "{w} mm wall · best {n}, each checked for problems".
   Every text added or changed gets its Russian entry (ADR-153).

## Alternatives considered

- **Default tall position right in room fill (1)** — right at one corner, wrong at the other.
- **Filter stale wall indices (5)** — hides the error but keeps new walls unticked, against the hint.
- **Depth fields on the Room step (6)** — skipped for a project's room, so the depth stays hidden.
- **Open the project after a failed save (7)** — the alert would sit in a closed dialog; the user works unsaved.

## Scope

- In scope: the fixes above, their tests (wallfill, roomfill, room), a jsdom find-it test
  (tests/find-it/start-new.test.tsx, 390 and 1280 px: New… rows, bad width, bad room size, shape change, Use this mix).
- Not changed: the seller ProductPicker (ADR-161); no High or Medium finding.
- Out of scope: the identical 'project' glyph on the Project, Fill a wall and Fill the room rows (Low) (G-358).
- Out of scope: Start from listing 108 items inside the phone dialog (settled, ADR-078 and ADR-120; G-116 to G-127).

## Consequences

- Positive: room mixes without a wall of corner-door warnings; wrong sizes named where typed; no blank or stale
  step; no sideways scroll; a failed save is never silent.
- Negative / risks: two tall signatures per stretch double the candidate lists (bounded by PER_STRETCH and
  MAX_BUILDS; the 4-wall default must stay under 100 ms); roomfill tests that count warnings change.

## Done when

- [x] Default room (3600 × 3000, 4 walls): first card ≤ 4 warnings; `tallPosition: 'left'` still obeyed.
- [x] Room width "abc", "0", "-100": Next stays on Room with an alert naming the field; no "NaN mm" anywhere.
- [x] Fill a wall width "abc" + Enter: stays on Wall, alert under the field, `aria-invalid`; header never echoes it.
- [x] Room → Refine → Back and Wall → Refine → Back show cards for the typed values; never a blank step.
- [x] U → Rectangle → Show suggestions gives cards; Rectangle → L shows 6 ticked walls.
- [x] Walls step shows Depth and Tall cabinet depth for a typed room and for a project's room.
- [x] A rejected `saveProject` in "Project with several pieces" shows the alert and opens nothing.
- [x] At 390 px `.dialog-body` scrollWidth equals clientWidth; no "(ADR-059)"; ru entries updated; find-it passes
      at 390 and 1280 px; typecheck, lint, test, build and docs:check pass.

## Implementation evidence

Ran locally on branch `adr-193-start-new-fill-flows`, 2026-11-06. Not merged, not deployed, not live-verified.

- Item 1: `suggestRoomMixes` on auto gives each stretch's one-tall candidates a twin with the tall at the right end
  (`tallAtRight`, signature `…|right`). Starting from the best combination with every tall on the left, each stretch in
  turn moves its tall right and keeps it when the room has fewer warnings. The kept side's candidates come first in
  each list, the other side's after them (lists up to 2 × `PER_STRETCH`). The first 4 combinations alone are not
  enough for the "fewest warnings" ranking to find the clear side, so the side is chosen this way. Each combination
  is built once (a per-call memo of pieces and footprints), which keeps the default room fast. Default room:
  first card 4 warnings (it was 19); `tallPosition: 'left'` gives no `|right` key. Fill a wall is unchanged.
- Item 2: `checkRoomSizes` (`src/core/room.ts`), run by `checkRoom` (with a ready shape) and when leaving the Room
  step (Next or a step tab). Each problem carries its `field`.
- Item 3: both wizards are a `<form>` whose submit is the step's primary button. `checkWall` / `checkRoom` errors
  stay on the step as `role="alert"` under the fields; the field gets `aria-invalid` and `aria-describedby`.
  `checkWall` problems now name their `field`. The header shows `toInput(applied).width`, a number.
- Item 4: `applied` starts null in both. Back from Refine with nothing applied runs `suggest()`; Walls (room) and
  Wall (wall) count as done only once something is applied.
- Item 5: a shape change resets `walls` to null. Item 6: Depth and Tall cabinet depth sit on the Walls step under
  "Cabinets", for a typed room and for a project's room.
- Item 7: `NewDialog` awaits `saveProject` in try/catch; on failure it shows the storage alert and opens nothing. A
  second tap while it saves does nothing, and the alert is gone when the dialog opens again (code review).
- Item 8: under 760 px the `.wizard-footer` side margins and padding are `--s-4`. The vertical offsets stay `--s-5`,
  because the dialog body's bottom padding stays `--s-5` at that width (only its side padding changes). Measured:
  `.dialog-body` scrollWidth equals clientWidth at 390 px.
- Item 9: "(ADR-059)" dropped; room summaries "Wall {n}: …"; headers "{w} mm wall · best {n}, each checked for
  problems" and "{n} walls · best {k}, each checked for problems". Russian entries added, changed or removed.
- Checks: `tests/roomfill.test.ts`, `tests/room.test.ts`, `tests/wallfill.test.ts`: 60/60, including the default
  room ≤ 4 warnings, `left` obeyed, warm run under 100 ms (fastest of 3), sizes named. `tests/find-it/start-new.test.tsx`
  (jsdom, 390 and 1280 px): 6/6. Browser: `node tools/start-new/find-it.mjs` on `pnpm build` + `pnpm preview`
  (Chromium, 390 × 844 and 1280 × 900): 48 checks passed. `FUZZ_N=30000` fuzz 4/4. lint, format:check,
  typecheck, build and docs:check pass; `pnpm test` 1219 passed (1 skipped).
- Gaps found while building: G-372 (the default L and U rooms give no mix, before and after this ADR) and G-373 (the
  start Cut offset 0 is rejected for U and Alcove by the new size check).
