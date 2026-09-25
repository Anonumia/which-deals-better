import { describe, expect, it } from 'vitest';
import { calculateTip, calculateTipOptions } from '../src/lib/tip';

describe('tip calculations', () => {
  it.each([
    [15, 6.30, 48.30],
    [18, 7.56, 49.56],
    [20, 8.40, 50.40],
  ])('calculates a %i%% tip', (percentage, tip, total) => {
    expect(calculateTip(42, percentage)).toEqual({ bill: 42, percentage, tip, total });
  });

  it('supports decimal bill amounts', () => {
    const result = calculateTip(37.65, 18)!;
    expect(result.tip).toBeCloseTo(6.777);
    expect(result.total).toBeCloseTo(44.427);
  });

  it('returns all three preset options together for a decimal bill', () => {
    const results = calculateTipOptions(79.99)!;
    expect(results.map(({ percentage }) => percentage)).toEqual([15, 18, 20]);
    expect(results.map(({ bill }) => bill)).toEqual([79.99, 79.99, 79.99]);
    expect(results[0].tip).toBeCloseTo(11.9985);
    expect(results[0].total).toBeCloseTo(91.9885);
    expect(results[1].tip).toBeCloseTo(14.3982);
    expect(results[1].total).toBeCloseTo(94.3882);
    expect(results[2].tip).toBeCloseTo(15.998);
    expect(results[2].total).toBeCloseTo(95.988);
  });

  it.each(['', 0, -1, Number.POSITIVE_INFINITY])('does not produce options for an invalid bill', (bill) => {
    expect(calculateTipOptions(bill)).toBeNull();
  });

  it.each([
    ['', 15],
    [0, 18],
    [-10, 20],
    [Number.POSITIVE_INFINITY, 15],
    [42, ''],
    [42, 25],
  ])('rejects blank, zero, negative, non-finite, and unsupported values', (bill, percentage) => {
    expect(calculateTip(bill, percentage)).toBeNull();
  });
});
