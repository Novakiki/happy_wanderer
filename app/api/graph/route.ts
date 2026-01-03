/**
 * Graph API - Returns nodes and edges for visualization
 * ======================================================
 *
 * Returns:
 * - People as nodes (redacted labels, colored by claim status)
 * - Notes as nodes (colored by type)
 * - event_references as edges (people ↔ notes)
 * - memory_threads as edges (note ↔ note relationships)
 * - prompted_by_event_id as chain edges (sparked-by)
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { redactReferences, type ReferenceRow } from '@/lib/references';

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
  type: 'reference' | 'thread' | 'chain';
  label?: string;
  color: string;
  weight?: number;
  role?: string | null;
  relationship?: string | null;
  visibility?: string | null;
  year?: number | null;
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
    chain: 'rgba(129, 178, 154, 0.45)', // Sage, transparent
  },
};

const REFERENCE_ROLE_COLORS: Record<string, string> = {
  heard_from: 'rgba(224, 122, 95, 0.55)',
  witness: 'rgba(129, 178, 154, 0.55)',
  source: 'rgba(61, 64, 91, 0.55)',
  related: 'rgba(242, 204, 143, 0.6)',
};

const THREAD_RELATIONSHIP_COLORS: Record<string, string> = {
  perspective: 'rgba(224, 122, 95, 0.6)',
  addition: 'rgba(129, 178, 154, 0.6)',
  correction: 'rgba(196, 82, 82, 0.6)',
  related: 'rgba(242, 204, 143, 0.6)',
};

export async function GET() {
  try {
    const admin = createAdminClient();

    // Fetch events
    const { data: events, error: eventsError } = await admin
      .from('current_notes')
      .select('id, title, type, year, status, prompted_by_event_id, contributor_id')
      .eq('status', 'published')
      .order('year', { ascending: true });

    if (eventsError) {
      console.error('Graph API - events error:', eventsError);
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    // Fetch references (people ↔ events)
    const { data: references, error: refsError } = await admin
      .from('event_references')
      .select(`
        id,
        event_id,
        person_id,
        role,
        visibility,
        relationship_to_subject,
        person:people(id, canonical_name, visibility),
        contributor:contributors!event_references_contributor_id_fkey(name)
      `)
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

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const eventIds = new Set<string>();
    const personIds = new Set<string>();
    const contributorIds = new Set<string>();

    const eventById = new Map<string, { contributor_id: string | null; prompted_by_event_id: string | null }>();
    for (const event of (events || [])) {
      const typedEvent = event as {
        id: string;
        title: string | null;
        type: string | null;
        year: number | null;
        prompted_by_event_id: string | null;
        contributor_id: string | null;
      };
      eventIds.add(typedEvent.id);
      if (typedEvent.contributor_id) {
        contributorIds.add(typedEvent.contributor_id);
      }
      eventById.set(typedEvent.id, {
        contributor_id: typedEvent.contributor_id ?? null,
        prompted_by_event_id: typedEvent.prompted_by_event_id ?? null,
      });

      const eventType = (typedEvent.type as 'memory' | 'milestone' | 'origin') || 'memory';
      nodes.push({
        id: `event-${typedEvent.id}`,
        label: typedEvent.title || `${typedEvent.year ?? ''}`.trim(),
        type: 'event',
        size: 10,
        color: COLORS.event[eventType] || COLORS.event.memory,
        metadata: {
          year: typedEvent.year,
          eventType: typedEvent.type,
        },
      });
    }

    // Gather person IDs from references
    for (const ref of (references || [])) {
      const typedRef = ref as { person_id: string | null };
      if (typedRef.person_id) {
        personIds.add(typedRef.person_id);
      }
    }

    // Load visibility preferences (for per-note redaction)
    type VisibilityPref = { person_id: string; contributor_id: string | null; visibility: string };
    let allPreferences: VisibilityPref[] = [];
    if (personIds.size > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let prefQuery = admin.from('visibility_preferences' as any)
        .select('person_id, contributor_id, visibility')
        .in('person_id', [...personIds]);

      if (contributorIds.size > 0) {
        const contributorFilter = [...contributorIds]
          .map((id) => `contributor_id.eq.${id}`)
          .join(',');
        prefQuery = prefQuery.or(`${contributorFilter},contributor_id.is.null`);
      } else {
        prefQuery = prefQuery.is('contributor_id', null);
      }

      const { data: prefs } = await prefQuery;
      allPreferences = (prefs || []) as unknown as VisibilityPref[];
    }

    const prefLookup = new Map<string, Map<string | null, string>>();
    for (const pref of allPreferences) {
      if (!prefLookup.has(pref.person_id)) {
        prefLookup.set(pref.person_id, new Map());
      }
      prefLookup.get(pref.person_id)!.set(pref.contributor_id, pref.visibility);
    }

    // Load claim state for people (for coloring)
    const claimedPeople = new Set<string>();
    if (personIds.size > 0) {
      const { data: claims } = await admin
        .from('person_claims')
        .select('person_id, status')
        .in('person_id', [...personIds]);
      for (const claim of (claims || []) as Array<{ person_id: string; status: string }>) {
        if (claim.status === 'approved' || claim.status === 'pending') {
          claimedPeople.add(claim.person_id);
        }
      }
    }

    const referenceRows: Array<ReferenceRow & { event_id?: string; person_id?: string | null }> = (references || []).map((ref) => {
      const typedRef = ref as {
        id: string;
        event_id: string;
        person_id: string | null;
        role: string | null;
        visibility: string | null;
        relationship_to_subject: string | null;
        person?: { id?: string; canonical_name?: string | null; visibility?: string | null } | null;
        contributor?: { name?: string | null } | null;
      };
      const eventContributorId = eventById.get(typedRef.event_id)?.contributor_id ?? null;
      const personPrefs = typedRef.person_id ? prefLookup.get(typedRef.person_id) : null;
      const visibility_preference = personPrefs
        ? {
            contributor_preference: eventContributorId ? personPrefs.get(eventContributorId) ?? null : null,
            global_preference: personPrefs.get(null) ?? null,
          }
        : null;

      return {
        id: typedRef.id,
        type: 'person',
        role: typedRef.role,
        visibility: typedRef.visibility,
        relationship_to_subject: typedRef.relationship_to_subject ?? null,
        person: typedRef.person ?? null,
        contributor: typedRef.contributor ?? null,
        visibility_preference,
        event_id: typedRef.event_id,
        person_id: typedRef.person_id,
      };
    });

    const redacted = redactReferences(referenceRows);
    const redactedById = new Map(redacted.map((ref) => [ref.id, ref]));

    const personNodes = new Map<string, GraphNode>();

    for (const ref of referenceRows) {
      const typedRef = ref as ReferenceRow & { event_id?: string; person_id?: string | null };
      if (!typedRef.person_id || !typedRef.event_id) continue;
      if (!eventIds.has(typedRef.event_id)) continue;

      const redactedRef = redactedById.get(typedRef.id);
      if (!redactedRef || redactedRef.type !== 'person') continue;

      const personId = typedRef.person_id;
      const personNodeId = `person-${personId}`;

      if (!personNodes.has(personId)) {
        const label = redactedRef.render_label || 'Someone';
        const visibility = redactedRef.identity_state;
        const hasClaim = claimedPeople.has(personId);
        personNodes.set(personId, {
          id: personNodeId,
          label,
          type: 'person',
          size: 15,
          color: hasClaim ? COLORS.person.claimed : COLORS.person.unclaimed,
          metadata: {
            visibility,
            claimed: hasClaim,
          },
        });
      }

      const role = redactedRef.role ?? null;
      edges.push({
        id: `ref-${typedRef.id}`,
        source: personNodeId,
        target: `event-${typedRef.event_id}`,
        type: 'reference',
        label: role || undefined,
        role,
        visibility: redactedRef.identity_state,
        color: role && role in REFERENCE_ROLE_COLORS
          ? REFERENCE_ROLE_COLORS[role]
          : COLORS.edge.reference,
      });
    }

    nodes.push(...personNodes.values());

    // Add chain edges (prompted_by_event_id)
    for (const [eventId, info] of eventById.entries()) {
      if (info.prompted_by_event_id && eventIds.has(info.prompted_by_event_id)) {
        edges.push({
          id: `chain-${eventId}`,
          source: `event-${info.prompted_by_event_id}`,
          target: `event-${eventId}`,
          type: 'chain',
          label: 'sparked',
          color: COLORS.edge.chain,
        });
      }
    }

    // Add thread edges (event ↔ event)
    for (const thread of (threads || [])) {
      const typedThread = thread as { id: string; original_event_id: string; response_event_id: string; relationship: string | null };
      if (eventIds.has(typedThread.original_event_id) && eventIds.has(typedThread.response_event_id)) {
        const relationship = typedThread.relationship || null;
        edges.push({
          id: `thread-${typedThread.id}`,
          source: `event-${typedThread.original_event_id}`,
          target: `event-${typedThread.response_event_id}`,
          type: 'thread',
          label: relationship || undefined,
          relationship,
          color: relationship && relationship in THREAD_RELATIONSHIP_COLORS
            ? THREAD_RELATIONSHIP_COLORS[relationship]
            : COLORS.edge.thread,
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
