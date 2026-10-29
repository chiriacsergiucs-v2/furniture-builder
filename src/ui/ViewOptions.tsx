import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../core/i18n';
import { Icon } from './icons';

/**
 * The view tools behind one "Options" button on a phone, in Compose and Build & Preview alike (ADR-144), so the
 * drawing and the 3D view keep their height; Escape and a tap outside close it. Elsewhere they are shown as they are.
 * Fronts, Select, Move and Turn 90° stay outside it (`PHONE_INLINE`, G-269).
 */
export function ViewOptions({ menu, children }: { menu: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => ref.current?.removeAttribute('open');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current?.open) {
        close();
        ref.current?.querySelector('summary')?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) close();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [menu]);
  if (!menu) return <>{children}</>;
  return (
    <details className="menu view-options" ref={ref}>
      <summary>
        {t('Options')}
        <Icon name="chevron-down" className="sm" />
      </summary>
      <div className="view-options-panel" role="group" aria-label={t('View options')}>
        {children}
      </div>
    </details>
  );
}
