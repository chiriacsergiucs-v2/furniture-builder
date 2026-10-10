# Guillotine optimizer v0.1

For each part instance the engine considers candidate free leaves on existing sheets, then permitted new offcuts/sheets. It scores fit by area/short-side/long-side residual, explores vertical-first/horizontal-first partitions, and repeats deterministic seeded orderings. Every placement replaces one free leaf with a recursively splittable guillotine tree. Cuts consume full-length kerf stripes; a residual too narrow for the configured kerf is rejected. Parts must match material ID and thickness, sheet inventory, grain and rotation rules. The independent validator reconstructs child rectangles, counts requested instances and checks area conservation. Geometric coordinates refer to the full physical sheet, with trimmed margins excluded.

Objective is lexicographic: fewest unplaced instances, then new stock sheets, then unrecoverable waste, then recoverable area, then cut count. It is a heuristic search; **not a mathematical global optimum**. Cutting-machine tolerances and cutting-order feasibility for production require operator review beyond the geometric tree.

Areas in mm²: `gross = parts + trims + kerf + recoverable + unrecoverable`. Utilization = `100 * part area / gross stock consumed area` (counts both stock sheets and used offcuts). Recoverability uses configured minimum offcut width, height and area.
