# Project memory (read first)

Furniture Builder, rebuilt from zero 2026-10-21 on `rebuild/v1`; clean break from the old app and its data (ADR-001).
Offline static PWA, no backend (ADR-002). Integer mm, x/y/z = width/height-from-floor/depth-from-back (ADR-003).
Panels are boxes; one `buildModel()` feeds elevation, 3D, parts, hardware, checks (ADR-004). Cabinets are recursive
space trees: split / shelves / drawers / hanging / empty + optional doors (ADR-005). Full-overlay fronts with exact
gaps (ADR-006). Desk pedestals are cabinets (ADR-007). Problems are diagnostics; independent overlap/envelope
checks; errors block CSV (ADR-008). Cut list = finished sizes, L/W edge counts, grain → length (ADR-009). Hardware
is a labelled schedule (ADR-010). Design = self-contained validated JSON (ADR-011). Dexie `furniture-builder` v1,
autosave, never delete unreadable rows (ADR-012). Front elevation edits; 3D previews (ADR-014). Tests: core +
seeded fuzz + storage; no browser suite by default (ADR-015). Process: smallest slice, evidence-only ledger in
`docs/backlog.md`, end replies with _Skipped this iteration_ (ADR-016).

User decisions 2026-10-21: kerf 4 mm; PAL/HDF 2800 × 2070, MDF 2440 × 1220; trim 10 mm; full sheets only; A4 portrait;
Romanian on paper and CSV; never subtract edge band; ball-bearing side runners; 35 mm soft-close clip-on hinges;
inset gap 3 mm; handles bar/knob/push; blind + L corners; bracket-and-rail wall mounting; independent pedestals;
projects embed copies; no orchestration runtime. Details in ADR-009/010/017–026.

Unknown — never invent: loads, drilling depths, screw specs, exact supplier datasheet values.

Catalog (2026-10-23, ADR-032–039, Proposed with defaults, built on `feat/catalog-templates`): 42 template families of
complete design snapshots copied on insert (origin kept, ADR-028), 1–5 variants each, Start from + Catalog tab grouped
by Room (default) or Type; local template edits in Dexie v3; rules registry (`src/core/rules.ts`); kitchen flags
(rails top, no bottom, appliance niches typed by the user), `panel` and `frame` roots, sliding doors and flaps, solid
stock in a lengths list, project run parts. `docs/catalog.md` is generated (`npm run catalog:docs`). No formula engine,
no template inheritance; shaped parts (raked backs, diagonal fronts) need a future ADR.

User answers 2026-10-23 (all ADR open questions): kitchen carcass 720 + plinth 100; shelf span 900 (18 mm), door 600,
hanger depth 530, anti-tip > 1000; no scribe allowance; sliding 30 / 80; timber lengths 2400 + 3000, joinery not
listed; brand cleared on first edit; all saved pieces in the Catalog; own templates mixed in by room/type; placement
keeps its own turn, Wall warns, gap tool hidden above; feed weekly IKEA only; own confirm dialogs; theme toggle stays;
no guided New (amended same day: "New piece" wizard, ADR-044); phone bottom bar; shaped-part ADR next (ADR-040).

New-piece wizard (2026-10-23, ADR-044–046, Proposed): New → "New piece" asks sizes, a construction type (cabinet,
open shelving, table, bench, desk) and only that type's steps; types, steps and suggestion generators are data in
`src/core/wizard/`; cards are candidates built by `buildModel()` with no errors, ranked default-first then by variety;
the result is a normal design saved with `saveDesign()` (no Dexie change). Legs under a carcass are not in the model.

User answers 2026-10-23 (ADR-040–046): rake default 8° kept; recliner 100/120/150°; full-size profile templates;
Pat Noi bed joins with bed-rail brackets (rail height unknown, ADR-041 stays Proposed); catalog pictures also in
Start from + drawn in the browser for edited families (N36); no auto backlog from research approvals; tab label kept;
wizard: add Wardrobe and Bed types, keep answers to reopen in the wizard (N35); no legs under cabinets now; 6/64 cards.
Built 2026-10-23: wizard types Wardrobe and Bed; answers stored on pieces (`wizard.answers`) with "Open in wizard";
catalog pictures in Start from and drawn in the browser for edited families (N35, N36).
Built 2026-10-23: ADR-040 shaped parts (tilt/profile on whole-mm blanks; raked backs 8°, recliner and lounger
positions 100/120/150°, diagonal corner, U-cut sink drawer, full-size print templates); ADR-041 placed panels and
screwed joints (Pat Noi sides screwed to the foot board). Feed (ADR-029) blocked here: ikea.com not allowed.
Built 2026-10-23 (N38): the app starts on a Home welcome page (create a new project, choose a saved one); editor at #editor.
Built 2026-10-24 (N41): Mobila — Living re-done from catalog base cabinets, 1-door + 2-door + 1-door on the floor and at the ceiling (805 · 1610 · 805 × 435, 3220 wall).
User answers 2026-10-24 (ADR-047): merging refuses pieces of different height or depth; cabinets only; project-level undo
added (ADR-051, N46). Process: the repository follows the reserv flow (ADR-050): `docs/adr`, `.claude/skills`, `CLAUDE.md`.
