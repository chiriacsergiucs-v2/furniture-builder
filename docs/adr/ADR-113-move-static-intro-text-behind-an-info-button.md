# ADR-113: Move static intro text behind an info button

- Status: Pending
- Date: 2026-10-27
- Depends on: none
- Design: docs/ui-design.md (section 3, components: info button)
- Backlog: N112
- Agreed: 2026-10-27 "All static intros (Recommended)"

## Context

The user, 2026-10-27: "Move info text from Project to a tooltip, apply same to other similar UX occurences." The
example is the paragraph under the **Project** heading: "Pieces are cut and bought together. Each piece is a copy;
editing it here never changes your saved pieces." Asked how far, the user chose "All static intros (Recommended)":
every static paragraph that explains a section or feature, app-wide. Asked about the 12 guidance lines that
[ADR-010](../adr-done/ADR-010-hardware-is-a-schedule-with-labelled-guidance-never-invented.md) labels as guidance, the
user chose "Move to ⓘ". This changes how ADR-010's labelled guidance is shown: it stays labelled, one tap away.

## Decision

- Reuse `InfoTip` (`src/ui/controls.tsx`, ADR-080: hover or focus with a mouse, tap with touch; a tap outside, a
  second tap or Esc closes it) beside a heading or label, accessible name "About <section>". Fixes: an `align="start"`
  prop, a z-index above the count card, and Esc inside a `<dialog>` closes only the popover. G-138 asks whether
  ADR-080's behaviour stays.
- Every static intro paragraph app-wide moves into an `InfoTip` on its heading; the inventory is made by the critique
  (file:line list in the implementing change).
- ADR-010 guidance lines move too, into an ⓘ named "Guidance: <topic>"; the popover text starts with "Guidance".
- Stay visible (not moved): warnings, errors and every diagnostic (ADR-008), empty states, live values and counts.
  A paragraph that mixes a live value with an explanation keeps the live part visible.

## Alternatives considered

- **Editor panels only** — not chosen by the user.
- **Native `title` tooltip** — no touch support and not keyboard-reachable.

## Scope

- In scope: the component, moving every static intro, a jsdom find-it test.
- Out of scope: rewording the texts. How the popover opens is G-138.

## Consequences

- Positive: shorter panels; headers line up.
- Negative / risks: explanations take one tap to read.
- Harder to change later: nothing; no stored shape changes.

## Done when

- [ ] The Project panel shows no "Pieces are cut and bought together" until its ⓘ button is pressed; pressing it shows
      the text, Escape hides it and focus returns to the button.
- [ ] Every intro and guidance line in the inventory is behind an ⓘ button; no warning, error, diagnostic, empty
      state or live value moved; guidance popovers start with "Guidance".
- [ ] ⓘ buttons are at least 44 × 44 px under touch and have an accessible name.
- [ ] Find-it passes from the bare app at phone and desktop widths (`tests/find-it/info-tip.test.tsx`, jsdom).

## Open questions

- Keep ADR-080's InfoTip behaviour (hover/focus with a mouse, tap with touch)? Used until answered. G-138.
