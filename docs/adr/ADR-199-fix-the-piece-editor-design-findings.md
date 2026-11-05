# ADR-199: Fix the piece editor design findings

- Status: Pending
- Date: 2026-11-06
- Depends on: ADR-079, ADR-080, ADR-112, ADR-117
- Design: docs/ui-design.md (Piece editor (Compose and Configure))
- Backlog: N204
- Acceptance: browser

## Context

The user asked to implement ADRs 198, 199 and 200 using the Claude Flow audit. On main at `f1f7b70`,
all three were empty placeholders: no findings, Decision or agreed fixes. Original request: "run a /batch
for 1 through 7 with a critique of design … 1 adr with high and medium issues and fixes per flow".
This records a code critique and diagnostic evidence; it does not interpret that request as an answer to
choices absent from the placeholders. ADR-191 and ADR-193 to ADR-196 are excluded.

## Decision

User answer 2026-11-06: "Yes" to implementing all twelve proposed fixes across ADR-198 to ADR-200.
The four fixes below are accepted. No unresolved product decision blocks this implementation.

## Findings and agreed fixes

1. **Settings displays refused sizes as if applied (High).** `src/ui/Inspector.tsx:937-960` offers ordinary
   Width/Height/Depth inputs unlike Compose's lock-aware PieceSize. SizeLockNote at 130-143 only checks the
   whole-size flag. `src/ui/controls.tsx:44-48` keeps a valid draft after a refused edit. Probe: width locked,
   Settings, type 1700 instead of 1600, blur: field 1700, model 1600, no lock explanation. Fix: respect
   per-axis locks in Settings and show the reason; reconcile field text explicitly after other refused
   commits. Alternative: store-only refusal leaves the displayed dimensions untrustworthy.
2. **Invalid split/drawer sizes look accepted (High).** `Inspector.tsx:718-759,842-895`: uncontrolled fields
   commit only on valid blur, without invalid state/error. Probe: Left share abc remains after blur with no
   aria-invalid while the document stays unchanged. Drawer heights use the same pattern. Fix:
   a shared size/share field keeps invalid text with a translated local error and accessible associations;
   finite positive shares below 1000, positive integer mm. Alternative: resetting on blur hides the mistake.
3. **Enter does not commit split/drawer fields (Medium).** Those fields have onBlur only. Probe: Left share
   2, Enter leaves the document unchanged until Tab, unlike adjacent MmField controls. Fix: Enter
   blurs/commits once; Escape restores the saved value and clears the error. Alternative: per-keystroke
   commits build intermediate sizes and add undo steps.
4. **Door count forgets hinge choice (Medium).** `src/ui/Editors.tsx:59-73` creates fresh objects for Door/Pair.
   Probe: right-hinged Door to Pair drops hinge; returning to Door defaults left. The quick-count stepper
   preserves it. Fix: retain existing door settings when changing count within the doors kind;
   preserve current reset behaviour between different front kinds. Alternative: a separate remembered-hinge
   field adds an unnecessary document change.

## Alternatives considered

The user chose all four fixes on 2026-11-06. Alternatives beside each finding were rejected for the
reasons given. The accepted fixes are implemented on this branch.

## Scope and consequences

Only the four proposed fixes and their regression/find-it coverage, translations and relevant feature entries.
No new physical specifications, model rules, storage schema or dependency. Keep existing undo semantics and
validate through the authoritative model. The user approved these behaviour changes on 2026-11-06.

## Initial critique evidence (before implementation)

Ran locally on 2026-11-06: frozen-lockfile install; pnpm build; four piece-editor probes passed within an 11/11
scratch Vitest diagnostic run. Probes assert existing defects, not corrected behaviour; removed after use.
The shell drag probe is a synthetic event sequence; unhandled project-template writes are source evidence.
No application code changed. Node 24.22.1, pnpm 11.25.0 (package.json pins pnpm 12.6.0).
Production screenshots at 390 × 844 and 1280 × 900 were not obtained: Chromium failed to launch/render
(GPU/font initialization). No browser, visual, 3D or gesture acceptance is claimed. G-367 remains Open.
The accepted implementation scope is the four findings above; current verification follows below.

## Open questions

None. The user accepted all four fixes. G-367 tracks implementation and verification.

## Done when

- [x] User choices and the production-browser critique are complete and recorded.
- [x] Locked Settings dimensions are disabled/explained; a refused edit never looks applied.
- [x] Invalid split/drawer sizes and shares show a local accessible error without changing the document.
- [x] Enter commits once; Escape cancels a size/share draft without changing the document.
- [x] Right-hinged Door to Pair to Door keeps the hinge, matching the count stepper.
- [x] Russian copy/feature entries, regression/find-it checks at both widths and required CI checks pass.

## Implementation evidence

Built all four fixes; targeted Vitest 6/6 passed at 390 and 1280 px, including split/drawer validation, one-step commits, Escape, axis locks, rejected dimensions and hinge preservation. Production checks pending.

Production verification 2026-11-06: tools/piece-editor-inputs/find-it.mjs passed 16/16 at 390 × 844 and
1280 × 900. Checked visible split/drawer errors, Escape/Enter, Door/Pair hinge retention, and a locked project
imported through More → Import a file. Settings shows width disabled and explained, height editable.
Captured split/drawer validation and locked Settings in light/dark; no horizontal page scroll.
Targeted tests 6/6, typecheck and production build passed. Full suite pending integration.

## Requirement evidence

User request: "Implement ADR-s 198, 199, 200"; answer "Yes" to all twelve numbered fixes.

| Accepted requirement       | Evidence                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------- |
| Refused sizes and locks    | Settings axis fields disabled/explained; rejected drafts reconcile to model values. |
| Invalid split/drawer sizes | Finite positive shares and integer mm; local translated, accessible errors.         |
| Enter/Escape               | Enter commits exactly once; Escape restores the saved value.                        |
| Door/Pair hinge            | Right-hinged Door → Pair → Door retains the hinge.                                  |

Tests: tests/find-it/piece-editor-inputs.test.tsx. Production acceptance: tools/piece-editor-inputs/find-it.mjs — 16/16 passed
at 390 × 844 and 1280 × 900. Light/dark screenshots were inspected. Lint, formatting, types,
full test suite, production build and docs checks pass locally. One pre-existing skipped test remains.
No geometry rule, dependency or storage schema changed. Not merged, deployed or live-verified.
