'use client';

import Link from 'next/link';

export type TriggerEvent = {
  id: string;
  title: string;
  privacy_level?: string | null;
};

type Props = {
  triggerEvent: TriggerEvent | null | undefined;
  currentEventId: string;
};

/**
 * Displays "In response to: [Parent Title]" link when a note
 * was created in response to another note (trigger_event_id is set).
 */
export function TriggerEventLink({ triggerEvent, currentEventId }: Props) {
  // Don't show if no trigger event or if it's self-referential
  if (!triggerEvent || triggerEvent.id === currentEventId) {
    return null;
  }

  return (
    <div className="mt-2 text-xs text-white/50" data-testid="trigger-event-link">
      In response to:{' '}
      <Link
        href={`/memory/${triggerEvent.id}`}
        className="text-white/70 hover:text-white underline underline-offset-4"
      >
        {triggerEvent.title}
      </Link>
    </div>
  );
}
