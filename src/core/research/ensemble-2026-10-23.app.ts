/**
 * Where this app stands on each research feature left to build, and the features merged because they share one idea
 * (ADR-092, re-checked 2026-10-27 for ADR-149). Repository records, not research: every status cites the backlog row
 * or ADR that shows it.
 *
 * Statuses: In Progress — part of it is built, `missing` says what is not (user answer 2026-10-26: "In Progress +
 * what's missing"). Features not listed are Not Started. Built features (Verified, Implemented) are deleted from the
 * data (ADR-149, ADR-152, ADR-184). A status the user sets on the page wins over these.
 */
import type { Implementation } from './types';

type Status = [status: Implementation, evidence: string, missing?: string];

export const APP_CHECKED = '2026-11-05';

export const ENSEMBLE_APP_STATUS: Record<string, Status> = {
  'generated-parts': [
    'in-progress',
    'N26, N49, N56, N70: run parts derived from the pieces they span.',
    'shared supports, sinks and handles as generated parts',
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
  'propagation-pipeline': [
    'in-progress',
    'N56, N66: after a change, checks rerun and run parts regenerate.',
    'connector frames and constraints (no connectors yet)',
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
  'no-silent-moves': [
    'in-progress',
    'N93 (ADR-095): a locked piece is never moved; the action is refused with a reason.',
    'stopping and explaining when a change cannot keep every hard rule, for unlocked pieces',
  ],
  'rapier-queries': [
    'in-progress',
    'N126 (ADR-125): Rapier measured as a query engine against the box checks (devDependency only).',
    'adopting it in the app (needs a new ADR)',
  ],
};

/**
 * Remaining features merged into another unbuilt feature with the same idea (user answer 2026-10-26: "Broad: same
 * common idea"). Non-destructive: the feature stays, hidden from lists, and is shown on its target; the user can undo
 * each merge. A target is never one the app has built (review 2026-10-26), so merges never hide work left to do.
 */
export const ENSEMBLE_MERGES: Record<string, [target: string, reason: string]> = {
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
  'live-manufacturer-data': [
    'multi-supplier-catalogue',
    'Live data is how a cross-manufacturer catalogue stays current.',
  ],
  labels: ['cad-cnc-export', 'Part labels are a manufacturing output.'],
  'manufacturing-adapter': ['cad-cnc-export', 'The layer that produces manufacturing output.'],
  'ai-floorplan': ['ai-layout', 'AI layout on the room plan.'],
  'ai-explains': ['ai-layout', 'Part of the AI layout loop (propose, explain, validate).'],
  'inspiration-images': ['nl-generation', 'Another input to intent-driven generation.'],
  'yjs-crdt': ['collaboration', 'A technology for real-time collaboration.'],
};
