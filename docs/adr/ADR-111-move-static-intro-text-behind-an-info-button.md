# ADR-111: Move static intro text behind an info button

- Status: Pending
- Date: 2026-10-27
- Depends on: none
- Design: docs/ui-design.md (section 3, components: info button)
- Backlog: N109
- Agreed: 2026-10-27 "All static intros (Recommended)"

## Context

The user, 2026-10-27: "Move info text from Project to a tooltip, apply same to other similar UX occurences." The
example is the paragraph under the **Project** heading: "Pieces are cut and bought together. Each piece is a copy;
editing it here never changes your saved pieces." Asked how far, the user chose "All static intros (Recommended)":
every static paragraph that explains a section or feature, app-wide.

## Decision

- One shared `InfoTip` component: an ⓘ button beside a heading or label (accessible name "About <section>"), at least
  44 × 44 px under `pointer: coarse`, that opens the text in a small popover (`aria-expanded`, `aria-controls`);
  Escape, a tap outside or a second tap closes it; keyboard focus visible. Default for how it opens is G-136.
- Every static intro paragraph app-wide moves into an `InfoTip` on its heading; the inventory is made by the critique
  (file:line list in the implementing change).
- Stay visible (not moved): warnings, errors and every diagnostic (ADR-008), empty states, live values and counts,
  and instructions needed to finish a step that is in progress.

## Alternatives considered

- **Editor panels only** — not chosen by the user.
- **Native `title` tooltip** — no touch support and not keyboard-reachable.

## Scope

- In scope: the component, moving every static intro, a jsdom find-it test.
- Out of scope: rewording the texts. How the popover opens is G-136.

## Consequences

- Positive: shorter panels; headers line up.
- Negative / risks: explanations take one tap to read.
- Harder to change later: nothing; no stored shape changes.

## Done when

- [ ] The Project panel shows no "Pieces are cut and bought together" until its ⓘ button is pressed; pressing it shows
      the text, Escape hides it and focus returns to the button.
- [ ] Every intro in the inventory is behind an ⓘ button; no warning, error, diagnostic or empty state moved.
- [ ] ⓘ buttons are at least 44 × 44 px under touch and have an accessible name.
- [ ] Find-it passes from the bare app at phone and desktop widths (`tests/find-it/info-tip.test.tsx`, jsdom).

## Open questions

- Popover on tap and click (default) or hover-only tooltip? G-136.
