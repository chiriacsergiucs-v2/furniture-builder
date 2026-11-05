// ADR-181: each priced Shopping list row shows the unit price its total comes from; the CSV and the printed list
// have a Unit price column in the print language (ro, ru, en).
import { afterEach, describe, expect, it } from 'vitest';
import { setPrintLang } from '../src/core/i18n/print';
import {
  linePrice,
  unitPrice,
  type PriceEntry,
  type SellerLookup,
} from '../src/core/prices';
import { shoppingCsvRo, unitPricePrint, type ShopLine } from '../src/core/shopping';

const board: ShopLine = {
  section: 'boards',
  label: 'PAL alb',
  quantity: 2,
  unit: 'sheet',
  detail: '18 mm',
  priceKey: 'board:pal',
  sheets: 2,
  m2: 7.5,
};
const hinge: ShopLine = {
  section: 'hardware',
  label: 'Hinge',
  quantity: 4,
  unit: 'piece',
  detail: '',
  priceKey: 'hw:Hinge',
};
const map = (...e: PriceEntry[]) => new Map(e.map((p) => [p.id, p]));

afterEach(() => setPrintLang('ro'));

describe('unit price of a Shopping list row (ADR-181)', () => {
  it('a row priced per m² gives the entry amount per m², and the line total is unchanged', () => {
    const prices = map({ id: 'board:pal', unit: 'm2', amount: 4500 });
    expect(unitPrice(board, prices)).toEqual({ amount: 4500, per: 'm2' });
    expect(linePrice(board, prices)).toBe(Math.round(7.5 * 4500));
  });
  it('per sheet, per piece and per worktop board come from the stored entry', () => {
    expect(unitPrice(board, map({ id: 'board:pal', unit: 'sheet', amount: 25000 }))).toEqual({
      amount: 25000,
      per: 'sheet',
    });
    expect(unitPrice(hinge, map({ id: 'hw:Hinge', unit: 'piece', amount: 1200 }))).toEqual({
      amount: 1200,
      per: 'piece',
    });
    const wt: ShopLine = { ...board, worktop: true, priceKey: 'board:wt' };
    expect(unitPrice(wt, map({ id: 'board:wt', unit: 'piece', amount: 40000 }))).toEqual({
      amount: 40000,
      per: 'worktop',
    });
  });
  it('a row without a price (or with sheets not laid out) has no unit price', () => {
    expect(unitPrice(hinge, map())).toBeNull();
    const unlaid: ShopLine = { ...board, sheets: null };
    const prices = map({ id: 'board:pal', unit: 'sheet', amount: 25000 });
    expect(linePrice(unlaid, prices)).toBeNull();
    expect(unitPrice(unlaid, prices)).toBeNull();
  });
  it('a seller price is used as published: a board per piece is per sheet; hardware per piece', () => {
    const product = { seller: 's', id: 'p', name: 'P' };
    const seller: SellerLookup = () => ({ amount: 19900, unit: 'piece', seller: 'S', date: 'd' });
    const b: ShopLine = { ...board, priceKey: 'board:none', product };
    expect(unitPrice(b, map(), seller)).toEqual({ amount: 19900, per: 'sheet' });
    expect(unitPrice({ ...b, worktop: true }, map(), seller)).toEqual({
      amount: 19900,
      per: 'worktop',
    });
    const h: ShopLine = { ...hinge, product, per: 2 };
    expect(unitPrice(h, map(), seller)).toEqual({ amount: 19900, per: 'piece' });
    expect(linePrice(h, map(), seller)).toBe(4 * 2 * 19900);
    // The user's own price still wins.
    expect(unitPrice(h, map({ id: 'hw:Hinge', unit: 'piece', amount: 500 }), seller)).toEqual({
      amount: 500,
      per: 'piece',
    });
  });
});

describe('Unit price column in the CSV and the print, in ro, ru and en (ADR-181)', () => {
  const prices = map({ id: 'board:pal', unit: 'm2', amount: 4500 });
  const csv = () =>
    shoppingCsvRo(
      [board, hinge],
      (l) => linePrice(l, prices),
      'lei',
      (l) => unitPrice(l, prices),
    )
      .replace(/^﻿/, '')
      .split('\r\n');
  it.each([
    ['ro', 'Preț unitar (lei)', '45,00 / m²', '45,00 lei / m²'],
    ['ru', 'Цена за единицу (lei)', '45,00 / м²', '45,00 lei / м²'],
    ['en', 'Unit price (lei)', '45,00 / m²', '45,00 lei / m²'],
  ] as const)('%s', (lang, head, cell, print) => {
    setPrintLang(lang);
    const rows = csv();
    expect(rows[0]).toBe(`Secțiune;Articol;Cantitate;UM;Detalii;Preț (lei);${head}`);
    expect(rows[1]).toBe(`Plăci;PAL alb;2;plăci;18 mm;337,50;${cell}`);
    // No price: both cells empty.
    expect(rows[2]).toBe('Feronerie;Hinge;4;buc;;;');
    expect(unitPricePrint({ amount: 4500, per: 'm2' }, 'lei')).toBe(print);
  });
  it('every unit in each print language', () => {
    const per = ['sheet', 'm2', 'm', 'piece', 'worktop'] as const;
    const text = (l: 'ro' | 'ru' | 'en') => {
      setPrintLang(l);
      return per.map((p) => unitPricePrint({ amount: 100, per: p }, 'lei'));
    };
    expect(text('ro')).toEqual([
      '1,00 lei / placă',
      '1,00 lei / m²',
      '1,00 lei / m',
      '1,00 lei / buc',
      '1,00 lei / blat',
    ]);
    expect(text('ru')).toEqual([
      '1,00 lei / лист',
      '1,00 lei / м²',
      '1,00 lei / м',
      '1,00 lei / шт.',
      '1,00 lei / щит столешницы',
    ]);
    expect(text('en')).toEqual([
      '1,00 lei / sheet',
      '1,00 lei / m²',
      '1,00 lei / m',
      '1,00 lei / piece',
      '1,00 lei / worktop board',
    ]);
  });
  it('without a unit-price lookup the CSV is as before', () => {
    expect(shoppingCsvRo([board], (l) => linePrice(l, prices)).split('\r\n')[0]).toBe(
      '﻿Secțiune;Articol;Cantitate;UM;Detalii;Preț (lei)',
    );
  });
});
