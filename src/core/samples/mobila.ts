/**
 * The Mobila rooms, rebuilt as native projects from the project file `MOBILA_TOATE_CAMERELE_AI_CAD_PAL_MDF.json`
 * (format 2.0.0, 2026-10-22). Every size below is taken from that file; where the app builds a part differently
 * from the file, `docs/samples/mobila.md` lists the difference. Nothing here is invented: unknown values (backs,
 * plinths, drawer box boards) use the app's own defaults and are listed there as open.
 *
 * The Pat Noi bed is known only as cut panels, without positions ("UNPLACED_DO_NOT_INVENT" in the file), so it is a
 * panel set (ADR-0032): listed for cutting, never assembled here. The kitchen splashback (left out at the user's
 * request), the RHS workbench (an envelope with no member list) and the variants the file marks as not for production
 * (nightstand B, the simplified bed) are not built.
 */
import { defaultDrawers, defaultMaterials, fr, mm } from '../design'
import type { Placement, Project, ProjectItem } from '../project'
import type { CabinetParams, Design, LoosePanel, Material, Product, Space } from '../types'

const STAMP = '2026-10-22T00:00:00.000Z'

/** Boards named as in the file. Sheet sizes from "Estimare servicii Salice.txt": PAL 2800 × 2070, MDF 2800 × 1220. */
const materials = (): Material[] => {
  const base = defaultMaterials()
  const keep = base.filter(m => m.id === 'pal16' || m.id === 'hdf3')
  return [
    { id: 'pal18', name: 'PAL 18 mm', thickness: 18, grain: false, color: '#e7e3db', sheet: { length: 2800, width: 2070, trim: 10, count: null } },
    { id: 'mdf-p110', name: 'MDF Kastamonu P110 antracit lucios 18 mm', thickness: 18, grain: false, color: '#3b3f44', sheet: { length: 2800, width: 1220, trim: 10, count: null } },
    ...keep,
  ]
}

/** Carcass settings shared by every Mobila piece: PAL body, P110 fronts, no back, no plinth (none in the file). */
const carcass = (over: Partial<CabinetParams> & Pick<CabinetParams, 'width' | 'height' | 'depth' | 'interior'>): CabinetParams => ({
  bodyMaterialId: 'pal18', frontMaterialId: 'mdf-p110', backMaterialId: 'hdf3',
  top: 'over', bottom: 'between', back: 'none', backInset: 15, plinthHeight: 0, plinthSetback: 0,
  frontGap: 2, frontStyle: 'overlay', shelfSetback: 0, shelfClearance: 1, pinRowSetback: 37,
  drawers: defaultDrawers(),
  ...over,
})

const design = (id: string, name: string, params: CabinetParams): Design => wrap(id, name, { kind: 'cabinet', id: `${id}-p`, params })

const wrap = (id: string, name: string, product: Product, mats = materials()): Design => ({
  schemaVersion: 2, id, name, createdAt: STAMP, updatedAt: STAMP, materials: mats, product, cutting: { kerf: 4 },
})

/** A panel set: part ids are the file's part ids, so the cut list can be traced back to it. */
const panelSet = (id: string, name: string, panels: LoosePanel[], note: string, mats?: Material[]): Design =>
  wrap(id, name, { kind: 'panels', id: `${id}-p`, params: { panels, note } }, mats)

const part = (id: string, name: string, length: number, width: number, materialId: string, quantity = 1): LoosePanel =>
  ({ id, name, length, width, materialId, quantity })

const bay = (id: string, shelves: number): Space => ({ id, kind: 'shelves', count: shelves, front: { kind: 'doors', count: 1 } })

/**
 * A row of five bays (JOS and SUS): top and bottom 2685 run over the sides, four uprights 399 high,
 * bays 510 · 519 · 519 · 519 · 510, one fixed shelf and one door per bay.
 */
const run = (id: string): Space => ({
  id, kind: 'split', axis: 'x', sizes: [mm(510), fr(), fr(), fr(), mm(510)], front: null,
  children: [1, 2, 3, 4, 5].map(i => bay(`${id}-b${i}`, 1)),
})

const item = (id: string, d: Design, x: number, placement: Placement, quantity = 1): ProjectItem =>
  ({ id, design: d, quantity, position: { x, y: 0, z: 0 }, rotationY: 0, placement })

/** Living_2026_535: the tall column on the left, the low run on the floor and the high run hung above it. */
export function mobilaLiving(): Project {
  const coloana = design('mobila-coloana', 'Coloana', carcass({
    width: 535, height: 2600, depth: 400, top: 'between', bottom: 'between',
    // Upper compartment 410 high behind its own door; four shelves behind the tall door below the fixed shelf.
    interior: {
      id: 'col-in', kind: 'split', axis: 'y', sizes: [mm(410), fr()], front: null,
      children: [
        { id: 'col-sus', kind: 'shelves', count: 0, front: { kind: 'doors', count: 1 } },
        { id: 'col-jos', kind: 'shelves', count: 4, front: { kind: 'doors', count: 1 } },
      ],
    },
  }))
  const jos = design('mobila-jos', 'Corp jos (JOS)', carcass({ width: 2685, height: 435, depth: 400, bottom: 'under', interior: run('jos-in') }))
  const sus = design('mobila-sus', 'Corp sus (SUS)', carcass({ width: 2685, height: 435, depth: 400, bottom: 'under', mount: 'wall', mountHeight: 2165, interior: run('sus-in') }))
  return {
    schemaVersion: 1, id: 'mobila-living', name: 'Mobila — Living', createdAt: STAMP, updatedAt: STAMP, cutting: { kerf: 4 },
    items: [
      item('living-coloana', coloana, 0, { kind: 'floor' }),
      item('living-jos', jos, 535, { kind: 'floor' }),
      // SUS bottom at 2165 in the file: 1730 mm above the 435 mm JOS.
      item('living-sus', sus, 535, { kind: 'above', baseId: 'living-jos', gap: 1730, offsetX: 0 }),
    ],
  }
}

/**
 * Pat Noi: the file's cut panels (BD-0050…BD-0055). The upholstered zone (2100 × 600 × 40, textile and foam) and the
 * existing 2100 × 1100 headboard panel are not cut from board, so they are named in the note, not listed.
 */
const patNoi = (): Design => panelSet('mobila-pat-noi', 'Pat Noi', [
  part('BD-0050', 'Laterală pat', 1800, 270, 'pal18', 2),
  part('BD-0051', 'Cap pe picioare', 2040, 270, 'pal18'),
  part('BD-0053', 'Traversă tăblie', 2100, 100, 'mdf-p110'),
  part('BD-0054', 'Poliță sus tăblie', 2100, 80, 'mdf-p110'),
  part('BD-0055', 'Poliță laterală tăblie', 450, 80, 'mdf-p110', 2),
], 'Bed for an 1800 × 2000 mattress. Cut sizes from the Mobila file; how the panels join is not in the file. ' +
  'Not cut from board, so not listed: upholstered zone 2100 × 600 × 40 (textile and foam), existing headboard panel 2100 × 1100.')

/** Dormitor: nightstand A, two identical units, and the Pat Noi panels (positions in the room are not in the file). */
export function mobilaDormitor(): Project {
  const noptiera = design('mobila-noptiera-a', 'Noptieră A', carcass({
    width: 450, height: 400, depth: 332, frontGap: 4,
    // Fronts 446 wide; top drawer front 160, the lower one takes the rest.
    interior: { id: 'nA-in', kind: 'drawers', count: 2, heights: [mm(160), fr()], front: null },
  }))
  return {
    schemaVersion: 1, id: 'mobila-dormitor', name: 'Mobila — Dormitor', createdAt: STAMP, updatedAt: STAMP, cutting: { kerf: 4 },
    items: [
      item('dormitor-noptiera-a', noptiera, 0, { kind: 'floor' }, 2),
      // Next to the nightstand only so the pieces do not overlap in the plan; the file has no position.
      item('dormitor-pat-noi', patNoi(), 450, { kind: 'floor' }),
    ],
  }
}

export interface SampleProject { id: string; name: string; description: string; create: () => Project }

export const sampleProjects: SampleProject[] = [
  { id: 'mobila-living', name: 'Mobila — Living', description: 'Column 535 × 2600, low run 2685 × 435 on the floor, high run hung 1730 mm above it', create: mobilaLiving },
  { id: 'mobila-dormitor', name: 'Mobila — Dormitor', description: 'Two nightstands A, 450 × 400, two drawers; Pat Noi bed panels (not assembled)', create: mobilaDormitor },
]
