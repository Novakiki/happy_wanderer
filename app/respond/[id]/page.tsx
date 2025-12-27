'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formStyles, subtleBackground } from '@/lib/styles';
import { RELATIONSHIP_OPTIONS } from '@/lib/terminology';
import { formatRelationshipContext } from '@/lib/invites';

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

          <button
            onClick={() => router.push('/letter')}
            className={`${formStyles.buttonPrimary} mt-8`}
          >
            Read more memories
          </button>
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
