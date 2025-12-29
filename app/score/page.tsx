'use client';

import { YearInput } from '@/components/forms/YearInput';
import { ReferencesList } from '@/components/ReferencesList';
import { RelationGraphPeek } from '@/components/RelationGraphPeek';
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
  MODAL_LABELS,
  SCORE_TITLE,
} from '@/lib/terminology';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Minimal HTML decoder for stored rich text
function decodeHtml(input: string) {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export default function ChaptersPage() {
  const [bundles, setBundles] = useState<StoryBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [hoveredBundle, setHoveredBundle] = useState<StoryBundle | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<StoryBundle | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareMode, setShareMode] = useState<'link' | 'invite'>('link');
  const [isReady, setIsReady] = useState(false);

  // Share panel state
  const [witnesses, setWitnesses] = useState<string[]>([]);
  const [newWitness, setNewWitness] = useState('');
  const [inviteMethod, setInviteMethod] = useState<'email' | 'sms' | 'link'>('link');
  const [inviteContact, setInviteContact] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  // Inline edit mode for note detail modal
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    why_included: '',
    location: '',
    year: 0,
    year_end: null as number | null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'time' | 'witness' | 'storyteller' | 'thread' | 'synchronicity'>('time');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number | null>(null);

  // Graph connections for the selected event
  type GraphPerson = {
    id: string;
    name?: string;
    relationship?: string;
    role: 'wrote' | 'responded' | 'invited' | 'mentioned';
    isViewer?: boolean;
  };
  const [connectedPeople, setConnectedPeople] = useState<GraphPerson[]>([]);

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

  // Fetch current user session
  useEffect(() => {
    fetch('/api/session')
      .then(res => res.json())
    .then(data => {
      if (data?.name) setCurrentUserName(data.name);
    })
      .catch(() => {});
  }, []);

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
          const eventsData = await getTimelineEvents({ privacyLevels: ['public', 'family', 'kids-only'] });

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

  // Close modal on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isShareOpen) {
          setIsShareOpen(false);
        } else {
          setSelectedEvent(null);
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isShareOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!selectedEvent) {
      setIsShareOpen(false);
      setShareMode('link');
      setIsEditMode(false);
      setSelectedBundle(null);
      setWitnesses([]);
      setNewWitness('');
      setInviteMethod('link');
      setInviteContact('');
      setPersonalMessage('');
      setInviteSent(false);
      setConnectedPeople([]);
      setSaveError(null);
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (!selectedEvent || selectedEvent.type !== 'memory') {
      setShareMode('link');
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (isShareOpen) {
      setInviteSent(false);
      setInviteError(null);
    }
  }, [isShareOpen, shareMode]);

  // Fetch people connected to selected event (for the graph)
  useEffect(() => {
    if (!selectedEvent || selectedEvent.type !== 'memory') {
      setConnectedPeople([]);
      return;
    }

    async function fetchConnections() {
      try {
        const res = await fetch(`/api/respond/connections?event_id=${selectedEvent!.id}`);
        if (res.ok) {
          const data = await res.json();
          setConnectedPeople(data.people || []);
        }
      } catch {
        // Silently fail - graph is enhancement, not critical
      }
    }
    fetchConnections();
  }, [selectedEvent]);

  const addWitness = () => {
    if (newWitness.trim() && !witnesses.includes(newWitness.trim())) {
      setWitnesses([...witnesses, newWitness.trim()]);
      setNewWitness('');
    }
  };

  const removeWitness = (name: string) => {
    setWitnesses(witnesses.filter(w => w !== name));
  };

  const handleSendInvite = async () => {
    if (!selectedEvent) return;

    setInviteSent(false);
    setInviteError(null);
    setInviteSending(true);
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: selectedEvent.id,
          recipient_name: witnesses[0] || 'Friend of Valerie',
          recipient_contact: inviteContact || 'link',
          method: inviteMethod,
          message: personalMessage,
          witnesses,
        }),
      });

      if (!res.ok) throw new Error('Invite failed');
      setInviteSent(true);
      setPersonalMessage('');
      setInviteContact('');
      setWitnesses([]);
      setNewWitness('');
    } catch (error) {
      console.error(error);
      setInviteError('Could not send invite. Please try again.');
    } finally {
      setInviteSending(false);
      setTimeout(() => setInviteSent(false), 2000);
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/memory/${selectedEvent?.id}`;
    navigator.clipboard.writeText(link);
    setInviteError(null);
    setInviteSent(true);
    setTimeout(() => setInviteSent(false), 2000);
  };

  // Enter edit mode - populate form with current values
  const enterEditMode = () => {
    if (!selectedEvent) return;
    setEditForm({
      title: selectedEvent.title || '',
      content: selectedEvent.fullEntry || '',
      why_included: selectedEvent.whyIncluded || '',
      location: selectedEvent.location || '',
      year: selectedEvent.year || 0,
      year_end: selectedEvent.yearEnd ?? null,
    });
    setSaveError(null);
    setIsEditMode(true);
  };

  // Cancel edit mode
  const cancelEditMode = () => {
    setIsEditMode(false);
    setSaveError(null);
  };

  // Save inline edits
  const saveInlineEdits = async () => {
    if (!selectedEvent) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          content: editForm.content,
          why_included: editForm.why_included,
          location: editForm.location,
          year: editForm.year,
          year_end: editForm.year_end,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      // Update the local state with new values
      const updatedEvent = {
        ...selectedEvent,
        title: editForm.title,
        fullEntry: editForm.content,
        preview: editForm.content.length > 160
          ? `${editForm.content.slice(0, 160).trimEnd()}...`
          : editForm.content,
        whyIncluded: editForm.why_included,
        location: editForm.location,
        year: editForm.year,
        yearEnd: editForm.year_end,
      };

      // Update bundles to reflect the change
      setBundles(prevBundles =>
        prevBundles.map(bundle => {
          if (bundle.rootEvent.id === selectedEvent.id) {
            return { ...bundle, rootEvent: updatedEvent };
          }
          return {
            ...bundle,
            perspectives: bundle.perspectives.map(p =>
              p.id === selectedEvent.id ? updatedEvent : p
            ),
          };
        })
      );

      setSelectedEvent(updatedEvent);
      setIsEditMode(false);
    } catch (error) {
      console.error('Save error:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

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
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-8">
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
            className="mt-8 flex flex-wrap gap-4 animate-fade-in-up"
            style={{ animationDelay: '360ms', animationFillMode: 'both' }}
          >
            <a
              href="/share"
              className="inline-flex items-center gap-2 rounded-full bg-[#e07a5f] text-white px-6 py-3 text-xs uppercase tracking-[0.2em] hover:bg-[#d06a4f] transition-colors"
            >
              Add a note
            </a>
            <div className="relative">
              <span
                className="inline-flex items-center gap-2 rounded-full border border-white/20 text-white/70 px-6 py-3 text-xs uppercase tracking-[0.2em] cursor-pointer hover:border-white/40 hover:text-white transition-colors"
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
          <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-white/5 relative z-10">
            <div
              className="flex items-center gap-1 overflow-x-auto scrollbar-hide pr-8 -mr-8"
              style={{
                maskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent 100%)',
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

            {/* Zoom controls - hidden on mobile since pinch gestures work */}
            {activeTab === 'time' && (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
                  className="w-7 h-7 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors text-sm flex items-center justify-center"
                >
                  −
                </button>
                <span className="text-[10px] text-white/30 w-10 text-center tabular-nums">{Math.round(zoomLevel * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}
                  className="w-7 h-7 rounded-md bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors text-sm flex items-center justify-center"
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* Tab content */}
          <div className="p-4 overflow-visible relative z-20">
            {activeTab === 'time' ? (
              <>
                {/* Key toggle */}
                <div className="mb-2">
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="text-[11px] tracking-[0.15em] uppercase text-white/40 hover:text-white/60 transition-colors"
                  >
                    {showKey ? '— Hide key' : '— Key'}
                  </button>
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
                const hasMore = event.fullEntry || event.preview;
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
                const isSelected = selectedEvent?.id === event.id;
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
                const slurClass = isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-70';

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
                    onClick={(e) => {
                      if (!hasMore) return;

                      // Two-tap pattern for mobile:
                      // If already showing preview for this event, open full detail
                      // Otherwise, show preview first
                      if (hoveredEvent?.id === event.id) {
                        setSelectedEvent(event);
                        setSelectedBundle(bundle);
                        // Clear preview
                        setHoveredEvent(null);
                        setHoveredBundle(null);
                        setTooltipPos(null);
                      } else {
                        // Show preview (mobile tap = hover equivalent)
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                        setHoveredEvent(event);
                        setHoveredBundle(bundle);
                      }
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


      {/* Modal for expanded entry */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-[#151515] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                {isEditMode ? (
                  <>
                    <YearInput
                      year={editForm.year}
                      yearEnd={editForm.year_end}
                      onYearChange={(y) => setEditForm({ ...editForm, year: y ?? 0 })}
                      onYearEndChange={(y) => setEditForm({ ...editForm, year_end: y })}
                      layout="inline"
                      label="Year"
                      className="mb-2"
                    />
                    <label className="text-xs text-white/40 uppercase tracking-wider block mt-2">Title</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-lg font-serif focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40"
                      placeholder="Title"
                    />
                  </>
                ) : (
                  <>
                    <p className="text-white/40 text-sm">{formatYearLabel(selectedEvent)}</p>
                    <h2 className="text-2xl font-serif text-white mt-1">{selectedEvent.title}</h2>
                    {selectedBundle && selectedBundle.totalCount > 1 && (
                      <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full bg-[#e07a5f]/15 text-[#e07a5f] text-[10px] uppercase tracking-[0.2em]">
                        Other perspectives
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                {/* Edit button for owner */}
                {!isEditMode && currentUserName && selectedEvent.contributor?.toLowerCase() === currentUserName.toLowerCase() && (
                  <button
                    onClick={enterEditMode}
                    className="text-white/40 hover:text-white transition-colors p-1 text-sm"
                    title="Edit this note"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    if (isEditMode) {
                      cancelEditMode();
                    } else {
                      setSelectedEvent(null);
                    }
                  }}
                  className="text-white/40 hover:text-white transition-colors p-1"
                >
                  <span className="text-xl">×</span>
                </button>
              </div>
            </div>

            {selectedBundle && selectedBundle.totalCount > 1 && (
              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50">
                Root note · Depth {selectedEvent.chainDepth ?? 0} · {selectedBundle.totalCount} notes
              </div>
            )}

            {/* Content */}
            <div className="text-white/70 leading-relaxed space-y-4">
              {selectedEvent.type === 'origin' && selectedEvent.fullEntry && !isEditMode && (
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">{MODAL_LABELS.originContent}</p>
              )}
              {isEditMode ? (
                <>
                  <label className="text-xs text-white/40 uppercase tracking-wider">Content</label>
                  <textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    rows={8}
                    className="w-full mt-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 resize-y"
                    placeholder="What happened..."
                  />
                </>
              ) : selectedEvent.fullEntry ? (
                <div
                  className="prose prose-sm prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: decodeHtml(selectedEvent.fullEntry) }}
                />
              ) : selectedEvent.preview ? (
                <p>{selectedEvent.preview}</p>
              ) : null}
            </div>

            {selectedEvent.media && selectedEvent.media.length > 0 && (
              <div className="mt-6 space-y-4">
                {selectedEvent.media.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    {item.type === 'audio' && (
                      <audio controls className="w-full">
                        <source src={item.url} />
                      </audio>
                    )}
                    {item.type === 'photo' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.url}
                        alt={item.caption || 'Attached image'}
                        className="w-full rounded-lg border border-white/10"
                      />
                    )}
                    {item.type === 'document' && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[#e07a5f] hover:text-white transition-colors"
                      >
                        Open link
                      </a>
                    )}
                    {item.caption && (
                      <p className="text-xs text-white/40 mt-3">{item.caption}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Why this note */}
            {isEditMode ? (
              <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
                <label className="text-xs text-white/40 uppercase tracking-wider">{MODAL_LABELS.whyIncluded}</label>
                <textarea
                  value={editForm.why_included}
                  onChange={(e) => setEditForm({ ...editForm, why_included: e.target.value })}
                  rows={3}
                  className="w-full mt-2 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white/60 text-sm italic leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 resize-y"
                  placeholder="Why is this meaningful..."
                />
              </div>
            ) : selectedEvent.whyIncluded ? (
              <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">{MODAL_LABELS.whyIncluded}</p>
                <div
                  className="text-white/60 text-sm italic leading-relaxed prose prose-sm prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: decodeHtml(selectedEvent.whyIncluded) }}
                />
                <p className="text-white/30 text-xs mt-2">
                  — {selectedEvent.contributor}
                  {selectedEvent.contributorRelation && selectedEvent.contributorRelation !== 'synthesized' && (
                    <span> ({selectedEvent.contributorRelation})</span>
                  )}
                </p>
              </div>
            ) : null}

            {/* Context / Location */}
            {isEditMode ? (
              <div className="mt-4">
                <label className="text-xs text-white/40 uppercase tracking-wider">Location</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40"
                  placeholder="Where did this happen?"
                />
              </div>
            ) : (selectedEvent.location
              || selectedEvent.date
              || (selectedEvent.timingCertainty && selectedEvent.timingCertainty !== 'exact')
              || (selectedEvent.timingInputType === 'age_range'
                && selectedEvent.ageStart !== null
                && selectedEvent.ageEnd !== null)
            ) ? (
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/40">
                {selectedEvent.date && (
                  <span>{selectedEvent.date}, {formatYearLabel(selectedEvent)}</span>
                )}
                {selectedEvent.location && (
                  <span>📍 {selectedEvent.location}</span>
                )}
                {selectedEvent.timingCertainty && selectedEvent.timingCertainty !== 'exact' && (
                  <span>
                    Timing: {selectedEvent.timingCertainty === 'approximate' ? 'Approximate' : 'Vague'}
                  </span>
                )}
                {selectedEvent.timingInputType === 'age_range'
                  && selectedEvent.ageStart !== null
                  && selectedEvent.ageEnd !== null && (
                  <span>Ages {selectedEvent.ageStart}–{selectedEvent.ageEnd}</span>
                )}
              </div>
            ) : null}

            {/* Other perspectives in this story */}
            {selectedBundle && selectedBundle.totalCount > 1 && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-3">
                  Other perspectives ({selectedBundle.totalCount})
                </p>
                <div className="space-y-2">
                  {/* Show root event if currently viewing a perspective */}
                  {selectedEvent.id !== selectedBundle.rootEvent.id && (
                    <button
                      onClick={() => setSelectedEvent(selectedBundle.rootEvent)}
                      className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                    >
                      <p className="text-white/80 text-sm font-medium">{selectedBundle.rootEvent.title}</p>
                      <p className="text-white/40 text-xs mt-1">
                        {selectedBundle.rootEvent.contributor}
                        {selectedBundle.rootEvent.contributorRelation && selectedBundle.rootEvent.contributorRelation !== 'synthesized' && (
                          <span> ({selectedBundle.rootEvent.contributorRelation})</span>
                        )}
                        <span className="ml-2 text-[#e07a5f]">Original</span>
                      </p>
                    </button>
                  )}
                  {/* Show other perspectives */}
                  {selectedBundle.perspectives
                    .filter(p => p.id !== selectedEvent.id)
                    .map((perspective) => (
                      <button
                        key={perspective.id}
                        onClick={() => setSelectedEvent(perspective)}
                        className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                      >
                        <p className="text-white/80 text-sm font-medium">{perspective.title}</p>
                        <p className="text-white/40 text-xs mt-1">
                          {perspective.contributor}
                          {perspective.contributorRelation && perspective.contributorRelation !== 'synthesized' && (
                            <span> ({perspective.contributorRelation})</span>
                          )}
                        </p>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Source attribution (references only) */}
            <div className="mt-6 pt-4 border-t border-white/10 space-y-4">
              <div className="text-xs text-white/40">
                <span className="text-white/20">Added by</span>{' '}
                <span className="text-white/50">{selectedEvent.contributor}</span>
                {selectedEvent.contributorRelation && selectedEvent.contributorRelation !== 'synthesized' && (
                  <span className="text-white/30"> ({selectedEvent.contributorRelation})</span>
                )}
              </div>
              {selectedEvent.references && selectedEvent.references.length > 0 && (
                <ReferencesList references={selectedEvent.references} />
              )}
            </div>

            {/* Constellation graph - only for memories with connections */}
            {selectedEvent.type === 'memory' && connectedPeople.length > 0 && (
              <RelationGraphPeek
                className="mt-6"
                story={{
                  id: selectedEvent.id,
                  title: selectedEvent.title,
                  type: selectedEvent.type,
                }}
                people={connectedPeople}
              />
            )}

            {/* Action buttons */}
            <div className="mt-6 space-y-3">
              {/* Save/Cancel buttons when in edit mode */}
              {isEditMode ? (
                <>
                  {saveError && (
                    <p className="text-sm text-red-400 text-center">{saveError}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={cancelEditMode}
                      disabled={isSaving}
                      className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 text-sm font-medium hover:border-white/40 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveInlineEdits}
                      disabled={isSaving || !editForm.title.trim() || !editForm.content.trim()}
                      className="flex-1 py-3 rounded-xl bg-[#e07a5f] text-white text-sm font-medium hover:bg-[#d06a4f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSaving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Add your perspective - only for memories and not the contributor */}
                  {selectedEvent.type === 'memory' &&
                    !(currentUserName && selectedEvent.contributor?.toLowerCase() === currentUserName.toLowerCase()) && (
                    <a
                      href={`/share?responding_to=${selectedEvent.id}`}
                      className="w-full py-3 rounded-xl border border-white/20 text-white/70 text-sm font-medium hover:border-white/40 hover:text-white transition-colors flex items-center justify-center gap-2"
                    >
                      <span>Add your perspective</span>
                    </a>
                  )}

                  {/* Share button - for all event types */}
                  <button
                    onClick={() => {
                      setShareMode('link');
                      setIsShareOpen(true);
                    }}
                    className="w-full py-3 rounded-xl bg-[#e07a5f] text-white text-sm font-medium hover:bg-[#d06a4f] transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Share this note</span>
                    <span>→</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share / Invite Panel */}
      {isShareOpen && selectedEvent && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsShareOpen(false)}
        >
          <div
            className="bg-[#151515] border border-white/10 rounded-2xl max-w-lg w-full shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Share this note</h2>
              <button
                onClick={() => setIsShareOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>

            {/* Mode toggle */}
            {selectedEvent.type === 'memory' && (
              <div className="px-6 py-4 border-b border-white/10">
                <p className="text-sm text-white/60">How do you want to share this note?</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setShareMode('link')}
                    className={`flex-1 py-2 rounded-xl text-sm transition-colors ${
                      shareMode === 'link'
                        ? 'bg-white/20 text-white'
                        : 'bg-white/10 text-white/50 hover:bg-white/15'
                    }`}
                  >
                    View-only link
                  </button>
                  <button
                    onClick={() => setShareMode('invite')}
                    className={`flex-1 py-2 rounded-xl text-sm transition-colors ${
                      shareMode === 'invite'
                        ? 'bg-white/20 text-white'
                        : 'bg-white/10 text-white/50 hover:bg-white/15'
                    }`}
                  >
                    Invite to contribute
                  </button>
                </div>
              </div>
            )}

            {/* Share link */}
            {(selectedEvent.type !== 'memory' || shareMode === 'link') && (
              <>
                <div className="p-6 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]">
                  <div className="bg-[#1f1f1f] rounded-xl p-4 border border-white/5">
                    <p className="text-white/40 text-xs">{formatYearLabel(selectedEvent)}</p>
                    <h3 className="text-white font-serif text-lg mt-1">{selectedEvent.title}</h3>
                    {selectedEvent.preview && (
                      <p className="text-white/60 text-sm mt-2 leading-relaxed line-clamp-3">{selectedEvent.preview}</p>
                    )}
                    <p className="text-xs text-white/30 mt-3 pt-3 border-t border-white/5">
                      Added by {selectedEvent.contributor}
                      {selectedEvent.contributorRelation && selectedEvent.contributorRelation !== 'synthesized' && (
                        <span> ({selectedEvent.contributorRelation})</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="px-6 py-4">
                  <button
                    onClick={copyShareLink}
                    className={`w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      inviteSent
                        ? 'bg-green-600 text-white'
                        : 'bg-[#e07a5f] text-white hover:bg-[#d06a4f]'
                    }`}
                  >
                    {inviteSent ? (
                      <>
                        <span>✓</span>
                        <span>Link copied!</span>
                      </>
                    ) : (
                      <>
                        <span>Copy link to share</span>
                      </>
                    )}
                  </button>
                  <p className="text-xs text-white/30 text-center mt-3">
                    Anyone with access can view this note
                  </p>
                </div>
              </>
            )}

            {/* Invite to contribute */}
            {selectedEvent.type === 'memory' && shareMode === 'invite' && (
              <>
                <div className="px-6 py-4 border-b border-white/10">
                  <p className="text-sm text-white/60">
                    Invite someone who was there to add their perspective to:
                  </p>
                  <p className="text-white font-medium mt-2">{selectedEvent.title}</p>
                  <p className="text-xs text-white/40 mt-1">{formatYearLabel(selectedEvent)}</p>
                </div>

                <div className="px-6 py-4 border-b border-white/10">
                  <label className="text-sm text-white/60 block mb-3">
                    Who was there?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newWitness}
                      onChange={(e) => setNewWitness(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addWitness()}
                      placeholder="Name (e.g., Aunt Susan)"
                      className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#e07a5f]/40 focus:border-transparent"
                    />
                    <button
                      onClick={addWitness}
                      className="px-4 py-2 rounded-xl bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  {witnesses.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {witnesses.map((name) => (
                        <span
                          key={name}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#e07a5f]/20 text-[#e07a5f] text-sm"
                        >
                          {name}
                          <button
                            onClick={() => removeWitness(name)}
                            className="ml-1 hover:text-white transition-colors"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-b border-white/10">
                  <label className="text-sm text-white/60 block mb-3">
                    How do you want to reach them?
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setInviteMethod('link')}
                      className={`flex-1 py-2 rounded-xl text-sm transition-colors ${
                        inviteMethod === 'link'
                          ? 'bg-white/20 text-white'
                          : 'bg-white/10 text-white/50 hover:bg-white/15'
                      }`}
                    >
                      🔗 Copy Link
                    </button>
                    <div className="relative flex-1 group">
                      <button
                        disabled
                        className="w-full py-2 rounded-xl text-sm bg-white/5 text-white/30 cursor-not-allowed"
                      >
                        📧 Email
                      </button>
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-white/10 backdrop-blur-sm rounded text-xs text-white/60 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Coming soon
                      </span>
                    </div>
                    <div className="relative flex-1 group">
                      <button
                        disabled
                        className="w-full py-2 rounded-xl text-sm bg-white/5 text-white/30 cursor-not-allowed"
                      >
                        💬 SMS
                      </button>
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-white/10 backdrop-blur-sm rounded text-xs text-white/60 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Coming soon
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4">
                  <button
                    onClick={handleSendInvite}
                    disabled={witnesses.length === 0 || inviteSending}
                    className={`w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      inviteSent
                        ? 'bg-green-600 text-white'
                        : 'bg-[#e07a5f] text-white hover:bg-[#d06a4f] disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {inviteSent ? (
                      <>
                        <span>✓</span>
                        <span>Invite created!</span>
                      </>
                    ) : inviteSending ? (
                      <span>Creating invite…</span>
                    ) : (
                      <>
                        <span>{inviteMethod === 'link' ? 'Create invite link' : 'Send invite'}</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                  {inviteError && (
                    <p className="text-xs text-red-300 text-left mt-2">{inviteError}</p>
                  )}
                  <p className="text-xs text-white/30 text-center mt-3">
                    {witnesses.length > 0
                      ? `Will create an invite for ${witnesses.length} person${witnesses.length > 1 ? 's' : ''} to add their perspective`
                      : 'Add at least one person to invite'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Portal tooltip for timeline hover/tap preview */}
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
              // Tap on tooltip opens full detail (mobile)
              if (hoveredEvent.fullEntry || hoveredEvent.preview) {
                setSelectedEvent(hoveredEvent);
                setSelectedBundle(hoveredBundle);
                setHoveredEvent(null);
                setHoveredBundle(null);
                setTooltipPos(null);
              }
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
              <span className="hidden md:inline">Click to read more</span>
              <span className="md:hidden">Tap to read more</span>
            </p>
          </div>
        </>,
        document.body
      )}

    </div>
  );
}
