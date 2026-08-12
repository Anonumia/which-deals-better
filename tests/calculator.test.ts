import { describe, expect, it } from 'vitest';
import { compareDeals, initialPackageCount, packageMultiplier } from '../src/lib/calculator';
const deal = (price: unknown, quantity: unknown, unit = 'oz', packages: unknown = 1) => ({ price, quantity, unit, packages });

describe('calculator comparison', () => {
  it('treats a single product as multiplier 1', () => expect(packageMultiplier(false, '')).toBe(1));
  it('uses number in pack when multipack is enabled', () => expect(packageMultiplier(true, 24)).toBe(24));
  it('starts the desktop multipack count blank without changing the mobile default', () => {
    expect(initialPackageCount(false)).toBe('');
    expect(initialPackageCount(true)).toBe('1');
  });
  it('does not substitute 1 for a blank enabled multipack', () => expect(packageMultiplier(true, '')).toBe(''));
  it('returns to multiplier 1 when multipack is disabled', () => { expect(packageMultiplier(true, 12)).toBe(12); expect(packageMultiplier(false, 12)).toBe(1); });
  it('compares the same unit and calculates the advantage', () => { const r = compareDeals([deal(10,20),deal(9,15)]); expect(r.winners[0].index).toBe(0); expect(r.advantagePercent).toBeCloseTo(16.6667,3); });
  it('converts oz and lb', () => expect(compareDeals([deal(5,16,'oz'),deal(4,1,'lb')]).winners[0].index).toBe(1));
  it('converts g and kg', () => expect(compareDeals([deal(5,500,'g'),deal(8,1,'kg')]).winners[0].index).toBe(1));
  it('converts mL and L', () => expect(compareDeals([deal(3,500,'ml'),deal(5,1,'l')]).winners[0].index).toBe(1));
  it('converts fl oz and gallon', () => expect(compareDeals([deal(2,16,'fl-oz'),deal(10,1,'gallon')]).winners[0].index).toBe(1));
  it('converts length units', () => expect(compareDeals([deal(6,3,'foot'),deal(5,30,'inch')]).winners[0].index).toBe(0));
  it('normalizes count labels', () => expect(compareDeals([deal(10,40,'pod'),deal(14,62,'pod')]).winners[0].index).toBe(1));
  it('calculates multipacks', () => expect(compareDeals([deal(12,12,'fl-oz',2),deal(13,20,'fl-oz',1)]).winners[0].index).toBe(0));
  it('compares three deals', () => expect(compareDeals([deal(3,10),deal(5,20),deal(8,40)]).winners[0].index).toBe(2));
  it('compares five deals', () => expect(compareDeals([deal(5,10),deal(5,11),deal(5,12),deal(5,13),deal(5,14)]).winners[0].index).toBe(4));
  it('handles a tie', () => expect(compareDeals([deal(5,10),deal(10,20)]).status).toBe('tie'));
  it('handles incomplete input', () => expect(compareDeals([deal('', ''),deal('', '')]).status).toBe('incomplete'));
  it('does not calculate when an enabled multipack count is blank', () => {
    const result = compareDeals([deal(10, 20, 'oz', packageMultiplier(true, '')), deal(12, 20)]);
    expect(result.status).toBe('invalid');
    expect(result.deals).toEqual([]);
    expect(result.winners).toEqual([]);
    expect(result.advantagePercent).toBeNull();
  });
  it.each([0, -1, 1.5, 'bad'])('rejects invalid multipack count %s', (packages) => {
    expect(compareDeals([deal(10, 20, 'oz', packages), deal(12, 20)]).status).toBe('invalid');
  });
  it.each([[0,1],[-1,1],['bad',1],[1,0],[1,-2]])('rejects invalid numeric input %s / %s',(price,quantity)=>expect(compareDeals([deal(price,quantity),deal(2,2)]).status).toBe('invalid'));
  it('rejects incompatible categories', () => expect(compareDeals([deal(2,10,'oz'),deal(2,10,'l')]).status).toBe('incompatible'));
  it('uses package count in total quantity', () => expect(compareDeals([deal(10,5,'item',3),deal(10,10,'item',1)]).winners[0].index).toBe(0));
});
