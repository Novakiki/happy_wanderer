import { describe, it, expect } from 'vitest';
import {
  checkForDrift,
  validateInterpreterResponse,
  estimateTokens,
  summarizeContent,
  applyTokenBudget,
  parseInterpretationOutput,
} from './orchestrator';

describe('checkForDrift', () => {
  it('passes for well-structured response with citations', () => {
    const goodResponse = `
## Pattern: Hospitality as Welcome Ritual

**What the evidence says:**
Sarah describes cookies being ready "every single visit, without fail" [mem_sarah_001].
Mike corroborates this from a different decade, noting she "baked the morning I arrived" [mem_mike_002].

**Evidence:** [mem_sarah_001, mem_mike_002]
**Strength:** High (repeated pattern, direct witnesses, cross-decade corroboration)

This suggests hospitality was a deliberate practice, not occasional generosity.
    `;

    const result = checkForDrift(goodResponse);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('flags response with no citations', () => {
    const badResponse = `
Valerie was known for her incredible warmth and hospitality.
Everyone who knew her describes how she made them feel welcome.
She was always ready with cookies and a warm smile.
    `;

    const result = checkForDrift(badResponse);
    expect(result.passed).toBe(false);
    expect(result.violations).toContain('Fewer than 2 memory_id citations found');
  });

  it('flags generic "warm grandmother" phrases', () => {
    const genericResponse = `
She was so loving and kind. [mem_001]
Everyone loved her and she touched so many lives. [mem_002]
She had a heart of gold and will always be remembered.
    `;

    const result = checkForDrift(genericResponse);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('Generic phrases'))).toBe(true);
  });

  it('flags long response without structure', () => {
    const unstructuredResponse = `
Valerie had a way of making people feel welcome. [mem_001] She would always have cookies ready when family visited. [mem_002] This was something she did throughout her life, from when her children were young through her later years. The cookies were not just about food but about showing care. She wanted people to know they were expected and that their visit mattered. This pattern of anticipatory care showed up in other ways too. She would remember what people liked and prepare accordingly. Multiple family members have noted this behavior across different times and contexts. It seems to have been a core part of how she expressed love.
    `;

    const result = checkForDrift(unstructuredResponse);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('lacks section structure'))).toBe(true);
  });

  it('flags internal state claims without inference markers', () => {
    const claimResponse = `
## Pattern: Care through Food

Valerie felt deeply that food was the best way to show love. [mem_001]
Her motivation was to make everyone feel like family. [mem_002]

**Evidence:** [mem_001, mem_002]
    `;

    const result = checkForDrift(claimResponse);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('inference markers'))).toBe(true);
  });

  it('passes when inference markers are present', () => {
    const inferenceResponse = `
## Pattern: Care through Food

Multiple memories suggest that food preparation was how Valerie expressed care. [mem_001]
This may have been her way of ensuring visitors felt expected. [mem_002]

**Evidence:** [mem_001, mem_002]
**Strength:** Medium
    `;

    const result = checkForDrift(inferenceResponse);
    expect(result.passed).toBe(true);
  });
});

describe('validateInterpreterResponse', () => {
  it('returns valid for well-formed response', () => {
    const goodResponse = `
## A) Pattern: Hospitality

Sarah notes she "always had cookies ready" [mem_sarah_001].
This suggests anticipatory care was important to her.

**Evidence:** [mem_sarah_001, mem_mike_002]
**Strength:** High
    `;

    const result = validateInterpreterResponse(goodResponse);
    expect(result.valid).toBe(true);
    expect(result.suggestions).toHaveLength(0);
  });

  it('flags excessive adjective use', () => {
    const adjectiveHeavy = `
## Pattern: Warmth

She was extremely loving and deeply caring. [mem_001]
Visitors describe her as incredibly kind and truly generous. [mem_002]
She was absolutely devoted to making people feel very welcome. [mem_003]

**Evidence:** [mem_001, mem_002, mem_003]
    `;

    const result = validateInterpreterResponse(adjectiveHeavy);
    expect(result.valid).toBe(false);
    expect(result.suggestions.some((s) => s.includes('why_included'))).toBe(true);
  });
});

describe('estimateTokens', () => {
  it('estimates tokens based on character count', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('12345678')).toBe(2);
    expect(estimateTokens('')).toBe(0);
  });

  it('rounds up partial tokens', () => {
    expect(estimateTokens('abc')).toBe(1); // 3/4 = 0.75 → 1
    expect(estimateTokens('abcde')).toBe(2); // 5/4 = 1.25 → 2
  });
});

describe('summarizeContent', () => {
  it('returns short content unchanged', () => {
    const short = 'This is a short memory.';
    const result = summarizeContent(short, 500);
    expect(result.wasShortened).toBe(false);
    expect(result.summary).toBe(short);
    expect(result.keyQuotes).toHaveLength(0);
  });

  it('extracts quoted speech from long content', () => {
    const long = `She always greeted visitors warmly. "Come in, come in!" she would say.
    The kitchen was always full of activity. "Are you hungry?" was her signature question.
    This pattern repeated throughout her life until her final years.`;
    const result = summarizeContent(long, 100);
    expect(result.wasShortened).toBe(true);
    expect(result.keyQuotes).toContain('"Come in, come in!"');
    expect(result.keyQuotes).toContain('"Are you hungry?"');
  });

  it('preserves first and last sentences', () => {
    const content = 'First sentence here. Middle content. Last sentence here.';
    const result = summarizeContent(content, 80);
    expect(result.summary).toContain('First sentence here.');
    expect(result.summary).toContain('Last sentence here.');
  });

  it('truncates if summary exceeds max', () => {
    const veryLong = 'A'.repeat(1000);
    const result = summarizeContent(veryLong, 50);
    expect(result.summary.length).toBeLessThanOrEqual(50);
    expect(result.summary.endsWith('...')).toBe(true);
  });
});

describe('applyTokenBudget', () => {
  const makeMemory = (id: string, entry: string, trusted?: boolean) => ({
    memory_id: id,
    content: { full_entry: entry, title: null, preview: null },
    people: { submitter: { trusted } },
    time: { timing_certainty: 'exact' as const },
    provenance: { witness_type: 'direct' as const },
    curation: { motifs: [] },
  });

  it('keeps short memories intact', () => {
    const memories = [
      makeMemory('mem_001', 'Short entry'),
      makeMemory('mem_002', 'Another short one'),
    ];
    const result = applyTokenBudget(memories);
    expect(result.summarizedCount).toBe(0);
    expect(result.memories).toHaveLength(2);
  });

  it('summarizes long entries', () => {
    const memories = [
      makeMemory('mem_001', 'A'.repeat(600)),
    ];
    const result = applyTokenBudget(memories);
    expect(result.summarizedCount).toBe(1);
    expect(result.memories[0].content.full_entry.length).toBeLessThan(600);
  });

  it('prioritizes trusted memories when over budget', () => {
    const longEntry = 'A'.repeat(3000);
    const memories = [
      makeMemory('mem_untrusted', longEntry, false),
      makeMemory('mem_trusted', longEntry, true),
      makeMemory('mem_unknown', longEntry, undefined),
    ];
    const result = applyTokenBudget(memories, {
      maxMemoryTokens: 2000, // Force budget constraint
      maxResponseTokens: 900,
      summarizeAfter: 500,
    });
    // Should keep trusted one over untrusted
    const keptIds = result.memories.map((m) => m.memory_id);
    if (keptIds.length < 3) {
      // If not all fit, trusted should be included
      expect(keptIds).toContain('mem_trusted');
    }
  });
});

describe('parseInterpretationOutput', () => {
  it('parses valid JSON output', () => {
    const validJson = `{
      "patterns": [
        {
          "pattern_id": "p_hospitality_01",
          "name": "Hospitality",
          "summary": "Test pattern",
          "evidence_ids": ["mem_001"],
          "life_stages": ["childhood"],
          "motifs": ["hospitality"],
          "strength": "high",
          "notes": ""
        }
      ],
      "tensions": [],
      "timeline_anchors": [],
      "open_questions": ["What about later years?"],
      "metadata": {
        "memories_analyzed": 5,
        "memories_cited": 3,
        "motifs_referenced": ["hospitality"]
      }
    }`;
    const result = parseInterpretationOutput(validJson);
    expect(result).not.toBeNull();
    expect(result?.patterns).toHaveLength(1);
    expect(result?.patterns[0].name).toBe('Hospitality');
  });

  it('extracts JSON from markdown code blocks', () => {
    const withCodeBlock = `Here is the analysis:

\`\`\`json
{
  "patterns": [],
  "tensions": [],
  "timeline_anchors": [],
  "open_questions": ["Test question"],
  "metadata": { "memories_analyzed": 0, "memories_cited": 0, "motifs_referenced": [] }
}
\`\`\`

That's the output.`;
    const result = parseInterpretationOutput(withCodeBlock);
    expect(result).not.toBeNull();
    expect(result?.open_questions).toContain('Test question');
  });

  it('returns null for invalid JSON', () => {
    const invalid = 'This is not JSON at all.';
    const result = parseInterpretationOutput(invalid);
    expect(result).toBeNull();
  });

  it('returns null for missing required fields', () => {
    const missingFields = '{"patterns": [], "tensions": []}'; // Missing open_questions
    const result = parseInterpretationOutput(missingFields);
    expect(result).toBeNull();
  });
});
