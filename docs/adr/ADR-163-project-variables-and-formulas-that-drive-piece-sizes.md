# ADR-163: Project variables and formulas that drive piece sizes

- Status: Pending
- Date: 2026-10-30
- Depends on: ADR-124
- Design: docs/ui-design.md (Configure, selected-piece card)
- Backlog: N165
- Agreed: 2026-10-30 (every question answered in the interactive questions; the answers are quoted below)

## Context

The user (2026-10-30): "I would like to introduce the possibility of using variables within the project. For
example, I will be having a variable bottom height equals to 400. So the certain pieces will be using that height
from that variable. Whenever I change that, they automatically scale to the value I've set."

Answers (2026-10-30): bind **piece outer size**, **inner division sizes** and **room position / mount height**
(not the plinth height, which stays a project setting, ADR-124); values are numbers **or formulas**; a non-whole
result is **rounded and shown** ("333.33 → 333 mm"); binding through a **ƒ button beside each field**; deleting a
used variable **asks, then unbinds** (pieces keep the current number); a bound position axis **stays fixed** in Move
mode and Move to.

**Change control.** The project document changes (ADR-011): `Project.variables` and `ProjectItem.bindings`,
project `schemaVersion` 16, old readers kept (the stored sizes are always the evaluated numbers). Project-wide
settings ([ADR-124](../adr-done/ADR-124-research-batch-4-design-codes-keep-edits-on-replace-template.md)) stay as
they are; a variable is a second, named way to drive a size. Linked copies
([ADR-111](../adr-done/ADR-111-linked-copies-of-a-piece-in-a-project.md)) share a design;
bound values are the one part a link does not copy (below).

## Decision

1. **Variables.** `Project.variables?: { id; name; expr }[]`. Names are unique in a project (case-insensitive).
   `expr` is a number or a formula over other variables: `+ − × ÷` (also typed `*` `/`), parentheses, decimals.
   `src/core/variables.ts` (pure): `parseFormula`, `evaluateVariables(project)` → every variable's value, rounded
   to the nearest integer mm, with its unrounded result when they differ; a problem (empty, syntax, unknown name,
   cycle, division by zero) is a diagnostic per variable and an error diagnostic on the project (ADR-008: blocks
   export, never hidden); the fields bound to it keep their stored numbers.
2. **Bindings.** `ProjectItem.bindings?: { target; expr }[]` where `target` is `width`, `height`, `depth`,
   `mountHeight`, `x`, `y`, `z` or `split:<spaceId>:<index>` (a `mm` size of a split), and `expr` is a variable name
   or a formula. The store evaluates bindings on every commit (`applyBindings`, one undo step with the change that
   caused it) and writes the number into the design or the position, so every view, check, cut list and export is
   unchanged (ADR-004) and old readers read the last value. A binding on a split size sets its mode to `mm`.
3. **Binding UI.** A **ƒ** button beside every bindable size in the selected-piece card (Size; Position; Mount
   height; the split sizes of the inspector in a project): a sheet with the variables to pick from, a formula field,
   and **Unbind**. A bound field is read-only and shows `bottom height = 400` (or `= 333 mm` from a formula).
4. **Variables page.** Configure → **Variables**: a list (name, value or formula, `→ 333 mm` when rounded, the
   problem when any, "used by 3 pieces"), **Add variable**, rename, **Delete**. Deleting a used variable asks,
   listing the pieces; on yes those bindings are removed and the pieces keep their numbers. A rename follows into
   every formula and binding.
5. **Interplay.** A bound position axis does not move in Move mode or Move to ("x follows _bottom height_"); the
   other axes move. A linked copy (ADR-111) shares the design but keeps its own bindings and bound values: linked
   propagation skips every bound target. A size lock (ADR-122) on a bound size is reported as a diagnostic and the
   variable wins. Project templates (ADR-060) keep variables and bindings; a design saved to the catalog drops its
   bindings (G-317).

## Alternatives considered

- **Evaluate at build time only (projection), never store the number** — every reader of `Design` would need the
  variables; old readers would see stale sizes. Storing the evaluated number keeps ADR-004 and ADR-011 intact.
- **Spreadsheet-style cells inside every design** — far bigger; the user asked for project-level variables.
- **Variables as project settings (ADR-124)** — settings are fixed roles (boards, handle); a variable is named and
  free.

## Scope

- In scope: core (`variables.ts`, validation, migration to `schemaVersion` 16), store action, Variables page, ƒ
  button, diagnostics, tests, fuzz on evaluated designs, jsdom find-it.
- Out of scope: variables outside projects (G-317); formula functions (G-318); bindings on run parts (G-319).

## Consequences

- Positive: one number changes a whole run of pieces; formulas express dependent sizes.
- Negative / risks: a bound field is no longer editable in place (the ƒ sheet is one tap away); a cycle or a bad
  formula leaves pieces at their last size until fixed, with an error that blocks export.
- Harder to change later: binding targets are a closed list; a new target is a new ADR.

## Done when

- [ ] `bottom height = 400` → three pieces bound on `height` are 400 high; set to 450 → all three are 450, one undo
      step (`tests/variables.test.ts`)
- [ ] Formula `bottom height + 18` and `1000 / 3` → 333 with the unrounded value reported; unknown name, cycle and
      `/ 0` give diagnostics, the bound size keeps its number, export is blocked (tests)
- [ ] A bound split size, mount height and position follow the variable; a bound axis does not move in Move to or
      Move mode (tests)
- [ ] Deleting a used variable lists its pieces and unbinds them; rename follows into formulas and bindings (tests)
- [ ] Project `schemaVersion` 16 validates, a 15 file loads, a linked copy keeps its own bound values
      (`tests/project-doc.test.ts`)
- [ ] Fuzz: 3,000 seeded projects with random variables and bindings build with no throw
- [ ] Find-it `tests/find-it/variables.test.tsx` (390 and 1280 px): **Variables** → **Add variable** → `bottom
  height` `400` → selected piece → **ƒ** by Height → pick it → field reads `bottom height = 400`; change to 450
      → the piece is 450 high; **Delete** asks and unbinds

## Open questions

None (all answered 2026-10-30).
