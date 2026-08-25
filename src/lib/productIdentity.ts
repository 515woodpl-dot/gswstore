export interface IdentityCategory {
  id: number;
  name: string;
  prefix: string;
}

export interface ExistingIdentity {
  id: string;
  sku?: string | null;
}

const STOP_WORDS = new Set([
  "and", "for", "the", "with", "tool", "tools", "product", "products",
  "supply", "supplies", "equipment", "hardware", "accessory", "accessories",
]);

function singular(word: string) {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
  return word;
}

function words(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(singular);
}

export function inferCategoryFromProductName<T extends IdentityCategory>(name: string, categories: T[]): T | null {
  const productWords = words(name);
  if (productWords.length === 0) return null;
  const productText = productWords.join(" ");

  let best: { category: T; score: number } | null = null;
  for (const category of categories) {
    const categoryWords = words(category.name).filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
    if (categoryWords.length === 0) continue;

    const matched = categoryWords.filter((keyword) =>
      productWords.includes(keyword) || (keyword.length >= 4 && productText.includes(keyword))
    );
    if (matched.length === 0) continue;

    const phraseBonus = productText.includes(categoryWords.join(" ")) ? 20 : 0;
    const score = phraseBonus + matched.length * 10 + matched.reduce((sum, word) => sum + word.length, 0);
    if (!best || score > best.score) best = { category, score };
  }

  return best?.category ?? null;
}

function sequenceFor(value: string | null | undefined, prefix: string) {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/\s+/g, "");
  const match = normalized.match(new RegExp(`^${prefix}[-_]?0*(\\d+)$`));
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function generateSmartProductIdentity(
  category: IdentityCategory,
  existing: ExistingIdentity[],
) {
  const prefix = category.prefix.toUpperCase().replace(/[^A-Z0-9]/g, "") || "GEN";
  const used = existing.flatMap((product) => [
    sequenceFor(product.id, prefix),
    sequenceFor(product.sku, prefix),
  ]).filter((value): value is number => value !== null);
  const next = (used.length > 0 ? Math.max(...used) : 0) + 1;

  return {
    id: `${prefix}${String(next).padStart(3, "0")}`,
    sku: `${prefix}-${String(next).padStart(4, "0")}`,
    prefix,
    sequence: next,
  };
}
