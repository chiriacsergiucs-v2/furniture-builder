/**
 * New-piece wizard (ADR-044, ADR-045, ADR-046). Renders whatever the step library and the construction-type
 * registry declare: fields by kind, cards from the type's generators. No branch here knows a construction type.
 */
import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { boardChoices } from '../core/boards';
import { roleBoard } from '../core/finish';
import type { Decor } from '../core/materials';
import { cutlist } from '../core/cutlist';
import { snapshotSvg } from '../core/snapshot';
import type { Design, FurnitureModel, Material } from '../core/types';
import {
  REVIEW,
  TYPE,
  check,
  createPiece,
  editedSinceWizard,
  reopenAnswers,
  fieldOptions,
  fieldRange,
  nextOpenStep,
  resolve,
  stepsWriting,
  typeOf,
  visibleFields,
  visibleSteps,
  withType,
  type Problem,
} from '../core/wizard/engine';
import {
  boardsVersion,
  compartmentsOf,
  contentText,
  contentUses,
  listOf,
  setWizardBoards,
} from '../core/wizard/steps';
import { CARDS_FIRST, generatorAt, suggestions, type Suggestion } from '../core/wizard/suggest';
import type { Answers, AnswerValue, Compartment, FieldDef } from '../core/wizard/types';
import { t, tr } from '../core/i18n';
import { listDecors, saveDesign } from '../store/libraryStore';
import { useDesign } from '../store/designStore';
import { askConfirm } from './Confirm';
import { Counter, InfoTip, Segmented, Select, Steps } from './controls';
import { Dialog } from './Dialogs';
import { Icon } from './icons';
import { useUi, type WizardDraft } from '../store/uiStore';

const picture = (model: FurnitureModel, materials: Material[], size: number) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshotSvg(model, materials, size))}`;

/**
 * Whole-number input that hands every entry to the wizard, so out-of-range values show as problems instead of
 * vanishing. `error`: the step's problem for this field, shown under the box (ADR-194); `errorId`: the field is invalid
 * and its problem is shown elsewhere under that id (one message for a list of boxes).
 */
function IntInput({
  label,
  value,
  unit,
  onChange,
  hint,
  error,
  errorId,
}: {
  label: string;
  value: AnswerValue | undefined;
  unit?: string;
  onChange: (v: AnswerValue) => void;
  hint?: string;
  error?: string;
  errorId?: string;
}) {
  const [text, setText] = useState(String(value ?? ''));
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(String(value ?? ''));
  }
  const commit = () => {
    const n = Number(text);
    onChange(text.trim() !== '' && Number.isFinite(n) ? n : text);
  };
  const id = useId();
  const described = error ? `${id}-err` : errorId;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`mm wz-int ${described ? 'invalid' : ''}`}>
        <input
          id={id}
          inputMode="numeric"
          value={text}
          aria-invalid={described ? true : undefined}
          aria-describedby={described}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
        />
        <span className="unit">{unit ?? ''}</span>
      </div>
      {error && (
        <p className="field-error" id={`${id}-err`}>
          {error}
        </p>
      )}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

/** A field's problems under it (ADR-194); `quiet`: the untouched Type step only hints (ADR-191). */
function FieldProblems({
  ids,
  messages,
  quiet,
}: {
  ids: string[];
  messages: string[];
  quiet?: boolean;
}) {
  return (
    <>
      {messages.map((m, k) => (
        <p key={k} className={quiet ? 'hint' : 'field-error'} id={ids[k]}>
          {m}
        </p>
      ))}
    </>
  );
}

/** One choice of several as radios (ADR-191), with a roving tabindex: one tab stop, arrow keys move between them (ADR-194). */
function RadioOptions({
  label,
  value,
  options,
  onChange,
  errorId,
}: {
  label: string;
  value: AnswerValue | undefined;
  options: { value: string; label: string; help?: string }[];
  onChange: (v: string) => void;
  errorId?: string;
}) {
  const checked = options.findIndex((o) => o.value === value);
  // The tab stop: the radio the arrow keys moved to, else the chosen one (else the first).
  const [moved, setMoved] = useState<number | null>(null);
  const active = moved !== null && moved < options.length ? moved : Math.max(0, checked);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // Arrow keys move the focus only; Space or Enter chooses (choosing a type resets later answers, ADR-191).
  const move = (e: KeyboardEvent, k: number) => {
    const n = options.length;
    const to =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? (k + 1) % n
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? (k - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    setMoved(to);
    refs.current[to]?.focus();
  };
  return (
    <fieldset
      className="field wz-options"
      role="radiogroup"
      aria-label={label}
      aria-invalid={errorId ? true : undefined}
      aria-describedby={errorId}
    >
      <legend>{label}</legend>
      {options.map((o, k) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[k] = el;
          }}
          type="button"
          role="radio"
          className={`row-btn ${value === o.value ? 'on' : ''}`}
          aria-checked={value === o.value}
          tabIndex={k === active ? 0 : -1}
          onFocus={() => setMoved(k)}
          onKeyDown={(e) => move(e, k)}
          onClick={() => {
            setMoved(null);
            onChange(o.value);
          }}
        >
          <span className="glyph">
            {value === o.value ? <Icon name="check" /> : <Icon name="box" />}
          </span>
          <span>
            <strong>{o.label}</strong>
            <span className="sub">{o.help}</span>
          </span>
          <span />
        </button>
      ))}
    </fieldset>
  );
}

/**
 * One field by kind. `problems`: the step's problems whose `field` is this field, shown under it once (ADR-194);
 * `quiet`: they only hint (the untouched Type step, ADR-191).
 */
function FieldInput({
  f,
  a,
  r,
  set,
  problems,
  quiet,
}: {
  f: FieldDef;
  a: Answers;
  r: Answers;
  set: (id: string, v: AnswerValue) => void;
  problems: string[];
  quiet?: boolean;
}) {
  const errIds = problems.map((_, k) => `wz-${f.id}-err${k ? `-${k}` : ''}`);
  const invalid = problems.length > 0 && !quiet ? errIds.join(' ') : undefined;
  const under = <FieldProblems ids={errIds} messages={problems} quiet={quiet} />;
  const v = r[f.id];
  const opts = fieldOptions(f, a).map((o) => ({
    ...o,
    label: tr(o.label),
    help: o.help && tr(o.help),
  }));
  const label = tr(f.label);
  const help = f.help && tr(f.help);
  const { min, max } = fieldRange(f, a);
  switch (f.kind) {
    case 'text':
      return (
        <div className="field">
          <label htmlFor={`wz-${f.id}`}>{label}</label>
          <input
            id={`wz-${f.id}`}
            value={String(v ?? '')}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid}
            onChange={(e) => set(f.id, e.target.value)}
          />
          {under}
        </div>
      );
    case 'int':
      return f.unit || max - min > 20 ? (
        <IntInput
          label={
            f.unit
              ? t('{label} ({min}–{max} mm)', { label, min, max })
              : t('{label} ({min}–{max})', { label, min, max })
          }
          value={v}
          unit={f.unit && t('mm')}
          hint={help}
          error={problems.length ? problems.join(' ') : undefined}
          onChange={(x) => set(f.id, x)}
        />
      ) : (
        <>
          <Counter
            label={label}
            value={typeof v === 'number' ? v : min}
            min={min}
            max={max}
            onChange={(x) => set(f.id, x)}
          />
          {under}
        </>
      );
    case 'choice':
      if (opts.some((o) => o.help))
        return (
          <>
            <RadioOptions
              label={label}
              value={v}
              options={opts}
              errorId={invalid}
              onChange={(x) => set(f.id, x)}
            />
            {under}
          </>
        );
      // Up to five options are a segmented control; five wrap to a second row on a phone (ADR-202).
      return opts.length <= 5 ? (
        <>
          <Segmented
            label={label}
            value={String(v ?? '')}
            options={opts}
            onChange={(x) => set(f.id, x)}
            wrap={opts.length === 5}
          />
          {help && <p className="hint">{help}</p>}
          {under}
        </>
      ) : (
        <>
          <Select
            label={label}
            value={String(v ?? '')}
            options={opts}
            onChange={(x) => set(f.id, x)}
          />
          {under}
        </>
      );
    case 'compartments': {
      const cs = compartmentsOf(r);
      const put = (i: number, c: Compartment) =>
        set(
          f.id,
          cs.map((x, j) => (j === i ? c : x)),
        );
      return (
        <div className="wz-list">
          {cs.length > 1 && (
            <button
              type="button"
              className="btn sm"
              onClick={() =>
                set(
                  f.id,
                  cs.map(() => ({ ...cs[0] })),
                )
              }
            >
              <Icon name="copy" className="sm" />
              {t('Apply compartment 1 to all')}
            </button>
          )}
          {cs.map((c, i) => (
            <div className="wz-row" key={i}>
              <Select
                label={`${label} ${i + 1}`}
                value={c.kind}
                options={opts}
                onChange={(k) => put(i, { ...c, kind: k })}
              />
              {contentUses(c.kind).includes('shelves') && (
                <Counter
                  label={t('Shelves')}
                  name={t('Shelves in compartment {n}', { n: i + 1 })}
                  value={c.shelves}
                  min={1}
                  max={max}
                  onChange={(n) => put(i, { ...c, shelves: n })}
                />
              )}
              {contentUses(c.kind).includes('drawers') && (
                <Counter
                  label={t('Drawers')}
                  name={t('Drawers in compartment {n}', { n: i + 1 })}
                  value={c.drawers}
                  min={1}
                  max={10}
                  onChange={(n) => put(i, { ...c, drawers: n })}
                />
              )}
            </div>
          ))}
          {under}
        </div>
      );
    }
    case 'perCompartment': {
      const list = listOf<string>(r, f.id, opts[0]?.value ?? '');
      return (
        <div className="wz-list">
          {list.length > 1 && (
            <button
              type="button"
              className="btn sm"
              onClick={() =>
                set(
                  f.id,
                  list.map(() => list[0]),
                )
              }
            >
              <Icon name="copy" className="sm" />
              {t('Apply compartment 1 to all')}
            </button>
          )}
          {list.map((x, i) => (
            <Segmented
              key={i}
              label={`${label} ${i + 1}`}
              value={x}
              options={opts}
              onChange={(y) =>
                set(
                  f.id,
                  list.map((z, j) => (j === i ? y : z)),
                )
              }
            />
          ))}
          {under}
        </div>
      );
    }
    case 'perCompartmentMm': {
      const list = listOf<number>(r, f.id, 0);
      return (
        <div className="wz-list">
          <p className="hint">{label}</p>
          <div className="wz-row">
            {list.map((x, i) => (
              <IntInput
                key={i}
                label={t('Compartment {n}', { n: i + 1 })}
                value={x}
                unit={t('mm')}
                errorId={invalid}
                onChange={(y) =>
                  set(
                    f.id,
                    list.map((z, j) => (j === i ? (y as number) : z)),
                  )
                }
              />
            ))}
          </div>
          {under}
        </div>
      );
    }
  }
}

/** The side picture, drawn once per built model, not once per keystroke (ADR-191). */
function PreviewPicture({
  model,
  materials,
  name,
}: {
  model: FurnitureModel;
  materials: Material[];
  name: string;
}) {
  const src = useMemo(() => picture(model, materials, 260), [model, materials]);
  return <img src={src} alt={t('Preview of {name}', { name })} />;
}

function ProblemList({ problems, limit }: { problems: Problem[]; limit?: number }) {
  const list = [...problems]
    .sort((x, y) => (x.severity === y.severity ? 0 : x.severity === 'error' ? -1 : 1))
    .slice(0, limit);
  if (!list.length)
    return (
      <p className="alert ok">
        <Icon name="check" className="sm" />
        <span>{t('No problems found.')}</span>
      </p>
    );
  return (
    <ul className="wz-problems">
      {list.map((p, i) => (
        <li key={i} className={`alert ${p.severity}`}>
          <Icon name={p.severity === 'error' ? 'alert-circle' : 'alert-triangle'} className="sm" />
          <span>{p.message}</span>
        </li>
      ))}
      {limit !== undefined && problems.length > limit && (
        <li className="hint">{t('…and {n} more on Review.', { n: problems.length - limit })}</li>
      )}
    </ul>
  );
}

function Card({ s, onUse }: { s: Suggestion; onUse: () => void }) {
  const src = useMemo(() => picture(s.model, s.design.materials, 120), [s]);
  return (
    <li className="wz-card wz-pick">
      <img src={src} alt="" width={120} height={90} />
      <span className="wz-card-label">
        {s.isDefault && <span className="badge neutral">{t('Default')}</span>} {s.label}
      </span>
      {/* The warnings listed as on wall-fill cards (ADR-103, ADR-194); the button stays at the card's foot. */}
      {s.warnings > 0 && (
        <>
          <span className="badge warning">{t('{n|# warning|# warnings}', { n: s.warnings })}</span>
          <ul className="wf-warnings">
            {s.notes.slice(0, 3).map((m, i) => (
              <li key={i} className="alert warning">
                <Icon name="alert-triangle" className="sm" />
                <span>{m}</span>
              </li>
            ))}
            {s.notes.length > 3 && (
              <li className="hint">{t('…and {n} more on Review.', { n: s.notes.length - 3 })}</li>
            )}
          </ul>
        </>
      )}
      <button
        type="button"
        className="btn sm primary"
        aria-label={t('Use this: {label}', { label: s.label })}
        onClick={onUse}
      >
        {t('Use this')}
      </button>
    </li>
  );
}

function Suggestions({
  a,
  stepId,
  onUse,
  onBlank,
}: {
  a: Answers;
  stepId: string;
  onUse: (s: Suggestion) => void;
  onBlank: () => void;
}) {
  const [shown, setShown] = useState(CARDS_FIRST);
  const deferred = useDeferredValue(a);
  const list = useMemo(() => suggestions(deferred, stepId), [deferred, stepId]);
  return (
    <section className="wz-suggest" aria-label={t('Suggested combinations')}>
      <div className="card-title">
        <span className="info-row">
          <span>{t('Suggested combinations')}</span>
          <InfoTip label={t('About suggested combinations')} align="start">
            {t('Fit the sizes entered so far, checked by the model.')}
          </InfoTip>
        </span>
      </div>
      {list.length ? (
        <ul className="wz-cards">
          {list.slice(0, shown).map((s) => (
            <Card key={s.key} s={s} onUse={() => onUse(s)} />
          ))}
        </ul>
      ) : (
        <p className="hint">
          {t('No combination fits these sizes without errors; set the answers by hand.')}
        </p>
      )}
      <div className="split-actions">
        {list.length > shown && (
          <button type="button" className="btn sm" onClick={() => setShown(shown + CARDS_FIRST)}>
            {t('Show more ({n})', { n: list.length - shown })}
          </button>
        )}
        <button type="button" className="btn sm outline" onClick={onBlank}>
          {t('Continue by hand')}
        </button>
      </div>
    </section>
  );
}

/**
 * `from`: a piece made in the wizard, reopened with its stored answers; "Update piece" replaces it in place (ADR-046).
 * `toProject`: started from a project's Add a piece; "Add to project" saves the piece and adds it to the open project,
 * which stays open (ADR-107).
 */
export function WizardDialog({
  open,
  onClose,
  onCreated,
  from,
  toProject,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  from?: Design | null;
  toProject?: boolean;
}) {
  // True while the answers differ from a fresh wizard's; × and Esc then ask first (ADR-191). Backdrop clicks never close.
  const dirtyRef = useRef(false);
  // A new piece's answers, step and finished steps, kept as the session's draft when it closes (ADR-211, G-356).
  const draftRef = useRef<WizardDraft | null>(null);
  const close = async () => {
    if (open && dirtyRef.current) {
      if (from) {
        // A reopened piece keeps its own answers: closing it still discards the changes (ADR-191).
        if (
          !(await askConfirm(t('Discard the answers?'), {
            confirmLabel: t('Discard'),
            danger: true,
          }))
        )
          return;
      } else {
        if (
          !(await askConfirm(
            t('Close the wizard? Your answers stay as a draft until you close the app.'),
            { confirmLabel: t('Close') },
          ))
        )
          return;
        if (draftRef.current) useUi.getState().setWizardDraft(draftRef.current);
      }
    }
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={() => void close()}
      title={from ? t('Wizard: {name}', { name: from.name }) : t('New piece')}
      wide
      backdropClose={false}
    >
      {open && (
        <Wizard
          key={from?.id ?? 'new'}
          onCreated={onCreated}
          from={from ?? null}
          toProject={!!toProject && !from}
          dirtyRef={dirtyRef}
          draftRef={draftRef}
        />
      )}
    </Dialog>
  );
}

/** One field's answer as text, for the Review list (ADR-191). */
function valueText(f: FieldDef, a: Answers, r: Answers): string {
  const v = r[f.id];
  const opts = fieldOptions(f, a);
  const optLabel = (x: unknown) => tr(opts.find((o) => o.value === x)?.label ?? String(x ?? ''));
  switch (f.kind) {
    case 'text':
      return String(v ?? '');
    case 'int':
      return f.unit ? `${String(v ?? '')} ${t('mm')}` : String(v ?? '');
    case 'choice':
      return optLabel(v);
    case 'compartments':
      return compartmentsOf(r).map(contentText).join(' | ');
    case 'perCompartment':
      return listOf<string>(r, f.id, opts[0]?.value ?? '')
        .map(optLabel)
        .join(' | ');
    case 'perCompartmentMm':
      return listOf<number>(r, f.id, 0)
        .map((n) => `${n} ${t('mm')}`)
        .join(' | ');
  }
}

function Wizard({
  onCreated,
  from,
  toProject,
  dirtyRef,
  draftRef,
}: {
  onCreated: () => void;
  from: Design | null;
  toProject: boolean;
  dirtyRef: { current: boolean };
  draftRef: { current: WizardDraft | null };
}) {
  const load = useDesign((s) => s.load);
  const addPiece = useDesign((s) => s.addPiece);
  // The Board choice offers the project's boards, then the decor list; it starts on the project's carcass board (ADR-164).
  const project = useDesign((s) => s.project);
  const [decors, setDecors] = useState<Decor[]>([]);
  useEffect(() => {
    listDecors()
      .then(setDecors)
      .catch(() => setDecors([]));
  }, []);
  // A reopened piece also offers its own board, so its board never waits for the decor list (ADR-194).
  useMemo(() => {
    const first = project?.items[0]?.design;
    const carcass = first?.materials.find((m) => m.id === roleBoard(first, 'body'));
    setWizardBoards(
      project || decors.length ? boardChoices(project, null, decors) : null,
      project?.settings?.body ?? carcass,
      from,
    );
    return boardsVersion();
  }, [project, from, decors]);
  // After the boards are set: a stored decor board is answered by the piece's own board (ADR-194).
  const [reopened] = useState<Answers | null>(() => from && reopenAnswers(from));
  const [a, setA] = useState<Answers>(() => reopened ?? {});
  const [stepId, setStepId] = useState<string>(TYPE);
  const [done, setDone] = useState<Set<string>>(
    () => new Set(reopened ? visibleSteps(reopened).map((s) => s.id) : []),
  );
  // On every render, after the boards are set: the check behind it is memoised by boardsVersion() (ADR-194).
  const edited = !!from && editedSinceWizard(from, reopened);
  const heading = useRef<HTMLHeadingElement>(null);
  const [moved, setMoved] = useState(0);
  // A step change moves the focus to the new step's heading, which announces it (ADR-194).
  useEffect(() => {
    if (moved) heading.current?.focus({ preventScroll: true });
  }, [moved]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const r = resolve(a);
  const steps = visibleSteps(a);
  const i = Math.max(
    0,
    steps.findIndex((s) => s.id === stepId),
  );
  const step = steps[i];
  const fields = visibleFields(step, a);
  const c = check(a);
  const stepProblems = c.problems.filter((p) => p.step === step.id);
  // Problems not shown under a field of this step (never hidden, ADR-008).
  const otherProblems = stepProblems.filter(
    (p) => !p.field || !fields.some((f) => f.id === p.field),
  );
  const hasError = (id: string) => c.problems.some((p) => p.step === id && p.severity === 'error');
  // An untouched Type step only hints at the choice; it is an error once the user has left the step (ADR-191).
  const typeUntouched = step.id === TYPE && !done.has(TYPE);
  const root = useRef<HTMLDivElement>(null);
  const dirtyNow = JSON.stringify(resolve(a)) !== JSON.stringify(resolve({}));
  useEffect(() => {
    dirtyRef.current = dirtyNow;
    return () => {
      dirtyRef.current = false;
    };
  }, [dirtyRef, dirtyNow]);
  // The session's draft of a new piece (ADR-211): offered on the Type step until continued or started over.
  const draft = useUi((s) => s.wizardDraft);
  const setDraft = useUi((s) => s.setWizardDraft);
  const [offerDraft, setOfferDraft] = useState(() => !from && !!draft);
  useEffect(() => {
    draftRef.current = from ? null : { answers: a, stepId, done: [...done] };
  }, [draftRef, from, a, stepId, done]);
  const continueDraft = () => {
    if (!draft) return;
    setA(draft.answers);
    setDone(new Set(draft.done));
    setOfferDraft(false);
    go(draft.stepId);
  };
  const startOver = () => {
    setDraft(null);
    setOfferDraft(false);
  };
  /** A new type keeps only the Size answers it can use (ADR-191); the steps start over. */
  const set = (id: string, v: AnswerValue) => {
    if (id === 'type') {
      setA((prev) => withType(prev, String(v)));
      setDone(new Set());
    } else setA((prev) => ({ ...prev, [id]: v }));
  };
  const go = (id: string) => {
    setStepId(id);
    setMoved((n) => n + 1);
    root.current?.closest('.dialog-body')?.scrollTo({ top: 0 });
  };
  const markDone = (ids: string[]) => setDone((prev) => new Set([...prev, ...ids]));
  /**
   * Next keeps the answers; Use defaults puts this step back to the type's defaults (the first type, on the type step,
   * where it shows only while no type is chosen, ADR-194).
   */
  const next = (keep: boolean) => {
    let b = a;
    if (!keep && step.id === TYPE) b = withType(a, fieldOptions(step.fields[0], a)[0]?.value ?? '');
    else if (!keep)
      b = Object.fromEntries(
        Object.entries(a).filter(([k]) => !step.fields.some((f) => f.id === k)),
      );
    setA(b);
    markDone([step.id]);
    const after = visibleSteps(b);
    go(after[Math.min(after.findIndex((s) => s.id === step.id) + 1, after.length - 1)].id);
  };
  const use = (s: Suggestion) => {
    const gen = generatorAt(a, step.id);
    const covered = stepsWriting(s.answers, gen ? gen.axes.flatMap((ax) => ax.writes) : []);
    const nowDone = new Set([...done, step.id, ...covered]);
    setA(s.answers);
    setDone(nowDone);
    go(nextOpenStep(s.answers, step.id, nowDone));
  };
  const create = async () => {
    const res = createPiece(a, new Date().toISOString(), from ?? undefined);
    if (!res.ok) return;
    // A project piece reopened from its Settings (ADR-203, G-359): Update piece replaces that piece in the project's own
    // copy as one edit, never the library; a size lock or a locked piece on it refuses it.
    const st = useDesign.getState();
    if (from && st.project && st.editingItemId) {
      const refused = st.replaceDesign(res.design);
      if (refused) setSaveError(refused);
      else onCreated();
      return;
    }
    try {
      await saveDesign(res.design);
      if (toProject) addPiece(res.design, res.design.id);
      else load(res.design);
      // The piece is made: the session's draft is done with (ADR-211).
      if (!from) setDraft(null);
      onCreated();
    } catch {
      setSaveError(t('The piece could not be saved in this browser’s storage.'));
    }
  };
  const isReview = step.id === REVIEW;
  const rows = isReview && c.model && c.design ? cutlist(c.model, c.design.materials) : [];
  const hasCards = !!generatorAt(a, step.id);
  const firstType = fieldOptions(steps[0].fields[0], a)[0];
  return (
    <div className="wizard" ref={root}>
      <Steps
        label={t('Wizard steps')}
        current={step.id}
        onSelect={go}
        steps={steps.map((s) => ({
          id: s.id,
          label: tr(s.title),
          // A step with an error is not done, whatever was pressed (ADR-191).
          done: done.has(s.id) && !hasError(s.id),
          tone: hasError(s.id) && !(s.id === TYPE && !done.has(TYPE)) ? 'error' : undefined,
        }))}
      />
      <div className="wz-body">
        <div className="wz-main">
          {/* On the first step, wherever the wizard opens (Type since G-059), so a reopen always warns first. */}
          {from && step.id === steps[0]?.id && (
            <p className={`alert ${edited ? 'warning' : 'info'}`} role="status">
              <Icon name={edited ? 'alert-triangle' : 'info'} className="sm" />
              <span>
                {t(
                  'Reopened with the answers it was made from. “Update piece” replaces “{name}” in place.',
                  { name: from.name },
                )}
                {edited
                  ? t(' It was changed in the editor since; those changes will be replaced.')
                  : ''}
              </span>
            </p>
          )}
          {offerDraft && draft && step.id === TYPE && (
            <div className="alert info wz-draft" role="status">
              <Icon name="info" className="sm" />
              <span className="wz-draft-actions">
                <button type="button" className="btn sm primary" onClick={continueDraft}>
                  {t('Continue where you left off')}
                </button>
                <button type="button" className="btn sm" onClick={startOver}>
                  {t('Start over')}
                </button>
              </span>
            </div>
          )}
          {step.help ? (
            <div className="info-row">
              <h3 ref={heading} tabIndex={-1}>
                {tr(step.title)}
              </h3>
              <InfoTip label={t('About this step')} align="start">
                {tr(step.help)}
              </InfoTip>
            </div>
          ) : (
            <h3 ref={heading} tabIndex={-1}>
              {tr(step.title)}
            </h3>
          )}
          {/* A field's problems sit under the field; the list keeps only the step's other problems (ADR-194). */}
          {fields.map((f) => (
            <FieldInput
              key={f.id}
              f={f}
              a={a}
              r={r}
              set={set}
              problems={stepProblems.filter((p) => p.field === f.id).map((p) => p.message)}
              quiet={typeUntouched}
            />
          ))}
          {otherProblems.length > 0 && <ProblemList problems={otherProblems} />}
          {hasCards && (
            <Suggestions
              key={`${step.id}`}
              a={a}
              stepId={step.id}
              onUse={use}
              onBlank={() => next(true)}
            />
          )}
          {isReview && (
            <>
              <section aria-label={t('Answers')}>
                <div className="card-title">
                  <span>{t('Answers')}</span>
                </div>
                <ul className="wz-answers">
                  {steps
                    .filter((s) => s.id !== REVIEW)
                    .map((s) => (
                      <li key={s.id}>
                        <strong>{tr(s.title)}</strong>
                        <span>
                          {s.id === TYPE
                            ? tr(typeOf(a)?.label ?? '')
                            : visibleFields(s, a)
                                .map(
                                  (f) => `${tr(f.reviewLabel ?? f.label)}: ${valueText(f, a, r)}`,
                                )
                                .join(' · ')}
                        </span>
                        <button
                          type="button"
                          className="btn sm"
                          aria-label={t('Edit {step}', { step: tr(s.title) })}
                          onClick={() => go(s.id)}
                        >
                          {t('Edit')}
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
              <section aria-label={t('Parts')}>
                <div className="card-title">
                  <span>{t('Parts')}</span>
                  <span className="hint">{t('from the built model')}</span>
                </div>
                <p className="num">
                  {t('{parts} parts · {sizes} different cut sizes · {pieces} pieces to cut', {
                    parts: c.model?.panels.length ?? 0,
                    sizes: rows.length,
                    pieces: rows.reduce((n, x) => n + x.quantity, 0),
                  })}
                </p>
                <ul className="wz-parts">
                  {rows.slice(0, 12).map((x, k) => (
                    <li key={k} className="num">
                      {x.quantity} × {tr(x.labels[0])} — {x.length} × {x.width} × {x.thickness}{' '}
                      {t('mm')} {tr(x.materialName)}
                    </li>
                  ))}
                </ul>
                {rows.length > 12 && (
                  <p className="hint">
                    {t('…and {n} more in the parts list after creating.', { n: rows.length - 12 })}
                  </p>
                )}
              </section>
              <section aria-label={t('Problems')}>
                <div className="card-title">
                  <span>{t('Checks')}</span>
                </div>
                <ProblemList problems={c.problems} />
              </section>
              {saveError && (
                <p className="alert error" role="alert">
                  <Icon name="alert-circle" className="sm" />
                  <span>{saveError}</span>
                </p>
              )}
            </>
          )}
        </div>
        <aside className="wz-preview" aria-label={t('Preview')}>
          {c.model && c.design && c.model.panels.length > 0 ? (
            <PreviewPicture model={c.model} materials={c.design.materials} name={c.design.name} />
          ) : (
            <p className="hint">
              {a.type ? t('Fix the marked fields.') : t('Choose a type to see the piece.')}
            </p>
          )}
          {c.model && (
            <p className="num">
              {c.model.bounds.w} × {c.model.bounds.h} × {c.model.bounds.d} {t('mm')} ·{' '}
              {t('{n} parts', { n: c.model.panels.length })}
            </p>
          )}
          {/* Problems of this step already sit under its fields; the panel shows the others (ADR-191). */}
          {!isReview && c.design && (
            <ProblemList problems={c.problems.filter((p) => p.step !== step.id)} limit={3} />
          )}
        </aside>
      </div>
      <div className="wizard-footer wz-footer">
        <button
          type="button"
          className="btn"
          disabled={i === 0}
          onClick={() => go(steps[i - 1].id)}
        >
          {t('Back')}
        </button>
        {/* No Cancel (ADR-118): the dialog's × closes the wizard. */}
        <span className="wz-spacer" />
        {/* On the Type step only while no type is chosen: it would keep the chosen one (ADR-194). */}
        {!isReview && !(step.id === TYPE && a.type) && (
          <button type="button" className="btn outline wz-defaults" onClick={() => next(false)}>
            {step.id === TYPE
              ? t('Use {label}', { label: tr(firstType?.label ?? '') })
              : t('Use defaults')}
          </button>
        )}
        {!isReview && (
          <button
            type="button"
            className="btn primary"
            disabled={step.id === TYPE && !a.type}
            onClick={() => next(true)}
          >
            {t('Next')}
          </button>
        )}
        {isReview && (
          <button
            type="button"
            className="btn primary"
            disabled={!c.design || c.errors > 0}
            title={c.errors ? t('Fix the problems listed under Checks first') : undefined}
            onClick={() => void create()}
          >
            <Icon name="plus" className="sm" />
            {from ? t('Update piece') : toProject ? t('Add to project') : t('Create piece')}
          </button>
        )}
      </div>
    </div>
  );
}
