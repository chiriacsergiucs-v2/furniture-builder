/**
 * Where this app stands on each research feature left to build, and the features merged because they share one idea
 * (ADR-092, re-checked 2026-10-27 for ADR-111). Repository records, not research: every status cites the backlog row
 * or ADR that shows it.
 *
 * Statuses: In Progress — part of it is built, `missing` says what is not (user answer 2026-10-26: "In Progress +
 * what's missing"). Features not listed are Not Started. Built features (Verified, Implemented) are deleted from the
 * data (ADR-111) and listed in `ENSEMBLE_REMOVED`. A status the user sets on the page wins over these.
 */
import type { Implementation } from './types';

type Status = [status: Implementation, evidence: string, missing?: string];

export const APP_CHECKED = '2026-10-27';

export const ENSEMBLE_APP_STATUS: Record<string, Status> = {
  'precise-numeric': [
    'in-progress',
    'N48, N13: From left kept at 4321 mm; Gap to … on the left.',
    'typed rotation (turns are 90° steps, N64)',
  ],
  'numeric-transform': [
    'in-progress',
    'N48, N13: positions and gaps typed in whole mm.',
    'typed rotation (turns are 90° steps, N64)',
  ],
  'transactional-undo': [
    'in-progress',
    'N46 (ADR-051): undo/redo for project changes, one step per drag (N60).',
    'undo of snap, unsnap, group and compound operations (connections and groups are not built)',
  ],
  'generated-parts': [
    'in-progress',
    'N26, N49, N56, N70: run parts derived from the pieces they span.',
    'shared supports, sinks and handles as generated parts',
  ],
  'ensemble-templates': [
    'in-progress',
    'N55 (ADR-060): save a project as a reusable project template.',
    'templates keep copies, not item references, connections or generated-part recipes',
  ],
  'paste-ensemble': [
    'in-progress',
    'N55 (ADR-060): create a new project from a project template.',
    'inserting a saved template into an open project',
  ],
  'live-price': [
    'in-progress',
    "N57 (ADR-062): estimate from the user's own price list.",
    'live supplier prices (N58, ADR-063 deferred)',
  ],
  'independent-selection': [
    'in-progress',
    'N84 (ADR-088), N95 (ADR-097): each project piece stays selectable with its own controls; a grouped piece is reached by a second tap.',
    'connections between pieces, which the feature is about',
  ],
  'semantic-connectors': [
    'in-progress',
    'N65 (ADR-070): snapping uses connectors derived from piece boxes and walls.',
    'authored, typed connectors with frames and orientations on templates',
  ],
  'cad-cnc-export': [
    'in-progress',
    'N03, N02, F09: Fusion 360 script, SVG/PDF, CSV.',
    'DXF, STEP and CNC output',
  ],
  'direct-manipulation': [
    'in-progress',
    'N60, N64: drag and turn pieces on the plan; N91 (ADR-093): move and turn them in the 3D view.',
    'free rotation (turns are 90° steps, ADR-093)',
  ],
  'composition-layer': [
    'in-progress',
    'N04: projects of independent pieces above the item editor.',
    'composition metadata (connectors, compatibility tags, dependency rules)',
  ],
  'ensemble-model': [
    'in-progress',
    'N04, N53, N56: project with items, room and run parts; N95: saved groups; N94: template references with revisions.',
    'connections',
  ],
  'versioned-save': [
    'in-progress',
    'N48, F14: projects saved and reopened with every piece and position; N94: template revisions kept per piece.',
    'connections',
  ],
  'propagation-pipeline': [
    'in-progress',
    'N56, N66: after a change, checks rerun and run parts regenerate.',
    'connector frames and constraints (no connectors yet)',
  ],
  'deterministic-alternatives': [
    'in-progress',
    'N34 (ADR-045): suggested combinations kept only when buildModel() has no errors — per piece; N101, N102 (ADR-103, ADR-104): four suggested mixes for one wall run.',
    'alternative layouts of a whole project',
  ],
  'automated-fixes': [
    'in-progress',
    'N66 (ADR-071): a previewed repair is applied in one step.',
    'fixes chosen and applied from repair strategies stored with each rule',
  ],
  'assembly-graph': [
    'in-progress',
    'N19 (ADR-031): a piece placed on another follows it (a parent/child relation).',
    'connections between pieces beyond stacking, stored as a graph',
  ],
  'saved-design-codes': [
    'in-progress',
    'F14, N48: designs and projects saved and reopened on the device.',
    'a code to share or reopen a design elsewhere',
  ],
  'gen-sinks-handles': [
    'in-progress',
    'N06 handles per piece; N49 sink fixed front.',
    'sinks and handles generated for a run',
  ],
  'locks-overrides': [
    'in-progress',
    'N93 (ADR-095): Lock a piece; drags, turns, the gap tool and repairs leave it alone.',
    'locks on single named parameters (rotation only, a width only)',
  ],
  'no-silent-moves': [
    'in-progress',
    'N93 (ADR-095): a locked piece is never moved; the action is refused with a reason.',
    'stopping and explaining when a change cannot keep every hard rule, for unlocked pieces',
  ],
  'template-instancing': [
    'in-progress',
    'N94 (ADR-096), N105 (ADR-107): project pieces name their template and revision.',
    'store only the parameters that differ (pieces still hold a full copy, ADR-022)',
  ],
};

/**
 * Remaining features merged into another unbuilt feature with the same idea (user answer 2026-10-26: "Broad: same
 * common idea"). Non-destructive: the feature stays, hidden from lists, and is shown on its target; the user can undo
 * each merge. A target is never one the app has built (review 2026-10-26), so merges never hide work left to do.
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
  'transform-gizmos': ['direct-manipulation', 'Handles are one way of moving and rotating pieces.'],
  'live-manufacturer-data': [
    'multi-supplier-catalogue',
    'Live data is how a cross-manufacturer catalogue stays current.',
  ],
  labels: ['cad-cnc-export', 'Part labels are a manufacturing output.'],
  'manufacturing-adapter': ['cad-cnc-export', 'The layer that produces manufacturing output.'],
  'budget-style-filters': ['deterministic-alternatives', 'Filters on the generated alternatives.'],
  'layout-optimisation': ['deterministic-alternatives', 'Ranking generated alternatives.'],
  'ai-floorplan': ['ai-layout', 'AI layout on the room plan.'],
  'ai-explains': ['ai-layout', 'Part of the AI layout loop (propose, explain, validate).'],
  'inspiration-images': ['nl-generation', 'Another input to intent-driven generation.'],
  'yjs-crdt': ['collaboration', 'A technology for real-time collaboration.'],
};

/**
 * Features deleted from the research data because the app has built them (ADR-111, user 2026-10-27: "Re-validate,
 * remove implemented ones"; "Delete from the data"). One line each, never shown: the coverage audit still accounts
 * for the paper's rows they held. `[slug, name, evidence, findings]`.
 */
export const ENSEMBLE_REMOVED: [
  slug: string,
  name: string,
  evidence: string,
  findings: string[],
][] = [
  [
    'alignment-distribution',
    'Edge/face/centre alignment and equal distribution',
    'N97 (ADR-099)',
    ['rank-17', '036', '097', '107', '110'],
  ],
  [
    'approachable-complexity',
    'Hide technical complexity behind drag-and-drop and templates',
    'N22, N34, N38',
    ['047', '051', '038', '025'],
  ],
  [
    'auto-bom',
    'Automatic BOM / order list',
    'N59 (ADR-064)',
    ['rank-15', 'rec-15', 'mvp-15', '068', '077', 'phase-1'],
  ],
  [
    'auto-fill-span',
    'Auto-fill remaining span with modules + fillers',
    'merged into auto-fit-span, built',
    ['rank-27', '122'],
  ],
  [
    'auto-fit-span',
    'Auto-fit a run/span using valid discrete module widths',
    'N101, N102 (ADR-103, ADR-104)',
    ['rank-20', '084', '097', '110', '122', 'phase-2'],
  ],
  [
    'board-bom',
    'Detailed hardware and board-level BOM',
    'F09, F10, N69',
    ['123', 'phase-3', '052'],
  ],
  ['build-a-run', '"Build a run" workflow', 'merged into auto-fit-span, built', ['084', '155']],
  ['catalogue-categories', 'Catalogue categories incl. existing designs', 'N22', ['071']],
  [
    'catalogue-placement',
    'Catalogue placement of multiple instances',
    'N51, N04',
    ['mvp-2', '061', 'phase-1'],
  ],
  [
    'catalogue-validation',
    'Catalogue validation and QA tooling',
    'merged into inspectable-rules, built',
    ['137'],
  ],
  [
    'clearance-envelopes',
    'Operational clearance envelopes',
    'N52, N68',
    ['129', '093', '094', '097', '011', 'phase-2'],
  ],
  ['clearance-overlays', 'Clearance overlays with severity levels', 'N68 (ADR-073)', ['130']],
  [
    'collision-clearance',
    'Collision + operational-clearance detection',
    'N04, N52 (ADR-057), N68 (ADR-073)',
    ['rank-03', 'rec-03', '011', '012', '013', '029', '032', '064', 'phase-1', 'phase-2'],
  ],
  [
    'compatibility-engine',
    'Compatibility-rule engine preventing invalid connections',
    'N98 (ADR-100)',
    ['rank-02', 'rec-02', 'mvp-8', '011', '012', '029', '056', '058', '128', '106'],
  ],
  [
    'compatible-swap',
    'Smart replace/swap with compatible alternatives',
    'N96 (ADR-098)',
    ['rank-11', 'rec-11', '085', '134', '135', 'phase-2'],
  ],
  [
    'connector-compat-rules',
    'Connector compatibility rules',
    'merged into compatibility-engine, built',
    ['093'],
  ],
  [
    'controllable-automation',
    'Controllable automation (visible cause, escape hatch)',
    'N65, N66, N56',
    ['131', '132', '065', '108', '010'],
  ],
  [
    'countertops',
    'Automatically generated shared countertops/worktops',
    'N26, N70 (ADR-075)',
    ['rank-13', '080', '101', '116', '133'],
  ],
  [
    'cross-family',
    'Unified cross-family composition',
    'N48',
    ['017', '018', '019', '033', '063', '127', '173'],
  ],
  ['crown-moulding', 'Generated crown moulding', 'N70 (ADR-075)', ['014', '015', '050', '098']],
  ['custom-furniture', 'Create custom furniture', 'F01\u2013F13, N34', ['044', '046']],
  ['cut-list', 'Cut-list generation', 'F09', ['rank-31', '052', 'phase-3']],
  ['cycle-overlapping', 'Cycle through overlapping objects', 'N95 (ADR-097)', ['043', '010']],
  ['deduplication', 'Deduplication', 'F09, N69', ['phase-3']],
  [
    'dependency-regeneration',
    'Derived-component dependency regeneration',
    'N56 (ADR-061)',
    ['rank-23', '101', '109', '077', '015'],
  ],
  ['dimensioning', 'Dimensions and measurements', 'N48, N11', ['039', '061']],
  [
    'domain-graph',
    'Authoritative domain graph, render tree as projection',
    'ADR-004',
    ['103', '112', 'stack-06'],
  ],
  ['drag-drop-placement', 'Drag-and-drop placement', 'N92 (ADR-094)', ['061', '062', '042', '047']],
  [
    'duplicate-mirror-rotate',
    'Duplicate, mirror and predictable rotate operations',
    'N64 (ADR-069)',
    ['rank-19'],
  ],
  [
    'ensemble-workspace',
    'Catalogue-led ensemble workspace',
    'N51 (ADR-056), N22',
    ['071', '028', '062', '153'],
  ],
  ['env-chair', 'Envelope: chair/user clearance', 'N68 (ADR-073)', ['129']],
  ['env-door', 'Envelope: door swing', 'N52 (ADR-057)', ['129', '011', '081']],
  ['env-drawer', 'Envelope: drawer extension', 'N52 (ADR-057)', ['129', '011', '012', '136']],
  ['env-installation', 'Envelope: installation clearance', 'N68 (ADR-073)', ['129', '016']],
  ['env-service', 'Envelope: service/maintenance zone', 'N68 (ADR-073)', ['129', '093']],
  ['env-solid', 'Envelope: solid body', 'N04', ['129', '094']],
  [
    'explainable-warnings',
    'Explainable warnings with suggested repairs',
    'N66 (ADR-071)',
    ['rank-07', 'rec-07', '081', '082', 'phase-2'],
  ],
  ['exploded-view', 'Exploded assembly view', 'N12', ['rank-29', '124', 'phase-3']],
  [
    'fillers-plinths-panels',
    'Automatic fillers, plinths/toe-kicks, end panels and trim',
    'N26, N49 (ADR-054)',
    ['rank-14', '016', '064', '080', '133', 'phase-2'],
  ],
  ['finish-change', 'Change finishes and materials', 'N48, F16, N43', ['061', '044', '050', '034']],
  [
    'finish-scope',
    'Scope selector: This item / Connected run / Entire ensemble',
    'N50 (ADR-055)',
    ['079', 'rec-12'],
  ],
  ['floor-plan-2d', 'Construct the floor plan in 2D', 'N54 (ADR-059)', ['044', '032']],
  ['gen-end-panel', 'Generated end panels', 'N26, N49', ['rec-13', '098', '133']],
  ['gen-filler', 'Generated fillers', 'N26, N49 (ADR-054)', ['011', '016', '098', '133']],
  ['gen-plinth', 'Generated plinths / toe-kicks', 'N49 (ADR-054)', ['080', '015', '098']],
  ['gen-trim', 'Generated trims', 'N70 (ADR-075)', ['rank-14', '133']],
  ['generated-overrides', 'User overrides survive regeneration', 'N56 (ADR-061)', ['098', '101']],
  [
    'generated-part-mechanism',
    'Generic GeneratedPart mechanism',
    'N56 (ADR-061)',
    ['116', '098', '101'],
  ],
  [
    'guided-snapping',
    'Guided connection snapping with live preview and orientation',
    'N65 (ADR-070)',
    ['rank-01', '007', '008', '009', '010', '073', '075', '043', '063'],
  ],
  [
    'hardware-completeness',
    'Hardware/fastener completeness',
    'F10, N69 (ADR-074)',
    ['rank-25', '064', '133', '142', 'phase-3', '123'],
  ],
  [
    'in-context-editing',
    'Configure individual parametric items inside an ensemble',
    'N48, N86',
    ['rank-05', 'rec-05', 'mvp-11', '076', '039', '046'],
  ],
  [
    'inference-points',
    'Inference points (corners, centres, midpoints)',
    'merged into alignment-distribution, built',
    ['036'],
  ],
  ['inspectable-rules', 'Constraints as inspectable domain data', 'N98 (ADR-100)', ['136', '137']],
  [
    'interface-capabilities',
    'Interface capabilities instead of brand checks',
    'merged into compatibility-engine, built',
    ['139', '140'],
  ],
  ['keep-identity', 'Grouping keeps object identity (no flattening)', 'N48', ['069', 'mvp-10']],
  ['material-overrides', 'Per-instance material overrides', 'N50 (ADR-055)', ['095']],
  [
    'material-propagation',
    'Shared material/finish propagation',
    'N50 (ADR-055)',
    ['rank-12', 'rec-12', '079', '039', '134'],
  ],
  ['mobile-parity', 'Mobile and desktop feature parity', 'F18, N48', ['018', '032', '048']],
  ['model-import', 'Import 3D models and model libraries', 'N71 (ADR-076)', ['044', '049']],
  [
    'multi-select-groups',
    'Multi-select, groups and whole-ensemble transforms',
    'N95 (ADR-097)',
    ['rank-08', 'rec-08', 'mvp-10', '010', '043', '063', '069', '076', '100'],
  ],
  [
    'named-groups',
    'Named selection groups',
    'merged into multi-select-groups, built',
    ['099', '100'],
  ],
  ['order-completeness', 'Consumer order completeness', 'N59 (ADR-064)', ['123', '029', '133']],
  ['ortho-plan', '2D plan as orthographic view of the same model', 'N48, N11', ['stack-05', '120']],
  [
    'photoreal-rendering',
    'Photorealistic rendering and AI imagery',
    'N62, N63 (ADR-067/068)',
    ['008', '128', '003'],
  ],
  ['picking', 'Picking (raycasting / pointer events)', 'F12, N78', ['089', 'stack-02']],
  ['precision-tooltips', 'Precision feedback and tooltips', 'N60 (ADR-065)', ['043']],
  [
    'preserve-intent',
    'Preserve user intent through change',
    'merged into compatible-swap, built',
    ['134', '135'],
  ],
  ['production-drawings', 'Design-to-production drawing exports', 'N48, N02', ['046']],
  [
    'project-documentation',
    'Project documentation and item lists',
    'N48, N02, N04',
    ['053', '068'],
  ],
  ['repair-suggestions', 'Suggested repairs', 'N66 (ADR-071)', ['081', '136', 'rec-07', 'phase-2']],
  [
    'replace-workflow',
    'Replace workflow (browse only compatible alternatives)',
    'merged into compatible-swap, built',
    ['085', '155'],
  ],
  ['resize-generic', 'Resize generic objects', 'N86 (ADR-090)', ['044']],
  ['revalidation', 'Automatic revalidation after parameter changes', 'N04, N66', ['mvp-12', '077']],
  [
    'room-geometry',
    'Room/wall geometry, windows, doors and obstacles',
    'N53 (ADR-058)',
    ['rank-16', 'rec-14', '061', '044', '042', '102', '032'],
  ],
  ['room-obstacles', 'Obstacle zones', 'N53 (ADR-058)', ['rec-14', 'rank-16']],
  ['room-openings', 'Doors and windows', 'N53 (ADR-058)', ['rec-14', 'rank-16']],
  ['room-services', 'Pipes and outlets', 'N67 (ADR-072)', ['rec-14']],
  ['room-validation', 'Validity checked against the room', 'N53, N54', ['rec-14', '011']],
  ['room-walls', 'Walls and corners', 'N53, N54', ['rec-14', 'rank-16']],
  [
    'schema-migrations',
    'Versioned records with migrations',
    'ADR-011, ADR-012',
    ['stack-08', '099'],
  ],
  ['select-and-explain', 'Select and explain the problem', 'N66 (ADR-071)', ['081']],
  ['selection-box', 'Selection box', 'N95 (ADR-097)', ['043', '063']],
  ['sheet-optimisation', 'Sheet/material optimisation', 'N01', ['rank-32', '052', '123']],
  ['snap-candidate-ranking', 'Deterministic snap candidate ranking', 'N65 (ADR-070)', ['074']],
  [
    'snap-override',
    'Snap override (modifier key or toggle)',
    'N65 (ADR-070)',
    ['mvp-6', '009', '010', '043', '065', '075', '131'],
  ],
  [
    'snap-preview',
    'Snap preview before commit (ghost placement)',
    'N65 (ADR-070)',
    ['mvp-5', '073', '075', '132'],
  ],
  [
    'static-collision',
    'Static body collision detection (AABB/OBB)',
    'N04, N10',
    ['mvp-9', 'stack-04', 'phase-1'],
  ],
  ['structured-exports', 'BOM/CSV/JSON and CAD exports', 'N48, F09, N03', ['056']],
  [
    'support-diagnostics',
    'Support diagnostics from rules',
    'merged into inspectable-rules, built',
    ['137'],
  ],
  [
    'sync-2d-3d',
    'Synchronous 2D plan + 3D view',
    'N48, N11',
    ['rank-06', 'rec-06', '060', '061', '062', 'stack-01', '089', 'stack-05', '120', 'phase-1'],
  ],
  ['template-api', 'Template API exposing parameters and bounds', 'ADR-004', ['phase-1', '119']],
  ['why-wont-connect', '"Why won\'t this connect?" explanation', 'N65 (ADR-070)', ['073']],
];
