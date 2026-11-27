import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@furniture-builder/i18n';
import { FEATURES, type Feature, type FeatureDomain } from './info/features';
import { OVERVIEW } from './CanvasEditor';
import { readLocal, writeLocal } from '../persist/localPrefs';

/**
 * Find an action (ADR-289): one search over what the canvas editor can open here (the selection's blocks and the
 * results) and over every feature the app has (the feature tree, ADR-158), each with its own description.
 */

/** Every feature of the tree with the domain path it sits under, in tree order. */
export function flatFeatures(
  domains: FeatureDomain[] = FEATURES,
): { f: Feature; path: string[] }[] {
  const out: { f: Feature; path: string[] }[] = [];
  const walk = (d: FeatureDomain, path: string[]) => {
    for (const f of d.features ?? []) out.push({ f, path });
    for (const c of d.children ?? []) walk(c, [...path, t(c.name)]);
  };
  for (const d of domains) walk(d, [t(d.name)]);
  return out;
}

/** Words of `q` all found in `text`, case and accents ignored; an empty query matches everything. */
export function matches(text: string, q: string): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const hay = norm(text);
  return norm(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

export function FindAction({
  open,
  blocks,
  outputs,
  onBlock,
  onOutput,
  onClose,
}: {
  open: boolean;
  blocks: string[];
  outputs: [string, string][];
  onBlock: (k: string) => void;
  onOutput: (tab: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  const all = useMemo(() => flatFeatures(), []);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQ('');
      setShown(null);
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) d.close();
  }, [open]);
  const here = [
    ...[OVERVIEW, ...blocks].map((k) => ({
      label: k === OVERVIEW ? t('Overview') : k,
      go: () => onBlock(k),
    })),
    ...outputs.map(([tab, label]) => ({ label, go: () => onOutput(tab) })),
  ].filter((x) => matches(x.label, q));
  const found = q.trim()
    ? all.filter(({ f }) => matches(`${t(f.name)} ${f.detail ? t(f.detail) : ''}`, q)).slice(0, 40)
    : [];
  return (
    <dialog ref={ref} className="find-action" aria-label={t('Find an action')} onClose={onClose}>
      <div className="find-head">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('Search actions and features')}
          aria-label={t('Search actions and features')}
          autoFocus
        />
        <button type="button" className="btn icon ghost" aria-label={t('Close')} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="find-body">
        {here.length > 0 && (
          <section aria-label={t('Open here')}>
            <h3>{t('Open here')}</h3>
            <ul>
              {here.map((x) => (
                <li key={x.label}>
                  <button
                    type="button"
                    className="find-row"
                    onClick={() => {
                      onClose();
                      x.go();
                    }}
                  >
                    {x.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {found.length > 0 && (
          <section aria-label={t('All features')}>
            <h3>{t('All features')}</h3>
            <ul>
              {found.map(({ f, path }) => (
                <li key={`${path.join('/')}/${f.name}`}>
                  <button
                    type="button"
                    className="find-row"
                    aria-expanded={shown === f.name}
                    onClick={() => setShown(shown === f.name ? null : f.name)}
                  >
                    <span>{t(f.name)}</span>
                    <small>{path.join(' › ')}</small>
                  </button>
                  {shown === f.name && f.detail && <p className="find-detail">{t(f.detail)}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {here.length === 0 && found.length === 0 && (
          <p className="hint">{t('Nothing found. Try another word.')}</p>
        )}
      </div>
    </dialog>
  );
}

const COACH_KEY = 'fb:canvas-coach';
const STEP_COUNT = 3;

/** True until the first-run hints were finished or skipped on this device. */
function coachDue(): boolean {
  return readLocal(COACH_KEY, (v) => v !== 'done', false);
}

/** First-run hints for the canvas editor (ADR-289): three steps, once per device, skippable. */
export function CanvasHints({ on }: { on: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  const [due, setDue] = useState(coachDue);
  const show = on && due;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (show && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!show && d.open) d.close();
  }, [show]);
  const finish = () => {
    writeLocal(COACH_KEY, 'done'); // private mode: shown again next time
    setDue(false);
  };
  const titles = [t('Tap to select'), t('Sizes and handles'), t('Edit opens the editor')];
  const bodies = [
    t(
      'Tap the drawing to select: each tap goes one space deeper. The path at the top goes back up.',
    ),
    t('Yellow sizes open their field. A green + divides a space; drag a divider to resize.'),
    t(
      'Edit at the bottom opens the whole editor of the selection; Jump to goes to a section. The magnifier finds any action.',
    ),
  ];
  return (
    <dialog ref={ref} className="canvas-hints" aria-label={t('Getting started')} onClose={finish}>
      {step < STEP_COUNT && (
        <>
          <p className="hint">{t('Step {i} of {n}', { i: step + 1, n: STEP_COUNT })}</p>
          <h3>{titles[step]}</h3>
          <p>{bodies[step]}</p>
          <div className="hint-actions">
            <button type="button" className="btn ghost" onClick={finish}>
              {t('Skip')}
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => (step < STEP_COUNT - 1 ? setStep(step + 1) : finish())}
            >
              {step < STEP_COUNT - 1 ? t('Next') : t('Start')}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
