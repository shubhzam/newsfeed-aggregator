import { categoryLabel } from "../../lib/feedOptions";

type CategoryChipsProps = {
  categories: string[];
  active: string | null;
  onChange: (category: string | null) => void;
  disabled?: boolean;
};

export function CategoryChips({ categories, active, onChange, disabled }: CategoryChipsProps) {
  return (
    <div
      role="group"
      aria-label="Filter by category"
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 sm:mx-0 sm:px-0"
    >
      <Chip label="All" isActive={active === null} disabled={disabled} onClick={() => onChange(null)} />
      {categories.map((category) => (
        <Chip
          key={category}
          label={categoryLabel(category)}
          isActive={active === category}
          disabled={disabled}
          onClick={() => onChange(active === category ? null : category)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  isActive,
  disabled,
  onClick,
}: {
  label: string;
  isActive: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] whitespace-nowrap capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        isActive
          ? "border-accent bg-accent text-white"
          : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
