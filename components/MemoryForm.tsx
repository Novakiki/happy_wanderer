'use client';

import type { EntryType, PersonReference, ProvenanceData } from '@/lib/form-types';
import {
  DEFAULT_PROVENANCE,
  getDefaultProvenanceForEntryType,
  mapToLegacyPersonRole,
  provenanceToRecurrence,
  provenanceToSource,
  provenanceToWitnessType,
} from '@/lib/form-types';
import {
  buildTimingRawText,
  parseYear,
  parseYearFromDate,
  validateYearRange,
} from '@/lib/form-validation';
import { hasContent, stripHtml } from '@/lib/html-utils';
import { buildSmsLink } from '@/lib/invites';
import { getLintSuggestion } from '@/lib/lint-copy';
import { formStyles } from '@/lib/styles';
import {
  ENTRY_TYPE_DESCRIPTIONS,
  ENTRY_TYPE_LABELS,
  LIFE_STAGE_YEAR_RANGES,
  PERSON_ROLE_LABELS,
  THREAD_RELATIONSHIP_DESCRIPTIONS,
  THREAD_RELATIONSHIP_LABELS,
} from '@/lib/terminology';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimingMode } from './forms';
import { DisclosureSection, NoteContentSection, PeopleSection, ProvenanceSection, ReferencesSection, TimingModeSelector } from './forms';
import TrustRequestPanel from './TrustRequestPanel';

// Helper for lint warning styling in success screen
const lintTone = (severity?: 'soft' | 'strong') => ({
  message: severity === 'soft' ? formStyles.guidanceWarningMessageSoft : formStyles.guidanceWarningMessage,
  suggestion: severity === 'soft' ? formStyles.guidanceSuggestionSoft : formStyles.guidanceSuggestion,
});

type CreatedInvite = {
  id: string;
  name: string;
  phone: string;
};

type MentionCandidate = {
  name: string;
  mentionId: string;
  status: string;
};

type LintWarning = {
  code: string;
  message: string;
  suggestion?: string;
  severity?: 'soft' | 'strong';
  match?: string;
};

type UserProfile = {
  name: string;
  relation: string;
  email: string;
  contributorId: string;
  trusted?: boolean | null;
};

type RespondingToEvent = {
  id: string;
  title: string;
  preview: string | null;
  contributorName: string | null;
};

type Props = {
  respondingToEventId?: string;
  respondingToEvent?: RespondingToEvent | null;
  storytellerName?: string;
  userProfile: UserProfile;
  trustRequestStatus?: 'pending' | 'approved' | 'declined' | null;
};

type ThreadRelationship = keyof typeof THREAD_RELATIONSHIP_LABELS;

export default function MemoryForm({
  respondingToEventId,
  respondingToEvent,
  storytellerName,
  userProfile,
  trustRequestStatus,
}: Props) {
  const [formData, setFormData] = useState({
    entry_type: 'memory',
    exact_date: '',
    year: '',
    year_end: '',
    life_stage: '',
    is_approximate: true,
    timing_note: '',
    location: '',
    title: '',
    content: '',
    privacy_level: 'family',
    why_included: '',
  });

  // Provenance - single source of truth for "how do you know this?"
  const [provenance, setProvenance] = useState<ProvenanceData>(DEFAULT_PROVENANCE);

  // People references
  const [personRefs, setPersonRefs] = useState<PersonReference[]>([]);

  // Link references (external sources)
  const [linkRefs, setLinkRefs] = useState<{ displayName: string; url: string }[]>([]);

  // Invites created after submission (for "Text them" buttons)
  const [createdInvites, setCreatedInvites] = useState<CreatedInvite[]>([]);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);

  const [threadRelationship, setThreadRelationship] = useState<ThreadRelationship>('perspective');
  const [threadNote, setThreadNote] = useState('');


  // Timing mode: which method user chooses to enter timing (null = none selected yet)
  const [timingMode, setTimingMode] = useState<TimingMode>(null);

  // Show optional timing details (location, timing note)
  const [showTimingDetails, setShowTimingDetails] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showGuidanceWhy, setShowGuidanceWhy] = useState(false);
  const [showWhyMeaningful, setShowWhyMeaningful] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [, setLlmReviewMessage] = useState<string | null>(null);
  const [llmReviewReasons, setLlmReviewReasons] = useState<string[]>([]);
  const [lintWarnings, setLintWarnings] = useState<LintWarning[]>([]);
  const lintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lintAbortRef = useRef<AbortController | null>(null);
  const peopleSectionRef = useRef<HTMLDivElement>(null);
  const [peoplePulse, setPeoplePulse] = useState(false);

  const scrollToPeopleSection = useCallback(() => {
    peopleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setPeoplePulse(true);
    setTimeout(() => setPeoplePulse(false), 2000);
  }, []);

  useEffect(() => {
    if (isSubmitted) return;

    const rawText = stripHtml(formData.content || '').trim();
    if (rawText.length < 10) {
      setLintWarnings([]);
      return;
    }

    if (lintTimeoutRef.current) {
      clearTimeout(lintTimeoutRef.current);
    }

    lintTimeoutRef.current = setTimeout(async () => {
      if (lintAbortRef.current) {
        lintAbortRef.current.abort();
      }
      const controller = new AbortController();
      lintAbortRef.current = controller;

      try {
        const res = await fetch('/api/lint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: formData.content }),
          signal: controller.signal,
        });

        if (!res.ok) {
          return;
        }

        const result = await res.json().catch(() => ({}));
        setLintWarnings(Array.isArray(result?.lintWarnings) ? result.lintWarnings : []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.warn('Lint preview failed', err);
        }
      }
    }, 600);

    return () => {
      if (lintTimeoutRef.current) {
        clearTimeout(lintTimeoutRef.current);
      }
    };
  }, [formData.content, isSubmitted]);

  // Handle entry type change - update provenance default
  const handleEntryTypeChange = (newEntryType: string) => {
    setFormData({ ...formData, entry_type: newEntryType });
    // Set appropriate default provenance for this entry type
    setProvenance(getDefaultProvenanceForEntryType(newEntryType as EntryType));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLlmReviewMessage(null);
    setLlmReviewReasons([]);
    setLintWarnings([]);

    // Validate and derive year based on entry type and timing mode
    let year: number | null = null;
    let yearEnd: number | null = null;
    let timingInputType = 'year';

    // Milestone and Synchronicity always use exact date
    if (formData.entry_type === 'milestone' || formData.entry_type === 'origin') {
      if (!formData.exact_date) {
        setError('Please select a date.');
        return;
      }
      year = parseYearFromDate(formData.exact_date);
      timingInputType = 'date';
    }
    // Memory uses the timing mode cards
    else if (timingMode === null) {
      setError('Please choose how to place this memory in time.');
      return;
    } else if (timingMode === 'exact') {
      if (!formData.exact_date) {
        setError('Please select a date.');
        return;
      }
      year = parseYearFromDate(formData.exact_date);
      timingInputType = 'date';
    } else if (timingMode === 'year') {
      year = parseYear(formData.year);
      if (!year) {
        setError('Please enter a year.');
        return;
      }
      yearEnd = parseYear(formData.year_end);
      const rangeValidation = validateYearRange(year, yearEnd);
      if (!rangeValidation.valid) {
        setError(rangeValidation.error);
        return;
      }
      timingInputType = yearEnd ? 'year_range' : 'year';
    } else if (timingMode === 'chapter') {
      if (!formData.life_stage) {
        setError('Please select a chapter of her life.');
        return;
      }
      const stageRange = LIFE_STAGE_YEAR_RANGES[formData.life_stage as keyof typeof LIFE_STAGE_YEAR_RANGES];
      if (stageRange) {
        year = stageRange[0];
        yearEnd = stageRange[1];
      } else {
        // 'beyond' has null range - use current year
        year = new Date().getFullYear();
      }
      timingInputType = 'life_stage';
    }

    if (!year) {
      setError('Please provide timing information.');
      return;
    }

    // Require at least one reference for synchronicity/origin entries
    if (formData.entry_type === 'origin') {
      if (linkRefs.length === 0) {
        setError('Please add at least one reference (external link) for a synchronicity.');
        return;
      }
      // Require "the story behind it" for synchronicities
      if (!formData.why_included?.trim()) {
        setError('Please add the story behind this synchronicity—how you connected the dots.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Derive source_name and heard_from based on provenance data
      const derivedSource = provenanceToSource(provenance);
      const sourceName = derivedSource.source_name;
      const sourceUrl = derivedSource.source_url;
      let heardFrom = null;

      if (provenance.type === 'secondhand' && provenance.toldByName?.trim()) {
        const toldBy = provenance.toldByName.trim();
        const toldByRelationship = provenance.toldByRelationship?.trim();
        const toldByPhone = provenance.toldByPhone?.trim();
        heardFrom = {
          name: toldBy,
          relationship: toldByRelationship || '',
          phone: toldByPhone || '',
        };
      }

      const timingRawText = buildTimingRawText({
        timingInputType: timingInputType as 'date' | 'year' | 'year_range' | 'life_stage',
        exactDate: formData.exact_date,
        year: formData.year,
        yearEnd: formData.year_end,
        lifeStage: formData.life_stage,
      });

      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          year,
          year_end: yearEnd,
          timing_certainty: formData.is_approximate ? 'approximate' : 'exact',
          timing_input_type: timingInputType,
          timing_raw_text: timingRawText,
          witness_type: provenanceToWitnessType(provenance),
          recurrence: provenanceToRecurrence(provenance),
          source_name: sourceName,
          source_url: sourceUrl,
          heard_from: heardFrom,
          prompted_by_event_id: respondingToEventId || null,
          relationship: respondingToEventId ? threadRelationship : null,
          relationship_note: respondingToEventId ? threadNote.trim() : null,
          provenance_type: provenance.type,
          references: {
            links: linkRefs.map((l) => ({
              display_name: l.displayName,
              url: l.url,
            })),
            people: personRefs.map((p) => ({
              ...p,
              role: mapToLegacyPersonRole(p.role),
            })),
          },
          attachment_type: 'none',
          attachment_url: '',
          attachment_caption: '',
          // User profile from auth session
          contributor_id: userProfile.contributorId,
          submitter_name: userProfile.name,
          submitter_relationship: userProfile.relation,
          submitter_email: userProfile.email,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (Array.isArray(result?.lintWarnings)) {
          setLintWarnings(result.lintWarnings);
        }
        if (response.status === 422) {
          setLlmReviewMessage('LLM review blocked submission. Please address the issues below.');
          setLlmReviewReasons(result?.reasons || []);
          return;
        }
        setError(result?.error || 'Something went wrong. Please try again.');
        return;
      }

      if (result.invites && result.invites.length > 0) {
        setCreatedInvites(result.invites);
      }

      if (result.mentionCandidates && result.mentionCandidates.length > 0) {
        setMentionCandidates(result.mentionCandidates);
      }

      if (Array.isArray(result?.lintWarnings)) {
        setLintWarnings(result.lintWarnings);
      }

      setSubmittedStatus(result?.event?.status || null);
      setIsSubmitted(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const isTrusted = userProfile?.trusted === true;
    const statusMessage =
      submittedStatus === 'published'
        ? 'Your Note is now part of The Score.'
        : submittedStatus === 'pending'
          ? 'Your Note is pending review before it appears in The Score.'
          : 'Your Note has been added to The Score.';

    return (
      <div className="py-16 text-center text-white">
        <h1 className="text-3xl sm:text-4xl font-serif text-white mb-4">Thank you</h1>
        <p className="text-lg text-white/60 mb-12">
          {statusMessage}
        </p>

        {!isTrusted && (
          <div className="mb-8 max-w-lg mx-auto">
            <TrustRequestPanel
              isTrusted={isTrusted}
              status={trustRequestStatus || null}
            />
          </div>
        )}

        {/* Show "Text them" buttons if invites were created */}
        {createdInvites.length > 0 && (
          <div className="mb-8 p-5 rounded-2xl border border-white/10 bg-white/[0.07] text-left">
            <p className="text-sm font-medium text-white mb-3">
              Invite people you mentioned to add their perspective:
            </p>
            <div className="space-y-2">
              {createdInvites.map((invite) => {
                const smsUrl = buildSmsLink(invite.phone, invite.name, invite.id, baseUrl);
                return (
                  <a
                    key={invite.id}
                    href={smsUrl}
                    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-sm text-white">{invite.name}</span>
                    <span className="text-xs text-[#e07a5f] font-medium">Text them &rarr;</span>
                  </a>
                );
              })}
            </div>
            <p className="text-xs text-white/50 mt-3">
              Opens your messaging app. They can respond without logging in.
            </p>
          </div>
        )}

        {/* Identity guardian notice for pending names */}
        {mentionCandidates.length > 0 && (
          <div className="mb-8 p-5 rounded-2xl border border-amber-500/10 bg-white/[0.03] text-left max-w-lg mx-auto">
            <p className="text-sm font-medium text-white mb-2">
              Identity guardian: names are saved for review before they become people
            </p>
            <p className="text-sm text-white/50">
              {mentionCandidates.map((p) => p.name).join(', ')} stays private until you review it.
              Others will see &ldquo;someone&rdquo; unless you promote the name to a person.
            </p>
          </div>
        )}

        {lintWarnings.length > 0 && (
          <div className="mb-8 p-5 rounded-2xl border border-white/10 bg-white/[0.05] text-left max-w-lg mx-auto">
            <p className="text-sm font-medium text-white mb-2">
              Writing guidance (optional)
            </p>
            <p className="text-sm text-white/50 mb-3">
              These are gentle suggestions if you want to refine this note.
            </p>
            <p className="text-xs text-white/40 mb-3">
              Quoted text is the phrase we noticed.
            </p>
            <div className="space-y-3">
              {lintWarnings.map((warning, idx) => {
                const tone = lintTone(warning.severity);
                const suggestion = getLintSuggestion(warning.code, warning.suggestion, warning.message);
                return (
                  <div key={`${warning.code}-${idx}`} className="space-y-1">
                    <p className={tone.message}>
                    {warning.match && (
                      <span className="font-medium text-white/80">&ldquo;{warning.match}&rdquo;</span>
                    )}
                    {warning.match ? ' - ' : ''}
                    {warning.message}
                    </p>
                    {suggestion && (
                      <p className={tone.suggestion}>{suggestion}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setIsSubmitted(false);
            setCreatedInvites([]);
            setMentionCandidates([]);
            setLintWarnings([]);
            setFormData({
              entry_type: 'memory',
              exact_date: '',
              year: '',
              year_end: '',
              life_stage: '',
              is_approximate: true,
              timing_note: '',
              location: '',
              title: '',
              content: '',
              privacy_level: 'family',
              why_included: '',
            });
            setProvenance(DEFAULT_PROVENANCE);
            setPersonRefs([]);
            setLinkRefs([]);
            setTimingMode(null);
            setShowTimingDetails(false);
            setShowLocation(false);
            setThreadRelationship('perspective');
            setThreadNote('');
          }}
          className={formStyles.buttonPrimary}
        >
          Share Another Note
        </button>
        <div className="mt-4 flex justify-center">
          <Link href="/score" className={formStyles.buttonSecondary}>
            View The Score
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">
        Contributors
      </p>
      {respondingToEventId && storytellerName ? (
        <>
          <h1 className="text-3xl sm:text-4xl font-serif text-white mt-4">
            Add your link to the chain
          </h1>
          <p className="text-lg text-white/60 leading-relaxed mt-3">
            Someone has been carrying a story you told them. Now you can hold it
            yourself&mdash;tell it the way you remember it.
          </p>
        </>
      ) : respondingToEvent ? (
        <>
          <h1 className="text-3xl sm:text-4xl font-serif text-white mt-4">
            Your perspective on this moment
          </h1>
          <p className="text-lg text-white/60 leading-relaxed mt-3">
            Share how you remember this&mdash;your view adds depth to the story.
          </p>
          {/* Show the event being responded to */}
          <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/5">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">
              Responding to
            </p>
            <p className="text-white font-medium">{respondingToEvent.title}</p>
            {respondingToEvent.preview && (
              <p className="text-sm text-white/60 mt-1 line-clamp-2">
                {respondingToEvent.preview}
              </p>
            )}
            {respondingToEvent.contributorName && (
              <p className="text-xs text-white/40 mt-2">
                Added by {respondingToEvent.contributorName}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <h1 className="text-3xl sm:text-4xl font-serif text-white mt-4">
            Add to Valerie&apos;s score
          </h1>
          <p className="text-lg text-white/60 leading-relaxed mt-3">
            Share a memory, mark a milestone, or add a synchronicity when an
            outside pattern helps frame her story. Your voice helps her children
            learn her rhythm&mdash;how she moved through life, how she loved,
            how she noticed what mattered.
          </p>
        </>
      )}
      <form onSubmit={handleSubmit} className="mt-8 text-white">
      <div className="space-y-6">
        {/* Entry type - minimal, at top */}
        <div>
          <label htmlFor="entry_type" className={formStyles.label}>
            Entry type
          </label>
          <select
            id="entry_type"
            value={formData.entry_type}
            onChange={(e) => handleEntryTypeChange(e.target.value)}
            className={formStyles.select}
          >
            <option value="memory">{ENTRY_TYPE_LABELS.memory}</option>
            <option value="origin">{ENTRY_TYPE_LABELS.origin}</option>
          </select>
          <p className={formStyles.hint}>
            {ENTRY_TYPE_DESCRIPTIONS[formData.entry_type as keyof typeof ENTRY_TYPE_DESCRIPTIONS] || ENTRY_TYPE_DESCRIPTIONS.memory}
          </p>
        </div>

        {/* YOUR NOTE - the heart of what you're sharing */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5">
          <p className={formStyles.sectionLabel}>Your Note</p>
          <p className={`${formStyles.hint} mb-4`}>This appears on the timeline</p>

          <NoteContentSection
            title={formData.title}
            content={formData.content}
            whyIncluded={formData.why_included}
            entryType={formData.entry_type}
            onTitleChange={(val) => setFormData({ ...formData, title: val })}
            onContentChange={(val) => setFormData({ ...formData, content: val })}
            onWhyIncludedChange={(val) => setFormData({ ...formData, why_included: val })}
            lintWarnings={lintWarnings}
            showGuidanceWhy={showGuidanceWhy}
            onToggleGuidanceWhy={() => setShowGuidanceWhy(!showGuidanceWhy)}
            showWhyMeaningful={showWhyMeaningful}
            onToggleWhyMeaningful={setShowWhyMeaningful}
            testIdPrefix="share"
          />

          {/* Provenance - right after content for both memories and synchronicities */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <ProvenanceSection
              value={provenance}
              onChange={setProvenance}
              entryType={formData.entry_type as EntryType}
            />
          </div>

          {/* References - sources that support this note */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <ReferencesSection
              value={linkRefs}
              onChange={setLinkRefs}
              emptyMessage={
                formData.entry_type === 'origin'
                  ? 'Add links to articles, videos, or sources that document this synchronicity.'
                  : 'Add links to articles, photos, or documents that support this memory.'
              }
            />
          </div>
        </div>

        {/* WHEN & WHERE */}
        <div className={formStyles.section}>
          <p className={formStyles.sectionLabel}>When & Where</p>

          {/* Milestone & Synchronicity: just date picker */}
          {(formData.entry_type === 'milestone' || formData.entry_type === 'origin') && (
            <div>
              <label htmlFor="exact_date" className={formStyles.label}>
                Date <span className={formStyles.required}>*</span>
              </label>
              <input
                type="date"
                id="exact_date"
                value={formData.exact_date}
                onChange={(e) => {
                  const date = e.target.value;
                  const year = date ? date.split('-')[0] : '';
                  setFormData({ ...formData, exact_date: date, year, is_approximate: false });
                }}
                className={formStyles.input}
                required
              />
            </div>
          )}

          {/* Memory: show timing mode cards */}
          {formData.entry_type === 'memory' && (
            <>
              <p className={`${formStyles.hint} mb-4`}>Choose one way to place this memory in time <span className={formStyles.required}>*</span></p>

              <TimingModeSelector
                mode={timingMode}
                onModeChange={(mode) => {
                  setTimingMode(mode);
                  setFormData({ ...formData, is_approximate: mode !== 'exact' });
                }}
                data={{
                  exactDate: formData.exact_date,
                  year: formData.year,
                  yearEnd: formData.year_end,
                  lifeStage: formData.life_stage,
                }}
                onDataChange={(field, value) => {
                  if (field === 'exactDate') {
                    const date = value as string;
                    const year = date ? date.split('-')[0] : '';
                    setFormData({ ...formData, exact_date: date, year });
                  } else if (field === 'year') {
                    setFormData({ ...formData, year: value?.toString() ?? '' });
                  } else if (field === 'yearEnd') {
                    setFormData({ ...formData, year_end: value?.toString() ?? '' });
                  } else if (field === 'lifeStage') {
                    setFormData({ ...formData, life_stage: value as string });
                  }
                }}
              />
            </>
          )}

          {/* Optional timing details */}
          <div className="flex flex-col items-start gap-3 mt-6">
            <DisclosureSection
              label="Timing note"
              isOpen={showTimingDetails}
              onToggle={setShowTimingDetails}
              hasContent={!!formData.timing_note}
              onClear={() => setFormData({ ...formData, timing_note: '' })}
            >
              <input
                type="text"
                id="timing_note"
                value={formData.timing_note}
                onChange={(e) => setFormData({ ...formData, timing_note: e.target.value })}
                placeholder="e.g., Summer before college, around Christmas"
                className={formStyles.input}
              />
            </DisclosureSection>

            <DisclosureSection
              label="Location"
              isOpen={showLocation}
              onToggle={setShowLocation}
              hasContent={!!formData.location}
              onClear={() => setFormData({ ...formData, location: '' })}
            >
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Riverton, UT or Anchorage, AK"
                className={formStyles.input}
              />
            </DisclosureSection>
          </div>
        </div>

        {/* Connection to the original note - simplified for perspectives */}
        {respondingToEventId && (
          <div className={formStyles.section}>
            <p className={formStyles.sectionLabel}>Your perspective</p>
            <div>
              <label htmlFor="thread_note" className={formStyles.label}>
                What&apos;s different about your view? (optional)
              </label>
              <textarea
                id="thread_note"
                rows={2}
                value={threadNote}
                onChange={(e) => setThreadNote(e.target.value)}
                placeholder="e.g., I remember this differently... / From where I was standing..."
                className={formStyles.textarea}
              />
              <p className={formStyles.hint}>
                A short note about how your memory differs or what you noticed.
              </p>
            </div>
          </div>
        )}


        {/* PEOPLE - show for memories and milestones */}
        {(formData.entry_type === 'memory' || formData.entry_type === 'milestone') && (
          <div
            ref={peopleSectionRef}
            className={`${formStyles.section} border bg-white/[0.05] transition-all duration-300 ${
              peoplePulse
                ? 'border-[#e07a5f] shadow-[0_0_20px_-5px_rgba(224,122,95,0.5)] animate-pulse-subtle'
                : llmReviewReasons.length > 0
                  ? 'border-[#e07a5f]/60'
                  : 'border-[#e07a5f]/40'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className={`${formStyles.sectionLabel} text-[#e07a5f]`}>People</p>
              <span className="text-xs text-white/60">Add & invite others here</span>
            </div>
            <PeopleSection
              value={personRefs}
              onChange={setPersonRefs}
              mode="inline"
            />
          </div>
        )}

        {/* Review notice */}
        <div className="p-5 rounded-2xl border border-white/5 bg-white/[0.03] text-left">
          <p className="text-sm font-medium text-white mb-2">
            Notes from new contributors are reviewed before they go live
          </p>
          <div className="mt-3 pt-3 border-t border-white/10 text-white/60 space-y-3">
            <p className="text-sm">
              We look for private info that shouldn&rsquo;t be public and flag anything that needs a second look. We will let you know if a revision is needed.
            </p>
            {llmReviewReasons.length > 0 && (
              <div className="text-sm space-y-3 p-4 rounded-xl border border-[#e07a5f]/40 bg-[#e07a5f]/10 text-white/80">
                <p className="font-medium text-white">Our review blocked submission. Please address the items below.</p>
                {llmReviewReasons.map((r, idx) => {
                  const needsConsent = r.toLowerCase().includes('consent') || r.toLowerCase().includes('named person');
                  const suggestion = needsConsent
                    ? 'Remove the name for now—use "someone" or no name. Best next step: add them in People and invite them so they can choose how to appear.'
                    : null;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="font-medium">{r}</div>
                      {suggestion && <div className="text-xs text-white/70">{suggestion}</div>}
                      {needsConsent && (
                        <button
                          type="button"
                          onClick={scrollToPeopleSection}
                          className="mt-2 text-[#e07a5f] text-sm underline underline-offset-4 hover:text-[#e07a5f]/80 transition-colors"
                        >
                          Go to People section &uarr;
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Invitation summary - consolidated view of all invites */}
        {(() => {
          const pendingInvites: { name: string; role: string; source: 'provenance' | 'people' }[] = [];

          // From provenance (someone told me)
          if (provenance.type === 'secondhand' && provenance.toldByPhone?.trim() && provenance.toldByName?.trim()) {
            pendingInvites.push({
              name: provenance.toldByName.trim(),
              role: 'told you this story',
              source: 'provenance',
            });
          }

          // From People section
          personRefs.forEach((person) => {
            if (person.phone?.trim() && person.name?.trim()) {
              const roleLabel = PERSON_ROLE_LABELS[person.role as keyof typeof PERSON_ROLE_LABELS] || 'witness';
              pendingInvites.push({
                name: person.name.trim(),
                role: roleLabel.toLowerCase(),
                source: 'people',
              });
            }
          });

          if (pendingInvites.length === 0) return null;

          return (
            <div className="p-4 rounded-xl border border-[#e07a5f]/30 bg-[#e07a5f]/5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📨</span>
                <span className="text-sm font-medium text-white">
                  Inviting {pendingInvites.length} {pendingInvites.length === 1 ? 'person' : 'people'}
                </span>
              </div>
              <ul className="space-y-1">
                {pendingInvites.map((invite, idx) => (
                  <li key={`${invite.source}-${idx}`} className="text-sm text-white/70">
                    <span className="text-white">{invite.name}</span>
                    <span className="text-white/50"> ({invite.role})</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-white/40 mt-3">
                They&apos;ll get a text to add their own memories after you submit.
              </p>
            </div>
          );
        })()}

        {error && (
          <p className={formStyles.error}>{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !hasContent(formData.content)}
          className={formStyles.buttonPrimaryFull}
          data-testid="share-submit"
        >
          {isSubmitting ? 'Adding...' : 'Add This Memory'}
        </button>
      </div>
      </form>
    </>
  );
}
