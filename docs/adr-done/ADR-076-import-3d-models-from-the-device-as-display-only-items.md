# ADR-076: Import 3D models from the device as display-only items

- Status: Implemented
- Date: 2026-10-24
- Implemented: 2026-10-25 (Merged to main; CI run 40170561018 and Deploy GitHub Pages run 40170561007 green on 895eb54)
- Depends on: ADR-002, ADR-011, ADR-012, ADR-048
- Design: docs/ui-design.md (Add a piece, Plan view, 3D)
- Backlog: N71

## Context

The user, 2026-10-24, on the Feature Research & Catalog selection: "Identify the features and subfeatures
necessary for the following items from research. Import 3D models and model libraries · Duplicate, mirror and
predictable rotate operations · Also for these: [14 features marked Interested]", then "Draft adrs for each".

Research mentions: HomeByMe "import models on applicable plans" and Sweet Home 3D "importable model libraries".
The app builds everything from panels ([ADR-004](../adr-done/ADR-004-every-part-is-an-axis-aligned-box-one-furnituremodel-feeds-e.md)); kitchens and rooms look unfinished without appliances,
sinks, chairs or decor, which are not furniture the app should cut.

## Decision

- **Import:** _Import 3D model_ accepts `.glb` and `.gltf` (with embedded buffers) from the device, read with
  three's own GLTFLoader (no new dependency). Files with external URIs, over 30 MB or over 500 000 triangles are
  refused with a message. No network request, ever (ADR-002).
- **Kept on the device:** the file goes into a new Dexie table `models` (new storage version,
  [ADR-012](../adr-done/ADR-012-local-persistence-in-indexeddb-with-autosave-corrupt-rows-ar.md)); the project keeps a reference `{ modelId, name }` like a board picture ([ADR-048](../adr-done/ADR-048-a-material-can-show-any-picture-from-the-user-s-device-the-p.md)).
  Exported project files embed the models; imported files store them again under new ids.
- **A display-only project item:** `ProjectItem` gains an optional `model` (instead of a `design`): size in mm
  (from the model's bounds, editable with locked proportions), `position`, `rotationY`, `placement`. It is
  **never** in the cut list, costs, shopping list or nesting. Its bounding box takes part in overlap, room and
  clearance checks, is drawn as a labelled box on the plan and in the front view, and renders in 3D and in
  rendered pictures. This is a new project shape: the project `schemaVersion` goes up by one (the next free number when this ships; projects are at 1 today) and older files still load (ADR-011).
- **Orientation:** glTF metres and Y-up are converted to mm; _Front faces_ (four choices) fixes models that face
  the wrong way.
- **Library:** imported models appear in _Add a piece → My 3D models_ with a rendered thumbnail; several files
  can be imported at once; delete asks first and never removes a model a project still uses (ADR-012).

## Alternatives considered

- **Online model libraries** (3D Warehouse, Sketchfab) — runtime third-party requests (ADR-002).
- **Ship a bundled model set** — needs your licence choice and a one-time download.
- **OBJ/FBX** — no materials or a heavy loader; glTF is the open standard.

## Scope

- In scope: GLB/glTF import, device storage, display-only items, checks by bounding box, plan/front/3D drawing,
  export/import, library list.
- Out of scope: editing models, converting models into panels, online libraries, bundled models.

## Consequences

- Positive: appliances, sinks and decor make plans and renders believable.
- Negative / risks: untrusted files are parsed in the page; size and URI checks and a security review are
  required before shipping (`security-review` skill).
- Harder to change later: a new storage version and a project `schemaVersion` bump.

## Done when

- [x] A model item validates; projects of the previous `schemaVersion` load; export/import round-trips with new
      ids (unit tests)
- [x] Model items never reach cut list, costs, shopping list or nesting; their boxes are checked (unit tests)
- [x] Files with external URIs or over the limits are refused (unit tests on the validator)
- [x] A model in use cannot be deleted from the library (storage test)
- [x] _Import 3D model_ and _My 3D models_ are found; the model shows in 3D (find-it at 390 px and 1280 px)
- [x] Security review done; all CI checks pass

## Open questions

- Size limits — default 30 MB and 500 000 triangles.
- Bundled models (fridge, oven, sink) — default none until you choose a licence.
