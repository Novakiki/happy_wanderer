'use client';

import { formStyles } from '@/lib/styles';
import { LIFE_STAGES, LIFE_STAGE_DESCRIPTIONS } from '@/lib/terminology';
import { YearInput } from './YearInput';

export type TimingMode = 'exact' | 'year' | 'chapter' | null;

export type TimingModeData = {
  exactDate?: string;
  year?: string | number | null;
  yearEnd?: string | number | null;
  lifeStage?: string;
};

export type TimingModeSelectorProps = {
  /** Currently selected timing mode */
  mode: TimingMode;
  /** Callback when mode changes */
  onModeChange: (mode: TimingMode) => void;
  /** Current timing data values */
  data: TimingModeData;
  /** Callback when a data field changes */
  onDataChange: (field: keyof TimingModeData, value: string | number | null) => void;
  /** Additional class for container */
  className?: string;
};

/**
 * Reusable timing mode selector with three card options:
 * - Exact date: For precise dates
 * - Around a year: For year or year range
 * - Chapter of life: For life stage selection
 *
 * Used in MemoryForm (add) and EditNotesClient (edit).
 *
 * @example
 * <TimingModeSelector
 *   mode={timingMode}
 *   onModeChange={setTimingMode}
 *   data={{
 *     exactDate: formData.exact_date,
 *     year: formData.year,
 *     yearEnd: formData.year_end,
 *     lifeStage: formData.life_stage,
 *   }}
 *   onDataChange={(field, value) => {
 *     if (field === 'exactDate') setFormData({ ...formData, exact_date: value });
 *     // etc.
 *   }}
 * />
 */
export function TimingModeSelector({
  mode,
  onModeChange,
  data,
  onDataChange,
  className = '',
}: TimingModeSelectorProps) {
  const cardBaseClass = 'w-full text-left rounded-xl border p-4 transition-all duration-200';
  const cardActiveClass = 'border-[#e07a5f] bg-[#e07a5f]/10';
  const cardInactiveClass = 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100';

  const radioBaseClass = 'w-4 h-4 rounded-full border-2 flex items-center justify-center';
  const radioActiveClass = 'border-[#e07a5f]';
  const radioInactiveClass = 'border-white/30';

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Exact date card */}
      <button
        type="button"
        onClick={() => onModeChange('exact')}
        className={`${cardBaseClass} ${mode === 'exact' ? cardActiveClass : cardInactiveClass}`}
      >
        <div className="flex items-center gap-3">
          <div className={`${radioBaseClass} ${mode === 'exact' ? radioActiveClass : radioInactiveClass}`}>
            {mode === 'exact' && <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />}
          </div>
          <div>
            <p className="text-sm font-medium text-white">Exact date</p>
            <p className="text-xs text-white/50">I know the specific day</p>
          </div>
        </div>
        {mode === 'exact' && (
          <div className="mt-4 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
            <input
              type="date"
              value={data.exactDate ?? ''}
              onChange={(e) => onDataChange('exactDate', e.target.value)}
              className={formStyles.input}
              required
            />
          </div>
        )}
      </button>

      {/* Year/range card */}
      <button
        type="button"
        onClick={() => onModeChange('year')}
        className={`${cardBaseClass} ${mode === 'year' ? cardActiveClass : cardInactiveClass}`}
      >
        <div className="flex items-center gap-3">
          <div className={`${radioBaseClass} ${mode === 'year' ? radioActiveClass : radioInactiveClass}`}>
            {mode === 'year' && <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />}
          </div>
          <div>
            <p className="text-sm font-medium text-white">Around a year</p>
            <p className="text-xs text-white/50">I know roughly when</p>
          </div>
        </div>
        {mode === 'year' && (
          <div className="mt-4 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
            <YearInput
              year={data.year}
              yearEnd={data.yearEnd}
              onYearChange={(y) => onDataChange('year', y)}
              onYearEndChange={(y) => onDataChange('yearEnd', y)}
              layout="grid"
              required
            />
          </div>
        )}
      </button>

      {/* Chapter card */}
      <button
        type="button"
        onClick={() => onModeChange('chapter')}
        className={`${cardBaseClass} ${mode === 'chapter' ? cardActiveClass : cardInactiveClass}`}
      >
        <div className="flex items-center gap-3">
          <div className={`${radioBaseClass} ${mode === 'chapter' ? radioActiveClass : radioInactiveClass}`}>
            {mode === 'chapter' && <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />}
          </div>
          <div>
            <p className="text-sm font-medium text-white">Chapter of her life</p>
            <p className="text-xs text-white/50">I remember the era, not the year</p>
          </div>
        </div>
        {mode === 'chapter' && (
          <div className="mt-4 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
            <select
              value={data.lifeStage ?? ''}
              onChange={(e) => onDataChange('lifeStage', e.target.value)}
              className={formStyles.select}
              required
            >
              <option value="">Select a chapter...</option>
              {Object.entries(LIFE_STAGES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {data.lifeStage && (
              <p className={`${formStyles.hint} mt-2`}>
                {LIFE_STAGE_DESCRIPTIONS[data.lifeStage as keyof typeof LIFE_STAGE_DESCRIPTIONS]}
              </p>
            )}
          </div>
        )}
      </button>
    </div>
  );
}
