/**
 * empty_signal prompt v1
 * Handle signals with no fragments
 * Acknowledge absence, prompt contribution
 */

export const EMPTY_SIGNAL_RESPONSE = {
  signal_description: "This signal has no fragments yet.",
  registers: [],
  conditions: [],
  non_resolution_clause: "Nothing to synthesize — this pattern awaits its first expression.",
  invitation: "If you recognize this pattern in a memory, consider contributing a fragment."
};

// This isn't really a prompt — it's a static response
// No LLM call needed for empty signals
export function buildEmptySignalResponse(signalLabel: string): typeof EMPTY_SIGNAL_RESPONSE {
  return {
    ...EMPTY_SIGNAL_RESPONSE,
    signal_description: `The signal "${signalLabel}" has no fragments yet.`,
  };
}

export const EMPTY_SIGNAL_PROMPT_VERSION = 'empty_signal_v1';
