import { describe, expect, it } from 'vitest';
import { calculateTip } from '../src/lib/tip';

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
