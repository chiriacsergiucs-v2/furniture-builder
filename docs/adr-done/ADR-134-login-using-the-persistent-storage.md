# ADR-134: Login using the persistent storage

- Status: Implemented
- Date: 2026-10-28
- Implemented: 2026-10-28 (2026-10-28 (light acceptance; find-it pending (ADR-066)))
- Depends on: ADR-127, ADR-131, ADR-133
- Design: docs/ui-design.md (Dialog, top bar)
- Backlog: N135
- Acceptance: light
- Answers: 2026-10-28, the user answered every open question (below)

## Context

The user asked (2026-10-28): "New adr for login using that persistent storage", right after "new ADR for
persistent storage and folder backup" ([ADR-133](../adr-done/ADR-133-keep-saved-data-persistent-and-back-it-up-to-a-folder.md)).
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

Which reading is built: see the answers below.

**Answers (user, 2026-10-28):**

- **Reading B** (G-245): the account sign-in of ADR-135 and ADR-136 is kept in the device's persistent storage (ADR-131, G-234), so a reload or an offline start opens signed in, showing the name and email, without a request. A local lock or profiles (reading A, G-246) are not built.

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

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [x] (B) Reload and an offline start show the signed-in name without a network request (browser script).
- [ ] Browser find-it on the production build at 390 and 1280 px for the chosen reading's visible text (light — catch-up).

## Implementation (2026-10-28)

Reading B (G-245): the account is remembered in localStorage (`fb:account`) and shown at once; the session is kept
by Supabase in this browser's storage (G-234); `initAccount` checks it when the online chunk loads and keeps the
remembered account while offline. Reading A is not built (G-246). Test: `tests/account-ui.test.tsx` ("a remembered
account shows at once with no request, offline too") — jsdom, not a browser script.

## Open questions

- None open. Answered 2026-10-28, one by one: G-245 reading B; G-246 not applicable.
