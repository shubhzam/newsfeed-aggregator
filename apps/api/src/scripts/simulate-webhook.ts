import "dotenv/config";
import { prisma } from "../lib/prisma.js";

const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "http://localhost:4000/webhooks/article-published";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "dev-shared-secret-please-change";

async function main() {
  // pick a real publisher to pretend to be, so the simulated payload is realistic
  const publisher = await prisma.publisher.findFirst();
  if (!publisher) {
    console.error("no publishers found - run the seed script first");
    process.exit(1);
  }

  const payload = {
    publisherId: publisher.id,
    title: "Breaking: Simulated Webhook Article",
    url: `${publisher.url}/simulated/${Date.now()}`,
    summary: "This article was created by the simulated webhook sender script.",
    categories: ["simulated"],
    publishedAt: new Date().toISOString(),
  };

  console.log(`simulating a webhook from ${publisher.name}...`);

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": WEBHOOK_SECRET,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  console.log(`response: ${response.status}`, body);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });