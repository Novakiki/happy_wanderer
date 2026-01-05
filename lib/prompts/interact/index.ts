/**
 * Interact prompts index
 * Signal-bound synthesis with structured output
 */

export * from './types';
export * from './ask_score_v1';
export * from './ask_position_v1';
export * from './empty_signal_v1';

// Current versions
export const CURRENT_VERSIONS = {
  ask_score: 'ask_score_v1',
  ask_position: 'ask_position_v1',
  empty_signal: 'empty_signal_v1',
} as const;
