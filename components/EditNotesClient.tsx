'use client';

import { useState, useEffect } from 'react';
import {
  ENTRY_TYPE_LABELS,
  ENTRY_TYPE_DESCRIPTIONS,
  LIFE_STAGE_YEAR_RANGES,
  THREAD_RELATIONSHIP_LABELS,
  TIMING_CERTAINTY,
  TIMING_CERTAINTY_DESCRIPTIONS,
} from '@/lib/terminology';
import { formStyles } from '@/lib/styles';
import type { ReferenceVisibility } from '@/lib/references';
import type { ProvenanceData, PersonReference, Reference } from '@/lib/form-types';
import {
  mapLegacyPersonRole,
  mapToLegacyPersonRole,
  deriveProvenanceFromSource,
  provenanceToSource,
} from '@/lib/form-types';
import RichTextEditor from './RichTextEditor';
import { ProvenanceSection } from './forms';
import { PeopleSection } from './forms';
import { ReferencesSection } from './forms';
import { TimingModeSelector } from './forms/TimingModeSelector';
import type { TimingMode } from './forms/TimingModeSelector';
import { validateYearRange } from '@/lib/form-validation';
import { generatePreviewFromHtml, PREVIEW_MAX_LENGTH, stripHtml } from '@/lib/html-utils';

type EditableEvent = {
  id: string;
  year: number;
  date: string | null;
  year_end: number | null;
  age_start: number | null;
  age_end: number | null;
  life_stage: 'childhood' | 'teens' | 'college' | 'young_family' | 'beyond' | null;
  timing_certainty: 'exact' | 'approximate' | 'vague';
  timing_input_type: 'date' | 'year' | 'year_range' | 'age_range' | 'life_stage';
  timing_note: string | null;
  location: string | null;
  people_involved?: string[] | null;
  provenance: ProvenanceData;
  type: 'origin' | 'milestone' | 'memory';
  title: string;
  preview?: string | null;
  full_entry: string | null;
  why_included: string | null;
  source_name: string | null;
  source_url: string | null;
  privacy_level: 'public' | 'family';
  references: {
    id?: string;
    display_name: string;
    url: string;
  }[];
  person_refs: {
    id?: string;
    person_id?: string | null;
    name: string;
    relationship?: string | null;
    role: PersonReference['role'];
    phone?: string;
  }[];
};

// IncomingEvent uses looser types for values coming from the database
// The component will normalize these to the stricter EditableEvent types internally
type IncomingEvent = {
  id: string;
  year: number;
  date?: string | null;
  year_end?: number | null;
  age_start?: number | null;
  age_end?: number | null;
  life_stage?: string | null;
  timing_certainty?: string | null;
  timing_input_type?: string | null;
  timing_note?: string | null;
  location?: string | null;
  people_involved?: string[] | null;
  provenance?: string | null;
  type?: string;
  title?: string;
  preview?: string | null;
  full_entry?: string | null;
  why_included?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  privacy_level?: string | null;
  person_refs?: EditableEvent['person_refs'];
  references?: {
    id: string;
    type: string;
    url?: string | null;
    display_name?: string | null;
    role?: string | null;
    relationship_to_subject?: string | null;
    visibility?: ReferenceVisibility | string | null;
    note?: string | null;
    person_id?: string | null;
    person?: { id?: string | null; canonical_name?: string | null } | null;
  }[];
};

type Props = {
  token: string;
  contributorName: string;
  events: IncomingEvent[];
  initialEditingId?: string | null;
};

type ThreadRelationship = keyof typeof THREAD_RELATIONSHIP_LABELS;

export default function EditNotesClient({
  token,
  contributorName,
  events: initialEvents,
  initialEditingId = null,
}: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [editingId, setEditingId] = useState<string | null>(() => {
    if (initialEditingId && initialEvents.some((event) => event.id === initialEditingId)) {
      return initialEditingId;
    }
    return null;
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, EditableEvent>>(() =>
    initialEvents.reduce((acc, event) => {
      const activeReferences = event.references?.filter((ref) => ref.visibility !== 'removed') ?? [];
      const linkRefs =
        activeReferences.filter((ref) => ref.type === 'link')?.map((ref) => ({
          id: ref.id,
          display_name: ref.display_name || '',
          url: ref.url || '',
        })) ?? [];
      const personRefs =
        activeReferences.filter((ref) => ref.type === 'person')?.map((ref) => ({
          id: ref.id,
          person_id: ref.person?.id || ref.person_id || undefined,
          name: ref.person?.canonical_name || ref.display_name || '',
          relationship: ref.relationship_to_subject || '',
          role: mapLegacyPersonRole(ref.role),
          phone: '',
        })) ?? [];
      acc[event.id] = {
        ...event,
        type: (event.type || 'memory') as EditableEvent['type'],
        title: event.title || '',
        full_entry: event.full_entry ?? null,
        why_included: event.why_included ?? null,
        source_name: event.source_name ?? null,
        source_url: event.source_url ?? null,
        preview: event.preview ?? '',
        year_end: event.year_end ?? null,
        age_start: event.age_start ?? null,
        age_end: event.age_end ?? null,
        life_stage: (event.life_stage ?? null) as EditableEvent['life_stage'],
        timing_certainty: (event.timing_certainty ?? 'approximate') as EditableEvent['timing_certainty'],
        timing_input_type: (event.timing_input_type ?? 'year') as EditableEvent['timing_input_type'],
        date: event.date ?? null,
        timing_note: event.timing_note ?? '',
        location: event.location ?? '',
        people_involved: event.people_involved ?? [],
        provenance: deriveProvenanceFromSource(event.source_name, event.source_url),
        privacy_level: (event.privacy_level || 'family') as EditableEvent['privacy_level'],
        references: linkRefs,
        person_refs: personRefs,
      };
      return acc;
    }, {} as Record<string, EditableEvent>)
  );
  const [status, setStatus] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [timingMode, setTimingMode] = useState<Record<string, TimingMode>>(() =>
    initialEvents.reduce((acc, event) => {
      const inputType = event.timing_input_type;
      if (inputType === 'date') acc[event.id] = 'exact';
      else if (inputType === 'life_stage') acc[event.id] = 'chapter';
      else acc[event.id] = 'year';
      return acc;
    }, {} as Record<string, TimingMode>)
  );
  const [whyOpen, setWhyOpen] = useState<Record<string, boolean>>(() =>
    initialEvents.reduce((acc, event) => {
      acc[event.id] = Boolean(event.why_included);
      return acc;
    }, {} as Record<string, boolean>)
  );
  const [attachments, setAttachments] = useState<Record<string, { type: 'image' | 'audio' | 'link'; url: string; caption: string }>>(
    () =>
      initialEvents.reduce((acc, event) => {
        acc[event.id] = { type: 'image', url: '', caption: '' };
        return acc;
      }, {} as Record<string, { type: 'image' | 'audio' | 'link'; url: string; caption: string }>)
  );
  const [linkRelationships, setLinkRelationships] = useState<Record<string, ThreadRelationship>>(
    () =>
      initialEvents.reduce((acc, event) => {
        acc[event.id] = 'perspective';
        return acc;
      }, {} as Record<string, ThreadRelationship>)
  );
  const [linkNotes, setLinkNotes] = useState<Record<string, string>>(
    () =>
      initialEvents.reduce((acc, event) => {
        acc[event.id] = '';
        return acc;
      }, {} as Record<string, string>)
  );
  const [llmMessages, setLlmMessages] = useState<Record<string, string | null>>({});
  const [llmReasons, setLlmReasons] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!initialEditingId) return;
    if (events.some((event) => event.id === initialEditingId)) {
      setEditingId(initialEditingId);
    }
  }, [initialEditingId, events]);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

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
        const strValue = typeof value === 'string' ? value : '';
        const parsed = Number.parseInt(strValue, 10);
        nextValue = Number.isNaN(parsed) ? current.year : parsed;
      }
      if (field === 'year_end' || field === 'age_start' || field === 'age_end') {
        const strValue = typeof value === 'string' ? value : '';
        const parsed = Number.parseInt(strValue, 10);
        nextValue = strValue.trim() === '' || Number.isNaN(parsed) ? null : parsed;
      }

      setIsDirty(true);
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
    const derivedSource = provenanceToSource(payload.provenance);
    const trimmedSourceName = derivedSource.source_name;
    const trimmedSourceUrl = derivedSource.source_url;

    if (!trimmedWhy) {
      setStatus((prev) => ({ ...prev, [eventId]: "Please add why it's meaningful." }));
      return;
    }

    // Derive timing from card selection
    const mode = timingMode[eventId] ?? 'year';
    let timingInputType = payload.timing_input_type;
    let timingCertainty = payload.timing_certainty || 'approximate';
    let year = payload.year;
    let year_end = payload.year_end;
    let life_stage = payload.life_stage;
    let date = payload.date;

    if (mode === 'exact') {
      if (!date) {
        setStatus((prev) => ({ ...prev, [eventId]: 'Please select a date.' }));
        return;
      }
      const derivedYear = Number.parseInt(date.split('-')[0], 10);
      if (Number.isNaN(derivedYear)) {
        setStatus((prev) => ({ ...prev, [eventId]: 'Date must include a year.' }));
        return;
      }
      year = derivedYear;
      year_end = null;
      life_stage = null;
      timingInputType = 'date';
      timingCertainty = 'exact';
    } else if (mode === 'year') {
      if (!year || Number.isNaN(Number(year))) {
        setStatus((prev) => ({ ...prev, [eventId]: 'Please enter a year.' }));
        return;
      }
      timingInputType = year_end ? 'year_range' : 'year';
      timingCertainty = timingCertainty || 'approximate';
      life_stage = null;
      date = null;
      const rangeValidation = validateYearRange(year, year_end);
      if (!rangeValidation.valid) {
        setStatus((prev) => ({ ...prev, [eventId]: rangeValidation.error }));
        return;
      }
    } else if (mode === 'chapter') {
      if (!life_stage) {
        setStatus((prev) => ({ ...prev, [eventId]: 'Select a life stage.' }));
        return;
      }
      const stageRange = LIFE_STAGE_YEAR_RANGES[life_stage as keyof typeof LIFE_STAGE_YEAR_RANGES];
      if (stageRange) {
        year = stageRange[0];
        year_end = stageRange[1];
      }
      timingInputType = 'life_stage';
      timingCertainty = 'approximate';
      date = null;
    }

    if (
      payload.age_start !== null
      && payload.age_end !== null
      && payload.age_end < payload.age_start
    ) {
      setStatus((prev) => ({ ...prev, [eventId]: 'Age range end must be later.' }));
      return;
    }

    setLlmMessages((prev) => ({ ...prev, [eventId]: null }));
    setLlmReasons((prev) => ({ ...prev, [eventId]: [] }));

    setStatus((prev) => ({ ...prev, [eventId]: 'saving' }));
    try {
      const attachment = attachments[eventId];
      const attachment_type =
        attachment && attachment.url.trim() ? attachment.type : 'none';
      const attachment_url = attachment?.url?.trim() || '';
      const attachment_caption = attachment?.caption?.trim() || '';

      const response = await fetch('/api/edit/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          event_id: eventId,
          year,
          year_end,
          date,
          age_start: payload.age_start,
          age_end: payload.age_end,
          life_stage,
          timing_certainty: timingCertainty,
          timing_input_type: timingInputType,
          timing_note: payload.timing_note,
          location: payload.location,
          // Sync people_involved: use person_refs if any have names, else preserve legacy
          people_involved: (() => {
            const namesFromRefs = (payload.person_refs || [])
              .map((p) => p.name)
              .filter((name) => name.trim());
            return namesFromRefs.length > 0 ? namesFromRefs : payload.people_involved;
          })(),
          provenance: payload.provenance.type,
          entry_type: payload.type,
          title: payload.title,
          content: payload.full_entry,
          why_included: trimmedWhy,
          source_name: trimmedSourceName,
          source_url: trimmedSourceUrl,
          privacy_level: payload.privacy_level,
          attachment_type,
          attachment_url,
          attachment_caption,
          references: {
            links: payload.references,
            people: (payload.person_refs || []).map((p) => ({
              ...p,
              role: mapToLegacyPersonRole(p.role),
            })),
          },
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 422) {
          setStatus((prev) => ({ ...prev, [eventId]: 'Blocked by LLM review.' }));
          setLlmMessages((prev) => ({
            ...prev,
            [eventId]: 'LLM review blocked saving. Please address the issues below.',
          }));
          setLlmReasons((prev) => ({ ...prev, [eventId]: result?.reasons || [] }));
          return;
        }
        setStatus((prev) => ({ ...prev, [eventId]: result?.error || 'Update failed.' }));
        return;
      }

      setStatus((prev) => ({ ...prev, [eventId]: 'saved' }));
      setIsDirty(false);
      setTimeout(() => {
        setStatus((prev) => ({ ...prev, [eventId]: '' }));
      }, 1800);
    } catch (err) {
      console.error(err);
      setStatus((prev) => ({ ...prev, [eventId]: 'error' }));
    }
  };

  const saveAsLinkedNote = async (eventId: string) => {
    const payload = formState[eventId];
    if (!payload) return;

    const trimmedWhy = (payload.why_included || '').trim();
    const derivedSource = provenanceToSource(payload.provenance);
    const trimmedSourceName = derivedSource.source_name;
    const trimmedSourceUrl = derivedSource.source_url;

    if (!trimmedWhy) {
      setStatus((prev) => ({ ...prev, [eventId]: "Please add why it's meaningful." }));
      return;
    }

    const mode = timingMode[eventId] ?? 'year';
    let timingInputType = payload.timing_input_type;
    let timingCertainty = payload.timing_certainty || 'approximate';
    let year = payload.year;
    let year_end = payload.year_end;
    let life_stage = payload.life_stage;
    let date = payload.date;

    if (mode === 'exact') {
      if (!date) {
        setStatus((prev) => ({ ...prev, [eventId]: 'Please select a date.' }));
        return;
      }
      const derivedYear = Number.parseInt(date.split('-')[0], 10);
      if (Number.isNaN(derivedYear)) {
        setStatus((prev) => ({ ...prev, [eventId]: 'Date must include a year.' }));
        return;
      }
      year = derivedYear;
      year_end = null;
      life_stage = null;
      timingInputType = 'date';
      timingCertainty = 'exact';
    } else if (mode === 'year') {
      if (!year || Number.isNaN(Number(year))) {
        setStatus((prev) => ({ ...prev, [eventId]: 'Please enter a year.' }));
        return;
      }
      timingInputType = year_end ? 'year_range' : 'year';
      timingCertainty = timingCertainty || 'approximate';
      life_stage = null;
      date = null;
      const rangeValidation = validateYearRange(year, year_end);
      if (!rangeValidation.valid) {
        setStatus((prev) => ({ ...prev, [eventId]: rangeValidation.error }));
        return;
      }
    } else if (mode === 'chapter') {
      if (!life_stage) {
        setStatus((prev) => ({ ...prev, [eventId]: 'Select a life stage.' }));
        return;
      }
      const stageRange = LIFE_STAGE_YEAR_RANGES[life_stage as keyof typeof LIFE_STAGE_YEAR_RANGES];
      if (stageRange) {
        year = stageRange[0];
        year_end = stageRange[1];
      }
      timingInputType = 'life_stage';
      timingCertainty = 'approximate';
      date = null;
    }

    if (
      payload.age_start !== null
      && payload.age_end !== null
      && payload.age_end < payload.age_start
    ) {
      setStatus((prev) => ({ ...prev, [eventId]: 'Age range end must be later.' }));
      return;
    }

    setLlmMessages((prev) => ({ ...prev, [eventId]: null }));
    setLlmReasons((prev) => ({ ...prev, [eventId]: [] }));
    setStatus((prev) => ({ ...prev, [eventId]: 'linking' }));
    try {
      const attachment = attachments[eventId];
      const attachment_type =
        attachment && attachment.url.trim() ? attachment.type : 'none';
      const attachment_url = attachment?.url?.trim() || '';
      const attachment_caption = attachment?.caption?.trim() || '';

          const response = await fetch('/api/edit/linked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          event_id: eventId,
          relationship: linkRelationships[eventId] || 'perspective',
          relationship_note: linkNotes[eventId] || '',
          year,
          year_end,
          date,
          age_start: payload.age_start,
          age_end: payload.age_end,
          life_stage,
          timing_certainty: timingCertainty,
          timing_input_type: timingInputType,
          timing_note: payload.timing_note,
          location: payload.location,
          people_involved: (() => {
            const namesFromRefs = (payload.person_refs || [])
              .map((p) => p.name)
              .filter((name) => name.trim());
            return namesFromRefs.length > 0 ? namesFromRefs : payload.people_involved;
          })(),
          provenance: payload.provenance.type,
          entry_type: payload.type,
          title: payload.title,
          content: payload.full_entry,
          why_included: trimmedWhy,
          source_name: trimmedSourceName,
          source_url: trimmedSourceUrl,
          privacy_level: payload.privacy_level,
          attachment_type,
          attachment_url,
          attachment_caption,
          references: {
            links: payload.references,
            people: (payload.person_refs || []).map((p) => ({
              ...p,
              role: mapToLegacyPersonRole(p.role),
            })),
          },
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 422) {
          setStatus((prev) => ({ ...prev, [eventId]: 'Blocked by LLM review.' }));
          setLlmMessages((prev) => ({
            ...prev,
            [eventId]: 'LLM review blocked saving. Please address the issues below.',
          }));
          setLlmReasons((prev) => ({ ...prev, [eventId]: result?.reasons || [] }));
          return;
        }
        setStatus((prev) => ({ ...prev, [eventId]: result?.error || 'Linked note failed.' }));
        return;
      }

      setStatus((prev) => ({ ...prev, [eventId]: 'linked' }));
      setTimeout(() => {
        setStatus((prev) => ({ ...prev, [eventId]: '' }));
      }, 1800);
    } catch (err) {
      console.error(err);
      setStatus((prev) => ({ ...prev, [eventId]: 'link-error' }));
    }
  };

  const updateReferenceField = (
    eventId: string,
    index: number,
    field: 'display_name' | 'url',
    value: string
  ) => {
    setFormState((prev) => {
      const current = prev[eventId];
      if (!current) return prev;
      const nextRefs = [...current.references];
      nextRefs[index] = {
        ...nextRefs[index],
        [field]: value,
      };
      setIsDirty(true);
      return {
        ...prev,
        [eventId]: { ...current, references: nextRefs },
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
      setIsDirty(true);
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
      setIsDirty(true);
      return {
        ...prev,
        [eventId]: {
          ...current,
          person_refs: [
            ...(current.person_refs || []),
            { name: '', relationship: '', role: 'witness' as const, phone: '' },
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
      setIsDirty(true);
      return {
        ...prev,
        [eventId]: { ...current, person_refs: nextPeople },
      };
    });
  };

  const addReference = (eventId: string) => {
    setFormState((prev) => {
      const current = prev[eventId];
      if (!current) return prev;
      setIsDirty(true);
      return {
        ...prev,
        [eventId]: {
          ...current,
          references: [...current.references, { display_name: '', url: '' }],
        },
      };
    });
  };

  const removeReference = (eventId: string, index: number) => {
    setFormState((prev) => {
      const current = prev[eventId];
      if (!current) return prev;
      const nextRefs = [...current.references];
      nextRefs.splice(index, 1);
      setIsDirty(true);
      return {
        ...prev,
        [eventId]: { ...current, references: nextRefs },
      };
    });
  };

  // Shared component handlers
  const updateProvenance = (eventId: string, provenance: ProvenanceData) => {
    setFormState((prev) => {
      const current = prev[eventId];
      if (!current) return prev;
      setIsDirty(true);
      return {
        ...prev,
        [eventId]: { ...current, provenance },
      };
    });
  };

  const updatePeople = (eventId: string, people: PersonReference[]) => {
    setFormState((prev) => {
      const current = prev[eventId];
      if (!current) return prev;
      setIsDirty(true);
      return {
        ...prev,
        [eventId]: {
          ...current,
          person_refs: people.map((p) => ({
            id: p.id,
            person_id: p.personId,
            name: p.name,
            relationship: p.relationship,
            role: p.role,
            phone: p.phone,
          })),
        },
      };
    });
  };

  const updateReferences = (eventId: string, refs: Reference[]) => {
    setFormState((prev) => {
      const current = prev[eventId];
      if (!current) return prev;
      setIsDirty(true);
      return {
        ...prev,
        [eventId]: {
          ...current,
          references: refs.map((r) => ({
            id: r.id,
            display_name: r.displayName,
            url: r.url,
          })),
        },
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
                    {stripHtml(event.full_entry || '') || 'No text added yet.'}
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
                  <p className={formStyles.hint}>Choose one way to place this memory in time</p>

                  <TimingModeSelector
                    mode={timingMode[event.id] ?? 'year'}
                    onModeChange={(mode) => {
                      setTimingMode((prev) => ({ ...prev, [event.id]: mode }));
                      if (mode === 'exact') {
                        updateField(event.id, 'timing_certainty', 'exact');
                        updateField(event.id, 'timing_input_type', 'date');
                      } else if (mode === 'year') {
                        updateField(event.id, 'timing_input_type', data.year_end ? 'year_range' : 'year');
                      } else if (mode === 'chapter') {
                        updateField(event.id, 'timing_input_type', 'life_stage');
                        updateField(event.id, 'timing_certainty', 'approximate');
                      }
                    }}
                    data={{
                      exactDate: data.date ?? '',
                      year: data.year,
                      yearEnd: data.year_end,
                      lifeStage: data.life_stage ?? '',
                    }}
                    onDataChange={(field, value) => {
                      if (field === 'exactDate') {
                        updateField(event.id, 'date', value as string);
                      } else if (field === 'year') {
                        updateField(event.id, 'year', value?.toString() ?? '');
                      } else if (field === 'yearEnd') {
                        updateField(event.id, 'year_end', value?.toString() ?? '');
                      } else if (field === 'lifeStage') {
                        updateField(event.id, 'life_stage', value as string);
                      }
                    }}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={formStyles.label}>Timing certainty</label>
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
                      <label className={formStyles.label}>Timing note (optional)</label>
                      <textarea
                        value={data.timing_note || ''}
                        onChange={(e) => updateField(event.id, 'timing_note', e.target.value)}
                        rows={2}
                        className={formStyles.textarea}
                      />
                    </div>
                  </div>
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

                {event.type === 'origin' ? (
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <p className={formStyles.hint}>
                      This synchronicity is recorded as your personal observation.
                    </p>
                  </div>
                ) : (
                  <ProvenanceSection
                    value={data.provenance}
                    onChange={(prov) => updateProvenance(event.id, prov)}
                    required
                  />
                )}

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
                      return generatePreviewFromHtml(
                        data.full_entry || data.preview || '',
                        PREVIEW_MAX_LENGTH
                      );
                    })()}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white/70 text-sm cursor-not-allowed"
                  />
                </div>

                <div>
                  {!whyOpen[event.id] && !data.why_included ? (
                    <button
                      type="button"
                      onClick={() => setWhyOpen((prev) => ({ ...prev, [event.id]: true }))}
                      className={formStyles.buttonGhost}
                    >
                      <span className={formStyles.disclosureArrow}>▶</span>
                      Add why it&apos;s meaningful
                    </button>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between">
                        <label className={formStyles.label}>
                          Why it&apos;s meaningful <span className={formStyles.required}>*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setWhyOpen((prev) => ({ ...prev, [event.id]: false }));
                            updateField(event.id, 'why_included', '');
                          }}
                          className="text-xs text-white/40 hover:text-white transition-colors"
                        >
                          Hide
                        </button>
                      </div>
                      <RichTextEditor
                        value={data.why_included || ''}
                        onChange={(val) => updateField(event.id, 'why_included', val)}
                        placeholder="Explain the connection or significance"
                        minHeight="80px"
                      />
                    </div>
                  )}
                </div>

                {/* People references - only for memories */}
                {event.type === 'memory' && (
                  <PeopleSection
                    value={(data.person_refs || []).map((p) => ({
                      id: p.id,
                      personId: p.person_id,
                      name: p.name,
                      relationship: p.relationship,
                      role: p.role,
                      phone: p.phone,
                    }))}
                    onChange={(people) => updatePeople(event.id, people)}
                    mode="cards"
                    showTypeahead={false}
                  />
                )}

                <div className="opacity-50">
                  <div className="flex items-center gap-2">
                    <label className={formStyles.label}>Privacy</label>
                    <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded text-white/40">Coming soon</span>
                  </div>
                  <select
                    disabled
                    value="family"
                    className={`${formStyles.select} cursor-not-allowed`}
                  >
                    <option value="family">Family (default)</option>
                  </select>
                  <p className={formStyles.hint}>
                    Privacy settings are being finalized with family input.
                  </p>
                </div>

                {/* References (external links) */}
                <ReferencesSection
                  value={data.references.map((r) => ({
                    id: r.id,
                    displayName: r.display_name,
                    url: r.url,
                  }))}
                  onChange={(refs) => updateReferences(event.id, refs)}
                />

                {/* Attachments */}
                <div className={formStyles.section}>
                  <div className="flex items-center justify-between mb-3">
                    <p className={formStyles.sectionLabel}>Attachment</p>
                    {attachments[event.id]?.url ? (
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) => ({
                            ...prev,
                            [event.id]: { type: 'image', url: '', caption: '' },
                          }))
                        }
                        className="text-xs text-white/40 hover:text-white transition-colors"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={formStyles.label}>Type</label>
                      <select
                        value={attachments[event.id]?.type || 'image'}
                        onChange={(e) =>
                          setAttachments((prev) => ({
                            ...prev,
                            [event.id]: {
                              ...(prev[event.id] || { type: 'image', url: '', caption: '' }),
                              type: e.target.value as 'image' | 'audio' | 'link',
                            },
                          }))
                        }
                        className={formStyles.select}
                      >
                        <option value="image">Image</option>
                        <option value="audio">Audio</option>
                        <option value="link">Link</option>
                      </select>
                    </div>
                    <div>
                      <label className={formStyles.label}>URL</label>
                      <input
                        type="url"
                        value={attachments[event.id]?.url || ''}
                        onChange={(e) =>
                          setAttachments((prev) => ({
                            ...prev,
                            [event.id]: { ...(prev[event.id] || { type: 'image', url: '', caption: '' }), url: e.target.value },
                          }))
                        }
                        placeholder="https://..."
                        className={formStyles.input}
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className={formStyles.label}>Caption (optional)</label>
                    <input
                      type="text"
                      value={attachments[event.id]?.caption || ''}
                      onChange={(e) =>
                        setAttachments((prev) => ({
                          ...prev,
                          [event.id]: { ...(prev[event.id] || { type: 'image', url: '', caption: '' }), caption: e.target.value },
                        }))
                      }
                      placeholder="A short description"
                      className={formStyles.input}
                    />
                  </div>
                  <p className={formStyles.hint}>Leave URL blank if you don&apos;t want to attach anything.</p>
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
                    {statusText === 'linking' && (
                      <span className="text-xs text-white/50">Saving linked note...</span>
                    )}
                    {statusText === 'linked' && (
                      <span className={formStyles.success}>Linked note saved.</span>
                    )}
                    {statusText === 'error' && (
                      <span className={formStyles.error}>Could not save.</span>
                    )}
                    {statusText === 'link-error' && (
                      <span className={formStyles.error}>Could not save linked note.</span>
                    )}
                    {statusText && statusText !== 'saving' && statusText !== 'saved' && statusText !== 'linking' && statusText !== 'linked' && statusText !== 'error' && statusText !== 'link-error' && statusText !== 'deleting' && statusText !== 'delete-error' && (
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

                {(llmMessages[event.id] || (llmReasons[event.id] && llmReasons[event.id].length > 0)) && (
                  <div className="mt-3 space-y-2">
                    {llmMessages[event.id] && (
                      <p className="text-sm text-white/70">{llmMessages[event.id]}</p>
                    )}
                    {llmReasons[event.id] && llmReasons[event.id].length > 0 && (
                      <ul className="list-disc list-inside text-sm text-white/70">
                        {llmReasons[event.id].map((r, idx) => (
                          <li key={idx}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

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
