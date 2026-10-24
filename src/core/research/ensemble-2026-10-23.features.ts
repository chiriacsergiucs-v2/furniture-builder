/**
 * Features of the 2026-10-23 ensemble paper (ADR-043). Ratings of ranked features are read from the paper's own
 * table row (lines 75–113), word for word; every other rating is `not evaluated` because the paper gives none.
 * `origin: 'inferred'` marks an opportunity read from findings (listed in `inferredFrom`), never a research conclusion.
 * `appNotes` are observations about this repository (backlog / ADR ids), kept apart from the research.
 */
import text from '../../../docs/research/2026-10-23-furniture-ensemble-builder.md?raw';
import {
  ASSESSOR,
  ASSESSMENT_DATE,
  ENSEMBLE_APPRECIATION,
  ENSEMBLE_ASSESSMENTS,
  ENSEMBLE_PRIORITIES,
} from './ensemble-2026-10-23.assessment';
import type { Assessment, Contradiction, ResearchFeature } from './types';

export const NOT_EVALUATED = 'not evaluated';
export const UNKNOWN = 'unknown';

const LINES = text.split('\n');
const clean = (s: string) =>
  s
    .replace(/\*\*/g, '')
    .replace(/\s*\[\^ref-\d+\]/g, '')
    .trim();
/** Ratings of ranked feature `rank`, copied from its row in the paper. */
function ranked(rank: number) {
  const cells = LINES[74 + rank - 1].split('|').slice(1, -1).map(clean);
  if (Number(cells[0]) !== rank) throw new Error(`ranked row ${rank} not found`);
  const [, , demand, appreciation, adoption, complexity, impact, confidence, priority] = cells;
  return { rank, demand, appreciation, adoption, complexity, impact, confidence, priority };
}

type Draft = Partial<Omit<ResearchFeature, 'id'>> &
  Pick<ResearchFeature, 'name' | 'description' | 'category' | 'subcategory'>;
const n = (s: string) => `ens.n.${s}`;
const id = (s: string) => `ens.f.${s}`;
function assessmentOf(slug: string): Assessment | undefined {
  const r = ENSEMBLE_ASSESSMENTS[slug];
  if (!r) return undefined;
  const [
    relevance,
    demand,
    ux,
    adoption,
    differentiation,
    leverage,
    complexity,
    confidence,
    rationale,
    internal,
  ] = r;
  const [priority, priorityBasis] = ENSEMBLE_PRIORITIES[slug] ?? ['', ''];
  const [appreciation, appreciationBasis] = ENSEMBLE_APPRECIATION[slug] ?? ['', ''];
  return {
    scores: { relevance, demand, ux, adoption, differentiation, leverage },
    complexity: complexity as Assessment['complexity'],
    confidence: confidence as Assessment['confidence'],
    priority,
    priorityBasis,
    appreciation,
    appreciationBasis,
    rationale,
    by: ASSESSOR,
    date: ASSESSMENT_DATE,
    ...(internal ? { internal } : {}),
  };
}
function F(slug: string, d: Draft): ResearchFeature {
  const assessment = d.rank ? undefined : assessmentOf(slug);
  return {
    origin: 'explicit',
    userProblem: UNKNOWN,
    userBenefit: UNKNOWN,
    useCases: [],
    workflow: [],
    requirements: [],
    technical: [],
    competitors: [],
    demand: NOT_EVALUATED,
    appreciation: NOT_EVALUATED,
    adoption: NOT_EVALUATED,
    impact: NOT_EVALUATED,
    complexity: NOT_EVALUATED,
    confidence: NOT_EVALUATED,
    priority: NOT_EVALUATED,
    tags: [],
    ...d,
    id: id(slug),
    parent: d.parent ? id(d.parent) : undefined,
    dependencies: (d.dependencies ?? []).map(id),
    related: (d.related ?? []).map(id),
    findings: (d.findings ?? []).map(n),
    inferredFrom: d.inferredFrom?.map(n),
    ...(assessment ? { assessment } : {}),
  };
}
const P1 = 'Functional ensemble creation (phase 1)',
  P2 = 'Intelligent compatibility and automatic adjustments (phase 2)';
const P3 = 'Manufacturing and advanced configuration (phase 3)',
  P4 = 'Smart layout and AI assistance (phase 4)';

export const ENSEMBLE_FEATURES: ResearchFeature[] = [
  // ── Composition layer and ensemble model ──────────────────────────────────────────────────────────────────────
  F('composition-layer', {
    name: 'Composition layer above existing templates',
    category: 'architecture',
    subcategory: 'Ensemble runtime',
    description:
      'A composition layer and ensemble runtime added above the existing parametric furniture templates, instead of merging the item editor and the ensemble editor into one model. Each template stays an independently configurable object; composition metadata tells the ensemble editor how instances may interact.',
    userProblem:
      'Users want to combine furniture they already have without rebuilding the individual items.',
    userBenefit: 'Existing items keep working on their own while they take part in ensembles.',
    requirements: [
      'Existing templates remain independently configurable objects.',
      'Composition metadata (connectors, mating surfaces, clearance envelopes, compatibility tags, dependency rules) describes how instances interact.',
      'Do not merge the furniture editor and ensemble editor into one monolithic model.',
    ],
    technical: [
      "Roomle's independently parameterised components joined through docking are the closest documented analogue.",
      'First job: make combining existing products fast, predictable, reversible and valid; auto-fill, manufacturing and AI then extend the same model.',
    ],
    competitors: ['c.roomle'],
    findings: ['002', '006', '024', '088', '113', '152', '153', '154'],
    phase: P1,
    tags: ['core', 'architecture'],
    related: ['ensemble-model', 'template-instancing', 'semantic-connectors'],
  }),
  F('composition-metadata', {
    name: 'Composition metadata on templates',
    parent: 'composition-layer',
    category: 'catalogue',
    subcategory: 'Template metadata',
    description:
      'Optional metadata on each furniture template: connectors, tags, body bounds, operational clearances and generated-part roles, referencing the existing parametric item definition without rewriting it.',
    requirements: [
      'FurnitureTemplate: id, version, name, category, itemDefinitionId (existing item), geometryRef, parameterSchemaRef.',
      'Optional composition block: connectors, tags, bodyBounds, operationalClearances, generatedPartRoles.',
    ],
    technical: [
      'Template metadata authoring and QA across hundreds of products can add substantial effort (effort caveat).',
    ],
    findings: ['006', '094', '117'],
    phase: P1,
    tags: ['data-model'],
    related: ['semantic-connectors', 'connector-authoring'],
  }),
  F('template-instancing', {
    name: 'Existing-template instancing',
    parent: 'composition-layer',
    category: 'assembly',
    subcategory: 'Instances',
    description:
      'The ensemble editor creates FurnitureInstances that reference existing templates (id + version) and store only the parameters that differ from the template defaults. The template is never copied or destructively modified.',
    userBenefit:
      'No duplicated or re-implemented parametric logic; one template can be reused across many instances.',
    mvp: "The ensemble editor creates instances from current furniture templates without duplicating/reimplementing the template's internal parametric logic.",
    requirements: [
      'Instance holds templateId and templateVersion.',
      'Instance parameters hold only differences from template defaults.',
      'Optional materialOverrides and ensembleId.',
      'Dragging an item into the scene creates an instance; the template is not copied.',
    ],
    competitors: ['c.pcon'],
    findings: ['mvp-1', '072', '095', '053', '114', '120'],
    phase: P1,
    tags: ['MVP', 'data-model'],
    appNotes: [
      'This app: project items embed a copy of a design (ADR-022, ADR-028); see the research-vs-app conflict record.',
    ],
  }),
  F('reference-copies', {
    name: 'Reference copies updated across instances',
    parent: 'template-instancing',
    category: 'assembly',
    subcategory: 'Instances',
    description:
      'pCon reference copies let one product definition be reused and updated across multiple instances, instead of monolithic geometry.',
    competitors: ['c.pcon'],
    findings: ['053', '069'],
    tags: ['competitor-capability'],
  }),
  F('ensemble-model', {
    name: 'Ensemble document model',
    parent: 'composition-layer',
    category: 'architecture',
    subcategory: 'Data model',
    description:
      'An Ensemble record (id, schemaVersion, name, instance ids, connection ids, generated-part ids, named groups, created/updated metadata) inside a project hierarchy: room geometry, furniture instances, ensembles, generated parts and BOM/derived outputs.',
    requirements: [
      'Project → room/environmental geometry; furniture instances (template reference, parameter overrides, world transform); ensembles (membership, groups, connections, constraints); generated parts; BOM/derived outputs.',
      'Phase one starts by adding FurnitureInstance, Ensemble, connector metadata and transactional commands.',
    ],
    findings: ['099', '102', '120', 'phase-1'],
    phase: P1,
    tags: ['data-model', 'core'],
    related: ['assembly-graph', 'versioned-save'],
  }),
  F('domain-graph', {
    name: 'Authoritative domain graph, render tree as projection',
    parent: 'composition-layer',
    category: 'architecture',
    subcategory: 'State',
    description:
      'The domain graph is the authoritative relationship store; the Three.js scene hierarchy is a rendering projection. No authoritative application state lives inside Three.js objects; a central domain store sits apart from rendered objects.',
    userProblem:
      'An innocent reparenting operation can alter world transforms or corrupt product semantics when the scene tree is authoritative.',
    requirements: [
      'Do not encode the ensemble as a parent-child Three.js scene hierarchy.',
      'Central domain store separate from rendered Three objects.',
    ],
    technical: ['Makes save/load, testing, undo, constraints and server-side processing easier.'],
    findings: ['103', '112', 'stack-06'],
    tags: ['architecture'],
    appNotes: ['This app already treats every view as a projection of buildModel() (ADR-004).'],
  }),
  F('template-api', {
    name: 'Template API exposing parameters and bounds',
    parent: 'composition-layer',
    category: 'architecture',
    subcategory: 'Dependencies',
    description:
      'Phase one depends on the existing template API exposing parameters and geometry/bounds consistently, and on parameter changes being callable from outside the item editor.',
    userProblem:
      'The effort estimate can be badly wrong if geometry is not normalised, transforms are embedded in component code, or parameter changes cannot be invoked externally.',
    findings: ['phase-1', '119'],
    tags: ['prerequisite'],
  }),

  // ── Workspace and catalogue placement ─────────────────────────────────────────────────────────────────────────
  F('ensemble-workspace', {
    name: 'Catalogue-led ensemble workspace',
    category: 'assembly',
    subcategory: 'Workflow',
    description:
      'The first interaction stays catalogue-led rather than CAD-led: the user opens an ensemble workspace and chooses a category; the catalogue shows existing templates instead of asking the user to model geometry.',
    userBenefit:
      'Matches the consumer mental model (IKEA: choose modules and see the finished result).',
    workflow: [
      'Open an ensemble workspace.',
      'Choose a category (Base Cabinets, Wardrobes, Shelving, Desks, Existing Designs).',
      'Drag a template into the scene: an instance is created.',
    ],
    competitors: ['c.ikea-kitchen'],
    findings: ['071', '028', '062', '153'],
    phase: P1,
    tags: ['workflow', 'catalogue'],
    appNotes: [
      'This app has a Catalog page and "Start from" lists (backlog N22) and projects with several pieces (N04); an added piece is placed where the user taps the plan (ADR-056, N51).',
    ],
  }),
  F('catalogue-placement', {
    name: 'Catalogue placement of multiple instances',
    parent: 'ensemble-workspace',
    category: 'assembly',
    subcategory: 'Catalogue',
    description:
      'User can search/select an existing template and add multiple instances to a workspace.',
    mvp: 'User can search/select an existing template and add multiple instances to a workspace.',
    findings: ['mvp-2', '061', 'phase-1'],
    phase: P1,
    tags: ['MVP'],
  }),
  F('catalogue-categories', {
    name: 'Catalogue categories incl. existing designs',
    parent: 'ensemble-workspace',
    category: 'catalogue',
    subcategory: 'Catalogue',
    description:
      'The workspace catalogue offers categories such as Base Cabinets, Wardrobes, Shelving, Desks and Existing Designs.',
    findings: ['071'],
    tags: ['catalogue'],
  }),

  // ── Connectors and snapping ───────────────────────────────────────────────────────────────────────────────────
  F('semantic-connectors', {
    name: 'Semantic snap connectors',
    category: 'snapping',
    subcategory: 'Connectors',
    recommendationRank: 1,
    description:
      'Connectors that are more than geometric points: each carries a coordinate frame, an interface type, compatible types, allowable orientations and relevant dimensions, turning "move until it looks aligned" into "attach this cabinet side to that cabinet side".',
    userProblem: 'Aligning by eye is slow and error-prone.',
    userBenefit: 'One snap sets both position and orientation against a meaningful interface.',
    mvp: 'Templates can optionally define semantic connection points; old templates without connectors continue to work as freely placed items.',
    requirements: [
      'Connector carries coordinate frame, interface type, compatible types, allowable orientations, relevant dimensions.',
      'Templates can define connectors optionally.',
    ],
    technical: [
      'Roomle docking and SketchUp Snaps validate the interaction pattern.',
      'Phase two expands connectors from points into interfaces with rules and clearance envelopes.',
    ],
    competitors: ['c.roomle', 'c.sketchup'],
    findings: ['rec-01', 'mvp-4', '008', '104', '105', '121'],
    phase: P1,
    tags: ['core', 'MVP'],
    related: ['guided-snapping', 'compatibility-engine'],
  }),
  F('connector-frame', {
    name: 'Connector as a coordinate frame',
    parent: 'semantic-connectors',
    category: 'snapping',
    subcategory: 'Connectors',
    description:
      'A connector describes a frame — origin (where the interface is), normal (which way it faces), up (reference direction), kind (what interface it represents), rules (what may mate) and clearance (what empty space is required) — in template-local coordinates, so one snap computes translation and rotation.',
    requirements: [
      'ConnectorFrame: template-local position and a rotation defining mating orientation.',
      'Frame fields: origin, normal, up, kind, rules, clearance.',
    ],
    findings: ['092', '105'],
    tags: ['data-model'],
  }),
  F('connector-kinds', {
    name: 'Connector interface kinds',
    parent: 'semantic-connectors',
    category: 'snapping',
    subcategory: 'Connectors',
    description:
      'Semantic connector kinds: cabinet-side, cabinet-top, cabinet-bottom, wall-mount, shelf-support, desk-return, generic.',
    findings: ['093'],
    tags: ['data-model'],
  }),
  F('connector-snap-settings', {
    name: 'Per-connector snap settings',
    parent: 'semantic-connectors',
    category: 'snapping',
    subcategory: 'Connectors',
    description:
      'Each connector has a snap radius, optional allowed rotation axes and an optional orientation tolerance.',
    findings: ['093'],
    tags: ['data-model'],
  }),
  F('connector-optional', {
    name: 'Templates without connectors stay freely placeable',
    parent: 'semantic-connectors',
    category: 'snapping',
    subcategory: 'Connectors',
    description:
      'Connectors are optional; old templates without connectors continue to work as freely placed items.',
    findings: ['mvp-4'],
    tags: ['MVP', 'compatibility'],
  }),
  F('connector-authoring', {
    name: 'Gradual connector authoring for existing templates',
    parent: 'semantic-connectors',
    category: 'catalogue',
    subcategory: 'Content authoring',
    description:
      'Connector design is the key content-authoring problem: docking points carry semantic placement logic and need carefully defined pivots/component structure. Existing templates gain connectors gradually without rewriting their internal model.',
    technical: ['Roomle product content requires carefully defined pivots/component structure.'],
    competitors: ['c.roomle'],
    findings: ['104', '117'],
    tags: ['content'],
  }),
  F('guided-snapping', {
    name: 'Guided connection snapping with live preview and orientation',
    category: 'snapping',
    subcategory: 'Snapping',
    ...ranked(1),
    description:
      'While the user drags an item near another, the editor finds nearby compatible connectors, shows valid candidate connections with a preview of the resulting placement and orientation, and commits a connection on release. Snapping is understandable and can be bypassed.',
    userProblem:
      'Placement "until it looks aligned" is imprecise; uncontrollable snapping frustrates users (Planner 5D complaints).',
    userBenefit: 'Fast, correct attachment of modules with position and orientation in one move.',
    workflow: [
      'Drag a second item near a placed one.',
      'Editor queries nearby compatible connectors.',
      'Candidate connection shown as ghost/outline.',
      'Release to commit the connection; hold a modifier or use a toggle to place freely.',
    ],
    requirements: [
      'Snap previewed before commit.',
      'Releasing the pointer creates a connection.',
      'Snapping temporarily bypassable.',
    ],
    competitors: ['c.roomle', 'c.sketchup', 'c.planner5d'],
    findings: ['rank-01', '007', '008', '009', '010', '073', '075', '043', '063'],
    dependencies: ['semantic-connectors', 'compatibility-engine'],
    related: ['persistent-connections'],
    phase: P1,
    tags: ['core', 'MVP', 'P0'],
  }),
  F('snap-preview', {
    name: 'Snap preview before commit (ghost placement)',
    parent: 'guided-snapping',
    category: 'snapping',
    subcategory: 'Snapping',
    description:
      'Dragging near a valid connector visibly previews the proposed position/orientation — preferably a small ghost/outline — before anything is committed.',
    mvp: 'Dragging near a valid connector visibly previews the proposed position/orientation before commit.',
    findings: ['mvp-5', '073', '075', '132'],
    tags: ['MVP'],
  }),
  F('snap-override', {
    name: 'Snap override (modifier key or toggle)',
    parent: 'guided-snapping',
    category: 'snapping',
    subcategory: 'Snapping',
    description:
      'User can temporarily disable or ignore snapping with a modifier key or UI toggle.',
    userProblem:
      'Planner 5D users complained about snapping they could not disable; a recent request asks how to disable snapping on walls.',
    mvp: 'User can temporarily disable/ignore snapping.',
    competitors: ['c.planner5d'],
    findings: ['mvp-6', '009', '010', '043', '065', '075', '131'],
    tags: ['MVP', 'user-request'],
  }),
  F('snap-candidate-ranking', {
    name: 'Deterministic snap candidate ranking',
    parent: 'guided-snapping',
    category: 'snapping',
    subcategory: 'Snapping',
    description:
      'Candidates are ranked deterministically: connector compatibility → distance → orientation error → alignment preference → current editing axis → user locks.',
    findings: ['074'],
    tags: ['algorithm'],
  }),
  F('why-wont-connect', {
    name: '"Why won\'t this connect?" explanation',
    parent: 'guided-snapping',
    category: 'snapping',
    subcategory: 'Snapping',
    description:
      'Incompatible connectors stay hidden during dragging, or appear only when the user asks why an item will not connect.',
    findings: ['073'],
    related: ['explainable-warnings'],
    tags: ['explainability'],
  }),
  F('alignment-distribution', {
    name: 'Edge/face/centre alignment and equal distribution',
    category: 'snapping',
    subcategory: 'Alignment',
    ...ranked(17),
    description:
      'Align instances by edges, faces or centres and distribute them with equal spacing — a general CAD/planner pattern.',
    requirements: [
      'Align constraint: instances, axis x/y/z, mode min/centre/max.',
      'Equal spacing is a soft constraint.',
    ],
    technical: ['A linear solver can help with continuous quantities such as equal spacing.'],
    competitors: ['c.sketchup'],
    findings: ['rank-17', '036', '097', '107', '110'],
    tags: ['P0'],
  }),
  F('inference-points', {
    name: 'Inference points (corners, centres, midpoints)',
    parent: 'alignment-distribution',
    category: 'snapping',
    subcategory: 'Alignment',
    description: 'SketchUp inference points support snapping to corners, centres and midpoints.',
    competitors: ['c.sketchup'],
    findings: ['036'],
    tags: ['competitor-capability'],
  }),

  // ── Connections ───────────────────────────────────────────────────────────────────────────────────────────────
  F('persistent-connections', {
    name: 'Persistent semantic connections',
    category: 'assembly',
    subcategory: 'Connections',
    description:
      'Committing a snap creates a persistent Connection between two connectors, with constraints, a rules version and a status, independent of selection groups.',
    mvp: 'Committing a snap creates a persistent semantic connection independent of selection groups.',
    requirements: [
      'Connection: two connector refs, rulesVersion, constraints, status valid | warning | invalid.',
      'A group and a connection are different concepts.',
    ],
    findings: ['mvp-7', '096', '100', '075'],
    dependencies: ['semantic-connectors'],
    phase: P1,
    tags: ['MVP', 'data-model'],
  }),
  F('connection-constraints', {
    name: 'Connection constraint types',
    parent: 'persistent-connections',
    category: 'parametric',
    subcategory: 'Constraints',
    description:
      "Constraint kinds: dock (two connectors), align (axis + min/centre/max), gap (distance between two instances), parameter-match (same parameter across instances), clearance (an instance's clearance volume), span (instances filling a target length).",
    findings: ['097'],
    tags: ['data-model'],
  }),
  F('connection-status', {
    name: 'Connection status and rules version',
    parent: 'persistent-connections',
    category: 'validation',
    subcategory: 'Connections',
    description:
      'Each connection records the rules version it was validated with and a status: valid, warning or invalid.',
    findings: ['096'],
    tags: ['data-model'],
  }),
  F('unsnap', {
    name: 'Unsnap (disconnect) as an undoable operation',
    parent: 'persistent-connections',
    category: 'assembly',
    subcategory: 'Connections',
    description:
      'Connections can be removed (unsnapped); unsnap is one of the operations undo/redo must revert.',
    findings: ['mvp-13'],
    tags: ['MVP'],
  }),
  F('independent-selection', {
    name: 'Connected items stay independently selectable',
    parent: 'persistent-connections',
    category: 'positioning',
    subcategory: 'Selection',
    description:
      'After connection, either item can still be selected on its own and shows its existing parametric controls; selecting the ensemble/group exposes common operations.',
    findings: ['076'],
    tags: ['selection'],
  }),
  F('assembly-graph', {
    name: 'Connection hierarchy / assembly graph',
    category: 'architecture',
    subcategory: 'Data model',
    ...ranked(22),
    description:
      'An internal graph of instances and their connections (Roomle uses a docking tree with parent/child relations) that the editor, validation and BOM read from.',
    technical: [
      'Roomle docking creates explicit parent/child relations with compatible docking points, orientations and conditions.',
      'Keep this graph in the domain model, not in the scene hierarchy.',
    ],
    competitors: ['c.roomle'],
    findings: ['rank-22', '039', '102', '103'],
    related: ['domain-graph', 'persistent-connections'],
    tags: ['internal', 'P0'],
  }),

  // ── Validation ────────────────────────────────────────────────────────────────────────────────────────────────
  F('compatibility-engine', {
    name: 'Compatibility-rule engine preventing invalid connections',
    category: 'validation',
    subcategory: 'Rules',
    ...ranked(2),
    recommendationRank: 2,
    description:
      'A deterministic engine that stops invalid combinations before they become expensive downstream errors, considering product family, dimensions, connector types, structural rules and exclusions. Invalid connector pairs are rejected or clearly reported, never silently joined.',
    userProblem:
      'Planning tools let users build layouts that cannot be built (overlapping cabinets, drawers hitting doors).',
    userBenefit:
      '"Valid by construction": the ensemble stays structurally and operationally compatible.',
    mvp: 'Invalid connector pairs are rejected or clearly reported rather than silently joined.',
    requirements: [
      'Consider product family, dimensions, connector types, structural rules and exclusions.',
      'Hard violations prevent commit or require explicit resolution.',
    ],
    competitors: ['c.roomle', 'c.parametra', 'c.vividworks', 'c.salsita'],
    findings: ['rank-02', 'rec-02', 'mvp-8', '011', '012', '029', '056', '058', '128', '106'],
    dependencies: ['semantic-connectors'],
    phase: P2,
    tags: ['core', 'MVP', 'P0'],
  }),
  F('connector-compat-rules', {
    name: 'Connector compatibility rules',
    parent: 'compatibility-engine',
    category: 'validation',
    subcategory: 'Rules',
    description:
      'Per-connector compatibility: accepted kinds, required and forbidden tags, minimum and maximum width, parameter rules (for example: only permit same-depth modules).',
    findings: ['093'],
    tags: ['data-model'],
  }),
  F('hard-soft-constraints', {
    name: 'Hard and soft constraints',
    parent: 'compatibility-engine',
    category: 'parametric',
    subcategory: 'Constraint resolution',
    description:
      'Hard constraints (impossible dimensions, incompatible connector classes, mandatory structural dependencies, critical interference) prevent commit or require explicit resolution. Soft constraints (visual alignment, equal spacing, preferred orientation, style continuity) may be violated temporarily while dragging.',
    findings: ['106', '107'],
    tags: ['rules'],
  }),
  F('interface-capabilities', {
    name: 'Interface capabilities instead of brand checks',
    parent: 'compatibility-engine',
    category: 'catalogue',
    subcategory: 'Multi-supplier',
    description:
      'Compatibility checks interface capabilities (e.g. accepts ["cabinet-side-interface:v1"]) rather than hard-coded brand/family checks, so the engine stays reusable across ranges and suppliers; family-specific rules still exist.',
    competitors: ['c.pcon'],
    findings: ['139', '140'],
    tags: ['extensibility'],
    related: ['multi-supplier-catalogue'],
  }),
  F('inspectable-rules', {
    name: 'Constraints as inspectable domain data',
    parent: 'compatibility-engine',
    category: 'validation',
    subcategory: 'Rules',
    description:
      'Rules are data, not hidden code: name, what they apply to, what they require, severity and repair strategies. Example: drawer-door-clearance — applies to base-cabinet-with-drawer; drawer swept volume must not intersect neighbour solid/door volume; severity error; repairs: increase side gap, insert compatible filler, change neighbour, reverse door hinge where supported.',
    findings: ['136', '137'],
    related: ['explainable-warnings'],
    tags: ['rules', 'explainability'],
    appNotes: ['This app has a rules registry keyed by role/product (ADR-035, backlog N25).'],
  }),
  F('catalogue-validation', {
    name: 'Catalogue validation and QA tooling',
    parent: 'inspectable-rules',
    category: 'catalogue',
    subcategory: 'Quality',
    description: 'Inspectable rules enable QA tooling and catalogue validation.',
    findings: ['137'],
    tags: ['quality'],
  }),
  F('support-diagnostics', {
    name: 'Support diagnostics from rules',
    parent: 'inspectable-rules',
    category: 'ux',
    subcategory: 'Support',
    description: 'Inspectable rules enable much better support diagnostics.',
    findings: ['137'],
    tags: ['support'],
  }),
  F('collision-clearance', {
    name: 'Collision + operational-clearance detection',
    category: 'validation',
    subcategory: 'Collision and clearance',
    ...ranked(3),
    recommendationRank: 3,
    description:
      'Detect both static body intersections and conflicts of motion/maintenance clearances: a closed cabinet may not overlap anything while its door or drawer still hits another module.',
    userProblem:
      'PAX drawers conflicting with doors or hinges; a kitchen plan with physically overlapping cabinets; insufficient appliance/filler clearances.',
    userBenefit: 'Problems found while planning, not during installation.',
    requirements: [
      'Model static body bounds and motion/maintenance clearances.',
      'Recheck collisions/clearances after every parameter change.',
    ],
    competitors: ['c.ikea-pax', 'c.ikea-kitchen'],
    findings: ['rank-03', 'rec-03', '011', '012', '013', '029', '032', '064', 'phase-1', 'phase-2'],
    phase: 'Static collisions in phase 1; clearance volumes in phase 2',
    tags: ['core', 'P0'],
    related: ['compatibility-engine', 'explainable-warnings'],
  }),
  F('static-collision', {
    name: 'Static body collision detection (AABB/OBB)',
    parent: 'collision-clearance',
    category: 'validation',
    subcategory: 'Collision and clearance',
    description:
      'Static body intersections are detected and presented before finalisation; simple AABB/OBB checks first.',
    mvp: 'Static body intersections are detected and presented before finalisation.',
    findings: ['mvp-9', 'stack-04', 'phase-1'],
    tags: ['MVP'],
    appNotes: [
      'This app reports pieces that overlap in a project and pieces below the floor (`src/core/project.ts`, ADR-022) and overlapping panels in a piece (ADR-008).',
    ],
  }),
  F('rapier-queries', {
    name: 'Spatial query engine (Rapier) without physics',
    parent: 'collision-clearance',
    category: 'architecture',
    subcategory: 'Collision engine',
    description:
      'Evaluate Rapier for richer collision and clearance queries — broad and narrow phase, sensor colliders, scene queries — used only as a geometry/query engine: cabinets must not bounce, fall or be physically integrated.',
    findings: ['090', 'stack-04'],
    tags: ['technology'],
  }),
  F('clearance-envelopes', {
    name: 'Operational clearance envelopes',
    parent: 'collision-clearance',
    category: 'validation',
    subcategory: 'Collision and clearance',
    description:
      'Each template may carry several envelopes beyond its solid body — door swing, drawer extension, chair/user clearance, installation clearance, service/maintenance zone — as clearance volumes on connectors and templates. Proposed as a possible signature capability.',
    requirements: [
      'clearanceVolumes on connector definitions; operationalClearances on templates.',
      'Clearance constraint links an instance to one of its clearance volumes.',
    ],
    findings: ['129', '093', '094', '097', '011', 'phase-2'],
    phase: P2,
    tags: ['differentiator'],
  }),
  F('env-solid', {
    name: 'Envelope: solid body',
    parent: 'clearance-envelopes',
    category: 'validation',
    subcategory: 'Envelopes',
    description: 'The body volume of the item itself.',
    findings: ['129', '094'],
    tags: ['envelope'],
  }),
  F('env-door', {
    name: 'Envelope: door swing',
    parent: 'clearance-envelopes',
    category: 'validation',
    subcategory: 'Envelopes',
    description:
      "Volume swept by a door; example conflict: a tall cabinet's door sweep intersects a wall cabinet.",
    findings: ['129', '011', '081'],
    tags: ['envelope'],
  }),
  F('env-drawer', {
    name: 'Envelope: drawer extension',
    parent: 'clearance-envelopes',
    category: 'validation',
    subcategory: 'Envelopes',
    description:
      'Volume a drawer needs when pulled out (drawer travel); PAX drawer/door conflicts show the need.',
    findings: ['129', '011', '012', '136'],
    tags: ['envelope'],
  }),
  F('env-chair', {
    name: 'Envelope: chair/user clearance',
    parent: 'clearance-envelopes',
    category: 'validation',
    subcategory: 'Envelopes',
    description: 'Chair/user clearance envelope (named in the paper without further detail).',
    findings: ['129'],
    tags: ['envelope'],
  }),
  F('env-installation', {
    name: 'Envelope: installation clearance',
    parent: 'clearance-envelopes',
    category: 'validation',
    subcategory: 'Envelopes',
    description:
      'Space needed to install the item (fillers and clearances decide whether furniture can be installed and opened).',
    findings: ['129', '016'],
    tags: ['envelope'],
  }),
  F('env-service', {
    name: 'Envelope: service/maintenance zone',
    parent: 'clearance-envelopes',
    category: 'validation',
    subcategory: 'Envelopes',
    description: 'Access space for service and maintenance.',
    findings: ['129', '093'],
    tags: ['envelope'],
  }),
  F('clearance-overlays', {
    name: 'Clearance overlays with severity levels',
    parent: 'clearance-envelopes',
    category: 'visual',
    subcategory: 'Overlays',
    description:
      'Users switch the relevant clearance overlays on and off and get different severity levels: a drawer crossing another cabinet is a hard interference; a recommended walkway is merely advisory.',
    findings: ['130'],
    tags: ['visualisation'],
  }),
  F('explainable-warnings', {
    name: 'Explainable warnings with suggested repairs',
    category: 'validation',
    subcategory: 'Diagnostics',
    ...ranked(7),
    recommendationRank: 7,
    description:
      '"Invalid" is not enough: the application selects the problem, explains it in plain terms ("drawer clearance intersects left cabinet by 34 mm") and offers repairs such as changing hinge side, adding a spacer, narrowing the module or moving the neighbour.',
    userProblem: 'Red geometry alone does not tell the user what is wrong or how to fix it.',
    userBenefit: 'A major opportunity to outperform generic planners.',
    useCases: [
      "Door clearance conflict: tall cabinet A's door sweep intersects wall cabinet B — fixes: add 30 mm spacer · reverse hinge · move B · choose narrower cabinet.",
    ],
    findings: ['rank-07', 'rec-07', '081', '082', 'phase-2'],
    dependencies: ['collision-clearance'],
    phase: P2,
    tags: ['P1', 'differentiator'],
    appNotes: [
      'This app lists problems as diagnostics that block export (ADR-008); no repair actions.',
    ],
  }),
  F('select-and-explain', {
    name: 'Select and explain the problem',
    parent: 'explainable-warnings',
    category: 'ux',
    subcategory: 'Diagnostics',
    description:
      'When a problem occurs the application selects the items involved and states the conflict in words.',
    findings: ['081'],
    tags: ['explainability'],
  }),
  F('repair-suggestions', {
    name: 'Suggested repairs',
    parent: 'explainable-warnings',
    category: 'validation',
    subcategory: 'Diagnostics',
    description:
      'Each diagnostic lists possible fixes (add spacer, reverse hinge, move neighbour, choose narrower cabinet, increase side gap, insert compatible filler, change neighbour).',
    findings: ['081', '136', 'rec-07', 'phase-2'],
    tags: ['repair'],
  }),
  F('automated-fixes', {
    name: 'Automated fixes from rule repair strategies',
    parent: 'explainable-warnings',
    category: 'validation',
    subcategory: 'Diagnostics',
    description:
      'Repair strategies stored with inspectable rules open the door to automated fixes.',
    findings: ['137'],
    tags: ['repair', 'automation'],
  }),

  // ── Positioning and manipulation ──────────────────────────────────────────────────────────────────────────────
  F('direct-manipulation', {
    name: 'Direct manipulation in 2D/3D',
    category: 'positioning',
    subcategory: 'Transforms',
    description:
      'User can move and rotate instances in 2D and 3D by dragging, with picking and transform handles, and also enter exact numeric transforms.',
    mvp: 'User can move and rotate instances in 2D/3D and enter exact numeric transforms.',
    requirements: [
      'Move and rotate in both views.',
      'Exact numeric transforms (see Precise numeric manipulation).',
    ],
    technical: ['Transform = position, rotation (quaternion), optional scale.'],
    findings: ['mvp-3', '091', 'phase-1'],
    phase: P1,
    tags: ['MVP'],
    related: ['precise-numeric'],
    appNotes: [
      'This app places project pieces in whole mm with quarter turns about the vertical axis only (ADR-022).',
    ],
  }),
  F('drag-drop-placement', {
    name: 'Drag-and-drop placement',
    parent: 'direct-manipulation',
    category: 'positioning',
    subcategory: 'Placement',
    description:
      'Drag/drop placement from a catalogue — a category norm; rapid furniture placement is one of the most appreciated capabilities.',
    competitors: ['c.planner5d', 'c.homestyler'],
    findings: ['061', '062', '042', '047'],
    tags: ['category-norm'],
  }),
  F('picking', {
    name: 'Picking (raycasting / pointer events)',
    parent: 'direct-manipulation',
    category: 'architecture',
    subcategory: 'Interaction technology',
    description: 'Select objects in 3D with the Three.js Raycaster / R3F pointer events.',
    findings: ['089', 'stack-02'],
    tags: ['technology'],
  }),
  F('transform-gizmos', {
    name: 'Transform handles (TransformControls or custom gizmos)',
    parent: 'direct-manipulation',
    category: 'positioning',
    subcategory: 'Transforms',
    description:
      'Three.js TransformControls as a baseline; furniture-specific constrained gizmos will probably need custom UX.',
    findings: ['089', 'stack-03'],
    tags: ['technology'],
  }),
  F('precise-numeric', {
    name: 'Precise numeric position, dimensions and gaps',
    category: 'positioning',
    subcategory: 'Precision',
    ...ranked(4),
    recommendationRank: 4,
    description:
      'Dragging is fast; numbers make it trustworthy. Users type width, offset, gap, position and rotation while snapping keeps working.',
    userProblem:
      'Planner 5D feedback specifically criticises insufficient precision; dimension errors are among the biggest frustrations.',
    userBenefit: 'Trustworthy, buildable sizes.',
    requirements: [
      'Type width, offset, gap, position and rotation.',
      'Keep snapping while entering numbers.',
    ],
    competitors: ['c.planner5d', 'c.roomle', 'c.pcon'],
    findings: ['rank-04', 'rec-04', '010', '043', '063', '064', '053'],
    phase: P1,
    tags: ['core', 'P0'],
    appNotes: [
      'This app: whole-mm sizes everywhere (ADR-003); gap between two project pieces along the wall (backlog N13).',
    ],
  }),
  F('numeric-transform', {
    name: 'Numeric transform entry',
    parent: 'precise-numeric',
    category: 'positioning',
    subcategory: 'Precision',
    description: 'Exact numeric position, offset, gap and rotation for instances.',
    findings: ['mvp-3', 'rec-04', 'phase-1'],
    tags: ['MVP'],
  }),
  F('dimensioning', {
    name: 'Dimensions and measurements',
    parent: 'precise-numeric',
    category: 'visual',
    subcategory: 'Dimensioning',
    description:
      'Show dimensions and measurements (Roomle dimensioning; measurements are a category norm across planners).',
    competitors: ['c.roomle', 'c.planner5d'],
    findings: ['039', '061'],
    tags: ['category-norm'],
    appNotes: [
      'This app shows tape dimensions in the project plan and room front view (backlog N11).',
    ],
  }),
  F('precision-tooltips', {
    name: 'Precision feedback and tooltips',
    parent: 'precise-numeric',
    category: 'ux',
    subcategory: 'Feedback',
    description:
      'Better precision feedback and tooltips while manipulating objects (Planner 5D request).',
    competitors: ['c.planner5d'],
    findings: ['043'],
    tags: ['user-request'],
  }),
  F('multi-select-groups', {
    name: 'Multi-select, groups and whole-ensemble transforms',
    category: 'positioning',
    subcategory: 'Selection and groups',
    ...ranked(8),
    recommendationRank: 8,
    description:
      'Select one item, several items or a saved group and move a complete kitchen run, wardrobe bank or desk/storage combination without flattening the items or losing their individual configurability.',
    userProblem:
      'Planner 5D users complained about lack of grouping and difficulty selecting overlapping objects.',
    mvp: 'User can select one item, several items or a saved group and move them without flattening their independent configuration.',
    requirements: [
      'Groups are separate from connections.',
      'Group operations are undoable.',
      'Selecting a group exposes common operations.',
    ],
    competitors: ['c.planner5d', 'c.sketchup'],
    findings: ['rank-08', 'rec-08', 'mvp-10', '010', '043', '063', '069', '076', '100'],
    phase: P1,
    tags: ['core', 'MVP', 'P0'],
  }),
  F('selection-box', {
    name: 'Selection box',
    parent: 'multi-select-groups',
    category: 'positioning',
    subcategory: 'Selection and groups',
    description: 'Select several objects by dragging a box (Planner 5D request).',
    competitors: ['c.planner5d'],
    findings: ['043', '063'],
    tags: ['user-request'],
  }),
  F('cycle-overlapping', {
    name: 'Cycle through overlapping objects',
    parent: 'multi-select-groups',
    category: 'positioning',
    subcategory: 'Selection and groups',
    description:
      'Select among overlapping objects by cycling (Planner 5D request; difficulty selecting overlapping objects).',
    competitors: ['c.planner5d'],
    findings: ['043', '010'],
    tags: ['user-request'],
  }),
  F('named-groups', {
    name: 'Named selection groups',
    parent: 'multi-select-groups',
    category: 'assembly',
    subcategory: 'Selection and groups',
    description:
      'Ensembles hold named groups of instances that are selected and transformed together; a group says nothing about connection.',
    findings: ['099', '100'],
    tags: ['data-model'],
  }),
  F('keep-identity', {
    name: 'Grouping keeps object identity (no flattening)',
    parent: 'multi-select-groups',
    category: 'assembly',
    subcategory: 'Selection and groups',
    description:
      'Grouping must not flatten objects into one mesh; SketchUp components vs groups, Roomle docked components and pCon reference copies keep identity after composition.',
    competitors: ['c.sketchup', 'c.roomle', 'c.pcon'],
    findings: ['069', 'mvp-10'],
    tags: ['principle'],
  }),
  F('duplicate-mirror-rotate', {
    name: 'Duplicate, mirror and predictable rotate operations',
    category: 'positioning',
    subcategory: 'Transforms',
    ...ranked(19),
    description: 'Duplicate instances or groups, mirror them, and rotate them predictably.',
    findings: ['rank-19'],
    tags: ['P0'],
    appNotes: [
      'This app: duplicate a saved piece in the Library (F14); project item quantity; quarter turns (ADR-022). No mirror.',
    ],
  }),
  F('locks-overrides', {
    name: 'Lock/pin modules and preserve manual overrides',
    category: 'parametric',
    subcategory: 'Locks',
    ...ranked(18),
    description:
      'Lock an instance\'s position, rotation or named parameters; locks and manual overrides outrank soft rules so the application never keeps "correcting" intentional placement. Auto-fit respects locked modules; snap ranking considers user locks.',
    userProblem:
      'Smart behaviour becomes frustrating when it repeatedly overrides intentional placement.',
    requirements: [
      'locked.position, locked.rotation, locked.parameters on the instance.',
      'Locks outrank soft constraints.',
      'Auto-fit respects locked modules.',
    ],
    findings: ['rank-18', '095', '108', '074', '122', 'phase-2'],
    phase: P2,
    tags: ['P1', 'trust'],
  }),

  // ── Parametric editing in context ─────────────────────────────────────────────────────────────────────────────
  F('in-context-editing', {
    name: 'Configure individual parametric items inside an ensemble',
    category: 'parametric',
    subcategory: 'In-context editing',
    ...ranked(5),
    recommendationRank: 5,
    description:
      'Existing width/height/depth/material parameters stay editable while an item belongs to an ensemble. Changing a cabinet from 600 to 800 mm preserves valid connections where possible and regenerates dependent parts.',
    mvp: 'Existing width/height/depth/material parameters can still be edited while the item belongs to an ensemble.',
    useCases: ['Change a cabinet in a run from 600 to 800 mm wide.'],
    competitors: ['c.roomle', 'c.homestyler'],
    findings: ['rank-05', 'rec-05', 'mvp-11', '076', '039', '046'],
    phase: P1,
    tags: ['core', 'MVP', 'P0'],
    appNotes: [
      'This app: a project piece opens in the editor and changes stay in the project (backlog N04).',
    ],
  }),
  F('propagation-pipeline', {
    name: 'Local dependency update on parameter change',
    parent: 'in-context-editing',
    category: 'parametric',
    subcategory: 'Propagation',
    description:
      'parameter change → connector frames recalculated → connected constraints re-solved → collisions/clearances rechecked → derived countertop/fillers regenerated → BOM refreshed.',
    findings: ['077', 'rec-05', 'phase-2'],
    dependencies: ['dependency-regeneration'],
    tags: ['algorithm'],
  }),
  F('revalidation', {
    name: 'Automatic revalidation after parameter changes',
    parent: 'in-context-editing',
    category: 'validation',
    subcategory: 'Propagation',
    description:
      'Parameter changes automatically rerun connection and collision validation for affected objects.',
    mvp: 'Parameter changes automatically rerun connection and collision validation for affected objects.',
    findings: ['mvp-12', '077'],
    tags: ['MVP'],
  }),
  F('no-silent-moves', {
    name: 'Never silently move unrelated items',
    parent: 'in-context-editing',
    category: 'parametric',
    subcategory: 'Propagation',
    description:
      'A change never silently forces an unrelated distant item to move; when propagation cannot keep every hard constraint, it stops and presents the conflict.',
    findings: ['078'],
    tags: ['trust'],
  }),

  // ── Views ─────────────────────────────────────────────────────────────────────────────────────────────────────
  F('sync-2d-3d', {
    name: 'Synchronous 2D plan + 3D view',
    category: 'visual',
    subcategory: 'Views',
    ...ranked(6),
    recommendationRank: 6,
    description:
      'One ensemble model with two synchronous projections: 2D for exact planning, 3D for comprehension and visual confirmation. No separate "2D project" and "3D project" states.',
    userBenefit: 'See a design before buying/building it; plan precisely in 2D.',
    technical: [
      '2D plan: same scene/domain model with an orthographic camera and overlays.',
      'Phase one implements top/orthographic 2D and perspective 3D against the same model.',
    ],
    competitors: ['c.roomle', 'c.homebyme', 'c.planner5d', 'c.sweethome3d'],
    findings: [
      'rank-06',
      'rec-06',
      '060',
      '061',
      '062',
      'stack-01',
      '089',
      'stack-05',
      '120',
      'phase-1',
    ],
    phase: P1,
    tags: ['core', 'P0'],
    appNotes: [
      'This app: every view is a projection of buildModel() (ADR-004); front elevation + 3D (ADR-014); project plan and room front view (N11).',
    ],
  }),
  F('ortho-plan', {
    name: '2D plan as orthographic view of the same model',
    parent: 'sync-2d-3d',
    category: 'visual',
    subcategory: 'Views',
    description:
      'The 2D plan uses the same scene/domain model with an orthographic camera and overlays, avoiding divergent 2D and 3D states.',
    findings: ['stack-05', '120'],
    tags: ['technology'],
  }),
  F('section-cutaway', {
    name: 'Section/cutaway and visibility isolation',
    category: 'visual',
    subcategory: 'Inspection views',
    ...ranked(28),
    description: 'Cut through the ensemble or isolate parts of it to see inside.',
    findings: ['rank-28'],
    tags: ['P2'],
  }),
  F('photoreal-rendering', {
    name: 'Photorealistic rendering and AI imagery',
    category: 'visual',
    subcategory: 'Rendering',
    description:
      'High-quality renders and AI imagery. The paper rates the six core capabilities above photorealistic rendering and notes many consumer planners compete aggressively on renders and AI imagery; it does not rank this feature.',
    findings: ['008', '128', '003'],
    tags: ['deprioritised-by-research'],
  }),
  F('ar-placement', {
    name: 'AR placement',
    category: 'visual',
    subcategory: 'AR',
    ...ranked(39),
    description:
      'Place furniture in the real room through augmented reality. One IKEA user explicitly found it low-value.',
    competitors: ['c.ikea-planners'],
    findings: ['rank-39'],
    tags: ['P3'],
  }),
  F('on-demand-rendering', {
    name: 'On-demand rendering',
    category: 'architecture',
    subcategory: 'Performance',
    description:
      'Render only when something changes (R3F on-demand rendering): most editor scenes are static much of the time, so this reduces continuous rendering on laptops and tablets.',
    findings: ['111'],
    tags: ['performance'],
  }),

  // ── Undo and persistence ──────────────────────────────────────────────────────────────────────────────────────
  F('transactional-undo', {
    name: 'Transactional undo/redo',
    category: 'persistence',
    subcategory: 'Undo',
    ...ranked(9),
    recommendationRank: 9,
    description:
      'Add, delete, move, rotate, snap, unsnap, parameter change and group operations can be reverted; a compound operation (a snap that moves an item, connects it and regenerates a countertop) undoes as one user action.',
    mvp: 'Add, delete, move, rotate, snap, unsnap, parameter change and group operations can be reverted. Compound operations undo atomically.',
    technical: [
      'Command/transaction log: one semantic operation touching instances, connections, generated parts and BOM stays one undo step.',
      'Complex configurators continue to spend engineering effort on correct undo grouping (the cited source is the Roomle changelog, ref-54).',
    ],
    competitors: ['c.roomle'],
    findings: ['rank-09', 'rec-09', 'mvp-13', 'stack-07'],
    phase: P1,
    tags: ['core', 'MVP', 'P0'],
    appNotes: [
      'This app: undo/redo in the piece editor (F15) and for every project change, one action = one step (ADR-051, N46).',
    ],
  }),
  F('command-log', {
    name: 'Command/transaction log',
    parent: 'transactional-undo',
    category: 'architecture',
    subcategory: 'Undo',
    description: 'Undo/redo implemented as a command/transaction log.',
    findings: ['stack-07', '120'],
    tags: ['technology'],
  }),
  F('versioned-save', {
    name: 'Versioned save/reload of entire ensembles',
    category: 'persistence',
    subcategory: 'Saving',
    ...ranked(10),
    recommendationRank: 10,
    description:
      'Saving and reopening restores template versions, parameter overrides, transformations, groups and connections — not merely a flattened mesh. Save reliability is a product feature, not plumbing.',
    userProblem: 'Version-loss complaints in planning software (Planner 5D).',
    mvp: 'Saving and reopening restores template versions, parameter overrides, transformations, groups and connections.',
    technical: [
      'Versioned JSON/domain records plus separate asset references allow migrations and keep template identity.',
    ],
    competitors: ['c.planner5d'],
    findings: ['rank-10', 'rec-10', 'mvp-14', 'stack-08', '043', '063', '061'],
    phase: P1,
    tags: ['core', 'MVP', 'P0'],
    appNotes: ['This app: autosaved local library and projects in IndexedDB (F14, ADR-012).'],
  }),
  F('version-recovery', {
    name: 'Version history and recovery',
    parent: 'versioned-save',
    category: 'persistence',
    subcategory: 'History',
    description:
      'Stronger recovery and version history (Planner 5D request; better version recovery is among the most wanted needs).',
    competitors: ['c.planner5d'],
    findings: ['043', '063'],
    tags: ['user-request'],
  }),
  F('schema-migrations', {
    name: 'Versioned records with migrations',
    parent: 'versioned-save',
    category: 'architecture',
    subcategory: 'Persistence',
    description:
      'Persist versioned JSON/domain records with separate asset references so data can be migrated and template identity preserved.',
    findings: ['stack-08', '099'],
    tags: ['technology'],
  }),
  F('saved-design-codes', {
    name: 'Saved designs and personal codes',
    parent: 'versioned-save',
    category: 'persistence',
    subcategory: 'Sharing',
    description:
      'IKEA planners keep saved designs; the IKEA Netherlands page describes saved/personal codes for designs.',
    competitors: ['c.ikea-pax', 'c.ikea-planners'],
    findings: ['030', '172'],
    tags: ['competitor-capability'],
  }),

  // ── Replace, materials, generated parts ───────────────────────────────────────────────────────────────────────
  F('compatible-swap', {
    name: 'Smart replace/swap with compatible alternatives',
    category: 'assembly',
    subcategory: 'Replace',
    ...ranked(11),
    recommendationRank: 11,
    description:
      'Replacing a 600 mm drawer cabinet with another compatible 600 mm cabinet preserves placement, material context, group membership, neighbouring connections and the generated top where possible.',
    userProblem:
      'Configurators are good at creating from scratch, less elegant at late structural changes.',
    findings: ['rank-11', 'rec-11', '085', '134', '135', 'phase-2'],
    dependencies: ['compatibility-engine'],
    phase: P2,
    tags: ['P1'],
  }),
  F('replace-workflow', {
    name: 'Replace workflow (browse only compatible alternatives)',
    parent: 'compatible-swap',
    category: 'assembly',
    subcategory: 'Replace',
    description:
      'Select a module and browse only compatible alternatives (an alternative workflow beside drag-and-drop).',
    findings: ['085', '155'],
    tags: ['workflow'],
  }),
  F('preserve-intent', {
    name: 'Preserve user intent through change',
    parent: 'compatible-swap',
    category: 'assembly',
    subcategory: 'Replace',
    description:
      'After a replace or resize: same logical position, same group, same neighbouring connections where valid, same ensemble finish, derived countertop regenerated, BOM updated, violations explicitly reported. Needs more engineering than delete/add, but targets how people iterate designs.',
    findings: ['134', '135'],
    tags: ['differentiator'],
  }),
  F('material-propagation', {
    name: 'Shared material/finish propagation',
    category: 'shared',
    subcategory: 'Materials',
    ...ranked(12),
    recommendationRank: 12,
    description:
      "Ensemble-level materials: apply a finish to this module, this connected run or the whole ensemble. Conceptually Roomle's global parameters.",
    competitors: ['c.roomle'],
    findings: ['rank-12', 'rec-12', '079', '039', '134'],
    phase: P2,
    tags: ['P1'],
    appNotes: [
      'This app: materials are edited per piece (F16); project → Finish applies a board to this piece, this run or the whole project (ADR-055, N50).',
    ],
  }),
  F('finish-scope', {
    name: 'Scope selector: This item / Connected run / Entire ensemble',
    parent: 'material-propagation',
    category: 'shared',
    subcategory: 'Materials',
    description:
      'For common parameters such as finish, a scope selector — easier to understand than an abstract "global parameter".',
    findings: ['079', 'rec-12'],
    tags: ['ux'],
  }),
  F('global-parameters', {
    name: 'Global parameters propagating common choices',
    parent: 'material-propagation',
    category: 'parametric',
    subcategory: 'Global parameters',
    description:
      'Roomle global parameters propagate common choices across components; the scope selector can be implemented the same way.',
    competitors: ['c.roomle'],
    findings: ['039', '079'],
    tags: ['competitor-capability'],
  }),
  F('material-overrides', {
    name: 'Per-instance material overrides',
    parent: 'material-propagation',
    category: 'shared',
    subcategory: 'Materials',
    description:
      'FurnitureInstance.materialOverrides keeps material choices that differ from the template.',
    findings: ['095'],
    tags: ['data-model'],
  }),
  F('generated-parts', {
    name: 'Generated shared components (ensemble-derived parts)',
    category: 'shared',
    subcategory: 'Generated parts',
    recommendationRank: 13,
    description:
      'Countertops, worktops, plinths/toe-kicks, fillers, end panels, crown moulding and shared structural elements derive from the modules they span instead of behaving like manually placed products. They remember their source instances and generator version and regenerate on change, keeping permitted user overrides.',
    userProblem:
      'Inexperienced users forget the "boring" parts; fillers and clearances decide whether furniture can be installed and opened.',
    userBenefit: 'Complete, consistent ensembles without manual fitting parts.',
    requirements: [
      'GeneratedPart: type, generatedFrom instance ids, generatorVersion, parameters, overrides.',
      'Generated parts are not ordinary furniture instances.',
    ],
    competitors: ['c.coohom', 'c.roomle'],
    findings: ['rec-13', '014', '015', '016', '050', '174', '098', '101', '121', '133'],
    phase: P2,
    tags: ['differentiator'],
    appNotes: [
      'This app suggests run parts — worktop, run plinth, fillers, cover panels — for a project run (`planRuns`, backlog N26, N49) and keeps them up to date when pieces change (ADR-061, N56).',
    ],
  }),
  F('generated-part-mechanism', {
    name: 'Generic GeneratedPart mechanism',
    parent: 'generated-parts',
    category: 'architecture',
    subcategory: 'Generated parts',
    description:
      'Implement the generic GeneratedPart mechanism early, even if countertops are postponed, so the architecture never assumes every scene object is placed by hand.',
    findings: ['116', '098', '101'],
    tags: ['architecture'],
  }),
  F('generated-overrides', {
    name: 'User overrides survive regeneration',
    parent: 'generated-parts',
    category: 'shared',
    subcategory: 'Generated parts',
    description:
      'User changes to a generated part are stored as overrides and survive regeneration.',
    findings: ['098', '101'],
    tags: ['trust'],
  }),
  F('countertops', {
    name: 'Automatically generated shared countertops/worktops',
    parent: 'generated-parts',
    category: 'shared',
    subcategory: 'Generated parts',
    ...ranked(13),
    description:
      'When cabinets form a continuous run, "Add countertop" creates one dependent countertop spanning the run (not unrelated tops); it regenerates when the cabinets move or resize. Proposed as the optional proving ground of a kitchen MVP.',
    workflow: [
      'Select cabinets forming a run.',
      'Add countertop.',
      'One countertop spans the run and follows its changes.',
    ],
    competitors: ['c.coohom'],
    findings: ['rank-13', '080', '101', '116', '133'],
    phase: P2,
    tags: ['P1', 'kitchen'],
  }),
  F('fillers-plinths-panels', {
    name: 'Automatic fillers, plinths/toe-kicks, end panels and trim',
    parent: 'generated-parts',
    category: 'shared',
    subcategory: 'Generated parts',
    ...ranked(14),
    description:
      'Derived fillers, plinths/toe-kicks, end panels and trims for cabinetry runs; "Add plinth" works like "Add countertop".',
    userProblem:
      'Installation discussions show fillers, end boards and spacers decide whether the furniture can be installed and opened.',
    competitors: ['c.coohom', 'c.ikea-kitchen'],
    findings: ['rank-14', '016', '064', '080', '133', 'phase-2'],
    phase: P2,
    tags: ['P1', 'kitchen'],
  }),
  F('gen-filler', {
    name: 'Generated fillers',
    parent: 'fillers-plinths-panels',
    category: 'shared',
    subcategory: 'Generated parts',
    description:
      'Generated fillers; the paper counts required filler dimensions as part of active validity.',
    findings: ['011', '016', '098', '133'],
    tags: ['generated-part'],
  }),
  F('gen-plinth', {
    name: 'Generated plinths / toe-kicks',
    parent: 'fillers-plinths-panels',
    category: 'shared',
    subcategory: 'Generated parts',
    description: 'One plinth/toe-kick spanning a run (Coohom generates toe-kick moulding).',
    competitors: ['c.coohom'],
    findings: ['080', '015', '098'],
    tags: ['generated-part'],
  }),
  F('gen-end-panel', {
    name: 'Generated end panels',
    parent: 'fillers-plinths-panels',
    category: 'shared',
    subcategory: 'Generated parts',
    description: 'Side finishing / end panels depending on the cabinets they cover.',
    findings: ['rec-13', '098', '133'],
    tags: ['generated-part'],
  }),
  F('gen-trim', {
    name: 'Generated trims',
    parent: 'fillers-plinths-panels',
    category: 'shared',
    subcategory: 'Generated parts',
    description: 'Trim pieces derived from the run.',
    findings: ['rank-14', '133'],
    tags: ['generated-part'],
  }),
  F('crown-moulding', {
    name: 'Generated crown moulding',
    parent: 'generated-parts',
    category: 'shared',
    subcategory: 'Generated parts',
    description: 'Crown moulding generated from selected cabinetry (Coohom).',
    competitors: ['c.coohom'],
    findings: ['014', '015', '050', '098'],
    tags: ['generated-part'],
  }),
  F('shared-support', {
    name: 'Shared structural elements',
    parent: 'generated-parts',
    category: 'shared',
    subcategory: 'Generated parts',
    description:
      'Shared supports/structural elements across modules (GeneratedPart type "shared-support"; Roomle shelving shows shared logic across components).',
    competitors: ['c.roomle', 'c.parametra'],
    findings: ['014', '015', '098', '056'],
    tags: ['generated-part'],
  }),
  F('gen-sinks-handles', {
    name: 'Generated sinks, handles and other derived components',
    parent: 'generated-parts',
    category: 'shared',
    subcategory: 'Generated parts',
    description: 'Coohom also generates sinks, handles and other derived components.',
    competitors: ['c.coohom'],
    findings: ['050'],
    tags: ['competitor-capability'],
  }),
  F('dependency-regeneration', {
    name: 'Derived-component dependency regeneration',
    category: 'architecture',
    subcategory: 'Dependencies',
    ...ranked(23),
    description:
      'A dependency graph regenerates derived components (tops, fillers, BOM nodes) when their source instances change, and invalidates only what is affected.',
    findings: ['rank-23', '101', '109', '077', '015'],
    competitors: ['c.roomle', 'c.coohom'],
    tags: ['internal', 'P1'],
  }),
  F('local-propagation', {
    name: 'Local propagation with targeted invalidation',
    parent: 'dependency-regeneration',
    category: 'architecture',
    subcategory: 'Performance',
    description:
      'Propagation stays local to the connected component; a cabinet width change never recomputes an unrelated bedroom ensemble elsewhere in the project. Invalidate only affected connections, generated parts, BOM nodes and clearance checks.',
    findings: ['109'],
    tags: ['performance'],
  }),

  // ── BOM, costing, commerce ────────────────────────────────────────────────────────────────────────────────────
  F('auto-bom', {
    name: 'Automatic BOM / order list',
    category: 'bom',
    subcategory: 'Order list',
    ...ranked(15),
    recommendationRank: 15,
    description:
      'Every change updates product quantities and derived pieces. At MVP level: "these are the furniture instances, options, generated fillers/tops and quantities required by this ensemble" — not manufacturing-grade cut optimisation.',
    userBenefit: 'Immediate practical value even before manufacturing exports exist.',
    mvp: 'Application outputs one entry per required product/configuration with quantities.',
    competitors: ['c.roomle', 'c.pcon', 'c.cabinet-vision'],
    findings: ['rank-15', 'rec-15', 'mvp-15', '068', '077', 'phase-1'],
    phase: P1,
    tags: ['MVP'],
    appNotes: [
      'This app: parts list (cut list) and hardware schedule per piece and per project (F09, F10, N04) — a board-level list, not a product order list.',
    ],
  }),
  F('order-completeness', {
    name: 'Consumer order completeness',
    parent: 'auto-bom',
    category: 'bom',
    subcategory: 'Order list',
    description:
      'Separate consumer-facing order completeness (every product, accessory and derived part needed) from production data; missing-item problems escape IKEA planning.',
    competitors: ['c.ikea-kitchen'],
    findings: ['123', '029', '133'],
    tags: ['completeness'],
  }),
  F('live-price', {
    name: 'Live price/cost estimate',
    category: 'commerce',
    subcategory: 'Pricing',
    ...ranked(24),
    description:
      'A running price or cost estimate for the ensemble (Roomle pricing, Cyncly live pricing data, VividWorks pricing); costing is part of phase three.',
    competitors: ['c.roomle', 'c.cyncly', 'c.vividworks'],
    findings: [
      'rank-24',
      '039',
      '054',
      '057',
      'phase-3',
      '041',
      '055',
      '156',
      '157',
      '158',
      '159',
      '160',
      '161',
      '162',
      '163',
      '164',
      '165',
      '166',
      '167',
      '168',
      '168b',
    ],
    phase: P3,
    tags: ['P1/P2'],
  }),
  F('quotation', {
    name: 'Quotations / quoting',
    category: 'commerce',
    subcategory: 'Quotation',
    description:
      'Turn a configuration into a quotation (Homestyler quotations, Cyncly quoting); the same configuration can feed pricing, quotations, BOMs and manufacturing.',
    competitors: ['c.homestyler', 'c.cyncly'],
    findings: ['046', '054', '138', '005'],
    tags: ['competitor-capability'],
  }),
  F('inventory-alternatives', {
    name: 'Inventory/availability-aware alternatives',
    category: 'commerce',
    subcategory: 'Availability',
    ...ranked(34),
    description: 'Suggest alternatives based on stock or availability.',
    findings: ['rank-34'],
    tags: ['P2'],
  }),
  F('consumer-pro-bridge', {
    name: 'Gradual bridge from consumer planning to professional output',
    category: 'integration',
    subcategory: 'Design-to-production',
    description:
      'Preserve the path from configuration to pricing, quotations, BOMs and manufacturing (Roomle, pCon, Cyncly, Cabinet Vision) without exposing professional complexity in the everyday editor.',
    competitors: ['c.roomle', 'c.pcon', 'c.cyncly', 'c.cabinet-vision', 'c.salsita'],
    findings: ['138', '059', '153', '058', '052', '162', '169', '170b'],
    tags: ['strategy'],
  }),
  F('hardware-completeness', {
    name: 'Hardware/fastener completeness',
    category: 'manufacturing',
    subcategory: 'Hardware',
    ...ranked(25),
    description:
      'The ensemble lists all required hardware and fasteners; missing hardware is one of the "looks right but cannot be built" frustrations (a missing-hinge example illustrates the need). The paper keeps generated hardware deterministic.',
    findings: ['rank-25', '064', '133', '142', 'phase-3', '123'],
    phase: P3,
    tags: ['P2'],
    appNotes: ['This app lists hardware as a labelled schedule and never invents specs (ADR-010).'],
  }),
  F('board-bom', {
    name: 'Detailed hardware and board-level BOM',
    parent: 'hardware-completeness',
    category: 'manufacturing',
    subcategory: 'Production data',
    description:
      'Detailed hardware BOM and board-level BOMs for production, separate from the consumer order list.',
    competitors: ['c.cabinet-vision'],
    findings: ['123', 'phase-3', '052'],
    phase: P3,
    tags: ['professional'],
  }),
  F('deduplication', {
    name: 'Deduplication',
    parent: 'board-bom',
    category: 'manufacturing',
    subcategory: 'Production data',
    description: 'Listed as phase-three work without further detail in the paper.',
    findings: ['phase-3'],
    phase: P3,
    tags: ['detail-unknown'],
  }),
  F('cut-list', {
    name: 'Cut-list generation',
    category: 'bom',
    subcategory: 'Cut list',
    ...ranked(31),
    description:
      'Cut lists for the ensemble (Hexagon/Cabinet Vision generate optimised cut lists).',
    competitors: ['c.cabinet-vision'],
    findings: ['rank-31', '052', 'phase-3'],
    phase: P3,
    tags: ['P2'],
    appNotes: ['This app has a cut list per piece and per project (F09, N04).'],
  }),
  F('sheet-optimisation', {
    name: 'Sheet/material optimisation',
    category: 'manufacturing',
    subcategory: 'Optimisation',
    ...ranked(32),
    description: 'Optimise sheet/material usage (cut optimisation).',
    competitors: ['c.cabinet-vision'],
    findings: ['rank-32', '052', '123'],
    phase: P3,
    tags: ['P2/P3'],
    appNotes: ['This app has sheet nesting (N01).'],
  }),
  F('cad-cnc-export', {
    name: 'Manufacturing/CAD/CNC export',
    category: 'integration',
    subcategory: 'Manufacturing output',
    ...ranked(33),
    description:
      'Exports for manufacturing: DXF/STEP/CNC adapters as required, CAD formats, production drawings, labels.',
    competitors: ['c.cabinet-vision', 'c.parametra', 'c.homestyler'],
    findings: ['rank-33', 'phase-3', '056', '171', '046', '123', '052'],
    phase: P3,
    tags: ['P2/P3'],
    appNotes: [
      'This app exports a Fusion 360 script (N03, not yet run in Fusion), SVG/PDF sheets (N02) and CSV (F09).',
    ],
  }),
  F('manufacturing-adapter', {
    name: 'Manufacturing adapter layer',
    parent: 'cad-cnc-export',
    category: 'architecture',
    subcategory: 'Manufacturing output',
    description:
      'An adapter layer from domain/BOM to cut list/CAD/CNC keeps production requirements out of the core interaction model.',
    findings: ['stack-10'],
    tags: ['architecture'],
  }),
  F('structured-exports', {
    name: 'BOM/CSV/JSON and CAD exports',
    parent: 'cad-cnc-export',
    category: 'integration',
    subcategory: 'Exports',
    description: 'PARAMETRA exports include BOM/CSV/JSON and CAD formats.',
    competitors: ['c.parametra'],
    findings: ['056'],
    tags: ['competitor-capability'],
  }),
  F('production-drawings', {
    name: 'Design-to-production drawing exports',
    parent: 'cad-cnc-export',
    category: 'integration',
    subcategory: 'Exports',
    description: 'Homestyler offers design-to-production drawing exports.',
    competitors: ['c.homestyler'],
    findings: ['046'],
    tags: ['competitor-capability'],
  }),
  F('labels', {
    name: 'Part labels',
    parent: 'cad-cnc-export',
    category: 'manufacturing',
    subcategory: 'Production data',
    description: 'Labels for production parts (Hexagon suite; listed in phase three).',
    competitors: ['c.cabinet-vision'],
    findings: ['123'],
    phase: P3,
    tags: ['professional'],
  }),
  F('project-documentation', {
    name: 'Project documentation and item lists',
    category: 'integration',
    subcategory: 'Documentation',
    description: 'pCon builds precise item lists and project documentation.',
    competitors: ['c.pcon'],
    findings: ['053', '068'],
    tags: ['competitor-capability'],
    appNotes: ['This app prints Romanian A4 cutting sheets (N02).'],
  }),

  // ── Assembly instructions ─────────────────────────────────────────────────────────────────────────────────────
  F('exploded-view', {
    name: 'Exploded assembly view',
    category: 'instructions',
    subcategory: 'Exploded view',
    ...ranked(29),
    description:
      'An exploded view of the ensemble. A visual explosion generated from geometry alone is straightforward; it must not imply manufacturability.',
    findings: ['rank-29', '124', 'phase-3'],
    phase: P3,
    tags: ['P2'],
    appNotes: ['This app has a geometric exploded 3D view of a piece and a project (N12).'],
  }),
  F('assembly-sequence', {
    name: 'Step-by-step assembly sequence',
    category: 'instructions',
    subcategory: 'Assembly steps',
    ...ranked(30),
    description:
      'A correct step-by-step assembly sequence needs explicit knowledge of assembly relationships — joints, hardware and ordering — that geometry alone does not give. VividWorks provides assembly information.',
    competitors: ['c.vividworks'],
    findings: ['rank-30', '124', 'phase-3', '057'],
    phase: P3,
    tags: ['P2'],
  }),

  // ── Room and cross-family ─────────────────────────────────────────────────────────────────────────────────────
  F('room-geometry', {
    name: 'Room/wall geometry, windows, doors and obstacles',
    category: 'room',
    subcategory: 'Room geometry',
    ...ranked(16),
    recommendationRank: 14,
    description:
      'Walls, corners, doors, windows, pipes/outlets and obstacle zones let furniture validity be checked against the actual environment, not only against other furniture.',
    competitors: ['c.planner5d', 'c.roomle', 'c.homebyme', 'c.ikea-kitchen'],
    findings: ['rank-16', 'rec-14', '061', '044', '042', '102', '032'],
    tags: ['P0'],
    appNotes: [
      'This app places pieces with wall-hung and on-piece placement (N19) in an optional room with walls, doors, windows and obstacles, checked against the pieces (ADR-058/0056, N53, N54).',
    ],
  }),
  F('room-walls', {
    name: 'Walls and corners',
    parent: 'room-geometry',
    category: 'room',
    subcategory: 'Room geometry',
    description: 'Room walls and corners as context geometry.',
    findings: ['rec-14', 'rank-16'],
    tags: ['room'],
  }),
  F('room-openings', {
    name: 'Doors and windows',
    parent: 'room-geometry',
    category: 'room',
    subcategory: 'Room geometry',
    description: 'Room doors and windows as context geometry.',
    findings: ['rec-14', 'rank-16'],
    tags: ['room'],
  }),
  F('room-services', {
    name: 'Pipes and outlets',
    parent: 'room-geometry',
    category: 'room',
    subcategory: 'Room geometry',
    description: 'Pipes and outlets in the room.',
    findings: ['rec-14'],
    tags: ['room'],
  }),
  F('room-obstacles', {
    name: 'Obstacle zones',
    parent: 'room-geometry',
    category: 'room',
    subcategory: 'Room geometry',
    description: 'Obstacle zones as context geometry.',
    findings: ['rec-14', 'rank-16'],
    tags: ['room'],
  }),
  F('room-validation', {
    name: 'Validity checked against the room',
    parent: 'room-geometry',
    category: 'validation',
    subcategory: 'Room geometry',
    description:
      'Furniture validity checked against the actual environment, not only other furniture; wall clearance is part of active validity.',
    findings: ['rec-14', '011'],
    tags: ['validation'],
  }),
  F('floor-plan-2d', {
    name: 'Construct the floor plan in 2D',
    parent: 'room-geometry',
    category: 'room',
    subcategory: 'Floor plan',
    description:
      'HomeByMe: construct the floor plan in 2D and furnish/visualise it in 3D; room-modelling limitations are reported for PAX.',
    competitors: ['c.homebyme', 'c.ikea-pax'],
    findings: ['044', '032'],
    tags: ['competitor-capability'],
  }),
  F('cross-family', {
    name: 'Unified cross-family composition',
    category: 'room',
    subcategory: 'Cross-family',
    description:
      'One workspace where wardrobes, cabinets, shelving, desks, beds and other compatible products participate in the same assembly model, instead of product-family planner silos. Described as probably the most obvious opportunity.',
    userProblem:
      'A user asked for one IKEA environment combining PAX, MALM, ALEX, a desk and a bed; planner silos block it.',
    useCases: ['A room that mixes PAX, MALM, ALEX, desks and beds.'],
    competitors: ['c.ikea-planners', 'c.ikea-pax'],
    findings: ['017', '018', '019', '033', '063', '127', '173'],
    tags: ['differentiator', 'user-request'],
  }),
  F('family-presets', {
    name: 'Kitchen/wardrobe/desk as presets over one engine',
    parent: 'cross-family',
    category: 'room',
    subcategory: 'Cross-family',
    description:
      'Do not encode "Kitchen Mode", "Wardrobe Mode" and "Desk Mode" as separate applications; make them presets or specialised workflows over one composition engine.',
    findings: ['127'],
    tags: ['architecture'],
  }),
  F('multi-supplier-catalogue', {
    name: 'Cross-manufacturer catalogue',
    parent: 'cross-family',
    category: 'catalogue',
    subcategory: 'Multi-supplier',
    description:
      'Current manufacturer data and configurable articles from several ranges or suppliers in one planning environment (pCon); catalogue accuracy matters (Cyncly). Possibly strategically stronger than a single-brand planner.',
    competitors: ['c.pcon', 'c.cyncly'],
    findings: ['139', '053', '054', '170', '170b'],
    tags: ['strategy'],
  }),
  F('live-manufacturer-data', {
    name: 'Live manufacturer product data',
    parent: 'multi-supplier-catalogue',
    category: 'catalogue',
    subcategory: 'Product data',
    description:
      'Planning on live manufacturer data and configurable manufacturer catalogues with live product/pricing data.',
    competitors: ['c.pcon', 'c.cyncly'],
    findings: ['053', '054'],
    tags: ['competitor-capability'],
  }),

  // ── Automation and AI ─────────────────────────────────────────────────────────────────────────────────────────
  F('auto-fit-span', {
    name: 'Auto-fit a run/span using valid discrete module widths',
    category: 'ai',
    subcategory: 'Deterministic layout',
    ...ranked(20),
    description:
      'Given a wall run (e.g. 3,150 mm), search valid combinations of real catalogue module widths, reserve minimum clearances/fillers, respect locked modules and rank solutions by objective rules. Arrives only after rules are trustworthy; safer than a generative model inventing widths.',
    useCases: ['Fill a 3,150 mm wall run with valid cabinets plus fillers.'],
    technical: [
      "Deterministic search/constraint layer under the app's control; continuous solvers are insufficient for discrete widths (400, 600, 800 mm) and categorical rules.",
      'span constraint: instances and a target length.',
    ],
    findings: ['rank-20', '084', '097', '110', '122', 'phase-2'],
    dependencies: ['compatibility-engine', 'locks-overrides'],
    phase: P2,
    tags: ['P1'],
  }),
  F('build-a-run', {
    name: '"Build a run" workflow',
    parent: 'auto-fit-span',
    category: 'ai',
    subcategory: 'Deterministic layout',
    description:
      'Select a wall or draw a span, choose families, and the deterministic solver proposes combinations of valid module widths plus fillers. One of the alternative workflows that coexist with drag-and-drop.',
    findings: ['084', '155'],
    tags: ['workflow'],
  }),
  F('auto-fill-span', {
    name: 'Auto-fill remaining span with modules + fillers',
    category: 'ai',
    subcategory: 'Deterministic layout',
    ...ranked(27),
    description: 'Fill what is left of a span with modules and fillers.',
    findings: ['rank-27', '122'],
    dependencies: ['auto-fit-span'],
    tags: ['P2'],
  }),
  F('deterministic-alternatives', {
    name: 'Deterministic generation of alternative valid layouts',
    category: 'ai',
    subcategory: 'Deterministic layout',
    ...ranked(26),
    description:
      'Generate alternative valid layouts deterministically; phase four begins here before AI.',
    findings: ['rank-26', '125', 'phase-4', '141'],
    phase: P4,
    tags: ['P2'],
  }),
  F('budget-style-filters', {
    name: 'Budget and style filters',
    parent: 'deterministic-alternatives',
    category: 'ai',
    subcategory: 'Deterministic layout',
    description:
      'Filter generated layouts by budget and style (phase four), e.g. "keep it under €2,500".',
    findings: ['phase-4', '125', '126'],
    phase: P4,
    tags: ['phase-4'],
  }),
  F('layout-optimisation', {
    name: 'Layout optimisation',
    parent: 'deterministic-alternatives',
    category: 'ai',
    subcategory: 'Deterministic layout',
    description: 'Optimisation of layouts, listed in phase four without further detail.',
    findings: ['phase-4'],
    phase: P4,
    tags: ['detail-unknown'],
  }),
  F('ai-layout', {
    name: 'AI layout generation',
    category: 'ai',
    subcategory: 'AI',
    ...ranked(37),
    description:
      'AI proposes candidate arrangements; the deterministic engine validates; the user accepts or edits. AI never overrides a hard compatibility rule. Coohom (AI kitchen auto-layout) and Planner 5D (AI-assisted placement) implement versions of it.',
    requirements: [
      'AI proposes → deterministic engine validates → user accepts/edits.',
      'AI may never override a hard compatibility rule.',
    ],
    competitors: ['c.coohom', 'c.planner5d'],
    findings: ['rank-37', '020', '021', '022', '126', '142', '143', '042'],
    dependencies: ['compatibility-engine'],
    phase: P4,
    tags: ['P3'],
    appNotes: ['ADR-002: no remote AI in this app; see the research-vs-app conflict record.'],
  }),
  F('ai-floorplan', {
    name: 'AI-assisted floor-plan/layout',
    parent: 'ai-layout',
    category: 'ai',
    subcategory: 'AI',
    description:
      'Planner 5D offers AI-assisted floor-plan/layout features; its guidance stresses checking real dimensions and clearances.',
    competitors: ['c.planner5d'],
    findings: ['042', '021'],
    tags: ['competitor-capability'],
  }),
  F('ai-explains', {
    name: 'AI explains alternatives',
    parent: 'ai-layout',
    category: 'ai',
    subcategory: 'AI',
    description:
      'AI understands intent, chooses candidate styles/categories, proposes arrangements and explains alternatives; the engine keeps products, geometry, checks, generated parts and BOM.',
    findings: ['142', '141'],
    tags: ['division-of-labour'],
  }),
  F('nl-generation', {
    name: 'Natural-language ensemble generation',
    category: 'ai',
    subcategory: 'AI',
    ...ranked(38),
    description:
      'Turn requests such as "make a 3.2 m media wall with drawers below and tall storage at each side" or "a 2.8-metre office wall with two desks… under €2,500" into candidate ensembles: the language model identifies intent, categories, style and budget; the solver chooses concrete furniture and validates.',
    useCases: [
      '"Make a 3.2 m media wall with drawers below and tall storage at each side."',
      '"Create a 2.8-metre office wall with two desks, drawers at each side and overhead storage; keep it under €2,500."',
    ],
    findings: ['rank-38', '087', '125', '126', '141'],
    dependencies: ['ai-layout', 'compatibility-engine'],
    phase: P4,
    tags: ['P3'],
  }),
  F('inspiration-images', {
    name: 'Inspiration images as AI input',
    parent: 'nl-generation',
    category: 'ai',
    subcategory: 'AI',
    description: 'Inspiration images are named as an excellent AI surface.',
    findings: ['141'],
    tags: ['ai-surface'],
  }),
  F('style-recommendations', {
    name: 'Style/material recommendations',
    category: 'ai',
    subcategory: 'Recommendations',
    ...ranked(36),
    description:
      'Recommend styles and materials; style matching is one of the AI uses the paper accepts.',
    findings: ['rank-36', '020', '142'],
    phase: P4,
    tags: ['P3'],
  }),

  // ── UX and collaboration ──────────────────────────────────────────────────────────────────────────────────────
  F('controllable-automation', {
    name: 'Controllable automation (visible cause, escape hatch)',
    category: 'ux',
    subcategory: 'Automation',
    description:
      'Every automated behaviour has a visible cause and an escape hatch: "Automatic when obvious; preview when consequential; ask when ambiguous." Avoid both CAD-like manual effort and aggressive automation the user cannot override.',
    userProblem: 'Strong frustration when automation (snapping, selection) cannot be overridden.',
    findings: ['131', '132', '065', '108', '010'],
    competitors: ['c.planner5d'],
    tags: ['principle', 'trust'],
  }),
  F('mobile-parity', {
    name: 'Mobile and desktop feature parity',
    category: 'ux',
    subcategory: 'Platforms',
    description:
      'Users complain that mobile planners expose fewer capabilities than desktop (IKEA) and that mobile and desktop workflows are inconsistent (Homestyler); one request asks for richer mobile planning.',
    competitors: ['c.ikea-pax', 'c.homestyler'],
    findings: ['018', '032', '048'],
    tags: ['user-request'],
    appNotes: ['This app is one responsive PWA for phone and desktop (F18).'],
  }),
  F('approachable-complexity', {
    name: 'Hide technical complexity behind drag-and-drop and templates',
    origin: 'inferred',
    inferredFrom: ['047', '051', '038', '025'],
    category: 'ux',
    subcategory: 'Learnability',
    description:
      "Opportunity read from competitor signals: Homestyler hides technical complexity behind drag/drop and templates; Coohom's interface and documentation were criticised despite good output; SketchUp newcomers report a learning curve. The paper names consumer-level simplicity as the target.",
    competitors: ['c.homestyler', 'c.coohom', 'c.sketchup'],
    findings: ['047', '051', '038', '025'],
    tags: ['inferred'],
  }),
  F('professional-review', {
    name: 'Hand a plan to a professional for review',
    origin: 'inferred',
    inferredFrom: ['027', '062'],
    category: 'integration',
    subcategory: 'Review',
    description:
      'Opportunity read from competitor signals: IKEA offers specialist review of kitchen plans, and IKEA users start in the planner even when a professional later checks the result.',
    competitors: ['c.ikea-kitchen'],
    findings: ['027', '062'],
    tags: ['inferred'],
  }),
  F('collaboration', {
    name: 'Real-time collaboration/comments',
    category: 'ux',
    subcategory: 'Collaboration',
    ...ranked(35),
    description:
      'Several people edit or comment on one ensemble; listed in phase four "if justified". Yjs is a credible option.',
    findings: ['rank-35', 'stack-09', 'phase-4'],
    phase: P4,
    tags: ['P2'],
    appNotes: ['ADR-002: no backend or accounts in this app.'],
  }),
  F('yjs-crdt', {
    name: 'CRDT shared state (Yjs)',
    parent: 'collaboration',
    category: 'architecture',
    subcategory: 'Collaboration',
    description:
      'Yjs shared types merge concurrent changes automatically; relevant only if collaborative editing becomes a requirement.',
    findings: ['stack-09'],
    tags: ['technology'],
  }),
  F('ensemble-templates', {
    name: 'Reusable ensemble templates',
    category: 'assembly',
    subcategory: 'Templates',
    ...ranked(21),
    description:
      "Save the selected ensemble as a reusable template storing item references, parameter defaults, relative transformations, connections, generated-component recipes and optional room-independent constraints — not a permanent copy of every item's geometry.",
    competitors: ['c.pcon', 'c.ikea-planners'],
    findings: ['rank-21', '083', '086'],
    tags: ['P1'],
  }),
  F('paste-ensemble', {
    name: '"Paste ensemble" workflow',
    parent: 'ensemble-templates',
    category: 'assembly',
    subcategory: 'Templates',
    description:
      'Instantiate a previously saved assembly (an alternative workflow beside drag-and-drop).',
    findings: ['086', '155'],
    tags: ['workflow'],
  }),

  // ── Item-level (competitor capabilities) ──────────────────────────────────────────────────────────────────────
  F('custom-furniture', {
    name: 'Create custom furniture',
    category: 'item',
    subcategory: 'Custom items',
    description:
      'HomeByMe lets users create custom furniture (MakeByMe); Homestyler offers parametric kitchen/bath custom furniture with cabinet/wardrobe parameters.',
    competitors: ['c.homebyme', 'c.homestyler'],
    findings: ['044', '046'],
    tags: ['competitor-capability'],
    appNotes: ['This app is itself a parametric item editor (F01–F13).'],
  }),
  F('resize-generic', {
    name: 'Resize generic objects',
    category: 'item',
    subcategory: 'Editing',
    description: 'HomeByMe lets users resize generic objects.',
    competitors: ['c.homebyme'],
    findings: ['044'],
    tags: ['competitor-capability'],
  }),
  F('finish-change', {
    name: 'Change finishes and materials',
    category: 'item',
    subcategory: 'Materials',
    description:
      'Material changes are a category norm; HomeByMe changes finishes; Coohom adjusts size/material/style; BESTÅ is configured by size, style and colour.',
    competitors: ['c.homebyme', 'c.coohom', 'c.ikea-besta'],
    findings: ['061', '044', '050', '034'],
    tags: ['category-norm'],
  }),
  F('model-import', {
    name: 'Import 3D models and model libraries',
    category: 'integration',
    subcategory: 'Import',
    description:
      'HomeByMe imports models on applicable plans; Sweet Home 3D has importable model libraries.',
    competitors: ['c.homebyme', 'c.sweethome3d'],
    findings: ['044', '049'],
    tags: ['competitor-capability'],
  }),
];

/** Contradictions, mixed evidence and conflicting estimates, kept side by side. */
export const ENSEMBLE_CONTRADICTIONS: Contradiction[] = [
  {
    id: 'ens.x.01',
    basis: 'paper',
    title: 'BOM priority: P0/P1',
    description:
      'The ranked table gives "Automatic BOM / order list" the dual priority P0/P1, while the MVP table includes a BOM row. Both are kept; neither is chosen.',
    findings: ['ens.n.rank-15', 'ens.n.mvp-15', 'ens.n.rec-15'],
    features: ['ens.f.auto-bom'],
  },
  {
    id: 'ens.x.02',
    basis: 'paper',
    title: 'Countertops: MVP proving ground or postponed',
    description:
      'Countertops are ranked P1, may be the optional proving ground of a kitchen MVP, and should be postponed if not strategically important to the first segment — while the GeneratedPart mechanism should come early in any case.',
    findings: ['ens.n.rank-13', 'ens.n.116', 'ens.n.080'],
    features: ['ens.f.countertops', 'ens.f.generated-part-mechanism'],
  },
  {
    id: 'ens.x.03',
    basis: 'paper',
    title: 'Dual priorities: price P1/P2, sheet optimisation and CAD/CNC export P2/P3',
    description:
      'The paper keeps two priority bands for these rows; live price complexity is "Medium if data exists".',
    findings: ['ens.n.rank-24', 'ens.n.rank-32', 'ens.n.rank-33'],
    features: ['ens.f.live-price', 'ens.f.sheet-optimisation', 'ens.f.cad-cnc-export'],
  },
  {
    id: 'ens.x.04',
    basis: 'paper',
    title: 'AI layout: rising adoption, mixed appreciation',
    description:
      'Demand and competitor adoption are "Medium and rising" but appreciation is "Mixed"; Planner 5D offers AI-assisted placement while its own guidance stresses checking real dimensions and clearances.',
    findings: ['ens.n.rank-37', 'ens.n.021'],
    features: ['ens.f.ai-layout'],
  },
  {
    id: 'ens.x.05',
    basis: 'paper',
    title: 'AR placement: mixed appreciation',
    description: 'Appreciation "Mixed"; one IKEA user explicitly found it low-value.',
    findings: ['ens.n.rank-39'],
    features: ['ens.f.ar-placement'],
  },
  {
    id: 'ens.x.06',
    basis: 'paper',
    title: 'Coohom: good output, criticised interface',
    description:
      "One independent user liked Coohom's output quality but criticised its interface and documentation — power versus complexity remains a risk.",
    findings: ['ens.n.051', 'ens.n.050'],
    features: ['ens.f.generated-parts', 'ens.f.approachable-complexity'],
  },
  {
    id: 'ens.x.07',
    basis: 'paper',
    title: 'Approachable planners, weak semantics',
    description:
      'HomeByMe is praised for approachable visualisation yet less specialised in module-to-module compatibility; Sweet Home 3D is strong as a general floorplanner but much weaker as a modular configurator.',
    findings: ['ens.n.045', 'ens.n.049'],
    features: ['ens.f.sync-2d-3d', 'ens.f.compatibility-engine'],
  },
  {
    id: 'ens.x.08',
    basis: 'paper',
    title: 'Snapping wanted and resented',
    description:
      'Guided snapping ranks first, yet users complain about snapping they cannot disable; the paper resolves it with preview and override.',
    findings: ['ens.n.rank-01', 'ens.n.010', 'ens.n.075'],
    features: ['ens.f.guided-snapping', 'ens.f.snap-override'],
  },
  {
    id: 'ens.x.09',
    basis: 'paper',
    title: 'Effort: 2–3 months vs "can be badly wrong"',
    description:
      'The first usable phase is sized at about two to three months for three engineers (XL overall), with the explicit warning that the estimate can be badly wrong and is not a commitment.',
    findings: ['ens.n.119', 'ens.n.phase-1', 'ens.n.117'],
    features: ['ens.f.composition-layer'],
  },
  {
    id: 'ens.x.10',
    basis: 'inferred',
    title: 'Value score vs priority label',
    description:
      'Read across the table (not stated by the paper): "Explainable warnings" scores 4.8 but is P1 while lower-scored rows 16, 17 and 19 are P0; "Lock/pin" is P1 although the architecture section calls locks outranking soft rules "essential for user trust". Value and priority are separate columns in the paper.',
    findings: ['ens.n.rank-07', 'ens.n.rank-16', 'ens.n.rank-18', 'ens.n.108'],
    features: ['ens.f.explainable-warnings', 'ens.f.locks-overrides'],
  },
  {
    id: 'ens.x.15',
    basis: 'inferred',
    title: 'P0 features missing from the MVP table and phase plan',
    description:
      'Read across the paper (not stated by it): room geometry (rank 16, P0, recommendation #14), edge/face/centre alignment (rank 17, P0), duplicate/mirror/rotate (rank 19, P0) and the assembly graph (rank 22, "P0 internal") are not in the MVP capability table, and none of them is named in the four phases. No phase is assigned to them here.',
    findings: [
      'ens.n.rank-16',
      'ens.n.rank-17',
      'ens.n.rank-19',
      'ens.n.rank-22',
      'ens.n.rec-14',
      'ens.n.114',
      'ens.n.phase-1',
    ],
    features: [
      'ens.f.room-geometry',
      'ens.f.alignment-distribution',
      'ens.f.duplicate-mirror-rotate',
      'ens.f.assembly-graph',
    ],
  },
  {
    id: 'ens.x.16',
    basis: 'inferred',
    title: '"High" evidence confidence resting on anecdotes',
    description:
      'Read across the paper (not stated by it): several rows rate evidence "High" from community posts — rank 3 "real interference reports", rank 8 "explicit request also found", rank 10 "version-loss frustration documented" (its only citation, ref-55, is the r/planner5d forum) — while the paper calls these sources anecdotes, not statistically representative, and "low for prevalence".',
    findings: [
      'ens.n.rank-03',
      'ens.n.rank-08',
      'ens.n.rank-10',
      'ens.n.013',
      'ens.n.019',
      'ens.n.144',
      'ens.n.151',
    ],
    features: ['ens.f.collision-clearance', 'ens.f.multi-select-groups', 'ens.f.versioned-save'],
  },
  {
    id: 'ens.x.11',
    basis: 'app',
    title: 'Research vs ADR-002: AI, collaboration, live data',
    description:
      'AI layout, natural-language generation, real-time collaboration (Yjs), live pricing/inventory data and server-side processing need network services; ADR-002 keeps this app a static offline PWA with no backend, accounts, cloud or remote AI.',
    findings: [
      'ens.n.rank-37',
      'ens.n.rank-38',
      'ens.n.rank-35',
      'ens.n.rank-24',
      'ens.n.rank-34',
      'ens.n.stack-09',
      'ens.n.112',
    ],
    features: [
      'ens.f.ai-layout',
      'ens.f.nl-generation',
      'ens.f.collaboration',
      'ens.f.live-price',
      'ens.f.inventory-alternatives',
    ],
  },
  {
    id: 'ens.x.12',
    basis: 'app',
    title: 'Research vs ADR-022/028: references vs embedded copies',
    description:
      "The paper's FurnitureInstance references a template and never copies it (pCon reference copies update across instances); this app's projects embed a copy of each design so library edits never flow in by themselves.",
    findings: ['ens.n.072', 'ens.n.095', 'ens.n.053'],
    features: ['ens.f.template-instancing', 'ens.f.reference-copies'],
  },
  {
    id: 'ens.x.13',
    basis: 'app',
    title: 'Research vs ADR-022: free rotation vs quarter turns',
    description:
      "The paper's Transform uses a quaternion rotation; this app keeps every panel an axis-aligned box and rotates project pieces in quarter turns about the vertical axis only.",
    findings: ['ens.n.091', 'ens.n.mvp-3'],
    features: ['ens.f.direct-manipulation', 'ens.f.numeric-transform'],
  },
  {
    id: 'ens.x.14',
    basis: 'app',
    title: 'Research vs ADR-010: generated hardware',
    description:
      'The paper wants generated hardware and hardware completeness; ADR-010 lets this app list hardware only as a labelled schedule and never invent specs.',
    findings: ['ens.n.rank-25', 'ens.n.133', 'ens.n.142'],
    features: ['ens.f.hardware-completeness'],
  },
];
