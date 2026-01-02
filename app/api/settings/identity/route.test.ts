import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { createAdminClient, createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedCreateAdminClient = vi.mocked(createAdminClient);

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
    single: async () => consume(),
    maybeSingle: async () => consume(),
    then: (resolve: (value: MockResponse) => void, reject: (reason?: unknown) => void) =>
      Promise.resolve(consume()).then(resolve, reject),
  };

  return {
    from: vi.fn(() => chain),
  };
}

function mockAuthUser(userId: string | null) {
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  } as unknown as ReturnType<typeof createClient>);
}

function makePost(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/settings/identity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockedCreateClient.mockReset();
  mockedCreateAdminClient.mockReset();
});

describe('settings identity API', () => {
  it('GET returns 401 when unauthenticated', async () => {
    mockAuthUser(null);

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('GET returns contributor_name when no identity claim exists', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
      { data: [], error: null },
      { data: { name: 'Amy' }, error: null },
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.person).toBeNull();
    expect(body.contributor_name).toBe('Amy');
  });

  it('POST returns 401 when unauthenticated', async () => {
    mockAuthUser(null);

    const response = await POST(makePost({ scope: 'claim' }) as NextRequest);
    expect(response.status).toBe(401);
  });

  it('POST returns 400 for invalid scope', async () => {
    mockAuthUser('user-1');

    const response = await POST(makePost({ scope: 'invalid' }) as NextRequest);
    expect(response.status).toBe(400);
  });

  it('POST claim creates identity when no person exists', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
      { data: { id: 'contrib-1', name: 'Amy' }, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: { id: 'person-1' }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(makePost({ scope: 'claim' }) as NextRequest);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.person_id).toBe('person-1');
  });

  it('POST default rejects pending visibility', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
      { data: [{ person_id: 'person-1', status: 'approved' }], error: null },
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(makePost({ scope: 'default', visibility: 'pending' }) as NextRequest);
    expect(response.status).toBe(400);
  });

  it('POST note returns 404 when reference is not found', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
      { data: [{ person_id: 'person-1', status: 'approved' }], error: null },
      { data: null, error: null },
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({ scope: 'note', reference_id: 'ref-1', visibility: 'approved' }) as NextRequest
    );
    expect(response.status).toBe(404);
  });

  it('POST note updates visibility successfully', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
      { data: [{ person_id: 'person-1', status: 'approved' }], error: null },
      { data: { id: 'ref-1', event_id: 'event-1' }, error: null }, // reference found
      { data: { contributor_id: 'author-1' }, error: null }, // event lookup
      { data: { visibility: 'approved' }, error: null }, // person visibility
      { data: [], error: null }, // visibility preferences
      { data: null, error: null }, // update succeeds
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({ scope: 'note', reference_id: 'ref-1', visibility: 'blurred' }) as NextRequest
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('POST note rejects visibility less private than default', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
      { data: [{ person_id: 'person-1', status: 'approved' }], error: null },
      { data: { id: 'ref-1', event_id: 'event-1' }, error: null }, // reference found
      { data: { contributor_id: 'author-1' }, error: null }, // event lookup
      { data: { visibility: 'blurred' }, error: null }, // person visibility (base blurred)
      { data: [], error: null }, // visibility preferences
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({ scope: 'note', reference_id: 'ref-1', visibility: 'approved' }) as NextRequest
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it('POST default updates visibility successfully', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
      { data: [{ person_id: 'person-1', status: 'approved' }], error: null },
      { data: null, error: null }, // people update
      { data: null, error: null }, // visibility_preferences upsert
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({ scope: 'default', visibility: 'approved' }) as NextRequest
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('POST author updates preference successfully', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
      { data: [{ person_id: 'person-1', status: 'approved' }], error: null },
      { data: null, error: null }, // visibility_preferences upsert
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({ scope: 'author', contributor_id: 'author-1', visibility: 'blurred' }) as NextRequest
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('POST author with pending visibility deletes preference', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
      { data: [{ person_id: 'person-1', status: 'approved' }], error: null },
      { data: null, error: null }, // delete succeeds
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({ scope: 'author', contributor_id: 'author-1', visibility: 'pending' }) as NextRequest
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('POST author returns 400 when contributor_id missing', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
      { data: [{ person_id: 'person-1', status: 'approved' }], error: null },
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({ scope: 'author', visibility: 'approved' }) as NextRequest
    );
    expect(response.status).toBe(400);
  });

  it('POST display_name updates name successfully', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
      { data: [{ person_id: 'person-1', status: 'approved' }], error: null },
      { data: null, error: null }, // update succeeds
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({ scope: 'display_name', display_name: 'Amy Anderson' }) as NextRequest
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('POST display_name returns 400 for empty name', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({ scope: 'display_name', display_name: '  ' }) as NextRequest
    );
    expect(response.status).toBe(400);
  });

  it('POST display_name returns 400 when no identity claim', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
      { data: [], error: null }, // no person claims
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({ scope: 'display_name', display_name: 'Amy' }) as NextRequest
    );
    expect(response.status).toBe(400);
  });

  it('POST note returns 400 when reference_id missing', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: 'contrib-1' }, error: null },
      { data: [{ person_id: 'person-1', status: 'approved' }], error: null },
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({ scope: 'note', visibility: 'approved' }) as NextRequest
    );
    expect(response.status).toBe(400);
  });

  it('POST returns 400 when no contributor linked', async () => {
    mockAuthUser('user-1');
    const admin = createAdminMock([
      { data: { contributor_id: null }, error: null },
    ]);
    mockedCreateAdminClient.mockReturnValue(admin as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      makePost({ scope: 'default', visibility: 'approved' }) as NextRequest
    );
    expect(response.status).toBe(400);
  });
});
