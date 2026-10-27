---
name: implement-design
description: Build a screen or component from the UI design reference (docs/ui-design.md) or a screenshot the user gives — design tokens, shared components, all states, phone and desktop, accessible — then prove it with a find-it test. Use when the user says "implement this design", "build this screen", "match the mockup", or when an ADR names a Design reference.
---

# Implement a design

Project: **Furniture Builder** — phone-first PWA. The design reference is authoritative:
no visual, copy or flow changes without the user's approval.

## Workflow

1. **Open the reference:** the ADR's `Design:` line (usually a section of
   `docs/ui-design.md`) or the screenshot the user gave. View the image itself.
2. **Break it down:** regions, components, and the states a picture does not show (empty,
   error diagnostics, disabled, saving, storage unavailable, offline). Ask about anything
   that changes behaviour.
3. **Reuse before creating:** tokens in `src/styles.css` (light and dark themes, ADR-030),
   the `.btn` variants and the existing components in `src/ui`. No hardcoded colours or
   one-off sizes.
4. **Build:**
   - data comes from the store and `buildModel()`; no geometry in UI code (ADR-004);
   - selectors return stable references;
   - phone first (375–390 px), then 1280 and 1600 px; no horizontal page scroll; the phone
     bottom bar keeps every tab and action reachable;
   - every state from step 2; error diagnostics never hidden or softened;
   - keyboard focus visible, labels on icon buttons and inputs, touch targets ≥ 44 px.
5. **Copy:** English in the app; Romanian only on printed sheets and the parts CSV (ADR-020).
6. **Find-it test (R3):** write `tests/find-it/<feature>.test.tsx` (jsdom, ADR-108; copy
   `count-stepper.test.tsx`) that starts from the bare app and finds the feature by role and
   visible text at both `WIDTHS`. jsdom has no CSS: for an ADR with `- Acceptance: browser`
   (layout/CSS, 3D view, Move mode) write `tools/<feature>/find-it.mjs` instead (copy an existing
   one), with screenshots, and run it on `pnpm build` + `vite preview`. Skip it when the ADR
   says `- Acceptance: light`, and record `find-it pending (light, ADR-066)` in the backlog row (ADR-066).
7. **Verify** with the `verify` skill, add logic tests with `add-tests`, and report what
   was built, which states are covered, screenshots, and any deviation with the reason.

## Rules

- Do not "improve" the design; if something looks wrong, say so and ask.
- Never leave a deviation unreported. No new styling or component dependencies unasked.
