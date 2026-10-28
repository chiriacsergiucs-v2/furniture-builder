# ADR-126: Keep the core offline and allow opt-in online features

- Status: Pending
- Date: 2026-10-28
- Depends on: none
- Design: n/a
- Backlog: N127
- Acceptance: light

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

- [ ] Decision recorded; CLAUDE.md, `docs/architecture.md` and the security-review skill cite ADR-126 next to ADR-002.
- [ ] A test fails if any module outside the online folder calls `fetch`, XHR, WebSocket or `sendBeacon`.
- [ ] With no sign-in, a production build makes no request to any origin but its own (browser check, ADR-131).

## Open questions

- Paid backend allowed? Free tier only, or a paid plan up to an amount you set? Suggested: free tier only until a
  limit is reached (G-213).
- Who can create an account: only you, people you invite, or anyone? Suggested: anyone, closest to "user accounts"
  and share links (estimate effort +15 %, value +30 % over owner-only) (G-214).
- Online client code: lazy chunk loaded after opt-in, or in the main bundle? Suggested: lazy chunk (+5 %) (G-215).
- Opening a share link: fetch at once, or ask first? Suggested: ask first, like ADR-124's links (+2 %) (G-216).
