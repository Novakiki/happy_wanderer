import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  validateMemoryInput,
  resolveTiming,
  normalizeEntryType,
  normalizePrivacyLevel,
  generatePreview,
  computeChainInfo,
  type ParentEventInfo,
} from '@/lib/memories';
import { shouldCreateInvite, buildInviteData } from '@/lib/invites';
import { createPersonLookupHelpers } from '@/lib/person-lookup';
// TODO: Enable geocoding when map feature is implemented
// import { geocodeLocation } from '@/lib/claude';

export async function POST(request: NextRequest) {
  try {
    // Require authenticated user via Supabase Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    const body = await request.json();

    const {
      content,
      contributor_id,
      submitter_name,
      submitter_relationship,
      submitter_email,
      entry_type,
      year,
      location,
      privacy_level,
      year_end,
      age_start,
      age_end,
      life_stage,
      timing_certainty,
      timing_input_type,
      timing_note,
      title,
      source_name,
      source_url,
      why_included,
      attachment_type,
      attachment_url,
      attachment_caption,
      references,
      heard_from,
      prompted_by_event_id,
      relationship,
      relationship_note,
    } = body;

    const trimmedSourceName = source_name?.trim() || 'Personal memory';

    // Validate required fields
    const validationErrors = validateMemoryInput({
      content,
      title,
      why_included,
      source_name: trimmedSourceName,
    });
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors[0].message },
        { status: 400 }
      );
    }

    // Resolve timing (handles year, age_range, life_stage conversions)
    const timingResult = resolveTiming({
      year,
      yearEnd: year_end,
      ageStart: age_start,
      ageEnd: age_end,
      lifeStage: life_stage,
      timingCertainty: timing_certainty,
      timingInputType: timing_input_type,
    });

    if (!timingResult.success) {
      return NextResponse.json(
        { error: timingResult.error.message },
        { status: 400 }
      );
    }

    const timing = timingResult.data;
    const eventType = normalizeEntryType(entry_type);
    const normalizedPrivacyLevel = normalizePrivacyLevel(privacy_level);

    // Determine story chain root and depth
    let chainInfo = computeChainInfo(null);

    if (prompted_by_event_id) {
      // Look up the parent event's chain info
      const { data: parentEvent } = await (admin.from('timeline_events') as ReturnType<typeof admin.from>)
        .select('id, root_event_id, chain_depth')
        .eq('id', prompted_by_event_id)
        .single();

      if (parentEvent) {
        chainInfo = computeChainInfo(parentEvent as ParentEventInfo);
      }
    }

    const trimmedContent = content.trim();
    const trimmedTitle = title.trim();
    const preview = generatePreview(trimmedContent);

    // Use contributor_id from authenticated user's profile
    // Falls back to lookup/create for backwards compatibility
    let contributorId: string | null = contributor_id || null;
    const trimmedName = submitter_name?.trim();
    const trimmedRelation = submitter_relationship?.trim();
    const trimmedEmail = submitter_email?.trim();

    // Fallback: look up or create contributor if not provided
    if (!contributorId && trimmedEmail) {
      const { data: existingContributorByEmail } = await (admin.from('contributors') as ReturnType<typeof admin.from>)
        .select('id')
        .ilike('email', trimmedEmail)
        .single();

      if ((existingContributorByEmail as { id?: string } | null)?.id) {
        contributorId = (existingContributorByEmail as { id: string }).id;
      }
    }

    if (!contributorId && trimmedName) {
      const { data: existingContributorByName } = await (admin.from('contributors') as ReturnType<typeof admin.from>)
        .select('id')
        .ilike('name', trimmedName)
        .single();

      if ((existingContributorByName as { id?: string } | null)?.id) {
        contributorId = (existingContributorByName as { id: string }).id;
      }
    }

    if (!contributorId && trimmedName) {
      const { data: createdContributor } = await (admin.from('contributors') as ReturnType<typeof admin.from>)
        .insert({
          name: trimmedName,
          relation: trimmedRelation || 'family/friend',
          email: trimmedEmail || null,
        })
        .select('id')
        .single();
      contributorId = (createdContributor as { id?: string } | null)?.id ?? null;
    }

    const { data: eventData, error: eventError } = await (admin.from('timeline_events') as ReturnType<typeof admin.from>)
      .insert({
        year: timing.year,
        year_end: timing.yearEnd,
        type: eventType,
        title: trimmedTitle,
        preview,
        full_entry: trimmedContent,
        why_included: why_included?.trim() || null,
        source_url: source_url?.trim() || null,
        source_name: trimmedSourceName,
        location: location?.trim() || null,
        contributor_id: contributorId,
        timing_certainty: timing.timingCertainty,
        timing_input_type: timing.timingInputType,
        age_start: timing.ageStart,
        age_end: timing.ageEnd,
        life_stage: timing.lifeStage,
        timing_note: timing_note?.trim() || null,
        status: 'published',
        privacy_level: normalizedPrivacyLevel,
        prompted_by_event_id: prompted_by_event_id || null,
        root_event_id: chainInfo.rootEventId,
        chain_depth: chainInfo.chainDepth,
      })
      .select()
      .single();

    if (eventError) {
      console.error('Supabase timeline insert error:', eventError);
      return NextResponse.json(
        { error: 'Failed to save note' },
        { status: 500 }
      );
    }

    // Save references if provided
    const eventId = (eventData as { id?: string } | null)?.id;
    const createdInvites: Array<{ id: string; name: string; phone: string }> = [];

    // If this is a standalone event (no parent), set root_event_id to self
    if (eventId && !chainInfo.rootEventId) {
      await (admin.from('timeline_events') as ReturnType<typeof admin.from>)
        .update({ root_event_id: eventId })
        .eq('id', eventId);
    }

    // TODO: Enable geocoding when map feature is implemented
    // See lib/migrations/006_add_coordinates.sql and lib/claude.ts geocodeLocation()

    // Create person lookup helpers scoped to this contributor
    const { canUsePersonId, resolvePersonIdByName } = createPersonLookupHelpers(admin, contributorId);

    if (references && eventId) {
      const linkRefs = references.links || [];
      const personRefs = references.people || [];

      // Insert link references
      for (const linkRef of linkRefs) {
        if (linkRef.url && linkRef.display_name) {
          await (admin.from('event_references') as ReturnType<typeof admin.from>).insert({
            event_id: eventId,
            type: 'link',
            url: linkRef.url,
            display_name: linkRef.display_name,
            role: 'source',
            added_by: contributorId,
          });
        }
      }

      // Insert person references (resolve person records)
      for (const personRef of personRefs) {
        const trimmedName = personRef.name?.trim() || '';
        const submittedPersonId = personRef.personId || personRef.person_id;

        if (!trimmedName && !submittedPersonId) {
          continue;
        }

        let personId: string | null = null;
        if (submittedPersonId && await canUsePersonId(submittedPersonId)) {
          personId = submittedPersonId;
        } else if (trimmedName) {
          personId = await resolvePersonIdByName(trimmedName);
        }

        if (!personId) {
          continue;
        }

        await (admin.from('event_references') as ReturnType<typeof admin.from>).insert({
          event_id: eventId,
          type: 'person',
          person_id: personId,
          role: 'witness',
          relationship_to_subject: personRef.relationship || null,
          visibility: 'pending',
          added_by: contributorId,
        });

        // Create invite if phone number provided
        if (shouldCreateInvite({ name: trimmedName, relationship: personRef.relationship || '', phone: personRef.phone })) {
          let inviteName = trimmedName || 'Someone';
          if (!trimmedName) {
            const { data: personRows } = await (admin.from('people') as ReturnType<typeof admin.from>)
              .select('canonical_name')
              .eq('id', personId)
              .limit(1);
            inviteName = (personRows && personRows[0] ? personRows[0].canonical_name : inviteName) as string;
          }

          const inviteData = buildInviteData(
            { name: inviteName, relationship: personRef.relationship || '', phone: personRef.phone },
            submitter_name || 'Someone'
          );

          if (inviteData) {
            const { data: invite } = await (admin.from('invites') as ReturnType<typeof admin.from>)
              .insert({
                event_id: eventId,
                recipient_name: inviteData.recipient_name,
                recipient_contact: inviteData.recipient_contact,
                method: inviteData.method,
                message: inviteData.message,
                sender_id: contributorId,
                status: 'pending',
              })
              .select('id')
              .single();

            if (invite) {
              createdInvites.push({
                id: (invite as { id: string }).id,
                name: inviteName,
                phone: personRef.phone!,
              });
            }
          }
        }
      }
    }

    // Handle "heard from" attribution
    if (heard_from?.name && eventId) {
      const storytellerName = heard_from.name.trim();
      const storytellerRelation = heard_from.relationship?.trim() || null;
      const storytellerEmail = heard_from.email?.trim() || null;

      const storytellerPersonId = await resolvePersonIdByName(storytellerName);

      // Create "heard from" reference
      if (storytellerPersonId) {
        await (admin.from('event_references') as ReturnType<typeof admin.from>).insert({
          event_id: eventId,
          type: 'person',
          person_id: storytellerPersonId,
          role: 'heard_from',
          relationship_to_subject: storytellerRelation,
          visibility: 'pending',
          added_by: contributorId,
        });

        // Create invite if requested
        if (heard_from.shouldInvite && storytellerEmail && contributorId) {
          await (admin.from('invites') as ReturnType<typeof admin.from>).insert({
            event_id: eventId,
            recipient_name: storytellerName,
            recipient_contact: storytellerEmail,
            method: 'email',
            message: `${submitter_name} has been carrying a story you told them. Now you can add your own link to the chain.`,
            sender_id: contributorId,
            status: 'pending',
          });
        }
      }
    }

    // If this is a response to another story, create memory_threads link
    if (prompted_by_event_id && eventId) {
      const allowedRelationships = new Set(['perspective', 'addition', 'correction', 'related']);
      const normalizedRelationship = allowedRelationships.has(relationship) ? relationship : 'perspective';
      const trimmedRelationshipNote = typeof relationship_note === 'string' ? relationship_note.trim() : '';

      await (admin.from('memory_threads') as ReturnType<typeof admin.from>).insert({
        original_event_id: prompted_by_event_id,
        response_event_id: eventId,
        relationship: normalizedRelationship,
        note: trimmedRelationshipNote ? trimmedRelationshipNote : null,
      });
    }

    const trimmedAttachmentUrl = attachment_url?.trim();
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
          caption: attachment_caption?.trim() || null,
          year: timing.year,
          uploaded_by: contributorId,
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
            event_id: eventId,
            media_id: mediaId,
          });
        if (linkError) {
          console.error('Supabase event media insert error:', linkError);
        }
      }
    }

    return NextResponse.json({ success: true, event: eventData, invites: createdInvites });
  } catch (error) {
    console.error('Memory submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit memory' },
      { status: 500 }
    );
  }
}
