import Parser from "rss-parser";
import { prisma } from "../lib/prisma.js";

const parser = new Parser();
const FETCH_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function ingestPublisher(publisher: {
  id: string;
  name: string;
  rssFeedUrl: string | null;
  region: string;
}) {
  if (!publisher.rssFeedUrl) {
    console.log(`skipping ${publisher.name} - no rssFeedUrl set`);
    return { count: 0 };
  }

  const feed = await withTimeout(parser.parseURL(publisher.rssFeedUrl), FETCH_TIMEOUT_MS);

  let count = 0;
  for (const item of feed.items) {
    if (!item.link) {
      console.warn(`skipping item with no link from ${publisher.name}`);
      continue;
    }

    await prisma.article.upsert({
      where: { url: item.link },
      update: {},
      create: {
        title: item.title ?? "Untitled",
        summary: item.contentSnippet ?? null,
        url: item.link,
        thumbnailUrl: null,
        region: publisher.region,
        publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
        publisherId: publisher.id,
      },
    });
    count++;
  }

  return { count };
}

async function main() {
  const publishers = await prisma.publisher.findMany();
  let succeeded = 0;
  let failed = 0;

  for (const publisher of publishers) {
    try {
      const result = await ingestPublisher(publisher);
      console.log(`ingested ${result.count} articles for ${publisher.name}`);
      succeeded++;
    } catch (err) {
      console.error(`failed to ingest ${publisher.name}: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`ingestion complete: ${succeeded}/${publishers.length} publishers succeeded, ${failed} failed`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });