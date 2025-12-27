import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';

type Visibility = 'approved' | 'pending' | 'anonymized' | 'blurred' | 'removed';

type PersonSearchResult = {
  person_id: string;
  display_name: string;
  relationship: string | null;
  linked: boolean;
  mention_count: number;
  source: 'person' | 'claimed' | 'placeholder';
};

type ScoredResult = PersonSearchResult & { _score: number[]; _name: string };

type AliasRow = {
  person_id: string;
  alias: string;
  person: { id: string; canonical_name: string; visibility: Visibility | null; created_by?: string | null } | null;
};
type ClaimRow = { person_id: string };
type ReferenceRow = {
  person_id: string;
  relationship_to_subject?: string | null;
  visibility?: Visibility | null;
  created_at?: string | null;
  added_by?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    // Require authenticated user (same gate as memory submission)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q')?.trim() ?? '';
    const parsedLimit = Number.parseInt(searchParams.get('limit') ?? '8', 10);
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(parsedLimit, 20))
      : 8;

    // Avoid noisy responses for very short inputs
    if (rawQuery.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const likePattern = `%${rawQuery}%`;
    const normalizedQuery = rawQuery.toLowerCase();

    const { data: profileRow } = await (admin.from('profiles') as ReturnType<typeof admin.from>)
      .select('contributor_id')
      .eq('id', user.id)
      .limit(1);
    const contributorId = (profileRow && profileRow[0] ? profileRow[0].contributor_id : null) as string | null;

    // Fetch matching aliases with their people
    const { data: aliasRows, error: aliasError } = await (admin.from('person_aliases') as ReturnType<typeof admin.from>)
      .select('person_id, alias, person:people(id, canonical_name, visibility, created_by)')
      .ilike('alias', likePattern)
      .limit(limit * 6);

    if (aliasError) {
      console.error('People search alias error:', aliasError);
      return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
    }

    if (!aliasRows || aliasRows.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Collapse aliases to best match per person
    const bestMatch = new Map<
      string,
      { alias: string; matchRank: number; aliasLength: number; person: AliasRow['person'] }
    >();

    (aliasRows as AliasRow[]).forEach((row) => {
      if (!row.person) return;
      const normalizedAlias = row.alias.toLowerCase();
      const prefixMatch = normalizedAlias.startsWith(normalizedQuery);
      const containsMatch = normalizedAlias.includes(normalizedQuery);
      const matchRank = prefixMatch ? 2 : containsMatch ? 1 : 0;
      const aliasLength = row.alias.length;

      const existing = bestMatch.get(row.person_id);
      if (
        !existing ||
        matchRank > existing.matchRank ||
        (matchRank === existing.matchRank && aliasLength < existing.aliasLength)
      ) {
        bestMatch.set(row.person_id, {
          alias: row.alias,
          matchRank,
          aliasLength,
          person: row.person,
        });
      }
    });

    const personIds = Array.from(bestMatch.keys());
    if (personIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Claims indicate a linked identity
    const { data: claims } = await (admin.from('person_claims') as ReturnType<typeof admin.from>)
      .select('person_id')
      .in('person_id', personIds)
      .eq('status', 'approved');
    const linkedIds = new Set((claims as ClaimRow[] || []).map((c) => c.person_id));

    // Reference data: mention counts + latest relationship_to_subject
    const { data: referenceRows } = await (admin.from('event_references') as ReturnType<typeof admin.from>)
      .select('person_id, relationship_to_subject, visibility, created_at, added_by')
      .eq('type', 'person')
      .in('person_id', personIds);

    const mentionCounts = new Map<string, number>();
    const latestRelationship = new Map<string, { relationship: string | null; created_at: string | null }>();
    const ownedPersonIds = new Set<string>();

    ((referenceRows || []) as ReferenceRow[]).forEach((row) => {
      const visibility = (row.visibility ?? 'pending') as Visibility;
      if (visibility === 'removed') {
        return;
      }

      const personId = row.person_id;
      mentionCounts.set(personId, (mentionCounts.get(personId) ?? 0) + 1);

      const relationship = row.relationship_to_subject ?? null;
      const createdAt = row.created_at ?? null;
      const existing = latestRelationship.get(personId);

      if (!existing || (createdAt && existing.created_at && createdAt > existing.created_at)) {
        latestRelationship.set(personId, { relationship, created_at: createdAt });
      } else if (!existing) {
        latestRelationship.set(personId, { relationship, created_at: createdAt });
      }

      if (contributorId && row.added_by === contributorId) {
        ownedPersonIds.add(personId);
      }
    });

    const scored: ScoredResult[] = personIds
      .map((personId) => {
        const match = bestMatch.get(personId);
        if (!match || !match.person) return null;

        const person = match.person;
        const canonicalName = person.canonical_name;
        const baseVisibility = (person.visibility ?? 'pending') as Visibility;
        if (baseVisibility === 'removed') return null;

        const linked = linkedIds.has(personId);
        const owned = Boolean(
          contributorId &&
          (person.created_by === contributorId || ownedPersonIds.has(personId))
        );
        const isVisible = baseVisibility === 'approved' || linked || owned;
        if (!isVisible) return null;

        const relationship =
          latestRelationship.get(personId)?.relationship ?? null;
        const mentionCount = mentionCounts.get(personId) ?? 0;

        return {
          person_id: personId,
          display_name: canonicalName,
          relationship,
          linked,
          mention_count: mentionCount,
          source: linked ? 'claimed' : mentionCount > 0 ? 'placeholder' : 'person',
          _score: [
            match.matchRank,
            linked ? 1 : 0,
            mentionCount,
            -match.aliasLength,
          ],
          _name: canonicalName,
        };
      })
      .filter((row): row is ScoredResult => Boolean(row));

    // Rank results: prefix > contains > linked > mention_count > shorter alias > alpha
    scored.sort((a, b) => {
      for (let i = 0; i < Math.max(a._score.length, b._score.length); i++) {
        const diff = b._score[i] - a._score[i];
        if (diff !== 0) return diff;
      }
      return a._name.localeCompare(b._name);
    });

    const results: PersonSearchResult[] = scored
      .slice(0, limit)
      .map((item) => ({
        person_id: item.person_id,
        display_name: item.display_name,
        relationship: item.relationship,
        linked: item.linked,
        mention_count: item.mention_count,
        source: item.source,
      }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error('People search error:', error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}
