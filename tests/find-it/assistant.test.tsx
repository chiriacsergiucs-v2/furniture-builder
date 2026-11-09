// @vitest-environment jsdom
// Find-it for the assistant (ADR-239, ADR-240), in jsdom (ADR-108): from the bare app, by role and visible text, at
// 1280 and 390 px. The build has a backend URL; the backend is the in-memory one (`src/online/fake.ts`) with a
// scripted assistant, so nothing leaves the test.
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openMore, renderApp, WIDTHS } from './setup';

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_test');
});
afterEach(() => vi.unstubAllEnvs());

describe.each(WIDTHS)('the assistant at %ipx (find-it, ADR-239, ADR-240)', (width) => {
  it('bare app → piece → More › Assistant → switch → consent → request → change list → Apply', async () => {
    const { user } = await renderApp(width);
    localStorage.clear();
    const { fakeBackend, fakeServer } = await import('../../src/online/fake');
    const client = await import('../../src/online/client');
    const { rememberAccount } = await import('../../src/store/accountStore');
    const { useAssistant } = await import('../../src/store/assistantStore');
    useAssistant.setState({ enabled: false, consented: false, lines: [], preview: null });
    const server = fakeServer();
    server.assistant = () => ({
      kind: 'plan',
      summary: 'Width to 1000 mm.',
      calls: [{ action: 'resizePiece', args: { key: 'width', value: 1000 } }],
    });
    const backend = fakeBackend(server);
    client.setBackend(backend);
    const res = await backend.signUp('a@example.com', 'long-password-1');
    if (!res.ok) throw new Error('sign up');
    rememberAccount(res.user);

    await user.click(await screen.findByRole('button', { name: 'New single piece' }));
    const pick = await screen.findByRole('dialog');
    await user.click(within(pick).getAllByRole('button', { name: /Sideboard/ })[0]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // More › Assistant opens the dialog with the switch off and nothing sent.
    await openMore(user);
    await user.click(screen.getByRole('button', { name: /^Assistant/ }));
    const dlg = within(await screen.findByRole('dialog', { name: 'Assistant' }));
    expect(dlg.getByText('The assistant is off. Nothing is sent anywhere.')).toBeTruthy();

    // The switch shows the consent first; nothing is sent before Accept.
    await user.click(dlg.getByRole('checkbox', { name: 'Use the assistant on this device' }));
    expect(dlg.getByText(/passes them to an AI model provider \(Anthropic\)/)).toBeTruthy();
    expect(server.assistantCalls ?? []).toEqual([]);
    await user.click(dlg.getByRole('button', { name: 'Accept and start' }));

    // A typed request shows the summary, the change list, Apply and Discard.
    await user.type(dlg.getByLabelText('Your request'), 'make it 1000 wide');
    await user.click(dlg.getByRole('button', { name: 'Send' }));
    const card = within(await dlg.findByRole('region', { name: 'Proposed change' }));
    expect(card.getByText('Width to 1000 mm.')).toBeTruthy();
    expect(card.getByText(/→ 1000/)).toBeTruthy();
    expect(card.getByRole('button', { name: 'Discard' })).toBeTruthy();
    await user.click(card.getByRole('button', { name: 'Apply' }));
    expect(await dlg.findByText('Applied. Undo takes it back in one step.')).toBeTruthy();
    expect(server.assistantCalls).toHaveLength(1);
  });
});
