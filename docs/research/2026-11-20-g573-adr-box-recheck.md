# G-573 re-check of unchecked Done-when boxes in implemented ADRs — 2026-11-20

User pick 2026-11-20: "Re-check each box" for the 35 unchecked `- [ ]` Done-when items, without a G id, in 22
implemented ADRs. Implemented ADRs are not edited (CLAUDE.md), so the result is recorded here and in backlog row N363.

Runs, all in this session on 2026-11-20, against `main` 6199b1bc plus the script fixes on this branch:

- jsdom: `pnpm exec vitest run tests/find-it/catch-up-editor.test.tsx tests/find-it/accounts.test.tsx
  tests/find-it/selected-piece.test.tsx tests/find-it/gaps-ratings.test.tsx tests/find-it/lazy-pages.test.tsx` — 5
  files, 18 tests passed; `tests/ui-mode.test.ts` — 3 passed.
- Browser, production build with the test backend (`VITE_SUPABASE_URL=https://catchup-test.supabase.co`), `vite preview`:
  `tools/catch-up/find-it.mjs` 98 PASS, 0 FAIL (390, 1280, 1600 px); `tools/editor-modes/find-it.mjs` 165 PASS, 0 FAIL;
  `tools/plan-snap/find-it.mjs` 51 PASS; `tools/plan-drag/find-it.mjs` 28 PASS; `tools/home/find-it.mjs` 64 PASS;
  `tools/room-surfaces/find-it.mjs` 71 PASS.
- Script repairs needed first: both browser scripts had gone stale with the navbar change 234f34d (the Account button is
  now named "Account, <state>", the `.sync-status` element is gone, and "Build & Preview" and the phone's "Cut list" are
  named "Cut List"). `tools/catch-up/find-it.mjs` also gained the missing ADR-131 check: sign out, reload, still signed out.

Result: **22 of 35 met**, 13 open. "Met as renamed" means the behavior holds under a later name, and gives the change
that renamed it.

| ADR | Box (short) | Result | Evidence |
| --- | --- | --- | --- |
| ADR-080 | Info buttons replace captions; open on hover/tap, close on outside tap or Esc | Open: buttons and text met; closing not re-checked | catch-up-editor (jsdom) finds "About the plan" and "About the front view"; plan-snap shows their text at 375 and 1440 px |
| ADR-080 | No Snap status line; "Pieces go exactly where dropped."; "Snaps:" while dragging | Met | plan-snap: "with Snap off … Pieces go exactly where dropped.", "Snaps: … joins Base cabinet", "gone after release" |
| ADR-080 | At 390 × 844 in a project's Compose, the plan and the front view are both fully visible | Open: not re-checked | no check found in any script |
| ADR-080 | The mode control shows Compose and Build & Preview; stored `fb:mode` = `configure` opens Compose | Met as renamed (Cut List, 234f34d) | editor-modes "modes Compose · Cut List visible", phone "places Editor · Cut List"; `tests/ui-mode.test.ts` 3 passed |
| ADR-080 | Settings modal has Width, Construction, Add a material, Drawers; changing Width updates the drawing | Open: modal contents met; the Width change not re-checked | editor-modes "Settings shows Width", "Construction", "Drawers and runners", "Add a material" |
| ADR-080 | Every row has Settings for <name>; a change there shows after reopening | Open: button met; change and reopen not re-checked | catch-up-editor finds `Settings for <name>` |
| ADR-080 | An invalid value shows its error, is not clamped, and blocks Download CSV | Open: error and block met; "not clamped" not re-checked | editor-modes "Checks shows the error", "Download CSV and Print disabled with an error" |
| ADR-081 | 1280 px: View switch with Front, 3D, Both; Both shows both | Met as renamed (2D, ADR-144) | catch-up "View reads 2D · 3D · Both", "Both shows 2D and 3D" |
| ADR-081 | In a project: Plan, 3D, Both | Open: not re-checked in a project | catch-up checks the switch on a single piece only |
| ADR-081 | ≥ 1500 px: Both by default; Front removes the canvas | Open: default met; canvas removal not re-checked | catch-up "Both from 1500 px" |
| ADR-081 | 390 px Build & Preview: 3D selected; Compose has no switch | Met as changed (ADR-144: 2D below 1500 px, a switch in Compose) | catch-up "default view: 2D below 1500 px", "Compose: View reads 2D · 3D · Both" |
| ADR-081 | No horizontal scroll at 360 and 390 px | Met | catch-up and editor-modes "no horizontal/sideways scroll" at 360 and 390 px |
| ADR-111 | Find-it: Add a linked copy, Linked: 2 copies, Change all copies | Met | catch-up-editor (jsdom) |
| ADR-116 | Heading scale at 390 and 1280 px | Met | catch-up "N115 headings: h1 24, h2 20, h3 17" |
| ADR-116 | Find-it from the bare app | Met | catch-up (browser) |
| ADR-120 | The nine items are visible at 390 and 1280 px | Met, except the Turn buttons, which ADR-160 removed | catch-up-editor (jsdom), N119 checks |
| ADR-120 | Find-it from the bare app | Met | catch-up-editor (jsdom) |
| ADR-129 | jsdom: first-sign-in question and a Conflict state | Open: Conflict met ("Kept both"); first-sign-in question in no test | accounts (jsdom) |
| ADR-130 | jsdom: Privacy notice, Export my data, Delete my account | Met | accounts (jsdom) |
| ADR-131 | Sign-out clears the stored session; a reload shows signed out | Met (new check) | catch-up "N132 Sign out clears the stored session; a reload shows signed out" at 390, 1280 and 1600 px |
| ADR-133 | Browser: Saved data, Choose backup folder | Met | catch-up "N134 Settings › Saved data: Choose backup folder → Last backup:" |
| ADR-134 | Browser: the chosen reading's text | Met | catch-up "N135 offline start shows the remembered account" |
| ADR-135 | Browser: Continue with Google from the bare app | Met | catch-up "N136" |
| ADR-136 | Browser: Sign in, Forgot password? | Met | catch-up "N137 Forgot password? → Send reset link" |
| ADR-137 | jsdom: sign in, Save to account, In your account | Open: In your account met; "Save to account" in no test | accounts (jsdom) |
| ADR-138 | jsdom: Share link, Copy link, Open a copy | Met | accounts (jsdom) |
| ADR-139 | Browser: status visible, no horizontal scroll | Met | catch-up "N140 the sync status is in the top bar — Account, In your account" |
| ADR-140 | Browser: only on this device, Back up | Met | catch-up "N141" |
| ADR-141 | jsdom: Last backup:, Back up now, interval | Met | accounts (jsdom) "Last backup:", "Remind me to back up"; catch-up "Back up now" |
| ADR-142 | Browser: Add another account, switch, back | Open: button met; switch and back not re-checked | catch-up "N143" |
| ADR-143 | Browser: preview, Open a copy, no horizontal scroll | Met | catch-up "N144" |
| ADR-144 | Browser: the View switch in Compose and Build & Preview | Met | catch-up "N145" |
| ADR-201 | A core-only PR runs the `--changed` tests (run id, time) | Open: no core-only PR has merged since ADR-201 | `git log` of merges since 2026-11-06 shows none touching only `src/core/` and docs |
| ADR-208 | Render shows Engine: WebGPU with an adapter, WebGL 2 without, both 8 samples | Open: WebGL 2 met; WebGPU needs a browser with an adapter | room-surfaces "Engine: WebGL 2", "8 samples"; "this browser has no WebGPU adapter" |
| ADR-208 | View in AR on an Android phone and AR Quick Look on an iPhone | Open: needs the user's phones | — |
