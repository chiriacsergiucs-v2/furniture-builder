/**
 * The room Custom (ADR-298): pieces that are neither a classic catalog item nor a single room's furniture. Each version
 * is highlighted and inserted as a kit: the user gets the pre-made build and may change only its size and boards.
 * The rows are staggered (ADR-282) and written from their rule here, so the tile and the inserted piece match.
 */
import { buildModel } from '../build';
import { newId } from '../design';
import { refreshStagger } from '../stagger';
import type { CabinetParams, Design, Mm, Space } from '../types';
import { cab, empty, even, splitY } from './helpers';
import type { CatalogFamily, CatalogVariant } from './types';

/** A cabinet with `rows` staggered rows of the three `widths`, rows written for its size. */
function staggered(
  name: string,
  over: Partial<CabinetParams>,
  rows: number,
  widths: [Mm, Mm, Mm],
  seed: number,
): Design {
  const split = splitY(
    even(rows),
    Array.from({ length: rows }, () => empty()),
  ) as Extract<Space, { kind: 'split' }>;
  const d = cab(name, over, { ...split, id: newId(), stagger: { widths, seed } });
  return refreshStagger(d, buildModel(d));
}

/** A highlighted kit version (ADR-298). */
const kitVersion = (
  id: string,
  name: string,
  summary: string,
  create: () => Design,
): CatalogVariant => ({
  id,
  name,
  summary,
  kind: 'interior',
  requires: [],
  highlight: true,
  kit: true,
  create,
});

/** Open both sides (ADR-292): no back, rear edges banded; a free-standing piece. */
const OPEN: Partial<CabinetParams> = { back: 'none', twoFaced: true, plinthHeight: 0 };
/** Against a wall: back nailed on. */
const WALL: Partial<CabinetParams> = { back: 'applied', plinthHeight: 0 };

export const custom: CatalogFamily[] = [
  {
    id: 'room-divider',
    name: 'Room divider',
    nameRo: 'Paravan bibliotecă',
    aliases: ['room divider', 'space divider', 'partition shelf', 'paravan', 'despărțitor'],
    function: 'storage',
    rooms: ['custom', 'living', 'office'],
    root: 'cabinet',
    support: 'ready',
    structure:
      'Open on both sides, no back; staggered rows of open cells, rear edges banded. Stands free: fix it to the floor or ceiling.',
    configurations: ['Width and height (kit)', 'Boards (kit)'],
    dims: { min: [600, 500, 250], max: [3000, 2700, 600] },
    catalogVersion: 1,
    variants: [
      kitVersion('room-divider-low', 'Low', '1600 × 800 × 350, two staggered rows', () =>
        staggered(
          'Room divider — Low',
          { ...OPEN, width: 1600, height: 800, depth: 350 },
          2,
          [200, 280, 360],
          11,
        ),
      ),
      kitVersion('room-divider-tall', 'Tall', '1200 × 2000 × 350, six staggered rows', () =>
        staggered(
          'Room divider — Tall',
          { ...OPEN, width: 1200, height: 2000, depth: 350 },
          6,
          [200, 280, 360],
          7,
        ),
      ),
      kitVersion('room-divider-wide', 'Wide', '2400 × 1600 × 400, five rows of wider cells', () =>
        staggered(
          'Room divider — Wide',
          { ...OPEN, width: 2400, height: 1600, depth: 400 },
          5,
          [300, 400, 500],
          3,
        ),
      ),
    ],
  },
  {
    id: 'staggered-shelving',
    name: 'Staggered shelving',
    nameRo: 'Etajeră decalată',
    aliases: ['staggered shelves', 'offset shelving', 'brick shelving', 'etajeră'],
    function: 'storage',
    rooms: ['custom', 'living', 'kids'],
    root: 'cabinet',
    support: 'ready',
    structure: 'Back nailed on; staggered rows of open cells whose dividers never line up.',
    configurations: ['Width and height (kit)', 'Boards (kit)'],
    dims: { min: [400, 400, 200], max: [3000, 2700, 600] },
    catalogVersion: 1,
    variants: [
      kitVersion(
        'staggered-narrow-tower',
        'Narrow tower',
        '600 × 2000 × 300, seven narrow rows',
        () =>
          staggered(
            'Staggered shelving — Narrow tower',
            { ...WALL, width: 600, height: 2000, depth: 300 },
            7,
            [150, 200, 250],
            5,
          ),
      ),
      kitVersion('staggered-wall', 'Wall', '1800 × 1800 × 300, five rows', () =>
        staggered(
          'Staggered shelving — Wall',
          { ...WALL, width: 1800, height: 1800, depth: 300 },
          5,
          [200, 280, 360],
          9,
        ),
      ),
      kitVersion(
        'staggered-low-bench',
        'Low bench shelf',
        '1400 × 600 × 350, two rows of wide cells',
        () =>
          staggered(
            'Staggered shelving — Low bench shelf',
            { ...WALL, width: 1400, height: 600, depth: 350 },
            2,
            [250, 350, 450],
            13,
          ),
      ),
    ],
  },
];
