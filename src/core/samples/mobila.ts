/**
 * The Mobila rooms, rebuilt as native projects from the project file `MOBILA_TOATE_CAMERELE_AI_CAD_PAL_MDF.json`
 * (format 2.0.0, 2026-10-22). Living was re-done from the catalog's base cabinets at the user's request (2026-10-24);
 * it keeps the file's envelope and boards. Every other size below is taken from that file; where the app builds a part differently
 * from the file, `docs/samples/mobila.md` lists the difference. Nothing here is invented: unknown values (backs,
 * plinths, drawer box boards) use the app's own defaults and are listed there as open.
 *
 * The Pat Noi bed is known only as cut panels, without positions ("UNPLACED_DO_NOT_INVENT" in the file), so it is a
 * panel set (ADR-041): listed for cutting, never assembled here. The kitchen splashback (left out at the user's
 * request), the RHS workbench (an envelope with no member list) and the variants the file marks as not for production
 * (nightstand B, the simplified bed) are not built.
 */
import { findFamily } from '../catalog';
import { defaultDrawers, defaultMaterials, fr, mm } from '../design';
import type { Placement, Project, ProjectItem } from '../project';
import type { CabinetParams, Design, LoosePanel, Material, Product } from '../types';

const STAMP = '2026-10-22T00:00:00.000Z';
const LIVING_STAMP = '2026-10-24T00:00:00.000Z';

/** Boards named as in the file. Sheet sizes from "Estimare servicii Salice.txt": PAL 2800 × 2070, MDF 2800 × 1220. */
const materials = (): Material[] => {
  const base = defaultMaterials();
  const keep = base.filter((m) => m.id === 'pal16' || m.id === 'hdf3');
  return [
    {
      id: 'pal18',
      name: 'PAL 18 mm',
      thickness: 18,
      grain: false,
      color: '#e7e3db',
      sheet: { length: 2800, width: 2070, trim: 10, count: null },
    },
    {
      id: 'mdf-p110',
      name: 'MDF Kastamonu P110 antracit lucios 18 mm',
      thickness: 18,
      grain: false,
      color: '#3b3f44',
      sheet: { length: 2800, width: 1220, trim: 10, count: null },
    },
    ...keep,
  ];
};

/** Carcass settings shared by every Mobila piece: PAL body, P110 fronts, no back, no plinth (none in the file). */
const carcass = (
  over: Partial<CabinetParams> & Pick<CabinetParams, 'width' | 'height' | 'depth' | 'interior'>,
): CabinetParams => ({
  bodyMaterialId: 'pal18',
  frontMaterialId: 'mdf-p110',
  backMaterialId: 'hdf3',
  top: 'over',
  bottom: 'between',
  back: 'none',
  backInset: 15,
  plinthHeight: 0,
  plinthSetback: 0,
  frontGap: 2,
  frontStyle: 'overlay',
  shelfSetback: 0,
  shelfClearance: 1,
  pinRowSetback: 37,
  drawers: defaultDrawers(),
  ...over,
});

const design = (id: string, name: string, params: CabinetParams): Design =>
  wrap(id, name, { kind: 'cabinet', id: `${id}-p`, params });

const wrap = (id: string, name: string, product: Product, mats = materials()): Design => ({
  schemaVersion: 2,
  id,
  name,
  createdAt: STAMP,
  updatedAt: STAMP,
  materials: mats,
  product,
  cutting: { kerf: 4 },
});

/** A panel set: part ids are the file's part ids, so the cut list can be traced back to it. */
const panelSet = (
  id: string,
  name: string,
  panels: LoosePanel[],
  note: string,
  mats?: Material[],
): Design => wrap(id, name, { kind: 'panels', id: `${id}-p`, params: { panels, note } }, mats);

const part = (
  id: string,
  name: string,
  length: number,
  width: number,
  materialId: string,
  quantity = 1,
): LoosePanel => ({ id, name, length, width, materialId, quantity });

const item = (
  id: string,
  d: Design,
  x: number,
  placement: Placement,
  quantity = 1,
): ProjectItem => ({
  id,
  design: d,
  quantity,
  position: { x, y: 0, z: 0 },
  rotationY: 0,
  placement,
});

/**
 * A Mobila cabinet made from the catalog's "Base cabinet, doors" family (variants "1 door + shelf" and "2 doors +
 * shelf": one shelf behind one or two doors), sized to the Living wall and built with the Mobila boards. The origin
 * link is kept (ADR-028) with fixed ids and stamp, so the generator stays deterministic.
 */
const fromBase = (
  id: string,
  name: string,
  doors: 1 | 2,
  over: Partial<CabinetParams> & Pick<CabinetParams, 'width'>,
): Design => {
  const family = findFamily('base-doors')!;
  const variant = family.variants.find(
    (v) => v.id === (doors === 1 ? 'base-door' : 'base-2-doors'),
  )!;
  return {
    ...design(
      id,
      name,
      carcass({
        height: 435,
        depth: 400,
        bottom: 'under',
        ...over,
        interior: {
          id: `${id}-in`,
          kind: 'shelves',
          count: 1,
          front: { kind: 'doors', count: doors },
        },
      }),
    ),
    catalog: {
      category: family.name,
      origin: {
        catalogId: family.id,
        variantId: variant.id,
        revision: family.catalogVersion,
        productName: `${family.name} — ${variant.name}`,
        takenAt: LIVING_STAMP,
      },
    },
  };
};

/** Living wall 3220 wide (the file's envelope): four doors of equal width, so 805 · 1610 · 805. */
export const LIVING_WIDTHS = [805, 1610, 805] as const;

/**
 * Living, re-done from the catalog (user request 2026-10-24): per row a 1-door base cabinet on the left, then a 2-door
 * and a 1-door base cabinet. The floor row stands on the floor; the ceiling row is the same three cabinets hung on wall
 * brackets, each 1730 mm above its floor cabinet (underside 2165, top 2600, as the file's SUS).
 */
export function mobilaLiving(): Project {
  const doors = [1, 2, 1] as const;
  const xs = LIVING_WIDTHS.map((_, i) => LIVING_WIDTHS.slice(0, i).reduce((a, w) => a + w, 0));
  const floor = LIVING_WIDTHS.map((width, i) =>
    item(
      `living-jos-${i + 1}`,
      fromBase(
        `mobila-jos-${i + 1}`,
        `Corp jos ${i + 1} (${doors[i]} ${doors[i] === 1 ? 'ușă' : 'uși'})`,
        doors[i],
        { width },
      ),
      xs[i],
      { kind: 'floor' },
    ),
  );
  const ceiling = LIVING_WIDTHS.map((width, i) =>
    item(
      `living-sus-${i + 1}`,
      fromBase(
        `mobila-sus-${i + 1}`,
        `Corp sus ${i + 1} (${doors[i]} ${doors[i] === 1 ? 'ușă' : 'uși'})`,
        doors[i],
        { width, mount: 'wall', mountHeight: 2165 },
      ),
      xs[i],
      { kind: 'above', baseId: `living-jos-${i + 1}`, gap: 1730, offsetX: 0 },
    ),
  );
  return {
    schemaVersion: 1,
    id: 'mobila-living',
    name: 'Mobila — Living',
    createdAt: STAMP,
    updatedAt: LIVING_STAMP,
    cutting: { kerf: 4 },
    items: [...floor, ...ceiling],
  };
}

/**
 * Pat Noi: the file's cut panels (BD-0050…BD-0055). The user decided on 2026-10-23 that the bed rails are the
 * chipboard side boards screwed to the foot board (ADR-041 amendment): the two sides (1800 × 270) stand on edge
 * behind the foot board (2040 × 270), flush with its ends, and are screwed through it. The head end stands against the
 * existing headboard panel. The headboard trim (BD-0053…0055) has no known place and stays in the pile. The upholstered
 * zone (2100 × 600 × 40) and the existing 2100 × 1100 headboard panel are not cut from board, so they are named in the
 * note, not listed. What carries the mattress is not in the file.
 */
const patNoi = (): Design => {
  const d = panelSet(
    'mobila-pat-noi',
    'Pat Noi',
    [
      {
        ...part('BD-0050-L', 'Laterală pat stânga', 1800, 270, 'pal18'),
        place: { x: 0, y: 0, z: 0, lie: 'edge-z' },
      },
      {
        ...part('BD-0050-R', 'Laterală pat dreapta', 1800, 270, 'pal18'),
        place: { x: 2022, y: 0, z: 0, lie: 'edge-z' },
      },
      {
        ...part('BD-0051', 'Cap pe picioare', 2040, 270, 'pal18'),
        place: { x: 0, y: 0, z: 1800, lie: 'edge-x' },
      },
      part('BD-0053', 'Traversă tăblie', 2100, 100, 'mdf-p110'),
      part('BD-0054', 'Poliță sus tăblie', 2100, 80, 'mdf-p110'),
      part('BD-0055', 'Poliță laterală tăblie', 450, 80, 'mdf-p110', 2),
    ],
    'Bed frame: the two side boards are screwed to the foot board (user decision 2026-10-23); the head end stands ' +
      'against the existing headboard panel. Cut sizes from the Mobila file (sides 1800, foot 2040: check against the ' +
      'mattress before cutting). Not in the file: what carries the mattress, and where the headboard trim goes (shown in ' +
      'the pile). Not cut from board, so not listed: upholstered zone 2100 × 600 × 40, existing headboard panel 2100 × 1100.',
  );
  if (d.product.kind === 'panels')
    d.product.params.joints = [
      { a: 'BD-0050-L', b: 'BD-0051', kind: 'screwed' },
      { a: 'BD-0050-R', b: 'BD-0051', kind: 'screwed' },
    ];
  return d;
};

/** Dormitor: nightstand A, two identical units, and the Pat Noi panels (positions in the room are not in the file). */
export function mobilaDormitor(): Project {
  const noptiera = design(
    'mobila-noptiera-a',
    'Noptieră A',
    carcass({
      width: 450,
      height: 400,
      depth: 332,
      frontGap: 4,
      // Fronts 446 wide; top drawer front 160, the lower one takes the rest.
      interior: { id: 'nA-in', kind: 'drawers', count: 2, heights: [mm(160), fr()], front: null },
    }),
  );
  return {
    schemaVersion: 1,
    id: 'mobila-dormitor',
    name: 'Mobila — Dormitor',
    createdAt: STAMP,
    updatedAt: STAMP,
    cutting: { kerf: 4 },
    items: [
      item('dormitor-noptiera-a', noptiera, 0, { kind: 'floor' }, 2),
      // Next to the nightstand only so the pieces do not overlap in the plan; the file has no position.
      item('dormitor-pat-noi', patNoi(), 450, { kind: 'floor' }),
    ],
  };
}

export interface SampleProject {
  id: string;
  name: string;
  description: string;
  create: () => Project;
}

export const sampleProjects: SampleProject[] = [
  {
    id: 'mobila-living',
    name: 'Mobila — Living',
    description:
      'Catalog base cabinets, 1 door + 2 doors + 1 door (805 · 1610 · 805 × 435), on the floor and the same three hung at the ceiling (underside 2165)',
    create: mobilaLiving,
  },
  {
    id: 'mobila-dormitor',
    name: 'Mobila — Dormitor',
    description:
      'Two nightstands A, 450 × 400, two drawers; Pat Noi bed frame (sides screwed to the foot board)',
    create: mobilaDormitor,
  },
];
