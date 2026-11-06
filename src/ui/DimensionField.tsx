import type { ComponentProps } from 'react';
import { t } from '../core/i18n';
import type { SizeAxis } from '../core/project';
import { axesText, isAxisLocked } from '../core/sizeLock';
import { useDesign } from '../store/designStore';
import { MmField } from './controls';
import { DesignBindButton, designBindingHint } from './Variables';

/**
 * Settings uses the same axis locks as Compose (ADR-199). Indirect size edits remain guarded by the store. The ƒ
 * button binds the size to the piece's own variables (ADR-210); a bound size is off and says what it follows.
 */
export function DimensionField({
  axis,
  disabled,
  hint,
  ...props
}: ComponentProps<typeof MmField> & { axis: SizeAxis }) {
  const locked = useDesign((s) =>
    isAxisLocked(
      s.project?.items.find((i) => i.id === (s.editingItemId ?? s.drillItemId)),
      axis,
    ),
  );
  const bound = useDesign((s) => designBindingHint(s.design, axis));
  return (
    <MmField
      {...props}
      disabled={disabled || locked || !!bound}
      hint={
        locked ? t('{axes} locked — unlock to change', { axes: axesText([axis]) }) : (bound ?? hint)
      }
      trailing={<DesignBindButton target={axis} />}
    />
  );
}
