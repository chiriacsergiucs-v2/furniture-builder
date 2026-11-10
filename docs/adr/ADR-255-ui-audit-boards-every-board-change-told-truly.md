# ADR-255: UI audit — Boards and edges: every board change is told truly and every field names its board

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: none
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 08, **Boards and edges** (`src/ui/info/features.ts:639-750`). The full
sub-flow map (21 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-08-boards.md](../research/ui-audit-08-boards.md).

Summary of the map: boards are set from two places, the header bar's **Material** dialog
(`src/ui/MaterialDialog.tsx:85-506`, button `src/ui/App.tsx:805-806`) and **Settings → Boards, sheets and saw cut**
(`src/ui/Dialogs.tsx:470-740`, band editor `src/ui/BoardBand.tsx`, seller picker `src/ui/SellerLinks.tsx:36-98`).
Common top, bottom and shared sides sit on the selection card (`src/ui/Selection.tsx:248-318`). All are reachable at
390 and 1280 px.

[ADR-244](../adr-done/ADR-244-report-every-refused-edit-truthfully.md) made Apply material report a lock truthfully.
Two buttons in the same dialog still say "done" when a lock refuses them, and several fields are not tied to their
board or their problem.

## Findings

| Id      | Class           | Severity | Finding                                                                                                                                              |
| ------- | --------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| D08-F1  | Proven          | major    | "Use its group's board again" and lost-part "Clear" say done on a boards-locked piece (`MaterialDialog.tsx:375-399`, `designStore.ts:1852-1870`).    |
| D08-F2  | Proven          | minor    | Clearing a board's name leaves the field empty and keeps the old name, with no message (`Dialogs.tsx:612-618`).                                      |
| D08-F3  | Proven          | minor    | The lost-part warning shows the internal panel id, e.g. "e0a67cf7/plinth no longer exists…" (`MaterialDialog.tsx:393`).                              |
| D08-F4  | Proven          | minor    | "Your own band…" does not mark a wrong thickness `aria-invalid` and gives no field error (`MaterialDialog.tsx:454-493`); the board band editor does. |
| D08-F5  | Proven          | minor    | Why **Group** is unavailable is only in a `title` tooltip (`MaterialDialog.tsx:298-305,343`); reproduced at 390 px: no visible reason.               |
| D08-F6  | Proven          | minor    | Every board row's Name, Thickness, Sheet length… share one accessible name; 5 "Name" fields for a chest of drawers (`Dialogs.tsx:612-701`).          |
| D08-F7  | Code-evident    | minor    | The band list cannot be removed; the decor list can (`Dialogs.tsx:524-549` vs `:576-590`, `persist/db.ts:494,504-515`).                              |
| D08-F8  | Moved           | minor    | Apply-material and common-panel messages name pieces untranslated (`finish.ts:408-415`, `common.ts:120-131`). Moved to ADR-265.                      |
| D08-F9  | Rejected        | polish   | A repeated Apply material adds an undo step and says "Applied" (`finish.ts:283-293`); see Cross-examination.                                         |
| D08-F10 | Rejected (user) | minor    | "Show seller pictures (online)" off still downloads the seller's picture on **Use this** (`SellerLinks.tsx:41-66`); see User decision.               |

## Decision

One rule for every board control: **a change the app refuses is said as refused, a field shows what is stored, and
every field and problem names its board.**

1. **F1:** `clearPartBoard` returns the refusal (`string | null`), as `commit` and `commitProject` do (ADR-244). The
   dialog shows "Nothing changed: {why}." on refusal and the success line only when the entry is gone; **Clear** on a
   lost part shows the same status.
2. **F2:** on blur with an empty name the field goes back to the stored name and the row says "A board needs a name;
   it keeps {name}." (`role="status"`, `t()` with its Russian entry).
3. **F3:** the lost-part line names no id: "A part this piece no longer builds has its own board; it is not used."
   with **Clear** labelled "Clear the board of a removed part" when several are listed, numbered "(1)", "(2)".
4. **F4:** the own-band thickness input gets `aria-invalid` and a field error with `aria-describedby`, the same text as
   the board band editor ("From 0.1 to 10 mm, one decimal."). No allowance field (ADR-188 names type, thickness, width
   and code only).
5. **F5:** while **Group** is disabled, its reason shows as a visible hint under the scope buttons, and the radio gets
   `aria-describedby` to it.
6. **F6:** each board row becomes `role="group"` with the label "Board {name}" (`tr(m.name)`), so its fields are found
   and announced within their board.
7. **F7:** **Remove band list** beside Import band list, with the same confirm as the decor list; `clearBands` in
   `src/persist/db.ts` clears the table (no schema change). Boards keep the bands already picked.

## Alternatives considered

- **F1: disable the buttons on a locked piece** — hides why; the lock chip already explains, and ADR-244 chose to
  report refusals.
- **F2: allow an empty name** — every list, cut list and print would show a blank board.
- **F3: keep the id and add a label** — the label is not stored once the part is gone; a guessed name could be wrong.
- **F6: a unique label per field ("Name of PAL 18 white")** — longer labels on every field; a named group gives the
  same context once.

## Scope

- In scope: F1–F7 as decided; tests for each.
- Out of scope: translating piece names in core messages (moved to ADR-265); a no-op Apply (rejected); the seller
  picture switch (open question).

## Consequences

- Positive: the Material dialog never contradicts the lock notice; screen-reader users can tell boards apart.
- Negative / risks: `clearPartBoard` changes its return type; its callers in the store and tests follow.

## Done when

- [ ] On a boards-locked piece, "Use its group's board again" and lost-part Clear say "Nothing changed: …" and keep the entry (test).
- [ ] An emptied board name goes back to the stored name with the message, in English and Russian (test).
- [ ] The lost-part warning shows no panel id (test).
- [ ] A wrong own-band thickness is `aria-invalid` with its field error (test).
- [ ] A disabled Group scope shows its reason as visible text tied to the radio (test).
- [ ] Each board row is a group named after its board; Name is found within it (find-it).
- [ ] Remove band list clears the list after a confirm, and the band editor no longer offers it (storage test + find-it).
- [ ] Find-it test passes from the bare app at phone and desktop widths.

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates (of each other and of ADR-248), for behaviour
an implemented ADR intends, for conflicts with the hard rules, for over-engineering and for missing tests.

| Id      | Skeptic                                                                                                            | Proposer                                                                                                                                                                                     | Verdict                             |
| ------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| D08-F1  | The header shows the lock notice, so the user is told.                                                             | The dialog's own status says the opposite ("back to its group's board"); ADR-244 lines 28-30: "A refusal is never counted as applied". Reproduced: entry kept, success line shown.           | Accepted                            |
| D08-F2  | Ignoring an empty name is the safe choice; nothing is lost.                                                        | Nothing is lost, but the field shows a blank the board does not have and no word says why (ADR-008: input is never ignored silently). Restoring the field and one status line is small.      | Accepted                            |
| D08-F3  | ADR-151 only asks that lost parts are listed with Clear.                                                           | ADR-151 line 35 lists them for the user; an internal id is not readable and cannot be translated (ADR-153). Reproduced: "e0a67cf7/plinth".                                                   | Accepted                            |
| D08-F4  | ADR-188 never asked for an allowance in the own band.                                                              | Agreed: ADR-188 lines 41-42 name type, thickness, width, code; the allowance part is dropped. The invalid state stays: the board band editor marks the same field (`BoardBand.tsx:183-205`). | Accepted (narrowed)                 |
| D08-F5  | A tooltip is the usual place for a disabled reason.                                                                | No tooltip on touch, and a disabled button is skipped by the screen reader; the selection card shows its reasons as text (`Selection.tsx:294,315`). Reproduced at 390 px.                    | Accepted                            |
| D08-F6  | Polish; sighted users see the colour swatch and the name beside each field.                                        | `tests/find-it/setup.tsx:7-9` (ADR-224) asks for an accessible name instead of class names; five identical "Name" fields fail it. A named group per row is one attribute.                    | Accepted                            |
| D08-F7  | ADR-212 says a new import replaces the list; removal was not asked.                                                | ADR-212 item 8 says "parsed like" the decor list, which has Remove (ADR-049 lines 34-35). Without it the list stays forever. No schema change: the table exists.                             | Accepted                            |
| D08-F8  | Piece names in core messages are raw everywhere (common, shared, finish); this is not a Boards problem.            | True: the pattern is cross-domain; the Language domain owns how core messages name pieces.                                                                                                   | Moved to ADR-265                    |
| D08-F9  | The board is on those parts, so "Applied" is true; a deep compare of designs to drop the step is over-engineering. | An extra undo step that changes nothing is harmless; no rule is broken.                                                                                                                      | Rejected                            |
| D08-F10 | ADR-161 lines 32-36 intend the download on a pick; the switch is for lists (lines 50-52).                          | Intended today, but it touches the network boundary (ADR-126): whether "off" means no seller request at all is the user's call.                                                              | Rejected (user kept it, 2026-11-10) |

No physical-fact question arose. Decided without asking: F4 keeps ADR-188's four band fields.

## User decision (2026-11-10)

- **D08-F10:** Download the seller picture on a pick, as ADR-161 says (today). No change; the finding is closed.
