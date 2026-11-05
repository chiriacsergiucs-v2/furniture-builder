import type { ComponentProps } from 'react';
import { t } from '../core/i18n';
import type { SizeAxis } from '../core/project';
import { axesText, isAxisLocked } from '../core/sizeLock';
import { useDesign } from '../store/designStore';
import { MmField } from './controls';

/** Settings uses the same axis locks as Compose (ADR-199). Indirect size edits remain guarded by the store. */
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
  return (
    <MmField
      {...props}
      disabled={disabled || locked}
      hint={locked ? t('{axes} locked — unlock to change', { axes: axesText([axis]) }) : hint}
    />
  );
}
