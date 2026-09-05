"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Article, FeedResponse } from "@repo/shared";
import { fetchFeed } from "../../lib/api";
import { categoriesForRegion, REGIONS } from "../../lib/feedOptions";
import { ArticleCard } from "./ArticleCard";
import { CategoryChips } from "./CategoryChips";
import { EmptyState, ErrorState, FeedSkeleton, Spinner } from "./FeedStates";
import { RegionSwitcher } from "./RegionSwitcher";

type FeedClientProps = {
  /** First page rendered on the server; `null` when that fetch failed. */
  initialData: FeedResponse | null;
  initialRegion: string;
  initialError: string | null;
};

const VIEW_ERROR = "Couldn't reach the newsfeed API. Check that it's running on port 4000.";
const MORE_ERROR = "Couldn't load more articles.";

export function FeedClient({ initialData, initialRegion, initialError }: FeedClientProps) {
  const [region, setRegion] = useState(initialRegion);
  const [category, setCategory] = useState<string | null>(null);

  const [articles, setArticles] = useState<Article[]>(initialData?.articles ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initialData?.nextCursor ?? null);
  const [hasMore, setHasMore] = useState(initialData?.hasMore ?? false);

  const [isReloading, setIsReloading] = useState(false);
  const [viewError, setViewError] = useState<string | null>(initialError);

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  /**
   * Latest-request-wins. Every fetch claims an id; a response whose id is no
   * longer the newest is dropped on the floor, so a slow US response can never
   * paint over an already-rendered UK view. The abort controller is the same
   * guard one layer down — it stops the wasted work rather than the render.
   */
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const startRequest = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    requestIdRef.current += 1;
    return { requestId: requestIdRef.current, signal: controller.signal };
  }, []);

  const isStale = useCallback((requestId: number) => requestId !== requestIdRef.current, []);

  const loadView = useCallback(
    async (nextRegion: string, nextCategory: string | null) => {
      const { requestId, signal } = startRequest();

      setIsReloading(true);
      setViewError(null);
      setMoreError(null);

      try {
        const data = await fetchFeed({ region: nextRegion, category: nextCategory }, { signal });
        if (isStale(requestId)) return;

        setArticles(data.articles);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch {
        if (signal.aborted || isStale(requestId)) return;
        setArticles([]);
        setNextCursor(null);
        setHasMore(false);
        setViewError(VIEW_ERROR);
      } finally {
        if (!isStale(requestId)) setIsReloading(false);
      }
    },
    [isStale, startRequest],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;

    const { requestId, signal } = startRequest();

    setIsLoadingMore(true);
    setMoreError(null);

    try {
      const data = await fetchFeed({ region, category, cursor: nextCursor }, { signal });
      if (isStale(requestId)) return;

      // Append, de-duping defensively: a webhook ingest between two pages can
      // shift the window enough to repeat an article at the boundary.
      setArticles((current) => {
        const seen = new Set(current.map((article) => article.id));
        return [...current, ...data.articles.filter((article) => !seen.has(article.id))];
      });
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      if (signal.aborted || isStale(requestId)) return;
      // Deliberately leaves `articles` untouched — a failed page must not wipe
      // what the reader is already looking at.
      setMoreError(MORE_ERROR);
    } finally {
      if (!isStale(requestId)) setIsLoadingMore(false);
    }
  }, [category, isLoadingMore, isStale, nextCursor, region, startRequest]);

  const handleRegionChange = useCallback(
    (nextRegion: string) => {
      if (nextRegion === region) return;
      setRegion(nextRegion);
      setCategory(null);
      void loadView(nextRegion, null);
    },
    [loadView, region],
  );

  const handleCategoryChange = useCallback(
    (nextCategory: string | null) => {
      if (nextCategory === category) return;
      setCategory(nextCategory);
      void loadView(region, nextCategory);
    },
    [category, loadView, region],
  );

  const retry = useCallback(() => void loadView(region, category), [category, loadView, region]);

  const chipCategories = useMemo(() => {
    const base = categoriesForRegion(region);
    // A category picked off an article card may not be in the curated list —
    // surface it so the active filter is always visible in the rail.
    return category && !base.includes(category) ? [category, ...base] : base;
  }, [category, region]);

  const regionLabel =
    REGIONS.find((option) => option.code === region)?.blurb ?? region;

  const showEmpty = !isReloading && !viewError && articles.length === 0;

  const viewStatus = isReloading ? "loading" : viewError ? "error" : "ready";

  return (
    // The data-feed-* attributes describe the settled view: they let an
    // end-to-end test wait on real state instead of racing a spinner.
    <div
      data-feed-region={region}
      data-feed-category={category ?? ""}
      data-feed-status={viewStatus}
      data-feed-count={articles.length}
      data-feed-has-more={String(hasMore)}
    >
      <div className="sticky top-0 z-20 -mx-4 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:mx-0 sm:rounded-b-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 py-3.5">
          <div className="flex items-baseline gap-2.5">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Latest</h2>
            <span aria-live="polite" className="font-mono text-[11px] text-ink-faint">
              {isReloading
                ? "loading…"
                : `${articles.length} article${articles.length === 1 ? "" : "s"} · ${regionLabel}`}
            </span>
          </div>
          <RegionSwitcher region={region} onChange={handleRegionChange} />
        </div>
        <div className="pb-3">
          <CategoryChips
            categories={chipCategories}
            active={category}
            onChange={handleCategoryChange}
          />
        </div>
      </div>

      <div className="pt-6 pb-20">
        {isReloading ? (
          <FeedSkeleton />
        ) : viewError ? (
          <ErrorState message={viewError} onRetry={retry} />
        ) : showEmpty ? (
          <EmptyState region={regionLabel} category={category} onClear={() => handleCategoryChange(null)} />
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {articles.map((article, index) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  index={index}
                  activeCategory={category}
                  onCategorySelect={handleCategoryChange}
                />
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-3">
              {moreError ? (
                <p role="alert" className="text-[13px] text-accent">
                  {moreError} <span className="text-ink-muted">Try again below.</span>
                </p>
              ) : null}

              {hasMore ? (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={isLoadingMore}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-[14px] font-medium text-ink shadow-card transition-colors hover:border-line-strong hover:bg-canvas-tint disabled:cursor-wait disabled:opacity-70"
                >
                  {isLoadingMore ? <Spinner /> : null}
                  {isLoadingMore ? "Loading" : moreError ? "Retry" : "Load more"}
                </button>
              ) : (
                <p className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
                  End of feed
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
