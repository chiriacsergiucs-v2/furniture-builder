# ADR-136: Sign-in screens: log in, log out, forgot and reset password

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-127, ADR-130, ADR-131, ADR-135
- Design: docs/ui-design.md (tokens; Dialog, Button, `.input`, Alert, Status, top bar)
- Backlog: N137
- Acceptance: light

## Context

The user asked (2026-10-28): "New adr for ui login (including gmail)/logout/forgot password/reset password".
Google sign-in is ADR-135; email/password, verification and reset mails come from the provider (ADR-127) and need
an email sender (G-250).

## Decision

**Entry point** (place: G-251): an icon button with `aria-label="Account"`; signed in, it shows the initial.

**States and copy** (one `Dialog`, title `--fs-xl`, body gap `--s-4`, controls `--control-h`):

| State           | What shows                                                                                                                                                                                                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logged out      | "Sign in to save your pieces and templates to your account. Everything still works on this device without an account." **Continue with Google** (`outline`, block); "or"; Email, Password (`.input`); **Sign in** (`primary`); links **Forgot password?**, **Create account** (only if G-252 is answered yes), **Privacy notice** |
| Logging in      | Sign in button `loading`; fields disabled                                                                                                                                                                                                                                                                                         |
| Error           | `.alert.error`: "Email or password is wrong." / "Check your connection and try again." Fields keep their text                                                                                                                                                                                                                     |
| Logged in       | Name and email; **Sign out** (`outline`); **Export my data**, **Delete my account** (ADR-130)                                                                                                                                                                                                                                     |
| Offline         | `.alert.info`: "You are offline. Your designs still work on this device." Sign-in buttons disabled                                                                                                                                                                                                                                |
| Forgot password | Email; **Send reset link**; then "If an account exists for <email>, we sent a link. Check your inbox." (same text whether or not it exists)                                                                                                                                                                                       |
| Reset password  | Opened from the mail link: New password, Confirm; **Save new password**; "Password changed. You are signed in." Expired link: "This link has expired. Ask for a new one." with **Send a new link**                                                                                                                                |
| Signing out     | "Sign out of <email>? Your designs stay on this device." **Sign out** / **Cancel** (local copies: ADR-129, G-227)                                                                                                                                                                                                                 |

**Layouts.** 390 px: the dialog fills the screen (`--s-4` side padding), buttons full width, no horizontal scroll.
1280 px: a centred dialog `--out` (400 px) wide, `--shadow-3`, `--backdrop`. Both light and dark tokens; focus
ring visible on every control; errors linked with `aria-describedby`.

The reset link returns to the app's base URL with the provider's token in the fragment; the app clears the
fragment after reading it (as ADR-124 does for `#open=`).

## Alternatives considered

- **A separate sign-in page** — the app is one screen with dialogs; a dialog keeps the open design visible.
- **Magic-link email only, no password** — the user asked for forgot and reset password.

## Scope

- In scope: every state above, copy, both layouts, tests and the browser find-it.
- Covered elsewhere: Google flow (ADR-135), privacy actions (ADR-130), session persistence (ADR-134, ADR-131).

## Consequences

- Positive: one dialog for every account action.
- Negative / risks: reset mails depend on an email sender's deliverability.

## Done when

Light acceptance (user 2026-10-28: "update all adrs te be light", ADR-066): find-it items wait for a
catch-up run.

- [ ] Each state's copy above renders in jsdom from a fake provider (tests).
- [ ] Forgot password shows the same text for a known and an unknown email (test).
- [ ] Reset with an expired token shows the expired text and **Send a new link** (test).
- [ ] Sign out keeps every local row (store test).
- [ ] Browser find-it on the production build at 390 and 1280 px: Account › "Sign in", "Forgot password?",
      "Send reset link", "Sign out"; no horizontal scroll at 390 px; focus visible (light — catch-up).
- [ ] Screenshots at 390 and 1280 px shown to the user before tests (standing rule).

## Open questions

- Email sender for verification and reset mails: the backend's built-in email (limits unknown), or your own SMTP
  sender (e.g. Brevo, Resend, Amazon SES; facts unknown)? Suggested: your own sender (+10 %) (G-250).
- Where Account sits: top bar, ⋯ menu, or Settings? Suggested: top bar (+3 %) (G-251).
- Include Create account with email and password? Suggested: yes (+10 %) (G-252).
- Password rule: provider default or your minimum length? Suggested: provider default, shown under the field
  (G-253).
- Require email verification before the first sign-in? Suggested: yes (+5 %) (G-254).
