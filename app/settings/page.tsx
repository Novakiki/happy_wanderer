'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { RELATIONSHIP_OPTIONS } from '@/lib/terminology';
import { formStyles, subtleBackground } from '@/lib/styles';
import { createClient } from '@/lib/supabase/client';

type Profile = {
  id: string;
  name: string;
  relation: string;
  email: string;
};

type Visibility = 'approved' | 'blurred' | 'anonymized' | 'removed' | 'pending';

type IdentityNote = {
  reference_id: string;
  visibility_override: Visibility;
  effective_visibility: Visibility;
  base_visibility: Visibility;
  relationship_to_subject: string | null;
  role: string | null;
  event: {
    id: string;
    title: string;
    year: number;
    year_end: number | null;
    timing_certainty: 'exact' | 'approximate' | 'vague' | null;
    status: string | null;
    privacy_level: string | null;
    contributor_id: string | null;
    contributor: { id: string; name: string | null; relation: string | null } | null;
  } | null;
};

type IdentityAuthorPreference = {
  contributor_id: string | null;
  visibility: Visibility;
  name: string | null;
  relation: string | null;
};

type IdentityData = {
  person: { id: string; name: string | null } | null;
  default_visibility: Visibility;
  default_source: 'preference' | 'person' | 'unknown';
  contributor_name: string | null;
  author_preferences: IdentityAuthorPreference[];
  notes: IdentityNote[];
};

const VISIBILITY_OPTIONS = [
  {
    value: 'approved' as Visibility,
    label: 'Name',
    preview: (name: string, relation?: string) => {
      const namePart = name || 'Sarah Mitchell';
      return relation ? `${namePart} · ${relation}` : namePart;
    },
    icon: '○○○○',
    description: 'Shows your name (and relationship if provided)',
  },
  {
    value: 'blurred' as Visibility,
    label: 'Initials only',
    preview: (name: string) => {
      if (!name) return 'S.M.';
      return name.split(' ').map(n => n[0]).join('.') + '.';
    },
    icon: '○○○',
    description: 'Shows first letters only',
  },
  {
    value: 'anonymized' as Visibility,
    label: 'Relationship',
    preview: (_name: string, relation?: string) => relation ? `a ${relation}` : 'a cousin',
    icon: '○○',
    description: 'Hides your name; shows your relationship only',
  },
  {
    value: 'removed' as Visibility,
    label: 'Hidden',
    preview: () => 'someone',
    icon: '○',
    description: 'Appears as "someone"',
    isRestrictive: true,
  },
] as const;

const VISIBILITY_LABELS: Record<Visibility, string> = {
  approved: 'Name',
  blurred: 'Initials only',
  anonymized: 'Relationship',
  removed: 'Hidden',
  pending: 'Not set',
};

const VISIBILITY_RANK: Record<Visibility, number> = {
  approved: 0,
  blurred: 1,
  anonymized: 1,
  pending: 1,
  removed: 2,
};

function isLessPrivate(candidate: Visibility, base: Visibility) {
  return VISIBILITY_RANK[candidate] < VISIBILITY_RANK[base];
}

const RELATIONSHIP_GROUPS = {
  family: [
    'parent',
    'child',
    'sibling',
    'cousin',
    'aunt_uncle',
    'niece_nephew',
    'grandparent',
    'grandchild',
    'in_law',
    'spouse',
  ],
  social: ['friend', 'neighbor', 'coworker', 'classmate'],
  other: ['acquaintance', 'other', 'unknown'],
} as const;

function formatYearLabel(
  year: number,
  yearEnd: number | null,
  timingCertainty: 'exact' | 'approximate' | 'vague' | null
) {
  const isApproximate = timingCertainty && timingCertainty !== 'exact';
  const hasRange = typeof yearEnd === 'number' && yearEnd !== year;
  if (hasRange) {
    return `${isApproximate ? '~' : ''}${year}-${yearEnd}`;
  }
  return isApproximate ? `~${year}` : String(year);
}
export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);

  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);

  // Identity visibility state
  const [identity, setIdentity] = useState<IdentityData | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [identityError, setIdentityError] = useState('');
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identitySaved, setIdentitySaved] = useState('');
  const [noteSavingId, setNoteSavingId] = useState<string | null>(null);
  const [authorSavingId, setAuthorSavingId] = useState<string | null>(null);
  const [claimingIdentity, setClaimingIdentity] = useState(false);

  // Display name state
  const [displayName, setDisplayName] = useState('');
  const [displayNameSaving, setDisplayNameSaving] = useState(false);
  const [displayNameEditing, setDisplayNameEditing] = useState(false);

  // Notes visibility UI state
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [expandedAuthors, setExpandedAuthors] = useState<Set<string>>(new Set());
  const [bulkSavingAuthorId, setBulkSavingAuthorId] = useState<string | null>(null);

  // Relationship form state
  const [relation, setRelation] = useState('');
  const [customRelation, setCustomRelation] = useState('');
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
        const incomingRelation = data.relation ?? '';
        setRelation(incomingRelation);
        if (incomingRelation && !(incomingRelation in RELATIONSHIP_OPTIONS)) {
          setCustomRelation(incomingRelation);
        }
      }

      setProfileLoading(false);
    };

    void loadProfile();
  }, [supabase]);

  const loadIdentity = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setIdentityLoading(true);
    }
    setIdentityError('');

    try {
      const res = await fetch('/api/settings/identity');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to load identity settings.');
      }
      const data = await res.json();
      setIdentity(data);
      if (data?.person?.name && !displayNameEditing) {
        setDisplayName(data.person.name);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load identity settings.';
      setIdentityError(message);
    } finally {
      if (!silent) {
        setIdentityLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadIdentity();
  }, []);

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

  const handleDisplayNameSave = async () => {
    if (displayNameSaving || !displayName.trim()) return;
    setDisplayNameSaving(true);
    setIdentityError('');
    setIdentitySaved('');

    try {
      const res = await fetch('/api/settings/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'display_name', display_name: displayName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update display name.');
      }
      setIdentitySaved('Display name updated.');
      setDisplayNameEditing(false);
      await loadIdentity({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update display name.';
      setIdentityError(message);
    } finally {
      setDisplayNameSaving(false);
    }
  };

  const handleDefaultVisibility = async (value: Visibility) => {
    if (identitySaving) return;
    setIdentitySaving(true);
    setIdentityError('');
    setIdentitySaved('');

    try {
      const res = await fetch('/api/settings/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'default', visibility: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update default visibility.');
      }
      setIdentitySaved('Default visibility updated.');
      await loadIdentity({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update default visibility.';
      setIdentityError(message);
    } finally {
      setIdentitySaving(false);
    }
  };

  const handleNoteVisibility = async (referenceId: string, value: Visibility) => {
    if (noteSavingId) return;
    setNoteSavingId(referenceId);
    setIdentityError('');
    setIdentitySaved('');

    try {
      const res = await fetch('/api/settings/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'note', reference_id: referenceId, visibility: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update note visibility.');
      }
      setIdentitySaved('Note visibility updated.');
      await loadIdentity({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update note visibility.';
      setIdentityError(message);
    } finally {
      setNoteSavingId(null);
    }
  };

  const handleAuthorVisibility = async (contributorId: string, value: Visibility) => {
    if (authorSavingId) return;
    setAuthorSavingId(contributorId);
    setIdentityError('');
    setIdentitySaved('');

    try {
      const res = await fetch('/api/settings/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'author', contributor_id: contributorId, visibility: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update author preference.');
      }
      setIdentitySaved('Author preference updated.');
      await loadIdentity({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update author preference.';
      setIdentityError(message);
    } finally {
      setAuthorSavingId(null);
    }
  };

  const handleBulkAuthorVisibility = async (contributorId: string, value: Visibility) => {
    if (bulkSavingAuthorId) return;
    setBulkSavingAuthorId(contributorId);
    setIdentityError('');
    setIdentitySaved('');

    try {
      // Get all notes from this author
      const authorNotes = identity?.notes.filter(
        (n) => (n.event?.contributor_id || 'unknown') === contributorId
      ) || [];

      // Update each note sequentially
      for (const note of authorNotes) {
        const res = await fetch('/api/settings/identity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scope: 'note', reference_id: note.reference_id, visibility: value }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Failed to update note visibility.');
        }
      }

      setIdentitySaved(`Updated ${authorNotes.length} notes.`);
      await loadIdentity({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update notes.';
      setIdentityError(message);
    } finally {
      setBulkSavingAuthorId(null);
    }
  };

  const toggleAuthorExpanded = (contributorId: string) => {
    setExpandedAuthors((prev) => {
      const next = new Set(prev);
      if (next.has(contributorId)) {
        next.delete(contributorId);
      } else {
        next.add(contributorId);
      }
      return next;
    });
  };

  const handleClaimIdentity = async () => {
    if (claimingIdentity) return;
    setClaimingIdentity(true);
    setIdentityError('');
    setIdentitySaved('');

    try {
      const res = await fetch('/api/settings/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'claim' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to claim identity.');
      }
      setIdentitySaved('Identity claimed.');
      await loadIdentity({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to claim identity.';
      setIdentityError(message);
    } finally {
      setClaimingIdentity(false);
    }
  };

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
                className="text-xs px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:bg-white/5 disabled:text-white/50 transition-colors"
              >
                {passwordSaving ? 'Updating...' : 'Update password'}
              </button>
            </form>
          </div>

          {/* Relationship */}
          <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-white/80 mb-1">Your relationship to Val</h2>
                <p className="text-xs text-white/50">One line, so we label mentions correctly.</p>
              </div>
              {relationSuccess && <span className="text-xs text-green-400">{relationSuccess}</span>}
            </div>

            <form onSubmit={handleRelationSubmit} className="space-y-3 mt-4">
              <div className="space-y-2">
                <label htmlFor="relation" className="text-xs text-white/60">
                  Relationship
                </label>
                <select
                  id="relation"
                  className={formStyles.select}
                  value={relation && relation in RELATIONSHIP_OPTIONS ? relation : '__custom'}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '__custom') {
                      setRelation(customRelation || '');
                      return;
                    }
                    setRelation(value);
                  }}
                  disabled={profileLoading}
                  required
                >
                  <option value="" disabled>
                    Select relationship
                  </option>
                  {customRelation ? (
                    <optgroup label="Custom">
                      <option value="__custom">{customRelation}</option>
                    </optgroup>
                  ) : (
                    <option value="__custom">Other (type your own)</option>
                  )}
                  <optgroup label="Family">
                    {RELATIONSHIP_GROUPS.family.map((key) => (
                      <option key={key} value={key}>
                        {RELATIONSHIP_OPTIONS[key]}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Social">
                    {RELATIONSHIP_GROUPS.social.map((key) => (
                      <option key={key} value={key}>
                        {RELATIONSHIP_OPTIONS[key]}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Other">
                    {RELATIONSHIP_GROUPS.other.map((key) => (
                      <option key={key} value={key}>
                        {RELATIONSHIP_OPTIONS[key]}
                      </option>
                    ))}
                  </optgroup>
                </select>

                {(customRelation || (!relation || !(relation in RELATIONSHIP_OPTIONS))) && (
                  <input
                    type="text"
                    className={formStyles.inputSmall}
                    placeholder="Type your relationship (optional)"
                    value={customRelation}
                    onChange={(e) => {
                      setCustomRelation(e.target.value);
                      setRelation(e.target.value);
                    }}
                    disabled={profileLoading}
                  />
                )}

                {profileLoading && <p className="text-xs text-white/50">Loading your profile...</p>}
                {profileError && <p className={formStyles.error}>{profileError}</p>}
              </div>

              <button
                type="submit"
                disabled={relationSaving || profileLoading || !relation}
                className="text-xs px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:bg-white/5 disabled:text-white/50 transition-colors"
              >
                {relationSaving ? 'Saving...' : 'Save relationship'}
              </button>
            </form>
          </div>

          {/* Identity visibility */}
          <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-white/80 mb-1">How your name shows</h2>
                <p className="text-xs text-white/50">Choose a default; override specific notes.</p>
                <Link
                  href="/identity"
                  className="text-xs text-[#e07a5f] hover:text-white transition-colors"
                >
                  How identity works →
                </Link>
              </div>
              {identitySaved && <span className="text-xs text-green-400">{identitySaved}</span>}
            </div>

            {identityLoading ? (
              <p className="text-xs text-white/50 mt-3">Loading identity settings...</p>
            ) : identityError ? (
              <p className={`${formStyles.error} mt-3`}>{identityError}</p>
            ) : !identity?.person ? (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-white/50">
                  You have not claimed your identity yet. Claiming lets you control how your name
                  appears across notes.
                </p>
                {identity?.contributor_name && (
                  <p className="text-xs text-white/50">
                    We will claim the identity for {identity.contributor_name}.
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleClaimIdentity}
                  disabled={claimingIdentity}
                  className="px-4 py-2 rounded-xl bg-[#e07a5f] text-white text-sm hover:bg-[#d06a4f] disabled:bg-white/10 disabled:text-white/40 transition-colors"
                >
                  {claimingIdentity ? 'Claiming...' : 'Claim my identity'}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-6">
                {/* Display name */}
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                    Display name
                  </p>
                  {displayNameEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white text-sm focus:outline-none focus:border-[#e07a5f]/50"
                        placeholder="Your display name"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleDisplayNameSave}
                        disabled={displayNameSaving || !displayName.trim()}
                        className="px-3 py-2 rounded-lg bg-[#e07a5f] text-white text-sm hover:bg-[#d06a4f] disabled:bg-white/10 disabled:text-white/40 transition-colors"
                      >
                        {displayNameSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDisplayNameEditing(false);
                          setDisplayName(identity?.person?.name || '');
                        }}
                        className="px-3 py-2 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDisplayNameEditing(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:border-white/20 transition-colors group"
                    >
                      <span className="text-sm">{identity?.person?.name || 'Set your name'}</span>
                      <svg
                        className="w-3.5 h-3.5 text-white/50 group-hover:text-white/70 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )}
                  <p className="text-xs text-white/50">
                    Used when you pick &ldquo;Name.&rdquo;
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">Default in notes</p>
                  <div className="grid grid-cols-2 gap-2">
                    {VISIBILITY_OPTIONS.map((option) => {
                      const isSelected = identity?.default_visibility === option.value;
                      const previewText = option.preview(
                        displayName || identity?.person?.name || '',
                        profile?.relation
                      );
                      const isRestrictive = 'isRestrictive' in option && option.isRestrictive;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={identitySaving}
                          onClick={() => handleDefaultVisibility(option.value)}
                          data-testid={`identity-default-${option.value}`}
                          className={`relative text-left rounded-xl border px-3 py-3 text-sm transition-all ${
                            isSelected
                              ? 'border-[#e07a5f]/50 bg-[#e07a5f]/10'
                              : isRestrictive
                              ? 'border-white/5 bg-white/[0.02] hover:border-white/15'
                              : 'border-white/10 bg-white/5 hover:border-white/20'
                          } ${identitySaving ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`text-xs tracking-widest ${
                              isSelected ? 'text-[#e07a5f]' : 'text-white/30'
                            }`}>
                              {option.icon}
                            </span>
                            <span className={`font-medium ${isSelected ? 'text-white' : 'text-white/70'}`}>
                              {option.label}
                            </span>
                          </span>
                          <span className={`block text-xs mt-1 ${
                            isSelected ? 'text-white/50' : 'text-white/40'
                          }`}>
                            {option.description}
                          </span>
                          <span className={`block text-xs mt-2 font-medium ${
                            isSelected ? 'text-white/80' : 'text-white/50'
                          }`}>
                            &ldquo;{previewText}&rdquo;
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-white/50">
                    Pick your default above; change it for specific notes below.
                  </p>
                </div>

                {identity.author_preferences.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                      Trusted authors
                    </p>
                    <div className="space-y-3">
                      {identity.author_preferences.map((pref) => (
                        <div
                          key={pref.contributor_id || 'unknown'}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm text-white/80">
                                {pref.name || 'Unknown contributor'}
                              </p>
                              {pref.relation && (
                                <p className="text-xs text-white/50">{pref.relation}</p>
                              )}
                            </div>
                            {pref.contributor_id && (
                              <select
                                value={pref.visibility}
                                onChange={(e) => handleAuthorVisibility(pref.contributor_id as string, e.target.value as Visibility)}
                                disabled={authorSavingId === pref.contributor_id}
                                className={`${formStyles.select} text-sm`}
                              >
                                <option value="pending">Use default</option>
                                <option value="approved">Name</option>
                                <option value="blurred">Initials only</option>
                                <option value="anonymized">Relationship</option>
                                <option value="removed">Hidden</option>
                              </select>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                    How your name shows in notes
                  </p>
                  {identity.notes.length === 0 ? (
                    <p className="text-xs text-white/50">
                      No notes mention you yet.
                    </p>
                  ) : (() => {
                    // Calculate stats
                    const totalNotes = identity.notes.filter((n) => n.event).length;
                    const exceptions = identity.notes.filter(
                      (n) => n.event && n.visibility_override && n.visibility_override !== 'pending'
                    );
                    const defaultCount = totalNotes - exceptions.length;

                    // Group exceptions by visibility
                    const exceptionsByVisibility = exceptions.reduce((acc, note) => {
                      const vis = note.visibility_override as Visibility;
                      if (!acc[vis]) acc[vis] = [];
                      acc[vis].push(note);
                      return acc;
                    }, {} as Record<Visibility, typeof exceptions>);

                    // Group all notes by author
                    const notesByAuthor = identity.notes
                      .filter((n) => n.event)
                      .reduce((acc, note) => {
                        const authorId = note.event?.contributor_id || 'unknown';
                        if (!acc[authorId]) {
                          acc[authorId] = {
                            name: note.event?.contributor?.name || 'Someone',
                            relation: note.event?.contributor?.relation || null,
                            notes: [],
                          };
                        }
                        acc[authorId].notes.push(note);
                        return acc;
                      }, {} as Record<string, { name: string; relation: string | null; notes: typeof identity.notes }>);

                    return (
                      <div className="space-y-4">
                        {/* Summary */}
                        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                          <p className="text-sm text-white/80">
                            You appear in <span className="text-white font-medium">{totalNotes}</span> note{totalNotes !== 1 ? 's' : ''}.{' '}
                            {defaultCount > 0 && (
                              <span className="text-white/60">
                                {defaultCount} use{defaultCount === 1 ? 's' : ''} your default ({VISIBILITY_LABELS[identity.default_visibility]})
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Exceptions grouped by visibility */}
                        {exceptions.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs text-white/50 uppercase tracking-wide">
                              {exceptions.length} exception{exceptions.length !== 1 ? 's' : ''}
                            </p>
                            {(['approved', 'blurred', 'anonymized', 'removed'] as Visibility[]).map((vis) => {
                              const notes = exceptionsByVisibility[vis];
                              if (!notes || notes.length === 0) return null;
                              return (
                                <div key={vis} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                                  <div className="px-4 py-2 border-b border-white/10 bg-white/5">
                                    <p className="text-xs text-white/60">
                                      Showing as <span className="text-white/80">{VISIBILITY_LABELS[vis]}</span> ({notes.length})
                                    </p>
                                  </div>
                                  <div className="divide-y divide-white/5">
                                    {notes.map((note) => {
                                      if (!note.event) return null;
                                      const yearLabel = formatYearLabel(
                                        note.event.year,
                                        note.event.year_end,
                                        note.event.timing_certainty
                                      );
                                      const authorName = note.event.contributor?.name || 'Someone';
                                      const baseVisibility = note.base_visibility || identity.default_visibility;
                                      return (
                                        <div key={note.reference_id} className="px-4 py-2 flex items-center justify-between gap-3">
                                          <div className="min-w-0 flex-1">
                                            <Link
                                              href={`/memory/${note.event.id}`}
                                              className="text-sm text-white/80 hover:text-white transition-colors truncate block"
                                            >
                                              {yearLabel} &middot; {note.event.title}
                                            </Link>
                                            <p className="text-xs text-white/40">{authorName}</p>
                                          </div>
                                          <select
                                            data-reference-id={note.reference_id}
                                            data-testid={`note-visibility-${note.reference_id}`}
                                            value={note.visibility_override || 'pending'}
                                            onChange={(e) => handleNoteVisibility(note.reference_id, e.target.value as Visibility)}
                                            disabled={noteSavingId === note.reference_id}
                                            className="text-xs px-2 py-1 rounded-lg bg-white/10 border border-white/10 text-white/70"
                                          >
                                            <option value="pending">Default</option>
                                            <option value="approved" disabled={isLessPrivate('approved', baseVisibility)}>Name</option>
                                            <option value="blurred" disabled={isLessPrivate('blurred', baseVisibility)}>Initials only</option>
                                            <option value="anonymized" disabled={isLessPrivate('anonymized', baseVisibility)}>Relationship</option>
                                            <option value="removed" disabled={isLessPrivate('removed', baseVisibility)}>Hidden</option>
                                          </select>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Toggle to show all notes */}
                        <button
                          type="button"
                          onClick={() => setShowAllNotes(!showAllNotes)}
                          data-testid="identity-notes-toggle"
                          className="w-full text-left px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-between"
                        >
                          <span className="text-sm text-white/70">
                            {showAllNotes ? 'Hide all notes' : 'Show all notes by author'}
                          </span>
                          <svg
                            className={`w-4 h-4 text-white/50 transition-transform ${showAllNotes ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* All notes grouped by author */}
                        {showAllNotes && (
                          <div className="space-y-3">
                            {Object.entries(notesByAuthor).map(([authorId, author]) => {
                              const isExpanded = expandedAuthors.has(authorId);
                              const isSaving = bulkSavingAuthorId === authorId;
                              return (
                                <div key={authorId} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                                  {/* Author header */}
                                  <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-white/10 bg-white/5">
                                    <button
                                      type="button"
                                      onClick={() => toggleAuthorExpanded(authorId)}
                                      data-author-id={authorId}
                                      data-testid={`identity-author-${authorId}`}
                                      className="flex items-center gap-2 text-left flex-1 min-w-0"
                                    >
                                      <svg
                                        className={`w-3.5 h-3.5 text-white/50 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      <div className="min-w-0">
                                        <p className="text-sm text-white/80 truncate">
                                          {author.name}
                                          {author.relation && <span className="text-white/50"> ({author.relation})</span>}
                                        </p>
                                        <p className="text-xs text-white/40">{author.notes.length} note{author.notes.length !== 1 ? 's' : ''}</p>
                                      </div>
                                    </button>
                                    <select
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleBulkAuthorVisibility(authorId, e.target.value as Visibility);
                                          e.target.value = '';
                                        }
                                      }}
                                      disabled={isSaving}
                                      className="text-xs px-2 py-1 rounded-lg bg-white/10 border border-white/10 text-white/70"
                                      value=""
                                    >
                                      <option value="">Set all...</option>
                                      <option value="pending">Default</option>
                                      <option value="approved">Name</option>
                                      <option value="blurred">Initials</option>
                                      <option value="anonymized">Relationship</option>
                                      <option value="removed">Hidden</option>
                                    </select>
                                  </div>

                                  {/* Author's notes (when expanded) */}
                                  {isExpanded && (
                                    <div className="divide-y divide-white/5">
                                      {author.notes.map((note) => {
                                        if (!note.event) return null;
                                        const yearLabel = formatYearLabel(
                                          note.event.year,
                                          note.event.year_end,
                                          note.event.timing_certainty
                                        );
                                        const overrideValue = note.visibility_override || 'pending';
                                        const baseVisibility = note.base_visibility || identity.default_visibility;
                                        return (
                                          <div key={note.reference_id} className="px-4 py-2 flex items-center justify-between gap-3">
                                            <Link
                                              href={`/memory/${note.event.id}`}
                                              className="text-sm text-white/70 hover:text-white transition-colors truncate flex-1 min-w-0"
                                            >
                                              {yearLabel} &middot; {note.event.title}
                                            </Link>
                                            <select
                                              data-reference-id={note.reference_id}
                                              data-testid={`note-visibility-${note.reference_id}`}
                                              value={overrideValue}
                                              onChange={(e) => handleNoteVisibility(note.reference_id, e.target.value as Visibility)}
                                              disabled={noteSavingId === note.reference_id || isSaving}
                                              className="text-xs px-2 py-1 rounded-lg bg-white/10 border border-white/10 text-white/70"
                                            >
                                              <option value="pending">Default</option>
                                              <option value="approved" disabled={isLessPrivate('approved', baseVisibility)}>Name</option>
                                              <option value="blurred" disabled={isLessPrivate('blurred', baseVisibility)}>Initials</option>
                                              <option value="anonymized" disabled={isLessPrivate('anonymized', baseVisibility)}>Relationship</option>
                                              <option value="removed" disabled={isLessPrivate('removed', baseVisibility)}>Hidden</option>
                                            </select>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {isSaving && (
                                    <div className="px-4 py-2 bg-white/5 border-t border-white/10">
                                      <p className="text-xs text-white/50">Updating all notes...</p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

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
