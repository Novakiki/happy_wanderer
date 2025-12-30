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

import { TimelinePeek } from '@/components/TimelinePeek';
import { formatRelationshipContext } from '@/lib/invites';
import { formStyles, subtleBackground } from '@/lib/styles';
import { RELATIONSHIP_OPTIONS } from '@/lib/terminology';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type InviteData = {
  id: string;
  recipient_name: string;
  sender_name: string;
  relationship_to_subject?: string | null;
  event: {
    id: string;
    title: string;
    content: string;
    year: number;
    year_end: number | null;
  };
};

export default function RespondPage() {
  const params = useParams();
  const router = useRouter();
  const inviteId = params.id as string;

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Email capture after submission
  const [contributorId, setContributorId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailSkipped, setEmailSkipped] = useState(false);

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
        setName(data.invite.recipient_name || '');
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

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_id: inviteId,
          name: name.trim(),
          content: response.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit');
      }

      const result = await res.json();
      if (result.contributor_id) {
        setContributorId(result.contributor_id);
      }
      setIsSubmitted(true);
    } catch {
      setError('Failed to submit your response. Please try again.');
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

  return (
    <div className={formStyles.pageContainer} style={subtleBackground}>
      <div className={formStyles.contentWrapper}>
        <p className={formStyles.subLabel}>
          {relationshipContext
            ? `You were there — ${relationshipContext}`
            : 'You were there'}
        </p>
        <h1 className={formStyles.pageTitle}>Add your perspective</h1>
        <p className={formStyles.pageDescription}>
          {invite.sender_name} shared a memory.
        </p>
        <p className="text-sm text-white/60 leading-relaxed mt-4">
          Happy Wanderer is a private memory site for Valerie Park Anderson.
          The Score holds Notes shared by family and friends; your perspective
          helps her children know her.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-white/40">
          <a href="/why" className="hover:text-white transition-colors">
            Why this exists
          </a>
          <a href="/score" className="hover:text-white transition-colors">
            What&apos;s emerging
          </a>
        </div>

        <TimelinePeek className="mt-6" />

        {/* The original memory */}
        <div className={`${formStyles.section} mt-8`}>
          <p className="text-xs text-white/40 mb-2">{yearDisplay}</p>
          <h2 className="text-lg font-medium text-white mb-3">{invite.event.title}</h2>
          <p className="text-white/70 leading-relaxed whitespace-pre-wrap">
            {invite.event.content}
          </p>
          <p className="text-xs text-white/40 mt-4">— {invite.sender_name}</p>
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

          <button
            type="submit"
            disabled={isSubmitting || !response.trim()}
            className={formStyles.buttonPrimaryFull}
          >
            {isSubmitting ? 'Submitting...' : 'Add my memory'}
          </button>
        </form>
      </div>
    </div>
  );
}
