import { Router } from "express";
import { getFeed } from "../services/feed.js";

export const feedRouter: Router = Router();

feedRouter.get("/feed", async (req, res) => {
  const { region, limit, page } = req.query;

  if (!region || typeof region !== "string") {
    return res.status(400).json({ error: "region is required" });
  }

  const parsedLimit = limit ? parseInt(limit as string, 10) : 20;
  const parsedPage = page ? parseInt(page as string, 10) : 1;

  try {
    const result = await getFeed({ region, limit: parsedLimit, page: parsedPage });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: "database unavailable" });
  }
});