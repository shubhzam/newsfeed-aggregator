import { REGIONS } from "../../lib/feedOptions";

type RegionSwitcherProps = {
  region: string;
  onChange: (region: string) => void;
  disabled?: boolean;
};

export function RegionSwitcher({ region, onChange, disabled }: RegionSwitcherProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Region"
      className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5"
    >
      {REGIONS.map((option) => {
        const isActive = option.code === region;
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.blurb}
            disabled={disabled}
            onClick={() => onChange(option.code)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed ${
              isActive
                ? "bg-ink text-canvas"
                : "text-ink-muted hover:text-ink disabled:hover:text-ink-muted"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
