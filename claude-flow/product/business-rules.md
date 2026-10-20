# Business rules

- Dimensions are integer mm in the optimiser and must not be silently changed by edging metadata.
- Validate guillotine placement before diagram/export. Heuristic results are not guaranteed global minima.
- Respect stock availability, orientation, grain, trim, kerf and material compatibility.
- Existing project snapshots must remain reproducible after library changes.
- Migration never deletes source keys; preserving existing IndexedDB IDs is required.
- New furniture types are specialist roots + shared reusable child components, not renamed cabinets.
- A template is "ready" only if it yields actual valid geometry/manufacturing output; catalogue concept counts do not imply readiness.
- Fusion direct-model snapshot is not a live-linked native CAD model.
- Neither the panel viewer nor untested BOM signifies structural or installation certification.
- SALICE 'FINAL dimensions include ABS' contradicts a naive one-to-one mapping from optimiser cut dimensions; adapter must resolve it per vendor specification.
