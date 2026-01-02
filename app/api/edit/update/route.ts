import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import {
  normalizePrivacyLevel,
  normalizeRecurrence,
  normalizeWitnessType,
} from '@/lib/memories';
import { hasContent, generatePreviewFromHtml, PREVIEW_MAX_LENGTH } from '@/lib/html-utils';
import { buildTimingRawText } from '@/lib/form-validation';
import { buildInviteData } from '@/lib/invites';
import { llmReviewGate } from '@/lib/llm-review';
import { lintNote } from '@/lib/note-lint';
import { detectAndStoreMentions } from '@/lib/pending-names';
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

type ExistingReference = {
  id: string;
  type: string;
  person_id: string | null;
  url: string | null;
  display_name: string | null;
  role: string | null;
  relationship_to_subject: string | null;
  visibility: string | null;
};

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
      year,
      year_end,
      age_start,
      age_end,
      life_stage,
      timing_certainty,
      timing_input_type,
      date,
      timing_note,
      timing_raw_text,
      witness_type,
      recurrence,
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

    const { data: event }: { data: { id: string; contributor_id: string | null } | null } = await admin
      .from('timeline_events')
      .select('id, contributor_id')
      .eq('id', event_id)
      .single();

    if (!event?.id || event.contributor_id !== tokenRow.contributor_id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const rawTitle = String(title || '');
    const rawContent = String(content || '');
    const rawWhy = String(why_included || '');
    const trimmedSourceName = String(source_name || '').trim() || 'Personal memory';
    const parsedYear = Number.parseInt(String(year), 10);
    const parsedYearEnd = Number.parseInt(String(year_end), 10);
    const parsedAgeStart = Number.parseInt(String(age_start), 10);
    const parsedAgeEnd = Number.parseInt(String(age_end), 10);
    const parsedDate = typeof date === 'string' && date.includes('-') ? date : null;

    // Use HTML-aware validation for rich text fields
    if (!hasContent(rawTitle) || !hasContent(rawContent) || !hasContent(rawWhy) || !trimmedSourceName) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // LLM review for safety (names are handled separately via pending references)
    const llmGate = await llmReviewGate(
      { title: rawTitle, content: rawContent, why: rawWhy },
      'LLM review blocked saving.'
    );
    if (!llmGate.ok) return llmGate.response;

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
    const normalizedWitnessType = normalizeWitnessType(witness_type);
    const normalizedRecurrence = normalizeRecurrence(recurrence);
    const normalizedPeople =
      Array.isArray(people_involved)
        ? people_involved
          .map((p: unknown) => (typeof p === 'string' ? p.trim() : ''))
          .filter((p: string) => p.length > 0)
        : [];
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

    const allowedLifeStages = new Set(['childhood', 'teens', 'college', 'young_family', 'beyond']);
    const normalizedLifeStage = typeof life_stage === 'string' && allowedLifeStages.has(life_stage.trim())
      ? life_stage.trim()
      : null;

    // Derive year from date if needed
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

    const preview = generatePreviewFromHtml(rawContent, PREVIEW_MAX_LENGTH);
    const lintWarnings = await lintNote(admin, rawContent);
    const trimmedTimingRawText = typeof timing_raw_text === 'string' ? timing_raw_text.trim() : '';
    const timingRawText = trimmedTimingRawText
      || buildTimingRawText({
        timingInputType: normalizedTimingInputType as 'date' | 'year' | 'year_range' | 'age_range' | 'life_stage',
        exactDate: parsedDate,
        year: resolvedYear,
        yearEnd: resolvedYearEnd,
        lifeStage: normalizedLifeStage,
        ageStart: resolvedAgeStart,
        ageEnd: resolvedAgeEnd,
      })
      || null;

    const updatePayload: Database['public']['Tables']['timeline_events']['Update'] = {
      year: resolvedYear ?? parsedYear,
      year_end: resolvedYearEnd,
      date: normalizedTimingInputType === 'date' ? parsedDate : null,
      type: eventType,
      title: rawTitle.trim(),
      full_entry: rawContent,
      preview,
      why_included: rawWhy,
      source_name: trimmedSourceName,
      source_url: String(source_url || '').trim() || null,
      timing_certainty: normalizedTimingCertainty,
      timing_input_type: normalizedTimingInputType,
      age_start: resolvedAgeStart,
      age_end: resolvedAgeEnd,
      life_stage: normalizedLifeStage,
      timing_note: String(timing_note || '').trim() || null,
      timing_raw_text: timingRawText,
      witness_type: normalizedWitnessType,
      recurrence: normalizedRecurrence,
      location: String(location || '').trim() || null,
      privacy_level: normalizedPrivacyLevel,
      people_involved: normalizedPeople.length > 0 ? normalizedPeople : null,
    };
    const { error: updateError } = await admin
      .from('timeline_events')
      .update(updatePayload)
      .eq('id', event_id);

    if (updateError) {
      throw updateError;
    }

    if (hasLinkPayload || hasPersonPayload) {
      const { data: existingRefs, error: existingError } = await admin
        .from('event_references')
        .select('id, type, person_id, url, display_name, role, relationship_to_subject, visibility')
        .eq('event_id', event_id);

      if (existingError) {
        throw existingError;
      }

      const existingRefsSafe: ExistingReference[] = (existingRefs || []) as ExistingReference[];
      const existingById = new Map(existingRefsSafe.map((ref: ExistingReference) => [ref.id, ref]));
      const existingLinks = existingRefsSafe.filter((ref: ExistingReference) => ref.type === 'link' && ref.visibility !== 'removed');
      const existingPeople = existingRefsSafe.filter((ref: ExistingReference) => ref.type === 'person' && ref.visibility !== 'removed');

      const linkKeepIds = new Set<string>();
      const personKeepIds = new Set<string>();
      const linkRows: Database['public']['Tables']['event_references']['Insert'][] = [];
      const personRows: Database['public']['Tables']['event_references']['Insert'][] = [];

      // Create person lookup helpers scoped to this contributor
      const { canUsePersonId, resolvePersonIdByName } = createPersonLookupHelpers(admin, tokenRow.contributor_id!);

      let cachedSubmitterName: string | null = null;
      const getSubmitterName = async () => {
        if (cachedSubmitterName !== null) {
          return cachedSubmitterName;
        }
        const { data: contributorRow } = await admin
          .from('contributors')
          .select('name')
          .eq('id', tokenRow.contributor_id!)
          .single();
        cachedSubmitterName = contributorRow?.name || 'Someone';
        return cachedSubmitterName;
      };

      const updateReference = async (
        id: string,
        updates: Database['public']['Tables']['event_references']['Update']
      ) => {
        const { error } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
          .update(updates)
          .eq('id', id);
        if (error) {
          throw error;
        }
      };

      if (hasLinkPayload) {
        for (const raw of linkRefs || []) {
          if (!raw) continue;
          const rawId = typeof raw?.id === 'string' ? raw.id : null;
          const existing = rawId ? existingById.get(rawId) : null;
          const activeExisting = existing && existing.visibility !== 'removed' ? existing : null;
          const fallbackRole = normalizeReferenceRole(activeExisting?.role, 'source');
          const normalized = normalizeLinkReferenceInput(raw, fallbackRole);

          if (!normalized) {
            continue;
          }

          if (activeExisting && activeExisting.type === 'link') {
            linkKeepIds.add(activeExisting.id);
            await updateReference(activeExisting.id, {
              display_name: normalized.display_name,
              url: normalized.url,
              role: normalized.role,
            });
          } else {
            linkRows.push({
              event_id,
              type: 'link',
              display_name: normalized.display_name,
              url: normalized.url,
              role: normalized.role,
              added_by: tokenRow.contributor_id,
            });
          }
        }
      }

      if (hasPersonPayload) {
        // Get contributor name once to filter out self-references
        const contributorNameLower = (await getSubmitterName()).toLowerCase();

        for (const raw of personRefs || []) {
          if (!raw) continue;

          // Skip if this person is the contributor themselves (they're already credited as author)
          const personName = String(raw?.name || raw?.display_name || '').trim();
          if (personName && personName.toLowerCase() === contributorNameLower) {
            continue;
          }

          const rawId = typeof raw?.id === 'string' ? raw.id : null;
          const existing = rawId ? existingById.get(rawId) : null;
          const activeExisting = existing && existing.visibility !== 'removed' ? existing : null;
          const fallbackRole = normalizeReferenceRole(activeExisting?.role, 'witness');
          const role = normalizeReferenceRole(raw?.role, fallbackRole);
          const relationship = String(raw?.relationship || raw?.relationship_to_subject || '').trim() || null;

          const personId = await resolvePersonReferenceId({
            ref: raw,
            existingPersonId: activeExisting?.person_id ?? undefined,
            canUsePersonId,
            resolvePersonIdByName,
          });

          if (!personId) {
            continue;
          }

          if (activeExisting && activeExisting.type === 'person') {
            personKeepIds.add(activeExisting.id);
            await updateReference(activeExisting.id, {
              person_id: personId,
              role,
              relationship_to_subject: relationship,
            });
          } else {
            personRows.push({
              event_id,
              type: 'person',
              person_id: personId,
              role,
              relationship_to_subject: relationship,
              visibility: 'pending',
              added_by: tokenRow.contributor_id,
            });
          }

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
              { name: inviteName || 'Someone', relationship: relationship || '', phone },
              senderName
            );

            if (inviteData) {
              const { data: existingInvite } = await (admin.from('invites') as ReturnType<typeof admin.from>)
                .select('id')
                .eq('event_id', event_id)
                .eq('recipient_contact', inviteData.recipient_contact)
                .limit(1);

              if (!existingInvite || existingInvite.length === 0) {
                await (admin.from('invites') as ReturnType<typeof admin.from>)
                  .insert({
                    event_id,
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
      }

      const allRows: Database['public']['Tables']['event_references']['Insert'][] = [...linkRows, ...personRows];
      if (allRows.length > 0) {
        const { error: refError } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
          .insert(allRows);
        if (refError) {
          throw refError;
        }
      }

      if (hasLinkPayload) {
        const linkIdsToDelete = existingLinks
          .filter((ref: ExistingReference) => !linkKeepIds.has(ref.id))
          .map((ref: ExistingReference) => ref.id);
        if (linkIdsToDelete.length > 0) {
          const { error: deleteError } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
            .update({ visibility: 'removed' })
            .in('id', linkIdsToDelete);
          if (deleteError) {
            throw deleteError;
          }
        }
      }

      if (hasPersonPayload) {
        const personIdsToDelete = existingPeople
          .filter((ref: ExistingReference) => !personKeepIds.has(ref.id))
          .map((ref: ExistingReference) => ref.id);
        if (personIdsToDelete.length > 0) {
          const { error: deleteError } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
            .update({ visibility: 'removed' })
            .in('id', personIdsToDelete);
          if (deleteError) {
            throw deleteError;
          }
        }
      }
    }

    // Optional attachment (creates new media record)
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
            event_id: event_id,
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

    // Detect names in content and store mention candidates (no people created)
    const nameResult = await detectAndStoreMentions(
      rawContent,
      event_id,
      admin,
      tokenRow.contributor_id
    );

    return NextResponse.json({
      success: true,
      mentionCandidates: nameResult.mentions,
      lintWarnings,
    });
  } catch (error) {
    console.error('Edit update error:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}
