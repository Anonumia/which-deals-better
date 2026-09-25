export type GetDiscountType = 'free' | 'half' | 'percent';

export interface BogoOfferInput {
  pricePerItem: unknown;
  buyQuantity: unknown;
  getQuantity: unknown;
  discountType: GetDiscountType;
  discountPercent: unknown;
  quantity: unknown;
}

export interface SimpleOfferInput {
  pricePerItem: unknown;
  quantity: unknown;
}

export interface OfferCost {
  checkoutTotal: number;
  quantity: number;
  effectivePrice: number;
}

export interface BogoOfferCost extends OfferCost {
  promotionSavings: number;
  completeGroups: number;
  remainingItems: number;
  fullPriceItems: number;
  discountedItems: number;
}

export interface BogoComparison {
  offerA: BogoOfferCost;
  offerB: OfferCost;
  sameQuantity: boolean;
  checkoutWinner: 'a' | 'b' | 'tie';
  effectiveWinner: 'a' | 'b' | 'tie';
  checkoutDifference: number;
  effectiveDifference: number;
}

const positive = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const nonNegative = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const whole = (value: unknown) => {
  const parsed = positive(value);
  return parsed !== null && Number.isSafeInteger(parsed) ? parsed : null;
};

export function calculateBogoOffer(input: BogoOfferInput): BogoOfferCost | null {
  const pricePerItem = positive(input.pricePerItem);
  const buyQuantity = whole(input.buyQuantity);
  const getQuantity = whole(input.getQuantity);
  const quantity = whole(input.quantity);
  const enteredDiscount = input.discountType === 'free' ? 100 : input.discountType === 'half' ? 50 : nonNegative(input.discountPercent);
  if (pricePerItem === null || buyQuantity === null || getQuantity === null || quantity === null || enteredDiscount === null || enteredDiscount > 100) return null;

  const groupSize = buyQuantity + getQuantity;
  if (!Number.isSafeInteger(groupSize)) return null;
  const completeGroups = Math.floor(quantity / groupSize);
  const remainingItems = quantity % groupSize;
  const discountedItems = completeGroups * getQuantity;
  const fullPriceItems = completeGroups * buyQuantity + remainingItems;
  const checkoutTotal = fullPriceItems * pricePerItem + discountedItems * pricePerItem * (1 - enteredDiscount / 100);
  const regularTotal = quantity * pricePerItem;
  if (!Number.isFinite(checkoutTotal) || !Number.isFinite(regularTotal)) return null;

  return {
    checkoutTotal,
    quantity,
    effectivePrice: checkoutTotal / quantity,
    promotionSavings: regularTotal - checkoutTotal,
    completeGroups,
    remainingItems,
    fullPriceItems,
    discountedItems,
  };
}

export function calculateSimpleOffer(input: SimpleOfferInput): OfferCost | null {
  const pricePerItem = positive(input.pricePerItem);
  const quantity = whole(input.quantity);
  if (pricePerItem === null || quantity === null) return null;
  const checkoutTotal = pricePerItem * quantity;
  if (!Number.isFinite(checkoutTotal)) return null;
  return { checkoutTotal, quantity, effectivePrice: pricePerItem };
}

const winner = (a: number, b: number): 'a' | 'b' | 'tie' => {
  const tolerance = Math.max(Math.abs(a), Math.abs(b), 1) * 1e-10;
  if (Math.abs(a - b) <= tolerance) return 'tie';
  return a < b ? 'a' : 'b';
};

export function compareBogoOffers(offerAInput: BogoOfferInput, offerBInput: SimpleOfferInput): BogoComparison | null {
  const offerA = calculateBogoOffer(offerAInput);
  const offerB = calculateSimpleOffer(offerBInput);
  if (!offerA || !offerB) return null;
  return {
    offerA,
    offerB,
    sameQuantity: offerA.quantity === offerB.quantity,
    checkoutWinner: winner(offerA.checkoutTotal, offerB.checkoutTotal),
    effectiveWinner: winner(offerA.effectivePrice, offerB.effectivePrice),
    checkoutDifference: Math.abs(offerA.checkoutTotal - offerB.checkoutTotal),
    effectiveDifference: Math.abs(offerA.effectivePrice - offerB.effectivePrice),
  };
}
