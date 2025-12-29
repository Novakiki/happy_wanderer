'use client';

import { RelationGraphPeek } from '@/components/RelationGraphPeek';
import { formatRelationshipContext } from '@/lib/invites';
import { formStyles, subtleBackground } from '@/lib/styles';
import {
  RELATIONSHIP_OPTIONS,
  THREAD_RELATIONSHIP_DESCRIPTIONS,
  THREAD_RELATIONSHIP_LABELS,
} from '@/lib/terminology';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type InviteData = {
  id: string;
  recipient_name: string;
  sender_name: string;
  relationship_to_subject?: string | null;
  event: {
    id: string;
    title: string;
    type?: 'memory' | 'milestone' | 'origin';
    content: string;
    year: number;
    year_end: number | null;
    contributor_id?: string | null;
  };
};

const PREVIEW_INVITE: InviteData = {
  id: 'preview-invite',
  recipient_name: 'You',
  sender_name: 'Amy',
  relationship_to_subject: 'cousin',
  event: {
    id: 'preview-event',
    title: 'Preview memory (add yours)',
    type: 'memory',
    content:
      'This is a preview slot. In production, this shows the actual note you were invited to respond to. Add your perspective or share your version.',
    year: new Date().getFullYear(),
    year_end: new Date().getFullYear(),
    contributor_id: null,
  },
};

const PREVIEW_STORY = {
  id: 'preview-story',
  title: 'Preview memory',
  type: 'memory' as const,
};

const PREVIEW_PEOPLE = [
  { id: 'amy', name: 'Amy', role: 'wrote' as const },
  { id: 'you', name: 'You', relationship: 'cousin', role: 'invited' as const, isViewer: true },
  { id: 'anon', relationship: 'aunt', role: 'responded' as const }, // no name permission
];

type ThreadRelationship = keyof typeof THREAD_RELATIONSHIP_LABELS;

export default function RespondPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteId = params.id as string;

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [response, setResponse] = useState('');
  const [relationship, setRelationship] = useState<ThreadRelationship>('perspective');
  const [relationshipNote, setRelationshipNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Email capture after submission
  const [contributorId, setContributorId] = useState<string | null>(null);
  const [viewerContributorId, setViewerContributorId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailSkipped, setEmailSkipped] = useState(false);

  // Graph connections (other people connected to this event)
  type GraphPerson = {
    id: string;
    name?: string;
    relationship?: string;
    role: 'wrote' | 'responded' | 'invited' | 'mentioned';
    isViewer?: boolean;
  };
  const [connectedPeople, setConnectedPeople] = useState<GraphPerson[]>([]);

  useEffect(() => {
    const isPreview = searchParams.get('preview') === '1' || searchParams.get('mock') === '1';

    // Fetch viewer session so we know if they own the note
    fetch('/api/session')
      .then((res) => res.json())
      .then((data) => {
        if (data?.contributor_id) {
          setViewerContributorId(data.contributor_id);
        }
      })
      .catch(() => {});

    async function fetchInvite() {
      if (isPreview) {
        setInvite(PREVIEW_INVITE);
        setName(PREVIEW_INVITE.recipient_name || '');
        setLoading(false);
        return;
      }

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
  }, [inviteId, searchParams]);

  // Fetch other people connected to this event (for the graph)
  useEffect(() => {
    const isPreview = searchParams.get('preview') === '1' || searchParams.get('mock') === '1';
    const eventId = invite?.event?.id;
    const currentInviteId = invite?.id;
    if (isPreview || !eventId) return;

    async function fetchConnections() {
      try {
        const url = `/api/respond/connections?event_id=${eventId}${currentInviteId ? `&exclude_invite=${currentInviteId}` : ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setConnectedPeople(data.people || []);
        }
      } catch {
        // Silently fail - graph is enhancement, not critical
      }
    }
    fetchConnections();
  }, [invite, searchParams]);

  // Build the people array for the graph, merging baseline with fetched connections
  const graphPeople = useMemo(() => {
    const isPreview = searchParams.get('preview') === '1' || searchParams.get('mock') === '1';
    if (isPreview || !invite) return [];

    // Start with viewer (always present)
    const people: GraphPerson[] = [
      {
        id: 'viewer',
        name: invite.recipient_name,
        relationship: invite.relationship_to_subject || undefined,
        role: 'invited',
        isViewer: true
      },
    ];

    // Add connected people, but mark the author if found in API response
    if (connectedPeople.length > 0) {
      for (const person of connectedPeople) {
        // Skip if this looks like the current viewer (by matching role)
        if (person.role === 'invited' && person.isViewer) continue;
        people.push(person);
      }
    } else {
      // Fallback: just show author from invite data
      people.push({ id: 'author', name: invite.sender_name, role: 'wrote' });
    }

    return people;
  }, [invite, connectedPeople, searchParams]);

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
          relationship,
          relationship_note: relationshipNote.trim(),
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

  // Milestones and synchronicities don't support the respond flow
  const isPreview = searchParams.get('preview') === '1' || searchParams.get('mock') === '1';
  if (!isPreview && invite?.event?.type && invite.event.type !== 'memory') {
    const typeLabel = invite.event.type === 'origin' ? 'synchronicity' : invite.event.type;
    return (
      <div className={formStyles.pageContainer} style={subtleBackground}>
        <div className={formStyles.contentWrapper}>
          <h1 className={formStyles.pageTitle}>{invite.event.title}</h1>
          <p className="text-white/60 mt-4 leading-relaxed">
            This is a {typeLabel}, not a memory. Perspectives can only be added to memories.
          </p>
          <p className="text-white/60 mt-3 leading-relaxed">
            You can view and comment on this {typeLabel} in the Score.
          </p>
          <a
            href="/score"
            className={`${formStyles.buttonPrimary} mt-8 inline-block`}
          >
            View the Score
          </a>
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
            onClick={() => router.push('/why')}
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
          {`According to ${invite.sender_name || 'someone'}, you were there — ${
            relationshipContext ? relationshipContext : "as Val's cousin"
          }`}
        </p>
        <h1 className={formStyles.pageTitle}>Add your perspective</h1>
        <p className="text-sm text-white/60 leading-relaxed mt-4">
          Happy Wanderer is a private memory site for Valerie Park Anderson.
          The Score holds Notes shared by family and friends; your perspective
          helps her children know her.
        </p>
        <p className="text-sm text-white/60 leading-relaxed mt-3">
          Add your perspective as another Note in the Score. We keep different tellings
          side by side so her children can hear the full chorus.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-white/40">
          <a href="/why" className="hover:text-white transition-colors">
            Why this exists
          </a>
          <a href="/score" className="hover:text-white transition-colors">
            What&apos;s emerging
          </a>
        </div>

        <RelationGraphPeek
          className="mt-6"
          story={{ id: invite.event.id, title: invite.event.title, type: invite.event.type }}
          people={graphPeople}
          previewStory={searchParams.get('preview') === '1' || searchParams.get('mock') === '1' ? PREVIEW_STORY : undefined}
          previewPeople={searchParams.get('preview') === '1' || searchParams.get('mock') === '1' ? PREVIEW_PEOPLE : undefined}
        />

        {/* The original memory */}
        <div className={`${formStyles.section} mt-8`}>
          <p className="text-xs text-white/40 mb-2">{yearDisplay}</p>
          <h2 className="text-lg font-medium text-white mb-3">{invite.event.title}</h2>
          <div
            className="text-white/70 leading-relaxed prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: invite.event.content }}
          />
          <p className="text-xs text-white/40 mt-4">— {invite.sender_name}</p>
          {viewerContributorId && invite.event.contributor_id && invite.event.contributor_id === viewerContributorId && (
            <a
              href={`/edit?event_id=${invite.event.id}`}
              className="inline-flex items-center gap-2 text-xs text-[#e07a5f] hover:text-white transition-colors mt-2"
            >
              Edit this note →
            </a>
          )}
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

          <div>
            <label htmlFor="relationship" className={formStyles.label}>
              How does your note connect?
            </label>
            <select
              id="relationship"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value as ThreadRelationship)}
              className={formStyles.select}
            >
              {Object.entries(THREAD_RELATIONSHIP_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className={formStyles.hint}>
              {THREAD_RELATIONSHIP_DESCRIPTIONS[relationship]}
            </p>
          </div>

          <div>
            <label htmlFor="relationship_note" className={formStyles.label}>
              Short note (optional)
            </label>
            <textarea
              id="relationship_note"
              value={relationshipNote}
              onChange={(e) => setRelationshipNote(e.target.value)}
              placeholder="e.g., I remember this as 1989, not 1990"
              rows={2}
              className={formStyles.textarea}
            />
            <p className={formStyles.hint}>
              This appears with the link between notes.
            </p>
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
