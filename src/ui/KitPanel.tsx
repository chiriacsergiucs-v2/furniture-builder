/**
 * A kit's editor (ADR-298): a piece inserted as a pre-made build shows a banner and, under Settings, only its outer
 * size. Its boards stay open; everything else is fixed until the user unlocks the kit (the store refuses it).
 */
import { t, tr } from '@furniture-builder/i18n';
import { useDesign } from '../store/designStore';
import { askConfirm } from './Confirm';
import { DimensionField } from './DimensionField';
import { Icon } from './icons';

/** The banner and Unlock all edits; shown wherever the full editor would be. */
export function KitBanner() {
  const name = useDesign((s) => s.design.catalog?.origin?.productName ?? s.design.name);
  const unlock = useDesign((s) => s.unlockKit);
  const ask = async () => {
    const ok = await askConfirm(
      t('Unlock this kit? The piece becomes a normal design. You can undo this.'),
      { confirmLabel: t('Unlock'), cancelLabel: t('Cancel'), cancelFirst: true },
    );
    if (ok) unlock();
  };
  return (
    <div className="alert info plain kit-banner" role="status">
      <p>
        <Icon name="lock" className="sm" /> <strong>{t('Kit: {name}', { name: tr(name) })}</strong>
        <br />
        {t('Size and boards can be changed. Unlock all edits to change the rest.')}
      </p>
      <button type="button" className="btn" onClick={() => void ask()}>
        {t('Unlock all edits')}
      </button>
    </div>
  );
}

/** The kit editor under Settings: the banner and the outer size. */
export function KitEditor() {
  const prod = useDesign((s) => s.design.product);
  const set = useDesign((s) => s.updateCabinet);
  return (
    <div className="inspector">
      <KitBanner />
      {prod.kind === 'cabinet' && (
        <div className="dims3">
          <DimensionField
            axis="width"
            label={t('Width')}
            value={prod.params.width}
            min={100}
            max={4000}
            onChange={(v) => set({ width: v })}
          />
          <DimensionField
            axis="height"
            label={t('Height')}
            value={prod.params.height}
            min={100}
            max={3000}
            onChange={(v) => set({ height: v })}
          />
          <DimensionField
            axis="depth"
            label={t('Depth')}
            value={prod.params.depth}
            min={100}
            max={1200}
            onChange={(v) => set({ depth: v })}
          />
        </div>
      )}
    </div>
  );
}
