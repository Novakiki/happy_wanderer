'use client';

import { formStyles } from '@/lib/styles';
import {
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_DESCRIPTIONS,
  ENTRY_TYPE_CONTENT_LABELS,
  LIFE_STAGES,
  LIFE_STAGE_DESCRIPTIONS,
  LIFE_STAGE_YEAR_RANGES,
  RELATIONSHIP_OPTIONS,
} from '@/lib/terminology';
import { validatePersonReference } from '@/lib/invites';
import { useEffect, useRef, useState } from 'react';

type PersonReference = {
  name: string;
  relationship: string;
  personId?: string;
  phone?: string;
};

type CreatedInvite = {
  id: string;
  name: string;
  phone: string;
};

type PersonSearchResult = {
  person_id: string;
  display_name: string;
  relationship: string | null;
  linked: boolean;
  mention_count: number;
};

type ProvenanceType = 'firsthand' | 'told' | 'record' | 'mixed';

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
  const [provenanceType, setProvenanceType] = useState<ProvenanceType>('firsthand');
  const [toldByName, setToldByName] = useState('');
  const [recordSource, setRecordSource] = useState({ name: '', url: '' });
  const [provenanceNote, setProvenanceNote] = useState('');

  // People references
  const [personRefs, setPersonRefs] = useState<PersonReference[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonRelationship, setNewPersonRelationship] = useState('');
  const [newPersonId, setNewPersonId] = useState<string | null>(null);
  const [newPersonPhone, setNewPersonPhone] = useState('');

  // Invites created after submission (for "Text them" buttons)
  const [createdInvites, setCreatedInvites] = useState<CreatedInvite[]>([]);

  // Typeahead for person search
  const [personSearchResults, setPersonSearchResults] = useState<PersonSearchResult[]>([]);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const personInputRef = useRef<HTMLInputElement>(null);

  // Debounced search for people
  useEffect(() => {
    if (newPersonName.length < 2) {
      setPersonSearchResults([]);
      setShowPersonDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/people/search?q=${encodeURIComponent(newPersonName)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setPersonSearchResults(data.results || []);
          setShowPersonDropdown(data.results?.length > 0);
        }
      } catch (e) {
        console.error('Person search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [newPersonName]);

  const selectPerson = (person: PersonSearchResult) => {
    setNewPersonName(person.display_name);
    setNewPersonId(person.person_id);
    // Always set relationship (or clear if none) to avoid stale values
    setNewPersonRelationship(person.relationship || '');
    setShowPersonDropdown(false);
    setPersonSearchResults([]);
  };

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

  const addPersonRef = () => {
    const ref = {
      name: newPersonName,
      relationship: newPersonRelationship,
    };
    const { valid } = validatePersonReference(ref);

    if (valid) {
      setPersonRefs([...personRefs, {
        name: newPersonName.trim(),
        relationship: newPersonRelationship,
        personId: newPersonId || undefined,
        phone: newPersonPhone.trim() || undefined,
      }]);
      setNewPersonName('');
      setNewPersonRelationship('');
      setNewPersonId(null);
      setNewPersonPhone('');
      setShowPersonDropdown(false);
    }
  };

  const removePersonRef = (index: number) => {
    setPersonRefs(personRefs.filter((_, i) => i !== index));
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
      // Derive source_name and heard_from based on provenance type
      let sourceName = 'Personal memory';
      let sourceUrl = '';
      let heardFrom = null;

      if (provenanceType === 'firsthand') {
        sourceName = 'Personal memory';
      } else if (provenanceType === 'told') {
        sourceName = 'Told to me';
        if (toldByName.trim()) {
          heardFrom = { name: toldByName.trim(), relationship: '', email: '', shouldInvite: false };
        }
      } else if (provenanceType === 'record') {
        sourceName = recordSource.name.trim() || 'Record/document';
        sourceUrl = recordSource.url.trim();
      } else if (provenanceType === 'mixed') {
        sourceName = provenanceNote.trim() || 'Mixed / not sure';
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
          provenance_type: provenanceType,
          references: {
            links: [],
            people: personRefs,
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
            setProvenanceType('firsthand');
            setToldByName('');
            setRecordSource({ name: '', url: '' });
            setProvenanceNote('');
            setPersonRefs([]);
            setNewPersonId(null);
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

          {/* Provenance - single selector */}
          <div className="mb-6">
            <label className={formStyles.label}>
              How do you know this? <span className={formStyles.required}>*</span>
            </label>
            <div className="space-y-3 mt-3">
              {/* I remember it firsthand */}
              <button
                type="button"
                onClick={() => setProvenanceType('firsthand')}
                className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
                  provenanceType === 'firsthand'
                    ? 'border-[#e07a5f] bg-[#e07a5f]/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    provenanceType === 'firsthand' ? 'border-[#e07a5f]' : 'border-white/30'
                  }`}>
                    {provenanceType === 'firsthand' && <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">I remember it firsthand</p>
                    <p className="text-xs text-white/50">I was there or experienced this directly</p>
                  </div>
                </div>
              </button>

              {/* I was told about it */}
              <button
                type="button"
                onClick={() => setProvenanceType('told')}
                className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
                  provenanceType === 'told'
                    ? 'border-[#e07a5f] bg-[#e07a5f]/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    provenanceType === 'told' ? 'border-[#e07a5f]' : 'border-white/30'
                  }`}>
                    {provenanceType === 'told' && <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">I was told about it</p>
                    <p className="text-xs text-white/50">Someone shared this story with me</p>
                  </div>
                </div>
                {provenanceType === 'told' && (
                  <div className="mt-4 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                    <label htmlFor="told_by" className={formStyles.label}>
                      Told by
                    </label>
                    <input
                      type="text"
                      id="told_by"
                      value={toldByName}
                      onChange={(e) => setToldByName(e.target.value)}
                      placeholder="e.g., Uncle John, my mother"
                      className={formStyles.input}
                    />
                  </div>
                )}
              </button>

              {/* I have a record */}
              <button
                type="button"
                onClick={() => setProvenanceType('record')}
                className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
                  provenanceType === 'record'
                    ? 'border-[#e07a5f] bg-[#e07a5f]/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    provenanceType === 'record' ? 'border-[#e07a5f]' : 'border-white/30'
                  }`}>
                    {provenanceType === 'record' && <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">I have a record</p>
                    <p className="text-xs text-white/50">Photo, letter, journal, email, etc.</p>
                  </div>
                </div>
                {provenanceType === 'record' && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-3" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <label htmlFor="record_name" className={formStyles.label}>
                        What is it?
                      </label>
                      <input
                        type="text"
                        id="record_name"
                        value={recordSource.name}
                        onChange={(e) => setRecordSource({ ...recordSource, name: e.target.value })}
                        placeholder="e.g., Her journal, family photo album"
                        className={formStyles.input}
                      />
                    </div>
                    <div>
                      <label htmlFor="record_url" className={formStyles.labelMuted}>
                        Link <span className="text-white/40">(optional)</span>
                      </label>
                      <input
                        type="url"
                        id="record_url"
                        value={recordSource.url}
                        onChange={(e) => setRecordSource({ ...recordSource, url: e.target.value })}
                        placeholder="https://..."
                        className={formStyles.inputSmall}
                      />
                    </div>
                  </div>
                )}
              </button>

              {/* Mixed / not sure */}
              <button
                type="button"
                onClick={() => setProvenanceType('mixed')}
                className={`w-full text-left rounded-xl border p-4 transition-all duration-200 ${
                  provenanceType === 'mixed'
                    ? 'border-[#e07a5f] bg-[#e07a5f]/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    provenanceType === 'mixed' ? 'border-[#e07a5f]' : 'border-white/30'
                  }`}>
                    {provenanceType === 'mixed' && <div className="w-2 h-2 rounded-full bg-[#e07a5f]" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Mixed / not sure</p>
                    <p className="text-xs text-white/50">Part memory, part story I&apos;ve heard</p>
                  </div>
                </div>
                {provenanceType === 'mixed' && (
                  <div className="mt-4 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                    <label htmlFor="provenance_note" className={formStyles.labelMuted}>
                      Note <span className="text-white/40">(optional)</span>
                    </label>
                    <input
                      type="text"
                      id="provenance_note"
                      value={provenanceNote}
                      onChange={(e) => setProvenanceNote(e.target.value)}
                      placeholder="e.g., I think I was there but I'm not certain"
                      className={formStyles.input}
                    />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* People who were there */}
          <div>
            <label className={formStyles.label}>
              Who else was there?
            </label>
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-[1fr,auto,auto]">
                <div className="relative">
                  <input
                    ref={personInputRef}
                    type="text"
                    value={newPersonName}
                    onChange={(e) => {
                      setNewPersonName(e.target.value);
                      setNewPersonId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPersonRef();
                      } else if (e.key === 'Escape') {
                        setShowPersonDropdown(false);
                      }
                    }}
                    onFocus={() => {
                      if (personSearchResults.length > 0) {
                        setShowPersonDropdown(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay to allow click on dropdown
                      setTimeout(() => setShowPersonDropdown(false), 150);
                    }}
                    placeholder="Name"
                    className={formStyles.inputSmall}
                    autoComplete="off"
                  />
                  {/* Typeahead dropdown */}
                  {showPersonDropdown && personSearchResults.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl border border-white/10 bg-[#1a1a1a] shadow-lg overflow-hidden">
                      {personSearchResults.map((person) => (
                        <button
                          key={person.person_id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectPerson(person)}
                          className="w-full px-3 py-2 text-left hover:bg-white/10 transition-colors flex items-center justify-between gap-2"
                        >
                          <span className="text-sm text-white truncate">{person.display_name}</span>
                          <span className="text-xs text-white/40 flex-shrink-0">
                            {person.relationship && RELATIONSHIP_OPTIONS[person.relationship as keyof typeof RELATIONSHIP_OPTIONS]}
                            {person.linked && <span className="ml-1 text-green-400">✓</span>}
                            {!person.linked && person.mention_count > 0 && (
                              <span className="ml-1">{person.mention_count}×</span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <select
                  value={newPersonRelationship}
                  onChange={(e) => setNewPersonRelationship(e.target.value)}
                  className={`${formStyles.select} text-sm py-2`}
                >
                  <option value="">Relationship to Val</option>
                  <optgroup label="Family">
                    {Object.entries(RELATIONSHIP_OPTIONS)
                      .filter(([key]) => ['parent', 'child', 'sibling', 'cousin', 'aunt_uncle', 'niece_nephew', 'grandparent', 'grandchild', 'in_law', 'spouse'].includes(key))
                      .map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                  </optgroup>
                  <optgroup label="Social">
                    {Object.entries(RELATIONSHIP_OPTIONS)
                      .filter(([key]) => ['friend', 'neighbor', 'coworker', 'classmate'].includes(key))
                      .map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                  </optgroup>
                  <optgroup label="Other">
                    {Object.entries(RELATIONSHIP_OPTIONS)
                      .filter(([key]) => ['acquaintance', 'other', 'unknown'].includes(key))
                      .map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                  </optgroup>
                </select>
              </div>
              {/* Phone input - shown when name is entered */}
              {newPersonName.trim() && (
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={newPersonPhone}
                    onChange={(e) => setNewPersonPhone(e.target.value)}
                    placeholder="Phone (optional - to invite them)"
                    className={`flex-1 ${formStyles.inputSmall}`}
                  />
                  <span className="text-xs text-white/40 whitespace-nowrap">
                    They can add their side
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={addPersonRef}
                disabled={!newPersonName.trim() || !newPersonRelationship}
                className={formStyles.buttonSecondary}
              >
                Add
              </button>
            </div>
            {personRefs.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {personRefs.map((ref, i) => (
                  <span key={i} className={formStyles.tag}>
                    {ref.name}
                    {ref.relationship && ref.relationship !== 'unknown' && (
                      <span className="text-[#e07a5f]/60 ml-1">
                        ({RELATIONSHIP_OPTIONS[ref.relationship as keyof typeof RELATIONSHIP_OPTIONS] || ref.relationship})
                      </span>
                    )}
                    {ref.phone && (
                      <span className="text-[#e07a5f]/60 ml-1" title={`Will invite: ${ref.phone}`}>
                        +
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePersonRef(i)}
                      className={formStyles.tagRemove}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
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
