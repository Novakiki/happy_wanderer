import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
const noteIdOverride = process.env.E2E_NOTE_ID;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const VIS_LABELS: Record<string, string> = {
  approved: 'Name',
  blurred: 'Initials only',
  anonymized: 'Relationship',
  removed: 'Hidden',
  pending: 'Default',
};

test.describe('Smoke checks', () => {
  test.skip(!email || !password, 'Set E2E_EMAIL and E2E_PASSWORD for login.');

  const memoryEditorPlaceholder = 'Share a story, a moment, or a note...';

  const login = async (page: Page) => {
    await page.goto('/auth/login');
    await page.getByLabel('Email').fill(email as string);
    await page.getByLabel('Password').fill(password as string);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/score');
  };

  const fillRichText = async (page: Page, placeholder: string, text: string) => {
    const editor = page.locator(`[data-placeholder="${placeholder}"]`);
    await expect(editor).toBeVisible();
    await editor.click();
    await editor.fill(text);
  };

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

  const findInviteCandidate = async () => {
    if (!supabaseAdmin) return null;

    const { data: events } = await supabaseAdmin
      .from('current_notes')
      .select('id')
      .eq('status', 'published')
      .eq('type', 'memory')
      .limit(25);

    for (const event of events ?? []) {
      const { data: refs } = await supabaseAdmin
        .from('event_references')
        .select('id, display_name, person:people(canonical_name)')
        .eq('event_id', event.id)
        .eq('type', 'person')
        .limit(25);

      const match = (refs ?? []).find((ref) => ref?.display_name || ref?.person?.canonical_name);
      const name = (match?.display_name || match?.person?.canonical_name || '').trim();
      if (name) {
        return { eventId: event.id as string, recipientName: name };
      }
    }

    return null;
  };

  const ensureNoteReferenceForIdentity = async (identity: any) => {
    if (!supabaseAdmin || !identity?.person?.id) return null;

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('contributor_id')
      .eq('email', email as string)
      .maybeSingle();

    const contributorId = (profile as { contributor_id?: string | null } | null)?.contributor_id;
    if (!contributorId) return null;

    const { data: event } = await supabaseAdmin
      .from('timeline_events')
      .insert({
        year: 1998,
        type: 'memory',
        title: 'Per-note visibility test note',
        preview: 'Temporary note for visibility override test',
        full_entry: 'Temporary note seeded for per-note visibility override test.',
        why_included: 'Temporary test seed.',
        status: 'published',
        privacy_level: 'family',
        contributor_id: contributorId,
      })
      .select('id')
      .single();

    const eventId = (event as { id?: string } | null)?.id;
    if (!eventId) return null;

    await supabaseAdmin.from('event_references').insert({
      event_id: eventId,
      type: 'person',
      person_id: identity.person.id as string,
      role: 'witness',
      visibility: 'approved',
      relationship_to_subject: 'cousin',
      added_by: contributorId,
    });

    return eventId;
  };

  let createdNote: { id: string; title: string } | null = null;

  test('auth gate redirects to login', async ({ page }) => {
    await page.goto('/score');
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  });

  test('score loads', async ({ page }) => {
    await login(page);
    await page.goto('/score');
    await expect(page.getByText('Valerie Park Anderson', { exact: true })).toBeVisible();
  });

  test('memory loads', async ({ page }) => {
    await login(page);

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
    await login(page);
    await page.goto('/chat');
    await expect(page.getByRole('heading', { name: 'Chat with her patterns' })).toBeVisible();
  });

  test('add note flow', async ({ page }) => {
    await login(page);
    await page.goto('/share');

    const title = `E2E Memory ${Date.now()}`;
    await page.getByPlaceholder('A short title for this note...').fill(title);
    await fillRichText(page, memoryEditorPlaceholder, 'In 1998 there was music and laughter in the kitchen.');

    await page.getByRole('button', { name: /Around a year/i }).click();
    await page.getByPlaceholder('Year, e.g. 1996').fill('1998');

    const submitButton = page.getByRole('button', { name: 'Add This Memory' });
    await expect(submitButton).toBeEnabled();

    let noteId: string | null = null;

    try {
      const [response] = await Promise.all([
        page.waitForResponse((resp) =>
          resp.url().includes('/api/memories') && resp.request().method() === 'POST'
        ),
        submitButton.click(),
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
    await login(page);

    const identity = await loadIdentity(page);
    if (!identity?.person) {
      test.skip(true, 'No identity claim available for this user.');
    }

    const current = identity.default_visibility as string;
    const next = current === 'blurred' ? 'approved' : 'blurred';

    await page.goto('/settings');
    await page.getByRole('button', { name: VIS_LABELS[next] }).first().click();
    await expect(page.getByText('Default visibility updated.')).toBeVisible();

    const updated = await loadIdentity(page);
    expect(updated?.default_visibility).toBe(next);

    // revert to original to avoid polluting data
    await page.getByRole('button', { name: VIS_LABELS[current] }).first().click();
    await expect(page.getByText('Default visibility updated.')).toBeVisible();
  });

  test('per-note override persists', async ({ page }) => {
    await login(page);

    let seededNoteId: string | null = null;
    try {
      let identity = await loadIdentity(page);
      let targetNote = identity?.notes?.find((n: any) => n?.event?.id);

      if (!identity?.person) {
        test.skip(true, 'No identity claim available for per-note overrides.');
      }

      if (!targetNote) {
        seededNoteId = await ensureNoteReferenceForIdentity(identity);
        if (seededNoteId) {
          identity = await loadIdentity(page);
          targetNote = identity?.notes?.find((n: any) => n?.event?.id);
        }
      }

      if (!targetNote) {
        test.skip(true, 'No note mentions available to override.');
      }

      const refId = targetNote.reference_id as string;
      const originalOverride = (targetNote.visibility_override || 'pending') as string;
      const effective = (targetNote.effective_visibility || 'approved') as string;
      const current = originalOverride === 'pending' ? effective : originalOverride;
      const next = current === 'blurred' ? 'approved' : 'blurred';
      await page.goto('/settings');

      let noteSelect = page.locator(`select[data-reference-id="${refId}"]`);
      if (!(await noteSelect.isVisible())) {
        let authorButtons = page.locator('button[data-author-id]');
        if ((await authorButtons.count()) === 0) {
          const toggle = page.getByRole('button', { name: /Show all notes by author|Hide all notes/ });
          if (await toggle.isVisible()) {
            await toggle.click();
            // wait for author list to render after expanding
            await authorButtons.first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
          }
        }

        authorButtons = page.locator('button[data-author-id]');
        const authorButtonsCount = await authorButtons.count();

        if (authorButtonsCount > 0) {
          const authorId = (targetNote.event?.contributor_id as string | null) ?? 'unknown';
          const authorToggle = page.locator(`button[data-author-id="${authorId}"]`).first();
          if (await authorToggle.isVisible()) {
            await authorToggle.click();
          } else {
            await authorButtons.first().click();
          }
        } else {
          // no author buttons; try waiting for the select to appear anyway
          await noteSelect.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
        }
      }

      noteSelect = page.locator(`select[data-reference-id="${refId}"]`);
      const noteSelectVisible = await noteSelect
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(() => true)
        .catch(() => false);

      if (!noteSelectVisible) {
        test.skip(true, 'No per-note visibility control available for this note.');
        return;
      }
      await noteSelect.selectOption(next);
      await expect(page.getByText('Note visibility updated.')).toBeVisible();

      const refreshed = await loadIdentity(page);
      const updatedNote = refreshed?.notes?.find((n: any) => n.reference_id === refId);
      expect(updatedNote?.visibility_override || updatedNote?.effective_visibility).toBe(next);

      // revert
      await noteSelect.selectOption(originalOverride);
      await expect(page.getByText('Note visibility updated.')).toBeVisible();
    } finally {
      if (seededNoteId && supabaseAdmin) {
        await supabaseAdmin.from('timeline_events').delete().eq('id', seededNoteId);
      }
    }
  });

  test('invite request succeeds', async ({ page }) => {
    await login(page);

    if (!supabaseAdmin) {
      test.skip(true, 'SUPABASE_URL and SUPABASE_SECRET_KEY are required for invite cleanup.');
    }

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
      if (inviteId && supabaseAdmin) {
        await supabaseAdmin.from('invites').delete().eq('id', inviteId);
      }
    }
  });

  test('edit link loads', async ({ page }) => {
    await login(page);
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
    await login(page);
    await page.goto('/memory/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText('This page could not be found.')).toBeVisible();
  });
});
