# Architecture overview

```
 src/ui (React)                         src/viewer (lazy)
  Elevation ── tap space ─┐              Viewer3D ── click panel ─┐
  Inspector ── edit ──────┤                                       │
  Output (parts/hw/checks)│  reads model                          │ select only
                          ▼                                       ▼
 src/store  Zustand: design ─► buildModel() ─► model ; selection ; undo/redo
                          │
 src/core (pure TS)       ▼
  design.ts  Design doc, templates, tree ops, validateDesign
  build.ts   buildModel: cabinet|desk ─► panels/spaces/hardware ─► independent checks
  cabinet.ts carcass + recursive spaces (split/shelves/drawers/hanging/doors), front zones
  desk.ts    worktop/gables/modesty + pedestals via buildCabinet
  cutlist.ts grouping, edges L/W, grain, m², band metres, CSV, hardware summary
  geometry.ts boxes, overlap, distribute, cutDimensions
                          │
 src/persist  Dexie `furniture-builder` v12 (db.ts:96-208): designs, projects, templates, ... (autosave, library, import/export)
```

Boundaries: `src/core` imports nothing from React, three or Dexie (ADR-013). `src/shared` (`planDrag.ts`, `renderSupport.ts`) holds code that `src/ui` and `src/viewer` both import and imports nothing from the app (ADR-219). Views never generate geometry
(ADR-004). The viewer never edits a design (ADR-014); it only places project pieces with Move and Turn (ADR-093, `src/viewer/pieceDrag.ts` → `src/core/drag3d.ts`). Checks in `build.ts` do not trust generators (ADR-008).
Network (ADR-126, replacing ADR-002's rule): the offline core makes no request; online features live in `src/online`,
are imported only dynamically after the user opts in, and contact only `onlineOrigins()` (`tests/network-boundary.test.ts`).
The opt-in assistant (ADR-239, ADR-240) is the one place an AI model is used: `src/store/assistantStore.ts` sends the
open document, the selection and the action catalog (`src/store/assistantActions.ts`) through `src/online` to the
backend's `assistant` Edge Function (`supabase/functions/assistant`), which holds the provider key and the daily cap.
A reply is a question or a plan of catalog calls; `src/store/assistantRun.ts` checks the plan whole, previews it by
running it and putting the store back, and applies it as one undo step.

Agent sessions run behind a proxy that refuses the Pages URL and ikea.com: deploys are confirmed by their
`Deploy GitHub Pages` run id only; live checks and the catalog feed (ADR-029, ADR-052) need the user or a
session with that access (retro 2026-10-26).

## Shell: places, modes and the phone sheet

Checked in `src/ui/App.tsx`, `src/ui/SheetHandle.tsx`, `src/ui/shell/*`, `src/styles.css`.

- **Places.** `type Page = 'projects' | 'editor' | 'catalog' | 'gaps' | 'info'` (`App.tsx:159`). The location hash picks
  the page (`pageFromHash`, `usePage`, `App.tsx:161-185`); the bare address is Projects. Catalog, Gaps and Info are
  lazy chunks (`App.tsx:72-74`). Nav: `nav.places` inside `header.bar` (`App.tsx:619-664`), a bottom nav at ≤ 760 px
  (`styles.css:4843`). Gaps and Info are reached from ⋯ More or by their hash.
- **Modes.** `MODES = ['compose', 'build']` (`src/store/uiStore.ts:18`), the `.modes` radio group under the bar
  (`App.tsx:831-858`). Hidden on phones (`styles.css:4915-4917`); there the bottom nav adds a Cut list place that sets
  `build` and Editor sets `compose` (`App.tsx:633-654`, ADR-241).
- **Editor layout.** `main.work.mode-<mode>` holds `aside.side` (the Compose panel) and the stage (`App.tsx:898-901`).
  On a phone `.side` is the bottom sheet: a peek row (`SheetHandle` + `.sheet-peek` button), a `#sheet-slot` where
  Settings and Material open (ADR-247), and `.side-body` (`App.tsx:902-926`).
- **Sheet stops.** `peek` (56 px), `half` (40 % of the window height), `full` (to the bar and bottom nav): state in
  `App.tsx:274-284`, heights in `SheetHandle.tsx:6-20`. Selecting a piece or space opens it to half
  (`App.tsx:314-332`); `askSheet` in `uiStore` lets a project's Edit this piece ask for `full` (`src/ui/Project.tsx:510`).
- **⋯ More.** `src/ui/shell/MoreMenu.tsx` (New, Files, language, Gaps, Info, with arrow-key navigation);
  `ProjectsPage.tsx`, `LanguageMenu.tsx`, `files.ts` and `importFile.ts` sit beside it. What each of the last four does
  beyond its imports: not checked.
- Layout detail and tokens: `docs/ui-design.md`.

## Domains (proposed 2026-11-15, not built)

Status: a proposal for splitting the flat `src/core` (149 files), `src/ui` (82) and `src/store` (34) into domain
folders. Nothing is moved yet. Open decisions: folders by domain vs vertical slices vs separate packages; core only
vs core + store + ui. The grouping below comes from file names, not from the import graph; files that straddle
domains (`shopping`, `connections`, `rules`, `gaps`, `variables`) are settled from the imports before any move.

`src/core`:

1. **cabinet**: `cabinet`, `panel`, `panelset`, `frame`, `corner`, `desk`, `shape`, `geometry`, `build`, `assembly`, `explode`, `outline`, `surface`, `styles`, `finish`, `pieceSize`, `sizeLock`, `groupSize`, `varLimits`, `variables`
2. **design**: `design`, `types`, `selection`, `selectPath`, `history`, `snap`, `align`, `arrange`, `replace`, `merge`, `moveTo`, `groupMove`, `height`, `pieceLocks`, `linked`, `sets`, `ownEdits`, `snapshot`, `drag3d`
3. **cutlist**: `cutlist`, `boards`, `materials`, `counts`, `roles`, `ro`, `fusion`, `nesting/*`
4. **hardware**: `fasteners`, `connections`, `clearance`, `compat`, `envelopes`, `rules`
5. **checks**: `diagnosticCodes`, `repairs`, `gaps`
6. **room**: `room`, `roomSurfaces`, `roomfill`, `setRoom`, `wallfill`, `wallPicture`, `planPicture`, `model3d`, `modelPlace`
7. **project**: `project*`, `projectWorktops`, `reviewPack`, `backup`, `backupReminder`, `shareCode`, `zip`, `sync`
8. **templates**: `template`, `templateRevision`, `insertTemplate`, `wizard/*`
9. **shopping**: `shopping`, `shopping-types`, `prices`, `sellers/*`
10. **catalog**: `catalog/*`
11. **i18n**: `i18n/*`
12. **assistant, account**: `assistant`, `account`

`src/ui` and `src/store` follow the same domains: design/editing (`Elevation`, `Inspector`, `Selection`, `Editors`,
`Variables`, `Replace`, `MoveTo`), output (`Output`, `PieceList`, `Sheets`, `Print*`, `BoardBand`), hardware
(`Fasteners`, `Clearances`, `CompatRules`, `Assembly`), room (`Room*`), project (`Project*`, `ReviewPack`, `Share*`),
shopping (`Shopping`, `SellerLinks`), catalog (`Catalog*`, `Templates`, `ProductPicker`, `SaveToCatalog`),
account and assistant (`Account*`, `Assistant`), shell (`shell/`, `Settings`, `Info`, `Dialogs`, `Confirm`).
`src/viewer`, `src/persist` and `src/online` are already domain-shaped and stay. The research domain was removed
(N281).

If built: barrel `index.ts` per domain, a lint rule against deep cross-domain imports, and the Repository layout
in `CLAUDE.md` and this file updated in the same change.
