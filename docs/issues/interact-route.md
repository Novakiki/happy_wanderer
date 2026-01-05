# Interact Route: Signal-bound Synthesis API

## Summary

Build `POST /api/interact` — a route that enables signal-bound inquiry with structured synthesis, contradiction handling, and anti-leakage guardrails.

## Context

Interact is not a chat interface. It's **guided re-attunement through inquiry**. Users enter through a signal and receive synthesis that:
- Surfaces patterns across fragments without narrativizing
- Holds contradiction as dimensionality, not error
- Increases specificity when certainty decreases

## Route Shape

```
POST /api/interact

Request:
{
  signal_id: string
  mode: 'ask_score' | 'ask_position'
  query?: string  // optional focus lens
}

Response:
{
  sections: AskScoreOutput | AskPositionOutput
  metadata: {
    contradiction_detected: boolean
    registers_found: string[]
    sources: string[]  // fragment ids used
    link_stats: {
      expresses: number
      amplifies: number
      complicates: number
      legibility_effects: Record<string, number>
    }
    prompt_version: string
    needs_review?: boolean  // if leakage lint flagged
  }
}
```

## Output Schemas (JSON, not markdown)

### ask_score mode
```typescript
interface AskScoreOutput {
  signal_description: string
  registers: Array<{
    name: string
    description: string
    supporting_fragment_ids: string[]
  }>
  conditions: Array<{
    register_name: string
    condition: string  // when/with whom
    supporting_fragment_ids: string[]
  }>
  non_resolution_clause: string
}
```

### ask_position mode
```typescript
interface AskPositionOutput {
  hypothesis_framing: string
  interior_tension: {
    cost: string
    protects: string
  }
  functional_consequence: string
  boundary_clause: string
}
```

## Prompt Matrix

Select prompt based on: `mode` × `contradiction_detected` × `empty_signal`

| Mode | Contradiction | Empty | Prompt |
|------|---------------|-------|--------|
| ask_score | true | false | Strict registers/conditions/non-resolution |
| ask_score | false | false | Simpler but structured |
| ask_position | true | false | Hypothesis-with-tension, dismissible |
| ask_position | false | false | Still hypothesis-framed |
| any | any | true | Acknowledge absence, prompt contribution |

## Prompt Constraints (all modes)

```
NEVER:
- Resolve differences between fragments
- Infer causes unless directly stated
- Use: "probably", "maybe", "it seems like", "perhaps"
- Average, choose between, explain away, or romanticize

WHEN DIVERGENCE EXISTS:
- Increase specificity
- Decrease certainty language
- Enumerate registers explicitly
```

## Leakage Lint (pre-return scan)

Flag outputs containing:
- **Causal insertion**: "because", "due to", "so that" (when not evidenced)
- **Romanticizing**: "strength", "complexity", "beautifully", "rich"
- **Averaging**: "somewhat", "both X and Y" without register structure
- **Arc imposition**: "over time", "eventually", "became"

If flagged: set `needs_review: true` in metadata (for internal debugging, not blocking)

## Contradiction Detection

Primary (schema-based):
- `link_type = 'complicates'` OR
- `legibility_effect = 'fragments'`

Secondary (to add later):
- Competing clarifiers: two `expresses` fragments with divergent registers
- Based on: contributor role, temporal distance, semantic clustering

## File Structure

```
lib/
  prompts/
    interact/
      ask_score_v1.ts
      ask_position_v1.ts
      empty_signal_v1.ts
      types.ts
app/
  api/
    interact/
      route.ts
```

## Test Fixtures

### Simulated constellation: "how she decided"

```typescript
const testFragments = [
  {
    content: "She'd look at you and just say 'we're doing this'",
    contributor_relation: 'sibling',
    link_type: 'expresses',
    legibility_effect: 'clarifies'
  },
  {
    content: "I'd find her up at 3am sometimes, just sitting. Before big decisions.",
    contributor_relation: 'spouse',
    link_type: 'complicates',
    legibility_effect: 'fragments'
  },
  {
    content: "With the kids she was certain. Always. Even when I knew she wasn't.",
    contributor_relation: 'spouse',
    link_type: 'expresses',
    legibility_effect: null
  },
  {
    content: "She asked me once what I thought — then did the opposite. But she'd asked.",
    contributor_relation: 'friend',
    link_type: 'amplifies',
    legibility_effect: null
  }
]
```

### Leakage detection fixtures

One fixture per predicted leakage type:
1. Causal insertion: output contains "because of the weight of responsibility"
2. Temporal smoothing: output contains "over time she became more decisive"
3. Romanticizing: output contains "this shows her strength"
4. False synthesis: output contains "she was decisive but thoughtful" (averaging)

## Dependencies

- `get_emerging_signals` RPC (exists)
- `motif_links` with `link_type`, `legibility_effect` (exists, migration 027)
- LLM with JSON mode / structured output (Claude or GPT)

## Open Questions

1. Which LLM? Claude (current provider) or GPT? JSON mode reliability differs.
2. Should `ask_position` require explicit user opt-in given its interpretive nature?
3. How to handle multi-signal queries? (Defer for v1 — single signal only)

## Acceptance Criteria

- [ ] Route accepts signal_id + mode, returns structured JSON
- [ ] Contradiction detection works on test constellation
- [ ] Both modes produce correct output structure
- [ ] Leakage lint catches all 4 fixture cases
- [ ] Prompt version returned in metadata
- [ ] Empty signal case returns acknowledgment, not synthesis
