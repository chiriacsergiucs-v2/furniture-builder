# ADR-233: Extend the network boundary test and share one https origin rule

- Status: Pending
- Date: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N238

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-15** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

`tests/network-boundary.test.ts` (ADR-126) catches `fetch`, XHR, WebSocket, `sendBeacon`, `EventSource` and static
`src/online` imports, but not `new Image(` with a remote URL, a remote `src=`, `import('https://…')`,
`navigator.serviceWorker` outside the PWA registration, or `@supabase` imported outside `src/online`. And two rules
for "is the backend configured" disagree: `backendConfigured` in `src/store/accountStore.ts` (a regex, key required)
and `onlineConfigured` in `src/online/origins.ts` (`new URL`, key not required), e.g. on `"https://"` alone.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- `tests/network-boundary.test.ts` gains patterns, applied to every `src` file outside `src/online`: `new Image(`
  followed by an `http(s)` literal, `src=` / `src:` with an `http(s)` literal, `import('http`, `@supabase`, and
  `navigator.serviceWorker` outside the one PWA registration file (allowlisted by path). Its self-check covers each.
- `isHttpsOrigin(url)` in `src/core/origin.ts` (pure, no network): true only for a parseable `https:` URL with a host.
  `onlineOrigins` and `backendConfigured` both use it; `backendConfigured` keeps requiring the key, as
  `client.ts` already does at connect time.
- The `dist` assertion for `createClient` in `index` lives in ADR-222's bundle test; this ADR does not duplicate it.

## Alternatives considered

- **Make `backendConfigured` import `src/online/origins`** — a static import of `src/online`, forbidden by ADR-126.
- **Scan only `dist`** — misses a remote load added in a lazy chunk's source until build time.
- **Leave the two rules** — a build with `"https://"` shows Accounts as available and fails on connect.

## Scope

- In scope: the extended patterns and self-checks, `isHttpsOrigin`, its two callers.

## Consequences

- Positive: more of ADR-126's promise is checked; one origin rule.
- Negative / risks: a false positive on a literal URL in a comment or a link (`href` is not matched; comments are
  stripped before matching).
- Harder to change later: nothing.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [ ] (test first) self-check cases for each new pattern (a remote `new Image`, `src="https://…"`,
      `import('https://…')`, `@supabase`, `navigator.serviceWorker`) fail before the patterns exist, pass after; the
      scan of today's `src` stays empty.
- [ ] (test first) a fixture-URL table (`undefined`, `''`, `https://`, `http://x.co`, `not a url`,
      `https://x.supabase.co`) gives the same answer from `onlineOrigins(...).length > 0` and from `isHttpsOrigin`;
      `backendConfigured` is false without a key.
- [ ] `tests/accounts*` and `find-it/accounts.test.tsx` pass unchanged.
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).
