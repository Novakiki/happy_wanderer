import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { readEditSession } from '@/lib/edit-session';
import { hasContent, generatePreviewFromHtml, PREVIEW_MAX_LENGTH } from '@/lib/html-utils';
import { normalizeRecurrence, normalizeWitnessType } from '@/lib/memories';
import { lintNote } from '@/lib/note-lint';
import { recordEventVersion } from '@/lib/event-versions';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    const editCookie = request.cookies.get('vals-memory-edit')?.value;
    const editSession = readEditSession(editCookie);

    if (!editSession?.token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Validate token and get contributor_id
    const { data: tokenRow } = await admin
      .from('edit_tokens')
      .select('contributor_id, expires_at')
      .eq('token', editSession.token)
      .single();

    if (!tokenRow?.contributor_id) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    // Check event ownership
    const { data: event } = await admin
      .from('timeline_events')
      .select('id, contributor_id')
      .eq('id', eventId)
      .single();

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.contributor_id !== tokenRow.contributor_id) {
      return NextResponse.json({ error: 'Not authorized to edit this event' }, { status: 403 });
    }

    // Parse update data
    const body = await request.json();
    const {
      title,
      content,
      why_included,
      location,
      year,
      year_end,
      timing_raw_text,
      witness_type,
      recurrence,
    } = body;

    // Build update payload with only provided fields
    const updatePayload: Database['public']['Tables']['timeline_events']['Update'] = {};

    if (typeof title === 'string' && title.trim()) {
      updatePayload.title = title.trim();
    }

    if (typeof content === 'string' && hasContent(content)) {
      updatePayload.full_entry = content;
      // Update preview (strip HTML for clean display)
      updatePayload.preview = generatePreviewFromHtml(content, PREVIEW_MAX_LENGTH);
    }

    if (typeof why_included === 'string') {
      updatePayload.why_included = why_included.trim() || null;
    }

    if (typeof location === 'string') {
      updatePayload.location = location.trim() || null;
    }

    if (typeof year === 'number' && year > 0) {
      updatePayload.year = year;
    }

    if (year_end !== undefined) {
      updatePayload.year_end = typeof year_end === 'number' && year_end > 0 ? year_end : null;
    }

    if (typeof timing_raw_text === 'string') {
      updatePayload.timing_raw_text = timing_raw_text.trim() || null;
    }

    if (typeof witness_type === 'string') {
      updatePayload.witness_type = normalizeWitnessType(witness_type);
    }

    if (typeof recurrence === 'string') {
      updatePayload.recurrence = normalizeRecurrence(recurrence);
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const lintWarnings = typeof content === 'string' && hasContent(content)
      ? await lintNote(admin, content)
      : [];

    // Update the event
    const { error: updateError } = await admin
      .from('timeline_events')
      .update(updatePayload)
      .eq('id', eventId);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    await recordEventVersion(admin, eventId, tokenRow.contributor_id);

    // Fetch updated event
    const { data: updatedEvent } = await admin
      .from('timeline_events')
      .select('id, title, full_entry, preview, why_included, location, year, year_end')
      .eq('id', eventId)
      .single();

    return NextResponse.json({ success: true, event: updatedEvent, lintWarnings });
  } catch (error) {
    console.error('Inline update error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
