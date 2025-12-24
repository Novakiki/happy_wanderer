'use client';

import { useState, useEffect } from 'react';
import { getTimelineEvents, getThemes } from '@/lib/supabase';
import type { Theme } from '@/lib/database.types';

// UI type for timeline events (mapped from database)
type TimelineEvent = {
  id: string;
  year: number;
  date?: string | null;
  type: 'origin' | 'milestone' | 'memory';
  title: string;
  preview?: string | null;
  fullEntry?: string | null;
  whyIncluded?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  contributor: string;
  contributorRelation?: string | null;
  themes?: string[];
  location?: string | null;
  peopleInvolved?: string[] | null;
};

export default function ChaptersPage() {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
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

  // Fetch data from Supabase
  useEffect(() => {
    async function fetchData() {
      try {
        // Prefer server-fetched score (avoids client env or RLS hiccups)
        const res = await fetch('/api/score');
        if (res.ok) {
          const json = await res.json();
          const eventsData = json.events || [];
          const themesData = json.themes || [];

          const mappedEvents: TimelineEvent[] = eventsData.map((e: any) => ({
            id: e.id,
            year: e.year,
            date: e.date,
            type: e.type,
            title: e.title,
            preview: e.preview,
            fullEntry: e.full_entry,
            whyIncluded: e.why_included,
            sourceUrl: e.source_url,
            sourceName: e.source_name,
            contributor: e.contributor?.name || 'Unknown',
            contributorRelation: e.contributor?.relation,
            themes: e.themes?.map((t: { theme: { id: string } }) => t.theme.id) || [],
            location: e.location,
            peopleInvolved: e.people_involved,
          }));

          setEvents(mappedEvents);
          setThemes(themesData || []);
        } else {
          // Fallback to direct Supabase client
          const [eventsData, themesData] = await Promise.all([
            getTimelineEvents({ privacyLevels: ['public', 'family', 'kids-only'] }),
            getThemes(),
          ]);
          const mappedEvents: TimelineEvent[] = eventsData.map((e) => ({
            id: e.id,
            year: e.year,
            date: e.date,
            type: e.type,
            title: e.title,
            preview: e.preview,
            fullEntry: e.full_entry,
            whyIncluded: e.why_included,
            sourceUrl: e.source_url,
            sourceName: e.source_name,
            contributor: e.contributor?.name || 'Unknown',
            contributorRelation: e.contributor?.relation,
            themes: e.themes?.map((t: { theme: { id: string } }) => t.theme.id) || [],
            location: e.location,
            peopleInvolved: e.people_involved,
          }));
          setEvents(mappedEvents);
          setThemes(themesData || []);
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

  // Reset share state when modal closes
  useEffect(() => {
    if (!selectedEvent) {
      setIsShareOpen(false);
      setWitnesses([]);
      setNewWitness('');
      setInviteContact('');
      setPersonalMessage('');
      setInviteSent(false);
    }
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

  // Position events evenly across the timeline (index-based, not time-based)
  const getEventPosition = (index: number) => {
    if (events.length <= 1) return 50;
    const padding = 5; // % padding on each side
    const usableWidth = 100 - (padding * 2);
    return padding + (index / (events.length - 1)) * usableWidth;
  };

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
      className="min-h-screen text-white overflow-hidden bg-[#0b0b0b]"
      style={{
        backgroundImage: `
          repeating-linear-gradient(90deg,
            rgba(255, 255, 255, 0.03) 0,
            rgba(255, 255, 255, 0.03) 1px,
            transparent 1px,
            transparent 8px,
            rgba(255, 255, 255, 0.02) 8px,
            rgba(255, 255, 255, 0.02) 9px,
            transparent 9px,
            transparent 140px
          ),
          radial-gradient(900px 520px at 12% -8%, rgba(224, 122, 95, 0.12), transparent 60%),
          radial-gradient(700px 520px at 88% 6%, rgba(124, 138, 120, 0.12), transparent 55%),
          linear-gradient(180deg, rgba(11, 11, 11, 1), rgba(5, 5, 5, 1))
        `,
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Intro Section */}
      <section className={`transition-opacity duration-1000 ${isReady ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-8">
          <p
            className="text-xs uppercase tracking-[0.3em] text-white/40 animate-fade-in-up"
            style={{ animationDelay: '50ms', animationFillMode: 'both' }}
          >
            The Happy Wanderer
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
            This is a place to explore who she was — through the memories,
            stories, and moments shared by family and friends.
          </p>
          <div
            className="mt-4 animate-fade-in-up"
            style={{ animationDelay: '330ms', animationFillMode: 'both' }}
          >
            <a
              href="/letter"
              className="text-sm text-white/60 hover:text-white transition-colors underline underline-offset-4"
            >
              Read the letter to her children
            </a>
          </div>
          <div
            className="mt-8 animate-fade-in-up"
            style={{ animationDelay: '360ms', animationFillMode: 'both' }}
          >
            <a
              href="/share"
              className="inline-flex items-center gap-2 rounded-full bg-[#e07a5f] text-white px-6 py-3 text-xs uppercase tracking-[0.2em] hover:bg-[#d06a4f] transition-colors"
            >
              Share a memory
            </a>
          </div>
        </div>
      </section>

      {/* Timeline Visualization */}
      <section className="relative mt-12 px-6">
        <p
          className="text-xs uppercase tracking-[0.3em] text-white/40 mb-4 max-w-4xl mx-auto animate-fade-in-up"
          style={{ animationDelay: '700ms', animationFillMode: 'both' }}
        >
          The Score
        </p>
        <div
          className="max-w-4xl mx-auto flex flex-wrap items-center gap-4 text-xs text-white/40 mb-2 animate-fade-in-up"
          style={{ animationDelay: '740ms', animationFillMode: 'both' }}
        >
          <div className="inline-flex items-center gap-2">
            <span className="h-3 w-1 rounded-full bg-white/80" />
            <span>Synchronicity-based storytelling</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="h-3 w-1 rounded-full bg-[#e07a5f]" />
            <span>Milestones</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="h-3 w-1 rounded-full bg-white/30" />
            <span>Memories</span>
          </div>
        </div>

        {/* Timeline container */}
        <div className="relative h-[280px] mt-8">
          {events.length === 0 ? (
            <div className="absolute inset-0 flex items-start justify-start text-white/30 pt-6">
              No memories yet. Be the first to share.
            </div>
          ) : (
            <>
              {/* Event bars - evenly spaced */}
              {events.map((event, i) => {
                const isOrigin = event.type === 'origin';
                const isMilestone = event.type === 'milestone';
                const isHovered = hoveredEvent?.id === event.id;
                const hasMore = event.fullEntry || event.preview;

                return (
                  <div
                    key={event.id || `${event.year}-${event.title}`}
                    className="absolute bottom-12 group cursor-pointer"
                    style={{ left: `${getEventPosition(i)}%` }}
                    onMouseEnter={() => setHoveredEvent(event)}
                    onMouseLeave={() => setHoveredEvent(null)}
                    onClick={() => hasMore && setSelectedEvent(event)}
                  >
                    {/* The bar */}
                    <div
                      className={`
                        w-[3px] -translate-x-1/2 transition-all duration-300 animate-rise rounded-full
                        ${isOrigin
                          ? 'bg-white/80 h-36'
                          : isMilestone
                            ? 'bg-[#e07a5f] h-28'
                            : 'bg-white/30 h-16 group-hover:bg-white/50 group-hover:h-20'
                        }
                        ${isHovered ? 'scale-x-[2]' : ''}
                      `}
                      style={{ animationDelay: `${500 + i * 50}ms`, animationFillMode: 'both' }}
                    />

                    {/* Year label - always visible */}
                    <span
                      className={`absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap animate-fade-in-up transition-colors ${
                        isHovered ? 'text-white/80' : isOrigin ? 'text-white/50' : isMilestone ? 'text-white/40' : 'text-white/25'
                      }`}
                      style={{ animationDelay: `${700 + i * 50}ms`, animationFillMode: 'both' }}
                    >
                      {event.year}
                    </span>

                    {/* Tooltip on hover */}
                    <div
                      className={`
                        absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2
                        bg-white/10 backdrop-blur-sm rounded-lg
                        transition-all duration-200 pointer-events-none min-w-[160px] max-w-[260px]
                        ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
                      `}
                    >
                      <p className="text-white text-sm font-medium">{event.title}</p>
                      {isOrigin && (
                        <p className="text-white/40 text-[10px] uppercase tracking-[0.2em] mt-1">
                          Synchronicity-based storytelling
                        </p>
                      )}
                      {event.preview && (
                        <p className="text-white/60 text-xs mt-1 leading-relaxed">{event.preview}</p>
                      )}
                      {event.whyIncluded && (
                        <p className="text-white/40 text-xs mt-2 italic border-t border-white/10 pt-2">
                          &ldquo;{event.whyIncluded}&rdquo;
                        </p>
                      )}
                      {hasMore && (
                        <p className="text-[#e07a5f] text-xs mt-2">Click to read more →</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Timeline base line */}
              <div className="absolute bottom-12 left-[3%] right-[3%] h-px bg-white/10" />
            </>
          )}
        </div>

      </section>

      {/* Explore by Motif */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-start gap-4 border-t border-white/10 pt-8">
          <p className="text-white/40 text-sm">
            Motifs — the recurring patterns of a life.
          </p>
          <span className="text-xs uppercase tracking-[0.3em] text-white/30">
            Coming soon
          </span>
        </div>
        <div className="flex flex-wrap gap-3 mt-6">
          {themes.map((motif) => (
            <span
              key={motif.id}
              className="px-4 py-2 rounded-full border border-white/10 text-sm text-white/30 bg-white/[0.02]"
            >
              {motif.label}
            </span>
          ))}
        </div>
        <p className="text-white/30 text-xs mt-6 italic">
          Motifs are still taking shape. This view will open once enough notes are in.
        </p>
      </section>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 py-12 mt-8">
        <div className="flex flex-wrap items-center justify-start gap-6 text-sm text-white/30">
          <a href="/share" className="hover:text-white/50 transition-colors">
            Share a memory
          </a>
        </div>
      </footer>

      {/* Modal for expanded entry */}
      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-[#151515] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/40 text-sm">{selectedEvent.year}</p>
                <h2 className="text-2xl font-serif text-white mt-1">{selectedEvent.title}</h2>
                {selectedEvent.type === 'origin' && (
                  <p className="text-white/40 text-[10px] uppercase tracking-[0.2em] mt-2">
                    Synchronicity-based storytelling
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-white/40 hover:text-white transition-colors p-1"
              >
                <span className="text-xl">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="text-white/70 leading-relaxed space-y-4">
              {selectedEvent.fullEntry ? (
                <p>{selectedEvent.fullEntry}</p>
              ) : selectedEvent.preview ? (
                <p>{selectedEvent.preview}</p>
              ) : null}
            </div>

            {/* Why this note */}
            {selectedEvent.whyIncluded && (
              <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Why this note</p>
                <p className="text-white/60 text-sm italic leading-relaxed">
                  &ldquo;{selectedEvent.whyIncluded}&rdquo;
                </p>
                <p className="text-white/30 text-xs mt-2">
                  — {selectedEvent.contributor}
                </p>
              </div>
            )}

            {/* Context */}
            {(selectedEvent.location || selectedEvent.date) && (
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/40">
                {selectedEvent.date && (
                  <span>{selectedEvent.date}, {selectedEvent.year}</span>
                )}
                {selectedEvent.location && (
                  <span>📍 {selectedEvent.location}</span>
                )}
              </div>
            )}

            {/* Themes */}
            {selectedEvent.themes && selectedEvent.themes.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {selectedEvent.themes.map((themeId) => {
                  const theme = themes.find(t => t.id === themeId);
                  return theme ? (
                    <span key={themeId} className="text-xs text-white/40 px-2 py-0.5 rounded-full border border-white/10">
                      {theme.label}
                    </span>
                  ) : null;
                })}
              </div>
            )}

            {/* Source attribution */}
            <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="text-xs text-white/40">
                  <span className="text-white/20">Added by</span>{' '}
                  <span className="text-white/50">{selectedEvent.contributor}</span>
                  {selectedEvent.contributorRelation && selectedEvent.contributorRelation !== 'synthesized' && (
                    <span className="text-white/30"> ({selectedEvent.contributorRelation})</span>
                  )}
                </div>
                {selectedEvent.sourceUrl && (
                  <a
                    href={selectedEvent.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/40 hover:text-white/60 transition-colors"
                  >
                    {selectedEvent.sourceName || 'Source'} ↗
                  </a>
                )}
              </div>
            </div>

            {/* Share button */}
            <button
              onClick={() => setIsShareOpen(true)}
              className="mt-6 w-full py-3 rounded-xl bg-[#e07a5f] text-white text-sm font-medium hover:bg-[#d06a4f] transition-colors flex items-center justify-center gap-2"
            >
              <span>Share this memory</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}

      {/* Share Panel */}
      {isShareOpen && selectedEvent && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsShareOpen(false)}
        >
          <div
            className="bg-[#151515] border border-white/10 rounded-2xl max-w-lg w-full shadow-2xl animate-fade-in-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">Share Memory</h2>
              <button
                onClick={() => setIsShareOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>

            {/* Memory Card Preview */}
            <div className="p-6 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]">
              <div className="bg-[#1f1f1f] rounded-xl p-4 border border-white/5">
                <p className="text-white/40 text-xs">{selectedEvent.year}</p>
                <h3 className="text-white font-serif text-lg mt-1">{selectedEvent.title}</h3>
                {selectedEvent.preview && (
                  <p className="text-white/60 text-sm mt-2 leading-relaxed">{selectedEvent.preview}</p>
                )}
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs text-white/30">Added by {selectedEvent.contributor}</span>
                  <span className="text-xs text-[#e07a5f]">Were you there?</span>
                </div>
              </div>
            </div>

            {/* Who was there? */}
            <div className="px-6 py-4 border-t border-white/10">
              <label className="text-sm text-white/60 block mb-3">
                Who else was there? Tag them to spark more memories.
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newWitness}
                  onChange={(e) => setNewWitness(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addWitness()}
                  placeholder="Name (e.g., Aunt Susan)"
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30"
                />
                <button
                  onClick={addWitness}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white/70 text-sm hover:bg-white/20 transition-colors"
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

            {/* Invite method */}
            <div className="px-6 py-4 border-t border-white/10">
              <label className="text-sm text-white/60 block mb-3">
                How do you want to share?
              </label>
              <div className="flex gap-2">
                {(['link', 'email', 'sms'] as const).map((method) => (
                  <button
                    key={method}
                    onClick={() => setInviteMethod(method)}
                    className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                      inviteMethod === method
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {method === 'link' ? '🔗 Copy Link' : method === 'email' ? '📧 Email' : '💬 SMS'}
                  </button>
                ))}
              </div>

              {inviteMethod !== 'link' && (
                <input
                  type={inviteMethod === 'email' ? 'email' : 'tel'}
                  value={inviteContact}
                  onChange={(e) => setInviteContact(e.target.value)}
                  placeholder={inviteMethod === 'email' ? 'their@email.com' : 'Phone number'}
                  className="w-full mt-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30"
                />
              )}

              <textarea
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                placeholder="Add a personal note (optional)"
                rows={2}
                className="w-full mt-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
              />
            </div>

            {/* Send button */}
            <div className="px-6 py-4 border-t border-white/10">
              <button
                onClick={inviteMethod === 'link' ? copyShareLink : handleSendInvite}
                disabled={(inviteMethod !== 'link' && !inviteContact) || inviteSending}
                className={`w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  inviteSent
                    ? 'bg-green-600 text-white'
                    : 'bg-[#e07a5f] text-white hover:bg-[#d06a4f] disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {inviteSent ? (
                  <>
                    <span>✓</span>
                    <span>{inviteMethod === 'link' ? 'Link copied!' : 'Invite sent!'}</span>
                  </>
                ) : inviteSending ? (
                  <>
                    <span>Sending…</span>
                  </>
                ) : (
                  <>
                    <span>{inviteMethod === 'link' ? 'Copy share link' : 'Send invite'}</span>
                    <span>→</span>
                  </>
                )}
              </button>
              {inviteError && (
                <p className="text-xs text-red-300 text-left mt-2">{inviteError}</p>
              )}
              <p className="text-xs text-white/30 text-left mt-3">
                {witnesses.length > 0
                  ? `${witnesses.length} witness${witnesses.length > 1 ? 'es' : ''} will be tagged`
                  : 'Tag witnesses to start a memory cascade'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
