import { useMemo } from 'react';
import { areaM2, bandMetersFromRows, boardBandText, lengthsList } from '../core/cutlist';
import { useDesign, type Tab } from '../store/designStore';
import { Sheets } from './Sheets';
import { ShoppingList } from './Shopping';
import { useView } from './useView';
import { Icon } from './icons';
import { cutlistCsvRo } from '../core/ro';
import { download, fileName } from './shell/files';
import { useUi } from './shell/uiStore';

export function Output() {
  const tab = useDesign((s) => s.tab);
  const setTab = useDesign((s) => s.setTab);
  const view = useView();
  const errors = view.diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = view.diagnostics.length - errors;
  const parts = view.rows.reduce((n, r) => n + r.quantity, 0);
  const tabs: { id: Tab; label: string; badge?: number; kind?: string }[] = [
    { id: 'parts', label: 'Parts', badge: parts || undefined, kind: 'neutral' },
    { id: 'sheets', label: 'Sheets' },
    { id: 'hardware', label: 'Hardware' },
    { id: 'shopping', label: 'Shopping list' },
    {
      id: 'checks',
      label: 'Checks',
      badge: errors || warnings || undefined,
      kind: errors ? 'error' : 'warning',
    },
  ];
  return (
    <section className="output" aria-label="Results">
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={tab === t.id ? 'on' : ''}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.badge ? <span className={`badge ${t.kind}`}>{t.badge}</span> : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="tabpanel">
        {tab === 'parts' && <Parts />}
        {tab === 'sheets' && <Sheets />}
        {tab === 'hardware' && <Hardware />}
        {tab === 'shopping' && <ShoppingList />}
        {tab === 'checks' && <Checks />}
      </div>
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
  const total = rows.reduce((n, r) => n + r.quantity, 0);

  const setPrinting = useUi((s) => s.setPrinting);
  const why = blocked ? 'Fix the problems listed under Checks first' : undefined;

  return (
    <div className="parts">
      <div className="out-actions">
        <button
          type="button"
          className="btn primary"
          disabled={blocked}
          title={why ?? 'Download the parts list as CSV (Romanian)'}
          onClick={() =>
            download(
              `${fileName(view.title)}-parts.csv`,
              cutlistCsvRo(view.rows),
              'text/csv;charset=utf-8',
            )
          }
        >
          <Icon name="download" />
          Download CSV
        </button>
        <button
          type="button"
          className="btn outline"
          disabled={blocked}
          title={why ?? 'Print the cutting sheet (Romanian, A4) or save it as PDF'}
          onClick={() => setPrinting(true)}
        >
          <Icon name="printer" />
          Print
        </button>
      </div>
      {blocked && (
        <p className="alert error blocked">
          <Icon name="alert-circle" className="sm" />
          <span>
            {view.mode === 'project' ? 'This project' : 'This design'} has problems (see Checks).
            Fix them before cutting.
          </span>
        </p>
      )}
      <p className="summary">
        {total} parts in {byMat.length} {byMat.length === 1 ? 'material' : 'materials'}. Sizes are
        finished sizes; edges marked for banding.
      </p>
      {byMat.map(([mid, list]) => {
        const name = list[0].materialName;
        return (
          <table key={mid} className="cut">
            <caption>
              <strong>{name}</strong>
              <span>
                {areaM2(rows, mid).toFixed(2)} m²
                {bands.get(mid) ? `, ${bands.get(mid)!.toFixed(1)} m edge band` : ''}
                {list[0].grain ? ', grain along length' : ''}
              </span>
              {boardBandText(list) && <span className="band">{boardBandText(list)}</span>}
            </caption>
            <thead>
              <tr>
                <th scope="col">Qty</th>
                <th scope="col">Length</th>
                <th scope="col">Width</th>
                <th scope="col">Edges</th>
                <th scope="col">Part</th>
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
                      {r.labels.join(', ')}
                      {r.drilling && <span className="drill">Drill: {r.drilling}</span>}
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
    <section className="lengths" aria-label="Solid timber lengths">
      <h3 className="list-head">Solid timber to buy</h3>
      <p className="hint">
        Parts packed into the lengths you can buy, longest first, with a {view.kerf} mm saw cut
        between parts. A quick heuristic, not an optimum.
      </p>
      {groups.map((g) => (
        <table key={`${g.materialId}|${g.section}`} className="cut">
          <caption>
            <strong>{g.materialName}</strong>
            <span>
              section {g.section} mm, {g.bars.length} {g.bars.length === 1 ? 'length' : 'lengths'}
            </span>
          </caption>
          <thead>
            <tr>
              <th scope="col">Length</th>
              <th scope="col">Cut into</th>
              <th scope="col">Left over</th>
            </tr>
          </thead>
          <tbody>
            {g.bars.map((b, i) => (
              <tr key={i}>
                <td className="num">{b.stock}</td>
                <td className="labels">
                  {b.parts.map((p) => `${p.length} (${p.label})`).join(' + ')}
                </td>
                <td className="num">{b.waste}</td>
              </tr>
            ))}
            {g.tooLong.map((p, i) => (
              <tr key={`long-${i}`} className="too-long">
                <td className="num">—</td>
                <td className="labels">
                  {p.length} ({p.label}) is longer than any length you buy
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
    <span className="edgemark" title={`Banded: ${l} along length, ${w} along width`}>
      <svg viewBox="0 0 30 16" aria-hidden="true">
        <rect x="3" y="3" width="24" height="10" className="e-body" />
        <line x1="3" y1="3" x2="27" y2="3" className={l >= 1 ? 'e-on' : 'e-off'} />
        <line x1="3" y1="13" x2="27" y2="13" className={l >= 2 ? 'e-on' : 'e-off'} />
        <line x1="3" y1="3" x2="3" y2="13" className={w >= 1 ? 'e-on' : 'e-off'} />
        <line x1="27" y1="3" x2="27" y2="13" className={w >= 2 ? 'e-on' : 'e-off'} />
      </svg>
      <span className="e-text">
        L{l} W{w}
      </span>
    </span>
  );
}

function Hardware() {
  const items = useView().hardware;
  if (!items.length)
    return (
      <p className="empty center">
        <Icon name="box" />
        No hardware needed yet. Add drawers, doors or a hanging rail.
      </p>
    );
  return (
    <div className="hardware">
      <table className="cut">
        <thead>
          <tr>
            <th scope="col">Qty</th>
            <th scope="col">Item</th>
            <th scope="col">Size</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {items.map((h, i) => (
            <tr key={i}>
              <td className="num">{h.quantity}</td>
              <td>{h.label}</td>
              <td className="num">{h.sizeMm ? `${h.sizeMm} mm` : ''}</td>
              <td className="note">{h.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Screws and connectors are not listed, except screwed joints a design names (their screws are
        your choice). Hinge and shelf-pin counts follow common guidance; the maker's datasheet
        decides.
      </p>
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
  const go = (nodeId?: string) =>
    view.mode === 'project'
      ? selectItem(nodeId ?? null)
      : select(nodeId && nodeId !== productId ? nodeId : null);
  if (!diags.length)
    return (
      <p className="empty ok center">
        <Icon name="check" />
        No problems found. Parts fit, nothing overlaps, every size is a whole millimetre.
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
              setHighlight(d.panelIds ?? []);
            }}
          >
            <Icon
              name={d.severity === 'error' ? 'alert-circle' : 'alert-triangle'}
              className="sm"
            />
            <span>
              <span className="sev">{d.severity === 'error' ? 'Problem' : 'Check'}</span>
              {d.message}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
