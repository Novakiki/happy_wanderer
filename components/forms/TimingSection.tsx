'use client';

import { useState } from 'react';
import { formStyles } from '@/lib/styles';
import {
  LIFE_STAGES,
  LIFE_STAGE_DESCRIPTIONS,
  TIMING_CERTAINTY,
  TIMING_CERTAINTY_DESCRIPTIONS,
} from '@/lib/terminology';
import type { TimingData, TimingMode, LifeStage, EntryType } from '@/lib/form-types';
import { DisclosureSection } from './DisclosureSection';
import { YearInput } from './YearInput';

type Props = {
  value: TimingData;
  onChange: (timing: TimingData) => void;
  entryType: EntryType;
  mode?: 'cards' | 'dropdowns'; // cards = add form, dropdowns = edit form
  showLocation?: boolean;
  location?: string;
  onLocationChange?: (location: string) => void;
};

export default function TimingSection({
  value,
  onChange,
  entryType,
  mode = 'cards',
  showLocation = false,
  location = '',
  onLocationChange,
}: Props) {
  // For progressive disclosure in add mode
  const [showTimingNote, setShowTimingNote] = useState(!!value.note);
  const [showLocationField, setShowLocationField] = useState(showLocation);

  const updateMode = (timingMode: TimingMode) => {
    onChange({
      ...value,
      mode: timingMode,
      certainty: timingMode === 'exact' ? 'exact' : 'approximate',
    });
  };

  const updateField = <K extends keyof TimingData>(field: K, fieldValue: TimingData[K]) => {
    onChange({ ...value, [field]: fieldValue });
  };

  // Milestone and Synchronicity always use exact date
  if (entryType === 'milestone' || entryType === 'origin') {
    return (
      <div className={formStyles.section}>
        <p className={formStyles.sectionLabel}>When & Where</p>
        <div>
          <label className={formStyles.label}>
            Date <span className={formStyles.required}>*</span>
          </label>
          <input
            type="date"
            value={value.exactDate || ''}
            onChange={(e) => {
              const date = e.target.value;
              const year = date ? parseInt(date.split('-')[0], 10) : undefined;
              updateField('exactDate', date);
              if (year) updateField('year', year);
            }}
            className={formStyles.input}
            required
          />
        </div>
        {showLocationField && onLocationChange && (
          <div className="mt-4">
            <label className={formStyles.label}>Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              placeholder="e.g., St. Paul, MN"
              className={formStyles.input}
            />
          </div>
        )}
      </div>
    );
  }

  // Dropdowns mode (for edit form)
  if (mode === 'dropdowns') {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
        <p className={formStyles.sectionLabel}>Timing</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={formStyles.label}>How sure are you?</label>
            <select
              value={value.certainty}
              onChange={(e) => updateField('certainty', e.target.value as TimingData['certainty'])}
              className={formStyles.select}
            >
              {Object.entries(TIMING_CERTAINTY).map(([val, lbl]) => (
                <option key={val} value={val}>
                  {lbl}
                </option>
              ))}
            </select>
            <p className={formStyles.hint}>
              {TIMING_CERTAINTY_DESCRIPTIONS[value.certainty]}
            </p>
          </div>
          <div>
            <label className={formStyles.label}>How do you remember it?</label>
            <select
              value={value.mode}
              onChange={(e) => updateMode(e.target.value as TimingMode)}
              className={formStyles.select}
            >
              <option value="exact">Exact date</option>
              <option value="year">Year</option>
              <option value="year_range">Year range</option>
              <option value="life_stage">Life stage</option>
            </select>
          </div>
        </div>

        {value.mode === 'exact' && (
          <div>
            <label className={formStyles.label}>Date</label>
            <input
              type="date"
              value={value.exactDate || ''}
              onChange={(e) => {
                const date = e.target.value;
                const year = date ? parseInt(date.split('-')[0], 10) : undefined;
                updateField('exactDate', date);
                if (year) updateField('year', year);
              }}
              className={formStyles.input}
            />
          </div>
        )}

        {value.mode === 'year' && (
          <div>
            <label className={formStyles.label}>Year</label>
            <input
              type="number"
              value={value.year || ''}
              onChange={(e) => updateField('year', parseInt(e.target.value, 10) || undefined)}
              className={formStyles.input}
            />
          </div>
        )}

        {value.mode === 'year_range' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={formStyles.label}>Start year</label>
              <input
                type="number"
                value={value.year || ''}
                onChange={(e) => updateField('year', parseInt(e.target.value, 10) || undefined)}
                className={formStyles.input}
              />
            </div>
            <div>
              <label className={formStyles.label}>End year</label>
              <input
                type="number"
                value={value.yearEnd ?? ''}
                onChange={(e) => updateField('yearEnd', parseInt(e.target.value, 10) || null)}
                className={formStyles.input}
              />
            </div>
          </div>
        )}

        {value.mode === 'life_stage' && (
          <div>
            <label className={formStyles.label}>Life stage</label>
            <select
              value={value.lifeStage ?? ''}
              onChange={(e) => updateField('lifeStage', (e.target.value || null) as LifeStage | null)}
              className={formStyles.select}
            >
              <option value="">Select a stage</option>
              {Object.entries(LIFE_STAGES).map(([val, lbl]) => (
                <option key={val} value={val}>
                  {lbl}
                </option>
              ))}
            </select>
            {value.lifeStage && (
              <p className={formStyles.hint}>
                {LIFE_STAGE_DESCRIPTIONS[value.lifeStage]}
              </p>
            )}
          </div>
        )}

        <div>
          <label className={formStyles.label}>Timing note (optional)</label>
          <textarea
            value={value.note || ''}
            onChange={(e) => updateField('note', e.target.value)}
            rows={2}
            className={formStyles.textarea}
          />
        </div>
      </div>
    );
  }

  // Cards mode (for add form) - Memory entry type
  return (
    <div className={formStyles.section}>
      <p className={formStyles.sectionLabel}>When & Where</p>
      <p className={`${formStyles.hint} mb-4`}>
        Choose one way to place this memory in time{' '}
        <span className={formStyles.required}>*</span>
      </p>

      <div className="space-y-3">
        {/* Exact date card */}
        <button
          type="button"
          onClick={() => updateMode('exact')}
          className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
            value.mode === 'exact'
              ? 'border-[#e07a5f] bg-[#e07a5f]/10'
              : 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                value.mode === 'exact' ? 'border-[#e07a5f]' : 'border-white/30'
              }`}
            >
              {value.mode === 'exact' && (
                <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">Exact date</p>
              <p className="text-xs text-white/50">I know the specific day</p>
            </div>
          </div>
          {value.mode === 'exact' && (
            <div
              className="mt-4 pt-4 border-t border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="date"
                value={value.exactDate || ''}
                onChange={(e) => {
                  const date = e.target.value;
                  const year = date ? parseInt(date.split('-')[0], 10) : undefined;
                  updateField('exactDate', date);
                  if (year) updateField('year', year);
                }}
                className={formStyles.input}
                required
              />
            </div>
          )}
        </button>

        {/* Year/range card */}
        <button
          type="button"
          onClick={() => updateMode('year')}
          className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
            value.mode === 'year' || value.mode === 'year_range'
              ? 'border-[#e07a5f] bg-[#e07a5f]/10'
              : 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                value.mode === 'year' || value.mode === 'year_range'
                  ? 'border-[#e07a5f]'
                  : 'border-white/30'
              }`}
            >
              {(value.mode === 'year' || value.mode === 'year_range') && (
                <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">Around a year</p>
              <p className="text-xs text-white/50">I know the year or a rough range</p>
            </div>
          </div>
          {(value.mode === 'year' || value.mode === 'year_range') && (
            <div
              className="mt-4 pt-4 border-t border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <YearInput
                year={value.year}
                yearEnd={value.yearEnd}
                onYearChange={(y) => updateField('year', y ?? undefined)}
                onYearEndChange={(y) => {
                  updateField('yearEnd', y);
                  if (y) updateMode('year_range');
                }}
                layout="grid"
                required
              />
            </div>
          )}
        </button>

        {/* Chapter card */}
        <button
          type="button"
          onClick={() => updateMode('life_stage')}
          className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
            value.mode === 'life_stage'
              ? 'border-[#e07a5f] bg-[#e07a5f]/10'
              : 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                value.mode === 'life_stage' ? 'border-[#e07a5f]' : 'border-white/30'
              }`}
            >
              {value.mode === 'life_stage' && (
                <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">Chapter of her life</p>
              <p className="text-xs text-white/50">I only remember the era / life stage</p>
            </div>
          </div>
          {value.mode === 'life_stage' && (
            <div
              className="mt-4 pt-4 border-t border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <select
                value={value.lifeStage ?? ''}
                onChange={(e) => updateField('lifeStage', (e.target.value || null) as LifeStage | null)}
                className={formStyles.select}
                required
              >
                <option value="">Select a chapter...</option>
                {Object.entries(LIFE_STAGES).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </select>
              {value.lifeStage && (
                <p className={`${formStyles.hint} mt-2`}>
                  {LIFE_STAGE_DESCRIPTIONS[value.lifeStage]}
                </p>
              )}
            </div>
          )}
        </button>
      </div>

      {/* Optional timing details */}
      <div className="flex flex-col items-start gap-3 mt-6">
        <DisclosureSection
          label="Timing note"
          isOpen={showTimingNote}
          onToggle={setShowTimingNote}
          hasContent={!!value.note}
          onClear={() => updateField('note', '')}
        >
          <input
            type="text"
            value={value.note || ''}
            onChange={(e) => updateField('note', e.target.value)}
            placeholder="e.g., Summer before college, around Christmas"
            className={formStyles.input}
          />
        </DisclosureSection>

        {onLocationChange && (
          <DisclosureSection
            label="Location"
            isOpen={showLocationField}
            onToggle={setShowLocationField}
            hasContent={!!location}
            onClear={() => onLocationChange('')}
          >
            <input
              type="text"
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              placeholder="e.g., Riverton, UT or Anchorage, AK"
              className={formStyles.input}
            />
          </DisclosureSection>
        )}
      </div>
    </div>
  );
}
