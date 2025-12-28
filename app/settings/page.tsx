'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { formStyles, subtleBackground } from '@/lib/styles';
import { createClient } from '@/lib/supabase/client';

type Profile = {
  id: string;
  name: string;
  relation: string;
  email: string;
};

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);

  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);

  // Relationship form state
  const [relation, setRelation] = useState('');
  const [relationSaving, setRelationSaving] = useState(false);
  const [relationError, setRelationError] = useState('');
  const [relationSuccess, setRelationSuccess] = useState('');

  // Password form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

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
        setRelation(data.relation ?? '');
      }

      setProfileLoading(false);
    };

    void loadProfile();
  }, [supabase]);

  const handleRelationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRelationError('');
    setRelationSuccess('');

    const trimmed = relation.trim();
    if (!trimmed) {
      setRelationError('Relationship is required.');
      return;
    }

    setRelationSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setRelationError('Please sign in to update your relationship.');
      setRelationSaving(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        relation: trimmed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      setRelationError('Failed to update relationship. Please try again.');
    } else {
      setRelationSuccess('Relationship updated.');
      setProfile((prev) => (prev ? { ...prev, relation: trimmed } : prev));
    }

    setRelationSaving(false);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    setPasswordSaving(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setPasswordError(error.message || 'Failed to update password.');
    } else {
      setPasswordSuccess('Password updated.');
      setPassword('');
      setConfirmPassword('');
    }

    setPasswordSaving(false);
  };

  return (
    <div className="min-h-screen text-white" style={subtleBackground}>
      <div className="max-w-xl mx-auto px-6 py-24">
        <Link
          href="/score"
          className="text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white/60 transition-colors"
        >
          &larr; Back to the score
        </Link>

        <h1 className="text-2xl font-light text-white/90 mt-8 mb-8">
          Settings
        </h1>

        <div className="space-y-6">
          {/* Password */}
          <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-white/80 mb-1">Password</h2>
                <p className="text-xs text-white/50">Update your password</p>
              </div>
              {passwordSuccess && <span className="text-xs text-green-400">{passwordSuccess}</span>}
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-3 mt-4">
              <div className="space-y-2">
                <label htmlFor="new-password" className="text-xs text-white/60">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  className={formStyles.inputSmall}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-xs text-white/60">
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  className={formStyles.inputSmall}
                  placeholder="Type it again"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {passwordError && <p className={formStyles.error}>{passwordError}</p>}

              <button
                type="submit"
                disabled={passwordSaving || !password || !confirmPassword}
                className="text-xs px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:bg-white/5 disabled:text-white/40 transition-colors"
              >
                {passwordSaving ? 'Updating...' : 'Update password'}
              </button>
            </form>
          </div>

          {/* Relationship */}
          <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-white/80 mb-1">Relationship</h2>
                <p className="text-xs text-white/50">How you knew Val</p>
              </div>
              {relationSuccess && <span className="text-xs text-green-400">{relationSuccess}</span>}
            </div>

            <form onSubmit={handleRelationSubmit} className="space-y-3 mt-4">
              <div className="space-y-2">
                <label htmlFor="relation" className="text-xs text-white/60">
                  Relationship to Val
                </label>
                <input
                  id="relation"
                  type="text"
                  className={formStyles.inputSmall}
                  placeholder="e.g., daughter, cousin, friend, bandmate"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  disabled={profileLoading}
                  required
                />
                {profileLoading && <p className="text-xs text-white/40">Loading your profile...</p>}
                {profileError && <p className={formStyles.error}>{profileError}</p>}
              </div>

              <button
                type="submit"
                disabled={relationSaving || profileLoading || !relation}
                className="text-xs px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:bg-white/5 disabled:text-white/40 transition-colors"
              >
                {relationSaving ? 'Saving...' : 'Save relationship'}
              </button>
            </form>
          </div>

          {/* Notifications */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <h2 className="text-sm font-medium text-white/80 mb-1">Notifications</h2>
            <p className="text-xs text-white/40 mb-3">Email preferences for new notes and responses</p>
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
