'use client';

import { formStyles } from '@/lib/styles';
import {
  MEMORY_PROVENANCE,
  MEMORY_PROVENANCE_DESCRIPTIONS,
  RELATIONSHIP_OPTIONS,
} from '@/lib/terminology';
import type { EntryType, ProvenanceData, ProvenanceType } from '@/lib/form-types';

type Props = {
  value: ProvenanceData;
  onChange: (data: ProvenanceData) => void;
  required?: boolean;
  compact?: boolean; // For edit mode - simpler UI
  entryType?: EntryType; // Controls which primary option shows (firsthand vs pattern_observed)
};

export default function ProvenanceSection({
  value,
  onChange,
  required = false,
  compact = false,
  entryType = 'memory',
}: Props) {
  const isSynchronicity = entryType === 'origin';

  // Contextual labels for synchronicities
  const firsthandLabel = isSynchronicity ? 'I noticed it myself' : MEMORY_PROVENANCE.firsthand;
  const firsthandDesc = isSynchronicity ? 'You made the connection yourself' : MEMORY_PROVENANCE_DESCRIPTIONS.firsthand;
  const secondhandLabel = isSynchronicity ? 'Someone helped me see it' : MEMORY_PROVENANCE.secondhand;
  const secondhandDesc = isSynchronicity ? 'Someone else pointed out the connection' : MEMORY_PROVENANCE_DESCRIPTIONS.secondhand;
  const labelText = isSynchronicity ? 'Who helped you see this connection?' : 'How do you know this?';
  const updateType = (type: ProvenanceType) => {
    onChange({ ...value, type });
  };

  const updateField = (field: keyof ProvenanceData, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue });
  };

  const RELATIONSHIP_GROUPS = {
    family: [
      'parent',
      'child',
      'sibling',
      'cousin',
      'aunt_uncle',
      'niece_nephew',
      'grandparent',
      'grandchild',
      'in_law',
      'spouse',
    ],
    social: ['friend', 'neighbor', 'coworker', 'classmate'],
    other: ['acquaintance', 'other', 'unknown'],
  } as const;

  const renderRelationshipOptions = (customValue?: string) => (
    <>
      <option value="">Relationship to Val</option>
      {customValue ? (
        <optgroup label="Custom">
          <option value={customValue}>{customValue}</option>
        </optgroup>
      ) : null}
      <optgroup label="Family">
        {RELATIONSHIP_GROUPS.family.map((key) => (
          <option key={key} value={key}>
            {RELATIONSHIP_OPTIONS[key as keyof typeof RELATIONSHIP_OPTIONS]}
          </option>
        ))}
      </optgroup>
      <optgroup label="Social">
        {RELATIONSHIP_GROUPS.social.map((key) => (
          <option key={key} value={key}>
            {RELATIONSHIP_OPTIONS[key as keyof typeof RELATIONSHIP_OPTIONS]}
          </option>
        ))}
      </optgroup>
      <optgroup label="Other">
        {RELATIONSHIP_GROUPS.other.map((key) => (
          <option key={key} value={key}>
            {RELATIONSHIP_OPTIONS[key as keyof typeof RELATIONSHIP_OPTIONS]}
          </option>
        ))}
      </optgroup>
    </>
  );

  // Compact mode: simple dropdown
  if (compact) {
    return (
      <div>
        <label className={formStyles.label}>
          {labelText}
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
            <div className="mt-3">
              <label className={formStyles.labelMuted}>
                Relationship to Val <span className="text-white/50">(optional)</span>
              </label>
              <select
                value={value.toldByRelationship || ''}
                onChange={(e) => updateField('toldByRelationship', e.target.value)}
                className={formStyles.select}
              >
                {renderRelationshipOptions(
                  value.toldByRelationship &&
                  !(value.toldByRelationship in RELATIONSHIP_OPTIONS)
                    ? value.toldByRelationship
                    : undefined
                )}
              </select>
            </div>
            <div className="mt-3">
              <label className={formStyles.labelMuted}>
                Phone number to invite them <span className="text-white/50">(optional)</span>
              </label>
              <input
                type="tel"
                value={value.toldByPhone || ''}
                onChange={(e) => updateField('toldByPhone', e.target.value)}
                placeholder="They'll get a text to add their own memories"
                className={formStyles.input}
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
      <p className={formStyles.sectionLabel}>The Chain</p>
      <p className={`${formStyles.hint} mb-4`}>{labelText}</p>
      <div className="space-y-3 mt-3">
        {/* "I was there" / "I noticed it myself" (firsthand) */}
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
                {firsthandLabel}
              </p>
              <p className="text-xs text-white/50">
                {firsthandDesc}
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
                {secondhandLabel}
              </p>
              <p className="text-xs text-white/50">
                {secondhandDesc}
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
              <div className="mt-3">
                <label className={formStyles.labelMuted}>
                  Relationship to Val <span className="text-white/50">(optional)</span>
                </label>
                <select
                  value={value.toldByRelationship || ''}
                  onChange={(e) => updateField('toldByRelationship', e.target.value)}
                  className={formStyles.select}
                >
                  {renderRelationshipOptions(
                    value.toldByRelationship &&
                    !(value.toldByRelationship in RELATIONSHIP_OPTIONS)
                      ? value.toldByRelationship
                      : undefined
                  )}
                </select>
              </div>
              <div className="mt-3">
                <label className={formStyles.labelMuted}>
                  Phone number to invite them <span className="text-white/50">(optional)</span>
                </label>
                <input
                  type="tel"
                  value={value.toldByPhone || ''}
                  onChange={(e) => updateField('toldByPhone', e.target.value)}
                  placeholder="They'll get a text to add their own memories"
                  className={formStyles.input}
                />
              </div>
            </div>
          )}
        </button>

      </div>
    </div>
  );
}
