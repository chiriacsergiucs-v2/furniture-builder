import { useEffect, useLayoutEffect, useRef } from 'react';

/** The history entry the open phone card added (ADR-295) is the current one. */
const onCardEntry = () => !!(history.state as { fbCard?: number } | null)?.fbCard;

/**
 * Back closes the open card (ADR-295): opening it adds one history entry; closing it any other way takes that entry
 * back, once. Never more than one entry, and a back that is ours is never read as a close twice.
 * `cardEntry` says we stand on our entry, whatever its state now holds: code that replaces the state while the card
 * is open (the projects page, share and open links, sign-in) must not leave the entry behind. `pendingBack` holds
 * the address to keep while our own history.back() is on its way, so its popstate is never read as a Back, a reopen
 * in the meantime pushes after it lands, and an address replaced on our entry stays the address after the back.
 * Moved out of App unchanged (G-500); `close` closes the card.
 */
export function useCardHistory(cardUp: boolean, close: () => void) {
  const cardEntry = useRef(false);
  const pendingBack = useRef<string | null>(null);
  const cardUpNow = useRef(cardUp);
  const closeRef = useRef(close);
  useLayoutEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    // A reload with the card open lands on our old entry: it is a plain entry now.
    if (onCardEntry()) history.replaceState(null, '');
  }, []);
  useEffect(() => {
    cardUpNow.current = cardUp;
    if (cardUp && !cardEntry.current) {
      if (pendingBack.current !== null) return; // pushed once our back lands (popstate below)
      cardEntry.current = true;
      history.pushState({ fbCard: 1 }, '');
    } else if (!cardUp && cardEntry.current) {
      cardEntry.current = false;
      const keep = location.href;
      pendingBack.current = keep;
      history.back();
      // A back whose popstate never arrives must not block later entries (re-review of ADR-295, N3).
      window.setTimeout(() => {
        if (pendingBack.current === keep) pendingBack.current = null;
      }, 600);
    }
  }, [cardUp]);
  useEffect(() => {
    const onPop = () => {
      if (pendingBack.current !== null) {
        const keep = pendingBack.current;
        pendingBack.current = null;
        if (location.href !== keep) history.replaceState(history.state, '', keep);
        if (cardUpNow.current) {
          cardEntry.current = true;
          history.pushState({ fbCard: 1 }, '');
        }
        return;
      }
      if (!cardEntry.current) {
        // Forward onto an entry of a card that is closed: make it a plain entry.
        if (onCardEntry()) history.replaceState(null, '');
        return;
      }
      if (onCardEntry()) return;
      cardEntry.current = false;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
}
