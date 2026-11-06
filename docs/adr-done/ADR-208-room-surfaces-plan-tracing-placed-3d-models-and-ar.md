# ADR-208: Room surfaces, plan tracing, placed 3D models and AR

- Status: Implemented
- Date: 2026-11-06
- Implemented: 2026-11-06
- Depends on: ADR-059, ADR-068, ADR-076, ADR-093, ADR-145
- Design: docs/ui-design.md (§4 Project panel, Drawings, 3D look and Render)
- Backlog: N213
- Acceptance: browser

## Context

User (2026-11-06): "Do the same for next 50 gaps with no questions, same split/grouping for batches, add to this pr
the created adrs, no implementation yet." The user accepted the gaps' suggested picks for the first 50 gaps and asked
for the same here, so each pick below is the user's decision.
Requests: G-273, G-274 and G-275 "Set wall background; … colour or picture, 3D view and front view, per wall";
G-012 room and floor plan (context, not a quote); G-008 features from the competitor research (context); G-022
laptop, preview quality (context); G-040 "Import 3D models and model libraries"; G-413 "Render the furniture
according to the selected material's color and structure".

Partial takeovers: G-012 tracing only (angled walls: G-428); G-008 AR and USDZ only (shared side panels were built by
ADR-190 and the review pack by ADR-121); G-022 the WebGPU plan only (the laptop run: G-429); G-040 placement and
templates only (bundled models: G-430); G-413 the plan only (catalog pictures and cut sheets: G-431).

Change control: ADR-014 lets the 3D view only select; ADR-093 made one exception, moving and turning project pieces
in Move mode. Item 6 extends that same exception to display-only 3D models (ADR-076); designs are still edited only
on the front elevation. AR only shows the scene and edits nothing. No size, load or hardware fact is invented
(ADR-010).

## Decision

1. **Wall colours on the plan (G-273).** Each wall with a finish (ADR-145) gets a 50 mm band inside its wall line on
   the plan, in its colour (a picture's average colour). Other outputs stay as they are.
2. **Floor background (G-274).** `Room.floor?: { colour; image?: WallImage }` reuses the wall finish shape and picker
   (ADR-145, ADR-146); a picture's `fit` is in plan mm (x, then z from the back). Room → Walls gets a **Floor
   background** row (None / Colour / Picture). 3D fills the floor inside the outline; the plan fills it under the
   pieces. Pictures go in the `images` table (no new Dexie version).
3. **Wall behind a single piece (G-275).** A piece opened from a project with a room shows, in its own front view,
   the wall its back stands against (the project front view's rule, ADR-145 item 5), floor to room height, the
   picture placed by the piece's position along that wall.
4. **Board pictures on the plan (G-413).** Each piece's footprint on the plan fills with the picture pattern of its
   highest panel's board (ties: first panel in model order), to its tile size; a board without a picture keeps its
   colour. Catalog pictures and cut sheets keep the average colour (ADR-048).
5. **Trace a plan picture (G-012).** Room → **Plan picture** → **Add a plan picture** (from the device, `images`
   table). **Set the scale**: "Tap a corner of the plan, then the other end of a wall you know." and type **Known
   length** (mm). Stored as `Project.planPicture?: { id; name; a: Pt; b: Pt; length: Mm; hidden?: true }` (a, b in
   whole picture pixels); point a sits at room (0, 0). The plan draws it under everything at 50 % opacity; **Draw the
   room** traces over it with ADR-059's axis-aligned, 10 mm snapping. **Show the plan picture** and **Remove the plan
   picture**.
6. **Place, drag and snap 3D models (G-040).** `ModelItem.placement?: Placement` (floor, wall at a height, on a
   piece); `resolvePlacements` keeps models in line, and a model is never a base. The model panel gets the same
   placement control as pieces. Models drag on the plan and in Move mode through the piece path (ADR-065, ADR-070,
   ADR-093): whole mm, Snap and Alt, snapping to walls, pieces and models, turn 90°, one undo step each.
   `ProjectTemplate.models` keeps them (offset and placement over refs); template files embed the model files
   (`withModels`), imports get new ids. **My 3D models** refuses to delete a model a template uses (ADR-012).
7. **AR (G-008).** The 3D toolbar ⋯ gets **View in AR** when `navigator.xr.isSessionSupported('immersive-ar')` is
   true: three's `renderer.xr` (no `@react-three/xr`, no controller models, which load from a CDN), required
   `hit-test`, optional `dom-overlay`. "Tap the floor to place" puts the shown pieces and models at 1:1 scale, front
   to the phone; **Turn 90° ↻** (AR only), **Exit AR**. **Export for AR (.usdz)**: three's `USDZExporter`
   (MIT, with three's own fflate copy, MIT), loaded on demand; on iPhone (`relList.supports('ar')`) a `rel="ar"`
   link opens AR Quick Look, elsewhere `<name>.usdz` downloads. No request, no new dependency.
8. **WebGPU path tracer (G-022).** The Render dialog (ADR-068) gets a `RenderEngine` seam (start, samples, cancel,
   PNG). With a WebGPU adapter it uses `WebGPUPathTracer` from `three-gpu-pathtracer/webgpu` (same 0.0.27, MIT) on
   `three/webgpu`; otherwise the WebGL 2 tracer. Denoiser and upscaler stay off (weight files). The dialog shows
   "Engine: {name}"; a three or tracer upgrade must pass the render find-it on both engines.

**Documents (ADR-011).** Project `schemaVersion` 22 stores `Room.floor`, `planPicture` and model `placement`;
template `schemaVersion` 4 stores `models` (ADR-204/205/206 plan project 21, design 9, template 3). Older versions
load unchanged; bad entries are problems, never exceptions (ADR-008). Geometry only from the project build (ADR-004).

**Texts.** `t()` with Russian entries: 'Floor background', 'Plan picture', 'Add a plan picture', 'Set the scale',
the scale hint, 'Known length', 'Show the plan picture', 'Remove the plan picture', 'View in AR', 'Tap the floor to
place', 'Exit AR', 'Export for AR (.usdz)', 'Engine: {name}'. No print text. `src/core/features.ts` gains a line per
item (ADR-158).

## Alternatives considered

- **`@react-three/xr`** — a new dependency for what `renderer.xr` does.
- **Plan picture kept on the device only** — it would not travel with the project.
- **A newer tracer release** — 0.0.27 already ships the WebGPU tracer.

## Scope

- In scope: items 1–8, tests, `tools/room-surfaces/find-it.mjs` on the production build.
- Out of scope: angled walls (G-428); the render run on a GPU laptop (G-429); bundled CC0 models (G-430); board
  pictures in catalog pictures and cut sheets (G-431).

## Consequences

- Positive: a room traced from the user's plan that looks real, furnished with placed models, seen in AR.
- Negative / risks: WebXR runs only on some phones; the WebGPU tracer API is young; pictures enlarge files.
- Harder to change later: `floor`, `planPicture`, model `placement` and template `models` in saved files.

## Done when

- [x] Project schema 22 and template schema 4 round-trip; every older version loads; bad entries give problems (tests)
- [x] Plan: wall bands, floor fill, board picture fills, and a plan picture at the typed scale (unit tests on the
      scale and fill helpers)
- [x] Models resolve on floor, wall and a piece, drag with snap on the plan and in Move mode with one undo step, and
      survive a template round-trip; a model a template uses cannot be deleted (tests)
- [x] With `navigator.xr` stubbed, View in AR requests `immersive-ar` with `hit-test`; Export for AR downloads a zip
      holding a `.usda`, with no request (find-it)
- [ ] Render shows "Engine: WebGPU" with an adapter and "Engine: WebGL 2" without, and both reach 8 samples (find-it)
- [x] `tools/room-surfaces/find-it.mjs` at 390 and 1280 px finds **Floor background**, **Plan picture**, **Set the
      scale**, the wall behind a single piece, and a model placed **On a piece**
- [ ] The user checks View in AR on an Android phone and AR Quick Look on an iPhone; result recorded in N213
- [x] Every new text has its `t()` entry; all CI checks pass
