# ADR-116: Use one heading scale and the spacing tokens everywhere

- Status: Implemented
- Date: 2026-10-27
- Implemented: 2026-10-27
- Depends on: ADR-114
- Design: docs/ui-design.md (section 2, tokens)
- Backlog: N115
- Acceptance: light
- Agreed: 2026-10-27 "Heading + spacing scale"

## Context

The user, 2026-10-27: "Run a critique for listings, headers, text, button sizes, gaps, groupings." Critique: [2026-10-27 UI critique](../retros/2026-10-27-ui-critique.md). Catalog h2 and
h3 are both 17/600; the Settings dialog has two h2; Projects shows "Projects", "Choose a project" and "PROJECTS" in a
row; uppercase `.card-title` sits beside sentence-case h4; 192 spacing values are ad hoc (6 px × 23) against 229
tokens; `.bar` is defined five times. The user picked "Heading + spacing scale".

## Decision

- One heading scale: h1 24, h2 20, h3 17 (600), section label 13 uppercase; sub-sections inside a card use the 13 px
  label style, never a sentence-case h4 beside it. One heading per level per screen; repeated headings go.
- Every gap, padding and margin uses `--s-*` tokens; off-scale values (2, 6 px …) round to the nearest token.
  Field-to-hint 4 px, group-to-group 16 px.
- `.bar` gets one base rule with modifiers.

## Alternatives considered

- **Leave as is** — not chosen.

## Scope

- In scope: `src/styles.css`, heading levels in `src/ui`, a browser find-it script.
- Out of scope: text in SVG drawings and print sheets (G-139); low-severity critique items (G-141).

## Consequences

- Positive: consistent hierarchy and rhythm.
- Negative / risks: many small visual shifts; checked by screenshots at both widths.
- Harder to change later: nothing.

## Done when

- [x] No non-zero gap, padding or margin in `src/styles.css` outside `:root` uses a raw px value except borders and
      hairlines (a test greps the file).
- [ ] At 390 and 1280 px, on Projects, Catalog, editor and Settings, every h1/h2/h3 has the scale's size and no
      level repeats the same text in a row.
- [ ] Find-it from the bare app at phone and desktop widths (light — catch-up; user 2026-10-27 "Dont run find it
      on these").
