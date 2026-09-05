"use client";

import { useSyncExternalStore } from "react";
import { formatAbsoluteDate, formatRelativeDate } from "../../lib/format";

/**
 * One ticker for the whole feed rather than an interval per article: with
 * 40+ timestamps on screen after a few "load more" clicks, per-instance
 * intervals add up for no benefit.
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let now = Date.now();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  timer ??= setInterval(() => {
    now = Date.now();
    for (const listener of listeners) listener();
  }, 60_000);

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => now;
/** `0` marks "not hydrated yet" — the server has no meaningful clock to share. */
const getServerSnapshot = () => 0;

/**
 * Renders the timezone-pinned absolute date on the server and through
 * hydration, then upgrades to relative time on the client. Relative text
 * depends on `Date.now()`, which would mismatch between the two otherwise.
 */
export function TimeStamp({ isoDate }: { isoDate: string }) {
  const clock = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const absolute = formatAbsoluteDate(isoDate);

  return (
    <time dateTime={isoDate} title={absolute}>
      {clock === 0 ? absolute : formatRelativeDate(isoDate, clock)}
    </time>
  );
}
