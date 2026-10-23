# Project memory (read first)

Furniture Builder, rebuilt from zero 2026-10-21 on `rebuild/v1`; clean break from the old app and its data (ADR-0001).
Offline static PWA, no backend (ADR-0002). Integer mm, x/y/z = width/height-from-floor/depth-from-back (ADR-0003).
Panels are boxes; one `buildModel()` feeds elevation, 3D, parts, hardware, checks (ADR-0004). Cabinets are recursive
space trees: split / shelves / drawers / hanging / empty + optional doors (ADR-0005). Full-overlay fronts with exact
gaps (ADR-0006). Desk pedestals are cabinets (ADR-0007). Problems are diagnostics; independent overlap/envelope
checks; errors block CSV (ADR-0008). Cut list = finished sizes, L/W edge counts, grain → length (ADR-0009). Hardware
is a labelled schedule (ADR-0010). Design = self-contained validated JSON (ADR-0011). Dexie `furniture-builder` v1,
autosave, never delete unreadable rows (ADR-0012). Front elevation edits; 3D previews (ADR-0014). Tests: core +
seeded fuzz + storage; no browser suite by default (ADR-0015). Process: smallest slice, evidence-only ledger in
`docs/backlog.md`, end replies with *Skipped this iteration* (ADR-0016).

User decisions 2026-10-21: kerf 4 mm; PAL/HDF 2800 × 2070, MDF 2440 × 1220; trim 10 mm; full sheets only; A4 portrait;
Romanian on paper and CSV; never subtract edge band; ball-bearing side runners; 35 mm soft-close clip-on hinges;
inset gap 3 mm; handles bar/knob/push; blind + L corners; bracket-and-rail wall mounting; independent pedestals;
projects embed copies; no orchestration runtime. Details in ADR-0009/0010/0017–0026.

Unknown — never invent: loads, drilling depths, screw specs, exact supplier datasheet values.

Catalog (2026-10-23, ADR-0032–0039, Proposed with defaults, built on `feat/catalog-templates`): 42 template families of
complete design snapshots copied on insert (origin kept, ADR-0028), 1–5 variants each, Start from + Catalog tab grouped
by Room (default) or Type; local template edits in Dexie v3; rules registry (`src/core/rules.ts`); kitchen flags
(rails top, no bottom, appliance niches typed by the user), `panel` and `frame` roots, sliding doors and flaps, solid
stock in a lengths list, project run parts. `docs/catalog.md` is generated (`npm run catalog:docs`). No formula engine,
no template inheritance; shaped parts (raked backs, diagonal fronts) need a future ADR.

User answers 2026-10-23 (all ADR open questions): kitchen carcass 720 + plinth 100; shelf span 900 (18 mm), door 600,
hanger depth 530, anti-tip > 1000; no scribe allowance; sliding 30 / 80; timber lengths 2400 + 3000, joinery not
listed; brand cleared on first edit; all saved pieces in the Catalog; own templates mixed in by room/type; placement
keeps its own turn, Wall warns, gap tool hidden above; feed weekly IKEA only; own confirm dialogs; theme toggle stays;
no guided New; phone bottom bar; shaped-part ADR next (ADR-0040).
