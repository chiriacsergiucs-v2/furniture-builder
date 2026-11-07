import { useRef, useState } from 'react';
import { t } from '../core/i18n';
import { Icon } from './icons';
import { fileName } from './shell/files';
import { useUi } from '../store/uiStore';

/**
 * The 3D toolbar's ⋯ beside Render (ADR-206): Export scene (.glb). The exporter (three's GLTFExporter) is loaded only
 * when it is pressed; it reads the scene the 3D view shows and the file is saved on this device (ADR-002, ADR-014).
 */
export function SceneMenu({ name }: { name: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const setNotice = useUi((s) => s.setNotice);
  const exportGlb = async () => {
    ref.current?.removeAttribute('open');
    setBusy(true);
    try {
      const { exportSceneGlb } = await import('../viewer/exportScene');
      const blob = await exportSceneGlb();
      const file = `${fileName(name)}-scene.glb`;
      const url = URL.createObjectURL(blob);
      Object.assign(document.createElement('a'), { href: url, download: file }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice({ ok: true, text: t('Saved {name}.', { name: file }) });
    } catch (e) {
      setNotice({
        ok: false,
        text: t('The scene could not be exported: {message}', {
          message: e instanceof Error ? e.message : String(e),
        }),
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="menu scene-menu" ref={ref}>
      <summary className="btn sm" aria-label={t('More 3D actions')} title={t('More 3D actions')}>
        <Icon name="more" className="sm" />
      </summary>
      <div className="menu-items">
        <button type="button" disabled={busy} onClick={() => void exportGlb()}>
          <Icon name="download" />
          {t('Export scene (.glb)')}{' '}
          <small>{t('the 3D scene with its pictures, for Blender')}</small>
        </button>
      </div>
    </details>
  );
}
