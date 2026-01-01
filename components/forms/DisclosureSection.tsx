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
  /** Visual variant for different contexts */
  variant?: 'default' | 'inset';
  /** Content to show when expanded */
  children: React.ReactNode;
};

/** SVG Chevron that animates rotation */
function Chevron({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`${formStyles.disclosureChevron} ${isOpen ? formStyles.disclosureChevronOpen : ''}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

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
  variant = 'default',
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
        className={`${formStyles.disclosureButton} ${className}`}
      >
        <Chevron isOpen={false} />
        {resolvedAddLabel}
      </button>
    );
  }

  // Inset variant for "Why it matters" - more subdued styling
  const contentClass = variant === 'inset'
    ? 'pl-4 border-l-2 border-[#7c8a78]/25'
    : '';

  // Expanded state
  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleCollapse}
        className={`${formStyles.disclosureButton} mb-2`}
      >
        <Chevron isOpen={true} />
        <span className={variant === 'inset' ? 'font-serif italic text-white/70' : ''}>
          {label}
        </span>
      </button>
      <div className={`${formStyles.disclosureContent} ${contentClass}`}>
        {children}
      </div>
    </div>
  );
}

export default DisclosureSection;
