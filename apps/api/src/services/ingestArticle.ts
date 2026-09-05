import { prisma } from "../lib/prisma.js";
import { addArticleToCache } from "./feedCache.js";

type IngestArticleInput = {
  title: string;
  url: string;
  summary: string | null;
  region: string;
  categories: string[];
  publishedAt: Date;
  publisherId: string;
  publisherName: string;
};

// the one shared write path for both pull-based (collect) and push-based
// (webhook) ingestion - upserts the article by url, then updates the cache
export async function ingestArticle(input: IngestArticleInput) {
  const created = await prisma.article.upsert({
    where: { url: input.url },
    update: {
      categories: input.categories,
    },
    create: {
      title: input.title,
      summary: input.summary,
      url: input.url,
      thumbnailUrl: null,
      region: input.region,
      categories: input.categories,
      publishedAt: input.publishedAt,
      publisherId: input.publisherId,
    },
  });

  await addArticleToCache({
    id: created.id,
    title: created.title,
    summary: created.summary,
    url: created.url,
    thumbnailUrl: created.thumbnailUrl,
    region: created.region,
    categories: created.categories,
    publishedAt: created.publishedAt,
    publisher: { id: input.publisherId, name: input.publisherName },
  });

  return created;
}