'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { EventReferenceWithContributor } from '@/lib/database.types';
import type { RedactedReference } from '@/lib/references';
import { REFERENCE_ROLE_LABELS, RELATIONSHIP_OPTIONS } from '@/lib/terminology';

const PRIVACY_EXPLAINER = `To protect privacy, we show "someone" instead of real names until the person has approved being identified. The note author can still see who they mentioned.`;

// Component accepts either raw DB references or redacted references
type ReferenceItem = RedactedReference | EventReferenceWithContributor;

type Props = {
  references: ReferenceItem[];
  viewerIsOwner?: boolean;
  showBothViews?: boolean; // Dev mode: show owner + public views side by side
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nearr;/g, '↗')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function PersonRefItem({
  ref,
  asOwner,
}: {
  ref: ReferenceItem;
  asOwner: boolean;
}) {
  const [showExplainer, setShowExplainer] = useState(false);
  const redacted = ref as RedactedReference;
  const raw = ref as EventReferenceWithContributor;

  const visibility = (redacted.identity_state || ref.visibility || 'pending') as string;
  const isRedacted = visibility !== 'approved';

  // Owner sees real name from author_payload, public sees redacted render_label
  const ownerName = redacted.author_payload?.author_label || 'someone';
  const publicName = redacted.render_label ||
    redacted.person_display_name ||
    raw.contributor?.name ||
    'someone';

  const displayName = asOwner ? ownerName : publicName;

  const relationshipToSubject = (ref as { relationship_to_subject?: string }).relationship_to_subject;

  // Only show relationship parenthetical for approved visibility
  const showRelationship = visibility === 'approved' &&
    relationshipToSubject &&
    relationshipToSubject !== 'unknown' &&
    relationshipToSubject !== 'other';

  const relationshipLabel = relationshipToSubject
    ? (RELATIONSHIP_OPTIONS[relationshipToSubject as keyof typeof RELATIONSHIP_OPTIONS] ||
      relationshipToSubject)
    : null;

  return (
    <div className="text-xs text-white/40 flex items-center gap-1.5">
      <span className="text-white/30">
        {ref.role ? REFERENCE_ROLE_LABELS[ref.role as keyof typeof REFERENCE_ROLE_LABELS] || '' : ''}
      </span>
      {ref.role && REFERENCE_ROLE_LABELS[ref.role as keyof typeof REFERENCE_ROLE_LABELS] ? ' ' : ''}
      <span className="text-white/60">
        {displayName}
      </span>
      {showRelationship && relationshipLabel && (
        <span className="text-white/40"> ({relationshipLabel})</span>
      )}
      {/* Show privacy indicator for public view when name is redacted */}
      {!asOwner && isRedacted && (
        <span className="relative inline-flex items-center">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[10px] text-white/25 hover:text-white/40 transition-colors cursor-help"
            onMouseEnter={() => setShowExplainer(true)}
            onMouseLeave={() => setShowExplainer(false)}
            onClick={(e) => {
              e.stopPropagation();
              setShowExplainer(!showExplainer);
            }}
            aria-label="Why is this name hidden?"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
            </svg>
          </button>
          {/* Explainer popover */}
          {showExplainer && (
            <>
              {/* Invisible backdrop to close on outside tap (mobile) */}
              <div
                className="fixed inset-0 z-40 md:hidden"
                onClick={() => setShowExplainer(false)}
              />
              <div
                className="absolute left-0 bottom-full mb-2 w-64 p-3 rounded-lg bg-[#1a1a1a] border border-white/10 shadow-xl z-50 animate-fade-in"
                onMouseEnter={() => setShowExplainer(true)}
                onMouseLeave={() => setShowExplainer(false)}
              >
                <p className="text-xs text-white/70 leading-relaxed">
                  {PRIVACY_EXPLAINER}
                </p>
                <Link
                  href="/identity"
                  className="mt-2 inline-block text-xs text-white/60 hover:text-white"
                >
                  How identity works
                </Link>
                {/* Close button for mobile */}
                <button
                  type="button"
                  className="absolute top-2 right-2 text-white/30 hover:text-white/50 md:hidden"
                  onClick={() => setShowExplainer(false)}
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="absolute left-3 bottom-0 translate-y-full">
                  <div className="w-2 h-2 bg-[#1a1a1a] border-r border-b border-white/10 rotate-45 -translate-y-1" />
                </div>
              </div>
            </>
          )}
        </span>
      )}
      {ref.note && (
        <span className="text-white/30 italic"> — {ref.note}</span>
      )}
    </div>
  );
}

export function ReferencesList({ references, viewerIsOwner = false, showBothViews = false }: Props) {
  if (!references || references.length === 0) return null;

  const personRefs = references.filter((r) => r.type === 'person');
  const linkRefs = references.filter((r) => r.type === 'link');

  // Dev mode: show both views side by side
  if (showBothViews && personRefs.length > 0) {
    return (
      <div className="space-y-4">
        {/* Owner view */}
        <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
          <p className="text-[10px] uppercase tracking-wider text-emerald-400/60 mb-2">
            Owner sees
          </p>
          <div className="space-y-1">
            {personRefs.map((ref) => (
              <PersonRefItem key={`owner-${ref.id}`} ref={ref} asOwner={true} />
            ))}
          </div>
        </div>

        {/* Public view */}
        <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
          <p className="text-[10px] uppercase tracking-wider text-amber-400/60 mb-2">
            Public sees
          </p>
          <div className="space-y-1">
            {personRefs.map((ref) => (
              <PersonRefItem key={`public-${ref.id}`} ref={ref} asOwner={false} />
            ))}
          </div>
        </div>

        {/* Link references (same for both) */}
        {linkRefs.length > 0 && (
          <div className="space-y-1">
            {linkRefs.map((ref) => (
              <div key={ref.id}>
                <a
                  href={ref.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white/40 hover:text-white/60 transition-colors"
                >
                  {decodeHtmlEntities(ref.display_name || '')} <span className="text-white/30">↗</span>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Normal mode: show single view based on viewerIsOwner
  return (
    <div className="space-y-3">
      {personRefs.length > 0 && (
        <div className="space-y-1">
          {personRefs.map((ref) => (
            <PersonRefItem key={ref.id} ref={ref} asOwner={viewerIsOwner} />
          ))}
        </div>
      )}

      {linkRefs.length > 0 && (
        <div className="space-y-1">
          {linkRefs.map((ref) => (
            <div key={ref.id}>
              <a
                href={ref.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                {decodeHtmlEntities(ref.display_name || '')} <span className="text-white/30">↗</span>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
