import { useEffect, useMemo, useState } from 'react'
import { buildModel } from '../core/build'
import { catalogFamilies, CAPABILITY_WAITS, FUNCTION_LABEL, FUNCTIONS, insertable, insertVariant, missingCapabilities, ROOM_LABEL, ROOMS, startFamilies, type FunctionGroup, type Room } from '../core/catalog'
import { mergeCatalog, shadowOf, templateFromDesign, validateLocalTemplate, type LocalTemplate, type ViewFamily } from '../core/catalog/local'
import type { Design } from '../core/types'
import { listDesigns, type StoredDesign } from '../persist/db'
import { useDesign } from '../store/designStore'
import { useTemplates } from '../store/templatesStore'
import { Dialog } from './Dialogs'
import { Icon } from './icons'
import { familyGlyph, templateGlyph } from './Templates'

export type Grouping = 'room' | 'type'
const GROUP_KEY = 'furniture-builder:catalog-group'
const readGrouping = (): Grouping => { try { return localStorage.getItem(GROUP_KEY) === 'type' ? 'type' : 'room' } catch { return 'room' } }
const writeGrouping = (g: Grouping) => { try { localStorage.setItem(GROUP_KEY, g) } catch { /* private mode */ } }

/** Grouping chosen on this device: Room by default (ADR-0032), persisted in browser storage when it works. */
export function useGrouping(): [Grouping, (g: Grouping) => void] {
  const [g, setG] = useState<Grouping>(readGrouping)
  return [g, (next: Grouping) => { writeGrouping(next); setG(next) }]
}

/** Shipped families merged with the ones edited on this device. Computed outside any store selector. */
export function useCatalog(): ViewFamily[] {
  const locals = useTemplates(s => s.locals)
  const loaded = useTemplates(s => s.loaded)
  useEffect(() => { if (!loaded) void useTemplates.getState().refresh() }, [loaded])
  return useMemo(() => mergeCatalog(catalogFamilies, locals), [locals])
}

interface Group { key: string; label: string; items: { family: ViewFamily; also?: boolean }[] }

/** Room view lists a family under every room it carries (badged "also" after the first); Type view once. */
export function groupFamilies(families: ViewFamily[], by: Grouping): Group[] {
  if (by === 'type') return FUNCTIONS.map(fn => ({ key: fn, label: FUNCTION_LABEL[fn], items: families.filter(f => f.function === fn).map(family => ({ family })) })).filter(g => g.items.length)
  const groups: Group[] = ROOMS.map(r => ({ key: r, label: ROOM_LABEL[r], items: families.filter(f => f.rooms.includes(r)).map(family => ({ family, also: family.rooms[0] !== r })) }))
  const other = families.filter(f => !f.rooms.length)
  if (other.length) groups.find(g => g.key === 'other')!.items.push(...other.map(family => ({ family })))
  return groups.filter(g => g.items.length)
}

function GroupToggle({ value, onChange }: { value: Grouping; onChange: (g: Grouping) => void }) {
  return (
    <div className="segmented small" role="radiogroup" aria-label="Group by">
      <button type="button" role="radio" aria-checked={value === 'room'} className={value === 'room' ? 'on' : ''} onClick={() => onChange('room')}>By room</button>
      <button type="button" role="radio" aria-checked={value === 'type'} className={value === 'type' ? 'on' : ''} onClick={() => onChange('type')}>By type</button>
    </div>
  )
}

const now = () => new Date().toISOString()

/**
 * "Start from" (ADR-0032): every family that can be built, its default variant first; the chevron opens the others.
 * Picking makes an independent copy with its origin recorded.
 */
export function StartFrom({ onPick, onBrowse }: { onPick: (d: Design) => void; onBrowse?: () => void }) {
  const families = useCatalog()
  const [grouping, setGrouping] = useGrouping()
  const [open, setOpen] = useState<string | null>(null)
  const groups = useMemo(() => groupFamilies(startFamilies(families) as ViewFamily[], grouping), [families, grouping])
  const pick = (f: ViewFamily, vId: string) => { const v = f.variants.find(x => x.id === vId); const d = v && insertVariant(f, v, now()); if (d) onPick(d) }
  return (
    <div className="start-from">
      <div className="start-head">
        <h3 className="list-head">Start from</h3>
        <GroupToggle value={grouping} onChange={setGrouping} />
        {onBrowse && <button type="button" className="btn sm" onClick={onBrowse}><Icon name="catalog" className="sm" />Full catalog</button>}
      </div>
      {groups.map(g => (
        <section key={g.key} className="start-group" aria-label={g.label}>
          <h4>{g.label} <span className="count">{g.items.length}</span></h4>
          <ul className="template-list template-grid">
            {g.items.map(({ family: f, also }) => {
              const first = f.variants.find(insertable)!
              const more = f.variants.filter(insertable).length - 1
              const key = `${g.key}:${f.id}`
              return (
                <li key={key} className="start-item">
                  <div className="start-row">
                    <button type="button" className="row-btn" onClick={() => pick(f, first.id)}>
                      <span className="glyph"><Icon name={familyGlyph(f)} /></span>
                      <span><strong>{f.name}{f.localId && <span className="tag">edited</span>}{also && <span className="tag subtle">also here</span>}</strong><span className="sub">{first.name} — {first.summary}</span></span>
                    </button>
                    {more > 0 && (
                      <button type="button" className="btn icon ghost sm" aria-expanded={open === key} aria-label={`${more} more ${f.name} variants`} title={`${more} more`}
                        onClick={() => setOpen(open === key ? null : key)}><Icon name={open === key ? 'chevron-down' : 'chevron-right'} /><span className="more">{more}</span></button>
                    )}
                  </div>
                  {open === key && (
                    <ul className="variant-picks">
                      {f.variants.filter(v => v.id !== first.id).map(v => (
                        <li key={v.id}>
                          <button type="button" className="link" disabled={!insertable(v)} onClick={() => pick(f, v.id)} title={insertable(v) ? undefined : waitsFor(v.requires)}>
                            {v.name} <span className="sub">{insertable(v) ? v.summary : waitsFor(v.requires)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

const waitsFor = (requires: Parameters<typeof missingCapabilities>[0]['requires']) =>
  missingCapabilities({ requires }).map(c => CAPABILITY_WAITS[c] ?? c).join('; ')

/** Size, parts and checks of a family's default variant, from the built model (ADR-0004). */
function useCardFacts(f: ViewFamily) {
  return useMemo(() => {
    const v = f.variants.find(insertable)
    if (!v) return null
    const m = buildModel(insertVariant(f, v, '')!)
    const errors = m.diagnostics.filter(d => d.severity === 'error').length
    return { w: m.bounds.w, h: m.bounds.h, d: m.bounds.d, parts: m.panels.length, errors, warnings: m.diagnostics.length - errors }
  }, [f])
}

type Source = 'templates' | 'saved' | 'brands'

/** The Catalog page (ADR-0027, amended by ADR-0032): templates, saved pieces and brand products. */
export function CatalogDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const families = useCatalog()
  const [grouping, setGrouping] = useGrouping()
  const [source, setSource] = useState<Source>('templates')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<LocalTemplate | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const project = useDesign(s => s.project)
  const editingItem = useDesign(s => s.editingItemId)
  const toProject = !!project && !editingItem
  const take = (d: Design) => {
    if (toProject) useDesign.getState().addPiece(d)
    else useDesign.getState().load(d)
    onClose()
  }
  const q = query.trim().toLowerCase()
  const shown = useMemo(() => (q ? families.filter(f => [f.name, f.nameRo, ...f.aliases].some(s => s.toLowerCase().includes(q))) : families), [families, q])
  const groups = useMemo(() => groupFamilies(shown, grouping), [shown, grouping])
  const startEdit = (f: ViewFamily) => {
    const local = f.localId ? useTemplates.getState().locals.find(t => t.id === f.localId) : undefined
    setEditing(local ? structuredClone(local) : shadowOf(catalogFamilies.find(x => x.id === f.id)!))
  }
  const exportLocal = () => {
    const data = JSON.stringify({ kind: 'mobila-templates', templates: useTemplates.getState().locals }, null, 2)
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: 'mobila-templates.json' }).click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const importLocal = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as { templates?: unknown[] }
      const list = Array.isArray(data.templates) ? data.templates : []
      let ok = 0, bad = 0
      for (const t of list) { if (validateLocalTemplate(t).length) { bad++; continue } await useTemplates.getState().save(t as LocalTemplate); ok++ }
      setMsg(`${ok} ${ok === 1 ? 'template' : 'templates'} imported${bad ? `, ${bad} skipped (not valid)` : ''}.`)
    } catch { setMsg('That file could not be read as a templates file.') }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Catalog" wide
      footer={<>
        <p className="hint start">Templates are starting points: picking one makes your own copy. Edits to a template stay on this device.</p>
        <button type="button" className="btn outline" onClick={exportLocal} disabled={!useTemplates.getState().locals.length}><Icon name="download" />Export my templates</button>
        <label className="btn outline file-btn"><Icon name="upload" />Import templates
          <input type="file" accept="application/json,.json" onChange={e => { const f = e.target.files?.[0]; if (f) void importLocal(f); e.target.value = '' }} />
        </label>
      </>}>
      <div className="catalog-toolbar">
        <div className="segmented small" role="tablist" aria-label="Source">
          {(['templates', 'saved', 'brands'] as const).map(s => (
            <button key={s} type="button" role="tab" aria-selected={source === s} className={source === s ? 'on' : ''} onClick={() => setSource(s)}>
              {s === 'templates' ? 'Templates' : s === 'saved' ? 'Saved on this device' : 'Brands'}
            </button>
          ))}
        </div>
        {source === 'templates' && <>
          <GroupToggle value={grouping} onChange={setGrouping} />
          <label className="search"><Icon name="search" className="sm" /><input type="search" placeholder="Search names and other names" aria-label="Search the catalog" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <SaveAsTemplate />
        </>}
      </div>
      {msg && <p className="alert info" role="status"><Icon name="info" className="sm" /><span>{msg}</span></p>}
      {source === 'templates' && (editing
        ? <TemplateEditor key={editing.id} draft={editing} onDone={m => { setEditing(null); if (m) setMsg(m) }} onEditDesign={(t, vid) => { useDesign.getState().editTemplateVariant(t, vid); onClose() }} />
        : groups.length === 0 ? <p className="empty center"><Icon name="search" />Nothing matches “{query}”.</p>
        : groups.map(g => (
          <section key={g.key} className="catalog-group" aria-label={g.label}>
            <h3 className="group-head">{g.label} <span className="count">{g.items.length}</span></h3>
            <div className="fam-grid">
              {g.items.map(({ family, also }) => <FamilyCard key={`${g.key}:${family.id}`} f={family} also={also} toProject={toProject} onTake={take} onEdit={() => startEdit(family)} />)}
            </div>
          </section>
        )))}
      {source === 'saved' && <SavedList onTake={take} />}
      {source === 'brands' && <p className="empty center"><Icon name="catalog" />No brand products yet. They arrive through the catalog feed (ADR-0029), which has not added any.</p>}
    </Dialog>
  )
}

const SUPPORT_TEXT = { ready: 'Ready', 'needs-construction': 'Needs construction', safety: 'Waits for safety values', reference: 'Reference' } as const

function FamilyCard({ f, also, toProject, onTake, onEdit }: { f: ViewFamily; also?: boolean; toProject: boolean; onTake: (d: Design) => void; onEdit: () => void }) {
  const facts = useCardFacts(f)
  const remove = useTemplates(s => s.remove)
  return (
    <article className={`fam-card support-${f.support}`}>
      <header>
        <span className="glyph"><Icon name={familyGlyph(f)} /></span>
        <div>
          <h4>{f.name}</h4>
          <p className="sub">{f.nameRo}{f.aliases.length ? ` · ${f.aliases.join(', ')}` : ''}</p>
        </div>
        <button type="button" className="btn icon ghost sm" onClick={onEdit} aria-label={`Edit the ${f.name} template`} title="Edit this template"><Icon name="pencil" /></button>
      </header>
      <p className="chips">
        <span className={`chip ${f.support}`}>{SUPPORT_TEXT[f.support]}</span>
        <span className="chip">{FUNCTION_LABEL[f.function as FunctionGroup]}</span>
        {f.rooms.map(r => <span key={r} className="chip subtle">{ROOM_LABEL[r as Room]}</span>)}
        {f.localId && <span className="chip edited">{f.own ? 'Your template' : 'Edited on this device'}</span>}
        {also && <span className="chip subtle">also listed in {ROOM_LABEL[f.rooms[0] as Room]}</span>}
      </p>
      {facts && <p className="facts num">{facts.w} × {facts.h} × {facts.d} mm · {facts.parts} parts{facts.errors ? ` · ${facts.errors} problems` : facts.warnings ? ` · ${facts.warnings} to check` : ' · no problems'}</p>}
      <p className="structure">{f.structure}</p>
      <details className="configs"><summary>What can be changed</summary><ul>{f.configurations.map(c => <li key={c}>{c}</li>)}</ul></details>
      {f.shippedUpdated && <ShippedUpdated f={f} />}
      <ul className="variants">
        {f.variants.map((v, i) => {
          const ok = insertable(v)
          return (
            <li key={v.id} className={ok ? '' : 'waits'}>
              <div>
                <strong>{v.name}</strong>{i === 0 && <span className="tag subtle">default</span>}
                <span className={`kind ${v.kind}`} title={v.kind === 'interior' ? 'Interior-only: builds on an existing product' : 'Needed new construction'}>{v.kind === 'interior' ? 'I' : 'C'}</span>
                <span className="sub">{ok ? v.summary : waitsFor(v.requires)}{v.hardware ? ` · choose: ${v.hardware}` : ''}</span>
              </div>
              <button type="button" className="btn sm" disabled={!ok} onClick={() => { const d = insertVariant(f, v); if (d) onTake(d) }}>{toProject ? 'Add' : 'Open'}</button>
            </li>
          )
        })}
      </ul>
      {f.localId && !f.own && <button type="button" className="danger-link" onClick={() => { if (confirm(`Reset “${f.name}” to the shipped template? Your edits to it on this device are removed.`)) void remove(f.localId!) }}>Reset to shipped</button>}
      {f.own && <button type="button" className="danger-link" onClick={() => { if (confirm(`Delete your template “${f.name}”?`)) void remove(f.localId!) }}>Delete template</button>}
    </article>
  )
}

function ShippedUpdated({ f }: { f: ViewFamily }) {
  const save = useTemplates(s => s.save), remove = useTemplates(s => s.remove)
  const shipped = catalogFamilies.find(x => x.id === f.id)
  if (!shipped) return null
  return (
    <p className="alert info"><Icon name="info" className="sm" />
      <span>The shipped template was updated (revision {shipped.catalogVersion}). Shipped: {shipped.variants.length} variants; yours: {f.variants.length}.</span>
      <button type="button" className="btn sm" onClick={() => { const t = useTemplates.getState().locals.find(x => x.id === f.localId); if (t) void save({ ...t, basedOn: shipped.catalogVersion, updatedAt: now() }) }}>Keep mine</button>
      <button type="button" className="btn sm" onClick={() => { if (confirm('Replace your edits with the shipped template?')) void remove(f.localId!) }}>Use shipped</button>
    </p>
  )
}

function SaveAsTemplate() {
  const design = useDesign(s => s.design)
  const project = useDesign(s => s.project), editingItem = useDesign(s => s.editingItemId)
  const save = useTemplates(s => s.save)
  const [done, setDone] = useState(false)
  if (project && !editingItem) return null
  return (
    <button type="button" className="btn sm" disabled={done} onClick={() => {
      const name = prompt('Name of the new template', design.name)?.trim()
      if (!name) return
      void save(templateFromDesign(design, { name, function: 'storage', rooms: ['other'] })).then(() => setDone(true))
    }}>{done ? 'Saved as a template' : 'Save this piece as a template'}</button>
  )
}

function SavedList({ onTake }: { onTake: (d: Design) => void }) {
  const [rows, setRows] = useState<StoredDesign[] | null>(null)
  useEffect(() => { listDesigns().then(setRows).catch(() => setRows([])) }, [])
  if (!rows) return <p className="loading">Loading…</p>
  if (!rows.length) return <p className="empty center"><Icon name="folder" />Nothing saved on this device yet.</p>
  return (
    <ul className="template-list template-grid">
      {rows.map(r => (
        <li key={r.id}>
          <button type="button" className="row-btn" onClick={() => onTake(r.design)}>
            <span className="glyph"><Icon name={templateGlyph(r.design.product.kind)} /></span>
            <span><strong>{r.name}</strong><span className="sub">{r.design.catalog?.origin ? `Based on ${r.design.catalog.origin.productName}` : 'Your design'}</span></span>
            <Icon name="chevron-right" className="chev sm" />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Edit a family on this device (ADR-0034): names, grouping, text, variant order and names; designs in the editor. */
function TemplateEditor({ draft: initial, onDone, onEditDesign }: { draft: LocalTemplate; onDone: (msg?: string) => void; onEditDesign: (t: LocalTemplate, variantId: string) => void }) {
  const [t, setT] = useState(initial)
  const save = useTemplates(s => s.save)
  const f = t.family
  const setF = (patch: Partial<typeof f>) => setT({ ...t, family: { ...f, ...patch } })
  const setV = (i: number, patch: Partial<(typeof f.variants)[number]>) => setF({ variants: f.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) })
  const move = (i: number, d: -1 | 1) => { const vs = [...f.variants]; const j = i + d; if (j < 0 || j >= vs.length) return; [vs[i], vs[j]] = [vs[j], vs[i]]; setF({ variants: vs }) }
  const errs = validateLocalTemplate({ ...t, updatedAt: now() })
  const commit = async (next = t) => { const stamped = { ...next, revision: next.revision + 1, updatedAt: now() }; await save(stamped); return stamped }
  return (
    <section className="template-editor" aria-label={`Edit template ${f.name}`}>
      <div className="card-title"><span>Edit template</span><span className="hint">Saved on this device only; the shipped template never changes.</span></div>
      <div className="dims2">
        <div className="field"><label htmlFor="te-name">Name</label><input id="te-name" value={f.name} onChange={e => setF({ name: e.target.value })} /></div>
        <div className="field"><label htmlFor="te-aliases">Other names (comma-separated)</label><input id="te-aliases" value={f.aliases.join(', ')} onChange={e => setF({ aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>
      </div>
      <div className="field">
        <label htmlFor="te-fn">Type</label>
        <select id="te-fn" value={f.function} onChange={e => setF({ function: e.target.value as FunctionGroup })}>{FUNCTIONS.map(fn => <option key={fn} value={fn}>{FUNCTION_LABEL[fn]}</option>)}</select>
      </div>
      <fieldset className="field rooms"><legend>Rooms (the first ticked is the main one)</legend>
        {ROOMS.map(r => (
          <label key={r} className="toggle small"><input type="checkbox" checked={f.rooms.includes(r)} onChange={e => setF({ rooms: e.target.checked ? [...f.rooms, r] : f.rooms.filter(x => x !== r) })} /><span>{ROOM_LABEL[r]}</span></label>
        ))}
      </fieldset>
      <div className="field"><label htmlFor="te-structure">Default structure</label><textarea id="te-structure" rows={2} value={f.structure} onChange={e => setF({ structure: e.target.value })} /></div>
      <div className="field"><label htmlFor="te-config">What can be changed (one per line)</label><textarea id="te-config" rows={3} value={f.configurations.join('\n')} onChange={e => setF({ configurations: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} /></div>
      <div className="field">
        <span className="field-label">Variants (1–5; the first is the default)</span>
        <ul className="variant-edit">
          {f.variants.map((v, i) => (
            <li key={v.id}>
              <input aria-label="Variant name" value={v.name} onChange={e => setV(i, { name: e.target.value })} />
              <input aria-label="Variant summary" value={v.summary} onChange={e => setV(i, { summary: e.target.value })} />
              <div className="row-actions">
                <button type="button" className="btn icon ghost sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="btn icon ghost sm" aria-label="Move down" disabled={i === f.variants.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="btn sm" disabled={!v.design} onClick={async () => onEditDesign(await commit(), v.id)}>Edit design</button>
                <button type="button" className="btn sm" disabled={f.variants.length >= 5 || !v.design} onClick={() => setF({ variants: [...f.variants, { ...structuredClone(v), id: `${v.id}-copy-${Date.now().toString(36)}`, name: `${v.name} (copy)` }] })}><Icon name="copy" className="sm" />Duplicate</button>
                <button type="button" className="btn sm danger" disabled={f.variants.length <= 1} onClick={() => setF({ variants: f.variants.filter((_, j) => j !== i) })}><Icon name="trash" className="sm" /></button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {errs.length > 0 && <p className="alert error" role="alert"><Icon name="alert-circle" className="sm" /><span>{errs.slice(0, 3).join('; ')}</span></p>}
      <div className="split-actions">
        <button type="button" className="btn primary" disabled={errs.length > 0} onClick={async () => { await commit(); onDone(`Template “${f.name}” saved on this device.`) }}>Save template</button>
        <button type="button" className="btn outline" onClick={() => onDone()}>Cancel</button>
      </div>
    </section>
  )
}
