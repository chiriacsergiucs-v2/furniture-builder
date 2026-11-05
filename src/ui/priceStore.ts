/**
 * The user's price list on this device (ADR-062), read once and shared by the Shopping list and the running estimate
 * chip (ADR-172), so a price saved on the list reaches the chip at once. Nothing here leaves the device.
 */
import { create } from 'zustand';
import type { PriceEntry } from '../core/prices';
import { listPrices, savePrice } from '../persist/db';

interface PriceStore {
  prices: PriceEntry[];
  /** 'idle' until the first read, 'ready' after it, 'failed' when the browser refused. */
  state: 'idle' | 'loading' | 'ready' | 'failed';
  load: () => void;
  /** Read the list again (after a CSV import). */
  reload: () => Promise<void>;
  /** Keep one price here and on the device; the returned promise rejects when the device refused. */
  setPrice: (e: PriceEntry) => Promise<void>;
}

export const usePrices = create<PriceStore>((set, get) => ({
  prices: [],
  state: 'idle',
  load: () => {
    if (get().state !== 'idle') return;
    set({ state: 'loading' });
    void get().reload();
  },
  reload: async () => {
    try {
      set({ prices: await listPrices(), state: 'ready' });
    } catch {
      set({ state: 'failed' });
    }
  },
  setPrice: (e) => {
    set({ prices: [...get().prices.filter((p) => p.id !== e.id), e] });
    return savePrice(e).then(() => undefined);
  },
}));
