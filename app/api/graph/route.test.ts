import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextResponse } from 'next/server';
import { GET } from './route';

// Mock Supabase admin client
vi.mock('@/lib/supabase/server', () => {
  type Row = Record<string, unknown>;

  const buildBuilder = (rows: Row[]) => {
    const data = rows;
    const builder: any = {
      select: () => builder,
      eq: () => builder,
      not: () => builder,
      in: () => builder,
      or: () => builder,
      is: () => builder,
      order: () => Promise.resolve({ data, error: null }),
      then: (resolve: any, reject?: any) =>
        Promise.resolve({ data, error: null }).then(resolve, reject),
    };
    return builder;
  };

  const mockData: Record<string, Row[]> = {
    people: [
      {
        id: 'p1',
        canonical_name: 'Cheryl',
        visibility: 'approved',
        person_claims: [{ id: 'c1', status: 'approved' }],
      },
      {
        id: 'p2',
        canonical_name: 'Alex',
        visibility: 'approved',
        person_claims: [],
      },
    ],
    current_notes: [
      {
        id: 'e1',
        title: 'Fishing trip',
        type: 'memory',
        year: 1995,
        status: 'published',
        prompted_by_event_id: null,
        contributor_id: 'c1',
      },
      {
        id: 'e2',
        title: 'Graduation',
        type: 'milestone',
        year: 2001,
        status: 'published',
        prompted_by_event_id: 'e1',
        contributor_id: 'c1',
      },
    ],
    event_references: [
      {
        id: 'r1',
        event_id: 'e1',
        person_id: 'p1',
        role: 'witness',
        visibility: 'pending',
        relationship_to_subject: 'friend',
        type: 'person',
        person: { id: 'p1', canonical_name: 'Cheryl', visibility: 'approved' },
      },
      {
        id: 'r2',
        event_id: 'e2',
        person_id: 'p2',
        role: 'heard_from',
        visibility: 'pending',
        relationship_to_subject: 'friend',
        type: 'person',
        person: { id: 'p2', canonical_name: 'Alex', visibility: 'approved' },
      },
    ],
    memory_threads: [
      { id: 't1', original_event_id: 'e1', response_event_id: 'e2', relationship: 'addition' },
    ],
    visibility_preferences: [
      { person_id: 'p1', contributor_id: null, visibility: 'approved' },
    ],
    person_claims: [
      { person_id: 'p1', status: 'approved' },
    ],
  };

  return {
    createAdminClient: () => ({
      from: (table: string) => buildBuilder(mockData[table] ?? []),
    }),
  };
});

describe('/api/graph GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns people and event nodes plus reference, chain, and thread edges with expected colors', async () => {
    const res = (await GET()) as NextResponse;
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      nodes: Array<{ id: string; type: string; color: string; metadata?: Record<string, unknown> }>;
      edges: Array<{ id: string; type: string; source: string; target: string; label?: string; color: string }>;
    };

    // People nodes
    const personNodes = json.nodes.filter((n) => n.type === 'person');
    expect(personNodes).toHaveLength(2);
    const claimed = personNodes.find((n) => n.id === 'person-p1');
    const unclaimed = personNodes.find((n) => n.id === 'person-p2');
    expect(claimed?.color).toBe('#e07a5f'); // claimed color
    expect(unclaimed?.color).toBe('#81b29a'); // unclaimed color
    expect(claimed?.metadata?.claimed).toBe(true);
    expect(unclaimed?.metadata?.claimed).toBe(false);
    expect(claimed?.metadata?.visibility).toBe('approved');

    // Event nodes
    const eventNodes = json.nodes.filter((n) => n.type === 'event');
    expect(eventNodes).toHaveLength(2);
    const memoryNode = eventNodes.find((n) => n.id === 'event-e1');
    const milestoneNode = eventNodes.find((n) => n.id === 'event-e2');
    expect(memoryNode?.color).toBe('#3d405b');
    expect(milestoneNode?.color).toBe('#f2cc8f');
    expect(memoryNode?.metadata?.year).toBe(1995);

    // Edges
    expect(json.edges).toHaveLength(4);
    const refEdge = json.edges.find((e) => e.id === 'ref-r1');
    const refEdgeTwo = json.edges.find((e) => e.id === 'ref-r2');
    const chainEdge = json.edges.find((e) => e.id === 'chain-e2');
    const threadEdge = json.edges.find((e) => e.id === 'thread-t1');
    expect(refEdge).toMatchObject({
      type: 'reference',
      source: 'person-p1',
      target: 'event-e1',
      color: 'rgba(129, 178, 154, 0.55)',
      label: 'witness',
    });
    expect(refEdgeTwo).toMatchObject({
      type: 'reference',
      source: 'person-p2',
      target: 'event-e2',
      color: 'rgba(224, 122, 95, 0.55)',
      label: 'heard_from',
    });
    expect(chainEdge).toMatchObject({
      type: 'chain',
      source: 'event-e1',
      target: 'event-e2',
      color: 'rgba(129, 178, 154, 0.45)',
      label: 'sparked',
    });
    expect(threadEdge).toMatchObject({
      type: 'thread',
      source: 'event-e1',
      target: 'event-e2',
      color: 'rgba(129, 178, 154, 0.6)',
      label: 'addition',
    });
  });
});
