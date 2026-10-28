# ADR-134: Login using the persistent storage

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-133
- Design: docs/ui-design.md (Dialog, top bar)
- Backlog: N135
- Acceptance: browser

## Context

The user asked (2026-10-28): "New adr for login using that persistent storage", right after "new ADR for
persistent storage and folder backup" ([ADR-133](ADR-133-keep-saved-data-persistent-and-back-it-up-to-a-folder.md)).
The words allow two readings, and the user has not said which:

- **(A) Local login, no server.** A profile or lock on this device, stored in the persistent storage of ADR-133.
  A PIN in the browser protects nothing unless the saved data is also encrypted: IndexedDB is readable by anyone
  with the device's browser profile.
- **(B) Account session kept in persistent storage.** The account sign-in of ADR-135/ADR-136 is stored on the
  device so it survives restarts and the app opens signed in while offline. This needs ADR-126, ADR-127 and
  ADR-131 (session storage, G-234) as well.

## Decision

Settled for both readings:

- The login state lives in the device's persistent storage (ADR-133), never in a cookie set by GitHub Pages.
- Signing in or out never deletes or rewrites saved designs (ADR-012, ADR-129).
- An offline start shows the last login state and keeps every offline feature working.

**Not written: which reading is built.** The rest of this Decision waits for G-245 (and G-246 if A).

## Alternatives considered

- Reading A and reading B are the alternatives; see the open questions.
- **Both** — two login concepts in one small app; confusing.

## Scope

- In scope: the chosen reading only.
- Covered elsewhere: account screens (ADR-136), session security (ADR-131).

## Consequences

- Positive: the user opens the app and is where they left off, online or not.
- Negative / risks (A): a lock without encryption is cosmetic; with encryption, a lost passphrase loses the data.
- Negative / risks (B): a stolen device keeps a live session until it expires or is signed out elsewhere.

## Done when

- [ ] The user picked a reading; the Decision is completed and the Depends on line updated to match.
- [ ] (B) Reload and an offline start show the signed-in name without a network request (browser script).
- [ ] (A) The chosen lock or profiles work after a reload and never expose saved data while locked (tests).
- [ ] Browser find-it on the production build at 390 and 1280 px for the chosen reading's visible text.

## Open questions

- Reading A (local profile or lock, no server) or reading B (account session kept in persistent storage)?
  Suggested: B, because items 3 and 4 are logins to an account (estimate: B +10 % on top of ADR-131; A +25 % as a
  separate feature) (G-245).
- If A: a passphrase lock with encrypted storage, or several local profiles? Suggested, only if A: the lock
  (G-246).
