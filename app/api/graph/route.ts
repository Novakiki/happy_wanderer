/**
 * Graph API - Returns nodes and edges for visualization
 * ======================================================
 *
 * Returns:
 * - People as nodes (colored by whether they've claimed identity)
 * - Events as nodes (colored by type)
 * - event_references as edges (people ↔ events)
 * - memory_threads as edges (events ↔ events)
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

type GraphNode = {
  id: string;
  label: string;
  type: 'person' | 'event';
  size: number;
  color: string;
  metadata?: Record<string, unknown>;
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: 'reference' | 'thread';
  label?: string;
  color: string;
};

type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

// Colors
const COLORS = {
  person: {
    claimed: '#e07a5f',    // Warm terracotta - has account
    unclaimed: '#81b29a',  // Sage green - no account yet
  },
  event: {
    memory: '#3d405b',     // Dark blue-gray
    milestone: '#f2cc8f',  // Golden
    origin: '#f4f1de',     // Cream
  },
  edge: {
    reference: 'rgba(255, 255, 255, 0.2)',
    thread: 'rgba(224, 122, 95, 0.4)',  // Terracotta, transparent
  },
};

export async function GET() {
  try {
    const admin = createAdminClient();

    // Fetch people with claim status
    const { data: people, error: peopleError } = await admin
      .from('people')
      .select(`
        id,
        canonical_name,
        visibility,
        person_claims (
          id,
          status
        )
      `);

    if (peopleError) {
      console.error('Graph API - people error:', peopleError);
      return NextResponse.json({ error: 'Failed to fetch people' }, { status: 500 });
    }

    // Fetch events
    const { data: events, error: eventsError } = await admin
      .from('timeline_events')
      .select('id, title, type, year, status')
      .eq('status', 'published')
      .order('year', { ascending: true });

    if (eventsError) {
      console.error('Graph API - events error:', eventsError);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    // Fetch references (people ↔ events)
    const { data: references, error: refsError } = await admin
      .from('event_references')
      .select('id, event_id, person_id, role, visibility')
      .eq('type', 'person')
      .not('person_id', 'is', null);

    if (refsError) {
      console.error('Graph API - references error:', refsError);
      return NextResponse.json({ error: 'Failed to fetch references' }, { status: 500 });
    }

    // Fetch memory threads (events ↔ events)
    const { data: threads, error: threadsError } = await admin
      .from('memory_threads')
      .select('id, original_event_id, response_event_id, relationship');

    if (threadsError) {
      console.error('Graph API - threads error:', threadsError);
      return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 });
    }

    // Build node and edge sets
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const personIds = new Set<string>();
    const eventIds = new Set<string>();

    // Add people nodes
    for (const person of (people || [])) {
      const claims = (person as { person_claims?: Array<{ status: string }> }).person_claims || [];
      const hasClaim = claims.some((c) => c.status === 'approved' || c.status === 'pending');

      personIds.add(person.id);
      nodes.push({
        id: `person-${person.id}`,
        label: person.canonical_name || 'Unknown',
        type: 'person',
        size: 15,
        color: hasClaim ? COLORS.person.claimed : COLORS.person.unclaimed,
        metadata: {
          visibility: person.visibility,
          claimed: hasClaim,
        },
      });
    }

    // Add event nodes
    for (const event of (events || [])) {
      const eventType = event.type as 'memory' | 'milestone' | 'origin';
      eventIds.add(event.id);
      nodes.push({
        id: `event-${event.id}`,
        label: event.title || `${event.year}`,
        type: 'event',
        size: 10,
        color: COLORS.event[eventType] || COLORS.event.memory,
        metadata: {
          year: event.year,
          eventType: event.type,
        },
      });
    }

    // Add reference edges (person ↔ event)
    for (const ref of (references || [])) {
      const typedRef = ref as { id: string; event_id: string; person_id: string; role: string };
      if (personIds.has(typedRef.person_id) && eventIds.has(typedRef.event_id)) {
        edges.push({
          id: `ref-${typedRef.id}`,
          source: `person-${typedRef.person_id}`,
          target: `event-${typedRef.event_id}`,
          type: 'reference',
          label: typedRef.role,
          color: COLORS.edge.reference,
        });
      }
    }

    // Add thread edges (event ↔ event)
    for (const thread of (threads || [])) {
      const typedThread = thread as { id: string; original_event_id: string; response_event_id: string; relationship: string };
      if (eventIds.has(typedThread.original_event_id) && eventIds.has(typedThread.response_event_id)) {
        edges.push({
          id: `thread-${typedThread.id}`,
          source: `event-${typedThread.original_event_id}`,
          target: `event-${typedThread.response_event_id}`,
          type: 'thread',
          label: typedThread.relationship,
          color: COLORS.edge.thread,
        });
      }
    }

    const graphData: GraphData = { nodes, edges };

    return NextResponse.json(graphData);
  } catch (error) {
    console.error('Graph API error:', error);
    return NextResponse.json({ error: 'Failed to build graph' }, { status: 500 });
  }
}
