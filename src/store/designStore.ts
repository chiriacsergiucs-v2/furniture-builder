import { create } from 'zustand'
import { buildModel } from '../core/build'
import { findInProduct, mapProductSpace, templates } from '../core/design'
import type { CabinetParams, DeskParams, Design, FurnitureModel, Material, Space } from '../core/types'

export type Tab = 'parts' | 'hardware' | 'checks'

interface State {
  design: Design
  model: FurnitureModel
  /** Selected space id, or null for the whole piece. */
  selectedId: string | null
  /** Panels highlighted from the parts list. */
  highlight: string[]
  showFronts: boolean
  tab: Tab
  past: Design[]
  future: Design[]
  dirtyAt: number

  load: (d: Design) => void
  rename: (name: string) => void
  updateCabinet: (patch: Partial<CabinetParams>) => void
  updateDesk: (patch: Partial<DeskParams>) => void
  updateSpace: (id: string, fn: (s: Space) => Space) => void
  updateMaterial: (id: string, patch: Partial<Material>) => void
  addMaterial: (m: Material) => void
  select: (id: string | null) => void
  setHighlight: (ids: string[]) => void
  setShowFronts: (v: boolean) => void
  setTab: (t: Tab) => void
  undo: () => void
  redo: () => void
}

const HISTORY = 100

export const useDesign = create<State>((set, get) => {
  /** Every edit goes through here: history, timestamp, rebuild. */
  const commit = (next: Design) => {
    const { design, past } = get()
    if (next === design) return
    const stamped = { ...next, updatedAt: new Date().toISOString() }
    set({
      design: stamped, model: buildModel(stamped),
      past: [...past, design].slice(-HISTORY), future: [], dirtyAt: Date.now(),
    })
    const sel = get().selectedId
    if (sel && !findInProduct(stamped.product, sel)) set({ selectedId: null })
  }
  const initial = templates[0].create()
  return {
    design: initial,
    model: buildModel(initial),
    selectedId: null,
    highlight: [],
    showFronts: true,
    tab: 'parts',
    past: [],
    future: [],
    dirtyAt: 0,

    load: d => set({ design: d, model: buildModel(d), selectedId: null, highlight: [], past: [], future: [], dirtyAt: 0 }),
    rename: name => commit({ ...get().design, name }),
    updateCabinet: patch => {
      const d = get().design
      if (d.product.kind !== 'cabinet') return
      commit({ ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } })
    },
    updateDesk: patch => {
      const d = get().design
      if (d.product.kind !== 'desk') return
      commit({ ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } })
    },
    updateSpace: (id, fn) => {
      const d = get().design
      const product = mapProductSpace(d.product, id, fn)
      if (product !== d.product) commit({ ...d, product })
    },
    updateMaterial: (id, patch) => {
      const d = get().design
      commit({ ...d, materials: d.materials.map(m => (m.id === id ? { ...m, ...patch } : m)) })
    },
    addMaterial: m => { const d = get().design; commit({ ...d, materials: [...d.materials, m] }) },
    select: id => set({ selectedId: id }),
    setHighlight: ids => set({ highlight: ids }),
    setShowFronts: v => set({ showFronts: v }),
    setTab: t => set({ tab: t }),
    undo: () => {
      const { past, design, future } = get()
      const prev = past[past.length - 1]
      if (!prev) return
      set({ design: prev, model: buildModel(prev), past: past.slice(0, -1), future: [design, ...future], dirtyAt: Date.now() })
    },
    redo: () => {
      const { past, design, future } = get()
      const next = future[0]
      if (!next) return
      set({ design: next, model: buildModel(next), past: [...past, design], future: future.slice(1), dirtyAt: Date.now() })
    },
  }
})
