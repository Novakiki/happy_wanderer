'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formStyles } from '@/lib/styles';
import RichTextEditor from '@/components/RichTextEditor';

// =============================================================================
// Types
// =============================================================================

type Signal = {
  id: string;
  label: string;
  definition: string | null;
  score?: number;
  should_confirm?: boolean;
};

type PersonRow = {
  name: string;
  relationship?: string;
};

type EntryMode = 'signal_first' | 'fragment_first';

type WitnessType = 'firsthand' | 'secondhand' | 'inferred' | 'unsure';

// =============================================================================
// Constants
// =============================================================================

const SEED_SIGNAL_LABELS = [
  'her humor',
  'how she decided',
  'what she noticed',
  'how she corrected',
  'how she welcomed',
  'what she returned to',
  'how ordinary moments changed around her',
];

const CONFIRM_THRESHOLD = 0.5;
const MIN_SHOW_SCORE = 0.1;
const SUGGEST_LIMIT = 8;

const WITNESS_OPTIONS: { value: WitnessType; label: string }[] = [
  { value: 'firsthand', label: 'I was there' },
  { value: 'secondhand', label: 'Someone told me' },
  { value: 'inferred', label: 'I pieced it together' },
  { value: 'unsure', label: 'Not sure' },
];

// =============================================================================
// Component
// =============================================================================

type Props = {
  contributorId: string;
};

export default function FragmentCaptureForm({ contributorId }: Props) {
  const supabase = createClient();

  // Entry mode
  const [entryMode, setEntryMode] = useState<EntryMode>('signal_first');

  // Signals loaded from DB
  const [signals, setSignals] = useState<Signal[]>([]);
  const [selectedSignalIds, setSelectedSignalIds] = useState<string[]>([]);

  // Freeform "something else"
  const [freeformSignal, setFreeformSignal] = useState('');
  const [freeformKept, setFreeformKept] = useState(false);

  // Suggestions / confirm
  const [suggestions, setSuggestions] = useState<Signal[]>([]);
  const [confirmCandidate, setConfirmCandidate] = useState<Signal | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fragment content
  const [content, setContent] = useState('');

  // Optional details
  const [showOptional, setShowOptional] = useState(false);
  const [timeAnchor, setTimeAnchor] = useState('');
  const [witnessType, setWitnessType] = useState<WitnessType | ''>('');
  const [people, setPeople] = useState<PersonRow[]>([]);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Post-submit prompt for fragment-first
  const [postSubmitEventId, setPostSubmitEventId] = useState<string | null>(null);
  const [showPostSubmitPrompt, setShowPostSubmitPrompt] = useState(false);

  // Debounce ref for suggestions
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Load seed signals from DB
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const { data, error: fetchError } = await supabase
        .from('motifs')
        .select('id, label, definition, status')
        .in('label', SEED_SIGNAL_LABELS)
        .eq('status', 'active');

      if (fetchError) {
        console.error('Failed to load signals:', fetchError);
        return;
      }

      setSignals(
        (data ?? []).map((row) => ({
          id: row.id,
          label: row.label,
          definition: row.definition,
        }))
      );
    })();
  }, [supabase]);

  // ---------------------------------------------------------------------------
  // Toggle signal selection
  // ---------------------------------------------------------------------------
  const toggleSignal = useCallback((id: string) => {
    setSelectedSignalIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Freeform signal suggestions (debounced)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const q = freeformSignal.trim();
    setFreeformKept(false);

    if (q.length < 3) {
      setSuggestions([]);
      setConfirmCandidate(null);
      setShowConfirm(false);
      return;
    }

    if (suggestTimeoutRef.current) {
      clearTimeout(suggestTimeoutRef.current);
    }

    suggestTimeoutRef.current = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc('search_motifs', {
        q,
        lim: SUGGEST_LIMIT,
        min_show_score: MIN_SHOW_SCORE,
        confirm_threshold: CONFIRM_THRESHOLD,
      });

      if (rpcError) {
        console.error('search_motifs failed:', rpcError);
        return;
      }

      const results: Signal[] = (data ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        definition: row.definition,
        score: row.score,
        should_confirm: row.should_confirm,
      }));

      setSuggestions(results);

      // Confirm candidate: best match above threshold
      if (results.length > 0 && results[0].should_confirm) {
        setConfirmCandidate(results[0]);
        setShowConfirm(true);
      } else {
        setConfirmCandidate(null);
        setShowConfirm(false);
      }
    }, 200);

    return () => {
      if (suggestTimeoutRef.current) {
        clearTimeout(suggestTimeoutRef.current);
      }
    };
  }, [freeformSignal, supabase]);

  // ---------------------------------------------------------------------------
  // Suggestion handlers
  // ---------------------------------------------------------------------------
  const chooseSuggestedSignal = useCallback(
    (signal: Signal) => {
      setFreeformSignal('');
      setFreeformKept(false);
      setShowConfirm(false);
      setConfirmCandidate(null);
      setSuggestions([]);
      toggleSignal(signal.id);
    },
    [toggleSignal]
  );

  const keepFreeform = useCallback(() => {
    setFreeformKept(true);
    setShowConfirm(false);
  }, []);

  const useConfirmCandidate = useCallback(() => {
    if (confirmCandidate) {
      chooseSuggestedSignal(confirmCandidate);
    }
  }, [confirmCandidate, chooseSuggestedSignal]);

  // ---------------------------------------------------------------------------
  // People quick-add
  // ---------------------------------------------------------------------------
  const addPersonRow = useCallback(() => {
    setPeople((prev) => [...prev, { name: '', relationship: '' }]);
  }, []);

  const updatePersonName = useCallback((idx: number, name: string) => {
    setPeople((prev) => prev.map((p, i) => (i === idx ? { ...p, name } : p)));
  }, []);

  const updatePersonRelationship = useCallback((idx: number, relationship: string) => {
    setPeople((prev) => prev.map((p, i) => (i === idx ? { ...p, relationship } : p)));
  }, []);

  const removePersonRow = useCallback((idx: number) => {
    setPeople((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ---------------------------------------------------------------------------
  // Reset form
  // ---------------------------------------------------------------------------
  const resetForm = useCallback(() => {
    setSelectedSignalIds([]);
    setFreeformSignal('');
    setFreeformKept(false);
    setSuggestions([]);
    setConfirmCandidate(null);
    setShowConfirm(false);
    setContent('');
    setShowOptional(false);
    setTimeAnchor('');
    setWitnessType('');
    setPeople([]);
    setEntryMode('signal_first');
  }, []);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const submit = useCallback(
    async (mode: EntryMode) => {
      setError(null);
      setIsSubmitting(true);

      try {
        // Validate content
        const plainText = content.replace(/<[^>]*>/g, '').trim();
        if (plainText.length === 0) {
          throw new Error('Please add a few words before submitting.');
        }

        const hasSignals = selectedSignalIds.length > 0;

        // Build people_involved array
        const peopleInvolved = people
          .filter((p) => p.name.trim())
          .map((p) => {
            const name = p.name.trim();
            const rel = p.relationship?.trim();
            return rel ? `${name} (${rel})` : name;
          });

        // Generate a title from content (first ~50 chars, no HTML)
        const titlePreview = plainText.slice(0, 50).trim() || '(fragment)';

        // Insert timeline_events row
        const { data: eventData, error: eventError } = await supabase
          .from('timeline_events')
          .insert({
            type: 'memory',
            title: titlePreview,
            year: new Date().getFullYear(),
            preview: null,
            full_entry: content,
            witness_type: witnessType || null,
            timing_raw_text: timeAnchor || null,
            people_involved: peopleInvolved,
            status: 'active',
            contributor_id: contributorId,
            needs_signal_assignment: !hasSignals,
            entry_mode: mode,
          })
          .select('id')
          .single();

        if (eventError) throw eventError;
        const eventId = eventData.id;

        // Insert motif_links
        if (hasSignals) {
          const linkRows = selectedSignalIds.map((motif_id) => ({
            motif_id,
            note_id: eventId,
            link_type: 'expresses' as const,
          }));

          const { error: linkError } = await supabase.from('motif_links').insert(linkRows);
          if (linkError) throw linkError;
        }

        // Insert signal_suggestions for freeform "something else"
        const ff = freeformSignal.trim();
        if (ff.length >= 1 && freeformKept) {
          const { error: ssError } = await supabase.from('signal_suggestions').insert({
            event_id: eventId,
            text: ff,
          });
          if (ssError) throw ssError;
        }

        // Post-submit prompt for fragment-first
        if (mode === 'fragment_first') {
          setPostSubmitEventId(eventId);
          setShowPostSubmitPrompt(true);
        } else {
          setIsSubmitted(true);
          resetForm();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        console.error(err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      content,
      selectedSignalIds,
      people,
      witnessType,
      timeAnchor,
      freeformSignal,
      freeformKept,
      contributorId,
      supabase,
      resetForm,
    ]
  );

  // ---------------------------------------------------------------------------
  // Post-submit signal addition
  // ---------------------------------------------------------------------------
  const postSubmitAddSignals = useCallback(
    async (signalIds: string[]) => {
      if (!postSubmitEventId) return;

      setIsSubmitting(true);
      setError(null);

      try {
        if (signalIds.length > 0) {
          const linkRows = signalIds.map((motif_id) => ({
            motif_id,
            note_id: postSubmitEventId,
            link_type: 'expresses' as const,
          }));

          const { error: linkError } = await supabase.from('motif_links').insert(linkRows);
          if (linkError) throw linkError;

          const { error: updateError } = await supabase
            .from('timeline_events')
            .update({ needs_signal_assignment: false })
            .eq('id', postSubmitEventId);
          if (updateError) throw updateError;
        }

        setShowPostSubmitPrompt(false);
        setPostSubmitEventId(null);
        setIsSubmitted(true);
        resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        console.error(err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [postSubmitEventId, supabase, resetForm]
  );

  const dismissPostSubmitPrompt = useCallback(() => {
    setShowPostSubmitPrompt(false);
    setPostSubmitEventId(null);
    setIsSubmitted(true);
    resetForm();
  }, [resetForm]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const tooManySelected = selectedSignalIds.length > 4;
  const hasContent = content.replace(/<[^>]*>/g, '').trim().length > 0;

  // ---------------------------------------------------------------------------
  // Success screen
  // ---------------------------------------------------------------------------
  if (isSubmitted) {
    return (
      <div className="py-16 text-center text-white">
        <h1 className="text-3xl sm:text-4xl font-serif text-white mb-4">Thank you</h1>
        <p className="text-lg text-white/60 mb-12">
          Your fragment has been added.
        </p>
        <button
          onClick={() => {
            setIsSubmitted(false);
            resetForm();
          }}
          className={formStyles.buttonPrimary}
        >
          Share Another Fragment
        </button>
        <div className="mt-4 flex justify-center">
          <Link href="/score" className={formStyles.buttonSecondary}>
            View The Score
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main form
  // ---------------------------------------------------------------------------
  return (
    <>
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">
        Contributors
      </p>
      <h1 className="text-3xl sm:text-4xl font-serif text-white mt-4">
        Share a fragment
      </h1>
      <p className="text-lg text-white/60 leading-relaxed mt-3">
        A moment, a pattern, something she said, something you noticed.
        These fragments help her presence reappear.
      </p>

      <div className="mt-8 text-white space-y-6">
        {/* Entry mode selector */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setEntryMode('signal_first')}
            className={`px-4 py-2 rounded-full border transition-all duration-200 ${
              entryMode === 'signal_first'
                ? 'border-white/40 bg-white/10 text-white'
                : 'border-white/10 bg-transparent text-white/60 hover:border-white/20'
            }`}
          >
            Start with what you recognized
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('fragment_first')}
            className={`px-4 py-2 rounded-full border transition-all duration-200 ${
              entryMode === 'fragment_first'
                ? 'border-white/40 bg-white/10 text-white'
                : 'border-white/10 bg-transparent text-white/60 hover:border-white/20'
            }`}
          >
            I&apos;m not sure&mdash;let me just write
          </button>
        </div>

        {/* Signal selection (signal-first mode) */}
        {entryMode === 'signal_first' && (
          <div className={formStyles.section}>
            <p className={formStyles.sectionLabel}>What did you recognize in her here?</p>
            <p className={`${formStyles.hint} mb-4`}>Select the patterns this fragment shows</p>

            {/* Signal chips */}
            <div className="flex flex-wrap gap-2">
              {signals.map((signal) => {
                const selected = selectedSignalIds.includes(signal.id);
                return (
                  <button
                    key={signal.id}
                    type="button"
                    onClick={() => toggleSignal(signal.id)}
                    title={signal.definition ?? ''}
                    className={`px-4 py-2 rounded-full border transition-all duration-200 ${
                      selected
                        ? 'border-[#e07a5f] bg-[#e07a5f]/20 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {signal.label}
                  </button>
                );
              })}

              {/* Something else button */}
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('freeform-signal-input');
                  if (input) input.focus();
                }}
                className="px-4 py-2 rounded-full border border-dashed border-white/20 bg-transparent text-white/50 hover:border-white/30 hover:text-white/70 transition-all duration-200"
              >
                something else
              </button>
            </div>

            {/* Too many selected warning */}
            {tooManySelected && (
              <p className={`${formStyles.hint} mt-3 text-amber-400/70`}>
                That&apos;s a lot&mdash;sure they all apply?
              </p>
            )}

            {/* Freeform signal input */}
            <div className="mt-4">
              <input
                id="freeform-signal-input"
                type="text"
                value={freeformSignal}
                onChange={(e) => setFreeformSignal(e.target.value)}
                placeholder="Name it in your words..."
                className={formStyles.input}
              />

              {/* Near-duplicate confirm */}
              {showConfirm && confirmCandidate && (
                <div className="mt-3 p-4 rounded-xl border border-white/10 bg-white/5 animate-slide-down">
                  <p className="text-sm text-white/80 mb-3">
                    This sounds like <strong className="text-white">{confirmCandidate.label}</strong>&mdash;did you mean that?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={useConfirmCandidate}
                      className={formStyles.buttonPrimary}
                    >
                      Use existing
                    </button>
                    <button
                      type="button"
                      onClick={keepFreeform}
                      className={formStyles.buttonSecondary}
                    >
                      Keep my wording
                    </button>
                  </div>
                </div>
              )}

              {/* Suggestions list */}
              {suggestions.length > 0 && !showConfirm && (
                <div className="mt-3">
                  <p className={`${formStyles.hint} mb-2`}>Did you mean one of these?</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => chooseSuggestedSignal(s)}
                        title={s.definition ?? ''}
                        className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/70 text-sm hover:border-white/20 hover:text-white transition-all duration-200"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Freeform kept indicator */}
              {freeformKept && freeformSignal.trim() && (
                <p className={`${formStyles.hint} mt-2 text-[#e07a5f]`}>
                  Your wording will be saved for review.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Fragment content */}
        <div className={formStyles.section}>
          <p className={formStyles.sectionLabel}>
            {entryMode === 'signal_first' ? 'Tell us about it' : 'Share your fragment'}
          </p>
          <p className={`${formStyles.hint} mb-3`}>
            A moment, a pattern, something she said, something you noticed.
          </p>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="A moment, a pattern, something she said, something you noticed..."
            minHeight="140px"
            dataTestId="fragment-content"
          />
          <p className={`${formStyles.hint} mt-2`}>
            No title needed. Just the fragment.
          </p>
        </div>

        {/* Optional details */}
        <div>
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className={formStyles.disclosureButton}
          >
            <span
              className={`${formStyles.disclosureChevron} ${showOptional ? formStyles.disclosureChevronOpen : ''}`}
            >
              &#9654;
            </span>
            Add details (optional)
          </button>

          {showOptional && (
            <div className={`mt-4 ${formStyles.section} ${formStyles.disclosureContent}`}>
              {/* Time anchor */}
              <div className="mb-4">
                <label className={formStyles.label}>When was this, roughly?</label>
                <input
                  type="text"
                  value={timeAnchor}
                  onChange={(e) => setTimeAnchor(e.target.value)}
                  placeholder="summer 1987, when I was a kid, late 70s..."
                  className={formStyles.input}
                />
              </div>

              {/* Witness type */}
              <div className="mb-4">
                <label className={formStyles.label}>How do you know this?</label>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                  {WITNESS_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="radio"
                        name="witness_type"
                        value={opt.value}
                        checked={witnessType === opt.value}
                        onChange={() => setWitnessType(opt.value)}
                        className={formStyles.checkbox}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* People quick-add */}
              <div>
                <label className={formStyles.label}>Who else is in this? (besides Val)</label>
                {people.map((person, idx) => (
                  <div key={idx} className="flex gap-2 mt-2">
                    <input
                      type="text"
                      value={person.name}
                      onChange={(e) => updatePersonName(idx, e.target.value)}
                      placeholder="Name"
                      className={`${formStyles.inputSmall} flex-1`}
                    />
                    <input
                      type="text"
                      value={person.relationship ?? ''}
                      onChange={(e) => updatePersonRelationship(idx, e.target.value)}
                      placeholder="Relationship (optional)"
                      className={`${formStyles.inputSmall} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => removePersonRow(idx)}
                      className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-white/50 hover:text-white hover:border-white/20 transition-all duration-200"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPersonRow}
                  className={`${formStyles.buttonSecondary} mt-3`}
                >
                  Add person
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && <p className={formStyles.error}>{error}</p>}

        {/* Submit */}
        <button
          type="button"
          onClick={() => submit(entryMode)}
          disabled={isSubmitting || !hasContent}
          className={formStyles.buttonPrimaryFull}
          data-testid="fragment-submit"
        >
          {isSubmitting ? 'Saving...' : 'Submit'}
        </button>
      </div>

      {/* Post-submit signal prompt (fragment-first only) */}
      {showPostSubmitPrompt && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"
          onClick={dismissPostSubmitPrompt}
        >
          <div
            className="w-full max-w-xl bg-[#0b0b0b] border border-white/10 rounded-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="text-xl font-serif text-white">
                Thanks. Before you go&mdash;what does this show about her?
              </h2>
              <button
                type="button"
                onClick={dismissPostSubmitPrompt}
                className="text-white/50 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {signals.map((signal) => {
                const selected = selectedSignalIds.includes(signal.id);
                return (
                  <button
                    key={signal.id}
                    type="button"
                    onClick={() => toggleSignal(signal.id)}
                    className={`px-4 py-2 rounded-full border transition-all duration-200 ${
                      selected
                        ? 'border-[#e07a5f] bg-[#e07a5f]/20 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {signal.label}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={dismissPostSubmitPrompt}
                className={formStyles.buttonSecondary}
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={() => postSubmitAddSignals(selectedSignalIds)}
                disabled={isSubmitting || selectedSignalIds.length === 0}
                className={formStyles.buttonPrimary}
              >
                {isSubmitting ? 'Saving...' : 'Add signals'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
