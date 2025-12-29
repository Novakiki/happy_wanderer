/**
 * Shared form components for note/memory forms
 *
 * These components provide consistent UI and behavior
 * between the add (MemoryForm) and edit (EditNotesClient) forms.
 */

export { default as ProvenanceSection } from './ProvenanceSection';
export { default as TimingSection } from './TimingSection';
export { default as PeopleSection } from './PeopleSection';
export { default as ReferencesSection } from './ReferencesSection';
export { default as NoteContentSection } from './NoteContentSection';
export { YearInput } from './YearInput';
export { YEAR_CONSTRAINTS } from '@/lib/form-validation';
export { TimingModeSelector } from './TimingModeSelector';
export type { TimingMode, TimingModeData, TimingModeSelectorProps } from './TimingModeSelector';
export { DisclosureSection } from './DisclosureSection';
export type { DisclosureSectionProps } from './DisclosureSection';
