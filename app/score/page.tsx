'use client';

import {
  applyScoreEventOverrides,
  groupEventsIntoBundles,
  mapTimelineEvents,
  type StoryBundle,
  type TimelineEvent,
} from '@/lib/mappers';
import { scoreBackground } from '@/lib/styles';
import { getTimelineEvents } from '@/lib/supabase';
import {
  LEGEND_LABELS,
  SCORE_TITLE,
} from '@/lib/terminology';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function ChaptersPage() {
  const router = useRouter();
  const [bundles, setBundles] = useState<StoryBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [hoveredBundle, setHoveredBundle] = useState<StoryBundle | null>(null);
  const [isReady, setIsReady] = useState(false);

  const [showComingSoon, setShowComingSoon] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const [activeTab, setActiveTab] = useState<'time' | 'witness' | 'storyteller' | 'thread' | 'synchronicity'>('time');

  const [zoomLevel, setZoomLevel] = useState(1);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);

  // Map of event_id -> event for quick lookups (e.g., trigger titles)
  const eventLookup = useMemo(() => {
    const map = new Map<string, TimelineEvent>();
    for (const bundle of bundles) {
      map.set(bundle.rootEvent.id, bundle.rootEvent);
      for (const p of bundle.perspectives) {
        map.set(p.id, p);
      }
    }
    return map;
  }, [bundles]);

  // Gesture zoom handlers
  const handleWheel = useCallback((e: WheelEvent) => {
    // Pinch-to-zoom on trackpad or Ctrl/Cmd + scroll wheel
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(z => Math.min(3, Math.max(0.5, z + delta)));
    }
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance.current = Math.hypot(dx, dy);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.hypot(dx, dy);
      const delta = (distance - lastTouchDistance.current) * 0.01;
      setZoomLevel(z => Math.min(3, Math.max(0.5, z + delta)));
      lastTouchDistance.current = distance;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    lastTouchDistance.current = null;
  }, []);

  // Attach gesture listeners (re-attach when tab changes or data loads)
  useEffect(() => {
    if (activeTab !== 'time' || loading) return;

    const wheelOptions: AddEventListenerOptions = { passive: false };
    const touchOptions: AddEventListenerOptions = { passive: true };
    let attachedEl: HTMLDivElement | null = null;

    // Small delay to ensure ref is attached after render
    const timer = setTimeout(() => {
      attachedEl = timelineRef.current;
      if (!attachedEl) return;

      attachedEl.addEventListener('wheel', handleWheel as EventListener, wheelOptions);
      attachedEl.addEventListener('touchstart', handleTouchStart as EventListener, touchOptions);
      attachedEl.addEventListener('touchmove', handleTouchMove as EventListener, touchOptions);
      attachedEl.addEventListener('touchend', handleTouchEnd as EventListener, touchOptions);
    }, 50);

    return () => {
      clearTimeout(timer);
      if (!attachedEl) return;
      attachedEl.removeEventListener('wheel', handleWheel as EventListener, wheelOptions);
      attachedEl.removeEventListener('touchstart', handleTouchStart as EventListener, touchOptions);
      attachedEl.removeEventListener('touchmove', handleTouchMove as EventListener, touchOptions);
      attachedEl.removeEventListener('touchend', handleTouchEnd as EventListener, touchOptions);
    };
  }, [activeTab, loading, handleWheel, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const formatYearLabel = (event: TimelineEvent) => {
    const isApproximate = event.timingCertainty && event.timingCertainty !== 'exact';
    const hasRange = typeof event.yearEnd === 'number' && event.yearEnd !== event.year;
    if (hasRange) {
      return `${isApproximate ? '~' : ''}${event.year}–${event.yearEnd}`;
    }
    return isApproximate ? `~${event.year}` : String(event.year);
  };

  // Fetch data from Supabase
  useEffect(() => {
    async function fetchData() {
      try {
        // Prefer server-fetched score (avoids client env or RLS hiccups)
        const res = await fetch('/api/score');
        if (res.ok) {
          const json = await res.json();
          const eventsData = Array.isArray(json.events) ? json.events : [];

          const mappedEvents = mapTimelineEvents(eventsData).map(e => applyScoreEventOverrides(e));
          const eventBundles = groupEventsIntoBundles(mappedEvents);
          setBundles(eventBundles);
        } else {
          // Fallback to direct Supabase client
          const eventsData = await getTimelineEvents({ privacyLevels: ['public', 'family'] });

          const mappedEvents = mapTimelineEvents(eventsData).map(e => applyScoreEventOverrides(e));
          const eventBundles = groupEventsIntoBundles(mappedEvents);

          setBundles(eventBundles);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
        setIsReady(true);
      }
    }

    fetchData();
  }, []);
  // Position bundles evenly across the timeline (index-based, not time-based)
  const getBundlePosition = (index: number) => {
    if (bundles.length <= 1) return 50;
    const padding = 5; // % padding on each side
    const usableWidth = 100 - (padding * 2);
    return padding + (index / (bundles.length - 1)) * usableWidth;
  };

  const bundlePositions = bundles.map((_, index) => getBundlePosition(index));

  const decadeGroups = bundles.reduce<Array<{ decade: number; startIndex: number; endIndex: number }>>(
    (acc, bundle, index) => {
      const decade = Math.floor(bundle.rootEvent.year / 10) * 10;
      const lastGroup = acc[acc.length - 1];
      if (!lastGroup || lastGroup.decade !== decade) {
        acc.push({ decade, startIndex: index, endIndex: index });
      } else {
        lastGroup.endIndex = index;
      }
      return acc;
    },
    [],
  );

  const measureLabels = decadeGroups.map((group) => {
    const startPos = bundlePositions[group.startIndex];
    const endPos = bundlePositions[group.endIndex];
    return {
      label: `Measure ${group.decade}s`,
      shortLabel: `M. ${group.decade}s`,
      position: (startPos + endPos) / 2,
    };
  });

  const measureBarlines = decadeGroups.slice(1).map((group, index) => {
    const prevGroup = decadeGroups[index];
    const position = (bundlePositions[prevGroup.endIndex] + bundlePositions[group.startIndex]) / 2;
    return { position };
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-left">
          <div className="animate-pulse text-white/50">Loading her story...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white overflow-x-hidden bg-[#0b0b0b]"
      style={scoreBackground}
    >
      {/* Intro Section */}
      <section className={`transition-opacity duration-1000 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-4xl mx-auto px-6 pt-16 pb-6">
          <p
            className="text-xs uppercase tracking-[0.3em] text-white/40 animate-fade-in-up"
            style={{ animationDelay: '50ms', animationFillMode: 'both' }}
          >
            Valerie Park Anderson
          </p>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-serif leading-tight text-white/95 mt-4 animate-fade-in-up"
            style={{ animationDelay: '150ms', animationFillMode: 'both' }}
          >
            A life told by those who loved her.
          </h1>
          <p
            className="text-lg sm:text-xl text-white/50 mt-6 max-w-2xl leading-relaxed animate-fade-in-up"
            style={{ animationDelay: '300ms', animationFillMode: 'both' }}
          >
            This timeline supports both linear storytelling and synchronized
            storytelling—by design and by metaphor.
          </p>
          <div
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-2 animate-fade-in-up"
            style={{ animationDelay: '330ms', animationFillMode: 'both' }}
          >
            <a
              href="/why"
              className="text-sm text-white/60 hover:text-white transition-colors underline underline-offset-4"
            >
              Why this exists
            </a>
            <a
              href="/emerging"
              className="text-sm text-white/60 hover:text-white transition-colors underline underline-offset-4"
            >
              What&apos;s emerging
            </a>
          </div>
          <div
            className="mt-6 flex flex-wrap items-center gap-3 animate-fade-in-up"
            style={{ animationDelay: '360ms', animationFillMode: 'both' }}
          >
            <a
              href="/share"
              className="inline-flex items-center gap-2 rounded-full bg-[#e07a5f] text-white px-5 py-2.5 text-xs uppercase tracking-[0.15em] font-medium hover:bg-[#d06a4f] transition-colors shadow-lg shadow-[#e07a5f]/20"
            >
              Add a note
            </a>
            <div className="relative">
              <span
                className="inline-flex items-center gap-2 rounded-full border border-white/20 text-white/60 px-5 py-2.5 text-xs uppercase tracking-[0.15em] cursor-pointer hover:border-white/30 hover:text-white/80 transition-colors"
                onMouseEnter={() => setShowComingSoon(true)}
                onMouseLeave={() => setShowComingSoon(false)}
                onClick={() => setShowComingSoon(true)}
              >
                Interact
              </span>
              <div
                className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 bg-black/80 rounded text-[10px] text-white/50 whitespace-nowrap transition-all duration-150 ${
                  showComingSoon ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                Coming soon
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Visualization */}
      <section className="max-w-4xl mx-auto px-6 mt-12">
        <div className="mb-4 animate-fade-in-up" style={{ animationDelay: '700ms', animationFillMode: 'both' }}>
          <p className="text-sm uppercase tracking-[0.3em] text-white/40">{SCORE_TITLE}</p>
        </div>

        {/* Tabbed card */}
        <div
          className="rounded-2xl border border-white/10 bg-white/[0.02] animate-fade-in-up overflow-visible"
          style={{ animationDelay: '720ms', animationFillMode: 'both' }}
        >
          {/* Tabs */}
          <div className="px-4 pt-4 pb-2 border-b border-white/5 relative z-10">
            <div
              className="flex items-center gap-1 overflow-x-auto scrollbar-hide"
              style={{
                maskImage: 'linear-gradient(to right, black 90%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, black 90%, transparent 100%)',
              }}
            >
              <button
                onClick={() => setActiveTab('time')}
                className={`px-4 py-2 text-xs rounded-lg transition-colors ${
                  activeTab === 'time' ? 'text-white/70 bg-white/10' : 'text-white/35 hover:text-white/50'
                }`}
              >
                Time
              </button>
              {[
                { id: 'witness' as const, label: 'Witness', desc: 'who was present' },
                { id: 'storyteller' as const, label: 'Storyteller', desc: 'whose voice' },
                { id: 'thread' as const, label: 'Thread', desc: 'what sparked what' },
                { id: 'synchronicity' as const, label: 'Synchronicity', desc: 'A meaningful coincidence that adds melody or harmony' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-xs rounded-lg transition-colors ${
                    activeTab === tab.id ? 'text-white/70 bg-white/10' : 'text-white/35 hover:text-white/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="p-4 overflow-visible relative z-20">
            {activeTab === 'time' ? (
              <>
                {/* Controls row: Key toggle left, Zoom controls right */}
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="text-[11px] tracking-[0.15em] uppercase text-white/40 hover:text-white/60 transition-colors"
                  >
                    {showKey ? '− Key' : '+ Key'}
                  </button>
                  {/* Zoom controls - hidden on mobile since pinch gestures work */}
                  <div className="hidden sm:flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
                      className="w-6 h-6 rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors text-xs flex items-center justify-center"
                    >
                      −
                    </button>
                    <span className="text-[10px] text-white/30 w-8 text-center tabular-nums">{Math.round(zoomLevel * 100)}%</span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}
                      className="w-6 h-6 rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors text-xs flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-out ${
                      showKey ? 'max-h-32 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'
                    }`}
                  >
                    <div className="flex flex-col gap-2 text-xs text-white/50">
                      <div className="inline-flex items-center gap-2">
                        <span className="h-4 w-[3px] rounded-full bg-white/80" />
                        <span>Outside patterns <span className="text-white/40">— <em>{LEGEND_LABELS.origin}</em></span></span>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <span className="h-4 w-[3px] rounded-full bg-[#e07a5f]" />
                        <span>Dated events <span className="text-white/40">— <em>{LEGEND_LABELS.milestone}</em></span></span>
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <span
                          className="h-4 w-[3px] rounded-full"
                          style={{ background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.3) 0px, rgba(255,255,255,0.3) 2px, transparent 2px, transparent 4px)' }}
                        />
                        <span>Personal <span className="text-white/40">— <em>{LEGEND_LABELS.memory}</em></span></span>
                      </div>
                    </div>
                  </div>

                {/* Timeline container with fixed repeat signs */}
                <div className="relative h-[280px] flex overflow-visible">
                  {/* Left repeat sign - fixed */}
                  <div className="flex-shrink-0 w-4 relative">
                    <div className="absolute flex items-center gap-0.5" style={{ left: '0%', top: '28%', height: '32%' }}>
                      <div className="flex flex-col justify-center gap-3 h-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      </div>
                      <div className="w-[2px] h-full bg-white/15" />
                      <div className="w-px h-full bg-white/10" />
                    </div>
                  </div>

                  {/* Scrollable timeline content */}
                  <div
                    ref={timelineRef}
                    className="flex-1 overflow-x-auto overflow-y-visible scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent touch-pan-x"
                  >
                    <div
                      className="relative h-full"
                      style={{ width: `${100 * zoomLevel}%`, minWidth: '100%' }}
                    >
          {bundles.length === 0 ? (
            <div className="absolute inset-0 flex items-start justify-start text-white/30 pt-6">
              No notes yet. Be the first to share.
            </div>
          ) : (
            <>
              {/* Measure labels */}
              {measureLabels.map((measure) => (
                <div
                  key={measure.label}
                  className="absolute top-[18%] -translate-x-1/2 pointer-events-none z-10 hidden sm:block"
                  style={{ left: `${measure.position}%` }}
                >
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/35 whitespace-nowrap">
                    {zoomLevel < 0.75 ? measure.shortLabel : measure.label}
                  </span>
                </div>
              ))}

              {/* Measure barlines */}
              {measureBarlines.map((barline, index) => (
                <div
                  key={`barline-${index}`}
                  className="absolute top-[28%] bottom-[40%] w-px bg-white/10 z-0"
                  style={{ left: `${barline.position}%` }}
                />
              ))}

              {/* 5 staff lines */}
              <div className="absolute left-0 right-0 top-[28%] h-px bg-white/[0.07]" />
              <div className="absolute left-0 right-0 top-[36%] h-px bg-white/[0.07]" />
              <div className="absolute left-0 right-0 top-[44%] h-px bg-white/[0.07]" />
              <div className="absolute left-0 right-0 top-[52%] h-px bg-white/[0.07]" />
              <div className="absolute left-0 right-0 top-[60%] h-px bg-white/[0.07]" />

              {/* Event bars - evenly spaced, grouped by story bundle */}
              {bundles.map((bundle, i) => {
                const event = bundle.rootEvent;
                const perspectiveCount = bundle.totalCount - 1;
                const isOrigin = event.type === 'origin';
                const isMilestone = event.type === 'milestone';
                const isHovered = hoveredEvent?.id === event.id;
                const isApproximate = event.timingCertainty === 'approximate';
                const isVague = event.timingCertainty === 'vague';
                const yearLabel = formatYearLabel(event);
                const baseHeight = isOrigin ? 'h-36' : isMilestone ? 'h-28' : 'h-16';
                const baseColor = isOrigin
                  ? 'bg-white/80'
                  : isMilestone
                    ? 'bg-[#e07a5f]'
                    : isVague
                      ? 'bg-white/20'
                      : isApproximate
                        ? 'bg-white/25'
                        : 'bg-white/30';
                const hoverColor = !isOrigin && !isMilestone ? 'group-hover:bg-white/50' : '';
                const hoverHeight = !isOrigin && !isMilestone ? 'group-hover:h-20' : '';
                const noteHeadClass = isOrigin
                  ? 'w-3 h-3 rotate-45 rounded-[2px] bg-white/70'
                  : isMilestone
                    ? 'w-3.5 h-2.5 -rotate-12 rounded-full border border-[#e07a5f] bg-transparent'
                    : 'w-3.5 h-2.5 -rotate-12 rounded-full bg-white/70';
                const chordHeadClass = isOrigin
                  ? 'w-2.5 h-2.5 rotate-45 rounded-[2px] bg-white/40'
                  : isMilestone
                    ? 'w-3 h-2 -rotate-12 rounded-full border border-[#e07a5f]/70 bg-transparent'
                    : 'w-3 h-2 -rotate-12 rounded-full bg-white/40';
                const chordOffsets = perspectiveCount > 1
                  ? [
                      { x: -6, y: 4 },
                      { x: 6, y: -4 },
                    ]
                  : perspectiveCount === 1
                    ? [{ x: 5, y: -3 }]
                    : [];
                const dotSize = isVague ? 'w-1.5 h-1.5' : 'w-1 h-1';
                const dotColor = isMilestone
                  ? 'bg-[#e07a5f]/70'
                  : isOrigin
                    ? 'bg-white/70'
                    : 'bg-white/50';
                const slurClass = isHovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-70';

                return (
                  <div
                    key={event.id || `${event.year}-${event.title}`}
                    className={`absolute bottom-12 group cursor-pointer ${isHovered ? 'z-[100]' : 'z-10'}`}
                    style={{ left: `${getBundlePosition(i)}%` }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                      setHoveredEvent(event);
                      setHoveredBundle(bundle);
                    }}
                    onMouseLeave={() => {
                      setHoveredEvent(null);
                      setHoveredBundle(null);
                      setTooltipPos(null);
                    }}
                    onClick={() => {
                      if (!event.id) return;
                      // Interaction rule: hover previews on desktop; click/tap opens the full note.
                      router.push(`/memory/${event.id}`);
                    }}
                  >
                    {/* The bar */}
                    <div
                      className="relative flex items-end justify-center w-8 animate-rise"
                      style={{ animationDelay: `${500 + i * 50}ms`, animationFillMode: 'both' }}
                    >
                      <span
                        className={`
                          relative w-[3px] transition-all duration-300 rounded-full
                          ${baseHeight} ${isOrigin || isMilestone ? baseColor : ''} ${hoverColor} ${hoverHeight}
                          ${isHovered ? 'scale-x-[2]' : ''}
                        `}
                        style={!isOrigin && !isMilestone ? {
                          background: `repeating-linear-gradient(to bottom, rgba(255,255,255,${isVague ? 0.2 : isApproximate ? 0.25 : 0.3}) 0px, rgba(255,255,255,${isVague ? 0.2 : isApproximate ? 0.25 : 0.3}) 3px, transparent 3px, transparent 6px)`
                        } : undefined}
                      />
                      {/* Notehead + chord */}
                      <div className="absolute left-1/2 -translate-x-1/2 -top-1 pointer-events-none">
                        <div className="relative">
                          <span className={`block ${noteHeadClass}`} />
                          {chordOffsets.map((offset, offsetIndex) => (
                            <span
                              key={`chord-${offsetIndex}`}
                              className={`absolute ${chordHeadClass}`}
                              style={{ left: `${offset.x}px`, top: `${offset.y}px` }}
                            />
                          ))}
                          {(isApproximate || isVague) && (
                            <span
                              className={`absolute left-full ml-1 top-1 rounded-full ${dotSize} ${dotColor}`}
                            />
                          )}
                          {perspectiveCount > 0 && (
                            <svg
                              className={`absolute -left-5 -top-4 ${slurClass}`}
                              width="34"
                              height="14"
                              viewBox="0 0 34 14"
                              aria-hidden="true"
                            >
                              <path
                                d="M 2 12 Q 17 0 32 12"
                                stroke="rgba(224, 122, 95, 0.35)"
                                strokeWidth="1.2"
                                fill="none"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                      {/* Horizontal bracket along timeline for approximate dates */}
                      {(isApproximate || isVague) && (
                        <span
                          className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none"
                          style={{ width: isVague ? '32px' : '20px' }}
                        >
                          {/* Left bracket [ */}
                          <span
                            className={`
                              absolute left-0 h-2.5 w-[1px]
                              ${isOrigin ? 'bg-white/40' : isMilestone ? 'bg-[#e07a5f]/50' : 'bg-white/20'}
                            `}
                          />
                          {/* Horizontal line */}
                          <span
                            className={`
                              absolute bottom-0 left-0 right-0 h-[1px]
                              ${isOrigin ? 'bg-white/30' : isMilestone ? 'bg-[#e07a5f]/40' : 'bg-white/15'}
                            `}
                          />
                          {/* Right bracket ] */}
                          <span
                            className={`
                              absolute right-0 h-2.5 w-[1px]
                              ${isOrigin ? 'bg-white/40' : isMilestone ? 'bg-[#e07a5f]/50' : 'bg-white/20'}
                            `}
                          />
                        </span>
                      )}
                    </div>

                    {/* Perspective count badge */}
                    {perspectiveCount > 0 && (
                      <span
                        className="absolute -top-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-[#e07a5f]/80 text-white text-[10px] font-medium animate-fade-in-up"
                        style={{ animationDelay: `${600 + i * 50}ms`, animationFillMode: 'both' }}
                      >
                        +{perspectiveCount}
                      </span>
                    )}

                    {/* Year label - always visible */}
                    <span
                      className={`absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap animate-fade-in-up transition-colors ${
                        isHovered ? 'text-white/80' : isOrigin ? 'text-white/50' : isMilestone ? 'text-white/40' : 'text-white/25'
                      }`}
                      style={{ animationDelay: `${700 + i * 50}ms`, animationFillMode: 'both' }}
                    >
                      {yearLabel}
                    </span>

                    {/* Tooltip rendered via portal */}
                  </div>
                );
              })}

              {/* Timeline base line */}
              <div className="absolute bottom-12 left-0 right-0 h-px bg-white/10" />
            </>
          )}
                    </div>
                  </div>

                  {/* Right repeat sign - fixed */}
                  <div className="flex-shrink-0 w-4 relative">
                    <div className="absolute flex items-center gap-0.5" style={{ right: '0%', top: '28%', height: '32%' }}>
                      <div className="w-px h-full bg-white/10" />
                      <div className="w-[2px] h-full bg-white/15" />
                      <div className="flex flex-col justify-center gap-3 h-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Coming soon placeholder for other tabs */
              <div className="h-[320px] flex flex-col items-center justify-center text-center px-8">
                {activeTab === 'witness' && (
                  <>
                    {/* Visual hint: clustered circles representing people */}
                    <div className="flex items-center justify-center gap-2 mb-6">
                      {[28, 36, 24, 32, 28].map((size, i) => (
                        <div
                          key={i}
                          className="rounded-full bg-white/10 border border-white/20"
                          style={{
                            width: `${size}px`,
                            height: `${size}px`,
                            marginTop: `${[0, -6, 4, -4, 2][i]}px`,
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-white/50 text-sm max-w-sm">
                      Stories grouped by <em>who was there</em> — the same moment seen through different eyes.
                    </p>
                  </>
                )}
                {activeTab === 'storyteller' && (
                  <>
                    {/* Visual hint: stacked horizontal lines representing voices */}
                    <div className="flex flex-col items-start gap-2 mb-6 w-48">
                      {[0.8, 0.5, 0.65, 0.4].map((width, i) => (
                        <div
                          key={i}
                          className="h-1 rounded-full bg-white/15"
                          style={{ width: `${width * 100}%` }}
                        />
                      ))}
                    </div>
                    <p className="text-white/50 text-sm max-w-sm">
                      All the notes from a single voice — <em>whose perspective</em> shaped this telling.
                    </p>
                  </>
                )}
                {activeTab === 'thread' && (
                  <>
                    {/* Visual hint: two knowledge graphs connected */}
                    <div className="relative w-64 h-20 mb-6">
                      {/* Left cluster */}
                      <div className="absolute left-2 top-2 w-3 h-3 rounded-full bg-white/15 border border-white/25" />
                      <div className="absolute left-8 top-6 w-4 h-4 rounded-full bg-white/20 border border-white/30" />
                      <div className="absolute left-3 top-12 w-2.5 h-2.5 rounded-full bg-white/15 border border-white/25" />

                      {/* Right cluster */}
                      <div className="absolute right-8 top-3 w-3.5 h-3.5 rounded-full bg-white/20 border border-white/30" />
                      <div className="absolute right-2 top-8 w-3 h-3 rounded-full bg-white/15 border border-white/25" />
                      <div className="absolute right-6 top-14 w-2.5 h-2.5 rounded-full bg-white/15 border border-white/25" />

                      <svg className="absolute inset-0 w-full h-full" style={{ overflow: 'visible' }}>
                        {/* Left cluster connections */}
                        <line x1="20" y1="14" x2="40" y2="30" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                        <line x1="18" y1="54" x2="40" y2="30" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                        {/* Right cluster connections */}
                        <line x1="220" y1="18" x2="238" y2="38" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                        <line x1="228" y1="62" x2="238" y2="38" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                        {/* Bridge between clusters */}
                        <path d="M 44 30 Q 128 10, 216 28" stroke="rgba(224,122,95,0.3)" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
                      </svg>
                    </div>
                    <p className="text-white/50 text-sm max-w-sm">
                      How one story sparked another — <em>what led to what</em> across time.
                    </p>
                  </>
                )}
                {activeTab === 'synchronicity' && (
                  <>
                    {/* Visual hint: parallel lines suggesting rhyming patterns */}
                    <div className="flex gap-8 mb-6">
                      <div className="flex flex-col gap-3">
                        <div className="w-12 h-1 rounded-full bg-[#e07a5f]/30" />
                        <div className="w-8 h-1 rounded-full bg-white/15" />
                      </div>
                      <div className="flex flex-col gap-3">
                        <div className="w-12 h-1 rounded-full bg-[#e07a5f]/30" />
                        <div className="w-8 h-1 rounded-full bg-white/15" />
                      </div>
                    </div>
                    <p className="text-white/40 text-sm max-w-md leading-relaxed text-center mx-auto font-light italic">
                      <span className="block">Patterns that echo across time.</span>
                      <span className="block mt-1 text-white/30">Meaningful coincidences that add melody or harmony.</span>
                    </p>
                  </>
                )}
                <span className="mt-6 text-[10px] uppercase tracking-[0.3em] text-white/50 border border-white/20 rounded-full px-4 py-1.5">
                  Coming soon
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Explore by Motif — Coming Soon */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div
          className="relative rounded-2xl border border-dashed border-white/20 p-8 overflow-hidden cursor-pointer"
          onMouseEnter={() => setShowComingSoon(true)}
          onMouseLeave={() => setShowComingSoon(false)}
          onClick={() => setShowComingSoon(true)}
        >
          {/* Subtle gradient overlay suggesting emergence */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(124, 138, 120, 0.08), transparent)'
            }}
          />

          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="font-serif text-xl text-white/90">
                Motifs
              </h3>
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 border border-white/20 rounded-full px-2.5 py-0.5">
                Taking shape
              </span>
            </div>

            <p className="text-white/60 text-sm leading-relaxed max-w-lg">
              The recurring patterns of a life — her humor, her fire, her care — will emerge here once enough notes are gathered.
            </p>
          </div>
        </div>
      </section>
      {/* Portal tooltip for timeline hover preview */}
      {hoveredEvent && tooltipPos && typeof document !== 'undefined' && createPortal(
        <>
          {/* Invisible backdrop to dismiss on mobile tap-away */}
          <div
            className="fixed inset-0 z-[9998] md:hidden"
            onClick={() => {
              setHoveredEvent(null);
              setHoveredBundle(null);
              setTooltipPos(null);
            }}
          />
          <div
            className="fixed z-[9999] px-3 py-2.5 bg-black/95 backdrop-blur-sm rounded-lg min-w-[180px] max-w-[280px] animate-fade-in border border-white/10 cursor-pointer md:pointer-events-none"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
            onClick={() => {
              if (!hoveredEvent?.id) return;
              router.push(`/memory/${hoveredEvent.id}`);
            }}
          >
            <p className="text-white/50 text-[10px] tracking-wide">
              {hoveredEvent.year}{hoveredEvent.yearEnd && hoveredEvent.yearEnd !== hoveredEvent.year ? `–${hoveredEvent.yearEnd}` : ''}
              {hoveredEvent.location && ` · ${hoveredEvent.location}`}
            </p>
            <p className="text-white text-sm font-medium mt-0.5">{hoveredEvent.title}</p>
            {hoveredEvent.preview && (
              <p className="text-white/60 text-xs mt-1.5 leading-relaxed line-clamp-3">
                {hoveredEvent.preview.replace(/<[^>]*>/g, '').slice(0, 150)}
                {hoveredEvent.preview.replace(/<[^>]*>/g, '').length > 150 ? '…' : ''}
              </p>
            )}
            {hoveredEvent.triggerEventId && eventLookup.get(hoveredEvent.triggerEventId) && (
              <p className="text-white/40 text-[10px] mt-2">
                In response to:{' '}
                <span className="text-white/60">
                  {eventLookup.get(hoveredEvent.triggerEventId)?.title}
                </span>
              </p>
            )}
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
              <p className="text-white/40 text-[10px]">
                {hoveredEvent.contributor}
                {hoveredEvent.contributorRelation && hoveredEvent.contributorRelation !== 'synthesized' && (
                  <span className="text-white/30"> ({hoveredEvent.contributorRelation})</span>
                )}
              </p>
              {hoveredBundle && hoveredBundle.totalCount > 1 && (
                <span className="text-[#e07a5f] text-[10px]">
                  +{hoveredBundle.totalCount - 1} other perspective{hoveredBundle.totalCount > 2 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-white/30 text-[10px] mt-1.5 italic">
              <span className="hidden md:inline">Click the note to open</span>
              <span className="md:hidden">Tap the note to open</span>
            </p>
          </div>
        </>,
        document.body
      )}

    </div>
  );
}
