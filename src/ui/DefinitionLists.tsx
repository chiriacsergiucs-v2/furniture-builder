import { useState } from 'react';
import { t, tr } from '@furniture-builder/i18n';
import { boardChoices } from '../core/boards';
import { listNameProblem, listUsers, listValues, valueSource } from '../core/defLists';
import { materialKey, type DefinitionList, type ProjectItem } from '../core/project';
import { SETTING_LABEL, type SettingKey } from '../core/projectSettings';
import type { FrontStyle, Handle, Material } from '../core/types';
import { evaluatedText, evaluateVariables } from '../core/variables';
import { useDesign } from '../store/designStore';
import { askConfirm } from './Confirm';
import { InfoTip, MmField, Select, Toggle } from './controls';
import { Icon } from './icons';

const PROJECT = '';
const HANDLES: Record<string, Handle | null> = {
  bar: { kind: 'bar' },
  knob: { kind: 'knob' },
  push: { kind: 'push' },
  none: null,
};
const handleValue = (h: Handle | null | undefined) =>
  h === undefined ? PROJECT : h === null ? 'none' : h.kind;

/**
 * Definition lists in Configure (ADR-306): each list gives the project's variables and settings other values for the
 * pieces linked to it. An empty field keeps the project's value.
 */
export function DefinitionListsPanel() {
  const project = useDesign((s) => s.project)!;
  const add = useDesign((s) => s.addDefinitionList);
  const lists = project.definitionLists ?? [];
  return (
    <section className="definition-lists section" aria-labelledby="def-lists-head">
      <div className="info-row">
        <h3 id="def-lists-head">{t('Definition lists')}</h3>
        <InfoTip label={t('About definition lists')} align="start">
          {t(
            'A list gives the variables and the project settings other values. Link a piece to a list in its card; a change to the list reaches every linked piece. An empty field keeps the project’s value.',
          )}
        </InfoTip>
      </div>
      {lists.map((l) => (
        <ListCard key={l.id} list={l} />
      ))}
      <button type="button" className="btn outline" onClick={() => add()}>
        <Icon name="plus" /> {t('Add list')}
      </button>
    </section>
  );
}

function ListCard({ list }: { list: DefinitionList }) {
  const project = useDesign((s) => s.project)!;
  const rename = useDesign((s) => s.renameDefinitionList);
  const setValue = useDesign((s) => s.setDefinitionListValue);
  const setSetting = useDesign((s) => s.setDefinitionListSetting);
  const remove = useDesign((s) => s.removeDefinitionList);
  const [msg, setMsg] = useState<string | null>(null);
  const vars = project.variables ?? [];
  const ev = evaluateVariables(vars, listValues(project, { list: { id: list.id } }));
  const users = listUsers(project, list.id);
  const s = list.settings ?? {};
  const boards = boardChoices(project, null);
  const apply = (key: SettingKey, value: Parameters<typeof setSetting>[2]) => {
    useDesign.setState({ notice: null });
    const applied = setSetting(list.id, key, value);
    const refused = useDesign.getState().notice;
    if (refused) return setMsg(refused);
    setMsg(
      value === undefined
        ? t('{setting}: the project’s. Pieces keep what they have.', {
            setting: SETTING_LABEL[key],
          })
        : t('{setting}: applied to {n|# piece|# pieces}.', {
            setting: SETTING_LABEL[key],
            n: applied.length,
          }),
    );
  };
  const del = async () => {
    const message = users.length
      ? t('Delete “{name}”? {list} use it; their bound sizes go back to the project’s values.', {
          name: list.name,
          list: users.map((i) => tr(i.design.name)).join(', '),
        })
      : t('Delete “{name}”?', { name: list.name });
    if (await askConfirm(message, { confirmLabel: t('Delete'), danger: true })) remove(list.id);
  };
  const boardSelect = (key: 'body' | 'front' | 'back') => {
    const cur = s[key] as Material | undefined;
    return (
      <Select
        label={SETTING_LABEL[key]}
        value={cur ? materialKey(cur) : PROJECT}
        options={[
          { value: PROJECT, label: t('Project’s') },
          ...boards
            .filter((b) => !b.key.startsWith('decor:'))
            .map((b) => ({ value: b.key, label: b.label })),
        ]}
        onChange={(v) =>
          apply(key, v === PROJECT ? undefined : boards.find((b) => b.key === v)?.board)
        }
      />
    );
  };
  return (
    <fieldset className="def-list" aria-label={list.name}>
      <div className="variable-row">
        <input
          aria-label={t('Name of {name}', { name: list.name })}
          defaultValue={list.name}
          key={`n-${list.id}-${list.name}`}
          onBlur={(e) => {
            const n = e.target.value.trim();
            if (n === list.name) return;
            const p = listNameProblem(n, project.definitionLists ?? [], list.id);
            if (p) {
              setMsg(p);
              e.target.value = list.name;
            } else rename(list.id, n);
          }}
        />
        <button
          type="button"
          className="btn icon ghost sm"
          onClick={() => void del()}
          aria-label={t('Delete {name}', { name: list.name })}
        >
          <Icon name="trash" />
        </button>
        <span className="hint">{t('used by {n|# piece|# pieces}', { n: users.length })}</span>
      </div>
      {vars.length > 0 ? (
        <ul className="variable-list" role="list">
          {vars.map((v) => {
            const r = ev.get(v.id)!;
            return (
              <li key={v.id} className="variable-row">
                <span>{v.name}</span>
                <input
                  aria-label={t('{name} in {list}', { name: v.name, list: list.name })}
                  defaultValue={list.values[v.id] ?? ''}
                  placeholder={v.expr}
                  key={`v-${list.id}-${v.id}-${list.values[v.id] ?? ''}`}
                  aria-invalid={r.value === undefined || undefined}
                  onBlur={(e) => {
                    const x = e.target.value.trim();
                    if (x !== (list.values[v.id] ?? '')) setValue(list.id, v.id, x || null);
                  }}
                />
                <span
                  className={`result ${r.value === undefined ? 'error' : ''}`}
                  role={r.value === undefined ? 'alert' : undefined}
                >
                  {evaluatedText(r)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="hint">{t('No variables yet. Add them in Settings › Variables.')}</p>
      )}
      {boardSelect('body')}
      {boardSelect('front')}
      {boardSelect('back')}
      <Select
        label={SETTING_LABEL.handle}
        value={handleValue(s.handle)}
        options={[
          { value: PROJECT, label: t('Project’s') },
          { value: 'bar', label: t('Bar handle') },
          { value: 'knob', label: t('Knob handle') },
          { value: 'push', label: t('Push-to-open') },
          { value: 'none', label: t('No handle') },
        ]}
        onChange={(v) => apply('handle', v === PROJECT ? undefined : HANDLES[v])}
      />
      <Select<'' | FrontStyle>
        label={SETTING_LABEL.frontStyle}
        value={s.frontStyle ?? PROJECT}
        options={[
          { value: PROJECT, label: t('Project’s') },
          { value: 'overlay', label: t('Overlay') },
          { value: 'half', label: t('Half overlay') },
          { value: 'inset', label: t('Inset') },
        ]}
        onChange={(v) => apply('frontStyle', v === PROJECT ? undefined : v)}
      />
      <Toggle
        label={t('Own plinth height in this list')}
        checked={s.plinthHeight !== undefined}
        onChange={(on) => apply('plinthHeight', on ? 100 : undefined)}
      />
      {s.plinthHeight !== undefined && (
        <MmField
          label={SETTING_LABEL.plinthHeight}
          value={s.plinthHeight}
          min={0}
          max={500}
          onChange={(v) => apply('plinthHeight', v)}
        />
      )}
      {msg && (
        <p className="hint" role="status">
          {msg}
        </p>
      )}
    </fieldset>
  );
}

/**
 * The selected piece's definition list (ADR-306): which list it follows, and each variable's value with its source
 * and the piece's own override.
 */
export function PieceDefinitionList({ item }: { item: ProjectItem }) {
  const project = useDesign((s) => s.project)!;
  const link = useDesign((s) => s.linkToList);
  const override = useDesign((s) => s.setListOverride);
  const lists = project.definitionLists ?? [];
  const vars = project.variables ?? [];
  const list = item.list ? lists.find((l) => l.id === item.list!.id) : undefined;
  if (item.set) return <p className="hint">{t('A value-set duplicate keeps its set’s values.')}</p>;
  const ev = list ? evaluateVariables(vars, listValues(project, item)) : null;
  return (
    <>
      <Select
        label={t('Definition list')}
        value={list?.id ?? ''}
        options={[
          { value: '', label: t('None') },
          ...lists.map((l) => ({ value: l.id, label: l.name })),
        ]}
        onChange={(v) => link(item.id, v || null)}
      />
      {list && ev && vars.length > 0 && (
        <ul className="variable-list" role="list">
          {vars.map((v) => {
            const src = valueSource(project, item, v.id);
            const own = item.list?.values?.[v.id] ?? '';
            const r = ev.get(v.id)!;
            return (
              <li key={v.id} className="variable-row">
                <span>{v.name}</span>
                <input
                  aria-label={t('Own value of {name}', { name: v.name })}
                  defaultValue={own}
                  placeholder={list.values[v.id] || v.expr}
                  key={`o-${item.id}-${v.id}-${own}`}
                  aria-invalid={r.value === undefined || undefined}
                  onBlur={(e) => {
                    const x = e.target.value.trim();
                    if (x !== own) override(item.id, v.id, x || null);
                  }}
                />
                <span className={`result ${r.value === undefined ? 'error' : ''}`}>
                  {evaluatedText(r)}{' '}
                  {src === 'piece'
                    ? t('(own)')
                    : src === 'list'
                      ? t('(from {list})', { list: list.name })
                      : t('(from project)')}
                </span>
                {src === 'piece' && (
                  <button
                    type="button"
                    className="btn sm outline"
                    onClick={() => override(item.id, v.id, null)}
                  >
                    {t('Use list value')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
