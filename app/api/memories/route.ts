import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY!;

const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    // Require authenticated visitor (password gate)
    const authCookie = request.cookies.get('vals-memory-auth');
    if (!authCookie || authCookie.value !== 'authenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const {
      content,
      submitter_name,
      submitter_relationship,
      submitter_email,
      entry_type,
      year,
      title,
      source_name,
      source_url,
      why_included,
      attachment_type,
      attachment_url,
      attachment_caption,
    } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      );
    }

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const parsedYear = Number.parseInt(String(year), 10);
    if (!parsedYear || Number.isNaN(parsedYear)) {
      return NextResponse.json(
        { error: 'A valid year is required' },
        { status: 400 }
      );
    }

    const eventType = entry_type === 'origin'
      ? 'origin'
      : entry_type === 'milestone'
        ? 'milestone'
        : 'memory';

    const trimmedContent = content.trim();
    const trimmedTitle = title.trim();
    const preview = trimmedContent.length > 160
      ? `${trimmedContent.slice(0, 160).trimEnd()}...`
      : trimmedContent;

    let contributorId: string | null = null;
    const trimmedName = submitter_name?.trim();
    const trimmedRelation = submitter_relationship?.trim();

    if (trimmedName) {
      const { data: existingContributor } = await admin
        .from('contributors')
        .select('id')
        .ilike('name', trimmedName)
        .single();

      if (existingContributor?.id) {
        contributorId = existingContributor.id;
      } else {
        const { data: createdContributor } = await admin
          .from('contributors')
          .insert({
            name: trimmedName,
            relation: trimmedRelation || 'family/friend',
            email: submitter_email?.trim() || null,
          })
          .select('id')
          .single();
        contributorId = createdContributor?.id ?? null;
      }
    }

    const { data: eventData, error: eventError } = await admin
      .from('timeline_events')
      .insert({
        year: parsedYear,
        type: eventType,
        title: trimmedTitle,
        preview,
        full_entry: trimmedContent,
        why_included: why_included?.trim() || null,
        source_url: source_url?.trim() || null,
        source_name: source_name?.trim() || null,
        contributor_id: contributorId,
        status: 'published',
        privacy_level: 'family',
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

    const trimmedAttachmentUrl = attachment_url?.trim();
    if (trimmedAttachmentUrl && attachment_type && attachment_type !== 'none') {
      const mediaType = attachment_type === 'image'
        ? 'photo'
        : attachment_type === 'audio'
          ? 'audio'
          : 'document';
      const { data: mediaData, error: mediaError } = await admin
        .from('media')
        .insert({
          type: mediaType,
          url: trimmedAttachmentUrl,
          caption: attachment_caption?.trim() || null,
          year: parsedYear,
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

      if (mediaData?.id) {
        const { error: linkError } = await admin
          .from('event_media')
          .insert({
            event_id: eventData.id,
            media_id: mediaData.id,
          });
        if (linkError) {
          console.error('Supabase event media insert error:', linkError);
        }
      }
    }

    const { data: memoryData, error: memoryError } = await admin
      .from('memories')
      .insert({
        content: trimmedContent,
        submitter_name: trimmedName || null,
        submitter_relationship: trimmedRelation || null,
        submitter_email: submitter_email?.trim() || null,
        is_visible: true,
      })
      .select()
      .single();

    if (memoryError) {
      console.error('Supabase memory insert error:', memoryError);
      return NextResponse.json(
        { error: 'Failed to save note' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, event: eventData, memory: memoryData });
  } catch (error) {
    console.error('Memory submission error:', error);
    return NextResponse.json(
      { error: 'Failed to submit memory' },
      { status: 500 }
    );
  }
}
