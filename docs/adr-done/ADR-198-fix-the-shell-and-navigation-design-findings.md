# ADR-198: Fix the shell and navigation design findings

- Status: Implemented
- Date: 2026-11-06
- Implemented: 2026-11-05 (Built in PR #169 (merged 353108e, CI run 42126747931); production find-it re-run on main 2026-11-05)
- Depends on: ADR-078, ADR-079, ADR-080
- Design: docs/ui-design.md (Shell and navigation)
- Backlog: N203

## Context

The user asked to implement ADRs 198, 199 and 200 using the design audit. On main at `f1f7b70`,
all three were empty placeholders: no findings, Decision or agreed fixes. Original request: "run a /batch
for 1 through 7 with a critique of design … 1 adr with high and medium issues and fixes per flow".
This records a code critique and diagnostic evidence; it does not interpret that request as an answer to
choices absent from the placeholders. ADR-191 and ADR-193 to ADR-196 are excluded.

## Decision

User answer 2026-11-06: "Yes" to implementing all twelve proposed fixes across ADR-198 to ADR-200.
The four fixes below are accepted. No unresolved product decision blocks this implementation.

## Findings and agreed fixes

1. **Undo changes a hidden design (High).** `src/ui/App.tsx:429-437,479-482`: Ctrl/Cmd+Z and Ctrl/Cmd+Y have
   no page guard. Probe: change Sideboard width, go to Catalog, Ctrl+Z reverts the width. Fix: run
   editor shortcuts only on the Editor page. Alternative: global undo leaves hidden edits and autosaves.
2. **Shortcuts act underneath dialogs (High).** The same handler excludes inputs, but not a dialog button,
   contenteditable or handled events. Probe: Settings, focus Done, Ctrl+Z undoes the piece beneath it.
   Fix: a shared guard excludes open dialogs, editable targets and handled events; prevent repeated
   destructive shortcuts. Alternative: exempt Settings alone still leaves every other dialog exposed.
3. **Escape on More also changes selection (Medium).** `src/ui/shell/MoreMenu.tsx:53-58` does not consume
   Escape; `App.tsx:485-488` handles it too. Probe: a selected space becomes whole-piece selection after
   More, Escape. Fix: handle Escape on the menu, consume it and restore summary focus before the
   editor handler. Alternative: two window listeners still depend on listener ordering.
4. **An inside drag can dismiss a dialog (Medium).** `src/ui/Dialogs.tsx:91-93` dismisses any click targeted
   at the dialog. Synthetic probe: pointer-down on text, pointer-up/click on backdrop calls onClose.
   Fix: dismiss only when the same pointer starts and ends on the backdrop, excluding cancellation;
   keep backdropClose=false for the wizard. Alternatives: disable backdrop dismissal everywhere, or check
   only the click target (current). A physical text-selection drag still needs browser verification.

## Alternatives considered

The user chose all four fixes on 2026-11-06. Alternatives beside each finding were rejected for the
reasons given. The accepted fixes are implemented on this branch.

## Scope and consequences

Only the four proposed fixes and their regression/find-it coverage, translations and relevant feature entries.
No new physical specifications, model rules, storage schema or dependency. Keep existing undo semantics and
validate through the authoritative model. The user approved these behaviour changes on 2026-11-06.

## Initial critique evidence (before implementation)

Ran locally on 2026-11-06: frozen-lockfile install; pnpm build; four shell probes passed within an 11/11
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
- [x] Shortcuts on Projects, Catalog, Info and Research do not change the hidden editor or its history.
- [x] Open dialogs, editable targets and handled events do not trigger background editor shortcuts.
- [x] Escape on More restores focus and preserves space/piece selection.
- [x] Only an intentional backdrop press/release dismisses a dialog; inside/cancelled drags do not.
- [x] Regression/find-it checks at 390 and 1280 px and all required CI checks pass.

## Implementation evidence

Built the four shell fixes. Ran targeted Vitest: 8/8 passed (shortcut guards, both-width bare-app acceptance, backdrop gesture regression). Full verification and production screenshots pending.

Production verification 2026-11-06: tools/shell-shortcuts/find-it.mjs passed 14/14 on the production build
at 390 × 844 and 1280 × 900, including a physical text drag ending on the backdrop. Captured Projects,
Settings, More, editor light/dark states; no horizontal page scroll. Chromium GPU disabled; no 3D claim.
Targeted tests 8/8 passed; lint, typecheck, build and docs:check passed. Full suite pending integration.

## Requirement evidence

User request: "Implement ADR-s 198, 199, 200"; answer "Yes" to all twelve numbered fixes.

| Accepted requirement    | Evidence                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Hidden undo             | Non-editor shortcut guard; Catalog export/field checks.                                   |
| Dialog shortcuts        | Editable/modal guard, including Chromium native undo of a blurred input.                  |
| Escape on More          | Focus returns to More; the selected space remains selected.                               |
| Backdrop drag dismissal | Complete backdrop gesture required; physical inside-to-backdrop drag keeps Settings open. |

Tests: tests/editor-shortcuts.test.ts; tests/find-it/shell-shortcuts.test.tsx. Production acceptance: tools/shell-shortcuts/find-it.mjs — 14/14 passed
at 390 × 844 and 1280 × 900. Light/dark screenshots were inspected. Lint, formatting, types,
full test suite, production build and docs checks pass locally. One pre-existing skipped test remains.
No geometry rule, dependency or storage schema changed. Not merged, deployed or live-verified.
