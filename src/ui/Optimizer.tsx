import { useEffect, useRef, useState } from 'react';
import { t } from '@furniture-builder/i18n';
import { nest } from '../core/nesting';
import {
  defaultOptimizerInput,
  emptyOptimizerPart,
  optimizerJob,
  parseOptimizerInput,
  type OptimizerInput,
  type OptimizerPart,
  type OptimizerProblem,
} from '../core/optimizer';
import type { NestJob, NestResult } from '@furniture-builder/nesting';
import { createNestWorker, type NestResponse } from '@furniture-builder/nesting/client';
import { InfoTip } from './controls';
import { Icon } from './icons';
import { MaterialSheets } from './Sheets';
import { readLocal, writeLocal } from '../persist/localPrefs';

/** The last typed list and board stay on this device only (no Dexie table, no design document). */
const STORE_KEY = 'fb.optimizer.v1';

function loadInput(): OptimizerInput {
  return readLocal(STORE_KEY, (v) => parseOptimizerInput(v), null) ?? defaultOptimizerInput();
}

const PROBLEM: Record<OptimizerProblem, () => string> = {
  required: () => t('Enter a value.'),
  whole: () => t('Enter whole millimetres.'),
  min: () => t('Too small.'),
};

type Run =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; job: NestJob; result: NestResult }
  | { status: 'error'; error: string };

/** Lays out the job in the nesting worker 300 ms after the last edit; a newer run wins (ADR-018). */
function useOptimize(job: NestJob | null): Run {
  const [run, setRun] = useState<Run>({ status: 'idle' });
  const worker = useRef<Worker | null>(null);
  const req = useRef(0);
  const key = job ? JSON.stringify(job) : '';
  useEffect(() => {
    const id = ++req.current;
    // With no job the page shows what to fix instead of a result, so the last run is left as it is.
    if (!job) return;
    const timer = setTimeout(() => {
      setRun({ status: 'running' });
      const finish = (msg: NestResponse) => {
        if (msg.id !== id) return;
        setRun(
          'results' in msg
            ? { status: 'done', job, result: msg.results[0] }
            : { status: 'error', error: msg.error },
        );
      };
      try {
        worker.current ??= createNestWorker();
        worker.current.onmessage = (e: MessageEvent<NestResponse>) => finish(e.data);
        worker.current.onerror = () =>
          finish({ id, error: t('The sheet layout could not run in this browser.') });
        worker.current.postMessage({ id, jobs: [job] });
      } catch {
        try {
          finish({ id, results: [nest(job)] });
        } catch (err) {
          finish({ id, error: String(err) });
        }
      }
    }, 300);
    return () => clearTimeout(timer);
    // The job is compared by its text: a new object with the same values does not run again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = null;
    },
    [],
  );
  return run;
}

function Field({
  id,
  label,
  value,
  problem,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  problem?: OptimizerProblem;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        inputMode="numeric"
        value={value}
        aria-invalid={!!problem}
        aria-describedby={problem ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {problem && (
        <p className="field-error" id={`${id}-err`}>
          {PROBLEM[problem]()}
        </p>
      )}
    </div>
  );
}

/**
 * The standalone cut list optimizer, reached from the ⋯ menu: type part sizes and one board, and see how many
 * sheets they fill, with each sheet drawn. Nothing here touches the open design.
 */
export function OptimizerPage({
  onDone,
  designOpen = true,
}: {
  onDone: () => void;
  designOpen?: boolean;
}) {
  const [input, setInput] = useState<OptimizerInput>(loadInput);
  useEffect(() => {
    // Storage unavailable (private window): the page still works, the list is just not kept.
    writeLocal(STORE_KEY, JSON.stringify(input));
  }, [input]);
  const check = optimizerJob(input);
  const run = useOptimize(check.job);
  const set = (patch: Partial<OptimizerInput>) => setInput((i) => ({ ...i, ...patch }));
  const setPart = (id: string, patch: Partial<OptimizerPart>) =>
    setInput((i) => ({ ...i, parts: i.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const labelOf = (key: string) => {
    const p = input.parts.find((x) => x.id === key);
    return p ? { labels: [p.label.trim() || `${p.length}×${p.width}`], panelIds: [] } : undefined;
  };
  const result = run.status === 'done' ? run.result : null;
  return (
    <main className="catalog-page optimizer-page" aria-label={t('Cut list optimizer')}>
      <header className="catalog-head">
        <div>
          <h1>{t('Cut list optimizer')}</h1>
          <p className="hint">
            {t('Type the parts and the board size; the sheets are laid out as you type.')}{' '}
            <InfoTip label={t('About the sheet layout')} align="start">
              {t(
                'Heuristic layout for a panel saw (edge-to-edge cuts): usually close to the fewest sheets, not guaranteed.',
              )}
            </InfoTip>
          </p>
        </div>
        {designOpen && (
          <button type="button" className="btn outline" onClick={onDone}>
            <Icon name="chevron-left" className="sm" />
            {t('Back to the editor')}
          </button>
        )}
      </header>

      <section aria-labelledby="opt-board">
        <h2 id="opt-board">{t('Board')}</h2>
        <div className="opt-grid">
          <Field
            id="opt-sheet-length"
            label={t('Sheet length (mm)')}
            value={input.sheetLength}
            problem={check.problems.sheetLength}
            onChange={(v) => set({ sheetLength: v })}
          />
          <Field
            id="opt-sheet-width"
            label={t('Sheet width (mm)')}
            value={input.sheetWidth}
            problem={check.problems.sheetWidth}
            onChange={(v) => set({ sheetWidth: v })}
          />
          <Field
            id="opt-kerf"
            label={t('Saw cut (mm)')}
            value={input.kerf}
            problem={check.problems.kerf}
            onChange={(v) => set({ kerf: v })}
          />
          <Field
            id="opt-trim"
            label={t('Trim per edge (mm)')}
            value={input.trim}
            problem={check.problems.trim}
            onChange={(v) => set({ trim: v })}
          />
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={input.grain}
            onChange={(e) => set({ grain: e.target.checked })}
          />
          <span>{t('Grain locked: parts never turn (length along the sheet length)')}</span>
        </label>
      </section>

      <section aria-labelledby="opt-parts">
        <h2 id="opt-parts">{t('Parts')}</h2>
        <ol className="opt-parts">
          {input.parts.map((p, i) => (
            <li key={p.id} aria-label={t('Part {n}', { n: i + 1 })}>
              <div className="field">
                <label htmlFor={`opt-${p.id}-label`}>{t('Name')}</label>
                <input
                  id={`opt-${p.id}-label`}
                  value={p.label}
                  onChange={(e) => setPart(p.id, { label: e.target.value })}
                />
              </div>
              <Field
                id={`opt-${p.id}-length`}
                label={t('Length (mm)')}
                value={p.length}
                problem={check.problems[`${p.id}.length`]}
                onChange={(v) => setPart(p.id, { length: v })}
              />
              <Field
                id={`opt-${p.id}-width`}
                label={t('Width (mm)')}
                value={p.width}
                problem={check.problems[`${p.id}.width`]}
                onChange={(v) => setPart(p.id, { width: v })}
              />
              <Field
                id={`opt-${p.id}-qty`}
                label={t('Qty')}
                value={p.quantity}
                problem={check.problems[`${p.id}.quantity`]}
                onChange={(v) => setPart(p.id, { quantity: v })}
              />
              <button
                type="button"
                className="btn icon ghost"
                aria-label={t('Remove part {n}', { n: i + 1 })}
                onClick={() =>
                  setInput((s) => {
                    const parts = s.parts.filter((x) => x.id !== p.id);
                    return { ...s, parts: parts.length ? parts : [emptyOptimizerPart()] };
                  })
                }
              >
                <Icon name="trash" className="sm" />
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="btn outline"
          onClick={() => set({ parts: [...input.parts, emptyOptimizerPart()] })}
        >
          <Icon name="plus" className="sm" />
          {t('Add a part')}
        </button>
      </section>

      <section aria-labelledby="opt-result" aria-live="polite">
        <h2 id="opt-result">{t('Result')}</h2>
        {check.filled === 0 ? (
          <p className="hint">{t('Add at least one part with its length and width.')}</p>
        ) : !check.job ? (
          <p className="hint">{t('Fix the fields marked above to lay out the sheets.')}</p>
        ) : run.status === 'error' ? (
          <p className="alert error blocked">
            <Icon name="alert-circle" className="sm" />
            <span>{run.error}</span>
          </p>
        ) : run.status !== 'done' ? (
          <p className="loading">{t('Laying out sheets…')}</p>
        ) : (
          <>
            {result?.valid && (
              <p className="opt-summary">
                <strong>{t('{n|# sheet|# sheets}', { n: result.stats.sheetsUsed })}</strong>{' '}
                {t('{used}% of the board used', {
                  used: Math.round(result.stats.utilisation * 100),
                })}
                {result.unplaced.length > 0 &&
                  ` · ${t('{n|# part not placed|# parts not placed}', { n: result.unplaced.length })}`}
              </p>
            )}
            <MaterialSheets
              result={run.result}
              job={run.job}
              color="#ddd"
              trim={run.job.trim}
              labelOf={labelOf}
              onHover={() => {}}
            />
          </>
        )}
      </section>
    </main>
  );
}
