import { useEffect } from 'react';
import { useUi } from '../../store/uiStore';
import { PrintAssembly } from '../Assembly';
import { PrintClient } from '../PrintClient';
import { PrintSheet } from '../PrintSheet';

/** Render the print sheet, open the print dialog, then remove it again (ADR-020). */
export function PrintHost() {
  const printing = useUi((s) => s.printing);
  const printMode = useUi((s) => s.printMode);
  const setPrinting = useUi((s) => s.setPrinting);
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done, { once: true });
    // Wait for fonts: the Romanian glyphs (ș, ț, ă) load on first use, i.e. only when the print sheet appears.
    const glyphs = ['400', '500', '600'].map((w) =>
      document.fonts.load(`${w} 1em Barlow`, 'șțăîâȘȚĂÎÂ'),
    );
    const t = setTimeout(() => {
      void Promise.all(glyphs)
        .then(() => document.fonts.ready)
        .then(() => window.print());
    }, 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
    };
  }, [printing, setPrinting]);
  if (!printing) return null;
  return printMode === 'assembly' ? (
    <PrintAssembly />
  ) : printMode === 'client' ? (
    <PrintClient />
  ) : (
    <PrintSheet />
  );
}
