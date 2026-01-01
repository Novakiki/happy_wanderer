'use client';

import { formStyles } from '@/lib/styles';
import {
  MEMORY_PROVENANCE,
  MEMORY_PROVENANCE_DESCRIPTIONS,
} from '@/lib/terminology';
import type { ProvenanceData, ProvenanceType } from '@/lib/form-types';

type Props = {
  value: ProvenanceData;
  onChange: (data: ProvenanceData) => void;
  required?: boolean;
  compact?: boolean; // For edit mode - simpler UI
};

export default function ProvenanceSection({
  value,
  onChange,
  required = false,
  compact = false,
}: Props) {
  const updateType = (type: ProvenanceType) => {
    onChange({ ...value, type });
  };

  const updateField = (field: keyof ProvenanceData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  // Compact mode: simple dropdown
  if (compact) {
    return (
      <div>
        <label className={formStyles.label}>
          How do you know this?
          {required && <span className={formStyles.required}> *</span>}
        </label>
        <select
          value={value.type}
          onChange={(e) => updateType(e.target.value as ProvenanceType)}
          className={formStyles.select}
        >
          {Object.entries(MEMORY_PROVENANCE).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <p className={formStyles.hint}>
          {MEMORY_PROVENANCE_DESCRIPTIONS[value.type]}
        </p>

        {/* Conditional sub-fields */}
        {value.type === 'secondhand' && (
          <div className="mt-3">
            <label className={formStyles.labelMuted}>
              Who told you? <span className="text-white/50">(optional)</span>
            </label>
            <input
              type="text"
              value={value.toldByName || ''}
              onChange={(e) => updateField('toldByName', e.target.value)}
              placeholder="e.g., Uncle John, my mother"
              className={formStyles.input}
            />
          </div>
        )}

        {value.type === 'from_references' && (
          <div className="mt-3 space-y-3">
            <div>
              <label className={formStyles.labelMuted}>
                What record? <span className="text-white/50">(optional)</span>
              </label>
              <input
                type="text"
                value={value.referenceName || ''}
                onChange={(e) => updateField('referenceName', e.target.value)}
                placeholder="e.g., Her journal, family photo album"
                className={formStyles.input}
              />
            </div>
            <div>
              <label className={formStyles.labelMuted}>
                Link <span className="text-white/50">(optional)</span>
              </label>
              <input
                type="url"
                value={value.referenceUrl || ''}
                onChange={(e) => updateField('referenceUrl', e.target.value)}
                placeholder="https://..."
                className={formStyles.inputSmall}
              />
            </div>
          </div>
        )}

      </div>
    );
  }

  // Full mode: card-based selection (for add form)
  return (
    <div>
      <label className={formStyles.label}>
        How do you know this?
        {required && <span className={formStyles.required}> *</span>}
      </label>
      <div className="space-y-3 mt-3">
        {/* I was there (firsthand) */}
        <button
          type="button"
          onClick={() => updateType('firsthand')}
          className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
            value.type === 'firsthand'
              ? 'border-[#e07a5f] bg-[#e07a5f]/10'
              : 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                value.type === 'firsthand' ? 'border-[#e07a5f]' : 'border-white/30'
              }`}
            >
              {value.type === 'firsthand' && (
                <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {MEMORY_PROVENANCE.firsthand}
              </p>
              <p className="text-xs text-white/50">
                {MEMORY_PROVENANCE_DESCRIPTIONS.firsthand}
              </p>
            </div>
          </div>
        </button>

        {/* Someone told me (secondhand) */}
        <button
          type="button"
          onClick={() => updateType('secondhand')}
          className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
            value.type === 'secondhand'
              ? 'border-[#e07a5f] bg-[#e07a5f]/10'
              : 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                value.type === 'secondhand' ? 'border-[#e07a5f]' : 'border-white/30'
              }`}
            >
              {value.type === 'secondhand' && (
                <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {MEMORY_PROVENANCE.secondhand}
              </p>
              <p className="text-xs text-white/50">
                {MEMORY_PROVENANCE_DESCRIPTIONS.secondhand}
              </p>
            </div>
          </div>
          {value.type === 'secondhand' && (
            <div
              className="mt-4 pt-4 border-t border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <label className={formStyles.label}>Who told you?</label>
              <input
                type="text"
                value={value.toldByName || ''}
                onChange={(e) => updateField('toldByName', e.target.value)}
                placeholder="e.g., Uncle John, my mother"
                className={formStyles.input}
              />
            </div>
          )}
        </button>

        {/* From a record (from_references) */}
        <button
          type="button"
          onClick={() => updateType('from_references')}
          className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
            value.type === 'from_references'
              ? 'border-[#e07a5f] bg-[#e07a5f]/10'
              : 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                value.type === 'from_references' ? 'border-[#e07a5f]' : 'border-white/30'
              }`}
            >
              {value.type === 'from_references' && (
                <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {MEMORY_PROVENANCE.from_references}
              </p>
              <p className="text-xs text-white/50">
                {MEMORY_PROVENANCE_DESCRIPTIONS.from_references}
              </p>
            </div>
          </div>
          {value.type === 'from_references' && (
            <div
              className="mt-4 pt-4 border-t border-white/10 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <label className={formStyles.label}>What is it?</label>
                <input
                  type="text"
                  value={value.referenceName || ''}
                  onChange={(e) => updateField('referenceName', e.target.value)}
                  placeholder="e.g., Her journal, family photo album"
                  className={formStyles.input}
                />
              </div>
              <div>
                <label className={formStyles.labelMuted}>
                  Link <span className="text-white/50">(optional)</span>
                </label>
                <input
                  type="url"
                  value={value.referenceUrl || ''}
                  onChange={(e) => updateField('referenceUrl', e.target.value)}
                  placeholder="https://..."
                  className={formStyles.inputSmall}
                />
              </div>
            </div>
          )}
        </button>

      </div>
    </div>
  );
}
