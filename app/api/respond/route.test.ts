import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { createAdminClient, createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedCreateClient = vi.mocked(createClient);

type MockResponse = { data?: unknown; error?: unknown };

function createAdminMock(responses: MockResponse[]) {
  let index = 0;
  const consume = () => responses[index++] ?? { data: null, error: null };

  const chain = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    upsert: () => chain,
    delete: () => chain,
    eq: () => chain,
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
    from: vi.fn(() => chain),
  };
}

function makeGet(inviteId: string) {
  return new NextRequest(`http://localhost/api/respond?id=${inviteId}`);
}

function mockAuthUser(userId: string | null) {
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
}

beforeEach(() => {
  mockedCreateAdminClient.mockReset();
  mockedCreateClient.mockReset();
});

describe('respond API', () => {
  it('uses invite sender name when present', async () => {
    mockAuthUser(null);
    const admin = createAdminMock([
      {
        data: {
          id: 'invite-1',
          recipient_name: 'Julie',
          status: 'sent',
          event: {
            id: 'event-1',
            title: 'Meeting Tom Cruise',
            type: 'memory',
            full_entry: '<p>Hello</p>',
            year: 1986,
            year_end: null,
            contributor_id: 'contrib-1',
            contributor: { name: 'Amy' },
          },
          sender: { name: 'Amy' },
        },
        error: null,
      },
      { data: [], error: null }, // event_references
      { data: [], error: null }, // note_mentions
      { data: null, error: null }, // invite status update
      { data: [{ id: 'invite-1' }], error: null }, // uses_count increment
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await GET(makeGet('invite-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invite.sender_name).toBe('Amy');
    expect(body.invite.sender_id).toBe('contrib-1');
    expect(body.invite.event.content).toBe('<p>Hello</p>');
    expect(body.viewer_identity.is_authenticated).toBe(false);
  });

  it('falls back to event contributor name when invite sender missing', async () => {
    mockAuthUser(null);
    const admin = createAdminMock([
      {
        data: {
          id: 'invite-2',
          recipient_name: 'Julie',
          status: 'sent',
          event: {
            id: 'event-2',
            title: 'Meeting Tom Cruise',
            type: 'memory',
            full_entry: '<p>Hello</p>',
            year: 1986,
            year_end: null,
            contributor_id: 'contrib-2',
            contributor: { name: 'Amy' },
          },
          sender: null,
        },
        error: null,
      },
      { data: [], error: null }, // event_references
      { data: [], error: null }, // note_mentions
      { data: null, error: null }, // invite status update
      { data: [{ id: 'invite-2' }], error: null }, // uses_count increment
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await GET(makeGet('invite-2'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invite.sender_name).toBe('Amy');
    expect(body.invite.sender_id).toBe('contrib-2');
    expect(body.viewer_identity.is_authenticated).toBe(false);
  });

  it('returns viewer identity defaults for authenticated users', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-9' }, error: null }, // profiles
      { data: [{ person_id: 'person-9', status: 'approved' }], error: null }, // person_claims
      { data: { visibility: 'approved' }, error: null }, // people
      { data: [{ visibility: 'blurred' }], error: null }, // visibility_preferences
      {
        data: {
          id: 'invite-3',
          recipient_name: 'Julie',
          status: 'sent',
          event: {
            id: 'event-3',
            title: 'Meeting Tom Cruise',
            type: 'memory',
            full_entry: '<p>Hello</p>',
            year: 1986,
            year_end: null,
            contributor_id: 'contrib-2',
            contributor: { name: 'Amy' },
          },
          sender: null,
        },
        error: null,
      },
      { data: [], error: null }, // event_references
      { data: [], error: null }, // note_mentions
      { data: null, error: null }, // invite status update
      { data: [{ id: 'invite-3' }], error: null }, // uses_count increment
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await GET(makeGet('invite-3'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.viewer_identity.is_authenticated).toBe(true);
    expect(body.viewer_identity.has_identity).toBe(true);
    expect(body.viewer_identity.default_visibility).toBe('blurred');
    expect(body.viewer_identity.default_source).toBe('preference');
  });
});
