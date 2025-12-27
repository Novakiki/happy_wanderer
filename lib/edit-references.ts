export type ReferenceRole = 'witness' | 'heard_from' | 'source' | 'related';

const VALID_REFERENCE_ROLES: ReferenceRole[] = [
  'witness',
  'heard_from',
  'source',
  'related',
];

export function normalizeReferenceRole(
  value: unknown,
  fallback: ReferenceRole
): ReferenceRole {
  if (VALID_REFERENCE_ROLES.includes(value as ReferenceRole)) {
    return value as ReferenceRole;
  }
  return fallback;
}

export type LinkReferenceInput = {
  id?: string;
  display_name?: string | null;
  url?: string | null;
  role?: unknown;
};

export function normalizeLinkReferenceInput(
  input: LinkReferenceInput,
  fallbackRole: ReferenceRole
): { id?: string; display_name: string; url: string; role: ReferenceRole } | null {
  const displayName = String(input?.display_name ?? '').trim();
  const url = String(input?.url ?? '').trim();

  if (!displayName || !url) {
    return null;
  }

  return {
    id: input.id,
    display_name: displayName,
    url,
    role: normalizeReferenceRole(input.role, fallbackRole),
  };
}

export type PersonReferenceInput = {
  person_id?: unknown;
  personId?: unknown;
  name?: unknown;
  display_name?: unknown;
};

export async function resolvePersonReferenceId(options: {
  ref: PersonReferenceInput;
  existingPersonId?: string | null;
  canUsePersonId: (personId: string) => Promise<boolean>;
  resolvePersonIdByName: (name: string) => Promise<string | null>;
}): Promise<string | null> {
  const { ref, existingPersonId, canUsePersonId, resolvePersonIdByName } = options;

  const submittedPersonId =
    typeof ref.person_id === 'string'
      ? ref.person_id
      : typeof ref.personId === 'string'
        ? ref.personId
        : null;

  if (submittedPersonId && await canUsePersonId(submittedPersonId)) {
    return submittedPersonId;
  }

  const submittedName = String(ref.name ?? ref.display_name ?? '').trim();
  if (submittedName) {
    const resolved = await resolvePersonIdByName(submittedName);
    if (resolved) {
      return resolved;
    }
  }

  if (existingPersonId) {
    return existingPersonId;
  }

  return null;
}
