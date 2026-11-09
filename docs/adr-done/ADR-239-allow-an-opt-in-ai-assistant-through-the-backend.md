# ADR-239: Allow an opt-in AI assistant through the backend

- Status: Implemented
- Date: 2026-11-09
- Implemented: 2026-11-09
- Depends on: ADR-126, ADR-127
- Design: docs/ui-design.md (§4, a new _Assistant_ entry when built)
- Backlog: N244

## Context

The user (2026-11-09): "Can i add a chat 'ai agent assistant' just like fusion has, where i write what i want, you do
what i asked for, ask if unclear". Then "Add the remote actions", with the ADR first and no code yet.

This changes two implemented decisions:

- [ADR-002](../adr-done/ADR-002-static-offline-pwa-on-github-pages-no-backend-accounts-cloud.md): "There is no server,
  account, sync, telemetry, remote AI or runtime third-party request." Its context adds that the owner "does not want
  designs leaving the device or any paid dependency".
- [ADR-126](../adr-done/ADR-126-keep-the-core-offline-and-allow-opt-in-online-features.md): "**Still forbidden:**
  telemetry, analytics, error reporters, remote AI, CDNs, remote fonts, ads." and "**Free tier only** (G-213): no
  paid plan".

A language model API is remote AI and is billed per use. This ADR replaces only those two sentences, and only for the
assistant described here. Everything else in ADR-002 and ADR-126 stays: the offline core, `src/online` only, dynamic
import, and no telemetry, analytics, CDN or remote fonts. The user approved both points on 2026-11-09 ("Approve + build + merge", "Yes, approve both").

## Decision

- **Opt-in and signed in.** The assistant appears only in a build with a backend (ADR-127) and only for a signed-in
  user who turned it on (More › Assistant, an on/off switch kept on this device). It is off by default. Signed out,
  offline or switched off, the app makes no assistant request and shows no assistant UI beyond the switch.
- **One origin.** The app sends assistant requests only to the existing Supabase origin (`src/online/origins.ts`),
  to an Edge Function `assistant`. The Edge Function holds the model provider key as a Supabase secret and calls the
  provider. The browser never sees the key or the provider's origin, so `origins.ts` gains no origin.
- **Code location.** All assistant code that sends requests lives in `src/online/assistant/` and is loaded with
  `import()` only when the user opens the assistant. `tests/network-boundary.test.ts` keeps passing unchanged.
- **What is sent.** Per request: the user's message, the earlier messages in this chat, the current design document
  (piece or project, the same JSON as a design file, ADR-011), the selection path, and the action list from
  [ADR-240](../adr-done/ADR-240-let-the-assistant-run-every-editor-action-as-a-previewed-cha.md). Generated geometry, pictures,
  other projects, the catalog and saved data are never sent.
- **Consent.** The first switch-on shows what is sent, to whom (the backend, then the model provider) and that it
  costs money per request. The user must accept before the first request.
- **Server rules.** The Edge Function checks the Supabase session, caps the size of each request (600 000 characters)
  and the number of requests per user per day (`assistant_usage` table and `assistant_take` function,
  `supabase/migrations/20261109000000_assistant.sql`, service role only), and stores no chat or design.
- **Provider and limits** (the user left them open, "No preference"; decided by Claude 2026-11-09): Anthropic,
  model `claude-opus-5-5` at effort `medium` with server-side refusal fallbacks, 50 requests per account per day.
  All three are Edge Function secrets (`ASSISTANT_MODEL`, `ASSISTANT_DAILY_CAP`) the owner can change without a
  new build; the key is `ANTHROPIC_API_KEY`.
- **Failure.** No network, a rejected session, the daily cap reached or a provider error each give a plain message
  in the chat. The design is never changed by a failed request.

## Alternatives considered

- **Each user brings their own API key.** No cost for the owner, but the app would contact the provider's origin
  directly and store a secret on the device. The user picked the backend (2026-11-09).
- **An offline command box** that understands fixed phrases ("width 900"). Keeps ADR-002 intact, but cannot ask
  back or understand free text, which is what the user asked for.
- **An on-device model.** No server, but a download of several GB and weak at using tools on a phone.

## Scope

- In scope: the decision, the switch and consent, the Edge Function contract, the request path, the chat panel shell
  (messages, input, sending state, errors).
- Out of scope: what the assistant can change (ADR-240); voice input; pictures or photos sent to the model; chat
  history kept between sessions; a paid plan for end users.

## Consequences

- Positive: the user can describe a change in words; the offline core is unchanged.
- Negative / risks: designs leave the device when the assistant is used; a running cost for the owner; answers
  depend on a third-party model; the Edge Function needs deploying and monitoring.
- Harder to change later: once users rely on the assistant, removing it is a visible loss.

## Done when

- [x] `tests/network-boundary.test.ts` passes; no module outside `src/online` sends a request.
- [x] With the assistant off, or signed out, a production build makes no request to the `assistant` function (test
      with a fake client).
- [x] The consent text is shown before the first request and the request is not sent until it is accepted (test).
- [x] The request body holds the message, the design document, the selection and the action list, and no geometry
      or pictures (test).
- [x] Each failure (offline, no session, cap reached, provider error) shows its message and leaves the design
      unchanged (tests with a fake client).
- [x] Find-it (jsdom, 390 and 1280 px): More › **Assistant** switch, the consent text, the chat input.
- [x] CLAUDE.md, `docs/architecture.md` and the security-review skill cite ADR-239 next to ADR-126.

## Answers (user, 2026-11-09)

- Lift "no remote AI" (ADR-002, ADR-126) for this opt-in assistant: **yes**.
- A paid model API, replacing "free tier only" (ADR-126, G-213) for the assistant: **yes**.
- Provider, model and daily cap: no preference; decided as above.
