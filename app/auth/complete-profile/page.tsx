import CompleteProfileForm from './CompleteProfileForm';
import { createClient } from '@/lib/supabase/server';
import { SITE_TITLE } from '@/lib/terminology';
import { redirect } from 'next/navigation';

export default async function CompleteProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Check if profile already exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (profile) {
    redirect('/');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0 bg-[#0b0b0b]" />
      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-[#e07a5f]/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-[#7c8a78]/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/4 -bottom-20 h-64 w-64 rounded-full bg-[#d9b3a1]/10 blur-3xl" />

      <div className="relative max-w-md w-full bg-white/[0.06] backdrop-blur-sm rounded-3xl shadow-lg shadow-black/30 border border-white/10 p-10">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50 text-center">
          {SITE_TITLE}
        </p>
        <h1 className="text-2xl sm:text-3xl font-serif text-white mb-2 mt-3 text-center">
          Almost there
        </h1>

        {/* Decorative flourish */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="h-px w-8 bg-white/20" />
          <span className="text-white/50 text-sm">&#9834;</span>
          <span className="h-px w-8 bg-white/20" />
        </div>

        <p className="text-white/60 text-center mb-8">
          Tell us a bit about yourself so others know who&apos;s sharing these memories.
        </p>

        <CompleteProfileForm userEmail={user.email || ''} />
      </div>
    </div>
  );
}
