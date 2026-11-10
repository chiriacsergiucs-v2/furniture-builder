# UI audit 12 — Views: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Views (`src/ui/info/features.ts:895-1016`, 25 feature lines)
- ADR: [ADR-259](../adr/ADR-259-ui-audit-views-render-stops-models-keep-range.md)
- Method: code reading with file:line citations; reproductions run as throwaway tests outside the repo (vitest with a
  scratch config; jsdom over `tests/find-it/setup.tsx` at 390 and 1280 px for the app, the `RenderDialog` alone with
  the path tracer module mocked, and the store and core in node). No repo source was changed. WebGL is absent in
  jsdom (`tests/find-it/setup.tsx:63-64` stubs `getContext` to null), so the 3D view itself (`src/viewer`) is
  checked by code and by the UI around it; AR is checked by code only.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. On a phone the view tools other than Fronts, Select, Move
and Turn sit behind **Options** (`src/ui/viewChoice.ts:52-59`, `src/ui/ViewOptions.tsx:9-43`). The stage tool row is
`src/ui/App.tsx:939-1033`; the 3D view's own toolbar is `src/viewer/Viewer3D.tsx:675-870`.

| #   | Feature line (features.ts)                     | Sub-flow: entry → steps → end state                                                                                                                       | Code                                                                                                    | Covering test                                                                   | P/D  |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---- |
| 1   | Compose and Build & Preview modes (:902)       | Editor → mode row Compose · Build & Preview → Compose shows the sheet and the drawing, Build & Preview the results                                        | `App.tsx:250`, `App.tsx:646`                                                                            | `tests/ui-mode.test.ts`, `tests/find-it/assembly-steps.test.tsx`                | P D  |
| 2   | Front drawing with sizes (:906)                | Piece open → View 2D → `Elevation` draws spaces with `Dim`/`DimV`; tap or Enter on a space selects it                                                    | `Elevation.tsx:139-180`, `Elevation.tsx:361-433`                                                         | `tests/find-it/piece-editor-inputs.test.tsx`                                    | P D  |
| 3   | Project plan and room front view (:907)        | Project open → View 2D → `PlanView` (plan) and `RoomFront`                                                                                                | `Project.tsx:1492`, `Project.tsx:2491`                                                                  | many find-it tests (`projectWithTwoPieces`)                                     | P D  |
| 4   | 2D, 3D or both side by side (:912)             | View radiogroup 2D · 3D · Both → `setView`; default 2D below 1500 px, Both from 1500; 3D and Both disabled without WebGL                                  | `App.tsx:940-966`, `viewChoice.ts:18-31`, `App.tsx:268-293`                                             | `tests/view-choice.test.ts`, `tests/find-it/move-to-block.test.tsx`             | P D  |
| 5   | 3D preview, select by click (:921)             | View 3D → lazy `Viewer3D` in `ViewerBoundary` + `Suspense` → click a panel → selection                                                                   | `App.tsx:1048-1061`, `App.tsx:97-113`                                                                   | `tests/find-it/lazy-pages.test.tsx` (lazy chunk); 3D: `tools/*/find-it.mjs`     | P D  |
| 6   | Exploded 3D view (:922)                        | View 3D → (phone: Options) → Exploded 3D → `explode(view.pieces)`; Move and Adjust picture disabled with a reason                                         | `App.tsx:980-989`, `Viewer3D.tsx:432-447`, `Viewer3D.tsx:684-694`                                       | `tests/explode.test.ts`                                                         | P D  |
| 7   | Realistic look (:923)                          | Look radiogroup Simple · Realistic → room light, key light, shadow catcher                                                                                | `App.tsx:997-1017`, `Viewer3D.tsx:600-626`                                                              | `tests/look-render.test.ts`, `tools/look-render/find-it.mjs`                    | P D  |
| 8   | Render a photo-quality picture (:929)          | Render → dialog → Size → Start → `startRender` (lazy) → samples rise → Done → Save PNG; Cancel; × / Esc                                                   | `App.tsx:1019-1031`, `RenderDialog.tsx:28-183`, `src/viewer/pathtrace.ts:51-75`                          | `tests/look-render.test.ts`, `tools/look-render/find-it.mjs:119-143`            | P D  |
| 9   | Export scene (.glb) (:935)                     | (phone: Options) → stage-row ⋯ "More 3D actions" → Export scene (.glb) → `exportSceneGlb` → download, notice "Saved …"                                   | `SceneMenu.tsx:11-51`, `src/viewer/exportScene.ts:13-48`                                                | `tests/find-it/prints-exports.test.tsx`                                         | P D  |
| 10  | WebGPU rendering (:942)                        | Render dialog opens → `detectEngine` → "Engine: WebGPU" or "WebGL 2" → Start uses that engine                                                            | `RenderDialog.tsx:41-50`, `pathtrace.ts:67-69`                                                          | `tests/look-render.test.ts`                                                     | P D  |
| 11  | View in AR and export for AR (:949)            | 3D view toolbar ⋯ "More 3D actions" → View in AR (if `isSessionSupported`) → `enterAR`; Export for AR (.usdz) → `exportUsdz`                             | `Viewer3D.tsx:891-970`, `src/viewer/AR.tsx:498-579`, `AR.tsx:1174-1213`                                  | `tests/ar-placement.test.tsx`, `tests/room-surfaces-ar.test.tsx`                | P D¹ |
| 12  | AR furniture sits on the real floor (:956)     | In AR: "Looking for the floor…" → steady floor hit → outline → tap → anchored, shadow                                                                     | `Viewer3D.tsx:910-925`, `src/viewer/arPlace.ts`                                                         | `tests/ar-placement.test.tsx`                                                   | P    |
| 13  | Place in AR by a corner (:963)                 | Placing → Point: Centre/Back-left/Back-right; Room corner → two floor taps → placed; Cancel corner                                                         | `Viewer3D.tsx:1034-1048`, `AR.tsx:581-597`                                                              | `tests/ar-placement.test.tsx`                                                   | P    |
| 14  | Fine-tune in AR and see its size (:970)        | Placed → arrows, ↺ ↻, Step 1 cm/10 cm, Place again, Sizes: Overall/Per piece/Off                                                                          | `Viewer3D.tsx:978-1063`                                                                                 | `tests/ar-placement.test.tsx`                                                   | P    |
| 15  | AR walls, wall gap, occlusion, light (:976)    | Room corner with both walls → one tap; Wall gap − / +; Hide behind real objects; one-finger drag                                                          | `Viewer3D.tsx:1011-1030`, `Viewer3D.tsx:1064-1070`                                                      | `tests/ar-walls.test.tsx`                                                       | P    |
| 16  | Section view and Isolate (:983)                | 3D toolbar → Section → axis Width/Height/Depth → Cut at slider; Isolate shows the selection only                                                          | `Viewer3D.tsx:803-869`, `src/viewer/section.ts`                                                         | `tests/research-batch-2.test.ts`                                                | P D  |
| 17  | Draws only when something changes (:984)       | Canvas `frameloop="demand"`; `invalidate()` on change                                                                                                      | `Viewer3D.tsx:589`                                                                                      | `tests/i18n-research2.test.ts` (text only); browser scripts                     | P D  |
| 18  | Import GLB and glTF models (:992)              | Project → Add a piece → My 3D models → Import 3D model → `importModelFile` (size, triangles, parse, save) → row → tap → `add` → selected                   | `Models3D.tsx:356-502`, `src/persist/models.ts:24-90`, `Project.tsx:3006`                               | `tests/model3d.test.ts`, `tests/find-it/room-surfaces.test.tsx`                 | P D  |
| 19  | Width, height and depth of a model (:998)      | Selected model → Width/Height/Depth (`MmField` 1–10 000) + Keep proportions → `resizeModel`; Reset size                                                  | `Models3D.tsx:111-142`, `src/core/model3d.ts:108-124`                                                   | `tests/model-size.test.ts`                                                      | P D  |
| 20  | Move and turn a model in 3D (:999)             | 3D → Move → drag the model (`dropModel`), Turn 90° ↺/↻; resize handles                                                                                     | `Viewer3D.tsx:675-781`, `src/viewer/modelResize.ts`, `designStore.ts:1938-1946`                          | `tests/model-move-3d.test.ts`                                                   | P D  |
| 21  | Place and drag 3D models (:1005)               | Selected model → Placed Floor/Wall/On a piece/Anywhere; plan drag (`dropModel`, lift-off), arrow keys (`patch`)                                         | `Models3D.tsx:226-301`, `Models3D.tsx:527-625`, `src/core/modelPlace.ts:23-29,124-139`                    | `tests/model-move-3d.test.ts`, `tests/room-surfaces.test.ts`                    | P D  |
| 22  | Imported models in the front view (:992)       | View 2D → `FrontModels` labelled boxes; tap or Enter selects                                                                                              | `Models3D.tsx:662-700`                                                                                  | `tests/find-it/room-surfaces.test.tsx`                                          | P D  |
| 23  | Model list in the project (:992)               | Compose → "3D models (display only)" list → tap selects                                                                                                   | `Models3D.tsx:303-336`                                                                                  | `tests/find-it/room-surfaces.test.tsx`                                          | P D  |
| 24  | Remove / delete a model (:992)                 | Selected model → Remove from project (confirm); My 3D models → Delete (refused while in use, undo history included)                                       | `Models3D.tsx:196-216`, `Models3D.tsx:397-433`                                                          | `tests/room-surfaces.test.ts`                                                   | P D  |
| 25  | No WebGL (:912, ADR-081)                       | Device without WebGL → View 3D and Both disabled; reason only in `title`                                                                                  | `viewChoice.ts:6,18-26`, `App.tsx:956-961`, `App.tsx:106-113`                                            | `tests/view-choice.test.ts` (options only)                                      | P D  |

¹ View in AR shows only where `navigator.xr.isSessionSupported('immersive-ar')` is true (`AR.tsx:208-220`), in practice
Android phones; Export for AR (.usdz) shows at both widths.

## Bug hunt

Each check below was applied to every sub-flow: empty / error / storage failure / reload, double tap, edge input,
i18n, accessibility (role, label, focus, invalid state), 390 px, ADR-004 and ADR-008, selector stability,
persistence. Only what failed is listed. Classes: **Proven** (reproduced, output quoted), **Code-evident** (cited,
not run), **Suspected**.

### D12-F1 — Closing or cancelling the Render dialog before the tracer is ready does not stop the render (Proven, major)

`start` (`RenderDialog.tsx:67-94`) sets the state to rendering, then awaits the lazy module and `startRender`, which
waits two frames, clones the scene and builds the tracer (`pathtrace.ts:51-75`, `:126-145`; seconds on a phone).
Until it returns, `job.current` is null, so × / Esc (`close`, `RenderDialog.tsx:60-64`) and **Cancel**
(`RenderDialog.tsx:110-118`) only call `stop()` on nothing and set the state to idle. When `startRender` resolves,
`job.current = j` (`:80`) is set anyway, the canvas goes into the (closed) dialog, all 256 samples are traced on the
GPU, the picture replaces the session's last render (`:87`, used by the client sheet, `Output.tsx:164`) and the state
becomes Done. ADR-068 says "Cancel stops and frees the GPU" (ADR-068 line 34).
Reproduction (`RenderDialog` alone, `pathtrace` mocked, the tracer resolving after the user's action):

```
D12-F-render closed before ready: job disposed 0
D12-F-render closed: lastRender after hidden render blob:x
D12-F-render reopened shows: Done: 256 samples | Start button: false | Render again: true
D12-F-render cancelled before ready: disposed 0 | shows Done: 256 samples
```

### D12-F2 — Without WebGL the reason 3D is off is only a tooltip on disabled buttons (Proven, minor)

`viewOptions` puts the reason in `title` only (`viewChoice.ts:18-26`, `App.tsx:956-961`); the buttons are
`disabled`, so they take no focus and the roving keys skip them (`controls.tsx:132-136`), and a touch screen shows no
title. The sentence "3D preview is not available in this browser. The front view and parts list still work."
(`App.tsx:106-113`) is rendered only in the 3D pane, which is `display: none` unless 3D or Both is chosen
(`styles.css:1619-1626`) — and neither can be chosen. ADR-081 asks for "the reason shown" (ADR-081 line 74).
Reproduction (bare app, project with two pieces; jsdom has no WebGL):

```
D12-F2 @390: 3D disabled=true title="3D preview is not available in this browser" describedby=null | Both disabled=true
D12-F2 @390: visible sentences about no 3D: 1; no-3d boxes in DOM: 1
D12-F2 @1280: 3D disabled=true title="3D preview is not available in this browser" describedby=null | Both disabled=true
```

The one `.no-3d` box is inside `.view.three` without `.active`, so hidden by CSS.

### D12-F3 — Two "More 3D actions" ⋯ menus, with exports split between them (Code-evident, minor)

ADR-206 puts Export scene (.glb) in "the 3D toolbar's ⋯ beside Render" (ADR-206 line 39) and ADR-208 puts View in AR
and Export for AR (.usdz) in "the 3D toolbar ⋯" (ADR-208 line 56). The code has two menus with the same accessible
name: `SceneMenu` in the stage row (`SceneMenu.tsx:39-41`, mounted at `App.tsx:1032`, behind Options on a phone) and
`ThreeMore` inside the 3D view (`Viewer3D.tsx:937-939`, mounted at `:677` and `:682`). In 3D or Both both are on screen
and a screen reader lists two "More 3D actions" buttons. The two exports also answer differently: .glb sets a notice
"Saved {name}." (`SceneMenu.tsx:26`); .usdz says nothing on success (`Viewer3D.tsx:955-960`, `AR.tsx:1202-1204`), and
its failure note is a `role="alert"` span that is never cleared while the 3D view stays (`Viewer3D.tsx:899`,
`:966-970`).

### D12-F4 — Keep proportions pushes a model side past 10 000 mm and collapses small sides to 1 mm silently (Proven, minor)

ADR-102 sets each side to "1 to 10 000" (ADR-102 lines 30, 41). `resizeModel` with `keep` scales the other two sides
with no upper bound and floors them at 1 (`model3d.ts:120-123`); `dragResize` holds only the dragged side
(`model3d.ts:146`). The other field then shows "Whole number from 1 to 10000." (`controls.tsx:101-104`) on a value the
user never typed, and a slim model loses its proportions with no word (ADR-008: never clamp silently).
Reproduction (core):

```
D12-F4 typed W 10000 keep: {"w":10000,"h":15000,"d":10000} max 10000
D12-F4 drag W +20000 keep: {"w":10000,"h":15000,"d":10000}
D12-F4 typed W 1 keep: {"w":1,"h":1,"d":1}
```

(the last from 600 × 90 × 20).

### D12-F5 — Arrow keys on a model placed on a piece move nothing and add undo steps (Proven, minor)

On the plan, arrow keys patch `position` directly (`Models3D.tsx:611-620`), while a drag goes through `dropModel` →
`moveModelTo`, which lifts a model off its piece (`designStore.ts:1938-1946`, `modelPlace.ts:23-26,124-139`). For a
model placed "On a piece", `modelPosition` recomputes x from the piece (`project.ts:677-680`), so the key does nothing
visible but each press is an undo step. Pieces' arrows go through store actions (`Project.tsx:2069-2075`).
Reproduction (store):

```
D12-F5 box x before 0 after 3 arrows 0 | undo steps added 3 | placement above
D12-F5 after drag +30: box x 30 placement floor
```

## Checked, no finding

- Render dialog double tap on Start: one `startRender` (`D12-F-render double tap: startRender calls 1`); the button
  turns into Cancel at once (`RenderDialog.tsx:105-127`).
- Render before the 3D view has loaded: `startRender` throws "Open the 3D view first." and the dialog shows it
  (`pathtrace.ts:54`, `RenderDialog.tsx:90-93`, `:162-167`); same for .glb (`exportScene.ts:15`) and .usdz
  (`AR.tsx:1181`).
- The last render's object URL is revoked when replaced (`uiStore.ts:104-107`).
- Import 3D model never throws: size, read, parse, triangles and save failures are each named
  (`persist/models.ts:24-90`); Delete refuses a model in use, undo history included (`Models3D.tsx:397-433`).
- Selectors in `Viewer3D.tsx` and `Models3D.tsx` use `.find` (stable references), no `.filter`/`.map`
  (`Viewer3D.tsx:1519`, `:2515`).
- Texts made at module load (`viewChoice.ts:6`, `Viewer3D.tsx:1463-1470`, `section.ts:39-43`) are by design: the
  dictionary loads before the app's modules (`src/core/i18n/index.ts:51-58`).
- Every visible text in the files read goes through `t()`/`tr()`; the AR overlay's arrows and ⋯ are symbols with
  `aria-label`s where they stand alone (`Viewer3D.tsx:938`, `:980-998`, `:1012-1030`).
- Section state lasting while the 3D view is hidden is intended (`section.ts:7-11`, ADR-122).
- A model dragged off a piece landing on the floor is intended (`modelPlace.ts:23`, ADR-065 lift-off).
