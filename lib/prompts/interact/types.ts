/**
 * Interact route types
 * Signal-bound synthesis with structured output
 */

// Request types
export type InteractMode = 'ask_score' | 'ask_position';

export interface InteractRequest {
  signal_id: string;
  mode: InteractMode;
  query?: string; // optional focus lens
}

// Output schemas (JSON, not markdown)

export interface AskScoreOutput {
  signal_description: string;
  registers: Array<{
    name: string;
    description: string;
    supporting_fragment_ids: string[];
  }>;
  conditions: Array<{
    register_name: string;
    condition: string; // when/with whom
    supporting_fragment_ids: string[];
  }>;
  non_resolution_clause: string;
}

export interface AskPositionOutput {
  hypothesis_framing: string;
  interior_tension: {
    cost: string;
    protects: string;
  };
  functional_consequence: string;
  boundary_clause: string;
}

// Response metadata

export interface LinkStats {
  expresses: number;
  amplifies: number;
  complicates: number;
  legibility_effects: Record<string, number>;
}

export interface InteractMetadata {
  contradiction_detected: boolean;
  registers_found: string[];
  sources: string[]; // fragment ids used
  link_stats: LinkStats;
  prompt_version: string;
  needs_review?: boolean; // if leakage lint flagged
}

export interface InteractResponse {
  sections: AskScoreOutput | AskPositionOutput;
  metadata: InteractMetadata;
}

// Prompt selection matrix
export type PromptKey =
  | 'ask_score_contradiction'
  | 'ask_score_simple'
  | 'ask_position_contradiction'
  | 'ask_position_simple'
  | 'empty_signal';

export interface PromptContext {
  mode: InteractMode;
  contradiction_detected: boolean;
  empty_signal: boolean;
}

export function selectPromptKey(ctx: PromptContext): PromptKey {
  if (ctx.empty_signal) return 'empty_signal';

  if (ctx.mode === 'ask_score') {
    return ctx.contradiction_detected ? 'ask_score_contradiction' : 'ask_score_simple';
  }

  return ctx.contradiction_detected ? 'ask_position_contradiction' : 'ask_position_simple';
}

// Leakage patterns to detect
export const LEAKAGE_PATTERNS = {
  causal_insertion: /\b(because|due to|so that|in order to|as a result)\b/i,
  romanticizing: /\b(strength|complexity|beautifully|rich|profound|deep)\b/i,
  averaging: /\b(somewhat|both .+ and .+|balanced|mixed)\b/i,
  arc_imposition: /\b(over time|eventually|became|grew to|learned to)\b/i,
} as const;

export type LeakageType = keyof typeof LEAKAGE_PATTERNS;

export interface LeakageScan {
  flagged: boolean;
  types: LeakageType[];
  matches: Array<{ type: LeakageType; match: string }>;
}

export function scanForLeakage(text: string): LeakageScan {
  const matches: LeakageScan['matches'] = [];

  for (const [type, pattern] of Object.entries(LEAKAGE_PATTERNS)) {
    const match = text.match(pattern);
    if (match) {
      matches.push({ type: type as LeakageType, match: match[0] });
    }
  }

  return {
    flagged: matches.length > 0,
    types: matches.map(m => m.type),
    matches,
  };
}
