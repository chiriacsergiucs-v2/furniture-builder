import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { leftNeighbour, placementBases, suggestRunParts, type Placement, type ProjectItem, type ProjectModel, type QuarterTurn } from '../core/project'
import type { Panel } from '../core/types'
import { listDesigns, loadDesign, type StoredDesign } from '../persist/db'
import { useDesign } from '../store/designStore'
import { Counter, MmField, Segmented, Select, Toggle } from './controls'
import { Dim, DimV } from './Elevation'
import { Icon } from './icons'
import { templateGlyph } from './Templates'
import { StartFrom } from './Catalog'

const FRONT_SIDE: Record<QuarterTurn, string> = { 0: 'front faces you', 90: 'front faces right', 180: 'front faces the back wall', 270: 'front faces left' }

/** Left panel in the project view: the pieces, and the one selected (ADR-0022). */
export function ProjectPanel({ onAdd }: { onAdd: () => void }) {
  const project = useDesign(s => s.project)!
  const pm = useDesign(s => s.projectModel)
  const selectedId = useDesign(s => s.selectedItemId)
  const select = useDesign(s => s.selectItem)
  const update = useDesign(s => s.updateItem)
  const remove = useDesign(s => s.removeItem)
  const edit = useDesign(s => s.editItem)
  const updateProject = useDesign(s => s.updateProject)
  const setGap = useDesign(s => s.setGap)
  const [libMsg, setLibMsg] = useState<string | null>(null)
  const [moveRight, setMoveRight] = useState(true)
  const item = project.items.find(i => i.id === selectedId)
  const left = useMemo(() => (selectedId ? leftNeighbour(project, selectedId) : null), [project, selectedId])
  const piece = pm?.pieces.find(p => p.item.id === selectedId)

  const updateFromLibrary = async () => {
    if (!item?.libraryId) return
    const d = await loadDesign(item.libraryId).catch(() => undefined)
    if (!d) { setLibMsg('The saved piece this came from no longer exists.'); return }
    if (!confirm(`Replace “${item.design.name}” in this project with the current saved version? Position, turn and quantity stay.`)) return
    update(item.id, { design: structuredClone(d) })
    setLibMsg('Updated from the saved piece.')
  }

  return (
    <div className="inspector">
      <header className="insp-head">
        <h2>Project</h2>
        <p className="hint">Pieces are cut and bought together. Each piece is a copy; editing it here never changes your saved pieces.</p>
      </header>
      {project.items.length === 0 ? (
        <p className="empty center"><Icon name="project" />No pieces yet. Add a cabinet, a corner unit or a desk to start.</p>
      ) : (
        <ul className="pieces">
          {project.items.map(i => {
            const b = pm?.pieces.find(p => p.item.id === i.id)?.bounds
            return (
              <li key={i.id}>
                <button type="button" className={`row-btn ${i.id === selectedId ? 'on' : ''}`} aria-pressed={i.id === selectedId} onClick={() => select(i.id)}>
                  <span><strong>{i.quantity > 1 ? `${i.quantity} × ` : ''}{i.design.name}</strong>{b && <span className="sub num">{b.w} × {b.h} × {b.d} mm</span>}</span>
                  <Icon name="chevron-right" className="chev sm" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <button type="button" className="btn outline block" onClick={onAdd}><Icon name="plus" />Add a piece</button>
      <RunParts />

      {item && (
        <section className="piece-edit section" aria-label={`Selected piece: ${item.design.name}`}>
          <div className="card-title"><span>Selected piece</span></div>
          <h3>{item.design.name}</h3>
          <div className="split-actions">
            <button type="button" className="btn solid" onClick={() => edit(item.id)}><Icon name="pencil" className="sm" />Edit this piece</button>
            {item.libraryId && <button type="button" className="btn outline" onClick={updateFromLibrary}>Update from saved piece</button>}
          </div>
          {libMsg && <p className="hint" role="status">{libMsg}</p>}
          <Counter label="How many" value={item.quantity} min={1} max={99} onChange={v => update(item.id, { quantity: v })} />
          {item.quantity > 1 && <p className="hint">Copies are added to parts, sheets and hardware; one is shown in the room.</p>}
          <Segmented<QuarterTurn> label="Turn" value={item.rotationY}
            options={[{ value: 0, label: '0°' }, { value: 90, label: '90°' }, { value: 180, label: '180°' }, { value: 270, label: '270°' }]}
            onChange={v => update(item.id, { rotationY: v })} />
          <p className="hint">{FRONT_SIDE[item.rotationY]}</p>
          <PlacementFields item={item} />
          {item.placement?.kind === 'above' ? null : left ? (
            <>
              <MmField label={`Gap to ${left.item.design.name} on the left`} value={left.gap} min={0} max={5000}
                onChange={v => setGap(item.id, v, moveRight)} />
              <Toggle label="Move the pieces on its right too" checked={moveRight} onChange={setMoveRight} />
            </>
          ) : <p className="hint">No piece on its left at this height; set “From left” to place it.</p>}
          {piece && <p className="hint">Takes {piece.bounds.w} × {piece.bounds.d} mm of floor, {piece.bounds.h} mm high.</p>}
          <button type="button" className="danger-link" onClick={() => { if (confirm(`Remove “${item.design.name}” from this project?`)) remove(item.id) }}>Remove from project</button>
        </section>
      )}

      <MmField label="Saw cut (kerf) for this project" value={project.cutting?.kerf ?? 4} min={0} max={20} step={1}
        onChange={v => updateProject(p => ({ ...p, cutting: { kerf: v } }))} />
    </div>
  )
}

type PlacementKind = Placement['kind'] | 'free'

/** Where the selected piece sits: on the floor, on the wall, on or above another piece, or anywhere (ADR-0031). */
function PlacementFields({ item }: { item: ProjectItem }) {
  const project = useDesign(s => s.project)!
  const update = useDesign(s => s.updateItem)
  const bases = useMemo(() => placementBases(project, item.id), [project, item.id])
  const pl = item.placement
  const kind: PlacementKind = pl?.kind ?? 'free'
  const pos = item.position
  const setPlacement = (next: PlacementKind) => {
    if (next === 'free') { update(item.id, { placement: undefined }); return }
    if (next === 'floor') update(item.id, { placement: { kind: 'floor' } })
    else if (next === 'wall') update(item.id, { placement: { kind: 'wall', height: pos.y > 0 ? pos.y : 1450 } })
    else if (bases.length) update(item.id, { placement: { kind: 'above', baseId: bases[0].id, gap: 0, offsetX: 0 } })
  }
  const xz = (
    <div className="dims2">
      <MmField label="From left" value={pos.x} min={-20000} max={20000} onChange={v => update(item.id, { position: { ...pos, x: v } })} />
      <MmField label="From back" value={pos.z} min={-20000} max={20000} onChange={v => update(item.id, { position: { ...pos, z: v } })} />
    </div>
  )
  return (
    <>
      <Segmented<PlacementKind> label="Placed" value={kind} onChange={setPlacement}
        options={[
          { value: 'floor', label: 'Floor', title: 'Stands on the floor' },
          { value: 'wall', label: 'Wall', title: 'Hung on the wall at a height' },
          ...(bases.length ? [{ value: 'above' as const, label: 'On a piece', title: 'Stands on, or hangs above, another piece and follows it' }] : []),
          { value: 'free', label: 'Anywhere', title: 'Set all three distances yourself' },
        ]} />
      {kind === 'floor' && xz}
      {kind === 'wall' && pl?.kind === 'wall' && (
        <>
          {xz}
          <MmField label="Underside above the floor" value={pl.height} min={0} max={3000} onChange={v => update(item.id, { placement: { ...pl, height: v } })} />
        </>
      )}
      {kind === 'above' && pl?.kind === 'above' && (
        <>
          <Select label="On or above" value={pl.baseId} options={bases.map(b => ({ value: b.id, label: b.design.name }))}
            onChange={v => update(item.id, { placement: { ...pl, baseId: v } })} />
          <div className="dims2">
            <MmField label="Gap above it" value={pl.gap} min={0} max={3000} onChange={v => update(item.id, { placement: { ...pl, gap: v } })} hint="0 = stands on it" />
            <MmField label="From its left edge" value={pl.offsetX} min={-5000} max={5000} onChange={v => update(item.id, { placement: { ...pl, offsetX: v } })} />
          </div>
          <p className="hint">Backs line up; it moves with the piece below.</p>
        </>
      )}
      {kind === 'free' && (
        <div className="dims3">
          <MmField label="From left" value={pos.x} min={-20000} max={20000} onChange={v => update(item.id, { position: { ...pos, x: v } })} />
          <MmField label="From back" value={pos.z} min={-20000} max={20000} onChange={v => update(item.id, { position: { ...pos, z: v } })} />
          <MmField label="Above floor" value={pos.y} min={0} max={3000} onChange={v => update(item.id, { position: { ...pos, y: v } })} />
        </div>
      )}
    </>
  )
}

const FRONTS = new Set<Panel['role']>(['door', 'drawer-front'])
const DRAWER_BOX = new Set<Panel['role']>(['drawer-side', 'drawer-back', 'drawer-inner-front', 'drawer-bottom'])

const onKey = (f: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f() } }

/** The project drawing: the plan from above, and the whole room seen from the front below it. */
export function PlanView() {
  const pm = useDesign(s => s.projectModel)
  if (!pm || !pm.pieces.length) return <div className="no-3d"><p>Add pieces to see them on the plan.</p></div>
  return (
    <div className="plan-views">
      <RoomPlan pm={pm} />
      <RoomFront pm={pm} />
    </div>
  )
}

/** Top-down plan of the room: x to the right, the back wall at the top. Tap a piece to select it. */
function RoomPlan({ pm }: { pm: ProjectModel }) {
  const selectedId = useDesign(s => s.selectedItemId)
  const select = useDesign(s => s.selectItem)
  const xs = pm.pieces.flatMap(p => [p.bounds.x, p.bounds.x + p.bounds.w]), zs = pm.pieces.flatMap(p => [p.bounds.z, p.bounds.z + p.bounds.d])
  const x0 = Math.min(0, ...xs), x1 = Math.max(...xs), z0 = Math.min(0, ...zs), z1 = Math.max(...zs)
  const span = Math.max(x1 - x0, z1 - z0, 1000)
  const pad = span * 0.1, fs = span / 40, dfs = span / 32
  const sel = pm.pieces.find(p => p.item.id === selectedId)?.bounds
  const frontLine = (b: { x: number; z: number; w: number; d: number }, r: QuarterTurn) =>
    r === 0 ? [b.x, b.z + b.d, b.x + b.w, b.z + b.d] : r === 90 ? [b.x + b.w, b.z, b.x + b.w, b.z + b.d]
      : r === 180 ? [b.x, b.z, b.x + b.w, b.z] : [b.x, b.z, b.x, b.z + b.d]
  return (
    <figure className="plan" aria-label="Room plan, seen from above. Select a piece.">
      <svg viewBox={`${x0 - pad * 1.2} ${z0 - pad * 1.6} ${x1 - x0 + pad * 2.4} ${z1 - z0 + pad * 2.8}`}>
        <line className="wall" x1={x0 - pad} y1={0} x2={x1 + pad} y2={0} />
        <text className="wall-label" x={x0} y={-pad * 0.5} fontSize={fs}>Back wall</text>
        {pm.pieces.map(pc => {
          const b = pc.bounds
          const [fx1, fz1, fx2, fz2] = frontLine(b, pc.item.rotationY)
          const on = pc.item.id === selectedId
          // Pieces stacked on the same floor area (a wall run above a base run) get their names on separate lines.
          const stack = pm.pieces.filter(q => q.bounds.x < b.x + b.w && b.x < q.bounds.x + q.bounds.w && q.bounds.z < b.z + b.d && b.z < q.bounds.z + q.bounds.d)
          const size = Math.min(fs, b.w / 7)
          const dy = (stack.indexOf(pc) - (stack.length - 1) / 2) * size * 1.3
          return (
            <g key={pc.item.id} className={`plan-piece ${on ? 'on' : ''} ${b.y > 0 ? 'raised' : ''}`} role="button" tabIndex={0} aria-pressed={on}
              aria-label={`${pc.item.design.name}, ${b.w} by ${b.d} mm`}
              onClick={() => select(pc.item.id)} onKeyDown={onKey(() => select(pc.item.id))}>
              <rect x={b.x} y={b.z} width={b.w} height={b.d} />
              <line className="front" x1={fx1} y1={fz1} x2={fx2} y2={fz2} />
              <text x={b.x + b.w / 2} y={b.z + b.d / 2 + dy} fontSize={size} textAnchor="middle" dominantBaseline="middle">
                {pc.item.quantity > 1 ? `${pc.item.quantity}× ` : ''}{pc.item.design.name}
              </text>
            </g>
          )
        })}
        <Dim x1={x0} x2={x1} y={z1 + pad * 0.7} fontSize={dfs} label={`${x1 - x0}`} />
        <DimV y1={z0} y2={z1} x={x0 - pad * 0.6} fontSize={dfs} label={`${z1 - z0}`} />
        {sel && <>
          <Dim x1={sel.x} x2={sel.x + sel.w} y={sel.z + sel.d + pad * 0.3} fontSize={dfs * 0.85} label={`${sel.w}`} subtle />
          <DimV y1={sel.z} y2={sel.z + sel.d} x={sel.x + sel.w + pad * 0.3} fontSize={dfs * 0.85} label={`${sel.d}`} subtle />
        </>}
      </svg>
      <figcaption>Seen from above. The yellow edge is each piece's front; dashed pieces hang on the wall.</figcaption>
    </figure>
  )
}

/** The whole room seen from the front (looking at the back wall), floor at the bottom. Tap a piece to select it. */
function RoomFront({ pm }: { pm: ProjectModel }) {
  const selectedId = useDesign(s => s.selectedItemId)
  const select = useDesign(s => s.selectItem)
  const showFronts = useDesign(s => s.showFronts)
  const colors = useMemo(() => new Map(pm.pieces.flatMap(pc => pc.item.design.materials.map(m => [`${pc.item.id}:${m.id}`, m.color] as const))), [pm.pieces])
  const b = pm.model.bounds
  const x0 = Math.min(0, b.x), x1 = b.x + b.w, top = b.y + b.h
  const span = Math.max(x1 - x0, top, 1000)
  const pad = span * 0.1, dfs = span / 32
  const Y = (y: number, h: number) => -(y + h)
  // Painted back to front so nearer panels cover the ones behind them.
  const parts = pm.pieces.flatMap(pc => pc.panels.filter(p => !DRAWER_BOX.has(p.role)).map(p => ({ p, pc })))
  const structure = parts.filter(({ p }) => !FRONTS.has(p.role)).sort((a, c) => (a.p.box.z + a.p.box.d) - (c.p.box.z + c.p.box.d))
  const fronts = parts.filter(({ p }) => FRONTS.has(p.role))
  const sel = pm.pieces.find(p => p.item.id === selectedId)?.bounds
  return (
    <figure className="plan" aria-label="Room seen from the front. Select a piece.">
      <svg viewBox={`${x0 - pad * 1.2} ${-top - pad * 0.8} ${x1 - x0 + pad * 2.4} ${top + pad * 1.8}`}>
        <rect className="floor" x={x0 - pad} y={0} width={x1 - x0 + 2 * pad} height={pad * 0.15} />
        {structure.map(({ p, pc }) => (
          <rect key={p.id} className={`el-panel ${pc.item.id === selectedId ? 'hl' : ''}`} x={p.box.x} y={Y(p.box.y, p.box.h)} width={p.box.w} height={p.box.h}
            style={{ fill: colors.get(`${pc.item.id}:${p.materialId}`) }} />
        ))}
        {showFronts && fronts.map(({ p }) => (
          <rect key={p.id} className="el-front" x={p.box.x} y={Y(p.box.y, p.box.h)} width={p.box.w} height={p.box.h} />
        ))}
        {pm.pieces.map(pc => (
          <rect key={pc.item.id} className="front-hit" x={pc.bounds.x} y={Y(pc.bounds.y, pc.bounds.h)} width={pc.bounds.w} height={pc.bounds.h}
            role="button" tabIndex={0} aria-pressed={pc.item.id === selectedId} aria-label={`${pc.item.design.name}, ${pc.bounds.w} wide, ${pc.bounds.h} high`}
            onClick={() => select(pc.item.id)} onKeyDown={onKey(() => select(pc.item.id))} />
        ))}
        <Dim x1={x0} x2={x1} y={pad * 0.6} fontSize={dfs} label={`${x1 - x0}`} />
        <DimV y1={0} y2={-top} x={x0 - pad * 0.6} fontSize={dfs} label={`${top}`} />
        {sel && <>
          <Dim x1={sel.x} x2={sel.x + sel.w} y={Y(sel.y, sel.h) - pad * 0.3} fontSize={dfs * 0.85} label={`${sel.w}`} subtle />
          <DimV y1={-sel.y} y2={Y(sel.y, sel.h)} x={sel.x + sel.w + pad * 0.3} fontSize={dfs * 0.85} label={`${sel.h}`} subtle />
        </>}
      </svg>
      <figcaption>Seen from the front. Sizes in mm: overall in yellow, the selected piece in green.</figcaption>
    </figure>
  )
}

/** Choose a starting piece or a saved piece to add to the project. */
export function AddPieceList({ onDone, onBrowse }: { onDone: () => void; onBrowse?: () => void }) {
  const add = useDesign(s => s.addPiece)
  const [saved, setSaved] = useState<StoredDesign[]>([])
  useEffect(() => { listDesigns().then(setSaved).catch(() => setSaved([])) }, [])
  return (
    <>
      <StartFrom onPick={d => { add(d); onDone() }} onBrowse={onBrowse} />
      {saved.length > 0 && (
        <>
          <h3 className="list-head">Your saved pieces</h3>
          <ul className="template-list">
            {saved.map(r => (
              <li key={r.id}>
                <button type="button" className="row-btn" onClick={() => { add(r.design, r.id); onDone() }}>
                  <span className="glyph"><Icon name={templateGlyph(r.design.product.kind)} /></span>
                  <span><strong>{r.name}</strong><span className="sub">A copy is added; “Update from saved piece” pulls later changes.</span></span>
                  <Icon name="chevron-right" className="chev sm" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

/** Worktop, fillers and cover panels along runs of base units (ADR-0036): suggested, listed with a reason, removable. */
function RunParts() {
  const project = useDesign(s => s.project)!
  const updateProject = useDesign(s => s.updateProject)
  const parts = project.runParts ?? []
  const suggest = () => {
    const next = suggestRunParts({ ...project, runParts: [] })
    if (parts.length && !confirm('Replace the run parts with new suggestions for where the pieces are now?')) return
    updateProject(p => ({ ...p, runParts: next }))
  }
  return (
    <section className="section run-parts" aria-label="Run parts">
      <div className="card-title"><span>Run parts</span></div>
      <p className="hint">For rows of base units side by side: one worktop, a filler in each gap, a cover panel on each open end. Pieces keep their own plinths.</p>
      {parts.length > 0 && (
        <ul className="run-list">
          {parts.map(rp => (
            <li key={rp.id}>
              <span><strong>{rp.label}</strong> <span className="num">{rp.box.w} × {rp.box.h} × {rp.box.d}</span><span className="sub">{rp.reason}</span></span>
              <button type="button" className="btn icon ghost sm" aria-label={`Remove ${rp.label}`} onClick={() => updateProject(p => ({ ...p, runParts: (p.runParts ?? []).filter(x => x.id !== rp.id) }))}><Icon name="trash" /></button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn outline block" onClick={suggest} disabled={!project.items.length}><Icon name="refresh" className="sm" />{parts.length ? 'Suggest again' : 'Suggest worktop, fillers and covers'}</button>
    </section>
  )
}
