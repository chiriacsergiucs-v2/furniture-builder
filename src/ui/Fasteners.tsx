import { useEffect, useId, useMemo, useState } from 'react';
import { create } from 'zustand';
import {
  fastenerCounts,
  GUIDANCE,
  JOINT_BY_ID,
  JOINTS,
  plural,
  projectFastenerCounts,
  type FastenerChoice,
  type FastenerCount,
  type JointInfo,
  type JointType,
} from '../core/fasteners';
import { t, tr } from '../core/i18n';
import { deleteFastener, listFasteners, saveFastener } from '../persist/db';
import { useDesign } from '../store/designStore';
import { GuidanceTip, Group, InfoTip } from './controls';
import { Icon } from './icons';

/**
 * The user's fastener list (ADR-074), shared by Materials › Fasteners, the Hardware tab and the Shopping list. It is
 * kept on this device; nothing here is part of a design.
 */
interface FastenerState {
  choices: FastenerChoice[];
  loaded: boolean;
  /** The saved list has been read (or could not be): rows start from what is saved. */
  ready: boolean;
  error: string | null;
  load: () => void;
  set: (c: FastenerChoice) => void;
  clear: (joint: JointType) => void;
}
export const useFastenerList = create<FastenerState>((set, get) => ({
  choices: [],
  loaded: false,
  ready: false,
  error: null,
  load: () => {
    if (get().loaded) return;
    set({ loaded: true });
    listFasteners()
      .then((choices) => set({ choices, ready: true }))
      .catch(() =>
        set({
          loaded: false,
          ready: true,
          error: t('Your fastener list could not be read from this browser.'),
        }),
      );
  },
  set: (c) => {
    set((s) => ({ choices: [...s.choices.filter((x) => x.joint !== c.joint), c], error: null }));
    saveFastener(c).catch(() => failed(set, t('The fastener could not be saved on this device.')));
  },
  clear: (joint) => {
    set((s) => ({ choices: s.choices.filter((x) => x.joint !== joint), error: null }));
    deleteFastener(joint).catch(() =>
      failed(set, t('The fastener could not be removed from this device.')),
    );
  },
}));

/** A write failed: show what is really saved again, so no view counts an unsaved fastener. */
function failed(set: (p: Partial<FastenerState>) => void, error: string) {
  set({ error });
  listFasteners()
    .then((choices) => set({ choices }))
    .catch(() => set({ choices: [] }));
}

/** The user's fastener list, read from the device on first use. */
export function useFastenerChoices(): FastenerChoice[] {
  const choices = useFastenerList((s) => s.choices);
  const load = useFastenerList((s) => s.load);
  useEffect(load, [load]);
  return choices;
}

/** Counts for what the result tabs show: the piece being edited, or the whole open project (like useView). */
export function useFastenerCounts(): FastenerCount[] {
  const model = useDesign((s) => s.model);
  const project = useDesign((s) => s.project);
  const projectModel = useDesign((s) => s.projectModel);
  const editing = useDesign((s) => s.editingItemId);
  return useMemo(
    () =>
      project && projectModel && !editing ? projectFastenerCounts(project) : fastenerCounts(model),
    [model, project, projectModel, editing],
  );
}

const amount = plural;

/** Materials › Fasteners (ADR-074): what the user fixes each joint type with, and how many per joint. */
export function FastenersPanel() {
  const choices = useFastenerChoices();
  const error = useFastenerList((s) => s.error);
  const ready = useFastenerList((s) => s.ready);
  const counts = useFastenerCounts();
  const byJoint = useMemo(() => new Map(counts.map((c) => [c.joint, c.count])), [counts]);
  return (
    <Group
      title={t('Fasteners')}
      id="g-fasteners"
      defaultOpen={false}
      info={
        <InfoTip label={t('About fasteners')}>
          {t(
            'Name what you fix each joint type with and how many per joint. The app counts the joints from the model as guidance; it never chooses a screw, dowel, length or spacing. Your list is saved on this device and used for every piece and project.',
          )}
        </InfoTip>
      }
    >
      {error && (
        <p className="alert error" role="alert">
          <Icon name="alert-circle" className="sm" />
          <span>{error}</span>
        </p>
      )}
      {/* Rows mount once the saved list is read, so they start from it and keep focus while typing. */}
      <ul className="fasteners">
        {ready &&
          JOINTS.map((j) => (
            <FastenerRow
              key={j.id}
              joint={j}
              count={byJoint.get(j.id) ?? 0}
              choice={choices.find((c) => c.joint === j.id)}
            />
          ))}
      </ul>
    </Group>
  );
}

function FastenerRow({
  joint,
  count,
  choice,
}: {
  joint: JointInfo;
  count: number;
  choice?: FastenerChoice;
}) {
  const id = useId();
  const setChoice = useFastenerList((s) => s.set);
  const clear = useFastenerList((s) => s.clear);
  const [name, setName] = useState(choice?.name ?? '');
  const [per, setPer] = useState(String(choice?.per ?? 1));
  const perN = Number(per);
  const perOk = per.trim() !== '' && Number.isSafeInteger(perN) && perN >= 1;
  const commit = (nextName = name, nextPer = per) => {
    const n = nextName.trim();
    const p = Number(nextPer);
    if (!n) {
      if (choice) clear(joint.id);
      return;
    }
    if (!(nextPer.trim() !== '' && Number.isSafeInteger(p) && p >= 1)) return;
    if (choice && choice.name === n && choice.per === p) return;
    setChoice({ joint: joint.id, name: n, per: p });
  };
  return (
    <li className="fastener">
      <div className="fastener-head">
        <strong>{tr(joint.title)}</strong>
        <span className="hint">
          {t('{amount} here · guidance: {how}', {
            amount: amount(count, joint),
            how: tr(joint.how),
          })}
        </span>
      </div>
      <div className="fastener-fields">
        <div className="field">
          <label htmlFor={`${id}-name`}>{t('Your fastener')}</label>
          <input
            id={`${id}-name`}
            aria-label={t('{joint}: your fastener', { joint: tr(joint.title) })}
            placeholder={t('Not chosen')}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => commit()}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>
        <div className="field per">
          <label htmlFor={`${id}-per`}>{t('Per {one}', { one: tr(joint.one) })}</label>
          <input
            id={`${id}-per`}
            aria-label={t('{joint}: how many per {one}', {
              joint: tr(joint.title),
              one: tr(joint.one),
            })}
            inputMode="numeric"
            value={per}
            aria-invalid={!perOk}
            aria-describedby={!perOk ? `${id}-err` : undefined}
            onChange={(e) => setPer(e.target.value.replace(/[^\d]/g, ''))}
            onBlur={() => commit()}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
        </div>
      </div>
      {!perOk && (
        <p className="field-error" id={`${id}-err`}>
          {t('Whole number, 1 or more. Not saved until it is.')}
        </p>
      )}
    </li>
  );
}

/** Hardware tab (ADR-074): the counts and what they become with the user's fasteners, labelled guidance. */
export function FastenerCounts() {
  const counts = useFastenerCounts();
  const choices = useFastenerChoices();
  const shown = counts.filter((c) => c.count > 0);
  if (!shown.length) return null;
  return (
    <section className="fastener-counts" aria-label={t('Fasteners')}>
      <div className="info-row">
        <h3 className="list-head">{t('Fasteners — guidance')}</h3>
        <GuidanceTip topic={t('fastener counts')}>
          {tr(GUIDANCE)}.{' '}
          {t('The fastener and how many per joint are yours: set them under Settings › Fasteners.')}
        </GuidanceTip>
      </div>
      <table className="cut">
        <thead>
          <tr>
            <th scope="col">{t('Count')}</th>
            <th scope="col">{t('Joint type')}</th>
            <th scope="col">{t('Your fastener')}</th>
            <th scope="col">{t('To buy')}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((c) => {
            const j = JOINT_BY_ID.get(c.joint)!;
            const pick = choices.find((x) => x.joint === c.joint);
            return (
              <tr key={c.joint}>
                <td className="num">{amount(c.count, j)}</td>
                <td>{tr(j.title)}</td>
                <td>
                  {pick ? (
                    `${t('{name}, {per} per {one}', { name: pick.name, per: pick.per, one: tr(j.one) })}${c.joint === 'shelf-pin' ? t(' (bought instead of the scheduled shelf pins)') : ''}`
                  ) : (
                    <span className="hint">{t('choose your fastener')}</span>
                  )}
                </td>
                <td className="num">{pick ? t('{n} pcs', { n: c.count * pick.per }) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
