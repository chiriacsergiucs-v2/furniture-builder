import { Component, lazy, Suspense, type ReactNode } from 'react';
import { t } from '@furniture-builder/i18n';
import { Icon } from '../icons';
import { CountStepper } from '../CountStepper';
import { MoveToButtons } from '../MoveTo';

const Viewer3D = lazy(() => import('../../viewer/Viewer3D'));
// What the 3D view draws from the ui (ADR-230: the viewer imports nothing from src/ui).
const countCard = (className: string) => <CountStepper className={className} foldable />;
const moveTo = (id: string | readonly string[], className: string) => (
  <MoveToButtons id={id} className={className} />
);

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <NoViewer /> : this.props.children;
  }
}
const NoViewer = () => (
  <div className="no-3d">
    <p className="empty center">
      <Icon name="cube" />
      {t('3D preview is not available in this browser. The front view and parts list still work.')}
    </p>
  </div>
);

/** The 3D view's box content: the lazy viewer while mounted (ADR-014), or why there is none. */
export function ViewerSlot({
  mount,
  has3d,
  countDock,
}: {
  mount: boolean;
  has3d: boolean;
  countDock: HTMLDivElement | null;
}) {
  return mount ? (
    <ViewerBoundary>
      <Suspense
        fallback={
          <div className="no-3d">
            <p className="loading">{t('Loading 3D…')}</p>
          </div>
        }
      >
        <Viewer3D countCard={countCard} moveTo={moveTo} countDock={countDock} />
      </Suspense>
    </ViewerBoundary>
  ) : has3d ? null : (
    <NoViewer />
  );
}
