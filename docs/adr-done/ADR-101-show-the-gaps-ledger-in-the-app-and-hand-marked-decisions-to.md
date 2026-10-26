# ADR-101: Show the gaps ledger in the app and hand marked decisions to Claude

- Status: Implemented
- Date: 2026-10-26
- Implemented: 2026-10-26
- Depends on: ADR-043, ADR-078, ADR-082
- Design: docs/ui-design.md (section 4, Gaps page)
- Backlog: N99
- Agreed: 2026-10-26 "Add a gaps page, similar to reseaech, then merge"; "Mark + hand to Claude (Recommended)", "Search + status filter, Overview counts, Full detail per gap", "Full find-it (Recommended)"

## Context

User request 2026-10-26, in their words: "Add a gaps page, similar to reseaech, then merge". It builds G-050 ("No
gaps page in the app"), whose request was that ledger items "can be used to add as a new adr or mark as acknowledged
and accepted" ([ADR-082](../adr-done/ADR-082-record-every-unbuilt-item-in-a-gaps-ledger-kept-in-step-with.md)). ADR-082 kept the
ledger as a repo file only and listed a page as out of scope; this ADR adds the page and leaves the file as the
single source of truth.

The app has no backend (ADR-002), so a page cannot change `docs/adr/GAPS.md`. User answers 2026-10-26:

- Actions: **Mark + hand to Claude**: per gap Acknowledge, Make ADR, or a note, saved on the device; a button copies
  the decisions as text to paste to Claude, who applies them to the ledger.
- Parts of Research to copy: **Search + status filter, Overview counts, Full detail per gap** (not grouping by origin).
- Acceptance level: **full** (find-it script, R3).

## Decision

- **Data:** the page shows `docs/adr/GAPS.md` as it was when the app was built (imported as text at build time, no
  network). A pure parser in `src/core/gaps.ts` reads the same `### G-NNN: title` and `- Key: value` lines as
  `scripts/gaps.py`; malformed sections are skipped, never thrown on.
- **Place:** `#gaps`, reached from the ⋯ More menu under Feature Research (“Gaps” — _what is not built yet_), with
  Done to go back, like Research ([ADR-043](../adr-done/ADR-043-research-papers-become-a-traceable-feature-catalog-decisions.md),
  [ADR-078](../adr-done/ADR-078-rebuild-the-app-shell-projects-catalog-and-editor-as-separat.md)).
- **Overview:** counts by status (Open, Acknowledged, Moved to an ADR, Done) and “Marked by you”.
- **Find:** a text search over id, title and every field, and status filter chips (Open by default).
- **Detail:** each gap expands to Status, Origin, Missing, Request, Questions, Suggested pick and Notes.
- **Marks:** per gap, _Acknowledge_ or _Make ADR_ (one at a time, tap again to clear) and a free note, saved in a new
  IndexedDB table `gapMarks` (Dexie v9, additive; nothing else changes). Marks are the user's only; nothing writes
  them automatically.
- **Hand-over:** _Copy decisions_ builds one text block (“acknowledge G-012 …”, “make an ADR from G-007 …”, “note on
  G-020: …”) for marked gaps whose shipped status is still Open or ADR-NNN, shows it in a read-only box and copies it
  to the clipboard when the browser allows.

## Alternatives considered

- **Read-only page** — the user asked to act on gaps from the page.
- **Copy one command per gap, nothing saved** — loses marks between visits; the user chose saved marks.
- **Edit the ledger from the app** — impossible without a backend or a GitHub token (ADR-002).

## Scope

- In scope: the page, the parser, the `gapMarks` table, Copy decisions, the More menu entry, tests and find-it.
- Out of scope: grouping by origin (not chosen, G-099); exporting or importing marks as a file (G-100); changing `GAPS.md` from the
  app (ADR-002, G-101).

## Consequences

- Positive: gaps can be triaged on the phone without a session; the hand-over text is exact ids.
- Negative / risks: the page shows the ledger of the deployed build, so it lags `main` until the next deploy; the
  page says the ledger is the one built into this version of the app.
- Harder to change later: the `gapMarks` table (a shipped Dexie version is never edited, ADR-012).

## Done when

- [x] `parseGaps` reads every section of the current `GAPS.md` with the same ids and statuses as `scripts/gaps.py`
      (covered by tests)
- [x] Decisions text lists only marked gaps whose status is Open or ADR-NNN, with ids, titles and notes (tests)
- [x] Dexie v9 adds `gapMarks`; a v8 database opens with its rows intact (tests)
- [x] Find-it: from the bare app, ⋯ More › “Gaps” opens a page headed “Gaps”, with the status counts, a search that
      finds a gap by id, the Open filter, an expanded gap's “Suggested pick”, Acknowledge, a note, and Copy decisions
      showing “acknowledge G-” at 390 and 1280 px, with no sideways scroll; the mark survives a reload
