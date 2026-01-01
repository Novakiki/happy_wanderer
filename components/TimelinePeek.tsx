 'use client';

import { useEffect, useMemo, useState } from 'react';

type PeekEvent = {
  id: string;
  year: number;
  year_end?: number | null;
  title: string;
  root_event_id?: string | null;
  chain_depth?: number | null;
};

export type TimelinePeekEvent = PeekEvent;

type Props = {
  className?: string;
  maxEvents?: number;
  previewEvents?: PeekEvent[];
};

type RootEvent = {
  id: string;
  year: number;
  title: string;
  _perspectiveCount: number;
};

/**
 * A lightweight glimpse of The Score for the respond page.
 * Shows a compact timeline bar and a short list of notes.
 * Supports preview data to render without a live fetch.
 */
export function TimelinePeek({ className = '', maxEvents = 14, previewEvents }: Props) {
  const [events, setEvents] = useState<PeekEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (previewEvents?.length) {
        setEvents(previewEvents);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/score-peek');
        if (!res.ok) {
          throw new Error('Failed to load score');
        }
        const data = (await res.json()) as { events: PeekEvent[] };
        if (cancelled) return;

        setEvents(data.events || []);
      } catch (err) {
        console.error('Timeline peek load error', err);
        if (previewEvents?.length && !cancelled) {
          setEvents(previewEvents);
          setError(null);
        } else if (!cancelled) {
          setError('Unable to load the score right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [maxEvents, previewEvents]);

  const roots: RootEvent[] = useMemo(() => {
    if (!events.length) return [];
    const group = new Map<string, PeekEvent[]>();

    for (const ev of events) {
      const rootId = ev.root_event_id || ev.id;
      const arr = group.get(rootId) || [];
      arr.push(ev);
      group.set(rootId, arr);
    }

    const bundles = Array.from(group.entries()).map(([rootId, evs]) => {
      const sorted = [...evs].sort((a, b) => {
        const depthDiff = (a.chain_depth ?? 0) - (b.chain_depth ?? 0);
        if (depthDiff !== 0) return depthDiff;
        return a.id.localeCompare(b.id);
      });
      const root = sorted[0];
      return {
        id: root.id,
        year: root.year,
        title: root.title,
        _perspectiveCount: evs.length - 1,
      };
    });

    return bundles
      .sort((a, b) => a.year - b.year)
      .slice(Math.max(0, bundles.length - maxEvents));
  }, [events, maxEvents]);

  const yearRange = useMemo(() => {
    if (roots.length === 0) return { min: 0, max: 0 };
    const years = roots.map((e) => e.year ?? 0);
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [roots]);

  if (loading) {
    return (
      <div className={className}>
        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.06]">
          <p className="text-sm text-white/60">Loading the score…</p>
        </div>
      </div>
    );
  }

  if (error || roots.length === 0) {
    return (
      <div className={className}>
        <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.06]">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-white/50">The Score</p>
              <h3 className="text-lg text-white font-semibold mt-1">Where this note lives</h3>
            </div>
            <a
              href="/score"
              className="text-xs text-[#e07a5f] font-medium hover:text-[#f28b73] transition-colors"
            >
              Open full Score →
            </a>
          </div>
          <p className="text-sm text-white/60">
            {error ? 'Unable to load the score right now.' : 'Notes are on The Score; tap to view the full timeline.'}
          </p>
        </div>
      </div>
    );
  }

  const span = Math.max(1, yearRange.max - yearRange.min);

  return (
    <div className={className}>
      <div className="p-5 rounded-2xl border border-white/10 bg-white/[0.06]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/50">The Score</p>
            <h3 className="text-lg text-white font-semibold mt-1">Where this note lives</h3>
          </div>
          <a
            href="/score"
            className="text-xs text-[#e07a5f] font-medium hover:text-[#f28b73] transition-colors"
          >
            Open full Score →
          </a>
        </div>

        {/* Mini timeline bar */}
        <div className="relative h-2 rounded-full bg-white/[0.08] overflow-hidden mb-4">
          {roots.map((event) => {
            const position = ((event.year - yearRange.min) / span) * 100;
            return (
              <div
                key={event.id}
                className="absolute -top-1.5 h-5 w-[10px] rounded-full bg-white/70"
                style={{ left: `${position}%` }}
                title={`${event.year}: ${event.title}`}
              />
            );
          })}
        </div>

        {/* Recent notes list */}
        <div className="grid gap-3 sm:grid-cols-2">
          {roots.map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <p className="text-xs uppercase tracking-[0.18em] text-white/50">
                {event.year}
              </p>
              <p className="text-sm text-white mt-1">{event.title}</p>
              {event._perspectiveCount ? (
                <p className="text-xs text-white/50 mt-1">
                  {event._perspectiveCount} linked perspective
                  {event._perspectiveCount === 1 ? '' : 's'}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
