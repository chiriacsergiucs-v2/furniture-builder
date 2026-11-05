# ADR-194: Fix the eight remaining findings of the New-piece wizard

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-044, ADR-045, ADR-046, ADR-118, ADR-164, ADR-191
- Design: docs/ui-design.md (New-piece wizard)
- Backlog: N199

## Context

Critique of `src/ui/Wizard.tsx` and `src/core/wizard/*` after ADR-191: code read, engine probes in Vitest, production
build screenshots at 390 and 1280 px (Type, Size, Dividers, Contents, Doors, Review). The user asked: "Split the entire
app into domains or flows … critique of design … 1 adr with high and medium issues and fixes per flow". G-356 and
G-357 stay as they are.

## Decision

1. **A card freezes every default as an answer (High).** `suggestions()` builds `answers` on `resolve(a)` (suggest.ts
   ~l.95), so "Use this" stores 31 keys; probe: Cabinet → card → Type → Wardrobe keeps name "Cabinet", 800 × 450, and
   the Size help ("sizes and name follow the type") becomes false. Fix: a card's `answers` are the user's `a` plus only
   the keys its axes `writes` (checked on the resolved candidate as now).
2. **Reopening a decor-board piece warns falsely and blocks (High).** `edited` is computed once at mount
   (Wizard.tsx `useState(() => editedSinceWizard(from))`) before `listDecors()` resolves, and `setWizardBoards`
   passes `null` for the piece; probe: `edited` true and "Board: choose one of the options." until decors load, for
   good once the decor left the list. Fix: offer the reopened piece's own boards (`boardChoices(project, from,
decors)`, a stored `decor:` answer resolved to the own board by `materialKey`) and compute `edited` from
   `boardsVersion()` after the boards are set.
3. **Type-step footer wraps at 390 px (Medium).** Measured: Back and "Use Cabinet (closed box)" on one row, Next
   alone at the left of a second row; Russian "Взять Шкаф (закрытый корпус)" is longer. Fix: at ≤ 760 px the footer
   is a two-row grid, Back | Next first and the defaults button full width under them (CSS `order`; DOM order
   Back, defaults, Next stays, ADR-118).
4. **"Use Cabinet (closed box)" with another type chosen (Medium).** `next(false)` keeps `a.type` when set
   (Wizard.tsx `b = a.type ? a : withType(...)`): with Bed chosen the button keeps Bed. Fix: on the Type step the
   defaults button shows only while no type is chosen.
5. **Cards: six buttons named "Use this"; warnings unreachable (Medium).** Every card button has the same name and
   the badge's text is a `title` tooltip with no message, while wall-fill cards (ADR-103, `.wf-warnings`) list theirs.
   Fix: `aria-label` "Use this: {label}" and the warning messages listed under the badge as in wall fill; the label
   row keeps the button aligned across cards (1280 px: a badge pushes its button down).
6. **Int fields report errors away from the field (Medium).** `IntInput` has no `aria-invalid`, `aria-describedby`
   or `.invalid`; the error sits in the list under all fields, unlike every `MmField` (`.field-error` under the box).
   Fix: `IntInput` takes the step's problem whose `field` is its id and renders it as `.field-error` with
   `aria-invalid`/`aria-describedby`; the step list keeps only problems without a field.
7. **Keyboard and screen reader (Medium).** Measured: every compartment's counter reads "Fewer shelves"/"More
   shelves"; the type radios are 7 tab stops with no arrow keys; after the last Next the button unmounts and focus
   falls to `body`; a new step is not announced. Fix: `Counter` gets a `name` prop (as `Toggle`, ADR-112) set to
   "Shelves in compartment {n}"; `go()` focuses the step heading (`tabIndex=-1`); the type radiogroup gets a roving
   tabindex with arrow keys.
8. **"Start blank" does not start blank (Medium).** It calls `next(true)`: keeps every answer and continues (ADR-045
   behaviour); Russian "Начать с нуля" says the opposite. Fix (user answer 2026-11-05): rename it "Continue by hand"
   (Russian "Продолжить вручную"); the behaviour stays.

Every text added or changed gets its Russian entry (ADR-153).

## Alternatives considered

- **Strip values equal to the type defaults in `use()` (1)** — misses a value the user typed that equals a default.
- **Store the board's Material in the answers (2)** — changes the stored answer shape (ADR-011/046) for one case.
- **Shorter type labels (3)** — changes ADR-044 data; Russian still wraps.
- **InfoTip per warning badge (5)** — one more tap, unlike wall-fill cards.
- **Reuse `MmField` (6)** — it resets an invalid entry on blur, a silent substitution (ADR-008).

## Scope

- In scope: the eight fixes above, their tests, a jsdom find-it test (tests/find-it/wizard.test.tsx, 390 and 1280 px).
- Out of scope: "Open in wizard" for a wizard piece inside a project (Settings hides it there) (G-359).
- Out of scope: Review rows repeating long field labels ("Width of each compartment (0 = share the rest): 0 mm") (G-360).
- Out of scope: arrow keys on `Segmented` app-wide (G-361).

## Consequences

- Positive: a card no longer pins the type's name and sizes; a reopened piece never warns falsely or blocks on its
  board; the phone footer keeps Next in reach; cards and fields are usable by keyboard and screen reader.
- Negative / risks: find-it asserts on card and footer names change; offering the piece's own boards adds one entry
  to the Board list on reopen.

## Done when

- [ ] Cabinet → card → Type → Wardrobe: name "Wardrobe", 1200 × 2100 × 600 (test, 1).
- [ ] A piece made with a decor board reopens with no edited warning and no Board error, also after the decor is
      removed from the list (test, 2).
- [ ] At 390 px the Type footer shows Next on the first row; the defaults button hides once a type is chosen
      (find-it, 3 and 4).
- [ ] Card buttons are named "Use this: <label>"; a card with warnings lists their messages (find-it, 5).
- [ ] Width "abc" marks the Width box `aria-invalid` with the error under it, once (find-it, 6).
- [ ] Counters read "Fewer shelves in compartment 2"; Next moves focus to the step heading; arrow keys move between
      types (find-it, 7).
- [ ] The cards' second button reads "Continue by hand" (Russian "Продолжить вручную") and keeps the answers (find-it, 8).
