/**
 * The subscriber list every small external-store hook needs (`useSyncExternalStore`): `subscribe` adds a listener and
 * returns its remover, `notify` calls every listener. One place, so the hooks (`useLook`, `useSnap`, …) share it.
 */
export function createListeners() {
  const listeners = new Set<() => void>();
  return {
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    notify() {
      listeners.forEach((f) => f());
    },
  };
}
