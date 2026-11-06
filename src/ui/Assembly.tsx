/**
 * The Assembly tab (ADR-174): an ordered step list per piece from `assemblySteps()`, labelled guidance (ADR-010).
 * "Show step" lights the step's parts in the 3D view (viewer-only, as Isolate, ADR-122); ← → move between steps.
 * The printed sheet is `PrintAssembly`, in the print language (ADR-157). A project opens with its Project order
 * (ADR-178, `projectAssemblyOrder()`): which pieces go in first, before the per-piece steps.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ASSEMBLY_GUIDANCE,
  assemblySteps,
  boxTitle,
  fastenerLines,
  hardwareLine,
  partName,
  prepLines,
  projectAssemblyOrder,
  projectOrderPrint,
  stepInstruction,
  stepLitIds,
  stepTitle,
  type AssemblyStep,
  type OrderEntry,
  type ProjectStage,
  type StepPart,
} from '../core/assembly';
import type { FastenerChoice } from '../core/fasteners';
import { t, tr } from '../core/i18n';
import { getPrintLang, PRINT_DATE_LOCALE, pt } from '../core/i18n/print';
import type { Design, FurnitureModel, Material } from '../core/types';
import { useDesign } from '../store/designStore';
import { printPieceName } from '../core/catalog/printName';
import { useFastenerChoices } from './Fasteners';
import { GuidanceTip } from './controls';
import { PieceElevation } from './Elevation';
import { Icon } from './icons';
import { useUi } from './shell/uiStore';
import { useView } from './useView';

interface PieceSteps {
  key: string;
  name: string;
  /** For the name on the printed sheet (`printPieceName`, ADR-202). */
  design: Pick<Design, 'name' | 'catalog'>;
  /** Linked copies (ADR-111) listed once: how many pieces share these steps. */
  times: number;
  /** Panel ids as the 3D view knows them (a project prefixes the piece id). */
  idOf: (panelId: string) => string;
  steps: AssemblyStep[];
  /** The piece's own model and boards, for its front view on the printed sheet (ADR-185). */
  model: FurnitureModel;
  materials: Material[];
}

/** The pieces shown with their steps: the open design, or every piece of the project (linked copies once). */
function usePieceSteps(): PieceSteps[] {
  const view = useView();
  const pieces = useDesign((s) =>
    s.project && !s.editingItemId ? s.projectModel?.pieces : undefined,
  );
  const design = useDesign((s) => s.design);
  return useMemo(() => {
    if (view.mode === 'design' || !pieces)
      return [
        {
          key: 'design',
          name: design.name,
          design,
          times: 1,
          idOf: (id) => id,
          steps: assemblySteps(view.model),
          model: view.model,
          materials: design.materials,
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
        design: pc.item.design,
        times: pc.item.quantity,
        idOf: (id) => `${pc.item.id}:${id}`,
        steps: assemblySteps(model),
        model,
        materials: pc.item.design.materials,
      };
      if (link) seen.set(link, entry);
      out.push(entry);
    }
    return out;
  }, [view, pieces, design]);
}

/** The project's order of pieces (ADR-178); none for a design alone or while one piece is being edited. */
function useProjectOrder(): ProjectStage[] {
  const view = useView();
  const project = useDesign((s) => (s.editingItemId ? null : s.project));
  const projectModel = useDesign((s) => (s.editingItemId ? null : s.projectModel));
  return useMemo(
    () => (view.mode === 'project' ? projectAssemblyOrder(project, projectModel) : []),
    [view.mode, project, projectModel],
  );
}

/** A line of the Project order on the tab: the piece's name or the part's, with its count and wall. */
function entryText(e: OrderEntry): string {
  const name =
    e.kind === 'sink'
      ? t('Sink cut-out {w} × {d} mm', { w: e.size![0], d: e.size![1] })
      : tr(e.name);
  return e.times > 1 ? `${name} × ${e.times}` : name;
}

/** The Project order at the start of the printed sheet (ADR-178), in the print language (ADR-157). */
function PrintProjectOrder({ stages }: { stages: ProjectStage[] }) {
  const sheet = projectOrderPrint(stages);
  return (
    <section className="pr-block">
      <h2>{sheet.heading}</h2>
      <ol>
        {sheet.stages.map((s) => (
          <li key={s.n}>
            <strong>{s.title}</strong>: {s.lines.join(', ')}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The Project order section of the tab (ADR-178): numbered stages, each with its pieces or parts in order. */
function ProjectOrder({ stages }: { stages: ProjectStage[] }) {
  return (
    <section className="assembly-piece assembly-order" aria-label={t('Project order')}>
      <h3>{t('Project order')}</h3>
      <ol className="assembly-steps">
        {stages.map((s) => (
          <li key={s.id}>
            <div className="step-head">
              <span className="step-n">{s.n}</span>
              <strong>{s.title}</strong>
            </div>
            <ol className="step-parts">
              {s.entries.map((e) => (
                <li key={e.ids[0]}>
                  {entryText(e)}
                  {e.wall !== undefined && (
                    <span className="hint"> · {t('Wall {n}', { n: e.wall + 1 })}</span>
                  )}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Assembly() {
  const pieces = usePieceSteps();
  const order = useProjectOrder();
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
    setLit(stepLitIds(step).map(p.idOf));
  };
  const move = (dir: 1 | -1) => {
    const p = pieces.find((x) => x.key === current?.piece) ?? pieces[0];
    if (!p) return;
    const idx = current ? p.steps.findIndex((s) => s.n === current.n) : -1;
    const next = p.steps[Math.min(p.steps.length - 1, Math.max(0, idx + dir))];
    if (next) show(p, next);
  };
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
      {order.length > 0 && <ProjectOrder stages={order} />}
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
                    {stepLitIds(s).length > 0 && (
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
                  <p className="step-do">{stepInstruction(s, 'app')}</p>
                  <StepBody step={s} choices={choices} />
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** A part row on the tab: "2 × Left side 702 × 542 × 18 mm". */
function PartRow({ part }: { part: StepPart }) {
  return (
    <li>
      <span className="num">{part.quantity} ×</span> {partName(part.label, 'app')}{' '}
      <span className="num hint">
        {part.size[0]} × {part.size[1]} × {part.size[2]} {t('mm')}
      </span>
    </li>
  );
}

/** A step's lists on the tab: prepared parts, parts, drawer boxes once × N, fronts hung again, fixings. */
function StepBody({ step: s, choices }: { step: AssemblyStep; choices: FastenerChoice[] }) {
  const prep = prepLines(s, 'app');
  const fixings = [
    ...fastenerLines(s, choices, 'app'),
    ...s.hardware.map((h) => hardwareLine(h, 'app')),
  ];
  return (
    <>
      {prep.length > 0 && (
        <ul className="step-parts">
          {prep.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      {s.parts.length > 0 && (
        <ul className="step-parts">
          {s.parts.map((part, i) => (
            <PartRow key={i} part={part} />
          ))}
        </ul>
      )}
      {s.boxes.length > 0 && (
        <ul className="step-parts step-boxes">
          {s.boxes.map((b, i) => (
            <li key={i}>
              <strong>{boxTitle(b, 'app')}</strong>
              <ul className="step-parts">
                {b.parts.map((part, k) => (
                  <PartRow key={k} part={part} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {s.again.length > 0 && (
        <ul className="step-parts">
          {s.again.map((part, i) => (
            <PartRow key={i} part={part} />
          ))}
        </ul>
      )}
      {fixings.length > 0 && (
        <ul className="step-fix hint">
          {fixings.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Printable assembly sheet (ADR-174): per piece its front view and steps, in the print language (ADR-157, ADR-185). */
export function PrintAssembly() {
  const view = useView();
  const pieces = usePieceSteps();
  const order = useProjectOrder();
  const choices = useFastenerChoices();
  const locale = PRINT_DATE_LOCALE[getPrintLang()];
  const mm = pt('mm');
  const row = (part: StepPart, i: number) => (
    <div key={i}>
      {part.quantity} × {partName(part.label, 'print')} — {part.size[0]} × {part.size[1]} ×{' '}
      {part.size[2]} {mm}
    </div>
  );
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
      {order.length > 0 && <PrintProjectOrder stages={order} />}
      {pieces.map((p) => (
        <section key={p.key} className="pr-block pr-piece">
          <h2>
            {printPieceName(p.design)}
            {p.times > 1 ? ` × ${p.times}` : ''}
          </h2>
          <div className="pr-elev">
            <PieceElevation
              model={p.model}
              materials={p.materials}
              label={`${pt('Vedere frontală')}: ${printPieceName(p.design)}`}
            />
          </div>
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
                    <strong>
                      {s.n}. {stepTitle(s, 'print')}
                    </strong>
                    <div className="pr-do">{stepInstruction(s, 'print')}</div>
                  </td>
                  <td>
                    {prepLines(s, 'print').map((line, i) => (
                      <div key={`p${i}`}>{line}</div>
                    ))}
                    {s.parts.map(row)}
                    {s.boxes.map((b, i) => (
                      <div key={`b${i}`} className="pr-box">
                        <strong>{boxTitle(b, 'print')}</strong>
                        {b.parts.map(row)}
                      </div>
                    ))}
                    {s.again.map(row)}
                  </td>
                  <td>
                    {fastenerLines(s, choices, 'print').map((line, i) => (
                      <div key={`f${i}`}>{line}</div>
                    ))}
                    {s.hardware.map((h, i) => (
                      <div key={`h${i}`}>{hardwareLine(h, 'print')}</div>
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
