# ADR-129: Move device designs into an account, offline use and conflicts

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-128
- Design: docs/ui-design.md (Dialog, Alert, Status)
- Backlog: N130
- Acceptance: light

## Context

Accounts (ADR-126) meet a device that already holds the user's work in Dexie. CLAUDE.md: "Nothing may delete or
rewrite saved designs without the user's explicit decision." The workshop is often offline (ADR-002). The user's
request (2026-10-28) covers "templates and pieces saved in a database"; it does not say what happens to designs
saved before signing in, to edits made offline, or to the same item changed on two devices.

## Decision

Settled by the hard rules:

- **Signed out = today's app.** Nothing changes for a user who never signs in.
- **Nothing moves or is removed silently.** A local row is uploaded, replaced or deleted only after a choice the
  user made (per item, or a standing choice they set). A failed upload leaves the local row as it was.
- **A conflict never loses work.** When the server holds a newer revision than the one an edit started from, the
  app keeps both versions until the user decides (exact policy: G-226).
- **Sync state is visible**: every account item shows Saved to account / Waiting to upload / Conflict
  (component: `.status`, ADR-139 proposes the indicator).
- **Logic in `src/core`** as pure functions (`planSync(local, remote) → actions`), unit-tested, with a fuzz test
  that no plan drops a document.

## Alternatives considered

- **Server is the source of truth, device is a cache** — offline edits could be lost on the next fetch.
- **Last save wins everywhere** — rewrites saved designs without the user's decision.
- **Real-time co-editing (CRDT)** — far more than asked; one owner per item.

## Scope

- In scope: first-sign-in migration, offline queue, conflict handling, sign-out, deletes, the sync plan tests.
- Covered elsewhere: which records (ADR-128, G-221), the Save to account UI (ADR-137).

## Consequences

- Positive: signing in can never cost the user a design.
- Negative / risks: duplicates after conflicts; the user tidies them.
- Harder to change later: the conflict policy once users rely on it.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [ ] `planSync` never yields an action that deletes or overwrites a local row without a user choice (fuzz test).
- [ ] First sign-in with 3 local pieces asks once; Not now uploads nothing (store test).
- [ ] Offline edit of an account item is kept locally and uploaded when back online (test with a fake backend).
- [ ] A two-device conflict keeps both versions (test).
- [ ] jsdom find-it at 390 and 1280 px: the first-sign-in question and a Conflict state are reachable by text (light — catch-up).

## Open questions

- Designs saved before sign-in: ask once (Upload all / Choose / Not now), upload all silently, or upload none?
  Suggested: ask once (+5 %) (G-224).
- Offline and signed in: save locally and send later, or block editing account items? Suggested: send later
  (+20 %) (G-225).
- Same item changed on two devices: keep both, last save wins, or ask with a compare? Suggested: keep both
  (+10 %) (G-226).
- Signing out on a shared device: keep local copies, offer to remove them, or remove automatically? Suggested:
  offer, default keep (G-227).
- A delete of an account item: everywhere at once, account Trash for N days (you pick N), or this device only?
  Suggested: Trash (G-228).
