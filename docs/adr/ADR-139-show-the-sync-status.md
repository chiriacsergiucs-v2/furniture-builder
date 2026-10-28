# ADR-139: Show the sync status

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-137
- Design: docs/ui-design.md (Status `.status`, Badge, top bar)
- Backlog: N140
- Acceptance: browser
- Proposed by: Claude, not requested (2026-10-28 task: "propose further architecture and UX ADRs")

## Context

Proposed by Claude, not requested. With account items (ADR-137) the user needs to know whether the open item and
the rest have reached the account, mainly after offline work (ADR-129). The top bar already shows the device save
status (`.status.saving` / `.saved` / `.failed`).

## Decision

- Signed in, a second status beside the save status reads **In your account**, **Uploading…**, **Waiting for a
  connection (n)** or **Upload failed — Retry**; failures stay visible until resolved (like `.status.failed`).
- Tapping it opens a short list of waiting and conflicting items with **Open**.
- Signed out, nothing is shown.

## Alternatives considered

- **Badges in lists only** — the open item's state would be hidden while editing.
- **Toasts per upload** — noisy, and gone before the user looks.

## Scope

- In scope: the status, its list, tests.
- Covered elsewhere: the sync plan (ADR-129).

## Consequences

- Positive: offline edits are never a surprise.
- Negative / risks: one more element in a full top bar at 390 px.

## Done when

- [ ] Each status text renders from the matching sync state (jsdom test).
- [ ] Browser find-it on the production build at 390 and 1280 px: the status is visible, no horizontal scroll.

## Open questions

- Beside the save status, a badge per item, or both? Suggested: both (+10 %) (G-260).
