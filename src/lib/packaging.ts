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

export function resolveSalePackage(item: {
  units_per_sale?: number | null;
  store_price: number;
  sale_price?: number | null;
  box_enabled?: boolean | null;
  box_price?: number | null;
}, requestedPackSize?: number | null): { packSize: number; price: number; isBox: boolean } | null {
  const catalogPackSize = positivePackagingFactor(item.units_per_sale);
  const packSize = requestedPackSize == null ? catalogPackSize : Number(requestedPackSize);
  if (!Number.isInteger(packSize) || packSize < 1) return null;
  if (packSize === catalogPackSize) {
    return { packSize, price: Number(item.sale_price ?? item.store_price), isBox: false };
  }
  if (packSize === 24 && catalogPackSize === 1 && item.box_enabled && Number(item.box_price) > 0) {
    return { packSize, price: Number(item.box_price), isBox: true };
  }
  return null;
}

export function cartPackageProblem(
  lines: { item_id: string; name: string; quantity: number; units_per_sale?: number; store_price: number; sale_price?: number | null }[],
  inventory: ({ id: string; amount: number } & Parameters<typeof resolveSalePackage>[0])[],
): string | null {
  const byId = new Map(inventory.map((item) => [item.id, item]));
  const requestedUnits = new Map<string, number>();
  for (const line of lines) {
    const product = byId.get(line.item_id);
    const pack = product && resolveSalePackage(product, line.units_per_sale);
    if (!product || !pack) return `${line.name} is no longer available in that package.`;
    if (Math.round(pack.price * 100) !== Math.round((line.sale_price ?? line.store_price) * 100)) {
      return `${line.name} has a new price. Remove it from the cart and add it again.`;
    }
    requestedUnits.set(line.item_id, (requestedUnits.get(line.item_id) ?? 0) + line.quantity * pack.packSize);
  }
  for (const [itemId, units] of requestedUnits) {
    if (units > byId.get(itemId)!.amount) return "The cart needs more units than are in stock. Please reduce the quantity.";
  }
  return null;
}
