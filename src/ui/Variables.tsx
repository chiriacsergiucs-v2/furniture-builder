import { useState } from 'react';
import { t, tr } from '../core/i18n';
import type { Project, ProjectItem } from '../core/project';
import { projectFromSet, setComplete, setProgress, type VariableSet } from '../core/sets';
import {
  bindingOf,
  evaluateBinding,
  evaluateVariables,
  evaluatedText,
  nameProblem,
  scopeFor,
  targetLabel,
  variableUsers,
} from '../core/variables';
import { saveProject } from '../persist/db';
import { useDesign } from '../store/designStore';
import { askConfirm } from './Confirm';
import { Dialog } from './Dialogs';
import { Group, InfoTip, MmField } from './controls';
import { Icon } from './icons';
import { useUi } from './shell/uiStore';

/** `bottom height = 400`: what a bound field shows instead of being edited (ADR-163). */
export function bindingHint(
  project: Project,
  item: ProjectItem,
  target: string,
): string | undefined {
  const b = bindingOf(item, target);
  if (!b) return undefined;
  const e = evaluateBinding(b.expr, scopeFor(project, item));
  return e.value === undefined
    ? t('{expr}: {problem}', { expr: b.expr, problem: e.problem ?? '' })
    : t('{expr} = {n}', { expr: b.expr, n: e.value });
}

/**
 * The ƒ button beside a bindable size (ADR-163): a sheet to pick a variable or type a formula, or to unbind.
 */
export function BindButton({ itemId, target }: { itemId: string; target: string }) {
  const project = useDesign((s) => s.project);
  const bind = useDesign((s) => s.bindTarget);
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState('');
  const item = project?.items.find((i) => i.id === itemId);
  if (!project || !item) return null;
  const current = bindingOf(item, target);
  // A value set's duplicate takes its bindings from its original (ADR-164).
  const copy = !!item.set;
  const vars = project.variables ?? [];
  const label = targetLabel(target);
  const scope = scopeFor(project, item);
  const preview = expr.trim() ? evaluateBinding(expr, scope) : null;
  const start = () => {
    setExpr(current?.expr ?? '');
    setOpen(true);
  };
  return (
    <>
      <button
        type="button"
        className={`btn icon sm bind ${current ? 'on' : 'ghost'}`}
        onClick={start}
        disabled={copy}
        aria-label={
          current
            ? t('{field} follows a variable; change or unbind', { field: label })
            : t('Bind {field} to a variable', { field: label })
        }
        title={current ? current.expr : t('Bind to a variable')}
      >
        ƒ
      </button>
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={t('Bind {field}', { field: label })}
          info={
            <InfoTip label={t('About binding')} align="start">
              {t(
                'The field follows the variable or formula: change the variable in Settings › Variables and every bound piece follows. A non-whole result is rounded to the nearest mm.',
              )}
            </InfoTip>
          }
          footer={
            <>
              {current && (
                <button
                  type="button"
                  className="btn outline"
                  onClick={() => {
                    bind(itemId, target, null);
                    setOpen(false);
                  }}
                >
                  {t('Unbind')}
                </button>
              )}
              <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
                {t('Cancel')}
              </button>
              <button
                type="button"
                className="btn solid"
                disabled={!preview || preview.value === undefined}
                onClick={() => {
                  bind(itemId, target, expr);
                  setOpen(false);
                }}
              >
                {t('Bind')}
              </button>
            </>
          }
        >
          {vars.length ? (
            <div className="field">
              <span className="field-label">{t('Variable')}</span>
              <ul className="variable-pick" role="list">
                {vars.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      className={`btn sm ${expr.trim().toLowerCase() === v.name.toLowerCase() ? 'solid' : 'outline'}`}
                      onClick={() => setExpr(v.name)}
                    >
                      {v.name} = {scope.has(v.name) ? scope.get(v.name) : '?'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="hint">{t('No variables yet. Add them in Settings › Variables.')}</p>
          )}
          <label className="field">
            <span className="field-label">{t('Formula')}</span>
            <input
              value={expr}
              onChange={(e) => setExpr(e.target.value)}
              placeholder={t('e.g. bottom height + 18')}
              autoFocus
            />
          </label>
          {preview && (
            <p
              className={preview.value === undefined ? 'alert error' : 'hint'}
              role={preview.value === undefined ? 'alert' : 'status'}
            >
              {preview.value === undefined
                ? preview.problem
                : t('= {text}', { text: evaluatedText(preview) })}
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}

/** Variables and value sets in Configure (ADR-163, ADR-164). */
export function VariablesPanel() {
  const project = useDesign((s) => s.project)!;
  const add = useDesign((s) => s.addVariable);
  const update = useDesign((s) => s.updateVariable);
  const remove = useDesign((s) => s.deleteVariable);
  const [name, setName] = useState('');
  const [expr, setExpr] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const vars = project.variables ?? [];
  const ev = evaluateVariables(vars);
  const problem = nameProblem(name, vars);
  const submit = () => {
    if (problem || !expr.trim())
      return setMsg(problem ?? t('A variable needs a value or a formula.'));
    add(name, expr);
    setName('');
    setExpr('');
    setMsg(null);
  };
  const del = async (id: string) => {
    const v = vars.find((x) => x.id === id)!;
    const users = variableUsers(project, id);
    const names = [
      ...users.items.map((i) => tr(i.design.name)),
      ...users.vars.map((x) => x.name),
      ...users.sets,
    ];
    const message = names.length
      ? t('Delete “{name}”? {list} use it; they keep their current numbers.', {
          name: v.name,
          list: names.join(', '),
        })
      : t('Delete “{name}”?', { name: v.name });
    if (await askConfirm(message, { confirmLabel: t('Delete'), danger: true })) remove(id);
  };
  return (
    <section className="variables section" aria-labelledby="variables-head">
      <div className="info-row">
        <h3 id="variables-head">{t('Variables')}</h3>
        <InfoTip label={t('About variables')} align="start">
          {t(
            'A named number or formula. Bind a piece’s width, height, depth, a division or its position to it with the ƒ button beside the field; change the variable and every bound piece follows.',
          )}
        </InfoTip>
      </div>
      {vars.length > 0 && (
        <ul className="variable-list" role="list">
          {vars.map((v) => {
            const r = ev.get(v.id)!;
            const users = variableUsers(project, v.id);
            return (
              <li key={v.id} className="variable-row">
                <input
                  aria-label={t('Name of {name}', { name: v.name })}
                  defaultValue={v.name}
                  key={`n-${v.id}-${v.name}`}
                  onBlur={(e) => {
                    const n = e.target.value.trim();
                    if (n === v.name) return;
                    const p = nameProblem(
                      n,
                      vars.filter((x) => x.id !== v.id),
                    );
                    if (p) {
                      setMsg(p);
                      e.target.value = v.name;
                    } else update(v.id, { name: n });
                  }}
                />
                <input
                  aria-label={t('Value of {name}', { name: v.name })}
                  defaultValue={v.expr}
                  key={`e-${v.id}-${v.expr}`}
                  inputMode="decimal"
                  onBlur={(e) => {
                    const x = e.target.value.trim();
                    if (x !== v.expr) update(v.id, { expr: x });
                  }}
                />
                <span
                  className={`result ${r.value === undefined ? 'error' : ''}`}
                  role={r.value === undefined ? 'alert' : undefined}
                >
                  {evaluatedText(r)}
                </span>
                <button
                  type="button"
                  className="btn icon ghost sm"
                  onClick={() => del(v.id)}
                  aria-label={t('Delete {name}', { name: v.name })}
                >
                  <Icon name="trash" />
                </button>
                <span className="hint">
                  {users.items.length
                    ? t('used by {n|# piece|# pieces}', { n: users.items.length })
                    : t('not used')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="variable-add">
        <label className="field">
          <span className="field-label">{t('New variable')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('e.g. bottom height')}
          />
        </label>
        <label className="field">
          <span className="field-label">{t('Value or formula')}</span>
          <input
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            placeholder="400"
            inputMode="decimal"
          />
        </label>
        <button type="button" className="btn outline" onClick={submit}>
          {t('Add variable')}
        </button>
      </div>
      {msg && (
        <p className="alert error" role="alert">
          {msg}
        </p>
      )}
      {vars.length > 0 && <ValueSets project={project} />}
    </section>
  );
}

/** Value sets (ADR-164): set 1 is the variables above; each other set has its values, origin and duplicates. */
function ValueSets({ project }: { project: Project }) {
  const addSet = useDesign((s) => s.addVariableSet);
  const updateSet = useDesign((s) => s.updateVariableSet);
  const removeSet = useDesign((s) => s.removeVariableSet);
  const [saved, setSaved] = useState<{ name: string; project: Project } | null>(null);
  const sets = project.variableSets ?? [];
  const vars = project.variables ?? [];
  const save = async (set: VariableSet) => {
    const p = projectFromSet(project, set.id);
    if (!p) return;
    await saveProject(p);
    setSaved({ name: p.name, project: p });
    const keep = await askConfirm(
      t('Saved as “{name}”. Keep {set} in this project?', { name: p.name, set: set.name }),
      { confirmLabel: t('Keep'), cancelLabel: t('Remove') },
    );
    if (!keep) removeSet(set.id);
  };
  return (
    <div className="value-sets" role="group" aria-label={t('Value sets')}>
      <h4>{t('Value sets')}</h4>
      <p className="hint">
        {t(
          'Set 1 is the values above. Another set duplicates every bound piece with its own values, beside set 1.',
        )}
      </p>
      {sets.map((set) => (
        <SetCard
          key={set.id}
          project={project}
          set={set}
          vars={vars}
          onChange={(patch) => updateSet(set.id, patch)}
          onRemove={() => removeSet(set.id)}
          onSave={() => save(set)}
        />
      ))}
      <button type="button" className="btn outline" onClick={() => addSet()}>
        {t('Add set')}
      </button>
      {saved && (
        <SavedNote name={saved.name} project={saved.project} onClose={() => setSaved(null)} />
      )}
    </div>
  );
}

function SetCard({
  project,
  set,
  vars,
  onChange,
  onRemove,
  onSave,
}: {
  project: Project;
  set: VariableSet;
  vars: Project['variables'] & object;
  onChange: (patch: Partial<Pick<VariableSet, 'name' | 'values' | 'origin'>>) => void;
  onRemove: () => void;
  onSave: () => void;
}) {
  const progress = setProgress(project, set);
  const complete = setComplete(project, set);
  const ev = evaluateVariables(vars, set.values);
  const dups = project.items.filter((i) => i.set?.id === set.id);
  const count = dups.length;
  const selectItems = useDesign((s) => s.selectItems);
  const remove = async () => {
    if (
      await askConfirm(
        count
          ? t('Remove {set} and its {n|# piece|# pieces}?', { set: set.name, n: count })
          : t('Remove {set}?', { set: set.name }),
        { confirmLabel: t('Remove'), danger: true },
      )
    )
      onRemove();
  };
  return (
    <section className="set-card" aria-label={set.name}>
      <div className="set-head">
        <input
          aria-label={t('Name of {name}', { name: set.name })}
          defaultValue={set.name}
          key={`${set.id}-${set.name}`}
          onBlur={(e) => {
            const n = e.target.value.trim();
            if (n && n !== set.name) onChange({ name: n });
          }}
        />
        <span className="hint" role="status">
          {complete
            ? t('{n|# piece|# pieces}', { n: count })
            : t('{done} of {total} values set', { done: progress.done, total: progress.total })}
        </span>
      </div>
      <ul className="variable-list" role="list">
        {vars.map((v) => {
          const r = ev.get(v.id);
          const has = (set.values[v.id] ?? '').trim() !== '';
          return (
            <li key={v.id} className="variable-row">
              <span className="name">{v.name}</span>
              <input
                aria-label={t('{set}: value of {name}', { set: set.name, name: v.name })}
                defaultValue={set.values[v.id] ?? ''}
                key={`${set.id}-${v.id}-${set.values[v.id] ?? ''}`}
                inputMode="decimal"
                placeholder={t('not set')}
                onBlur={(e) => {
                  const x = e.target.value.trim();
                  if (x !== (set.values[v.id] ?? ''))
                    onChange({ values: { ...set.values, [v.id]: x } });
                }}
              />
              <span className={`result ${has && r?.value === undefined ? 'error' : ''}`}>
                {has && r ? evaluatedText(r) : ''}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="dims2">
        <MmField
          label={t('Set origin from left')}
          value={set.origin.x}
          min={-50000}
          max={50000}
          step={100}
          onChange={(x) => onChange({ origin: { ...set.origin, x } })}
        />
        <MmField
          label={t('Set origin from back')}
          value={set.origin.z}
          min={-50000}
          max={50000}
          step={100}
          onChange={(z) => onChange({ origin: { ...set.origin, z } })}
        />
      </div>
      {count > 0 && (
        <p className="hint">
          {dups.map((i) => tr(i.design.name)).join(', ')}{' '}
          <button
            type="button"
            className="btn sm outline"
            onClick={() => selectItems(dups.map((i) => i.id))}
          >
            {t('Select them')}
          </button>
        </p>
      )}
      <div className="row">
        <button
          type="button"
          className="btn outline"
          onClick={onSave}
          disabled={!complete}
          title={complete ? undefined : t('Set every value first')}
        >
          {t('Save as separate project')}
        </button>
        <button type="button" className="btn ghost" onClick={remove}>
          {t('Remove set')}
        </button>
      </div>
      {!complete && (
        <p className="hint">
          {t('The set draws its pieces and can be saved once every value is set.')}
        </p>
      )}
    </section>
  );
}

/** "Saved as …" with Open (ADR-164): the user stays in the current project. */
function SavedNote({
  name,
  project,
  onClose,
}: {
  name: string;
  project: Project;
  onClose: () => void;
}) {
  const open = useDesign((s) => s.openProject);
  const closeSettings = useUi((s) => s.setSettingsOpen);
  return (
    <p className="alert info" role="status">
      {t('Saved as “{name}”.', { name })}{' '}
      <button
        type="button"
        className="btn sm outline"
        onClick={() => {
          open(project);
          closeSettings(false);
        }}
      >
        {t('Open')}
      </button>{' '}
      <button
        type="button"
        className="btn icon ghost sm"
        onClick={onClose}
        aria-label={t('Dismiss')}
      >
        <Icon name="x" />
      </button>
    </p>
  );
}

/**
 * The variables on the Compose side panel: name = value, editable in place, so the pieces move as you type. The
 * full panel, with the value sets, is in Settings.
 */
export function VariablesStrip() {
  const project = useDesign((s) => s.project)!;
  const update = useDesign((s) => s.updateVariable);
  const openSettings = useUi((s) => s.setSettingsOpen);
  const vars = project.variables ?? [];
  if (!vars.length) return null;
  const ev = evaluateVariables(vars);
  return (
    <section className="section variables-strip" aria-label={t('Variables')}>
      <Group title={t('Variables')} defaultOpen>
        <ul className="variable-list" role="list">
          {vars.map((v) => {
            const r = ev.get(v.id)!;
            return (
              <li key={v.id} className="variable-row strip">
                <span className="name">{v.name}</span>
                <input
                  aria-label={t('Value of {name}', { name: v.name })}
                  defaultValue={v.expr}
                  key={`${v.id}-${v.expr}`}
                  inputMode="decimal"
                  onBlur={(e) => {
                    const x = e.target.value.trim();
                    if (x !== v.expr) update(v.id, { expr: x });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                />
                <span className={`result ${r.value === undefined ? 'error' : ''}`}>
                  {evaluatedText(r)}
                </span>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn sm ghost" onClick={() => openSettings(true)}>
          {t('All variables and value sets…')}
        </button>
      </Group>
    </section>
  );
}
