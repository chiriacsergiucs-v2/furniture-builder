// The Catalog page (ADR-027, ADR-032), split from Catalog.tsx so it loads on first use (ADR-222).
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildModel } from '../core/build';
import { PHONE, useMediaQuery } from '../store/useMediaQuery';
import {
  catalogFamilies,
  FUNCTION_LABEL,
  FUNCTIONS,
  insertable,
  insertVariant,
  isSafetyConfirmed,
  ROOM_LABEL,
  ROOMS,
  setSafetyConfirmed,
  type CatalogVariant,
  type FunctionGroup,
  type Room,
} from '../core/catalog';
import {
  MAX_VARIANTS,
  shadowOf,
  templateProblemTexts,
  validateLocalTemplate,
  type LocalTemplate,
  type ViewFamily,
} from '../core/catalog/local';
import { brandEntries, copyBrandEntry } from '../core/catalog/brands';
import { newId } from '../core/design';
import type { Design } from '../core/types';
import { listDecors, listDesigns, type StoredDesign } from '../store/libraryStore';
import { decorBrands, usesBrand } from '../core/catalog/decorBrands';
import { kindName, type Decor } from '../core/materials';
import { useDesign } from '../store/designStore';
import { useCatalogFinder } from '../store/useCatalogFinder';
import { saveRevision, useTemplates } from '../store/templatesStore';
import { saveDesignToCatalog } from '../store/saveToCatalog';
import { ProjectTemplateList } from './ProjectTemplates';
import { askConfirm } from './Confirm';
import { Dialog } from './Dialogs';
import { CatalogSaveForm } from './SaveToCatalog';
import { InfoTip, rovingKeys, rovingTab } from './controls';
import { t, tr } from '@furniture-builder/i18n';
import { MAX_IMPORT_BYTES } from './shell/importFile';
import { tNode } from './i18n';
import { Icon } from './icons';
import { AccountBadge, AccountRowActions } from './Account';
import {
  CatalogActions,
  groupFamilies,
  GroupToggle,
  ItemPicture,
  itemCount,
  matches,
  now,
  SAFETY_KEY,
  safetyOnly,
  useCatalog,
  useGrouping,
  waitsFor,
} from './Catalog';
import { familyGlyph, templateGlyph } from './Templates';
import {
  finderFamilies,
  finderRooms,
  finderTypes,
  NO_FILTER,
  type FinderFilter,
} from './catalogFinder';
/**
 * Paging (N311). The catalog was 15 000 px (desktop) to 27 000 px (phone) tall because every card was in the page. A group
 * lists its first GROUP_PAGE families and each tap adds GROUP_STEP; a flat list (saved designs, a brand's decors and
 * pieces) lists LIST_PAGE rows and each tap adds LIST_STEP. Measured on the production build with 12 families per group:
 * no shorter; with 4: 15 996 px (phone) and 8 455 px (desktop).
 */
export const GROUP_PAGE = 4;
export const GROUP_STEP = 8;
const LIST_PAGE = 24;
const LIST_STEP = 24;

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
  designOpen = true,
}: {
  onDone: () => void;
  onNewPiece?: () => void;
  /** Whether a design or project is open, so "Back to the editor" has somewhere to go (ADR-120). */
  designOpen?: boolean;
}) {
  const families = useCatalog();
  const [finder] = useCatalogFinder();
  const phone = useMediaQuery(PHONE);
  const [grouping, setGrouping] = useGrouping();
  const [source, setSource] = useState<Source>('templates');
  const [query, setQuery] = useState('');
  // A draft handed back by template mode (Cancel, or a Save that could not be stored) opens again here (ADR-195).
  const [editing, setEditing] = useState<LocalTemplate | null>(() => useTemplates.getState().draft);
  useEffect(() => {
    if (useTemplates.getState().draft) useTemplates.getState().setDraft(null);
  }, []);
  const storageError = useTemplates((s) => s.error);
  const errorRef = useRef<HTMLParagraphElement>(null);
  // A new storage failure is brought into view: the Save that failed may be far below it (ADR-195).
  useEffect(() => {
    if (storageError) errorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [storageError]);
  const [msg, setMsg] = useState<string | null>(null);
  /** The family just made by "Save this piece as a template", linked from its confirmation (ADR-195). */
  const [savedFamily, setSavedFamily] = useState<{ id: string; name: string } | null>(null);
  // A new object per tap, so tapping the link again scrolls again; scrolled once the list has rendered.
  const [jump, setJump] = useState<{ id: string } | null>(null);
  // Families revealed beyond the first page of each group. It belongs to one search and one grouping: a new query or a
  // switch of grouping starts every group at its first page again.
  const [moreState, setMoreState] = useState<{
    q: string;
    grouping: string;
    extra: Record<string, number>;
  }>({
    q: '',
    grouping,
    extra: {},
  });
  const jumpTo = (id: string) => {
    setSource('templates');
    setQuery('');
    setEditing(null);
    // The family may sit below the first page of its group (or groups): open each of them down to it.
    const extra: Record<string, number> = {};
    for (const g of groupFamilies(families, grouping)) {
      const at = g.items.findIndex((i) => i.family.id === id);
      if (at >= GROUP_PAGE) extra[g.key] = at + 1 - GROUP_PAGE;
    }
    setMoreState({ q: '', grouping, extra });
    setJump({ id });
  };
  useEffect(() => {
    if (!jump) return;
    document
      .querySelector<HTMLElement>(`[data-family="${jump.id.replace(/["\\]/g, '\\$&')}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [jump]);
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
  // A new query or grouping drops the revealed families for good (clearing the search later does not bring them back):
  // state adjusted while rendering, the pattern React documents for state that follows a prop.
  if (moreState.q !== q || moreState.grouping !== grouping)
    setMoreState({ q, grouping, extra: {} });
  const extra = moreState.q === q && moreState.grouping === grouping ? moreState.extra : {};
  const showMore = (key: string, by: number) =>
    setMoreState({ q, grouping, extra: { ...extra, [key]: (extra[key] ?? 0) + by } });
  const all = families.flatMap((f) => f.variants);
  const ready = all.filter(insertable).length;
  const sources = (
    <div className="segmented small" role="tablist" aria-label={t('Source')} onKeyDown={rovingKeys}>
      {(['templates', 'saved', 'brands'] as const).map((s, i) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={source === s}
          tabIndex={rovingTab(source === s, i, true)}
          aria-label={phone && s === 'saved' ? t('Saved on this device') : undefined}
          className={source === s ? 'on' : ''}
          onClick={() => setSource(s)}
        >
          {s === 'templates'
            ? t('Templates')
            : s === 'saved'
              ? phone
                ? t('Saved')
                : t('Saved on this device')
              : t('Brands')}
        </button>
      ))}
    </div>
  );
  const search = (
    <label className="search">
      <Icon name="search" className="sm" />
      <input
        type="search"
        placeholder={t('Search, e.g. wardrobe, dulap, bed')}
        aria-label={t('Search the catalog')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </label>
  );
  const startEdit = (f: ViewFamily) => {
    const local = f.localId
      ? useTemplates.getState().locals.find((x) => x.id === f.localId)
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
    if (file.size > MAX_IMPORT_BYTES) {
      setMsg(t('That file is too large to import (over 20 MB).'));
      return;
    }
    try {
      const data = JSON.parse(await file.text()) as { templates?: unknown[] };
      // A JSON file that is not a templates file is said as such, not as "0 templates imported" (ADR-262).
      if (!data || !Array.isArray(data.templates)) {
        setMsg(t('That file could not be read as a templates file.'));
        return;
      }
      const list = data.templates;
      let ok = 0,
        bad = 0,
        kept = 0;
      for (const raw of list) {
        if (validateLocalTemplate(raw).length) {
          bad++;
          continue;
        }
        const tpl = raw as LocalTemplate;
        // A family already edited on this device, or earlier in this file (saved by then), is asked about: Keep mine
        // (the default, also Esc) skips the imported one; only Use the imported one replaces the edit (ADR-203, G-363).
        const store = useTemplates.getState();
        const edited = tpl.shadows ? store.locals.filter((l) => l.shadows === tpl.shadows) : [];
        if (edited.length) {
          const use = await askConfirm(
            t('“{name}” is already edited on this device. Keep yours or use the imported one?', {
              name: tr(tpl.family.name),
            }),
            {
              confirmLabel: t('Use the imported one'),
              cancelLabel: t('Keep mine'),
              cancelFirst: true,
            },
          );
          if (!use) {
            kept++;
            continue;
          }
        }
        // A refused write is shown as the storage alert and not counted as imported (ADR-195). The device's other
        // edits of the family go only once the imported one is saved, so a failed save loses nothing (ADR-262).
        if (await store.save(tpl)) {
          ok++;
          for (const l of edited) if (l.id !== tpl.id) await store.remove(l.id);
        }
      }
      setMsg(
        `${t('{n|# template|# templates} imported', { n: ok })}${bad ? t(', {n} skipped (not valid)', { n: bad }) : ''}${kept ? t(', {n} kept as they were', { n: kept }) : ''}.`,
      );
    } catch {
      setMsg(t('That file could not be read as a templates file.'));
    }
  };
  const safetyToggle = (
    <>
      <span className="info-row">
        <label className="toggle small">
          <input
            type="checkbox"
            checked={safety}
            onChange={(e) => toggleSafety(e.target.checked)}
          />
          <span>{t('I check safety-regulated items myself')}</span>
        </label>
        <InfoTip label={t('About safety-regulated items')} align="start">
          {t(
            'Safety-regulated items (bunk bed, cradle): you check them against the standards yourself.',
          )}
        </InfoTip>
      </span>
    </>
  );
  const filesMenu = (
    <>
      <details className="menu catalog-files">
        <summary aria-label={t('Template files')} title={t('Export or import your own templates')}>
          <Icon name="more" className="sm" />
          <span>{t('Template files')}</span>
        </summary>
        <div className="menu-items">
          <button
            type="button"
            onClick={exportLocal}
            disabled={!useTemplates.getState().locals.length}
          >
            <Icon name="download" />
            {t('Export my templates')}
          </button>
          <label className="menu-file">
            <Icon name="upload" />
            {t('Import templates')}
            <input
              type="file"
              accept="application/json,.json"
              aria-label={t('Import templates')}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importLocal(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </details>
    </>
  );
  const alerts = (
    <>
      {storageError && (
        <p className="alert error" role="alert" ref={errorRef}>
          <Icon name="alert-circle" className="sm" />
          <span>{storageError}</span>
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => useTemplates.getState().clearError()}
          >
            {t('Dismiss')}
          </button>
        </p>
      )}
      {msg && (
        <p className="alert info" role="status">
          <Icon name="info" className="sm" />
          <span>{msg}</span>
        </p>
      )}
      {savedFamily && (
        <p className="alert info" role="status">
          <Icon name="check" className="sm" />
          <span>
            {t('Saved to the catalog.')}{' '}
            <a
              href={`#fam-${savedFamily.id}`}
              onClick={(e) => {
                e.preventDefault();
                jumpTo(savedFamily.id);
              }}
            >
              {t('Show “{name}”', { name: savedFamily.name })}
            </a>
          </span>
        </p>
      )}
    </>
  );
  const templateEditor = editing && (
    <>
      <TemplateEditor
        key={editing.id}
        draft={editing}
        onDone={(m) => {
          setEditing(null);
          if (m) setMsg(m);
        }}
        onEditDesign={(tpl, vid) => {
          useDesign.getState().editTemplateVariant(tpl, vid);
          onDone();
        }}
      />
    </>
  );
  const savedBlock = (
    <>
      <>
        <SavedList onTake={take} />
        {/* The project templates list reports its own read failure. */}
        <ProjectTemplateList manage onOpened={onDone} />
      </>
    </>
  );
  const brandsBlock = (
    <>
      <DecorBrandList onTake={take}>
        {brandEntries.length > 0 && (
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
                      {e.design.catalog!.brand} {e.design.catalog!.productName ?? tr(e.design.name)}
                    </strong>
                    <span className="sub">
                      {e.design.catalog!.category ? tr(e.design.catalog!.category) : ''}
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
        )}
      </DecorBrandList>
    </>
  );
  // The catalog finder (ADR-291): the same pieces, laid out search first, behind the More switch.
  if (finder)
    return (
      <FinderPage
        families={families}
        source={source}
        sources={sources}
        search={search}
        query={query}
        total={all.length}
        ready={ready}
        toProject={toProject}
        safety={safety}
        editing={!!editing}
        jump={jump}
        onConfirmSafety={() => toggleSafety(true)}
        onTake={take}
        onEdit={startEdit}
        actions={
          <>
            {onNewPiece && (
              <button type="button" className="btn primary" onClick={onNewPiece}>
                <Icon name="plus" className="sm" />
                {t('New piece')}
              </button>
            )}
            {designOpen && (
              <button type="button" className="btn outline" onClick={onDone}>
                <Icon name="chevron-left" className="sm" />
                {t('Back to the editor')}
              </button>
            )}
            {designOpen && <SaveAsTemplate onSaved={setSavedFamily} />}
            {filesMenu}
            {safetyToggle}
          </>
        }
      >
        {alerts}
        {source === 'templates' && editing && templateEditor}
        {source === 'saved' && savedBlock}
        {source === 'brands' && brandsBlock}
      </FinderPage>
    );
  return (
    <main className="catalog-page" aria-label={t('Catalog')}>
      <header className="catalog-head">
        <div>
          <div className="info-row">
            <h1>{t('Catalog')}</h1>
            <InfoTip label={t('About the catalog')} align="start">
              {toProject
                ? t('Pick one to add it to the open project.')
                : t('Pick one to open your own copy in the editor.')}
            </InfoTip>
          </div>
          <p className="hint">
            {tNode('{items} in {families} · {ready} open right away.', {
              items: <strong className="num">{t('{n} items', { n: all.length })}</strong>,
              families: t('{n} families', { n: families.length }),
              ready: String(ready),
            })}
          </p>
        </div>
        <div className="split-actions">
          {onNewPiece && (
            <button type="button" className="btn primary" onClick={onNewPiece}>
              <Icon name="plus" className="sm" />
              {t('New piece')}
            </button>
          )}
          {/* Only when there is a design to go back to (ADR-120). */}
          {designOpen && (
            <button type="button" className="btn outline" onClick={onDone}>
              <Icon name="chevron-left" className="sm" />
              {t('Back to the editor')}
            </button>
          )}
        </div>
      </header>
      {/* Source and grouping share one row that scrolls away; only the search row stays (ADR-118 on a phone, ADR-119
          at every width). A phone shows the short labels. */}
      <div className="catalog-switches">
        {sources}
        {source === 'templates' && (
          <GroupToggle value={grouping} onChange={setGrouping} short={phone} />
        )}
      </div>
      {source === 'templates' && <div className="catalog-toolbar">{search}</div>}
      {source === 'templates' && (
        <CatalogActions phone={phone}>
          {safetyToggle}
          {/* Only when a design is open to save (ADR-195). */}
          {designOpen && <SaveAsTemplate onSaved={setSavedFamily} />}
          {filesMenu}
        </CatalogActions>
      )}
      {alerts}
      {source === 'templates' && editing && templateEditor}
      {source === 'templates' &&
        !editing &&
        (groups.length === 0 ? (
          <p className="empty center">
            <Icon name="search" />
            {t('Nothing matches “{query}”.', { query })}
          </p>
        ) : (
          <nav className="group-index" aria-label={t('Jump to a group')}>
            {groups.map((g) => (
              <a
                key={g.key}
                href={`#cat-${g.key}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`cat-${g.key}`)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {g.label} <span className="count">{itemCount(g, q)}</span>
              </a>
            ))}
          </nav>
        ))}
      {source === 'templates' && !editing && grouping === 'room' && groups.length > 0 && (
        <p className="hint">
          {t(
            'A family can sit in several rooms, so the room counts add up to more than the total.',
          )}
        </p>
      )}
      {source === 'templates' &&
        !editing &&
        groups.map((g) => (
          <section key={g.key} id={`cat-${g.key}`} className="catalog-group" aria-label={g.label}>
            <h2 className="group-head">
              {g.label}{' '}
              <span className="count">{t('{n|# item|# items}', { n: itemCount(g, q) })}</span>
            </h2>
            {g.items.slice(0, GROUP_PAGE + (extra[g.key] ?? 0)).map(({ family, also }) => (
              <FamilyBlock
                key={`${g.key}:${family.id}`}
                f={family}
                also={also}
                q={q}
                toProject={toProject}
                safety={safety}
                onConfirmSafety={() => toggleSafety(true)}
                onTake={take}
                onEdit={() => startEdit(family)}
              />
            ))}
            <ShowMore
              families
              shown={Math.min(g.items.length, GROUP_PAGE + (extra[g.key] ?? 0))}
              total={g.items.length}
              first={GROUP_PAGE}
              step={GROUP_STEP}
              onMore={(n) => showMore(g.key, n)}
            />
          </section>
        ))}
      {source === 'saved' && savedBlock}
      {source === 'brands' && brandsBlock}
    </main>
  );
}

/**
 * "1600 × 450 × 438 · 2 to check": an item's size and, when there are any, its checks in one line. The size has no " mm"
 * on the tile (user decision 2026-11-07, ADR-195).
 */
const factsLine = (fx: NonNullable<ReturnType<typeof itemFacts>>) =>
  `${fx.w} × ${fx.h} × ${fx.d}${
    fx.errors
      ? ` · ${t('{n} problems', { n: fx.errors })}`
      : fx.warnings
        ? ` · ${t('{n} to check', { n: fx.warnings })}`
        : ''
  }`;

/**
 * One item (variant) as a tile: the picture of its inside (doors off), its name and size. The whole tile is the button
 * that adds it (or opens it, outside a project). A tile that cannot open yet is a plain box that says why.
 */
function ItemCard({
  f,
  v,
  facts,
  toProject,
  onTake,
  onConfirmSafety,
  verb,
}: {
  f: ViewFamily;
  v: CatalogVariant;
  /** Show the tile's verb on it (ADR-291); the label already says it. */
  verb?: boolean;
  facts: ReturnType<typeof itemFacts> | undefined;
  toProject: boolean;
  onTake: (d: Design) => void;
  /** "I check it myself" on a safety-regulated item: ticks the catalog's safety switch (ADR-195). */
  onConfirmSafety: () => void;
}) {
  const ok = insertable(v);
  const nameId = useId();
  const size = facts ? factsLine(facts) : '';
  const text = (
    <>
      <span className="item-name" id={nameId}>
        <strong>{tr(v.name)}</strong>
        {v.kind === 'construction' && (
          <span className="kind construction" title={t('Needed new construction')}>
            {t('New construction')}
          </span>
        )}
      </span>
      {size && <span className="sub num">{size}</span>}
      {v.hardware && (
        <span className="sub">{t('You choose: {hardware}', { hardware: tr(v.hardware) })}</span>
      )}
    </>
  );
  return (
    <li className={`item ${ok ? '' : 'waits'}`}>
      {ok ? (
        <button
          type="button"
          className="tile"
          aria-label={
            toProject
              ? t('Add {name}', { name: `${tr(v.name)} ${size}`.trim() })
              : t('Open {name}', { name: `${tr(v.name)} ${size}`.trim() })
          }
          onClick={() => {
            const d = insertVariant(f, v);
            if (d) onTake(d);
          }}
        >
          <ItemPicture
            f={f}
            v={v}
            className="snap"
            width={160}
            height={120}
            alt={t('{name}, 3D view', { name: `${tr(f.name)}: ${tr(v.name)}` })}
          />
          {text}
          {verb && (
            <span className="verb" aria-hidden="true">
              {toProject ? t('Add') : t('Open')}
            </span>
          )}
        </button>
      ) : (
        <div className="waits-body">
          {text}
          {safetyOnly(v) ? (
            // Waits only for the user's own check (ADR-195): said as it is, with the switch at hand.
            <span className="safety-gate">
              <span className="sub waits-why">
                {t('Safety-regulated: you check it against the standards yourself')}
              </span>
              <button
                type="button"
                className="btn sm"
                aria-describedby={nameId}
                onClick={onConfirmSafety}
              >
                {t('I check it myself')}
              </button>
            </span>
          ) : (
            <span className="sub waits-why">
              {t('Not available yet: {why}', { why: waitsFor(v.requires) || t('no design') })}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * One family, then every item (variant) as its own compact card. Its default structure, configurations, rooms and
 * other names wait behind "About this family" (ADR-118 on a phone, ADR-119 at every width).
 */
/** Under a list: how many rows are shown, and a button for the next page. Nothing when the list fits the first page. */
function ShowMore({
  shown,
  total,
  first,
  step,
  families,
  onMore,
}: {
  shown: number;
  total: number;
  first: number;
  step: number;
  /** A catalog group counts families; a flat list counts rows. */
  families?: boolean;
  onMore: (n: number) => void;
}) {
  const status = useRef<HTMLParagraphElement>(null);
  if (total <= first) return null;
  const left = total - shown;
  const n = Math.min(step, left);
  return (
    <div className="group-more">
      <p className="hint" aria-live="polite" tabIndex={-1} ref={status}>
        {families
          ? t('Showing {shown} of {total} families', { shown, total })
          : t('Showing {shown} of {total}', { shown, total })}
      </p>
      {left > 0 && (
        <button
          type="button"
          className="btn outline"
          onClick={() => {
            onMore(n);
            // The button goes with the last page: focus moves to the count line instead of falling to the page.
            if (n >= left) setTimeout(() => status.current?.focus(), 0);
          }}
        >
          {families
            ? t('Show {n|# more family|# more families}', { n })
            : t('Show {n} more', { n })}
        </button>
      )}
    </div>
  );
}

/** A flat list one page at a time: the rows to show and the "Show more" control to put under them. */
function usePaged<T>(items: T[]): { visible: T[]; more: ReactNode } {
  const [extra, setExtra] = useState(0);
  const shown = Math.min(items.length, LIST_PAGE + extra);
  return {
    visible: items.slice(0, shown),
    more: (
      <ShowMore
        shown={shown}
        total={items.length}
        first={LIST_PAGE}
        step={LIST_STEP}
        onMore={(n) => setExtra((e) => e + n)}
      />
    ),
  };
}

function FamilyBlock({
  f,
  also,
  q,
  toProject,
  safety,
  onConfirmSafety,
  onTake,
  onEdit,
  verbs,
}: {
  f: ViewFamily;
  also?: boolean;
  /** The finder's family sheet (ADR-291): each tile shows its verb (Add or Open) as well as saying it. */
  verbs?: boolean;
  q: string;
  toProject: boolean;
  /** The safety switch: safety-regulated items build once it is on, so their facts are worked out again. */
  safety: boolean;
  onConfirmSafety: () => void;
  onTake: (d: Design) => void;
  onEdit: () => void;
}) {
  const remove = useTemplates((s) => s.remove);
  const items = f.variants.filter((v) => matches(f, v, q));
  const facts = useMemo(
    () => new Map(f.variants.map((v) => [v.id, itemFacts(f, v)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `safety` changes what `itemFacts` can build.
    [f, safety],
  );
  const headId = useId();
  return (
    <article className={`family support-${f.support}`} aria-label={tr(f.name)} data-family={f.id}>
      <header className="family-head">
        <span className="glyph">
          <Icon name={familyGlyph(f)} />
        </span>
        <div>
          <h3 id={headId}>
            {tr(f.name)} <span className="ro">{f.nameRo}</span>
          </h3>
          <p className="chips">
            {f.localId && (
              <span className="chip edited">
                {f.own ? t('Your template') : t('Edited on this device')}
              </span>
            )}
            {f.localId && <AccountBadge table="templates" id={f.localId} />}
            {also && (
              <span className="chip subtle">
                {t('main room: {room}', { room: tr(ROOM_LABEL[f.rooms[0] as Room]) })}
              </span>
            )}
          </p>
        </div>
        <div className="family-tools">
          {f.localId && <AccountRowActions table="templates" id={f.localId} name={f.name} />}
          <button type="button" className="btn sm" onClick={onEdit} aria-describedby={headId}>
            <Icon name="pencil" className="sm" />
            {t('Edit template')}
          </button>
        </div>
      </header>
      {f.shippedUpdated && <ShippedUpdated f={f} />}
      <ul className="items">
        {items.map((v) => (
          <ItemCard
            key={v.id}
            f={f}
            v={v}
            facts={facts.get(v.id)}
            toProject={toProject}
            onTake={onTake}
            onConfirmSafety={onConfirmSafety}
            verb={verbs}
          />
        ))}
      </ul>
      {f.localId && !f.own && (
        <button
          type="button"
          className="danger-link"
          onClick={async () => {
            if (
              await askConfirm(
                t(
                  'Reset “{name}” to the shipped template? Your edits to it on this device are removed.',
                  { name: tr(f.name) },
                ),
                { confirmLabel: t('Reset'), danger: true },
              )
            )
              void remove(f.localId!);
          }}
        >
          {t('Reset to shipped')}
        </button>
      )}
      {f.own && (
        <button
          type="button"
          className="danger-link"
          onClick={async () => {
            if (
              await askConfirm(t('Delete your template “{name}”?', { name: f.name }), {
                confirmLabel: t('Delete'),
                danger: true,
              })
            )
              void remove(f.localId!);
          }}
        >
          {t('Delete template')}
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
        {t(
          'The shipped template was updated (revision {rev}). Shipped: {shipped} variants; yours: {yours}.',
          {
            rev: shipped.catalogVersion,
            shipped: shipped.variants.length,
            yours: f.variants.length,
          },
        )}
      </span>
      <button
        type="button"
        className="btn sm"
        onClick={() => {
          // Hides the notice for this shipped revision only; the template's own revision stays (ADR-195).
          const mine = useTemplates.getState().locals.find((x) => x.id === f.localId);
          if (mine) void save({ ...mine, seenShipped: shipped.catalogVersion, updatedAt: now() });
        }}
      >
        {t('Keep mine')}
      </button>
      <button
        type="button"
        className="btn sm"
        onClick={async () => {
          if (
            await askConfirm(t('Replace your edits with the shipped template?'), {
              confirmLabel: t('Use shipped'),
              danger: true,
            })
          )
            void remove(f.localId!);
        }}
      >
        {t('Use shipped')}
      </button>
    </p>
  );
}

/**
 * "Save this piece as a template" (ADR-195): the Save to catalog form (name, room, type, ADR-107) for the open piece;
 * the confirmation links to the new family.
 */
function SaveAsTemplate({ onSaved }: { onSaved: (f: { id: string; name: string }) => void }) {
  const design = useDesign((s) => s.design);
  const project = useDesign((s) => s.project),
    editingItem = useDesign((s) => s.editingItemId);
  const [open, setOpen] = useState(false);
  if (project && !editingItem) return null;
  return (
    <>
      <button type="button" className="btn sm" onClick={() => setOpen(true)}>
        {t('Save this piece as a template')}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t('Save to catalog')}>
        {open && (
          <CatalogSaveForm
            design={design}
            save={(meta) => saveDesignToCatalog(design, meta)}
            onCancel={() => setOpen(false)}
            onSaved={(tpl) => {
              setOpen(false);
              onSaved({ id: tpl.family.id, name: tpl.family.name });
            }}
          />
        )}
      </Dialog>
    </>
  );
}

/** One maker's decors and the saved pieces with one of its boards, a page at a time (N311). Keyed by brand, so a new brand starts at page one. */
function BrandBody({
  brand,
  saved,
  savedFailed,
  onTake,
}: {
  brand: ReturnType<typeof decorBrands>[number];
  saved: StoredDesign[];
  savedFailed?: boolean;
  onTake: (d: Design) => void;
}) {
  const pieces = useMemo(() => saved.filter((r) => usesBrand(r.design, brand)), [saved, brand]);
  const decorPage = usePaged(brand.decors);
  const piecePage = usePaged(pieces);
  return (
    <section aria-label={brand.label}>
      <h3 className="list-head">{t('{brand} decors', { brand: brand.label })}</h3>
      <ul className="template-list">
        {decorPage.visible.map((d) => (
          <li key={d.id} className="decor-row">
            <span className="swatch" style={{ background: d.color }} aria-hidden="true" />
            <span>
              <strong>
                {d.code} {d.name}
              </strong>
              <span className="sub">
                {t('{n} mm', { n: d.thickness })} · {kindName(d.kind) ?? d.kind}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {decorPage.more}
      <h3 className="list-head">
        {t('Saved pieces with a {brand} board', { brand: brand.label })}
      </h3>
      {pieces.length ? (
        <>
          <ul className="template-list template-grid">
            {piecePage.visible.map((r) => (
              <li key={r.id}>
                <button type="button" className="row-btn" onClick={() => onTake(r.design)}>
                  <span className="glyph">
                    <Icon name={templateGlyph(r.design.product.kind)} />
                  </span>
                  <span>
                    <strong>{r.name}</strong>
                  </span>
                  <Icon name="chevron-right" className="chev sm" />
                </button>
              </li>
            ))}
          </ul>
          {piecePage.more}
        </>
      ) : savedFailed ? (
        <p className="alert error" role="alert">
          {t('Designs saved on this device could not be read.')}
        </p>
      ) : (
        <p className="hint">{t('No saved piece has a board of this maker yet.')}</p>
      )}
    </section>
  );
}

/**
 * Catalog → Brands (ADR-210, G-044): a chip per manufacturer of the decor list on this device, with its count, beside
 * any shipped brand entry (`children`). A chip lists that maker's decors and the saved pieces with a board of it.
 * Nothing is fetched (ADR-002).
 */
function DecorBrandList({
  onTake,
  children,
}: {
  onTake: (d: Design) => void;
  children?: ReactNode;
}) {
  const [data, setData] = useState<
    { decors: Decor[]; saved: StoredDesign[]; savedFailed?: boolean } | 'error' | null
  >(null);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    // A failed read of the saved pieces is said in the brand's section, never as "none" (ADR-262).
    Promise.all([listDecors(), listDesigns().catch(() => null)])
      .then(
        ([decors, saved]) =>
          live && setData({ decors, saved: saved ?? [], savedFailed: saved === null }),
      )
      .catch(() => live && setData('error'));
    return () => {
      live = false;
    };
  }, []);
  const brands = useMemo(() => (data && data !== 'error' ? decorBrands(data.decors) : []), [data]);
  if (data === null) return <p className="loading">{t('Loading…')}</p>;
  if (data === 'error')
    return (
      <>
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>{t('The decor list could not be read on this device.')}</span>
        </p>
        {children}
      </>
    );
  if (!brands.length && !children)
    return (
      <p className="empty center">
        <Icon name="catalog" />
        {t('No brands yet. Import your decor list under Boards to see its manufacturers here.')}
      </p>
    );
  const brand = brands.find((b) => b.key === picked);
  return (
    <>
      {brands.length > 0 && (
        <div className="chips" role="group" aria-label={t('Brands from your decor list')}>
          {brands.map((b) => (
            <button
              key={b.key}
              type="button"
              className={`chip ${picked === b.key ? 'on' : ''}`}
              aria-pressed={picked === b.key}
              onClick={() => setPicked(picked === b.key ? null : b.key)}
            >
              {t('{brand} ({n})', { brand: b.label, n: b.decors.length })}
            </button>
          ))}
        </div>
      )}
      {brand && (
        <BrandBody
          key={brand.key}
          brand={brand}
          saved={data.saved}
          savedFailed={data.savedFailed}
          onTake={onTake}
        />
      )}
      {children}
    </>
  );
}

function SavedList({ onTake }: { onTake: (d: Design) => void }) {
  const [rows, setRows] = useState<StoredDesign[] | null>(null);
  const [failed, setFailed] = useState(false);
  const { visible, more } = usePaged(rows ?? []);
  useEffect(() => {
    listDesigns()
      .then(setRows)
      .catch(() => {
        // A failed read is said as such, never as an empty list (ADR-195).
        setFailed(true);
        setRows([]);
      });
  }, []);
  if (failed)
    return (
      <p className="alert error" role="alert">
        <Icon name="alert-circle" className="sm" />
        <span>{t('Designs saved on this device could not be read.')}</span>
      </p>
    );
  if (!rows) return <p className="loading">{t('Loading…')}</p>;
  if (!rows.length)
    return (
      <p className="empty center">
        <Icon name="folder" />
        {t('Nothing saved on this device yet.')}
      </p>
    );
  return (
    <>
      <ul className="template-list template-grid">
        {visible.map((r) => (
          <li key={r.id}>
            <button type="button" className="row-btn" onClick={() => onTake(r.design)}>
              <span className="glyph">
                <Icon name={templateGlyph(r.design.product.kind)} />
              </span>
              <span>
                <strong>{r.name}</strong>
                <span className="sub">
                  {r.design.catalog?.origin
                    ? t('Based on {name}', { name: tr(r.design.catalog.origin.productName) })
                    : t('Your design')}
                </span>
              </span>
              <Icon name="chevron-right" className="chev sm" />
            </button>
          </li>
        ))}
      </ul>
      {more}
    </>
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
  const [tpl, setT] = useState(initial);
  const [busy, setBusy] = useState(false);
  const f = tpl.family;
  const setF = (patch: Partial<typeof f>) => setT({ ...tpl, family: { ...f, ...patch } });
  const setV = (i: number, patch: Partial<(typeof f.variants)[number]>) =>
    setF({ variants: f.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) });
  const move = (i: number, d: -1 | 1) => {
    const vs = [...f.variants];
    const j = i + d;
    if (j < 0 || j >= vs.length) return;
    [vs[i], vs[j]] = [vs[j], vs[i]];
    setF({ variants: vs });
  };
  // Each problem as a sentence for the user, never the validator's code (ADR-195).
  const problems = validateLocalTemplate({ ...tpl, updatedAt: now() });
  const errs = templateProblemTexts(problems);
  // Problems also under the field they name (ADR-262).
  const fieldErr = (codes: string[]) =>
    templateProblemTexts(problems.filter((p) => codes.includes(p.code))).join(' ');
  const nameErr = fieldErr(['no-name', 'long-name']);
  const roomsErr = fieldErr(['no-rooms', 'bad-rooms']);
  return (
    <section className="template-editor" aria-label={t('Edit template {name}', { name: f.name })}>
      <div className="card-title">
        <span className="info-row">
          <span>{t('Edit template')}</span>
          <InfoTip label={t('About editing a template')} align="start">
            {t('Saved on this device only; the shipped template never changes.')}
          </InfoTip>
        </span>
      </div>
      <div className="dims2">
        <div className="field">
          <label htmlFor="te-name">{t('Name')}</label>
          <input
            id="te-name"
            value={f.name}
            aria-invalid={!!nameErr || undefined}
            aria-describedby={nameErr ? 'te-name-err' : undefined}
            onChange={(e) => setF({ name: e.target.value })}
          />
          {nameErr && (
            <p className="field-error" id="te-name-err">
              {nameErr}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor="te-aliases">{t('Other names (comma-separated)')}</label>
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
        <label htmlFor="te-fn">{t('Type')}</label>
        <select
          id="te-fn"
          value={f.function}
          onChange={(e) => setF({ function: e.target.value as FunctionGroup })}
        >
          {FUNCTIONS.map((fn) => (
            <option key={fn} value={fn}>
              {tr(FUNCTION_LABEL[fn])}
            </option>
          ))}
        </select>
      </div>
      <fieldset
        className="field rooms"
        aria-invalid={!!roomsErr || undefined}
        aria-describedby={roomsErr ? 'te-rooms-err' : undefined}
      >
        <legend>{t('Rooms (the first ticked is the main one)')}</legend>
        {roomsErr && (
          <p className="field-error" id="te-rooms-err">
            {roomsErr}
          </p>
        )}
        {ROOMS.map((r) => (
          <label key={r} className="toggle small">
            <input
              type="checkbox"
              checked={f.rooms.includes(r)}
              onChange={(e) =>
                setF({ rooms: e.target.checked ? [...f.rooms, r] : f.rooms.filter((x) => x !== r) })
              }
            />
            <span>{tr(ROOM_LABEL[r])}</span>
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="te-structure">{t('Default structure')}</label>
        <textarea
          id="te-structure"
          rows={2}
          value={f.structure}
          onChange={(e) => setF({ structure: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="te-config">{t('What can be changed (one per line)')}</label>
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
        <span className="field-label">{t('Variants (1–12; the first is the default)')}</span>
        <ul className="variant-edit">
          {f.variants.map((v, i) => (
            // Each row's controls are named with the row (ADR-262).
            <li key={v.id} aria-label={t('Variant {n}', { n: i + 1 })} role="group">
              <input
                aria-label={t('Variant {n} name', { n: i + 1 })}
                value={v.name}
                aria-invalid={!v.name.trim() || v.name.length > 200 || undefined}
                onChange={(e) => setV(i, { name: e.target.value })}
              />
              <input
                aria-label={t('Variant {n} summary', { n: i + 1 })}
                value={v.summary}
                onChange={(e) => setV(i, { summary: e.target.value })}
              />
              <div className="row-actions">
                <button
                  type="button"
                  className="btn icon ghost sm"
                  aria-label={t('Move up')}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn icon ghost sm"
                  aria-label={t('Move down')}
                  disabled={i === f.variants.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn sm"
                  disabled={!v.design}
                  // The unsaved draft goes along; nothing is stored until "Save to template" (ADR-195).
                  onClick={() => onEditDesign(tpl, v.id)}
                >
                  {t('Edit design')}
                </button>
                <button
                  type="button"
                  className="btn sm"
                  disabled={f.variants.length >= MAX_VARIANTS || !v.design}
                  onClick={() =>
                    setF({
                      variants: [
                        ...f.variants,
                        {
                          ...structuredClone(v),
                          id: `${v.id}-copy-${Date.now().toString(36)}`,
                          name: t('{name} (copy)', { name: v.name }),
                        },
                      ],
                    })
                  }
                >
                  <Icon name="copy" className="sm" />
                  {t('Duplicate')}
                </button>
                <button
                  type="button"
                  className="btn icon sm danger"
                  aria-label={t('Remove variant')}
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
          <span>{errs.join(' ')}</span>
        </p>
      )}
      <div className="split-actions">
        <button
          type="button"
          className="btn primary"
          disabled={errs.length > 0 || busy}
          onClick={async () => {
            setBusy(true);
            const saved = await saveRevision(tpl);
            setBusy(false);
            // A refused write keeps the draft open; the storage alert above says why (ADR-195).
            if (saved) onDone(t('Template “{name}” saved on this device.', { name: f.name }));
          }}
        >
          {t('Save template')}
        </button>
        <button type="button" className="btn outline" onClick={() => onDone()}>
          {t('Cancel')}
        </button>
      </div>
    </section>
  );
}

/** How many families the finder's grid shows first, and how many each "Show more" adds (ADR-291). */
const FINDER_PAGE = 24;

/**
 * The catalog finder (ADR-291): one title row with a Catalog actions button, the search and one row of filters that stay
 * at the top, then each family once in a flat grid. A family opens in a sheet with its items, each with its verb, and its
 * template tools. The other sources and the template editor are the grouped page's own pieces, passed in.
 */
function FinderPage({
  families,
  source,
  sources,
  search,
  query,
  total,
  ready,
  toProject,
  safety,
  editing,
  jump,
  onConfirmSafety,
  onTake,
  onEdit,
  actions,
  children,
}: {
  families: ViewFamily[];
  source: Source;
  sources: ReactNode;
  search: ReactNode;
  query: string;
  total: number;
  ready: number;
  toProject: boolean;
  safety: boolean;
  editing: boolean;
  jump: { id: string } | null;
  onConfirmSafety: () => void;
  onTake: (d: Design) => void;
  onEdit: (f: ViewFamily) => void;
  actions: ReactNode;
  children: ReactNode;
}) {
  const [filter, setFilter] = useState<Omit<FinderFilter, 'q'>>(NO_FILTER);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [pageState, setPageState] = useState({ key: '', n: FINDER_PAGE });
  // "Show “name”" after a save: every filter off and that family's sheet open (a new jump object each tap; state
  // adjusted while rendering, as React documents for state that follows a prop).
  const [seenJump, setSeenJump] = useState(jump);
  if (jump !== seenJump) {
    setSeenJump(jump);
    if (jump) {
      setFilter(NO_FILTER);
      setOpenId(jump.id);
    }
  }
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => finderFamilies(families, { ...filter, q }), [families, filter, q]);
  const rooms = useMemo(() => finderRooms(families), [families]);
  const types = useMemo(() => finderTypes(families), [families]);
  // A new search or filter starts at the first page again (state that follows its inputs, adjusted while rendering).
  const key = `${q}|${filter.room}|${filter.fn}|${filter.ready}`;
  if (pageState.key !== key) setPageState({ key, n: FINDER_PAGE });
  const limit = pageState.key === key ? pageState.n : FINDER_PAGE;
  const items = shown.reduce((n, f) => n + f.variants.filter((v) => matches(f, v, q)).length, 0);
  const open = openId ? families.find((f) => f.id === openId) : undefined;
  const filtered = !!(q || filter.room || filter.fn || filter.ready);
  const actionsId = useId();
  return (
    <main className="catalog-page finder" aria-label={t('Catalog')}>
      <header className="finder-head">
        <div>
          <h1>{t('Catalog')}</h1>
          <p className="hint">
            {tNode('{items} in {families} · {ready} open right away.', {
              items: <strong className="num">{t('{n} items', { n: total })}</strong>,
              families: t('{n} families', { n: families.length }),
              ready: String(ready),
            })}
          </p>
        </div>
        <button
          type="button"
          className="btn outline"
          aria-expanded={showActions}
          aria-controls={actionsId}
          onClick={() => setShowActions((v) => !v)}
        >
          <Icon name="more" className="sm" />
          {t('Catalog actions')}
        </button>
      </header>
      <div className="finder-actions" id={actionsId} hidden={!showActions}>
        <p className="hint">
          {toProject
            ? t('Pick one to add it to the open project.')
            : t('Pick one to open your own copy in the editor.')}
        </p>
        {actions}
      </div>
      <div className="catalog-toolbar finder-bar">
        {source === 'templates' && search}
        <div className="finder-filters" role="group" aria-label={t('Filters')}>
          {sources}
          {source === 'templates' && (
            <>
              <select
                className={filter.room ? 'on' : ''}
                aria-label={t('Room')}
                value={filter.room}
                onChange={(e) => setFilter({ ...filter, room: e.target.value as Room | '' })}
              >
                <option value="">{t('All rooms')}</option>
                {rooms.map((r) => (
                  <option key={r} value={r}>
                    {tr(ROOM_LABEL[r])}
                  </option>
                ))}
              </select>
              <select
                className={filter.fn ? 'on' : ''}
                aria-label={t('Type')}
                value={filter.fn}
                onChange={(e) => setFilter({ ...filter, fn: e.target.value as FunctionGroup | '' })}
              >
                <option value="">{t('All types')}</option>
                {types.map((fn) => (
                  <option key={fn} value={fn}>
                    {tr(FUNCTION_LABEL[fn])}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`chip-toggle ${filter.ready ? 'on' : ''}`}
                aria-pressed={filter.ready}
                onClick={() => setFilter({ ...filter, ready: !filter.ready })}
              >
                {t('Ready to open')}
              </button>
            </>
          )}
        </div>
      </div>
      {children}
      {source === 'templates' && !editing && (
        <>
          <p className="hint finder-count" aria-live="polite">
            {t('{n} families', { n: shown.length })} · {t('{n|# item|# items}', { n: items })}
          </p>
          {shown.length === 0 ? (
            <div className="empty center">
              <Icon name="search" />
              <p>
                {q
                  ? t('Nothing matches “{query}”.', { query })
                  : t('Nothing matches these filters.')}
              </p>
              {filtered && (
                <button type="button" className="btn outline" onClick={() => setFilter(NO_FILTER)}>
                  {t('Clear filters')}
                </button>
              )}
            </div>
          ) : (
            <ul className="finder-grid" aria-label={t('Families')}>
              {shown.slice(0, limit).map((f) => (
                <FinderTile key={f.id} f={f} q={q} onOpen={() => setOpenId(f.id)} />
              ))}
            </ul>
          )}
          <ShowMore
            families
            shown={Math.min(shown.length, limit)}
            total={shown.length}
            first={FINDER_PAGE}
            step={FINDER_PAGE}
            onMore={(n) => setPageState({ key, n: limit + n })}
          />
        </>
      )}
      <Dialog
        open={!!open && !editing}
        onClose={() => setOpenId(null)}
        title={open ? tr(open.name) : ''}
        wide
      >
        {open && (
          <FamilyBlock
            f={open}
            q={q}
            toProject={toProject}
            safety={safety}
            verbs
            onConfirmSafety={onConfirmSafety}
            onTake={onTake}
            onEdit={() => {
              setOpenId(null);
              onEdit(open);
            }}
          />
        )}
      </Dialog>
    </main>
  );
}

/** One family in the finder's grid: the picture of its first item, its name and how many items it has. */
function FinderTile({ f, q, onOpen }: { f: ViewFamily; q: string; onOpen: () => void }) {
  const items = f.variants.filter((v) => matches(f, v, q));
  const first = items.find(insertable) ?? items[0];
  const opens = items.filter(insertable).length;
  return (
    <li>
      <button type="button" className="finder-tile" aria-haspopup="dialog" onClick={onOpen}>
        <ItemPicture f={f} v={first} className="snap" width={160} height={120} alt="" />
        <strong>{tr(f.name)}</strong>
        <span className="sub">
          {t('{n|# item|# items}', { n: items.length })}
          {opens < items.length
            ? ` · ${t('{n|# opens right away|# open right away}', { n: opens })}`
            : ''}
        </span>
        {f.localId && (
          <span className="chip edited">
            {f.own ? t('Your template') : t('Edited on this device')}
          </span>
        )}
      </button>
    </li>
  );
}
