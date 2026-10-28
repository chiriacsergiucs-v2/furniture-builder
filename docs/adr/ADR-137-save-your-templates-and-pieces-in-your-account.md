# ADR-137: Save your templates and pieces in your account

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-128, ADR-129, ADR-136
- Design: docs/ui-design.md (Row button, Badge, Status, Library and Catalog screens)
- Backlog: N138
- Acceptance: light
- Answers: 2026-10-28, the user answered every open question (below)

## Context

The user asked (2026-10-28): "New adr for save user templates and created pieces in db". Pieces are saved designs
in the library (`designs`, ADR-012); user templates are local template families (`templates`, ADR-034, ADR-107).
Both are device-only today. ADR-128 defines the server record and the link; ADR-129 the move, offline and conflict
rules.

## Decision

Settled:

- Signed in, the library and Catalog › Templates show for each own item one of: **In your account**, **Waiting to
  upload**, **Only on this device**, **Conflict** (`.badge`), from ADR-129's sync plan.
- **Save to account** on a piece or template sends it (ADR-128 record) and links the local row; **Remove from
  account** deletes only the server record after confirmation, the local row stays.
- A new section **In your account** lists account items not on this device; **Open** downloads a validated local
  copy, linked to the record.
- Signed out, nothing changes: no badges, no account section.
- Saving is automatic (answers below).

**Answers (user, 2026-10-28):**

- **Automatic** (G-255): while signed in, every saved piece and template is uploaded; each has **Keep on this device only**.
- Edits of shipped templates (local templates that shadow them) are uploaded too (G-256).

## Alternatives considered

- **Account copy replaces the device copy** — breaks offline use and ADR-012.
- **Separate Account screen holding all synced items** — splits one library into two places.

## Scope

- In scope: badges, Save to account, Remove from account, In your account list, open a copy, tests, jsdom find-it.
- Covered elsewhere: which other records may follow (G-221), share links (ADR-138).

## Consequences

- Positive: pieces and templates reach every device the user signs in on.
- Negative / risks: storage quota of the free tier (G-223); duplicates after conflicts.
- Harder to change later: users' expectations of what "in your account" holds.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [x] Save to account uploads one record, links the row, badge reads "In your account" (store test, fake backend).
- [x] Remove from account deletes the server record only; the local row is unchanged (test).
- [x] Open from "In your account" gives a validated copy; an invalid body is reported and not stored (test).
- [x] A local template saved and opened on a second (fake) device equals the original except ids and dates (test).
- [ ] jsdom find-it at 390 and 1280 px from the bare app: sign in (fake), "Save to account", "In your account" (light — catch-up).

## Implementation (2026-10-28)

Automatic upload with **Keep on this device only** per item (G-255); edited shipped templates too (G-256).
Badges (In your account, Waiting to upload, Only on this device) on Projects › Single pieces and on Catalog
templates; a cloud ⋯ per item with Share link and Keep on this device only / Save to account; **In your account**
on Projects lists records not on this device with Open. Tests: `tests/sync.test.ts`, `tests/account-ui.test.tsx`.

## Open questions

- None open. Answered 2026-10-28, one by one: G-255 automatic; G-256 yes.
