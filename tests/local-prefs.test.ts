// @vitest-environment jsdom
// G-570 M8: one read and write for device preferences in localStorage; blocked storage never throws.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLocal, writeLocal } from '../src/persist/localPrefs';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('localPrefs', () => {
  it('writes, reads through parse and removes on null', () => {
    expect(writeLocal('fb:test', 'on')).toBe(true);
    expect(readLocal('fb:test', (v) => v === 'on', false)).toBe(true);
    expect(writeLocal('fb:test', null)).toBe(true);
    expect(readLocal('fb:test', (v) => v, 'blocked')).toBeNull();
  });
  it('gives the blocked value and false when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readLocal('fb:test', (v) => v === 'on', true)).toBe(true);
    expect(writeLocal('fb:test', 'on')).toBe(false);
  });
  it('gives the blocked value when parse throws', () => {
    localStorage.setItem('fb:test', '{bad');
    expect(readLocal('fb:test', (v) => JSON.parse(v!) as unknown, 'fallback')).toBe('fallback');
  });
});
