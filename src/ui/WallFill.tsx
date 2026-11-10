/**
 * Fill a wall (ADR-103): width, depth and height of a wall, then suggested mixes of tall and base cabinets that fill
 * it exactly, each drawn like a catalog card. Refine narrows the mixes; "Use this mix" saves and opens a project.
 * The mixes are worked out in `src/core/wallfill.ts`; this file only collects the answers and shows the result.
 */
import { useId, useMemo, useState, type FormEvent } from 'react';
import { t } from '../core/i18n';
import { snapshotSvg } from '../core/snapshot';
import {
  BASE_HEIGHT,
  TALL_HEIGHT,
  WALL_DEPTH,
  WALL_HEIGHT,
  MIXES_FIRST,
  WALL_DEFAULTS,
  checkWall,
  suggestMixes,
  type Mix,
  type WallIssue,
  type TallPosition,
  type WallRow,
  type WallInput,
} from '../core/wallfill';
import { saveProject } from '../store/libraryStore';
import { useDesign } from '../store/designStore';
import { Segmented, Steps } from './controls';
import { Dialog } from './Dialogs';
import { FillFooter, Field, MixWarnings, Problems, ResultProblems, SaveError } from './fillParts';

type StepId = 'wall' | 'mixes' | 'refine';
const STEPS: { id: StepId; label: string }[] = [
  { id: 'wall', label: t('Wall') },
  { id: 'mixes', label: t('Suggestions') },
  { id: 'refine', label: t('Refine') },
];

/** What the user typed, kept as text so a wrong entry shows as a problem instead of vanishing (ADR-008). */
interface Form {
  width: string;
  depth: string;
  height: string;
  tallDepth: string;
  minWidth: string;
  maxWidth: string;
  baseHeight: string;
  pieces: string;
  tallCount: string;
  tallPosition: TallPosition | 'auto';
  shelves: string;
  drawers: string;
  door: string;
  equalFronts: string;
  wallRow: WallRow;
  wallHeight: string;
  /** Tall cabinet height and wall cabinet depth (ADR-204). */
  tallHeight: string;
  wallDepth: string;
}

const START: Form = {
  width: '3000',
  depth: '560',
  height: '2400',
  tallDepth: '',
  minWidth: String(WALL_DEFAULTS.minWidth),
  maxWidth: String(WALL_DEFAULTS.maxWidth),
  baseHeight: String(BASE_HEIGHT),
  pieces: '',
  tallCount: '',
  tallPosition: 'auto',
  shelves: '',
  drawers: '',
  door: '',
  equalFronts: '',
  wallRow: 'always',
  wallHeight: String(WALL_HEIGHT),
  tallHeight: String(TALL_HEIGHT),
  wallDepth: String(WALL_DEPTH),
};

/** The answers asked on the Wall step; the rest are on Refine. */
const WALL_STEP: WallIssue['field'][] = ['width', 'depth', 'height', 'tallDepth'];

/** Empty = any (absent); anything else goes to the core as a number, which reports what is wrong with it. */
const num = (s: string) => Number(s.trim());
const opt = (s: string) => (s.trim() === '' ? undefined : num(s));

function toInput(f: Form): WallInput {
  return {
    width: num(f.width),
    depth: num(f.depth),
    height: num(f.height),
    tallDepth: opt(f.tallDepth),
    minWidth: opt(f.minWidth),
    maxWidth: opt(f.maxWidth),
    baseHeight: opt(f.baseHeight),
    pieces: opt(f.pieces),
    tallCount: opt(f.tallCount),
    tallPosition: f.tallPosition === 'auto' ? undefined : f.tallPosition,
    atLeast: { shelves: opt(f.shelves), drawers: opt(f.drawers), door: opt(f.door) },
    equalFronts: opt(f.equalFronts),
    wallRow: f.wallRow,
    wallHeight: opt(f.wallHeight),
    tallHeight: opt(f.tallHeight),
    wallDepth: opt(f.wallDepth),
  };
}

/** A whole-mm answer kept as typed (ADR-008); shared with Fill the room. */
const picture = (m: Mix) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshotSvg(m.model.model, m.model.materials, 220))}`;

function MixCard({ m, onUse }: { m: Mix; onUse: () => void }) {
  const src = useMemo(() => picture(m), [m]);
  return (
    <li className="wz-card wf-card">
      <img
        src={src}
        alt={
          m.wallWidths
            ? t('Mix: wall {wall} mm, {widths} mm', { wall: m.wallWidths, widths: m.widths })
            : t('Mix: {widths} mm', { widths: m.widths })
        }
        width={180}
        height={110}
      />
      {m.wallWidths && (
        <span className="wz-card-label num wf-wall">{t('Wall: {w} mm', { w: m.wallWidths })}</span>
      )}
      <span className="wz-card-label num">
        <strong>{m.widths}</strong> {t('mm')}
      </span>
      <span className="wz-card-label">{m.summary}</span>
      <MixWarnings warnings={m.warnings} />
      <button type="button" className="btn sm primary" onClick={onUse}>
        {t('Use this mix')}
      </button>
    </li>
  );
}

export function WallFillDialog({
  open,
  onClose,
  onOpened,
}: {
  open: boolean;
  onClose: () => void;
  onOpened: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t('Fill a wall')} wide>
      {open && <WallFill onClose={onClose} onOpened={onOpened} />}
    </Dialog>
  );
}

function WallFill({ onClose, onOpened }: { onClose: () => void; onOpened: () => void }) {
  const openProject = useDesign((s) => s.openProject);
  const uid = useId();
  const [form, setForm] = useState<Form>(START);
  // The answers the cards were made from: set by "Show suggestions" and "Suggest again"; none until then (ADR-193).
  const [applied, setApplied] = useState<Form | null>(null);
  const [step, setStep] = useState<StepId>('wall');
  const [problems, setProblems] = useState<WallIssue[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const result = useMemo(() => (applied ? suggestMixes(toInput(applied)) : null), [applied]);
  const problemId = (i: number) => `${uid}-problem-${i}`;
  const problem = (k: keyof Form) =>
    problems
      .map((d, i) => (d.field === k ? problemId(i) : ''))
      .filter(Boolean)
      .join(' ') || undefined;
  const go = (s: StepId) => {
    setProblems([]);
    setStep(s);
    document.querySelector('.dialog[open] .dialog-body')?.scrollTo({ top: 0 });
  };
  // A wrong answer keeps the user on the step, named under the fields (ADR-008, ADR-193).
  const suggest = () => {
    const bad = checkWall(toInput(form));
    if (bad.length) {
      setProblems(bad);
      // Suggestions has no fields: the user goes to the step that holds the first problem.
      if (step === 'mixes') setStep(WALL_STEP.includes(bad[0].field) ? 'wall' : 'refine');
      return;
    }
    setApplied(form);
    go('mixes');
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (step === 'mixes') go('refine');
    else suggest();
  };
  const use = async (m: Mix) => {
    try {
      await saveProject(m.project);
      openProject(m.project);
      onClose();
      onOpened();
    } catch {
      setSaveError(t('The project could not be saved in this browser’s storage.'));
    }
  };
  return (
    <form className="wizard wall-fill" onSubmit={submit} noValidate>
      <Steps
        label={t('Fill a wall steps')}
        current={step}
        onSelect={(id) => (id === 'mixes' ? suggest() : go(id as StepId))}
        steps={STEPS.map((s) => ({ ...s, done: s.id === 'wall' && applied !== null }))}
      />
      {step === 'wall' && (
        <section aria-label={t('Wall')}>
          <h3>{t('Wall')}</h3>
          <p className="hint">
            {t(
              'The space to fill, in mm. Pieces taller than the height are still suggested, with a warning.',
            )}
          </p>
          <div className="wf-grid">
            <Field
              label={t('Width')}
              value={form.width}
              onChange={set('width')}
              problem={problem('width')}
            />
            <Field
              label={t('Depth')}
              value={form.depth}
              onChange={set('depth')}
              problem={problem('depth')}
            />
            <Field
              label={t('Height')}
              value={form.height}
              onChange={set('height')}
              problem={problem('height')}
            />
            <Field
              label={t('Tall cabinet depth')}
              value={form.tallDepth}
              onChange={set('tallDepth')}
              placeholder={t('same as depth')}
              problem={problem('tallDepth')}
            />
          </div>
          <Problems list={problems} idOf={problemId} />
        </section>
      )}
      {step === 'refine' && (
        <section aria-label={t('Refine')}>
          <h3>{t('Refine')}</h3>
          <p className="hint">
            {t(
              'Leave a field empty for any. The width range is your choice; shelves wider than the shelf-span guidance get a centre divider.',
            )}
          </p>
          <div className="wf-grid">
            <Field
              label={t('Min piece width')}
              value={form.minWidth}
              onChange={set('minWidth')}
              problem={problem('minWidth')}
            />
            <Field
              label={t('Max piece width')}
              value={form.maxWidth}
              onChange={set('maxWidth')}
              problem={problem('maxWidth')}
            />
            <Field
              label={t('Base height')}
              value={form.baseHeight}
              onChange={set('baseHeight')}
              problem={problem('baseHeight')}
            />
            <Field
              label={t('Number of pieces')}
              value={form.pieces}
              onChange={set('pieces')}
              problem={problem('pieces')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('Tall cabinets')}
              value={form.tallCount}
              onChange={set('tallCount')}
              problem={problem('tallCount')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('At least, open shelf bases')}
              value={form.shelves}
              onChange={set('shelves')}
              problem={problem('shelves')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('At least, drawer bases')}
              value={form.drawers}
              onChange={set('drawers')}
              problem={problem('drawers')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('At least, door bases')}
              value={form.door}
              onChange={set('door')}
              problem={problem('door')}
              unit=""
              placeholder={t('any')}
            />
            <Field
              label={t('Equal fronts')}
              value={form.equalFronts}
              onChange={set('equalFronts')}
              problem={problem('equalFronts')}
              unit=""
              placeholder={t('off')}
              hint={t('Every door the same width; insides left empty to configure later.')}
            />
            <Field
              label={t('Wall cabinet height')}
              value={form.wallHeight}
              onChange={set('wallHeight')}
              problem={problem('wallHeight')}
              hint={t('Wall cabinet tops sit at the wall height.')}
            />
            <Field
              label={t('Tall cabinet height')}
              value={form.tallHeight}
              onChange={set('tallHeight')}
              problem={problem('tallHeight')}
            />
            <Field
              label={t('Wall cabinet depth')}
              value={form.wallDepth}
              onChange={set('wallDepth')}
              problem={problem('wallDepth')}
            />
          </div>
          <Segmented
            label={t('Wall cabinets')}
            value={form.wallRow}
            onChange={(v) => setForm((f) => ({ ...f, wallRow: v }))}
            options={[
              { value: 'any', label: t('Any') },
              { value: 'always', label: t('Always') },
              { value: 'never', label: t('Never') },
            ]}
          />
          <Segmented
            label={t('Tall cabinets stand')}
            value={form.tallPosition}
            onChange={(v) => setForm((f) => ({ ...f, tallPosition: v }))}
            options={[
              { value: 'auto', label: t('Auto') },
              { value: 'left', label: t('Left') },
              { value: 'right', label: t('Right') },
              { value: 'ends', label: t('Both ends') },
              { value: 'centre', label: t('Centre') },
            ]}
          />
          <Problems list={problems} idOf={problemId} />
        </section>
      )}
      {step === 'mixes' && applied && result && (
        <section className="wz-suggest" aria-label={t('Suggested mixes')}>
          <div className="card-title">
            <span>{t('Suggested mixes')}</span>
            <span className="hint">
              {t('{width} mm wall · best {n}, each checked for problems', {
                width: toInput(applied).width,
                n: MIXES_FIRST,
              })}
            </span>
          </div>
          <ResultProblems problems={result.problems} />
          {result.mixes.length > 0 && (
            <ul className="wz-cards wf-cards">
              {result.mixes.map((m) => (
                <MixCard key={m.key} m={m} onUse={() => void use(m)} />
              ))}
            </ul>
          )}
          <SaveError message={saveError} />
        </section>
      )}
      <FillFooter
        backDisabled={step === 'wall'}
        // Back to Suggestions with nothing applied yet makes them from the typed answers (ADR-193).
        onBack={() =>
          step === 'refine' && !applied ? suggest() : go(step === 'refine' ? 'mixes' : 'wall')
        }
        onClose={onClose}
        submit={
          step === 'wall'
            ? t('Show suggestions')
            : step === 'mixes'
              ? t('Refine')
              : t('Suggest again')
        }
      />
    </form>
  );
}
