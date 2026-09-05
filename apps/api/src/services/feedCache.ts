import { redis } from "../lib/redis.js";

export const CACHE_CAP = 200;

export type FeedArticle = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  thumbnailUrl: string | null;
  region: string;
  categories: string[];
  publishedAt: Date;
  publisher: { id: string; name: string };
};

function cacheKey(region: string): string {
  return `feed:${region}`;
}

// reads up to `count` most recent cached articles for a region.
// null covers both a genuinely cold cache and any redis failure, so callers
// don't need to tell those two cases apart - both just mean "go to postgres"
export async function readFeedCache(region: string, count: number): Promise<FeedArticle[] | null> {
  try {
    const raw = await redis.zrevrange(cacheKey(region), 0, count - 1);
    if (raw.length === 0) return null;

    return raw.map((entry) => {
      const parsed = JSON.parse(entry) as Omit<FeedArticle, "publishedAt"> & { publishedAt: string };
      return { ...parsed, publishedAt: new Date(parsed.publishedAt) };
    });
  } catch (err) {
    console.error(`redis unavailable, falling back to Postgres for ${cacheKey(region)}: ${(err as Error).message}`);
    return null;
  }
}

// replaces a region's cache with a fresh batch, trimmed to CACHE_CAP.
// failures here are logged, never thrown - a cache write failing shouldn't break the response
export async function populateFeedCache(region: string, articles: FeedArticle[]): Promise<void> {
  if (articles.length === 0) return;

  try {
    const key = cacheKey(region);
    const members = articles.flatMap((article) => [article.publishedAt.getTime(), JSON.stringify(article)]);
    await redis.zadd(key, ...members);
    await redis.zremrangebyrank(key, 0, -(CACHE_CAP + 1));
  } catch (err) {
    console.error(`failed to populate cache for ${cacheKey(region)}: ${(err as Error).message}`);
  }
}

// adds one article to its region's cache - called by collect right after each Postgres upsert
export async function addArticleToCache(article: FeedArticle): Promise<void> {
  try {
    const key = cacheKey(article.region);
    await redis.zadd(key, article.publishedAt.getTime(), JSON.stringify(article));
    await redis.zremrangebyrank(key, 0, -(CACHE_CAP + 1));
  } catch (err) {
    console.error(`failed to add article to cache for ${cacheKey(article.region)}: ${(err as Error).message}`);
  }
}