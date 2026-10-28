# ADR-127: Choose the backend, sign-in provider and database

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-126
- Design: n/a
- Backlog: N128
- Acceptance: light

## Context

Items 3–6 of the user's list (2026-10-28: "gmail login", "ui login … forgot password/reset password", "save user
templates and created pieces in db", "share link to templates/pieces") need a sign-in provider with Google and
email/password, an email sender for resets, a database and an HTTP API reachable from the static site on GitHub
Pages ([ADR-126](ADR-126-keep-the-core-offline-and-allow-opt-in-online-features.md)). Nothing is chosen.

Vendor facts below come from earlier research (2026-10-27/28, secondary sources, **unverified**) or are
**unknown**. No price, quota or licence is stated as fact (ADR-010 by analogy).

## Decision

Settled: the vendor must offer, or be paired with, (1) Google sign-in, (2) email/password with verification and
reset, (3) a database with per-user access rules enforced on the server, (4) an HTTPS API callable from
`https://chiriacsergiucs-v2.github.io` with CORS, (5) data export and account deletion (ADR-130), (6) a published
licence and telemetry posture for any client SDK shipped in the bundle. The vendor, region and owner stay open.

## Alternatives considered

Each candidate stays here until the user picks one (none is chosen).

- **Supabase** — auth with Google; email/password with reset; Postgres database; free projects pause after 1 week
  idle; Pro is $25/mo (earlier research, unverified). Licence, quotas, client SDK telemetry: unknown.
- **Cloudflare D1 with a Worker** — SQLite database behind a Worker the project writes; sign-in is not included
  (own code or a separate auth provider). Quotas, price, licence: unknown.
- **Turso** (hosted SQLite) — database only; needs an auth provider and an API layer. Facts: unknown.
- **Neon** (hosted Postgres) — database only; needs an auth provider and an API layer. Facts: unknown.
- **Firebase (Authentication + Firestore)** — Google sign-in and email/password; document database. Facts: unknown.
- **Self-hosted PocketBase or Appwrite** — own server to run and patch; hosting cost unknown.

## Scope

- In scope: the choice, the region, who owns the account and keys, verified vendor facts with URL and date.
- Covered elsewhere: data shape (ADR-128), session storage and CSP (ADR-131), email sender (ADR-136, G-250).

## Consequences

- Positive: one place records why the vendor was picked.
- Negative / risks: vendor lock-in for auth; free tiers can pause or change.
- Harder to change later: moving accounts between auth providers can force password resets.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [ ] The user picked a vendor, region and owner; the facts used are cited with URL and date in this ADR.
- [ ] The picked client SDK's licence and telemetry are checked and recorded (no telemetry allowed, ADR-126).
- [ ] The vendor's server-side access rules are written down for ADR-128's tables.

## Open questions

- Which vendor: Supabase, Cloudflare D1 + Worker (+ auth), Turso or Neon (+ auth), Firebase, or self-hosted
  PocketBase / Appwrite? Suggested: Supabase, the only candidate in the earlier research that covers items 3, 4 and
  5 in one service; risk: idle pause (unverified) (G-217).
- Data region: EU, or any? Suggested: EU (G-218).
- Whose account owns the backend, billing and keys? Suggested: yours; only you can answer (G-219).
- Verify every vendor fact on the vendor's pages before choosing? Suggested: yes (+5 %) (G-220).
- Email sender for verification and reset mails: see G-250.
