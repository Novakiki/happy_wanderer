'use client';

import { formStyles } from '@/lib/styles';

export type DisclosureSectionProps = {
  /** Label shown when expanded (e.g., "Timing note") */
  label: string;
  /** Text shown on collapsed button (e.g., "Add timing note"). Defaults to "Add {label}" */
  addLabel?: string;
  /** Whether the section is currently expanded */
  isOpen: boolean;
  /** Callback when expand/collapse state changes */
  onToggle: (isOpen: boolean) => void;
  /** Optional callback when section is collapsed (e.g., to clear form values) */
  onClear?: () => void;
  /** Whether the section has content (auto-expands when true) */
  hasContent?: boolean;
  /** Additional class for the container */
  className?: string;
  /** Content to show when expanded */
  children: React.ReactNode;
};

/**
 * Reusable disclosure/accordion section for optional form fields.
 *
 * Two states:
 * - Collapsed: Shows "▶ Add X" button
 * - Expanded: Shows "▼ X" header button with content below
 *
 * Auto-expands when hasContent is true (e.g., when form field has a value).
 * Calls onClear when collapsing (optional, for clearing form values).
 *
 * @example
 * // Simple disclosure
 * <DisclosureSection
 *   label="Timing note"
 *   isOpen={showTimingNote}
 *   onToggle={setShowTimingNote}
 *   hasContent={!!formData.timing_note}
 *   onClear={() => setFormData({ ...formData, timing_note: '' })}
 * >
 *   <input value={formData.timing_note} onChange={...} />
 * </DisclosureSection>
 */
export function DisclosureSection({
  label,
  addLabel,
  isOpen,
  onToggle,
  onClear,
  hasContent = false,
  className = '',
  children,
}: DisclosureSectionProps) {
  const shouldShow = isOpen || hasContent;
  const resolvedAddLabel = addLabel ?? `Add ${label.toLowerCase()}`;

  const handleCollapse = () => {
    onToggle(false);
    onClear?.();
  };

  // Collapsed state
  if (!shouldShow) {
    return (
      <button
        type="button"
        onClick={() => onToggle(true)}
        className={`${formStyles.buttonGhost} ${className}`}
      >
        <span className={formStyles.disclosureArrow}>▶</span>
        {resolvedAddLabel}
      </button>
    );
  }

  // Expanded state
  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleCollapse}
        className={`${formStyles.buttonGhost} mb-2`}
      >
        <span className={formStyles.disclosureArrow}>▼</span>
        {label}
      </button>
      {children}
    </div>
  );
}

export default DisclosureSection;
