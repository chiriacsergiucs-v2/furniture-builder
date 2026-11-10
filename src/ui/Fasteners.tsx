import { useId, useMemo, useState } from 'react';
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
} from '../core/fasteners';
import { t, tr } from '../core/i18n';
import { useDesign } from '../store/designStore';
import { useFastenerChoices, useFastenerList } from '../store/fastenerStore';
import { GuidanceTip, Group, InfoTip } from './controls';
import { Icon } from './icons';

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

/** Settings › Fasteners (ADR-074): what the user fixes each joint type with, and how many per joint. */
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
          JOINTS.map((j) => {
            const c = choices.find((x) => x.joint === j.id);
            return <FastenerRow key={j.id} joint={j} count={byJoint.get(j.id) ?? 0} choice={c} />;
          })}
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
  // Carcass joints (ADR-209): mm from each end of a joint to the first and last fixing; empty = no drilling positions.
  const [edge, setEdge] = useState(choice?.edge !== undefined ? String(choice.edge) : '');
  // The saved choice changed from outside (a failed save re-read from storage, ADR-256): the row shows what is saved.
  // A save the user just made changes it to what the fields already hold, so nothing moves and focus stays.
  const savedKey = `${choice?.name ?? ''}|${choice?.per ?? ''}|${choice?.edge ?? ''}`;
  const [seen, setSeen] = useState(savedKey);
  const reset = () => {
    setName(choice?.name ?? '');
    setPer(String(choice?.per ?? 1));
    setEdge(choice?.edge !== undefined ? String(choice.edge) : '');
  };
  if (seen !== savedKey) {
    setSeen(savedKey);
    reset();
  }
  // A failed write also resets the row, when the save and the re-read land in one render.
  const storeError = useFastenerList((s) => s.error);
  const [seenError, setSeenError] = useState(storeError);
  if (seenError !== storeError) {
    setSeenError(storeError);
    if (storeError) reset();
  }
  const perN = Number(per);
  const perOk = per.trim() !== '' && Number.isSafeInteger(perN) && perN >= 1;
  const edgeN = Number(edge);
  const edgeOk = edge.trim() === '' || (Number.isSafeInteger(edgeN) && edgeN >= 0 && edgeN <= 5000);
  const drills = joint.id === 'carcass-joint';
  const commit = (nextName = name, nextPer = per) => {
    const n = nextName.trim();
    const p = Number(nextPer);
    if (!n) {
      if (choice) clear(joint.id);
      return;
    }
    if (!(nextPer.trim() !== '' && Number.isSafeInteger(p) && p >= 1)) return;
    if (!edgeOk) return;
    const e = drills && edge.trim() !== '' ? edgeN : undefined;
    if (choice && choice.name === n && choice.per === p && choice.edge === e) return;
    setChoice({ joint: joint.id, name: n, per: p, ...(e !== undefined ? { edge: e } : {}) });
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
            onChange={(e) => setPer(e.target.value.replace(/[^\d.,-]/g, ''))}
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
      {drills && (
        <div className="field">
          <label htmlFor={`${id}-edge`}>{t('From each end (mm)')}</label>
          <input
            id={`${id}-edge`}
            inputMode="numeric"
            value={edge}
            placeholder={t('Not set')}
            aria-invalid={!edgeOk}
            aria-describedby={`${id}-edge-hint`}
            onChange={(e) => setEdge(e.target.value.replace(/[^\d.,-]/g, ''))}
            onBlur={() => commit()}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          <p className={edgeOk ? 'hint' : 'field-error'} id={`${id}-edge-hint`}>
            {edgeOk
              ? t(
                  'Guidance: with your fastener named and this typed, Parts shows drilling positions from your values. No diameter, depth or screw is given.',
                )
              : t('Whole number from 0 to 5000. Not saved until it is.')}
          </p>
        </div>
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
