import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';
import { buildModel } from '../core/build';
import { snapshotSvg } from '../core/snapshot';
import {
  catalogFamilies,
  CAPABILITY_WAITS,
  FUNCTION_LABEL,
  FUNCTIONS,
  insertable,
  insertVariant,
  missingCapabilities,
  ROOM_LABEL,
  ROOMS,
  setSafetyConfirmed,
  startFamilies,
  type CatalogVariant,
} from '../core/catalog';
import { mergeCatalog, type LocalTemplate, type ViewFamily } from '../core/catalog/local';
import { VARIANT_RO } from '../core/catalog/ro';
import { templates } from '../core/design';
import type { Design } from '../core/types';
import { useTemplates } from '../store/templatesStore';
import { rovingKeys, rovingTab } from './controls';
import { t, tr } from '../core/i18n';
import { Icon } from './icons';

export type Grouping = 'room' | 'type';
const GROUP_KEY = 'furniture-builder:catalog-group';
export const SAFETY_KEY = 'furniture-builder:safety-confirmed';
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
      label: tr(FUNCTION_LABEL[fn]),
      items: families.filter((f) => f.function === fn).map((family) => ({ family })),
    })).filter((g) => g.items.length);
  const groups: Group[] = ROOMS.map((r) => ({
    key: r,
    label: tr(ROOM_LABEL[r]),
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

/** `short`: the phone catalog's one switches row (ADR-118) shows "Room" / "Type"; the names stay "By room" / "By type". */
export function GroupToggle({
  value,
  onChange,
  short,
}: {
  value: Grouping;
  onChange: (g: Grouping) => void;
  short?: boolean;
}) {
  return (
    <div
      className="segmented small"
      role="radiogroup"
      aria-label={t('Group by')}
      onKeyDown={rovingKeys}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === 'room'}
        tabIndex={rovingTab(value === 'room', 0, true)}
        aria-label={short ? t('By room') : undefined}
        className={value === 'room' ? 'on' : ''}
        onClick={() => onChange('room')}
      >
        {short ? t('Room') : t('By room')}
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'type'}
        tabIndex={rovingTab(value === 'type', 1, true)}
        aria-label={short ? t('By type') : undefined}
        className={value === 'type' ? 'on' : ''}
        onClick={() => onChange('type')}
      >
        {short ? t('Type') : t('By type')}
      </button>
    </div>
  );
}

export const now = () => new Date().toISOString();
export const waitsFor = (requires: CatalogVariant['requires']) =>
  missingCapabilities({ requires })
    .map((c) => (CAPABILITY_WAITS[c] ? tr(CAPABILITY_WAITS[c]) : c))
    .join('; ');
export const matches = (f: ViewFamily, v: CatalogVariant, q: string) =>
  !q ||
  [
    f.name,
    f.nameRo,
    ...f.aliases,
    v.name,
    VARIANT_RO[v.id] ?? '',
    tr(f.name),
    tr(v.name),
    ...f.aliases.map((a) => tr(a)),
  ].some((s) => s.toLowerCase().includes(q));
/** The items of a group that match the search, so its chip and heading count the cards shown (ADR-195). */
export const itemCount = (g: Group, q: string) =>
  g.items.reduce((n, i) => n + i.family.variants.filter((v) => matches(i.family, v, q)).length, 0);
/** A built item that waits only for the user's own safety confirmation (ADR-035, ADR-195). */
export const safetyOnly = (v: CatalogVariant) => {
  const missing = missingCapabilities(v);
  return !!v.create && missing.length === 1 && missing[0] === 'safety:user-confirmed';
};

/** The catalog's own actions; on a phone they fold under one button so the list starts higher up. */
export function CatalogActions({ phone, children }: { phone: boolean; children: ReactNode }) {
  if (!phone) return <div className="catalog-actions">{children}</div>;
  return (
    <details className="catalog-more">
      <summary>
        {t('More catalog actions')}
        <Icon name="chevron-down" className="sm" />
      </summary>
      <div className="catalog-actions">{children}</div>
    </details>
  );
}

/** Each built-in template's description by its id, shown under the Start from row of that id (ADR-216). */
const TEMPLATE_TEXT = new Map(
  templates.filter((x) => x.description).map((x) => [x.id, x.description]),
);

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
        <h3>
          {t('Start from')} <span className="count">{t('{n} ready items', { n: total })}</span>
        </h3>
        <GroupToggle value={grouping} onChange={setGrouping} />
        {onBrowse && (
          <button type="button" className="btn sm" onClick={onBrowse}>
            <Icon name="catalog" className="sm" />
            {t('Open the Catalog')}
          </button>
        )}
      </div>
      <label className="search">
        <Icon name="search" className="sm" />
        <input
          type="search"
          placeholder={t('Search, e.g. wardrobe, dulap, bed')}
          aria-label={t('Search the items')}
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
            <h4 className="list-head">
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
                        {tr(f.name)}: {tr(v.name)}
                      </strong>
                      <span className="sub">{tr(v.summary)}</span>
                      {/* The built-in template's description, under the row of the same id (ADR-216). */}
                      {TEMPLATE_TEXT.has(v.id) && (
                        <span className="sub">{tr(TEMPLATE_TEXT.get(v.id) ?? '')}</span>
                      )}
                      {/* The Romanian name on its own line, not inside the English text (ADR-120). */}
                      {VARIANT_RO[v.id] && (
                        <span className="sub ro-line" lang="ro">
                          RO: {f.nameRo}: {VARIANT_RO[v.id]}
                        </span>
                      )}
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
