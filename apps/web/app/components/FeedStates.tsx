export function FeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-center gap-2.5">
            <div className="skeleton size-7 rounded-lg" />
            <div className="skeleton h-3 w-28 rounded-full" />
          </div>
          <div className="skeleton mt-4 h-4 w-[92%] rounded-full" />
          <div className="skeleton mt-2 h-4 w-[64%] rounded-full" />
          <div className="skeleton mt-4 h-3 w-full rounded-full" />
          <div className="skeleton mt-2 h-3 w-[80%] rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  region,
  category,
  onClear,
}: {
  region: string;
  category: string | null;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <p className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
        No articles found
      </p>
      <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-muted">
        {category ? (
          <>
            Nothing tagged <span className="font-medium text-ink">{category}</span> has been
            ingested for {region} yet.
          </>
        ) : (
          <>No articles have been ingested for {region} yet.</>
        )}
      </p>
      {category ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 rounded-full border border-line-strong px-4 py-2 text-[13px] font-medium text-ink transition-colors hover:border-ink hover:bg-canvas-tint"
        >
          Clear filter
        </button>
      ) : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-line bg-surface px-6 py-12 text-center"
    >
      <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">
        Feed unavailable
      </p>
      <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-muted">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-canvas transition-opacity hover:opacity-85"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      className={`size-4 animate-spin ${className}`}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
