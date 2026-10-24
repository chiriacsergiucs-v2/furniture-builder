import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { buildModel } from '../src/core/build'
import { templates, validateDesign } from '../src/core/design'
import { buildProjectModel, makeItem, materialKey, newProject } from '../src/core/project'
import { BOX_FACES, boxUvs, defaultTile, faceMapping, fitWithin, imageFileProblem, imageRunAxis, MAX_IMAGE_BYTES, planeUvs } from '../src/core/surface'
import type { Design, MaterialImage, Panel } from '../src/core/types'
import { db, loadImage, saveImage } from '../src/persist/db'
import { useDesign } from '../src/store/designStore'

const img: MaterialImage = { id: 'img-1', name: 'oak.jpg', tileLength: 1000, tileWidth: 500 }
const withImage = (d: Design, id: string, image: unknown): Design => ({ ...d, materials: d.materials.map(m => (m.id === id ? { ...m, image } as never : m)) })
const panel = (over: Partial<Panel> = {}): Panel => ({
  id: 'p', nodeId: 'n', role: 'side', label: 'Side', materialId: 'pal18',
  box: { x: 0, y: 0, z: 0, w: 18, h: 2000, d: 600 }, thicknessAxis: 'x', grainAxis: 'y', banded: [], ...over,
})

describe('picked files (ADR-0048)', () => {
  it('accepts PNG, JPEG and WebP within the size limit; anything else is a message, never a throw', () => {
    expect(imageFileProblem({ name: 'a.png', type: 'image/png', size: 1000 })).toBeNull()
    expect(imageFileProblem({ name: 'a.webp', type: 'image/webp', size: 1000 })).toBeNull()
    expect(imageFileProblem({ name: 'a.jpg', type: 'image/jpeg', size: MAX_IMAGE_BYTES })).toBeNull()
    expect(imageFileProblem({ name: 'notes.pdf', type: 'application/pdf', size: 1000 })).toMatch(/not a PNG, JPEG or WebP/)
    expect(imageFileProblem({ name: 'x.gif', type: 'image/gif', size: 1000 })).toMatch(/not a PNG/)
    expect(imageFileProblem({ name: 'a.jpg', type: 'image/jpeg', size: 0 })).toMatch(/empty/)
    expect(imageFileProblem({ name: 'a.jpg', type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 })).toMatch(/larger than/)
  })
  it('scales large pictures down to 2048 px on the longest edge, keeps proportions, never scales up', () => {
    expect(fitWithin(4096, 3072)).toEqual({ w: 2048, h: 1536 })
    expect(fitWithin(1000, 8000)).toEqual({ w: 256, h: 2048 })
    expect(fitWithin(640, 480)).toEqual({ w: 640, h: 480 })
    expect(fitWithin(100000, 1)).toEqual({ w: 2048, h: 1 })
  })
  it('one picture first covers 1000 mm along its width, in proportion', () => {
    expect(defaultTile(2048, 1024)).toEqual({ tileLength: 1000, tileWidth: 500 })
    expect(defaultTile(300, 900)).toEqual({ tileLength: 1000, tileWidth: 3000 })
  })
})

describe('designs with a picture', () => {
  const d = templates[0].create()
  it('a valid picture reference passes validation and changes no part', () => {
    const p = withImage(d, 'pal18', img)
    expect(validateDesign(p)).toEqual([])
    expect(validateDesign(JSON.parse(JSON.stringify(p)))).toEqual([])
    expect(buildModel(p).panels).toEqual(buildModel(d).panels)
  })
  it('a bad picture reference is reported, not thrown', () => {
    for (const bad of [null, 'oak', { ...img, tileLength: 0 }, { ...img, tileWidth: 2.5 }, { ...img, id: '' }, { ...img, turn: 'yes' }]) {
      expect(() => validateDesign(withImage(d, 'pal18', bad))).not.toThrow()
      expect(validateDesign(withImage(d, 'pal18', bad)).join()).toMatch(/Invalid picture for PAL 18 white/)
    }
  })
  it('in a project, the same board with and without a picture are different decors', () => {
    const base = d.materials.find(m => m.id === 'pal18')!
    expect(materialKey(base)).not.toBe(materialKey({ ...base, image: img }))
    expect(materialKey(base)).toBe('mat:PAL 18 white|18|plain')
    let pr = newProject()
    pr = { ...pr, items: [makeItem(pr, d), makeItem(pr, withImage(d, 'pal18', img))] }
    const mats = buildProjectModel(pr).materials.filter(m => m.name === 'PAL 18 white')
    expect(mats.map(m => m.image?.id ?? null).sort()).toEqual(['img-1', null].sort())
  })
})

describe('laying the picture on a part', () => {
  it('runs along the grain axis, or across it when turned', () => {
    expect(imageRunAxis(panel(), img)).toBe('y')
    expect(imageRunAxis(panel(), { ...img, turn: true })).toBe('z')
    expect(imageRunAxis(panel({ thicknessAxis: 'y', grainAxis: 'x' }), { ...img, turn: true })).toBe('z')
  })
  it('one picture covers tileLength along the run axis and tileWidth across, on every face', () => {
    const p = panel()
    // Face spanned by z (s) and y (t): the run axis y is t, so the picture's width follows t.
    expect(faceMapping(p, img, 'z', 'y')).toEqual({ u: [0, 1 / 500], v: [1 / 1000, 0] })
    // Turned: run axis z is s.
    expect(faceMapping(p, { ...img, turn: true }, 'z', 'y')).toEqual({ u: [1 / 1000, 0], v: [0, 1 / 500] })
    // End face (x, z) does not contain y: the picture runs along z, not the 18 mm thickness.
    expect(faceMapping(p, img, 'x', 'z')).toEqual({ u: [0, 1 / 500], v: [1 / 1000, 0] })
  })
  it('box texture coordinates: 6 faces × 4 corners, scaled to the part in mm', () => {
    const p = panel()
    const uv = boxUvs(p, img)
    expect(uv).toHaveLength(48)
    expect(BOX_FACES.map(f => f.face)).toEqual(['+x', '-x', '+y', '-y', '+z', '-z'])
    // +x face, corner (s=1, t=1): 600 mm along z, 2000 mm along y → 2 pictures along the grain, 1.2 across.
    expect([uv[2], uv[3]]).toEqual([2, 1.2])
    expect([uv[4], uv[5]]).toEqual([0, 0])
    // Twice the tile → half the repeats.
    const big = boxUvs(p, { ...img, tileLength: 2000, tileWidth: 1000 })
    expect([big[2], big[3]]).toEqual([1, 0.6])
  })
  it('outline points map the same way as box faces', () => {
    const p = panel({ thicknessAxis: 'z', grainAxis: 'y', box: { x: 0, y: 0, z: 0, w: 600, h: 720, d: 18 } })
    expect(planeUvs(p, img, 'x', 'y', [600, 720, 0, 0])).toEqual([720 / 1000, 600 / 500, 0, 0])
  })
})

describe('pictures on this device', () => {
  it('saved bytes come back; a missing or unreadable row reads as absent and is kept', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]).buffer
    await saveImage({ id: 'img-a', name: 'a.jpg', type: 'image/jpeg', width: 2, height: 1, bytes, createdAt: '2026-10-24T00:00:00.000Z' })
    const got = await loadImage('img-a')
    expect(got?.name).toBe('a.jpg')
    expect(new Uint8Array(got!.bytes)).toEqual(new Uint8Array([1, 2, 3, 4]))
    expect(await loadImage('nope')).toBeUndefined()
    await db.images.put({ id: 'img-bad', name: 'x', type: 'image/jpeg', width: 1, height: 1, bytes: 'not bytes' as never, createdAt: '' })
    expect(await loadImage('img-bad')).toBeUndefined()
    expect(await db.images.get('img-bad')).toBeDefined()
    expect(db.verno).toBe(7)
  })
})

describe('upgrading to version 6', () => {
  it('a version-4 database keeps every design, project, template and research row', async () => {
    const name = 'fb-upgrade-v5'
    const old = new Dexie(name)
    old.version(4).stores({ designs: 'id, updatedAt, name', projects: 'id, updatedAt, name', templates: 'id, updatedAt', researchDocs: 'key, docId', researchMarks: 'id, updatedAt' })
    const d = templates[0].create()
    await old.table('designs').put({ id: d.id, name: d.name, updatedAt: d.updatedAt, design: d })
    await old.table('projects').put({ id: 'p1', name: 'P', updatedAt: d.updatedAt, project: { broken: true } })
    await old.table('templates').put({ id: 't1', updatedAt: d.updatedAt, template: { broken: true } })
    await old.table('researchMarks').put({ id: 'm1', updatedAt: d.updatedAt })
    old.close()
    const Db = db.constructor as new (n: string) => typeof db
    const fresh = new Db(name)
    await fresh.open()
    expect(fresh.verno).toBe(7)
    expect([await fresh.designs.count(), await fresh.projects.count(), await fresh.templates.count(), await fresh.researchMarks.count(), await fresh.images.count(), await fresh.decors.count()]).toEqual([1, 1, 1, 1, 0, 0])
    expect((await fresh.designs.get(d.id))?.design).toEqual(d)
    fresh.close()
  })
})

describe('removing a board', () => {
  it('removes an unused board, refuses one parts still use', () => {
    useDesign.getState().load(templates[0].create())
    const st = () => useDesign.getState()
    st().addMaterial({ id: 'spare', name: 'Spare', thickness: 18, grain: false, color: '#ffffff', image: img })
    expect(st().design.materials.some(m => m.id === 'spare')).toBe(true)
    expect(st().removeMaterial('spare')).toBeNull()
    expect(st().design.materials.some(m => m.id === 'spare')).toBe(false)
    const before = st().design
    expect(st().removeMaterial('pal18')).toMatch(/still used/)
    expect(st().design).toBe(before)
  })
})
