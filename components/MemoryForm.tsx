'use client';

import type { PersonReference, ProvenanceData } from '@/lib/form-types';
import {
  DEFAULT_PROVENANCE,
  mapToLegacyPersonRole,
  provenanceToSource,
} from '@/lib/form-types';
import { parseYear, parseYearFromDate, validateYearRange } from '@/lib/form-validation';
import { buildSmsLink } from '@/lib/invites';
import { formStyles } from '@/lib/styles';
import {
  ENTRY_TYPE_CONTENT_LABELS,
  ENTRY_TYPE_DESCRIPTIONS,
  ENTRY_TYPE_LABELS,
  LIFE_STAGE_YEAR_RANGES,
  THREAD_RELATIONSHIP_DESCRIPTIONS,
  THREAD_RELATIONSHIP_LABELS,
} from '@/lib/terminology';
import { useState } from 'react';
import { DisclosureSection, PeopleSection, ProvenanceSection, TimingModeSelector } from './forms';
import RichTextEditor from './RichTextEditor';
import type { TimingMode } from './forms';
import { hasContent } from '@/lib/html-utils';

type CreatedInvite = {
  id: string;
  name: string;
  phone: string;
};

type UserProfile = {
  name: string;
  relation: string;
  email: string;
  contributorId: string;
};

type Props = {
  respondingToEventId?: string;
  storytellerName?: string;
  userProfile: UserProfile;
};

type ThreadRelationship = keyof typeof THREAD_RELATIONSHIP_LABELS;

export default function MemoryForm({ respondingToEventId, storytellerName, userProfile }: Props) {
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
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [showLinks, setShowLinks] = useState(false);

  // Invites created after submission (for "Text them" buttons)
  const [createdInvites, setCreatedInvites] = useState<CreatedInvite[]>([]);

  const [threadRelationship, setThreadRelationship] = useState<ThreadRelationship>('perspective');
  const [threadNote, setThreadNote] = useState('');

  // Attachment (collapsed by default)
  const [showAttachment, setShowAttachment] = useState(false);
  const [attachment, setAttachment] = useState({
    type: 'image' as 'image' | 'audio',
    url: '',
    caption: '',
  });

  // Timing mode: which method user chooses to enter timing (null = none selected yet)
  const [timingMode, setTimingMode] = useState<TimingMode>(null);

  // Show optional timing details (location, timing note)
  const [showTimingDetails, setShowTimingDetails] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showWhyMeaningful, setShowWhyMeaningful] = useState(false);
  const [showPeople, setShowPeople] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const addLinkRef = () => {
    const url = newLinkUrl.trim();
    const name = newLinkName.trim();
    if (url && name) {
      setLinkRefs([...linkRefs, { displayName: name, url }]);
      setNewLinkName('');
      setNewLinkUrl('');
    }
  };

  const removeLinkRef = (index: number) => {
    setLinkRefs(linkRefs.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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

    // Require an attachment for synchronicity/origin entries
    if (formData.entry_type === 'origin') {
      const hasAttachment = attachment.url.trim().length > 0;
      const hasLinkRefs = linkRefs.length > 0;
      if (!hasAttachment && !hasLinkRefs) {
        setShowAttachment(true);
        setError('Please add an attachment (image/audio) or an external link for a synchronicity.');
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
        heardFrom = { name: toldBy, relationship: '', email: '', shouldInvite: false };
      }

      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          year,
          year_end: yearEnd,
          timing_certainty: formData.is_approximate ? 'approximate' : 'exact',
          timing_input_type: timingInputType,
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
          attachment_type: showAttachment && attachment.url.trim() ? attachment.type : 'none',
          attachment_url: showAttachment ? attachment.url : '',
          attachment_caption: showAttachment ? attachment.caption : '',
          // User profile from auth session
          contributor_id: userProfile.contributorId,
          submitter_name: userProfile.name,
          submitter_relationship: userProfile.relation,
          submitter_email: userProfile.email,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit memory');
      }

      const result = await response.json();
      if (result.invites && result.invites.length > 0) {
        setCreatedInvites(result.invites);
      }

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

    return (
      <div className="py-16 text-center text-white">
        <h1 className="text-3xl sm:text-4xl font-serif text-white mb-4">Thank you</h1>
        <p className="text-lg text-white/60 mb-8">
          Your memory has been added to the score.
        </p>

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
                    <span className="text-xs text-[#e07a5f] font-medium">Text them →</span>
                  </a>
                );
              })}
            </div>
            <p className="text-xs text-white/40 mt-3">
              Opens your messaging app. They can respond without logging in.
            </p>
          </div>
        )}

        <button
          onClick={() => {
            setIsSubmitted(false);
            setCreatedInvites([]);
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
            setShowLinks(false);
            setTimingMode(null);
            setShowTimingDetails(false);
            setShowLocation(false);
            setShowWhyMeaningful(false);
            setShowAttachment(false);
            setAttachment({ type: 'image', url: '', caption: '' });
            setThreadRelationship('perspective');
            setThreadNote('');
          }}
          className={formStyles.buttonPrimary}
        >
          Share Another Memory
        </button>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs uppercase tracking-[0.3em] text-white/40">
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
            onChange={(e) => setFormData({ ...formData, entry_type: e.target.value })}
            className={formStyles.select}
          >
            <option value="memory">{ENTRY_TYPE_LABELS.memory}</option>
            <option value="milestone">{ENTRY_TYPE_LABELS.milestone}</option>
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

          <div className="space-y-4">
            <div>
              <label htmlFor="title" className={formStyles.label}>
                Title <span className={formStyles.required}>*</span>
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Thanksgiving laughter"
                className={formStyles.input}
                required
              />
            </div>

            <div>
              <label className={formStyles.label}>
                {ENTRY_TYPE_CONTENT_LABELS[formData.entry_type as keyof typeof ENTRY_TYPE_CONTENT_LABELS] || 'The memory'} <span className={formStyles.required}>*</span>
              </label>
              <RichTextEditor
                value={formData.content}
                onChange={(val) => setFormData({ ...formData, content: val })}
                placeholder="Share a story, a moment, or a note..."
                minHeight="120px"
              />
            </div>

            <DisclosureSection
              label="Why it's meaningful"
              addLabel="Add why it's meaningful"
              isOpen={showWhyMeaningful}
              onToggle={setShowWhyMeaningful}
              hasContent={hasContent(formData.why_included)}
              onClear={() => setFormData({ ...formData, why_included: '' })}
            >
              <p className={formStyles.hint}>
                Appears as an italic quote beneath your note
              </p>
              <RichTextEditor
                value={formData.why_included}
                onChange={(val) => setFormData({ ...formData, why_included: val })}
                placeholder="What it shows about her, why it matters to you..."
                minHeight="80px"
              />
            </DisclosureSection>
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

        {/* Connection to the original note */}
        {respondingToEventId && (
          <div className={formStyles.section}>
            <p className={formStyles.sectionLabel}>Connection</p>
            <div className="space-y-4">
              <div>
                <label htmlFor="thread_relationship" className={formStyles.label}>
                  How does your note connect?
                </label>
                <select
                  id="thread_relationship"
                  value={threadRelationship}
                  onChange={(e) => setThreadRelationship(e.target.value as ThreadRelationship)}
                  className={formStyles.select}
                >
                  {Object.entries(THREAD_RELATIONSHIP_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className={formStyles.hint}>
                  {THREAD_RELATIONSHIP_DESCRIPTIONS[threadRelationship]}
                </p>
              </div>
              <div>
                <label htmlFor="thread_note" className={formStyles.label}>
                  Short note (optional)
                </label>
                <textarea
                  id="thread_note"
                  rows={2}
                  value={threadNote}
                  onChange={(e) => setThreadNote(e.target.value)}
                  placeholder="e.g., I remember this in 1989, not 1990"
                  className={formStyles.textarea}
                />
                <p className={formStyles.hint}>
                  This appears with the link between notes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* THE CHAIN - provenance and social connections */}
        <div className={formStyles.section}>
          <p className={formStyles.sectionLabel}>The Chain</p>
          <p className={`${formStyles.hint} mb-4`}>These fields help keep memories connected without turning them into a single official story.</p>

          <div className="mb-6">
            <ProvenanceSection
              value={provenance}
              onChange={setProvenance}
              required
            />
          </div>

          {!showPeople && personRefs.length === 0 ? (
            <button
              type="button"
              onClick={() => setShowPeople(true)}
              className={formStyles.buttonGhost}
            >
              <span className={formStyles.disclosureArrow}>&#9654;</span>
              Add who was there
            </button>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className={formStyles.sectionLabel}>Who else was there?</p>
                <button
                  type="button"
                  onClick={() => setShowPeople(false)}
                  className="text-xs text-white/40 hover:text-white transition-colors"
                >
                  Hide
                </button>
              </div>
              <PeopleSection
                value={personRefs}
                onChange={setPersonRefs}
                label="Who else was there?"
                mode="inline"
              />
            </div>
          )}
        </div>

        {/* External links: show for synchronicity, or when links exist; hide for memories/milestones when unused */}
        {(() => {
          const canAddLinks = formData.entry_type === 'origin';
          const hasLinks = linkRefs.length > 0;
          const shouldShowLinksSection = canAddLinks || hasLinks || showLinks;

          if (!shouldShowLinksSection) return null;

          return (
            <div>
              {canAddLinks && !showLinks && !hasLinks ? (
                <button
                  type="button"
                  onClick={() => setShowLinks(true)}
                  className={formStyles.buttonGhost}
                >
                  <span className={formStyles.disclosureArrow}>&#9654;</span>
                  Add external link (article, photo, etc.)
                </button>
              ) : (
                <div className="space-y-3">
                  <label className={formStyles.label}>External links</label>

                  {canAddLinks && (
                    <div className="grid gap-2 sm:grid-cols-[1fr,1fr,auto]">
                      <input
                        type="text"
                        value={newLinkName}
                        onChange={(e) => setNewLinkName(e.target.value)}
                        placeholder="Display name (e.g., Wikipedia)"
                        className={formStyles.inputSmall}
                      />
                      <input
                        type="url"
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addLinkRef();
                          }
                        }}
                        placeholder="URL"
                        className={formStyles.inputSmall}
                      />
                      <button
                        type="button"
                        onClick={addLinkRef}
                        disabled={!newLinkName.trim() || !newLinkUrl.trim()}
                        className={`${formStyles.buttonSecondary} text-sm py-2`}
                      >
                        Add
                      </button>
                    </div>
                  )}

                  {hasLinks && (
                    <div className="flex flex-wrap gap-2">
                      {linkRefs.map((ref, i) => (
                        <span key={i} className={formStyles.tag}>
                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {ref.displayName}
                          </a>
                          <button
                            type="button"
                            onClick={() => removeLinkRef(i)}
                            className={formStyles.tagRemove}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Attachment (collapsed) */}
        <div>
          {!showAttachment ? (
            <button
              type="button"
              onClick={() => setShowAttachment(true)}
              className={formStyles.buttonGhost}
            >
              + Add an attachment
            </button>
          ) : (
            <div className={formStyles.section}>
              <div className="flex items-center justify-between mb-4">
                <p className={formStyles.sectionLabel}>Attachment</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowAttachment(false);
                    setAttachment({ type: 'image', url: '', caption: '' });
                  }}
                  className="text-xs text-white/40 hover:text-white transition-colors"
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="attachment_type" className={formStyles.label}>
                    Type
                  </label>
                  <select
                    id="attachment_type"
                    value={attachment.type}
                    onChange={(e) => setAttachment({ ...attachment, type: e.target.value as 'image' | 'audio' })}
                    className={formStyles.select}
                  >
                    <option value="image">Image</option>
                    <option value="audio">Audio</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="attachment_url" className={formStyles.label}>
                    URL
                  </label>
                  <input
                    type="url"
                    id="attachment_url"
                    value={attachment.url}
                    onChange={(e) => setAttachment({ ...attachment, url: e.target.value })}
                    placeholder="https://..."
                    className={formStyles.input}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label htmlFor="attachment_caption" className={formStyles.label}>
                  Caption <span className="text-white/40">(optional)</span>
                </label>
                <input
                  type="text"
                  id="attachment_caption"
                  value={attachment.caption}
                  onChange={(e) => setAttachment({ ...attachment, caption: e.target.value })}
                  placeholder="A short description"
                  className={formStyles.input}
                />
              </div>
            </div>
          )}
        </div>

        {/* Review notice */}
        <p className="text-sm text-white/50 leading-relaxed">
          Admin may follow up to add context.
        </p>

        {error && (
          <p className={formStyles.error}>{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !hasContent(formData.content)}
          className={formStyles.buttonPrimaryFull}
        >
          {isSubmitting ? 'Adding...' : 'Add This Memory'}
        </button>
      </div>
      </form>
    </>
  );
}
