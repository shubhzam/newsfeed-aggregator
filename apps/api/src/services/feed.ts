import { prisma } from "../lib/prisma.js";

export type Cursor = {
  publishedAt: Date;
  id: string;
};

// turns a (publishedAt, id) pair into one opaque string safe to hand back to the client
export function encodeCursor(publishedAt: Date, id: string): string {
  const payload = `${publishedAt.toISOString()}_${id}`;
  return Buffer.from(payload).toString("base64");
}

// reverses encodeCursor - throws if the string is malformed, so callers can turn that into a 400
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

type GetFeedParams = {
  region: string;
  limit: number;
  cursor: Cursor | null;
};

// fetches one page of articles for a region, most recent first, cursor-based
export async function getFeed({ region, limit, cursor }: GetFeedParams) {
  const articles = await prisma.article.findMany({
    where: {
      region,
      ...(cursor && {
        OR: [
          { publishedAt: { lt: cursor.publishedAt } },
          { publishedAt: cursor.publishedAt, id: { lt: cursor.id } },
        ],
      }),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit + 1, // one extra row, just to detect whether more pages exist
    include: { publisher: { select: { id: true, name: true } } },
  });

  const hasMore = articles.length > limit;
  const page = hasMore ? articles.slice(0, limit) : articles;
  const last = page[page.length - 1];

  return {
    articles: page,
    nextCursor: hasMore && last ? encodeCursor(last.publishedAt, last.id) : null,
    hasMore,
  };
}