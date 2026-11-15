# ADR-267: Keep the drawer still: named path, fixed shell, change cue

- Status: Pending
- Date: 2026-11-16
- Depends on: ADR-083, ADR-087, ADR-203, ADR-211
- Design: docs/ui-design.md (section 4, editor screen and phone bottom sheet)
- Backlog: N281
- Acceptance: browser

## Context

User, 2026-11-15: "drawer too dynamic in real life working, keeps changing since we select inner containers on click,
and hard to keep track what and where." A research pass (19 patterns, top 10 ranked; report
`wf-19a02fae-9db1-8ebd-843b-31f3c76542e5`) found that lost orientation is a visibility problem: users cannot see where
the selection sits at the place where they edit. The user then asked for all ten ideas, split over as many ADRs as
needed ("Split them as necessary, cover all"). This is the first of four: ADR-267 (this one), ADR-268 (tree),
ADR-269 (hover, deep select, pin), ADR-270 (enter a container, focus strength).

What the code already has (checked 2026-11-16): the breadcrumb `Crumbs` in `src/ui/Inspector.tsx` names each level by
kind only, so two sibling "Drawers" or two "Divided" look the same; Esc goes up a level (ADR-203); a phone "Up one
level" button (ADR-211); outline-and-fade of the selection (ADR-087); the drawer is already a non-modal side panel on
desktop and a bottom sheet on phones (ADR-079, ADR-211). Those research ideas need no new work.

No change to `src/core/types.ts`, the design document or the Dexie schema (ADR-011, ADR-012).

## Decision

1. **Named path.** New pure `src/core/spaceNames.ts`: `spaceName(root, id)` returns the place of a space among its
   siblings and its kind. Place of a child of an `x` split: `Left`/`Right` for 2, `Left`/`Middle`/`Right` for 3, else
   `Bay {i} of {n}`; of a `y` split: `Top`/`Bottom` for 2, `Top`/`Middle`/`Bottom` for 3, else `Row {i} of {n}`; the
   first level keeps today's root label. Label text `t('{place}: {what}')`. `Crumbs`, the drawer title and
   `selectionLabel` (phone peek row) all use it, so every level on the path has its own name.
2. **Fixed shell.** The drawer head (path, title, size line) stays at the top of `.side-body` while the body scrolls
   (`position: sticky`), on desktop and in the phone sheet. Sections keep one fixed order whatever is selected. Open
   or closed state of each `Group` is remembered per group id in `useUi` (memory only, never storage) and survives a
   change of selection, so a click on another space never refolds what the user opened.
3. **Change cue.** A selection change flashes the drawer head once (300 ms, a background tint; none when
   `prefers-reduced-motion: reduce`). A `role="status"` region with `aria-atomic="true"` in the head says
   `t('Selection changed to {name}')`, debounced 150 ms, so fast tapping announces the last selection only. It never moves
   focus.
4. Texts: every new text has its Russian entry in `src/core/i18n/ru/inspector.ts` (translation rule, ADR-153).

## Alternatives considered

- **Locator thumbnail in the head** — no verified precedent, costs a render per selection; not chosen.
- **Fixed scope tabs (Piece / Space / Part)** — tabs that change meaning on selection add a second hidden state.
- **Stacked parent and child sections** — long drawer, repeats the path.

## Scope

- In scope: `spaceNames.ts` with tests, named crumbs, title and peek row, sticky head, remembered group state, the
  change cue and the status region, Russian entries, find-it script.
- Out of scope: structure tree (ADR-268), hover, deep select and pin (ADR-269), enter-container mode and fade
  strength (ADR-270), a stored (cross-session) group state.

## Consequences

- Positive: every level of the path reads differently; the head does not move; folding stays as the user left it.
- Negative / risks: a long path wraps (it truncates from the left, the current level stays whole); the sticky head
  takes height on a short phone sheet.
- Harder to change later: the place words are user-visible text in two languages.

## Done when

- [ ] `spaceName` gives Left/Middle/Right, Top/Bottom, `Bay i of n` and `Row i of n` for splits of 2, 3 and 4+
      children on both axes (unit tests).
- [ ] Two sibling drawer spaces show different crumb text and title; the phone peek row shows the same name (find-it).
- [ ] The drawer head keeps its position on screen after the body scrolls, at 390 and 1280 px (browser find-it).
- [ ] An opened group stays open after selecting another space and back (store test and find-it).
- [ ] After a selection change the status region reads `Selection changed to …` once (find-it); the tint animation
      is off under reduced motion (browser find-it, computed style).
- [ ] Every new text has a Russian entry (`pnpm typecheck`); `pnpm docs:check` passes.
