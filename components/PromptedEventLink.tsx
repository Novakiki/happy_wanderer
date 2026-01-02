'use client';

import Link from 'next/link';

export type PromptedEvent = {
  id: string;
  title: string;
  privacy_level?: string | null;
};

type Props = {
  promptedEvent: PromptedEvent | null | undefined;
  currentEventId: string;
};

/**
 * Displays "In response to: [Parent Title]" link when a note
 * was created in response to another note (prompted_by_event_id is set).
 */
export function PromptedEventLink({ promptedEvent, currentEventId }: Props) {
  // Don't show if no prompted event or if it's self-referential
  if (!promptedEvent || promptedEvent.id === currentEventId) {
    return null;
  }

  return (
    <div className="mt-2 text-xs text-white/50" data-testid="trigger-event-link">
      In response to:{' '}
      <Link
        href={`/memory/${promptedEvent.id}`}
        className="text-white/70 hover:text-white underline underline-offset-4"
      >
        {promptedEvent.title}
      </Link>
    </div>
  );
}
