import { Fragment, type ReactNode } from 'react';
import { t, type Key } from '../core/i18n';

/**
 * A translated sentence with elements inside (ADR-153): `{name}` placeholders take React nodes, so
 * `tNode('Tap {add} to start', { add: <strong>{t('Add')}</strong> })` keeps the element in either language.
 */
export function tNode(key: Key, nodes: Record<string, ReactNode>): ReactNode {
  const text = t(key);
  const parts = text.split(/\{(\w+)\}/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? <Fragment key={i}>{p in nodes ? nodes[p] : `{${p}}`}</Fragment> : p,
  );
}
