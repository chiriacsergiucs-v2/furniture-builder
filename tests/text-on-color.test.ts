import { describe, expect, it } from 'vitest';
import { textOnColor } from '../src/ui/Sheets';

describe('textOnColor', () => {
  it('gives dark text on light boards', () => {
    expect(textOnColor('#ffffff')).toBe('dark');
    expect(textOnColor('#ddd')).toBe('dark');
  });
  it('gives light text on dark boards', () => {
    expect(textOnColor('#000000')).toBe('light');
    expect(textOnColor('#3b2a1e')).toBe('light');
  });
  it('falls back to dark on anything that is not a hex colour', () => {
    expect(textOnColor('not a colour')).toBe('dark');
    expect(textOnColor('')).toBe('dark');
  });
});
