/**
 * Region and category options are hardcoded on purpose: the API has no
 * discovery endpoint for either (an explicit non-goal of the category-filtering
 * techspec). The category lists below are curated per region from categories
 * actually observed in ingested data — a single shared list would leave every
 * chip dead on one region or the other, since the US (TechCrunch/ESPN) and UK
 * (Guardian/BBC) feeds tag along completely different vocabularies.
 */

export type Region = {
  code: string;
  label: string;
  blurb: string;
};

export const REGIONS: Region[] = [
  { code: "US", label: "US", blurb: "United States" },
  { code: "UK", label: "UK", blurb: "United Kingdom" },
];

export const DEFAULT_REGION = "US";

const CATEGORIES_BY_REGION: Record<string, string[]> = {
  US: ["ai", "startups", "transportation", "robotics", "apps"],
  UK: ["culture", "politics", "business", "world news", "film", "sport"],
};

export function categoriesForRegion(region: string): string[] {
  return CATEGORIES_BY_REGION[region] ?? [];
}

/**
 * CSS `capitalize` turns "ai" into "Ai". Only acronyms need an override —
 * everything else capitalizes correctly on its own.
 */
const CATEGORY_LABELS: Record<string, string> = {
  ai: "AI",
};

export function categoryLabel(value: string): string {
  return CATEGORY_LABELS[value] ?? value;
}
