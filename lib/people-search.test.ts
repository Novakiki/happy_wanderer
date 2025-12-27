import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for people search logic.
 * Tests the ranking/scoring algorithm without hitting the database.
 */

type PersonSearchResult = {
  id: string;
  name: string;
  relationship: string | null;
  linked: boolean;
  mention_count: number;
  source: 'contributor' | 'placeholder' | 'claimed';
};

type ScoredResult = PersonSearchResult & { _score: number[] };

// Extract the scoring logic from the API
function scoreResults(
  contributors: Array<{ id: string; name: string; relation?: string | null }>,
  query: string,
  linkedIds: Set<string>,
  mentionCounts: Map<string, number>,
  latestRelationship: Map<string, string | null>
): ScoredResult[] {
  const normalizedQuery = query.toLowerCase();

  return contributors.map((c) => {
    const name = c.name;
    const normalizedName = name.toLowerCase();
    const relFromContributor = c.relation ?? null;
    const relFromRefs = latestRelationship.get(c.id) ?? null;
    const relationship = relFromContributor || relFromRefs;
    const mentionCount = mentionCounts.get(c.id) ?? 0;
    const linked = linkedIds.has(c.id);

    const prefixMatch = normalizedName.startsWith(normalizedQuery);
    const containsMatch = normalizedName.includes(normalizedQuery);

    return {
      id: c.id,
      name,
      relationship,
      linked,
      mention_count: mentionCount,
      source: linked ? 'claimed' : mentionCount > 0 ? 'placeholder' : 'contributor',
      _score: [
        prefixMatch ? 2 : containsMatch ? 1 : 0,
        linked ? 1 : 0,
        mentionCount,
        -name.length,
      ],
    };
  });
}

function sortResults(scored: ScoredResult[]): ScoredResult[] {
  return [...scored].sort((a, b) => {
    for (let i = 0; i < Math.max(a._score.length, b._score.length); i++) {
      const diff = b._score[i] - a._score[i];
      if (diff !== 0) return diff;
    }
    return a.name.localeCompare(b.name);
  });
}

describe('people search scoring', () => {
  const mockContributors = [
    { id: '1', name: 'Sarah Miller', relation: 'cousin' },
    { id: '2', name: 'Sarah Chen', relation: 'friend' },
    { id: '3', name: 'John Sarah', relation: null },
    { id: '4', name: 'Sam Wilson', relation: 'neighbor' },
  ];

  it('ranks prefix matches higher than contains matches', () => {
    const scored = scoreResults(
      mockContributors,
      'sarah',
      new Set(),
      new Map(),
      new Map()
    );
    const sorted = sortResults(scored);

    // Sarah Miller and Sarah Chen should come before John Sarah
    expect(sorted[0].name).toBe('Sarah Chen'); // shorter, prefix match
    expect(sorted[1].name).toBe('Sarah Miller'); // prefix match
    expect(sorted[2].name).toBe('John Sarah'); // contains match
  });

  it('ranks linked users higher', () => {
    const linkedIds = new Set(['2']); // Sarah Chen is linked
    const scored = scoreResults(
      mockContributors,
      'sarah',
      linkedIds,
      new Map(),
      new Map()
    );
    const sorted = sortResults(scored);

    // Sarah Chen (linked) should come first
    expect(sorted[0].name).toBe('Sarah Chen');
    expect(sorted[0].linked).toBe(true);
  });

  it('ranks by mention count', () => {
    const mentionCounts = new Map([
      ['1', 5], // Sarah Miller mentioned 5 times
      ['2', 1], // Sarah Chen mentioned once
    ]);
    const scored = scoreResults(
      mockContributors,
      'sarah',
      new Set(),
      mentionCounts,
      new Map()
    );
    const sorted = sortResults(scored);

    // Sarah Miller (5 mentions) should come before Sarah Chen (1 mention)
    expect(sorted[0].name).toBe('Sarah Miller');
    expect(sorted[0].mention_count).toBe(5);
  });

  it('prefers shorter names for ties', () => {
    const tiedContributors = [
      { id: '1', name: 'Sarah Jane Miller', relation: null },
      { id: '2', name: 'Sarah Lee', relation: null },
    ];
    const scored = scoreResults(
      tiedContributors,
      'sarah',
      new Set(),
      new Map(),
      new Map()
    );
    const sorted = sortResults(scored);

    expect(sorted[0].name).toBe('Sarah Lee'); // shorter
  });

  it('returns correct source based on linked/mentions', () => {
    const linkedIds = new Set(['1']);
    const mentionCounts = new Map([['2', 3]]);
    const scored = scoreResults(
      mockContributors.slice(0, 3),
      'sarah',
      linkedIds,
      mentionCounts,
      new Map()
    );

    const sarah1 = scored.find((r) => r.id === '1');
    const sarah2 = scored.find((r) => r.id === '2');
    const john = scored.find((r) => r.id === '3');

    expect(sarah1?.source).toBe('claimed'); // linked
    expect(sarah2?.source).toBe('placeholder'); // has mentions
    expect(john?.source).toBe('contributor'); // neither
  });

  it('uses relationship from references when contributor has none', () => {
    const contributorsNoRelation = [
      { id: '1', name: 'Sarah Miller', relation: null },
    ];
    const latestRelationship = new Map([['1', 'aunt_uncle']]);

    const scored = scoreResults(
      contributorsNoRelation,
      'sarah',
      new Set(),
      new Map(),
      latestRelationship
    );

    expect(scored[0].relationship).toBe('aunt_uncle');
  });
});
