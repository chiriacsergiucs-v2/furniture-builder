import { describe, expect, it } from 'vitest';
import { csvLines, csvSeparator } from '../src/core/csv';

describe('CSV import start (G-570 M10)', () => {
  it('drops the byte-order mark and blank lines, any line ending', () => {
    expect(csvLines('\uFEFFa;b\r\n\r\n1;2\n  \n3;4')).toEqual(['a;b', '1;2', '3;4']);
    expect(csvLines('')).toEqual([]);
  });
  it('picks the separator the header uses most', () => {
    expect(csvSeparator('a;b;c')).toBe(';');
    expect(csvSeparator('a,b,c')).toBe(',');
    expect(csvSeparator('a;b,c')).toBe(',');
    expect(csvSeparator('abc')).toBe(',');
  });
});
