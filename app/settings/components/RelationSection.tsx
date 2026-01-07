'use client';

import { useEffect, useMemo, useState } from 'react';

import { RELATIONSHIP_OPTIONS } from '@/lib/terminology';
import { formStyles } from '@/lib/styles';
import { createClient } from '@/lib/supabase/client';

type Profile = {
  id: string;
  name: string;
  relation: string;
  email: string;
};

type Props = {
  profile: Profile | null;
  profileLoading: boolean;
  profileError: string;
  onProfileUpdate: (profile: Profile) => void;
};

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

export default function RelationSection({
  profile,
  profileLoading,
  profileError,
  onProfileUpdate,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [relation, setRelation] = useState('');
  const [customRelation, setCustomRelation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Sync relation from profile on load
  useEffect(() => {
    if (profile) {
      const incomingRelation = profile.relation ?? '';
      setRelation(incomingRelation);
      if (incomingRelation && !(incomingRelation in RELATIONSHIP_OPTIONS)) {
        setCustomRelation(incomingRelation);
      }
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmed = relation.trim();
    if (!trimmed) {
      setError('Relationship is required.');
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('Please sign in to update your relationship.');
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        relation: trimmed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      setError('Failed to update relationship. Please try again.');
    } else {
      setSuccess('Relationship updated.');
      if (profile) {
        onProfileUpdate({ ...profile, relation: trimmed });
      }
    }

    setSaving(false);
  };

  return (
    <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-white/80 mb-1">Your relationship to Val</h2>
          <p className="text-xs text-white/50">One line, so we label mentions correctly.</p>
        </div>
        {success && <span className="text-xs text-green-400">{success}</span>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 mt-4">
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
          {error && <p className={formStyles.error}>{error}</p>}
        </div>

        <button
          type="submit"
          disabled={saving || profileLoading || !relation}
          className="text-xs px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 disabled:bg-white/5 disabled:text-white/50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save relationship'}
        </button>
      </form>
    </div>
  );
}
