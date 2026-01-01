'use client';

import { formStyles } from '@/lib/styles';
import { YEAR_CONSTRAINTS } from '@/lib/form-validation';

// Re-export for convenience
export { YEAR_CONSTRAINTS };

type YearValue = number | string | null | undefined;

export type YearInputProps = {
  /** Start year value */
  year: YearValue;
  /** End year value (for ranges) */
  yearEnd?: YearValue;
  /** Callback when year changes */
  onYearChange: (year: number | null) => void;
  /** Callback when yearEnd changes */
  onYearEndChange?: (yearEnd: number | null) => void;
  /** Layout mode */
  layout?: 'grid' | 'inline';
  /** Size variant */
  size?: 'default' | 'small';
  /** Whether year is required */
  required?: boolean;
  /** Custom placeholder for year */
  placeholder?: string;
  /** Custom placeholder for year end */
  placeholderEnd?: string;
  /** Label text (only shown in inline mode) */
  label?: string;
  /** Additional class for container */
  className?: string;
};

/**
 * Normalize various year value types to number or empty string for input.
 */
function normalizeYearValue(value: YearValue): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return value === 0 ? '' : String(value);
  return value;
}

/**
 * Parse input string to number or null.
 */
function parseYearInput(value: string): number | null {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Reusable year input component with optional year range support.
 *
 * Two layout modes:
 * - `grid`: Both year and yearEnd shown side by side (for timing cards)
 * - `inline`: Progressive disclosure - yearEnd hidden until "+ end year" clicked
 *
 * @example
 * // Grid layout (both fields always visible)
 * <YearInput
 *   year={formData.year}
 *   yearEnd={formData.year_end}
 *   onYearChange={(y) => setFormData({ ...formData, year: y })}
 *   onYearEndChange={(y) => setFormData({ ...formData, year_end: y })}
 *   layout="grid"
 * />
 *
 * @example
 * // Inline layout with progressive disclosure
 * <YearInput
 *   year={editForm.year}
 *   yearEnd={editForm.year_end}
 *   onYearChange={(y) => setEditForm({ ...editForm, year: y ?? 0 })}
 *   onYearEndChange={(y) => setEditForm({ ...editForm, year_end: y })}
 *   layout="inline"
 *   label="Year"
 * />
 */
export function YearInput({
  year,
  yearEnd,
  onYearChange,
  onYearEndChange,
  layout = 'grid',
  size = 'default',
  required = false,
  placeholder = 'Year, e.g. 1996',
  placeholderEnd = 'End year (optional)',
  label,
  className = '',
}: YearInputProps) {
  const inputClass = size === 'small' ? formStyles.inputSmall : formStyles.input;
  const hasYearEnd = yearEnd !== null && yearEnd !== undefined && yearEnd !== '';
  const supportsYearEnd = Boolean(onYearEndChange);

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onYearChange(parseYearInput(e.target.value));
  };

  const handleYearEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onYearEndChange?.(parseYearInput(e.target.value));
  };

  const addEndYear = () => {
    // Initialize end year to match start year as sensible default
    const startYear = parseYearInput(normalizeYearValue(year));
    onYearEndChange?.(startYear);
  };

  const removeEndYear = () => {
    onYearEndChange?.(null);
  };

  // Grid layout: both inputs side by side
  if (layout === 'grid') {
    return (
      <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
        <input
          type="number"
          min={YEAR_CONSTRAINTS.min}
          max={YEAR_CONSTRAINTS.max}
          inputMode="numeric"
          value={normalizeYearValue(year)}
          onChange={handleYearChange}
          placeholder={placeholder}
          className={inputClass}
          required={required}
        />
        {supportsYearEnd && (
          <input
            type="number"
            min={YEAR_CONSTRAINTS.min}
            max={YEAR_CONSTRAINTS.max}
            inputMode="numeric"
            value={normalizeYearValue(yearEnd)}
            onChange={handleYearEndChange}
            placeholder={placeholderEnd}
            className={inputClass}
          />
        )}
      </div>
    );
  }

  // Inline layout: progressive disclosure for year end
  return (
    <div className={className}>
      {label && (
        <label className="text-xs text-white/50 uppercase tracking-wider">
          {hasYearEnd ? `${label} range` : label}
        </label>
      )}
      <div className="flex items-center gap-2 mt-1">
        <input
          type="number"
          min={YEAR_CONSTRAINTS.min}
          max={YEAR_CONSTRAINTS.max}
          inputMode="numeric"
          value={normalizeYearValue(year)}
          onChange={handleYearChange}
          className="w-20 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40"
          required={required}
        />
        {supportsYearEnd && (
          hasYearEnd ? (
            <>
              <span className="text-white/30">–</span>
              <input
                type="number"
                min={YEAR_CONSTRAINTS.min}
                max={YEAR_CONSTRAINTS.max}
                inputMode="numeric"
                value={normalizeYearValue(yearEnd)}
                onChange={handleYearEndChange}
                className="w-20 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40"
              />
              <button
                type="button"
                onClick={removeEndYear}
                className="text-white/30 hover:text-white/60 text-xs transition-colors"
                title="Remove end year"
              >
                ×
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={addEndYear}
              className="text-white/50 hover:text-white/70 text-xs transition-colors"
            >
              + end year
            </button>
          )
        )}
      </div>
    </div>
  );
}
