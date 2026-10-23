import { frameDefaults } from '../design'
import { bed, cab, desk, door, drawers, empty, even, fr, frame, legacy, mm, shelves, splitX, splitY } from './helpers'
import type { CatalogFamily } from './types'

const TABLE_DIMS = { min: [300, 300, 300] as [number, number, number], max: [3000, 1100, 1400] as [number, number, number] }
const SEAT_DIMS = { min: [300, 350, 300] as [number, number, number], max: [2600, 1200, 1100] as [number, number, number] }
const BED_DIMS = { min: [500, 300, 900] as [number, number, number], max: [2200, 2000, 2300] as [number, number, number] }
const chair = frameDefaults('chair')
const withBack = (seatHeight: number, style: 'slats' | 'panel' = 'panel') => ({ seatHeight, style, count: 4, railHeight: 60, angleDeg: 8 })

export const tables: CatalogFamily[] = [
  {
    id: 'desk', name: 'Desk', nameRo: 'Birou', aliases: ['writing desk', 'birou'], function: 'tables', rooms: ['office', 'bedroom', 'kids'], root: 'desk', support: 'ready',
    structure: 'Worktop on panel gables or drawer pedestals (cabinets), with a modesty panel at the back.',
    configurations: ['Gables, pedestal left / right / both', 'Pedestal spaces edited like cabinets', 'Modesty panel'],
    dims: TABLE_DIMS, catalogVersion: 1,
    variants: [
      { id: 'desk-pedestal', name: 'Pedestal left', summary: '1400 × 750 × 700', kind: 'interior', requires: [], create: legacy('desk-pedestal') },
      { id: 'desk-pedestal-right', name: 'Pedestal right', summary: 'Drawers on the right', kind: 'interior', requires: [], create: () => desk('Desk, pedestal right', { support: 'pedestal-right' }) },
      { id: 'desk-two-pedestals', name: 'Two pedestals', summary: '1600 wide', kind: 'interior', requires: [], create: () => desk('Desk, two pedestals', { support: 'two-pedestals', width: 1600 }) },
      { id: 'desk-gables', name: 'Panel desk', summary: '1200 × 750 × 600 on two gables', kind: 'interior', requires: [], create: legacy('desk-gables') },
    ],
  },
  {
    id: 'nightstand', name: 'Nightstand', nameRo: 'Noptieră', aliases: ['bedside table', 'noptiera'], function: 'tables', rooms: ['bedroom'], root: 'cabinet', support: 'ready',
    structure: 'Small carcass on a low plinth with drawers, an open niche or a door.',
    configurations: ['Drawers 0–3', 'Open niche', 'Door'],
    dims: { min: [300, 300, 250], max: [700, 900, 600] }, catalogVersion: 1,
    variants: [
      { id: 'nightstand-drawer-shelf', name: 'Drawer + open shelf', summary: '450 × 600 × 400', kind: 'interior', requires: [], create: () => cab('Nightstand', { width: 450, height: 600, depth: 400, plinthHeight: 60 }, splitY([mm(150), fr()], [drawers(1), empty()])) },
      { id: 'nightstand-2-drawers', name: '2 drawers', summary: 'Two equal drawers', kind: 'interior', requires: [], create: () => cab('Nightstand, 2 drawers', { width: 450, height: 600, depth: 400, plinthHeight: 60 }, drawers(2)) },
      { id: 'nightstand-door', name: 'Door + drawer', summary: 'Drawer over a door', kind: 'interior', requires: [], create: () => cab('Nightstand, door', { width: 450, height: 600, depth: 400, plinthHeight: 60 }, splitY([mm(150), fr()], [drawers(1), shelves(1, door(1))])) },
    ],
  },
  {
    id: 'coffee-table', name: 'Coffee table', nameRo: 'Măsuță de cafea', aliases: ['low table', 'masuta'], function: 'tables', rooms: ['living'], root: 'frame', support: 'ready',
    structure: 'Low top on four legs with rails, or a low box; often a lower shelf.',
    configurations: ['Box or legs', 'Lower shelf', 'Height about the sofa seat'],
    dims: TABLE_DIMS, catalogVersion: 1,
    variants: [
      { id: 'coffee-box', name: 'Low box with open shelf', summary: '1100 × 420 × 600', kind: 'interior', requires: [], create: () => cab('Coffee table, box', { width: 1100, height: 420, depth: 600, plinthHeight: 60, back: 'none', bodyMaterialId: 'pal18oak' }, splitX(even(2), [shelves(1), shelves(1)])) },
      { id: 'coffee-legs', name: 'Legs + top', summary: 'Four legs and rails', kind: 'construction', requires: ['root:frame'], create: () => frame('Coffee table', 'table', { width: 1100, depth: 600, height: 420, leg: { w: 45, d: 45 }, apron: { height: 70, thickness: 22 } }) },
      { id: 'coffee-legs-shelf', name: 'Legs + lower shelf', summary: '1000 wide, shelf 150 above the floor', kind: 'construction', requires: ['root:frame'], create: () => frame('Coffee table with shelf', 'table', { width: 1000, depth: 600, height: 420, leg: { w: 45, d: 45 }, apron: { height: 70, thickness: 22 }, shelf: { height: 150 } }) },
    ],
  },
  {
    id: 'end-table', name: 'End table', nameRo: 'Măsuță laterală', aliases: ['side table'], function: 'tables', rooms: ['living', 'bedroom'], root: 'frame', support: 'ready',
    structure: 'Small top at sofa-arm height on legs or as a box, with a drawer or shelf.',
    configurations: ['Box or legs', 'Drawer', 'Shelf'],
    dims: { min: [300, 300, 300], max: [800, 800, 800] }, catalogVersion: 1,
    variants: [
      { id: 'end-box', name: 'Box with drawer', summary: '450 × 550 × 450', kind: 'interior', requires: [], create: () => cab('End table', { width: 450, height: 550, depth: 450, plinthHeight: 40, bodyMaterialId: 'pal18oak' }, splitY([mm(150), fr()], [drawers(1), empty()])) },
      { id: 'end-legs-shelf', name: 'Legs + shelf', summary: 'Shelf 180 above the floor', kind: 'construction', requires: ['root:frame'], create: () => frame('End table on legs', 'table', { width: 450, depth: 450, height: 550, leg: { w: 40, d: 40 }, apron: { height: 60, thickness: 22 }, shelf: { height: 180 } }) },
    ],
  },
  {
    id: 'dining-table', name: 'Dining table', nameRo: 'Masă de dining', aliases: ['kitchen table', 'masa'], function: 'tables', rooms: ['dining', 'kitchen'], root: 'frame', support: 'ready',
    structure: 'Top on four legs joined by rails under the top; about 600 mm of length per seat.',
    configurations: ['Length per seats', 'Leg section and inset', 'Rail height', 'H-stretcher'],
    dims: TABLE_DIMS, catalogVersion: 1,
    variants: [
      { id: 'dining-4', name: '4 seats', summary: '1200 × 750 × 800', kind: 'construction', requires: ['root:frame'], create: () => frame('Dining table, 4 seats', 'table', { width: 1200, depth: 800 }) },
      { id: 'dining-6', name: '6 seats', summary: '1600 × 750 × 900', kind: 'construction', requires: ['root:frame'], create: () => frame('Dining table, 6 seats', 'table', { width: 1600, depth: 900 }) },
      { id: 'dining-h-stretcher', name: 'With H-stretcher', summary: 'Stretchers low between the legs', kind: 'construction', requires: ['root:frame'], create: () => frame('Dining table, H-stretcher', 'table', { width: 1600, depth: 900, stretchers: 'h', stretcherHeight: 150 }) },
    ],
  },
  {
    id: 'patio-table', name: 'Patio table', nameRo: 'Masă de grădină', aliases: ['garden table', 'outdoor table'], function: 'tables', rooms: ['outdoor'], root: 'frame', support: 'ready',
    structure: 'Slatted top with drainage gaps on legs and rails, in outdoor timber.',
    configurations: ['Slat width and gap', 'Outdoor timber', 'Stretchers'],
    dims: TABLE_DIMS, catalogVersion: 1,
    variants: [
      { id: 'patio-slats', name: 'Slatted top', summary: '1500 × 740 × 900, larch', kind: 'construction', requires: ['root:frame'], create: () => frame('Patio table', 'table', { width: 1500, depth: 900, height: 740, top: 'slats', solidMaterialId: 'larch', slats: { width: 90, thickness: 25, gap: 8 } }) },
      { id: 'patio-slats-stretcher', name: 'Slatted top, H-stretcher', summary: 'Stiffer for uneven ground', kind: 'construction', requires: ['root:frame'], create: () => frame('Patio table, stretchers', 'table', { width: 1500, depth: 900, height: 740, top: 'slats', solidMaterialId: 'larch', slats: { width: 90, thickness: 25, gap: 8 }, stretchers: 'h' }) },
    ],
  },
]

const UPHOLSTERY = 'upholstery (foam, webbing or springs, fabric) — bought, not cut'

export const seating: CatalogFamily[] = [
  {
    id: 'chair', name: 'Chair', nameRo: 'Scaun', aliases: ['side chair', 'scaun'], function: 'seating', rooms: ['dining', 'office', 'bedroom'], root: 'frame', support: 'ready',
    structure: 'Four legs and seat rails; the back posts carry on up to a vertical back of slats or a panel.',
    configurations: ['Seat height 430–480', 'Back of slats or a panel', 'Stretchers'],
    dims: SEAT_DIMS, catalogVersion: 1,
    variants: [
      { id: 'chair-slats', name: 'Vertical slatted back', summary: '450 × 880 × 500, seat 460', kind: 'construction', requires: ['root:frame'], create: () => frame('Chair', 'chair') },
      { id: 'chair-panel', name: 'Panel back', summary: 'One panel between the back posts', kind: 'construction', requires: ['root:frame'], create: () => frame('Chair, panel back', 'chair', { back: { ...chair.back!, style: 'panel' } }) },
    ],
  },
  {
    id: 'dining-chair', name: 'Dining chair', nameRo: 'Scaun de dining', aliases: ['carver'], function: 'seating', rooms: ['dining'], root: 'frame', support: 'ready',
    structure: 'As a chair, sized for a 720–760 mm table.',
    configurations: ['As chair', 'Arms'],
    dims: SEAT_DIMS, catalogVersion: 1,
    variants: [
      { id: 'dining-chair-side', name: 'Side chair', summary: '460 × 880 × 520, seat 460', kind: 'construction', requires: ['root:frame'], create: () => frame('Dining chair', 'chair', { width: 460, depth: 520 }) },
      { id: 'dining-chair-arms', name: 'With arms', summary: 'Carver with arm rests', kind: 'construction', requires: ['root:frame', 'frame:arms'] },
    ],
  },
  {
    id: 'stool', name: 'Stool', nameRo: 'Taburet', aliases: ['bar stool', 'counter stool', 'taburet'], function: 'seating', rooms: ['kitchen', 'dining'], root: 'frame', support: 'ready',
    structure: 'Seat on four legs with rails and a footrest ring of stretchers.',
    configurations: ['Low, counter or bar height', 'Footrest height'],
    dims: SEAT_DIMS, catalogVersion: 1,
    variants: [
      { id: 'stool-low', name: 'Low 450', summary: 'Footrest 150', kind: 'construction', requires: ['root:frame'], create: () => frame('Low stool', 'stool', { height: 450, stretcherHeight: 150 }) },
      { id: 'stool-counter', name: 'Counter 650', summary: 'For a 900 worktop', kind: 'construction', requires: ['root:frame'], create: () => frame('Counter stool', 'stool') },
      { id: 'stool-bar', name: 'Bar 760', summary: 'For a 1050 bar top', kind: 'construction', requires: ['root:frame'], create: () => frame('Bar stool', 'stool', { height: 760, stretcherHeight: 300, width: 400, depth: 400 }) },
    ],
  },
  {
    id: 'bench', name: 'Bench', nameRo: 'Bancă', aliases: ['dining bench', 'hall bench', 'banca'], function: 'seating', rooms: ['dining', 'hallway', 'bedroom'], root: 'frame', support: 'ready',
    structure: 'Long seat on legs and rails, or a low box with cubbies.',
    configurations: ['Legs or box', 'Storage under', 'Lid'],
    dims: SEAT_DIMS, catalogVersion: 1,
    variants: [
      { id: 'bench-cubbies', name: 'Storage bench, open cubbies', summary: '1200 × 450 × 380', kind: 'interior', requires: [], create: () => cab('Storage bench', { width: 1200, height: 450, depth: 380, plinthHeight: 40, bodyMaterialId: 'pal18oak' }, splitX(even(3), [empty(), empty(), empty()])) },
      { id: 'bench-legs', name: '4 legs', summary: 'Seat on rails', kind: 'construction', requires: ['root:frame'], create: () => frame('Bench', 'bench') },
      { id: 'bench-lid', name: 'Lift lid', summary: 'Box with a hinged seat', kind: 'construction', requires: ['front:lid', 'hardware:user'] },
    ],
  },
  {
    id: 'garden-bench', name: 'Garden bench', nameRo: 'Bancă de grădină', aliases: ['outdoor bench'], function: 'seating', rooms: ['outdoor'], root: 'frame', support: 'ready',
    structure: 'Slatted seat with drainage gaps on legs and rails, outdoor timber.',
    configurations: ['Slat width and gap', 'Back and arms'],
    dims: SEAT_DIMS, catalogVersion: 1,
    variants: [
      { id: 'garden-bench-slats', name: 'Backless slatted', summary: '1500 × 450 × 450, larch', kind: 'construction', requires: ['root:frame'], create: () => frame('Garden bench', 'bench', { width: 1500, depth: 450, top: 'slats', solidMaterialId: 'larch', slats: { width: 70, thickness: 25, gap: 8 } }) },
      { id: 'garden-bench-back', name: 'With back and arms', summary: '1500 × 900 × 620, back raked 15°, arm rests at 650', kind: 'construction', requires: ['root:frame', 'shape'],
        create: () => frame('Garden bench with back', 'bench', { width: 1500, depth: 620, height: 900, top: 'slats', solidMaterialId: 'larch', slats: { width: 70, thickness: 25, gap: 8 },
          back: { seatHeight: 450, style: 'slats', count: 6, railHeight: 70, angleDeg: 15 }, arms: { height: 650 } }) },
    ],
  },
  {
    id: 'armchair', name: 'Armchair', nameRo: 'Fotoliu', aliases: ['easy chair', 'fotoliu'], function: 'seating', rooms: ['living', 'bedroom'], root: 'frame', support: 'ready',
    structure: 'Upholstered: base frame of rails, seat deck on webbing or springs, back frame, two arm frames, legs, cushions.',
    configurations: ['Arm style and width', 'Seat depth 500–550, seat height 400–450 (typical)', 'Cushions'],
    dims: SEAT_DIMS, catalogVersion: 1,
    variants: [
      { id: 'armchair-frame', name: 'Frame only', summary: 'Straight frame, no upholstery', kind: 'construction', requires: ['root:frame', 'hardware:user'], hardware: UPHOLSTERY,
        create: () => frame('Armchair frame', 'bench', { width: 800, depth: 800, height: 850, back: withBack(420), apron: { height: 90, thickness: 22 } }) },
    ],
  },
  {
    id: 'accent-chair', name: 'Accent chair', nameRo: 'Fotoliu decorativ', aliases: ['occasional chair'], function: 'seating', rooms: ['living', 'bedroom'], root: 'frame', support: 'ready',
    structure: 'Smaller upholstered chair, armless or with slim arms, on exposed legs.',
    configurations: ['Armless or slim arms', 'Exposed legs'],
    dims: SEAT_DIMS, catalogVersion: 1,
    variants: [
      { id: 'accent-chair-frame', name: 'Frame only', summary: 'Straight frame, no upholstery', kind: 'construction', requires: ['root:frame', 'hardware:user'], hardware: UPHOLSTERY,
        create: () => frame('Accent chair frame', 'bench', { width: 700, depth: 750, height: 800, back: withBack(420), apron: { height: 80, thickness: 22 } }) },
    ],
  },
  {
    id: 'sofa', name: 'Sofa', nameRo: 'Canapea', aliases: ['couch', 'settee', 'canapea'], function: 'seating', rooms: ['living'], root: 'frame', support: 'ready',
    structure: 'Upholstered: hardwood or ply rails, seat suspension, back frame, arms, legs, cushions; about 600–700 mm per seat.',
    configurations: ['Seats 2–4', 'Arm style', 'Cushions', 'Legs'],
    dims: SEAT_DIMS, catalogVersion: 1,
    variants: [
      { id: 'sofa-2-frame', name: '2-seat frame only', summary: '1600 wide', kind: 'construction', requires: ['root:frame', 'hardware:user'], hardware: UPHOLSTERY,
        create: () => frame('Sofa frame, 2 seats', 'bench', { width: 1600, depth: 850, height: 850, back: withBack(420), apron: { height: 100, thickness: 25 }, leg: { w: 60, d: 60 } }) },
      { id: 'sofa-3-frame', name: '3-seat frame only', summary: '2100 wide', kind: 'construction', requires: ['root:frame', 'hardware:user'], hardware: UPHOLSTERY,
        create: () => frame('Sofa frame, 3 seats', 'bench', { width: 2100, depth: 850, height: 850, back: withBack(420), apron: { height: 100, thickness: 25 }, leg: { w: 60, d: 60 } }) },
    ],
  },
  {
    id: 'sectional', name: 'Sectional', nameRo: 'Colțar', aliases: ['corner sofa', 'coltar'], function: 'seating', rooms: ['living'], root: 'frame', support: 'ready',
    structure: 'Sofa modules (arm, armless, corner, chaise) joined by brackets.',
    configurations: ['L, U or chaise layout', 'Module list'],
    dims: SEAT_DIMS, catalogVersion: 1,
    variants: [
      { id: 'sectional-main', name: 'Main section frame', summary: '2400 wide with a back; join modules with connector brackets', kind: 'construction', requires: ['root:frame', 'hardware:user'], hardware: `${UPHOLSTERY}; module connector brackets`,
        create: () => frame('Sectional main section frame', 'bench', { width: 2400, depth: 900, height: 850, back: withBack(420), apron: { height: 100, thickness: 25 }, leg: { w: 60, d: 60 } }) },
      { id: 'sectional-chaise', name: 'Chaise section frame', summary: '900 × 1600, no back', kind: 'construction', requires: ['root:frame', 'hardware:user'], hardware: `${UPHOLSTERY}; module connector brackets`,
        create: () => frame('Sectional chaise frame', 'bench', { width: 900, depth: 1600, height: 420, apron: { height: 100, thickness: 25 }, leg: { w: 60, d: 60 } }) },
      { id: 'sectional-l-frame', name: 'L-shape as one piece', summary: 'Modules joined at a corner', kind: 'construction', requires: ['root:frame', 'frame:modules'] },
    ],
  },
  {
    id: 'recliner', name: 'Recliner', nameRo: 'Fotoliu recliner', aliases: ['reclining chair'], function: 'seating', rooms: ['living'], root: 'frame', support: 'ready',
    structure: 'Upholstered frame built around a bought reclining mechanism that sets its inside sizes.',
    configurations: ['Mechanism', 'Wall clearance'],
    dims: SEAT_DIMS, catalogVersion: 1,
    variants: [
      { id: 'recliner-shell', name: 'Fixed frame shell', summary: '900 × 1000 × 950, seat 470', kind: 'construction', requires: ['root:frame', 'hardware:user'], hardware: `reclining mechanism (it sets the frame's inside sizes); ${UPHOLSTERY}`,
        create: () => frame('Recliner frame shell', 'bench', { width: 900, depth: 950, height: 1000, back: withBack(470), apron: { height: 110, thickness: 25 }, leg: { w: 60, d: 60 } }) },
      { id: 'recliner-reference', name: 'Reclining frame', summary: 'Back 100° / 120° / 150°, footrest; shown upright', kind: 'construction', requires: ['root:frame', 'shape', 'hardware:user'],
        hardware: `reclining mechanism with footrest linkage (it sets the positions and the frame's inside sizes); ${UPHOLSTERY}`,
        create: () => frame('Reclining frame', 'bench', { width: 900, depth: 950, height: 1000, back: withBack(470), apron: { height: 110, thickness: 25 }, leg: { w: 60, d: 60 },
          recline: { positions: [100, 120, 150], at: 0, footrest: { length: 380, angles: [0, 45, 90] } } }) },
    ],
  },
  {
    id: 'office-chair', name: 'Ergonomic office chair', nameRo: 'Scaun ergonomic', aliases: ['task chair'], function: 'seating', rooms: ['office'], root: 'frame', support: 'ready',
    structure: 'Bought assembly: gas lift, mechanism, five-star base, adjustable seat, back and arms.',
    configurations: ['Seat height range', 'Arms', 'Headrest'],
    dims: SEAT_DIMS, catalogVersion: 1,
    variants: [
      { id: 'office-chair-frame', name: 'Fixed-height desk chair frame', summary: 'Seat 470, panel back', kind: 'construction', requires: ['root:frame', 'hardware:user'], hardware: 'gas lift, synchro mechanism and 5-star base are bought; this frame has fixed legs instead',
        create: () => frame('Desk chair frame', 'chair', { width: 480, depth: 500, height: 950, back: { ...chair.back!, seatHeight: 470, style: 'panel' } }) },
      { id: 'office-chair-reference', name: 'Ergonomic chair (bought base)', summary: 'Seat and raked back boards on a bought gas lift, mechanism and 5-star base', kind: 'construction', requires: ['root:frame', 'shape', 'hardware:user'],
        hardware: 'gas lift, synchro mechanism, 5-star base and back support bar are bought',
        create: () => frame('Ergonomic chair boards', 'chair', { width: 480, depth: 460, height: 1000, base: 'bought', back: { ...chair.back!, seatHeight: 480, style: 'panel', angleDeg: 8 } }) },
    ],
  },
  {
    id: 'outdoor-lounger', name: 'Outdoor lounger', nameRo: 'Șezlong', aliases: ['sun lounger', 'sezlong'], function: 'seating', rooms: ['outdoor'], root: 'frame', support: 'ready',
    structure: 'Two stringers, slats, a hinged backrest on a prop with several positions, legs or wheels.',
    configurations: ['Backrest positions', 'Wheels'],
    dims: SEAT_DIMS, catalogVersion: 1,
    variants: [
      { id: 'lounger-flat', name: 'Flat lounger frame', summary: '1950 × 320 × 650, slatted, larch', kind: 'construction', requires: ['root:frame', 'hardware:user'], hardware: 'adjustable backrest prop and wheels',
        create: () => frame('Flat lounger', 'bench', { width: 1950, depth: 650, height: 320, top: 'slats', solidMaterialId: 'larch', slats: { width: 70, thickness: 22, gap: 10 }, legInset: 40, apron: { height: 90, thickness: 25 } }) },
      { id: 'lounger-reference', name: 'Adjustable backrest', summary: 'Backrest 100° / 120° / 150° on a prop; shown at 150°', kind: 'construction', requires: ['root:frame', 'shape', 'hardware:user'], hardware: 'backrest hinges and prop',
        create: () => frame('Lounger with backrest', 'bench', { width: 1950, depth: 650, height: 320, top: 'slats', solidMaterialId: 'larch', slats: { width: 70, thickness: 22, gap: 10 }, legInset: 40, apron: { height: 90, thickness: 25 },
          backrest: { length: 650, positions: [100, 120, 150], at: 2 } }) },
    ],
  },
]

export const sleeping: CatalogFamily[] = [
  {
    id: 'bed', name: 'Bed', nameRo: 'Pat', aliases: ['bed frame', 'pat'], function: 'sleeping', rooms: ['bedroom'], root: 'frame', support: 'ready',
    structure: 'Headboard and footboard carry two side rails; slats on ledgers; a centre rail on legs from 1400 mm wide.',
    configurations: ['Mattress size (typical sizes, check yours)', 'Slat width and gap', 'Headboard, footboard', 'Drawers under'],
    dims: BED_DIMS, catalogVersion: 1,
    variants: [
      { id: 'bed-platform', name: 'Platform with slats', summary: 'For a 160 × 200 mattress, headboard only', kind: 'construction', requires: ['root:frame'], create: () => bed('Bed', {}) },
      { id: 'bed-foot', name: 'Headboard + footboard', summary: 'Footboard 500 high', kind: 'construction', requires: ['root:frame'], create: () => bed('Bed with footboard', { footboardHeight: 500 }) },
      { id: 'bed-drawers', name: '2 drawers under', summary: 'Drawers in the frame', kind: 'construction', requires: ['root:frame', 'frame:under-storage'] },
    ],
  },
  {
    id: 'daybed', name: 'Daybed', nameRo: 'Pat de zi', aliases: ['day bed'], function: 'sleeping', rooms: ['living', 'bedroom'], root: 'frame', support: 'ready',
    structure: 'Single bed with ends and a back panel along one side, so it sits like a sofa.',
    configurations: ['Single mattress', 'Back and end heights', 'Trundle'],
    dims: BED_DIMS, catalogVersion: 1,
    variants: [
      { id: 'daybed-three-sided', name: 'Three-sided', summary: 'For a 90 × 200 mattress', kind: 'construction', requires: ['root:frame'], create: () => bed('Daybed', { mattress: { w: 900, l: 2000 }, headboardHeight: 800, footboardHeight: 800, sidePanelHeight: 800, deckHeight: 400 }) },
      { id: 'daybed-trundle', name: 'With trundle drawer', summary: 'Second mattress below', kind: 'construction', requires: ['root:frame', 'frame:under-storage'] },
    ],
  },
  {
    id: 'futon', name: 'Futon', nameRo: 'Futon', aliases: ['sofa bed frame'], function: 'sleeping', rooms: ['living', 'bedroom', 'office'], root: 'frame', support: 'ready',
    structure: 'Low slatted deck on a frame; the fold mechanism is bought.',
    configurations: ['Mattress size', 'Fold mechanism'],
    dims: BED_DIMS, catalogVersion: 1,
    variants: [
      { id: 'futon-frame', name: 'Bi-fold frame', summary: 'For a 140 × 200 futon', kind: 'construction', requires: ['root:frame', 'hardware:user'], hardware: 'futon fold mechanism',
        create: () => bed('Futon frame', { mattress: { w: 1400, l: 2000 }, deckHeight: 300, railHeight: 160, headboardHeight: 600 }) },
    ],
  },
  {
    id: 'bunk-bed', name: 'Bunk bed', nameRo: 'Pat supraetajat', aliases: ['bunk'], function: 'sleeping', rooms: ['kids', 'bedroom'], root: 'frame', support: 'safety',
    structure: 'Two decks between tall ends, guard rails all round the top deck, a ladder.',
    configurations: ['Tier gap', 'Ladder side', 'Guard rail height', 'Trundle'],
    dims: BED_DIMS, catalogVersion: 1,
    variants: [
      { id: 'bunk-standard', name: 'Standard', summary: 'Two 90 × 200 mattresses', kind: 'construction', requires: ['root:frame', 'safety:user-confirmed'],
        create: () => bed('Bunk bed', { mattress: { w: 900, l: 2000 }, tierGap: 1000, guardHeight: 300 }) },
      { id: 'bunk-trundle', name: 'With trundle', summary: 'Third bed below', kind: 'construction', requires: ['root:frame', 'frame:under-storage', 'safety:user-confirmed'] },
    ],
  },
  {
    id: 'cradle', name: 'Cradle', nameRo: 'Leagăn', aliases: ['crib', 'cot', 'patut'], function: 'sleeping', rooms: ['bedroom', 'kids'], root: 'frame', support: 'safety',
    structure: 'Small bed with tall ends and closed sides on a fixed stand.',
    configurations: ['Mattress size', 'Side height'],
    dims: BED_DIMS, catalogVersion: 1,
    variants: [
      { id: 'cradle-fixed', name: 'Fixed stand', summary: 'For a 40 × 80 mattress', kind: 'construction', requires: ['root:frame', 'safety:user-confirmed'],
        create: () => bed('Cradle', { mattress: { w: 400, l: 800 }, deckHeight: 600, railHeight: 400, headboardHeight: 950, footboardHeight: 950, clearance: 5 }, { slats: { width: 60, thickness: 18, gap: 30 } }) },
    ],
  },
]
