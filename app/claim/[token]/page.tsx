/**
 * Claim Page - Identity Visibility Management via SMS Link
 * =========================================================
 *
 * PURPOSE:
 * Allows people mentioned in memories to control how their name appears
 * WITHOUT requiring signup. Entry point from SMS notification.
 *
 * FLOW:
 * 1. User receives SMS: "You were mentioned in a memory of Val..."
 * 2. Clicks link -> /claim/{token}
 * 3. Page shows memory context and visibility options
 * 4. User selects visibility preference
 * 5. Success screen offers signup to add their own memories
 *
 * DESIGN:
 * - Mirrors /respond/[id] page pattern
 * - No auth required (token-based access)
 * - Simple focused UX for first-time visitors
 */
'use client';

import { formStyles, subtleBackground } from '@/lib/styles';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type ClaimData = {
  id: string;
  recipient_name: string;
  already_used: boolean;
};

type EventData = {
  id: string;
  title: string;
  preview: string | null;
  year: number;
  year_end: number | null;
  contributor_id: string | null;
  contributor_name: string;
};

type Visibility = 'approved' | 'blurred' | 'anonymized' | 'removed';
type VisibilityScope = 'this_note' | 'by_author' | 'all_notes';

const VISIBILITY_OPTIONS = [
  {
    value: 'approved' as const,
    label: 'Show my full name',
    hint: 'Your full name appears on this note.',
  },
  {
    value: 'blurred' as const,
    label: 'Show initials only',
    hint: 'Example: "S.M."',
  },
  {
    value: 'anonymized' as const,
    label: 'Show my relationship only',
    hint: 'Example: "a cousin".',
  },
  {
    value: 'removed' as const,
    label: 'Remove me from this note',
    hint: "Your name won't appear at all.",
  },
];

export default function ClaimPage() {
  const params = useParams();
  const token = params.token as string;

  const [claim, setClaim] = useState<ClaimData | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [visibility, setVisibility] = useState<Visibility>('anonymized');
  const [scope, setScope] = useState<VisibilityScope>('this_note');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    async function fetchClaim() {
      try {
        const res = await fetch(`/api/claim/verify?token=${token}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('This link is invalid or has expired.');
          } else {
            setError('Something went wrong. Please try again.');
          }
          return;
        }
        const data = await res.json();
        setClaim(data.claim);
        setEvent(data.event);
      } catch {
        setError('Failed to load claim.');
      } finally {
        setLoading(false);
      }
    }
    fetchClaim();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/claim/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, visibility, scope }),
      });

      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        setError(result?.error || 'Failed to save your preference.');
        return;
      }

      setIsSubmitted(true);
    } catch {
      setError('Failed to save your preference. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={formStyles.pageContainer} style={subtleBackground}>
        <div className={formStyles.contentWrapper}>
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={formStyles.pageContainer} style={subtleBackground}>
        <div className={formStyles.contentWrapper}>
          <h1 className={formStyles.pageTitle}>Oops</h1>
          <p className="text-white/60 mt-4">{error}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (isSubmitted) {
    const visibilityLabel =
      visibility === 'approved'
        ? 'full name'
        : visibility === 'blurred'
          ? 'initials only'
          : visibility === 'removed'
            ? 'hidden'
            : 'relationship only';

    return (
      <div className={formStyles.pageContainer} style={subtleBackground}>
        <div className={formStyles.contentWrapper}>
          <h1 className={formStyles.pageTitle}>Saved</h1>
          <p className="text-white/60 mt-4 leading-relaxed">
            Your name will now appear as <span className="text-white">{visibilityLabel}</span>
            {scope === 'all_notes'
              ? ' on all notes where you are mentioned'
              : scope === 'by_author'
                ? ` on notes by ${event?.contributor_name}`
                : ' on this note'}
            .
          </p>

          <div className="mt-8">
            <Link href={`/memory/${event?.id}`} className={formStyles.buttonSecondary}>
              View the note
            </Link>
          </div>

          {/* Signup prompt */}
          <div className={`${formStyles.section} mt-8 border-[#e07a5f]/30`}>
            <h2 className="text-lg font-serif text-white mb-2">Have memories of Val?</h2>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              Sign up to share your own memories, add details, or respond to others&apos;
              stories. Your voice helps her children know her.
            </p>
            <Link href="/auth/signup" className={formStyles.buttonPrimary}>
              Sign up to contribute
            </Link>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/score"
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              Or explore what others have shared →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!claim || !event) return null;

  const yearDisplay =
    event.year_end && event.year_end !== event.year
      ? `${event.year}–${event.year_end}`
      : event.year;

  return (
    <div className={formStyles.pageContainer} style={subtleBackground}>
      <div className={formStyles.contentWrapper}>
        <p className={formStyles.subLabel}>
          You were mentioned by <span className="text-[#e07a5f]">{event.contributor_name}</span>
        </p>
        <h1 className={formStyles.pageTitle}>Choose how your name appears.</h1>
        <p className="text-sm text-white/60 leading-relaxed mt-4">
          This is a private, invitation-only space preserving memories of Valerie Park Anderson.
          You control how your name appears on notes that mention you.
        </p>

        {/* The memory context */}
        <div className={`${formStyles.section} mt-8`}>
          <p className="text-xs text-white/50 mb-2">{yearDisplay}</p>
          <h2 className="text-lg font-medium text-white mb-3">{event.title}</h2>
          {event.preview && (
            <p className="text-white/70 text-sm leading-relaxed">{event.preview}</p>
          )}
          <p className="text-xs text-white/50 mt-4">— {event.contributor_name}</p>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Names are masked per note. You choose how your name appears.{' '}
          <Link
            href="/identity"
            className="ml-2 text-white/80 underline underline-offset-4 hover:text-white"
          >
            How identity works
          </Link>
        </div>

        {claim.already_used && (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            You&apos;ve already set a preference using this link. You can update it below.
          </div>
        )}

        {/* Visibility form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label className={formStyles.label}>How should your name appear?</label>
            <div className="space-y-2">
              {VISIBILITY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    visibility === option.value
                      ? 'border-[#e07a5f]/50 bg-[#e07a5f]/10 text-white'
                      : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={option.value}
                    checked={visibility === option.value}
                    onChange={() => setVisibility(option.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-white">{option.label}</span>
                    <span className="block text-xs text-white/50">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={formStyles.label}>Apply to</label>
            <div className="space-y-2">
              <label
                className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-colors ${
                  scope === 'this_note'
                    ? 'border-white/30 bg-white/10 text-white'
                    : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="this_note"
                  checked={scope === 'this_note'}
                  onChange={() => setScope('this_note')}
                  className="mt-1"
                />
                <span>
                  <span className="block text-white">This note only</span>
                </span>
              </label>

              {event.contributor_id && (
                <label
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    scope === 'by_author'
                      ? 'border-white/30 bg-white/10 text-white'
                      : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    value="by_author"
                    checked={scope === 'by_author'}
                    onChange={() => setScope('by_author')}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-white">All notes by {event.contributor_name}</span>
                    <span className="block text-xs text-white/50">
                      Trust this person with your visibility
                    </span>
                  </span>
                </label>
              )}

              <label
                className={`flex items-start gap-3 rounded-xl border px-3 py-2 text-sm cursor-pointer transition-colors ${
                  scope === 'all_notes'
                    ? 'border-white/30 bg-white/10 text-white'
                    : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  value="all_notes"
                  checked={scope === 'all_notes'}
                  onChange={() => setScope('all_notes')}
                  className="mt-1"
                />
                <span>
                  <span className="block text-white">All notes where I&apos;m mentioned</span>
                  <span className="block text-xs text-white/50">Set as my default preference</span>
                </span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={formStyles.buttonPrimaryFull}
          >
            {isSubmitting ? 'Saving...' : 'Save my preference'}
          </button>
        </form>
      </div>
    </div>
  );
}
