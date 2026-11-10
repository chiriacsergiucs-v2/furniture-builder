// @vitest-environment jsdom
// ADR-253 (Sizing) and ADR-256 (Hardware), the parts that need no app around them: MmField's draft and commitSame,
// PieceSize's lock note, the group's "Kept:" text in Russian, and tr() filling name placeholders.
import 'fake-indexeddb/auto';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MmField } from '../src/ui/controls';
import { PieceSize } from '../src/ui/PieceSize';
import { loadDictionary, setLang, tr } from '../src/core/i18n';

afterEach(() => {
  cleanup();
  setLang('en');
});
beforeAll(() => loadDictionary('ru'));

describe('MmField (ADR-253)', () => {
  it('commitSame commits the shown value even when it equals the value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MmField label="Width" value={600} onChange={onChange} commitSame />);
    const f = screen.getByLabelText('Width');
    await user.click(f);
    await user.tab();
    expect(onChange).toHaveBeenCalledWith(600);
  });

  it('an invalid draft is not committed and keeps its error after Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MmField label="Width" value={600} min={1} max={1000} onChange={onChange} />);
    const f = screen.getByLabelText('Width') as HTMLInputElement;
    await user.clear(f);
    await user.type(f, '5000{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(f.value).toBe('5000');
    expect(screen.getByText('Whole number from 1 to 1000.')).toBeTruthy();
    await user.type(f, '{Escape}');
    expect(f.value).toBe('600');
  });
});

describe('PieceSize lock note (ADR-253)', () => {
  it('a bed names its locked mattress field; a lock on a size it lacks shows no note', () => {
    const bed = {
      kind: 'frame',
      params: {
        kind: 'bed',
        width: 1500,
        height: 900,
        depth: 2100,
        bed: { mattress: { w: 1400, l: 2000 } },
      },
    } as never;
    render(<PieceSize product={bed} onChange={() => {}} lockedKeys={['width']} />);
    expect(screen.getByRole('note').textContent).toMatch(/^Mattress width locked/);
    cleanup();
    render(<PieceSize product={bed} onChange={() => {}} lockedKeys={['height']} />);
    expect(screen.queryByRole('note')).toBeNull();
  });
});

describe('names in placeholders (ADR-256)', () => {
  it('Flap fitting and Screws labels translate around the user’s words', () => {
    setLang('ru');
    expect(tr('Flap fitting: Aventos HK')).not.toBe('Flap fitting: Aventos HK');
    expect(tr('Flap fitting: Aventos HK')).toMatch(/Aventos HK/);
    expect(tr('Screws: Side to Top')).not.toBe('Screws: Side to Top');
  });
});
