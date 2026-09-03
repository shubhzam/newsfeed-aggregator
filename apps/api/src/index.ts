import express from "express";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { config } from "./lib/config.js";
import { feedRouter } from "./routes/feed.js";

const app = express();

app.use(feedRouter);

app.get("/health", async (_req, res) => {
  const checks = { database: false, redis: false };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    // database unreachable, checks.database stays false
  }

  try {
    const pong = await redis.ping();
    checks.redis = pong === "PONG";
  } catch {
    // redis unreachable, checks.redis stays false
  }

  const allHealthy = checks.database && checks.redis;
  res.status(allHealthy ? 200 : 503).json({ status: allHealthy ? "ok" : "degraded", checks });
});

app.listen(config.port, () => {
  console.log(`api listening on http://localhost:${config.port}`);
});