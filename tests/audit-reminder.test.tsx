// @vitest-environment jsdom
// ADR-263 item 7: the backup reminder's Back up now opens Saved data when the backup fails (Saved data shows its
// error); a setting the device refuses to save is said.
import 'fake-indexeddb/auto';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/core/backupReminder', async (orig) => ({
  ...(await orig<typeof import('../src/core/backupReminder')>()),
  reminderDue: () => true,
}));
vi.mock('../src/persist/backup', async (orig) => ({
  ...(await orig<typeof import('../src/persist/backup')>()),
  folderAccess: () => true,
  folderState: async () => ({ permission: 'granted', name: 'Backups' }),
  backupNow: async () => ({ at: new Date().toISOString(), items: 0, error: 'The folder refused.' }),
  lastBackup: async () => undefined,
}));
const settings = vi.hoisted(() => ({ fail: false }));
vi.mock('../src/store/libraryStore', async (orig) => {
  const real = await orig<typeof import('../src/store/libraryStore')>();
  return {
    ...real,
    setSetting: (...a: Parameters<typeof real.setSetting>) =>
      settings.fail ? Promise.reject(new Error('QuotaExceededError')) : real.setSetting(...a),
  };
});

afterEach(() => cleanup());

describe('backup reminder (ADR-263)', () => {
  it('a failed Back up now opens Saved data', async () => {
    const { BackupReminder } = await import('../src/ui/SavedData');
    const { useUi } = await import('../src/store/uiStore');
    useUi.getState().setSavedDataOpen(false);
    render(<BackupReminder />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Back up now' }));
    await waitFor(() => expect(useUi.getState().savedDataOpen).toBe(true));
  });

  it('a reminder interval the device refuses to save is said', async () => {
    const { SavedDataPanel } = await import('../src/ui/SavedData');
    render(<SavedDataPanel />);
    settings.fail = true;
    const user = userEvent.setup();
    const select = (await screen.findByLabelText('Remind me to back up')) as HTMLSelectElement;
    await user.selectOptions(
      select,
      select.options[0].value === select.value ? select.options[1].value : select.options[0].value,
    );
    expect(await screen.findByText('The setting could not be saved on this device.')).toBeTruthy();
    settings.fail = false;
  });
});
