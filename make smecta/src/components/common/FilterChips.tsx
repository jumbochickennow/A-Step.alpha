import React from 'react';

export interface FilterOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
}

export interface FilterChipsProps<T extends string = string> {
  options: FilterOption<T>[];
  selected: T;
  onChange: (value: T) => void;
  className?: string;
  /** Accessible name announced for the chip group. */
  label?: string;
}

export const FilterChips = <T extends string = string>({
  options,
  selected,
  onChange,
  className = '',
  label,
}: FilterChipsProps<T>) => {
  return (
    <div
      role="group"
      aria-label={label}
      className={`w-full overflow-x-auto scroll-row py-1 ${className}`}
    >
      <div className="flex items-center gap-2 min-w-max sm:flex-wrap sm:justify-center">
        {options.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`inline-flex min-h-11 items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shrink-0 ${
                isSelected
                  ? 'bg-primary text-white shadow-sm shadow-primary/25'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
              }`}
              aria-pressed={isSelected}
            >
              <span>{option.label}</span>
              {typeof option.count === 'number' && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default FilterChips;
