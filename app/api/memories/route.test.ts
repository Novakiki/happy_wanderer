import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { createAdminClient, createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/llm-review', () => ({
  llmReviewGate: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/lib/pending-names', () => ({
  detectAndStoreMentions: vi.fn().mockResolvedValue({ mentions: [] }),
}));

vi.mock('@/lib/note-lint', () => ({
  lintNote: vi.fn().mockResolvedValue([]),
}));

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedCreateClient = vi.mocked(createClient);

type MockResponse = { data?: unknown; error?: unknown };

/**
 * Creates a chainable mock that tracks insert/update calls for assertions.
 */
function createTrackingAdminMock(responses: MockResponse[]) {
  let index = 0;
  const consume = () => responses[index++] ?? { data: null, error: null };

  const inserts: Array<{ table: string; data: unknown }> = [];
  const updates: Array<{ table: string; data: unknown; filter: { column: string; value: unknown } }> = [];
  let currentTable = '';
  let pendingUpdate: Record<string, unknown> | null = null;

  const chain = {
    select: () => chain,
    insert: (data: unknown) => {
      inserts.push({ table: currentTable, data });
      return chain;
    },
    update: (data: unknown) => {
      pendingUpdate = data as Record<string, unknown>;
      return chain;
    },
    upsert: () => chain,
    delete: () => chain,
    eq: (column: string, value: unknown) => {
      if (pendingUpdate) {
        updates.push({ table: currentTable, data: pendingUpdate, filter: { column, value } });
        pendingUpdate = null;
      }
      return chain;
    },
    ilike: () => chain,
    limit: () => chain,
    in: () => chain,
    or: () => chain,
    is: () => chain,
    single: async () => consume(),
    maybeSingle: async () => consume(),
    then: (resolve: (value: MockResponse) => void, reject: (reason?: unknown) => void) =>
      Promise.resolve(consume()).then(resolve, reject),
  };

  return {
    from: vi.fn((table: string) => {
      currentTable = table;
      return chain;
    }),
    inserts,
    updates,
  };
}

function makePost(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/memories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function mockAuthUser(userId: string) {
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: { id: userId } },
        error: null,
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

const baseMemoryInput = {
  title: 'Test Memory',
  content: '<p>This is a test memory.</p>',
  why_included: 'Testing',
  year: 2020,
  entry_type: 'memory',
  contributor_id: 'contrib-1',
  submitter_name: 'Test User',
  submitter_relationship: 'self',
};

beforeEach(() => {
  mockedCreateAdminClient.mockReset();
  mockedCreateClient.mockReset();
});

describe('memories API - sibling linking', () => {
  it('sets shared_moment_id to self for standalone memories', async () => {
    mockAuthUser('user-1');

    // With contributor_id provided, API skips lookup and goes straight to:
    // 1. contributors.select('trusted') - trusted check
    // 2. timeline_events.insert().select() - create event
    const admin = createTrackingAdminMock([
      // contributor trusted check
      { data: { trusted: true }, error: null },
      // timeline_events insert
      { data: { id: 'event-standalone' }, error: null },
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(makePost(baseMemoryInput));
    expect(response.status).toBe(200);

    // Find the update that sets shared_moment_id
    const sharedMomentUpdate = admin.updates.find(
      (u) => u.table === 'timeline_events' && 'shared_moment_id' in (u.data as Record<string, unknown>)
    );

    expect(sharedMomentUpdate).toBeDefined();
    expect((sharedMomentUpdate!.data as Record<string, unknown>).shared_moment_id).toBe('event-standalone');
  });

  it('creates OVERLAPS memory_link when responding to existing memory', async () => {
    mockAuthUser('user-1');

    const parentEventId = 'event-parent';
    const parentSharedMomentId = 'moment-shared';

    // With prompted_by_event_id and contributor_id provided:
    // 1. timeline_events.select() - parent lookup
    // 2. contributors.select('trusted') - trusted check
    // 3. timeline_events.insert().select() - create event
    const admin = createTrackingAdminMock([
      // parent event lookup (prompted_by_event_id)
      {
        data: {
          id: parentEventId,
          root_event_id: parentEventId,
          chain_depth: 0,
          privacy_level: 'family',
          shared_moment_id: parentSharedMomentId,
        },
        error: null,
      },
      // contributor trusted check
      { data: { trusted: true }, error: null },
      // timeline_events insert
      { data: { id: 'event-child' }, error: null },
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({
        ...baseMemoryInput,
        prompted_by_event_id: parentEventId,
        contributor_id: 'contrib-2',
      })
    );

    expect(response.status).toBe(200);

    // Verify shared_moment_id is set to parent's shared_moment_id
    const sharedMomentUpdate = admin.updates.find(
      (u) => u.table === 'timeline_events' && 'shared_moment_id' in (u.data as Record<string, unknown>)
    );
    expect(sharedMomentUpdate).toBeDefined();
    expect((sharedMomentUpdate!.data as Record<string, unknown>).shared_moment_id).toBe(parentSharedMomentId);

    // Verify OVERLAPS memory_link is created
    const memoryLinkInsert = admin.inserts.find((i) => i.table === 'memory_links');
    expect(memoryLinkInsert).toBeDefined();
    expect(memoryLinkInsert!.data).toMatchObject({
      from_event_id: parentEventId,
      to_event_id: 'event-child',
      link_type_id: 1, // OVERLAPS
      created_by: 'contrib-2',
    });
  });

  it('uses prompted_by_event_id as shared_moment_id when parent has no shared_moment_id', async () => {
    mockAuthUser('user-1');

    const parentEventId = 'event-legacy-parent';

    const admin = createTrackingAdminMock([
      // parent event lookup - legacy event with no shared_moment_id
      {
        data: {
          id: parentEventId,
          root_event_id: parentEventId,
          chain_depth: 0,
          privacy_level: 'public',
          shared_moment_id: null, // Legacy event without shared_moment_id
        },
        error: null,
      },
      // contributor trusted check
      { data: { trusted: true }, error: null },
      // timeline_events insert
      { data: { id: 'event-response' }, error: null },
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({
        ...baseMemoryInput,
        prompted_by_event_id: parentEventId,
        contributor_id: 'contrib-3',
      })
    );

    expect(response.status).toBe(200);

    // Should fall back to using prompted_by_event_id as shared_moment_id
    const sharedMomentUpdate = admin.updates.find(
      (u) => u.table === 'timeline_events' && 'shared_moment_id' in (u.data as Record<string, unknown>)
    );
    expect(sharedMomentUpdate).toBeDefined();
    expect((sharedMomentUpdate!.data as Record<string, unknown>).shared_moment_id).toBe(parentEventId);
  });
});
