'use client';

import type { PersonReference, ProvenanceData } from '@/lib/form-types';
import {
  DEFAULT_PROVENANCE,
  mapToLegacyPersonRole,
  provenanceToSource,
} from '@/lib/form-types';
import { formStyles } from '@/lib/styles';
import {
  ENTRY_TYPE_CONTENT_LABELS,
  ENTRY_TYPE_DESCRIPTIONS,
  ENTRY_TYPE_LABELS,
  LIFE_STAGES,
  LIFE_STAGE_DESCRIPTIONS,
  LIFE_STAGE_YEAR_RANGES,
} from '@/lib/terminology';
import { useRef, useState } from 'react';
import { PeopleSection, ProvenanceSection } from './forms';

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

  // Attachment (collapsed by default)
  const [showAttachment, setShowAttachment] = useState(false);
  const [attachment, setAttachment] = useState({
    type: 'image' as 'image' | 'audio' | 'link',
    url: '',
    caption: '',
  });

  // Timing mode: which method user chooses to enter timing (null = none selected yet)
  const [timingMode, setTimingMode] = useState<'exact' | 'year' | 'chapter' | null>(null);

  // Show optional timing details (location, timing note)
  const [showTimingDetails, setShowTimingDetails] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showWhyMeaningful, setShowWhyMeaningful] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      year = Number.parseInt(formData.exact_date.split('-')[0], 10);
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
      year = Number.parseInt(formData.exact_date.split('-')[0], 10);
      timingInputType = 'date';
    } else if (timingMode === 'year') {
      year = Number.parseInt(formData.year, 10);
      if (Number.isNaN(year)) {
        setError('Please enter a year.');
        return;
      }
      yearEnd = formData.year_end ? Number.parseInt(formData.year_end, 10) : null;
      if (yearEnd !== null && yearEnd < year) {
        setError('End year must be the same or later than the start year.');
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
                const message = `Hey ${invite.name}! I shared a memory about you on Val's memorial. Add your side of the story: ${baseUrl}/respond/${invite.id}`;
                const smsUrl = `sms:${invite.phone}?body=${encodeURIComponent(message)}`;
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
              <label htmlFor="content" className={formStyles.label}>
                {ENTRY_TYPE_CONTENT_LABELS[formData.entry_type as keyof typeof ENTRY_TYPE_CONTENT_LABELS] || 'The memory'} <span className={formStyles.required}>*</span>
              </label>
              <textarea
                ref={textareaRef}
                id="content"
                required
                rows={6}
                value={formData.content}
                onChange={e => setFormData({ ...formData, content: e.target.value })}
                placeholder="Share a story, a moment, or a note..."
                className={formStyles.textarea}
              />
              <div className="flex justify-end mt-1">
                <span className={`text-xs ${formData.content.length > 2000 ? formStyles.required : 'text-white/40'}`}>
                  {formData.content.length} characters
                </span>
              </div>
            </div>

            {!showWhyMeaningful && !formData.why_included && (
              <button
                type="button"
                onClick={() => setShowWhyMeaningful(true)}
                className={formStyles.buttonGhost}
              >
                <span className={formStyles.disclosureArrow}>▶</span>Add why it&apos;s meaningful
              </button>
            )}

            {(showWhyMeaningful || formData.why_included) && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setShowWhyMeaningful(false);
                    setFormData({ ...formData, why_included: '' });
                  }}
                  className={`${formStyles.buttonGhost} mb-2`}
                >
                  <span className={formStyles.disclosureArrow}>▼</span>Why it&apos;s meaningful
                </button>
                <p className={formStyles.hint}>
                  Appears as an italic quote beneath your note
                </p>
                <textarea
                  id="why_included"
                  rows={2}
                  value={formData.why_included}
                  onChange={(e) => setFormData({ ...formData, why_included: e.target.value })}
                  placeholder="What it shows about her, why it matters to you..."
                  className={`${formStyles.textarea} mt-2`}
                />
              </div>
            )}
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

              <div className="space-y-3">
                {/* Exact date card */}
                <button
                  type="button"
                  onClick={() => {
                    setTimingMode('exact');
                    setFormData({ ...formData, is_approximate: false });
                  }}
                  className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
                    timingMode === 'exact'
                      ? 'border-[#e07a5f] bg-[#e07a5f]/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      timingMode === 'exact' ? 'border-[#e07a5f]' : 'border-white/30'
                    }`}>
                      {timingMode === 'exact' && <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Exact date</p>
                      <p className="text-xs text-white/50">I know the specific day</p>
                    </div>
                  </div>
                  {timingMode === 'exact' && (
                    <div className="mt-4 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        id="exact_date_memory"
                        value={formData.exact_date}
                        onChange={(e) => {
                          const date = e.target.value;
                          const year = date ? date.split('-')[0] : '';
                          setFormData({ ...formData, exact_date: date, year });
                        }}
                        className={formStyles.input}
                        required
                      />
                    </div>
                  )}
                </button>

                {/* Year/range card */}
                <button
                  type="button"
                  onClick={() => {
                    setTimingMode('year');
                    setFormData({ ...formData, is_approximate: true });
                  }}
                  className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
                    timingMode === 'year'
                      ? 'border-[#e07a5f] bg-[#e07a5f]/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      timingMode === 'year' ? 'border-[#e07a5f]' : 'border-white/30'
                    }`}>
                      {timingMode === 'year' && <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Around a year</p>
                      <p className="text-xs text-white/50">I know roughly when</p>
                    </div>
                  </div>
                  {timingMode === 'year' && (
                    <div className="mt-4 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          type="number"
                          id="year"
                          min="1900"
                          max="2030"
                          inputMode="numeric"
                          value={formData.year}
                          onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                          placeholder="Year, e.g. 1996"
                          className={formStyles.input}
                          required
                        />
                        <input
                          type="number"
                          id="year_end"
                          min="1900"
                          max="2030"
                          inputMode="numeric"
                          value={formData.year_end}
                          onChange={(e) => setFormData({ ...formData, year_end: e.target.value })}
                          placeholder="End year (optional)"
                          className={formStyles.input}
                        />
                      </div>
                    </div>
                  )}
                </button>

                {/* Chapter card */}
                <button
                  type="button"
                  onClick={() => {
                    setTimingMode('chapter');
                    setFormData({ ...formData, is_approximate: true });
                  }}
                  className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
                    timingMode === 'chapter'
                      ? 'border-[#e07a5f] bg-[#e07a5f]/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      timingMode === 'chapter' ? 'border-[#e07a5f]' : 'border-white/30'
                    }`}>
                      {timingMode === 'chapter' && <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Chapter of her life</p>
                      <p className="text-xs text-white/50">I remember the era, not the year</p>
                    </div>
                  </div>
                  {timingMode === 'chapter' && (
                    <div className="mt-4 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                      <select
                        id="life_stage"
                        value={formData.life_stage}
                        onChange={(e) => setFormData({ ...formData, life_stage: e.target.value })}
                        className={formStyles.select}
                        required
                      >
                        <option value="">Select a chapter...</option>
                        {Object.entries(LIFE_STAGES).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {formData.life_stage && (
                        <p className={`${formStyles.hint} mt-2`}>
                          {LIFE_STAGE_DESCRIPTIONS[formData.life_stage as keyof typeof LIFE_STAGE_DESCRIPTIONS]}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Optional details - collapsed */}
          <div className="flex flex-col items-start gap-3 mt-6">
            {!showTimingDetails && !formData.timing_note && (
              <button
                type="button"
                onClick={() => setShowTimingDetails(true)}
                className={formStyles.buttonGhost}
              >
                <span className={formStyles.disclosureArrow}>▶</span>Add timing note
              </button>
            )}
            {!showLocation && !formData.location && (
              <button
                type="button"
                onClick={() => setShowLocation(true)}
                className={formStyles.buttonGhost}
              >
                <span className={formStyles.disclosureArrow}>▶</span>Add location
              </button>
            )}
          </div>

          {/* Expanded optional fields */}
          {(showTimingDetails || formData.timing_note) && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowTimingDetails(false);
                  setFormData({ ...formData, timing_note: '' });
                }}
                className={`${formStyles.buttonGhost} mb-2`}
              >
                <span className={formStyles.disclosureArrow}>▼</span>Timing note
              </button>
              <input
                type="text"
                id="timing_note"
                value={formData.timing_note}
                onChange={(e) => setFormData({ ...formData, timing_note: e.target.value })}
                placeholder="e.g., Summer before college, around Christmas"
                className={formStyles.input}
              />
            </div>
          )}

          {(showLocation || formData.location) && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowLocation(false);
                  setFormData({ ...formData, location: '' });
                }}
                className={`${formStyles.buttonGhost} mb-2`}
              >
                <span className={formStyles.disclosureArrow}>▼</span>Location
              </button>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Riverton, UT or Anchorage, AK"
                className={formStyles.input}
              />
            </div>
          )}
        </div>

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

          <PeopleSection
            value={personRefs}
            onChange={setPersonRefs}
            label="Who else was there?"
            mode="inline"
          />
        </div>

        {/* External links (collapsed) */}
        <div>
          {!showLinks && linkRefs.length === 0 ? (
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
              {linkRefs.length > 0 && (
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
                    onChange={(e) => setAttachment({ ...attachment, type: e.target.value as 'image' | 'audio' | 'link' })}
                    className={formStyles.select}
                  >
                    <option value="image">Image</option>
                    <option value="audio">Audio</option>
                    <option value="link">Link</option>
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
          disabled={isSubmitting || !formData.content.trim()}
          className={formStyles.buttonPrimaryFull}
        >
          {isSubmitting ? 'Adding...' : 'Add This Memory'}
        </button>
      </div>
      </form>
    </>
  );
}
