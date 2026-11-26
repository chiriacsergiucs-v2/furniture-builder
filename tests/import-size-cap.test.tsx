// @vitest-environment jsdom
// The prices, bands, decors, templates and gap-marks importers refuse a file over MAX_IMPORT_BYTES before reading it (G-564).
import { describe, expect, it } from 'vitest';
import { MAX_IMPORT_BYTES } from '../src/ui/shell/importFile';
import { importFile } from '../src/ui/shell/importFile';

describe('the import size cap (G-564)', () => {
  it('is 20 MB and importFile refuses a larger file with the shared message', async () => {
    expect(MAX_IMPORT_BYTES).toBe(20_000_000);
    const f = new File(['{}'], 'big.json');
    Object.defineProperty(f, 'size', { value: MAX_IMPORT_BYTES + 1 });
    const r = await importFile(f);
    expect(r.message?.text).toBe('That file is too large to import (over 20 MB).');
  });
});
