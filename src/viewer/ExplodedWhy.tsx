import { t } from '@furniture-builder/i18n';
import { useDesign } from '../store/designStore';

/**
 * Why Move or Adjust wall picture is off while Exploded 3D is on, as visible text (touch has no tooltip, F-04). One
 * line per control, placed right after it in the tool row so the reason sits beside the disabled button (G-522).
 * Same wording as the buttons' `title`.
 */
export function ExplodedWhy({ tool }: { tool: 'move' | 'picture' }) {
  const exploded = useDesign((s) => s.exploded);
  if (!exploded) return null;
  return (
    <p className="hint three-why">
      {tool === 'move'
        ? t('Turn off Exploded 3D to move pieces')
        : t('Turn off Exploded 3D to adjust a wall picture')}
    </p>
  );
}
