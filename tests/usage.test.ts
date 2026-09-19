import { describe, expect, it } from 'vitest';
import { elapsedDays, parseUsageRecords, sanitizeUsageRecords, summarizeUsage, type UsageRecord } from '../src/lib/usage';

const record = (overrides: Partial<UsageRecord> = {}): UsageRecord => ({ id:'one', name:'Paper Towels', amount:12, unit:'roll', startDate:'2026-01-01', completedDate:'2026-02-12', cost:18, createdAt:'2026-01-01T00:00:00Z', ...overrides });

describe('usage history', () => {
  it('calculates a usage duration in whole calendar days', () => expect(elapsedDays('2026-01-01', '2026-02-12')).toBe(42));
  it('requires at least one elapsed day', () => expect(elapsedDays('2026-01-01', '2026-01-01')).toBeNull());
  it('calculates daily, weekly, days-per-unit, and cost rates', () => { const summary = summarizeUsage([record()], 'paper towels', 'roll')!; expect(summary.amountPerDay).toBeCloseTo(12/42); expect(summary.amountPerWeek).toBeCloseTo(2); expect(summary.daysPerUnit).toBeCloseTo(3.5); expect(summary.costPerDay).toBeCloseTo(18/42); });
  it('uses a weighted historical average across matching completed records', () => { const summary = summarizeUsage([record(), record({ id:'two', amount:6, startDate:'2026-03-01', completedDate:'2026-03-15', cost:undefined })], 'Paper Towels', 'roll')!; expect(summary.records).toBe(2); expect(summary.totalAmount).toBe(18); expect(summary.totalDays).toBe(56); expect(summary.amountPerDay).toBeCloseTo(18/56); });
  it('does not mix different item names or units', () => expect(summarizeUsage([record()], 'Paper Towels', 'sheet')).toBeNull());
  it('drops malformed stored records while preserving valid data', () => expect(sanitizeUsageRecords([record(), { id:'bad', name:'', amount:-2 }])).toHaveLength(1));
  it('recovers safely from malformed local-storage JSON', () => expect(parseUsageRecords('{broken')).toEqual([]));
  it('represents cleared storage as an empty list', () => expect(parseUsageRecords(null)).toEqual([]));
});
