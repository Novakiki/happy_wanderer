/**
 * Edit session utilities for reading contributor authentication from cookies.
 * Used to identify note owners on detail pages and authorize edit operations.
 */

export type EditSession = {
  token: string;
  name: string;
  contributor_id?: string;
};

/**
 * Parse the edit session from the vals-memory-edit cookie value.
 * Returns null if the cookie is missing, malformed, or invalid.
 */
export function readEditSession(cookieValue?: string): EditSession | null {
  if (!cookieValue) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(cookieValue));
    if (
      parsed &&
      typeof parsed.token === 'string' &&
      typeof parsed.name === 'string'
    ) {
      return {
        token: parsed.token,
        name: parsed.name,
        contributor_id: typeof parsed.contributor_id === 'string' ? parsed.contributor_id : undefined,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Check if the current edit session owns a specific event.
 * Compares the session's contributor_id with the event's contributor_id.
 */
export function isNoteOwner(
  session: EditSession | null,
  eventContributorId: string | null
): boolean {
  if (!session?.contributor_id || !eventContributorId) return false;
  return session.contributor_id === eventContributorId;
}
