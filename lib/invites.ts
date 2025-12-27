/**
 * Invite chain business logic
 * Pure functions for building invite data from person references
 *
 * TODO: Future identity claim flow:
 * - When contributor has email, they can receive a magic link
 * - Magic link creates auth account + links to contributor record
 * - Claimed contributors can edit their memories and add more
 * - Consider: person_claims table links people -> contributors for visibility
 */

export type PersonReference = {
  name: string;
  relationship: string;
  personId?: string;
  phone?: string;
};

export type InviteData = {
  recipient_name: string;
  recipient_contact: string;
  method: 'sms' | 'email';
  message: string;
};

/**
 * Validates a person reference has required fields
 */
export function validatePersonReference(ref: Partial<PersonReference>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!ref.name?.trim()) {
    errors.push('Name is required');
  }

  if (!ref.relationship || ref.relationship === '') {
    errors.push('Relationship is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Checks if a person reference should generate an invite
 */
export function shouldCreateInvite(ref: PersonReference): boolean {
  return Boolean(ref.phone?.trim());
}

/**
 * Builds invite data from a person reference
 */
export function buildInviteData(
  ref: PersonReference,
  senderName: string
): InviteData | null {
  if (!shouldCreateInvite(ref)) {
    return null;
  }

  const phone = ref.phone!.trim();
  const isEmail = phone.includes('@');

  return {
    recipient_name: ref.name.trim(),
    recipient_contact: phone,
    method: isEmail ? 'email' : 'sms',
    message: `${senderName} shared a memory that mentions you. Add your perspective!`,
  };
}

/**
 * Builds the SMS deep link URL for inviting someone
 */
export function buildSmsLink(
  phone: string,
  recipientName: string,
  inviteId: string,
  baseUrl: string
): string {
  const respondUrl = `${baseUrl}/respond/${inviteId}`;
  const message = `Hey ${recipientName}! I shared a memory about you on Val's memorial. Add your side of the story: ${respondUrl}`;
  return `sms:${phone}?body=${encodeURIComponent(message)}`;
}

/**
 * Filters person references to only those with invites
 */
export function getInvitableRefs(refs: PersonReference[]): PersonReference[] {
  return refs.filter(shouldCreateInvite);
}

/**
 * Formats relationship for display on respond page
 * e.g., "cousin" -> "as Val's cousin"
 */
export function formatRelationshipContext(
  relationship: string | null | undefined,
  relationshipLabels: Record<string, string>
): string | null {
  if (!relationship || relationship === 'unknown' || relationship === '') {
    return null;
  }

  const label = relationshipLabels[relationship];
  if (!label) {
    return null;
  }

  return `as Val's ${label.toLowerCase()}`;
}
