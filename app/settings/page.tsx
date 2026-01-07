'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { subtleBackground } from '@/lib/styles';
import { createClient } from '@/lib/supabase/client';

import PasswordSection from './components/PasswordSection';
import RelationSection from './components/RelationSection';
import IdentitySection from './components/IdentitySection';

type Profile = {
  id: string;
  name: string;
  relation: string;
  email: string;
};

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);

  // Profile state (shared with RelationSection)
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError('');

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setProfileError('Please sign in to manage settings.');
        setProfileLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, relation, email')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        setProfileError('Could not load your profile. Please try again.');
      } else if (!data) {
        setProfileError('Please complete your profile before updating settings.');
      } else {
        setProfile(data);
      }

      setProfileLoading(false);
    };

    void loadProfile();
  }, [supabase]);

  return (
    <div className="min-h-screen text-white" style={subtleBackground}>
      <div className="max-w-xl mx-auto px-6 py-24">
        <Link
          href="/score"
          className="text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white/70 transition-colors"
        >
          &larr; Back to the score
        </Link>

        <h1 className="text-2xl font-light text-white/90 mt-8 mb-8">
          Settings
        </h1>

        <div className="space-y-6">
          <PasswordSection />

          <RelationSection
            profile={profile}
            profileLoading={profileLoading}
            profileError={profileError}
            onProfileUpdate={setProfile}
          />

          <IdentitySection profileRelation={profile?.relation} />

          {/* Notifications */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <h2 className="text-sm font-medium text-white/80 mb-1">Notifications</h2>
            <p className="text-xs text-white/50 mb-3">Email preferences for new notes and responses</p>
            <button
              disabled
              className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-white/30 cursor-not-allowed"
            >
              Coming soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
