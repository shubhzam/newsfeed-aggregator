import { Router } from "express";
import { getFeed, decodeCursor } from "../services/feed.js";

export const feedRouter: Router = Router();

feedRouter.get("/feed", async (req, res) => {
  const { region, limit, cursor } = req.query;

  if (!region || typeof region !== "string") {
    return res.status(400).json({ error: "region is required" });
  }

  const parsedLimit = limit ? parseInt(limit as string, 10) : 20;

  let decodedCursor = null;
  if (cursor) {
    if (typeof cursor !== "string") {
      return res.status(400).json({ error: "invalid cursor" });
    }
    try {
      decodedCursor = decodeCursor(cursor);
    } catch {
      return res.status(400).json({ error: "invalid cursor" });
    }
  }

  try {
    const result = await getFeed({ region, limit: parsedLimit, cursor: decodedCursor });
    res.json(result);
  } catch (err) {
    res.status(503).json({ error: "database unavailable" });
  }
});