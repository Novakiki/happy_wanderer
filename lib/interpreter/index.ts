/**
 * Happy Wanderer Interpreter Module
 *
 * This module provides the enriched payload system for pattern-finding
 * across memories. It includes:
 *
 * - Types for structured payloads and interpretation outputs
 * - Payload builder that transforms DB records → enriched format
 * - System prompts (full and lite versions)
 * - Orchestrator prompt for structural discipline
 * - Drift detection for quality control
 */

// Types
export type {
  // Payload types
  InterpreterPayload,
  EnrichedMemory,
  MemoryThread,
  MotifDefinition,
  EvidenceControls,
  TaskContext,
  SubjectContext,

  // Enum types
  TimingCertainty,
  WitnessType,
  Recurrence,
  MemoryType,
  TrustStatus,
  ThreadRelationship,

  // DB input types
  DbMemoryRow,
  DbContributorRow,
  DbMotifLinkRow,
  DbEventReferenceRow,
  DbThreadRow,
  DbMotifRow,

  // Output types
  InterpretationOutput,
  InterpretedPattern,
  InterpretedTension,
  PatternStrength,
} from './types';

// Payload builder
export {
  buildInterpreterPayload,
  buildLightweightPayload,
  type EnrichedMemoryInput,
  type BuildInterpreterPayloadArgs,
} from './buildInterpreterPayload';

// System prompts
export {
  INTERPRETER_SYSTEM_PROMPT,
  INTERPRETER_SYSTEM_PROMPT_LITE,
  buildInterpreterSystemMessage,
  buildInterpreterSystemMessageLite,
} from './interpreterSystemPrompt';

// Orchestrator & drift control
export {
  ORCHESTRATOR_PROMPT,
  checkForDrift,
  validateInterpreterResponse,
  type DriftCheckResult,

  // Token budget
  DEFAULT_TOKEN_BUDGET,
  estimateTokens,
  summarizeContent,
  applyTokenBudget,
  type TokenBudget,

  // JSON output
  JSON_OUTPUT_SUFFIX,
  parseInterpretationOutput,
  type PatternOutput,
  type TensionOutput,
  type InterpretationJsonOutput,

  // Two-pass reasoning
  FIRST_PASS_PROMPT,
  SECOND_PASS_SUFFIX,
} from './orchestrator';

// Stance system (three-voice architecture)
export {
  // Routing
  routeToStance,
  detectStanceSwitch,
  buildMixedIntentResponse,
  type Stance,
  type StanceRoutingResult,

  // System prompts
  GUIDE_SYSTEM_PROMPT,
  LISTENER_SYSTEM_PROMPT,

  // Authority boundaries
  AUTHORITY_FIREWALLS,
} from './stances';
