import { base, corner, door, drawers, empty, even, flap, fr, legacy, mm, panel, shelves, splitY, tall, wallUnit } from './helpers'
import type { CatalogFamily } from './types'

/** Kitchen: 720 carcass + 100 plinth, 560 deep; walls 320 deep; tall to 2400 (ADR-0036 defaults, typical values to confirm). */
const GRID = [150, 200, 300, 400, 450, 500, 600, 800, 900, 1000, 1200]
const BASE_DIMS = { min: [150, 600, 300] as [number, number, number], max: [1200, 1000, 700] as [number, number, number], widthGrid: GRID }

export const kitchen: CatalogFamily[] = [
  {
    id: 'base-doors', name: 'Base cabinet, doors', nameRo: 'Corp bază cu uși', aliases: ['base unit', 'door base', 'corp jos'], function: 'kitchen', rooms: ['kitchen'], root: 'cabinet', support: 'ready',
    structure: 'Sides, bottom and top between the sides, back, plinth; shelves behind one or two hinged doors.',
    configurations: ['Width on the kitchen grid (free size allowed)', '1 door up to 600 mm, 2 doors above', 'Shelves 0–3, fixed or adjustable', 'Inner drawers behind the door'],
    dims: BASE_DIMS, catalogVersion: 1,
    variants: [
      { id: 'base-door', name: '1 door + shelf', summary: '600 wide, one shelf', kind: 'interior', requires: [], create: () => base('Base cabinet, 1 door', {}, shelves(1, door(1))) },
      { id: 'base-2-doors', name: '2 doors + shelf', summary: '800 wide, a pair of doors', kind: 'interior', requires: [], create: () => base('Base cabinet, 2 doors', { width: 800 }, shelves(1, door(2))) },
      { id: 'base-drawer-door', name: 'Drawer over door', summary: 'Top drawer, shelf behind a door below', kind: 'interior', requires: [], create: () => base('Base cabinet, drawer over door', {}, splitY([mm(150), fr()], [drawers(1), shelves(1, door(1))])) },
      { id: 'base-inner-drawers', name: 'Door + 2 inner drawers', summary: 'Internal drawers behind one door', kind: 'interior', requires: [], create: () => base('Base cabinet, inner drawers', {}, drawers(2, undefined, door(1))) },
      { id: 'base-open', name: 'Open shelves', summary: 'No front, two shelves', kind: 'interior', requires: [], create: () => base('Base cabinet, open', {}, shelves(2)) },
    ],
  },
  {
    id: 'base-drawers', name: 'Base cabinet, drawers', nameRo: 'Corp bază cu sertare', aliases: ['drawer base', 'pan drawers', 'corp sertare'], function: 'kitchen', rooms: ['kitchen'], root: 'cabinet', support: 'ready',
    structure: 'Carcass on a plinth with a bank of drawers on side-mount runners; fronts split top to bottom.',
    configurations: ['Drawers 1–5', 'Front heights equal, fixed or shares (ADR-0023)', 'Runner length from your list', 'Rails instead of a top under a hob'],
    dims: BASE_DIMS, catalogVersion: 1,
    variants: [
      { id: 'drawers-3', name: '3 drawers, deep bottom', summary: 'Shallow, medium, deep', kind: 'interior', requires: [], create: () => base('Drawer base, 3 drawers', {}, drawers(3, [fr(1), fr(1.5), fr(2)])) },
      { id: 'drawers-4', name: '4 equal drawers', summary: 'Four equal fronts', kind: 'interior', requires: [], create: () => base('Drawer base, 4 drawers', {}, drawers(4)) },
      { id: 'drawers-pan', name: '2 pan drawers', summary: 'Two deep drawers', kind: 'interior', requires: [], create: () => base('Drawer base, 2 pan drawers', {}, drawers(2)) },
      { id: 'drawers-800', name: '800 wide drawer bank', summary: '3 drawers, 800 wide', kind: 'interior', requires: [], create: () => base('Drawer base, 800', { width: 800 }, drawers(3, [fr(1), fr(1.5), fr(2)])) },
      { id: 'drawers-hob', name: 'Hob base', summary: 'Top rails, a shallow drawer over 2 deep ones', kind: 'construction', requires: ['top:rails'], create: () => base('Hob base', { topKind: 'rails' }, drawers(3, [fr(0.6), fr(1.5), fr(1.5)])) },
    ],
  },
  {
    id: 'sink-base', name: 'Sink base', nameRo: 'Corp chiuvetă', aliases: ['sink unit', 'corp chiuveta'], function: 'kitchen', rooms: ['kitchen'], root: 'cabinet', support: 'ready',
    structure: 'Carcass with two top rails instead of a top and no back, so the sink and pipes fit; doors in front.',
    configurations: ['Width 600–1200', '1 or 2 doors', 'Rails depth', 'False front, U-cut drawer or waste pull-out'],
    dims: BASE_DIMS, catalogVersion: 1,
    variants: [
      { id: 'sink-2-doors', name: '2 doors, rails, no back', summary: '800 wide', kind: 'construction', requires: ['top:rails'], create: () => base('Sink base, 2 doors', { width: 800, topKind: 'rails', back: 'none' }, empty(door(2))) },
      { id: 'sink-1-door', name: '1 door (600)', summary: '600 wide, rails, no back', kind: 'construction', requires: ['top:rails'], create: () => base('Sink base, 1 door', { topKind: 'rails', back: 'none' }, empty(door(1))) },
      { id: 'sink-false-front', name: 'False front + 2 doors', summary: 'Fixed strip under the sink', kind: 'construction', requires: ['top:rails', 'front:fixed'] },
      { id: 'sink-u-drawer', name: 'U-cut drawer + drawer', summary: 'Drawer cut around the trap', kind: 'construction', requires: ['shape', 'hardware:user'] },
      { id: 'sink-waste', name: 'Waste pull-out', summary: 'One tall pull-out for bins', kind: 'construction', requires: ['top:rails', 'hardware:user'], hardware: 'waste pull-out system',
        create: () => base('Sink base, waste pull-out', { topKind: 'rails', back: 'none' }, drawers(1)) },
    ],
  },
  {
    id: 'appliance-base', name: 'Appliance base', nameRo: 'Corp bază pentru cuptor', aliases: ['oven housing', 'oven base'], function: 'kitchen', rooms: ['kitchen'], root: 'cabinet', support: 'ready',
    structure: 'Carcass with rails and no back; an open niche sized from the oven\'s installation drawing.',
    configurations: ['Niche size from the appliance drawing (never defaulted)', 'Drawer below or oven at plinth level'],
    dims: BASE_DIMS, catalogVersion: 1,
    variants: [
      { id: 'oven-drawer', name: 'Oven niche + drawer below', summary: 'Niche over a 150 drawer', kind: 'construction', requires: ['top:rails', 'appliance-niche', 'hardware:user'], hardware: 'oven — enter its niche size from the installation drawing',
        create: () => base('Oven base', { topKind: 'rails', back: 'none' }, splitY([fr(), mm(150)], [empty(), drawers(1)])) },
      { id: 'oven-plinth', name: 'Oven niche at plinth', summary: 'The whole carcass is the niche', kind: 'construction', requires: ['top:rails', 'appliance-niche', 'hardware:user'], hardware: 'oven — enter its niche size from the installation drawing',
        create: () => base('Oven base, full height', { topKind: 'rails', back: 'none' }, empty()) },
    ],
  },
  {
    id: 'pullout-base', name: 'Narrow pull-out base', nameRo: 'Corp îngust cu jolly', aliases: ['spice pull-out', 'bottle pull-out', 'jolly'], function: 'kitchen', rooms: ['kitchen'], root: 'cabinet', support: 'ready',
    structure: 'Narrow carcass with one full-height drawer front on a pull-out frame.',
    configurations: ['Width 150–400', 'Pull-out frame from its datasheet'],
    dims: { ...BASE_DIMS, min: [150, 600, 300], max: [400, 1000, 700] }, catalogVersion: 1,
    variants: [
      { id: 'pullout-300', name: 'Full-height pull-out', summary: '300 wide', kind: 'interior', requires: ['hardware:user'], hardware: 'pull-out frame', create: () => base('Pull-out base 300', { width: 300 }, drawers(1)) },
      { id: 'pullout-150', name: 'Spice / bottle pull-out', summary: '150 wide', kind: 'interior', requires: ['hardware:user'], hardware: 'pull-out frame', create: () => base('Pull-out base 150', { width: 150 }, drawers(1)) },
    ],
  },
  {
    id: 'integrated-front', name: 'Integrated front', nameRo: 'Front încorporabil', aliases: ['dishwasher front', 'fridge door'], function: 'kitchen', rooms: ['kitchen'], root: 'panel', support: 'ready',
    structure: 'One front panel with no carcass, fixed to the appliance with its own kit.',
    configurations: ['Width and height to line up with the neighbouring fronts', 'Handle'],
    dims: { min: [200, 300, 16], max: [900, 2200, 25] }, catalogVersion: 1,
    variants: [
      { id: 'front-dishwasher-600', name: 'Dishwasher 600', summary: '597 × 717 front', kind: 'construction', requires: ['root:panel'], create: () => panel('Dishwasher front 600', 'dishwasher') },
      { id: 'front-dishwasher-450', name: 'Dishwasher 450', summary: '447 × 717 front', kind: 'construction', requires: ['root:panel'], create: () => panel('Dishwasher front 450', 'dishwasher', { width: 447 }) },
      { id: 'front-fridge', name: 'Fridge door', summary: '597 × 1200 front', kind: 'construction', requires: ['root:panel'], create: () => panel('Fridge door front', 'fridge') },
    ],
  },
  {
    id: 'wall-cabinet', name: 'Wall cabinet', nameRo: 'Corp suspendat', aliases: ['wall unit', 'corp sus'], function: 'kitchen', rooms: ['kitchen', 'living'], root: 'cabinet', support: 'ready',
    structure: 'Carcass with the back set in, hung on brackets and a wall rail; shelves behind doors or a flap.',
    configurations: ['Width on the grid', 'Height 360 / 600 / 720 / 900', 'Doors 1–2, lift-up flap or open', 'No bottom over a hood'],
    dims: { min: [150, 300, 250], max: [1200, 1200, 450], widthGrid: GRID }, catalogVersion: 1,
    variants: [
      { id: 'wall-cabinet', name: '2 doors + shelf', summary: '800 × 720 × 320', kind: 'interior', requires: [], create: legacy('wall-cabinet') },
      { id: 'wall-1-door', name: '1 door + 2 shelves', summary: '600 wide', kind: 'interior', requires: [], create: () => wallUnit('Wall cabinet, 1 door', {}, shelves(2, door(1))) },
      { id: 'wall-open', name: 'Open', summary: 'No front, two shelves', kind: 'interior', requires: [], create: () => wallUnit('Wall cabinet, open', { width: 800 }, shelves(2)) },
      { id: 'wall-flap', name: 'Lift-up flap', summary: '800 × 400, flap opens upwards', kind: 'construction', requires: ['front:flap', 'hardware:user'], create: () => wallUnit('Wall cabinet, lift-up flap', { width: 800, height: 400 }, shelves(0, flap('up'))) },
      { id: 'wall-hood', name: 'Over-hood, no bottom', summary: '600 × 360, open below for the duct', kind: 'construction', requires: ['bottom:none'], create: () => wallUnit('Over-hood cabinet', { height: 360, bottom: 'none' }, empty(door(1))) },
    ],
  },
  {
    id: 'tall-cabinet', name: 'Tall cabinet', nameRo: 'Corp coloană', aliases: ['larder', 'pantry', 'tall unit', 'coloana'], function: 'kitchen', rooms: ['kitchen', 'hallway'], root: 'cabinet', support: 'ready',
    structure: 'Full-height carcass on a plinth, divided by a fixed shelf; stacked doors; niches for appliances.',
    configurations: ['Height 2000–2400', 'Stacked doors', 'Inner drawers', 'Appliance niches sized from their drawings'],
    dims: { min: [300, 1600, 300], max: [1200, 2400, 700], widthGrid: GRID }, catalogVersion: 1,
    variants: [
      { id: 'tall-pantry', name: 'Pantry, 2 stacked doors', summary: 'Shelves behind upper and lower doors', kind: 'interior', requires: [], create: () => tall('Pantry', {}, splitY(even(2), [shelves(3, door(1)), shelves(2, door(1))])) },
      { id: 'tall-pantry-drawers', name: 'Pantry + inner drawers', summary: 'Lower door over 3 inner drawers', kind: 'interior', requires: [], create: () => tall('Pantry with inner drawers', {}, splitY(even(2), [shelves(3, door(1)), drawers(3, undefined, door(1))])) },
      { id: 'tall-broom', name: 'Broom / utility', summary: 'Shelves above, open space below', kind: 'interior', requires: [], create: () => tall('Broom cupboard', {}, splitY([mm(700), fr()], [shelves(2, door(1)), empty(door(1))])) },
      { id: 'tall-oven-tower', name: 'Oven + microwave tower', summary: 'Niches between a top cupboard and drawers', kind: 'construction', requires: ['appliance-niche', 'hardware:user'], hardware: 'oven and microwave — enter their niche sizes from the installation drawings',
        create: () => tall('Oven tower', {}, splitY([fr(), mm(400), mm(600), mm(500)], [shelves(1, door(1)), empty(), empty(), drawers(2)])) },
      { id: 'tall-fridge', name: 'Fridge housing', summary: 'Niche with a cupboard above', kind: 'construction', requires: ['appliance-niche', 'hardware:user'], hardware: 'fridge — enter its niche size from the installation drawing',
        create: () => tall('Fridge housing', {}, splitY([fr(), mm(1600)], [shelves(1, door(1)), empty()])) },
    ],
  },
  {
    id: 'blind-corner', name: 'Blind corner', nameRo: 'Corp colț orb', aliases: ['blind corner base', 'colt'], function: 'kitchen', rooms: ['kitchen'], root: 'corner', support: 'ready',
    structure: 'A blind section covered by the neighbouring cabinet, joined to a normal cabinet with a door.',
    configurations: ['Corner on the left or right', 'Blind width', 'Base or wall height'],
    dims: { min: [600, 300, 250], max: [1500, 1000, 700] }, catalogVersion: 1,
    variants: [
      { id: 'corner-blind', name: 'Blind left + shelf', summary: '1000 wide, 720 carcass on the plinth', kind: 'interior', requires: [], create: () => corner('Blind corner base', 'blind', { height: 820 }) },
      { id: 'corner-blind-right', name: 'Blind right + shelf', summary: 'Mirrored', kind: 'interior', requires: [], create: () => corner('Blind corner, right', 'blind', { side: 'right', height: 820 }) },
      { id: 'corner-blind-wall', name: 'Wall blind corner', summary: '720 high, 320 deep, no plinth', kind: 'interior', requires: ['hardware:user'], hardware: 'wall hanging brackets (corner units do not get them automatically)',
        create: () => corner('Wall blind corner', 'blind', { height: 720, depth: 320, plinthHeight: 0, width: 900, blindWidth: 370 }) },
    ],
  },
  {
    id: 'l-corner', name: 'L corner', nameRo: 'Corp colț în L', aliases: ['corner base', 'L-shaped corner'], function: 'kitchen', rooms: ['kitchen'], root: 'corner', support: 'ready',
    structure: 'Two wings open to each other at the corner with a folding door pair.',
    configurations: ['Wing lengths', 'Corner side', 'Base or wall height'],
    dims: { min: [600, 300, 250], max: [1500, 1000, 700] }, catalogVersion: 1,
    variants: [
      { id: 'corner-l', name: 'Base L, folding doors', summary: '900 × 900, 720 carcass on the plinth', kind: 'interior', requires: [], create: () => corner('L-shaped corner base', 'l-shape', { height: 820 }) },
      { id: 'corner-l-wall', name: 'Wall L 600 × 600', summary: '720 high, 320 deep', kind: 'interior', requires: ['hardware:user'], hardware: 'wall hanging brackets (corner units do not get them automatically)',
        create: () => corner('Wall L corner', 'l-shape', { width: 600, wingWidth: 600, height: 720, depth: 320, plinthHeight: 0 }) },
      { id: 'corner-diagonal', name: 'Diagonal front', summary: 'Five-sided corner', kind: 'construction', requires: ['shape'] },
    ],
  },
]
