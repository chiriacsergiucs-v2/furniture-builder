# ADR-135: Sign in with Google

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-127, ADR-130, ADR-131
- Design: docs/ui-design.md (Button `outline`, Dialog)
- Backlog: N136
- Acceptance: light
- Answers: 2026-10-28, the user answered every open question (below)

## Context

The user asked (2026-10-28): "New adr for gmail login". Gmail is Google's mail service; the login meant here is
**Sign in with Google** (OAuth 2.0 / OpenID Connect), which works for any Google account, including ones without a
Gmail address. It runs through the sign-in provider chosen in ADR-127; the app never sees the Google password.

## Decision

Settled:

- A **Continue with Google** button in the sign-in dialog (ADR-136) starts the provider's Google flow.
- Scopes are only what sign-in needs: `openid`, `email`, `profile`. No Gmail, Drive or contacts access.
- The return address is the app's own base URL (`https://chiriacsergiucs-v2.github.io/furniture-builder/`, and
  the local preview URL for development); no other redirect URL is registered.
- On return, the app shows the account name and email; a cancelled or failed sign-in shows "Google sign-in did not
  finish. Try again." and leaves the app as it was.
- The privacy notice (ADR-130) is linked under the button before the flow starts.
- Offline, the button is disabled with "You are offline. Sign in when you are back online."

**Answers (user, 2026-10-28):**

- **Full-page redirect** (G-247).
- The user registers the Google OAuth client and consent screen under their personal account (G-248).
- **No account linking** (G-249, revised 2026-10-28 with G-254): a Google login and a password login with the same email stay separate accounts. Emails are not verified, so linking them would let anyone take over a Google user's account.

## Alternatives considered

- **Google Identity Services script loaded directly** — a third-party script from Google's origin in the page;
  the provider's flow keeps the allowed origins to ADR-127's backend plus Google's sign-in pages.
- **Email/password only** — the user asked for Google sign-in.

## Scope

- In scope: the button, the flow, error and offline states, redirect registration, tests.
- Covered elsewhere: the dialog and other screens (ADR-136), session storage (ADR-131).

## Consequences

- Positive: no password to remember for Google users.
- Negative / risks: depends on Google and on the provider; an OAuth consent screen must be kept up to date.
- Harder to change later: account identity tied to Google's subject id.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [x] Only `openid email profile` are requested (unit test on the request built for the provider).
- [x] Cancel and failure leave the app unchanged and show the message (test with a fake provider).
- [x] Offline: the button is disabled with the offline text (jsdom test).
- [ ] Browser find-it on the production build at 390 and 1280 px: "Continue with Google" is reachable from the bare
      app and starts the flow (provider stubbed or a test project) (light — catch-up).

## Implementation (2026-10-28)

Continue with Google → Supabase OAuth, full-page redirect (G-247), PKCE, scopes `openid email profile`, back to
the app's URL; `?error_description=` on return shows "Google sign-in did not finish. Try again." No account
linking (G-249, revised with G-254). The Google OAuth client is the owner's to register (G-248, G-271). Tests:
`tests/supabase-adapter.test.ts`, `tests/account-ui.test.tsx`.

## Open questions

- None open. Answered 2026-10-28, one by one: G-247 redirect; G-248 the user registers the OAuth client; G-249 revised: no linking.
