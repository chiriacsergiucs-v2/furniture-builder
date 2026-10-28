# ADR-138: Share links to templates and pieces

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-132, ADR-137
- Design: docs/ui-design.md (Menu, Dialog, Button, Alert)
- Backlog: N139
- Acceptance: light
- Answers: 2026-10-28, the user answered every open question (below)

## Context

The user asked (2026-10-28): "New adr share link to templates/pieces". ADR-132 fixes who can open a link and what
the viewer gets; ADR-137 puts pieces and templates in the account. Design codes (ADR-124) already share without a
server.

## Decision

Settled:

- **Share link** on a piece or template that is in the account (⋯ menu of the item). It opens a dialog with the
  link, **Copy link**, the item's current share links and, per ADR-132's answers, their lifetime and **Stop
  sharing**. Items only on this device show "Save to account first to share a link" with **Save to account**.
- **Opening a link** on any device: the app shows the item's name and kind, then **Open a copy** (and **Cancel**).
  The copy is validated and saved with new ids (ADR-132). A stopped, expired or unknown link shows "This link no
  longer works. Ask the owner for a new one." Offline: "You are offline. Open this link when you are back online."
- The link part of the address is cleared after reading it, as ADR-124 does for `#open=`.
- Templates open into Catalog › Templates; pieces open in the editor as a new library item.

**Answers (user, 2026-10-28):**

- **Copy code** stays beside **Share link** (G-257).
- Link form: `…/furniture-builder/#share=<id>` (G-258).
- **Shared links** list in Account with **Stop sharing**, plus per item (G-259).

## Alternatives considered

- **Design codes only** — no revoke, no pictures (G-201).
- **Share by email invite** — needs accounts on both sides; see G-236.

## Scope

- In scope: the dialog, link creation, opening flow, error and offline states, tests, jsdom find-it.
- Covered elsewhere: access rules (ADR-132), a richer preview (ADR-143, proposed).

## Consequences

- Positive: a short link instead of a long code; the owner keeps control.
- Negative / risks: links depend on the backend staying up and the account existing.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [x] Share link creates one share id for the record and shows a copyable link (test, fake backend).
- [x] Opening the link gives a copy with new ids and the owner's record unchanged (test).
- [x] Stopped, unknown and offline links show their messages and change nothing (tests).
- [ ] jsdom find-it at 390 and 1280 px: "Share link", "Copy link", then "Open a copy" from the link (light — catch-up).

## Implementation (2026-10-28)

Share link from the item's cloud menu, from ⋯ for the open piece, with Make a link, Copy link and Stop sharing;
Copy code stays (G-257); links `…/furniture-builder/#share=<id>` (G-258); Account lists Shared links with Stop
sharing (G-259). Opening a link loads at once (G-216) into the ADR-143 preview. Tests: `tests/account-ui.test.tsx`,
`tests/sync.test.ts`.

## Open questions

- None open. Answered 2026-10-28, one by one: G-257 keep both; G-258 #share=<id>; G-259 per item plus a list.
