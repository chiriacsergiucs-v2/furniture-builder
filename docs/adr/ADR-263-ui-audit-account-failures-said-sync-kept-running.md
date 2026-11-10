# ADR-263: UI audit — Account: a failed account action is said, and uploads keep running

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: none
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 17, **Account** (`src/ui/info/features.ts:1370-1392`). The full
sub-flow map (8 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-17-account.md](../research/ui-audit-17-account.md).

Summary of the map: everything starts from the top bar's Account button (`src/ui/Account.tsx:31-51`), shown only in a
build with a backend; the dialog's states live in `src/ui/AccountDialog.tsx:71-359` and act through
`src/store/accountActions.ts`, which loads `src/online/client.ts` by a dynamic import only (ADR-126). Item actions
sit in each row's ☁ menu (`Account.tsx:107-148`). All are reachable at 390 and 1280 px. The reproductions ran against
the in-memory backend with `fetch` stubbed to throw; no request left the tests.

The sign-in forms already say every failure (`accountActions.ts:57-70`). Two account actions outside them do not, and
one failure silently stops the automatic upload that
[ADR-137](../adr-done/ADR-137-save-your-templates-and-pieces-in-your-account.md) promises.

## Findings

| Id     | Class        | Severity | Finding                                                                                                                                                      |
| ------ | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D17-F1 | Proven       | major    | A failed Delete my account stops automatic upload for the visit (`client.ts:585-588`); reproduced: a new save not uploaded after 4 s, status still "idle".   |
| D17-F2 | Proven       | major    | **Keep on this device only** fails without a word when the server cannot be reached (`Account.tsx:140`, `accountActions.ts:144-148`); unhandled rejection.   |
| D17-F3 | Proven       | minor    | **Stop sharing** fails without a word and a failed list hides the section (`AccountDialog.tsx:458-483`). Moved to ADR-262.                                   |
| D17-F4 | Proven       | minor    | Reset password: the mismatch alert stays after the fix, and Confirm's `aria-describedby` points to an element not rendered (`AccountDialog.tsx:83,227-255`). |
| D17-F5 | Rejected     | —        | Reset password offline has no offline line and an enabled button (`AccountDialog.tsx:221-271`); see Cross-examination.                                       |
| D17-F6 | Code-evident | minor    | The conflict copy is named with a fixed English suffix "(from your account)" outside `t()` (`client.ts:278`).                                                |

## Decision

One rule for the account: **an account action that fails says so where the user tapped, and never leaves the
automatic upload stopped while the user is still signed in.**

1. **F1:** `client.deleteMyAccount` stops the automatic sync only after the server confirms the deletion
   (`client.ts:585-597`): `stopAutoSync()` moves inside `if (r.ok)`, and a thrown request leaves it running. The
   dialog keeps showing the error, as today.
2. **F2:** `AccountRowActions` awaits `setDeviceOnly` and catches: on failure the row menu shows a `role="alert"`
   line "It could not be taken out of your account. Check your connection and try again." (`t()` with its Russian
   entry), and the badge stays as it is. Same for **Save to account**, which does not fail today but shares the
   handler.
3. **F3:** moved to ADR-262 (Saving, backup and sharing), which owns share links (`features.ts:1361`).
4. **F4:** typing in New password or Confirm clears `mismatch`; the mismatch alert gets `id="acct-mismatch"` and
   Confirm's `aria-describedby` points to it (`Field` takes the id of its error).
5. **F5:** no change (rejected in the cross-examination).
6. **F6:** the copy's name is `t('{name} (from your account)', { name })` with its Russian entry; names already
   stored stay as they are (user data, ADR-012).

## Alternatives considered

- **F1: restart the automatic sync after a failure** (`startAutoSync()` in the catch) — works, but runs one extra
  sync at once; not stopping it until success is simpler and has no window.
- **F2: optimistic badge "Only on this device", undone on failure** — flickers, and the item would read as out of the
  account while it is not.
- **F2: report through the top bar's sync status** — the status is about uploads; the user tapped the row, so the
  answer goes there.

## Scope

- In scope: F1, F2, F4, F6 as decided; tests for each.
- Out of scope: F3 (ADR-262); renaming conflict copies already stored; the exact match of the typed email in Delete
  my account (ADR-130 chose typing the email).

## Consequences

- Positive: a signed-in user's saves keep uploading after any failed account action, and no account action fails in
  silence.
- Negative / risks: F2 adds a message line to the row menu; at 390 px it wraps inside the menu. The fixes touch
  `src/online/client.ts` (online code, dynamic import only), not the network boundary: no new origin or request.

## Done when

- [ ] A Delete my account that fails leaves the user signed in with the error, and a piece saved afterwards uploads (test with the in-memory backend offline, then back).
- [ ] Keep on this device only with the server unreachable shows the alert in the row menu, leaves the badge "In your account" and raises no unhandled rejection (test).
- [ ] Reset password: after a mismatch, typing the matching password removes the alert; Confirm is described by the mismatch text (test).
- [ ] A conflict copy is named "{name} (from your account)" in English and with its Russian entry in Russian (test).
- [ ] Find-it test passes from the bare app at phone and desktop widths: the row menu's alert text after Keep on this device only fails.

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates, for behaviour an implemented ADR intends, for
conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                                                        | Proposer                                                                                                                                                                                                                                    | Verdict          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| D17-F1 | A failed delete is rare, and a reload starts the sync again.                                                                   | Rare, but the top bar then says "In your account" for pieces that are not (`Account.tsx:73`), and nothing tells the user to reload. Reproduced with a control: 0 records against 1 without the failed delete. One line moves.               | Accepted         |
| D17-F2 | "Keep on this device only" is undoable and nothing is lost; the item is still in the account, which is the safe side.          | Nothing is lost, but the user asked to take it out of the account and was told nothing (ADR-008: problems are said); the rejection is unhandled. ADR-137 line 34 gives each item the choice, so it must say when the choice did not happen. | Accepted         |
| D17-F3 | Share links are domain 16's feature line (`features.ts:1361`, ADR-138), not the account's.                                     | Agreed: the same fix shape, but it belongs with share links.                                                                                                                                                                                | Moved to ADR-262 |
| D17-F4 | The mismatch is checked again on the next submit; the stale alert is cosmetic.                                                 | The submit with matching passwords still shows "The two passwords are not the same." while it saves, and the field's description points to nothing, against the label-and-invalid rule (brief, ADR-136). Two lines.                         | Accepted         |
| D17-F5 | ADR-136 line 30 disables the **sign-in** buttons offline; the reset form is opened from an email link, so the user was online. | A failed save is not silent: `run()` says "Check your connection and try again." (`accountActions.ts:57-70`). Only consistency is at stake.                                                                                                 | Rejected         |
| D17-F6 | It is a stored name, user data; translating it is the Language domain's job.                                                   | It is text written in code (`client.ts:278`); the translation rule (CLAUDE.md, ADR-153) asks for `t()` at the point it is written, and it is this domain's conflict policy (ADR-129). One key.                                              | Accepted         |

No question needs the user: every accepted fix follows an implemented ADR's rule (ADR-008, ADR-129, ADR-136,
ADR-137, ADR-153). Decided without asking: F2's message sits in the row menu, not the top bar.
