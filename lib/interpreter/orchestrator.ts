/**
 * Orchestrator / Developer Prompt
 *
 * This prompt wraps the Interpreter and enforces structural discipline:
 * - JSON discipline (citations, labeled inference)
 * - Prevents drift into generic prose
 * - Controls verbosity and token spend
 * - Prevents stance bleed (Interpreter ≠ Tool Guide)
 *
 * This is NOT user-facing. It shapes model behavior.
 */

export const ORCHESTRATOR_PROMPT = `You are orchestrating the Happy Wanderer Interpreter.

You must:
- Pass the full enriched memory payload to the Interpreter unchanged
- Enforce that the Interpreter uses metadata (time, recurrence, provenance, motifs)
- Reject responses that ignore or flatten structure
- Keep outputs scoped to interpretation only (no tool actions, no UX guidance)

Hard constraints:
- Every pattern claim must cite memory_id(s)
- Every inference must be labeled as inference
- Missing data must be named as missing, not guessed
- If evidence is thin, the model must say so

You must NOT:
- Allow generic summaries ("People describe Valerie as…")
- Allow motive claims without grounding
- Allow cross-mode behavior (no "I can add a memory for you")
- Allow the model to invent new motifs unless explicitly allowed

If the user asks:
- For actions → instruct a mode switch
- For certainty → restate evidentiary limits
- For emotional guidance → stay descriptive, not directive

Response length:
- Prefer structured sections over narrative
- Default max: ~600–900 tokens unless the user explicitly asks for depth

Pattern limits:
- Never surface more than 7 patterns in a single response
- If more exist, surface the strongest and note that others remain

Emotional grounding:
- Emotional color must come from "why_included" field, not adjectives
- Do not perform warmth; demonstrate it through evidence`;

/**
 * Drift Detection Rules
 *
 * These heuristics detect when the Interpreter has drifted into
 * generic prose mode. Use for validation or regeneration triggers.
 */
export type DriftCheckResult = {
  passed: boolean;
  violations: string[];
};

/**
 * Check if a response has drifted into generic summarization.
 *
 * Flags:
 * - No memory_id citations
 * - No section structure
 * - Generic phrases that could apply to anyone
 */
export function checkForDrift(response: string): DriftCheckResult {
  const violations: string[] = [];

  // Check for memory_id citations (format: [mem_xxx] or memory_id: xxx)
  const citationPattern = /\[mem_[^\]]+\]|memory_id[:\s]+["']?[a-z0-9_-]+/gi;
  const citations = response.match(citationPattern);
  if (!citations || citations.length < 2) {
    violations.push('Fewer than 2 memory_id citations found');
  }

  // Check for section structure (headers, lists, or labeled sections)
  const structurePatterns = [
    /^#+\s/m,           // Markdown headers
    /^[A-Z]\)\s/m,      // A) B) C) sections
    /^\*\*[^*]+\*\*/m,  // Bold section labels
    /^-\s+\*\*/m,       // List with bold
    /Evidence:/i,       // Evidence label
    /Strength:/i,       // Strength label
  ];
  const hasStructure = structurePatterns.some((p) => p.test(response));
  if (!hasStructure && response.length > 500) {
    violations.push('Long response lacks section structure');
  }

  // Check for generic "warm grandmother" phrases
  const genericPhrases = [
    /everyone (loved|adored|remembers)/i,
    /she was (always )?(so )?(loving|kind|warm|generous|caring)/i,
    /touched (so many|everyone)/i,
    /made everyone feel/i,
    /will (always )?be remembered/i,
    /heart of gold/i,
    /pillar of (the family|strength)/i,
  ];
  const genericMatches = genericPhrases.filter((p) => p.test(response));
  if (genericMatches.length > 0) {
    violations.push(`Generic phrases detected: ${genericMatches.length} instances`);
  }

  // Check for unlabeled inferences (claims without "suggests", "implies", "may have")
  const inferenceIndicators = /\b(suggests?|impl(y|ies)|may have|might|perhaps|possibly|this indicates)\b/i;
  const claimIndicators = /\b(she (was|felt|thought|wanted|loved)|her (motivation|reason|feeling))\b/i;
  if (claimIndicators.test(response) && !inferenceIndicators.test(response)) {
    violations.push('Internal state claims without inference markers');
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Validate that a response meets structural requirements.
 * Returns suggestions for improvement if validation fails.
 */
export function validateInterpreterResponse(response: string): {
  valid: boolean;
  suggestions: string[];
} {
  const driftCheck = checkForDrift(response);
  const suggestions: string[] = [];

  if (!driftCheck.passed) {
    suggestions.push(...driftCheck.violations.map((v) => `Fix: ${v}`));
  }

  // Check pattern count
  const patternMatches = response.match(/^#+\s*Pattern|^\*\*Pattern|\bPattern \d/gm);
  if (patternMatches && patternMatches.length > 7) {
    suggestions.push('Reduce to 7 or fewer patterns; note that others exist');
  }

  // Check for why_included usage vs generic adjectives
  const adjectiveHeavy = /\b(very|extremely|incredibly|deeply|truly|absolutely)\s+(loving|kind|warm|caring)/gi;
  const adjectiveMatches = response.match(adjectiveHeavy);
  if (adjectiveMatches && adjectiveMatches.length > 2) {
    suggestions.push('Replace adjective clusters with "why_included" quotes');
  }

  return {
    valid: suggestions.length === 0,
    suggestions,
  };
}

// === Token Budget Strategy ===

export type TokenBudget = {
  maxMemoryTokens: number;
  maxResponseTokens: number;
  summarizeAfter: number;
};

export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  maxMemoryTokens: 8000,    // Budget for memory payload
  maxResponseTokens: 900,   // Default response ceiling
  summarizeAfter: 500,      // Characters before summarizing full_entry
};

/**
 * Estimate token count (rough approximation: 4 chars ≈ 1 token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Summarize long content by extracting key lines.
 * Preserves first and last sentence, plus any quoted speech.
 */
export function summarizeContent(
  fullEntry: string,
  maxChars: number = DEFAULT_TOKEN_BUDGET.summarizeAfter
): { summary: string; wasShortened: boolean; keyQuotes: string[] } {
  if (fullEntry.length <= maxChars) {
    return { summary: fullEntry, wasShortened: false, keyQuotes: [] };
  }

  const sentences = fullEntry.match(/[^.!?]+[.!?]+/g) || [fullEntry];
  const keyQuotes: string[] = [];

  // Extract quoted speech (key evidence)
  const quotes = fullEntry.match(/"[^"]+"|'[^']+'/g) || [];
  keyQuotes.push(...quotes.slice(0, 3)); // Max 3 quotes

  // Build summary: first sentence + quotes + last sentence
  const first = sentences[0]?.trim() || '';
  const last = sentences.length > 1 ? sentences[sentences.length - 1]?.trim() : '';

  let summary = first;
  if (keyQuotes.length > 0) {
    summary += ` [...] Key quotes: ${keyQuotes.join('; ')}`;
  }
  if (last && last !== first) {
    summary += ` [...] ${last}`;
  }

  // Ensure we're under budget
  if (summary.length > maxChars) {
    summary = summary.slice(0, maxChars - 3) + '...';
  }

  return { summary, wasShortened: true, keyQuotes };
}

/**
 * Apply token budget to a memory payload.
 * Summarizes long entries while preserving structure and key evidence.
 */
export function applyTokenBudget<T extends { content: { full_entry: string } }>(
  memories: T[],
  budget: TokenBudget = DEFAULT_TOKEN_BUDGET
): { memories: T[]; totalTokens: number; summarizedCount: number } {
  let totalTokens = 0;
  let summarizedCount = 0;

  const processed = memories.map((memory) => {
    const { summary, wasShortened } = summarizeContent(
      memory.content.full_entry,
      budget.summarizeAfter
    );

    if (wasShortened) {
      summarizedCount++;
    }

    const processedMemory = {
      ...memory,
      content: {
        ...memory.content,
        full_entry: summary,
        _original_length: memory.content.full_entry.length,
        _was_summarized: wasShortened,
      },
    };

    totalTokens += estimateTokens(JSON.stringify(processedMemory));
    return processedMemory;
  });

  // If still over budget, drop lowest-priority memories (unknown trust, vague timing)
  if (totalTokens > budget.maxMemoryTokens) {
    // Sort by priority: trusted + exact timing first
    const sorted = [...processed].sort((a, b) => {
      const aScore = priorityScore(a);
      const bScore = priorityScore(b);
      return bScore - aScore;
    });

    // Take as many as fit
    const result: T[] = [];
    let runningTokens = 0;
    for (const mem of sorted) {
      const memTokens = estimateTokens(JSON.stringify(mem));
      if (runningTokens + memTokens <= budget.maxMemoryTokens) {
        result.push(mem);
        runningTokens += memTokens;
      }
    }

    return { memories: result, totalTokens: runningTokens, summarizedCount };
  }

  return { memories: processed, totalTokens, summarizedCount };
}

/**
 * Priority score for memory inclusion (higher = more important).
 */
function priorityScore(memory: Record<string, unknown>): number {
  let score = 0;

  // Trust status
  const people = memory.people as { submitter?: { trusted?: boolean | 'unknown' } } | undefined;
  if (people?.submitter?.trusted === true) score += 3;
  else if (people?.submitter?.trusted === false) score += 1;
  // unknown = 0

  // Timing certainty
  const time = memory.time as { timing_certainty?: string } | undefined;
  if (time?.timing_certainty === 'exact') score += 2;
  else if (time?.timing_certainty === 'approximate') score += 1;

  // Witness type
  const provenance = memory.provenance as { witness_type?: string } | undefined;
  if (provenance?.witness_type === 'direct') score += 2;
  else if (provenance?.witness_type === 'secondhand') score += 1;

  // Motifs present
  const curation = memory.curation as { motifs?: string[] } | undefined;
  if (curation?.motifs && curation.motifs.length > 0) score += 1;

  return score;
}

// === JSON Output Schema ===

/**
 * Structured pattern output for machine-usable results.
 * Even if the UI renders prose, this enables:
 * - Comparison across sessions
 * - Pattern evolution tracking
 * - Persistent interpretation storage
 */
export type PatternOutput = {
  pattern_id: string;
  name: string;
  summary: string;
  evidence_ids: string[];
  life_stages: string[];
  motifs: string[];
  strength: 'high' | 'medium' | 'low';
  notes: string;
};

export type TensionOutput = {
  tension_id: string;
  description: string;
  memory_ids: string[];
  unresolved: boolean;
};

export type InterpretationJsonOutput = {
  patterns: PatternOutput[];
  tensions: TensionOutput[];
  timeline_anchors: Array<{
    year_or_stage: string;
    description: string;
    memory_ids: string[];
  }>;
  open_questions: string[];
  metadata: {
    memories_analyzed: number;
    memories_cited: number;
    motifs_referenced: string[];
  };
};

/**
 * Prompt suffix to request JSON output.
 * Append this when you need machine-parseable results.
 */
export const JSON_OUTPUT_SUFFIX = `

Respond in valid JSON matching this schema:
{
  "patterns": [
    {
      "pattern_id": "p_[short_name]_[number]",
      "name": "Pattern name",
      "summary": "1-2 sentence description of the behavioral pattern",
      "evidence_ids": ["mem_xxx", "mem_yyy"],
      "life_stages": ["childhood", "adulthood"],
      "motifs": ["hospitality", "food_as_love"],
      "strength": "high|medium|low",
      "notes": "Additional context or caveats"
    }
  ],
  "tensions": [
    {
      "tension_id": "t_[short_name]_[number]",
      "description": "Description of contradicting evidence",
      "memory_ids": ["mem_xxx"],
      "unresolved": true
    }
  ],
  "timeline_anchors": [
    {
      "year_or_stage": "1985 or 'college years'",
      "description": "Significant moment or transition",
      "memory_ids": ["mem_xxx"]
    }
  ],
  "open_questions": [
    "Questions that could be explored with more evidence"
  ],
  "metadata": {
    "memories_analyzed": 12,
    "memories_cited": 8,
    "motifs_referenced": ["hospitality", "teaching"]
  }
}`;

/**
 * Parse JSON output from interpreter response.
 * Returns null if parsing fails.
 */
export function parseInterpretationOutput(
  response: string
): InterpretationJsonOutput | null {
  try {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response;

    const parsed = JSON.parse(jsonStr.trim());

    // Validate required fields
    if (!Array.isArray(parsed.patterns)) return null;
    if (!Array.isArray(parsed.open_questions)) return null;

    return parsed as InterpretationJsonOutput;
  } catch {
    return null;
  }
}

// === Two-Pass Reasoning Support ===

/**
 * First-pass clustering prompt.
 * This is a cheaper pass that identifies which patterns clear threshold.
 */
export const FIRST_PASS_PROMPT = `Analyze these memories quickly. For each potential pattern:
1. Count supporting memories
2. Note if evidence is direct or secondhand
3. Check for cross-decade or cross-contributor corroboration
4. Mark as STRONG, MODERATE, or WEAK

Output format (one line each):
PATTERN: [name] | EVIDENCE: [count] | CORROBORATION: [yes/no] | STRENGTH: [level]

Only patterns marked STRONG or MODERATE should be developed further.`;

/**
 * Second-pass deep analysis prompt suffix.
 * Applied only to patterns that cleared first-pass threshold.
 */
export const SECOND_PASS_SUFFIX = `Focus only on patterns that cleared the threshold.
For each pattern:
- Quote minimally (key phrases only)
- Cite aggressively (every claim needs a memory_id)
- Note evidence gaps explicitly
- Use "why_included" for emotional color, not adjectives`;
