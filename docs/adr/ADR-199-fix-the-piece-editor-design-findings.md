# ADR-199: Fix the piece editor design findings

- Status: Deferred (fix choices need the user's answer; production-browser critique incomplete)
- Date: 2026-11-06
- Depends on: ADR-079, ADR-080, ADR-112, ADR-117
- Design: docs/ui-design.md (Piece editor (Compose and Configure))
- Backlog: N204

## Context

The user asked to implement ADRs 198, 199 and 200 using the Claude Flow audit. On main at `f1f7b70`,
all three were empty placeholders: no findings, Decision or agreed fixes. Original request: "run a /batch
for 1 through 7 with a critique of design … 1 adr with high and medium issues and fixes per flow".
This records a code critique and diagnostic evidence; it does not interpret that request as an answer to
choices absent from the placeholders. ADR-191 and ADR-193 to ADR-196 are excluded.

## Decision

Not agreed yet. The fixes below remain proposals pending the user's choice under Open questions.

## Proposed findings and fixes

1. **Settings displays refused sizes as if applied (High).** `src/ui/Inspector.tsx:937-960` offers ordinary
   Width/Height/Depth inputs unlike Compose's lock-aware PieceSize. SizeLockNote at 130-143 only checks the
   whole-size flag. `src/ui/controls.tsx:44-48` keeps a valid draft after a refused edit. Probe: width locked,
   Settings, type 1700 instead of 1600, blur: field 1700, model 1600, no lock explanation. Proposed fix: respect
   per-axis locks in Settings and show the reason; reconcile field text explicitly after other refused
   commits. Alternative: store-only refusal leaves the displayed dimensions untrustworthy.
2. **Invalid split/drawer sizes look accepted (High).** `Inspector.tsx:718-759,842-895`: uncontrolled fields
   commit only on valid blur, without invalid state/error. Probe: Left share abc remains after blur with no
   aria-invalid while the document stays unchanged. Drawer heights use the same pattern. Proposed fix:
   a shared size/share field keeps invalid text with a translated local error and accessible associations;
   finite positive shares below 1000, positive integer mm. Alternative: resetting on blur hides the mistake.
3. **Enter does not commit split/drawer fields (Medium).** Those fields have onBlur only. Probe: Left share
   2, Enter leaves the document unchanged until Tab, unlike adjacent MmField controls. Proposed fix: Enter
   blurs/commits once; Escape restores the saved value and clears the error. Alternative: per-keystroke
   commits build intermediate sizes and add undo steps.
4. **Door count forgets hinge choice (Medium).** `src/ui/Editors.tsx:59-73` creates fresh objects for Door/Pair.
   Probe: right-hinged Door to Pair drops hinge; returning to Door defaults left. The quick-count stepper
   preserves it. Proposed fix: retain existing door settings when changing count within the doors kind;
   preserve current reset behaviour between different front kinds. Alternative: a separate remembered-hinge
   field adds an unnecessary document change.

## Alternatives considered

The alternatives beside each finding were compared with the proposed fix. They remain unselected until
the user answers; no alternative or proposal has been written into application code.

## Scope and consequences

Only the four proposed fixes and their regression/find-it coverage, translations and relevant feature entries.
No new physical specifications, model rules, storage schema or dependency. Keep existing undo semantics and
validate through the authoritative model. UI behaviour changes only after the user chooses the fixes.

## Evidence and remaining critique

Ran locally on 2026-11-06: frozen-lockfile install; pnpm build; four piece-editor probes passed within an 11/11
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
- [ ] Locked Settings dimensions are disabled/explained; a refused edit never looks applied.
- [ ] Invalid split/drawer sizes and shares show a local accessible error without changing the document.
- [ ] Enter commits once; Escape cancels a size/share draft without changing the document.
- [ ] Right-hinged Door to Pair to Door keeps the hinge, matching the count stepper.
- [ ] Russian copy/feature entries, regression/find-it checks at both widths and required CI checks pass.
