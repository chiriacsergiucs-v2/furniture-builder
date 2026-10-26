/**
 * Where this app stands on each research feature, and the remaining features merged because they share one idea
 * (ADR-092, 2026-10-26). Repository records, not research: every status cites the backlog row or ADR that shows it.
 *
 * Statuses: Verified — built, and shipped with a find-it pass recorded in `docs/backlog.md`; Implemented — built and
 * unit-tested, no browser acceptance of its own; In Progress — part of it is built, `missing` says what is not (user
 * answer 2026-10-26: "In Progress + what's missing"). Features not listed are Not Started. A status the user sets on
 * the page wins over these.
 */
import type { Implementation } from './types';

type Status = [status: Implementation, evidence: string, missing?: string];

export const APP_CHECKED = '2026-10-26';

export const ENSEMBLE_APP_STATUS: Record<string, Status> = {
  // Verify batch (N48: 11 features found in the app, find-it 40/40)
  'cross-family': ['verified', 'N48: one project mixes a base cabinet, a wardrobe and a daybed.'],
  'precise-numeric': ['verified', 'N48, N13: From left kept at 4321 mm; Gap to … on the left.'],
  'numeric-transform': ['verified', 'N48, N13: positions and gaps typed in whole mm.'],
  'sync-2d-3d': ['verified', 'N48, N11, N76: plan, front and 3D views of the same project model.'],
  'ortho-plan': [
    'verified',
    'N48, N11: the plan is a top projection of the built model (ADR-004).',
  ],
  dimensioning: ['verified', 'N48, N11: plan measurements in mm.'],
  'in-context-editing': [
    'verified',
    "N48, N86: edit a project piece's size, boards and construction in the project.",
  ],
  'keep-identity': [
    'verified',
    'N48: pieces stay separate after editing; merging is a separate action (N42).',
  ],
  'finish-change': ['verified', 'N48, F16, N43: board colour, name and a picture from the device.'],
  'structured-exports': [
    'verified',
    'N48, F09, N03: Parts CSV, design/project JSON files, Fusion 360 script.',
  ],
  'production-drawings': [
    'verified',
    'N48, N02: SVG front drawing and printed cutting sheets (PDF).',
  ],
  'project-documentation': [
    'verified',
    'N48, N02, N04: printed project sheets and project Parts CSV.',
  ],
  // Shipped ADRs that name the research row
  'transactional-undo': [
    'verified',
    'N46 (ADR-051): undo/redo for project changes, one step per drag (N60).',
    'connections and groups (not built) are not undoable yet',
  ],
  'fillers-plinths-panels': [
    'verified',
    'N26, N49 (ADR-054): run fillers with scribe, cover panels, run plinth.',
  ],
  'gen-filler': ['verified', 'N26, N49 (ADR-054): run fillers with scribe allowance.'],
  'gen-plinth': ['verified', "N49 (ADR-054): run plinth replacing the pieces' plinths."],
  'gen-end-panel': ['verified', 'N26, N49: cover panels on exposed run ends.'],
  'gen-trim': ['verified', 'N70 (ADR-075): crown, pelmet and ceiling filler trims.'],
  'crown-moulding': ['verified', 'N70 (ADR-075): crown trim over wall or tall units.'],
  countertops: [
    'verified',
    'N26, N70 (ADR-075): one run worktop, or a worktop over chosen adjacent units.',
  ],
  'generated-parts': [
    'verified',
    'N26, N49, N56, N70: run parts derived from the pieces they span.',
    'shared supports, sinks and handles are not generated',
  ],
  'generated-part-mechanism': [
    'verified',
    'N56 (ADR-061): run parts are one generated kind, rebuilt from their pieces.',
  ],
  'generated-overrides': [
    'verified',
    'N56 (ADR-061): removed run parts stay removed; settings kept.',
  ],
  'dependency-regeneration': [
    'verified',
    'N56 (ADR-061): run parts refresh by themselves after a change.',
  ],
  'material-propagation': [
    'verified',
    'N50 (ADR-055): apply a board to this piece, this run or the whole project.',
  ],
  'finish-scope': ['verified', 'N50 (ADR-055): This piece / This run / Whole project.'],
  'material-overrides': [
    'verified',
    'N50 (ADR-055): a piece keeps its own board when applied to "this piece".',
  ],
  'ensemble-workspace': [
    'verified',
    'N51 (ADR-056), N22: pick a catalog item, tap the plan to place it.',
  ],
  'catalogue-placement': ['verified', 'N51, N04: add several catalog pieces to one project.'],
  'catalogue-categories': ['verified', 'N22: catalog by room or by type.'],
  'collision-clearance': [
    'verified',
    'N04, N52 (ADR-057), N68 (ADR-073): overlaps, opening and use clearances checked.',
  ],
  'static-collision': ['verified', 'N04, N10: "… overlap in the room", "goes below the floor".'],
  'env-solid': ['verified', 'N04: piece bodies checked against each other.'],
  'env-door': ['verified', 'N52 (ADR-057): door swing needs free space.'],
  'env-drawer': ['verified', 'N52 (ADR-057): drawer travel needs free space.'],
  'clearance-envelopes': [
    'verified',
    'N52, N68: doors, drawers, flaps, chair, installation and service zones.',
  ],
  'env-chair': ['verified', 'N68 (ADR-073): chair space depth.'],
  'env-installation': ['verified', 'N68 (ADR-073): installation height when assembled lying down.'],
  'env-service': ['verified', 'N68 (ADR-073): service zone depth.'],
  'clearance-overlays': [
    'verified',
    'N68 (ADR-073): Clearances toggle on the plan, three severities.',
  ],
  'room-geometry': [
    'verified',
    'N53 (ADR-058): room size, doors, windows and obstacles, checked against pieces.',
  ],
  'room-walls': ['verified', 'N53, N54: walls and corners, incl. L / U / alcove outlines.'],
  'room-openings': ['verified', 'N53 (ADR-058): doors and windows, "higher than its sill".'],
  'room-obstacles': ['verified', 'N53 (ADR-058): "runs into Obstacle 1".'],
  'room-services': ['verified', 'N67 (ADR-072): pipes and outlets checked against pieces.'],
  'room-validation': [
    'verified',
    'N53, N54: pieces checked against walls, openings, obstacles and the outline.',
  ],
  'floor-plan-2d': ['verified', 'N54 (ADR-059): draw axis-aligned L / U / alcove outlines.'],
  'ensemble-templates': [
    'verified',
    'N55 (ADR-060): save a project as a reusable project template.',
  ],
  'paste-ensemble': [
    'in-progress',
    'N55 (ADR-060): create a new project from a project template.',
    'inserting a saved template into an open project',
  ],
  'live-price': [
    'verified',
    "N57 (ADR-062): estimate from the user's own price list.",
    'live supplier prices (N58, ADR-063 deferred)',
  ],
  'auto-bom': [
    'verified',
    'N59 (ADR-064): one shopping list for the project — boards, banding, hardware, run parts.',
  ],
  'order-completeness': [
    'verified',
    'N59 (ADR-064): "to choose before buying" lists what is still missing.',
  ],
  'guided-snapping': [
    'verified',
    'N65 (ADR-070): snap to neighbours and walls with preview, toggle and Alt override.',
  ],
  'snap-preview': ['verified', 'N65 (ADR-070): dashed snapped preview with its label.'],
  'snap-override': ['verified', 'N65 (ADR-070): Snap toggle; Alt places freely.'],
  'snap-candidate-ranking': ['verified', 'N65 (ADR-070): candidates ranked in `snapDrag`.'],
  'why-wont-connect': ['verified', 'N65 (ADR-070): "Won\'t snap to …" hint.'],
  'duplicate-mirror-rotate': [
    'verified',
    'N64 (ADR-069): duplicate, mirror, mirror the run, turn 90°.',
  ],
  'explainable-warnings': [
    'verified',
    'N66 (ADR-071): select the problem, explain it, offer previewed repairs.',
  ],
  'select-and-explain': [
    'verified',
    'N66 (ADR-071): "Show on the plan and see repairs"; "… overlap by 34 mm".',
  ],
  'repair-suggestions': [
    'verified',
    'N66 (ADR-071): move either piece, hang higher/lower, add a filler, move inside the room.',
  ],
  'hardware-completeness': [
    'verified',
    'F10, N69 (ADR-074): hardware schedule and fastener counts, labelled as guidance (ADR-010).',
  ],
  'board-bom': [
    'verified',
    'F09, F10, N69: cut list, hardware schedule and fastener counts per project.',
  ],
  deduplication: ['verified', 'F09, N69: identical parts grouped; shopping lines combined.'],
  'model-import': ['verified', 'N71 (ADR-076): import GLB/glTF models as display-only items.'],
  'photoreal-rendering': [
    'verified',
    'N62, N63 (ADR-067/068): realistic look and a photo-quality still, checked by the user on the live app.',
  ],
  'exploded-view': ['verified', 'N12: exploded 3D view of a piece and a project.'],
  'cut-list': ['verified', 'F09: grouped cut list with edge banding and CSV.'],
  'sheet-optimisation': [
    'verified',
    'N01: guillotine sheet nesting with an independent validator.',
  ],
  'drag-drop-placement': [
    'in-progress',
    'N60 (ADR-065): drag a piece on the plan to move it; N51: tap the plan to place.',
    'dragging a catalog item into the plan',
  ],
  picking: ['verified', 'F12, N78: tap or click to select in the drawing and in 3D.'],
  'custom-furniture': [
    'verified',
    'F01–F13, N34: design pieces from scratch or with the New-piece wizard.',
  ],
  'resize-generic': ['verified', "N86 (ADR-090): change a piece's size from the project editor."],
  'mobile-parity': [
    'verified',
    'F18, N82: one phone-first app, same features on phone and desktop.',
  ],
  'precision-tooltips': [
    'verified',
    'N60 (ADR-065): "From left … · From back …" label while dragging.',
  ],
  'controllable-automation': [
    'verified',
    'N65, N66, N56: snapping can be switched off, repairs are previewed, run-part removals are kept.',
  ],
  revalidation: ['verified', 'N04, N66: project checks rerun after every change.'],
  // Built, tested, no browser acceptance of its own
  'domain-graph': [
    'implemented',
    'ADR-004: every view and list is a projection of buildModel(); nothing authoritative in three.js.',
  ],
  'schema-migrations': [
    'implemented',
    'ADR-011, ADR-012: schemaVersion upgrades keep old readers; Dexie versions never edited (storage tests).',
  ],
  'template-api': [
    'implemented',
    'ADR-004: buildModel() exposes bounds; the store edits parameters from outside the editor.',
  ],
  'approachable-complexity': [
    'implemented',
    'N22, N34, N38: catalog, New-piece wizard and Home page start without modelling.',
  ],
  'professional-review': [
    'implemented',
    'N04, N02: export the project file or print it for a professional to check.',
  ],
  'independent-selection': [
    'implemented',
    'N84 (ADR-088): each project piece stays selectable with its own controls.',
  ],
  // Partly built
  'semantic-connectors': [
    'in-progress',
    'N65 (ADR-070): snapping uses connectors derived from piece boxes and walls.',
    'authored, typed connectors with frames and orientations on templates',
  ],
  'compatibility-engine': [
    'in-progress',
    'N25 rules registry; N65 snap rules refuse some targets.',
    'product-family, dimension and exclusion rules for connections',
  ],
  'inspectable-rules': [
    'in-progress',
    'N25 (ADR-035): rules registry as data, labelled warnings.',
    'repair strategies stored with each rule',
  ],
  'cad-cnc-export': [
    'in-progress',
    'N03, N02, F09: Fusion 360 script, SVG/PDF, CSV.',
    'DXF, STEP and CNC output',
  ],
  'direct-manipulation': [
    'in-progress',
    'N60, N64: drag and turn pieces on the plan.',
    'moving in 3D (the viewer only selects, ADR-014) and free rotation',
  ],
  'alignment-distribution': [
    'in-progress',
    'N65 (ADR-070): snapping aligns faces to neighbours and walls.',
    'centre alignment and equal distribution',
  ],
  'multi-select-groups': [
    'in-progress',
    'N50, N64: run-wide actions (this run, mirror the run).',
    'multi-select, selection box and saved groups',
  ],
  'composition-layer': [
    'in-progress',
    'N04: projects of independent pieces above the item editor.',
    'composition metadata (connectors, compatibility tags, dependency rules)',
  ],
  'ensemble-model': [
    'in-progress',
    'N04, N53, N56: project with items, room and run parts.',
    'connections, groups and template references',
  ],
  'versioned-save': [
    'in-progress',
    'N48, F14: projects saved and reopened with every piece and position.',
    'template versions and connections',
  ],
  'propagation-pipeline': [
    'in-progress',
    'N56, N66: after a change, checks rerun and run parts regenerate.',
    'connector frames and constraints (no connectors yet)',
  ],
  'deterministic-alternatives': [
    'in-progress',
    'N34 (ADR-045): suggested combinations kept only when buildModel() has no errors — per piece.',
    'alternative layouts of a whole project',
  ],
};

/**
 * Remaining features merged into another with the same idea (user answer 2026-10-26: "Broad: same common idea").
 * Non-destructive: the feature stays, hidden from lists, and is shown on its target; the user can undo each merge.
 */
export const ENSEMBLE_MERGES: Record<string, [target: string, reason: string]> = {
  'reference-copies': [
    'template-instancing',
    'Both make instances refer to one template definition instead of copying it.',
  ],
  'composition-metadata': [
    'composition-layer',
    'The metadata is what the composition layer consists of.',
  ],
  'connector-frame': [
    'semantic-connectors',
    'A field of the connector definition, not buildable on its own.',
  ],
  'connector-kinds': [
    'semantic-connectors',
    'A field of the connector definition, not buildable on its own.',
  ],
  'connector-snap-settings': [
    'semantic-connectors',
    'A field of the connector definition, not buildable on its own.',
  ],
  'connector-optional': [
    'semantic-connectors',
    'A rule of introducing connectors: templates without them keep working.',
  ],
  'connector-authoring': [
    'semantic-connectors',
    'Authoring is how templates get their connectors.',
  ],
  'persistent-connections': [
    'assembly-graph',
    'Committed connections are the edges of the assembly graph.',
  ],
  'connection-constraints': [
    'assembly-graph',
    "Constraints are stored on the graph's connections.",
  ],
  'connection-status': ['assembly-graph', "Status is stored on the graph's connections."],
  unsnap: ['assembly-graph', 'Removing an edge of the assembly graph.'],
  'inference-points': [
    'alignment-distribution',
    'Snapping to corners, centres and midpoints is alignment.',
  ],
  'connector-compat-rules': [
    'compatibility-engine',
    "The per-connector rules are the engine's content.",
  ],
  'interface-capabilities': [
    'multi-supplier-catalogue',
    "Interface capabilities exist so several suppliers' ranges can mate.",
  ],
  'catalogue-validation': ['inspectable-rules', 'A by-product of rules stored as data (line 570).'],
  'support-diagnostics': ['inspectable-rules', 'A by-product of rules stored as data (line 570).'],
  'rapier-queries': [
    'collision-clearance',
    'A query engine for the same collision and clearance checks.',
  ],
  'transform-gizmos': ['direct-manipulation', 'Handles are one way of moving and rotating pieces.'],
  'named-groups': [
    'multi-select-groups',
    'Saved groups are part of "groups and whole-ensemble transforms".',
  ],
  'local-propagation': ['dependency-regeneration', 'How dependency regeneration limits its work.'],
  'replace-workflow': ['compatible-swap', 'The workflow of compatible replacement.'],
  'preserve-intent': ['compatible-swap', 'What compatible replacement must keep.'],
  'global-parameters': [
    'material-propagation',
    'The mechanism behind the finish scope selector (built as N50).',
  ],
  'live-manufacturer-data': [
    'multi-supplier-catalogue',
    'Live data is how a cross-manufacturer catalogue stays current.',
  ],
  labels: ['cad-cnc-export', 'Part labels are a manufacturing output.'],
  'manufacturing-adapter': ['cad-cnc-export', 'The layer that produces manufacturing output.'],
  'build-a-run': ['auto-fit-span', 'The workflow of auto-fitting a span.'],
  'auto-fill-span': [
    'auto-fit-span',
    'Filling the rest of a span with modules and fillers is auto-fit on the free length.',
  ],
  'budget-style-filters': ['deterministic-alternatives', 'Filters on the generated alternatives.'],
  'layout-optimisation': ['deterministic-alternatives', 'Ranking generated alternatives.'],
  'ai-floorplan': ['ai-layout', 'AI layout on the room plan.'],
  'ai-explains': ['ai-layout', 'Part of the AI layout loop (propose, explain, validate).'],
  'inspiration-images': ['nl-generation', 'Another input to intent-driven generation.'],
  'family-presets': [
    'cross-family',
    'Presets over one engine are how cross-family composition avoids separate modes.',
  ],
  'yjs-crdt': ['collaboration', 'A technology for real-time collaboration.'],
  'command-log': [
    'transactional-undo',
    "A technique for atomic undo; the app's snapshot undo (N46) meets the same need.",
  ],
};
