# ADR-198: Fix the shell and navigation design findings

- Status: Deferred (fix choices need the user's answer; production-browser critique incomplete)
- Date: 2026-11-06
- Depends on: ADR-078, ADR-079, ADR-080
- Design: docs/ui-design.md (Shell and navigation)
- Backlog: N203

## Context

The user asked to implement ADRs 198, 199 and 200 using the Claude Flow audit. On main at `f1f7b70`,
all three were empty placeholders: no findings, Decision or agreed fixes. Original request: "run a /batch
for 1 through 7 with a critique of design … 1 adr with high and medium issues and fixes per flow".
This records a code critique and diagnostic evidence; it does not interpret that request as an answer to
choices absent from the placeholders. ADR-191 and ADR-193 to ADR-196 are excluded.

## Decision

Not agreed yet. The fixes below remain proposals pending the user's choice under Open questions.

## Proposed findings and fixes

1. **Undo changes a hidden design (High).** `src/ui/App.tsx:429-437,479-482`: Ctrl/Cmd+Z and Ctrl/Cmd+Y have
   no page guard. Probe: change Sideboard width, go to Catalog, Ctrl+Z reverts the width. Proposed fix: run
   editor shortcuts only on the Editor page. Alternative: global undo leaves hidden edits and autosaves.
2. **Shortcuts act underneath dialogs (High).** The same handler excludes inputs, but not a dialog button,
   contenteditable or handled events. Probe: Settings, focus Done, Ctrl+Z undoes the piece beneath it.
   Proposed fix: a shared guard excludes open dialogs, editable targets and handled events; prevent repeated
   destructive shortcuts. Alternative: exempt Settings alone still leaves every other dialog exposed.
3. **Escape on More also changes selection (Medium).** `src/ui/shell/MoreMenu.tsx:53-58` does not consume
   Escape; `App.tsx:485-488` handles it too. Probe: a selected space becomes whole-piece selection after
   More, Escape. Proposed fix: handle Escape on the menu, consume it and restore summary focus before the
   editor handler. Alternative: two window listeners still depend on listener ordering.
4. **An inside drag can dismiss a dialog (Medium).** `src/ui/Dialogs.tsx:91-93` dismisses any click targeted
   at the dialog. Synthetic probe: pointer-down on text, pointer-up/click on backdrop calls onClose.
   Proposed fix: dismiss only when the same pointer starts and ends on the backdrop, excluding cancellation;
   keep backdropClose=false for the wizard. Alternatives: disable backdrop dismissal everywhere, or check
   only the click target (current). A physical text-selection drag still needs browser verification.

## Alternatives considered

The alternatives beside each finding were compared with the proposed fix. They remain unselected until
the user answers; no alternative or proposal has been written into application code.

## Scope and consequences

Only the four proposed fixes and their regression/find-it coverage, translations and relevant feature entries.
No new physical specifications, model rules, storage schema or dependency. Keep existing undo semantics and
validate through the authoritative model. UI behaviour changes only after the user chooses the fixes.

## Evidence and remaining critique

Ran locally on 2026-11-06: frozen-lockfile install; pnpm build; four shell probes passed within an 11/11
scratch Vitest diagnostic run. Probes assert existing defects, not corrected behaviour; removed after use.
The shell drag probe is a synthetic event sequence; unhandled project-template writes are source evidence.
No application code changed. Node 24.22.1, pnpm 11.25.0 (package.json pins pnpm 12.6.0).
Production screenshots at 390 × 844 and 1280 × 900 were not obtained: Chromium failed to launch/render
(GPU/font initialization). No browser, visual, 3D or gesture acceptance is claimed. G-367 remains Open.
Completion prompt: obtain the user's fix choices; capture this domain's production states at both sizes in
light/dark themes; finish the original critique scope, check physical gestures and ask about additional fixes.

## Open questions

- Choose the four numbered fixes, or identify changes. Proposal: all four, to prevent the demonstrated
  misleading state, hidden edits or lost work while preserving existing capabilities. Effort/value percentages
  cannot be determined from current evidence. No proposed option is accepted by default. G-367.

## Done when

- [ ] User choices and the production-browser critique are complete and recorded.
- [ ] Shortcuts on Projects, Catalog, Info and Research do not change the hidden editor or its history.
- [ ] Open dialogs, editable targets and handled events do not trigger background editor shortcuts.
- [ ] Escape on More restores focus and preserves space/piece selection.
- [ ] Only an intentional backdrop press/release dismisses a dialog; inside/cancelled drags do not.
- [ ] Regression/find-it checks at 390 and 1280 px and all required CI checks pass.
