import type { RequestHandler } from "express";
import { config } from "./config.js";

/**
 * The web app's client components fetch the API directly from the browser
 * (see the frontend-feed dataflow doc), so the API has to opt those origins in.
 * Hand-rolled rather than pulling in `cors`: the feed is read-only, credential-free,
 * and the allowlist is a short fixed list.
 */
export const corsMiddleware: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;

  if (origin && config.webOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
};
