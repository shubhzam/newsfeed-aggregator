import { uuidv7 } from "uuidv7";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  const publishers = await prisma.publisher.findMany();
  const publisherIdMap = new Map<string, string>();

  for (const pub of publishers) {
    const newId = uuidv7();
    publisherIdMap.set(pub.id, newId);
    await prisma.publisher.update({
      where: { id: pub.id },
      data: { newId },
    });
    console.log(`${pub.name}: ${pub.id} -> ${newId}`);
  }
  console.log(`generated new ids for ${publishers.length} publishers`);

  const articles = await prisma.article.findMany();
  for (const article of articles) {
    const newPublisherId = publisherIdMap.get(article.publisherId);
    if (!newPublisherId) {
      throw new Error(`no new id mapped for publisher ${article.publisherId} (article ${article.id})`);
    }
    await prisma.article.update({
      where: { id: article.id },
      data: {
        newId: uuidv7(),
        newPublisherId,
      },
    });
  }
  console.log(`generated new ids for ${articles.length} articles`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });