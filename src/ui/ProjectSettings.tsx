import { useMemo, useState } from 'react';
import { projectBoards } from '../core/finish';
import type { ProjectItem } from '../core/project';
import {
  follows,
  SETTING_KEYS,
  SETTING_LABEL,
  settingText,
  type SettingKey,
} from '../core/projectSettings';
import type { FrontStyle, Handle, Material } from '../core/types';
import { t, tr } from '../core/i18n';
import { useDesign } from '../store/designStore';
import { InfoTip, MmField, Select, Toggle } from './controls';
import { Icon } from './icons';

const NOT_SET = '';
const HANDLES: Record<string, Handle | null> = {
  bar: { kind: 'bar' },
  knob: { kind: 'knob' },
  push: { kind: 'push' },
  none: null,
};
const handleValue = (h: Handle | null | undefined) =>
  h === undefined ? NOT_SET : h === null ? 'none' : h.kind;
const boardId = (m: Material | undefined) => (m ? `${m.name}|${m.thickness}|${m.grain}` : NOT_SET);

/**
 * Project settings in Configure (ADR-124): boards, handle, front overlay and plinth height every piece follows while
 * its own value is the project's. A change reaches every following piece in one undo step; pieces with their own
 * value keep it.
 */
export function ProjectSettingsPanel() {
  const project = useDesign((s) => s.project)!;
  const set = useDesign((s) => s.setProjectSetting);
  const [msg, setMsg] = useState<string | null>(null);
  const boards = useMemo(() => projectBoards(project), [project]);
  const s = project.settings ?? {};
  const apply = (key: SettingKey, value: Parameters<typeof set>[1]) => {
    const applied = set(key, value);
    // Refused because it would resize a size-locked piece (ADR-122): the store's notice says which.
    const refused = useDesign.getState().notice;
    if (refused) return setMsg(refused);
    setMsg(
      value === undefined
        ? t('{setting}: not set. Pieces keep what they have.', { setting: SETTING_LABEL[key] })
        : applied.length
          ? t('{setting}: applied to {n|# piece|# pieces}.', {
              setting: SETTING_LABEL[key],
              n: applied.length,
            })
          : t('{setting}: no piece follows it.', { setting: SETTING_LABEL[key] }),
    );
  };
  const boardSelect = (key: 'body' | 'front' | 'back') => {
    const cur = s[key];
    const options = boards.map((m) => ({
      value: boardId(m),
      label: t('{name} {n} mm', { name: tr(m.name), n: m.thickness }),
    }));
    if (cur && !options.some((o) => o.value === boardId(cur)))
      options.unshift({
        value: boardId(cur),
        label: t('{name} {n} mm', { name: tr(cur.name), n: cur.thickness }),
      });
    return (
      <Select
        key={key}
        label={SETTING_LABEL[key]}
        value={boardId(cur)}
        options={[{ value: NOT_SET, label: t('Not set') }, ...options]}
        onChange={(v) =>
          apply(key, v === NOT_SET ? undefined : (boards.find((m) => boardId(m) === v) ?? cur))
        }
      />
    );
  };
  return (
    <section className="project-settings section" aria-labelledby="project-settings-head">
      <div className="info-row">
        <h3 id="project-settings-head">{t('Project settings')}</h3>
        <InfoTip label={t('About project settings')} align="start">
          {t(
            "Every piece follows these while its own value is the project's. A piece changed on its own keeps its value; its card offers Follow project.",
          )}
        </InfoTip>
      </div>
      {boardSelect('body')}
      {boardSelect('front')}
      {boardSelect('back')}
      <Select
        label={SETTING_LABEL.handle}
        value={handleValue(s.handle)}
        options={[
          { value: NOT_SET, label: t('Not set') },
          { value: 'bar', label: t('Bar handle') },
          { value: 'knob', label: t('Knob handle') },
          { value: 'push', label: t('Push-to-open') },
          { value: 'none', label: t('No handle') },
        ]}
        onChange={(v) => apply('handle', v === NOT_SET ? undefined : HANDLES[v])}
      />
      <Select<'' | FrontStyle>
        label={SETTING_LABEL.frontStyle}
        value={s.frontStyle ?? NOT_SET}
        options={[
          { value: NOT_SET, label: t('Not set') },
          { value: 'overlay', label: t('Overlay') },
          { value: 'half', label: t('Half overlay') },
          { value: 'inset', label: t('Inset') },
        ]}
        onChange={(v) => apply('frontStyle', v === NOT_SET ? undefined : v)}
      />
      <Toggle
        label={t('Same plinth height for every piece')}
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
    </section>
  );
}

/** The selected piece's project settings (ADR-124): "Follows project", or its own value with Follow project. */
export function PieceProjectSettings({ item }: { item: ProjectItem }) {
  const project = useDesign((s) => s.project)!;
  const follow = useDesign((s) => s.followProject);
  const rows = SETTING_KEYS.map((key) => ({ key, state: follows(project, item, key) })).filter(
    (r) => r.state !== 'n/a',
  );
  if (!rows.length)
    return (
      <p className="hint">
        {t('No project settings apply to this piece. Set them in Settings › Project settings.')}
      </p>
    );
  return (
    <ul className="setting-rows">
      {rows.map(({ key, state }) => (
        <li key={key}>
          <span>
            <strong>{SETTING_LABEL[key]}:</strong>{' '}
            {state === 'follows' ? (
              <>
                <Icon name="check" className="sm" /> {t('Follows project')}
              </>
            ) : (
              t('Own: {value}', { value: settingText(item.design, key) })
            )}
          </span>
          {state === 'own' && (
            <button type="button" className="btn sm outline" onClick={() => follow(item.id, key)}>
              {t('Follow project')}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
