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
      },
      {
        name: 'New-piece wizard',
        detail:
          "Answer the size, construction and contents questions; only the chosen type's questions are asked.",
        adrs: ['ADR-044', 'ADR-046'],
      },
      {
        name: 'Suggested combinations in the wizard',
        detail: 'Cards with variations of your answers, kept only when they build without errors.',
        adrs: ['ADR-045'],
      },
      {
        name: 'Reopen a piece in the wizard',
        detail: 'The answers stay with the piece, so you can change them later.',
        adrs: ['ADR-046'],
      },
      {
        name: 'Create a project',
        detail: 'Several pieces placed in one room.',
        adrs: ['ADR-022', 'ADR-078'],
      },
      { name: 'Create a project from a project template', adrs: ['ADR-060'] },
      {
        name: 'Fill a wall',
        detail:
          'Enter a wall width and pick a suggested mix of tall, base and wall cabinets that fills it exactly.',
        adrs: ['ADR-103', 'ADR-104'],
      },
      { name: 'Make a new piece inside a project', adrs: ['ADR-107'] },
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
            adrs: ['ADR-005', 'ADR-003'],
          },
          { name: 'New parts start empty', adrs: ['ADR-089'] },
          {
            name: 'Bays and shelves layout',
            detail: 'Lay the whole inside out as equal bays with the same shelves and doors.',
            adrs: ['ADR-031'],
          },
          {
            name: 'Apply a layout preset',
            detail: 'Replace the selected space with the inside of a catalog variant.',
            adrs: ['ADR-033'],
          },
          {
            name: 'Merge two touching cabinets',
            detail:
              'The two become one cabinet with a divider where they met; any other difference refuses the merge.',
            adrs: ['ADR-047'],
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
          },
          { name: 'Drawers with equal or chosen heights', adrs: ['ADR-005', 'ADR-023'] },
          { name: 'Hanging rail', adrs: ['ADR-005'] },
          { name: 'Drawers behind doors', adrs: ['ADR-005', 'ADR-006'] },
          {
            name: 'Appliance niches',
            detail:
              "An empty space sized from the appliance's drawing, checked against the opening.",
            adrs: ['ADR-036'],
          },
          {
            name: 'Fixed front with no drawer',
            detail: 'A false front, for example on a sink base.',
            adrs: ['ADR-054'],
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
          },
          { name: 'Quick counts over the 3D view', adrs: ['ADR-085'] },
          { name: 'Quick counts over the project front view', adrs: ['ADR-109'] },
        ],
      },
      {
        name: 'Selecting inside a piece',
        features: [
          {
            name: 'Select from the whole piece inwards',
            detail: 'Each tap selects one level smaller under the tap.',
            adrs: ['ADR-083'],
          },
          {
            name: 'Clear highlight of the selected space',
            detail: 'An outline round it and the rest faded, in the drawing and in 3D.',
            adrs: ['ADR-087'],
          },
          {
            name: 'Drill into a project piece',
            detail: 'Edit its spaces, size, boards and construction without leaving the project.',
            adrs: ['ADR-088', 'ADR-090'],
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
        detail: 'Whole millimetres in 10 mm steps; Esc cancels.',
        adrs: ['ADR-065'],
      },
      { name: 'Move and turn pieces in the 3D view', adrs: ['ADR-093'] },
      { name: "Change a wall unit's height by dragging in 3D", adrs: ['ADR-122'] },
      {
        name: 'Type an exact position',
        detail: 'From the left, from the back and the gap to the piece on the left.',
        adrs: ['ADR-022'],
      },
      { name: 'Turn 90° about the centre', adrs: ['ADR-069'] },
      {
        name: 'Turn by any whole degree',
        detail: 'The typed angle is hidden from the side panel for now.',
        adrs: ['ADR-121', 'ADR-160'],
      },
      {
        name: 'Move to a wall, corner, ceiling, floor or neighbour',
        detail: 'One tap slides the piece until it touches a wall or another piece.',
        adrs: ['ADR-147'],
      },
      {
        name: 'Place on the floor, on the wall or on another piece',
        detail: 'A piece on another piece follows it.',
        adrs: ['ADR-031'],
      },
      {
        name: 'Lock a piece in place',
        detail: 'Drags, automatic moves and repairs leave it alone.',
        adrs: ['ADR-095'],
      },
    ],
  },
  {
    name: 'Aligning and arranging',
    features: [
      {
        name: 'Snap to neighbours and walls',
        detail: 'A preview while dragging; the Snap switch or Alt places freely.',
        adrs: ['ADR-070'],
      },
      { name: 'Snap centre to centre', adrs: ['ADR-099'] },
      {
        name: 'Compatibility rules',
        detail: 'Checked when snapping and in the project checks.',
        adrs: ['ADR-100'],
      },
      { name: 'Align left, centre, right, back and front', adrs: ['ADR-099'] },
      { name: 'Align tops and bottoms', adrs: ['ADR-122'] },
      { name: 'Distribute evenly', adrs: ['ADR-099'] },
      { name: 'Groups align as one block', adrs: ['ADR-099', 'ADR-148', 'N154'] },
      { name: 'Duplicate a piece', adrs: ['ADR-069'] },
      {
        name: 'Mirror a piece',
        detail: 'Swaps left and right inside the piece: hinges, pedestals and handles.',
        adrs: ['ADR-069'],
      },
      { name: 'Mirror a run or a selection', adrs: ['ADR-069', 'ADR-121'] },
      {
        name: 'Linked copies',
        detail: 'Change one copy and every linked copy changes.',
        adrs: ['ADR-111'],
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
      },
      {
        name: 'Select several pieces in the front view, 3D and the piece list',
        detail: 'One Select switch shared by every view.',
        adrs: ['ADR-159'],
      },
      { name: 'Selection box on the plan', adrs: ['ADR-097'] },
      { name: 'Cycle through overlapping pieces', adrs: ['ADR-097'] },
      {
        name: 'Keep pieces as named groups',
        detail: 'Grouped pieces move together.',
        adrs: ['ADR-097', 'ADR-148'],
      },
    ],
  },
  {
    name: 'Sizing',
    features: [
      { name: 'Size of the whole piece where it is selected', adrs: ['ADR-106'] },
      { name: 'Size, boards and construction of a project piece', adrs: ['ADR-090'] },
      {
        name: 'Lock size',
        detail: "Nothing changes the piece's width, height or depth until you unlock it.",
        adrs: ['ADR-122'],
      },
      {
        name: 'Size a group as a whole',
        detail: 'Width split proportionally or equally; height and depth set on every piece.',
        adrs: ['ADR-148'],
      },
      {
        name: 'Exact whole-millimetre splits',
        detail: 'Leftover millimetres go one each to the first parts.',
        adrs: ['ADR-003'],
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
          },
          { name: 'Doubled top', adrs: ['ADR-105'] },
          { name: 'Rails instead of a full top', adrs: ['ADR-036'] },
          { name: 'Cabinet with no bottom', adrs: ['ADR-036'] },
          { name: 'Wall cabinets', adrs: ['ADR-025'] },
          {
            name: 'Corner cabinets',
            detail: 'Blind, L-shaped and diagonal corners.',
            adrs: ['ADR-025', 'ADR-040'],
          },
          { name: 'Tall cabinets', adrs: ['ADR-036'] },
        ],
      },
      {
        name: 'Doors and fronts',
        features: [
          { name: 'Hinged doors, one or a pair', adrs: ['ADR-006'] },
          { name: 'Overlay, half-overlay and inset fronts', adrs: ['ADR-024'] },
          { name: 'Exact gaps between fronts', adrs: ['ADR-006'] },
          { name: 'Sliding doors', adrs: ['ADR-037'] },
          { name: 'Lift-up and drop-down flaps', adrs: ['ADR-037'] },
          { name: 'No doors or handles inside other doors', adrs: ['N109'] },
          {
            name: 'Front-only panels',
            detail: 'An integrated appliance door or a cover panel with no carcass.',
            adrs: ['ADR-036'],
          },
        ],
      },
      {
        name: 'Drawers',
        features: [
          { name: 'Drawer boxes with runner choice and clearances', adrs: ['ADR-005', 'ADR-010'] },
        ],
      },
      {
        name: 'Kitchen runs',
        features: [
          {
            name: 'Run parts: worktop, plinth, fillers and covers',
            detail: 'Suggested along a run of base units and kept up to date.',
            adrs: ['ADR-036', 'ADR-061'],
          },
          { name: 'One plinth for the whole run', adrs: ['ADR-054'] },
          { name: 'Scribe allowance for fillers', adrs: ['ADR-054'] },
          { name: 'Worktop over chosen pieces, with overhangs', adrs: ['ADR-075'] },
          { name: 'Crown, pelmet and ceiling filler', adrs: ['ADR-075'] },
          { name: 'Handles for a whole run', adrs: ['ADR-125'] },
          { name: 'Sink cut-out in the run worktop', adrs: ['ADR-125'] },
        ],
      },
      {
        name: 'Other kinds of furniture',
        features: [
          { name: 'Desks with pedestals', adrs: ['ADR-007', 'ADR-026'] },
          { name: 'Tables, benches, stools, chairs and beds', adrs: ['ADR-038'] },
          {
            name: 'Shaped parts',
            detail: 'Raked backs, splayed legs and profiled fronts, still in whole millimetres.',
            adrs: ['ADR-040'],
          },
          {
            name: 'Loose panel sets',
            detail: 'Parts known only by their cut sizes.',
            adrs: ['ADR-041'],
          },
        ],
      },
    ],
  },
  {
    name: 'Boards and edges',
    features: [
      { name: 'Boards: name, thickness, grain and colour', adrs: ['ADR-019', 'ADR-079'] },
      { name: 'Stock sheets, trim and kerf', adrs: ['ADR-019'] },
      { name: 'Solid timber stock', adrs: ['ADR-038'] },
      { name: 'Manufacturer and type labels', adrs: ['ADR-049'] },
      { name: 'Import your own decor list (CSV)', adrs: ['ADR-049'] },
      {
        name: 'Boards and edge bands from a seller',
        detail:
          'Bundled seller products (Regency first): same thickness and decor first, you pick.',
        adrs: ['ADR-161'],
      },
      {
        name: 'Seller board pictures shipped with the app',
        detail:
          'A seller board shows its decor in 3D and the front view, without asking the seller’s site.',
        adrs: ['ADR-162'],
      },
      { name: 'A picture from your device on a board', adrs: ['ADR-048'] },
      { name: 'Matte, satin or gloss finish', adrs: ['ADR-067'] },
      {
        name: 'Edge band per board',
        detail: 'Type, thickness, width and code, on the cut list and shopping list.',
        adrs: ['ADR-077'],
      },
      { name: 'Own board for any single part', adrs: ['ADR-151'] },
      {
        name: 'Apply a board to a piece, a run, a selection or the project',
        adrs: ['ADR-055', 'ADR-097'],
      },
      {
        name: 'Style suggestions',
        detail: 'Board and handle combinations, labelled as suggestions.',
        adrs: ['ADR-123'],
      },
      {
        name: 'Project-wide settings',
        detail:
          'Carcass, front and back boards, handle, overlay and plinth height that pieces follow.',
        adrs: ['ADR-124'],
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
      },
      { name: 'Handles: bar, knob or push to open', adrs: ['ADR-024'] },
      {
        name: 'Fastener counts',
        detail: 'Counted from the model as guidance; you name the fasteners you use.',
        adrs: ['ADR-074'],
      },
      {
        name: 'Hardware you choose yourself',
        detail:
          'Sliding tracks, flap stays and appliance fixings wait for your choice, never invented.',
        adrs: ['ADR-037', 'ADR-010'],
      },
    ],
  },
  {
    name: 'Room and walls',
    features: [
      { name: 'Room size, doors, windows and obstacles', adrs: ['ADR-058'] },
      {
        name: 'Draw the floor plan',
        detail: 'Rectangle, L, U and alcove shapes, every wall length editable.',
        adrs: ['ADR-059'],
      },
      { name: 'Pipes and outlets', adrs: ['ADR-072'] },
      { name: 'Wall colour or picture', adrs: ['ADR-145'] },
      { name: 'Fit, shift and straighten a wall picture', adrs: ['ADR-146'] },
      {
        name: 'Opening clearances',
        detail: 'Doors and drawers need free space in front.',
        adrs: ['ADR-057'],
      },
      { name: 'Chair, installation and service clearances', adrs: ['ADR-073'] },
    ],
  },
  {
    name: 'Checks and problems',
    features: [
      { name: 'Problems checked on their own; errors block export', adrs: ['ADR-008'] },
      { name: 'Overlap and room checks', adrs: ['ADR-022', 'ADR-058'] },
      {
        name: 'Construction guidance',
        detail: 'Shelf span, door width, anti-tip and more, labelled as guidance.',
        adrs: ['ADR-035'],
      },
      {
        name: 'Select the problem',
        detail: 'Tapping a check selects the pieces and shows where it is.',
        adrs: ['ADR-071'],
      },
      { name: 'Previewed repairs', adrs: ['ADR-071'] },
    ],
  },
  {
    name: 'Views',
    children: [
      {
        name: 'Drawings',
        features: [
          { name: 'Compose and Build & Preview modes', adrs: ['ADR-079', 'ADR-080'] },
          { name: 'Front drawing with sizes', adrs: ['ADR-014'] },
          { name: 'Project plan and room front view with sizes', adrs: ['ADR-022'] },
          { name: '2D, 3D or both side by side', adrs: ['ADR-081', 'ADR-144'] },
        ],
      },
      {
        name: '3D view',
        features: [
          { name: '3D preview, select by click', adrs: ['ADR-014'] },
          { name: 'Exploded 3D view', adrs: ['ADR-014'] },
          {
            name: 'Realistic look',
            detail: 'Board finishes, room light and soft shadows.',
            adrs: ['ADR-067'],
          },
          {
            name: 'Render a photo-quality picture',
            detail: 'Saved as PNG, on a laptop.',
            adrs: ['ADR-068'],
          },
          { name: 'Section view and Isolate', adrs: ['ADR-122'] },
          { name: 'Draws only when something changes', adrs: ['ADR-121'] },
        ],
      },
      {
        name: 'Imported 3D models',
        features: [
          {
            name: 'Import GLB and glTF models',
            detail: 'Display-only items, checked against the pieces and the room.',
            adrs: ['ADR-076'],
          },
          { name: 'Width, height and depth of a model', adrs: ['ADR-102'] },
        ],
      },
    ],
  },
  {
    name: 'Output',
    children: [
      {
        name: 'Cut list',
        features: [
          { name: 'Cut list with finished sizes and edge-band marks', adrs: ['ADR-009'] },
          { name: 'Grouped parts, area and band metres', adrs: ['ADR-009'] },
          { name: 'Parts CSV', adrs: ['ADR-020'] },
          { name: 'Lengths list for solid stock', adrs: ['ADR-038'] },
        ],
      },
      {
        name: 'Sheets',
        features: [
          {
            name: 'Sheet layouts',
            detail: 'Parts nested on your stock sheets, checked by an independent validator.',
            adrs: ['ADR-018'],
          },
        ],
      },
      {
        name: 'Shopping and costs',
        features: [
          {
            name: 'Shopping list',
            detail: 'Boards, banding, hardware, run parts and what is still to choose.',
            adrs: ['ADR-064'],
          },
          { name: 'Shopping list CSV', adrs: ['ADR-064'] },
          { name: 'Cost estimate from your price list', adrs: ['ADR-062'] },
          {
            name: 'Seller products for hardware and seller prices',
            detail: 'Your own price wins; otherwise the seller price, with its date.',
            adrs: ['ADR-161'],
          },
        ],
      },
      {
        name: 'Printing and files',
        features: [
          { name: 'Print sheets or save as PDF', adrs: ['ADR-020'] },
          { name: 'Download drawings as SVG', adrs: ['ADR-020'] },
          {
            name: 'Fusion 360 script',
            detail: 'Rebuilds the model as named solid boxes; not verified inside Fusion.',
            adrs: ['ADR-021'],
          },
          {
            name: 'Review pack for a professional',
            detail: 'Summary, parts CSV, drawings and the project file in one .zip.',
            adrs: ['ADR-121'],
          },
        ],
      },
    ],
  },
  {
    name: 'Projects',
    features: [
      { name: 'Several pieces in one room, with combined lists', adrs: ['ADR-022'] },
      {
        name: 'Projects page',
        detail: 'Open, duplicate and delete projects and single pieces.',
        adrs: ['ADR-078'],
      },
      { name: 'Add a piece from a list with pictures', adrs: ['ADR-094'] },
      { name: 'Tap the plan to place', adrs: ['ADR-056'] },
      { name: 'Drag a catalog item onto the plan', adrs: ['ADR-094'] },
      { name: 'Insert a project template', adrs: ['ADR-123'] },
      {
        name: 'Replace a piece with a compatible one',
        detail: 'Your own changes are kept where the new piece has the same setting.',
        adrs: ['ADR-098', 'ADR-124'],
      },
      { name: 'Template updated notices', adrs: ['ADR-096'] },
      {
        name: 'Template references',
        detail: 'A catalog piece keeps only what differs from its template.',
        adrs: ['ADR-124'],
      },
      { name: 'Undo and redo with named steps', adrs: ['ADR-051', 'ADR-123'] },
      { name: 'Edit history', adrs: ['ADR-123'] },
      { name: 'Version history', adrs: ['ADR-123'] },
      { name: 'Save as a project template', adrs: ['ADR-060'] },
      {
        name: 'Project variables and formulas',
        detail: 'Bind a size, a division or a position to a named value; change it once.',
        adrs: ['ADR-163'],
      },
      {
        name: 'Value sets',
        detail:
          'Duplicate every bound piece with other values, with the room; save a set as a project.',
        adrs: ['ADR-164'],
      },
      {
        name: 'Side panel ordered by use',
        detail:
          'Add a piece at the top, previous and next piece, one toolbar, a More actions menu and Delete to remove.',
        adrs: ['ADR-160'],
      },
      {
        name: 'Quick actions on the phone sheet',
        detail: 'Edit, duplicate and turn the selected piece with the sheet closed.',
        adrs: ['ADR-160'],
      },
    ],
  },
  {
    name: 'Catalog and templates',
    features: [
      { name: 'Browse by room or type, with search', adrs: ['ADR-032'] },
      { name: '1–5 variants per family', adrs: ['ADR-033'] },
      { name: 'Catalog pictures', adrs: ['ADR-042'] },
      { name: 'Compact cards with More', adrs: ['ADR-118', 'ADR-119'] },
      {
        name: 'Edit templates on this device',
        detail: 'Shipped templates never change; reset or compare with the shipped one.',
        adrs: ['ADR-034'],
      },
      { name: 'Save a design as a template', adrs: ['ADR-034'] },
      { name: 'Save a project piece to the catalog', adrs: ['ADR-107'] },
      { name: 'Catalog origin kept on copies', adrs: ['ADR-028'] },
      { name: 'Reference entries for upholstered pieces', adrs: ['ADR-039'] },
    ],
  },
  {
    name: 'Saving, backup and sharing',
    features: [
      { name: 'Autosave on this device', adrs: ['ADR-012'] },
      { name: 'Works offline, as an installed app', adrs: ['ADR-002', 'ADR-126'] },
      {
        name: 'Import and export files',
        detail: 'Designs and projects, with their pictures and 3D models.',
        adrs: ['ADR-011', 'ADR-078'],
      },
      { name: 'Design codes and links', adrs: ['ADR-124'] },
      { name: 'Keep saved data persistent', adrs: ['ADR-133'] },
      { name: 'Back up to a folder', adrs: ['ADR-133'] },
      { name: 'Backup reminder', adrs: ['ADR-141'] },
      { name: 'Only-on-this-device notice', adrs: ['ADR-140'] },
      { name: 'Clean up unused pictures', adrs: ['ADR-048', 'ADR-078'] },
      { name: 'Share links', adrs: ['ADR-132', 'ADR-138'] },
      { name: 'Preview a shared item', adrs: ['ADR-143'] },
    ],
  },
  {
    name: 'Account',
    features: [
      { name: 'Sign in with Google', adrs: ['ADR-135'] },
      { name: 'Email and password, forgot and reset', adrs: ['ADR-136'] },
      { name: 'Stay signed in', adrs: ['ADR-134'] },
      { name: 'Save pieces and templates to your account', adrs: ['ADR-128', 'ADR-137'] },
      { name: 'Sync status', adrs: ['ADR-129', 'ADR-139'] },
      { name: 'Conflicts never lose work', adrs: ['ADR-129'] },
      { name: 'Several accounts on one device', adrs: ['ADR-142'] },
      { name: 'Privacy notice, data export and account deletion', adrs: ['ADR-130'] },
    ],
  },
  {
    name: 'Language',
    features: [
      { name: 'English or Russian', adrs: ['ADR-153'] },
      { name: 'Every screen translated', adrs: ['ADR-154'] },
      { name: 'Catalog, wizard and research translated', adrs: ['ADR-155'] },
      { name: 'Problem messages translated', adrs: ['ADR-156'] },
      { name: 'Print language: Romanian, Russian or English', adrs: ['ADR-157'] },
    ],
  },
  {
    name: 'Information',
    features: [
      { name: 'Information and guides page', adrs: ['ADR-158'] },
      { name: 'Feature Research', adrs: ['ADR-043', 'ADR-092', 'ADR-110'] },
      { name: 'Gaps page', adrs: ['ADR-101'] },
      { name: 'Info buttons', adrs: ['ADR-080', 'ADR-113'] },
      { name: 'Light and dark themes', adrs: ['ADR-030'] },
    ],
  },
];
