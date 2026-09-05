import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";
import { ingestArticle } from "../services/ingestArticle.js";

export const webhooksRouter: Router = Router();

const webhookPayloadSchema = z.object({
  publisherId: z.string(),
  title: z.string().min(1),
  url: z.url(),
  summary: z.string().nullable().optional(),
  categories: z.array(z.string()).optional().default([]),
  publishedAt: z.iso.datetime(),
});

webhooksRouter.post("/webhooks/article-published", async (req, res) => {
  const secret = req.header("X-Webhook-Secret");
  if (secret !== config.webhookSecret) {
    return res.status(401).json({ error: "invalid webhook secret" });
  }

  const parseResult = webhookPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "invalid payload", details: parseResult.error.issues });
  }

  const payload = parseResult.data;

  try {
    const publisher = await prisma.publisher.findUnique({ where: { id: payload.publisherId } });
    if (!publisher) {
      return res.status(400).json({ error: "unknown publisherId" });
    }

    const created = await ingestArticle({
      title: payload.title,
      url: payload.url,
      summary: payload.summary ?? null,
      region: publisher.region,
      categories: payload.categories,
      publishedAt: new Date(payload.publishedAt),
      publisherId: publisher.id,
      publisherName: publisher.name,
    });

    res.json({ status: "ok", articleId: created.id });
  } catch (err) {
    res.status(503).json({ error: "database unavailable" });
  }
});