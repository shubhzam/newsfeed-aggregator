import { prisma } from "../lib/prisma.js";
import { readFeedCache, populateFeedCache, type FeedArticle } from "./feedCache.js";

export type Cursor = {
  publishedAt: Date;
  id: string;
};

export function encodeCursor(publishedAt: Date, id: string): string {
  const payload = `${publishedAt.toISOString()}_${id}`;
  return Buffer.from(payload).toString("base64");
}

export function decodeCursor(raw: string): Cursor {
  const payload = Buffer.from(raw, "base64").toString("utf-8");
  const separatorIndex = payload.lastIndexOf("_");

  if (separatorIndex === -1) {
    throw new Error("invalid cursor format");
  }

  const isoDate = payload.slice(0, separatorIndex);
  const id = payload.slice(separatorIndex + 1);
  const publishedAt = new Date(isoDate);

  if (isNaN(publishedAt.getTime()) || !id) {
    throw new Error("invalid cursor format");
  }

  return { publishedAt, id };
}

const ARTICLE_SELECT = {
  id: true,
  title: true,
  summary: true,
  url: true,
  thumbnailUrl: true,
  region: true,
  categories: true,
  publishedAt: true,
  publisher: { select: { id: true, name: true } },
} as const;

const CACHE_POPULATE_SIZE = 200;

type GetFeedParams = {
  region: string;
  limit: number;
  cursor: Cursor | null;
  category: string | null;
};

export async function getFeed({ region, limit, cursor, category }: GetFeedParams) {
  // cursor or category present -> always Postgres, cache only serves the plain first page
  if (cursor || category) {
    return getFeedFromDb({ region, limit, cursor, category });
  }

  const cached = await readFeedCache(region, limit + 1);
  if (cached) {
    console.log(`cache hit for feed:${region}`);
    return buildPageResponse(cached, limit);
  }

  console.log(`cache miss for feed:${region}, querying Postgres`);
  const freshBatch = await prisma.article.findMany({
    where: { region },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: CACHE_POPULATE_SIZE,
    select: ARTICLE_SELECT,
  });

  await populateFeedCache(region, freshBatch);

  return buildPageResponse(freshBatch, limit);
}

async function getFeedFromDb({ region, limit, cursor, category }: GetFeedParams) {
  const articles = await prisma.article.findMany({
    where: {
      region,
      ...(category && { categories: { has: category } }),
      ...(cursor && {
        OR: [
          { publishedAt: { lt: cursor.publishedAt } },
          { publishedAt: cursor.publishedAt, id: { lt: cursor.id } },
        ],
      }),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: ARTICLE_SELECT,
  });

  return buildPageResponse(articles, limit);
}

function buildPageResponse(articles: FeedArticle[], limit: number) {
  const hasMore = articles.length > limit;
  const page = hasMore ? articles.slice(0, limit) : articles;
  const last = page[page.length - 1];

  return {
    articles: page,
    nextCursor: hasMore && last ? encodeCursor(last.publishedAt, last.id) : null,
    hasMore,
  };
}