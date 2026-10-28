# ADR-127: Choose the backend, sign-in provider and database

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-126
- Design: n/a
- Backlog: N128
- Acceptance: light
- Answers: 2026-10-28, the user answered every open question (below)

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
licence and telemetry posture for any client SDK shipped in the bundle. The vendor, region and owner are in the answers below.

**Answers (user, 2026-10-28):**

- **Supabase** (G-217), in an **EU region** (G-218), under **the user's personal account**, who holds the keys (G-219).
- Before building, every Supabase fact used (free quota, idle pause, prices, client SDK licence and telemetry, email limits) is checked on Supabase's own pages and recorded here with URL and date (G-220).

## Alternatives considered

Supabase was picked (G-217); the others stay listed.

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

- [x] The Supabase facts used are cited with URL and date in this ADR (G-220).
- [x] The picked client SDK's licence and telemetry are checked and recorded (no telemetry allowed, ADR-126).
- [x] The vendor's server-side access rules are written down for ADR-128's tables.

## Implementation (2026-10-28)

Supabase (G-217), EU region (G-218), the owner's personal account (G-219). Facts (G-220), from a web search on
2026-10-28 citing https://supabase.com/pricing and https://supabase.com/docs/guides/auth/rate-limits;
supabase.com itself was not reachable from the build session, so they are **not checked on the page**: free plan 500
MB database, 1 GB file storage, 50,000 monthly active users, 2 active projects, free projects pause after 1 week of
inactivity (restorable, no data deleted), Pro $25 per month; the built-in email sender sends only to the project
team, about 2 emails per hour (G-270). Client: `@supabase/supabase-js` 2.118.0 and its five packages, all MIT (npm
registry, 2026-10-28); their code holds no analytics or beacon endpoint; it sends a version header to the project's
own API only. Rules: `supabase/migrations/20261028000000_accounts.sql`; setup steps: `docs/supabase-setup.md`. No
project exists yet (G-271).

## Open questions

- None open. Answered 2026-10-28, one by one: G-217 Supabase; G-218 EU region; G-219 the user's personal account; G-220 verify vendor facts first.
