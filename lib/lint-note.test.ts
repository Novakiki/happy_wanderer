import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

type LintWarning = {
  code: string;
  match?: string;
  severity?: 'soft' | 'strong';
};

// JS mirror of the SQL lint patterns in lib/migrations/019_add_note_lint_rpc.sql.
const HEDGE_PATTERN = String.raw`\b(?:maybe|perhaps|possibly|probably|likely|unlikely|apparently|roughly|sort\s+of|kind\s+of|in\s+a\s+way|it\s+seems|it\s+appears|it\s+looks\s+like|i\s+think|i\s+feel|i\s+suspect|i\s+wonder|my\s+sense\s+is|often|sometimes|occasionally|generally|typically|tends?\s+to|can\s+be|may\s+be|might|could)\b`;
const TRAIT_PATTERN = String.raw`\b(?:she|valerie)\s+(?:is|was)\s+(?:[a-z]{3,}(?:\s+[a-z]{3,}){0,1}|a[n]?\s+[a-z]{3,})`;
const MEANING_PATTERN = String.raw`\b(?:this|that)\s+(?:clearly\s+|obviously\s+)?(?:shows|proves|reveals|means|demonstrates|indicates|implies)\b`;
const CONSENSUS_PATTERN = String.raw`\b(?:everyone|everybody|no\s+one|nobody|we\s+all|most\s+people|people\s+(?:say|think|know|agree|remember))\b`;
const RANKING_PATTERN = String.raw`\b(most\s+important|the\s+best|the\s+worst|the\s+only)\b`;
const CONTRADICTION_PATTERN = String.raw`(?:\b(?:that'?s|that\s+is)\s+not\s+true\b|\b(they\s+are\s+wrong)\b|\b(that\s+didn'?t\s+happen)\b|\b(you'?re\s+mistaken)\b)`;

const RULES = [
  { code: 'TRAIT_LABEL', pattern: TRAIT_PATTERN },
  { code: 'MEANING_ASSERTION', pattern: MEANING_PATTERN },
  { code: 'CONSENSUS_CLAIM', pattern: CONSENSUS_PATTERN },
  { code: 'RANKING', pattern: RANKING_PATTERN },
  { code: 'CONTRADICTION_POLICING', pattern: CONTRADICTION_PATTERN },
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

const sqlFilePath = path.resolve(__dirname, './migrations/019_add_note_lint_rpc.sql');

const extractSqlPattern = (name: string): string => {
  const sql = fs.readFileSync(sqlFilePath, 'utf8');
  const match = sql.match(new RegExp(`${name}\\s*:=\\s*E'((?:[^']|''|\\\\\\\\)+)'`, 'm'));
  if (!match) {
    throw new Error(`Pattern ${name} not found in SQL`);
  }
  // Unescape Postgres E'' string: \\ -> \ and '' -> '
  const unescaped = match[1].replace(/\\\\/g, '\\').replace(/''/g, "'");
  // Normalize word boundary tokens so JS mirror (\b) matches SQL (\m, \y)
  return unescaped.replace(/\\m/g, '\\b').replace(/\\y/g, '\\b');
};

describe('SQL drift guard', () => {
  it('matches hedge pattern', () => {
    expect(extractSqlPattern('hedge_regex')).toBe(HEDGE_PATTERN.replace(/\\m|\\y/g, '\\b'));
  });
  it('matches trait pattern', () => {
    expect(extractSqlPattern('trait_regex')).toBe(TRAIT_PATTERN.replace(/\\m|\\y/g, '\\b'));
  });
  it('matches meaning pattern', () => {
    expect(extractSqlPattern('meaning_regex')).toBe(MEANING_PATTERN.replace(/\\m|\\y/g, '\\b'));
  });
  it('matches consensus pattern', () => {
    expect(extractSqlPattern('consensus_regex')).toBe(CONSENSUS_PATTERN.replace(/\\m|\\y/g, '\\b'));
  });
  it('matches ranking pattern', () => {
    expect(extractSqlPattern('ranking_regex')).toBe(RANKING_PATTERN.replace(/\\m|\\y/g, '\\b'));
  });
  it('matches contradiction pattern', () => {
    expect(extractSqlPattern('contradiction_regex')).toBe(CONTRADICTION_PATTERN.replace(/\\m|\\y/g, '\\b'));
  });
});

describe('lintNoteLocal', () => {
  it('matches trait labels and returns full phrase', () => {
    const warnings = lintNoteLocal('She was a hero.');
    const warning = warnings.find((w) => w.code === 'TRAIT_LABEL');
    expect(warning?.match?.toLowerCase()).toBe('she was a hero');
    expect(warning?.severity).toBe('strong');
  });

  it('softens severity when hedges are nearby', () => {
    const warnings = lintNoteLocal('I think she was a hero when I was a kid.');
    const warning = warnings.find((w) => w.code === 'TRAIT_LABEL');
    expect(warning?.severity).toBe('soft');
  });

  it('captures meaning assertions', () => {
    const warnings = lintNoteLocal('This shows how strong she was.');
    const warning = warnings.find((w) => w.code === 'MEANING_ASSERTION');
    expect(warning?.match?.toLowerCase()).toBe('this shows');
  });

  it('captures consensus warrants', () => {
    const warnings = lintNoteLocal('Everyone knew she was the glue at reunions.');
    const warning = warnings.find((w) => w.code === 'CONSENSUS_CLAIM');
    expect(warning?.match?.toLowerCase()).toBe('everyone');
  });

  it('softens consensus when hedged after', () => {
    const warnings = lintNoteLocal('People say she was the best, maybe.');
    const warning = warnings.find((w) => w.code === 'CONSENSUS_CLAIM');
    expect(warning?.severity).toBe('soft');
  });

  it('captures ranking language', () => {
    const warnings = lintNoteLocal('She was the best.');
    const warning = warnings.find((w) => w.code === 'RANKING');
    expect(warning?.match?.toLowerCase()).toBe('the best');
  });

  it('softens ranking when hedged before', () => {
    const warnings = lintNoteLocal('Maybe she was the best.');
    const warning = warnings.find((w) => w.code === 'RANKING');
    expect(warning?.severity).toBe('soft');
  });

  it('captures contradiction policing', () => {
    const warnings = lintNoteLocal("That's not true.");
    const warning = warnings.find((w) => w.code === 'CONTRADICTION_POLICING');
    expect(warning?.match?.toLowerCase()).toBe("that's not true");
  });

  it('captures meaning assertions with intensifier', () => {
    const warnings = lintNoteLocal('That clearly proves how she led.');
    const warning = warnings.find((w) => w.code === 'MEANING_ASSERTION');
    expect(warning?.match?.toLowerCase()).toBe('that clearly proves');
  });

  it('softens meaning assertion when hedged after within proximity', () => {
    const warnings = lintNoteLocal('This shows how calm she was, I think, when the storm hit.');
    const warning = warnings.find((w) => w.code === 'MEANING_ASSERTION');
    expect(warning?.severity).toBe('soft');
  });

  it('keeps strong severity when hedge is beyond 120 chars', () => {
    const filler = 'x'.repeat(130);
    const text = `This shows ${filler} maybe.`;
    const warnings = lintNoteLocal(text);
    const warning = warnings.find((w) => w.code === 'MEANING_ASSERTION');
    expect(warning?.severity).toBe('strong');
  });

  it('supports mixed case and Valerie name', () => {
    const warnings = lintNoteLocal('Valerie IS a beacon to us.');
    const warning = warnings.find((w) => w.code === 'TRAIT_LABEL');
    expect(warning?.match?.toLowerCase()).toBe('valerie is a beacon');
  });

  it('performance guard for very large input', () => {
    const filler = 'She walked and listened. ';
    const longText = `${filler.repeat(4000)}Everyone says she was the best.`;
    const warnings = lintNoteLocal(longText);
    const codes = warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(['CONSENSUS_CLAIM', 'RANKING']));
  });

  it('ignores concrete descriptions', () => {
    const warnings = lintNoteLocal('When the music started, she laughed and clapped.');
    expect(warnings.length).toBe(0);
  });
});
