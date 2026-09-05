# newsfeed-aggregator

A regional news feed. Articles are ingested from real RSS feeds and publisher webhooks into Postgres, served through a cursor-paginated read API with a Redis first-page cache, and read by a Next.js frontend.

Live publishers: TechCrunch and ESPN (`US`), BBC News and The Guardian (`UK`).

```
                 pull                                          push
        ┌──────────────────────┐                    ┌──────────────────────────┐
        │  collect  (RSS)      │                    │ POST /webhooks/          │
        │  rss-parser, 10s cap │                    │      article-published   │
        └──────────┬───────────┘                    └────────────┬─────────────┘
                   │                                             │
                   └──────────────┬──────────────────────────────┘
                                  ▼
                        ingestArticle()          ← the only write path
                     upsert by url, then cache
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ┊
   Postgres (truth)       Redis  feed:{region}      MinIO / S3   ┈┈ planned
region/publishedAt/id     sorted set, cap 200    thumbnail objects
  GIN on categories        first page only        bucket: thumbnails
         │                        │                        ┊
         └───────────┬────────────┘                        ┊
                     ▼                                     ┊
         GET /feed?region&cursor&category                  ┊
                     │                                     ┊
        ┌────────────┴────────────┐                        ┊
        ▼                         ▼                        ┊
app/page.tsx (server)      FeedClient (client) ┈┈┈┈┈┈┈┈┈┈┈┈┘
renders the first page     owns every fetch after   <img src> resolves straight
                                                    to the object store — image
                                                    bytes never cross the API
```

---

## Ingestion

Pull (RSS collector) and push (webhook) both funnel through one `ingestArticle()`, so idempotency, region derivation, and cache updates can't drift between them.

- Idempotent on `Article.url` being unique — an upsert, so re-running the collector is a no-op and webhook retries can't duplicate. Only `categories` is refreshed on conflict.
- Region comes from the publisher record, never the request payload.
- One dead feed is skipped and tallied, not fatal. 10s cap per fetch, since feeds stall more often than they refuse.
- **Gotcha:** `rss-parser` types `categories` as `string[]`, but The Guardian sends `<category domain="...">`, which parses as an object. Both shapes are normalized and lowercased at ingest — which is what keeps category filtering index-servable later.

---

## Thumbnails: MinIO as the object store

> **Designed, not built.** Every article currently has `thumbnailUrl = null`. The column has been `String?` since feature 1, so nothing needs migrating. See `apps/docs/thumbnail-investigation-findings.md`.

- **Copy the bytes at ingest, don't hotlink.** Publisher asset URLs rotate and expire, hotlinking leaks reader IPs to four third parties, and some publishers block it.
- **Object store, not Postgres.** Blobs bloat exactly the rows the `[region, publishedAt, id]` index exists to keep tight and scannable.
- **MinIO because it's the S3 API.** Code targets S3 semantics; production becomes an endpoint + credentials change. Same reasoning as running real Postgres and Redis locally.
- **Clients read the store directly.** The collector writes objects, the API only returns URLs, the browser fetches the image. Thumbnails are the largest and most numerous objects here — proxying them turns a JSON API into a file server.
- **Fetch on the write path**, never lazily on read — that would put a third-party round trip inside the response the Redis cache exists to make fast.
- **The blocker is source coverage, not storage.** TechCrunch's feed has no image data at all (would need article-page scraping); BBC's `media:thumbnail` hits an unresolved `rss-parser` bug (#130) for that self-closing attributes-only shape; ESPN and Guardian are unverified.

---

## Cursor pagination

Ordered `publishedAt DESC, id DESC`; the cursor is that tuple from the last row, base64-encoded into one opaque string.

- **Composite, not id-only** — ids were `cuid()` when this was built, and a composite cursor is correct whether or not ids sort. Still true after the UUIDv7 migration, so it stayed.
- **Opaque** so clients can't assemble tuples that never existed; malformed cursors 400 rather than paginating from garbage.
- **Offset removed entirely**, not kept alongside — no good answer to "which wins if both are sent," and with constant ingestion at the head of the feed `OFFSET 20` shifts under the reader anyway.
- Index is `[region, publishedAt, id]`; `id` is there so the tuple comparison stays index-covered.
- **Breaks first:** the cursor carries no query context. Changing `category` mid-pagination is valid but meaningless. The frontend resets on filter change; the API doesn't enforce it.

---

## Caching

One Redis sorted set per region (`feed:{region}`), scored by publish time, capped at 200. It serves only `region`-only requests — any cursor or category goes to Postgres.

- **Narrow on purpose.** Replicating `(publishedAt, id)` tuple comparison in a sorted set means trusting float64 score precision and Redis's lexicographic tie-break to match Postgres's `id DESC`. Both fail as *wrong ordering* rather than as errors.
- **Cache-aside**, so a cold cache is normal: a miss queries Postgres, populates, and responds.
- **No TTL** — bounded by `ZREMRANGEBYRANK` and refreshed by the write path, so staleness tracks the last write rather than a clock.
- **Redis is never load-bearing.** Misses and errors both return `null` → Postgres; cache writes log and never throw. Redis down makes the feed slower, not wrong.

---

## Category filtering

`String[]` on `Article` with a GIN index, queried by array containment — just another `WHERE` on the same ordered scan, so it composes with region and cursor for free.

Tags are lowercased at ingest, so reads are an exact containment check the index can serve directly. There's deliberately **no discovery endpoint** — it would need a `DISTINCT unnest()` per request or a second thing to keep in sync — so the frontend curates its filter chips by hand.

---

## UUIDv7 primary keys

Time-sortable like a sequential key, without the enumerability of `/article/41` telling a caller how many articles exist and roughly when. Migrated from `cuid()` as a real backfill — add columns, map old→new while rewriting `Article.publisherId`, swap — not a truncate-and-reseed, so ingested data survived.

---

## Frontend

`app/page.tsx` is a Server Component that renders the first `region=US` page; `FeedClient` owns every fetch after that. The split means first paint is already populated instead of empty → spinner → content.

- **Latest-request-wins.** Rapid region switching can land a stale response over a newer render. Guarded by a monotonic request-id ref *and* an `AbortController`: abort cancels in-flight work, the id check catches a response that already completed before the switch. An e2e test holds a UK response open past the US render to prove it.
- **Failure is scoped to what failed.** A failed view fetch clears the list — showing the old region's articles under the new region's label is worse than showing nothing. A failed "load more" keeps everything on screen and errors inline.
- **Chips are per region.** US and UK tag vocabularies barely overlap (`ai`/`startups` vs `culture`/`politics`), so one shared list would leave half the chips dead either way.
- `packages/shared` holds `Article`/`FeedResponse`, so an API shape change breaks the build rather than the browser.

---

## Failure posture

**Degraded is not the same as broken**, and each layer is explicit about which it's allowed to be:

| Failure | Behavior |
| --- | --- |
| Redis down or cold | Reads fall through to Postgres; correctness unchanged |
| Cache write fails | Logged, never thrown; the response is unaffected |
| One RSS feed dead or hanging | That publisher is skipped, the run continues and reports a tally |
| Postgres down | `/feed` returns 503 rather than a partial or invented result |
| API unreachable from the browser | Error state with working controls, not a crash |
| A "load more" page fails | Existing articles stay on screen; the error is inline and retryable |
| Thumbnail fetch fails *(planned)* | Article still ingests; `thumbnailUrl` stays `null`, card renders without an image |

`GET /health` reports Postgres and Redis independently and 503s when either is down.

---

## Repository shape

| Path | Contents |
| --- | --- |
| `apps/api` | Express API, Prisma schema and migrations, RSS collector, webhook receiver |
| `apps/web` | Next.js frontend — server-rendered feed page plus the client island |
| `apps/docs` | Per-feature planning / techspec / dataflow documents |
| `packages/shared` | The `Article` / `FeedResponse` contract shared by API and web |
| `packages/typescript-config`, `packages/eslint-config` | Shared tooling config |

Each feature in `apps/docs` carries a planning doc (decisions and what forced them), a techspec (contracts and edge cases), and a dataflow (one success trace, one failure trace).
