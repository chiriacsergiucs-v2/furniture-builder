import { useSyncExternalStore } from 'react';

// The Clearances toggle is shared by the plan and the 3D view (ADR-205): one switch shows the zones in both. A view
// setting for this page only, never saved in the project.
let clearancesOn = false;
const clearanceListeners = new Set<() => void>();
function setClearances(v: boolean) {
  clearancesOn = v;
  clearanceListeners.forEach((f) => f());
}
const subscribeClearances = (l: () => void) => {
  clearanceListeners.add(l);
  return () => clearanceListeners.delete(l);
};
/** Whether Clearances is on, and its setter (ADR-073 on the plan, ADR-205 in 3D). */
export function useClearances(): [boolean, (v: boolean) => void] {
  return [
    useSyncExternalStore(
      subscribeClearances,
      () => clearancesOn,
      () => false,
    ),
    setClearances,
  ];
}
