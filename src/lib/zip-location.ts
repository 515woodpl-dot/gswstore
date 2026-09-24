import zipcodes from "zipcodes-us";

export interface ZipLocation {
  city: string;
  state: string;
  stateCode: string;
  county: string;
}

export function getZipLocation(zip: string): ZipLocation | null {
  if (!/^\d{5}$/.test(zip)) return null;

  const result = zipcodes.find(zip);
  if (!result.isValid || !result.city || !result.stateCode) return null;

  return {
    city: result.city.trim(),
    state: result.state.trim(),
    stateCode: result.stateCode.trim().toUpperCase(),
    county: result.county.trim(),
  };
}
