# ADR-137: Save your templates and pieces in your account

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-128, ADR-129, ADR-136
- Design: docs/ui-design.md (Row button, Badge, Status, Library and Catalog screens)
- Backlog: N138
- Acceptance: full

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
- Whether saving is automatic or per item is open (G-255); this Decision does not choose it.

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

- [ ] Save to account uploads one record, links the row, badge reads "In your account" (store test, fake backend).
- [ ] Remove from account deletes the server record only; the local row is unchanged (test).
- [ ] Open from "In your account" gives a validated copy; an invalid body is reported and not stored (test).
- [ ] A local template saved and opened on a second (fake) device equals the original except ids and dates (test).
- [ ] jsdom find-it at 390 and 1280 px from the bare app: sign in (fake), "Save to account", "In your account".

## Open questions

- Automatic for every saved piece and template while signed in, or only those marked Save to account? Suggested:
  automatic with Keep on this device only per item (+10 %) (G-255).
- Your edits of shipped templates (local templates that shadow them) too? Suggested: yes (+2 %) (G-256).
- Which records, and whether pieces inside projects count as "created pieces": see G-221.
