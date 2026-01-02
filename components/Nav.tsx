'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import InteractButton from '@/components/InteractButton';
import UserMenu from '@/components/UserMenu';

type UserProfile = {
  name: string;
  relation: string;
  email?: string;
  contributorId?: string;
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
  const isContributeFlow =
    pathname === '/contribute' ||
    pathname === '/share' ||
    pathname === '/fragment' ||
    pathname === '/submit';
  const [clientProfile, setClientProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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

  useEffect(() => {
    let isActive = true;

    if (!profileToUse) {
      setIsAdmin(false);
      return;
    }

    fetch('/api/admin/status')
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json().catch(() => ({}));
        return data;
      })
      .then((data) => {
        if (!isActive) return;
        setIsAdmin(Boolean(data?.is_admin));
      })
      .catch(() => {
        if (!isActive) return;
        setIsAdmin(false);
      });

    return () => {
      isActive = false;
    };
  }, [profileToUse?.name, profileToUse?.relation]);

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
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-gradient-to-b from-[#0a0a0a]/90 to-transparent backdrop-blur-md pointer-events-none">
      <div className="max-w-6xl mx-auto flex items-center justify-between pointer-events-auto">
        <Link
          href="/score"
          className={`transition-colors p-2 -m-2 ${
            isScore ? 'text-white/50' : 'text-white/70 hover:text-white'
          }`}
          aria-label="Return to score"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
          </svg>
        </Link>
        <div className="flex items-center gap-4 text-sm text-white/50">
          <Link
            href="/contribute"
            className={`transition-colors ${
              isContributeFlow ? 'text-white/50' : 'hover:text-white'
            }`}
          >
            Contribute
          </Link>
          <InteractButton />
          {profileToUse && (
            <UserMenu
              name={profileToUse.name}
              relation={profileToUse.relation}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>
    </nav>
  );
}
