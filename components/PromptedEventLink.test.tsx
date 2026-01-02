/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PromptedEventLink } from './PromptedEventLink';

describe('PromptedEventLink', () => {
  describe('when prompted event exists', () => {
    it('renders the link with parent title', () => {
      render(
        <PromptedEventLink
          promptedEvent={{ id: 'parent-1', title: 'The Summer of 1986' }}
          currentEventId="child-1"
        />
      );

      expect(screen.getByText('In response to:')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'The Summer of 1986' })).toBeInTheDocument();
    });

    it('links to the parent memory page', () => {
      render(
        <PromptedEventLink
          promptedEvent={{ id: 'parent-1', title: 'The Summer of 1986' }}
          currentEventId="child-1"
        />
      );

      const link = screen.getByRole('link', { name: 'The Summer of 1986' });
      expect(link).toHaveAttribute('href', '/memory/parent-1');
    });

    it('has correct test id for e2e targeting', () => {
      render(
        <PromptedEventLink
          promptedEvent={{ id: 'parent-1', title: 'Test Parent' }}
          currentEventId="child-1"
        />
      );

      expect(screen.getByTestId('trigger-event-link')).toBeInTheDocument();
    });
  });

  describe('when prompted event is absent', () => {
    it('renders nothing when promptedEvent is null', () => {
      const { container } = render(
        <PromptedEventLink promptedEvent={null} currentEventId="note-1" />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when promptedEvent is undefined', () => {
      const { container } = render(
        <PromptedEventLink promptedEvent={undefined} currentEventId="note-1" />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('self-reference guard', () => {
    it('renders nothing when prompted event points to itself', () => {
      const { container } = render(
        <PromptedEventLink
          promptedEvent={{ id: 'same-id', title: 'Should not show' }}
          currentEventId="same-id"
        />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('edge cases', () => {
    it('handles empty title', () => {
      render(
        <PromptedEventLink
          promptedEvent={{ id: 'parent-1', title: '' }}
          currentEventId="child-1"
        />
      );

      // Link should still render, just with empty text
      expect(screen.getByTestId('trigger-event-link')).toBeInTheDocument();
    });

    it('handles special characters in title', () => {
      render(
        <PromptedEventLink
          promptedEvent={{ id: 'parent-1', title: 'Tom & Jerry\'s "Adventure"' }}
          currentEventId="child-1"
        />
      );

      expect(screen.getByRole('link', { name: 'Tom & Jerry\'s "Adventure"' })).toBeInTheDocument();
    });
  });
});
