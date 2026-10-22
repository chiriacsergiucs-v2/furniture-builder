import { create } from 'zustand'
import { buildModel } from '../core/build'
import { findInProduct, mapProductSpace, templates, upgradeDesign } from '../core/design'
import { buildProjectModel, makeItem, setGapLeft, type Project, type ProjectItem, type ProjectModel } from '../core/project'
import type { CabinetParams, CornerParams, DeskParams, Design, FurnitureModel, Material, Space } from '../core/types'

export type Tab = 'parts' | 'sheets' | 'hardware' | 'checks'

interface State {
  design: Design
  model: FurnitureModel
  /** Selected space id, or null for the whole piece. */
  selectedId: string | null
  /** Panels highlighted from the parts list. */
  highlight: string[]
  showFronts: boolean
  /** 3D preview with the panels pushed apart (display only). */
  exploded: boolean
  tab: Tab
  past: Design[]
  future: Design[]
  dirtyAt: number
  /** Opened from storage and not edited since: autosave leaves the stored row alone (ADR-0019). */
  pristine: boolean
  /** Open project (ADR-0022), or null when editing a single saved piece. */
  project: Project | null
  projectModel: ProjectModel | null
  /** Piece of the project being edited in the piece editor. */
  editingItemId: string | null
  /** Piece selected in the project view. */
  selectedItemId: string | null
  projectDirtyAt: number

  load: (d: Design, opts?: { fromStorage?: boolean }) => void
  setKerf: (kerf: number) => void
  rename: (name: string) => void
  updateCabinet: (patch: Partial<CabinetParams>) => void
  updateDesk: (patch: Partial<DeskParams>) => void
  updateCorner: (patch: Partial<CornerParams>) => void
  updateSpace: (id: string, fn: (s: Space) => Space) => void
  updateMaterial: (id: string, patch: Partial<Material>) => void
  addMaterial: (m: Material) => void
  select: (id: string | null) => void
  setHighlight: (ids: string[]) => void
  setShowFronts: (v: boolean) => void
  setExploded: (v: boolean) => void
  setTab: (t: Tab) => void
  undo: () => void
  redo: () => void
  /** 3D click: selects a space (piece editor) or a piece (project view). */
  pick: (nodeId: string) => void
  openProject: (p: Project) => void
  closeProject: () => void
  updateProject: (fn: (p: Project) => Project) => void
  addPiece: (d: Design, libraryId?: string) => void
  updateItem: (id: string, patch: Partial<ProjectItem>) => void
  setGap: (id: string, gap: number, moveRight: boolean) => void
  removeItem: (id: string) => void
  selectItem: (id: string | null) => void
  editItem: (id: string) => void
  backToProject: () => void
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
      past: [...past, design].slice(-HISTORY), future: [], dirtyAt: Date.now(), pristine: false,
    })
    const sel = get().selectedId
    if (sel && !findInProduct(stamped.product, sel)) set({ selectedId: null })
    // Editing a project piece: the change lives in the project's embedded copy, never the library (ADR-0022).
    const { project, editingItemId } = get()
    if (project && editingItemId) {
      set({ project: { ...project, updatedAt: stamped.updatedAt, items: project.items.map(i => (i.id === editingItemId ? { ...i, design: stamped } : i)) }, projectDirtyAt: Date.now() })
    }
  }
  /** Keep the project's embedded copy in step with the piece editor (undo/redo included). */
  const syncItem = () => {
    const { project, editingItemId, design } = get()
    if (project && editingItemId) set({ project: { ...project, items: project.items.map(i => (i.id === editingItemId ? { ...i, design } : i)) }, projectDirtyAt: Date.now() })
  }
  const commitProject = (next: Project) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() }
    set({ project: stamped, projectModel: buildProjectModel(stamped), projectDirtyAt: Date.now() })
  }
  const initial = templates[0].create()
  return {
    design: initial,
    model: buildModel(initial),
    selectedId: null,
    highlight: [],
    showFronts: true,
    exploded: false,
    tab: 'parts',
    past: [],
    future: [],
    dirtyAt: 0,
    pristine: false,
    project: null,
    projectModel: null,
    editingItemId: null,
    selectedItemId: null,
    projectDirtyAt: 0,

    load: (raw, opts) => {
      const d = upgradeDesign(raw)
      set({ design: d, model: buildModel(d), selectedId: null, highlight: [], past: [], future: [], dirtyAt: 0, pristine: !!opts?.fromStorage,
        project: null, projectModel: null, editingItemId: null, selectedItemId: null })
    },
    pick: nodeId => {
      const { project, editingItemId, design } = get()
      if (project && !editingItemId) { set({ selectedItemId: nodeId.split(':')[0] }); return }
      set({ selectedId: nodeId === design.product.id ? null : nodeId })
    },
    openProject: p => set({ project: p, projectModel: buildProjectModel(p), editingItemId: null, selectedItemId: null, highlight: [], projectDirtyAt: 0 }),
    closeProject: () => set({ project: null, projectModel: null, editingItemId: null, selectedItemId: null }),
    updateProject: fn => { const p = get().project; if (p) commitProject(fn(p)) },
    addPiece: (d, libraryId) => {
      const p = get().project
      if (!p) return
      const item = makeItem(p, d, libraryId)
      commitProject({ ...p, items: [...p.items, item] })
      set({ selectedItemId: item.id })
    },
    updateItem: (id, patch) => { const p = get().project; if (p) commitProject({ ...p, items: p.items.map(i => (i.id === id ? { ...i, ...patch } : i)) }) },
    setGap: (id, gap, moveRight) => { const p = get().project; if (p) { const next = setGapLeft(p, id, gap, moveRight); if (next !== p) commitProject(next) } },
    removeItem: id => { const p = get().project; if (p) { commitProject({ ...p, items: p.items.filter(i => i.id !== id) }); set({ selectedItemId: null }) } },
    selectItem: id => set({ selectedItemId: id }),
    editItem: id => {
      const item = get().project?.items.find(i => i.id === id)
      if (!item) return
      const d = upgradeDesign(item.design)
      set({ editingItemId: id, design: d, model: buildModel(d), selectedId: null, highlight: [], past: [], future: [], dirtyAt: 0, pristine: true })
    },
    backToProject: () => {
      const p = get().project
      if (!p) return
      set({ editingItemId: null, projectModel: buildProjectModel(p), selectedId: null, highlight: [] })
    },
    setKerf: kerf => { const d = get().design; commit({ ...d, cutting: { ...d.cutting, kerf } }) },
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
    updateCorner: patch => {
      const d = get().design
      if (d.product.kind !== 'corner') return
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
    setExploded: v => set({ exploded: v }),
    setTab: t => set({ tab: t }),
    undo: () => {
      const { past, design, future } = get()
      const prev = past[past.length - 1]
      if (!prev) return
      set({ design: prev, model: buildModel(prev), past: past.slice(0, -1), future: [design, ...future], dirtyAt: Date.now(), pristine: false })
      syncItem()
    },
    redo: () => {
      const { past, design, future } = get()
      const next = future[0]
      if (!next) return
      set({ design: next, model: buildModel(next), past: [...past, design], future: future.slice(1), dirtyAt: Date.now(), pristine: false })
      syncItem()
    },
  }
})
