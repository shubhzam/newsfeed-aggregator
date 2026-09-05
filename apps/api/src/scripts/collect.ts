import Parser from "rss-parser";
import { prisma } from "../lib/prisma.js";
import { ingestArticle } from "../services/ingestArticle.js";

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

// rss-parser's types claim categories are always strings, but real feeds
// (e.g. The Guardian) send <category domain="..."> which parses as an object,
// not a string - handle both shapes rather than assume the happy path
function normalizeCategory(category: unknown): string | null {
  if (typeof category === "string") {
    return category.toLowerCase();
  }
  if (category && typeof category === "object" && "_" in category && typeof (category as { _: unknown })._ === "string") {
    return (category as { _: string })._.toLowerCase();
  }
  return null;
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

    const categories = ((item.categories ?? []) as unknown[])
      .map(normalizeCategory)
      .filter((c): c is string => c !== null);

    await ingestArticle({
      title: item.title ?? "Untitled",
      url: item.link,
      summary: item.contentSnippet ?? null,
      region: publisher.region,
      categories,
      publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
      publisherId: publisher.id,
      publisherName: publisher.name,
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