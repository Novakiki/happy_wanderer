import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import type { Database } from '@/lib/database.types';
import EditNotesClient from '@/components/EditNotesClient';
import EditSessionSetter from '@/components/EditSessionSetter';
import Nav from '@/components/Nav';
import { redactReferences, type ReferenceRow } from '@/lib/references';
import { subtleBackground, formStyles } from '@/lib/styles';

export const dynamic = 'force-dynamic';

function coerceReferenceRows(value: unknown): ReferenceRow[] {
  return Array.isArray(value) ? (value as unknown as ReferenceRow[]) : [];
}

export default async function EditTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ event_id?: string }>;
}) {
  const { token } = await params;
  const { event_id: eventId } = await searchParams;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return (
      <div className={formStyles.pageContainer} style={subtleBackground}>
        <Nav />
        <section className={formStyles.contentWrapper}>
          <h1 className={`${formStyles.pageTitle} mt-0`}>Missing configuration</h1>
          <p className={formStyles.pageDescription}>
            SUPABASE_URL and SUPABASE_SECRET_KEY are required to load edit links.
          </p>
        </section>
      </div>
    );
  }

  const admin = createClient<Database>(supabaseUrl, supabaseServiceKey);

  const { data: tokenRow }: {
    data: { id: string; contributor_id: string | null; expires_at: string | null } | null;
  } = await admin
    .from('edit_tokens')
    .select('id, contributor_id, expires_at')
    .eq('token', token)
    .single();

  if (!tokenRow?.contributor_id) {
    return (
      <div className={formStyles.pageContainer} style={subtleBackground}>
        <Nav />
        <section className={formStyles.contentWrapper}>
          <h1 className={`${formStyles.pageTitle} mt-0`}>Invalid link</h1>
          <p className={formStyles.pageDescription}>
            We couldn&apos;t find that edit link. Please request a new one.
          </p>
          <Link
            href="/edit"
            className={`inline-flex items-center gap-2 mt-6 ${formStyles.buttonGhost}`}
          >
            Request a new link
          </Link>
        </section>
      </div>
    );
  }

  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return (
      <div className={formStyles.pageContainer} style={subtleBackground}>
        <Nav />
        <section className={formStyles.contentWrapper}>
          <h1 className={`${formStyles.pageTitle} mt-0`}>This link has expired</h1>
          <p className={formStyles.pageDescription}>
            Request a new magic link to continue editing your notes.
          </p>
          <Link
            href="/edit"
            className={`inline-flex items-center gap-2 mt-6 ${formStyles.buttonGhost}`}
          >
            Request a new link
          </Link>
        </section>
      </div>
    );
  }

  const tokenUpdate: Database['public']['Tables']['edit_tokens']['Update'] = {
    used_at: new Date().toISOString(),
  };
  await admin
    .from('edit_tokens')
    .update(tokenUpdate)
    .eq('id', tokenRow.id);

  const { data: contributor }: { data: { name: string | null } | null } = await admin
    .from('contributors')
    .select('name')
    .eq('id', tokenRow.contributor_id)
    .single();

  const buildEventsQuery = () =>
    admin
      .from('timeline_events')
      .select(
        `
          id,
          year,
          date,
          year_end,
          age_start,
          age_end,
          life_stage,
          timing_certainty,
          timing_input_type,
          timing_note,
          timing_raw_text,
          witness_type,
          recurrence,
          location,
          type,
          title,
          preview,
          full_entry,
          why_included,
          source_name,
          source_url,
          privacy_level,
          people_involved,
          references:event_references(
            id,
            type,
            url,
            display_name,
            role,
            visibility,
            relationship_to_subject,
            person_id,
            person:people(id, canonical_name)
          ),
          mentions:note_mentions(
            id,
            mention_text,
            status,
            visibility,
            display_label,
            promoted_person_id
          )
        `
      )
      .eq('contributor_id', tokenRow.contributor_id!)
      .order('year', { ascending: true });

  let { data: events } = eventId
    ? await buildEventsQuery().eq('id', eventId)
    : await buildEventsQuery();

  // If a specific note was requested but no longer exists, fall back to all notes
  if (eventId && (!events || events.length === 0)) {
    const fallback = await buildEventsQuery();
    events = fallback.data;
  }

  const redactedEvents = (events || []).map((evt) => ({
    ...evt,
    references: redactReferences(coerceReferenceRows((evt as { references?: unknown }).references), {
      includeAuthorPayload: true,
    }),
  }));

  const requestedEventFound = Boolean(eventId && redactedEvents.some((evt) => evt.id === eventId));

  return (
    <div className={formStyles.pageContainer} style={subtleBackground}>
      <Nav />
      <section className={formStyles.contentWrapper}>
        <EditSessionSetter token={token} />
        <p className={formStyles.subLabel}>
          Your notes
        </p>
        <h1 className={formStyles.pageTitle}>
          {requestedEventFound ? 'Edit note' : 'Your notes'}
        </h1>
        <p className={formStyles.pageDescription}>
          {requestedEventFound
            ? 'Edit your note below. Changes update immediately in the score.'
            : eventId
              ? 'We could not find that note. Showing your other notes.'
              : 'Select a note to edit. Changes update immediately in the score.'}
        </p>
        {eventId && !requestedEventFound && (
          <p className="mt-4 text-sm text-white/60">
            The requested note may have been removed or the link expired. Your remaining notes are below.
          </p>
        )}

        <div className="mt-8">
          <EditNotesClient
            token={token}
            contributorName={contributor?.name || 'Contributor'}
            events={redactedEvents}
            initialEditingId={requestedEventFound ? eventId : null}
          />
        </div>
      </section>
    </div>
  );
}
