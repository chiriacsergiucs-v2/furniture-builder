import { useMediaQuery } from '../store/useMediaQuery';
import { t } from '@furniture-builder/i18n';
import { useDesign } from '../store/designStore';
import { Dialog, MaterialsPanel } from './Dialogs';
import { FastenersPanel } from './Fasteners';
import { Inspector } from './Inspector';

/**
 * A project piece's own settings (ADR-090): size, construction, boards and drawers, edited from the project editor
 * without opening the piece. The piece is the one loaded for edits there (ADR-088); each change is one project undo
 * step.
 */
export function PieceSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const phone = useMediaQuery('(max-width: 760px)');
  const name = useDesign((s) => s.design.name);
  return (
    <Dialog
      inSheet={phone}
      open={open}
      onClose={onClose}
      title={t('Size, boards and construction: {name}', { name })}
      wide
      footer={
        <button type="button" className="btn primary" onClick={onClose}>
          {t('Done')}
        </button>
      }
    >
      {open && (
        <div className="settings-body">
          <Inspector mode="configure" />
          <div className="inspector boards">
            <MaterialsPanel />
            <FastenersPanel />
          </div>
        </div>
      )}
    </Dialog>
  );
}
