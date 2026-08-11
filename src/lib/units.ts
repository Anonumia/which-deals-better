export type UnitCategory = 'weight-us' | 'weight-metric' | 'volume' | 'count' | 'length-us' | 'length-metric';

export interface UnitDefinition {
  value: string;
  label: string;
  longLabel: string;
  group: 'Weight' | 'Volume' | 'Count' | 'Length';
  category: UnitCategory;
  factor: number;
  baseLabel: string;
}

export const units: UnitDefinition[] = [
  { value: 'oz', label: 'oz', longLabel: 'ounce', group: 'Weight', category: 'weight-us', factor: 1, baseLabel: 'oz' },
  { value: 'lb', label: 'lb', longLabel: 'pound', group: 'Weight', category: 'weight-us', factor: 16, baseLabel: 'oz' },
  { value: 'g', label: 'g', longLabel: 'gram', group: 'Weight', category: 'weight-metric', factor: 1, baseLabel: 'g' },
  { value: 'kg', label: 'kg', longLabel: 'kilogram', group: 'Weight', category: 'weight-metric', factor: 1000, baseLabel: 'g' },
  { value: 'fl-oz', label: 'fl oz', longLabel: 'fluid ounce', group: 'Volume', category: 'volume', factor: 29.5735295625, baseLabel: 'mL' },
  { value: 'cup', label: 'cup', longLabel: 'cup', group: 'Volume', category: 'volume', factor: 236.5882365, baseLabel: 'mL' },
  { value: 'pint', label: 'pint', longLabel: 'pint', group: 'Volume', category: 'volume', factor: 473.176473, baseLabel: 'mL' },
  { value: 'quart', label: 'quart', longLabel: 'quart', group: 'Volume', category: 'volume', factor: 946.352946, baseLabel: 'mL' },
  { value: 'gallon', label: 'gallon', longLabel: 'gallon', group: 'Volume', category: 'volume', factor: 3785.411784, baseLabel: 'mL' },
  { value: 'ml', label: 'mL', longLabel: 'milliliter', group: 'Volume', category: 'volume', factor: 1, baseLabel: 'mL' },
  { value: 'l', label: 'L', longLabel: 'liter', group: 'Volume', category: 'volume', factor: 1000, baseLabel: 'mL' },
  ...['item', 'piece', 'pod', 'tablet', 'capsule', 'roll', 'sheet', 'bag', 'bottle', 'can'].map((value) => ({ value, label: value, longLabel: value, group: 'Count' as const, category: 'count' as const, factor: 1, baseLabel: 'item' })),
  { value: 'inch', label: 'inch', longLabel: 'inch', group: 'Length', category: 'length-us', factor: 1, baseLabel: 'inch' },
  { value: 'foot', label: 'foot', longLabel: 'foot', group: 'Length', category: 'length-us', factor: 12, baseLabel: 'inch' },
  { value: 'yard', label: 'yard', longLabel: 'yard', group: 'Length', category: 'length-us', factor: 36, baseLabel: 'inch' },
  { value: 'cm', label: 'cm', longLabel: 'centimeter', group: 'Length', category: 'length-metric', factor: 1, baseLabel: 'cm' },
  { value: 'm', label: 'm', longLabel: 'meter', group: 'Length', category: 'length-metric', factor: 100, baseLabel: 'cm' },
];

export const unitMap = new Map(units.map((unit) => [unit.value, unit]));
export const unitGroups = ['Weight', 'Volume', 'Count', 'Length'].map((group) => ({
  group,
  units: units.filter((unit) => unit.group === group),
}));
