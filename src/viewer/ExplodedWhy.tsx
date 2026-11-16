import { t } from '../core/i18n';
import { useDesign } from '../store/designStore';

/**
 * Why Move and Adjust wall picture are off while Exploded 3D is on, as visible text (touch has no tooltip, F-04).
 * Same wording as the buttons' `title`.
 */
export function ExplodedWhy({ pieces, picture }: { pieces: boolean; picture: boolean }) {
  const exploded = useDesign((s) => s.exploded);
  if (!exploded) return null;
  return (
    <>
      {pieces && <p className="hint three-why">{t('Turn off Exploded 3D to move pieces')}</p>}
      {picture && (
        <p className="hint three-why">{t('Turn off Exploded 3D to adjust a wall picture')}</p>
      )}
    </>
  );
}
