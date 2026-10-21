type ZipFields = { taxZip: string; taxCity: string };

export function applyZipLookup<T extends ZipFields>(current: T, requestedZip: string, city: string): T {
  return current.taxZip === requestedZip ? { ...current, taxCity: city } : current;
}

export function applyDefaultZip<T extends ZipFields>(current: T, zip: string, city: string, edited: boolean): T {
  return edited || current.taxZip ? current : { ...current, taxZip: zip, taxCity: city };
}
