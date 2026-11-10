# ADR-259: UI audit — Views: a render stops when closed, one 3D menu, model sizes stay in range

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: none
- Acceptance: browser

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 12, **Views** (`src/ui/info/features.ts:895-1016`). The full
sub-flow map (25 rows, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-12-views.md](../research/ui-audit-12-views.md).

Summary of the map: the View switch 2D · 3D · Both and the view tools sit in the stage row (`src/ui/App.tsx:939-1033`,
behind Options on a phone, `src/ui/viewChoice.ts:52-59`); the lazy 3D view has its own toolbar with Move, Select,
Section, Isolate and a ⋯ menu for AR (`src/viewer/Viewer3D.tsx:675-970`); Render opens a dialog
(`src/ui/RenderDialog.tsx`); imported models live under Add a piece → My 3D models and the selected model's fields
(`src/ui/Models3D.tsx`). Everything is reachable at 390 and 1280 px; View in AR only on devices that offer immersive
AR. WebGL is absent in jsdom, so the 3D view is proven by code and by the UI around it.

## Findings

| Id     | Class        | Severity | Finding                                                                                                                                                                  |
| ------ | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D12-F1 | Proven       | major    | Close or Cancel before the tracer is ready leaves the render running hidden; it then replaces the last render and shows Done (`RenderDialog.tsx:60-94,110-118`).         |
| D12-F2 | Proven       | minor    | Without WebGL the reason is only a `title` on disabled 3D / Both buttons; the sentence exists but is hidden by CSS (`viewChoice.ts:18-26`, `App.tsx:106-113`).           |
| D12-F3 | Code-evident | minor    | Two ⋯ menus named "More 3D actions" split the exports; .usdz says nothing on success and its failure alert never clears (`SceneMenu.tsx:39-41`, `Viewer3D.tsx:937-970`). |
| D12-F4 | Proven       | minor    | Keep proportions pushes a model side past 10 000 mm and floors slim sides to 1 mm with no word (`model3d.ts:120-123`); reproduced: 600 × 900 × 600 → H 15 000.           |
| D12-F5 | Proven       | minor    | Arrow keys on a model placed on a piece move nothing and add an undo step per press (`Models3D.tsx:611-620`); reproduced: 3 presses, x unchanged, 3 undo steps.          |

## Decision

One rule for the views: **what the user stops is stopped, one place holds the 3D actions, and a size the app sets
stays inside the range it states.**

1. **F1:** `RenderDialog.start` takes a run token (a ref counter). Close, Cancel and a new Start bump it; when
   `startRender` returns with a stale token the job is disposed at once and nothing else happens (no canvas, no
   `setLastRender`, no state change). The token is also checked after `await j.done`.
2. **F2:** without WebGL, the stage row shows the sentence "3D preview is not available in this browser. The front
   view and parts list still work." as a hint beside the View switch, and the 3D and Both buttons point to it with
   `aria-describedby`. Same text as `NoViewer`, already in `t()` with its Russian entry.
3. **F3:** one ⋯ menu: Export scene (.glb) moves into the 3D view's ⋯ (`ThreeMore`), beside View in AR and Export for
   AR (.usdz); `SceneMenu` and its stage-row slot go. The in-view menu is on screen at both widths without Options.
   Export for AR sets the same notice as .glb on success ("Saved {name}."); its failure goes to the same notice
   (`setNotice`), so no stale alert stays in the 3D view.
4. **F4:** a core function `modelSideRange(size, side, keep)` in `src/core/model3d.ts` gives the range a side can take
   so that, with Keep proportions on, every side stays 1 to 10 000 mm. The size fields use it as their `min`/`max`, so
   an out-of-range value is named by the field's own "Whole number from {min} to {max}." and refused, never clamped;
   `dragResize` holds to the same range. No `src/core/types.ts` change.
5. **F5:** arrow keys on a model call the store's `dropModel(id, dx, dz, false)`, the drag's path: one undo step per
   press, and a model on a piece lifts off as a drag does (ADR-065, `modelPlace.ts:23-26`).

## Alternatives considered

- **F1: disable × and Esc while starting** — the user could not leave a slow phone render; ADR-068 promises Cancel.
- **F3: keep two menus and rename one** — two places for "export the 3D view" stays confusing; both ADRs name one ⋯.
- **F3: move AR into the stage-row ⋯** — on a phone it would sit behind Options, two taps further from the view it
  acts on.
- **F4: scale down the other sides to fit** — changes what the user typed into something else, a silent clamp.

## Scope

- In scope: F1–F5 as decided; tests for each; the browser find-it for the 3D menu (ADR-208's script area).
- Out of scope: what Section and Isolate do to an export or a render (not reported by any user); AR session flows
  that need a device with WebXR.

## Consequences

- Positive: a stopped render frees the GPU as ADR-068 says; one menu for every 3D export; model sizes stay in the
  stated range; keyboard moves of models match the drag.
- Negative / risks: the .glb export moves, so `tests/find-it/prints-exports.test.tsx` and
  `tools/prints-exports/find-it.mjs` must find it in the 3D view's ⋯; the 3D view mounts only with WebGL, so that step
  runs in the browser script. With F5 an arrow key lifts a model off its piece; that is the drag's rule.

## Done when

- [ ] Close and Cancel while the tracer starts dispose the job, keep the last render and leave the dialog at Start (test with the tracer mocked).
- [ ] Without WebGL the no-3D sentence is visible beside the View switch and named by the 3D and Both buttons, at 390 and 1280 px (jsdom find-it).
- [ ] One "More 3D actions" menu holds Export scene (.glb), Export for AR (.usdz) and View in AR; a .usdz export says "Saved …" (browser find-it).
- [ ] With Keep proportions on, no side goes past 1–10 000 mm by typing or dragging, and an out-of-range value is named by the field (core test + test).
- [ ] An arrow key on a model placed on a piece moves it by 10 mm in one undo step (store test).
- [ ] Find-it passes from the bare app at phone and desktop widths (jsdom for F2, browser script for F3).

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates (of each other and of ADR-248), for behaviour an
implemented ADR intends, for conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                                             | Proposer                                                                                                                                                                                                                             | Verdict  |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| D12-F1 | The window is short; on a laptop the tracer is ready in a moment. A double tap is not the issue (one call, proven). | On a phone the scene copy and tracer build take seconds (ADR-068 says a phone may be slow); reproduced: disposed 0, Done 256 samples after Cancel. ADR-068 line 34: "Cancel stops and frees the GPU". Not in ADR-248.                | Accepted |
| D12-F2 | ADR-081 lines 35-36 chose "disabled with the reason"; a `title` is that reason.                                     | ADR-081 line 74 asks for the reason _shown_; a disabled button takes no focus (`controls.tsx:132-136`) and a touch screen shows no title. Reproduced: the sentence is only in a `display: none` pane. Reuses an existing `t()` text. | Accepted |
| D12-F3 | Each menu passed its own find-it; merging is a layout change nobody asked for.                                      | ADR-206 line 39 and ADR-208 line 56 both name _the_ 3D toolbar ⋯; two summaries share one accessible name (`SceneMenu.tsx:40`, `Viewer3D.tsx:938`). The in-view menu is the one visible at 390 px without Options.                   | Accepted |
| D12-F4 | 15 000 mm models are absurd; validation accepts up to 10 000 000 (`model3d.ts:324-325`), so nothing breaks.         | Nothing crashes, but ADR-102 lines 30 and 41 state 1 to 10 000, and the floor at 1 mm changes proportions silently (ADR-008). Reproduced in core. The fix is one core function used by the fields, no new message.                   | Accepted |
| D12-F5 | A model on a piece follows the piece; arrows should not move it.                                                    | Then the key should not add undo steps; reproduced: 3 empty steps. The drag already lifts it off (`modelPlace.ts:23`, ADR-065), and pieces' arrows use store actions (`Project.tsx:2069-2075`). Same path as the drag.               | Accepted |

No question needs the user: every accepted fix follows an implemented ADR's rule (ADR-068, ADR-081, ADR-102, ADR-206,
ADR-208, ADR-065). Decided without asking: the single 3D menu is the in-view one.
