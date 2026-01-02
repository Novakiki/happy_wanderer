import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';
import { subtleBackground, formStyles } from '@/lib/styles';
import { redirect } from 'next/navigation';

type Profile = {
  name: string;
  relation: string | null;
  email: string | null;
  contributor_id: string | null;
};

type InviteRow = {
  id: string;
  event_id: string | null;
  recipient_name: string;
  recipient_contact: string;
  status: string;
  sent_at: string | null;
  contributed_at: string | null;
  timeline_events?: { title: string | null } | null;
};

type ThreadRow = {
  id: string;
  original_event_id: string;
  response_event_id: string;
};

type NoteSummary = {
  id: string;
  title: string | null;
  type: string | null;
};

async function getAuthedProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, relation, email, contributor_id')
    .eq('id', user.id)
    .single<Profile>();

  if (!profile || !profile.contributor_id) {
    redirect('/auth/complete-profile');
  }

  return { supabase, profile, userId: user.id };
}

function formatStatus(status: string) {
  switch (status) {
    case 'sent':
      return 'Sent';
    case 'opened':
      return 'Opened';
    case 'clicked':
      return 'Clicked';
    case 'contributed':
      return 'Contributed';
    case 'pending':
    default:
      return 'Pending';
  }
}

export default async function ConnectionsPage() {
  const { supabase, profile } = await getAuthedProfile();
  const contributorId = profile.contributor_id!;

  // Fetch invites sent by this contributor
  const { data: invitesData = [] } = await supabase
    .from('invites')
    .select('id, event_id, recipient_name, recipient_contact, status, sent_at, contributed_at, timeline_events(title)')
    .eq('sender_id', contributorId)
    .order('created_at', { ascending: false })
    .returns<InviteRow[]>();

  // Fetch this contributor's notes to find connections
  const { data: myNotesData } = await supabase
    .from('current_notes')
    .select('id, title')
    .eq('contributor_id', contributorId);
  const myNotes = myNotesData || [];

  const myEventIds = myNotes.map((n) => n.id);

  // Fetch threads where others responded to this contributor's notes
  const { data: threads = [] } = myEventIds.length
    ? await supabase
        .from('memory_threads')
        .select('id, original_event_id, response_event_id')
        .in('original_event_id', myEventIds)
        .returns<ThreadRow[]>()
    : { data: [] as ThreadRow[] };

  const responseIds = Array.from(new Set(threads.map((t) => t.response_event_id))).filter(Boolean);
  const { data: responseNotes = [] } = responseIds.length
    ? await supabase
        .from('current_notes')
        .select('id, title, type')
        .in('id', responseIds)
        .returns<NoteSummary[]>()
    : { data: [] as NoteSummary[] };

  const responseById = new Map(responseNotes.map((n) => [n.id, n]));
  const myNoteById = new Map(myNotes.map((n) => [n.id, n.title ?? 'Untitled']));

  return (
    <div className="min-h-screen text-white bg-[#0b0b0b]" style={subtleBackground}>
      <Nav
        userProfile={{
          name: profile.name,
          relation: profile.relation || '',
          email: profile.email || '',
          contributorId,
        }}
      />

      <main className="max-w-4xl mx-auto px-6 pt-24 pb-20 space-y-8">
        <header className="space-y-2">
          <p className={formStyles.subLabel}>Connections</p>
          <h1 className="text-3xl font-serif text-white">Who you remember, who remembers you</h1>
          <p className="text-white/60 max-w-2xl">
            See the people you invited to share their link in the chain, and the responses connected to your notes.
          </p>
        </header>

        <section className={formStyles.section}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Invites you sent</h2>
            <span className="text-xs text-white/50">Status updates as they engage</span>
          </div>
          {invitesData.length === 0 ? (
            <p className="text-sm text-white/60">No invites yet. Add a phone number when you mention someone to invite them.</p>
          ) : (
            <div className="space-y-3">
              {invitesData.map((invite) => {
                const noteTitle = invite.timeline_events?.title || 'Linked note';
                const statusLabel = formatStatus(invite.status);
                return (
                  <div
                    key={invite.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm text-white">{invite.recipient_name}</p>
                      <p className="text-xs text-white/50">
                        {invite.recipient_contact} · {noteTitle}
                      </p>
                    </div>
                    <span className="text-xs text-white/70 border border-white/15 rounded-full px-3 py-1">
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className={formStyles.section}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Connected through notes</h2>
            <span className="text-xs text-white/50">Responses linked to your notes</span>
          </div>
          {threads.length === 0 ? (
            <p className="text-sm text-white/60">No connected responses yet.</p>
          ) : (
            <div className="space-y-3">
              {threads.map((thread) => {
                const originalTitle = myNoteById.get(thread.original_event_id) || 'Your note';
                const response = responseById.get(thread.response_event_id);
                const responseTitle = response?.title || 'Response note';
                const typeLabel =
                  response?.type === 'origin'
                    ? 'Synchronicity'
                    : response?.type === 'milestone'
                      ? 'Milestone'
                      : 'Memory';
                return (
                  <div
                    key={thread.id}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 space-y-1"
                  >
                    <p className="text-sm text-white">{responseTitle}</p>
                    <p className="text-xs text-white/50">
                      Linked to your note “{originalTitle}” · {typeLabel}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
