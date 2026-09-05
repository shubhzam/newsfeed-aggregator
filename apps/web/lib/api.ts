import type { FeedResponse } from "@repo/shared";

/**
 * The browser talks to the API directly (see the frontend-feed dataflow doc),
 * so the base URL has to be public. `API_URL` lets a server-side render reach
 * the API over a different hostname (e.g. a container name) when needed.
 */
const BROWSER_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const SERVER_API_URL = process.env.API_URL ?? BROWSER_API_URL;

export const PAGE_SIZE = 20;

export function apiBaseUrl(): string {
  return typeof window === "undefined" ? SERVER_API_URL : BROWSER_API_URL;
}

export type FeedQuery = {
  region: string;
  category?: string | null;
  cursor?: string | null;
  limit?: number;
};

export function buildFeedUrl({ region, category, cursor, limit = PAGE_SIZE }: FeedQuery): string {
  const params = new URLSearchParams({ region, limit: String(limit) });
  if (category) params.set("category", category);
  if (cursor) params.set("cursor", cursor);
  return `${apiBaseUrl()}/feed?${params.toString()}`;
}

/** Throws on any non-2xx or transport failure; callers own the error state. */
export async function fetchFeed(query: FeedQuery, init?: RequestInit): Promise<FeedResponse> {
  const response = await fetch(buildFeedUrl(query), { cache: "no-store", ...init });

  if (!response.ok) {
    throw new Error(`Feed request failed with status ${response.status}`);
  }

  return (await response.json()) as FeedResponse;
}
