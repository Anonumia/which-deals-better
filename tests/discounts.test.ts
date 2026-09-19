import { describe, expect, it } from 'vitest';
import { calculateDiscountOffer, compareDiscountOffers } from '../src/lib/discounts';

const offer = (regularPrice: unknown, couponType: 'none'|'percent'|'fixed' = 'none', couponValue: unknown = 0, extras = {}) => ({ name:'', regularPrice, salePrice:'', couponType, couponValue, quantity:1, itemsPerPackage:1, ...extras });

describe('discount calculations', () => {
  it('calculates percentage-off savings', () => expect(calculateDiscountOffer(offer(30, 'percent', 20))).toMatchObject({ finalTotal:24, savings:6 }));
  it('calculates one fixed discount against the offer total', () => expect(calculateDiscountOffer(offer(10, 'fixed', 5, { quantity:2 }))).toMatchObject({ regularTotal:20, finalTotal:15, savings:5 }));
  it('applies coupons to an entered sale price', () => expect(calculateDiscountOffer(offer(20, 'percent', 25, { salePrice:16 }))).toMatchObject({ finalTotal:12, savings:8 }));
  it('calculates effective price across packages and multipack items', () => expect(calculateDiscountOffer(offer(12, 'none', 0, { quantity:2, itemsPerPackage:6 }))?.effectivePrice).toBe(2));
  it('never returns a negative final price', () => expect(calculateDiscountOffer(offer(4, 'fixed', 10))?.finalTotal).toBe(0));
  it('compares dollar-off with percentage-off', () => { const result = compareDiscountOffers([offer(30, 'percent', 20), offer(30, 'fixed', 5)]); expect(result.status).toBe('winner'); expect(result.winnerIndexes).toEqual([0]); expect(result.difference).toBe(1); });
  it('handles equal final prices as a tie', () => expect(compareDiscountOffers([offer(20, 'percent', 25), offer(20, 'fixed', 5)]).status).toBe('tie'));
  it.each([offer('', 'none'), offer(10, 'percent', 101), offer(10, 'none', 0, { quantity:1.5 })])('rejects malformed offer data', (input) => expect(calculateDiscountOffer(input)).toBeNull());
});
