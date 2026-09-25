import { describe, expect, it } from 'vitest';
import { calculateBogoOffer, compareBogoOffers } from '../src/lib/bogo';

const promotion = (overrides: Partial<Parameters<typeof calculateBogoOffer>[0]> = {}) => ({
  pricePerItem: 10,
  buyQuantity: 1,
  getQuantity: 1,
  discountType: 'free' as const,
  discountPercent: '',
  quantity: 2,
  ...overrides,
});

describe('Buy X Get Y calculations', () => {
  it('calculates Buy 1 Get 1 Free', () => {
    const result = calculateBogoOffer(promotion())!;
    expect(result.checkoutTotal).toBe(10);
    expect(result.effectivePrice).toBe(5);
    expect(result.promotionSavings).toBe(10);
  });

  it('always treats Free as 100% off without a percentage value', () => {
    const result = calculateBogoOffer(promotion({ discountPercent: '' }))!;
    expect(result.checkoutTotal).toBe(10);
    expect(result.promotionSavings).toBe(10);
  });

  it('calculates Buy 2 Get 1 Free', () => {
    const result = calculateBogoOffer(promotion({ pricePerItem: 8, buyQuantity: 2, quantity: 3 }))!;
    expect(result.checkoutTotal).toBe(16);
    expect(result.effectivePrice).toBeCloseTo(5.333333);
    expect(result.completeGroups).toBe(1);
  });

  it('automatically calculates Buy 1 Get 1 50% Off without a custom percentage', () => {
    const result = calculateBogoOffer(promotion({ discountType: 'half', discountPercent: '', quantity: 2 }))!;
    expect(result.checkoutTotal).toBe(15);
    expect(result.effectivePrice).toBe(7.5);
    expect(result.promotionSavings).toBe(5);
  });

  it('ignores a stale custom percentage in 50% off mode', () => {
    const result = calculateBogoOffer(promotion({ discountType: 'half', discountPercent: 80 }))!;
    expect(result.checkoutTotal).toBe(15);
    expect(result.promotionSavings).toBe(5);
  });

  it('calculates a custom Percentage off promotion', () => {
    const result = calculateBogoOffer(promotion({ discountType: 'percent', discountPercent: 25 }))!;
    expect(result.checkoutTotal).toBe(17.5);
    expect(result.promotionSavings).toBe(2.5);
  });

  it('accepts 0% and charges every item at full price', () => {
    const result = calculateBogoOffer(promotion({ discountType: 'percent', discountPercent: 0 }))!;
    expect(result.checkoutTotal).toBe(20);
    expect(result.promotionSavings).toBe(0);
  });

  it('accepts 100% and makes the Get item free', () => {
    const result = calculateBogoOffer(promotion({ discountType: 'percent', discountPercent: 100 }))!;
    expect(result.checkoutTotal).toBe(10);
    expect(result.promotionSavings).toBe(10);
  });

  it('applies multiple complete promotional groups', () => {
    const result = calculateBogoOffer(promotion({ pricePerItem: 8, buyQuantity: 2, quantity: 6 }))!;
    expect(result.checkoutTotal).toBe(32);
    expect(result.completeGroups).toBe(2);
    expect(result.discountedItems).toBe(2);
  });

  it('charges incomplete-group items at full price', () => {
    const result = calculateBogoOffer(promotion({ pricePerItem: 8, buyQuantity: 2, quantity: 5 }))!;
    expect(result.completeGroups).toBe(1);
    expect(result.remainingItems).toBe(2);
    expect(result.fullPriceItems).toBe(4);
    expect(result.checkoutTotal).toBe(32);
    expect(result.effectivePrice).toBe(6.4);
  });

  it('charges one requested item at full price when no group is complete', () => {
    const result = calculateBogoOffer(promotion({ pricePerItem: 8, buyQuantity: 2, quantity: 1 }))!;
    expect(result.completeGroups).toBe(0);
    expect(result.remainingItems).toBe(1);
    expect(result.checkoutTotal).toBe(8);
    expect(result.promotionSavings).toBe(0);
  });

  it('compares the promotion against a regular sale', () => {
    const result = compareBogoOffers(promotion({ pricePerItem: 8, buyQuantity: 2, quantity: 3 }), { pricePerItem: 6, quantity: 3 })!;
    expect(result.checkoutWinner).toBe('a');
    expect(result.effectiveWinner).toBe('a');
    expect(result.checkoutDifference).toBe(2);
  });

  it('recognizes an equal-price tie', () => {
    const result = compareBogoOffers(promotion(), { pricePerItem: 5, quantity: 2 })!;
    expect(result.checkoutWinner).toBe('tie');
    expect(result.effectiveWinner).toBe('tie');
  });

  it('reports checkout and effective-price winners separately for different quantities', () => {
    const result = compareBogoOffers(promotion({ quantity: 4 }), { pricePerItem: 6, quantity: 2 })!;
    expect(result.sameQuantity).toBe(false);
    expect(result.checkoutWinner).toBe('b');
    expect(result.effectiveWinner).toBe('a');
  });

  it('handles decimal prices', () => {
    const result = calculateBogoOffer(promotion({ pricePerItem: 3.99 }))!;
    expect(result.checkoutTotal).toBeCloseTo(3.99);
    expect(result.effectivePrice).toBeCloseTo(1.995);
  });

  it.each([
    promotion({ pricePerItem: '' }),
    promotion({ pricePerItem: 0 }),
    promotion({ pricePerItem: -1 }),
    promotion({ buyQuantity: 0 }),
    promotion({ getQuantity: 1.5 }),
    promotion({ quantity: -2 }),
    promotion({ discountType: 'percent', discountPercent: '' }),
    promotion({ discountType: 'percent', discountPercent: -1 }),
    promotion({ discountType: 'percent', discountPercent: 101 }),
  ])('rejects blank, zero, fractional-quantity, negative, and excessive values', (input) => {
    expect(calculateBogoOffer(input)).toBeNull();
  });

  it('handles a large quantity without non-finite output', () => {
    const result = calculateBogoOffer(promotion({ pricePerItem: 0.01, buyQuantity: 3, getQuantity: 2, quantity: 1_000_003 }))!;
    expect(result.checkoutTotal).toBeCloseTo(6000.03);
    expect(Number.isFinite(result.effectivePrice)).toBe(true);
  });

  it('rejects inputs whose totals would overflow', () => {
    expect(calculateBogoOffer(promotion({ pricePerItem: 1e308, quantity: 2 }))).toBeNull();
  });
});
