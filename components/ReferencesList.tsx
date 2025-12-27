'use client';

import type { EventReferenceWithContributor } from '@/lib/database.types';
import { REFERENCE_ROLE_LABELS, RELATIONSHIP_OPTIONS } from '@/lib/terminology';

type Props = {
  references: EventReferenceWithContributor[];
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

export function ReferencesList({ references }: Props) {
  if (!references || references.length === 0) return null;

  // Server already filters removed and redacts names - just render what we get
  const personRefs = references.filter((r) => r.type === 'person');
  const linkRefs = references.filter((r) => r.type === 'link');

  return (
    <div className="space-y-3">
      {/* People references */}
      {personRefs.length > 0 && (
        <div className="space-y-1">
          {personRefs.map((ref) => {
            // Server has already redacted names - trust what we receive
            const displayName =
              (ref as { person_display_name?: string }).person_display_name ||
              ref.contributor?.name ||
              'someone';
            const visibility = (ref as { visibility?: string }).visibility || 'pending';
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
              <div key={ref.id} className="text-xs text-white/40">
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
                {ref.note && (
                  <span className="text-white/30 italic"> — {ref.note}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Link references */}
      {linkRefs.length > 0 && (
        <div className="flex flex-wrap items-center gap-4">
          {linkRefs.map((ref) => (
            <a
              key={ref.id}
              href={ref.url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              {decodeHtmlEntities(ref.display_name || '')} <span className="text-white/30">↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
