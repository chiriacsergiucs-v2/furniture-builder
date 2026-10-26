import { useDesign } from '../store/designStore';
import { Dialog, MaterialsPanel } from './Dialogs';
import { FastenersPanel } from './Fasteners';
import { Inspector } from './Inspector';
import { ProjectPanel } from './Project';
import { Icon } from './icons';
import { useUi } from './shell/uiStore';

/**
 * Settings (ADR-080): everything that was the Configure mode (ADR-079), in a dialog. A project shows what applies
 * to the whole project; a piece (also one opened from a project) shows its size, construction, boards and drawers.
 * Changes apply at once, as before: one undo step each, autosaved and checked.
 */
export function SettingsDialog({ onWizard }: { onWizard: () => void }) {
  const open = useUi((s) => s.settingsOpen);
  const setOpen = useUi((s) => s.setSettingsOpen);
  const inProject = useDesign((s) => !!s.project && !s.editingItemId);
  const name = useDesign((s) => (s.project && !s.editingItemId ? s.project.name : s.design.name));
  const wizard = useDesign(
    (s) => !s.project && !s.templateEdit && !s.editingItemId && !!s.design.wizard,
  );
  const close = () => setOpen(false);
  return (
    <Dialog
      open={open}
      onClose={close}
      title={`Settings: ${name}`}
      wide
      footer={
        <button type="button" className="btn primary" onClick={close}>
          Done
        </button>
      }
    >
      {open && (
        <div className="settings-body">
          {wizard && (
            <div className="wz-reopen">
              <span className="hint">Made with the New-piece wizard.</span>
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  close();
                  onWizard();
                }}
              >
                <Icon name="pencil" className="sm" />
                Open in wizard
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
        </div>
      )}
    </Dialog>
  );
}

/**
 * A project piece's own settings (ADR-090): size, construction, boards and drawers, edited from the project editor
 * without opening the piece. The piece is the one loaded for edits there (ADR-088); each change is one project undo
 * step.
 */
export function PieceSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const name = useDesign((s) => s.design.name);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Size, boards and construction: ${name}`}
      wide
      footer={
        <button type="button" className="btn primary" onClick={onClose}>
          Done
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
