# Business rules (manufacturing truths the software encodes)

| Rule | Where enforced | ADR |
|---|---|---|
| Dimensions are whole millimetres; no rounding on import | `src/engine/schema.ts` | ADR-0007 |
| Kerf (default 4 mm) is removed along the full cut; residual < kerf is unusable | `src/engine/guillotine.ts` | ADR-0008 |
| A part must match sheet material **and** thickness | `src/engine/optimize.ts`, `validate.ts` | ADR-0009 |
| Grain-locked parts follow sheet grain; rotation only when allowed and non-square | `src/engine/geometry.ts` | ADR-0009 |
| Trim margins are unusable; coordinates are on the physical sheet | `src/engine/geometry.ts (usableOf)` | ADR-0009 |
| Offcuts are reusable only above configured min width/height/area | `src/engine/optimize.ts` | ADR-0011 |
| Preference order: existing board → offcut → new sheet | `src/engine/optimize.ts (cost 0/1/2)` | ADR-0011 |
| ABS is an edge label; finished-size inputs need an explicit transform | `src/engine/types.ts` | ADR-0010 |
| Hardware is purchased, never cut | `src/furniture/furniture-model.ts` | ADR-0019 |
| Drawer body = sides + back + inner front (+ applied front); 2 mm reveal default | `src/furniture/drawer.ts`, `AGENTS.md` v0.4 | ADR-0018 |
| Doors never span drawer fronts; double doors have a 3 mm gap | `docs/progress.json` iteration 9 | ADR-0020 |
| A layout is never "optimal"; operator reviews cutting order | `docs/algorithm.md` | ADR-0011 |
