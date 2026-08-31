export const DEFAULT_PACKAGING = { baseUnit: "Each", sellingUnit: "Each", unitsPerSale: 1 };

export function positivePackagingFactor(value: number | null | undefined): number {
  const factor = Number(value);
  return Number.isFinite(factor) && factor > 0 ? Math.floor(factor) : 1;
}

export function baseUnitsForSale(quantity: number, unitsPerSale?: number | null): number {
  return Math.max(0, Number(quantity) || 0) * positivePackagingFactor(unitsPerSale);
}

export function costForSale(costPerBaseUnit: number | null | undefined, quantity: number, unitsPerSale?: number | null): number {
  return (Number(costPerBaseUnit) || 0) * baseUnitsForSale(quantity, unitsPerSale);
}

export function baseQuantityFromPackages(packageQuantity: number, baseUnitsPerPackage?: number | null): number {
  return baseUnitsForSale(packageQuantity, baseUnitsPerPackage);
}

export function costPerBaseUnitFromPackageCost(packageCost: number, baseUnitsPerPackage?: number | null): number {
  return (Number(packageCost) || 0) / positivePackagingFactor(baseUnitsPerPackage);
}
