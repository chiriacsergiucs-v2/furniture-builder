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
