# ADR-240: Let the assistant run every editor action as a previewed change

- Status: Implemented
- Date: 2026-11-09
- Implemented: 2026-11-09
- Depends on: ADR-239
- Design: docs/ui-design.md (§4, a new _Assistant_ entry when built)
- Backlog: N245

## Context

The user (2026-11-09) wants a chat assistant that does what they ask and asks back when something is unclear. They
picked **edit with preview** and **every editor action**: anything they can do by hand in the editor (size, divide,
contents, doors, materials, adding, moving and turning pieces). [ADR-239](../adr-done/ADR-239-allow-an-opt-in-ai-assistant-through-the-backend.md)
covers the network side; this ADR covers what the assistant may change and how.

Constraints in force: every view is a projection of `buildModel()` (ADR-004); input never throws and is never
clamped silently, errors block export (ADR-008); no invented hardware or physical facts (ADR-010); designs are
validated before load (ADR-011); one undo step per user action (ADR-051).

## Decision

- **Action catalog.** `src/store/assistantActions.ts` lists every design-changing action of the editor stores
  (`designStore` and the project actions) as an entry: a name, a one-line English description, a JSON schema for its
  arguments and the store call it maps to. A test fails when a design-changing store action has no entry, so new
  editor features cannot be forgotten. View-only actions (selection, tabs, view, exploded, undo/redo) are not in the
  catalog.
- **Not in the catalog** (decided by Claude, needs the user to widen it): opening, replacing or deleting saved
  projects or designs, imports and exports, catalog and template writes, account and sharing actions, history
  (undo/redo), view and screen state, and gestures that have a catalog equivalent. Each is listed with its reason in
  `EXCLUDED`. Removing a piece from the open project is allowed, since it is undoable. Actions that take a whole
  design get one wrapper, `addTemplatePiece` (a built-in template at a plan point); `updateSpace` takes a patch
  instead of a function.
- **Model reply.** The model answers with either a **question** (shown in the chat, nothing changes) or a **plan**: a
  short summary and a list of catalog calls. The system prompt tells it to ask when the request is ambiguous and to
  ask, never guess, for any hardware spec, load, screw or supplier value (ADR-010).
- **Checking a plan.** Every call is checked against its schema and the catalog before anything runs. An unknown
  action or bad argument rejects the whole plan with a message; nothing is applied in part.
- **Preview.** The calls run through the same store code and the store is then put back exactly as it was (state,
  history and selection), so the preview is never saved. The chat shows the summary, the list of changes
  ("Wardrobe › product › params › width 1200 → 1000") and any new diagnostics with their severity, unsoftened. The
  drawing and 3D change only on **Apply** (decided by Claude 2026-11-09: showing a preview in the drawing would have
  needed autosave held back while it shows).
- **Apply.** The result replaces the open design as **one undo step**. Discard leaves the design as it was. A preview
  whose design changed underneath it (an edit by hand) cannot be applied; the chat says so and offers to ask again.
- **Values.** Arguments are integer mm (ADR-003). Out-of-range values are applied as typed and show their diagnostic,
  the same as typing them by hand (ADR-008).

## Alternatives considered

- **A short fixed list of actions first** (resize, divide, add a piece). Smaller, but the user asked for every action.
- **The model writes the whole design document.** One call, but large requests and easy to break unrelated parts;
  the diff would be the only check.
- **Apply at once with undo.** Faster, but the user picked preview.

## Scope

- In scope: the catalog, the coverage test, plan checking, the preview, Apply / Discard, one undo step.
- Out of scope: actions outside the catalog (above); several plans queued at once; the assistant reading prices or
  seller pages.

## Consequences

- Positive: anything the editor can do can be asked for; the same rules and checks as editing by hand.
- Negative / risks: about 140 store actions to describe and keep in step; a plan can still be valid but not what the
  user meant, so the preview matters.
- Harder to change later: the catalog becomes a public contract with the model prompt.

## Done when

- [x] Every design-changing store action has a catalog entry; a test fails for one without (coverage test).
- [x] A plan with an unknown action or a bad argument is rejected whole and the design is unchanged (test).
- [x] A valid plan previews on a copy; the open design is unchanged until Apply (test).
- [x] Apply is one undo step; one Undo restores the design exactly (test).
- [x] A question reply changes nothing and is shown in the chat (test with a fake client).
- [x] A preview after a hand edit cannot be applied and says so (test).
- [x] New error diagnostics show in the preview with their severity (test).
- [x] Find-it (jsdom, 390 and 1280 px): a typed request shows the change list, **Apply** and **Discard**.

## Open questions

- Widen the catalog to saved-data actions (delete or overwrite projects, imports)? Decided: no, until the user asks.
