// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { db, saveDesign, setSetting } from '../src/persist/db';
import { templates } from '../src/core/design';
import { BackupReminder, DeviceOnlyNotice, SavedDataPanel } from '../src/ui/SavedData';

// ADR-133, ADR-140, ADR-141: the Saved data panel, the device-only notice and the reminder, with the browser's storage
// API stubbed.
const stubStorage = (persisted: boolean, grant = false) =>
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: {
      persisted: async () => persisted,
      persist: async () => grant,
      estimate: async () => ({ usage: 2_500_000, quota: 1e9 }),
    },
  });

afterEach(async () => {
  cleanup();
  await db.settings.clear();
  await db.designs.clear();
});

describe('Settings › Saved data (ADR-133)', () => {
  it('shows "Not kept" with Keep saved data, and the browser’s refusal', async () => {
    stubStorage(false, false);
    render(<SavedDataPanel />);
    expect(await screen.findByText(/Not kept: the browser may clear saved data/)).toBeTruthy();
    expect(screen.getByText(/Space used: 2.5 MB/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Keep saved data' }));
    expect(await screen.findByText(/The browser said no/)).toBeTruthy();
  });
  it('shows "Kept" when the browser keeps data; without folder access offers a .zip and restore', async () => {
    stubStorage(true);
    render(<SavedDataPanel />);
    expect(await screen.findByText(/Kept: the browser will not clear/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download backup (.zip)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restore a .zip' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Choose backup folder' })).toBeNull();
    expect(screen.getByLabelText('Remind me to back up')).toBeTruthy();
  });
  it('shows the last backup', async () => {
    stubStorage(true);
    await setSetting('backup-status', { at: '2026-10-28T14:05:00.000Z', items: 23 });
    render(<SavedDataPanel />);
    expect(await screen.findByText(/Last backup: .* — 23 items/)).toBeTruthy();
  });
});

describe('device-only notice and reminder (ADR-140, ADR-141)', () => {
  it('the notice shows with saved items and no backup; Dismiss hides it', async () => {
    await saveDesign(templates[0].create());
    render(<DeviceOnlyNotice />);
    expect(await screen.findByText(/Your designs are only on this device/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/only on this device/)).toBeNull();
  });
  it('the reminder shows when the last backup is older than the interval', async () => {
    const old = new Date(Date.now() - 40 * 864e5).toISOString();
    await setSetting('backup-status', { at: old, items: 3 });
    await setSetting('last-change-at', new Date().toISOString());
    render(<BackupReminder />);
    expect(await screen.findByText('Last backup: 40 days ago.')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByText(/Last backup/)).toBeNull();
  });
});
