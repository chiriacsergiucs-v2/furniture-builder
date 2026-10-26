import { useEffect, useState } from 'react';

/** Whether a CSS media query matches now; follows changes (rotation, resizing). */
export function useMediaQuery(q: string) {
  const [match, setMatch] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia(q).matches,
  );
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setMatch(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return match;
}
