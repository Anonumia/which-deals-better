import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculateStockUp, presentStockUp } from '../src/lib/stockup';
import { summarizeUsage, type UsageRecord } from '../src/lib/usage';

describe('stock-up calculations', () => {
  it('calculates savings, duration, and cost per day', () => { const result = calculateStockUp({ salePrice:12, normalPrice:15, amountPerPackage:12, packageCount:3, amountPerDay:2/7 })!; expect(result.savings).toBe(9); expect(result.totalAmount).toBe(36); expect(result.supplyDays).toBeCloseTo(126); expect(result.extraPackageDays).toBeCloseTo(42); expect(result.costPerDay).toBeCloseTo(36/126); });
  it('shows negative savings when the entered sale costs more', () => expect(calculateStockUp({ salePrice:6, normalPrice:5, amountPerPackage:10, packageCount:2, amountPerDay:1 })?.savings).toBe(-2));
  it('accepts a historical usage rate from completed tracker data', () => { const records: UsageRecord[] = [{ id:'one', name:'Paper Towels', amount:12, unit:'roll', startDate:'2026-01-01', completedDate:'2026-02-12', createdAt:'2026-01-01T00:00:00Z' }]; const rate = summarizeUsage(records, 'Paper Towels', 'roll')!.amountPerDay; expect(calculateStockUp({ salePrice:12, normalPrice:15, amountPerPackage:12, packageCount:2, amountPerDay:rate })?.supplyDays).toBeCloseTo(84); });
  it.each([{ salePrice:'', normalPrice:5, amountPerPackage:1, packageCount:1, amountPerDay:1 }, { salePrice:4, normalPrice:5, amountPerPackage:1, packageCount:1.5, amountPerDay:1 }, { salePrice:4, normalPrice:5, amountPerPackage:1, packageCount:1, amountPerDay:0 }])('rejects invalid input', (input) => expect(calculateStockUp(input)).toBeNull());

  it('presents total sale savings and supply together', () => {
    const result = calculateStockUp({ salePrice: 9.99, normalPrice: 14.99, amountPerPackage: 16, packageCount: 5, amountPerDay: 1 })!;
    expect(presentStockUp(result, 5, 'oz')).toEqual({
      headline: 'Save $25.00 and get about 80 days of supply',
      summary: 'Buying 5 packages at $9.99 saves you $25.00 compared with the normal price of $14.99. You’ll spend $49.95 today instead of $74.95, and the 80 oz purchased may last about 80 days at your estimated usage.',
      metrics: [
        { label: 'You pay today', value: '$49.95' },
        { label: 'Normal cost for 5 packages', value: '$74.95' },
        { label: 'Total savings', value: '$25.00 (33.4%)' },
        { label: 'Estimated supply', value: 'about 80 days' },
      ],
    });
  });

  it('keeps daily use blank and gives its spinner a whole-number step without blocking typed decimals', () => {
    const component = readFileSync(new URL('../src/components/StockUpCalculator.astro', import.meta.url), 'utf8');
    const input = component.match(/<input data-field="amountPerDay"[^>]+>/)?.[0] ?? '';
    expect(input).toContain('type="number"');
    expect(input).toContain('step="1"');
    expect(input).toContain('inputmode="decimal"');
    expect(input).not.toContain(' min=');
    expect(input).not.toMatch(/\svalue=/);
    expect(calculateStockUp({ salePrice: 4, normalPrice: 5, amountPerPackage: 1, packageCount: 1, amountPerDay: 0.5 })?.supplyDays).toBe(2);
  });
});
