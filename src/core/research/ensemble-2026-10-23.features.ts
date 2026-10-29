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
import { APP_CHECKED, ENSEMBLE_APP_STATUS, ENSEMBLE_MERGES } from './ensemble-2026-10-23.app';
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
    ...appOf(slug),
  };
}
/** The app's status and any curated merge (ADR-092). */
function appOf(slug: string): Pick<ResearchFeature, 'app' | 'mergedInto' | 'mergeReason'> {
  const st = ENSEMBLE_APP_STATUS[slug];
  const mg = ENSEMBLE_MERGES[slug];
  return {
    ...(st
      ? {
          app: {
            status: st[0],
            evidence: st[1],
            ...(st[2] ? { missing: st[2] } : {}),
            checked: APP_CHECKED,
          },
        }
      : {}),
    ...(mg ? { mergedInto: id(mg[0]), mergeReason: mg[1] } : {}),
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

  // ── Workspace and catalogue placement ─────────────────────────────────────────────────────────────────────────

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
    related: ['persistent-connections'],
    tags: ['internal', 'P0'],
  }),

  // ── Validation ────────────────────────────────────────────────────────────────────────────────────────────────
  F('hard-soft-constraints', {
    name: 'Hard and soft constraints',
    category: 'parametric',
    subcategory: 'Constraint resolution',
    description:
      'Hard constraints (impossible dimensions, incompatible connector classes, mandatory structural dependencies, critical interference) prevent commit or require explicit resolution. Soft constraints (visual alignment, equal spacing, preferred orientation, style continuity) may be violated temporarily while dragging.',
    findings: ['106', '107'],
    tags: ['rules'],
  }),
  F('rapier-queries', {
    name: 'Spatial query engine (Rapier) without physics',
    category: 'architecture',
    subcategory: 'Collision engine',
    description:
      'Evaluate Rapier for richer collision and clearance queries — broad and narrow phase, sensor colliders, scene queries — used only as a geometry/query engine: cabinets must not bounce, fall or be physically integrated.',
    findings: ['090', 'stack-04'],
    tags: ['technology'],
  }),
  F('automated-fixes', {
    name: 'Automated fixes from rule repair strategies',
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
  F('propagation-pipeline', {
    name: 'Local dependency update on parameter change',
    category: 'parametric',
    subcategory: 'Propagation',
    description:
      'parameter change → connector frames recalculated → connected constraints re-solved → collisions/clearances rechecked → derived countertop/fillers regenerated → BOM refreshed.',
    findings: ['077', 'rec-05', 'phase-2'],
    tags: ['algorithm'],
  }),
  F('no-silent-moves', {
    name: 'Never silently move unrelated items',
    category: 'parametric',
    subcategory: 'Propagation',
    description:
      'A change never silently forces an unrelated distant item to move; when propagation cannot keep every hard constraint, it stops and presents the conflict.',
    findings: ['078'],
    tags: ['trust'],
  }),

  // ── Views ─────────────────────────────────────────────────────────────────────────────────────────────────────
  F('section-cutaway', {
    name: 'Section/cutaway and visibility isolation',
    category: 'visual',
    subcategory: 'Inspection views',
    ...ranked(28),
    description: 'Cut through the ensemble or isolate parts of it to see inside.',
    findings: ['rank-28'],
    tags: ['P2'],
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
  F('global-parameters', {
    name: 'Global parameters propagating common choices',
    category: 'parametric',
    subcategory: 'Global parameters',
    description:
      'Roomle global parameters propagate common choices across components; the scope selector can be implemented the same way.',
    competitors: ['c.roomle'],
    findings: ['039', '079'],
    tags: ['competitor-capability'],
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
  F('local-propagation', {
    name: 'Local propagation with targeted invalidation',
    category: 'architecture',
    subcategory: 'Performance',
    description:
      'Propagation stays local to the connected component; a cabinet width change never recomputes an unrelated bedroom ensemble elsewhere in the project. Invalidate only affected connections, generated parts, BOM nodes and clearance checks.',
    findings: ['109'],
    tags: ['performance'],
  }),

  // ── BOM, costing, commerce ────────────────────────────────────────────────────────────────────────────────────
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

  // ── Assembly instructions ─────────────────────────────────────────────────────────────────────────────────────
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
  F('family-presets', {
    name: 'Kitchen/wardrobe/desk as presets over one engine',
    category: 'room',
    subcategory: 'Cross-family',
    description:
      'Do not encode "Kitchen Mode", "Wardrobe Mode" and "Desk Mode" as separate applications; make them presets or specialised workflows over one composition engine.',
    findings: ['127'],
    tags: ['architecture'],
  }),
  F('multi-supplier-catalogue', {
    name: 'Cross-manufacturer catalogue',
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
    dependencies: ['ai-layout'],
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
];

/** Contradictions, mixed evidence and conflicting estimates, kept side by side. */
export const ENSEMBLE_CONTRADICTIONS: Contradiction[] = [
  {
    id: 'ens.x.03',
    basis: 'paper',
    title: 'Dual priorities: price P1/P2, sheet optimisation and CAD/CNC export P2/P3',
    description:
      'The paper keeps two priority bands for these rows; live price complexity is "Medium if data exists".',
    findings: ['ens.n.rank-24', 'ens.n.rank-32', 'ens.n.rank-33'],
    features: ['ens.f.live-price', 'ens.f.cad-cnc-export'],
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
    features: ['ens.f.generated-parts'],
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
    features: ['ens.f.locks-overrides'],
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
    features: ['ens.f.assembly-graph'],
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
    features: ['ens.f.versioned-save'],
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
];
