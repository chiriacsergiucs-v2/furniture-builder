# ADR-131: Secure sessions, content security policy and online requests

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-127
- Design: n/a
- Backlog: N132
- Acceptance: browser

## Context

Online features (ADR-126) add a sign-in session, requests to a backend and share links. The security-review
skill's checklist was run on `main` 253a488 for this ADR (2026-10-28, read-only):

- Network boundary: no `fetch`, XHR, WebSocket or `sendBeacon` in `src/` (grep) — confirmed.
- Injection: one `innerHTML` (`src/main.tsx:28`, a constant string) — confirmed, not variable; no `eval`,
  `new Function` or `dangerouslySetInnerHTML`.
- Service worker: Workbox `globPatterns` lists only own files; no `runtimeCaching` (`vite.config.ts`) — confirmed.
- **Finding (Low, hardening, confirmed):** `index.html` has no Content-Security-Policy. Today harmless; with a
  session token on the device, any injected script could read it.
- Secrets: no `.env` or secret files tracked (`git ls-files`). Not run: `pnpm audit` (needs the network) and the
  `dist/` origin scan (needs a build).
- Untrusted input gains a new source: server bodies and shared items (handled by ADR-128's validation).

## Decision

Settled:

- **CSP meta tag** in `index.html` (GitHub Pages cannot set headers): `default-src 'self'`; `connect-src 'self'`
  plus only the backend origins of ADR-127; `img-src 'self' data: blob:`; `object-src 'none'`; `base-uri 'self'`;
  `form-action 'self'`. Exact values are found by running every screen of the production build with no CSP
  violation in the console.
- **No secret in the bundle.** Only the vendor's public client key ships; every access rule is enforced on the
  server (ADR-128). A service or admin key in `src/` or `dist/` fails CI (grep test).
- **Service worker never caches online responses:** no `runtimeCaching` entry for backend origins; sign-out clears
  the session and any in-memory account data.
- **Share links** use unguessable ids (at least 128 random bits, from the server or `crypto.getRandomValues`);
  opening and creating them is rate-limited on the server (values: G-235).
- **Untrusted text** from the server renders as text only; downloaded bodies are validated (ADR-128).
- **Dependencies:** the vendor SDK passes `pnpm audit --omit=dev` and the licence and telemetry check (ADR-127).

## Alternatives considered

- **No CSP** — the session token would be one injected script away from theft.
- **Own proxy server for httpOnly cookies** — a second backend to run; see G-234.

## Scope

- In scope: CSP, session storage rule, SW rule, secret scan, share-link id and rate-limit rules.
- Covered elsewhere: share access model (ADR-132), privacy (ADR-130).

## Consequences

- Positive: the first network feature ships with a CSP and a secret scan.
- Negative / risks: a too-strict CSP can break 3D or pictures; the browser check catches it.
- Harder to change later: none beyond the vendor choice.

## Done when

- [ ] Production build: every screen opens with zero CSP violations (browser script, 390 and 1280 px).
- [ ] Signed out, the production build requests only its own origin (browser script).
- [ ] CI test fails on a service-role or secret key pattern in `src/` or `dist/`.
- [ ] Sign-out clears the stored session; a reload shows signed out (browser script).
- [ ] The SW precache list and runtime routes contain no backend origin (test on the build manifest).

## Open questions

- Session storage: IndexedDB or localStorage on the device, memory only, or an httpOnly cookie (needs a server on
  the same site)? Suggested: device storage behind the CSP, closest to "login using that persistent storage" (G-234).
- Rate-limit values per account and address? Suggested: vendor defaults for sign-in; share-link limits once the
  vendor is known (G-235).
