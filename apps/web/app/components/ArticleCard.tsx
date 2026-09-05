import type { CSSProperties } from "react";
import type { Article } from "@repo/shared";
import { hostnameOf, publisherHue, publisherInitials } from "../../lib/format";
import { TimeStamp } from "./TimeStamp";

type ArticleCardProps = {
  article: Article;
  /** Staggers the entrance transition across a freshly rendered page. */
  index: number;
  onCategorySelect: (category: string) => void;
  activeCategory: string | null;
};

export function ArticleCard({
  article,
  index,
  onCategorySelect,
  activeCategory,
}: ArticleCardProps) {
  const hue = publisherHue(article.publisher.name);
  const host = hostnameOf(article.url);

  // Cards show at most 5 tags, and articles routinely carry a dozen. Hoist the
  // active filter so the reader can always see why this article matched.
  const orderedCategories =
    activeCategory && article.categories.includes(activeCategory)
      ? [activeCategory, ...article.categories.filter((c) => c !== activeCategory)]
      : article.categories;

  return (
    <article
      className="rise group relative"
      style={{ "--rise-delay": `${Math.min(index, 6) * 30}ms` } as CSSProperties}
    >
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition duration-200 group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:shadow-card-hover group-focus-within:border-line-strong">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 bg-accent transition-transform duration-300 group-hover:scale-y-100 group-focus-within:scale-y-100"
        />

        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2.5 text-[13px]">
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-semibold tracking-tight"
              style={{
                backgroundColor: `hsl(${hue} 68% 50% / 0.14)`,
                color: `light-dark(hsl(${hue} 72% 30%), hsl(${hue} 78% 70%))`,
              }}
            >
              {publisherInitials(article.publisher.name)}
            </span>
            <span className="font-medium text-ink">{article.publisher.name}</span>
            <span aria-hidden className="text-ink-faint">
              ·
            </span>
            <span className="text-ink-muted">
              <TimeStamp isoDate={article.publishedAt} />
            </span>
            <span className="ml-auto hidden font-mono text-[11px] text-ink-faint sm:inline">
              {host}
            </span>
          </div>

          <h2 className="mt-3 text-[19px] leading-snug font-semibold tracking-[-0.011em] text-balance text-ink sm:text-[21px]">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors before:absolute before:inset-0 before:content-[''] hover:text-accent"
            >
              {article.title}
            </a>
          </h2>

          {article.summary ? (
            <p className="mt-2.5 line-clamp-3 text-[15px] leading-relaxed text-ink-muted">
              {article.summary}
            </p>
          ) : null}

          {article.categories.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {orderedCategories.slice(0, 5).map((category) => {
                const isActive = category === activeCategory;
                return (
                  <li key={category} className="relative z-10">
                    <button
                      type="button"
                      onClick={() => onCategorySelect(category)}
                      className={`rounded-full border px-2.5 py-1 font-mono text-[11px] tracking-wide lowercase transition-colors ${
                        isActive
                          ? "border-accent bg-accent-soft text-accent"
                          : "border-line bg-canvas-tint text-ink-muted hover:border-line-strong hover:text-ink"
                      }`}
                    >
                      {category}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </article>
  );
}
