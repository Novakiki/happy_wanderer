/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TriggerEventLink } from './TriggerEventLink';

describe('TriggerEventLink', () => {
  describe('when trigger event exists', () => {
    it('renders the link with parent title', () => {
      render(
        <TriggerEventLink
          triggerEvent={{ id: 'parent-1', title: 'The Summer of 1986' }}
          currentEventId="child-1"
        />
      );

      expect(screen.getByText('In response to:')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'The Summer of 1986' })).toBeInTheDocument();
    });

    it('links to the parent memory page', () => {
      render(
        <TriggerEventLink
          triggerEvent={{ id: 'parent-1', title: 'The Summer of 1986' }}
          currentEventId="child-1"
        />
      );

      const link = screen.getByRole('link', { name: 'The Summer of 1986' });
      expect(link).toHaveAttribute('href', '/memory/parent-1');
    });

    it('has correct test id for e2e targeting', () => {
      render(
        <TriggerEventLink
          triggerEvent={{ id: 'parent-1', title: 'Test Parent' }}
          currentEventId="child-1"
        />
      );

      expect(screen.getByTestId('trigger-event-link')).toBeInTheDocument();
    });
  });

  describe('when trigger event is absent', () => {
    it('renders nothing when triggerEvent is null', () => {
      const { container } = render(
        <TriggerEventLink triggerEvent={null} currentEventId="note-1" />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('renders nothing when triggerEvent is undefined', () => {
      const { container } = render(
        <TriggerEventLink triggerEvent={undefined} currentEventId="note-1" />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('self-reference guard', () => {
    it('renders nothing when trigger event points to itself', () => {
      const { container } = render(
        <TriggerEventLink
          triggerEvent={{ id: 'same-id', title: 'Should not show' }}
          currentEventId="same-id"
        />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('edge cases', () => {
    it('handles empty title', () => {
      render(
        <TriggerEventLink
          triggerEvent={{ id: 'parent-1', title: '' }}
          currentEventId="child-1"
        />
      );

      // Link should still render, just with empty text
      expect(screen.getByTestId('trigger-event-link')).toBeInTheDocument();
    });

    it('handles special characters in title', () => {
      render(
        <TriggerEventLink
          triggerEvent={{ id: 'parent-1', title: 'Tom & Jerry\'s "Adventure"' }}
          currentEventId="child-1"
        />
      );

      expect(screen.getByRole('link', { name: 'Tom & Jerry\'s "Adventure"' })).toBeInTheDocument();
    });
  });
});
