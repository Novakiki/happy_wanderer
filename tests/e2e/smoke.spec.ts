import { test, expect, type Page } from '@playwright/test';
import { readFixtures } from './fixtures/fixture-store';
import { login } from './pages/auth';
import { openMemory, expectMemoryContentHas } from './pages/memory';
import { fillNoteContent, fillNoteTitle, submitNote } from './pages/share';
import { openSettings, setDefaultVisibility, noteVisibilitySelect, toggleAllNotes, authorToggle } from './pages/settings';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const noteIdOverride = process.env.E2E_NOTE_ID;
const fixtureKey = process.env.E2E_FIXTURE_KEY;

type Visibility = 'approved' | 'blurred' | 'anonymized' | 'removed' | 'pending';

const VISIBILITY_RANK: Record<Visibility, number> = {
  approved: 0,
  blurred: 1,
  anonymized: 1,
  pending: 1,
  removed: 2,
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const loadFixtures = () => readFixtures();
const isMorePrivateOrEqual = (candidate: Visibility, base: Visibility) =>
  VISIBILITY_RANK[candidate] >= VISIBILITY_RANK[base];

const pickNextOverride = (current: Visibility, base: Visibility) => {
  const candidates: Visibility[] = ['blurred', 'anonymized', 'removed', 'approved', 'pending'];
  const allowed = candidates.filter((value) =>
    value === 'pending' || isMorePrivateOrEqual(value, base)
  );
  return allowed.find((value) => value !== current) ?? null;
};

test.describe('Smoke checks', () => {
  test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD for login.');

  const requestEditToken = async (page: Page) => {
    const response = await page.request.post('/api/edit/request', {
      data: { email },
    });

    if (!response.ok()) return null;

    const payload = await response.json().catch(() => ({}));
    const devLink = payload?.devLink;
    if (!devLink) return null;

    const pathname = devLink.startsWith('http')
      ? new URL(devLink).pathname
      : devLink;
    const token = pathname.split('/').filter(Boolean).pop();

    return token || null;
  };

  const cleanupNote = async (page: Page, noteId: string) => {
    const token = await requestEditToken(page);
    if (!token) {
      throw new Error('Missing edit token for cleanup.');
    }

    const response = await page.request.post('/api/edit/delete', {
      data: { token, event_id: noteId },
    });

    if (!response.ok()) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || 'Failed to clean up note.');
    }
  };

  const loadIdentity = async (page: Page) => {
    const response = await page.request.get(`/api/settings/identity?ts=${Date.now()}`);
    if (!response.ok()) return null;
    const data = await response.json().catch(() => null);
    return data;
  };

  const cleanupFixtures = async (page: Page, payload: { inviteIds?: string[] }) => {
    if (!fixtureKey) return;
    const response = await page.request.post('/api/test/fixtures/cleanup', {
      data: payload,
      headers: {
        'x-e2e-fixture-key': fixtureKey,
      },
    });
    if (!response.ok()) {
      const body = await response.json().catch(() => ({}));
      console.warn('Fixture cleanup failed:', body?.error || response.status());
    }
  };

  const findInviteCandidate = async () => {
    const fixtures = loadFixtures();
    const candidateNote = fixtures.identityNotes?.[0];
    const recipientName = fixtures.identity?.personName?.trim();

    if (!candidateNote || !recipientName) return null;

    return { eventId: candidateNote.id, recipientName };
  };

  let createdNote: { id: string; title: string } | null = null;

  test('auth gate redirects to login', async ({ page }) => {
    await page.goto('/score');
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  });

  test('score loads', async ({ page }) => {
    await login(page, { email: email as string, password: password as string });
    await page.goto('/score');
    await expect(page.getByText('Valerie Park Anderson', { exact: true })).toBeVisible();
  });

  test('memory loads', async ({ page }) => {
    await login(page, { email: email as string, password: password as string });

    let noteId: string | null = noteIdOverride || null;

    if (!noteId) {
      const response = await page.request.get('/api/score-peek');
      if (!response.ok()) {
        test.skip(true, `score-peek failed with status ${response.status()}`);
      }

      try {
        const data = await response.json();
        if (Array.isArray(data?.events) && data.events.length > 0) {
          noteId = data.events[0]?.id ?? null;
        }
      } catch {
        noteId = null;
      }
    }

    if (!noteId) {
      test.skip(true, 'No published notes available to test /memory.');
    }

    await page.goto(`/memory/${noteId}`);
    await expect(page.getByText('Added by')).toBeVisible();
  });

  test('chat loads', async ({ page }) => {
    await login(page, { email: email as string, password: password as string });
    await page.goto('/chat');
    await expect(page.getByRole('heading', { name: 'Chat with her patterns' })).toBeVisible();
  });

  test('add note flow', async ({ page }) => {
    await login(page, { email: email as string, password: password as string });
    await page.goto('/share');

    const title = `E2E Memory ${Date.now()}`;
    await fillNoteTitle(page, title);
    await fillNoteContent(page, 'In 1998 there was music and laughter in the kitchen.');

    await page.getByRole('button', { name: /Around a year/i }).click();
    await page.getByPlaceholder('Year, e.g. 1996').fill('1998');

    let noteId: string | null = null;

    try {
      const [response] = await Promise.all([
        page.waitForResponse((resp) =>
          resp.url().includes('/api/memories') && resp.request().method() === 'POST'
        ),
        submitNote(page),
      ]);

      const payload = await response.json().catch(() => ({}));
      expect(response.ok()).toBeTruthy();

      noteId = payload?.event?.id as string | undefined;
      expect(noteId).toBeTruthy();

      await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();

      createdNote = { id: noteId as string, title };

      await page.goto(`/memory/${noteId}`);
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
      await expect(page.getByText(/^~?1998$/)).toBeVisible();
    } finally {
      if (noteId) {
        await cleanupNote(page, noteId);
      }
    }
  });

  test('identity default persists', async ({ page }) => {
    await login(page, { email: email as string, password: password as string });

    const identity = await loadIdentity(page);
    if (!identity?.person) {
      test.skip(true, 'No identity claim available for this user.');
    }

    const current = identity.default_visibility as string;
    const next = current === 'blurred' ? 'approved' : 'blurred';

    await openSettings(page);
    await setDefaultVisibility(page, next as 'approved' | 'blurred' | 'anonymized' | 'removed');

    const updated = await loadIdentity(page);
    expect(updated?.default_visibility).toBe(next);

    // revert to original to avoid polluting data
    await openSettings(page);
    await setDefaultVisibility(page, current as 'approved' | 'blurred' | 'anonymized' | 'removed');
  });

  test('identity default applies across notes and sessions', async ({ page, browser }) => {
    await login(page, { email: email as string, password: password as string });

    const fixtures = loadFixtures();
    const identity = await loadIdentity(page);
    const fixturePersonName = fixtures.identity?.personName?.trim() || '';
    const personName = (identity?.person?.name || fixturePersonName).trim();

    if (!identity?.person || !personName) {
      test.skip(true, 'No identity claim available for visibility test.');
    }

    const current = identity?.default_visibility as string;
    if (!current || current === 'pending') {
      test.skip(true, 'Default visibility must be set to run this test.');
    }

    const next = current === 'approved' ? 'blurred' : 'approved';
    const seededNotes = fixtures.identityNotes ?? [];

    if (!seededNotes || seededNotes.length < 2) {
      test.skip(true, 'Fixture notes missing for identity visibility test.');
    }

    const nameRegex = new RegExp(`\\b${escapeRegExp(personName)}\\b`, 'i');
    const expectVisible = next === 'approved';
    let didUpdate = false;

    try {
      await openSettings(page);
      await setDefaultVisibility(page, next as 'approved' | 'blurred' | 'anonymized' | 'removed');
      didUpdate = true;

      for (const note of seededNotes) {
        await openMemory(page, note.id, note.title);
        await expectMemoryContentHas(page, nameRegex, expectVisible);
      }

      const freshContext = await browser.newContext();
      const freshPage = await freshContext.newPage();
      try {
        await login(freshPage, { email: email as string, password: password as string });
        for (const note of seededNotes) {
          await openMemory(freshPage, note.id, note.title);
          await expectMemoryContentHas(freshPage, nameRegex, expectVisible);
        }
      } finally {
        await freshContext.close();
      }
    } finally {
      if (didUpdate) {
        await openSettings(page);
        await setDefaultVisibility(page, current as 'approved' | 'blurred' | 'anonymized' | 'removed');
      }
    }
  });

  test('per-note override persists', async ({ page }) => {
    await login(page, { email: email as string, password: password as string });

    const fixtures = loadFixtures();
    const seededNotes = fixtures.identityNotes ?? [];

    const identity = await loadIdentity(page);
    if (!identity?.person) {
      test.skip(true, 'No identity claim available for per-note overrides.');
    }

    if (!seededNotes || seededNotes.length === 0) {
      test.skip(true, 'No fixture notes available for per-note overrides.');
    }

    let targetNote = identity?.notes?.find((note: any) =>
      seededNotes.some((seeded) => seeded.id === note?.event?.id)
    );

    if (!targetNote) {
      test.skip(true, 'No fixture note references found for per-note overrides.');
    }

    let refId = targetNote.reference_id as string;

    await openSettings(page);

    let noteSelect = noteVisibilitySelect(page, refId);
    if (!(await noteSelect.isVisible())) {
      const toggle = page.getByTestId('identity-notes-toggle');
      if (await toggle.isVisible()) {
        await toggleAllNotes(page);
      }

      const authorId = (targetNote.event?.contributor_id as string | null) ?? 'unknown';
      const authorButton = authorToggle(page, authorId);

      if (await authorButton.isVisible()) {
        await authorButton.click();
      } else {
        const fallbackAuthor = page.locator('[data-testid^="identity-author-"]').first();
        if (await fallbackAuthor.isVisible()) {
          await fallbackAuthor.click();
        } else {
          await noteSelect.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
        }
      }
    }

    noteSelect = noteVisibilitySelect(page, refId);
    let noteSelectVisible = await noteSelect
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    if (!noteSelectVisible) {
      const fallbackSelect = page.locator('[data-testid^="note-visibility-"]').first();
      noteSelectVisible = await fallbackSelect
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false);

      if (!noteSelectVisible) {
        test.skip(true, 'No per-note visibility control available for this note.');
        return;
      }

      const fallbackRefId = await fallbackSelect.getAttribute('data-reference-id');
      if (fallbackRefId) {
        refId = fallbackRefId;
        noteSelect = fallbackSelect;
        targetNote = identity?.notes?.find((note: any) => note.reference_id === refId) ?? targetNote;
      }
    }

    const originalOverride = (targetNote.visibility_override || 'pending') as Visibility;
    const baseVisibility = (targetNote.base_visibility || targetNote.effective_visibility || identity.default_visibility || 'approved') as Visibility;
    const current = originalOverride === 'pending' ? baseVisibility : originalOverride;
    const next = pickNextOverride(current, baseVisibility);

    if (!next) {
      test.skip(true, 'No valid visibility change available for per-note overrides.');
      return;
    }

    await noteSelect.selectOption(next);
    await expect(page.getByText('Note visibility updated.')).toBeVisible();

    const refreshed = await loadIdentity(page);
    const updatedNote = refreshed?.notes?.find((note: any) => note.reference_id === refId);
    expect(updatedNote?.visibility_override || updatedNote?.effective_visibility).toBe(next);

    const shouldRevertToOriginal = originalOverride === 'pending' ||
      isMorePrivateOrEqual(originalOverride, baseVisibility);
    const revertValue = shouldRevertToOriginal ? originalOverride : 'pending';

    await noteSelect.selectOption(revertValue);
    await expect(page.getByText('Note visibility updated.')).toBeVisible();
  });

  test('invite request succeeds', async ({ page }) => {
    await login(page, { email: email as string, password: password as string });

    const candidate = await findInviteCandidate();
    if (!candidate) {
      test.skip(true, 'No memory with person references available for invite test.');
    }

    let inviteId: string | null = null;

    try {
      const inviteRes = await page.request.post('/api/invite', {
        data: {
          event_id: candidate.eventId,
          recipient_name: candidate.recipientName,
          recipient_contact: 'invitee@example.com',
          method: 'email',
          message: 'Please add your perspective.',
        },
      });

      expect(inviteRes.ok()).toBeTruthy();
      const payload = await inviteRes.json().catch(() => ({}));
      expect(payload?.success).toBe(true);
      expect(payload?.invite_id).toBeTruthy();

      inviteId = payload.invite_id as string;
    } finally {
      if (inviteId) {
        await cleanupFixtures(page, { inviteIds: [inviteId] });
      }
    }
  });

  test('edit link loads', async ({ page }) => {
    await login(page, { email: email as string, password: password as string });
    await page.goto('/edit');

    const requestHeading = page.getByRole('heading', { name: 'Request a magic link' });
    const hasRequestForm = (await requestHeading.count()) > 0;

    if (hasRequestForm) {
      await page.getByLabel('Email used on your note').fill(email as string);

      const [response] = await Promise.all([
        page.waitForResponse((resp) =>
          resp.url().includes('/api/edit/request') && resp.request().method() === 'POST'
        ),
        page.getByRole('button', { name: 'Send magic link' }).click(),
      ]);

      const payload = await response.json().catch(() => ({}));
      expect(response.ok()).toBeTruthy();
      expect(payload?.devLink).toBeTruthy();

      await page.goto(payload.devLink);
      await expect(page.getByRole('heading', { name: /Your notes|Edit note/ })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: /Your notes|Edit note/ })).toBeVisible();
    }

    if (createdNote?.title) {
      const createdHeading = page.getByRole('heading', { name: createdNote.title });
      if ((await createdHeading.count()) > 0) {
        await expect(createdHeading).toBeVisible();
      }
    }
  });

  test('missing memory shows 404', async ({ page }) => {
    await login(page, { email: email as string, password: password as string });
    await page.goto('/memory/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText('This page could not be found.')).toBeVisible();
  });
});
