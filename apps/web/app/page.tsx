import type { FeedResponse } from "@repo/shared";
import { FeedClient } from "./components/FeedClient";
import { fetchFeed } from "../lib/api";
import { DEFAULT_REGION, REGIONS } from "../lib/feedOptions";

// The feed changes as articles are ingested, so never serve a cached render.
export const dynamic = "force-dynamic";

export default async function Home() {
  let initialData: FeedResponse | null = null;
  let initialError: string | null = null;

  try {
    initialData = await fetchFeed({ region: DEFAULT_REGION });
  } catch {
    // Rendering an error state beats throwing into Next's error boundary —
    // the controls stay usable so a retry doesn't require a page reload.
    initialError = "Couldn't reach the newsfeed API. Check that it's running on port 4000.";
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      <header className="pt-14 pb-9 sm:pt-20">
        <p className="font-mono text-[11px] tracking-[0.2em] text-ink-faint uppercase">
          {REGIONS.map((region) => region.code).join(" · ")} · cursor paginated
        </p>
        <h1 className="mt-3 text-[38px] leading-[1.05] font-semibold tracking-[-0.03em] text-ink sm:text-[46px]">
          Newsfeed
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-muted text-pretty">
          Everything ingested from TechCrunch, ESPN, BBC News and The Guardian, newest first.
        </p>
      </header>

      <FeedClient
        initialData={initialData}
        initialRegion={DEFAULT_REGION}
        initialError={initialError}
      />
    </div>
  );
}
