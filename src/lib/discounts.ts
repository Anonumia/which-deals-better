export type CouponType = 'none' | 'percent' | 'fixed';

export interface DiscountOfferInput {
  name?: string;
  regularPrice: unknown;
  salePrice?: unknown;
  couponType: CouponType;
  couponValue?: unknown;
  quantity: unknown;
  itemsPerPackage: unknown;
}

export interface DiscountOfferResult {
  name: string;
  regularTotal: number;
  finalTotal: number;
  savings: number;
  totalItems: number;
  effectivePrice: number;
}

const positive = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const nonNegative = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export function calculateDiscountOffer(input: DiscountOfferInput): DiscountOfferResult | null {
  const regularPrice = positive(input.regularPrice);
  const salePrice = input.salePrice === '' || input.salePrice === null || input.salePrice === undefined
    ? regularPrice
    : positive(input.salePrice);
  const couponValue = nonNegative(input.couponValue);
  const quantity = positive(input.quantity);
  const itemsPerPackage = positive(input.itemsPerPackage);
  if (!regularPrice || !salePrice || couponValue === null || !quantity || !itemsPerPackage || !Number.isInteger(quantity) || !Number.isInteger(itemsPerPackage)) return null;
  if (input.couponType === 'percent' && couponValue > 100) return null;

  const regularTotal = regularPrice * quantity;
  const saleTotal = salePrice * quantity;
  const couponDiscount = input.couponType === 'percent'
    ? saleTotal * (couponValue / 100)
    : input.couponType === 'fixed' ? couponValue : 0;
  const finalTotal = Math.max(0, saleTotal - couponDiscount);
  const totalItems = quantity * itemsPerPackage;
  return {
    name: input.name?.trim() || '',
    regularTotal,
    finalTotal,
    savings: regularTotal - finalTotal,
    totalItems,
    effectivePrice: finalTotal / totalItems,
  };
}

export function compareDiscountOffers(inputs: DiscountOfferInput[]) {
  const offers = inputs.map(calculateDiscountOffer);
  if (offers.some((offer) => offer === null)) return { status: 'invalid' as const, offers: [] as DiscountOfferResult[], winnerIndexes: [] as number[], difference: null };
  const valid = offers as DiscountOfferResult[];
  const lowest = Math.min(...valid.map((offer) => offer.finalTotal));
  const tolerance = Math.max(lowest * 1e-9, Number.EPSILON);
  const winnerIndexes = valid.flatMap((offer, index) => Math.abs(offer.finalTotal - lowest) <= tolerance ? [index] : []);
  const sortedTotals = valid.map((offer) => offer.finalTotal).sort((a, b) => a - b);
  return {
    status: winnerIndexes.length > 1 ? 'tie' as const : 'winner' as const,
    offers: valid,
    winnerIndexes,
    difference: sortedTotals.length > 1 ? sortedTotals[1] - sortedTotals[0] : 0,
  };
}
