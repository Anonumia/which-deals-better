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

export interface StockUpPresentation {
  headline: string;
  summary: string;
  metrics: Array<{ label: string; value: string }>;
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

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const number = (value: number, digits = 1) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

export function presentStockUp(result: StockUpResult, packageCount: number, unit: string): StockUpPresentation {
  const packageLabel = packageCount === 1 ? 'package' : 'packages';
  const salePrice = result.saleTotal / packageCount;
  const normalPrice = result.normalTotal / packageCount;
  const days = number(result.supplyDays, 0);
  const supply = `${number(result.totalAmount, 2)} ${unit} purchased may last about ${days} days at your estimated usage.`;

  let headline: string;
  let comparison: string;
  if (result.savings > 0) {
    headline = `Save ${money(result.savings)} and get about ${days} days of supply`;
    comparison = `saves you ${money(result.savings)} compared with the normal price of ${money(normalPrice)}`;
  } else if (result.savings < 0) {
    headline = `Pay ${money(Math.abs(result.savings))} more and get about ${days} days of supply`;
    comparison = `costs ${money(Math.abs(result.savings))} more than the normal price of ${money(normalPrice)}`;
  } else {
    headline = `Pay the normal price and get about ${days} days of supply`;
    comparison = `costs the same as the normal price of ${money(normalPrice)}`;
  }

  return {
    headline,
    summary: `Buying ${number(packageCount, 0)} ${packageLabel} at ${money(salePrice)} ${comparison}. You’ll spend ${money(result.saleTotal)} today instead of ${money(result.normalTotal)}, and the ${supply}`,
    metrics: [
      { label: 'You pay today', value: money(result.saleTotal) },
      { label: `Normal cost for ${number(packageCount, 0)} ${packageLabel}`, value: money(result.normalTotal) },
      { label: 'Total savings', value: `${money(result.savings)} (${number(result.savingsPercent)}%)` },
      { label: 'Estimated supply', value: `about ${days} days` },
    ],
  };
}
