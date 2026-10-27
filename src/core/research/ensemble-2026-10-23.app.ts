/**
 * Where this app stands on each research feature left to build, and the features merged because they share one idea
 * (ADR-092, re-checked 2026-10-27 for ADR-111). Repository records, not research: every status cites the backlog row
 * or ADR that shows it.
 *
 * Statuses: In Progress — part of it is built, `missing` says what is not (user answer 2026-10-26: "In Progress +
 * what's missing"). Features not listed are Not Started. Built features (Verified, Implemented) are deleted from the
 * data (ADR-111). A status the user sets on the page wins over these.
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
