'use client';

import { formStyles } from '@/lib/styles';
import type { Reference } from '@/lib/form-types';

type Props = {
  value: Reference[];
  onChange: (references: Reference[]) => void;
  label?: string;
  emptyMessage?: string;
};

export default function ReferencesSection({
  value,
  onChange,
  label = 'References',
  emptyMessage = 'Add links to articles, photos, or documents that support this memory.',
}: Props) {
  const addReference = () => {
    onChange([...value, { displayName: '', url: '' }]);
  };

  const removeReference = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const updateReference = (index: number, field: keyof Reference, fieldValue: string) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: fieldValue };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={formStyles.label}>{label}</label>
        <button
          type="button"
          onClick={addReference}
          className={formStyles.buttonGhost}
        >
          + Add reference
        </button>
      </div>

      {value.length === 0 && (
        <p className={`${formStyles.hint} italic`}>{emptyMessage}</p>
      )}

      {value.map((ref, index) => (
        <div
          key={ref.id || index}
          className="space-y-2 p-3 rounded-lg bg-white/5 border border-white/10"
        >
          <div className="flex items-center justify-between">
            <label className="text-xs text-white/50">Reference {index + 1}</label>
            <button
              type="button"
              onClick={() => removeReference(index)}
              className="text-xs text-white/50 hover:text-red-400 transition-colors"
            >
              Remove
            </button>
          </div>
          <input
            type="text"
            value={ref.displayName}
            onChange={(e) => updateReference(index, 'displayName', e.target.value)}
            placeholder="Display name (e.g. Wikipedia, Family photo)"
            className={formStyles.input}
          />
          <input
            type="url"
            value={ref.url}
            onChange={(e) => updateReference(index, 'url', e.target.value)}
            placeholder="https://..."
            className={formStyles.input}
          />
        </div>
      ))}
    </div>
  );
}
