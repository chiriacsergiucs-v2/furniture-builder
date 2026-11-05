/**
 * The Assembly tab (ADR-174): an ordered step list per piece from `assemblySteps()`, labelled guidance (ADR-010).
 * "Show step" lights the step's parts in the 3D view (viewer-only, as Isolate, ADR-122); ← → move between steps.
 * The printed sheet is `PrintAssembly`, in the print language (ADR-157).
 */
import { useEffect, useMemo, useState } from 'react';
import { ASSEMBLY_GUIDANCE, assemblySteps, type AssemblyStep } from '../core/assembly';
import { t, tr } from '../core/i18n';
import { getPrintLang, PRINT_DATE_LOCALE, pt } from '../core/i18n/print';
import type { FurnitureModel } from '../core/types';
import { useDesign } from '../store/designStore';
import { useFastenerChoices } from './Fasteners';
import { GuidanceTip } from './controls';
import { Elevation } from './Elevation';
import { Icon } from './icons';
import { useUi } from './shell/uiStore';
import { useView } from './useView';

interface PieceSteps {
  key: string;
  name: string;
  /** Linked copies (ADR-111) listed once: how many pieces share these steps. */
  times: number;
  /** Panel ids as the 3D view knows them (a project prefixes the piece id). */
  idOf: (panelId: string) => string;
  steps: AssemblyStep[];
}

/** The pieces shown with their steps: the open design, or every piece of the project (linked copies once). */
function usePieceSteps(): PieceSteps[] {
  const view = useView();
  const pieces = useDesign((s) =>
    s.project && !s.editingItemId ? s.projectModel?.pieces : undefined,
  );
  const designName = useDesign((s) => s.design.name);
  return useMemo(() => {
    if (view.mode === 'design' || !pieces)
      return [
        {
          key: 'design',
          name: designName,
          times: 1,
          idOf: (id) => id,
          steps: assemblySteps(view.model),
        },
      ];
    const out: PieceSteps[] = [];
    const seen = new Map<string, PieceSteps>();
    for (const pc of pieces) {
      const link = pc.item.linkId;
      const have = link ? seen.get(link) : undefined;
      if (have) {
        have.times += pc.item.quantity;
        continue;
      }
      const model: FurnitureModel = pc.model;
      const entry: PieceSteps = {
        key: pc.item.id,
        name: pc.item.design.name,
        times: pc.item.quantity,
        idOf: (id) => `${pc.item.id}:${id}`,
        steps: assemblySteps(model),
      };
      if (link) seen.set(link, entry);
      out.push(entry);
    }
    return out;
  }, [view, pieces, designName]);
}

export function Assembly() {
  const pieces = usePieceSteps();
  const setLit = useDesign((s) => s.setLit);
  const lit = useDesign((s) => s.litPanelIds);
  const setPrinting = useUi((s) => s.setPrinting);
  const setPrintMode = useUi((s) => s.setPrintMode);
  const choices = useFastenerChoices();
  const [current, setCurrent] = useState<{ piece: string; n: number } | null>(null);
  // Leaving the tab turns the highlight off (the model is untouched either way, ADR-014).
  useEffect(() => () => setLit(null), [setLit]);
  const show = (p: PieceSteps, step: AssemblyStep) => {
    setCurrent({ piece: p.key, n: step.n });
    setLit(step.parts.flatMap((part) => part.panelIds.map(p.idOf)));
  };
  const move = (dir: 1 | -1) => {
    const p = pieces.find((x) => x.key === current?.piece) ?? pieces[0];
    if (!p) return;
    const idx = current ? p.steps.findIndex((s) => s.n === current.n) : -1;
    const next = p.steps[Math.min(p.steps.length - 1, Math.max(0, idx + dir))];
    if (next) show(p, next);
  };
  const chosen = (joint: string) => choices.find((c) => c.joint === joint);
  return (
    <div
      className="assembly"
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          move(1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      <div className="out-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            setPrintMode('assembly');
            setPrinting(true);
          }}
        >
          <Icon name="printer" className="sm" />
          {t('Print assembly steps')}
        </button>
        {lit && (
          <button type="button" className="btn sm" onClick={() => setLit(null)}>
            {t('Show every part again')}
          </button>
        )}
      </div>
      <p className="hint guidance" role="note">
        <GuidanceTip topic={t('assembly order')} align="start">
          {t(
            'The order comes from where the parts sit: what the others stand on first, then what they carry. No screw, dowel or drilling is named; your own fastener list is quoted per joint type when you set one.',
          )}
        </GuidanceTip>{' '}
        {ASSEMBLY_GUIDANCE}
      </p>
      {pieces.map((p) => (
        <section
          key={p.key}
          className="assembly-piece"
          aria-label={t('Assembly: {name}', { name: tr(p.name) })}
        >
          <h3>
            {tr(p.name)}
            {p.times > 1 ? ` × ${p.times}` : ''}
          </h3>
          <ol className="assembly-steps">
            {p.steps.map((s) => {
              const on = current?.piece === p.key && current.n === s.n;
              return (
                <li key={s.id} className={on ? 'on' : ''} aria-current={on ? 'step' : undefined}>
                  <div className="step-head">
                    <span className="step-n">{s.n}</span>
                    <strong>{s.title}</strong>
                    {s.parts.length > 0 && (
                      <button
                        type="button"
                        className={`btn sm ${on ? 'primary' : 'outline'}`}
                        aria-pressed={on}
                        onClick={() => show(p, s)}
                      >
                        {t('Show step')}
                      </button>
                    )}
                  </div>
                  {s.parts.length > 0 && (
                    <ul className="step-parts">
                      {s.parts.map((part, i) => (
                        <li key={i}>
                          <span className="num">{part.quantity} ×</span> {tr(part.label)}{' '}
                          <span className="num hint">
                            {part.size[0]} × {part.size[1]} × {part.size[2]} {t('mm')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(s.joints > 0 || s.hardware.length > 0) && (
                    <p className="step-joins hint">
                      {s.joints > 0 &&
                        t('{n|# carcass joint|# carcass joints}', { n: s.joints }) +
                          (chosen('carcass-joint')
                            ? t(' — your fastener: {name}, {per} per joint', {
                                name: chosen('carcass-joint')!.name,
                                per: chosen('carcass-joint')!.per,
                              })
                            : '')}
                      {s.joints > 0 && s.hardware.length > 0 ? ' · ' : ''}
                      {s.hardware.map((h) => `${h.quantity} × ${tr(h.label)}`).join(', ')}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** Printable assembly sheet (ADR-174): the steps per piece in the print language, labelled guidance. */
export function PrintAssembly() {
  const view = useView();
  const pieces = usePieceSteps();
  const locale = PRINT_DATE_LOCALE[getPrintLang()];
  const mm = pt('mm');
  return (
    <div className="print-root" aria-hidden="true">
      <header className="pr-head">
        <h1>{view.title}</h1>
        <p>
          {pt('Fișă de asamblare')}
          {view.mode === 'project' ? ` · ${pt('proiect')}` : ''} ·{' '}
          {new Date().toLocaleDateString(locale)}
        </p>
        <p className="pr-note">
          {pt(
            'Îndrumare: ordinea rezultă din pozițiile pieselor; îmbinările, elementele de fixare și găurirea sunt alegerea dumneavoastră.',
          )}
        </p>
      </header>
      {view.mode === 'design' && (
        <section className="pr-block pr-elev">
          <h2>{pt('Vedere frontală')}</h2>
          <Elevation />
        </section>
      )}
      {pieces.map((p) => (
        <section key={p.key} className="pr-block">
          <h2>
            {p.name}
            {p.times > 1 ? ` × ${p.times}` : ''}
          </h2>
          <table className="pr-table">
            <thead>
              <tr>
                <th>{pt('Pas')}</th>
                <th>{pt('Părți')}</th>
                <th>{pt('Îmbinări și feronerie')}</th>
              </tr>
            </thead>
            <tbody>
              {p.steps.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.n}. {pt(STEP_PT[s.id])}
                  </td>
                  <td>
                    {s.parts.map((part, i) => (
                      <div key={i}>
                        {part.quantity} × {part.label} — {part.size[0]} × {part.size[1]} ×{' '}
                        {part.size[2]} {mm}
                      </div>
                    ))}
                  </td>
                  <td>
                    {s.joints > 0 && <div>{pt('{n} îmbinări de corp', { n: s.joints })}</div>}
                    {s.hardware.map((h, i) => (
                      <div key={i}>
                        {h.quantity} × {h.label}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}

/** Step titles as print text keys (Romanian, ADR-020/157). */
const STEP_PT: Record<AssemblyStep['id'], Parameters<typeof pt>[0]> = {
  bottom: 'Fundul',
  sides: 'Laturile pe fund',
  fixed: 'Despărțitoare și polițe fixe',
  top: 'Capacul',
  back: 'Spatele',
  plinth: 'Soclul',
  adjustable: 'Polițe reglabile',
  drawers: 'Corpuri de sertar',
  fronts: 'Uși și fronturi',
  handles: 'Mânere',
  hang: 'Prindere și fixare',
  loose: 'Piese libere',
  also: 'De asemenea',
};
