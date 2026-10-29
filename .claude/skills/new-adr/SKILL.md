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
   requirement ledger, R1 in `CLAUDE.md`). If the scope is unclear, ask at once (rule in step 6, **Open questions**).
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
4. **Claim the number** (parallel sessions never collide, `scripts/ids.py`):
   ```bash
   git fetch origin main
   pnpm ids next ADR            # prints the candidate number
   ```
   Claim it with the GitHub MCP tool `create_branch` (branch `id/ADR-NNN`, from `main`). If GitHub
   answers "Reference already exists", run `pnpm ids next ADR --after NNN` and claim that one. Never
   write a number you have not claimed. If the claim cannot be made (no GitHub access), stop and say so.
5. **Create the file** with the helper:
   ```bash
   ADR_ID=ADR-NNN bash .claude/skills/new-adr/new-adr.sh "<Title>" ["ADR-012, ADR-022"]
   ```
   The second argument lists dependencies (ADRs that must be implemented first); omit it
   for none. The script refuses a number already used locally or on `origin/main`, writes
   `docs/adr/ADR-NNN-slug.md` from `_template.md` (title, date and dependencies filled in,
   guidance comment removed) and appends a row to the table in `docs/adr/README.md`.
6. **Fill in the ADR.** Open the new file and replace every placeholder, in English:
   - `Design:` — `docs/ui-design.md` (with the section) for anything visible, or `n/a`.
   - `Backlog:` — the `docs/backlog.md` ids; add a new row there (next free `N` id, status
     `Not done`) if the work has none.
   - **Context** (the user's words), **Decision**, **Alternatives considered** (2–4 real
     options), **Scope**, **Consequences**.
   - **Done when** — verifiable items only (tests, diagnostics, visible text the find-it
     test looks for), at most 8. Anything visible gets a find-it item: jsdom by default
     (`tests/find-it/<area>.test.tsx`); for layout/CSS, 3D view or Move mode work add
     `- Acceptance: browser` under `- Backlog:` (ADR-108). If the user chose
     light acceptance, add `- Acceptance: light` under `- Backlog:`, mark those items
     `(light — catch-up)` and put `find-it pending (light, ADR-066)` in the backlog row (ADR-066).
   - **Gaps (ADR-082)** — each _Out of scope_ item and each open question gets a gap in
     `docs/adr/GAPS.md` (`pnpm gaps add --id G-NNN`, claimed like the ADR number with `pnpm ids next G`), cited by its G id; `pnpm docs:check` enforces it. When
     the ADR takes over an existing gap, set that gap's Status to `ADR-NNN`.
   - **Open questions** — every choice the user has not made, with the options and the
     recommended one closest to the request (`CLAUDE.md`). The recommendation is a suggestion
     only: never write it into the Decision or apply it until the user picks it. Never invent hardware specs, loads or supplier values (ADR-010);
     ask instead.
     **Ask each one the moment it arises (user rule 2026-10-29)** with the interactive question
     tool (`AskUserQuestion`): every option with its reasoning — what it delivers, the work it
     costs (+N %, estimate) — and the recommended one first, marked "(Recommended)". Do not
     finish the file and leave questions for later. Record each answer in the ADR.
7. **Check the plan rules:**
   - Dependencies point to ADRs that exist and do not form a cycle.
   - Size stays within ~110 lines, ~6.5 KB and 8 `Done when` items. If it would be bigger,
     split it into several ADRs (run the helper once per ADR).
   - Status stays `Pending`. If open questions block building, set
     `- Status: Deferred (<reason>)` in the file **and** in the README row.
8. **Run** `pnpm docs:check`.
9. **Build (user rule 2026-10-29, `CLAUDE.md`).** When every open question is answered, record the
   answers (Context, Decision, gaps moved to `ADR-NNN`), set Status `Pending` and continue with the
   `next-adr` skill on **this ADR** (not the lowest-numbered one), on the same branch, in the same pull
   request. The answers are the approval. Its dependencies must still be implemented; if one is not,
   say so and stop. If a question stays unanswered, keep the ADR `Deferred`, suggest a branch named
   `adr-NNN-slug`, and do not build. Never treat silence or a recommended default as an answer.

## Notes

- The helper never overwrites an existing file and never touches git history.
- A claimed number that ends up unused stays a hole; numbers are never reused or renumbered.
- Never set `Implemented` by hand; that is the `ship-adr` skill's job.
