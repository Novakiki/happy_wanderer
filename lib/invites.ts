/**
 * Invite System - "Chain Mail" for Memory Collection
 * ===================================================
 *
 * PURPOSE:
 * This module powers the invite system that allows memory contributors to
 * invite people mentioned in their memories to add their own perspectives.
 *
 * THE FLOW:
 * 1. ADDING A MEMORY (MemoryForm):
 *    - User adds people to a memory via PeopleSection
 *    - If a person has a phone number, an invite record is created
 *    - After submission, user sees "Text them →" buttons
 *
 * 2. SENDING (Client-side SMS):
 *    - Clicking "Text them" opens native SMS app via sms: URI
 *    - Pre-filled message includes link: /respond/{inviteId}
 *    - User sends manually (we don't send SMS server-side)
 *
 * 3. RESPONDING (No auth required):
 *    - Recipient clicks link → /respond/[id] page
 *    - Sees original memory context
 *    - Submits simple form (name + content only)
 *    - Creates timeline_event linked via memory_threads
 *
 * 4. GUIDED PATH TO FULL ACCESS:
 *    - After responding, user sees signup prompt
 *    - Signup → full access to MemoryForm with all fields
 *    - This is the conversion funnel from invited → full contributor
 *
 * DESIGN DECISIONS:
 * - No server-side SMS: Uses native sms: URI for privacy and simplicity
 * - No auth for responses: Reduces friction for first-time responders
 * - Simple response form: Intentionally limited; full access requires signup
 * - Creates real memories: Responses are timeline_events, not comments
 *
 * RELATED FILES:
 * - /app/api/memories/route.ts - Creates invite records during memory submission
 * - /app/respond/[id]/page.tsx - Response page for invited users
 * - /app/api/respond/route.ts - API for submitting responses
 * - /components/MemoryForm.tsx - Shows "Text them" buttons after submission
 *
 * TODO: Future identity claim flow:
 * - When contributor has email, they can receive a magic link
 * - Magic link creates auth account + links to contributor record
 * - Claimed contributors can edit their memories and add more
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

export const INVITE_EXPIRY_HOURS = 72;
export const INVITE_MAX_USES = 10;
export const INVITE_MAX_DEPTH = 3;

export function getInviteExpiryDate(now = Date.now()) {
  return new Date(now + INVITE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
}

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
    message: `${senderName} shared a memory of Val that includes you. Want to add to it or share your version?`,
  };
}

/**
 * Builds the SMS deep link URL for inviting someone
 */
export function buildSmsMessage(
  recipientName: string,
  inviteId: string,
  baseUrl: string
): string {
  const respondUrl = `${baseUrl}/respond/${inviteId}`;
  return `Hey ${recipientName}! A memory of Val includes you. Want to add to it or share your version? ${respondUrl}`;
}

export function buildSmsLink(
  phone: string,
  recipientName: string,
  inviteId: string,
  baseUrl: string
): string {
  const message = buildSmsMessage(recipientName, inviteId, baseUrl);
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
