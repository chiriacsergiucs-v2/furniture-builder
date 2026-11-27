import { useMediaQuery } from '../store/useMediaQuery';
import { t } from '@furniture-builder/i18n';
import { useDesign } from '../store/designStore';
import { InfoTip } from './controls';
import { Dialog, MaterialsPanel } from './Dialogs';
import { FastenersPanel } from './Fasteners';
import { Inspector } from './Inspector';
import { ProjectPanel } from './Project';
import { Icon } from './icons';
import { useUi } from '../store/uiStore';
import { SavedDataPanel } from './SavedData';

/**
 * Settings (ADR-080): everything that was the Configure mode (ADR-079), in a dialog. A project shows what applies
 * to the whole project; a piece (also one opened from a project) shows its size, construction, boards and drawers.
 * Changes apply at once, as before: one undo step each, autosaved and checked.
 */
export function SettingsDialog({ onWizard }: { onWizard: () => void }) {
  const phone = useMediaQuery('(max-width: 760px)');
  const open = useUi((s) => s.settingsOpen);
  const setOpen = useUi((s) => s.setSettingsOpen);
  const inProject = useDesign((s) => !!s.project && !s.editingItemId);
  const name = useDesign((s) => (s.project && !s.editingItemId ? s.project.name : s.design.name));
  // A wizard-made piece, also one opened from a project (ADR-203, G-359): Update piece then replaces that project piece.
  const wizard = useDesign(
    (s) => (!s.project || !!s.editingItemId) && !s.templateEdit && !!s.design.wizard,
  );
  const close = () => setOpen(false);
  return (
    <Dialog
      inSheet={phone}
      open={open}
      onClose={close}
      title={t('Settings: {name}', { name })}
      info={
        inProject ? (
          <InfoTip label={t('About project settings')} align="start">
            {t('These apply to every piece in {name}.', { name })}
          </InfoTip>
        ) : undefined
      }
      wide
      footer={
        <button type="button" className="btn primary" onClick={close}>
          {t('Done')}
        </button>
      }
    >
      {open && (
        <div className="settings-body">
          {wizard && (
            <div className="wz-reopen">
              <span className="hint">{t('Made with the New-piece wizard.')}</span>
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  close();
                  onWizard();
                }}
              >
                <Icon name="pencil" className="sm" />
                {t('Open in wizard')}
              </button>
            </div>
          )}
          {inProject ? (
            <ProjectPanel mode="configure" onAdd={() => {}} />
          ) : (
            <>
              <Inspector mode="configure" />
              <div className="inspector boards">
                <MaterialsPanel />
                <FastenersPanel />
              </div>
            </>
          )}
          {/* This device's saved data and backup (ADR-133), the same in every Settings. */}
          <div className="inspector">
            <SavedDataPanel />
          </div>
        </div>
      )}
    </Dialog>
  );
}
