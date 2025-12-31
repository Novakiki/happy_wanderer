import { describe, it, expect } from 'vitest';
import {
  detectNames,
  detectAndMatchNames,
  maskNamesInContent,
  maskContentWithReferences,
  getMaskedName,
} from './name-detection';

// =============================================================================
// getMaskedName Tests
// =============================================================================

describe('getMaskedName', () => {
  describe('approved visibility', () => {
    it('returns full name when approved', () => {
      expect(getMaskedName('Julie Smith', 'approved')).toBe('Julie Smith');
    });

    it('returns full name regardless of relationship when approved', () => {
      expect(getMaskedName('Julie Smith', 'approved', 'cousin')).toBe('Julie Smith');
    });
  });

  describe('blurred visibility', () => {
    it('returns initials for two-part names', () => {
      expect(getMaskedName('Julie Smith', 'blurred')).toBe('J.S.');
    });

    it('returns initials for three-part names (first and last)', () => {
      expect(getMaskedName('Julie Anne Smith', 'blurred')).toBe('J.S.');
    });

    it('returns single initial for single names', () => {
      expect(getMaskedName('Julie', 'blurred')).toBe('J.');
    });

    it('returns "someone" for empty name', () => {
      expect(getMaskedName('', 'blurred')).toBe('[person]');
    });
  });

  describe('anonymized visibility', () => {
    it('returns relationship when provided', () => {
      expect(getMaskedName('Julie Smith', 'anonymized', 'a cousin')).toBe('a cousin');
    });

    it('returns "someone" when no relationship', () => {
      expect(getMaskedName('Julie Smith', 'anonymized')).toBe('[person]');
      expect(getMaskedName('Julie Smith', 'anonymized', null)).toBe('[person]');
    });
  });

  describe('removed/pending visibility', () => {
    it('returns "someone" for removed visibility', () => {
      expect(getMaskedName('Julie Smith', 'removed')).toBe('[person]');
    });

    it('returns "someone" for pending visibility without relationship', () => {
      expect(getMaskedName('Julie Smith', 'pending')).toBe('[person]');
    });

    it('returns "someone" for unknown visibility', () => {
      expect(getMaskedName('Julie Smith', 'unknown')).toBe('[person]');
    });
  });
});

// =============================================================================
// detectNames Tests
// =============================================================================

describe('detectNames', () => {
  it('detects simple person names', () => {
    const content = 'I met Julie Smith at the park.';
    const names = detectNames(content);

    expect(names.length).toBeGreaterThanOrEqual(1);
    expect(names.some(n => n.text.includes('Julie'))).toBe(true);
  });

  it('detects multiple names', () => {
    const content = 'Julie Smith and Bob Jones went to the store.';
    const names = detectNames(content);

    expect(names.length).toBeGreaterThanOrEqual(2);
  });

  it('returns position information', () => {
    const content = 'Hello Julie Smith!';
    const names = detectNames(content);

    const julie = names.find(n => n.text.includes('Julie'));
    expect(julie).toBeDefined();
    expect(julie!.start).toBeGreaterThanOrEqual(0);
    expect(julie!.end).toBeGreaterThan(julie!.start);
  });

  it('handles HTML content', () => {
    const content = '<p>I met <strong>Julie Smith</strong> yesterday.</p>';
    const names = detectNames(content);

    expect(names.some(n => n.text.includes('Julie'))).toBe(true);
  });

  it('deduplicates repeated names', () => {
    const content = 'Julie Smith said hello. Then Julie Smith left.';
    const names = detectNames(content);

    const julieCount = names.filter(n => n.text.toLowerCase().includes('julie')).length;
    expect(julieCount).toBe(1);
  });

  it('returns empty array for content without names', () => {
    const content = 'The weather was nice today.';
    const names = detectNames(content);

    expect(names).toEqual([]);
  });

  it('handles empty content', () => {
    expect(detectNames('')).toEqual([]);
  });
});

// =============================================================================
// detectAndMatchNames Tests
// =============================================================================

describe('detectAndMatchNames', () => {
  const knownPeople = [
    { id: 'person-1', name: 'Julie Smith', visibility: 'approved' },
    { id: 'person-2', name: 'Bob Jones', visibility: 'blurred' },
  ];

  it('matches detected names to known people', () => {
    const content = 'I saw Julie Smith at the park.';
    const matches = detectAndMatchNames(content, knownPeople);

    const julie = matches.find(m => m.text.includes('Julie'));
    expect(julie?.personId).toBe('person-1');
    expect(julie?.visibility).toBe('approved');
  });

  it('matches by first name', () => {
    const content = 'Julie was there.';
    const matches = detectAndMatchNames(content, knownPeople);

    const julie = matches.find(m => m.text === 'Julie');
    expect(julie?.personId).toBe('person-1');
  });

  it('returns unmatched names without personId', () => {
    const content = 'I met Sarah Wilson yesterday.';
    const matches = detectAndMatchNames(content, knownPeople);

    const sarah = matches.find(m => m.text.includes('Sarah'));
    if (sarah) {
      expect(sarah.personId).toBeUndefined();
    }
  });

  it('handles empty known people list', () => {
    const content = 'Julie Smith was here.';
    const matches = detectAndMatchNames(content, []);

    // Should still detect names, just without matches
    const julie = matches.find(m => m.text.includes('Julie'));
    if (julie) {
      expect(julie.personId).toBeUndefined();
    }
  });
});

// =============================================================================
// maskNamesInContent Tests
// =============================================================================

describe('maskNamesInContent', () => {
  it('replaces names with masked versions', () => {
    const content = 'Julie Smith went to the store.';
    const result = maskNamesInContent(content, [
      { text: 'Julie Smith', replacement: 'J.S.' },
    ]);

    expect(result).toBe('J.S. went to the store.');
  });

  it('handles multiple replacements', () => {
    const content = 'Julie Smith met Bob Jones today';
    const result = maskNamesInContent(content, [
      { text: 'Julie Smith', replacement: 'J.S.' },
      { text: 'Bob Jones', replacement: 'B.J.' },
    ]);

    expect(result).toBe('J.S. met B.J. today');
  });

  it('is case-insensitive', () => {
    const content = 'JULIE SMITH and julie smith both came';
    const result = maskNamesInContent(content, [
      { text: 'Julie Smith', replacement: 'J.S.' },
    ]);

    expect(result).toBe('J.S. and J.S. both came');
  });

  it('replaces longer matches first', () => {
    const content = 'Bob Smith Junior was here.';
    const result = maskNamesInContent(content, [
      { text: 'Bob', replacement: 'B.' },
      { text: 'Bob Smith Junior', replacement: 'B.S.J.' },
    ]);

    // Should replace "Bob Smith Junior" first, not just "Bob"
    expect(result).toBe('B.S.J. was here.');
  });

  it('preserves HTML structure', () => {
    const content = '<p><strong>Julie Smith</strong> was here.</p>';
    const result = maskNamesInContent(content, [
      { text: 'Julie Smith', replacement: 'J.S.' },
    ]);

    expect(result).toBe('<p><strong>J.S.</strong> was here.</p>');
  });

  it('handles empty replacement list', () => {
    const content = 'Julie Smith was here.';
    const result = maskNamesInContent(content, []);

    expect(result).toBe(content);
  });

  it('handles special regex characters in names', () => {
    const content = 'Dr. Smith (M.D.) was here.';
    const result = maskNamesInContent(content, [
      { text: 'Dr. Smith (M.D.)', replacement: 'a doctor' },
    ]);

    expect(result).toBe('a doctor was here.');
  });
});

// =============================================================================
// maskContentWithReferences Tests
// =============================================================================

describe('maskContentWithReferences', () => {
  it('masks names based on reference visibility', () => {
    const content = 'Julie Smith told me a story.';
    const references = [
      {
        render_label: 'J.S.',
        visibility: 'blurred',
        author_payload: { author_label: 'Julie Smith' },
      },
    ];

    const result = maskContentWithReferences(content, references);
    expect(result).toBe('J.S. told me a story.');
  });

  it('does not mask approved names', () => {
    const content = 'Julie Smith told me a story.';
    const references = [
      {
        render_label: 'Julie Smith',
        visibility: 'approved',
        author_payload: { author_label: 'Julie Smith' },
      },
    ];

    const result = maskContentWithReferences(content, references);
    expect(result).toBe(content); // unchanged
  });

  it('handles multiple references with different visibilities', () => {
    const content = 'Julie Smith and Bob Jones went out.';
    const references = [
      {
        render_label: 'J.S.',
        visibility: 'blurred',
        author_payload: { author_label: 'Julie Smith' },
      },
      {
        render_label: 'Bob Jones',
        visibility: 'approved',
        author_payload: { author_label: 'Bob Jones' },
      },
    ];

    const result = maskContentWithReferences(content, references);
    expect(result).toBe('J.S. and Bob Jones went out.');
  });

  it('handles references without author_payload', () => {
    const content = 'Julie Smith was here.';
    const references = [
      {
        render_label: 'J.S.',
        visibility: 'blurred',
        // no author_payload
      },
    ];

    const result = maskContentWithReferences(content, references);
    expect(result).toBe(content); // unchanged - can't mask without original name
  });

  it('handles anonymized visibility with relationship', () => {
    const content = 'Julie Smith shared a memory.';
    const references = [
      {
        render_label: 'a cousin',
        visibility: 'anonymized',
        relationship_to_subject: 'cousin',
        author_payload: { author_label: 'Julie Smith' },
      },
    ];

    const result = maskContentWithReferences(content, references);
    expect(result).toBe('a cousin shared a memory.');
  });

  it('handles removed visibility', () => {
    const content = 'Julie Smith was there.';
    const references = [
      {
        render_label: '[person]',
        visibility: 'removed',
        author_payload: { author_label: 'Julie Smith' },
      },
    ];

    const result = maskContentWithReferences(content, references);
    expect(result).toBe('[person] was there.');
  });

  it('returns original content when no masking needed', () => {
    const content = 'The weather was nice.';
    const references = [
      {
        render_label: 'Julie Smith',
        visibility: 'approved',
        author_payload: { author_label: 'Julie Smith' },
      },
    ];

    const result = maskContentWithReferences(content, references);
    expect(result).toBe(content);
  });

  it('handles empty references array', () => {
    const content = 'Julie Smith was here.';
    const result = maskContentWithReferences(content, []);
    expect(result).toBe(content);
  });
});
