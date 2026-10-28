# ADR-126: Keep the core offline and allow opt-in online features

- Status: Implemented
- Date: 2026-10-28
- Implemented: 2026-10-28 (2026-10-28 (light acceptance; find-it pending (ADR-066)))
- Depends on: none
- Design: n/a
- Backlog: N127
- Acceptance: light
- Answers: 2026-10-28, the user answered every open question (below)

## Context

The user asked (2026-10-28) for six ADRs that take the app "from device-only storage to user accounts, with
templates and pieces saved in a database and shareable": "New adr for login using that persistent storage", "New
adr for gmail login", "New adr for ui login (including gmail)/logout/forgot password/reset password", "New adr for
save user templates and created pieces in db", "New adr share link to templates/pieces".

**Change control.** [ADR-002](../adr-done/ADR-002-static-offline-pwa-on-github-pages-no-backend-accounts-cloud.md)
(implemented) says: "There is no server, account, sync, telemetry, remote AI or runtime third-party request." Its
context adds that the owner "does not want designs leaving the device or any paid dependency". Accounts, a database
and share links contradict it. Implemented ADRs are never edited, so this ADR replaces ADR-002's network rule; the
rest of ADR-002 (static site on GitHub Pages, precached assets, update prompt, bundled fonts) stays. ADR-063 asked
the same question for supplier feeds ("would supersede ADR-002") and stays Deferred; this ADR does not decide it.

Today: `grep -rnE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon" src` finds nothing (run 2026-10-28).

## Decision

Settled by the request and the hard rules (the open questions below are not part of it):

- **Offline core unchanged.** Every feature that exists today keeps working signed out, offline and with no
  request. Nothing is sent before the user takes an online action.
- **Online features are opt-in actions:** sign in (ADR-135, ADR-136), save to the account (ADR-137), create or
  open a share link (ADR-138). Each names what it sends before it sends it.
- **One allowed online origin set.** The only runtime third-party origins are those of the backend chosen in
  ADR-127, listed in one place and in the content security policy (ADR-131). A request to any other origin is a
  bug.
- **Still forbidden:** telemetry, analytics, error reporters, remote AI, CDNs, remote fonts, ads.
- **Data rules carry over.** Documents from the server are validated before use and get new ids when copied
  (ADR-011); nothing deletes or rewrites saved designs without the user's decision (ADR-012).
- `docs/architecture.md`, the security-review skill and CLAUDE.md's ADR-002 lines are updated to cite this ADR
  when it is built.

**Answers (user, 2026-10-28):**

- **Free tier only** (G-213): no paid plan; when a free limit is reached the user decides.
- **Anyone can create an account** (G-214): public sign-up, with ADR-131's rate limits.
- **Online client in a lazy chunk** (G-215), downloaded only after the user signs in or opens a share link.
- **Opening a share link loads it at once** (G-216): opening the link is the opt-in action; no extra question.

## Alternatives considered

- **Keep ADR-002 as is** — items 2 (reading B) to 6 cannot be built.
- **Drop the offline core (online-first app)** — breaks the workshop use that ADR-002 was written for.
- **Accounts through a user-owned file sync (Drive or Dropbox folders)** — still a third-party request; the
  folder backup of ADR-133 covers the device-side part without a server.

## Scope

- In scope: the network rule, the opt-in rule, the allowed-origin list, the doc updates.
- Covered elsewhere: vendor (ADR-127), data (ADR-128, ADR-129), privacy (ADR-130), security (ADR-131).

## Consequences

- Positive: accounts and sharing become possible without weakening offline use.
- Negative / risks: first runtime dependency on an outside service; the "no designs leave the device" promise
  becomes "only when you choose".
- Harder to change later: once accounts exist, users' data lives on a server that must be kept or exported.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [x] Decision recorded; CLAUDE.md, `docs/architecture.md` and the security-review skill cite ADR-126 next to ADR-002.
- [x] A test fails if any module outside the online folder calls `fetch`, XHR, WebSocket or `sendBeacon`.
- [x] With no sign-in, a production build makes no request to any origin but its own (browser check, ADR-131).

## Implementation (2026-10-28)

`src/online/` holds every online module; `src/online/origins.ts` lists the allowed origin (the build's
`VITE_SUPABASE_URL`). `tests/network-boundary.test.ts` fails on `fetch`, XHR, WebSocket, `sendBeacon` or
`EventSource` outside `src/online`, and on any static import of `src/online` (only `import()`; G-215). The account
store loads the online chunk only when an account is used; a share link loads it at once (G-216). Paid plans: none
(G-213). CLAUDE.md, `docs/architecture.md` and the security-review skill cite ADR-126. Browser check (ran 2026-10-28,
production build, Chromium, 390 and 1280 px, Projects › New single piece › Both › Saved data › Catalog): no request
to any other origin, with and without a backend URL in the build, and none on opening Sign in.

## Open questions

- None open. Answered 2026-10-28, one by one: G-213 free tier only; G-214 anyone can sign up; G-215 lazy chunk after opt-in; G-216 a share link loads at once (no ask).
