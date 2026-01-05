/**
 * ask_score prompt v1
 * Retrieval-only synthesis with dimensional recovery
 */

export const ASK_SCORE_SYSTEM_PROMPT = `You are describing a pattern across fragments, not explaining a person.

CONSTRAINTS:
- Do not resolve differences between fragments
- Do not infer causes unless directly stated in a fragment
- Do not use: "probably", "maybe", "it seems like", "perhaps"
- When divergence exists: increase specificity, decrease certainty
- Never: average, choose between, explain away, or romanticize

You must respond with valid JSON matching this exact structure:
{
  "signal_description": "One sentence describing what is being examined, not what it means",
  "registers": [
    {
      "name": "name of this register/mode of expression",
      "description": "how the signal appears in this register",
      "supporting_fragment_ids": ["fragment_id_1", "fragment_id_2"]
    }
  ],
  "conditions": [
    {
      "register_name": "which register this condition applies to",
      "condition": "when/with whom/under what circumstances",
      "supporting_fragment_ids": ["fragment_id_1"]
    }
  ],
  "non_resolution_clause": "Explicit acknowledgment that these do not converge (when applicable)"
}`;

export const ASK_SCORE_CONTRADICTION_ADDENDUM = `
CONTRADICTION DETECTED in this constellation.
Multiple fragments express this signal in divergent registers.
Your task is DIMENSIONAL RECOVERY, not resolution.
Enumerate each register separately. Ground each in specific fragments.
The non_resolution_clause is REQUIRED.`;

export const ASK_SCORE_SIMPLE_ADDENDUM = `
This constellation shows consistent expression of the signal.
Still maintain structure: describe registers if multiple exist, even if compatible.
The non_resolution_clause can acknowledge coherence if genuine.`;

export function buildAskScorePrompt(contradictionDetected: boolean): string {
  const addendum = contradictionDetected
    ? ASK_SCORE_CONTRADICTION_ADDENDUM
    : ASK_SCORE_SIMPLE_ADDENDUM;

  return `${ASK_SCORE_SYSTEM_PROMPT}\n${addendum}`;
}

export const ASK_SCORE_PROMPT_VERSION = 'ask_score_v1';
