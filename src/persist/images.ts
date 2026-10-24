import { useEffect, useState } from 'react'
import { newId } from '../core/design'
import { defaultTile, fitWithin, imageFileProblem } from '../core/surface'
import type { MaterialImage } from '../core/types'
import { loadImage, saveImage } from './db'

/**
 * Pictures for materials (ADR-0048), browser side: import a file the user picked, and share one object URL per
 * stored picture between the views. Nothing is uploaded; problems come back as messages, never as exceptions.
 */
export type ImportResult = { ok: true; image: MaterialImage; color: string } | { ok: false; problem: string }

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0')

export async function importImage(file: File): Promise<ImportResult> {
  const problem = imageFileProblem(file)
  if (problem) return { ok: false, problem }
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file) } catch { return { ok: false, problem: `${file.name} could not be read as a picture.` } }
  try {
    const { w, h } = fitWithin(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return { ok: false, problem: 'This browser cannot prepare pictures.' }
    ctx.drawImage(bitmap, 0, 0, w, h)
    // Average colour: the plain colour used where pictures are not drawn (cut sheets, catalog pictures).
    const one = document.createElement('canvas')
    one.width = 1; one.height = 1
    const c1 = one.getContext('2d')
    c1?.drawImage(canvas, 0, 0, 1, 1)
    const px = c1?.getImageData(0, 0, 1, 1).data
    const color = px ? `#${hex(px[0])}${hex(px[1])}${hex(px[2])}` : '#cccccc'
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.9))
    if (!blob) return { ok: false, problem: `${file.name} could not be prepared.` }
    const id = `img-${newId()}${newId()}`
    await saveImage({ id, name: file.name, type: blob.type || 'image/jpeg', width: w, height: h, bytes: await blob.arrayBuffer(), createdAt: new Date().toISOString() })
    return { ok: true, image: { id, name: file.name, ...defaultTile(w, h) }, color }
  } catch {
    return { ok: false, problem: `${file.name} could not be saved on this device.` }
  } finally {
    bitmap.close()
  }
}

/** 'missing': no readable picture with that id on this device. */
export type ImageUrl = string | 'missing'

const cache = new Map<string, { refs: number; url?: ImageUrl; wait: Promise<ImageUrl> }>()

function acquire(id: string): Promise<ImageUrl> {
  const hit = cache.get(id)
  if (hit) { hit.refs++; return hit.wait }
  const entry: { refs: number; url?: ImageUrl; wait: Promise<ImageUrl> } = { refs: 1, wait: Promise.resolve('missing') }
  entry.wait = loadImage(id).then(
    row => (row ? URL.createObjectURL(new Blob([row.bytes], { type: row.type })) : 'missing'),
    () => 'missing' as const,
  ).then(url => {
    entry.url = url
    // Released while loading: free it straight away.
    if (entry.refs <= 0 && url !== 'missing') URL.revokeObjectURL(url)
    return url
  })
  cache.set(id, entry)
  return entry.wait
}

function release(id: string) {
  const e = cache.get(id)
  if (!e) return
  if (--e.refs > 0) return
  cache.delete(id)
  if (e.url && e.url !== 'missing') URL.revokeObjectURL(e.url)
}

/**
 * Object URLs for the given picture ids, loaded from this device; released when no view uses them any more.
 * `ids` should be a stable, sorted key (joined with ',') so the effect runs only when the set changes.
 */
export function useImageUrls(key: string): Map<string, ImageUrl> {
  const [urls, setUrls] = useState<{ key: string; map: Map<string, ImageUrl> }>({ key: '', map: new Map() })
  useEffect(() => {
    const ids = key ? key.split(',') : []
    let live = true
    Promise.all(ids.map(id => acquire(id).then(u => [id, u] as const))).then(pairs => { if (live) setUrls({ key, map: new Map(pairs) }) })
    return () => { live = false; ids.forEach(release) }
  }, [key])
  return urls.key === key ? urls.map : EMPTY
}
const EMPTY = new Map<string, ImageUrl>()

/** Sorted, de-duplicated picture ids of the materials, as the key `useImageUrls` takes. */
export const imageKey = (materials: { image?: MaterialImage }[]) =>
  [...new Set(materials.flatMap(m => (m.image ? [m.image.id] : [])))].sort().join(',')
