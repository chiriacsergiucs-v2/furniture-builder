import { useMemo } from 'react'
import { productRoots } from '../core/design'
import { useDesign } from '../store/designStore'
import type { Panel, SpaceOpening } from '../core/types'

const FRONTS = new Set<Panel['role']>(['door', 'drawer-front'])
const DRAWER_BOX = new Set<Panel['role']>(['drawer-side', 'drawer-back', 'drawer-inner-front', 'drawer-bottom'])

function describe(s: SpaceOpening, count?: number): string {
  switch (s.kind) {
    case 'empty': return 'Empty'
    case 'shelves': return count === 1 ? '1 shelf' : `${count ?? 0} shelves`
    case 'drawers': return count === 1 ? '1 drawer' : `${count ?? 0} drawers`
    case 'hanging': return 'Hanging'
    case 'split': return ''
  }
}

/**
 * Front elevation: the editing surface. Structure is drawn solid, fronts as dashed outlines,
 * every leaf space is a tap target. Y is flipped so the floor is at the bottom.
 */
export function Elevation() {
  const model = useDesign(s => s.model)
  const design = useDesign(s => s.design)
  const selectedId = useDesign(s => s.selectedId)
  const select = useDesign(s => s.select)
  const showFronts = useDesign(s => s.showFronts)
  const mats = useMemo(() => new Map(design.materials.map(m => [m.id, m])), [design.materials])

  const b = model.bounds
  const pad = Math.max(b.w, b.h) * 0.09
  const vb = `${b.x - pad} ${-(b.y + b.h) - pad} ${b.w + 2 * pad} ${b.h + 2 * pad * 1.4}`
  const Y = (y: number, h: number) => -(y + h)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    const walk = (s: import('../core/types').Space) => {
      if (s.kind === 'shelves' || s.kind === 'drawers') m.set(s.id, s.count)
      if (s.kind === 'split') s.children.forEach(walk)
    }
    productRoots(design.product).forEach(r => walk(r.root))
    return m
  }, [design.product])

  const BEHIND = new Set<Panel['role']>(['back', 'modesty'])
  const structure = model.panels.filter(p => !FRONTS.has(p.role) && !DRAWER_BOX.has(p.role) && !BEHIND.has(p.role))
  const backs = model.panels.filter(p => BEHIND.has(p.role))
  const fronts = model.panels.filter(p => FRONTS.has(p.role))
  const selectedPanels = new Set(model.panels.filter(p => p.nodeId === selectedId).map(p => p.id))
  const selectedSpace = model.spaces.find(s => s.nodeId === selectedId && s.view !== 'side')
  const fontSize = Math.max(b.w, b.h) / 26

  // Leaf spaces on top so they receive taps; parents (splits) are selected from the breadcrumb.
  const leaves = model.spaces.filter(s => s.leaf && s.view !== 'side')

  return (
    <figure className="elevation" aria-label="Front view. Select a space to edit it.">
      <svg viewBox={vb} preserveAspectRatio="xMidYMid meet" role="group">
        <rect className="floor" x={b.x - pad} y={0} width={b.w + 2 * pad} height={pad * 0.15} />
        {backs.map(p => <rect key={p.id} className="el-back" x={p.box.x} y={Y(p.box.y, p.box.h)} width={p.box.w} height={p.box.h} />)}
        {leaves.map(s => (
          <g key={s.nodeId} className={`el-space ${s.nodeId === selectedId ? 'selected' : ''}`}
            role="button" tabIndex={0} aria-pressed={s.nodeId === selectedId} aria-label={`${describe(s, counts.get(s.nodeId))} space, ${s.box.w} by ${s.box.h} mm`}
            onClick={e => { e.stopPropagation(); select(s.nodeId) }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(s.nodeId) } }}>
            <rect x={s.box.x} y={Y(s.box.y, s.box.h)} width={s.box.w} height={s.box.h} />
          </g>
        ))}
        {structure.map(p => (
          <rect key={p.id} className={`el-panel ${selectedPanels.has(p.id) ? 'hl' : ''}`} x={p.box.x} y={Y(p.box.y, p.box.h)} width={p.box.w} height={p.box.h}
            style={{ fill: mats.get(p.materialId)?.color }}
            onClick={e => { e.stopPropagation(); select(p.nodeId === design.product.id ? null : p.nodeId) }} />
        ))}
        {showFronts && fronts.map(p => (
          <rect key={p.id} className="el-front" x={p.box.x} y={Y(p.box.y, p.box.h)} width={p.box.w} height={p.box.h} />
        ))}
        {showFronts && fronts.filter(p => p.handleHoles).map(p => {
          const pts = p.handleHoles!.at.map(([u, v]) => [p.box.x + u, -(p.box.y + v)] as const)
          return pts.length === 2
            ? <line key={`h-${p.id}`} className="el-handle" x1={pts[0][0]} y1={pts[0][1]} x2={pts[1][0]} y2={pts[1][1]} />
            : <circle key={`h-${p.id}`} className="el-knob" cx={pts[0][0]} cy={pts[0][1]} r={Math.max(b.w, b.h) / 160} />
        })}
        {leaves.map(s => (
          <text key={`l-${s.nodeId}`} className={`el-label ${s.nodeId === selectedId ? 'selected' : ''}`} x={s.box.x + s.box.w / 2} y={Y(s.box.y, s.box.h) + s.box.h / 2}
            fontSize={Math.min(fontSize, s.box.w / 6)} dominantBaseline="middle" textAnchor="middle">
            {describe(s, counts.get(s.nodeId))}
          </text>
        ))}
        {selectedSpace && (
          <rect className="el-selection" x={selectedSpace.box.x} y={Y(selectedSpace.box.y, selectedSpace.box.h)} width={selectedSpace.box.w} height={selectedSpace.box.h} />
        )}
        <Dim x1={b.x} x2={b.x + b.w} y={pad * 0.75} fontSize={fontSize} label={`${b.w}`} />
        <DimV y1={0} y2={-(b.y + b.h)} x={b.x - pad * 0.55} fontSize={fontSize} label={`${b.h}`} />
        {selectedSpace && (
          <Dim x1={selectedSpace.box.x} x2={selectedSpace.box.x + selectedSpace.box.w} y={-(b.y + b.h) - pad * 0.45} fontSize={fontSize * 0.85} label={`${selectedSpace.box.w}`} subtle />
        )}
      </svg>
    </figure>
  )
}

function Dim({ x1, x2, y, label, fontSize, subtle }: { x1: number; x2: number; y: number; label: string; fontSize: number; subtle?: boolean }) {
  const mid = (x1 + x2) / 2
  const w = label.length * fontSize * 0.62 + fontSize
  return (
    <g className={`dim ${subtle ? 'subtle' : ''}`}>
      <line x1={x1} x2={x2} y1={y} y2={y} />
      <line x1={x1} x2={x1} y1={y - fontSize * 0.4} y2={y + fontSize * 0.4} />
      <line x1={x2} x2={x2} y1={y - fontSize * 0.4} y2={y + fontSize * 0.4} />
      <rect x={mid - w / 2} y={y - fontSize * 0.7} width={w} height={fontSize * 1.4} rx={fontSize * 0.2} />
      <text x={mid} y={y} fontSize={fontSize} textAnchor="middle" dominantBaseline="central">{label}</text>
    </g>
  )
}

function DimV({ y1, y2, x, label, fontSize }: { y1: number; y2: number; x: number; label: string; fontSize: number }) {
  const mid = (y1 + y2) / 2
  const w = label.length * fontSize * 0.62 + fontSize
  return (
    <g className="dim">
      <line x1={x} x2={x} y1={y1} y2={y2} />
      <line x1={x - fontSize * 0.4} x2={x + fontSize * 0.4} y1={y1} y2={y1} />
      <line x1={x - fontSize * 0.4} x2={x + fontSize * 0.4} y1={y2} y2={y2} />
      <g transform={`rotate(-90 ${x} ${mid})`}>
        <rect x={x - w / 2} y={mid - fontSize * 0.7} width={w} height={fontSize * 1.4} rx={fontSize * 0.2} />
        <text x={x} y={mid} fontSize={fontSize} textAnchor="middle" dominantBaseline="central">{label}</text>
      </g>
    </g>
  )
}
