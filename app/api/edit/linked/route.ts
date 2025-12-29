import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { computeChainInfo, generatePreview, normalizePrivacyLevel } from '@/lib/memories';
import { buildInviteData } from '@/lib/invites';
import {
  normalizeLinkReferenceInput,
  normalizeReferenceRole,
  resolvePersonReferenceId,
  type LinkReferenceInput,
  type PersonReferenceInput,
} from '@/lib/edit-references';
import { createPersonLookupHelpers } from '@/lib/person-lookup';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

type LinkReferencePayload = LinkReferenceInput;
type PersonReferencePayload = PersonReferenceInput & {
  id?: unknown;
  role?: unknown;
  relationship?: unknown;
  relationship_to_subject?: unknown;
  phone?: unknown;
  name?: unknown;
  display_name?: unknown;
};
type ReferencesPayload = {
  links?: LinkReferencePayload[];
  people?: PersonReferencePayload[];
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      token,
      event_id,
      relationship,
      relationship_note,
      year,
      year_end,
      age_start,
      age_end,
      life_stage,
      timing_certainty,
      timing_input_type,
      date,
      timing_note,
      location,
      entry_type,
      title,
      content,
      why_included,
      source_name,
      source_url,
      privacy_level,
      sources,
      people_involved,
      references,
      attachment_type,
      attachment_url,
      attachment_caption,
    } = body;

    if (!token || !event_id) {
      return NextResponse.json({ error: 'Missing token or event' }, { status: 400 });
    }

    const { data: tokenRow }: {
      data: { id: string; contributor_id: string | null; expires_at: string | null } | null;
    } = await admin
      .from('edit_tokens')
      .select('id, contributor_id, expires_at')
      .eq('token', token)
      .single();

    if (!tokenRow?.contributor_id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }

    const { data: parentEvent }: {
      data: { id: string; contributor_id: string | null; root_event_id: string | null; chain_depth: number | null; subject_id: string | null } | null;
    } = await admin
      .from('timeline_events')
      .select('id, contributor_id, root_event_id, chain_depth, subject_id')
      .eq('id', event_id)
      .single();

    if (!parentEvent?.id || parentEvent.contributor_id !== tokenRow.contributor_id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const trimmedTitle = String(title || '').trim();
    const trimmedContent = String(content || '').trim();
    const trimmedWhy = String(why_included || '').trim();
    const trimmedSourceName = String(source_name || '').trim() || 'Personal memory';
    const trimmedSourceUrl = String(source_url || '').trim() || null;
    const parsedYear = Number.parseInt(String(year), 10);
    const parsedYearEnd = Number.parseInt(String(year_end), 10);
    const parsedAgeStart = Number.parseInt(String(age_start), 10);
    const parsedAgeEnd = Number.parseInt(String(age_end), 10);
    const parsedDate = typeof date === 'string' && date.includes('-') ? date : null;

    if (!trimmedTitle || !trimmedContent || !trimmedWhy || !trimmedSourceName) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const normalizedTimingCertainty = timing_certainty === 'exact'
      || timing_certainty === 'approximate'
      || timing_certainty === 'vague'
      ? timing_certainty
      : 'approximate';
    const normalizedTimingInputType = timing_input_type === 'date'
      || timing_input_type === 'year'
      || timing_input_type === 'year_range'
      || timing_input_type === 'age_range'
      || timing_input_type === 'life_stage'
      ? timing_input_type
      : 'year';
    const normalizedPrivacyLevel = normalizePrivacyLevel(privacy_level);
    const normalizedPeople =
      Array.isArray(people_involved)
        ? people_involved
          .map((p: unknown) => (typeof p === 'string' ? p.trim() : ''))
          .filter((p: string) => p.length > 0)
        : [];

    const allowedLifeStages = new Set(['childhood', 'teens', 'college', 'young_family', 'beyond']);
    const normalizedLifeStage = typeof life_stage === 'string' && allowedLifeStages.has(life_stage.trim())
      ? life_stage.trim()
      : null;

    const resolvedDateYear = parsedDate ? Number.parseInt(parsedDate.split('-')[0], 10) : null;
    const resolvedYear = !Number.isNaN(parsedYear) && parsedYear ? parsedYear : resolvedDateYear;
    const resolvedYearEnd = Number.isNaN(parsedYearEnd) ? null : parsedYearEnd;
    const resolvedAgeStart = Number.isNaN(parsedAgeStart) ? null : parsedAgeStart;
    const resolvedAgeEnd = Number.isNaN(parsedAgeEnd) ? null : parsedAgeEnd;

    if (!resolvedYear) {
      return NextResponse.json(
        { error: 'A year or exact date is required' },
        { status: 400 }
      );
    }

    if (normalizedTimingInputType === 'date' && !parsedDate) {
      return NextResponse.json(
        { error: 'Exact date is required when using date timing' },
        { status: 400 }
      );
    }

    if (
      resolvedYearEnd !== null
      && normalizedTimingInputType === 'year_range'
      && resolvedYearEnd < (resolvedYear || 0)
    ) {
      return NextResponse.json(
        { error: 'Year range end must be the same or later than the start year' },
        { status: 400 }
      );
    }

    if (resolvedAgeStart !== null && resolvedAgeEnd !== null && resolvedAgeEnd < resolvedAgeStart) {
      return NextResponse.json(
        { error: 'Age range end must be the same or older than the start age' },
        { status: 400 }
      );
    }

    const eventType =
      entry_type === 'origin'
        ? 'origin'
        : entry_type === 'milestone'
          ? 'milestone'
          : 'memory';

    const preview = generatePreview(trimmedContent);
    const chainInfo = computeChainInfo({
      id: parentEvent.id,
      root_event_id: parentEvent.root_event_id,
      chain_depth: parentEvent.chain_depth,
    });

    const { data: newEvent, error: insertError } = await (admin.from('timeline_events') as ReturnType<typeof admin.from>)
      .insert({
        year: resolvedYear,
        year_end: resolvedYearEnd,
        date: normalizedTimingInputType === 'date' ? parsedDate : null,
        type: eventType,
        title: trimmedTitle,
        full_entry: trimmedContent,
        preview,
        why_included: trimmedWhy,
        source_name: trimmedSourceName,
        source_url: trimmedSourceUrl,
        timing_certainty: normalizedTimingCertainty,
        timing_input_type: normalizedTimingInputType,
        age_start: resolvedAgeStart,
        age_end: resolvedAgeEnd,
        life_stage: normalizedLifeStage,
        timing_note: String(timing_note || '').trim() || null,
        location: String(location || '').trim() || null,
        privacy_level: normalizedPrivacyLevel,
        people_involved: normalizedPeople.length > 0 ? normalizedPeople : null,
        contributor_id: tokenRow.contributor_id,
        status: 'published',
        prompted_by_event_id: parentEvent.id,
        root_event_id: chainInfo.rootEventId,
        chain_depth: chainInfo.chainDepth,
        subject_id: parentEvent.subject_id ?? null,
      })
      .select('id')
      .single();

    if (insertError || !newEvent) {
      console.error('Supabase linked note insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save linked note' },
        { status: 500 }
      );
    }

    const newEventId = (newEvent as { id: string }).id;

    if (!chainInfo.rootEventId) {
      await (admin.from('timeline_events') as ReturnType<typeof admin.from>)
        .update({ root_event_id: newEventId })
        .eq('id', newEventId);
    }

    const allowedRelationships = new Set(['perspective', 'addition', 'correction', 'related']);
    const normalizedRelationship = allowedRelationships.has(relationship) ? relationship : 'perspective';
    const trimmedRelationshipNote = typeof relationship_note === 'string' ? relationship_note.trim() : '';

    await (admin.from('memory_threads') as ReturnType<typeof admin.from>).insert({
      original_event_id: parentEvent.id,
      response_event_id: newEventId,
      relationship: normalizedRelationship,
      note: trimmedRelationshipNote ? trimmedRelationshipNote : null,
    });

    const referencesPayload =
      references && typeof references === 'object'
        ? (references as ReferencesPayload)
        : null;
    const hasSourcesPayload = Object.prototype.hasOwnProperty.call(body, 'sources');
    const hasReferencesPayload = Object.prototype.hasOwnProperty.call(body, 'references');
    const hasLinkPayload =
      hasSourcesPayload ||
      (hasReferencesPayload && referencesPayload && Object.prototype.hasOwnProperty.call(referencesPayload, 'links'));
    const hasPersonPayload =
      hasReferencesPayload && referencesPayload && Object.prototype.hasOwnProperty.call(referencesPayload, 'people');
    const referenceLinks =
      referencesPayload && Array.isArray(referencesPayload.links)
        ? referencesPayload.links
        : null;
    const referencePeople =
      referencesPayload && Array.isArray(referencesPayload.people)
        ? referencesPayload.people
        : null;
    const linkRefs = hasLinkPayload
      ? referenceLinks ?? (Array.isArray(sources) ? (sources as LinkReferencePayload[]) : [])
      : null;
    const personRefs = hasPersonPayload
      ? referencePeople ?? []
      : null;

    if (hasLinkPayload || hasPersonPayload) {
      // Create person lookup helpers scoped to this contributor
      const { canUsePersonId, resolvePersonIdByName } = createPersonLookupHelpers(admin, tokenRow.contributor_id);

      let cachedSubmitterName: string | null = null;
      const getSubmitterName = async () => {
        if (cachedSubmitterName !== null) {
          return cachedSubmitterName;
        }
        const { data: contributorRow } = await admin
          .from('contributors')
          .select('name')
          .eq('id', tokenRow.contributor_id)
          .single();
        cachedSubmitterName = contributorRow?.name || 'Someone';
        return cachedSubmitterName;
      };

      const linkRows: Database['public']['Tables']['event_references']['Insert'][] = [];
      const personRows: Database['public']['Tables']['event_references']['Insert'][] = [];

      if (hasLinkPayload) {
        for (const raw of linkRefs || []) {
          if (!raw) continue;
          const normalized = normalizeLinkReferenceInput(raw, 'source');
          if (!normalized) {
            continue;
          }
          linkRows.push({
            event_id: newEventId,
            type: 'link',
            display_name: normalized.display_name,
            url: normalized.url,
            role: normalized.role,
            added_by: tokenRow.contributor_id,
          });
        }
      }

      if (hasPersonPayload) {
        for (const raw of personRefs || []) {
          if (!raw) continue;
          const role = normalizeReferenceRole(raw?.role, 'witness');
          const relationshipToSubject = String(raw?.relationship || raw?.relationship_to_subject || '').trim() || null;
          const personId = await resolvePersonReferenceId({
            ref: raw,
            canUsePersonId,
            resolvePersonIdByName,
          });

          if (!personId) {
            continue;
          }

          personRows.push({
            event_id: newEventId,
            type: 'person',
            person_id: personId,
            role,
            relationship_to_subject: relationshipToSubject,
            visibility: 'pending',
            added_by: tokenRow.contributor_id,
          });

          const phone = typeof raw?.phone === 'string' ? raw.phone.trim() : '';
          if (phone) {
            let inviteName = String(raw?.name || raw?.display_name || '').trim();
            if (!inviteName) {
              const { data: personRowsData } = await (admin.from('people') as ReturnType<typeof admin.from>)
                .select('canonical_name')
                .eq('id', personId)
                .limit(1);
              inviteName = (personRowsData && personRowsData[0] ? personRowsData[0].canonical_name : inviteName) as string;
            }

            const senderName = await getSubmitterName();
            const inviteData = buildInviteData(
              { name: inviteName || 'Someone', relationship: relationshipToSubject || '', phone },
              senderName
            );

            if (inviteData) {
              await (admin.from('invites') as ReturnType<typeof admin.from>)
                .insert({
                  event_id: newEventId,
                  recipient_name: inviteData.recipient_name,
                  recipient_contact: inviteData.recipient_contact,
                  method: inviteData.method,
                  message: inviteData.message,
                  sender_id: tokenRow.contributor_id,
                  status: 'pending',
                });
            }
          }
        }
      }

      const allRows: Database['public']['Tables']['event_references']['Insert'][] = [...linkRows, ...personRows];
      if (allRows.length > 0) {
        const { error: refError } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
          .insert(allRows);
        if (refError) {
          throw refError;
        }
      }
    }

    const trimmedAttachmentUrl = typeof attachment_url === 'string' ? attachment_url.trim() : '';
    if (trimmedAttachmentUrl && attachment_type && attachment_type !== 'none') {
      const mediaType = attachment_type === 'image'
        ? 'photo'
        : attachment_type === 'audio'
          ? 'audio'
          : 'document';
      const { data: mediaData, error: mediaError } = await (admin.from('media') as ReturnType<typeof admin.from>)
        .insert({
          type: mediaType,
          url: trimmedAttachmentUrl,
          caption: typeof attachment_caption === 'string' ? attachment_caption.trim() || null : null,
          year: resolvedYear,
          uploaded_by: tokenRow.contributor_id,
        })
        .select()
        .single();

      if (mediaError) {
        console.error('Supabase media insert error:', mediaError);
        return NextResponse.json(
          { error: 'Failed to save attachment' },
          { status: 500 }
        );
      }

      const mediaId = (mediaData as { id?: string } | null)?.id;
      if (mediaId) {
        const { error: linkError } = await (admin.from('event_media') as ReturnType<typeof admin.from>)
          .insert({
            event_id: newEventId,
            media_id: mediaId,
          });
        if (linkError) {
          console.error('Supabase event media insert error:', linkError);
        }
      }
    }

    const tokenUpdate: Database['public']['Tables']['edit_tokens']['Update'] = {
      used_at: new Date().toISOString(),
    };
    await admin
      .from('edit_tokens')
      .update(tokenUpdate)
      .eq('id', tokenRow.id);

    return NextResponse.json({ success: true, event_id: newEventId });
  } catch (error) {
    console.error('Edit linked note error:', error);
    return NextResponse.json({ error: 'Failed to save linked note' }, { status: 500 });
  }
}
