import { useEffect, useState } from 'react'
import { templates } from '../core/design'
import type { QuarterTurn } from '../core/project'
import { listDesigns, loadDesign, type StoredDesign } from '../persist/db'
import { useDesign } from '../store/designStore'
import { Counter, MmField, Segmented } from './controls'

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
  const [libMsg, setLibMsg] = useState<string | null>(null)
  const item = project.items.find(i => i.id === selectedId)
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
        <p className="empty">No pieces yet. Add a cabinet, a corner unit or a desk to start.</p>
      ) : (
        <ul className="pieces">
          {project.items.map(i => {
            const b = pm?.pieces.find(p => p.item.id === i.id)?.bounds
            return (
              <li key={i.id}>
                <button type="button" className={i.id === selectedId ? 'on' : ''} aria-pressed={i.id === selectedId} onClick={() => select(i.id)}>
                  <strong>{i.quantity > 1 ? `${i.quantity} × ` : ''}{i.design.name}</strong>
                  {b && <span>{b.w} × {b.h} × {b.d} mm</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <button type="button" className="secondary" onClick={onAdd}>Add a piece</button>

      {item && (
        <section className="piece-edit" aria-label={`Selected piece: ${item.design.name}`}>
          <h3>{item.design.name}</h3>
          <div className="split-actions">
            <button type="button" onClick={() => edit(item.id)}>Edit this piece</button>
            {item.libraryId && <button type="button" onClick={updateFromLibrary}>Update from saved piece</button>}
          </div>
          {libMsg && <p className="hint" role="status">{libMsg}</p>}
          <Counter label="How many" value={item.quantity} min={1} max={99} onChange={v => update(item.id, { quantity: v })} />
          {item.quantity > 1 && <p className="hint">Copies are added to parts, sheets and hardware; one is shown in the room.</p>}
          <Segmented<QuarterTurn> label="Turn" value={item.rotationY}
            options={[{ value: 0, label: '0°' }, { value: 90, label: '90°' }, { value: 180, label: '180°' }, { value: 270, label: '270°' }]}
            onChange={v => update(item.id, { rotationY: v })} />
          <p className="hint">{FRONT_SIDE[item.rotationY]}</p>
          <div className="dims3">
            <MmField label="From left" value={item.position.x} min={-20000} max={20000} onChange={v => update(item.id, { position: { ...item.position, x: v } })} />
            <MmField label="From back" value={item.position.z} min={-20000} max={20000} onChange={v => update(item.id, { position: { ...item.position, z: v } })} />
            <MmField label="Above floor" value={item.position.y} min={0} max={3000} onChange={v => update(item.id, { position: { ...item.position, y: v } })} />
          </div>
          {piece && <p className="hint">Takes {piece.bounds.w} × {piece.bounds.d} mm of floor, {piece.bounds.h} mm high.</p>}
          <button type="button" className="danger-link" onClick={() => { if (confirm(`Remove “${item.design.name}” from this project?`)) remove(item.id) }}>Remove from project</button>
        </section>
      )}

      <MmField label="Saw cut (kerf) for this project" value={project.cutting?.kerf ?? 4} min={0} max={20} step={1}
        onChange={v => updateProject(p => ({ ...p, cutting: { kerf: v } }))} />
    </div>
  )
}

/** Top-down plan of the room: x to the right, the back wall at the top. Tap a piece to select it. */
export function PlanView() {
  const pm = useDesign(s => s.projectModel)
  const selectedId = useDesign(s => s.selectedItemId)
  const select = useDesign(s => s.selectItem)
  if (!pm || !pm.pieces.length) return <div className="no-3d"><p>Add pieces to see them on the plan.</p></div>
  const xs = pm.pieces.flatMap(p => [p.bounds.x, p.bounds.x + p.bounds.w]), zs = pm.pieces.flatMap(p => [p.bounds.z, p.bounds.z + p.bounds.d])
  const x0 = Math.min(0, ...xs), x1 = Math.max(...xs), z0 = Math.min(0, ...zs), z1 = Math.max(...zs)
  const span = Math.max(x1 - x0, z1 - z0, 1000)
  const pad = span * 0.08, fs = span / 40
  const frontLine = (b: { x: number; z: number; w: number; d: number }, r: QuarterTurn) =>
    r === 0 ? [b.x, b.z + b.d, b.x + b.w, b.z + b.d] : r === 90 ? [b.x + b.w, b.z, b.x + b.w, b.z + b.d]
      : r === 180 ? [b.x, b.z, b.x + b.w, b.z] : [b.x, b.z, b.x, b.z + b.d]
  return (
    <figure className="plan" aria-label="Room plan, seen from above. Select a piece.">
      <svg viewBox={`${x0 - pad} ${z0 - pad * 1.6} ${x1 - x0 + 2 * pad} ${z1 - z0 + pad * 3}`}>
        <line className="wall" x1={x0 - pad} y1={0} x2={x1 + pad} y2={0} />
        <text className="wall-label" x={x0} y={-pad * 0.5} fontSize={fs}>Back wall</text>
        {pm.pieces.map(pc => {
          const b = pc.bounds
          const [fx1, fz1, fx2, fz2] = frontLine(b, pc.item.rotationY)
          const on = pc.item.id === selectedId
          return (
            <g key={pc.item.id} className={`plan-piece ${on ? 'on' : ''} ${b.y > 0 ? 'raised' : ''}`} role="button" tabIndex={0} aria-pressed={on}
              aria-label={`${pc.item.design.name}, ${b.w} by ${b.d} mm`}
              onClick={() => select(pc.item.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(pc.item.id) } }}>
              <rect x={b.x} y={b.z} width={b.w} height={b.d} />
              <line className="front" x1={fx1} y1={fz1} x2={fx2} y2={fz2} />
              <text x={b.x + b.w / 2} y={b.z + b.d / 2} fontSize={Math.min(fs, b.w / 7)} textAnchor="middle" dominantBaseline="middle">
                {pc.item.quantity > 1 ? `${pc.item.quantity}× ` : ''}{pc.item.design.name}
              </text>
            </g>
          )
        })}
        <text className="dim-text" x={(x0 + x1) / 2} y={z1 + pad * 1.1} fontSize={fs} textAnchor="middle">{x1 - x0} mm</text>
      </svg>
      <figcaption>Seen from above. The yellow edge is each piece's front; dashed pieces hang on the wall.</figcaption>
    </figure>
  )
}

/** Choose a starting piece or a saved piece to add to the project. */
export function AddPieceList({ onDone }: { onDone: () => void }) {
  const add = useDesign(s => s.addPiece)
  const [saved, setSaved] = useState<StoredDesign[]>([])
  useEffect(() => { listDesigns().then(setSaved).catch(() => setSaved([])) }, [])
  return (
    <>
      <h3 className="list-head">Start from</h3>
      <ul className="template-list">
        {templates.map(t => (
          <li key={t.id}><button type="button" onClick={() => { add(t.create()); onDone() }}><strong>{t.name}</strong><span>{t.description}</span></button></li>
        ))}
      </ul>
      {saved.length > 0 && (
        <>
          <h3 className="list-head">Your saved pieces</h3>
          <ul className="template-list">
            {saved.map(r => (
              <li key={r.id}><button type="button" onClick={() => { add(r.design, r.id); onDone() }}><strong>{r.name}</strong><span>A copy is added; “Update from saved piece” pulls later changes.</span></button></li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
