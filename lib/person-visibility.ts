import type {
  IdentityState,
  MediaPresentation,
} from './form-types';

/**
 * Source data for a person reference before we scope it to a viewer.
 */
export type PersonVisibilitySource = {
  id: string;
  authorLabel: string;
  descriptor?: string | null;
  identityState: IdentityState;
  mediaPresentation?: MediaPresentation;
  // Capability flags (author/admin-only)
  canApprove?: boolean;
  canAnonymize?: boolean;
  canRemove?: boolean;
  canInvite?: boolean;
  canEditDescriptor?: boolean;
};

/**
 * Payload for general viewers (no raw identifiers).
 */
export type PersonViewerPayload = {
  id: string;
  identity_state: IdentityState;
  media_presentation: MediaPresentation;
  render_label: string;
};

/**
 * Payload for authors/admins who are allowed to see what they entered.
 */
export type PersonAuthorPayload = PersonViewerPayload & {
  author_label: string;
  descriptor?: string | null;
  canApprove: boolean;
  canAnonymize: boolean;
  canRemove: boolean;
  canInvite: boolean;
  canEditDescriptor: boolean;
};

type BuildOptions = {
  pendingPlaceholder?: string;
  anonymizedFallback?: string;
};

/**
 * Compute the safe label that can be shown to the current viewer.
 * - approved: show the name
 * - anonymized: show descriptor if provided, else fallback
 * - pending: show placeholder
 * - removed: empty string (typically omitted from UI)
 */
export function buildRenderLabel(
  identityState: IdentityState,
  authorLabel: string,
  descriptor?: string | null,
  options: BuildOptions = {}
): string {
  const pendingPlaceholder = options.pendingPlaceholder || '[person]';
  const anonymizedFallback = options.anonymizedFallback || 'a contributor';

  if (identityState === 'approved') {
    return authorLabel;
  }

  if (identityState === 'anonymized') {
    const safeDescriptor = descriptor?.trim();
    return safeDescriptor || anonymizedFallback;
  }

  if (identityState === 'pending') {
    return pendingPlaceholder;
  }

  // removed
  return '';
}

/**
 * Build viewer-scoped person payloads, ensuring identity is not leaked.
 */
export function buildPersonPayloads(
  source: PersonVisibilitySource,
  options: BuildOptions = {}
): {
  viewer: PersonViewerPayload;
  author: PersonAuthorPayload;
} {
  const media_presentation: MediaPresentation = source.mediaPresentation || 'hidden';
  const render_label = buildRenderLabel(
    source.identityState,
    source.authorLabel,
    source.descriptor,
    options
  );

  const viewer: PersonViewerPayload = {
    id: source.id,
    identity_state: source.identityState,
    media_presentation,
    render_label,
  };

  const author: PersonAuthorPayload = {
    ...viewer,
    author_label: source.authorLabel,
    descriptor: source.descriptor ?? null,
    canApprove: !!source.canApprove,
    canAnonymize: !!source.canAnonymize,
    canRemove: !!source.canRemove,
    canInvite: !!source.canInvite,
    canEditDescriptor: !!source.canEditDescriptor,
  };

  return { viewer, author };
}
