'use client';

import { useState } from 'react';
import {
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_DESCRIPTIONS,
  LIFE_STAGE_DESCRIPTIONS,
  LIFE_STAGES,
  TIMING_CERTAINTY,
  TIMING_CERTAINTY_DESCRIPTIONS,
} from '@/lib/terminology';
import { formStyles } from '@/lib/styles';
import RichTextEditor from './RichTextEditor';

const toPlainText = (html?: string | null) =>
  html ? html.replace(/<[^>]+>/g, '').trim() : '';

type EditableEvent = {
  id: string;
  year: number;
  year_end: number | null;
  age_start: number | null;
  age_end: number | null;
  life_stage: 'childhood' | 'teens' | 'college' | 'young_family' | 'beyond' | null;
  timing_certainty: 'exact' | 'approximate' | 'vague';
  timing_input_type: 'date' | 'year' | 'year_range' | 'age_range' | 'life_stage';
  timing_note: string | null;
  location: string | null;
  people_involved?: string[] | null;
  type: 'origin' | 'milestone' | 'memory';
  title: string;
  preview?: string | null;
  full_entry: string | null;
  why_included: string | null;
  source_name: string | null;
  source_url: string | null;
  privacy_level: 'public' | 'family' | 'kids-only';
  people_involved?: string[] | null;
  sources: {
    id?: string;
    display_name: string;
    url: string;
  }[];
  person_refs: {
    id?: string;
    person_id?: string | null;
    name: string;
    relationship?: string | null;
    role: 'witness' | 'heard_from' | 'source' | 'related';
    phone?: string;
  }[];
};

type IncomingEvent = Omit<EditableEvent, 'sources'> & {
  references?: {
    id: string;
    type: 'person' | 'link';
    url?: string | null;
    display_name?: string | null;
    role?: string | null;
    relationship_to_subject?: string | null;
    person?: { id?: string | null; canonical_name?: string | null } | null;
  }[];
};

type Props = {
  token: string;
  contributorName: string;
  events: IncomingEvent[];
};

// Strip HTML tags for plain text preview
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export default function EditNotesClient({ token, contributorName, events: initialEvents }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, EditableEvent>>(() =>
    initialEvents.reduce((acc, event) => {
      const linkRefs =
        event.references?.filter((ref) => ref.type === 'link')?.map((ref) => ({
          id: ref.id,
          display_name: ref.display_name || '',
          url: ref.url || '',
        })) ?? [];
      const personRefs =
        event.references?.filter((ref) => ref.type === 'person')?.map((ref) => ({
          id: ref.id,
          person_id: ref.person?.id || undefined,
          name: ref.person?.canonical_name || ref.display_name || '',
          relationship: ref.relationship_to_subject || '',
          role:
            ref.role === 'heard_from' ||
            ref.role === 'source' ||
            ref.role === 'related' ||
            ref.role === 'witness'
              ? ref.role
              : 'witness',
          phone: '',
        })) ?? [];
      acc[event.id] = {
        ...event,
        preview: event.preview ?? '',
        year_end: event.year_end ?? null,
        age_start: event.age_start ?? null,
        age_end: event.age_end ?? null,
        life_stage: event.life_stage ?? null,
        timing_certainty: event.timing_certainty ?? 'approximate',
        timing_input_type: event.timing_input_type ?? 'year',
        timing_note: event.timing_note ?? '',
        location: event.location ?? '',
        people_involved: event.people_involved ?? [],
        privacy_level: event.privacy_level || 'family',
        sources: linkRefs,
        person_refs: personRefs,
      };
      return acc;
    }, {} as Record<string, EditableEvent>)
  );
  const [status, setStatus] = useState<Record<string, string>>({});

  const formatYearLabel = (event: EditableEvent) => {
    const isApproximate = event.timing_certainty !== 'exact';
    const hasRange =
      typeof event.year_end === 'number' && event.year_end !== event.year;
    if (hasRange) {
      return `${isApproximate ? '~' : ''}${event.year}–${event.year_end}`;
    }
    return isApproximate ? `~${event.year}` : String(event.year);
  };

  const updateField = (
    eventId: string,
    field: keyof EditableEvent,
    value: string | string[]
  ) => {
    setFormState((prev) => {
      const current = prev[eventId];
      if (!current) return prev;

      let nextValue: EditableEvent[keyof EditableEvent] = value;
      if (field === 'type') {
        nextValue = value as EditableEvent['type'];
      }
      if (field === 'timing_certainty') {
        nextValue = value as EditableEvent['timing_certainty'];
      }
      if (field === 'timing_input_type') {
        nextValue = value as EditableEvent['timing_input_type'];
      }
      if (field === 'privacy_level') {
        nextValue = value as EditableEvent['privacy_level'];
      }
      if (field === 'life_stage') {
        nextValue = value
          ? (value as EditableEvent['life_stage'])
          : null;
      }
      if (field === 'people_involved') {
        nextValue = Array.isArray(value) ? value : [];
      }
      if (field === 'year') {
        const parsed = Number.parseInt(value, 10);
        nextValue = Number.isNaN(parsed) ? current.year : parsed;
      }
      if (field === 'year_end' || field === 'age_start' || field === 'age_end') {
        const parsed = Number.parseInt(value, 10);
        nextValue = value.trim() === '' || Number.isNaN(parsed) ? null : parsed;
      }

      return {
        ...prev,
        [eventId]: {
          ...current,
          [field]: nextValue,
        },
      };
    });
  };

  const saveChanges = async (eventId: string) => {
    const payload = formState[eventId];
    if (!payload) return;

    const trimmedWhy = (payload.why_included || '').trim();
    const trimmedSourceName = (payload.source_name || '').trim() || 'Personal memory';

    if (!trimmedWhy) {
      setStatus((prev) => ({ ...prev, [eventId]: 'Please add why this memory belongs.' }));
      return;
    }

    if (
      payload.year_end !== null
      && payload.timing_input_type === 'year_range'
      && payload.year_end < payload.year
    ) {
      setStatus((prev) => ({ ...prev, [eventId]: 'Year range end must be later.' }));
      return;
    }

    if (
      payload.age_start !== null
      && payload.age_end !== null
      && payload.age_end < payload.age_start
    ) {
      setStatus((prev) => ({ ...prev, [eventId]: 'Age range end must be later.' }));
      return;
    }

    setStatus((prev) => ({ ...prev, [eventId]: 'saving' }));
    try {
      const response = await fetch('/api/edit/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          event_id: eventId,
          year: payload.year,
          year_end: payload.year_end,
          age_start: payload.age_start,
          age_end: payload.age_end,
          life_stage: payload.life_stage,
          timing_certainty: payload.timing_certainty,
          timing_input_type: payload.timing_input_type,
          timing_note: payload.timing_note,
          location: payload.location,
          people_involved: payload.people_involved,
          entry_type: payload.type,
          title: payload.title,
          content: payload.full_entry,
          why_included: trimmedWhy,
          source_name: trimmedSourceName,
          source_url: payload.source_url,
          privacy_level: payload.privacy_level,
          sources: payload.sources,
          references: {
            links: payload.sources,
            people: payload.person_refs || [],
          },
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Update failed');
      }

      setStatus((prev) => ({ ...prev, [eventId]: 'saved' }));
      setTimeout(() => {
        setStatus((prev) => ({ ...prev, [eventId]: '' }));
      }, 1800);
    } catch (err) {
      console.error(err);
      setStatus((prev) => ({ ...prev, [eventId]: 'error' }));
    }
  };

  const updateSourceField = (
    eventId: string,
    index: number,
    field: 'display_name' | 'url',
    value: string
  ) => {
    setFormState((prev) => {
      const current = prev[eventId];
      if (!current) return prev;
      const nextSources = [...current.sources];
      nextSources[index] = {
        ...nextSources[index],
        [field]: value,
      };
      return {
        ...prev,
        [eventId]: { ...current, sources: nextSources },
      };
    });
  };

  const updatePersonField = (
    eventId: string,
    index: number,
    field: 'name' | 'relationship' | 'role' | 'phone',
    value: string
  ) => {
    setFormState((prev) => {
      const current = prev[eventId];
      if (!current) return prev;
      const nextPeople = [...(current.person_refs || [])];
      if (!nextPeople[index]) return prev;
      nextPeople[index] = {
        ...nextPeople[index],
        [field]: value,
      };
      return {
        ...prev,
        [eventId]: { ...current, person_refs: nextPeople },
      };
    });
  };

  const addPersonRefRow = (eventId: string) => {
    setFormState((prev) => {
      const current = prev[eventId];
      if (!current) return prev;
      return {
        ...prev,
        [eventId]: {
          ...current,
          person_refs: [
            ...(current.person_refs || []),
            { name: '', relationship: '', role: 'witness', phone: '' },
          ],
        },
      };
    });
  };

  const removePersonRefRow = (eventId: string, index: number) => {
    setFormState((prev) => {
      const current = prev[eventId];
      if (!current) return prev;
      const nextPeople = [...(current.person_refs || [])];
      nextPeople.splice(index, 1);
      return {
        ...prev,
        [eventId]: { ...current, person_refs: nextPeople },
      };
    });
  };

  const addSource = (eventId: string) => {
    setFormState((prev) => {
      const current = prev[eventId];
      if (!current) return prev;
      return {
        ...prev,
        [eventId]: {
          ...current,
          sources: [...current.sources, { display_name: '', url: '' }],
        },
      };
    });
  };

  const removeSource = (eventId: string, index: number) => {
    setFormState((prev) => {
      const current = prev[eventId];
      if (!current) return prev;
      const nextSources = [...current.sources];
      nextSources.splice(index, 1);
      return {
        ...prev,
        [eventId]: { ...current, sources: nextSources },
      };
    });
  };

  const deleteNote = async (eventId: string) => {
    setStatus((prev) => ({ ...prev, [eventId]: 'deleting' }));
    try {
      const response = await fetch('/api/edit/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, event_id: eventId }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Delete failed');
      }

      // Remove from local state
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setFormState((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
      setDeletingId(null);
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setStatus((prev) => ({ ...prev, [eventId]: 'delete-error' }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-white/60">
        Editing notes submitted by <span className="text-white">{contributorName}</span>
      </div>

      {events.length === 0 && (
        <div className="text-white/50">No notes found for this email.</div>
      )}

      {events.map((event) => {
        const data = formState[event.id];
        const isEditing = editingId === event.id;
        const statusText = status[event.id];
        const summaryEvent = data || event;

        return (
          <div key={event.id} className={formStyles.section}>
            {!isEditing ? (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-white/40">{formatYearLabel(summaryEvent)}</p>
                  <h3 className="text-lg font-serif text-white">{event.title}</h3>
                  <p className="text-white/50 text-sm mt-2 line-clamp-2">
                    {toPlainText(event.full_entry) || 'No text added yet.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingId(event.id)}
                  className="text-xs uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors"
                >
                  Edit
                </button>
              </div>
            ) : null}

            {isEditing && data && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors"
                  >
                    Close
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={formStyles.label}>
                      Entry type
                    </label>
                    <select
                      value={data.type}
                      onChange={(e) => updateField(event.id, 'type', e.target.value)}
                      className={formStyles.select}
                    >
                      <option value="memory">{ENTRY_TYPE_LABELS.memory}</option>
                      <option value="milestone">{ENTRY_TYPE_LABELS.milestone}</option>
                      <option value="origin">{ENTRY_TYPE_LABELS.origin}</option>
                    </select>
                    <p className={formStyles.hint}>
                      {ENTRY_TYPE_DESCRIPTIONS[data.type]}
                    </p>
                  </div>
                  <div>
                    <label className={formStyles.label}>Year</label>
                    <input
                      type="number"
                      value={data.year}
                      onChange={(e) => updateField(event.id, 'year', e.target.value)}
                      className={formStyles.input}
                    />
                  </div>
                  <div>
                    <label className={formStyles.label}>Location (optional)</label>
                    <input
                      type="text"
                      value={data.location || ''}
                      onChange={(e) => updateField(event.id, 'location', e.target.value)}
                      placeholder="e.g., St. Paul, MN"
                      className={formStyles.input}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
                  <p className={formStyles.sectionLabel}>Timing</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={formStyles.label}>How sure are you?</label>
                      <select
                        value={data.timing_certainty}
                        onChange={(e) => updateField(event.id, 'timing_certainty', e.target.value)}
                        className={formStyles.select}
                      >
                        {Object.entries(TIMING_CERTAINTY).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <p className={formStyles.hint}>
                        {TIMING_CERTAINTY_DESCRIPTIONS[
                          data.timing_certainty as keyof typeof TIMING_CERTAINTY_DESCRIPTIONS
                        ]}
                      </p>
                    </div>
                    <div>
                      <label className={formStyles.label}>How do you remember it?</label>
                      <select
                        value={data.timing_input_type}
                        onChange={(e) => updateField(event.id, 'timing_input_type', e.target.value)}
                        className={formStyles.select}
                      >
                        <option value="year">Year</option>
                        <option value="year_range">Year range</option>
                        <option value="age_range">Age range</option>
                        <option value="life_stage">Life stage</option>
                      </select>
                    </div>
                  </div>

                  {data.timing_input_type === 'year_range' && (
                    <div>
                      <label className={formStyles.label}>Year range end</label>
                      <input
                        type="number"
                        value={data.year_end ?? ''}
                        onChange={(e) => updateField(event.id, 'year_end', e.target.value)}
                        className={formStyles.input}
                      />
                    </div>
                  )}

                  {data.timing_input_type === 'age_range' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className={formStyles.label}>Age start</label>
                        <input
                          type="number"
                          value={data.age_start ?? ''}
                          onChange={(e) => updateField(event.id, 'age_start', e.target.value)}
                          className={formStyles.input}
                        />
                      </div>
                      <div>
                        <label className={formStyles.label}>Age end</label>
                        <input
                          type="number"
                          value={data.age_end ?? ''}
                          onChange={(e) => updateField(event.id, 'age_end', e.target.value)}
                          className={formStyles.input}
                        />
                      </div>
                    </div>
                  )}

                  {data.timing_input_type === 'life_stage' && (
                    <div>
                      <label className={formStyles.label}>Life stage</label>
                      <select
                        value={data.life_stage ?? ''}
                        onChange={(e) => updateField(event.id, 'life_stage', e.target.value)}
                        className={formStyles.select}
                      >
                        <option value="">Select a stage</option>
                        {Object.entries(LIFE_STAGES).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {data.life_stage && (
                        <p className={formStyles.hint}>
                          {LIFE_STAGE_DESCRIPTIONS[
                            data.life_stage as keyof typeof LIFE_STAGE_DESCRIPTIONS
                          ]}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className={formStyles.label}>Timing note (optional)</label>
                    <textarea
                      value={data.timing_note || ''}
                      onChange={(e) => updateField(event.id, 'timing_note', e.target.value)}
                      rows={2}
                      className={formStyles.textarea}
                    />
                  </div>
                </div>

                <div>
                  <label className={formStyles.label}>People involved (optional)</label>
                  <input
                    type="text"
                    value={(data.people_involved || []).join(', ')}
                    onChange={(e) =>
                      updateField(
                        event.id,
                        'people_involved',
                        e.target.value
                          .split(',')
                          .map((name) => name.trim())
                          .filter(Boolean)
                      )
                    }
                    placeholder="Amy, Julie"
                    className={formStyles.input}
                  />
                  <p className={formStyles.hint}>Comma-separated. This shows who was there.</p>
                </div>

                <div>
                  <label className={formStyles.label}>Title</label>
                  <input
                    type="text"
                    value={data.title}
                    onChange={(e) => updateField(event.id, 'title', e.target.value)}
                    className={formStyles.input}
                  />
                </div>

                {/* People references */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className={formStyles.label}>People (witnesses, sources)</label>
                    <button
                      type="button"
                      onClick={() => addPersonRefRow(event.id)}
                      className={formStyles.buttonGhost}
                    >
                      + Add person
                    </button>
                  </div>
                  {(data.person_refs || []).length === 0 && (
                    <p className={`${formStyles.hint} italic`}>No people added yet — include who was there or who told you.</p>
                  )}
                  {(data.person_refs || []).map((person, index) => (
                    <div key={person.id || index} className="space-y-2 p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-white/40">Person {index + 1}</label>
                        <button
                          type="button"
                          onClick={() => removePersonRefRow(event.id, index)}
                          className="text-xs text-white/40 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        type="text"
                        value={person.name}
                        onChange={(e) => updatePersonField(event.id, index, 'name', e.target.value)}
                        placeholder="Name"
                        className={formStyles.input}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          type="text"
                          value={person.relationship || ''}
                          onChange={(e) => updatePersonField(event.id, index, 'relationship', e.target.value)}
                          placeholder="Relationship to Val (optional)"
                          className={formStyles.input}
                        />
                        <select
                          value={person.role}
                          onChange={(e) => updatePersonField(event.id, index, 'role', e.target.value)}
                          className={formStyles.select}
                        >
                          <option value="witness">Witness</option>
                          <option value="heard_from">Heard from</option>
                          <option value="source">Source</option>
                          <option value="related">Related</option>
                        </select>
                      </div>
                      <input
                        type="tel"
                        value={person.phone || ''}
                        onChange={(e) => updatePersonField(event.id, index, 'phone', e.target.value)}
                        placeholder="Phone (optional - to invite them)"
                        className={formStyles.input}
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className={formStyles.label}>Your memory of Val</label>
                  <RichTextEditor
                    value={data.full_entry || ''}
                    onChange={(val) => updateField(event.id, 'full_entry', val)}
                    placeholder="Share the memory..."
                    minHeight="120px"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className={formStyles.label}>Preview (timeline hover)</label>
                    <span className={formStyles.hint}>auto-trimmed to 160 chars</span>
                  </div>
                  <textarea
                    readOnly
                    value={(() => {
                      const text = stripHtml(data.full_entry || data.preview || '');
                      return text.length > 160 ? `${text.slice(0, 160).trimEnd()}...` : text;
                    })()}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white/70 text-sm cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className={formStyles.label}>
                    Why this memory belongs (timeline hover)
                  </label>
                  <RichTextEditor
                    value={data.why_included || ''}
                    onChange={(val) => updateField(event.id, 'why_included', val)}
                    placeholder="Explain the connection or significance"
                    minHeight="80px"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={formStyles.label}>Source name</label>
                    <input
                      type="text"
                      value={data.source_name || ''}
                      onChange={(e) => updateField(event.id, 'source_name', e.target.value)}
                      placeholder="e.g., Personal memory"
                      className={formStyles.input}
                    />
                  </div>
                  <div>
                    <label className={formStyles.label}>Source link (optional)</label>
                    <input
                      type="url"
                      value={data.source_url || ''}
                      onChange={(e) => updateField(event.id, 'source_url', e.target.value)}
                      placeholder="https://..."
                      className={formStyles.input}
                    />
                  </div>
                </div>

                <div>
                  <label className={formStyles.label}>Privacy</label>
                  <select
                    value={data.privacy_level}
                    onChange={(e) => updateField(event.id, 'privacy_level', e.target.value)}
                    className={formStyles.select}
                  >
                    <option value="family">Family (default)</option>
                    <option value="kids-only">Kids only</option>
                    <option value="public">Public</option>
                  </select>
                  <p className={formStyles.hint}>
                    Keep visibility aligned with who should see this memory.
                  </p>
                </div>

                {/* Sources */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className={formStyles.label}>Sources</label>
                    <button
                      type="button"
                      onClick={() => addSource(event.id)}
                      className={formStyles.buttonGhost}
                    >
                      + Add source
                    </button>
                  </div>
                  {data.sources.length === 0 && (
                    <p className={`${formStyles.hint} italic`}>No sources yet — add links that support this memory.</p>
                  )}
                  {data.sources.map((source, index) => (
                    <div key={source.id || index} className="space-y-2 p-3 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-white/40">Source {index + 1}</label>
                        <button
                          type="button"
                          onClick={() => removeSource(event.id, index)}
                          className="text-xs text-white/40 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        type="text"
                        value={source.display_name}
                        onChange={(e) => updateSourceField(event.id, index, 'display_name', e.target.value)}
                        placeholder="Display name (e.g. Wikipedia)"
                        className={formStyles.input}
                      />
                      <input
                        type="url"
                        value={source.url}
                        onChange={(e) => updateSourceField(event.id, index, 'url', e.target.value)}
                        placeholder="https://..."
                        className={formStyles.input}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => saveChanges(event.id)}
                      className={formStyles.buttonPrimary}
                    >
                      Save changes
                    </button>
                    {statusText === 'saving' && (
                      <span className="text-xs text-white/50">Saving...</span>
                    )}
                    {statusText === 'saved' && (
                      <span className={formStyles.success}>Saved.</span>
                    )}
                    {statusText === 'error' && (
                      <span className={formStyles.error}>Could not save.</span>
                    )}
                    {statusText && statusText !== 'saving' && statusText !== 'saved' && statusText !== 'error' && statusText !== 'deleting' && statusText !== 'delete-error' && (
                      <span className={formStyles.error}>{statusText}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeletingId(event.id)}
                    className="text-xs text-white/40 hover:text-red-400 transition-colors"
                  >
                    Delete memory
                  </button>
                </div>

                {/* Delete confirmation */}
                {deletingId === event.id && (
                  <div className="mt-4 p-4 rounded-xl border border-red-500/30 bg-red-500/10">
                    <p className="text-sm text-white/80 mb-3">
                      Are you sure you want to delete &ldquo;{data.title}&rdquo;? This cannot be undone.
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => deleteNote(event.id)}
                        disabled={statusText === 'deleting'}
                        className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {statusText === 'deleting' ? 'Deleting...' : 'Yes, delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="px-4 py-2 rounded-lg border border-white/20 text-white/70 text-sm hover:border-white/40 transition-colors"
                      >
                        Cancel
                      </button>
                      {statusText === 'delete-error' && (
                        <span className={formStyles.error}>Failed to delete.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
