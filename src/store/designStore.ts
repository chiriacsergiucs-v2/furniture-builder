import { create } from 'zustand'
import { buildModel } from '../core/build'
import { findInProduct, mapProductSpace, templates, upgradeDesign, validateDesign } from '../core/design'
import { closeOutline, DEFAULT_ROOM_HEIGHT, snapCorner, type Pt, type Room } from '../core/room'
import { applyFinish, type FinishRole, type FinishScope } from '../core/finish'
import { mergeItems } from '../core/merge'
import { buildProjectModel, makeItem, planRuns, refreshRunParts, removeProjectItem, resolvePlacements, setGapLeft, type Project, type ProjectItem, type ProjectModel, type RunSettings } from '../core/project'
import type { CabinetParams, CornerParams, DeskParams, Design, FrameParams, FurnitureModel, Material, PanelParams, PanelSetParams, Space } from '../core/types'
import type { LocalTemplate } from '../core/catalog/local'

export type Tab = 'parts' | 'sheets' | 'hardware' | 'shopping' | 'checks'

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
  /** Project history (ADR-0050): one entry per user action on the project; session only. */
  projectPast: Project[]
  projectFuture: Project[]
  /** Corners tapped so far while drawing the room on the plan (ADR-0056), or null. */
  drawingRoom: Pt[] | null
  /** A piece just added and waiting to be placed by a tap on the plan (ADR-0053). */
  placingItemId: string | null
  /** The project as it was when *Edit this piece* opened; *Back to project* records one step from it. */
  editStart: Project | null
  /** Editing one variant of a local template (ADR-0034); the piece open before comes back afterwards. */
  templateEdit: { template: LocalTemplate; variantId: string; returnTo: Design } | null

  load: (d: Design, opts?: { fromStorage?: boolean }) => void
  setKerf: (kerf: number) => void
  rename: (name: string) => void
  updateCabinet: (patch: Partial<CabinetParams>) => void
  updateDesk: (patch: Partial<DeskParams>) => void
  updateCorner: (patch: Partial<CornerParams>) => void
  updatePanelSet: (patch: Partial<PanelSetParams>) => void
  updatePanel: (patch: Partial<PanelParams>) => void
  updateFrame: (patch: Partial<FrameParams>) => void
  /** Catalog metadata and guidance settings (ADR-0028, ADR-0035). */
  updateMeta: (patch: Partial<Pick<Design, 'catalog' | 'settings'>>) => void
  editTemplateVariant: (template: LocalTemplate, variantId: string) => void
  /** Leave template mode; returns the template with the edited design put back (the caller saves it), or null. */
  finishTemplateEdit: (keep: boolean) => LocalTemplate | null
  updateSpace: (id: string, fn: (s: Space) => Space) => void
  updateMaterial: (id: string, patch: Partial<Material>) => void
  addMaterial: (m: Material) => void
  /** Removes a board no part uses; returns why not otherwise (nothing changes). */
  removeMaterial: (id: string) => string | null
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
  /** Merge two touching cabinets into one (ADR-0047); returns why not, or an empty list. */
  mergeItems: (a: string, b: string) => string[]
  selectItem: (id: string | null) => void
  editItem: (id: string) => void
  backToProject: () => void
  /** Run parts (ADR-0036/0051/0058): propose again (forgets removals, turns automatic refresh on), remove one, settings. */
  suggestRunParts: () => void
  removeRunPart: (id: string) => void
  setRunSettings: (patch: Partial<RunSettings>) => void
  /** Put one board on the fronts or carcass of the selected piece, its run or the whole project (ADR-0052). */
  /** Put the piece being placed with its left-back corner at a plan point (whole mm, x and z ≥ 0), or stop placing. */
  placeAt: (x: number, z: number) => void
  stopPlacing: () => void
  /** The room (ADR-0055/0056); undefined removes it. */
  setRoom: (room: Room | undefined) => void
  startDrawRoom: () => void
  addRoomCorner: (x: number, z: number) => void
  /** Close the drawn outline into the room (keeps height and features); false when fewer than three corners. */
  finishDrawRoom: () => boolean
  cancelDrawRoom: () => void
  applyFinish: (id: string, role: FinishRole, board: Material, scope: FinishScope) => { applied: string[]; skipped: string[] }
}

const HISTORY = 100

export const useDesign = create<State>((set, get) => {
  /** Every edit goes through here: history, timestamp, rebuild. */
  const commit = (next: Design) => {
    const { design, past } = get()
    if (next === design) return
    // A copy of a brand's product stops being that brand's product once edited; its origin stays (ADR-0028).
    const debranded = next.catalog?.brand && next.catalog.origin ? { ...next, catalog: { ...next.catalog, brand: undefined } } : next
    const stamped = { ...debranded, updatedAt: new Date().toISOString() }
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
  /** Every project change goes through here: one call = one undo step (ADR-0050). */
  const commitProject = (next: Project) => {
    const prev = get().project
    // Pieces on or above others follow them (ADR-0031): stored positions always match the placements.
    // Run parts follow the pieces in the same step (ADR-0058).
    const stamped = { ...refreshRunParts(resolvePlacements(next)), updatedAt: new Date().toISOString() }
    set({ project: stamped, projectModel: buildProjectModel(stamped), projectDirtyAt: Date.now(),
      ...(prev ? { projectPast: [...get().projectPast, prev].slice(-HISTORY), projectFuture: [] } : {}) })
  }
  /** Show a project from the history: rebuild, keep the selection only if that piece still exists. */
  const showProject = (p: Project, projectPast: Project[], projectFuture: Project[]) => {
    const sel = get().selectedItemId
    set({ project: p, projectModel: buildProjectModel(p), projectPast, projectFuture, projectDirtyAt: Date.now(), placingItemId: null,
      selectedItemId: sel && p.items.some(i => i.id === sel) ? sel : null })
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
    projectPast: [],
    projectFuture: [],
    editStart: null,
    placingItemId: null,
    drawingRoom: null,
    templateEdit: null,

    load: (raw, opts) => {
      const d = upgradeDesign(raw)
      set({ design: d, model: buildModel(d), selectedId: null, highlight: [], past: [], future: [], dirtyAt: 0, pristine: !!opts?.fromStorage,
        project: null, projectModel: null, editingItemId: null, selectedItemId: null, projectPast: [], projectFuture: [], editStart: null })
    },
    pick: nodeId => {
      const { project, editingItemId, design } = get()
      if (project && !editingItemId) { set({ selectedItemId: nodeId.split(':')[0] }); return }
      set({ selectedId: nodeId === design.product.id ? null : nodeId })
    },
    openProject: raw => { const p = resolvePlacements(raw); set({ project: p, projectModel: buildProjectModel(p), editingItemId: null, selectedItemId: null, highlight: [], projectDirtyAt: 0, projectPast: [], projectFuture: [], editStart: null, placingItemId: null, drawingRoom: null }) },
    closeProject: () => set({ project: null, projectModel: null, editingItemId: null, selectedItemId: null, projectPast: [], projectFuture: [], editStart: null, placingItemId: null, drawingRoom: null }),
    updateProject: fn => { const p = get().project; if (p) commitProject(fn(p)) },
    addPiece: (d, libraryId) => {
      const p = get().project
      if (!p) return
      const item = makeItem(p, d, libraryId)
      commitProject({ ...p, items: [...p.items, item] })
      set({ selectedItemId: item.id, placingItemId: item.id })
    },
    updateItem: (id, patch) => { const p = get().project; if (p) commitProject({ ...p, items: p.items.map(i => (i.id === id ? { ...i, ...patch } : i)) }) },
    setGap: (id, gap, moveRight) => { const p = get().project; if (p) { const next = setGapLeft(p, id, gap, moveRight); if (next !== p) commitProject(next) } },
    removeItem: id => { const p = get().project; if (p) { commitProject(removeProjectItem(p, id)); set({ selectedItemId: null }) } },
    mergeItems: (a, b) => {
      const p = get().project
      if (!p) return ['No project is open.']
      const res = mergeItems(p, a, b)
      if (res.mergedId) { commitProject(res.project); set({ selectedItemId: res.mergedId }) }
      return res.issues
    },
    selectItem: id => set({ selectedItemId: id }),
    editItem: id => {
      const item = get().project?.items.find(i => i.id === id)
      if (!item) return
      const d = upgradeDesign(item.design)
      set({ editingItemId: id, design: d, model: buildModel(d), selectedId: null, highlight: [], past: [], future: [], dirtyAt: 0, pristine: true, editStart: get().project })
    },
    backToProject: () => {
      const raw = get().project
      if (!raw) return
      const start = get().editStart
      set({ editingItemId: null, selectedId: null, highlight: [], editStart: null })
      // The piece's edits are one project step (ADR-0050); a resized piece moves whatever sits on it.
      if (start && raw !== start) { set({ project: start }); commitProject(raw); return }
      const p = resolvePlacements(raw)
      set({ project: p, projectModel: buildProjectModel(p), ...(p !== raw ? { projectDirtyAt: Date.now() } : {}) })
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
    updatePanelSet: patch => {
      const d = get().design
      if (d.product.kind !== 'panels') return
      commit({ ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } })
    },
    updatePanel: patch => {
      const d = get().design
      if (d.product.kind !== 'panel') return
      commit({ ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } })
    },
    updateFrame: patch => {
      const d = get().design
      if (d.product.kind !== 'frame') return
      commit({ ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } })
    },
    updateMeta: patch => commit({ ...get().design, ...patch }),
    editTemplateVariant: (template, variantId) => {
      const v = template.family.variants.find(x => x.id === variantId)
      if (!v?.design) return
      const d = upgradeDesign(structuredClone(v.design))
      const returnTo = get().templateEdit?.returnTo ?? get().design
      set({ templateEdit: { template, variantId, returnTo }, design: d, model: buildModel(d), selectedId: null, highlight: [], past: [], future: [], dirtyAt: 0, pristine: true,
        project: null, projectModel: null, editingItemId: null, selectedItemId: null })
    },
    finishTemplateEdit: keep => {
      const te = get().templateEdit
      if (!te) return null
      const design = get().design
      const back = te.returnTo
      set({ templateEdit: null, design: back, model: buildModel(back), selectedId: null, highlight: [], past: [], future: [], dirtyAt: 0, pristine: true })
      if (!keep) return null
      const now = new Date().toISOString()
      return { ...te.template, revision: te.template.revision + 1, updatedAt: now,
        family: { ...te.template.family, variants: te.template.family.variants.map(v => (v.id === te.variantId ? { ...v, design } : v)) } }
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
    removeMaterial: id => {
      const d = get().design
      const next = { ...d, materials: d.materials.filter(m => m.id !== id) }
      if (next.materials.length === d.materials.length) return null
      if (validateDesign(next).length) return 'This board is still used by parts of the piece. Choose another board for them first.'
      commit(next)
      return null
    },
    select: id => set({ selectedId: id }),
    setHighlight: ids => set({ highlight: ids }),
    setShowFronts: v => set({ showFronts: v }),
    setExploded: v => set({ exploded: v }),
    setTab: t => set({ tab: t }),
    suggestRunParts: () => {
      const p = get().project
      if (!p) return
      const settings = { scribe: p.runSettings?.scribe ?? 0, auto: true }
      commitProject({ ...p, runSettings: settings, runPartsRemoved: [], runParts: planRuns({ ...p, runSettings: settings, runPartsRemoved: [] }).parts })
    },
    removeRunPart: id => {
      const p = get().project
      const rp = p?.runParts?.find(r => r.id === id)
      if (!p || !rp) return
      commitProject({ ...p, runParts: (p.runParts ?? []).filter(r => r.id !== id), runPartsRemoved: [...(p.runPartsRemoved ?? []), rp.key ?? rp.id] })
    },
    placeAt: (x, z) => {
      const { project: p, placingItemId: id } = get()
      const it = p?.items.find(i => i.id === id)
      set({ placingItemId: null })
      if (!p || !it) return
      const position = { ...it.position, x: Math.max(0, Math.round(x)), z: Math.max(0, Math.round(z)) }
      commitProject({ ...p, items: p.items.map(i => (i.id === it.id ? { ...i, position } : i)) })
    },
    stopPlacing: () => set({ placingItemId: null }),
    setRoom: room => {
      const p = get().project
      if (!p) return
      if (room) commitProject({ ...p, room })
      else { const { room: _r, ...rest } = p; void _r; commitProject(rest) }
    },
    startDrawRoom: () => set({ drawingRoom: [], placingItemId: null }),
    addRoomCorner: (x, z) => { const pts = get().drawingRoom; if (pts) set({ drawingRoom: [...pts, snapCorner(pts[pts.length - 1], x, z, 10, pts.length >= 2 ? pts[0] : undefined)] }) },
    finishDrawRoom: () => {
      const { drawingRoom: pts, project: p } = get()
      if (!p || !pts || pts.length < 3) return false
      set({ drawingRoom: null })
      commitProject({ ...p, room: { height: p.room?.height ?? DEFAULT_ROOM_HEIGHT, features: p.room?.features ?? [], outline: closeOutline(pts) } })
      return true
    },
    cancelDrawRoom: () => set({ drawingRoom: null }),
    applyFinish: (id, role, board, scope) => {
      const p = get().project
      if (!p) return { applied: [], skipped: [] }
      const r = applyFinish(p, id, role, board, scope)
      if (r.applied.length) commitProject(r.project)
      return { applied: r.applied, skipped: r.skipped }
    },
    setRunSettings: patch => {
      const p = get().project
      if (!p) return
      commitProject({ ...p, runSettings: { scribe: 0, auto: false, ...p.runSettings, ...patch } })
    },
    undo: () => {
      const { project, editingItemId, projectPast, projectFuture } = get()
      if (project && !editingItemId) {
        const prev = projectPast[projectPast.length - 1]
        if (prev) showProject(prev, projectPast.slice(0, -1), [project, ...projectFuture])
        return
      }
      const { past, design, future } = get()
      const prev = past[past.length - 1]
      if (!prev) return
      set({ design: prev, model: buildModel(prev), past: past.slice(0, -1), future: [design, ...future], dirtyAt: Date.now(), pristine: false })
      syncItem()
    },
    redo: () => {
      const { project, editingItemId, projectPast, projectFuture } = get()
      if (project && !editingItemId) {
        const next = projectFuture[0]
        if (next) showProject(next, [...projectPast, project], projectFuture.slice(1))
        return
      }
      const { past, design, future } = get()
      const next = future[0]
      if (!next) return
      set({ design: next, model: buildModel(next), past: [...past, design], future: future.slice(1), dirtyAt: Date.now(), pristine: false })
      syncItem()
    },
  }
})
