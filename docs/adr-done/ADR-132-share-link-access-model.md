# ADR-132: Share-link access model

- Status: Implemented
- Date: 2026-10-28
- Implemented: 2026-10-28 (2026-10-28 (light acceptance; find-it pending (ADR-066)))
- Depends on: ADR-128, ADR-131
- Design: n/a
- Backlog: N133
- Acceptance: light
- Answers: 2026-10-28, the user answered every open question (below)

## Context

The user asked (2026-10-28): "New adr share link to templates/pieces". Design codes (ADR-124,
`src/core/shareCode.ts`) already share a whole document inside a `#open=` link with no server, but they cannot be
stopped, carry no pictures (G-201) and grow with the design. A server share link points at an account record
(ADR-128) instead. Who may open it, for how long, and what it shows are not decided.

## Decision

Settled:

- A share link names one account record by an unguessable share id (ADR-131), never the record id.
- Opening a link never changes the owner's record. The viewer gets **a copy**: validated, with new ids
  (ADR-011), saved on the viewer's device like an imported file; `catalog.origin` is kept (ADR-028).
- The owner can see every link they made for an item.
- Server reads through a share id return only the body and name: no owner email or other account field.
- Creating and opening links are rate-limited on the server (ADR-131).

**Answers (user, 2026-10-28):**

- **Anyone with the link** can open it, without an account (G-236).
- **No expiry**; the owner can **stop** a link at any time (G-237).
- A link shows the item's **latest saved version** (G-238).

## Alternatives considered

- **Design codes only** (ADR-124) — no server needed, but no revoke and no pictures; kept beside (G-257).
- **Share by inviting an email** — needs both people to have accounts; see the access question.

## Scope

- In scope: the access, lifetime and content rules, the server read path, tests with a fake backend.
- Covered elsewhere: the Share link button and opening flow (ADR-138), the preview (ADR-143, proposed).

## Consequences

- Positive: links stay short and can carry pictures.
- Negative / risks: a link forwarded beyond its intended reader is readable by anyone if unlisted is chosen.
- Harder to change later: links already handed out.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [x] Server rule: a share id reads one body and name and nothing else; a wrong id gives not found (backend test).
- [x] Opening a link gives a copy with new ids; the owner's record is byte-identical after (test).
- [x] The chosen lifetime and revoke rules hold (test per rule).

## Implementation (2026-10-28)

Shares: 22-character base64url ids from 128 random bits (`newShareId`); made and stopped only by
`create_share` / `stop_share` (owner checked); `open_share` returns name, kind, body, schema and date only, for
anyone with the link (G-236), no expiry, stoppable (G-237), latest saved version (G-238); 30 links per account per
hour, 120 opens per link per hour (G-278). Tests: `tools/supabase/test.sql` steps 4–6 (another user cannot share
your record or insert a share directly; anon reads only through `open_share`), `tests/sync.test.ts`,
`tests/account-ui.test.tsx` (the copy gets a new id; nothing saved before Open a copy).

## Open questions

- None open. Answered 2026-10-28, one by one: G-236 anyone with the link; G-237 no expiry, the owner can stop a link; G-238 latest saved version.
