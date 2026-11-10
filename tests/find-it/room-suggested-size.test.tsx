// @vitest-environment jsdom
// Find-it for ADR-232 (N237), in jsdom (ADR-108), at 1280 and 390 px, from the bare app by role and visible text:
// a new project with a sideboard → Add the room → the room's summary shows the same suggested size as before the
// room auto-size moved from RoomSection into core (`suggestRoomSize`).
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { projectWithRoom, renderApp, WIDTHS } from './setup';

describe.each(WIDTHS)('room suggested size at %ipx (find-it, ADR-232)', (width) => {
  it('Add the room → Rectangle · 3000 × 3000 × 2500 mm, as before', async () => {
    const { user } = await renderApp(width);
    await projectWithRoom(user, 'Sideboard');
    const room = screen.getByRole('region', { name: 'Room' });
    expect(within(room).getByText('Rectangle · 3000 × 3000 × 2500 mm')).toBeTruthy();
  });
});
