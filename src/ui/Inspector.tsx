import { useMemo } from 'react'
import { changeKind, fr, setDrawerCount, findInProduct, findSpace, parentOf, pedestalRoot, splitSpace, unsplit, usesPedestal } from '../core/design'
import type { CabinetParams, CornerParams, DeskParams, DeskSupport, FrontStyle, Handle, Material, Space, SpaceKind, SplitSize } from '../core/types'
import { useDesign } from '../store/designStore'
import { Counter, Group, MmField, revealGroup, Section, Segmented, Select, Steps, Toggle, type Step } from './controls'
import { Icon } from './icons'

const KIND_LABEL: Record<SpaceKind, string> = { empty: 'Empty', shelves: 'Shelves', drawers: 'Drawers', hanging: 'Hanging', split: 'Divided' }

export function Inspector() {
  const design = useDesign(s => s.design)
  const selectedId = useDesign(s => s.selectedId)
  const prod = design.product
  const found = selectedId ? findInProduct(prod, selectedId) : undefined
  if (found) return <SpaceEditor space={found.space} root={found.root} rootLabel={found.label} wholeLabel={WHOLE[prod.kind]} />
  if (prod.kind === 'desk') return <DeskEditor p={prod.params} deskId={prod.id} materials={design.materials} />
  if (prod.kind === 'corner') return <CornerEditor p={prod.params} materials={design.materials} />
  return <CabinetEditor p={prod.params} materials={design.materials} />
}

const WHOLE = { cabinet: 'Whole cabinet', desk: 'Whole desk', corner: 'Whole corner unit' } as const

function matOptions(materials: Material[], filter?: (m: Material) => boolean) {
  return materials.filter(filter ?? (() => true)).map(m => ({ value: m.id, label: `${m.name}` }))
}
const matName = (materials: Material[], id: string) => materials.find(m => m.id === id)?.name ?? '—'

/** One line about what a space tree holds, for the steps rail: "4 drawers", "2 shelves, 1 door", "Empty". */
function insideSummary(roots: Space[]): string {
  let drawers = 0, shelves = 0, hanging = 0, doors = 0, empty = 0
  const walk = (s: Space) => {
    if (s.front) doors += s.front.count
    if (s.kind === 'split') s.children.forEach(walk)
    else if (s.kind === 'drawers') drawers += s.count
    else if (s.kind === 'shelves') { if (s.count) shelves += s.count; else empty++ }
    else if (s.kind === 'hanging') hanging++
    else empty++
  }
  roots.forEach(walk)
  const parts: string[] = []
  if (drawers) parts.push(`${drawers} ${drawers === 1 ? 'drawer' : 'drawers'}`)
  if (shelves) parts.push(`${shelves} ${shelves === 1 ? 'shelf' : 'shelves'}`)
  if (hanging) parts.push('hanging')
  if (doors) parts.push(`${doors} ${doors === 1 ? 'door' : 'doors'}`)
  if (!parts.length) return 'Empty'
  if (empty) parts.push('empty space')
  return parts.join(', ')
}

const FRONT_LABEL: Record<FrontStyle, string> = { overlay: 'Overlay', half: 'Half overlay', inset: 'Inset' }

/**
 * Steps rail above a whole-piece editor: a map of the stages (size → inside → build → boards → cut) with the state
 * of each. Nothing is gated; each entry jumps to its section, so the frequent paths stay as short as before.
 */
function EditorRail({ steps, inside }: { steps: Step[]; inside?: () => void }) {
  const diags = useDesign(s => s.model.diagnostics)
  const setTab = useDesign(s => s.setTab)
  const errors = diags.filter(d => d.severity === 'error').length
  const warnings = diags.length - errors
  const cut: Step = {
    id: 'cut', label: 'Cut', done: !errors,
    meta: errors ? `${errors} ${errors === 1 ? 'problem' : 'problems'}` : warnings ? `${warnings} to check` : 'Ready',
    tone: errors ? 'error' : warnings ? 'warn' : 'ok',
  }
  const go = (id: string) => {
    if (id === 'size') document.querySelector('.inspector')?.scrollIntoView({ block: 'start' })
    else if (id === 'inside') inside?.()
    else if (id === 'cut') {
      setTab(errors || warnings ? 'checks' : 'parts')
      if (matchMedia('(max-width: 760px)').matches) document.querySelector('.output')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    } else revealGroup(`g-${id}`)
  }
  return <div className="rail"><Steps label="Stages of this piece" steps={[...steps, cut]} onSelect={go} /></div>
}

function Crumbs({ root, id, rootLabel, wholeLabel }: { root: Space; id: string; rootLabel: string; wholeLabel: string }) {
  const select = useDesign(s => s.select)
  const chain: Space[] = []
  let cur: Space | undefined = findSpace(root, id)
  while (cur) { chain.unshift(cur); cur = parentOf(root, cur.id) }
  return (
    <nav className="crumbs" aria-label="Where this space sits">
      <button type="button" onClick={() => select(null)}>{wholeLabel}</button>
      {chain.map((s, i) => (
        <span key={s.id}>
          <span aria-hidden="true" className="sep">/</span>
          {i === chain.length - 1
            ? <span aria-current="true">{i === 0 ? rootLabel : KIND_LABEL[s.kind]}</span>
            : <button type="button" onClick={() => select(s.id)}>{i === 0 ? rootLabel : KIND_LABEL[s.kind]}</button>}
        </span>
      ))}
    </nav>
  )
}

function SpaceEditor({ space, root, rootLabel, wholeLabel }: { space: Space; root: Space; rootLabel: string; wholeLabel: string }) {
  const update = useDesign(s => s.updateSpace)
  const select = useDesign(s => s.select)
  const opening = useDesign(s => s.model.spaces.find(o => o.nodeId === space.id))
  const allDiags = useDesign(s => s.model.diagnostics)
  const diags = useMemo(() => allDiags.filter(d => d.nodeId === space.id), [allDiags, space.id])
  const set = (fn: (s: Space) => Space) => update(space.id, fn)
  const parent = parentOf(root, space.id)

  return (
    <div className="inspector">
      <Crumbs root={root} id={space.id} rootLabel={rootLabel} wholeLabel={wholeLabel} />
      <header className="insp-head">
        <h2>{space.kind === 'split' ? 'Divided space' : `${KIND_LABEL[space.kind]}`}</h2>
        {opening && <p className="measure"><span>{opening.box.w}</span> wide × <span>{opening.box.h}</span> high × <span>{opening.box.d}</span> deep inside</p>}
      </header>

      {diags.length > 0 && (
        <ul className="inline-diags">{diags.map((d, i) => <li key={i} className={`alert ${d.severity}`}><Icon name={d.severity === 'error' ? 'alert-circle' : 'alert-triangle'} className="sm" /><span>{d.message}</span></li>)}</ul>
      )}

      {space.kind === 'split' ? (
        <Section title="Division">
          <SplitEditor space={space} onChange={set} onSelect={select} />
        </Section>
      ) : (
        <Section title="Contents">
          <Segmented<SpaceKind> label="What goes here" value={space.kind}
            options={(['empty', 'shelves', 'drawers', 'hanging'] as const).map(k => ({ value: k, label: KIND_LABEL[k] }))}
            onChange={k => set(s => changeKind(s, k))} />
          {space.kind === 'shelves' && <Counter label="Shelves" value={space.count} min={0} max={12} onChange={v => set(s => ({ ...s, count: v }) as Space)} />}
          {space.kind === 'shelves' && space.count > 0 && (
            <Toggle label="Adjustable, on shelf pins" checked={!!space.adjustable} onChange={v => set(s => ({ ...s, adjustable: v }) as Space)} />
          )}
          {space.kind === 'drawers' && <Counter label="Drawers" value={space.count} min={1} max={10} onChange={v => set(s => setDrawerCount(s, v))} />}
          {space.kind === 'drawers' && space.count > 1 && <DrawerHeights space={space} onChange={set} />}
          {space.kind === 'hanging' && <MmField label="Rail below top" value={space.railDrop} min={0} max={500} step={10} onChange={v => set(s => ({ ...s, railDrop: v }) as Space)} />}
        </Section>
      )}

      <Section title="Doors and handles">
        <Segmented<0 | 1 | 2> label="Doors" value={space.front?.count ?? 0}
          options={[{ value: 0, label: 'None' }, { value: 1, label: 'One' }, { value: 2, label: 'Pair' }]}
          onChange={n => set(s => ({ ...s, front: n === 0 ? null : { kind: 'doors', count: n } }))} />
        {space.front?.count === 1 && (
          <Segmented<'left' | 'right'> label="Hinges on" value={space.front.hinge ?? 'left'}
            options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
            onChange={v => set(s => (s.front ? { ...s, front: { ...s.front, hinge: v } } : s))} />
        )}
        {space.kind === 'drawers' && space.front && <p className="hint">Drawers behind doors are built as internal drawers without their own fronts.</p>}
        {(space.front || space.kind === 'drawers') ? <HandleEditor space={space} onChange={set} /> : <p className="hint">Handles appear once there are doors or drawers.</p>}
      </Section>

      {space.kind !== 'split' && (
        <Section title="Divide this space">
          <div className="split-actions">
            <button type="button" className="btn outline" onClick={() => set(s => splitSpace(s, 'x', 2))}>Side by side</button>
            <button type="button" className="btn outline" onClick={() => set(s => splitSpace(s, 'y', 2))}>Stacked</button>
          </div>
        </Section>
      )}
      {parent && (
        <button type="button" className="link" onClick={() => select(parent.id)}>Select the divided space around this one</button>
      )}
    </div>
  )
}

const BAR_SPACINGS = [96, 128, 160, 192, 224, 256, 320]

function HandleEditor({ space, onChange }: { space: Space; onChange: (fn: (s: Space) => Space) => void }) {
  const h = space.handle
  const kind = h?.kind ?? 'none'
  const setH = (patch: Partial<Handle> | null) => onChange(s => ({ ...s, handle: patch === null ? null : { kind: 'bar', ...(s.handle ?? {}), ...patch } as Handle }))
  return (
    <>
      <Segmented<'none' | Handle['kind']> label={space.front ? 'Handles on the doors' : 'Handles on the drawers'} value={kind}
        options={[{ value: 'none', label: 'None' }, { value: 'bar', label: 'Bar' }, { value: 'knob', label: 'Knob' }, { value: 'push', label: 'Push to open' }]}
        onChange={v => setH(v === 'none' ? null : { kind: v })} />
      {h && h.kind !== 'push' && (
        <div className="dims2">
          {h.kind === 'bar' && (
            <Select label="Hole centres" value={String(h.holeSpacing ?? 128)} options={BAR_SPACINGS.map(v => ({ value: String(v), label: `${v} mm` }))}
              onChange={v => setH({ holeSpacing: Number(v) })} />
          )}
          <Select<'top' | 'centre' | 'bottom'> label="Position" value={h.position ?? (space.front ? 'centre' : 'top')}
            options={[{ value: 'top', label: 'Near the top' }, { value: 'centre', label: 'Middle' }, { value: 'bottom', label: 'Near the bottom' }]}
            onChange={v => setH({ position: v })} />
        </div>
      )}
    </>
  )
}

function DrawerHeights({ space, onChange }: { space: Extract<Space, { kind: 'drawers' }>; onChange: (fn: (s: Space) => Space) => void }) {
  const panels = useDesign(s => s.model.panels)
  const fronts = useMemo(() => panels.filter(p => p.nodeId === space.id && p.role === 'drawer-front').sort((a, b) => b.box.y - a.box.y), [panels, space.id])
  const custom = !!space.heights
  const heights = space.heights ?? Array.from({ length: space.count }, () => fr())
  const setH = (i: number, z: SplitSize) => onChange(s => (s.kind === 'drawers' ? { ...s, heights: heights.map((h, j) => (j === i ? z : h)) } : s))
  return (
    <>
      <Segmented<'equal' | 'custom'> label="Drawer heights" value={custom ? 'custom' : 'equal'}
        options={[{ value: 'equal', label: 'Equal' }, { value: 'custom', label: 'Choose' }]}
        onChange={v => onChange(s => {
          if (s.kind !== 'drawers') return s
          if (v === 'equal') { const { heights: _drop, ...rest } = s; void _drop; return rest }
          return { ...s, heights: Array.from({ length: s.count }, () => fr()) }
        })} />
      {custom && (
        <ul className="parts-sizes">
          {heights.map((z, i) => (
            <li key={i}>
              <span className="part-name static">Drawer {i + 1}</span>
              <select aria-label={`Drawer ${i + 1} sizing`} value={z.mode} onChange={e => setH(i, e.target.value === 'mm' ? { mode: 'mm', value: fronts[i]?.box.h ?? 150 } : { mode: 'fr', value: 1 })}>
                <option value="fr">Share</option>
                <option value="mm">Fixed</option>
              </select>
              <input aria-label={z.mode === 'mm' ? `Drawer ${i + 1} front height in mm` : `Drawer ${i + 1} share`} inputMode={z.mode === 'mm' ? 'numeric' : 'decimal'} defaultValue={z.value} key={`${i}-${z.mode}-${z.value}`}
                onBlur={e => { const v = Number(e.target.value); if (z.mode === 'mm' ? Number.isInteger(v) && v > 0 : v > 0 && v < 1000) setH(i, { mode: z.mode, value: v } as SplitSize) }} />
              <span className="result">{fronts[i] ? `${fronts[i].box.h} mm` : '—'}</span>
            </li>
          ))}
        </ul>
      )}
      {custom && <p className="hint">Top to bottom. Heights are front heights; a share splits whatever the fixed drawers leave.</p>}
    </>
  )
}

function SplitEditor({ space, onChange, onSelect }: { space: Extract<Space, { kind: 'split' }>; onChange: (fn: (s: Space) => Space) => void; onSelect: (id: string) => void }) {
  const openings = useDesign(s => s.model.spaces)
  const setSize = (i: number, size: SplitSize) => onChange(s => s.kind === 'split' ? { ...s, sizes: s.sizes.map((z, j) => (j === i ? size : z)) } : s)
  const n = space.children.length
  const setCount = (k: number) => onChange(s => {
    if (s.kind !== 'split') return s
    if (k > s.children.length) {
      const extra = splitSpace({ id: 'tmp', kind: 'shelves', count: 2 }, s.axis, k - s.children.length + 1)
      const add = extra.kind === 'split' ? extra.children.slice(1) : []
      return { ...s, children: [...s.children, ...add], sizes: [...s.sizes, ...add.map(() => ({ mode: 'fr', value: 1 }) as SplitSize)] }
    }
    return { ...s, children: s.children.slice(0, k), sizes: s.sizes.slice(0, k) }
  })
  const word = space.axis === 'x' ? 'Width' : 'Height'
  const names = space.axis === 'x'
    ? (i: number) => (n === 2 ? ['Left', 'Right'][i] : i === 0 ? 'Left' : i === n - 1 ? 'Right' : `Middle ${n > 3 ? i : ''}`.trim())
    : (i: number) => (n === 2 ? ['Top', 'Bottom'][i] : i === 0 ? 'Top' : i === n - 1 ? 'Bottom' : `Middle ${n > 3 ? i : ''}`.trim())
  return (
    <>
      <Segmented<'x' | 'y'> label="Direction" value={space.axis}
        options={[{ value: 'x', label: 'Side by side' }, { value: 'y', label: 'Stacked' }]}
        onChange={a => onChange(s => (s.kind === 'split' ? { ...s, axis: a } : s))} />
      <Counter label="Parts" value={n} min={2} max={8} onChange={setCount} />
      <div className="field">
        <span className="field-label">{word} of each part</span>
        <ul className="parts-sizes">
          {space.children.map((c, i) => {
            const z = space.sizes[i]
            const actual = openings.find(o => o.nodeId === c.id)?.box
            return (
              <li key={c.id}>
                <button type="button" className="part-name" onClick={() => onSelect(c.id)}>{names(i)}</button>
                <select aria-label={`${names(i)} sizing`} value={z.mode} onChange={e => setSize(i, e.target.value === 'mm' ? { mode: 'mm', value: actual ? (space.axis === 'x' ? actual.w : actual.h) : 300 } : { mode: 'fr', value: 1 })}>
                  <option value="fr">Share</option>
                  <option value="mm">Fixed</option>
                </select>
                {z.mode === 'mm'
                  ? <input aria-label={`${names(i)} ${word.toLowerCase()} in mm`} inputMode="numeric" defaultValue={z.value} key={`${c.id}-${z.value}`}
                      onBlur={e => { const v = Number(e.target.value); if (Number.isInteger(v) && v > 0) setSize(i, { mode: 'mm', value: v }) }} />
                  : <input aria-label={`${names(i)} share`} inputMode="decimal" defaultValue={z.value} key={`${c.id}-${z.value}`}
                      onBlur={e => { const v = Number(e.target.value); if (v > 0 && v < 1000) setSize(i, { mode: 'fr', value: v }) }} />}
                <span className="result">{actual ? `${space.axis === 'x' ? actual.w : actual.h} mm` : '—'}</span>
              </li>
            )
          })}
        </ul>
      </div>
      <button type="button" className="danger-link" onClick={() => onChange(unsplit)}>Remove dividers</button>
    </>
  )
}

function CabinetEditor({ p, materials }: { p: CabinetParams; materials: Material[] }) {
  const set = useDesign(s => s.updateCabinet)
  const select = useDesign(s => s.select)
  const panelMats = matOptions(materials, m => m.thickness >= 12)
  const thinMats = matOptions(materials)
  const inside = insideSummary([p.interior])
  const steps: Step[] = [
    { id: 'size', label: 'Size', meta: `${p.width}×${p.height}×${p.depth}`, done: true },
    { id: 'inside', label: 'Inside', meta: inside, done: inside !== 'Empty', tone: inside === 'Empty' ? 'warn' : undefined },
    { id: 'build', label: 'Build', meta: FRONT_LABEL[p.frontStyle ?? 'overlay'], done: true },
    { id: 'materials', label: 'Boards', meta: matName(materials, p.bodyMaterialId), done: true },
  ]
  return (
    <div className="inspector">
      <EditorRail steps={steps} inside={() => select(p.interior.id)} />
      <header className="insp-head">
        <h2>Whole cabinet</h2>
        <p className="hint">Tap a space in the front view to fill or divide it.</p>
      </header>
      <div className="dims3">
        <MmField label="Width" value={p.width} min={100} max={4000} onChange={v => set({ width: v })} />
        <MmField label="Height" value={p.height} min={100} max={3000} onChange={v => set({ height: v })} />
        <MmField label="Depth" value={p.depth} min={100} max={1200} onChange={v => set({ depth: v })} />
      </div>
      <button type="button" className="link" onClick={() => select(p.interior.id)}>Edit the interior</button>
      <Segmented<'floor' | 'wall'> label="Stands on" value={p.mount ?? 'floor'}
        options={[{ value: 'floor', label: 'The floor' }, { value: 'wall', label: 'Wall brackets' }]}
        onChange={v => set(v === 'wall' ? { mount: v, mountHeight: p.mountHeight ?? 1450 } : { mount: v })} />
      {p.mount === 'wall' && <MmField label="Underside above the floor" value={p.mountHeight ?? 1450} min={0} max={2500} onChange={v => set({ mountHeight: v })} hint="Position only; brackets and a rail are added to the hardware list." />}
      <Group title="Construction" id="g-build">
        <Segmented label="Top" value={p.top} options={[{ value: 'over', label: 'On the sides' }, { value: 'between', label: 'Between sides' }]} onChange={v => set({ top: v })} />
        <Segmented label="Back" value={p.back} options={[{ value: 'applied', label: 'Nailed on' }, { value: 'inset', label: 'Set in' }, { value: 'none', label: 'None' }]} onChange={v => set({ back: v })} />
        {p.back === 'inset' && <MmField label="Back set in from rear" value={p.backInset} min={0} max={100} step={1} onChange={v => set({ backInset: v })} />}
        {p.mount !== 'wall' && <MmField label="Plinth height" value={p.plinthHeight} min={0} max={250} onChange={v => set({ plinthHeight: v })} hint="0 for no plinth" />}
        {p.mount !== 'wall' && p.plinthHeight > 0 && <MmField label="Plinth set back" value={p.plinthSetback} min={0} max={200} step={5} onChange={v => set({ plinthSetback: v })} />}
        <Segmented<FrontStyle> label="Doors and drawer fronts" value={p.frontStyle ?? 'overlay'}
          options={[{ value: 'overlay', label: 'Overlay' }, { value: 'half', label: 'Half overlay' }, { value: 'inset', label: 'Inset' }]}
          onChange={v => set({ frontStyle: v })} />
        <MmField label={(p.frontStyle ?? 'overlay') === 'inset' ? 'Gap around fronts' : 'Gap between fronts'} value={p.frontGap} min={0} max={10} step={1} onChange={v => set({ frontGap: v })} />
        <MmField label="Shelf set back" value={p.shelfSetback} min={0} max={100} step={5} onChange={v => set({ shelfSetback: v })} />
        <div className="dims2">
          <MmField label="Adjustable shelf gap, each side" value={p.shelfClearance ?? 1} min={0} max={5} step={1} onChange={v => set({ shelfClearance: v })} />
          <MmField label="Pin rows from edges" value={p.pinRowSetback ?? 37} min={20} max={100} step={1} onChange={v => set({ pinRowSetback: v })} />
        </div>
      </Group>
      <Group title="Materials" id="g-materials">
        <Select label="Body" value={p.bodyMaterialId} options={panelMats} onChange={v => set({ bodyMaterialId: v })} />
        <Select label="Fronts" value={p.frontMaterialId} options={panelMats} onChange={v => set({ frontMaterialId: v })} />
        <Select label="Back" value={p.backMaterialId} options={thinMats} onChange={v => set({ backMaterialId: v })} />
      </Group>
      <DrawerSettingsGroup value={p.drawers} materials={materials} onChange={d => set({ drawers: d })} />
    </div>
  )
}

function DrawerSettingsGroup({ value: d, materials, onChange }: { value: CabinetParams['drawers']; materials: Material[]; onChange: (v: CabinetParams['drawers']) => void }) {
  return (
    <Group title="Drawers and runners" defaultOpen={false} id="g-drawers">
      <MmField label="Runner clearance each side" value={d.sideClearance} min={0} max={40} step={1} onChange={v => onChange({ ...d, sideClearance: v })} hint="Check your runner's datasheet; 12.5–13 mm is common for side-mount runners." />
      <MmField label="Height clearance" value={d.verticalClearance} min={0} max={100} step={1} onChange={v => onChange({ ...d, verticalClearance: v })} />
      <MmField label="Space behind runner" value={d.rearClearance} min={0} max={100} step={1} onChange={v => onChange({ ...d, rearClearance: v })} />
      <Select label="Drawer box" value={d.boxMaterialId} options={matOptions(materials, m => m.thickness >= 10)} onChange={v => onChange({ ...d, boxMaterialId: v })} />
      <Select label="Drawer bottom" value={d.bottomMaterialId} options={matOptions(materials)} onChange={v => onChange({ ...d, bottomMaterialId: v })} />
      <div className="field">
        <label htmlFor="runner-lengths">Runner lengths you can buy</label>
        <input id="runner-lengths" defaultValue={d.runnerLengths.join(', ')} key={d.runnerLengths.join(',')}
          onBlur={e => {
            const v = e.target.value.split(/[,\s]+/).map(Number).filter(n => Number.isInteger(n) && n > 0)
            if (v.length) onChange({ ...d, runnerLengths: [...new Set(v)].sort((a, b) => a - b) })
          }} />
        <p className="hint">The longest one that fits the depth is chosen.</p>
      </div>
    </Group>
  )
}

function CornerEditor({ p, materials }: { p: CornerParams; materials: Material[] }) {
  const set = useDesign(s => s.updateCorner)
  const select = useDesign(s => s.select)
  const panelMats = matOptions(materials, m => m.thickness >= 12)
  const blind = p.variant === 'blind'
  const inside = insideSummary(blind ? [p.interior] : [p.interior, p.wingInterior])
  const steps: Step[] = [
    { id: 'size', label: 'Size', meta: `${p.width}×${p.height}×${p.depth}`, done: true },
    { id: 'inside', label: 'Inside', meta: inside, done: inside !== 'Empty', tone: inside === 'Empty' ? 'warn' : undefined },
    { id: 'build', label: 'Build', meta: blind ? 'Blind corner' : 'L-shaped', done: true },
    { id: 'materials', label: 'Boards', meta: matName(materials, p.bodyMaterialId), done: true },
  ]
  return (
    <div className="inspector">
      <EditorRail steps={steps} inside={() => select(p.interior.id)} />
      <header className="insp-head">
        <h2>Corner unit</h2>
        <p className="hint">{blind ? 'A blind section the neighbouring cabinet covers, joined to a normal cabinet.' : 'Two wings open to each other at the corner, with a folding door pair. The front view shows the back-wall wing.'}</p>
      </header>
      <Segmented<CornerParams['variant']> label="Type" value={p.variant} options={[{ value: 'blind', label: 'Blind corner' }, { value: 'l-shape', label: 'L-shaped' }]} onChange={v => set({ variant: v })} />
      <Segmented<'left' | 'right'> label="Corner on the" value={p.side} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]} onChange={v => set({ side: v })} />
      <div className="dims3">
        <MmField label={blind ? 'Width' : 'Back wing'} value={p.width} min={300} max={3000} onChange={v => set({ width: v })} />
        <MmField label="Height" value={p.height} min={300} max={2500} onChange={v => set({ height: v })} />
        <MmField label="Depth" value={p.depth} min={200} max={900} onChange={v => set({ depth: v })} />
      </div>
      {blind
        ? <MmField label="Blind section" value={p.blindWidth} min={100} max={1500} onChange={v => set({ blindWidth: v })} hint={`About the neighbour's depth + 50 mm (${p.depth + 50}) keeps doors and handles clear.`} />
        : <MmField label="Side wing (incl. corner)" value={p.wingWidth} min={300} max={3000} onChange={v => set({ wingWidth: v })} />}
      <div className="field">
        <span className="field-label">Inside</span>
        <div className="split-actions">
          <button type="button" className="btn outline" onClick={() => select(p.interior.id)}>{blind ? 'Edit usable section' : 'Edit back-wall wing'}</button>
          {!blind && <button type="button" className="btn outline" onClick={() => select(p.wingInterior.id)}>Edit side-wall wing</button>}
        </div>
      </div>
      <Group title="Construction" id="g-build">
        <Segmented label="Top" value={p.top} options={[{ value: 'over', label: 'On the sides' }, { value: 'between', label: 'Between sides' }]} onChange={v => set({ top: v })} />
        <Segmented label="Back" value={p.back} options={[{ value: 'applied', label: 'Nailed on' }, { value: 'inset', label: 'Set in' }, { value: 'none', label: 'None' }]} onChange={v => set({ back: v })} />
        <MmField label="Plinth height" value={p.plinthHeight} min={0} max={250} onChange={v => set({ plinthHeight: v })} hint="0 for no plinth" />
        <MmField label="Gap between fronts" value={p.frontGap} min={0} max={10} step={1} onChange={v => set({ frontGap: v })} />
      </Group>
      <Group title="Materials" id="g-materials">
        <Select label="Body" value={p.bodyMaterialId} options={panelMats} onChange={v => set({ bodyMaterialId: v })} />
        <Select label="Fronts" value={p.frontMaterialId} options={panelMats} onChange={v => set({ frontMaterialId: v })} />
        <Select label="Back" value={p.backMaterialId} options={matOptions(materials)} onChange={v => set({ backMaterialId: v })} />
      </Group>
    </div>
  )
}

const SUPPORT_LABEL: Record<DeskSupport, string> = { gables: 'On panels', 'pedestal-left': 'Unit left', 'pedestal-right': 'Unit right', 'two-pedestals': 'Two units' }

function DeskEditor({ p, deskId, materials }: { p: DeskParams; deskId: string; materials: Material[] }) {
  const select = useDesign(s => s.select)
  const set = useDesign(s => s.updateDesk)
  const panelMats = matOptions(materials, m => m.thickness >= 12)
  const ped = p.support !== 'gables'
  const sides = (['left', 'right'] as const).filter(sd => usesPedestal(p, sd))
  const steps: Step[] = [
    { id: 'size', label: 'Size', meta: `${p.width}×${p.height}×${p.depth}`, done: true },
    { id: 'inside', label: 'Units', meta: ped ? insideSummary(sides.map(sd => pedestalRoot(p, sd, deskId))) : 'No drawer units', done: true, disabled: !ped },
    { id: 'build', label: 'Build', meta: SUPPORT_LABEL[p.support], done: true },
    { id: 'materials', label: 'Boards', meta: matName(materials, p.topMaterialId), done: true },
  ]
  return (
    <div className="inspector">
      <EditorRail steps={steps} inside={() => { if (sides[0]) select(pedestalRoot(p, sides[0], deskId).id) }} />
      <header className="insp-head"><h2>Desk</h2></header>
      <div className="dims3">
        <MmField label="Width" value={p.width} min={400} max={3000} onChange={v => set({ width: v })} />
        <MmField label="Height" value={p.height} min={400} max={1200} onChange={v => set({ height: v })} />
        <MmField label="Depth" value={p.depth} min={300} max={1200} onChange={v => set({ depth: v })} />
      </div>
      <Segmented<DeskSupport> label="Supports" value={p.support} onChange={v => set({ support: v })} options={[
        { value: 'gables', label: 'Panels' }, { value: 'pedestal-left', label: 'Drawers left' },
        { value: 'pedestal-right', label: 'Drawers right' }, { value: 'two-pedestals', label: 'Both' }]} />
      {ped && (
        <div className="dims2">
          <MmField label="Drawer unit width" value={p.pedestal.width} min={250} max={900} onChange={v => set({ pedestal: { ...p.pedestal, width: v } })} />
        </div>
      )}
      {ped && (
        <div className="field">
          <span className="field-label">Inside the drawer units</span>
          <div className="split-actions">
            {sides.map(sd => (
              <button key={sd} type="button" className="btn outline" onClick={() => select(pedestalRoot(p, sd, deskId).id)}>{sd === 'left' ? 'Edit left unit' : 'Edit right unit'}</button>
            ))}
          </div>
          <p className="hint">Or tap a drawer unit in the front view. Each unit is laid out on its own.</p>
        </div>
      )}
      <Group title="Construction" id="g-build">
        <MmField label="Top overhang at the front" value={p.frontOverhang} min={0} max={300} step={5} onChange={v => set({ frontOverhang: v })} />
        <Toggle label="Modesty panel at the back" checked={p.modesty.enabled} onChange={v => set({ modesty: { ...p.modesty, enabled: v } })} />
        {p.modesty.enabled && (
          <div className="dims2">
            <MmField label="Panel height" value={p.modesty.height} min={50} max={800} onChange={v => set({ modesty: { ...p.modesty, height: v } })} />
            <MmField label="Set in from rear" value={p.modesty.setback} min={0} max={400} onChange={v => set({ modesty: { ...p.modesty, setback: v } })} />
          </div>
        )}
      </Group>
      <Group title="Materials" id="g-materials">
        <Select label="Worktop" value={p.topMaterialId} options={panelMats} onChange={v => set({ topMaterialId: v })} />
        <Select label="Supports" value={p.bodyMaterialId} options={panelMats} onChange={v => set({ bodyMaterialId: v })} />
        {ped && <Select label="Drawer fronts" value={p.frontMaterialId} options={panelMats} onChange={v => set({ frontMaterialId: v })} />}
      </Group>
      {ped && <DrawerSettingsGroup value={p.drawers} materials={materials} onChange={d => set({ drawers: d })} />}
    </div>
  )
}
