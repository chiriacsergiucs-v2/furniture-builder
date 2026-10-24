# ADR-066: Give the 3D view a realistic look: board finishes, room light and soft shadows

- Status: Pending
- Date: 2026-10-24
- Depends on: ADR-014, ADR-048
- Design: docs/ui-design.md (§3 Segmented, §4 Materials and the 3D view)
- Backlog: N61

## Context

The user, 2026-10-24: "I want to be able to design furniture and give it realistic looks, with the
possibility of rendering high quality 3d designs of it, to sell designed kitchens as an example."
Asked where and how well, they answered: "Laptop, preview quality, start with step 1 and 2". Step 1
is this ADR (a realistic live 3D view); step 2 is [ADR-067](ADR-067-render-a-photo-quality-still-of-the-3d-view-on-a-laptop-and.md)
(a rendered still). Export to Blender (step 3) is not asked for.

Today the viewer (`src/viewer/Viewer3D.tsx`, ADR-014) draws every panel with `meshStandardMaterial`
in the board's display colour or the user's picture (ADR-048), with contact shadows and no
environment light, so boards look flat and plastic. The stack stays three + @react-three/fiber +
drei (ADR-013); the viewer stays lazy and select-only (ADR-014); no network (ADR-002).

## Decision

- **Board finish.** `Material` gains an optional `finish?: 'matte' | 'satin' | 'gloss'`; absent
  means `matte`. It is display-only, like `color` and `image`: never in the cut list, CSV, print,
  nesting or costs. Validation accepts only these three values (an unknown value is a validation
  error on load/import, ADR-011). It is optional, like ADR-048's `image` and ADR-049's labels, so
  `schemaVersion` stays 2 and older files load unchanged.
- **Finish → look** is one pure table in `src/core/surface.ts` (`finishLook`): roughness and
  clearcoat per finish. These are rendering values, not supplier or physical specs (ADR-010).
- **Materials dialog:** each board gets a **Finish** segmented control: _Matte · Satin · Gloss_.
- **Look control** in the 3D view: segmented **Simple · Realistic**. _Simple_ is today's view.
  _Realistic_ adds:
  - image-based light from three's built-in `RoomEnvironment` through `PMREMGenerator`, generated
    in code, so there is no HDRI file to download or ship;
  - `meshPhysicalMaterial` with the finish's roughness and clearcoat; user pictures in sRGB;
  - ACES Filmic tone mapping and sRGB output;
  - one key light with soft shadow maps, so panels cast real shadows on each other and the floor;
  - ambient occlusion with three's own `GTAOPass` (from `three/examples/jsm`, no new dependency).
- The choice lives in `localStorage` (`fb:look`, this device only), like the theme. Default:
  _Realistic_ at widths ≥ 1024 px, _Simple_ below.
- Selection and parts-list hover highlights stay visible in both looks; the exploded view, room
  boxes and click-to-select work as today. Geometry still comes only from `buildModel()` (ADR-004).

## Alternatives considered

- **Ship an HDRI file or use drei `<Environment preset>`** — the presets download from a CDN at
  runtime (forbidden by ADR-002); a bundled HDRI adds 1–5 MB and needs a download now. The
  generated `RoomEnvironment` needs neither.
- **The `postprocessing` / N8AO libraries for ambient occlusion** — a new dependency for something
  three already ships.
- **A different engine (Babylon.js, PlayCanvas)** — ADR-013 fixes three; nothing here needs more.
- **Bundled wood-grain textures** — need a licence choice and a download; left as an open question.

## Scope

- In scope: the `finish` field and its validation; the Finish control; the Look control; the
  realistic lighting, materials, shadows and ambient occlusion; tests and a find-it test.
- Out of scope: rendered stills (ADR-067), bundled textures, appliances and sinks, worktop edge
  profiles, wall and floor finishes, Blender/glTF export.

## Consequences

- Positive: kitchens look like real boards in the live view; it feeds ADR-067's renders.
- Negative / risks: _Realistic_ costs GPU time; older laptops and phones may stutter, hence the
  _Simple_ default on narrow screens and the toggle.
- Harder to change later: `finish` is saved in designs; it can gain values but not lose them.

## Done when

- [ ] `finish` validates (three values accepted, anything else rejected, absent = matte) and
      round-trips through export/import (unit test)
- [ ] `finish` never changes the cut list, CSV, nesting, costs or print (unit test)
- [ ] `finishLook` gives a distinct roughness per finish, gloss lowest (unit test)
- [ ] The Materials dialog shows **Finish** with _Matte · Satin · Gloss_ and the 3D view shows
      **Simple · Realistic**; the choice survives a reload (find-it at 390 px and 1280 px)
- [ ] _Realistic_ shows environment light, tone mapping, soft shadows and ambient occlusion, and the
      selected part is still highlighted (screenshots at 1280 px, light and dark)
- [ ] The production build makes no third-party request and the 3D chunk still loads only when the
      3D view is visible (build output and scripted network log)
- [ ] All CI checks pass (`pnpm lint`, `format:check`, `typecheck`, `test`, `build`, `docs:check`)

## Open questions

- Roughness/clearcoat per finish — default matte 0.85, satin 0.5, gloss 0.15 + clearcoat 0.6;
  tune by eye on your laptop.
- Default look by width — default _Realistic_ ≥ 1024 px, _Simple_ below.
- Bundled wood and stone textures (for example CC0 décors) — default none: plain colour or your own
  pictures (ADR-048). Bundling needs your licence choice and a one-time download.
