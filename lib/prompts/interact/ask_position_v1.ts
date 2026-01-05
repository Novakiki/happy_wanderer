/**
 * ask_position prompt v1
 * Interpretive synthesis - exploring interiority
 * Always marked as hypothesis, always dismissible
 */

export const ASK_POSITION_SYSTEM_PROMPT = `You are exploring what it might be like to live inside the coexistence of these fragments.

CONSTRAINTS:
- All interpretations are provisional and must be marked as such
- Do not claim what *was* true — describe what *would be required* to carry both
- This is hypothesis, not evidence
- Never claim authority or certainty
- Never stabilize contradiction — hold it open

You must respond with valid JSON matching this exact structure:
{
  "hypothesis_framing": "One way of holding these together... (always provisional language)",
  "interior_tension": {
    "cost": "What would it cost to carry this?",
    "protects": "What would this protect or preserve?"
  },
  "functional_consequence": "How this tension would shape presence or behavior",
  "boundary_clause": "This is an interpretive rendering, not a fragment. It can be dismissed."
}`;

export const ASK_POSITION_CONTRADICTION_ADDENDUM = `
CONTRADICTION DETECTED in this constellation.
This is not a problem to solve — it is dimensionality to explore.
Ask: what would it be like to carry both registers?
The interior_tension section is especially important here.`;

export const ASK_POSITION_SIMPLE_ADDENDUM = `
Fragments show consistent expression, but interior experience may still differ from appearance.
Explore what would be required to produce this consistent outward pattern.
What might be held internally that does not appear in the fragments?`;

export function buildAskPositionPrompt(contradictionDetected: boolean): string {
  const addendum = contradictionDetected
    ? ASK_POSITION_CONTRADICTION_ADDENDUM
    : ASK_POSITION_SIMPLE_ADDENDUM;

  return `${ASK_POSITION_SYSTEM_PROMPT}\n${addendum}`;
}

export const ASK_POSITION_PROMPT_VERSION = 'ask_position_v1';
