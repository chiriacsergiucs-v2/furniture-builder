# ADR-247: Open Settings and Material inside the phone sheet

- Status: Implemented
- Date: 2026-11-10
- Implemented: 2026-11-10
- Depends on: ADR-080, ADR-163, ADR-241
- Design: docs/ui-design.md (§4, _Phone editor (ADR-241)_, _Settings and Material in the sheet (ADR-247)_)
- Backlog: N255
- Acceptance: browser

## Context

The user's phone pains (2026-11-09): "Too many taps, Can't find settings, Drawing covered, Mode/view switching".
ADR-241 kept piece editing in the project and made the results a Cut list place, but left Settings and Material as
dialogs over the page. Asked whether to open a new ADR to move them into the phone sheet, the user answered "Yes, ADR +
build" (2026-11-10).

This replaces, for phones in the editor only, "It opens a modal (the shared `Dialog`; full screen on phones)" of
[ADR-080](../adr-done/ADR-080-move-configure-into-a-settings-modal-and-view-captions-behind.md) and the Material dialog's
"phone: full-width sheet" of [ADR-163](../adr-done/ADR-163-one-material-control-everywhere-part-item-group-or-project-s.md).

## Decision

- On a phone (≤ 760 px) with the editor shown, **Settings**, the project piece's **Size, boards and construction** and
  **Material** open inside the Compose sheet: the sheet goes to its full stop, the dialog takes the place of the
  sheet's body (the peek row and the bottom nav stay), and closing it brings the sheet back to half height.
- It stays a `<dialog open>` named by its title (non-modal), with the same header, body, footer and × **Close**; Esc
  closes it. Tests and scripts that find it by role, name or `dialog[open]` keep working.
- Everywhere else (desktop, or the Projects page) the shared modal is unchanged.
- No model, store or document change; `Dialog` gains an `inSheet` option used by those three dialogs.

## Alternatives considered

- **Rewrite Settings and Material as sheet sections** (the full ADR-241 proposal): two large forms rewritten and most
  of their tests; the dialog content is the same either way.
- **Keep the full-screen dialog**: the piece disappears behind it, which is the "can't find settings" pain.

## Scope

- In scope: the sheet placement, the full stop on open, Esc and Close, the find-it check, the browser check.
- Out of scope: one ⋯ menu; desktop; other dialogs.

## Consequences

- Positive: the settings open where the piece is edited; the bottom nav and the peek row stay in reach.
- Negative / risks: two places a dialog can render; a dialog opened outside the editor still uses the modal.

## Done when

- [x] At 390 px Settings and Material open inside the Compose sheet; at 1280 px they open over the page (find-it,
      `tests/find-it/phone-editor.test.tsx`).
- [x] Browser (production build, Chromium): at 390 × 844 both dialogs are inside `aside.side`, below the peek row,
      with no sideways scroll; at 1280 × 900 both are modals.
- [x] The 27 find-it files that open Settings or Material pass at 390 and 1280 px.
