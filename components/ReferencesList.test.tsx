/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReferencesList } from './ReferencesList';
import type { RedactedReference } from '@/lib/references';

// =============================================================================
// Test Fixtures
// =============================================================================

const createPersonRef = (overrides: Partial<RedactedReference> = {}): RedactedReference => ({
  id: 'ref-1',
  type: 'person',
  visibility: 'approved',
  identity_state: 'approved',
  media_presentation: 'normal',
  render_label: 'Julie Smith',
  person_display_name: 'Julie Smith',
  relationship_to_subject: 'cousin',
  role: 'witness',
  author_payload: {
    author_label: 'Julie Smith',
    render_label: 'Julie Smith',
    identity_state: 'approved',
    media_presentation: 'normal',
    canApprove: false,
    canAnonymize: false,
    canRemove: false,
    canInvite: false,
    canEditDescriptor: false,
  },
  ...overrides,
});

const createRedactedPersonRef = (overrides: Partial<RedactedReference> = {}): RedactedReference => ({
  id: 'ref-2',
  type: 'person',
  visibility: 'pending',
  identity_state: 'pending',
  media_presentation: 'normal',
  render_label: 'someone',
  person_display_name: 'someone',
  relationship_to_subject: 'friend',
  role: 'witness',
  author_payload: {
    author_label: 'Bob Jones',
    render_label: 'someone',
    identity_state: 'pending',
    media_presentation: 'normal',
    canApprove: false,
    canAnonymize: false,
    canRemove: false,
    canInvite: false,
    canEditDescriptor: false,
  },
  ...overrides,
});

const createLinkRef = (overrides: Partial<RedactedReference> = {}): RedactedReference => ({
  id: 'link-1',
  type: 'link',
  url: 'https://example.com/article',
  display_name: 'Example Article',
  visibility: 'approved',
  identity_state: 'approved',
  media_presentation: 'normal',
  render_label: 'Example Article',
  ...overrides,
});

// =============================================================================
// Empty/Null Handling
// =============================================================================

describe('ReferencesList', () => {
  describe('empty states', () => {
    it('returns null when references is empty array', () => {
      const { container } = render(<ReferencesList references={[]} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('returns null when references is undefined', () => {
      // @ts-expect-error - testing runtime behavior
      const { container } = render(<ReferencesList references={undefined} />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  // =============================================================================
  // Person References - Owner View
  // =============================================================================

  describe('person references - owner view', () => {
    it('shows full name for approved references', () => {
      render(
        <ReferencesList
          references={[createPersonRef()]}
          viewerIsOwner={true}
        />
      );

      expect(screen.getByText('Julie Smith')).toBeInTheDocument();
    });

    it('shows real name from author_payload for redacted references', () => {
      render(
        <ReferencesList
          references={[createRedactedPersonRef()]}
          viewerIsOwner={true}
        />
      );

      // Owner sees the real name from author_payload
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    it('shows role label', () => {
      render(
        <ReferencesList
          references={[createPersonRef({ role: 'witness' })]}
          viewerIsOwner={true}
        />
      );

      expect(screen.getByText('Also there')).toBeInTheDocument();
    });

    it('shows relationship for approved visibility', () => {
      render(
        <ReferencesList
          references={[createPersonRef({ relationship_to_subject: 'cousin' })]}
          viewerIsOwner={true}
        />
      );

      expect(screen.getByText('(Cousin)')).toBeInTheDocument();
    });

    it('does not show privacy indicator for owner', () => {
      render(
        <ReferencesList
          references={[createRedactedPersonRef()]}
          viewerIsOwner={true}
        />
      );

      expect(screen.queryByLabelText('Why is this name hidden?')).not.toBeInTheDocument();
    });
  });

  // =============================================================================
  // Person References - Public View
  // =============================================================================

  describe('person references - public view', () => {
    it('shows full name for approved references', () => {
      render(
        <ReferencesList
          references={[createPersonRef()]}
          viewerIsOwner={false}
        />
      );

      expect(screen.getByText('Julie Smith')).toBeInTheDocument();
    });

    it('shows redacted name for pending references', () => {
      render(
        <ReferencesList
          references={[createRedactedPersonRef()]}
          viewerIsOwner={false}
        />
      );

      expect(screen.getByText('someone')).toBeInTheDocument();
      expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
    });

    it('shows privacy indicator for redacted names', () => {
      render(
        <ReferencesList
          references={[createRedactedPersonRef()]}
          viewerIsOwner={false}
        />
      );

      expect(screen.getByLabelText('Why is this name hidden?')).toBeInTheDocument();
    });

    it('does not show privacy indicator for approved names', () => {
      render(
        <ReferencesList
          references={[createPersonRef()]}
          viewerIsOwner={false}
        />
      );

      expect(screen.queryByLabelText('Why is this name hidden?')).not.toBeInTheDocument();
    });

    it('does not show relationship for redacted references', () => {
      render(
        <ReferencesList
          references={[createRedactedPersonRef({ relationship_to_subject: 'cousin' })]}
          viewerIsOwner={false}
        />
      );

      // Relationship should not be shown when visibility is not approved
      expect(screen.queryByText('(Cousin)')).not.toBeInTheDocument();
    });
  });

  // =============================================================================
  // Privacy Explainer Tooltip
  // =============================================================================

  describe('privacy explainer tooltip', () => {
    it('shows explainer on hover', async () => {
      render(
        <ReferencesList
          references={[createRedactedPersonRef()]}
          viewerIsOwner={false}
        />
      );

      const privacyButton = screen.getByLabelText('Why is this name hidden?');
      fireEvent.mouseEnter(privacyButton);

      expect(screen.getByText(/To protect privacy/)).toBeInTheDocument();
      expect(screen.getByText('How identity works')).toBeInTheDocument();
    });

    it('hides explainer on mouse leave', () => {
      render(
        <ReferencesList
          references={[createRedactedPersonRef()]}
          viewerIsOwner={false}
        />
      );

      const privacyButton = screen.getByLabelText('Why is this name hidden?');
      fireEvent.mouseEnter(privacyButton);
      expect(screen.getByText(/To protect privacy/)).toBeInTheDocument();

      fireEvent.mouseLeave(privacyButton);
      expect(screen.queryByText(/To protect privacy/)).not.toBeInTheDocument();
    });

    it('toggles explainer on click', () => {
      render(
        <ReferencesList
          references={[createRedactedPersonRef()]}
          viewerIsOwner={false}
        />
      );

      const privacyButton = screen.getByLabelText('Why is this name hidden?');

      fireEvent.click(privacyButton);
      expect(screen.getByText(/To protect privacy/)).toBeInTheDocument();

      fireEvent.click(privacyButton);
      expect(screen.queryByText(/To protect privacy/)).not.toBeInTheDocument();
    });

    it('links to /identity page', () => {
      render(
        <ReferencesList
          references={[createRedactedPersonRef()]}
          viewerIsOwner={false}
        />
      );

      const privacyButton = screen.getByLabelText('Why is this name hidden?');
      fireEvent.mouseEnter(privacyButton);

      const link = screen.getByRole('link', { name: 'How identity works' });
      expect(link).toHaveAttribute('href', '/identity');
    });
  });

  // =============================================================================
  // Link References
  // =============================================================================

  describe('link references', () => {
    it('renders link with correct href', () => {
      render(<ReferencesList references={[createLinkRef()]} />);

      const link = screen.getByRole('link', { name: /Example Article/ });
      expect(link).toHaveAttribute('href', 'https://example.com/article');
    });

    it('opens links in new tab', () => {
      render(<ReferencesList references={[createLinkRef()]} />);

      const link = screen.getByRole('link', { name: /Example Article/ });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('decodes HTML entities in display name', () => {
      render(
        <ReferencesList
          references={[createLinkRef({ display_name: 'Tom &amp; Jerry' })]}
        />
      );

      expect(screen.getByText(/Tom & Jerry/)).toBeInTheDocument();
    });
  });

  // =============================================================================
  // Dev Mode (showBothViews)
  // =============================================================================

  describe('dev mode - showBothViews', () => {
    it('shows both owner and public views', () => {
      render(
        <ReferencesList
          references={[createRedactedPersonRef()]}
          viewerIsOwner={false}
          showBothViews={true}
        />
      );

      expect(screen.getByText('Owner sees')).toBeInTheDocument();
      expect(screen.getByText('Public sees')).toBeInTheDocument();
    });

    it('shows real name in owner section and redacted in public section', () => {
      render(
        <ReferencesList
          references={[createRedactedPersonRef()]}
          viewerIsOwner={false}
          showBothViews={true}
        />
      );

      // Both names should appear - real name in owner view, redacted in public
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
      expect(screen.getByText('someone')).toBeInTheDocument();
    });

    it('only shows dev mode when there are person refs', () => {
      render(
        <ReferencesList
          references={[createLinkRef()]}
          showBothViews={true}
        />
      );

      // Should not show owner/public sections for link-only references
      expect(screen.queryByText('Owner sees')).not.toBeInTheDocument();
      expect(screen.queryByText('Public sees')).not.toBeInTheDocument();
    });
  });

  // =============================================================================
  // Mixed References
  // =============================================================================

  describe('mixed references', () => {
    it('renders both person and link references', () => {
      render(
        <ReferencesList
          references={[createPersonRef(), createLinkRef()]}
          viewerIsOwner={true}
        />
      );

      expect(screen.getByText('Julie Smith')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Example Article/ })).toBeInTheDocument();
    });

    it('renders multiple person references', () => {
      render(
        <ReferencesList
          references={[
            createPersonRef({ id: 'ref-1', render_label: 'Julie Smith', author_payload: { ...createPersonRef().author_payload!, author_label: 'Julie Smith' } }),
            createRedactedPersonRef({ id: 'ref-2' }),
          ]}
          viewerIsOwner={true}
        />
      );

      expect(screen.getByText('Julie Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });
  });

  // =============================================================================
  // Notes
  // =============================================================================

  describe('reference notes', () => {
    it('displays note when present', () => {
      render(
        <ReferencesList
          references={[createPersonRef({ note: 'Important context' })]}
          viewerIsOwner={true}
        />
      );

      expect(screen.getByText(/Important context/)).toBeInTheDocument();
    });

    it('does not show note when absent', () => {
      render(
        <ReferencesList
          references={[createPersonRef({ note: undefined })]}
          viewerIsOwner={true}
        />
      );

      // Should not have any em-dash + text pattern
      expect(screen.queryByText(/—/)).not.toBeInTheDocument();
    });
  });
});
