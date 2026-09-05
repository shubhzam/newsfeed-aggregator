# newsfeed-aggregator

A regional news feed. Articles are ingested from real RSS feeds and publisher webhooks into Postgres, served through a cursor-paginated read API with a Redis first-page cache, and read by a Next.js frontend.

Four publishers are live: TechCrunch and ESPN (`US`), BBC News and The Guardian (`UK`).

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
                   ┌──────────────┴──────────────┐
                   ▼                             ▼
             Postgres (truth)            Redis  feed:{region}
          region/publishedAt/id          sorted set, cap 200
             GIN on categories            first page only
                   │                             │
                   └──────────────┬──────────────┘
                                  ▼
                       GET /feed?region&cursor&category
                                  │
                   ┌──────────────┴──────────────┐
                   ▼                             ▼
          app/page.tsx (server)          FeedClient (client)
          renders the first page         owns every fetch after
```

---

## Ingestion: one write path, two triggers

Articles arrive two ways — a pull-based RSS collector and a push-based webhook — and both funnel through a single `ingestArticle()` function. That convergence is the point: idempotency, region derivation, and cache maintenance are written once and cannot drift between the two entry points.

Idempotency is anchored on `Article.url` being unique, so ingestion is an upsert rather than an insert. Re-running the collector over an unchanged feed is a no-op, and a publisher retrying a webhook cannot create a duplicate. The upsert deliberately only refreshes `categories` on conflict — a re-ingest corrects tagging without rewriting a title or timestamp that may have been correct the first time.

Region is never taken from the wire. The webhook payload carries a `publisherId`; region is read off that publisher record. A caller cannot inject an article into a region the publisher doesn't belong to.

**Where the real world intrudes:** `rss-parser`'s types claim `categories` is always `string[]`. The Guardian emits `<category domain="...">`, which parses as an object, not a string. Trusting the type signature silently drops every Guardian tag. The collector normalizes both shapes and lowercases at the boundary, which is what makes case-insensitive category filtering possible downstream without a single `LOWER()` at query time.

**Failure isolation:** the collector loops publishers in a try/catch per publisher and reports a `succeeded/failed` tally. One dead feed degrades the run, it doesn't abort it. Each fetch is capped at 10 seconds, because an RSS endpoint that accepts a connection and then stalls is a more common failure than one that refuses outright.

---

## Cursor pagination: composite, opaque, and the only option

The feed is ordered by `publishedAt DESC, id DESC`, and the cursor is the `(publishedAt, id)` tuple of the last row on the page, base64-encoded into one opaque string.

**Why a composite cursor rather than an id-only one.** Ordering by a single sortable id requires the id to be monotonic. That wasn't true when pagination was built — ids were `cuid()` at the time — and a composite cursor is correct regardless of whether ids sort. Ids have since migrated to UUIDv7 (below), which would now permit the simpler form; the composite cursor stays because it's correct either way and re-deriving pagination to save a column comparison buys nothing.

**Why it's opaque.** Exposing `publishedAt` and `id` as two separate query params invites clients to construct or tamper with them independently, producing tuples that never existed in the data. One encoded blob has a single valid shape, and `decodeCursor` rejects anything malformed with a 400 rather than silently paginating from garbage.

**Why offset pagination was removed, not kept alongside.** Running both on one endpoint raises a question with no good answer — which wins when a client sends `page` *and* `cursor`? Nothing consumed the endpoint at the time, so this was a clean break rather than a versioning problem. Cursor pagination is also the correct default here on its own merits: with articles constantly being ingested at the head of the feed, `OFFSET 20` shifts under the reader between requests, duplicating or skipping rows. A cursor is anchored to a row, not a position.

The index is `[region, publishedAt, id]` — `id` included specifically so the tuple comparison is fully index-covered rather than degrading to a filter after the range scan.

**Where this breaks first:** the cursor encodes no query context. A client that keeps a cursor and changes `category` between pages gets a valid but meaningless continuation. The frontend resets pagination on every filter change; the API does not enforce it.

---

## Caching: a fast path, deliberately not a complete one

Redis holds one sorted set per region (`feed:{region}`), scored by publish time, trimmed to the 200 most recent articles. It serves exactly one shape of request: `region` only, no cursor, no category. Everything else goes straight to Postgres.

That narrowness is the design, not an unfinished edge. Reproducing `(publishedAt, id)` tuple-comparison semantics inside a sorted set means depending on float64 score precision for timestamps and on Redis's lexicographic tie-break matching Postgres's `id DESC` for equal scores. Neither holds reliably, and both fail as *wrong ordering* rather than as an error — the worst failure mode available. The traffic that actually matters is the first page of a region; page twelve of a category filter is rare enough to be worth a Postgres round trip.

**Cache-aside, not pre-warmed.** A cold cache is a normal state — before the first collector run ever executes, after a Redis restart — so an uncursored miss queries Postgres, populates the cache from that result, and responds. Reads never depend on ingestion having happened first.

**No TTL.** Size is bounded by `ZREMRANGEBYRANK` on every write, not by expiry. Ingestion actively pushes each new article into the cache, so entries are refreshed by the write path rather than aged out by a clock. Staleness is bounded by "since the last write," which a TTL would only make worse by periodically forcing a cold miss on the hottest key in the system.

**Redis is never load-bearing.** `readFeedCache` returns `null` for both a genuine miss and any Redis error, collapsing two cases the caller has no reason to distinguish — both mean "go to Postgres." Cache writes log their failures and never throw. Redis going down makes the feed slower; it does not make it wrong or unavailable.

---

## Category filtering: cheap because the work happened at ingest

Categories are a `String[]` on `Article` with a GIN index, queried by array containment. Filtering composes with everything else — region, cursor, page size — because it's an additional `WHERE` clause against the same ordered scan, not a separate code path.

The reason it stays cheap is that normalization was pushed to the write boundary. Tags are lowercased once during ingestion, so the query is an exact containment check that the GIN index can serve directly. Normalizing at read time instead would mean a function call on every row of every query and an index that no longer applies.

There is deliberately **no category discovery endpoint**. Nothing in the system knows the set of valid categories without a full scan, and inventing one would mean either an expensive `DISTINCT unnest()` per request or a second thing to keep in sync with ingestion. The consequence is pushed to the frontend, which curates its filter chips by hand (below).

---

## UUIDv7 primary keys

Both `Publisher.id` and `Article.id` are UUIDv7, migrated from `cuid()`. Version 7 UUIDs embed a millisecond timestamp in their high bits, so they sort chronologically while remaining unguessable — the index locality of a sequential key without the enumerable, information-leaking surface of an auto-incrementing integer, where `/article/41` tells a caller that articles 1 through 40 exist and roughly when they were created.

The migration was done as a real data migration (add columns → backfill with a script that maps old ids to new while rewriting `Article.publisherId` foreign keys → swap), not a truncate-and-reseed, so existing ingested articles survived it.

---

## Frontend: a server-rendered page with a client island

`app/page.tsx` is a Server Component that fetches the first `region=US` page and passes it as props. `FeedClient` is a Client Component that receives that data and owns every fetch afterwards — region switching, category filtering, and "load more."

The split exists so the first paint is fully populated. A client-side `useEffect` fetch would ship an empty page, then a spinner, then content — three states and an extra round trip to show data the server already had in hand.

### Latest-request-wins

Rapid region switching is a genuine race: a request for US can resolve *after* a newer request for UK has already rendered, painting stale content over correct content. This is handled with a monotonic request-id ref plus an `AbortController`. Every fetch claims an id; on arrival, a response whose id is no longer the newest is discarded. The abort controller is the same guard one layer down — it cancels wasted work, while the id check is what actually protects the render.

Two guards rather than one, because they cover different windows. Abort stops a request still in flight; the id check catches a response that had *already completed* before the switch and was merely waiting to be handled. This is verified by an end-to-end test that holds a UK response open until after the US view has rendered, then asserts the US view survives.

### Failure is scoped to what failed

The two fetch paths fail differently on purpose. A failed *view* fetch (region or category change) clears the list and shows a full error state — rendering the previous region's articles under the new region's label would be worse than showing nothing. A failed *"load more"* leaves every already-rendered article untouched and surfaces an inline message next to the button, because the next page failing is no reason to take away the page the reader is currently looking at.

When the API is unreachable during the server render, the page catches it and renders the error state with controls still live, rather than throwing into Next's error boundary. The retry path doesn't require a page reload.

### Curated filter chips, per region

Because the API has no category discovery, the chips are hardcoded — and they're **per region**, not one shared list. US and UK vocabularies in the real ingested data are almost disjoint (`ai`/`startups` are US-only; `culture`/`politics` are UK-only), so a single shared list would leave half the chips dead on whichever region you were viewing. Cards also render their own tags as clickable chips, which is how a reader reaches a category outside the curated set.

### The shared type contract

`packages/shared` holds `Article` and `FeedResponse` — the first types promoted out of `apps/api`, on the trigger that a genuine second consumer now exists. The frontend imports them instead of hand-copying the shape, so a change to the API response shape breaks the build rather than failing silently at runtime in the browser.

---

## Failure posture, as a whole

The recurring rule across the system is that **degraded is not the same as broken**, and each layer is explicit about which one it's allowed to be:

| Failure | Behavior |
| --- | --- |
| Redis down or cold | Every read falls through to Postgres; correctness unchanged |
| Cache write fails | Logged, never thrown; the response is unaffected |
| One RSS feed dead or hanging | That publisher is skipped, the run continues and reports a tally |
| Postgres down | `/feed` returns 503 rather than a partial or invented result |
| API unreachable from the browser | The page renders an error state with working controls, not a crash |
| A "load more" page fails | Existing articles stay on screen; the error is inline and retryable |

`GET /health` reports Postgres and Redis independently and returns 503 when either is down, so "the API is up but its dependencies aren't" is a distinguishable state rather than a mystery.

---

## Repository shape

| Path | Contents |
| --- | --- |
| `apps/api` | Express API, Prisma schema and migrations, RSS collector, webhook receiver |
| `apps/web` | Next.js frontend — server-rendered feed page plus the client island |
| `apps/docs` | Per-feature planning / techspec / dataflow documents |
| `packages/shared` | The `Article` / `FeedResponse` contract shared by API and web |
| `packages/typescript-config`, `packages/eslint-config` | Shared tooling config |

Each feature in `apps/docs` follows the same three-document structure — planning (decisions and their forcing constraints), techspec (contracts and edge cases), dataflow (a concrete success trace and a concrete failure trace). The decision logs there record what was rejected and why, which is usually the part that's hardest to reconstruct later.
