import { useMemo } from 'react';
import {
  areaM2,
  bandMetersFromRows,
  boardBands,
  boardBandText,
  lengthsList,
} from '../core/cutlist';
import { t, tr } from '../core/i18n';
import { useDesign, type Tab } from '../store/designStore';
import { Sheets } from './Sheets';
import { FastenerCounts } from './Fasteners';
import { ShoppingList } from './Shopping';
import { useView } from './useView';
import { GuidanceTip, InfoTip } from './controls';
import { Icon } from './icons';
import { cutlistCsvRo } from '../core/ro';
import { download, fileName } from './shell/files';
import { useUi } from './shell/uiStore';
import { mayRepair, problemPanels } from '../core/repairs';
import { useProblem } from './problemStore';
import { PHONE, useMediaQuery } from './useMediaQuery';

export function Output() {
  const tab = useDesign((s) => s.tab);
  const setTab = useDesign((s) => s.setTab);
  const toggleTab = useDesign((s) => s.toggleTab);
  const resultsOpen = useDesign((s) => s.resultsOpen);
  // Phones keep the results collapsed until a tab is tapped, so the views stay main (ADR-091).
  const phone = useMediaQuery(PHONE);
  const open = !phone || resultsOpen;
  const view = useView();
  const errors = view.diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = view.diagnostics.length - errors;
  const parts = view.rows.reduce((n, r) => n + r.quantity, 0);
  // Short labels keep the five tabs in one row on a phone (ADR-114); `name` is the full accessible name.
  const tabs: { id: Tab; label: string; name?: string; badge?: number; kind?: string }[] = [
    { id: 'parts', label: t('Parts'), badge: parts || undefined, kind: 'neutral' },
    { id: 'sheets', label: t('Sheets') },
    { id: 'hardware', label: t('Hardware') },
    { id: 'shopping', label: t('Shopping'), name: t('Shopping list') },
    {
      id: 'checks',
      label: t('Checks'),
      badge: errors || warnings || undefined,
      kind: errors ? 'error' : 'warning',
    },
  ];
  return (
    <section className={`output ${open ? '' : 'collapsed'}`} aria-label={t('Results')}>
      <div className="tabs" role="tablist">
        {tabs.map((b) => (
          <button
            key={b.id}
            role="tab"
            type="button"
            id={`tab-${b.id}`}
            aria-label={b.name}
            aria-selected={open && tab === b.id}
            aria-expanded={phone ? open && tab === b.id : undefined}
            aria-controls={open && tab === b.id ? `panel-${b.id}` : undefined}
            className={open && tab === b.id ? 'on' : ''}
            onClick={() => (phone ? toggleTab(b.id) : setTab(b.id))}
          >
            {b.label}
            {b.badge ? <span className={`badge ${b.kind}`}>{b.badge}</span> : null}
          </button>
        ))}
      </div>
      {open && (
        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className="tabpanel"
        >
          {tab === 'parts' && <Parts />}
          {tab === 'sheets' && <Sheets />}
          {tab === 'hardware' && <Hardware />}
          {tab === 'shopping' && <ShoppingList />}
          {tab === 'checks' && <Checks />}
        </div>
      )}
    </section>
  );
}

function Parts() {
  const view = useView();
  const setHighlight = useDesign((s) => s.setHighlight);
  const highlight = useDesign((s) => s.highlight);
  const rows = view.rows;
  const bands = useMemo(() => bandMetersFromRows(rows), [rows]);
  const blocked = view.diagnostics.some((d) => d.severity === 'error');
  const byMat = useMemo(() => {
    const m = new Map<string, typeof rows>();
    for (const r of rows) m.set(r.materialId, [...(m.get(r.materialId) ?? []), r]);
    return [...m.entries()];
  }, [rows]);
  // No board names its edge band yet: the summary says so once instead of under every board.
  const allUnnamed = useMemo(() => {
    const bs = byMat.map(([, list]) => boardBands(list));
    return bs.some((b) => b.unnamed) && bs.every((b) => !b.bands.length && !b.fronts.length);
  }, [byMat]);
  const total = rows.reduce((n, r) => n + r.quantity, 0);

  const setPrinting = useUi((s) => s.setPrinting);
  const why = blocked ? t('Fix the problems listed under Checks first') : undefined;

  return (
    <div className="parts">
      <div className="out-actions">
        <button
          type="button"
          className="btn primary"
          disabled={blocked}
          title={why ?? t('Download the parts list as CSV (in the print language)')}
          onClick={() =>
            download(
              `${fileName(view.title)}-parts.csv`,
              cutlistCsvRo(view.rows),
              'text/csv;charset=utf-8',
            )
          }
        >
          <Icon name="download" />
          {t('Download CSV')}
        </button>
        <button
          type="button"
          className="btn outline"
          disabled={blocked}
          title={why ?? t('Print the cutting sheet (Romanian, A4) or save it as PDF')}
          onClick={() => setPrinting(true)}
        >
          <Icon name="printer" />
          {t('Print')}
        </button>
      </div>
      {blocked && (
        <p className="alert error blocked">
          <Icon name="alert-circle" className="sm" />
          <span>
            {view.mode === 'project'
              ? t('This project has problems (see Checks). Fix them before cutting.')
              : t('This design has problems (see Checks). Fix them before cutting.')}
          </span>
        </p>
      )}
      <p className="summary">
        {t('{total} parts in {n|# material|# materials}.', { total, n: byMat.length })}
        {allUnnamed && t(' Edge bands are not named yet.')}{' '}
        <InfoTip label={t('About the parts list')} align="start">
          {t('Sizes are finished sizes; edges marked for banding.')}
        </InfoTip>
      </p>
      {byMat.map(([mid, list]) => {
        const name = tr(list[0].materialName);
        // Said once in the summary when no board names its band yet (G-059), else per board.
        const bandText = allUnnamed ? null : boardBandText(list);
        return (
          <table key={mid} className="cut">
            <caption>
              <strong>{name}</strong>
              <span>
                {t('{n} m²', { n: areaM2(rows, mid).toFixed(2) })}
                {bands.get(mid) ? t(', {n} m edge band', { n: bands.get(mid)!.toFixed(1) }) : ''}
                {list[0].grain ? t(', grain along length') : ''}
              </span>
              {bandText && <span className="band">{bandText}</span>}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('Qty')}</th>
                <th scope="col">{t('Length')}</th>
                <th scope="col">{t('Width')}</th>
                <th scope="col">{t('Edges')}</th>
                <th scope="col">{t('Part')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const on = r.panelIds.some((id) => highlight.includes(id));
                return (
                  <tr
                    key={r.panelIds[0]}
                    className={on ? 'on' : ''}
                    tabIndex={0}
                    onMouseEnter={() => setHighlight(r.panelIds)}
                    onMouseLeave={() => setHighlight([])}
                    onFocus={() => setHighlight(r.panelIds)}
                    onBlur={() => setHighlight([])}
                  >
                    <td className="num">{r.quantity}</td>
                    <td className="num">{r.length}</td>
                    <td className="num">{r.width}</td>
                    <td>
                      <EdgeMark l={r.edgesL} w={r.edgesW} />
                    </td>
                    <td className="labels">
                      {r.labels.map((l) => tr(l)).join(', ')}
                      {r.drilling && (
                        <span className="drill">
                          {t('Drill: {what}', { what: tr(r.drilling) })}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );
      })}
      <Lengths />
    </div>
  );
}

/** Solid timber bought in lengths (ADR-038): first-fit packing per section, a heuristic. */
function Lengths() {
  const view = useView();
  const groups = useMemo(() => {
    const mats = new Map(view.materials.map((m) => [m.id, m]));
    return lengthsList(view.rows, (id) => mats.get(id)?.lengths ?? [2400, 3000], view.kerf);
  }, [view]);
  if (!groups.length) return null;
  return (
    <section className="lengths" aria-label={t('Solid timber lengths')}>
      <div className="info-row">
        <h3 className="list-head">{t('Solid timber to buy')}</h3>
        <GuidanceTip topic={t('solid timber lengths')}>
          {t(
            'Parts packed into the lengths you can buy, longest first, with a {kerf} mm saw cut between parts. A quick heuristic, not an optimum.',
            { kerf: view.kerf },
          )}
        </GuidanceTip>
      </div>
      {groups.map((g) => (
        <table key={`${g.materialId}|${g.section}`} className="cut">
          <caption>
            <strong>{tr(g.materialName)}</strong>
            <span>
              {t('section {section} mm, {n|# length|# lengths}', {
                section: g.section,
                n: g.bars.length,
              })}
            </span>
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('Length')}</th>
              <th scope="col">{t('Cut into')}</th>
              <th scope="col">{t('Left over')}</th>
            </tr>
          </thead>
          <tbody>
            {g.bars.map((b, i) => (
              <tr key={i}>
                <td className="num">{b.stock}</td>
                <td className="labels">
                  {b.parts.map((p) => `${p.length} (${tr(p.label)})`).join(' + ')}
                </td>
                <td className="num">{b.waste}</td>
              </tr>
            ))}
            {g.tooLong.map((p, i) => (
              <tr key={`long-${i}`} className="too-long">
                <td className="num">—</td>
                <td className="labels">
                  {t('{length} ({part}) is longer than any length you buy', {
                    length: p.length,
                    part: tr(p.label),
                  })}
                </td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </section>
  );
}

/** Small rectangle with the banded edges drawn heavy: long sides = length edges, short sides = width edges. */
function EdgeMark({ l, w }: { l: number; w: number }) {
  return (
    <span className="edgemark" title={t('Banded: {l} along length, {w} along width', { l, w })}>
      <svg viewBox="0 0 30 16" aria-hidden="true">
        <rect x="3" y="3" width="24" height="10" className="e-body" />
        <line x1="3" y1="3" x2="27" y2="3" className={l >= 1 ? 'e-on' : 'e-off'} />
        <line x1="3" y1="13" x2="27" y2="13" className={l >= 2 ? 'e-on' : 'e-off'} />
        <line x1="3" y1="3" x2="3" y2="13" className={w >= 1 ? 'e-on' : 'e-off'} />
        <line x1="27" y1="3" x2="27" y2="13" className={w >= 2 ? 'e-on' : 'e-off'} />
      </svg>
      <span className="e-text">{t('L{l} W{w}', { l, w })}</span>
    </span>
  );
}

function Hardware() {
  const items = useView().hardware;
  if (!items.length)
    return (
      <div className="hardware">
        <p className="empty center">
          <Icon name="box" />
          {t('No hardware needed yet. Add drawers, doors or a hanging rail.')}
        </p>
        <FastenerCounts />
      </div>
    );
  return (
    <div className="hardware">
      <div className="info-row end">
        <GuidanceTip topic={t('hardware counts')} align="end">
          {t(
            "Screws and connectors are counted below only as joints (guidance), except screwed joints a design names (their screws are your choice). Hinge and shelf-pin counts follow common guidance; the maker's datasheet decides.",
          )}
        </GuidanceTip>
      </div>
      <table className="cut">
        <thead>
          <tr>
            <th scope="col">{t('Qty')}</th>
            <th scope="col">{t('Item')}</th>
            <th scope="col">{t('Size')}</th>
            <th scope="col">{t('Note')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((h, i) => (
            <tr key={i}>
              <td className="num">{h.quantity}</td>
              <td>{tr(h.label)}</td>
              <td className="num">{h.sizeMm ? t('{n} mm', { n: h.sizeMm }) : ''}</td>
              <td className="note">{h.note ? tr(h.note) : h.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <FastenerCounts />
    </div>
  );
}

function Checks() {
  const view = useView();
  const diags = view.diagnostics;
  const select = useDesign((s) => s.select);
  const selectItem = useDesign((s) => s.selectItem);
  const productId = useDesign((s) => s.design.product.id);
  const setHighlight = useDesign((s) => s.setHighlight);
  const projectModel = useDesign((s) => s.projectModel);
  const projectId = useDesign((s) => s.project?.id);
  const showProblem = useProblem((s) => s.show);
  const go = (nodeId?: string) =>
    view.mode === 'project'
      ? selectItem(nodeId ?? null)
      : select(nodeId && nodeId !== productId ? nodeId : null);
  // An empty project has nothing to check yet: no "No problems found" over zero parts (G-059).
  if (!diags.length && view.mode === 'project' && !projectModel?.pieces.length)
    return (
      <p className="empty center">
        <Icon name="info" />
        {t('Nothing to check yet. Add pieces under Compose.')}
      </p>
    );
  if (!diags.length)
    return (
      <p className="empty ok center">
        <Icon name="check" />
        {t('No problems found. Parts fit, nothing overlaps, every size is a whole millimetre.')}
      </p>
    );
  const sorted = [...diags].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1,
  );
  return (
    <ul className="checks">
      {sorted.map((d, i) => (
        <li key={i} className={d.severity}>
          <button
            type="button"
            onClick={() => {
              go(d.nodeId);
              // A project problem with a place (ADR-071): outline it on the plan, offer repairs, light its panels.
              if (view.mode === 'project' && projectModel && projectId && d.itemIds?.length) {
                setHighlight(problemPanels(projectModel, d));
                showProblem(d, projectId);
              } else setHighlight(d.panelIds ?? []);
            }}
          >
            <Icon
              name={d.severity === 'error' ? 'alert-circle' : 'alert-triangle'}
              className="sm"
            />
            <span>
              <span className="sev">{d.severity === 'error' ? t('Problem') : t('Check')}</span>
              {tr(d.message)}
              {view.mode === 'project' && d.itemIds?.length ? (
                <span className="check-more">
                  {mayRepair(d) ? t('Show on the plan and see repairs') : t('Show on the plan')}
                </span>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
