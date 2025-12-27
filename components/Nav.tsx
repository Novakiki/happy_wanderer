'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SCORE_TITLE } from '@/lib/terminology';
import InteractButton from '@/components/InteractButton';
import UserMenu from '@/components/UserMenu';

type UserProfile = {
  name: string;
  relation: string;
};

type Props = {
  /** Show as fixed header (true) or inline back link (false) */
  variant?: 'header' | 'back';
  /** User profile for showing UserMenu */
  userProfile?: UserProfile | null;
};

export default function Nav({ variant = 'header', userProfile }: Props) {
  const pathname = usePathname();
  const isScore = pathname === '/score';
  const [clientProfile, setClientProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (userProfile) return; // server already provided

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, relation')
        .eq('id', user.id)
        .single();
      if (profile) {
        setClientProfile({
          name: profile.name,
          relation: profile.relation,
        });
      }
    });
  }, [userProfile]);

  const profileToUse = userProfile ?? clientProfile;

  if (variant === 'back') {
    return (
      <Link
        href="/score"
        className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
      >
        &larr; Back to the score
      </Link>
    );
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-gradient-to-b from-[#0a0a0a] to-transparent pointer-events-none">
      <div className="max-w-6xl mx-auto flex items-center justify-between pointer-events-auto">
        <Link
          href="/score"
          className={`text-sm transition-colors font-light tracking-wide ${
            isScore ? 'text-white/40' : 'text-white/70 hover:text-white'
          }`}
        >
          {SCORE_TITLE}
        </Link>
        <div className="flex items-center gap-4 text-sm text-white/50">
          <Link
            href="/share"
            className={`transition-colors ${
              pathname === '/share' ? 'text-white/40' : 'hover:text-white'
            }`}
          >
            Add a note
          </Link>
          <InteractButton />
          {profileToUse && (
            <UserMenu name={profileToUse.name} relation={profileToUse.relation} />
          )}
        </div>
      </div>
    </nav>
  );
}
