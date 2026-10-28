# ADR-129: Move device designs into an account, offline use and conflicts

- Status: Implemented
- Date: 2026-10-28
- Implemented: 2026-10-28 (2026-10-28 (light acceptance; find-it pending (ADR-066)))
- Depends on: ADR-128
- Design: docs/ui-design.md (Dialog, Alert, Status)
- Backlog: N130
- Acceptance: light
- Answers: 2026-10-28, the user answered every open question (below)

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

**Answers (user, 2026-10-28):**

- **First sign-in** (G-224): everything on the device in ADR-128's records is uploaded without asking. This is the user's standing choice; the local rows are not changed.
- **Offline** (G-225): edits are saved locally and uploaded when back online.
- **Conflict** (G-226): both are kept; the second is saved as a copy named after its device.
- **Sign-out** (G-227): the app offers to remove the account copies from this device; the default keeps them.
- **Delete** (G-228): an account item moves to an account **Trash** for **7 days**, then is removed; it can be restored meanwhile.

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

- [x] `planSync` never yields an action that deletes or overwrites a local row without a user choice (fuzz test).
- [x] First sign-in with 3 local pieces asks once; Not now uploads nothing (store test).
- [x] Offline edit of an account item is kept locally and uploaded when back online (test with a fake backend).
- [x] A two-device conflict keeps both versions (test).
- [ ] jsdom find-it at 390 and 1280 px: the first-sign-in question and a Conflict state are reachable by text (light — catch-up).

## Implementation (2026-10-28)

`src/core/sync.ts` (`planSync`, pure) and `src/online/client.ts` (`sync`, auto after saves, on `online`, on
sign-in). Answers built: everything uploads silently at the first sign-in (G-224, replaces "asks once"); offline
edits wait and upload later (G-225); a conflict keeps both, the account's version as "… (from your account)"
(G-226, G-274); sign-out offers to remove this account's copies, default keep (G-227); a delete here moves the
record to the account Trash, purged after 7 days by `purge_trash` (G-228; no Trash list yet, G-273). Items of another
account on the same device are never uploaded (found while testing). Tests: `tests/sync.test.ts` (3,000-case fuzz:
no pull replaces an item changed here; silent first upload; offline; conflict; Trash; device-only).

## Open questions

- None open. Answered 2026-10-28, one by one: G-224 upload all silently; G-225 save locally, upload later; G-226 keep both; G-227 offer to remove, default keep; G-228 account Trash, 7 days.
