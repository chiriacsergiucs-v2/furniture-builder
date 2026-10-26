---
name: new-adr
description: Create a new ADR in docs/adr/ from the template — allocate the next free number, create the file, register it in the README index, then fill it in. Use when the user says "new ADR", "create an ADR", "add an ADR for X", "write an ADR about X", asks to turn a decision or request into an ADR, or gives an instruction that conflicts with an implemented ADR.
---

# Create a new ADR

Turns a decision or unit of work into a properly numbered ADR file and registers it in
the index. This is the first step of the ADR lifecycle:

`new-adr` → (user agrees, answers open questions) → `next-adr` → (implement) → `ship-adr`

Project: **Furniture Builder** — offline PWA for designing casework and getting a cut list.
Everything written to the repo is in **English**, whatever language the conversation is in.

## Workflow

1. **Understand the ADR.** Get the topic from the user, or draft it from the conversation.
   Write the user's request down **in their own words** (it becomes the Context and the
   requirement ledger, R1 in `CLAUDE.md`). If the scope is unclear, ask one question.
   Check `docs/adr/README.md` and `docs/adr-done/` first so the new ADR does not duplicate
   or contradict an existing one.
2. **Change control.** If the request conflicts with an implemented ADR, or touches
   `src/core/types.ts`, the design document, `FurnitureModel`, the Dexie schema, gap
   arithmetic or the network boundary (ADR-002):
   - quote the existing ADR sentence and the proposed change;
   - the new ADR links the old one in its Context and says what it replaces (implemented
     ADRs are never edited);
   - anything that would delete or rewrite saved designs, or invent a physical fact,
     needs the user's explicit decision first.
3. **Pick a title** — short, imperative, English (e.g. "Merge two touching cabinets into one").
4. **Refresh remote state** so numbers do not collide with another branch:
   ```bash
   git fetch origin
   ```
5. **Create the file** with the helper:
   ```bash
   bash .claude/skills/new-adr/new-adr.sh "<Title>" ["ADR-012, ADR-022"]
   ```
   The second argument lists dependencies (ADRs that must be implemented first); omit it
   for none. The script picks the next free 3-digit number, writes
   `docs/adr/ADR-NNN-slug.md` from `_template.md` (title, date and dependencies filled in,
   guidance comment removed) and appends a row to the table in `docs/adr/README.md`.
6. **Fill in the ADR.** Open the new file and replace every placeholder, in English:
   - `Design:` — `docs/ui-design.md` (with the section) for anything visible, or `n/a`.
   - `Backlog:` — the `docs/backlog.md` ids; add a new row there (next free `N` id, status
     `Not done`) if the work has none.
   - **Context** (the user's words), **Decision**, **Alternatives considered** (2–4 real
     options), **Scope**, **Consequences**.
   - **Done when** — verifiable items only (tests, diagnostics, visible text the find-it
     test looks for), at most 8. Anything visible gets a find-it item. If the user chose
     light acceptance, add `- Acceptance: light` under `- Backlog:`, mark those items
     `(light — catch-up)` and put `find-it pending (light, ADR-066)` in the backlog row (ADR-066).
   - **Gaps (ADR-082)** — each _Out of scope_ item and each open question gets a gap in
     `docs/adr/GAPS.md` (`pnpm gaps add`), cited by its G id; `pnpm docs:check` enforces it. When
     the ADR takes over an existing gap, set that gap's Status to `ADR-NNN`.
   - **Open questions** — every default the user has not confirmed, with the value used
     until they answer, and the recommended option closest to the request (`CLAUDE.md`). Never invent hardware specs, loads or supplier values (ADR-010);
     ask instead.
7. **Check the plan rules:**
   - Dependencies point to ADRs that exist and do not form a cycle.
   - Size stays within ~110 lines, ~6.5 KB and 8 `Done when` items. If it would be bigger,
     split it into several ADRs (run the helper once per ADR).
   - Status stays `Pending`. If open questions block building, set
     `- Status: Deferred (<reason>)` in the file **and** in the README row.
8. **Run** `pnpm docs:check`.
9. **Hand over.** The ADR keeps `- Agreed: not yet`. Ask the user (`AskUserQuestion`) about each decision,
   each out-of-scope item and each open question, then record their words in the `- Agreed:` line
   (retro 2026-10-26). `pnpm docs:check` refuses to ship an ADR from number 091 on without it. Show the user the open questions. Suggest a branch named `adr-NNN-slug`
   and a pull request. Do not commit or push unless the user asks.

## Notes

- The helper never overwrites an existing file and never touches git history.
- It also looks at `origin/main` (if fetched) when choosing the number, but two branches
  created at the same time can still collide — the PR review is the final check.
- Never set `Implemented` by hand; that is the `ship-adr` skill's job.
