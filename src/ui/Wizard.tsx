/**
 * New-piece wizard (ADR-044, ADR-045, ADR-046). Renders whatever the step library and the construction-type
 * registry declare: fields by kind, cards from the type's generators. No branch here knows a construction type.
 */
import { useDeferredValue, useId, useMemo, useState } from 'react';
import { cutlist } from '../core/cutlist';
import { snapshotSvg } from '../core/snapshot';
import type { Design, FurnitureModel, Material } from '../core/types';
import {
  REVIEW,
  TYPE,
  check,
  createPiece,
  editedSinceWizard,
  storedAnswers,
  fieldOptions,
  fieldRange,
  nextOpenStep,
  resolve,
  stepsWriting,
  visibleFields,
  visibleSteps,
  type Problem,
} from '../core/wizard/engine';
import { compartmentsOf, contentUses, listOf } from '../core/wizard/steps';
import { CARDS_FIRST, generatorAt, suggestions, type Suggestion } from '../core/wizard/suggest';
import type { Answers, AnswerValue, Compartment, FieldDef } from '../core/wizard/types';
import { saveDesign } from '../persist/db';
import { useDesign } from '../store/designStore';
import { Counter, InfoTip, Segmented, Select, Steps } from './controls';
import { Dialog } from './Dialogs';
import { Icon } from './icons';

const picture = (model: FurnitureModel, materials: Material[], size: number) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshotSvg(model, materials, size))}`;

/** Whole-number input that hands every entry to the wizard, so out-of-range values show as problems instead of vanishing. */
function IntInput({
  label,
  value,
  unit,
  onChange,
  hint,
}: {
  label: string;
  value: AnswerValue | undefined;
  unit?: string;
  onChange: (v: AnswerValue) => void;
  hint?: string;
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
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="mm wz-int">
        <input
          id={id}
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
          }}
        />
        <span className="unit">{unit ?? ''}</span>
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function FieldInput({
  f,
  a,
  r,
  set,
}: {
  f: FieldDef;
  a: Answers;
  r: Answers;
  set: (id: string, v: AnswerValue) => void;
}) {
  const v = r[f.id];
  const opts = fieldOptions(f, a);
  const { min, max } = fieldRange(f, a);
  switch (f.kind) {
    case 'text':
      return (
        <div className="field">
          <label htmlFor={`wz-${f.id}`}>{f.label}</label>
          <input
            id={`wz-${f.id}`}
            value={String(v ?? '')}
            onChange={(e) => set(f.id, e.target.value)}
          />
        </div>
      );
    case 'int':
      return f.unit || max - min > 20 ? (
        <IntInput
          label={`${f.label} (${min}–${max}${f.unit ? ' mm' : ''})`}
          value={v}
          unit={f.unit}
          hint={f.help}
          onChange={(x) => set(f.id, x)}
        />
      ) : (
        <Counter
          label={f.label}
          value={typeof v === 'number' ? v : min}
          min={min}
          max={max}
          onChange={(x) => set(f.id, x)}
        />
      );
    case 'choice':
      if (opts.some((o) => o.help)) {
        return (
          <fieldset className="field wz-options">
            <legend>{f.label}</legend>
            {opts.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`row-btn ${v === o.value ? 'on' : ''}`}
                aria-pressed={v === o.value}
                onClick={() => set(f.id, o.value)}
              >
                <span className="glyph">
                  {v === o.value ? <Icon name="check" /> : <Icon name="box" />}
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
      return opts.length <= 4 ? (
        <>
          <Segmented
            label={f.label}
            value={String(v ?? '')}
            options={opts}
            onChange={(x) => set(f.id, x)}
          />
          {f.help && <p className="hint">{f.help}</p>}
        </>
      ) : (
        <Select
          label={f.label}
          value={String(v ?? '')}
          options={opts}
          onChange={(x) => set(f.id, x)}
        />
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
              Apply compartment 1 to all
            </button>
          )}
          {cs.map((c, i) => (
            <div className="wz-row" key={i}>
              <Select
                label={`${f.label} ${i + 1}`}
                value={c.kind}
                options={opts}
                onChange={(k) => put(i, { ...c, kind: k })}
              />
              {contentUses(c.kind).includes('shelves') && (
                <Counter
                  label="Shelves"
                  value={c.shelves}
                  min={0}
                  max={max}
                  onChange={(n) => put(i, { ...c, shelves: n })}
                />
              )}
              {contentUses(c.kind).includes('drawers') && (
                <Counter
                  label="Drawers"
                  value={c.drawers}
                  min={1}
                  max={10}
                  onChange={(n) => put(i, { ...c, drawers: n })}
                />
              )}
            </div>
          ))}
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
              Apply compartment 1 to all
            </button>
          )}
          {list.map((x, i) => (
            <Segmented
              key={i}
              label={`${f.label} ${i + 1}`}
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
        </div>
      );
    }
    case 'perCompartmentMm': {
      const list = listOf<number>(r, f.id, 0);
      return (
        <div className="wz-list">
          <p className="hint">{f.label}</p>
          <div className="wz-row">
            {list.map((x, i) => (
              <IntInput
                key={i}
                label={`Compartment ${i + 1}`}
                value={x}
                unit="mm"
                onChange={(y) =>
                  set(
                    f.id,
                    list.map((z, j) => (j === i ? (y as number) : z)),
                  )
                }
              />
            ))}
          </div>
        </div>
      );
    }
  }
}

function ProblemList({ problems, limit }: { problems: Problem[]; limit?: number }) {
  const list = [...problems]
    .sort((x, y) => (x.severity === y.severity ? 0 : x.severity === 'error' ? -1 : 1))
    .slice(0, limit);
  if (!list.length)
    return (
      <p className="alert ok">
        <Icon name="check" className="sm" />
        <span>No problems found.</span>
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
        <li className="hint">…and {problems.length - limit} more on Review.</li>
      )}
    </ul>
  );
}

function Card({ s, onUse }: { s: Suggestion; onUse: () => void }) {
  const src = useMemo(() => picture(s.model, s.design.materials, 120), [s]);
  return (
    <li className="wz-card">
      <img src={src} alt="" width={120} height={90} />
      <span className="wz-card-label">
        {s.isDefault && <span className="badge neutral">Default</span>} {s.label}
      </span>
      {s.warnings > 0 && (
        <span className="badge warning" title="Warnings: see Review after using it">
          {s.warnings} {s.warnings === 1 ? 'warning' : 'warnings'}
        </span>
      )}
      <button type="button" className="btn sm primary" onClick={onUse}>
        Use this
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
    <section className="wz-suggest" aria-label="Suggested combinations">
      <div className="card-title">
        <span className="info-row">
          <span>Suggested combinations</span>
          <InfoTip label="About suggested combinations" align="start">
            Fit the sizes entered so far, checked by the model.
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
          No combination fits these sizes without errors; set the answers by hand.
        </p>
      )}
      <div className="split-actions">
        {list.length > shown && (
          <button type="button" className="btn sm" onClick={() => setShown(shown + CARDS_FIRST)}>
            Show more ({list.length - shown})
          </button>
        )}
        <button type="button" className="btn sm outline" onClick={onBlank}>
          Start blank
        </button>
      </div>
    </section>
  );
}

/** `from`: a piece made in the wizard, reopened with its stored answers; "Update piece" replaces it in place (ADR-046). */
export function WizardDialog({
  open,
  onClose,
  onCreated,
  from,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  from?: Design | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={from ? `Wizard: ${from.name}` : 'New piece'} wide>
      {open && <Wizard key={from?.id ?? 'new'} onCreated={onCreated} from={from ?? null} />}
    </Dialog>
  );
}

function Wizard({ onCreated, from }: { onCreated: () => void; from: Design | null }) {
  const load = useDesign((s) => s.load);
  const [a, setA] = useState<Answers>(() => (from && storedAnswers(from)) || {});
  const [stepId, setStepId] = useState<string>(TYPE);
  const [done, setDone] = useState<Set<string>>(
    () => new Set(from ? visibleSteps(storedAnswers(from) ?? {}).map((s) => s.id) : []),
  );
  const [edited] = useState(() => !!from && editedSinceWizard(from));
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
  const set = (id: string, v: AnswerValue) => setA((prev) => ({ ...prev, [id]: v }));
  const go = (id: string) => {
    setStepId(id);
    document.querySelector('.dialog[open] .dialog-body')?.scrollTo({ top: 0 });
  };
  const markDone = (ids: string[]) => setDone((prev) => new Set([...prev, ...ids]));
  /** Next keeps the answers; Skip puts this step back to the type's defaults (the first type, on the type step). */
  const next = (keep: boolean) => {
    let b = a;
    if (!keep && step.id === TYPE)
      b = a.type ? a : { ...a, type: fieldOptions(step.fields[0], a)[0]?.value };
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
    try {
      await saveDesign(res.design);
      load(res.design);
      onCreated();
    } catch {
      setSaveError('The piece could not be saved in this browser’s storage.');
    }
  };
  const isReview = step.id === REVIEW;
  const rows = isReview && c.model && c.design ? cutlist(c.model, c.design.materials) : [];
  const hasCards = !!generatorAt(a, step.id);
  return (
    <div className="wizard">
      <Steps
        label="Wizard steps"
        current={step.id}
        onSelect={go}
        steps={steps.map((s) => ({
          id: s.id,
          label: s.title,
          done: done.has(s.id),
          tone: c.problems.some((p) => p.step === s.id && p.severity === 'error')
            ? 'error'
            : undefined,
        }))}
      />
      <div className="wz-body">
        <div className="wz-main">
          {/* On the first step, wherever the wizard opens (Type since G-059), so a reopen always warns first. */}
          {from && step.id === steps[0]?.id && (
            <p className={`alert ${edited ? 'warning' : 'info'}`} role="status">
              <Icon name={edited ? 'alert-triangle' : 'info'} className="sm" />
              <span>
                Reopened with the answers it was made from. “Update piece” replaces “{from.name}” in
                place.
                {edited
                  ? ' It was changed in the editor since; those changes will be replaced.'
                  : ''}
              </span>
            </p>
          )}
          {step.help ? (
            <div className="info-row">
              <h3>{step.title}</h3>
              <InfoTip label="About this step" align="start">
                {step.help}
              </InfoTip>
            </div>
          ) : (
            <h3>{step.title}</h3>
          )}
          {fields.map((f) => (
            <FieldInput key={f.id} f={f} a={a} r={r} set={set} />
          ))}
          {stepProblems.length > 0 && <ProblemList problems={stepProblems} />}
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
              <section aria-label="Parts">
                <div className="card-title">
                  <span>Parts</span>
                  <span className="hint">from the built model</span>
                </div>
                <p className="num">
                  {c.model?.panels.length ?? 0} parts · {rows.length} different cut sizes ·{' '}
                  {rows.reduce((n, x) => n + x.quantity, 0)} pieces to cut
                </p>
                <ul className="wz-parts">
                  {rows.slice(0, 12).map((x, k) => (
                    <li key={k} className="num">
                      {x.quantity} × {x.labels[0]} — {x.length} × {x.width} × {x.thickness} mm{' '}
                      {x.materialName}
                    </li>
                  ))}
                </ul>
                {rows.length > 12 && (
                  <p className="hint">
                    …and {rows.length - 12} more in the parts list after creating.
                  </p>
                )}
              </section>
              <section aria-label="Problems">
                <div className="card-title">
                  <span>Checks</span>
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
        <aside className="wz-preview" aria-label="Preview">
          {c.model && c.design && c.model.panels.length > 0 ? (
            <img
              src={picture(c.model, c.design.materials, 260)}
              alt={`Preview of ${c.design.name}`}
            />
          ) : (
            <p className="hint">Choose a type to see the piece.</p>
          )}
          {c.model && (
            <p className="num">
              {c.model.bounds.w} × {c.model.bounds.h} × {c.model.bounds.d} mm ·{' '}
              {c.model.panels.length} parts
            </p>
          )}
          {!isReview && c.design && <ProblemList problems={c.problems} limit={3} />}
        </aside>
      </div>
      <div className="wizard-footer">
        <button
          type="button"
          className="btn"
          disabled={i === 0}
          onClick={() => go(steps[i - 1].id)}
        >
          Back
        </button>
        {/* No Cancel (ADR-116): the dialog's × closes the wizard. */}
        <span className="wz-spacer" />
        {!isReview && (
          <button
            type="button"
            className="btn outline"
            title={
              step.id === TYPE
                ? 'Skip: use the first type'
                : 'Skip: put this step back to its defaults'
            }
            onClick={() => next(false)}
          >
            Skip
          </button>
        )}
        {!isReview && (
          <button
            type="button"
            className="btn primary"
            disabled={step.id === TYPE && !a.type}
            onClick={() => next(true)}
          >
            Next
          </button>
        )}
        {isReview && (
          <button
            type="button"
            className="btn primary"
            disabled={!c.design || c.errors > 0}
            title={c.errors ? 'Fix the problems listed under Checks first' : undefined}
            onClick={() => void create()}
          >
            <Icon name="plus" className="sm" />
            {from ? 'Update piece' : 'Create piece'}
          </button>
        )}
      </div>
    </div>
  );
}
