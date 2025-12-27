import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { normalizePrivacyLevel } from '@/lib/memories';
import { buildInviteData } from '@/lib/invites';
import {
  normalizeLinkReferenceInput,
  normalizeReferenceRole,
  resolvePersonReferenceId,
  type LinkReferenceInput,
  type PersonReferenceInput,
} from '@/lib/edit-references';

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
      year,
      year_end,
      age_start,
      age_end,
      life_stage,
      timing_certainty,
      timing_input_type,
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

    const trimmedTitle = String(title || '').trim();
    const trimmedContent = String(content || '').trim();
    const trimmedWhy = String(why_included || '').trim();
    const trimmedSourceName = String(source_name || '').trim() || 'Personal memory';
    const parsedYear = Number.parseInt(String(year), 10);
    const parsedYearEnd = Number.parseInt(String(year_end), 10);
    const parsedAgeStart = Number.parseInt(String(age_start), 10);
    const parsedAgeEnd = Number.parseInt(String(age_end), 10);

    if (!trimmedTitle || !trimmedContent || !trimmedWhy || !trimmedSourceName || !parsedYear || Number.isNaN(parsedYear)) {
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

    const resolvedYearEnd = Number.isNaN(parsedYearEnd) ? null : parsedYearEnd;
    const resolvedAgeStart = Number.isNaN(parsedAgeStart) ? null : parsedAgeStart;
    const resolvedAgeEnd = Number.isNaN(parsedAgeEnd) ? null : parsedAgeEnd;

    if (
      resolvedYearEnd !== null
      && normalizedTimingInputType === 'year_range'
      && resolvedYearEnd < parsedYear
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

    const preview =
      trimmedContent.length > 160
        ? `${trimmedContent.slice(0, 160).trimEnd()}...`
        : trimmedContent;

    const updatePayload: Database['public']['Tables']['timeline_events']['Update'] = {
      year: parsedYear,
      year_end: resolvedYearEnd,
      type: eventType,
      title: trimmedTitle,
      full_entry: trimmedContent,
      preview,
      why_included: trimmedWhy,
      source_name: trimmedSourceName,
      source_url: String(source_url || '').trim() || null,
      timing_certainty: normalizedTimingCertainty,
      timing_input_type: normalizedTimingInputType,
      age_start: resolvedAgeStart,
      age_end: resolvedAgeEnd,
      life_stage: normalizedLifeStage,
      timing_note: String(timing_note || '').trim() || null,
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
      const { data: existingRefs, error: existingError } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
        .select('id, type, person_id, url, display_name, role, relationship_to_subject, visibility')
        .eq('event_id', event_id);

      if (existingError) {
        throw existingError;
      }

      const existingRefsSafe = existingRefs || [];
      const existingById = new Map(existingRefsSafe.map((ref) => [ref.id, ref]));
      const existingLinks = existingRefsSafe.filter((ref) => ref.type === 'link' && ref.visibility !== 'removed');
      const existingPeople = existingRefsSafe.filter((ref) => ref.type === 'person' && ref.visibility !== 'removed');

      const linkKeepIds = new Set<string>();
      const personKeepIds = new Set<string>();
      const linkRows: Database['public']['Tables']['event_references']['Insert'][] = [];
      const personRows: Database['public']['Tables']['event_references']['Insert'][] = [];

      const canUsePersonIdCache = new Map<string, boolean>();
      const canUsePersonId = async (personId: string) => {
        if (canUsePersonIdCache.has(personId)) {
          return canUsePersonIdCache.get(personId) ?? false;
        }

        const { data: personRowsData } = await (admin.from('people') as ReturnType<typeof admin.from>)
          .select('id, visibility, created_by')
          .eq('id', personId)
          .limit(1);
        const personRow = personRowsData?.[0] as { visibility?: string | null; created_by?: string | null } | undefined;

        if (!personRow) {
          canUsePersonIdCache.set(personId, false);
          return false;
        }

        const baseVisibility = (personRow.visibility ?? 'pending') as 'approved' | 'pending' | 'anonymized' | 'blurred' | 'removed';
        if (baseVisibility === 'approved') {
          canUsePersonIdCache.set(personId, true);
          return true;
        }
        if (baseVisibility === 'removed') {
          canUsePersonIdCache.set(personId, false);
          return false;
        }

        if (tokenRow.contributor_id && personRow.created_by === tokenRow.contributor_id) {
          canUsePersonIdCache.set(personId, true);
          return true;
        }

        const { data: claimRows } = await (admin.from('person_claims') as ReturnType<typeof admin.from>)
          .select('id')
          .eq('person_id', personId)
          .eq('status', 'approved')
          .limit(1);
        if (claimRows && claimRows.length > 0) {
          canUsePersonIdCache.set(personId, true);
          return true;
        }

        if (tokenRow.contributor_id) {
          const { data: referenceRows } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
            .select('id')
            .eq('person_id', personId)
            .eq('added_by', tokenRow.contributor_id)
            .limit(1);
          if (referenceRows && referenceRows.length > 0) {
            canUsePersonIdCache.set(personId, true);
            return true;
          }
        }

        canUsePersonIdCache.set(personId, false);
        return false;
      };

      const resolvePersonIdByName = async (name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) return null;

        const { data: aliasRows } = await (admin.from('person_aliases') as ReturnType<typeof admin.from>)
          .select('person_id')
          .ilike('alias', trimmedName)
          .limit(5);
        if (aliasRows && aliasRows.length > 0) {
          for (const row of aliasRows as Array<{ person_id?: string | null }>) {
            if (row.person_id && await canUsePersonId(row.person_id)) {
              return row.person_id;
            }
          }
        }

        const { data: personRowsData } = await (admin.from('people') as ReturnType<typeof admin.from>)
          .select('id')
          .ilike('canonical_name', trimmedName)
          .limit(5);
        if (personRowsData && personRowsData.length > 0) {
          for (const row of personRowsData as Array<{ id?: string | null }>) {
            if (row.id && await canUsePersonId(row.id)) {
              await (admin.from('person_aliases') as ReturnType<typeof admin.from>)
                .insert({
                  person_id: row.id,
                  alias: trimmedName,
                  created_by: tokenRow.contributor_id,
                });
              return row.id;
            }
          }
        }

        const { data: newPerson } = await (admin.from('people') as ReturnType<typeof admin.from>)
          .insert({
            canonical_name: trimmedName,
            visibility: 'pending',
            created_by: tokenRow.contributor_id,
          })
          .select('id')
          .single();

        const newPersonId = (newPerson as { id?: string } | null)?.id ?? null;
        if (!newPersonId) return null;

        await (admin.from('person_aliases') as ReturnType<typeof admin.from>)
          .insert({
            person_id: newPersonId,
            alias: trimmedName,
            created_by: tokenRow.contributor_id,
          });

        return newPersonId;
      };

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
        for (const raw of personRefs || []) {
          if (!raw) continue;
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
          .filter((ref) => !linkKeepIds.has(ref.id))
          .map((ref) => ref.id);
        if (linkIdsToDelete.length > 0) {
          const { error: deleteError } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
            .delete()
            .in('id', linkIdsToDelete);
          if (deleteError) {
            throw deleteError;
          }
        }
      }

      if (hasPersonPayload) {
        const personIdsToDelete = existingPeople
          .filter((ref) => !personKeepIds.has(ref.id))
          .map((ref) => ref.id);
        if (personIdsToDelete.length > 0) {
          const { error: deleteError } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
            .delete()
            .in('id', personIdsToDelete);
          if (deleteError) {
            throw deleteError;
          }
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Edit update error:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}
