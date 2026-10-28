# ADR-135: Sign in with Google

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-127, ADR-130, ADR-131
- Design: docs/ui-design.md (Button `outline`, Dialog)
- Backlog: N136
- Acceptance: browser

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

- [ ] Only `openid email profile` are requested (unit test on the request built for the provider).
- [ ] Cancel and failure leave the app unchanged and show the message (test with a fake provider).
- [ ] Offline: the button is disabled with the offline text (jsdom test).
- [ ] Browser find-it on the production build at 390 and 1280 px: "Continue with Google" is reachable from the bare
      app and starts the flow (provider stubbed or a test project).

## Open questions

- Full-page redirect or popup? Suggested: redirect, works in the installed app and on phones (G-247).
- Who registers the Google OAuth client and consent screen (requirements unknown)? Suggested: you, under the
  ADR-127 account (G-248).
- Same email by Google and by password: link when verified, keep separate, or ask? Suggested: link when verified
  (G-249).
