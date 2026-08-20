import { unitMap } from './units';

export interface DealInput { name?: string; price: unknown; packages: unknown; quantity: unknown; unit: string; }
export interface CalculatedDeal extends DealInput { index: number; normalizedQuantity: number; unitPrice: number; }
export interface ComparisonResult { status: 'incomplete' | 'invalid' | 'incompatible' | 'tie' | 'winner'; deals: CalculatedDeal[]; winners: CalculatedDeal[]; advantagePercent: number | null; displayUnit: string | null; message?: string; }

const positiveNumber = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const positiveInteger = (value: unknown): number | null => {
  const number = positiveNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
};

export function packageMultiplier(isMultipack: boolean, numberInPack: unknown): unknown {
  return isMultipack ? numberInPack : 1;
}

export function initialPackageCount(isMobile: boolean): string {
  return isMobile ? '1' : '';
}

export function compareDeals(inputs: DealInput[]): ComparisonResult {
  const hasPartial = inputs.some((deal) => deal.price !== '' || deal.quantity !== '');
  const calculated: CalculatedDeal[] = [];
  for (let index = 0; index < inputs.length; index += 1) {
    const deal = inputs[index];
    const price = positiveNumber(deal.price);
    const packages = positiveInteger(deal.packages);
    const quantity = positiveNumber(deal.quantity);
    const unit = unitMap.get(deal.unit);
    if (!price || !packages || !quantity || !unit) {
      return { status: hasPartial ? 'invalid' : 'incomplete', deals: [], winners: [], advantagePercent: null, displayUnit: null };
    }
    const normalizedQuantity = packages * quantity * unit.factor;
    calculated.push({ ...deal, index, price, packages, quantity, normalizedQuantity, unitPrice: price / normalizedQuantity });
  }
  const categories = new Set(calculated.map((deal) => unitMap.get(deal.unit)?.category));
  if (categories.size !== 1) return { status: 'incompatible', deals: calculated, winners: [], advantagePercent: null, displayUnit: null, message: 'These deals use different kinds of units. Choose comparable units to compare them.' };
  const displayUnit = calculated[0].unit;
  const lowest = Math.min(...calculated.map((deal) => deal.unitPrice));
  const tolerance = Math.max(lowest * 1e-9, Number.EPSILON);
  const winners = calculated.filter((deal) => Math.abs(deal.unitPrice - lowest) <= tolerance);
  if (winners.length > 1) return { status: 'tie', deals: calculated, winners, advantagePercent: 0, displayUnit };
  const nextLowest = Math.min(...calculated.filter((deal) => deal !== winners[0]).map((deal) => deal.unitPrice));
  return { status: 'winner', deals: calculated, winners, advantagePercent: ((nextLowest - lowest) / nextLowest) * 100, displayUnit };
}

export function formatUnitPrice(value: number): string {
  const cents = value * 100;
  const floatingPointTolerance = Number.EPSILON * Math.max(1, Math.abs(cents)) * 4;
  const roundedUp = Math.ceil(cents - floatingPointTolerance) / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(roundedUp);
}

export function unitPriceIn(unitPrice: number, displayUnit: string): number {
  const unit = unitMap.get(displayUnit);
  if (!unit) throw new Error(`Unknown display unit: ${displayUnit}`);
  return unitPrice * unit.factor;
}

export function formatUnitPriceForUnit(unitPrice: number, displayUnit: string): string {
  const unit = unitMap.get(displayUnit);
  if (!unit) throw new Error(`Unknown display unit: ${displayUnit}`);
  return `${formatUnitPrice(unitPriceIn(unitPrice, displayUnit))}/${unit.label}`;
}
