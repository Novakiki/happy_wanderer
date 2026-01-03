'use client';

import type { PersonReference, ProvenanceData, Reference } from '@/lib/form-types';
import {
  deriveProvenanceFromSource,
  mapLegacyPersonRole,
  mapToLegacyPersonRole,
  provenanceToRecurrence,
  provenanceToSource,
  provenanceToWitnessType,
} from '@/lib/form-types';
import { buildTimingRawText, validateYearRange } from '@/lib/form-validation';
import { stripHtml } from '@/lib/html-utils';
import { buildSmsLink } from '@/lib/invites';
import type { ReferenceVisibility } from '@/lib/references';
import { formStyles } from '@/lib/styles';
import {
  ENTRY_TYPE_DESCRIPTIONS,
  ENTRY_TYPE_LABELS,
  LIFE_STAGE_YEAR_RANGES,
} from '@/lib/terminology';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { DisclosureSection, NoteContentSection, PeopleSection, ProvenanceSection, ReferencesSection } from './forms';
import type { TimingMode } from './forms/TimingModeSelector';
import { TimingModeSelector } from './forms/TimingModeSelector';

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
  timing_raw_text: string | null;
  witness_type: 'direct' | 'secondhand' | 'mixed' | 'unsure';
  recurrence: 'one_time' | 'repeated' | 'ongoing';
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

type NoteMention = {
  id: string;
  mention_text: string;
  status?: string | null;
  visibility?: string | null;
  display_label?: string | null;
  promoted_person_id?: string | null;
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
  timing_raw_text?: string | null;
  witness_type?: string | null;
  recurrence?: string | null;
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
  mentions?: NoteMention[];
};

type Props = {
  token: string;
  contributorName: string;
  events: IncomingEvent[];
  initialEditingId?: string | null;
};

type LintWarning = {
  code: string;
  message: string;
  suggestion?: string;
  severity?: 'soft' | 'strong';
  match?: string;
};

type InviteSummary = {
  id: string;
  recipient_name: string;
  recipient_contact: string;
  method: string;
  status: string;
  sent_at?: string | null;
  opened_at?: string | null;
  contributed_at?: string | null;
};

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
        timing_raw_text: event.timing_raw_text ?? null,
        witness_type: (event.witness_type ?? 'direct') as EditableEvent['witness_type'],
        recurrence: (event.recurrence ?? 'one_time') as EditableEvent['recurrence'],
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
  const [mentionsByEvent, setMentionsByEvent] = useState<Record<string, NoteMention[]>>(() =>
    initialEvents.reduce((acc, event) => {
      acc[event.id] = (event.mentions ?? []).map((mention) => ({
        ...mention,
        status: mention.status ?? 'pending',
        visibility: mention.visibility ?? 'pending',
        display_label: mention.display_label ?? null,
      }));
      return acc;
    }, {} as Record<string, NoteMention[]>)
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
  const [guidanceWhyOpen, setGuidanceWhyOpen] = useState<Record<string, boolean>>(() =>
    initialEvents.reduce((acc, event) => {
      acc[event.id] = false;
      return acc;
    }, {} as Record<string, boolean>)
  );
  const [timingNoteOpen, setTimingNoteOpen] = useState<Record<string, boolean>>(() =>
    initialEvents.reduce((acc, event) => {
      acc[event.id] = Boolean(event.timing_note);
      return acc;
    }, {} as Record<string, boolean>)
  );
  const [locationOpen, setLocationOpen] = useState<Record<string, boolean>>(() =>
    initialEvents.reduce((acc, event) => {
      acc[event.id] = Boolean(event.location);
      return acc;
    }, {} as Record<string, boolean>)
  );
  const [llmMessages, setLlmMessages] = useState<Record<string, string | null>>({});
  const [llmReasons, setLlmReasons] = useState<Record<string, string[]>>({});
  const [lintWarningsById, setLintWarningsById] = useState<Record<string, LintWarning[]>>({});
  const [invitesByEvent, setInvitesByEvent] = useState<Record<string, InviteSummary[]>>({});
  const [inviteStatus, setInviteStatus] = useState<Record<string, string>>({});
  const [connectionsLoading, setConnectionsLoading] = useState<Record<string, boolean>>({});
  const connectionsRefs = useRef<Record<string, HTMLDivElement | null>>({}).current;

  useEffect(() => {
    if (!initialEditingId) return;
    if (events.some((event) => event.id === initialEditingId)) {
      setEditingId(initialEditingId);
    }
  }, [initialEditingId, events]);

  useEffect(() => {
    // Preload invites for all events
    const controller = new AbortController();
    const fetchInvites = async (eventId: string) => {
      setConnectionsLoading((prev) => ({ ...prev, [eventId]: true }));
      try {
        const res = await fetch(`/api/edit/invites?token=${encodeURIComponent(token)}&event_id=${eventId}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (data?.invites) {
          setInvitesByEvent((prev) => ({ ...prev, [eventId]: data.invites as InviteSummary[] }));
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.warn('Invite fetch failed', err);
        }
      } finally {
        setConnectionsLoading((prev) => ({ ...prev, [eventId]: false }));
      }
    };

    initialEvents.forEach((event) => {
      fetchInvites(event.id);
    });

    return () => controller.abort();
  }, [initialEvents, token]);

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

  const scrollToConnections = (eventId: string) => {
    const ref = connectionsRefs[eventId];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const getConnectionSummary = (eventId: string, data: EditableEvent) => {
    const invites = invitesByEvent[eventId] ?? [];
    const existingContacts = new Set(invites.map((i) => i.recipient_contact));

    let ready = 0;

    if (data.provenance?.type === 'secondhand' && data.provenance.toldByPhone && data.provenance.toldByName) {
      const phone = data.provenance.toldByPhone.trim();
      if (phone && !existingContacts.has(phone)) {
        ready += 1;
      }
    }

    (data.person_refs || []).forEach((p) => {
      const phone = p.phone?.trim();
      if (phone && !existingContacts.has(phone)) {
        ready += 1;
      }
    });

    const contributed = invites.filter((i) => i.status === 'contributed').length;

    return {
      invitesCount: invites.length,
      contributedCount: contributed,
      readyCount: ready,
    };
  };

  const handleManageInvites = (eventId: string) => {
    setEditingId(eventId);
    // allow render to occur before scrolling
    setTimeout(() => scrollToConnections(eventId), 50);
  };

  const upsertInvite = async (
    eventId: string,
    payload: { name: string; contact: string; relationship?: string | null }
  ) => {
    setInviteStatus((prev) => ({ ...prev, [eventId]: `Sending to ${payload.name}...` }));
    try {
      const res = await fetch('/api/edit/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          event_id: eventId,
          recipient_name: payload.name,
          recipient_contact: payload.contact,
          relationship_to_subject: payload.relationship || '',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteStatus((prev) => ({ ...prev, [eventId]: data?.error || 'Could not send invite.' }));
        return;
      }

      const smsLink = data?.sms_link as string | null | undefined;
      if (smsLink) {
        window.open(smsLink, '_blank');
      }
      // Refresh invites
      const refresh = await fetch(`/api/edit/invites?token=${encodeURIComponent(token)}&event_id=${eventId}`);
      if (refresh.ok) {
        const refreshed = await refresh.json().catch(() => null);
        if (refreshed?.invites) {
          setInvitesByEvent((prev) => ({ ...prev, [eventId]: refreshed.invites as InviteSummary[] }));
        }
      }
      setInviteStatus((prev) => ({ ...prev, [eventId]: 'Invite ready to text.' }));
      setTimeout(() => setInviteStatus((prev) => ({ ...prev, [eventId]: '' })), 2500);
    } catch (err) {
      console.error(err);
      setInviteStatus((prev) => ({ ...prev, [eventId]: 'Could not send invite.' }));
    }
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
      const timingRawText = buildTimingRawText({
        timingInputType: timingInputType as EditableEvent['timing_input_type'],
        exactDate: date,
        year,
        yearEnd: year_end,
        lifeStage: life_stage,
        ageStart: payload.age_start,
        ageEnd: payload.age_end,
      }) || payload.timing_raw_text || null;
      const witnessType = payload.witness_type || provenanceToWitnessType(payload.provenance);
      const recurrence = payload.recurrence || provenanceToRecurrence(payload.provenance);

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
          timing_raw_text: timingRawText,
          witness_type: witnessType,
          recurrence,
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
          attachment_type: 'none',
          attachment_url: '',
          attachment_caption: '',
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
        setLintWarningsById((prev) => ({
          ...prev,
          [eventId]: Array.isArray(result?.lintWarnings) ? result.lintWarnings : [],
        }));
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

      setLintWarningsById((prev) => ({
        ...prev,
        [eventId]: Array.isArray(result?.lintWarnings) ? result.lintWarnings : [],
      }));

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

  const updateMentionField = (eventId: string, mentionId: string, updates: Partial<NoteMention>) => {
    setMentionsByEvent((prev) => {
      const current = prev[eventId] ?? [];
      const next = current.map((mention) => (
        mention.id === mentionId ? { ...mention, ...updates } : mention
      ));
      return { ...prev, [eventId]: next };
    });
  };

  const upsertMention = (eventId: string, mention: NoteMention) => {
    setMentionsByEvent((prev) => {
      const current = prev[eventId] ?? [];
      const existingIndex = current.findIndex((item) => item.id === mention.id);
      const next = [...current];
      if (existingIndex >= 0) {
        next[existingIndex] = { ...current[existingIndex], ...mention };
      } else {
        next.push(mention);
      }
      return { ...prev, [eventId]: next };
    });
  };

  const handleMentionAction = async (
    eventId: string,
    mention: NoteMention,
    action: 'context' | 'ignore' | 'promote'
  ) => {
    try {
      const response = await fetch('/api/edit/mentions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          mention_id: mention.id,
          action,
          display_label: mention.display_label?.trim() || null,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Mention update failed');
      }

      if (result.mention) {
        upsertMention(eventId, result.mention as NoteMention);
      }

      if (result.reference?.person) {
        setFormState((prev) => {
          const current = prev[eventId];
          if (!current) return prev;
          const personId = result.reference.person.id as string | undefined;
          if (!personId) return prev;
          if (current.person_refs.some((ref) => ref.person_id === personId)) {
            return prev;
          }
          const nextRefs: EditableEvent['person_refs'] = [
            ...(current.person_refs || []),
            {
              person_id: personId,
              name: result.reference.person.name || mention.mention_text,
              relationship: '',
              role: 'related',
              phone: '',
            },
          ];
          return { ...prev, [eventId]: { ...current, person_refs: nextRefs } };
        });
      }
    } catch (err) {
      console.error(err);
      setStatus((prev) => ({ ...prev, [eventId]: 'mention update failed' }));
    }
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
        <div className="space-y-3 text-white/60">
          <div>No notes found for this email.</div>
          <Link
            href="/share"
            className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors underline underline-offset-4"
          >
            Add a new note →
          </Link>
        </div>
      )}

      {events.map((event) => {
        const data = formState[event.id];
        const isEditing = editingId === event.id;
        const statusText = status[event.id];
        const summaryEvent = data || event;
        const mentions = mentionsByEvent[event.id] ?? [];

        return (
          <div key={event.id} className={formStyles.section}>
            {!isEditing ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-white/50">{formatYearLabel(summaryEvent)}</p>
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

                {(() => {
                  const summary = getConnectionSummary(event.id, summaryEvent as EditableEvent);
                  const hasConnections = summary.invitesCount > 0 || summary.readyCount > 0;
                  return (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
                      <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">
                        Invites: {summary.invitesCount}
                      </span>
                      <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">
                        Ready: {summary.readyCount}
                      </span>
                      {summary.contributedCount > 0 && (
                        <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5">
                          Responses: {summary.contributedCount}
                        </span>
                      )}
                      {hasConnections && (
                        <button
                          type="button"
                          onClick={() => handleManageInvites(event.id)}
                          className="ml-auto text-[#e07a5f] hover:text-white transition-colors"
                        >
                          Manage invites
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : null}

            {isEditing && data && (
              <div className="space-y-6">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="text-xs uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors"
                  >
                    Close
                  </button>
                </div>

                {/* Entry type - at top, like add form */}
                <div>
                  <label className={formStyles.label}>Entry type</label>
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

                {/* YOUR NOTE - card matching add form */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5">
                  <p className={formStyles.sectionLabel}>Your Note</p>
                  <p className={`${formStyles.hint} mb-4`}>This appears on the timeline</p>

                  <NoteContentSection
                    title={data.title}
                    content={data.full_entry || ''}
                    whyIncluded={data.why_included || ''}
                    entryType={data.type || 'memory'}
                    onTitleChange={(val) => updateField(event.id, 'title', val)}
                    onContentChange={(val) => updateField(event.id, 'full_entry', val)}
                    onWhyIncludedChange={(val) => updateField(event.id, 'why_included', val)}
                    lintWarnings={lintWarningsById[event.id] || []}
                    showGuidanceWhy={guidanceWhyOpen[event.id] || false}
                    onToggleGuidanceWhy={() => setGuidanceWhyOpen((prev) => ({ ...prev, [event.id]: !prev[event.id] }))}
                    showWhyMeaningful={whyOpen[event.id] || false}
                    onToggleWhyMeaningful={(open: boolean) => setWhyOpen((prev) => ({ ...prev, [event.id]: open }))}
                    showTitle={true}
                    showPreview={false}
                  />

                  {/* References - sources that support this note */}
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <ReferencesSection
                      value={data.references.map((r) => ({
                        id: r.id,
                        displayName: r.display_name,
                        url: r.url,
                      }))}
                      onChange={(refs) => updateReferences(event.id, refs)}
                    />
                  </div>

                  {mentions.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-white/10">
                      <p className={formStyles.sectionLabel}>Detected names</p>
                      <p className={`${formStyles.hint} mb-3`}>
                        These are suggestions from the name detector. Promote only when you intend to create a person.
                      </p>
                      <div className="space-y-3">
                        {mentions.map((mention) => {
                          const statusLabel = mention.status ?? 'pending';
                          const isResolved = statusLabel === 'promoted' || statusLabel === 'ignored';

                          return (
                            <div key={mention.id} className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm text-white">{mention.mention_text}</p>
                                  <p className="text-xs text-white/40 mt-1 capitalize">
                                    {statusLabel}
                                  </p>
                                </div>
                                {statusLabel === 'promoted' && (
                                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#e07a5f]">
                                    Promoted
                                  </span>
                                )}
                              </div>

                              {!isResolved && (
                                <div className="mt-3 space-y-2">
                                  <input
                                    type="text"
                                    value={mention.display_label ?? ''}
                                    onChange={(e) =>
                                      updateMentionField(event.id, mention.id, { display_label: e.target.value })
                                    }
                                    placeholder="Context label (e.g., a neighbor)"
                                    className={formStyles.inputSmall}
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      className={formStyles.buttonSecondary}
                                      onClick={() => handleMentionAction(event.id, mention, 'context')}
                                    >
                                      Keep as context
                                    </button>
                                    <button
                                      type="button"
                                      className={formStyles.buttonSecondary}
                                      onClick={() => handleMentionAction(event.id, mention, 'promote')}
                                    >
                                      Make person
                                    </button>
                                    <button
                                      type="button"
                                      className={formStyles.buttonSecondary}
                                      onClick={() => handleMentionAction(event.id, mention, 'ignore')}
                                    >
                                      Ignore
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* WHEN & WHERE */}
                <div className={formStyles.section}>
                  <p className={formStyles.sectionLabel}>When & Where</p>
                  <p className={`${formStyles.hint} mb-4`}>Choose one way to place this memory in time</p>

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

                  {/* Optional timing details - disclosure pattern */}
                  <div className="flex flex-col items-start gap-3 mt-6">
                    <DisclosureSection
                      label="Timing note"
                      isOpen={timingNoteOpen[event.id] || false}
                      onToggle={(open) => setTimingNoteOpen((prev) => ({ ...prev, [event.id]: open }))}
                      hasContent={!!data.timing_note}
                      onClear={() => updateField(event.id, 'timing_note', '')}
                    >
                      <input
                        type="text"
                        value={data.timing_note || ''}
                        onChange={(e) => updateField(event.id, 'timing_note', e.target.value)}
                        placeholder="e.g., Summer before college, around Christmas"
                        className={formStyles.input}
                      />
                    </DisclosureSection>

                    <DisclosureSection
                      label="Location"
                      isOpen={locationOpen[event.id] || false}
                      onToggle={(open) => setLocationOpen((prev) => ({ ...prev, [event.id]: open }))}
                      hasContent={!!data.location}
                      onClear={() => updateField(event.id, 'location', '')}
                    >
                      <input
                        type="text"
                        value={data.location || ''}
                        onChange={(e) => updateField(event.id, 'location', e.target.value)}
                        placeholder="e.g., Riverton, UT or Anchorage, AK"
                        className={formStyles.input}
                      />
                    </DisclosureSection>
                  </div>
                </div>

                {/* THE CHAIN - provenance */}
                <div className={formStyles.section}>
                  <div className="flex items-center justify-between gap-3">
                    <p className={formStyles.sectionLabel}>The Chain</p>
                    <button
                      type="button"
                      onClick={() => scrollToConnections(event.id)}
                      className="text-xs text-white/50 hover:text-white transition-colors"
                    >
                      Manage invites
                    </button>
                  </div>
                  <p className={`${formStyles.hint} mb-4`}>
                    These fields help keep memories connected without turning them into a single official story.
                  </p>
                  <ProvenanceSection
                    value={data.provenance}
                    onChange={(prov) => updateProvenance(event.id, prov)}
                    required
                  />
                </div>

                {/* PEOPLE - separate section, only for memories */}
                {event.type === 'memory' && (
                  <div className={formStyles.section}>
                    <div className="flex items-center justify-between gap-3">
                      <p className={formStyles.sectionLabel}>People</p>
                      <button
                        type="button"
                        onClick={() => scrollToConnections(event.id)}
                        className="text-xs text-white/50 hover:text-white transition-colors"
                      >
                        Manage invites
                      </button>
                    </div>
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
                  </div>
                )}

                {/* CONNECTIONS - invites + outreach */}
                <div
                  className={formStyles.section}
                  ref={(el) => {
                    connectionsRefs[event.id] = el;
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={formStyles.sectionLabel}>Connections</p>
                      <p className={`${formStyles.hint} mb-2`}>Who you remember, who remembers you</p>
                    </div>
                    {connectionsLoading[event.id] && (
                      <span className="text-xs text-white/50">Loading...</span>
                    )}
                  </div>

                  {(() => {
                    const invites = invitesByEvent[event.id] ?? [];
                    const existingContacts = new Set(invites.map((i) => i.recipient_contact));
                    const potentials: Array<{ name: string; contact: string; source: string; relationship?: string | null }> = [];

                    // Provenance: storyteller
                    if (data.provenance?.type === 'secondhand' && data.provenance.toldByPhone && data.provenance.toldByName) {
                      const phone = data.provenance.toldByPhone.trim();
                      if (phone && !existingContacts.has(phone)) {
                        potentials.push({
                          name: data.provenance.toldByName.trim(),
                          contact: phone,
                          relationship: data.provenance.toldByRelationship || null,
                          source: 'Storyteller',
                        });
                      }
                    }

                    // People section
                    (data.person_refs || []).forEach((p) => {
                      const phone = p.phone?.trim();
                      if (phone && !existingContacts.has(phone)) {
                        potentials.push({
                          name: p.name || 'Someone',
                          contact: phone,
                          relationship: p.relationship || null,
                          source: 'People',
                        });
                      }
                    });

                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

                    return (
                      <div className="space-y-4">
                        {invites.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm text-white/70">Invites</p>
                            <div className="space-y-2">
                              {invites.map((invite) => {
                                const isSms = invite.method === 'sms';
                                const smsLink = isSms && invite.id ? buildSmsLink(invite.recipient_contact, invite.recipient_name, invite.id, baseUrl) : null;
                                const status = invite.status || 'pending';
                                const statusLabel =
                                  status === 'sent'
                                    ? 'Sent'
                                    : status === 'opened'
                                      ? 'Opened'
                                      : status === 'clicked'
                                        ? 'Clicked'
                                        : status === 'contributed'
                                          ? 'Contributed'
                                          : 'Pending';
                                return (
                                  <div
                                    key={invite.id}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                                  >
                                    <div>
                                      <p className="text-sm text-white">{invite.recipient_name}</p>
                                      <p className="text-xs text-white/50">{invite.recipient_contact}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-xs text-white/60 border border-white/15 rounded-full px-3 py-1">
                                        {statusLabel}
                                      </span>
                                      {smsLink && (
                                        <a
                                          href={smsLink}
                                          className="text-xs text-[#e07a5f] hover:text-white transition-colors"
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          Text link
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {potentials.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm text-white/70">Ready to invite</p>
                            <div className="space-y-2">
                              {potentials.map((p, idx) => (
                                <div
                                  key={`${p.contact}-${idx}`}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                                >
                                  <div>
                                    <p className="text-sm text-white">{p.name}</p>
                                    <p className="text-xs text-white/50">
                                      {p.contact} {p.relationship ? `· ${p.relationship}` : ''} {p.source ? `· ${p.source}` : ''}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => upsertInvite(event.id, { name: p.name, contact: p.contact, relationship: p.relationship })}
                                    className="text-xs text-[#e07a5f] hover:text-white transition-colors"
                                  >
                                    Send invite
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {invites.length === 0 && potentials.length === 0 && (
                          <p className="text-sm text-white/50">No invites yet. Add a phone number in People or The Chain to invite someone.</p>
                        )}

                        {inviteStatus[event.id] && (
                          <p className="text-xs text-white/60">{inviteStatus[event.id]}</p>
                        )}
                      </div>
                    );
                  })()}
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
                    className="text-xs text-white/50 hover:text-red-400 transition-colors"
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
