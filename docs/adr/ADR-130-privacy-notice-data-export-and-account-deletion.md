# ADR-130: Privacy notice, data export and account deletion

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-127
- Design: docs/ui-design.md (Dialog, Section card, Button `danger`)
- Backlog: N131
- Acceptance: light
- Answers: 2026-10-28, the user answered every open question (below)

## Context

Accounts store personal data (an email address, a name from Google, the user's designs) on a server (ADR-126).
Users are in Romania, so the GDPR applies, supervised by ANSPDCP; device storage for the session falls under the
ePrivacy rules (Romanian Law 506/2004). This ADR is engineering guidance, **not legal advice**. Today the app
collects nothing (ADR-002) and has no privacy notice.

## Decision

Settled by the request and GDPR principles (data minimisation, access, erasure, portability):

- **Privacy notice** reachable from the sign-in dialog and from Account before any data is sent: what is stored
  (email, display name, the items you save or share), where (vendor and region, ADR-127), why (to keep and share
  your items), how long, your rights, contact, and that the offline app sends nothing.
- **Collect only** the email, a display name and the items the user saves; no tracking, analytics or profiling
  (ADR-126).
- **Export my data**: Account › Export my data downloads every account record as the same files the app already
  imports (design and template JSON) plus a JSON of the account fields.
- **Delete my account**: Account › Delete my account, confirmed by typing the email; removes the server records,
  share links and the sign-in; local device copies stay unless the user also removes them (ADR-129).
- Copy is final only after the open questions below are answered.

**Answers (user, 2026-10-28):**

- **Controller** (G-229): the app's owner as a person; contact **Beliserii@gmail.com**.
- **Consent** (G-230): one line at sign-in explains the strictly necessary session storage; no banner.
- **Language** (G-231): English, like the app UI.
- **After account deletion** (G-232): server data is deleted at once; the notice states Supabase's backup period once verified.
- **Legal review** (G-233): none; the user decided to publish without one.

## Alternatives considered

- **No notice until public launch** — data is collected from the first sign-in.
- **Deletion by email request only** — slower and manual; an in-app action is clearer.

## Scope

- In scope: notice text and page, export, delete, consent wording, tests.
- Out of scope: legal review of the notice (G-233).

## Consequences

- Positive: users can leave with their data at any time.
- Negative / risks: notice must change whenever the vendor or data changes.
- Harder to change later: promises made in a published notice.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [x] Notice opens from the sign-in dialog before any request; names vendor, region, data and contact.
- [x] Export my data gives files that the app's Import opens (test with a fake backend).
- [x] Delete my account removes every server record and share link of that user and keeps local rows (test).
- [ ] jsdom find-it at 390 and 1280 px: "Privacy notice", "Export my data", "Delete my account" (light — catch-up).

## Implementation (2026-10-28)

Privacy notice in English (G-231) from the sign-in dialog and Account: controller the app's owner as a person,
contact Beliserii@gmail.com (G-229); Supabase in the EU; what is stored and why; the session kept on the device in
one line, no banner (G-230); 7-day Trash; delete at once (G-232); rights and ANSPDCP. No legal review (G-233, the
user's decision). Export my data: a .zip of the account's records as importable files plus `account.json`. Delete my
account: `delete_my_account()` removes the sign-in, every record and share at once; device rows stay. Tests:
`tests/account-ui.test.tsx`, `tests/sync.test.ts`, `tools/supabase/test.sql` (step 7).

## Open questions

- None open. Answered 2026-10-28, one by one: G-229 the user as a person, contact Beliserii@gmail.com; G-230 a line at sign-in; G-231 English; G-232 delete at once; G-233 no legal review.
