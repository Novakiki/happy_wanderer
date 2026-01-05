import Nav from '@/components/Nav';
import AdminDashboard from '@/components/AdminDashboard';
import { isAdminEmail } from '@/lib/admin';
import { formStyles, subtleBackground } from '@/lib/styles';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

type Profile = {
  name: string;
  relation: string | null;
  email: string | null;
  contributor_id: string | null;
};

type PendingNote = {
  id: string;
  title: string | null;
  year: number;
  year_end: number | null;
  type: string | null;
  status: string | null;
  preview: string | null;
  full_entry: string | null;
  why_included: string | null;
  source_name: string | null;
  source_url: string | null;
  created_at: string | null;
  privacy_level: string | null;
  contributor_id: string | null;
  contributor: { id: string; name: string | null; relation: string | null } | null;
};

type Contributor = {
  id: string;
  name: string;
  relation: string;
  email: string | null;
  phone: string | null;
  trusted: boolean | null;
  created_at: string | null;
  last_active: string | null;
  disabled_at: string | null;
};

type TrustRequest = {
  id: string;
  contributor_id: string;
  message: string | null;
  status: string | null;
  created_at: string | null;
  contributor: {
    id: string;
    name: string | null;
    relation: string | null;
    email: string | null;
    phone: string | null;
    trusted: boolean | null;
    last_active: string | null;
  } | null;
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  if (!isAdminEmail(user.email)) {
    notFound();
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, relation, email, contributor_id')
    .eq('id', user.id)
    .single<Profile>();

  if (!profile) {
    redirect('/auth/complete-profile');
  }

  const admin = createAdminClient();

  const { data: pendingNotes, error: pendingError } = await admin
    .from('timeline_events')
    .select(`
      id,
      title,
      year,
      year_end,
      type,
      status,
      preview,
      full_entry,
      why_included,
      source_name,
      source_url,
      created_at,
      privacy_level,
      contributor_id,
      contributor:contributors!timeline_events_contributor_id_fkey(id, name, relation)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .returns<PendingNote[]>();

  if (pendingError) {
    console.error('Admin pending notes fetch error:', pendingError);
  }

  const safePendingNotes = Array.isArray(pendingNotes) ? pendingNotes : [];

  const { data: contributors, error: contributorsError } = await admin
    .from('contributors')
    .select('id, name, relation, email, phone, trusted, created_at, last_active, disabled_at')
    .order('name', { ascending: true })
    .returns<Contributor[]>();

  if (contributorsError) {
    console.error('Admin contributors fetch error:', contributorsError);
  }

  const safeContributors = Array.isArray(contributors) ? contributors : [];

  const { data: trustRequests, error: trustError } = await ((admin.from('trust_requests') as unknown) as ReturnType<typeof admin.from>)
    .select(`
      id,
      contributor_id,
      message,
      status,
      created_at,
      contributor:contributors!trust_requests_contributor_id_fkey(id, name, relation, email, phone, trusted, last_active)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .returns<TrustRequest[]>();

  if (trustError) {
    console.error('Admin trust requests fetch error:', trustError);
  }

  const safeTrustRequests = Array.isArray(trustRequests) ? trustRequests : [];

  return (
    <div className="min-h-screen text-white bg-[#0b0b0b]" style={subtleBackground}>
      <Nav
        userProfile={{
          name: profile.name,
          relation: profile.relation || '',
          email: profile.email || '',
          contributorId: profile.contributor_id || '',
        }}
      />

      <main className="max-w-5xl mx-auto px-6 pt-24 pb-20 space-y-8">
        <header className="space-y-2">
          <p className={formStyles.subLabel}>Admin</p>
          <h1 className="text-3xl font-serif text-white">Review pending notes</h1>
          <p className="text-white/60 max-w-2xl">
            Review trust requests, approve notes, and manage trusted contributors.
          </p>
        </header>

        <AdminDashboard
          pendingNotes={safePendingNotes}
          contributors={safeContributors}
          trustRequests={safeTrustRequests}
        />
      </main>
    </div>
  );
}
