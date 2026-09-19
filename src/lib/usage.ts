export const USAGE_STORAGE_KEY = 'whichdealsbetter.usage.v1';
export const PURCHASE_HANDOFF_KEY = 'whichdealsbetter.purchase-handoff.v1';

export interface UsageRecord {
  id: string;
  name: string;
  amount: number;
  unit: string;
  startDate: string;
  completedDate?: string;
  cost?: number;
  createdAt: string;
}

export interface UsageSummary {
  records: number;
  totalAmount: number;
  totalDays: number;
  amountPerDay: number;
  amountPerWeek: number;
  daysPerUnit: number;
  costPerDay: number | null;
}

const dayMilliseconds = 86_400_000;
const validDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
const cleanName = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 80) : '';
export const usageKey = (name: string, unit: string) => `${name.trim().toLocaleLowerCase()}::${unit}`;

export function elapsedDays(startDate: string, completedDate: string): number | null {
  if (!validDate(startDate) || !validDate(completedDate)) return null;
  const days = Math.round((Date.parse(`${completedDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / dayMilliseconds);
  return days >= 1 ? days : null;
}

export function sanitizeUsageRecords(value: unknown): UsageRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const raw = item as Partial<UsageRecord>;
    const name = cleanName(raw.name);
    const amount = Number(raw.amount);
    const unit = typeof raw.unit === 'string' ? raw.unit : '';
    const cost = raw.cost === undefined ? undefined : Number(raw.cost);
    const startDate = typeof raw.startDate === 'string' ? raw.startDate : '';
    const completedDate = typeof raw.completedDate === 'string' ? raw.completedDate : undefined;
    if (!raw.id || typeof raw.id !== 'string' || !name || !Number.isFinite(amount) || amount <= 0 || !unit || !validDate(startDate) || (completedDate && !validDate(completedDate)) || (cost !== undefined && (!Number.isFinite(cost) || cost < 0))) return [];
    return [{ id: raw.id, name, amount, unit, startDate, completedDate, cost, createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString() }];
  });
}

export function parseUsageRecords(json: string | null): UsageRecord[] {
  if (!json) return [];
  try { return sanitizeUsageRecords(JSON.parse(json)); } catch { return []; }
}

export function summarizeUsage(records: UsageRecord[], name: string, unit: string): UsageSummary | null {
  const matching = records.filter((record) => record.completedDate && usageKey(record.name, record.unit) === usageKey(name, unit));
  const periods = matching.flatMap((record) => {
    const days = elapsedDays(record.startDate, record.completedDate!);
    return days ? [{ record, days }] : [];
  });
  if (!periods.length) return null;
  const totalAmount = periods.reduce((sum, period) => sum + period.record.amount, 0);
  const totalDays = periods.reduce((sum, period) => sum + period.days, 0);
  const totalCost = periods.reduce((sum, period) => sum + (period.record.cost ?? 0), 0);
  const pricedDays = periods.reduce((sum, period) => sum + (period.record.cost === undefined ? 0 : period.days), 0);
  const amountPerDay = totalAmount / totalDays;
  return {
    records: periods.length,
    totalAmount,
    totalDays,
    amountPerDay,
    amountPerWeek: amountPerDay * 7,
    daysPerUnit: 1 / amountPerDay,
    costPerDay: pricedDays ? totalCost / pricedDays : null,
  };
}
