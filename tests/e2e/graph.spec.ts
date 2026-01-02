import { test, expect } from '@playwright/test';

const mockGraph = {
  nodes: [
    {
      id: 'person-p1',
      label: 'Cheryl',
      type: 'person',
      size: 15,
      color: '#e07a5f',
      metadata: { claimed: true, visibility: 'family' },
    },
    {
      id: 'event-e1',
      label: 'Fishing trip',
      type: 'event',
      size: 10,
      color: '#3d405b',
      metadata: { year: 1995, eventType: 'memory' },
    },
  ],
  edges: [
    {
      id: 'ref-r1',
      source: 'person-p1',
      target: 'event-e1',
      type: 'reference',
      label: 'witness',
      color: 'rgba(255, 255, 255, 0.2)',
    },
  ],
};

test('graph page renders with mocked data', async ({ page }) => {
  await page.route('**/api/graph', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockGraph),
    });
  });

  await page.goto('/graph');

  await expect(page.getByRole('heading', { name: 'Memory Graph' })).toBeVisible();
  await expect(page.getByText('1 people')).toBeVisible();
  await expect(page.getByText('1 events')).toBeVisible();
  await expect(page.getByText('1 connections')).toBeVisible();
  await expect(page.getByText('Drag to pan')).toBeVisible();
});
