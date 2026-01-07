import { RELATIONSHIP_DISPLAY } from '@/lib/terminology';

export type ReferenceVisibility =
  | 'approved'
  | 'pending'
  | 'anonymized'
  | 'blurred'
  | 'removed';

export type ReferenceRow = {
  id: string;
  type: string;
  url?: string | null;
  display_name?: string | null;
  role?: string | null;
  note?: string | null;
  visibility?: string | null;
  relationship_to_subject?: string | null;
  person?: {
    id?: string;
    canonical_name?: string | null;
    visibility?: string | null;
  } | null;
  contributor?: {
    name?: string | null;
  } | null;
  // Visibility preferences (fetched by API routes)
  // contributor_preference: visibility set for this specific contributor
  // global_preference: visibility set for all contributors (contributor_id = NULL)
  visibility_preference?: {
    contributor_preference?: string | null;
    global_preference?: string | null;
  } | null;
};

export type RedactedReference = {
  id: string;
  type: 'person' | 'link';
  url?: string | null;
  display_name?: string | null;
  role?: string | null;
  note?: string | null;
  visibility: ReferenceVisibility;
  relationship_to_subject?: string | null;
  person_display_name?: string | null;
  // New, normalized outputs
  identity_state: ReferenceVisibility;
  media_presentation: 'normal' | 'blurred' | 'hidden';
  render_label: string;
  // Author/admin-only payload (optional; included only when requested)
  author_payload?: {
    author_label: string;
    render_label: string;
    identity_state: ReferenceVisibility;
    media_presentation: 'normal' | 'blurred' | 'hidden';
    canApprove: boolean;
    canAnonymize: boolean;
    canRemove: boolean;
    canInvite: boolean;
    canEditDescriptor: boolean;
  };
};

/**
 * Resolves the effective visibility for a reference using the precedence order:
 * 1. Per-note override (event_references.visibility)
 * 2. Per-contributor preference (visibility_preferences with contributor_id)
 * 3. Global preference (visibility_preferences with contributor_id = NULL)
 * 4. Person's default (people.visibility)
 */
function resolveVisibility(
  referenceVisibility?: ReferenceVisibility | null,
  personVisibility?: ReferenceVisibility | null,
  visibilityPreference?: {
    contributor_preference?: string | null;
    global_preference?: string | null;
  } | null
): ReferenceVisibility {
  const refVis = referenceVisibility ?? 'pending';
  const contributorPref = (visibilityPreference?.contributor_preference ?? 'pending') as ReferenceVisibility;
  const globalPref = (visibilityPreference?.global_preference ?? 'pending') as ReferenceVisibility;
  const personVis = personVisibility ?? 'pending';

  // Check for removal at any level (takes highest priority)
  if (personVis === 'removed' || contributorPref === 'removed' || globalPref === 'removed') {
    return 'removed';
  }

  // 1. Per-note override
  if (refVis !== 'pending') return refVis;

  // 2. Per-contributor preference
  if (contributorPref !== 'pending') return contributorPref;

  // 3. Global preference
  if (globalPref !== 'pending') return globalPref;

  // 4. Person's default
  return personVis;
}

function getMaskedDisplayName(
  name: string,
  visibility: ReferenceVisibility,
  relationship: string | null
): string {
  if (visibility === 'approved') return name;

  // Prefer relational masking when identity is hidden (pending/anonymized),
  // but *blurred* should show initials when possible.
  const relationshipLabel = relationship && relationship in RELATIONSHIP_DISPLAY
    ? RELATIONSHIP_DISPLAY[relationship as keyof typeof RELATIONSHIP_DISPLAY]
    : null;

  if (visibility === 'blurred') {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}.${parts[parts.length - 1][0]}.`;
    }
    return name[0] ? `${name[0]}.` : 'someone';
  }

  if (relationshipLabel) return relationshipLabel;

  return 'someone';
}

export function redactReferences(
  references: ReferenceRow[],
  options?: { includeAuthorPayload?: boolean }
): RedactedReference[] {
  if (!references) return [];

  const includeAuthor = options?.includeAuthorPayload || false;

  return references
    .map((ref) => {
      if (ref.type === 'link') {
        const visibility = (ref.visibility ?? 'pending') as ReferenceVisibility;
        if (visibility === 'removed') return null;

        // Note: 'removed' was already handled above, so media is always normal for links
        const media_presentation: RedactedReference['media_presentation'] = 'normal';

        return {
          id: ref.id,
          type: ref.type,
          url: ref.url ?? null,
          display_name: ref.display_name ?? null,
          role: ref.role ?? null,
          note: ref.note ?? null,
          visibility,
          identity_state: visibility,
          media_presentation,
          render_label: ref.display_name ?? '',
          author_payload: includeAuthor
            ? {
                author_label: ref.display_name ?? '',
                render_label: ref.display_name ?? '',
                identity_state: visibility,
                media_presentation,
                canApprove: false,
                canAnonymize: false,
                canRemove: false,
                canInvite: false,
                canEditDescriptor: false,
              }
            : undefined,
        } as RedactedReference;
      }

      const nameSource =
        ref.person?.canonical_name ||
        ref.contributor?.name ||
        'Someone';
      const relationship = ref.relationship_to_subject ?? null;
      const effectiveVisibility = resolveVisibility(
        ref.visibility as ReferenceVisibility | null | undefined,
        ref.person?.visibility as ReferenceVisibility | null | undefined,
        ref.visibility_preference
      );

      if (effectiveVisibility === 'removed') {
        return null;
      }

      // Note: 'removed' was already handled above, so we only check 'blurred' vs 'normal'
      const media_presentation: RedactedReference['media_presentation'] =
        effectiveVisibility === 'blurred' ? 'blurred' : 'normal';

      const render_label = getMaskedDisplayName(nameSource, effectiveVisibility, relationship);

      return {
        id: ref.id,
        type: ref.type,
        role: ref.role ?? null,
        note: ref.note ?? null,
        visibility: effectiveVisibility,
        relationship_to_subject: relationship,
        person_display_name: render_label,
        identity_state: effectiveVisibility,
        media_presentation,
        render_label,
        author_payload: includeAuthor
          ? {
              author_label: nameSource,
              render_label,
              identity_state: effectiveVisibility,
              media_presentation,
              // Explicitly default all capabilities to false; only the identity owner should flip these.
              canApprove: false,
              canAnonymize: false,
              canRemove: false,
              canInvite: false,
              canEditDescriptor: false,
            }
          : undefined,
      } as RedactedReference;
    })
    .filter((ref): ref is RedactedReference => Boolean(ref));
}
