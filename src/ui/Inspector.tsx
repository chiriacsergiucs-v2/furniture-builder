import { useMemo } from 'react'
import { changeKind, fr, setDrawerCount, findInProduct, findSpace, parentOf, pedestalRoot, splitSpace, unsplit, usesPedestal, type PedestalSide } from '../core/design'
import type { CabinetParams, DeskParams, DeskSupport, Material, Space, SpaceKind, SplitSize } from '../core/types'
import { useDesign } from '../store/designStore'
import { Counter, Group, MmField, Segmented, Select, Toggle } from './controls'

const KIND_LABEL: Record<SpaceKind, string> = { empty: 'Empty', shelves: 'Shelves', drawers: 'Drawers', hanging: 'Hanging', split: 'Divided' }

export function Inspector() {
  const design = useDesign(s => s.design)
  const selectedId = useDesign(s => s.selectedId)
  const prod = design.product
  const found = selectedId ? findInProduct(prod, selectedId) : undefined
  if (found) return <SpaceEditor space={found.space} root={found.root} side={found.side} />
  return prod.kind === 'desk'
    ? <DeskEditor p={prod.params} deskId={prod.id} materials={design.materials} />
    : <CabinetEditor p={prod.params} materials={design.materials} />
}

function matOptions(materials: Material[], filter?: (m: Material) => boolean) {
  return materials.filter(filter ?? (() => true)).map(m => ({ value: m.id, label: `${m.name}` }))
}

const ROOT_LABEL = (side?: PedestalSide) => (side ? `${side === 'left' ? 'Left' : 'Right'} drawer unit` : 'Interior')

function Crumbs({ root, id, side }: { root: Space; id: string; side?: PedestalSide }) {
  const select = useDesign(s => s.select)
  const chain: Space[] = []
  let cur: Space | undefined = findSpace(root, id)
  while (cur) { chain.unshift(cur); cur = parentOf(root, cur.id) }
  return (
    <nav className="crumbs" aria-label="Where this space sits">
      <button type="button" onClick={() => select(null)}>{side ? 'Whole desk' : 'Whole cabinet'}</button>
      {chain.map((s, i) => (
        <span key={s.id}>
          <span aria-hidden="true" className="sep">/</span>
          {i === chain.length - 1
            ? <span aria-current="true">{i === 0 ? ROOT_LABEL(side) : KIND_LABEL[s.kind]}</span>
            : <button type="button" onClick={() => select(s.id)}>{i === 0 ? ROOT_LABEL(side) : KIND_LABEL[s.kind]}</button>}
        </span>
      ))}
    </nav>
  )
}

function SpaceEditor({ space, root, side }: { space: Space; root: Space; side?: PedestalSide }) {
  const update = useDesign(s => s.updateSpace)
  const select = useDesign(s => s.select)
  const opening = useDesign(s => s.model.spaces.find(o => o.nodeId === space.id))
  const allDiags = useDesign(s => s.model.diagnostics)
  const diags = useMemo(() => allDiags.filter(d => d.nodeId === space.id), [allDiags, space.id])
  const set = (fn: (s: Space) => Space) => update(space.id, fn)
  const parent = parentOf(root, space.id)

  return (
    <div className="inspector">
      <Crumbs root={root} id={space.id} side={side} />
      <header className="insp-head">
        <h2>{space.kind === 'split' ? 'Divided space' : `${KIND_LABEL[space.kind]}`}</h2>
        {opening && <p className="measure"><span>{opening.box.w}</span> wide × <span>{opening.box.h}</span> high × <span>{opening.box.d}</span> deep inside</p>}
      </header>

      {diags.length > 0 && (
        <ul className="inline-diags">{diags.map((d, i) => <li key={i} className={d.severity}>{d.message}</li>)}</ul>
      )}

      {space.kind !== 'split' && (
        <Segmented<SpaceKind> label="Contents" value={space.kind}
          options={(['empty', 'shelves', 'drawers', 'hanging'] as const).map(k => ({ value: k, label: KIND_LABEL[k] }))}
          onChange={k => set(s => changeKind(s, k))} />
      )}
      {space.kind === 'shelves' && <Counter label="Shelves" value={space.count} min={0} max={12} onChange={v => set(s => ({ ...s, count: v }) as Space)} />}
      {space.kind === 'shelves' && space.count > 0 && (
        <Toggle label="Adjustable, on shelf pins" checked={!!space.adjustable} onChange={v => set(s => ({ ...s, adjustable: v }) as Space)} />
      )}
      {space.kind === 'drawers' && <Counter label="Drawers" value={space.count} min={1} max={10} onChange={v => set(s => setDrawerCount(s, v))} />}
      {space.kind === 'drawers' && space.count > 1 && <DrawerHeights space={space} onChange={set} />}
      {space.kind === 'hanging' && <MmField label="Rail below top" value={space.railDrop} min={0} max={500} step={10} onChange={v => set(s => ({ ...s, railDrop: v }) as Space)} />}

      <Segmented<0 | 1 | 2> label="Doors" value={space.front?.count ?? 0}
        options={[{ value: 0, label: 'None' }, { value: 1, label: 'One' }, { value: 2, label: 'Pair' }]}
        onChange={n => set(s => ({ ...s, front: n === 0 ? null : { kind: 'doors', count: n } }))} />
      {space.kind === 'drawers' && space.front && <p className="hint">Drawers behind doors are built as internal drawers without their own fronts.</p>}

      {space.kind === 'split' ? (
        <SplitEditor space={space} onChange={set} onSelect={select} />
      ) : (
        <div className="field">
          <span className="field-label">Divide this space</span>
          <div className="split-actions">
            <button type="button" onClick={() => set(s => splitSpace(s, 'x', 2))}>Side by side</button>
            <button type="button" onClick={() => set(s => splitSpace(s, 'y', 2))}>Stacked</button>
          </div>
        </div>
      )}
      {parent && (
        <button type="button" className="link" onClick={() => select(parent.id)}>Select the divided space around this one</button>
      )}
    </div>
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
  return (
    <div className="inspector">
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
      <Group title="Construction">
        <Segmented label="Top" value={p.top} options={[{ value: 'over', label: 'On the sides' }, { value: 'between', label: 'Between sides' }]} onChange={v => set({ top: v })} />
        <Segmented label="Back" value={p.back} options={[{ value: 'applied', label: 'Nailed on' }, { value: 'inset', label: 'Set in' }, { value: 'none', label: 'None' }]} onChange={v => set({ back: v })} />
        {p.back === 'inset' && <MmField label="Back set in from rear" value={p.backInset} min={0} max={100} step={1} onChange={v => set({ backInset: v })} />}
        <MmField label="Plinth height" value={p.plinthHeight} min={0} max={250} onChange={v => set({ plinthHeight: v })} hint="0 for no plinth" />
        {p.plinthHeight > 0 && <MmField label="Plinth set back" value={p.plinthSetback} min={0} max={200} step={5} onChange={v => set({ plinthSetback: v })} />}
        <MmField label="Gap between fronts" value={p.frontGap} min={0} max={10} step={1} onChange={v => set({ frontGap: v })} />
        <MmField label="Shelf set back" value={p.shelfSetback} min={0} max={100} step={5} onChange={v => set({ shelfSetback: v })} />
        <div className="dims2">
          <MmField label="Adjustable shelf gap, each side" value={p.shelfClearance ?? 1} min={0} max={5} step={1} onChange={v => set({ shelfClearance: v })} />
          <MmField label="Pin rows from edges" value={p.pinRowSetback ?? 37} min={20} max={100} step={1} onChange={v => set({ pinRowSetback: v })} />
        </div>
      </Group>
      <Group title="Materials">
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
    <Group title="Drawers and runners" defaultOpen={false}>
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

function DeskEditor({ p, deskId, materials }: { p: DeskParams; deskId: string; materials: Material[] }) {
  const select = useDesign(s => s.select)
  const set = useDesign(s => s.updateDesk)
  const panelMats = matOptions(materials, m => m.thickness >= 12)
  const ped = p.support !== 'gables'
  return (
    <div className="inspector">
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
            {(['left', 'right'] as const).filter(sd => usesPedestal(p, sd)).map(sd => (
              <button key={sd} type="button" onClick={() => select(pedestalRoot(p, sd, deskId).id)}>{sd === 'left' ? 'Edit left unit' : 'Edit right unit'}</button>
            ))}
          </div>
          <p className="hint">Or tap a drawer unit in the front view. Each unit is laid out on its own.</p>
        </div>
      )}
      <MmField label="Top overhang at the front" value={p.frontOverhang} min={0} max={300} step={5} onChange={v => set({ frontOverhang: v })} />
      <Toggle label="Modesty panel at the back" checked={p.modesty.enabled} onChange={v => set({ modesty: { ...p.modesty, enabled: v } })} />
      {p.modesty.enabled && (
        <div className="dims2">
          <MmField label="Panel height" value={p.modesty.height} min={50} max={800} onChange={v => set({ modesty: { ...p.modesty, height: v } })} />
          <MmField label="Set in from rear" value={p.modesty.setback} min={0} max={400} onChange={v => set({ modesty: { ...p.modesty, setback: v } })} />
        </div>
      )}
      <Group title="Materials">
        <Select label="Worktop" value={p.topMaterialId} options={panelMats} onChange={v => set({ topMaterialId: v })} />
        <Select label="Supports" value={p.bodyMaterialId} options={panelMats} onChange={v => set({ bodyMaterialId: v })} />
        {ped && <Select label="Drawer fronts" value={p.frontMaterialId} options={panelMats} onChange={v => set({ frontMaterialId: v })} />}
      </Group>
      {ped && <DrawerSettingsGroup value={p.drawers} materials={materials} onChange={d => set({ drawers: d })} />}
    </div>
  )
}
