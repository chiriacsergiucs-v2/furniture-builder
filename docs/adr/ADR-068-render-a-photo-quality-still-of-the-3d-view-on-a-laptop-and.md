# ADR-068: Render a photo-quality still of the 3D view on a laptop and save it as PNG

- Status: Pending
- Date: 2026-10-24
- Depends on: ADR-002, ADR-067
- Design: docs/ui-design.md (§3 Button, Dialog; §4 the 3D view)
- Backlog: N63

## Context

The user, 2026-10-24: "I want to be able to design furniture and give it realistic looks, with the
possibility of rendering high quality 3d designs of it, to sell designed kitchens as an example."
Their answers: renders happen on a **laptop**, **preview quality** (a picture a client accepts, not
magazine quality), start with step 1 ([ADR-067](ADR-067-give-the-3d-view-a-realistic-look-board-finishes-room-light.md),
realistic live view) and step 2 (this ADR, a rendered still).

A live WebGL view, however well lit, approximates light. A path tracer follows light bounces and
gives soft, believable reflections and shadows: the picture you send a client. Everything must run
in the browser, offline, with nothing uploaded (ADR-002).

## Decision

- **Engine:** `three-gpu-pathtracer` (MIT, gkjohnson; 0.0.27 needs `three >= 0.185`, we have
  0.186.1) with its peers `three-mesh-bvh` (MIT) and `xatlas-web` (MIT). It path-traces the same
  three scene the viewer shows, on the laptop's GPU through WebGL 2.
- **Loaded only when used:** imported dynamically when the user presses **Render**, so it is its own
  chunk and never in the main bundle or the 3D chunk. The PWA precaches it so rendering works
  offline once the app is installed.
- **Flow:** a **Render** button in the 3D view toolbar opens a dialog _Render a picture_:
  - size: _1920 × 1080_ (default) or _1280 × 720_;
  - **Start** renders the current camera view with ADR-067's realistic materials; selection
    highlights are hidden; a progress line reads "Rendering… 120 / 256 samples" and the picture
    sharpens in the dialog as samples add up; **Cancel** stops and frees the GPU;
  - when done, **Save PNG** downloads `<design name> render.png` to the device. Nothing is uploaded.
- **No WebGL 2:** the dialog says "Rendering needs WebGL 2 on this device" and offers nothing else.
- Hint under the button: "Best on a laptop; a phone may be slow."
- The viewer still never edits the design (ADR-014); rendering reads the same scene.

## Alternatives considered

- **Export to Blender (glTF) and render in Cycles** — best quality, but the user chose preview
  quality in the browser first; possible later as step 3.
- **A cloud render service** — forbidden by ADR-002.
- **Screenshot the live view at high resolution** — cheap, but it is what ADR-067 already shows; no
  real light bounces.
- **Write our own path tracer** — months of work that the MIT library already does.

## Scope

- In scope: the Render button, dialog, progress, cancel, PNG download; the lazy chunk and its
  precache; the three dependencies and their licences.
- Out of scope: Blender/glTF export, animations or turntables, a client sheet with price and
  render, watermarks or logos, phone-specific tuning, render queues.

## Consequences

- Positive: a client-ready picture of a kitchen from the app alone, offline.
- Negative / risks: the library is pre-1.0 (0.0.x); an update may break its API, so its version is
  pinned. Rendering keeps the GPU busy (fan noise, battery) until it finishes or is cancelled. Adds
  several hundred kB to the install, downloaded only once.
- Harder to change later: nothing stored changes; renders are files the user saves.

## Done when

- [ ] The 3D view shows **Render**; it opens _Render a picture_ with the two sizes (find-it at
      390 px and 1280 px)
- [ ] Start shows "Rendering… n / 256 samples" rising; Cancel stops it (scripted browser check)
- [ ] A finished render offers **Save PNG** and the file is a PNG of the chosen size (scripted
      browser check at 1280 × 720)
- [ ] The path tracer is in its own chunk, fetched only after Render is pressed, and precached by
      the service worker (build output and scripted network log)
- [ ] No third-party request at runtime (scripted network log)
- [ ] Without WebGL 2 the dialog says "Rendering needs WebGL 2 on this device" (unit test on the
      capability check)
- [ ] All CI checks pass (`pnpm lint`, `format:check`, `typecheck`, `test`, `build`, `docs:check`)

## Open questions

- Samples per render — default 256 (preview quality); more is sharper and slower.
- Sizes — default 1920 × 1080 and 1280 × 720; add 4K or square for social media?
- Background — default the room as built (walls and floor if the project has a room, otherwise a
  light studio floor).
- Precache the render chunk — default yes (offline); no would save install size but need a network
  the first time.
