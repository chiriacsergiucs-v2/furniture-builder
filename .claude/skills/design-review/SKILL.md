---
name: design-review
description: Compare an implemented screen or component with its design reference and report every visual, copy, state and accessibility difference, at phone and desktop widths. Read-only unless asked to fix. Use when the user says "review the design", "does this match the mockup", "compare with the design", "design QA", or after implementing a screen.
---

# Design review

Project: **Furniture Builder** — phone-first PWA. The reference (`docs/ui-design.md` or the
user's screenshot) is authoritative. This skill finds differences; `implement-design` fixes.

## Workflow

1. **Get both sides.** The reference from the ADR's `Design:` line. The implementation from
   the production build (`npm run build && npx vite preview --port 4173`, then
   `http://localhost:4173/furniture-builder/`), captured with Playwright (Chromium is
   installed) at 390, 1280 and 1600 px, light and dark theme. Never review from the code alone.
2. **Find it first (R3):** starting from the bare app, can the feature be found by its
   visible text at each width? If not, that is a blocker whatever it looks like.
3. **Compare region by region:** layout and spacing, typography (Barlow), colours and
   tokens, icons, copy, component states (default, focused, disabled, empty, error
   diagnostics, saving), behaviour the reference implies.
4. **Responsive:** no horizontal page scroll at 320–768 px; nothing clipped or hidden in a
   sideways scroller on phones.
5. **Accessibility:** contrast ≥ 4.5:1 for body text, touch targets ≥ 44 px, visible focus,
   labels on icon-only buttons and inputs.
6. **Hygiene:** tokens from `src/styles.css`, shared components reused, no geometry in UI.
7. **Report as a table**, by severity:

   | Area | Reference | Implementation | Width | Severity | Suggested fix |
   | ---- | --------- | -------------- | ----- | -------- | ------------- |

   Severity: **blocker** (not findable, wrong behaviour, broken layout, accessibility
   failure), **visible**, **minor**. End with a one-line verdict.

## Rules

- The reference wins; design opinions go in a separate note for the user.
- Only report what you observed; say what you could not check (e.g. a real phone).
- Read-only unless the user asks you to apply the fixes.
