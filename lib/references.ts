import { RELATIONSHIP_DISPLAY } from '@/lib/terminology';

export type ReferenceVisibility =
  | 'approved'
  | 'pending'
  | 'anonymized'
  | 'blurred'
  | 'removed';

type ReferenceRow = {
  id: string;
  type: 'person' | 'link';
  url?: string | null;
  display_name?: string | null;
  role?: string | null;
  note?: string | null;
  visibility?: ReferenceVisibility | null;
  relationship_to_subject?: string | null;
  person?: {
    canonical_name?: string | null;
    visibility?: ReferenceVisibility | null;
  } | null;
  contributor?: {
    name?: string | null;
  } | null;
};

type RedactedReference = {
  id: string;
  type: 'person' | 'link';
  url?: string | null;
  display_name?: string | null;
  role?: string | null;
  note?: string | null;
  visibility: ReferenceVisibility;
  relationship_to_subject?: string | null;
  person_display_name?: string | null;
};

const visibilityRank: Record<ReferenceVisibility, number> = {
  approved: 0,
  blurred: 1,
  anonymized: 2,
  pending: 2,
  removed: 3,
};

function resolveVisibility(
  referenceVisibility?: ReferenceVisibility | null,
  personVisibility?: ReferenceVisibility | null
): ReferenceVisibility {
  const refVis = referenceVisibility ?? 'pending';
  const personVis = personVisibility ?? 'pending';
  const rank = Math.max(visibilityRank[refVis], visibilityRank[personVis]);

  if (rank >= visibilityRank.removed) return 'removed';
  if (rank >= visibilityRank.anonymized) return 'pending';
  if (rank >= visibilityRank.blurred) return 'blurred';
  return 'approved';
}

function getMaskedDisplayName(
  name: string,
  visibility: ReferenceVisibility,
  relationship: string | null
): string {
  if (visibility === 'approved') return name;
  if (visibility === 'blurred') {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}.${parts[parts.length - 1][0]}.`;
    }
    return name[0] ? `${name[0]}.` : 'someone';
  }

  if (relationship && relationship in RELATIONSHIP_DISPLAY) {
    return RELATIONSHIP_DISPLAY[relationship as keyof typeof RELATIONSHIP_DISPLAY];
  }

  return 'someone';
}

export function redactReferences(references: ReferenceRow[]): RedactedReference[] {
  if (!references) return [];

  return references
    .map((ref) => {
      if (ref.type === 'link') {
        const visibility = (ref.visibility ?? 'pending') as ReferenceVisibility;
        if (visibility === 'removed') return null;

        return {
          id: ref.id,
          type: ref.type,
          url: ref.url ?? null,
          display_name: ref.display_name ?? null,
          role: ref.role ?? null,
          note: ref.note ?? null,
          visibility,
        } as RedactedReference;
      }

      const nameSource =
        ref.person?.canonical_name ||
        ref.contributor?.name ||
        'Someone';
      const relationship = ref.relationship_to_subject ?? null;
      const effectiveVisibility = resolveVisibility(ref.visibility, ref.person?.visibility);

      if (effectiveVisibility === 'removed') {
        return null;
      }

      return {
        id: ref.id,
        type: ref.type,
        role: ref.role ?? null,
        note: ref.note ?? null,
        visibility: effectiveVisibility,
        relationship_to_subject: relationship,
        person_display_name: getMaskedDisplayName(nameSource, effectiveVisibility, relationship),
      } as RedactedReference;
    })
    .filter((ref): ref is RedactedReference => Boolean(ref));
}
