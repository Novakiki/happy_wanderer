/**
 * Shared configuration for note forms (add and edit).
 * Single source of truth for labels, placeholders, and hints.
 */

import { ENTRY_TYPE_CONTENT_LABELS } from '@/lib/terminology';

export type EntryType = 'memory' | 'milestone' | 'origin';

/**
 * Get the content section label based on entry type
 */
export function getContentLabel(entryType: EntryType | string): string {
  return ENTRY_TYPE_CONTENT_LABELS[entryType as keyof typeof ENTRY_TYPE_CONTENT_LABELS] || 'The memory';
}

/**
 * Shared copy for content section
 */
export const CONTENT_SECTION = {
  hint: 'Describe what happened. Save what it meant for the section below.',
  placeholder: 'Share a story, a moment, or a note...',
  // Synchronicity-specific
  hintOrigin: 'Connect an outside fact to something in Val\'s life.',
  placeholderOrigin: 'The song was released in 1961, the year Val was born...',
} as const;

/**
 * Shared copy for "Why it matters" section
 */
export const WHY_IT_MATTERS = {
  label: 'Why it matters to you (optional)',
  addLabel: 'Add why it matters to you (optional)',
  hint: 'Your personal reflection. Appears as an italic note beneath your memory.',
  placeholder: 'How it landed for you, why it still matters...',
  // Synchronicity-specific
  labelOrigin: 'The story behind it',
  addLabelOrigin: 'Add the story behind it',
  hintOrigin: 'The story/memory behind it.',
  placeholderOrigin: 'How you connected the dots, what it revealed...',
} as const;

/**
 * Shared copy for writing guidance section
 */
export const WRITING_GUIDANCE = {
  label: 'Writing guidance',
  toggleShow: 'why?',
  toggleHide: 'hide',
  explainer: 'The code is looking for common ways people turn opinions or interpretations into "facts."',
  meaningAssertionAction: 'Move this to "Why it matters to you"',
} as const;

/**
 * Shared copy for "The Chain" (provenance) section
 */
export const THE_CHAIN = {
  label: 'The Chain',
  hint: 'These fields help keep memories connected without turning them into a single official story.',
  originNote: 'This synchronicity is recorded as your personal observation.',
} as const;

/**
 * Shared copy for title field
 */
export const TITLE_FIELD = {
  label: 'Title',
  placeholder: 'A short title for this note...',
} as const;
