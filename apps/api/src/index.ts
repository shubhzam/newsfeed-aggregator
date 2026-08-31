import "dotenv/config";
import express from "express";
import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Redis } from "ioredis";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

const app = express();
const port = process.env.PORT ?? 4000;

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

app.listen(port, () => {
  console.log(`api listening on http://localhost:${port}`);
});