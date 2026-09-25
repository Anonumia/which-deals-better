export const TIP_PERCENTAGES = [15, 18, 20] as const;
export type TipPercentage = typeof TIP_PERCENTAGES[number];

export interface TipResult {
  bill: number;
  percentage: TipPercentage;
  tip: number;
  total: number;
}

export function calculateTip(billValue: unknown, percentageValue: unknown): TipResult | null {
  if (billValue === '' || billValue === null || billValue === undefined) return null;
  const bill = typeof billValue === 'number' ? billValue : Number(billValue);
  const percentage = typeof percentageValue === 'number' ? percentageValue : Number(percentageValue);
  if (!Number.isFinite(bill) || bill <= 0 || !TIP_PERCENTAGES.includes(percentage as TipPercentage)) return null;
  const tip = bill * percentage / 100;
  const total = bill + tip;
  if (!Number.isFinite(tip) || !Number.isFinite(total)) return null;
  return { bill, percentage: percentage as TipPercentage, tip, total };
}
