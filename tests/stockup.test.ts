import { describe, expect, it } from 'vitest';
import { calculateStockUp } from '../src/lib/stockup';
import { summarizeUsage, type UsageRecord } from '../src/lib/usage';

describe('stock-up calculations', () => {
  it('calculates savings, duration, and cost per day', () => { const result = calculateStockUp({ salePrice:12, normalPrice:15, amountPerPackage:12, packageCount:3, amountPerDay:2/7 })!; expect(result.savings).toBe(9); expect(result.totalAmount).toBe(36); expect(result.supplyDays).toBeCloseTo(126); expect(result.extraPackageDays).toBeCloseTo(42); expect(result.costPerDay).toBeCloseTo(36/126); });
  it('shows negative savings when the entered sale costs more', () => expect(calculateStockUp({ salePrice:6, normalPrice:5, amountPerPackage:10, packageCount:2, amountPerDay:1 })?.savings).toBe(-2));
  it('accepts a historical usage rate from completed tracker data', () => { const records: UsageRecord[] = [{ id:'one', name:'Paper Towels', amount:12, unit:'roll', startDate:'2026-01-01', completedDate:'2026-02-12', createdAt:'2026-01-01T00:00:00Z' }]; const rate = summarizeUsage(records, 'Paper Towels', 'roll')!.amountPerDay; expect(calculateStockUp({ salePrice:12, normalPrice:15, amountPerPackage:12, packageCount:2, amountPerDay:rate })?.supplyDays).toBeCloseTo(84); });
  it.each([{ salePrice:'', normalPrice:5, amountPerPackage:1, packageCount:1, amountPerDay:1 }, { salePrice:4, normalPrice:5, amountPerPackage:1, packageCount:1.5, amountPerDay:1 }, { salePrice:4, normalPrice:5, amountPerPackage:1, packageCount:1, amountPerDay:0 }])('rejects invalid input', (input) => expect(calculateStockUp(input)).toBeNull());
});
