/**
 * Both formatters pin the timezone to UTC so a server render and the browser
 * hydration that follows produce byte-identical text.
 */
const absoluteFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatAbsoluteDate(isoDate: string): string {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? "" : absoluteFormatter.format(date);
}

const DIVISIONS: { limitSeconds: number; seconds: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limitSeconds: 60, seconds: 1, unit: "second" },
  { limitSeconds: 3600, seconds: 60, unit: "minute" },
  { limitSeconds: 86400, seconds: 3600, unit: "hour" },
  { limitSeconds: 604800, seconds: 86400, unit: "day" },
  { limitSeconds: 2629800, seconds: 604800, unit: "week" },
  { limitSeconds: 31557600, seconds: 2629800, unit: "month" },
];

/** "3 hours ago" for anything under a year, falling back to an absolute date. */
export function formatRelativeDate(isoDate: string, now: number = Date.now()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  const elapsedSeconds = (date.getTime() - now) / 1000;
  const magnitude = Math.abs(elapsedSeconds);

  for (const division of DIVISIONS) {
    if (magnitude < division.limitSeconds) {
      return relativeFormatter.format(Math.round(elapsedSeconds / division.seconds), division.unit);
    }
  }

  return absoluteFormatter.format(date);
}

/** Deterministic hue per publisher so each source keeps a stable colour. */
export function publisherHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}

export function publisherInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase();
  return `${(words[0] ?? "")[0] ?? ""}${(words[1] ?? "")[0] ?? ""}`.toUpperCase();
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
