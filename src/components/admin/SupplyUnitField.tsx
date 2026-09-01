"use client";

export const SUPPLY_UNITS = [
  "Each", "Piece", "Unit", "Pair", "Dozen",
  "Set", "Kit", "Pack", "Package", "Bundle",
  "Bag", "Box", "Case", "Carton", "Sleeve", "Tray",
  "Roll", "Coil", "Spool", "Reel", "Strip",
  "Tube", "Cartridge", "Bottle", "Can", "Jug", "Pail", "Bucket", "Drum",
  "Sheet", "Panel", "Board", "Length",
  "Foot", "Yard", "Meter", "Square Foot", "Linear Foot",
  "Ounce", "Pound", "Gram", "Kilogram", "Gallon", "Liter",
  "Pallet", "Crate",
] as const;

const CUSTOM_VALUE = "__custom__";

export default function SupplyUnitField({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const isKnown = SUPPLY_UNITS.includes(value as (typeof SUPPLY_UNITS)[number]);
  const custom = !isKnown;
  const inputClass = `w-full rounded-xl border border-slate-300 bg-white px-3 ${compact ? "py-2 text-sm" : "py-2.5 text-sm"} outline-none focus:border-brand-navy`;

  return (
    <label className="block">
      <span className={`block font-semibold text-slate-700 ${compact ? "mb-1 text-xs" : "mb-1.5 text-sm"}`}>{label}</span>
      <select
        value={custom ? CUSTOM_VALUE : value}
        onChange={(event) => onChange(event.target.value === CUSTOM_VALUE ? CUSTOM_VALUE : event.target.value)}
        className={inputClass}
      >
        {SUPPLY_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        <option value={CUSTOM_VALUE}>Other / custom...</option>
      </select>
      {custom && (
        <input
          value={value === CUSTOM_VALUE ? "" : value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type custom unit"
          autoFocus
          className={`${inputClass} mt-2`}
        />
      )}
    </label>
  );
}
