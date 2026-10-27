import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';
import { buildModel } from '../core/build';
import { PHONE, useMediaQuery } from './useMediaQuery';
import { snapshotSvg } from '../core/snapshot';
import {
  catalogFamilies,
  CAPABILITY_WAITS,
  FUNCTION_LABEL,
  FUNCTIONS,
  insertable,
  insertVariant,
  isSafetyConfirmed,
  missingCapabilities,
  ROOM_LABEL,
  ROOMS,
  setSafetyConfirmed,
  startFamilies,
  type CatalogVariant,
  type FunctionGroup,
  type Room,
} from '../core/catalog';
import {
  mergeCatalog,
  shadowOf,
  templateFromDesign,
  validateLocalTemplate,
  type LocalTemplate,
  type ViewFamily,
} from '../core/catalog/local';
import { VARIANT_RO } from '../core/catalog/ro';
import { brandEntries, copyBrandEntry } from '../core/catalog/brands';
import { newId } from '../core/design';
import type { Design } from '../core/types';
import { listDesigns, type StoredDesign } from '../persist/db';
import { useDesign } from '../store/designStore';
import { useTemplates } from '../store/templatesStore';
import { ProjectTemplateList } from './ProjectTemplates';
import { askConfirm, askText } from './Confirm';
import { InfoTip } from './controls';
import { Icon } from './icons';
import { familyGlyph, templateGlyph } from './Templates';

export type Grouping = 'room' | 'type';
const GROUP_KEY = 'furniture-builder:catalog-group';
const SAFETY_KEY = 'furniture-builder:safety-confirmed';
const readGrouping = (): Grouping => {
  try {
    return localStorage.getItem(GROUP_KEY) === 'type' ? 'type' : 'room';
  } catch {
    return 'room';
  }
};
const writeGrouping = (g: Grouping) => {
  try {
    localStorage.setItem(GROUP_KEY, g);
  } catch {
    /* private mode */
  }
};
// The safety confirmation is remembered on this device (ADR-035); read once when the app loads.
try {
  setSafetyConfirmed(localStorage.getItem(SAFETY_KEY) === 'yes');
} catch {
  /* private mode */
}

/** Grouping chosen on this device: Room by default (ADR-032), persisted in browser storage when it works. */
export function useGrouping(): [Grouping, (g: Grouping) => void] {
  const [g, setG] = useState<Grouping>(readGrouping);
  return [
    g,
    (next: Grouping) => {
      writeGrouping(next);
      setG(next);
    },
  ];
}

/** The templates edited on this device (ADR-034), read once from storage; null until they are read. */
export function useLocalTemplates(): LocalTemplate[] | null {
  const locals = useTemplates((s) => s.locals);
  const loaded = useTemplates((s) => s.loaded);
  useEffect(() => {
    if (!loaded) void useTemplates.getState().refresh();
  }, [loaded]);
  return loaded ? locals : null;
}

/** Shipped families merged with the ones edited on this device. Computed outside any store selector. */
export function useCatalog(): ViewFamily[] {
  const locals = useLocalTemplates();
  return useMemo(() => mergeCatalog(catalogFamilies, locals ?? []), [locals]);
}

interface Group {
  key: string;
  label: string;
  items: { family: ViewFamily; also?: boolean }[];
}

/** Room view lists a family under every room it carries (badged "also" after the first); Type view once. */
export function groupFamilies(families: ViewFamily[], by: Grouping): Group[] {
  if (by === 'type')
    return FUNCTIONS.map((fn) => ({
      key: fn,
      label: FUNCTION_LABEL[fn],
      items: families.filter((f) => f.function === fn).map((family) => ({ family })),
    })).filter((g) => g.items.length);
  const groups: Group[] = ROOMS.map((r) => ({
    key: r,
    label: ROOM_LABEL[r],
    items: families
      .filter((f) => f.rooms.includes(r))
      .map((family) => ({ family, also: family.rooms[0] !== r }))
      // The room's own families first; those whose main room is elsewhere follow ("also" here).
      .sort((a, b) => Number(a.also) - Number(b.also)),
  }));
  const other = families.filter((f) => !f.rooms.length);
  if (other.length)
    groups.find((g) => g.key === 'other')!.items.push(...other.map((family) => ({ family })));
  return groups.filter((g) => g.items.length);
}

const itemCount = (g: Group) => g.items.reduce((n, i) => n + i.family.variants.length, 0);

function GroupToggle({ value, onChange }: { value: Grouping; onChange: (g: Grouping) => void }) {
  return (
    <div className="segmented small" role="radiogroup" aria-label="Group by">
      <button
        type="button"
        role="radio"
        aria-checked={value === 'room'}
        className={value === 'room' ? 'on' : ''}
        onClick={() => onChange('room')}
      >
        By room
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'type'}
        className={value === 'type' ? 'on' : ''}
        onClick={() => onChange('type')}
      >
        By type
      </button>
    </div>
  );
}

const now = () => new Date().toISOString();
const waitsFor = (requires: CatalogVariant['requires']) =>
  missingCapabilities({ requires })
    .map((c) => CAPABILITY_WAITS[c] ?? c)
    .join('; ');
const matches = (f: ViewFamily, v: CatalogVariant, q: string) =>
  !q ||
  [f.name, f.nameRo, ...f.aliases, v.name, VARIANT_RO[v.id] ?? ''].some((s) =>
    s.toLowerCase().includes(q),
  );

/** The catalog's own actions; on a phone they fold under one button so the list starts higher up. */
function CatalogActions({ phone, children }: { phone: boolean; children: ReactNode }) {
  if (!phone) return <div className="catalog-actions">{children}</div>;
  return (
    <details className="catalog-more">
      <summary>
        More catalog actions
        <Icon name="chevron-down" className="sm" />
      </summary>
      <div className="catalog-actions">{children}</div>
    </details>
  );
}

/**
 * "Start from" (ADR-032) in New and in a project's "Add a piece": every catalog item, grouped by room or type, with
 * search. Picking one makes an independent copy with its origin recorded.
 */
export function StartFrom({
  onPick,
  onBrowse,
  dragFor,
}: {
  onPick: (d: Design) => void;
  onBrowse?: () => void;
  /** Pointer handlers that let an item be dragged onto the plan (ADR-094); `make` builds its copy. */
  dragFor?: (make: () => Design | null) => HTMLAttributes<HTMLButtonElement>;
}) {
  const families = useCatalog();
  const [grouping, setGrouping] = useGrouping();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const groups = useMemo(
    () => groupFamilies(startFamilies(families) as ViewFamily[], grouping),
    [families, grouping],
  );
  const total = useMemo(
    () => startFamilies(families).reduce((n, f) => n + f.variants.filter(insertable).length, 0),
    [families],
  );
  return (
    <div className="start-from">
      <div className="start-head">
        <h3 className="list-head">
          Start from <span className="count">{total} ready items</span>
        </h3>
        <GroupToggle value={grouping} onChange={setGrouping} />
        {onBrowse && (
          <button type="button" className="btn sm" onClick={onBrowse}>
            <Icon name="catalog" className="sm" />
            Open the Catalog
          </button>
        )}
      </div>
      <label className="search">
        <Icon name="search" className="sm" />
        <input
          type="search"
          placeholder="Search, e.g. wardrobe, dulap, bed"
          aria-label="Search the items"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      {groups.map((g) => {
        const rows = g.items.flatMap(({ family: f }) =>
          f.variants.filter((v) => insertable(v) && matches(f, v, q)).map((v) => ({ f, v })),
        );
        if (!rows.length) return null;
        return (
          <section key={g.key} className="start-group" aria-label={g.label}>
            <h4>
              {g.label} <span className="count">{rows.length}</span>
            </h4>
            <ul className="template-list template-grid">
              {rows.map(({ f, v }) => (
                <li key={`${g.key}:${f.id}:${v.id}`}>
                  <button
                    type="button"
                    className="row-btn"
                    {...dragFor?.(() => insertVariant(f, v, now()))}
                    onClick={() => {
                      const d = insertVariant(f, v, now());
                      if (d) onPick(d);
                    }}
                  >
                    <ItemPicture f={f} v={v} className="thumb" width={64} height={44} alt="" />
                    <span>
                      <strong>
                        {f.name}: {v.name}
                      </strong>
                      <span className="sub">
                        {v.summary}
                        {VARIANT_RO[v.id] ? ` · ${f.nameRo}: ${VARIANT_RO[v.id]}` : ''}
                      </span>
                    </span>
                    <Icon name="chevron-right" className="chev sm" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Size, parts and checks of one item, from its built model (ADR-004). */
function itemFacts(f: ViewFamily, v: CatalogVariant) {
  if (!insertable(v)) return null;
  const m = buildModel(insertVariant(f, v, '')!);
  const errors = m.diagnostics.filter((d) => d.severity === 'error').length;
  return {
    w: m.bounds.w,
    h: m.bounds.h,
    d: m.bounds.d,
    parts: m.panels.length,
    errors,
    warnings: m.diagnostics.length - errors,
  };
}

type Source = 'templates' | 'saved' | 'brands';

/**
 * The Catalog page (ADR-027 as amended by ADR-032): a full page, reached from the "Catalog" tab in the top bar or
 * the #catalog link. It lists every item (each variant of each family) with its default structure and what can be
 * changed, grouped by room or by type; items open or join the open project; templates are edited here (ADR-034).
 */
export function CatalogPage({
  onDone,
  onNewPiece,
}: {
  onDone: () => void;
  onNewPiece?: () => void;
}) {
  const families = useCatalog();
  const phone = useMediaQuery(PHONE);
  const [grouping, setGrouping] = useGrouping();
  const [source, setSource] = useState<Source>('templates');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<LocalTemplate | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [safety, setSafety] = useState(isSafetyConfirmed());
  const project = useDesign((s) => s.project);
  const editingItem = useDesign((s) => s.editingItemId);
  const toProject = !!project && !editingItem;
  const take = (d: Design) => {
    if (toProject) useDesign.getState().addPiece(d);
    else useDesign.getState().load(d);
    onDone();
  };
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => families.filter((f) => f.variants.some((v) => matches(f, v, q))),
    [families, q],
  );
  const groups = useMemo(() => groupFamilies(shown, grouping), [shown, grouping]);
  const all = families.flatMap((f) => f.variants);
  const ready = all.filter(insertable).length;
  const startEdit = (f: ViewFamily) => {
    const local = f.localId
      ? useTemplates.getState().locals.find((t) => t.id === f.localId)
      : undefined;
    setEditing(
      local ? structuredClone(local) : shadowOf(catalogFamilies.find((x) => x.id === f.id)!),
    );
    window.scrollTo({ top: 0 });
  };
  const toggleSafety = (v: boolean) => {
    setSafetyConfirmed(v);
    try {
      localStorage.setItem(SAFETY_KEY, v ? 'yes' : 'no');
    } catch {
      /* private mode */
    }
    setSafety(v);
  };
  const exportLocal = () => {
    const data = JSON.stringify(
      { kind: 'mobila-templates', templates: useTemplates.getState().locals },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    Object.assign(document.createElement('a'), {
      href: url,
      download: 'mobila-templates.json',
    }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importLocal = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as { templates?: unknown[] };
      const list = Array.isArray(data.templates) ? data.templates : [];
      let ok = 0,
        bad = 0;
      for (const t of list) {
        if (validateLocalTemplate(t).length) {
          bad++;
          continue;
        }
        await useTemplates.getState().save(t as LocalTemplate);
        ok++;
      }
      setMsg(
        `${ok} ${ok === 1 ? 'template' : 'templates'} imported${bad ? `, ${bad} skipped (not valid)` : ''}.`,
      );
    } catch {
      setMsg('That file could not be read as a templates file.');
    }
  };
  return (
    <main className="catalog-page" aria-label="Catalog">
      <header className="catalog-head">
        <div>
          <div className="info-row">
            <h1>Catalog</h1>
            <InfoTip label="About the catalog" align="start">
              {toProject
                ? 'Pick one to add it to the open project.'
                : 'Pick one to open your own copy in the editor.'}
            </InfoTip>
          </div>
          <p className="hint">
            <strong className="num">{all.length} items</strong> in {families.length} families ·{' '}
            {ready} open right away.
          </p>
        </div>
        <div className="split-actions">
          {onNewPiece && (
            <button type="button" className="btn primary" onClick={onNewPiece}>
              <Icon name="plus" className="sm" />
              New piece
            </button>
          )}
          <button type="button" className="btn outline" onClick={onDone}>
            <Icon name="chevron-right" className="sm" />
            Back to the editor
          </button>
        </div>
      </header>
      <div className="catalog-toolbar">
        <div className="segmented small" role="tablist" aria-label="Source">
          {(['templates', 'saved', 'brands'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={source === s}
              className={source === s ? 'on' : ''}
              onClick={() => setSource(s)}
            >
              {s === 'templates' ? 'Templates' : s === 'saved' ? 'Saved on this device' : 'Brands'}
            </button>
          ))}
        </div>
        {source === 'templates' && (
          <>
            <GroupToggle value={grouping} onChange={setGrouping} />
            <label className="search">
              <Icon name="search" className="sm" />
              <input
                type="search"
                placeholder="Search, e.g. wardrobe, dulap, bed"
                aria-label="Search the catalog"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </>
        )}
      </div>
      {source === 'templates' && (
        <CatalogActions phone={phone}>
          <span className="info-row">
            <label className="toggle small">
              <input
                type="checkbox"
                checked={safety}
                onChange={(e) => toggleSafety(e.target.checked)}
              />
              <span>I check safety-regulated items myself</span>
            </label>
            <InfoTip label="About safety-regulated items" align="start">
              Safety-regulated items (bunk bed, cradle): you check them against the standards
              yourself.
            </InfoTip>
          </span>
          <SaveAsTemplate />
          <details className="menu catalog-files">
            <summary aria-label="Template files" title="Export or import your own templates">
              <Icon name="more" className="sm" />
              <span>Template files</span>
            </summary>
            <div className="menu-items">
              <button
                type="button"
                onClick={exportLocal}
                disabled={!useTemplates.getState().locals.length}
              >
                <Icon name="download" />
                Export my templates
              </button>
              <label className="menu-file">
                <Icon name="upload" />
                Import templates
                <input
                  type="file"
                  accept="application/json,.json"
                  aria-label="Import templates"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importLocal(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </details>
        </CatalogActions>
      )}
      {msg && (
        <p className="alert info" role="status">
          <Icon name="info" className="sm" />
          <span>{msg}</span>
        </p>
      )}
      {source === 'templates' && editing && (
        <TemplateEditor
          key={editing.id}
          draft={editing}
          onDone={(m) => {
            setEditing(null);
            if (m) setMsg(m);
          }}
          onEditDesign={(t, vid) => {
            useDesign.getState().editTemplateVariant(t, vid);
            onDone();
          }}
        />
      )}
      {source === 'templates' &&
        !editing &&
        (groups.length === 0 ? (
          <p className="empty center">
            <Icon name="search" />
            Nothing matches “{query}”.
          </p>
        ) : (
          <nav className="group-index" aria-label="Jump to a group">
            {groups.map((g) => (
              <a
                key={g.key}
                href={`#cat-${g.key}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`cat-${g.key}`)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {g.label} <span className="count">{itemCount(g)}</span>
              </a>
            ))}
          </nav>
        ))}
      {source === 'templates' &&
        !editing &&
        groups.map((g) => (
          <section key={g.key} id={`cat-${g.key}`} className="catalog-group" aria-label={g.label}>
            <h2 className="group-head">
              {g.label} <span className="count">{itemCount(g)} items</span>
            </h2>
            {g.items.map(({ family, also }) => (
              <FamilyBlock
                key={`${g.key}:${family.id}`}
                f={family}
                also={also}
                q={q}
                toProject={toProject}
                onTake={take}
                onEdit={() => startEdit(family)}
              />
            ))}
          </section>
        ))}
      {source === 'saved' && (
        <>
          <SavedList onTake={take} />
          <ProjectTemplateList manage onOpened={onDone} />
        </>
      )}
      {source === 'brands' &&
        (brandEntries.length === 0 ? (
          <p className="empty center">
            <Icon name="catalog" />
            No brand products yet. The weekly catalog feed (Mondays, IKEA first) adds them once it
            can reach the manufacturers' sites.
          </p>
        ) : (
          <ul className="template-list template-grid">
            {brandEntries.map((e) => (
              <li key={e.catalogId}>
                <button
                  type="button"
                  className="row-btn"
                  onClick={() => take(copyBrandEntry(e, newId()))}
                >
                  <span className="glyph">
                    <Icon name={templateGlyph(e.design.product.kind)} />
                  </span>
                  <span>
                    <strong>
                      {e.design.catalog!.brand} {e.design.catalog!.productName ?? e.design.name}
                    </strong>
                    <span className="sub">
                      {e.design.catalog!.category ?? ''}
                      {e.design.catalog!.articleNumber
                        ? ` · ${e.design.catalog!.articleNumber}`
                        : ''}
                    </span>
                  </span>
                  <Icon name="chevron-right" className="chev sm" />
                </button>
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}

/** Picture made before runtime from the shipped design (ADR-042, `npm run catalog:snapshots`). */
const snapshotUrl = (variantId: string) => `${import.meta.env.BASE_URL}catalog/${variantId}.svg`;

/**
 * An item's 3D picture (ADR-042 as answered 2026-10-23): the shipped file for shipped families; for families edited
 * on this device, drawn in the browser from the built model with the same renderer.
 */
export function ItemPicture({
  f,
  v,
  className,
  width,
  height,
  alt,
}: {
  f: ViewFamily;
  v: CatalogVariant;
  className: string;
  width: number;
  height: number;
  alt: string;
}) {
  const local = !!f.localId;
  const drawn = useMemo(() => {
    if (!local || !insertable(v)) return null;
    const d = insertVariant(f, v, '');
    return d
      ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshotSvg(buildModel(d), d.materials))}`
      : null;
  }, [f, v, local]);
  if (!insertable(v) || (local && !drawn)) return null;
  return (
    <img
      className={className}
      src={drawn ?? snapshotUrl(v.id)}
      alt={alt}
      loading="lazy"
      decoding="async"
      width={width}
      height={height}
    />
  );
}

const SUPPORT_TEXT = {
  ready: 'Ready',
  'needs-construction': 'Needs construction',
  safety: 'Safety-regulated',
  reference: 'Reference',
} as const;

/** One family: its default structure and what can be changed, then every item (variant) as its own card. */
function FamilyBlock({
  f,
  also,
  q,
  toProject,
  onTake,
  onEdit,
}: {
  f: ViewFamily;
  also?: boolean;
  q: string;
  toProject: boolean;
  onTake: (d: Design) => void;
  onEdit: () => void;
}) {
  const remove = useTemplates((s) => s.remove);
  const items = f.variants.filter((v) => matches(f, v, q));
  const facts = useMemo(() => new Map(f.variants.map((v) => [v.id, itemFacts(f, v)])), [f]);
  return (
    <article className={`family support-${f.support}`} aria-label={f.name}>
      <header className="family-head">
        <span className="glyph">
          <Icon name={familyGlyph(f)} />
        </span>
        <div>
          <h3>
            {f.name} <span className="ro">{f.nameRo}</span>
          </h3>
          <p className="chips">
            <span className={`chip ${f.support}`}>{SUPPORT_TEXT[f.support]}</span>
            <span className="chip">{FUNCTION_LABEL[f.function as FunctionGroup]}</span>
            {f.rooms.map((r) => (
              <span key={r} className="chip subtle">
                {ROOM_LABEL[r as Room]}
              </span>
            ))}
            {f.localId && (
              <span className="chip edited">
                {f.own ? 'Your template' : 'Edited on this device'}
              </span>
            )}
            {also && (
              <span className="chip subtle">main room: {ROOM_LABEL[f.rooms[0] as Room]}</span>
            )}
            {f.aliases.length > 0 && (
              <span className="aliases">also called {f.aliases.join(', ')}</span>
            )}
          </p>
        </div>
        <button type="button" className="btn sm" onClick={onEdit}>
          <Icon name="pencil" className="sm" />
          Edit template
        </button>
      </header>
      <div className="family-body">
        <p className="structure">
          <strong>Default structure:</strong> {f.structure}
        </p>
        <div className="configs">
          <strong>Configurations:</strong>
          <ul>
            {f.configurations.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
      {f.shippedUpdated && <ShippedUpdated f={f} />}
      <ul className="items">
        {items.map((v, i) => {
          const ok = insertable(v);
          const fx = facts.get(v.id);
          return (
            <li key={v.id} className={`item ${ok ? '' : 'waits'}`}>
              {ok && (
                <ItemPicture
                  f={f}
                  v={v}
                  className="snap"
                  width={240}
                  height={150}
                  alt={`${f.name}: ${v.name}, 3D view`}
                />
              )}
              <div className="item-text">
                <span className="item-name">
                  <strong>{v.name}</strong>
                  {i === 0 && f.variants[0].id === v.id && (
                    <span className="tag subtle">default</span>
                  )}
                  <span
                    className={`kind ${v.kind}`}
                    title={
                      v.kind === 'interior'
                        ? 'Interior-only: built on an existing product'
                        : 'Needed new construction'
                    }
                  >
                    {v.kind === 'interior' ? 'Interior only' : 'New construction'}
                  </span>
                </span>
                {VARIANT_RO[v.id] && <span className="ro">{VARIANT_RO[v.id]}</span>}
                <span className="sub">{v.summary}</span>
                {fx && (
                  <span className="sub num">
                    {fx.w} × {fx.h} × {fx.d} mm · {fx.parts} parts
                    {fx.errors
                      ? ` · ${fx.errors} problems`
                      : fx.warnings
                        ? ` · ${fx.warnings} to check`
                        : ''}
                  </span>
                )}
                {v.hardware && <span className="sub">You choose: {v.hardware}</span>}
                {!ok && (
                  <span className="sub waits-why">
                    Not available yet: {waitsFor(v.requires) || 'no design'}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn sm outline"
                disabled={!ok}
                onClick={() => {
                  const d = insertVariant(f, v);
                  if (d) onTake(d);
                }}
              >
                {toProject ? 'Add' : 'Open'}
              </button>
            </li>
          );
        })}
      </ul>
      {f.localId && !f.own && (
        <button
          type="button"
          className="danger-link"
          onClick={async () => {
            if (
              await askConfirm(
                `Reset “${f.name}” to the shipped template? Your edits to it on this device are removed.`,
                { confirmLabel: 'Reset', danger: true },
              )
            )
              void remove(f.localId!);
          }}
        >
          Reset to shipped
        </button>
      )}
      {f.own && (
        <button
          type="button"
          className="danger-link"
          onClick={async () => {
            if (
              await askConfirm(`Delete your template “${f.name}”?`, {
                confirmLabel: 'Delete',
                danger: true,
              })
            )
              void remove(f.localId!);
          }}
        >
          Delete template
        </button>
      )}
    </article>
  );
}

function ShippedUpdated({ f }: { f: ViewFamily }) {
  const save = useTemplates((s) => s.save),
    remove = useTemplates((s) => s.remove);
  const shipped = catalogFamilies.find((x) => x.id === f.id);
  if (!shipped) return null;
  return (
    <p className="alert info">
      <Icon name="info" className="sm" />
      <span>
        The shipped template was updated (revision {shipped.catalogVersion}). Shipped:{' '}
        {shipped.variants.length} variants; yours: {f.variants.length}.
      </span>
      <button
        type="button"
        className="btn sm"
        onClick={() => {
          const t = useTemplates.getState().locals.find((x) => x.id === f.localId);
          if (t) void save({ ...t, basedOn: shipped.catalogVersion, updatedAt: now() });
        }}
      >
        Keep mine
      </button>
      <button
        type="button"
        className="btn sm"
        onClick={async () => {
          if (
            await askConfirm('Replace your edits with the shipped template?', {
              confirmLabel: 'Use shipped',
              danger: true,
            })
          )
            void remove(f.localId!);
        }}
      >
        Use shipped
      </button>
    </p>
  );
}

function SaveAsTemplate() {
  const design = useDesign((s) => s.design);
  const project = useDesign((s) => s.project),
    editingItem = useDesign((s) => s.editingItemId);
  const save = useTemplates((s) => s.save);
  const [done, setDone] = useState(false);
  if (project && !editingItem) return null;
  return (
    <button
      type="button"
      className="btn sm"
      disabled={done}
      onClick={async () => {
        const name = (await askText('Name of the new template', design.name))?.trim();
        if (!name) return;
        void save(templateFromDesign(design, { name, function: 'storage', rooms: ['other'] })).then(
          () => setDone(true),
        );
      }}
    >
      {done ? 'Saved as a template' : 'Save this piece as a template'}
    </button>
  );
}

function SavedList({ onTake }: { onTake: (d: Design) => void }) {
  const [rows, setRows] = useState<StoredDesign[] | null>(null);
  useEffect(() => {
    listDesigns()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);
  if (!rows) return <p className="loading">Loading…</p>;
  if (!rows.length)
    return (
      <p className="empty center">
        <Icon name="folder" />
        Nothing saved on this device yet.
      </p>
    );
  return (
    <ul className="template-list template-grid">
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" className="row-btn" onClick={() => onTake(r.design)}>
            <span className="glyph">
              <Icon name={templateGlyph(r.design.product.kind)} />
            </span>
            <span>
              <strong>{r.name}</strong>
              <span className="sub">
                {r.design.catalog?.origin
                  ? `Based on ${r.design.catalog.origin.productName}`
                  : 'Your design'}
              </span>
            </span>
            <Icon name="chevron-right" className="chev sm" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Edit a family on this device (ADR-034): names, grouping, text, variant order and names; designs in the editor. */
function TemplateEditor({
  draft: initial,
  onDone,
  onEditDesign,
}: {
  draft: LocalTemplate;
  onDone: (msg?: string) => void;
  onEditDesign: (t: LocalTemplate, variantId: string) => void;
}) {
  const [t, setT] = useState(initial);
  const save = useTemplates((s) => s.save);
  const f = t.family;
  const setF = (patch: Partial<typeof f>) => setT({ ...t, family: { ...f, ...patch } });
  const setV = (i: number, patch: Partial<(typeof f.variants)[number]>) =>
    setF({ variants: f.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  const move = (i: number, d: -1 | 1) => {
    const vs = [...f.variants];
    const j = i + d;
    if (j < 0 || j >= vs.length) return;
    [vs[i], vs[j]] = [vs[j], vs[i]];
    setF({ variants: vs });
  };
  const errs = validateLocalTemplate({ ...t, updatedAt: now() });
  const commit = async (next = t) => {
    const stamped = { ...next, revision: next.revision + 1, updatedAt: now() };
    await save(stamped);
    return stamped;
  };
  return (
    <section className="template-editor" aria-label={`Edit template ${f.name}`}>
      <div className="card-title">
        <span className="info-row">
          <span>Edit template</span>
          <InfoTip label="About editing a template" align="start">
            Saved on this device only; the shipped template never changes.
          </InfoTip>
        </span>
      </div>
      <div className="dims2">
        <div className="field">
          <label htmlFor="te-name">Name</label>
          <input id="te-name" value={f.name} onChange={(e) => setF({ name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="te-aliases">Other names (comma-separated)</label>
          <input
            id="te-aliases"
            value={f.aliases.join(', ')}
            onChange={(e) =>
              setF({
                aliases: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="te-fn">Type</label>
        <select
          id="te-fn"
          value={f.function}
          onChange={(e) => setF({ function: e.target.value as FunctionGroup })}
        >
          {FUNCTIONS.map((fn) => (
            <option key={fn} value={fn}>
              {FUNCTION_LABEL[fn]}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="field rooms">
        <legend>Rooms (the first ticked is the main one)</legend>
        {ROOMS.map((r) => (
          <label key={r} className="toggle small">
            <input
              type="checkbox"
              checked={f.rooms.includes(r)}
              onChange={(e) =>
                setF({ rooms: e.target.checked ? [...f.rooms, r] : f.rooms.filter((x) => x !== r) })
              }
            />
            <span>{ROOM_LABEL[r]}</span>
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="te-structure">Default structure</label>
        <textarea
          id="te-structure"
          rows={2}
          value={f.structure}
          onChange={(e) => setF({ structure: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="te-config">What can be changed (one per line)</label>
        <textarea
          id="te-config"
          rows={3}
          value={f.configurations.join('\n')}
          onChange={(e) =>
            setF({
              configurations: e.target.value
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </div>
      <div className="field">
        <span className="field-label">Variants (1–5; the first is the default)</span>
        <ul className="variant-edit">
          {f.variants.map((v, i) => (
            <li key={v.id}>
              <input
                aria-label="Variant name"
                value={v.name}
                onChange={(e) => setV(i, { name: e.target.value })}
              />
              <input
                aria-label="Variant summary"
                value={v.summary}
                onChange={(e) => setV(i, { summary: e.target.value })}
              />
              <div className="row-actions">
                <button
                  type="button"
                  className="btn icon ghost sm"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn icon ghost sm"
                  aria-label="Move down"
                  disabled={i === f.variants.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn sm"
                  disabled={!v.design}
                  onClick={async () => onEditDesign(await commit(), v.id)}
                >
                  Edit design
                </button>
                <button
                  type="button"
                  className="btn sm"
                  disabled={f.variants.length >= 5 || !v.design}
                  onClick={() =>
                    setF({
                      variants: [
                        ...f.variants,
                        {
                          ...structuredClone(v),
                          id: `${v.id}-copy-${Date.now().toString(36)}`,
                          name: `${v.name} (copy)`,
                        },
                      ],
                    })
                  }
                >
                  <Icon name="copy" className="sm" />
                  Duplicate
                </button>
                <button
                  type="button"
                  className="btn sm danger"
                  disabled={f.variants.length <= 1}
                  onClick={() => setF({ variants: f.variants.filter((_, j) => j !== i) })}
                >
                  <Icon name="trash" className="sm" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {errs.length > 0 && (
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>{errs.slice(0, 3).join('; ')}</span>
        </p>
      )}
      <div className="split-actions">
        <button
          type="button"
          className="btn primary"
          disabled={errs.length > 0}
          onClick={async () => {
            await commit();
            onDone(`Template “${f.name}” saved on this device.`);
          }}
        >
          Save template
        </button>
        <button type="button" className="btn outline" onClick={() => onDone()}>
          Cancel
        </button>
      </div>
    </section>
  );
}
