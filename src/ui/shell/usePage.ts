import { useCallback, useEffect, useState } from 'react';

export type Page = 'projects' | 'editor' | 'catalog' | 'gaps' | 'info' | 'optimizer';
const PAGES: Page[] = ['projects', 'editor', 'catalog', 'gaps', 'info', 'optimizer'];
const pageFromHash = (): Page =>
  typeof location === 'undefined'
    ? 'projects'
    : (PAGES.find((p) => location.hash === `#${p}`) ?? 'projects');

/**
 * The three places (ADR-078), linkable: the bare address and #projects open Projects, #editor the editor, #catalog
 * the Catalog (ADR-032); #gaps the gaps ledger (ADR-101), reached from the ⋯ menu, #info Information and guides (ADR-158)
 * and #optimizer the standalone cut list optimizer. The setter keeps its identity, so memoised children keep theirs
 * (G-500).
 */
export function usePage(): [Page, (p: Page) => void] {
  const [page, setPage] = useState<Page>(pageFromHash);
  useEffect(() => {
    const on = () => setPage(pageFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((p: Page) => {
    if (p === 'projects') history.replaceState(null, '', location.pathname + location.search);
    else location.hash = p;
    setPage(p);
    window.scrollTo({ top: 0 });
  }, []);
  return [page, go];
}
