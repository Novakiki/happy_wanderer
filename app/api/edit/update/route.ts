import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { normalizePrivacyLevel } from '@/lib/memories';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

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
    const linkRefs = Array.isArray(references?.links)
      ? references.links
      : Array.isArray(sources)
        ? sources
        : [];
    const personRefs = Array.isArray(references?.people) ? references.people : [];

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

    const { error: updateError } = await (admin
      .from('timeline_events') as any)
      .update({
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
      } as any)
      .eq('id', event_id);

    if (updateError) {
      throw updateError;
    }

    // Replace all references (links + people) if provided
    if (Array.isArray(linkRefs) || Array.isArray(personRefs)) {
      await admin.from('event_references').delete().eq('event_id', event_id);

      const linkRows = (linkRefs || [])
        .map((src: any) => ({
          display_name: String(src?.display_name || '').trim(),
          url: String(src?.url || '').trim(),
          role: src?.role,
        }))
        .filter((src) => src.display_name && src.url)
        .map((src) => ({
          event_id,
          type: 'link' as const,
          display_name: src.display_name,
          url: src.url,
          role:
            src.role === 'related' ||
            src.role === 'source' ||
            src.role === 'witness' ||
            src.role === 'heard_from'
              ? src.role
              : 'source',
          added_by: tokenRow.contributor_id,
        }));

      const resolvedPeople: Array<{
        name: string;
        relationship?: string | null;
        role: 'witness' | 'heard_from' | 'source' | 'related';
      }> = [];

      for (const ref of personRefs || []) {
        const name = String((ref?.name || ref?.display_name || '')).trim();
        if (!name) continue;
        const role =
          ref?.role === 'heard_from' ||
          ref?.role === 'source' ||
          ref?.role === 'related' ||
          ref?.role === 'witness'
            ? ref.role
            : 'witness';
        resolvedPeople.push({
          name,
          relationship: String(ref?.relationship || ref?.relationship_to_subject || '').trim() || null,
          role,
        });
      }

      const personRows: Array<{
        event_id: string;
        type: 'person';
        person_id: string;
        role: 'witness' | 'heard_from' | 'source' | 'related';
        relationship_to_subject: string | null;
        added_by: string | null;
      }> = [];

      for (const ref of resolvedPeople) {
        // Resolve or create person
        const { data: existing } = await admin
          .from('people')
          .select('id')
          .ilike('canonical_name', ref.name)
          .limit(1);
        let personId = existing && existing[0] ? (existing[0] as { id: string }).id : null;
        if (!personId) {
          const { data: created } = await admin
            .from('people')
            .insert({
              canonical_name: ref.name,
              visibility: 'pending',
              created_by: tokenRow.contributor_id,
            })
            .select('id')
            .single();
          personId = (created as { id?: string } | null)?.id || null;
        }
        if (!personId) continue;
        personRows.push({
          event_id,
          type: 'person',
          person_id: personId,
          role: ref.role,
          relationship_to_subject: ref.relationship || null,
          added_by: tokenRow.contributor_id,
        });
      }

      const allRows = [...linkRows, ...personRows];
      if (allRows.length > 0) {
        const { error: refError } = await admin.from('event_references').insert(allRows as any);
        if (refError) {
          throw refError;
        }
      }
    }

    await (admin.from('edit_tokens') as any)
      .update({ used_at: new Date().toISOString() } as any)
      .eq('id', tokenRow.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Edit update error:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}
