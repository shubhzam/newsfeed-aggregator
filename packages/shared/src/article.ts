/**
 * The article/feed contract shared between `apps/api` (producer) and
 * `apps/web` (consumer). Mirrors the `ARTICLE_SELECT` shape in
 * `apps/api/src/services/feed.ts` — if one side changes, the other should
 * fail to typecheck rather than break silently at runtime.
 */

export type Article = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  thumbnailUrl: string | null;
  region: string;
  categories: string[];
  /** ISO 8601 string — `Date` objects don't survive JSON transport. */
  publishedAt: string;
  publisher: { id: string; name: string };
};

export type FeedResponse = {
  articles: Article[];
  /** Opaque base64 cursor for the next page, or `null` when exhausted. */
  nextCursor: string | null;
  hasMore: boolean;
};
