/**
 * Construction types offered by the New-piece wizard (ADR-044) and their suggestion families (ADR-045).
 * Adding a type or a family is one entry here; the engine and the UI read these entries only.
 * Sizes and counts are layout defaults the user changes in the wizard, not hardware or load figures (ADR-010).
 */
import { cabinet, deskDefaults, frameDefaults, newId, wrap } from '../design';
import { answerAxis, dividersAxis, drawersAxis, frontsAxis, mixAxis, shelvesAxis } from './axes';
import type { Axis, ConstructionType } from './types';

const cabinetAxes = (): Axis[] => [
  dividersAxis([0, 1, 2]),
  mixAxis(['shelves', 'drawers', 'shelves-drawers', 'drawers-left', 'open']),
  shelvesAxis([1, 2, 3, 4, 5]),
  drawersAxis([2, 3, 4, 5, 6]),
  frontsAxis(['none', 'pair', 'single', 'per']),
  answerAxis('base', ['plinth', 'none']),
];

const shelvingAxes = (): Axis[] => [
  dividersAxis([0, 1, 2, 3]),
  mixAxis(['shelves', 'open']),
  shelvesAxis([2, 3, 4, 5, 6, 7]),
  answerAxis('base', ['plinth', 'none']),
  answerAxis('back', ['none', 'applied']),
];

const frameAxes = (legs: number[]): Axis[] => [
  answerAxis('top', ['panel', 'slats']),
  answerAxis('stretchers', ['none', 'box', 'h']),
  answerAxis('lowerShelf', ['none', 'yes']),
  answerAxis('legSize', legs),
];

const wardrobeAxes = (): Axis[] => [
  dividersAxis([1, 2, 0]),
  mixAxis(['hanging-left', 'hanging', 'shelves', 'drawers-left', 'shelves-drawers']),
  shelvesAxis([4, 5, 6, 3]),
  drawersAxis([3, 4, 2]),
  frontsAxis(['pair', 'sliding', 'per', 'none']),
  answerAxis('base', ['plinth', 'none']),
];

const bedAxes = (): Axis[] => [
  answerAxis('mattressWidth', [1600, 900, 1400, 1800]),
  answerAxis('footboard', ['none', 'yes']),
  answerAxis('deckHeight', [380, 250, 450]),
];

const deskAxes = (): Axis[] => [
  answerAxis('support', ['pedestal-left', 'gables', 'two-pedestals', 'pedestal-right']),
  answerAxis('pedestalDrawers', [3, 2, 4, 5]),
  answerAxis('modesty', ['yes', 'no']),
];

export const CONSTRUCTION_TYPES: ConstructionType[] = [
  {
    id: 'cabinet',
    label: 'Cabinet (closed box)',
    description:
      'A rectangular carcass: sides, top, bottom and back, with dividers, shelves, drawers and doors.',
    steps: ['divisions', 'contents', 'fronts', 'base', 'carcass'],
    defaults: {
      name: 'Cabinet',
      category: 'storage',
      width: 800,
      height: 900,
      depth: 450,
      dividers: 0,
      compartments: [{ kind: 'shelves', shelves: 2, drawers: 3 }],
      fronts: 'pair',
      base: 'plinth',
      plinthHeight: 80,
      back: 'applied',
    },
    limits: {
      width: { min: 200, max: 3000 },
      height: { min: 200, max: 2700 },
      depth: { min: 150, max: 900 },
    },
    seed: () => cabinet('Cabinet', {}, { id: newId(), kind: 'empty' }),
    generators: [
      { id: 'cabinet-layouts', at: 'type', axes: cabinetAxes() },
      { id: 'cabinet-divisions', at: 'divisions', axes: cabinetAxes() },
      { id: 'cabinet-contents', at: 'contents', axes: cabinetAxes().slice(1) },
      {
        id: 'cabinet-fronts',
        at: 'fronts',
        axes: [
          frontsAxis(['none', 'single', 'pair', 'sliding', 'per']),
          answerAxis('base', ['plinth', 'none', 'wall']),
        ],
      },
      { id: 'cabinet-base', at: 'base', axes: [answerAxis('base', ['plinth', 'none', 'wall'])] },
    ],
  },
  {
    id: 'shelving',
    label: 'Open shelving',
    description:
      'A rectangular frame with no doors: bookcases and open storage, with or without a back.',
    steps: ['divisions', 'contents', 'base', 'carcass'],
    defaults: {
      name: 'Open shelving',
      category: 'storage',
      width: 800,
      height: 1800,
      depth: 300,
      dividers: 1,
      compartments: [{ kind: 'shelves', shelves: 4, drawers: 3 }],
      base: 'plinth',
      plinthHeight: 60,
      back: 'none',
    },
    options: { compartments: ['open', 'shelves'] },
    limits: {
      width: { min: 200, max: 3000 },
      height: { min: 200, max: 2700 },
      depth: { min: 100, max: 800 },
    },
    seed: () =>
      cabinet('Open shelving', { shelfSetback: 0, back: 'none' }, { id: newId(), kind: 'empty' }),
    generators: [
      { id: 'shelving-layouts', at: 'type', axes: shelvingAxes() },
      { id: 'shelving-divisions', at: 'divisions', axes: shelvingAxes() },
      { id: 'shelving-contents', at: 'contents', axes: shelvingAxes().slice(1) },
      { id: 'shelving-base', at: 'base', axes: shelvingAxes().slice(3) },
    ],
  },
  {
    id: 'wardrobe',
    label: 'Wardrobe',
    description:
      'A tall carcass for clothes: hanging rails, shelves and drawers, behind hinged or sliding doors.',
    steps: ['divisions', 'contents', 'fronts', 'base', 'carcass'],
    defaults: {
      name: 'Wardrobe',
      category: 'storage',
      width: 1200,
      height: 2100,
      depth: 600,
      dividers: 1,
      compartments: [
        { kind: 'hanging', shelves: 5, drawers: 3 },
        { kind: 'shelves', shelves: 5, drawers: 3 },
      ],
      fronts: 'pair',
      base: 'plinth',
      plinthHeight: 80,
      back: 'applied',
    },
    limits: {
      width: { min: 400, max: 3000 },
      height: { min: 1200, max: 2700 },
      depth: { min: 300, max: 800 },
    },
    seed: () => cabinet('Wardrobe', {}, { id: newId(), kind: 'empty' }),
    generators: [
      { id: 'wardrobe-layouts', at: 'type', axes: wardrobeAxes() },
      { id: 'wardrobe-divisions', at: 'divisions', axes: wardrobeAxes() },
      { id: 'wardrobe-contents', at: 'contents', axes: wardrobeAxes().slice(1) },
      { id: 'wardrobe-fronts', at: 'fronts', axes: wardrobeAxes().slice(4) },
    ],
  },
  {
    id: 'bed',
    label: 'Bed',
    description:
      'A bed frame sized from its mattress: headboard, side rails, slats on ledgers, optional raised footboard.',
    steps: ['bed'],
    hide: ['width', 'depth'],
    labels: { height: 'Headboard height' },
    defaults: {
      name: 'Bed',
      category: 'sleeping',
      height: 1000,
      mattressWidth: 1600,
      mattressLength: 2000,
      deckHeight: 380,
      footboard: 'none',
      footboardHeight: 600,
    },
    limits: { height: { min: 500, max: 1600 } },
    seed: () => wrap('Bed', { kind: 'frame', id: newId(), params: frameDefaults('bed') }),
    generators: [
      { id: 'bed-sizes', at: 'type', axes: bedAxes() },
      { id: 'bed-step', at: 'bed', axes: bedAxes() },
    ],
  },
  {
    id: 'table',
    label: 'Table (leg frame)',
    description: 'Four legs, rails under the top, optional stretchers and a lower shelf.',
    steps: ['frame'],
    defaults: {
      name: 'Table',
      category: 'tables',
      width: 1600,
      height: 750,
      depth: 900,
      top: 'panel',
      stretchers: 'none',
      lowerShelf: 'none',
      shelfHeight: 150,
      legSize: 60,
    },
    limits: {
      width: { min: 300, max: 3000 },
      height: { min: 250, max: 1100 },
      depth: { min: 300, max: 1500 },
    },
    seed: () => wrap('Table', { kind: 'frame', id: newId(), params: frameDefaults('table') }),
    generators: [
      { id: 'table-frames', at: 'type', axes: frameAxes([45, 60, 80]) },
      { id: 'table-frame-step', at: 'frame', axes: frameAxes([45, 60, 80]) },
    ],
  },
  {
    id: 'bench',
    label: 'Bench (leg frame)',
    description:
      'A long low seat on four legs, panel or slatted, with optional stretchers and shelf.',
    steps: ['frame'],
    defaults: {
      name: 'Bench',
      category: 'seating',
      width: 1200,
      height: 450,
      depth: 380,
      top: 'panel',
      stretchers: 'none',
      lowerShelf: 'none',
      shelfHeight: 120,
      legSize: 45,
    },
    limits: {
      width: { min: 300, max: 3000 },
      height: { min: 250, max: 700 },
      depth: { min: 200, max: 800 },
    },
    seed: () => wrap('Bench', { kind: 'frame', id: newId(), params: frameDefaults('bench') }),
    generators: [
      { id: 'bench-frames', at: 'type', axes: frameAxes([40, 45, 60]) },
      { id: 'bench-frame-step', at: 'frame', axes: frameAxes([40, 45, 60]) },
    ],
  },
  {
    id: 'desk',
    label: 'Desk',
    description:
      'A worktop on panel gables or on drawer pedestals, with an optional modesty panel.',
    steps: ['desk'],
    defaults: {
      name: 'Desk',
      category: 'tables',
      width: 1400,
      height: 750,
      depth: 700,
      support: 'pedestal-left',
      pedestalDrawers: 3,
      modesty: 'yes',
    },
    limits: {
      width: { min: 600, max: 3000 },
      height: { min: 500, max: 1200 },
      depth: { min: 400, max: 1200 },
    },
    seed: () => wrap('Desk', { kind: 'desk', id: newId(), params: deskDefaults() }),
    generators: [
      { id: 'desk-supports', at: 'type', axes: deskAxes() },
      { id: 'desk-step', at: 'desk', axes: deskAxes() },
    ],
  },
];

export const typeById = new Map(CONSTRUCTION_TYPES.map((t) => [t.id, t]));
