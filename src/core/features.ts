/**
 * What the app can do, as a tree of domains (ADR-158), for the Information and guides page. Written by hand from the
 * implemented ADRs; a feature built later adds its line here (CLAUDE.md). Texts are keys of the dictionary (ADR-153).
 */
import type { Key } from './i18n';

export interface Feature {
  /** What the user can do, in a few words. */
  name: Key;
  /** One sentence more, optional. */
  detail?: Key;
  /** The ADRs that built it. */
  adrs: string[];
  /**
   * The date a sync verified this line against the code (YYYY-MM-DD); a later ADR that edits or cites the line clears
   * it. `pnpm sync:pending` lists the lines a sync must check (CLAUDE.md).
   */
  checked?: string;
}
export interface FeatureDomain {
  name: Key;
  features?: Feature[];
  /** Sub-domains, one level deep. */
  children?: FeatureDomain[];
}

export const FEATURES: FeatureDomain[] = [
  {
    name: 'Creating',
    features: [
      {
        name: 'Start a new single piece',
        detail: 'Pick a template from the catalog to start from.',
        adrs: ['ADR-032', 'ADR-078'],
        checked: '2026-11-05',
      },
      {
        name: 'New-piece wizard',
        detail:
          "Answer the size, construction and contents questions; only the chosen type's questions are asked.",
        adrs: ['ADR-044', 'ADR-046', 'ADR-191'],
        checked: '2026-11-05',
      },
      {
        name: 'Suggested combinations in the wizard',
        detail: 'Cards with variations of your answers, kept only when they build without errors.',
        adrs: ['ADR-045'],
        checked: '2026-11-05',
      },
      {
        name: 'Reopen a piece in the wizard',
        detail: 'The answers stay with the piece, so you can change them later.',
        adrs: ['ADR-046'],
        checked: '2026-11-05',
      },
      {
        name: 'Reopen a project piece in the wizard',
        detail: 'Open in wizard in its Settings; Update piece replaces it in the project only.',
        adrs: ['ADR-203'],
      },
      {
        name: 'Create a project',
        detail: 'Several pieces placed in one room.',
        adrs: ['ADR-022', 'ADR-078'],
        checked: '2026-11-05',
      },
      {
        name: 'Create a project from a project template',
        detail:
          'Copies of the pieces with their positions, run-part recipe, connections, variables and bindings; pieces inserted into a project take its settings.',
        adrs: ['ADR-060', 'ADR-123', 'ADR-170', 'ADR-200'],
        checked: '2026-11-06',
      },
      {
        name: 'Fill a wall',
        detail:
          'Enter a wall width and pick a suggested mix of tall, base and wall cabinets that fills it exactly.',
        adrs: ['ADR-103', 'ADR-104'],
        checked: '2026-11-05',
      },
      { name: 'Make a new piece inside a project', adrs: ['ADR-107'], checked: '2026-11-05' },
      {
        name: 'Fill the room',
        detail:
          'Pick a room shape or use the project’s room: suggested mixes for every ticked wall at once, doors and windows kept free, a corner cabinet at each inside corner with a wall corner cabinet above it, wall rows split at windows; each mix checked as a project.',
        adrs: ['ADR-173', 'ADR-177'],
        checked: '2026-11-05',
      },
    ],
  },
  {
    name: 'Composition',
    children: [
      {
        name: 'Dividing spaces',
        features: [
          {
            name: 'Divide a space side by side or stacked',
            detail: 'Fixed millimetre sizes or shares, split exactly in whole millimetres.',
            adrs: ['ADR-005', 'ADR-003', 'ADR-199'],
            checked: '2026-11-06',
          },
          { name: 'New parts start empty', adrs: ['ADR-089'], checked: '2026-11-05' },
          {
            name: 'Bays and shelves layout',
            detail: 'Lay the whole inside out as equal bays with the same shelves and doors.',
            adrs: ['ADR-031'],
            checked: '2026-11-05',
          },
          {
            name: 'Apply a layout preset',
            detail: 'Replace the selected space with the inside of a catalog variant.',
            adrs: ['ADR-033'],
            checked: '2026-11-05',
          },
          {
            name: 'Merge two touching cabinets',
            detail:
              'The two become one cabinet with a divider where they met; any other difference refuses the merge.',
            adrs: ['ADR-047'],
            checked: '2026-11-05',
          },
        ],
      },
      {
        name: 'Contents',
        features: [
          {
            name: 'Shelves, fixed or adjustable',
            detail: 'Adjustable shelves get 32 mm pin-row notes on the sides.',
            adrs: ['ADR-023'],
            checked: '2026-11-05',
          },
          {
            name: 'Drawers with equal or chosen heights',
            adrs: ['ADR-005', 'ADR-023'],
            checked: '2026-11-05',
          },
          { name: 'Hanging rail', adrs: ['ADR-005'], checked: '2026-11-05' },
          { name: 'Drawers behind doors', adrs: ['ADR-005', 'ADR-006'], checked: '2026-11-05' },
          {
            name: 'Appliance niches',
            detail:
              "An empty space sized from the appliance's drawing, checked against the opening.",
            adrs: ['ADR-036'],
            checked: '2026-11-05',
          },
          {
            name: 'Fixed front with no drawer',
            detail: 'A false front, for example on a sink base.',
            adrs: ['ADR-054'],
            checked: '2026-11-05',
          },
        ],
      },
      {
        name: 'Quick counts',
        features: [
          {
            name: 'Plus-minus counts on the drawing',
            detail: 'Dividers, shelves, drawers and doors of the selected space only.',
            adrs: ['ADR-084', 'ADR-086', 'ADR-112'],
            checked: '2026-11-05',
          },
          { name: 'Quick counts over the 3D view', adrs: ['ADR-085'], checked: '2026-11-05' },
          {
            name: 'Quick counts over the project front view',
            adrs: ['ADR-109'],
            checked: '2026-11-05',
          },
        ],
      },
      {
        name: 'Selecting inside a piece',
        features: [
          {
            name: 'Select from the whole piece inwards',
            detail: 'Each tap selects one level smaller under the tap.',
            adrs: ['ADR-083'],
            checked: '2026-11-05',
          },
          {
            name: 'Clear highlight of the selected space',
            detail: 'An outline round it and the rest faded, in the drawing and in 3D.',
            adrs: ['ADR-087'],
            checked: '2026-11-05',
          },
          {
            name: 'Drill into a project piece',
            detail: 'Edit its spaces, size, boards and construction without leaving the project.',
            adrs: ['ADR-088', 'ADR-090'],
            checked: '2026-11-05',
          },
          {
            name: 'Esc selects one level up',
            detail:
              'In the piece editor: a space, then the space around it, then the whole piece, then nothing.',
            adrs: ['ADR-203'],
          },
          {
            name: 'Outline turns with an angled piece',
            detail: 'The 3D selection outline and the Move ghost are turned like its boards.',
            adrs: ['ADR-203'],
          },
        ],
      },
    ],
  },
  {
    name: 'Moving',
    features: [
      {
        name: 'Drag a piece on the plan',
        detail:
          'Whole millimetres in 10 mm steps; Esc cancels. The arrow keys move a focused piece 10 mm, 100 mm with Shift.',
        adrs: ['ADR-065'],
        checked: '2026-11-05',
      },
      { name: 'Move and turn pieces in the 3D view', adrs: ['ADR-093'], checked: '2026-11-05' },
      {
        name: "Change a wall unit's height by dragging in 3D",
        adrs: ['ADR-122'],
        checked: '2026-11-05',
      },
      {
        name: 'Type an exact position',
        detail: 'From the left, from the back and the gap to the piece on the left.',
        adrs: ['ADR-022'],
        checked: '2026-11-05',
      },
      {
        name: 'Turn 90° about the centre',
        detail: 'Turn ↺ and ↻ in the toolbar, or R and Shift+R.',
        adrs: ['ADR-069', 'ADR-160'],
        checked: '2026-11-05',
      },
      {
        name: 'Turn to any whole degree with a handle',
        detail:
          'Drag the round handle in front of the selected piece; it snaps to quarter turns, Shift steps by 15°, [ and ] turn by 1°.',
        adrs: ['ADR-169', 'ADR-160'],
        checked: '2026-11-05',
      },
      {
        name: 'Move to a wall, corner, ceiling, floor or neighbour',
        detail:
          "One tap slides it to a wall, corner or neighbour, up to the ceiling or down, centres it, or matches a neighbour's top or front. Several selected pieces move as one block.",
        adrs: ['ADR-147', 'ADR-182'],
        checked: '2026-11-05',
      },
      {
        name: 'Place on the floor, on the wall or on another piece',
        detail: 'A piece on another piece follows it.',
        adrs: ['ADR-031'],
        checked: '2026-11-05',
      },
      {
        name: 'Lock a piece in place, its turn, or each of its sizes',
        detail:
          'Lock keeps it where it is; Lock turn, Lock width, Lock height, Lock depth and Lock size (all three) in More actions. A locked value outranks variables, Replace, linked copies and project settings.',
        adrs: ['ADR-095', 'ADR-122', 'ADR-171'],
        checked: '2026-11-05',
      },
      {
        name: 'A locked piece on a base keeps the base from being resized',
        detail: 'Unlock it to resize the piece under it; unlocked pieces on it follow.',
        adrs: ['ADR-203'],
      },
    ],
  },
  {
    name: 'Aligning and arranging',
    features: [
      {
        name: 'Snap to neighbours and walls',
        detail:
          'A preview while dragging; at equal distance a locked neighbour wins; the Snap box or Alt places freely.',
        adrs: ['ADR-070', 'ADR-180'],
        checked: '2026-11-05',
      },
      { name: 'Snap centre to centre', adrs: ['ADR-099'], checked: '2026-11-05' },
      {
        name: 'Connected pieces',
        detail:
          'A snap joins two touching pieces; they move together, the seam is marked on the plan, the front view and in 3D, and a pair that no longer touches is warned about.',
        adrs: ['ADR-168', 'ADR-179'],
        checked: '2026-11-05',
      },
      {
        name: 'Compatibility rules',
        detail: 'Checked when snapping and in the project checks.',
        adrs: ['ADR-100'],
        checked: '2026-11-05',
      },
      {
        name: 'Align left, centre, right, back and front',
        adrs: ['ADR-099'],
        checked: '2026-11-05',
      },
      { name: 'Align tops and bottoms', adrs: ['ADR-122'], checked: '2026-11-05' },
      { name: 'Distribute evenly', adrs: ['ADR-099'], checked: '2026-11-05' },
      {
        name: 'Groups align and distribute as one block',
        adrs: ['ADR-099', 'ADR-148'],
        checked: '2026-11-05',
      },
      { name: 'Duplicate a piece', adrs: ['ADR-069'], checked: '2026-11-05' },
      {
        name: 'Mirror a piece',
        detail: 'Swaps left and right inside the piece: hinges, pedestals and handles.',
        adrs: ['ADR-069'],
        checked: '2026-11-05',
      },
      {
        name: 'Mirror a run or a selection',
        detail:
          'Positions reflect about the centre and each piece is mirrored; groups touching the run mirror with it, and a group that cannot mirror refuses with the reason.',
        adrs: ['ADR-069', 'ADR-121', 'ADR-176'],
        checked: '2026-11-05',
      },
      {
        name: 'Linked copies',
        detail: 'Change one copy and every linked copy changes.',
        adrs: ['ADR-111'],
        checked: '2026-11-05',
      },
    ],
  },
  {
    name: 'Selection and groups',
    features: [
      {
        name: 'Select several pieces',
        detail: 'Shift- or Ctrl-click, Select on a phone, or Ctrl+A.',
        adrs: ['ADR-097'],
        checked: '2026-11-05',
      },
      {
        name: 'Select several pieces in the front view, 3D and the piece list',
        detail: 'One Select box shared by every view.',
        adrs: ['ADR-159'],
        checked: '2026-11-05',
      },
      { name: 'Selection box on the plan', adrs: ['ADR-097'], checked: '2026-11-05' },
      { name: 'Cycle through overlapping pieces', adrs: ['ADR-097'], checked: '2026-11-05' },
      {
        name: 'Keep pieces as named groups',
        detail: 'Grouped pieces move together.',
        adrs: ['ADR-097', 'ADR-148'],
        checked: '2026-11-05',
      },
    ],
  },
  {
    name: 'Sizing',
    features: [
      {
        name: 'Width, height and depth of the whole piece where it is selected',
        adrs: ['ADR-106', 'ADR-148'],
        checked: '2026-11-05',
      },
      {
        name: 'Size, boards and construction of a project piece',
        adrs: ['ADR-090'],
        checked: '2026-11-05',
      },
      {
        name: 'Lock size',
        detail: "Nothing changes the piece's width, height or depth until you unlock it.",
        adrs: ['ADR-122', 'ADR-199'],
        checked: '2026-11-06',
      },
      {
        name: 'Size a group as a whole',
        detail: 'Width split proportionally or equally; height and depth set on every piece.',
        adrs: ['ADR-148'],
        checked: '2026-11-05',
      },
      {
        name: 'Exact whole-millimetre splits',
        detail: 'Leftover millimetres go one each to the first parts.',
        adrs: ['ADR-003'],
        checked: '2026-11-05',
      },
    ],
  },
  {
    name: 'Construction',
    children: [
      {
        name: 'Carcass',
        features: [
          {
            name: 'Sides, top, bottom, plinth and back',
            detail:
              'Top on or between the sides, bottom between or under them, back nailed on, set in or none.',
            adrs: ['ADR-004', 'ADR-031'],
            checked: '2026-11-05',
          },
          { name: 'Doubled top', adrs: ['ADR-105'], checked: '2026-11-05' },
          { name: 'Rails instead of a full top', adrs: ['ADR-036'], checked: '2026-11-05' },
          { name: 'Cabinet with no bottom', adrs: ['ADR-036'], checked: '2026-11-05' },
          { name: 'Wall cabinets', adrs: ['ADR-025'], checked: '2026-11-05' },
          {
            name: 'Corner cabinets',
            detail:
              'Blind, L-shaped and diagonal corners, on the floor or hung on the wall (you choose the brackets).',
            adrs: ['ADR-025', 'ADR-040', 'ADR-177'],
            checked: '2026-11-05',
          },
          { name: 'Tall cabinets', adrs: ['ADR-036'], checked: '2026-11-05' },
        ],
      },
      {
        name: 'Doors and fronts',
        features: [
          {
            name: 'Hinged doors, one or a pair',
            adrs: ['ADR-006', 'ADR-199'],
            checked: '2026-11-06',
          },
          {
            name: 'Overlay, half-overlay and inset fronts',
            adrs: ['ADR-024'],
            checked: '2026-11-05',
          },
          { name: 'Exact gaps between fronts', adrs: ['ADR-006'], checked: '2026-11-05' },
          { name: 'Sliding doors', adrs: ['ADR-037'], checked: '2026-11-05' },
          { name: 'Lift-up and drop-down flaps', adrs: ['ADR-037'], checked: '2026-11-05' },
          { name: 'No doors or handles inside other doors', adrs: [], checked: '2026-11-05' },
          {
            name: 'Front-only panels',
            detail: 'An integrated appliance door or a cover panel with no carcass.',
            adrs: ['ADR-036'],
            checked: '2026-11-05',
          },
        ],
      },
      {
        name: 'Drawers',
        features: [
          {
            name: 'Drawer boxes with runner choice and clearances',
            adrs: ['ADR-005', 'ADR-010'],
            checked: '2026-11-05',
          },
          { name: 'Drawer boxes without an inner front', adrs: ['ADR-192'], checked: '2026-11-05' },
        ],
      },
      {
        name: 'Kitchen runs',
        features: [
          {
            name: 'Run parts: worktop, plinth, fillers and covers',
            detail: 'Suggested along a run of base units and kept up to date.',
            adrs: ['ADR-036', 'ADR-061'],
            checked: '2026-11-05',
          },
          { name: 'One plinth for the whole run', adrs: ['ADR-054'], checked: '2026-11-05' },
          { name: 'Scribe allowance for fillers', adrs: ['ADR-054'], checked: '2026-11-05' },
          {
            name: 'Worktop over chosen pieces, with overhangs',
            adrs: ['ADR-075'],
            checked: '2026-11-05',
          },
          { name: 'Crown, pelmet and ceiling filler', adrs: ['ADR-075'], checked: '2026-11-05' },
          { name: 'Handles for a whole run', adrs: ['ADR-125'], checked: '2026-11-05' },
          {
            name: 'Run handle shown in the piece editor',
            detail: 'Its kind and hole centres, read-only, under Set by Handles for this run.',
            adrs: ['ADR-203'],
          },
          { name: 'Sink cut-out in the run worktop', adrs: ['ADR-125'], checked: '2026-11-05' },
        ],
      },
      {
        name: 'Other kinds of furniture',
        features: [
          { name: 'Desks with pedestals', adrs: ['ADR-007', 'ADR-026'], checked: '2026-11-05' },
          {
            name: 'Tables, benches, stools, chairs and beds',
            adrs: ['ADR-038'],
            checked: '2026-11-05',
          },
          {
            name: 'Shaped parts',
            detail: 'Raked backs, splayed legs and profiled fronts, still in whole millimetres.',
            adrs: ['ADR-040'],
            checked: '2026-11-05',
          },
          {
            name: 'Loose panel sets',
            detail: 'Parts known only by their cut sizes.',
            adrs: ['ADR-041'],
            checked: '2026-11-05',
          },
        ],
      },
    ],
  },
  {
    name: 'Boards and edges',
    features: [
      {
        name: 'Boards: name, thickness, grain and colour',
        adrs: ['ADR-019'],
        checked: '2026-11-05',
      },
      {
        name: 'One Material control everywhere',
        detail:
          'Material in the header bar: a board on one part, the item, the group or the whole project, on any part roles.',
        adrs: ['ADR-055', 'ADR-163'],
        checked: '2026-11-05',
      },
      {
        name: 'One PAL 18 board for every part by default',
        detail:
          "New pieces start on one board; the wizard offers the project's boards and your decor list.",
        adrs: ['ADR-164'],
        checked: '2026-11-05',
      },
      {
        name: 'A common top or bottom across items',
        detail:
          'Select items standing side by side: Common top or Common bottom makes one panel across them.',
        adrs: ['ADR-165'],
        checked: '2026-11-05',
      },
      {
        name: 'Run parts and edge bands in the Material dialog',
        detail:
          'Worktop, fillers, plinth and trims of a run; an edge band per part role or per part.',
        adrs: ['ADR-188'],
        checked: '2026-11-05',
      },
      {
        name: 'Common top across gaps, corner units and desks',
        detail:
          'One top over a gap, round an L or diagonal corner (cut to template) and over a desk.',
        adrs: ['ADR-189'],
        checked: '2026-11-05',
      },
      {
        name: 'Neighbours share one side panel',
        detail:
          'Select cabinets side by side: Shared sides leaves one side per joint; fronts meet over its middle.',
        adrs: ['ADR-190'],
        checked: '2026-11-05',
      },
      { name: 'Stock sheets, trim and kerf', adrs: ['ADR-019'], checked: '2026-11-05' },
      { name: 'Solid timber stock', adrs: ['ADR-038'], checked: '2026-11-05' },
      { name: 'Manufacturer and type labels', adrs: ['ADR-049'], checked: '2026-11-05' },
      { name: 'Import your own decor list (CSV)', adrs: ['ADR-049'], checked: '2026-11-05' },
      {
        name: 'Boards and edge bands from a seller',
        detail:
          'Bundled seller products (Regency first): same thickness and decor first, you pick; pictures not shipped with the app load online from the seller’s site.',
        adrs: ['ADR-161'],
        checked: '2026-11-05',
      },
      {
        name: 'Seller board pictures shipped with the app',
        detail:
          'A seller board shows its decor in 3D and the front view, without asking the seller’s site.',
        adrs: ['ADR-162'],
        checked: '2026-11-05',
      },
      { name: 'A picture from your device on a board', adrs: ['ADR-048'], checked: '2026-11-05' },
      { name: 'Matte, satin or gloss finish', adrs: ['ADR-067'], checked: '2026-11-05' },
      {
        name: 'Edge band per board',
        detail: 'Type, thickness, width and code, on the cut list and shopping list.',
        adrs: ['ADR-077'],
        checked: '2026-11-05',
      },
      {
        name: 'Own board for any single part',
        detail: 'In Material, scope Part; a part the piece no longer builds is listed to clear.',
        adrs: ['ADR-151', 'ADR-163'],
        checked: '2026-11-05',
      },
      {
        name: 'Style suggestions',
        detail: 'In the Material dialog: board and handle combinations, labelled as suggestions.',
        adrs: ['ADR-123', 'ADR-163'],
        checked: '2026-11-05',
      },
      {
        name: 'Project-wide settings',
        detail:
          'Handle, front overlay and plinth height that pieces follow; Material with scope Project sets the carcass, front and back boards.',
        adrs: ['ADR-124', 'ADR-163'],
        checked: '2026-11-05',
      },
    ],
  },
  {
    name: 'Hardware',
    features: [
      {
        name: 'Hardware schedule',
        detail: 'Hinges, runners, rails and brackets, with typical values labelled as guidance.',
        adrs: ['ADR-010'],
        checked: '2026-11-05',
      },
      { name: 'Handles: bar, knob or push to open', adrs: ['ADR-024'], checked: '2026-11-05' },
      {
        name: 'Fastener counts',
        detail: 'Counted from the model as guidance; you name the fasteners you use.',
        adrs: ['ADR-074'],
        checked: '2026-11-05',
      },
      {
        name: 'Hardware you choose yourself',
        detail:
          'Sliding tracks, flap stays and appliance fixings wait for your choice, never invented.',
        adrs: ['ADR-037', 'ADR-010'],
        checked: '2026-11-05',
      },
    ],
  },
  {
    name: 'Room and walls',
    features: [
      {
        name: 'Room size, doors, windows and obstacles',
        adrs: ['ADR-058', 'ADR-200'],
        checked: '2026-11-06',
      },
      {
        name: 'Draw the floor plan',
        detail: 'Rectangle, L, U and alcove shapes, every wall length editable.',
        adrs: ['ADR-059'],
        checked: '2026-11-05',
      },
      { name: 'Pipes and outlets', adrs: ['ADR-072'], checked: '2026-11-05' },
      {
        name: 'Wall colour or picture',
        detail:
          'Set per wall under Walls in the room; shown on the walls in 3D and behind the pieces against it in the room front view. Solid walls in 3D makes the walls opaque.',
        adrs: ['ADR-145'],
        checked: '2026-11-05',
      },
      {
        name: 'Fit, shift and straighten a wall picture',
        adrs: ['ADR-146'],
        checked: '2026-11-05',
      },
      {
        name: 'Opening clearances',
        detail: 'Doors and drawers need free space in front.',
        adrs: ['ADR-057'],
        checked: '2026-11-05',
      },
      {
        name: 'Chair, installation and service clearances',
        adrs: ['ADR-073'],
        checked: '2026-11-05',
      },
    ],
  },
  {
    name: 'Checks and problems',
    features: [
      {
        name: 'Problems checked on their own; errors block export',
        adrs: ['ADR-008'],
        checked: '2026-11-05',
      },
      { name: 'Overlap and room checks', adrs: ['ADR-022', 'ADR-058'], checked: '2026-11-05' },
      {
        name: 'Construction guidance',
        detail: 'Shelf span, door width, anti-tip and more, labelled as guidance.',
        adrs: ['ADR-035'],
        checked: '2026-11-05',
      },
      {
        name: 'Select the problem',
        detail: 'Tapping a check selects the pieces and shows where it is.',
        adrs: ['ADR-071'],
        checked: '2026-11-05',
      },
      {
        name: 'Previewed repairs',
        detail:
          'A repair moves the whole group and connected pieces together; one they cannot follow is shown refused, with the reason.',
        adrs: ['ADR-071', 'ADR-176'],
        checked: '2026-11-05',
      },
    ],
  },
  {
    name: 'Views',
    children: [
      {
        name: 'Drawings',
        features: [
          {
            name: 'Compose and Build & Preview modes',
            adrs: ['ADR-079', 'ADR-080'],
            checked: '2026-11-05',
          },
          { name: 'Front drawing with sizes', adrs: ['ADR-014'], checked: '2026-11-05' },
          {
            name: 'Project plan and room front view with sizes',
            adrs: ['ADR-022'],
            checked: '2026-11-05',
          },
          {
            name: '2D, 3D or both side by side',
            detail:
              'One View switch in Compose and Build & Preview; the chosen view stays when the mode changes.',
            adrs: ['ADR-081', 'ADR-144'],
            checked: '2026-11-05',
          },
        ],
      },
      {
        name: '3D view',
        features: [
          { name: '3D preview, select by click', adrs: ['ADR-014'], checked: '2026-11-05' },
          { name: 'Exploded 3D view', adrs: ['ADR-014'], checked: '2026-11-05' },
          {
            name: 'Realistic look',
            detail: 'Board finishes, room light and soft shadows.',
            adrs: ['ADR-067'],
            checked: '2026-11-05',
          },
          {
            name: 'Render a photo-quality picture',
            detail: 'Saved as PNG; best on a laptop, a phone may be slow.',
            adrs: ['ADR-068'],
            checked: '2026-11-05',
          },
          { name: 'Section view and Isolate', adrs: ['ADR-122'], checked: '2026-11-05' },
          { name: 'Draws only when something changes', adrs: ['ADR-121'], checked: '2026-11-05' },
        ],
      },
      {
        name: 'Imported 3D models',
        features: [
          {
            name: 'Import GLB and glTF models',
            detail: 'Display-only items, checked against the pieces and the room.',
            adrs: ['ADR-076'],
            checked: '2026-11-05',
          },
          { name: 'Width, height and depth of a model', adrs: ['ADR-102'], checked: '2026-11-05' },
          {
            name: 'Move and turn a model in 3D',
            detail: 'Drag it in Move mode, with Snap, and turn it 90° about its centre.',
            adrs: ['ADR-203'],
          },
        ],
      },
    ],
  },
  {
    name: 'Output',
    children: [
      {
        name: 'Results',
        features: [
          {
            name: 'Results tabs under the views',
            detail:
              'Parts, Sheets, Hardware, Assembly, Shopping and Checks; Parts shows the number of parts and Checks the number of problems; on a phone they stay folded until you tap a tab.',
            adrs: ['ADR-079', 'ADR-091', 'ADR-174'],
            checked: '2026-11-05',
          },
          {
            name: 'Assembly steps',
            detail:
              'Steps per piece, labelled guidance: prepare the parts, fit hardware to the sides, assemble, then fit drawers and doors. Each step has an instruction, its parts, joints, fasteners and hardware; identical drawers are listed once. Show step lights the parts in 3D; printed with each piece’s front view in the print language.',
            adrs: ['ADR-174', 'ADR-185', 'ADR-186'],
            checked: '2026-11-05',
          },
          {
            name: 'Project assembly order',
            detail:
              'A project’s Assembly tab and printed sheet open with the order of its pieces: corner cabinets, base pieces wall by wall from the corner, wall pieces, then run parts; labelled guidance.',
            adrs: ['ADR-178'],
            checked: '2026-11-05',
          },
        ],
      },
      {
        name: 'Cut list',
        features: [
          {
            name: 'Cut list with finished sizes and edge-band marks',
            adrs: ['ADR-009'],
            checked: '2026-11-05',
          },
          { name: 'Grouped parts, area and band metres', adrs: ['ADR-009'], checked: '2026-11-05' },
          { name: 'Parts CSV', adrs: ['ADR-020'], checked: '2026-11-05' },
          { name: 'Lengths list for solid stock', adrs: ['ADR-038'], checked: '2026-11-05' },
        ],
      },
      {
        name: 'Sheets',
        features: [
          {
            name: 'Sheet layouts',
            detail: 'Parts nested on your stock sheets, checked by an independent validator.',
            adrs: ['ADR-018'],
            checked: '2026-11-05',
          },
        ],
      },
      {
        name: 'Shopping and costs',
        features: [
          {
            name: 'Running cost estimate',
            detail:
              'A chip in the editor header with the estimate of what is shown, updated on every change; tap it to open the Shopping list.',
            adrs: ['ADR-172'],
            checked: '2026-11-05',
          },
          {
            name: 'Shopping list',
            detail: 'Boards, banding, hardware, run parts and what is still to choose.',
            adrs: ['ADR-064'],
            checked: '2026-11-05',
          },
          { name: 'Shopping list CSV', adrs: ['ADR-064'], checked: '2026-11-05' },
          {
            name: 'Unit price on each Shopping list row',
            detail:
              'Under each line total, the unit price it comes from (your price or the seller’s); “—” when a row has no price. Also a column on the printed list and in the CSV.',
            adrs: ['ADR-181'],
            checked: '2026-11-05',
          },
          { name: 'Cost estimate from your price list', adrs: ['ADR-062'], checked: '2026-11-05' },
          {
            name: 'Seller products for hardware and seller prices',
            detail:
              'Your own price wins; otherwise the seller price, with its date. Add seller product puts any seller product on a piece’s shopping list.',
            adrs: ['ADR-161'],
            checked: '2026-11-05',
          },
        ],
      },
      {
        name: 'Printing and files',
        features: [
          { name: 'Print sheets or save as PDF', adrs: ['ADR-020'], checked: '2026-11-05' },
          { name: 'Download drawings as SVG', adrs: ['ADR-020'], checked: '2026-11-05' },
          {
            name: 'Fusion 360 script',
            detail: 'Rebuilds the model as named solid boxes; not verified inside Fusion.',
            adrs: ['ADR-021'],
            checked: '2026-11-05',
          },
          {
            name: 'Review pack for a professional',
            detail: 'Summary, parts CSV, drawings and the project file in one .zip.',
            adrs: ['ADR-121'],
            checked: '2026-11-05',
          },
        ],
      },
    ],
  },
  {
    name: 'Projects',
    features: [
      {
        name: 'Several pieces in one room, with combined lists',
        adrs: ['ADR-022'],
        checked: '2026-11-05',
      },
      {
        name: 'Projects page',
        detail: 'Open, duplicate and delete projects and single pieces.',
        adrs: ['ADR-078'],
        checked: '2026-11-05',
      },
      {
        name: 'Ask about kept versions when deleting a project',
        detail: 'Keep them is the default; only readable versions are deleted.',
        adrs: ['ADR-203'],
      },
      { name: 'Add a piece from a list with pictures', adrs: ['ADR-094'], checked: '2026-11-05' },
      { name: 'Tap the plan to place', adrs: ['ADR-056'], checked: '2026-11-05' },
      { name: 'Drag a catalog item onto the plan', adrs: ['ADR-094'], checked: '2026-11-05' },
      { name: 'Insert a project template', adrs: ['ADR-123'], checked: '2026-11-05' },
      {
        name: 'Replace a piece with a compatible one',
        detail: 'Your own changes are kept where the new piece has the same setting.',
        adrs: ['ADR-098', 'ADR-124'],
        checked: '2026-11-05',
      },
      { name: 'Template updated notices', adrs: ['ADR-096'], checked: '2026-11-05' },
      {
        name: 'Template references',
        detail: 'A catalog piece keeps only what differs from its template.',
        adrs: ['ADR-124'],
        checked: '2026-11-05',
      },
      {
        name: 'Undo and redo with named steps',
        adrs: ['ADR-051', 'ADR-123', 'ADR-198'],
        checked: '2026-11-06',
      },
      { name: 'Edit history', adrs: ['ADR-123'], checked: '2026-11-05' },
      { name: 'Version history', adrs: ['ADR-123', 'ADR-200'], checked: '2026-11-06' },
      { name: 'Save as a project template', adrs: ['ADR-060', 'ADR-200'], checked: '2026-11-06' },
      {
        name: 'Project variables and formulas',
        detail: 'Bind a size, a division or a position to a named value; change it once.',
        adrs: ['ADR-166'],
        checked: '2026-11-05',
      },
      {
        name: 'Value sets',
        detail:
          'Duplicate every bound piece with other values, with the room; set 1’s run parts, run handles and sinks are copied onto each set and kept in step; save a set as a project.',
        adrs: ['ADR-167', 'ADR-175'],
        checked: '2026-11-05',
      },
      {
        name: 'Side panel ordered by use',
        detail:
          'Add a piece at the top, previous and next piece, one toolbar, a More actions menu and Delete to remove.',
        adrs: ['ADR-117', 'ADR-160'],
        checked: '2026-11-05',
      },
      {
        name: 'Quick actions on the phone sheet',
        detail: 'Edit, duplicate and turn the selected piece with the sheet closed.',
        adrs: ['ADR-160'],
        checked: '2026-11-05',
      },
    ],
  },
  {
    name: 'Catalog and templates',
    features: [
      { name: 'Browse by room or type, with search', adrs: ['ADR-032'], checked: '2026-11-05' },
      { name: '1–5 variants per family', adrs: ['ADR-033'], checked: '2026-11-05' },
      { name: 'Catalog pictures', adrs: ['ADR-042'], checked: '2026-11-05' },
      { name: 'Compact cards with More', adrs: ['ADR-118', 'ADR-119'], checked: '2026-11-05' },
      {
        name: 'Edit templates on this device',
        detail: 'Shipped templates never change; reset or compare with the shipped one.',
        adrs: ['ADR-034'],
        checked: '2026-11-05',
      },
      { name: 'Save a design as a template', adrs: ['ADR-034'], checked: '2026-11-05' },
      {
        name: 'Choose which edit to keep on template import',
        detail: 'An imported template for a family you edited asks; Keep mine is the default.',
        adrs: ['ADR-203'],
      },
      { name: 'Save a project piece to the catalog', adrs: ['ADR-107'], checked: '2026-11-05' },
      { name: 'Catalog origin kept on copies', adrs: ['ADR-028'], checked: '2026-11-05' },
      {
        name: 'Reference entries for upholstered pieces',
        adrs: ['ADR-039'],
        checked: '2026-11-05',
      },
    ],
  },
  {
    name: 'Saving, backup and sharing',
    features: [
      { name: 'Autosave on this device', adrs: ['ADR-012'], checked: '2026-11-05' },
      {
        name: 'Works offline, as an installed app',
        adrs: ['ADR-002', 'ADR-126'],
        checked: '2026-11-05',
      },
      {
        name: 'Import and export files',
        detail: 'Designs and projects, with their pictures and 3D models.',
        adrs: ['ADR-011', 'ADR-078'],
        checked: '2026-11-05',
      },
      { name: 'Design codes and links', adrs: ['ADR-124'], checked: '2026-11-05' },
      { name: 'Keep saved data persistent', adrs: ['ADR-133'], checked: '2026-11-05' },
      {
        name: 'Back up to a folder or a .zip, and restore',
        detail: 'Restoring adds new copies; nothing saved is overwritten or deleted.',
        adrs: ['ADR-133'],
        checked: '2026-11-05',
      },
      { name: 'Backup reminder', adrs: ['ADR-141'], checked: '2026-11-05' },
      { name: 'Only-on-this-device notice', adrs: ['ADR-140'], checked: '2026-11-05' },
      { name: 'Clean up unused pictures', adrs: ['ADR-048', 'ADR-078'], checked: '2026-11-05' },
      {
        name: 'Share links',
        detail:
          'Signed in, a link to a piece or template; anyone with it opens a copy until you stop sharing.',
        adrs: ['ADR-132', 'ADR-138'],
        checked: '2026-11-05',
      },
      { name: 'Preview a shared item', adrs: ['ADR-143'], checked: '2026-11-05' },
    ],
  },
  {
    name: 'Account',
    features: [
      { name: 'Sign in with Google', adrs: ['ADR-135'], checked: '2026-11-05' },
      { name: 'Email and password, forgot and reset', adrs: ['ADR-136'], checked: '2026-11-05' },
      { name: 'Stay signed in', adrs: ['ADR-134'], checked: '2026-11-05' },
      {
        name: 'Save pieces and templates to your account',
        detail:
          'Signed in, saved pieces and templates upload by themselves; Keep on this device only opts one out, and In your account lists those not on this device.',
        adrs: ['ADR-128', 'ADR-137'],
        checked: '2026-11-05',
      },
      { name: 'Sync status', adrs: ['ADR-129', 'ADR-139'], checked: '2026-11-05' },
      { name: 'Conflicts never lose work', adrs: ['ADR-129'], checked: '2026-11-05' },
      { name: 'Several accounts on one device', adrs: ['ADR-142'], checked: '2026-11-05' },
      {
        name: 'Privacy notice, data export and account deletion',
        adrs: ['ADR-130'],
        checked: '2026-11-05',
      },
    ],
  },
  {
    name: 'Language',
    features: [
      { name: 'English or Russian', adrs: ['ADR-153'], checked: '2026-11-05' },
      { name: 'Every screen translated', adrs: ['ADR-154'], checked: '2026-11-05' },
      { name: 'Catalog, wizard and research translated', adrs: ['ADR-155'], checked: '2026-11-05' },
      { name: 'Problem messages translated', adrs: ['ADR-156'], checked: '2026-11-05' },
      {
        name: 'Print language: Romanian, Russian or English',
        adrs: ['ADR-157'],
        checked: '2026-11-05',
      },
    ],
  },
  {
    name: 'Information',
    features: [
      { name: 'Information and guides page', adrs: ['ADR-158'], checked: '2026-11-05' },
      {
        name: 'Feature Research',
        detail: 'Research features still left to build, and competitors.',
        adrs: ['ADR-043', 'ADR-092', 'ADR-110', 'ADR-149', 'ADR-152', 'ADR-184'],
        checked: '2026-11-05',
      },
      {
        name: 'Gaps page',
        detail:
          'Gaps with rough work, impact and necessity ratings, filters, and an issue and a fix line each.',
        adrs: ['ADR-101', 'ADR-187'],
        checked: '2026-11-05',
      },
      { name: 'Info buttons', adrs: ['ADR-080', 'ADR-113'], checked: '2026-11-05' },
      {
        name: 'Arrow keys in segmented controls',
        detail:
          'Tab reaches the chosen option; the arrow keys, Home and End move and choose, in every segmented control.',
        adrs: ['ADR-202'],
      },
      { name: 'Light and dark themes', adrs: ['ADR-030'], checked: '2026-11-05' },
    ],
  },
];
