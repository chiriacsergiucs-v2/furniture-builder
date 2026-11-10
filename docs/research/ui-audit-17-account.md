# UI audit 17 — Account: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Account (`src/ui/info/features.ts:1370-1392`, 8 feature lines)
- ADR: [ADR-264](../adr/ADR-264-ui-audit-account-failures-said-sync-kept-running.md)
- Method: code reading with file:line citations; reproductions run as throwaway jsdom tests outside the repo
  (vitest with a scratch config, the in-memory backend `src/online/fake.ts` and `fetch` stubbed to throw, so no
  request left the test). No repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. The account is reached from the top bar's Account button
(`src/ui/Account.tsx:31-51`), shown only in a build with a backend (`src/store/accountStore.ts:77-82`); the dialog's
states are `AccountDialogState` (`src/ui/AccountDialog.tsx:71-359`), loaded on first use (`Account.tsx:204-215`).
Every action loads the online chunk with a dynamic import (`accountStore.ts:125`).

| #   | Feature line (features.ts)                           | Sub-flow: entry → steps → end state                                                                                                                                         | Code                                                                                                                              | Covering test                                                                        | P/D |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --- |
| 1   | Sign in with Google (:1373)                          | Account → Sign in → **Continue with Google** → page leaves → back → `initAccount` → signed in; a failed return says "Google sign-in did not finish."                        | `AccountDialog.tsx:124-131`, `src/store/accountActions.ts:38-55,91-101`                                                          | `tests/account-ui.test.tsx:146,276`, `tests/find-it/accounts.test.tsx`              | P D |
| 2   | Email and password, forgot and reset (:1374)         | Sign in / Create account → email, password → signed in; Forgot password? → Send reset link → Check your inbox; reset link → New password, Confirm → Save new password      | `AccountDialog.tsx:108-271`, `accountActions.ts:57-115`                                                                           | `tests/account-ui.test.tsx:74-145`                                                   | P D |
| 3   | Stay signed in (:1375)                               | Reload or offline start → remembered account shown at once, no request → session checked when online                                                                       | `accountStore.ts:57-115`, `accountActions.ts:38-55`                                                                               | `tests/account-ui.test.tsx:252`                                                      | P D |
| 4   | Save pieces and templates to your account (:1376)    | Signed in → saves upload by themselves; row ☁ → **Keep on this device only** / **Save to account**; Home → **In your account** → Open                                      | `src/online/client.ts:197-352,354-372,384-397,409-457`, `Account.tsx:107-148,151-202`                                             | `tests/account-ui.test.tsx:178`, `tests/sync.test.ts`, `tests/find-it/accounts.test.tsx` | P D |
| 5   | Sync status (:1383)                                  | Top bar status → Uploading… / Waiting… / Upload failed — Retry / In your account; badges per item; Account panel line and **Sync now**                                    | `Account.tsx:54-104`, `AccountDialog.tsx:389-405`, `accountActions.ts:140-142`                                                    | `tests/account-ui.test.tsx:178`, `tests/find-it/accounts.test.tsx`                  | P D |
| 6   | Conflicts never lose work (:1384)                    | Edited on two devices → both kept, the account's as a copy → "Kept both: n" → shown in the Account panel → cleared when it closes                                          | `client.ts:263-293`, `Account.tsx:69-70`, `AccountDialog.tsx:371-376,396-399`                                                     | `tests/sync.test.ts`                                                                 | P D |
| 7   | Several accounts on one device (:1385)               | Account → **Switch to {email}** / **Add another account** → signs out, keeps copies → Sign in with the email filled; "Used on this device:" with Forget                     | `AccountDialog.tsx:337-356,407-425`, `accountActions.ts:118-138`, `accountStore.ts:102-122`, `client.ts:491-506`                  | `tests/account-ui.test.tsx:189`, `tests/sync.test.ts`                                | P D |
| 8   | Privacy notice, data export and account deletion (:1386) | **Privacy notice** (sign-in links or panel); **Export my data** → .zip; **Delete my account** → type the email → account gone, device rows stay                          | `AccountDialog.tsx:301-329,431-445,498-562`, `accountActions.ts:150-175`, `client.ts:564-597`                                     | `tests/account-ui.test.tsx:154,203`                                                  | P D |

## Bug hunt

Each check was applied to every sub-flow: empty / error / offline / storage failure / reload, double tap, edge input,
i18n, accessibility (role, label, focus, invalid state), 390 px, ADR-008, selector stability, persistence, and the
network boundary (ADR-002, ADR-126). Only what failed is listed. Classes: **Proven** (reproduced, output quoted),
**Code-evident** (cited, not run), **Suspected**.

### D17-F1 — A failed Delete my account stops uploads for the rest of the visit, and the status still says all is in the account (Proven, major)

`client.deleteMyAccount` calls `stopAutoSync()` before it asks the server (`client.ts:585-597`); when the request
fails, nothing starts it again (`accountActions.ts:164-175`). The user stays signed in with the error shown, but later
saves are no longer uploaded, and the last status stays "idle".
Reproduction: signed in → Delete my account → email typed → connection lost (fake server offline) → Delete →
`D17-F1 after failed delete: signed in true alert "Check your connection and try again."`; connection back, a new
piece saved, 4 s later: `D17-F1 records in the account 4 s after a new save: 0 sync state idle waiting 0`. The top bar
reads "In your account" (`Account.tsx:73`) for a piece that is not. Control, same steps with no failed delete:
`D17-F1 control: records 4 s after a save with no failed delete: 1`.

### D17-F2 — Keep on this device only fails without a word when the server cannot be reached (Proven, major)

The row menu calls `void setDeviceOnly(...)` (`Account.tsx:135,140`); `accountActions.setDeviceOnly` has no catch
(`accountActions.ts:144-148`) and `client.setDeviceOnly` throws when the server cannot be reached
(`client.ts:384-397`). Reproduction, connection lost: `D17-F2 Keep on this device only offline: badge "In your
account" alerts 0 unhandled ["Check your connection and try again."]`. The user is told nothing; the item stays in the
account they asked to take it out of. ADR-008 asks that problems be said, not swallowed. **Save to account** only
drops the local link and queues a sync (`client.ts:396-397`), so it does not fail this way.

### D17-F3 — Stop sharing fails without a word; a failed list hides the section (Proven, minor; FLOW 02: moved to ADR-263)

`SharedLinks` awaits `stopShare` with no catch (`AccountDialog.tsx:480-483`) and turns a failed list into an empty one
(`AccountDialog.tsx:458-463`), which hides the section (`:469`). Reproduction: `D17-F3 Stop sharing offline: still
listed true alerts [] unhandled ["Check your connection and try again."]` — the link keeps working while the user
believes it stopped. Share links are feature line `features.ts:1361` (Saving, backup and sharing, domain 16).

### D17-F4 — Reset password: the mismatch alert outlives the fix, and Confirm points to a missing element (Proven, minor)

`mismatch` is set on submit and never cleared (`AccountDialog.tsx:83,227-230,251-255`); the Confirm field is marked
with `error={mismatch ? 'x' : null}`, so its `aria-describedby` is `acct-error` (`AccountDialog.tsx:54,249`), the id of
the server error paragraph (`:92`), which is not rendered. Reproduction: `D17-F4 confirm aria-describedby acct-error
target exists false`, then after typing the matching password: `D17-F4 after fixing confirm: mismatch alert shown true
confirm aria-invalid true`. A screen reader hears no reason for the invalid field, and the alert is untrue once the two match.

### D17-F5 — Reset password offline has no offline line and an enabled button (Proven, minor; FLOW 02: rejected)

The other forms show the offline line and disable their buttons offline (`AccountDialog.tsx:123-127,156,185,198`,
ADR-136 line 30); the reset form does neither (`:221-271`). Reproduction: `D17-F5 reset offline: offline line false
Save enabled true`. A save attempted offline is answered by `run()` with "Check your connection and try again."
(`accountActions.ts:57-70`).

### D17-F6 — The conflict copy is named with a fixed English suffix (Code-evident, minor)

`client.ts:278` names the account's copy `${a.remote.name} (from your account)`, outside `t()`, with no Russian entry
(`grep` finds the text only there). A Russian user gets an English suffix stored in the piece's name; the translation
rule (CLAUDE.md, ADR-153) asks that every text written in code go through `t()`.

## Checked, no finding

- Network boundary: every account action reaches the online code through `online()` (`accountStore.ts:125`), a
  dynamic import; the reproductions stubbed `fetch` to throw and nothing called it.
- Selectors in `Account.tsx` and `AccountDialog.tsx` return store fields or primitives; `others` is filtered in the
  component, not in a selector (`AccountDialog.tsx:369`).
- Sign out offline forgets the session anyway and keeps device rows (`accountActions.ts:118-132`); Switch and Add
  another account sign out first, as ADR-142 says ("A switch signs out", ADR-142 line 54).
- Server error texts are mapped to `t()` sentences (`src/online/supabase.ts:51-58`); offline lines and disabled
  buttons on Sign in, Create account, Forgot and Delete (`AccountDialog.tsx:127,156,198,321`).
- Delete my account needs the email typed exactly (`AccountDialog.tsx:321`); ADR-130 line 30 chose typing the email
  as the confirmation, so the exact match is intended.
- Each dialog state remounts with empty password fields (`Account.tsx:212`), and `setDialog` clears the error
  (`accountStore.ts:96`).
