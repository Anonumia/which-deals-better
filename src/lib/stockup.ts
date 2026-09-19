export interface StockUpInput {
  salePrice: unknown;
  normalPrice: unknown;
  amountPerPackage: unknown;
  packageCount: unknown;
  amountPerDay: unknown;
}

export interface StockUpResult {
  saleTotal: number;
  normalTotal: number;
  savings: number;
  savingsPercent: number;
  totalAmount: number;
  supplyDays: number;
  costPerDay: number;
  extraPackageDays: number;
  extraPackageSavings: number;
}

const positive = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function calculateStockUp(input: StockUpInput): StockUpResult | null {
  const salePrice = positive(input.salePrice);
  const normalPrice = positive(input.normalPrice);
  const amountPerPackage = positive(input.amountPerPackage);
  const packageCount = positive(input.packageCount);
  const amountPerDay = positive(input.amountPerDay);
  if (!salePrice || !normalPrice || !amountPerPackage || !packageCount || !amountPerDay || !Number.isInteger(packageCount)) return null;
  const saleTotal = salePrice * packageCount;
  const normalTotal = normalPrice * packageCount;
  const totalAmount = amountPerPackage * packageCount;
  return {
    saleTotal,
    normalTotal,
    savings: normalTotal - saleTotal,
    savingsPercent: ((normalPrice - salePrice) / normalPrice) * 100,
    totalAmount,
    supplyDays: totalAmount / amountPerDay,
    costPerDay: saleTotal / (totalAmount / amountPerDay),
    extraPackageDays: amountPerPackage / amountPerDay,
    extraPackageSavings: normalPrice - salePrice,
  };
}
