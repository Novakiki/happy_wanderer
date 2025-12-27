import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import type { Database } from '@/lib/database.types';
import EditNotesClient from '@/components/EditNotesClient';
import EditSessionSetter from '@/components/EditSessionSetter';
import Nav from '@/components/Nav';
import { subtleBackground, formStyles } from '@/lib/styles';

export const dynamic = 'force-dynamic';

export default async function EditTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
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

  const { data: events } = await admin
    .from('timeline_events')
    .select(
      `
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
      `
    )
    .eq('contributor_id', tokenRow.contributor_id)
    .order('year', { ascending: true });

  return (
    <div className={formStyles.pageContainer} style={subtleBackground}>
      <Nav />
      <section className={formStyles.contentWrapper}>
        <EditSessionSetter token={token} />
        <p className={formStyles.subLabel}>
          Edit your notes
        </p>
        <h1 className={formStyles.pageTitle}>
          Your contributions
        </h1>
        <p className={formStyles.pageDescription}>
          You can edit any note you have submitted. Changes update immediately in the score.
        </p>

        <div className="mt-8">
          <EditNotesClient
            token={token}
            contributorName={contributor?.name || 'Contributor'}
            events={events || []}
          />
        </div>
      </section>
    </div>
  );
}
