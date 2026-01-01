/**
 * Respond Page - Invited User Response Flow
 * ==========================================
 *
 * PURPOSE:
 * This page allows invited users to respond to a memory they were mentioned in
 * WITHOUT requiring signup. It's the entry point for the "chain mail" invite system.
 *
 * FLOW:
 * 1. User receives SMS with link: /respond/{inviteId}
 * 2. Page loads the original memory and shows context
 * 3. User submits their perspective (name + content only - intentionally simple)
 * 4. Response creates a new timeline_event linked via memory_threads
 * 5. Success screen offers:
 *    - Email capture (for notifications)
 *    - SIGNUP PROMPT to add more memories (guided path to full contributor)
 *
 * DESIGN DECISIONS:
 * - No auth required: Reduces friction for first-time responders
 * - Simple form: Only name + content (no timing, provenance, people fields)
 * - Guided path: After responding, prompt signup for full access to MemoryForm
 * - This creates a natural funnel: invited → respond → want more? → sign up
 *
 * RELATED FILES:
 * - /api/respond/route.ts - API that creates the response event
 * - /lib/invites.ts - Invite creation and SMS link helpers
 * - /components/MemoryForm.tsx - Full form for authenticated contributors
 */
'use client';

import FirstTimeGuide from '@/components/FirstTimeGuide';
import { formatRelationshipContext } from '@/lib/invites';
import { getLintSuggestion } from '@/lib/lint-copy';
import { formStyles, subtleBackground } from '@/lib/styles';
import { RELATIONSHIP_OPTIONS } from '@/lib/terminology';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type InviteData = {
  id: string;
  recipient_name: string;
  sender_name: string;
  sender_id: string | null;
  relationship_to_subject?: string | null;
  identity_visibility?: 'approved' | 'blurred' | 'anonymized' | 'pending' | 'removed' | null;
  event: {
    id: string;
    title: string;
    content: string;
    year: number;
    year_end: number | null;
  };
};

type VisibilityScope = 'this_note' | 'by_author' | 'all_notes';
type Visibility = 'approved' | 'blurred' | 'anonymized' | 'removed';

type LintWarning = {
  code: string;
  message: string;
  suggestion?: string;
  severity?: 'soft' | 'strong';
  match?: string;
};

const lintTone = (severity?: LintWarning['severity']) => ({
  message: severity === 'soft' ? 'text-sm text-white/50' : 'text-sm text-white/70',
  suggestion: severity === 'soft' ? 'text-xs text-white/40' : 'text-xs text-white/50',
});

type ViewerIdentity = {
  is_authenticated: boolean;
  has_identity: boolean;
  default_visibility: 'approved' | 'blurred' | 'anonymized' | 'removed' | 'pending';
  default_source: 'preference' | 'person' | 'unknown';
};

const VISIBILITY_LABELS: Record<ViewerIdentity['default_visibility'], string> = {
  approved: 'Full name',
  blurred: 'Initials only',
  anonymized: 'Relationship only',
  removed: 'Hidden',
  pending: 'Not set',
};

const ALLOWED_VISIBILITY = new Set<Visibility>([
  'approved',
  'blurred',
  'anonymized',
  'removed',
]);

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

const IDENTITY_VISIBILITY_OPTIONS = [
  {
    value: 'approved',
    label: 'Show my full name',
    hint: 'Your full name appears on this note.',
  },
  {
    value: 'blurred',
    label: 'Show initials only',
    hint: 'Example: "S.M."',
  },
  {
    value: 'anonymized',
    label: 'Show my relationship only',
    hint: 'Example: "a cousin".',
  },
  {
    value: 'removed',
    label: 'Remove me from this note',
    hint: 'Your name won\'t appear at all.',
  },
] as const;

export default function RespondPage() {
  const params = useParams();
  const inviteId = params.id as string;
  const searchParams = useSearchParams();
  const manageMode = searchParams?.get('manage') === '1';

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [llmReasons, setLlmReasons] = useState<string[]>([]);
  const [lintWarnings, setLintWarnings] = useState<LintWarning[]>([]);

  const [viewerIdentity, setViewerIdentity] = useState<ViewerIdentity | null>(null);
  const [identityOverrideEnabled, setIdentityOverrideEnabled] = useState(false);

  const [name, setName] = useState('');
  const [response, setResponse] = useState('');
  const [relationshipToSubject, setRelationshipToSubject] = useState('');
  const [identityVisibility, setIdentityVisibility] = useState<Visibility>('anonymized');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Email capture after submission
  const [contributorId, setContributorId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailSkipped, setEmailSkipped] = useState(false);

  // Visibility management after submission
  const [showVisibilityEditor, setShowVisibilityEditor] = useState(false);
  const [visibilityUpdating, setVisibilityUpdating] = useState(false);
  const [visibilitySaved, setVisibilitySaved] = useState(false);

  const identityLabel =
    identityVisibility === 'approved'
      ? 'Full name'
      : identityVisibility === 'blurred'
      ? 'Initials only'
      : identityVisibility === 'removed'
      ? 'Removed from note'
      : 'Relationship only';
  const defaultVisibility = viewerIdentity?.has_identity &&
    ALLOWED_VISIBILITY.has(viewerIdentity.default_visibility as Visibility)
    ? (viewerIdentity.default_visibility as Visibility)
    : null;
  const canUseDefaultVisibility = Boolean(defaultVisibility);
  const showIdentityOptions = !canUseDefaultVisibility || identityOverrideEnabled;
  const defaultVisibilityLabel = defaultVisibility
    ? VISIBILITY_LABELS[defaultVisibility]
    : 'Default';
  const [visibilityScope, setVisibilityScope] = useState<VisibilityScope>('this_note');

  useEffect(() => {
    if (manageMode) {
      setVisibilityScope('this_note');
    }
  }, [manageMode]);

  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await fetch(`/api/respond?id=${inviteId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('This invitation link is invalid or has expired.');
          } else {
            setError('Something went wrong. Please try again.');
          }
          return;
        }
        const data = await res.json();
        setInvite(data.invite);
        const viewer = (data.viewer_identity || null) as ViewerIdentity | null;
        setViewerIdentity(viewer);
        setName(data.invite.recipient_name || '');
        setRelationshipToSubject(data.invite.relationship_to_subject || '');
        const defaultVisibility = viewer?.has_identity
          ? (ALLOWED_VISIBILITY.has(viewer.default_visibility as Visibility)
            ? (viewer.default_visibility as Visibility)
            : null)
          : null;

        if (defaultVisibility) {
          setIdentityVisibility(defaultVisibility);
          setIdentityOverrideEnabled(false);
        } else if (data.invite.identity_visibility === 'approved' ||
          data.invite.identity_visibility === 'blurred' ||
          data.invite.identity_visibility === 'anonymized' ||
          data.invite.identity_visibility === 'removed') {
          setIdentityVisibility(data.invite.identity_visibility);
          setIdentityOverrideEnabled(true);
        } else {
          setIdentityVisibility('anonymized');
          setIdentityOverrideEnabled(true);
        }
      } catch {
        setError('Failed to load invitation.');
      } finally {
        setLoading(false);
      }
    }
    fetchInvite();
  }, [inviteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!response.trim()) return;

    setSubmitError('');
    setLlmReasons([]);
    setLintWarnings([]);
    const shouldSendIdentity = !canUseDefaultVisibility || identityOverrideEnabled;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_id: inviteId,
          name: name.trim(),
          content: response.trim(),
          relationship_to_subject: relationshipToSubject,
          identity_visibility: shouldSendIdentity ? identityVisibility : null,
        }),
      });

      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        if (Array.isArray(result?.lintWarnings)) {
          setLintWarnings(result.lintWarnings);
        }
        if (res.status === 422) {
          setSubmitError('LLM review blocked submission. Please address the issues below.');
          setLlmReasons(result?.reasons || []);
          return;
        }
        setSubmitError(result?.error || 'Failed to submit your response. Please try again.');
        return;
      }

      const result = await res.json().catch(() => ({}));
      if (result.contributor_id) {
        setContributorId(result.contributor_id);
      }
      if (Array.isArray(result?.lintWarnings)) {
        setLintWarnings(result.lintWarnings);
      }
      setIsSubmitted(true);
    } catch {
      setSubmitError('Failed to submit your response. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !contributorId) return;

    setEmailSubmitting(true);
    try {
      const res = await fetch('/api/respond/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contributor_id: contributorId,
          email: email.trim(),
        }),
      });

      if (res.ok) {
        setEmailSaved(true);
      }
    } catch {
      // Silently fail - don't block their experience
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleVisibilityUpdate = async (newVisibility: 'approved' | 'blurred' | 'anonymized' | 'removed') => {
    setVisibilityUpdating(true);
    try {
      const res = await fetch('/api/respond/visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_id: inviteId,
          identity_visibility: newVisibility,
          scope: visibilityScope,
          contributor_id: visibilityScope === 'by_author' ? invite?.sender_id : null,
        }),
      });

      if (res.ok) {
        setIdentityVisibility(newVisibility);
        setVisibilitySaved(true);
        setShowVisibilityEditor(false);
        // Reset the saved indicator after a moment
        setTimeout(() => setVisibilitySaved(false), 2000);
      }
    } catch {
      // Silently fail
    } finally {
      setVisibilityUpdating(false);
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

  /**
   * SUCCESS STATE
   * After submitting a response, show:
   * 1. Thank you message
   * 2. Email capture (optional - for notifications)
   * 3. SIGNUP PROMPT - the key conversion point for the guided path
   * 4. Link to browse memories
   */
  if (isSubmitted) {
    return (
      <div className={formStyles.pageContainer} style={subtleBackground}>
        <div className={formStyles.contentWrapper}>
          <h1 className={formStyles.pageTitle}>Thank you</h1>
          <p className="text-white/60 mt-4 leading-relaxed">
            Your memory has been added. It means a lot to have your perspective.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/score" className={formStyles.buttonSecondary}>
              View The Score
            </Link>
          </div>

          {lintWarnings.length > 0 && (
            <div className={`${formStyles.section} mt-8`}>
              <p className="text-xs uppercase tracking-wider text-white/50 mb-3">
                Writing guidance (optional)
              </p>
              <p className="text-sm text-white/50 mb-3">
                Gentle suggestions if you want to refine this note.
              </p>
              <p className="text-xs text-white/40 mb-3">
                Quoted text is the phrase we noticed.
              </p>
              <div className="space-y-3">
                {lintWarnings.map((warning, idx) => {
                  const tone = lintTone(warning.severity);
                  const suggestion = getLintSuggestion(warning.code, warning.suggestion);
                  return (
                    <div key={`${warning.code}-${idx}`} className="space-y-1">
                      <p className={tone.message}>
                        {warning.match && (
                          <span className="font-medium text-white/80">"{warning.match}"</span>
                        )}
                        {warning.match ? ' — ' : ''}{warning.message}
                      </p>
                      {suggestion && (
                        <p className={tone.suggestion}>{suggestion}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Visibility management - show current choice with option to change */}
          <div className={`${formStyles.section} mt-8`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-white/50 mb-1">
                  Your name appears as
                </p>
                <p className="text-white/80">
                  {identityLabel}
                  {visibilitySaved && (
                    <span className="ml-2 text-emerald-400 text-sm">✓ Saved</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVisibilityEditor(!showVisibilityEditor)}
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                {showVisibilityEditor ? 'Cancel' : 'Change'}
              </button>
            </div>

            {showVisibilityEditor && (
              <div className="mt-4 space-y-4">
                {/* Visibility options */}
                <div className="space-y-2">
                  <p className="text-xs text-white/50 uppercase tracking-wider">How to show my name</p>
                  {IDENTITY_VISIBILITY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-start gap-3 w-full text-left rounded-xl border px-3 py-2 text-sm transition-colors cursor-pointer ${
                        identityVisibility === option.value
                          ? 'border-[#e07a5f]/50 bg-[#e07a5f]/10 text-white'
                          : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                      }`}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value={option.value}
                        checked={identityVisibility === option.value}
                        onChange={() => setIdentityVisibility(option.value)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-white">{option.label}</span>
                        <span className="block text-xs text-white/50">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>

                {/* Scope options */}
                <div className="space-y-2">
                  <p className="text-xs text-white/50 uppercase tracking-wider">Apply to</p>
                  <label
                    className={`flex items-start gap-3 w-full text-left rounded-xl border px-3 py-2 text-sm transition-colors cursor-pointer ${
                      visibilityScope === 'this_note'
                        ? 'border-white/30 bg-white/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value="this_note"
                      checked={visibilityScope === 'this_note'}
                      onChange={() => setVisibilityScope('this_note')}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-white">This note only</span>
                    </span>
                  </label>
                  {invite?.sender_id && (
                    <label
                      className={`flex items-start gap-3 w-full text-left rounded-xl border px-3 py-2 text-sm transition-colors cursor-pointer ${
                        visibilityScope === 'by_author'
                          ? 'border-white/30 bg-white/10 text-white'
                          : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scope"
                        value="by_author"
                        checked={visibilityScope === 'by_author'}
                        onChange={() => setVisibilityScope('by_author')}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-white">All notes by {invite.sender_name}</span>
                        <span className="block text-xs text-white/50">Trust this person with your visibility</span>
                      </span>
                    </label>
                  )}
                  <label
                    className={`flex items-start gap-3 w-full text-left rounded-xl border px-3 py-2 text-sm transition-colors cursor-pointer ${
                      visibilityScope === 'all_notes'
                        ? 'border-white/30 bg-white/10 text-white'
                        : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value="all_notes"
                      checked={visibilityScope === 'all_notes'}
                      onChange={() => setVisibilityScope('all_notes')}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-white">All notes where I&apos;m mentioned</span>
                      <span className="block text-xs text-white/50">Set as my default preference</span>
                    </span>
                  </label>
                </div>

                {/* Save button */}
                <button
                  type="button"
                  disabled={visibilityUpdating}
                  onClick={() => handleVisibilityUpdate(identityVisibility)}
                  className={`w-full py-2 rounded-xl text-sm font-medium transition-colors ${
                    visibilityUpdating
                      ? 'bg-white/10 text-white/50 cursor-wait'
                      : 'bg-[#e07a5f] text-white hover:bg-[#d06a4f]'
                  }`}
                >
                  {visibilityUpdating ? 'Saving...' : 'Save preference'}
                </button>
              </div>
            )}
          </div>
          <div className="mt-3">
            <Link
              href={`/respond/${inviteId}?manage=1`}
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              Manage visibility for this note →
            </Link>
          </div>

          {/* Email capture - only show if we have contributorId and haven't saved/skipped */}
          {contributorId && !emailSaved && !emailSkipped && (
            <div className={`${formStyles.section} mt-8`}>
              <p className="text-white/80 text-sm mb-3">
                Want to be notified if someone adds to this story?
              </p>
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email (optional)"
                  className={formStyles.input}
                />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={!email.trim() || emailSubmitting}
                    className={formStyles.buttonPrimary}
                  >
                    {emailSubmitting ? 'Saving...' : 'Notify me'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailSkipped(true)}
                    className={formStyles.buttonSecondary}
                  >
                    No thanks
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Email saved confirmation */}
          {emailSaved && (
            <p className="text-white/60 mt-6 text-sm">
              We&apos;ll let you know if someone continues this thread.
            </p>
          )}

          {/*
           * SIGNUP PROMPT - Guided Path Conversion Point
           * This is the key UX decision: invited users who want to do more
           * than respond to a single memory should sign up for full access.
           * Full access = MemoryForm with timing, provenance, people, links, etc.
           */}
          <div className={`${formStyles.section} mt-8 border-[#e07a5f]/30`}>
            <h2 className="text-lg font-serif text-white mb-2">
              Have more memories of Val?
            </h2>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              Sign up to add your own memories, mark meaningful dates, or share
              photos and stories. Your voice helps her children know her.
            </p>
            <Link
              href="/auth/signup"
              className={formStyles.buttonPrimary}
            >
              Sign up to contribute more
            </Link>
          </div>

          {/* Secondary action - browse without signing up */}
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

  if (!invite) return null;

  const yearDisplay = invite.event.year_end && invite.event.year_end !== invite.event.year
    ? `${invite.event.year}–${invite.event.year_end}`
    : invite.event.year;

  const relationshipContext = formatRelationshipContext(invite.relationship_to_subject, RELATIONSHIP_OPTIONS);
  const whyLink = `/why?from=invite&inviteId=${encodeURIComponent(inviteId)}`;

  if (manageMode) {
    return (
      <div className={formStyles.pageContainer} style={subtleBackground}>
        <div className={formStyles.contentWrapper}>
          <p className={formStyles.subLabel}>Identity visibility</p>
          <h1 className={formStyles.pageTitle}>Manage how your name appears</h1>
          <p className={formStyles.pageDescription}>
            Update how your name appears on this note.
          </p>

          <div className={`${formStyles.section} mt-8`}>
            <p className="text-xs text-white/50 mb-2">{yearDisplay}</p>
            <h2 className="text-lg font-medium text-white mb-2">{invite.event.title}</h2>
            <p className="text-white/60 text-sm">
              Current setting: {identityLabel}
              {visibilitySaved && (
                <span className="ml-2 text-emerald-400 text-sm">✓ Saved</span>
              )}
            </p>
          </div>

          <div className={`${formStyles.section} mt-6`}>
            <label className={formStyles.label}>
              How should your name appear on this note?
            </label>
            <div className="space-y-2">
              {IDENTITY_VISIBILITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={visibilityUpdating}
                  onClick={() => handleVisibilityUpdate(option.value)}
                  className={`w-full text-left rounded-xl border px-3 py-2 text-sm transition-colors ${
                    identityVisibility === option.value
                      ? 'border-[#e07a5f]/50 bg-[#e07a5f]/10 text-white'
                      : 'border-white/10 bg-white/5 text-white/80 hover:border-white/20'
                  } ${visibilityUpdating ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <span className="block text-white">{option.label}</span>
                  <span className="block text-xs text-white/50">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href={`/respond/${inviteId}`}
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              Back to the invitation →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={formStyles.pageContainer} style={subtleBackground}>
      <div className={formStyles.contentWrapper}>
        <p className={formStyles.subLabel}>
          {relationshipContext ? (
            <>
              You were invited by <span className="text-[#e07a5f]">{invite.sender_name}</span> —{' '}
              {relationshipContext}
            </>
          ) : (
            <>
              You were invited by <span className="text-[#e07a5f]">{invite.sender_name}</span>
            </>
          )}
        </p>
        <h1 className={formStyles.pageTitle}>Share what you remember.</h1>
        <p className="text-sm text-white/60 leading-relaxed mt-4">
          This is a private, invitation-only space for Valerie Park Anderson’s family.
          Your words help her children know her.
        </p>

        <FirstTimeGuide
          storageKey={`respondGuide:${inviteId}`}
          legacyDismissKeys={[
            `respondGuideDismissed:${inviteId}`,
            'respondGuideDismissed',
          ]}
          title="What you're stepping into"
          subtitle="A quick orientation for first-time invitees."
          steps={[
            "Read the Note you're responding to.",
            'Add your perspective. Short is enough.',
            'Choose how your name appears (per Note).',
          ]}
          links={[
            { label: 'Why this exists', href: whyLink, newTab: true },
            { label: 'How identity works', href: '/identity', newTab: true },
          ]}
          showLinksWhenCollapsed
        />

        {/* The original memory */}
        <div className={`${formStyles.section} mt-8`}>
          <p className="text-xs text-white/50 mb-2">{yearDisplay}</p>
          <h2 className="text-lg font-medium text-white mb-3">{invite.event.title}</h2>
          {invite.event.content ? (
            <div
              className="text-white/70 leading-relaxed prose prose-sm prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: invite.event.content }}
            />
          ) : (
            <p className="text-white/50">
              This note is in The Score, but the full text has not been added yet.
            </p>
          )}
          <p className="text-xs text-white/50 mt-4">— {invite.sender_name}</p>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          Names are masked per note. You choose how your name appears when you submit.{' '}
          <Link
            href="/identity"
            className="ml-2 text-white/80 underline underline-offset-4 hover:text-white"
          >
            How identity works
          </Link>
        </div>

        {/* Response form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="name" className={formStyles.label}>
              Your name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={formStyles.input}
              required
            />
          </div>

          <div>
            <label htmlFor="relationship_to_subject" className={formStyles.label}>
              Relationship to Val
            </label>
            <select
              id="relationship_to_subject"
              value={relationshipToSubject}
              onChange={(e) => setRelationshipToSubject(e.target.value)}
              className={formStyles.select}
            >
              <option value="">Relationship to Val</option>
              {relationshipToSubject && !(relationshipToSubject in RELATIONSHIP_OPTIONS) ? (
                <optgroup label="Custom">
                  <option value={relationshipToSubject}>{relationshipToSubject}</option>
                </optgroup>
              ) : null}
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
            <p className={formStyles.hint}>
              Optional. This helps us show &ldquo;a cousin&rdquo; if you choose
              relationship-only.
            </p>
          </div>

          <div>
            <label className={formStyles.label}>
              How should your name appear on this note?
            </label>
            {showIdentityOptions ? (
              <>
                <div className="space-y-2">
                  {IDENTITY_VISIBILITY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 cursor-pointer hover:border-white/20 transition-colors"
                    >
                      <input
                        type="radio"
                        name="identity_visibility"
                        value={option.value}
                        checked={identityVisibility === option.value}
                        onChange={() => setIdentityVisibility(option.value)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-white">{option.label}</span>
                        <span className="block text-xs text-white/50">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {canUseDefaultVisibility && (
                  <button
                    type="button"
                    onClick={() => {
                      if (defaultVisibility) {
                        setIdentityVisibility(defaultVisibility);
                      }
                      setIdentityOverrideEnabled(false);
                    }}
                    className="mt-3 text-xs text-white/50 hover:text-white transition-colors"
                  >
                    Use my default instead
                  </button>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/80 flex items-center justify-between gap-3">
                <span>Using your default: {defaultVisibilityLabel}</span>
                <button
                  type="button"
                  onClick={() => setIdentityOverrideEnabled(true)}
                  className="text-xs uppercase tracking-[0.18em] text-white/60 hover:text-white transition-colors"
                >
                  Change for this Note
                </button>
              </div>
            )}
            <p className={formStyles.hint}>
              We will share a link after you submit so you can update this later.
            </p>
          </div>

          <div>
            <label htmlFor="response" className={formStyles.label}>
              What do you remember?
            </label>
            <textarea
              id="response"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Share your perspective, add details, or tell another side of the story..."
              rows={6}
              className={formStyles.textarea}
              required
            />
          </div>

          {submitError && (
            <div className="space-y-2">
              <p className={formStyles.error}>{submitError}</p>
              {llmReasons.length > 0 && (
                <ul className="list-disc list-inside text-sm text-white/70">
                  {llmReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !response.trim()}
            className={formStyles.buttonPrimaryFull}
          >
            {isSubmitting ? 'Submitting...' : 'Share my tribute'}
          </button>
        </form>
      </div>
    </div>
  );
}
