# ADR-130: Privacy notice, data export and account deletion

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-127
- Design: docs/ui-design.md (Dialog, Section card, Button `danger`)
- Backlog: N131
- Acceptance: full

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

- [ ] Notice opens from the sign-in dialog before any request; names vendor, region, data and contact.
- [ ] Export my data gives files that the app's Import opens (test with a fake backend).
- [ ] Delete my account removes every server record and share link of that user and keeps local rows (test).
- [ ] jsdom find-it at 390 and 1280 px: "Privacy notice", "Export my data", "Delete my account".

## Open questions

- Who is named as controller, and which contact email? Only you can answer (G-229).
- Consent banner, or a line at sign-in about the strictly necessary session storage? Suggested: a line at sign-in,
  to be checked (G-230).
- Notice language: Romanian, English or both? Suggested: both (+5 %) (G-231).
- After deletion: delete at once, or keep N days for undo? Suggested: at once, stating the vendor's backup period
  once known (G-232).
- Legal review before public sign-up? Suggested: yes (G-233).
