# Acceptance criteria

**Universal criterion:** an executed test or manual verification artefact linked to the requirement, branch/commit and environment. An unrun or merely documented test is not accepted.

**Panels:** integer mm, material stock, kerf, trim, grain and banding exact. Independently verify no overlap, no boundary breach and correct cut-tree conservation.

**Storage:** valid migration does not delete old keys, is idempotent on refresh and does not overwrite existing Dexie entities. Verify backups and merge restore.

**Modular furniture:** output projections agree on panel identity, quantity and dimensions; no speculative hardware/drilling; save/reload independent instance configuration.

**Viewer:** accessible fallback without WebGL, supported mouse/touch/keyboard navigation where documented.

**Supplier adapter:** signed-off sample demonstrates exact column mapping, edge thickness convention and roundtrip; no default assumption about final versus saw-cut dimensions.

**Release:** run `npm ci`, lint, typecheck, kernel, Vitest, build, Chromium Playwright and deploy checks as appropriate; attach logs, not just status text. Physical Android, Fusion and fixing loads are separate gates.
