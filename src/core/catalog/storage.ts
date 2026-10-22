import { cab, door, drawers, empty, even, flap, fr, hanging, legacy, mm, shelves, sliding, splitX, splitY } from './helpers'
import type { CatalogFamily } from './types'

const ROOM_DIMS = { min: [300, 300, 200] as [number, number, number], max: [3000, 2700, 800] as [number, number, number] }

export const storage: CatalogFamily[] = [
  {
    id: 'bookcase', name: 'Bookcase (with back)', nameRo: 'Bibliotecă', aliases: ['bookshelf', 'shelving', 'biblioteca'], function: 'storage', rooms: ['living', 'office', 'kids'], root: 'cabinet', support: 'ready',
    structure: 'Two sides, top, bottom, back panel and plinth; shelves between the sides.',
    configurations: ['Width (bays via "Bays and shelves")', 'Shelves fixed or adjustable', 'Back nailed on or set in', 'Plinth height'],
    dims: ROOM_DIMS, catalogVersion: 1,
    variants: [
      { id: 'bookcase', name: 'Open, back panel, shelves', summary: '800 × 1800 × 300, four shelves', kind: 'interior', requires: [], create: legacy('bookcase') },
    ],
  },
  {
    id: 'wardrobe', name: 'Wardrobe', nameRo: 'Dulap de haine', aliases: ['closet', 'garderobă', 'dulap'], function: 'storage', rooms: ['bedroom', 'hallway'], root: 'cabinet', support: 'ready',
    structure: 'Tall carcass on a plinth divided into sections; hanging rails, shelves and drawers behind hinged or sliding doors.',
    configurations: ['Sections 1–6', 'Per section: hanging, shelves, drawers', 'Hinged or sliding doors', 'Plinth'],
    dims: ROOM_DIMS, catalogVersion: 1,
    variants: [
      { id: 'wardrobe', name: '2 doors, hanging + shelves', summary: '1200 × 2100 × 600', kind: 'interior', requires: [], create: legacy('wardrobe') },
      { id: 'wardrobe-3', name: '3 sections + drawers', summary: '1750 wide: hanging, shelves, shelves over drawers', kind: 'interior', requires: [],
        create: () => cab('Wardrobe, 3 sections', { width: 1750, height: 2100, depth: 600, plinthHeight: 80 }, splitX(even(3), [hanging(door(1)), shelves(5, door(1)), splitY([fr(), mm(600)], [shelves(2), drawers(3)], door(1))])) },
      { id: 'wardrobe-double-hang', name: 'Double hanging', summary: 'Two rails one above the other', kind: 'interior', requires: [],
        create: () => cab('Wardrobe, double hanging', { width: 1000, height: 2100, depth: 600, plinthHeight: 80 }, splitY(even(2), [hanging(), hanging()], door(2))) },
      { id: 'wardrobe-4-doors', name: '4 doors, 2 sections', summary: '1600 wide', kind: 'interior', requires: [],
        create: () => cab('Wardrobe, 4 doors', { width: 1600, height: 2100, depth: 600, plinthHeight: 80 }, splitX(even(2), [hanging(door(2)), shelves(5, door(2))])) },
      { id: 'wardrobe-sliding', name: 'Sliding 2 doors', summary: '1800 wide, doors on a track', kind: 'construction', requires: ['front:sliding'],
        create: () => cab('Wardrobe, sliding doors', { width: 1800, height: 2100, depth: 600, plinthHeight: 80 }, splitX(even(2), [hanging(), shelves(5)], sliding(2))) },
    ],
  },
  {
    id: 'armoire', name: 'Armoire', nameRo: 'Șifonier', aliases: ['freestanding wardrobe', 'clothes press', 'sifonier'], function: 'storage', rooms: ['bedroom'], root: 'cabinet', support: 'ready',
    structure: 'Freestanding wardrobe with a pair of doors over hanging space, often a drawer below.',
    configurations: ['1–2 sections', 'Pair of doors', 'Bottom drawer'],
    dims: ROOM_DIMS, catalogVersion: 1,
    variants: [
      { id: 'armoire-drawer', name: 'Hanging + bottom drawer', summary: '1100 × 1950 × 600', kind: 'interior', requires: [],
        create: () => cab('Armoire', { width: 1100, height: 1950, depth: 600, plinthHeight: 80, bodyMaterialId: 'pal18oak', frontMaterialId: 'pal18oak' }, splitY([fr(), mm(250)], [hanging(door(2)), drawers(1)])) },
      { id: 'armoire-shelves', name: 'Hanging + shelves', summary: 'Two sections behind a pair of doors', kind: 'interior', requires: [],
        create: () => cab('Armoire with shelves', { width: 1100, height: 1950, depth: 600, plinthHeight: 80, bodyMaterialId: 'pal18oak', frontMaterialId: 'pal18oak' }, splitX(even(2), [hanging(), shelves(4)], door(2))) },
    ],
  },
  {
    id: 'dresser', name: 'Dresser', nameRo: 'Comodă lată', aliases: ['double dresser', 'comoda'], function: 'storage', rooms: ['bedroom'], root: 'cabinet', support: 'ready',
    structure: 'Low wide carcass with drawer columns side by side on a plinth.',
    configurations: ['Columns 1–3 × drawers 2–5', 'Equal or graduated heights'],
    dims: ROOM_DIMS, catalogVersion: 1,
    variants: [
      { id: 'dresser-2x3', name: '2 × 3 drawers', summary: '1400 × 800 × 500', kind: 'interior', requires: [], create: () => cab('Dresser 2 × 3', { width: 1400, height: 800, depth: 500 }, splitX(even(2), [drawers(3), drawers(3)])) },
      { id: 'dresser-2x4', name: '2 × 4 drawers', summary: '1400 × 900 × 500', kind: 'interior', requires: [], create: () => cab('Dresser 2 × 4', { width: 1400, height: 900, depth: 500 }, splitX(even(2), [drawers(4), drawers(4)])) },
      { id: 'dresser-graduated', name: '3 graduated wide', summary: '1000 wide, deeper towards the floor', kind: 'interior', requires: [], create: () => cab('Dresser, graduated', { width: 1000, height: 800, depth: 500 }, drawers(3, [fr(1), fr(1.3), fr(1.6)])) },
    ],
  },
  {
    id: 'chest', name: 'Chest of drawers', nameRo: 'Comodă', aliases: ['tallboy', 'chest'], function: 'storage', rooms: ['bedroom', 'hallway'], root: 'cabinet', support: 'ready',
    structure: 'Carcass on a plinth with one column of drawers.',
    configurations: ['Drawers 3–6', 'Width', 'Tall and narrow'],
    dims: ROOM_DIMS, catalogVersion: 1,
    variants: [
      { id: 'chest', name: '4 drawers', summary: '800 × 900 × 450', kind: 'interior', requires: [], create: legacy('chest') },
      { id: 'chest-tall', name: '5 drawers, tall-narrow', summary: '500 × 1200 × 450', kind: 'interior', requires: [], create: () => cab('Tall chest', { width: 500, height: 1200 }, drawers(5)) },
      { id: 'chest-2-over-3', name: '2 small over 3 wide', summary: '800 × 1000 × 450', kind: 'interior', requires: [], create: () => cab('Chest, 2 over 3', { height: 1000 }, splitY([fr(), fr(3)], [splitX(even(2), [drawers(1), drawers(1)]), drawers(3)])) },
      { id: 'blanket-chest', name: 'Lidded blanket chest', summary: 'Box with a lid on top', kind: 'construction', requires: ['front:lid', 'hardware:user'] },
    ],
  },
  {
    id: 'sideboard', name: 'Sideboard', nameRo: 'Bufet', aliases: ['buffet', 'bufet'], function: 'storage', rooms: ['dining', 'living'], root: 'cabinet', support: 'ready',
    structure: 'Long low carcass in 2–4 sections with doors, drawers or open space.',
    configurations: ['Sections 2–4', 'Doors, drawers or open per section'],
    dims: ROOM_DIMS, catalogVersion: 1,
    variants: [
      { id: 'sideboard', name: 'Doors · drawers · doors', summary: '1600 × 800 × 450', kind: 'interior', requires: [], create: legacy('sideboard') },
      { id: 'sideboard-3-doors', name: '3 doors', summary: 'Three sections behind doors', kind: 'interior', requires: [], create: () => cab('Sideboard, 3 doors', { width: 1600, height: 800, bodyMaterialId: 'pal18oak' }, splitX(even(3), [shelves(1, door(1)), shelves(1, door(1)), shelves(1, door(1))])) },
      { id: 'sideboard-niche', name: '2 doors + open niche', summary: 'Open middle section', kind: 'interior', requires: [], create: () => cab('Sideboard with niche', { width: 1600, height: 800, bodyMaterialId: 'pal18oak' }, splitX(even(3), [shelves(1, door(1)), shelves(1), shelves(1, door(1))])) },
    ],
  },
  {
    id: 'credenza', name: 'Credenza', nameRo: 'Credenza', aliases: ['office sideboard'], function: 'storage', rooms: ['office', 'dining', 'living'], root: 'cabinet', support: 'ready',
    structure: 'Low office sideboard close to desk height: doors, sliding doors or file drawers.',
    configurations: ['Sections', 'Hinged or sliding doors', 'File drawers'],
    dims: ROOM_DIMS, catalogVersion: 1,
    variants: [
      { id: 'credenza-file', name: 'Doors + file drawers', summary: '1600 × 700 × 450', kind: 'interior', requires: ['hardware:user'], hardware: 'hanging-file rails',
        create: () => cab('Credenza with file drawers', { width: 1600, height: 700 }, splitX([fr(), fr(), mm(450)], [shelves(1, door(1)), shelves(1, door(1)), drawers(2)])) },
      { id: 'credenza-3-doors', name: '3 doors, low', summary: 'Three sections behind doors', kind: 'interior', requires: [], create: () => cab('Credenza, 3 doors', { width: 1600, height: 700 }, splitX(even(3), [shelves(1, door(1)), shelves(1, door(1)), shelves(1, door(1))])) },
      { id: 'credenza-sliding', name: 'Sliding doors', summary: 'Two doors on a track', kind: 'construction', requires: ['front:sliding'], create: () => cab('Credenza, sliding doors', { width: 1600, height: 700 }, splitX(even(2), [shelves(1), shelves(1)], sliding(2))) },
    ],
  },
  {
    id: 'media-console', name: 'Media console', nameRo: 'Comodă TV', aliases: ['TV unit', 'TV bench', 'comoda tv'], function: 'storage', rooms: ['living'], root: 'cabinet', support: 'ready',
    structure: 'Low long carcass with open niches for devices, drawers, doors or flaps; on the floor or hung on the wall.',
    configurations: ['Open niches', 'Drawers', 'Drop-down flaps', 'Floor or wall-hung'],
    dims: ROOM_DIMS, catalogVersion: 1,
    variants: [
      { id: 'media-open-drawers', name: 'Open niches + drawers', summary: '1800 × 450 × 420', kind: 'interior', requires: [], create: () => cab('Media console', { width: 1800, height: 450, depth: 420, plinthHeight: 60 }, splitX(even(3), [empty(), drawers(2), empty()])) },
      { id: 'media-doors-centre', name: 'Doors + open centre', summary: 'Doors either side of a niche', kind: 'interior', requires: [], create: () => cab('Media console, doors', { width: 1750, height: 450, depth: 420, plinthHeight: 60 }, splitX(even(3), [shelves(1, door(1)), shelves(1), shelves(1, door(1))])) },
      { id: 'media-wall', name: 'Wall-hung', summary: 'On brackets, 300 above the floor', kind: 'interior', requires: [], create: () => cab('Media console, wall-hung', { width: 1800, height: 400, depth: 400, mount: 'wall', mountHeight: 300, plinthHeight: 0, back: 'inset', backInset: 18 }, splitX(even(3), [drawers(1), empty(), drawers(1)])) },
      { id: 'media-flaps', name: 'Drop-down flaps', summary: 'Two flaps hinged at the bottom', kind: 'construction', requires: ['front:flap', 'hardware:user'], create: () => cab('Media console, flaps', { width: 1600, height: 450, depth: 420, plinthHeight: 60 }, splitX(even(2), [empty(flap('down')), empty(flap('down'))])) },
    ],
  },
  {
    id: 'filing-cabinet', name: 'Filing cabinet', nameRo: 'Fișet', aliases: ['file cabinet', 'pedestal', 'fiset'], function: 'storage', rooms: ['office'], root: 'cabinet', support: 'ready',
    structure: 'Strong carcass with file drawers on full-extension runners and hanging-file rails.',
    configurations: ['Drawers 2–4', 'Vertical or lateral', 'Under-desk pedestal'],
    dims: ROOM_DIMS, catalogVersion: 1,
    variants: [
      { id: 'filing-3', name: '3 file drawers', summary: '420 × 1000 × 600', kind: 'interior', requires: ['hardware:user'], hardware: 'hanging-file rails and full-extension runners rated for files', create: () => cab('Filing cabinet', { width: 420, height: 1000, depth: 600, plinthHeight: 40 }, drawers(3)) },
      { id: 'filing-pedestal', name: 'Pedestal: box + file drawer', summary: '420 × 600 × 600', kind: 'interior', requires: [], create: () => cab('Desk pedestal', { width: 420, height: 600, depth: 600, plinthHeight: 0 }, drawers(2, [fr(1), fr(2)])) },
      { id: 'filing-lateral', name: 'Lateral, 2 drawers', summary: '900 × 720 × 500', kind: 'interior', requires: ['hardware:user'], hardware: 'lateral hanging-file rails', create: () => cab('Lateral filing cabinet', { width: 900, height: 720, depth: 500, plinthHeight: 40 }, drawers(2)) },
    ],
  },
]
