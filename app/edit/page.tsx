import EditNotesClient from '@/components/EditNotesClient';
import EditRequestForm from '@/components/EditRequestForm';
import Nav from '@/components/Nav';
import { redactReferences } from '@/lib/references';
import { formStyles, subtleBackground } from '@/lib/styles';
import { createAdminClient, createClient as createServerClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';

const MAGIC_LINK_TTL_DAYS = Number(process.env.MAGIC_LINK_TTL_DAYS || 30);

function getMaxAgeSeconds() {
  if (!MAGIC_LINK_TTL_DAYS || Number.isNaN(MAGIC_LINK_TTL_DAYS)) {
    return undefined;
  }
  if (MAGIC_LINK_TTL_DAYS <= 0) return undefined;
  return Math.floor(MAGIC_LINK_TTL_DAYS * 24 * 60 * 60);
}

type EditSession = {
  token: string;
  name: string;
};

function readEditSession(value?: string): EditSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    if (parsed && typeof parsed.token === 'string' && typeof parsed.name === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

// Get a specific event by ID if the user has permission to edit it
async function getEventById(eventId: string, contributorName: string) {
  const admin = createAdminClient();

  const { data: eventData } = await (admin.from('timeline_events') as ReturnType<typeof admin.from>)
    .select(`
      id,
      year,
      year_end,
      age_start,
      age_end,
      life_stage,
      timing_certainty,
      timing_input_type,
      timing_note,
      location,
      type,
      title,
      preview,
      full_entry,
      why_included,
      source_name,
      source_url,
      privacy_level,
      contributor:contributors(name),
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
      )
    `)
    .eq('id', eventId)
    .single();

  const event = eventData as {
    id: string;
    year: number;
    contributor: { name: string } | null;
    [key: string]: unknown;
  } | null;

  if (!event) return null;

  // Check if the contributor name matches (case-insensitive)
  const eventContributorName = event.contributor?.name;
  if (!eventContributorName || eventContributorName.toLowerCase() !== contributorName.toLowerCase()) {
    return null;
  }

  // Return without the contributor field to match expected format
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { contributor, ...eventWithoutContributor } = event;
  return {
    ...eventWithoutContributor,
    references: redactReferences((eventWithoutContributor as { references?: unknown }).references as any || [], {
      includeAuthorPayload: true,
    }),
  };
}

async function getEventsForToken(token: string, contributorName?: string) {
  const admin = createAdminClient();

  // Get contributor from token
  const { data: tokenRow }: {
    data: { contributor_id: string | null; expires_at: string | null } | null;
  } = await admin
    .from('edit_tokens')
    .select('contributor_id, expires_at')
    .eq('token', token)
    .single();

  if (!tokenRow?.contributor_id) return null;

  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return null;
  }

  // Get events for this contributor by ID
  const { data: events } = await admin
    .from('timeline_events')
    .select(`
      id,
      year,
      year_end,
      age_start,
      age_end,
      life_stage,
      timing_certainty,
      timing_input_type,
      timing_note,
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
      )
    `)
    .eq('contributor_id', tokenRow.contributor_id)
    .order('year', { ascending: true });

  // If no events found by ID and we have a name, try finding by contributor name
  if ((!events || events.length === 0) && contributorName) {
    // Find all contributor IDs with this name
    const { data: contributors }: { data: { id: string }[] | null } = await admin
      .from('contributors')
      .select('id')
      .ilike('name', contributorName);

    if (contributors && contributors.length > 0) {
      const contributorIds = contributors.map(c => c.id);

      const { data: eventsByName } = await admin
        .from('timeline_events')
        .select(`
          id,
          year,
          year_end,
          age_start,
          age_end,
          life_stage,
          timing_certainty,
          timing_input_type,
          timing_note,
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
          )
        `)
        .in('contributor_id', contributorIds)
        .order('year', { ascending: true });

      return eventsByName || [];
    }
  }

  return (events || []).map((evt) => ({
    ...evt,
    references: redactReferences((evt as { references?: unknown }).references as any || [], {
      includeAuthorPayload: true,
    }),
  }));
}

async function getEventForContributor(eventId: string, contributorId: string) {
  const admin = createAdminClient();

  const { data: event } = await admin
    .from('timeline_events')
    .select(`
      id,
      year,
      year_end,
      age_start,
      age_end,
      life_stage,
      timing_certainty,
      timing_input_type,
      timing_note,
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
      )
    `)
    .eq('id', eventId)
    .eq('contributor_id', contributorId)
    .single();

  return event
    ? {
        ...event,
        references: redactReferences((event as { references?: unknown }).references as any || [], {
          includeAuthorPayload: true,
        }),
      }
    : null;
}

async function getEventsForContributor(contributorId: string) {
  const admin = createAdminClient();

  const { data: events } = await admin
    .from('timeline_events')
    .select(`
      id,
      year,
      year_end,
      age_start,
      age_end,
      life_stage,
      timing_certainty,
      timing_input_type,
      timing_note,
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
      )
    `)
    .eq('contributor_id', contributorId)
    .order('year', { ascending: true });

  return (events || []).map((evt) => ({
    ...evt,
    references: redactReferences((evt as { references?: unknown }).references as any || [], {
      includeAuthorPayload: true,
    }),
  }));
}

async function getOrCreateEditTokenForContributor(contributorId: string) {
  const admin = createAdminClient();

  const { data: existingTokens } = await admin
    .from('edit_tokens')
    .select('token, expires_at')
    .eq('contributor_id', contributorId)
    .order('expires_at', { ascending: false })
    .limit(1);

  const candidate = existingTokens?.[0];
  if (candidate?.token) {
    const expiresAt = candidate.expires_at ? new Date(candidate.expires_at) : null;
    if (!expiresAt || expiresAt > new Date()) {
      return candidate.token;
    }
  }

  const token = randomUUID();
  const expiresAt = MAGIC_LINK_TTL_DAYS > 0
    ? new Date(Date.now() + MAGIC_LINK_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    : null;

  await admin.from('edit_tokens').insert({
    token,
    contributor_id: contributorId,
    expires_at: expiresAt,
  });

  return token;
}

export default async function EditPage({
  searchParams,
}: {
  searchParams: Promise<{ event_id?: string }>;
}) {
  const cookieStore = await cookies();
  const editSession = readEditSession(cookieStore.get('vals-memory-edit')?.value);
  const { event_id: eventId } = await searchParams;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Pull the profile for logged-in users to see if we can link directly to their contributor record
  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('name, contributor_id')
        .eq('id', user.id)
        .single()
    : { data: null };
  const contributorToken = profile?.contributor_id
    ? await getOrCreateEditTokenForContributor(profile.contributor_id)
    : null;

  // If user has a valid session, show their notes
  if (editSession?.token) {
    // If a specific event_id is provided, try to load just that event
    if (eventId) {
      const event = await getEventById(eventId, editSession.name);
      if (event) {
        return (
          <div
            className={formStyles.pageContainer}
            style={subtleBackground}
          >
            <Nav />
            <section className={formStyles.contentWrapper}>
              <p className={formStyles.subLabel}>
                Edit your notes
              </p>
              <h1 className={formStyles.pageTitle}>
                Edit note
              </h1>

              <div className="mt-8">
                <EditNotesClient
                  token={editSession.token}
                  contributorName={editSession.name}
                  events={[event] as Parameters<typeof EditNotesClient>[0]['events']}
                />
              </div>
            </section>
          </div>
        );
      }
      // If event not found or no permission, fall through to show all notes
    }

    const events = await getEventsForToken(editSession.token, editSession.name);

    if (events) {
      return (
        <div
          className={formStyles.pageContainer}
          style={subtleBackground}
        >
          <Nav />
          <section className={formStyles.contentWrapper}>
            <p className={formStyles.subLabel}>
              Edit your notes
            </p>
            <h1 className={formStyles.pageTitle}>
              Your contributions
            </h1>

            <div className="mt-8">
              <EditNotesClient
                token={editSession.token}
                contributorName={editSession.name}
                events={events}
              />
            </div>
          </section>
        </div>
      );
    }
  }

  // If authenticated and mapped to a contributor, show their notes without requiring the edit-session cookie
  if (profile?.contributor_id && contributorToken) {
    if (eventId) {
      const event = await getEventForContributor(eventId, profile.contributor_id);
      if (event) {
        return (
          <div
            className={formStyles.pageContainer}
            style={subtleBackground}
          >
            <Nav />
            <section className={formStyles.contentWrapper}>
              <p className={formStyles.subLabel}>
                Edit your notes
              </p>
              <h1 className={formStyles.pageTitle}>
                Edit note
              </h1>

              <div className="mt-8">
                <EditNotesClient
                  token={contributorToken}
                  contributorName={profile.name || 'Your notes'}
                  events={[event] as Parameters<typeof EditNotesClient>[0]['events']}
                />
              </div>
            </section>
          </div>
        );
      }
    }

    const events = await getEventsForContributor(profile.contributor_id);

    if (events && events.length > 0) {
      return (
        <div
          className={formStyles.pageContainer}
          style={subtleBackground}
        >
          <Nav />
          <section className={formStyles.contentWrapper}>
            <p className={formStyles.subLabel}>
              Edit your notes
            </p>
            <h1 className={formStyles.pageTitle}>
              Your contributions
            </h1>

            <div className="mt-8">
              <EditNotesClient
                token={contributorToken}
                contributorName={profile.name || 'Your notes'}
                events={events}
              />
            </div>
          </section>
        </div>
      );
    }
  }

  // Otherwise show the request form
  return (
    <div
      className={formStyles.pageContainer}
      style={subtleBackground}
    >
      <Nav />
      <section className={formStyles.contentWrapper}>
        <p className={formStyles.subLabel}>
          Edit your notes
        </p>
        <h1 className={formStyles.pageTitle}>
          Request a magic link
        </h1>
        <p className={formStyles.pageDescription}>
          Enter the email you used when you shared a note. We will send you a link
          that lets you edit your submissions any time.
        </p>

        <div className="mt-8">
          <EditRequestForm />
        </div>
      </section>
    </div>
  );
}
