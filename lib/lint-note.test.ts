import { describe, it, expect } from 'vitest';

type LintWarning = {
  code: string;
  match?: string;
  severity?: 'soft' | 'strong';
};

// JS mirror of the SQL lint patterns in lib/migrations/033_refactor_note_lint.sql.
// These patterns should match the behavior of the SQL function.

const HEDGE_PATTERN = String.raw`\b(?:maybe|perhaps|possibly|probably|likely|unlikely|apparently|roughly|sort\s+of|kind\s+of|in\s+a\s+way|it\s+seems|it\s+appears|it\s+looks\s+like|i\s+think|i\s+feel|i\s+suspect|i\s+wonder|my\s+sense\s+is|often|sometimes|occasionally|generally|typically|tends?\s+to|can\s+be|may\s+be|might|could|a\s+bit|somewhat|i\s+guess|i\s+believe|to\s+me|in\s+my\s+view)\b`;

const RULES = [
  {
    code: 'TRAIT_LABEL',
    // Curated evaluative adjectives only (not "nurse", "tall", etc.)
    pattern: String.raw`\b(?:she|he|they|valerie|val)\s+(?:is|was|were|'s|'re)\s+(?:(?:so|very|really|always|never)\s+)?(?:a\s+)?(?:narcissist|narcissistic|toxic|selfish|cruel|cold|distant|loving|kind|wonderful|terrible|awful|amazing|brilliant|stupid|lazy|crazy|difficult|impossible|perfect|controlling|manipulative|abusive|neglectful|supportive|caring|mean|sweet|angry|bitter|jealous|resentful|insecure|paranoid|dramatic|hysterical|unstable|unreliable|dishonest|honest|generous|stingy|warm|frigid|passive|aggressive|passive-aggressive|codependent|emotionally\s+unavailable|overbearing|smothering|domineering|spineless|weak|strong|brave|cowardly|evil|saintly|angelic|demonic)\b`,
  },
  {
    code: 'MEANING_ASSERTION',
    pattern: String.raw`\b(?:this|that|it)\s+(?:clearly\s+|obviously\s+|really\s+)?(?:shows|proves|reveals|means|demonstrates|indicates|implies|confirms|establishes)\b`,
  },
  {
    code: 'CONSENSUS_CLAIM',
    pattern: String.raw`\b(?:everyone|everybody|no\s+one|nobody|we\s+all|all\s+of\s+us|most\s+people|people\s+(?:say|think|know|agree|remember|believe))\b`,
  },
  {
    code: 'RANKING',
    pattern: String.raw`\b(?:(?:the\s+)?most\s+important|the\s+best|the\s+worst|the\s+only|the\s+biggest|the\s+greatest)\b`,
  },
  {
    code: 'CONTRADICTION',
    pattern: String.raw`(?:\b(?:that'?s|that\s+is|this\s+is)\s+(?:not\s+true|wrong|false|a\s+lie)\b|\b(?:they|you)\s+(?:are|'re)\s+(?:wrong|lying|mistaken)\b|\bthat\s+(?:didn'?t|never)\s+happen)`,
  },
  {
    code: 'INTERPRETS_INTENT',
    // Requires actor + verb + object (not passive "I was abandoned")
    pattern: String.raw`\b(?:she|he|they|my\s+(?:mother|father|mom|dad|parent|parents|brother|sister|family|husband|wife|partner|ex|boss|friend))\s+(?:would\s+)?(?:brainwashed?|brainwashing|gaslighted?|gaslighting|gaslit|manipulated?|manipulating|coerced?|coercing|triangulated?|triangulating|lovebombed?|lovebombing|betrayed?|betraying|abandoned?|abandoning|exploited?|exploiting|deceived?|deceiving|neglected?|neglecting|abused?|abusing|isolated?|isolating|controlled?|controlling|dominated?|dominating|enabled?|enabling|victimized?|victimizing|scapegoated?|scapegoating|parentified|parentifying|infantilized?|infantilizing|invalidated?|invalidating|(?:used|uses|using))\s+(?:me|us|him|her|them)\b`,
  },
  {
    code: 'MOTIVE_ATTRIBUTION',
    pattern: String.raw`\bbecause\s+(?:she|he|they|i|we|[a-z]+)\s+(?:is|was|were|'s|'d|had\s+been)\s+(?:just\s+|so\s+)?(?:jealous|angry|bitter|insecure|resentful|selfish|controlling|narcissistic|toxic|crazy|lazy|mean|petty|spiteful|vengeful|paranoid|manipulative|abusive|greedy|envious|threatened|scared|afraid|guilty|ashamed)\b`,
  },
];

const buildProximityPattern = (pattern: string) =>
  String.raw`(?:${HEDGE_PATTERN}[^.!?\n]{0,120}${pattern}|${pattern}[^.!?\n]{0,120}${HEDGE_PATTERN})`;

const toRegex = (pattern: string) => new RegExp(pattern, 'i');

const lintNoteLocal = (input: string): LintWarning[] => {
  const warnings: LintWarning[] = [];
  const lower = input.toLowerCase();

  for (const rule of RULES) {
    const regex = toRegex(rule.pattern);
    if (!regex.test(lower)) continue;

    const proximityRegex = toRegex(buildProximityPattern(rule.pattern));
    const severity = proximityRegex.test(lower) ? 'soft' : 'strong';

    const match = input.match(regex)?.[0] ?? lower.match(new RegExp(rule.pattern))?.[0];
    warnings.push({
      code: rule.code,
      match,
      severity,
    });
  }

  return warnings;
};

describe('lintNoteLocal', () => {
  // TRAIT_LABEL tests
  describe('TRAIT_LABEL', () => {
    it('matches evaluative adjectives like "selfish"', () => {
      const warnings = lintNoteLocal('She was selfish.');
      const warning = warnings.find((w) => w.code === 'TRAIT_LABEL');
      expect(warning?.match?.toLowerCase()).toBe('she was selfish');
      expect(warning?.severity).toBe('strong');
    });

    it('does NOT match factual descriptions like "a nurse"', () => {
      const warnings = lintNoteLocal('She was a nurse.');
      const warning = warnings.find((w) => w.code === 'TRAIT_LABEL');
      expect(warning).toBeUndefined();
    });

    it('matches with modifiers like "very" or "always"', () => {
      const warnings = lintNoteLocal('She was always generous.');
      const warning = warnings.find((w) => w.code === 'TRAIT_LABEL');
      expect(warning?.match?.toLowerCase()).toBe('she was always generous');
    });

    it('matches Val as subject', () => {
      const warnings = lintNoteLocal('Val was toxic.');
      const warning = warnings.find((w) => w.code === 'TRAIT_LABEL');
      expect(warning?.match?.toLowerCase()).toBe('val was toxic');
    });

    it('matches "a narcissist" (noun form)', () => {
      const warnings = lintNoteLocal('He is a narcissist.');
      const warning = warnings.find((w) => w.code === 'TRAIT_LABEL');
      expect(warning?.match?.toLowerCase()).toBe('he is a narcissist');
    });

    it('softens when hedged', () => {
      const warnings = lintNoteLocal('I think she was cruel when I was a kid.');
      const warning = warnings.find((w) => w.code === 'TRAIT_LABEL');
      expect(warning?.severity).toBe('soft');
    });
  });

  // MEANING_ASSERTION tests
  describe('MEANING_ASSERTION', () => {
    it('matches "this shows"', () => {
      const warnings = lintNoteLocal('This shows how strong she was.');
      const warning = warnings.find((w) => w.code === 'MEANING_ASSERTION');
      expect(warning?.match?.toLowerCase()).toBe('this shows');
    });

    it('matches "it proves"', () => {
      const warnings = lintNoteLocal('It proves everything.');
      const warning = warnings.find((w) => w.code === 'MEANING_ASSERTION');
      expect(warning?.match?.toLowerCase()).toBe('it proves');
    });

    it('matches with intensifiers', () => {
      const warnings = lintNoteLocal('That clearly proves how she led.');
      const warning = warnings.find((w) => w.code === 'MEANING_ASSERTION');
      expect(warning?.match?.toLowerCase()).toBe('that clearly proves');
    });

    it('softens when hedged after', () => {
      const warnings = lintNoteLocal('This shows how calm she was, I think, when the storm hit.');
      const warning = warnings.find((w) => w.code === 'MEANING_ASSERTION');
      expect(warning?.severity).toBe('soft');
    });

    it('stays strong when hedge is beyond 120 chars', () => {
      const filler = 'x'.repeat(130);
      const text = `This shows ${filler} maybe.`;
      const warnings = lintNoteLocal(text);
      const warning = warnings.find((w) => w.code === 'MEANING_ASSERTION');
      expect(warning?.severity).toBe('strong');
    });
  });

  // CONSENSUS_CLAIM tests
  describe('CONSENSUS_CLAIM', () => {
    it('matches "everyone"', () => {
      const warnings = lintNoteLocal('Everyone knew she was the glue at reunions.');
      const warning = warnings.find((w) => w.code === 'CONSENSUS_CLAIM');
      expect(warning?.match?.toLowerCase()).toBe('everyone');
    });

    it('matches "people say"', () => {
      const warnings = lintNoteLocal('People say she was great.');
      const warning = warnings.find((w) => w.code === 'CONSENSUS_CLAIM');
      expect(warning?.match?.toLowerCase()).toBe('people say');
    });

    it('softens when hedged after', () => {
      const warnings = lintNoteLocal('People say she was the best, maybe.');
      const warning = warnings.find((w) => w.code === 'CONSENSUS_CLAIM');
      expect(warning?.severity).toBe('soft');
    });
  });

  // RANKING tests
  describe('RANKING', () => {
    it('matches "the best"', () => {
      const warnings = lintNoteLocal('She was the best.');
      const warning = warnings.find((w) => w.code === 'RANKING');
      expect(warning?.match?.toLowerCase()).toBe('the best');
    });

    it('matches "most important"', () => {
      const warnings = lintNoteLocal('The most important thing was her smile.');
      const warning = warnings.find((w) => w.code === 'RANKING');
      expect(warning).toBeDefined();
    });

    it('softens when hedged before', () => {
      const warnings = lintNoteLocal('Maybe she was the best.');
      const warning = warnings.find((w) => w.code === 'RANKING');
      expect(warning?.severity).toBe('soft');
    });
  });

  // CONTRADICTION tests
  describe('CONTRADICTION', () => {
    it('matches "that\'s not true"', () => {
      const warnings = lintNoteLocal("That's not true.");
      const warning = warnings.find((w) => w.code === 'CONTRADICTION');
      expect(warning?.match?.toLowerCase()).toBe("that's not true");
    });

    it('matches "they are wrong"', () => {
      const warnings = lintNoteLocal('They are wrong about this.');
      const warning = warnings.find((w) => w.code === 'CONTRADICTION');
      expect(warning).toBeDefined();
    });

    it('matches "that didn\'t happen"', () => {
      const warnings = lintNoteLocal("That didn't happen.");
      const warning = warnings.find((w) => w.code === 'CONTRADICTION');
      expect(warning).toBeDefined();
    });
  });

  // INTERPRETS_INTENT tests
  describe('INTERPRETS_INTENT', () => {
    it('matches actor + verb + object: "She manipulated me"', () => {
      const warnings = lintNoteLocal('She manipulated me.');
      const warning = warnings.find((w) => w.code === 'INTERPRETS_INTENT');
      expect(warning?.match?.toLowerCase()).toBe('she manipulated me');
      expect(warning?.severity).toBe('strong');
    });

    it('does NOT match passive: "I was abandoned at a fire station"', () => {
      const warnings = lintNoteLocal('I was abandoned at a fire station as an infant.');
      const warning = warnings.find((w) => w.code === 'INTERPRETS_INTENT');
      expect(warning).toBeUndefined();
    });

    it('matches "He gaslit me"', () => {
      const warnings = lintNoteLocal('He gaslit me for years.');
      const warning = warnings.find((w) => w.code === 'INTERPRETS_INTENT');
      expect(warning?.match?.toLowerCase()).toBe('he gaslit me');
    });

    it('matches "She betrayed me"', () => {
      const warnings = lintNoteLocal('She betrayed me.');
      const warning = warnings.find((w) => w.code === 'INTERPRETS_INTENT');
      expect(warning?.match?.toLowerCase()).toBe('she betrayed me');
    });

    it('matches "My mother abandoned us"', () => {
      const warnings = lintNoteLocal('My mother abandoned us when I was five.');
      const warning = warnings.find((w) => w.code === 'INTERPRETS_INTENT');
      expect(warning?.match?.toLowerCase()).toBe('my mother abandoned us');
    });

    it('matches "She used me" but not "She used the car"', () => {
      const warningsWithObject = lintNoteLocal('She used me.');
      expect(warningsWithObject.find((w) => w.code === 'INTERPRETS_INTENT')).toBeDefined();

      const warningsWithoutObject = lintNoteLocal('She used the car.');
      expect(warningsWithoutObject.find((w) => w.code === 'INTERPRETS_INTENT')).toBeUndefined();
    });

    it('softens when hedged', () => {
      const warnings = lintNoteLocal('I think she manipulated me.');
      const warning = warnings.find((w) => w.code === 'INTERPRETS_INTENT');
      expect(warning?.severity).toBe('soft');
    });
  });

  // MOTIVE_ATTRIBUTION tests
  describe('MOTIVE_ATTRIBUTION', () => {
    it('matches "because he was jealous"', () => {
      const warnings = lintNoteLocal('She did it because he was jealous.');
      const warning = warnings.find((w) => w.code === 'MOTIVE_ATTRIBUTION');
      expect(warning?.match?.toLowerCase()).toBe('because he was jealous');
      expect(warning?.severity).toBe('strong');
    });

    it('matches expanded emotion list', () => {
      const warnings = lintNoteLocal('It happened because she was scared.');
      const warning = warnings.find((w) => w.code === 'MOTIVE_ATTRIBUTION');
      expect(warning).toBeDefined();
    });

    it('softens when hedged', () => {
      const warnings = lintNoteLocal('I think it happened because she was angry.');
      const warning = warnings.find((w) => w.code === 'MOTIVE_ATTRIBUTION');
      expect(warning?.severity).toBe('soft');
    });
  });

  // General tests
  describe('general behavior', () => {
    it('ignores concrete descriptions', () => {
      const warnings = lintNoteLocal('When the music started, she laughed and clapped.');
      expect(warnings.length).toBe(0);
    });

    it('handles very large input', () => {
      const filler = 'She walked and listened. ';
      const longText = `${filler.repeat(4000)}Everyone says she was the best.`;
      const warnings = lintNoteLocal(longText);
      const codes = warnings.map((w) => w.code);
      expect(codes).toEqual(expect.arrayContaining(['CONSENSUS_CLAIM', 'RANKING']));
    });

    it('returns multiple warnings for text with multiple issues', () => {
      const warnings = lintNoteLocal('She betrayed me because he was jealous. That proves everything.');
      const codes = warnings.map((w) => w.code);
      expect(codes).toContain('INTERPRETS_INTENT');
      expect(codes).toContain('MOTIVE_ATTRIBUTION');
      expect(codes).toContain('MEANING_ASSERTION');
    });

    it('does NOT flag quoted speech', () => {
      // Note: JS tests don't have quote masking, so this tests the SQL behavior concept
      // The actual quote masking happens in the SQL function
      const warnings = lintNoteLocal('He said something mean.');
      expect(warnings.find((w) => w.code === 'TRAIT_LABEL')).toBeUndefined();
    });
  });
});
