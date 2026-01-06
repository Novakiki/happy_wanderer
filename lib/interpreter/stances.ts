/**
 * Happy Wanderer Stance System
 *
 * Three distinct voices, each with clear boundaries:
 * - Interpreter: Pattern-finding about Valerie (interpretive authority only)
 * - Guide: Tool navigation and actions (procedural authority only)
 * - Listener: Feedback capture (no authority, only receipt)
 *
 * Critical rule: Only ONE stance may speak in a single turn.
 */

// === Stance Types ===

export type Stance = 'interpreter' | 'guide' | 'listener';

export type StanceRoutingResult = {
  stance: Stance;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  mixedIntents?: string[];
};

// === Intent Detection Patterns ===

const ACTION_PATTERNS = [
  /\b(add|create|submit|write|post|share)\b.*\b(memory|note|story)/i,
  /\b(edit|update|change|fix|modify)\b.*\b(my|the)\b/i,
  /\b(delete|remove)\b/i,
  /\b(claim|verify|confirm)\b/i,
  /\bshow me (my|the)\b/i,
  /\bhow (do|can) I\b/i,
  /\bwhere (do|can) I\b/i,
  /\bcan (I|you)\b.*\b(add|edit|delete|change|submit)/i,
];

const TOOL_QUESTION_PATTERNS = [
  /\bhow does\b.*\bwork/i,
  /\bwhat happens (to|when|if)\b/i,
  /\bwho can see\b/i,
  /\bis (this|my)\b.*\b(private|public|visible)/i,
  /\bwhat (are|is) (the|a) (rule|policy|guideline)/i,
  /\bhow (is|are)\b.*\b(stored|saved|shared)/i,
  /\bpermission/i,
  /\bsetting/i,
  /\bvisibility\b/i,
];

const FEEDBACK_PATTERNS = [
  /\byou should\b/i,
  /\bit would be (better|nice|helpful) if\b/i,
  /\bthis (feels|seems|is) (confusing|unclear|broken|wrong)/i,
  /\bI (wish|want|think) (you|it|this)\b/i,
  /\bfeedback\b/i,
  /\bsuggestion\b/i,
  /\bidea for\b/i,
  /\bfeature request\b/i,
  /\bbug\b/i,
  /\bdoesn't (work|make sense)/i,
];

const VALERIE_PATTERNS = [
  /\b(val|valerie)('s|'s)?\b/i,
  /\b(her|she)\b.*\b(like|pattern|habit|way|always|never)/i,
  /\bwhat (was|did) she\b/i,
  /\btell me about\b/i,
  /\bwhat (do|does) (the|people) (notes?|memories?) (say|show|suggest)/i,
  /\bpattern/i,
  /\bwhat kind of (person|mother|woman)\b/i,
  /\bhow did she\b/i,
  /\bstories? about\b/i,
];

// === Stance Routing ===

/**
 * Determines which stance should handle a user message.
 *
 * Priority order:
 * 1. Action requests → Guide
 * 2. Tool questions → Guide
 * 3. Feedback/ideas → Listener
 * 4. Valerie questions → Interpreter
 * 5. Default → Interpreter (safest default)
 */
export function routeToStance(userMessage: string): StanceRoutingResult {
  const detectedIntents: { stance: Stance; pattern: string }[] = [];

  // Check action patterns
  for (const pattern of ACTION_PATTERNS) {
    if (pattern.test(userMessage)) {
      detectedIntents.push({ stance: 'guide', pattern: 'action_request' });
      break;
    }
  }

  // Check tool question patterns
  for (const pattern of TOOL_QUESTION_PATTERNS) {
    if (pattern.test(userMessage)) {
      detectedIntents.push({ stance: 'guide', pattern: 'tool_question' });
      break;
    }
  }

  // Check feedback patterns
  for (const pattern of FEEDBACK_PATTERNS) {
    if (pattern.test(userMessage)) {
      detectedIntents.push({ stance: 'listener', pattern: 'feedback' });
      break;
    }
  }

  // Check Valerie patterns
  for (const pattern of VALERIE_PATTERNS) {
    if (pattern.test(userMessage)) {
      detectedIntents.push({ stance: 'interpreter', pattern: 'valerie_question' });
      break;
    }
  }

  // Handle results
  if (detectedIntents.length === 0) {
    // Default to interpreter (safest)
    return {
      stance: 'interpreter',
      confidence: 'low',
      reason: 'No clear intent detected; defaulting to Interpreter',
    };
  }

  if (detectedIntents.length === 1) {
    return {
      stance: detectedIntents[0].stance,
      confidence: 'high',
      reason: `Detected ${detectedIntents[0].pattern}`,
    };
  }

  // Mixed intents: prioritize by order (guide > listener > interpreter)
  const stancePriority: Stance[] = ['guide', 'listener', 'interpreter'];
  const primaryStance = stancePriority.find((s) =>
    detectedIntents.some((i) => i.stance === s)
  )!;

  return {
    stance: primaryStance,
    confidence: 'medium',
    reason: `Mixed intents detected; prioritizing ${primaryStance}`,
    mixedIntents: detectedIntents.map((i) => i.pattern),
  };
}

// === System Prompts ===

export const GUIDE_SYSTEM_PROMPT = `You are the Happy Wanderer Guide.

You help users understand and use the tool.
You can explain processes and, when authorized, perform actions.

You must:
- Be clear and procedural
- State what you can and cannot do
- Confirm before taking any action on the user's behalf
- Describe outcomes and visibility clearly
- Explain the steps involved in any process

You must NOT:
- Interpret memories or patterns
- Speak about Valerie's character or meaning
- Offer emotional interpretations
- Blur system limits
- Make promises about future features

## What you can help with:
- Adding or editing memories
- Understanding visibility settings
- Claiming mentions of yourself
- Navigating the Score
- Understanding who can see what
- Explaining how trust and verification work

## Authority boundaries:
- You cannot interpret what memories mean
- You cannot draw conclusions about Valerie
- You cannot use motifs or pattern language
- You cannot speak for the archive

If a user asks about Valerie's patterns or what memories suggest about her, respond:
"For questions about Valerie and what the memories reveal, I'd suggest the Interpreter mode. I can help with how to use the tool, add memories, or understand the system."

## Tone:
- Helpful but administrative
- Clear, not warm
- Factual, not interpretive`;

export const LISTENER_SYSTEM_PROMPT = `You are the Happy Wanderer Listener.

Your role is to receive feedback, ideas, confusion, or critique about the project.

You must:
- Listen carefully
- Reflect back what you heard in neutral language
- Ask at most one clarifying question if needed
- Thank them for sharing
- Offer to record or pass along the feedback

You must NOT:
- Defend the system
- Explain design decisions unless explicitly asked
- Promise changes or timelines
- Interpret Valerie or memories
- Suggest solutions unless the user specifically asks
- Commit the roadmap
- Apologize excessively

## Your responses should:
- Acknowledge what was said
- Paraphrase to confirm understanding
- Ask one clarifying question if the feedback is unclear
- End by asking if they'd like this recorded

## Tone:
- Appreciative
- Grounded
- Non-committal
- Brief

## Example response structure:
"Thank you for sharing that. If I understand correctly, [paraphrase their feedback]. [Optional: one clarifying question]. Would you like me to record this feedback?"

## Authority boundaries:
- You cannot solve problems
- You cannot interpret memories
- You cannot take actions
- You can only receive and acknowledge`;

// === Authority Firewalls ===

/**
 * Authority boundaries for each stance.
 * These are the hard rules that maintain trust.
 */
export const AUTHORITY_FIREWALLS = {
  interpreter: {
    canDo: [
      'Surface patterns from evidence',
      'Cite memory IDs',
      'Distinguish evidence from inference',
      'Note tensions and disagreements',
      'Suggest what the archive might answer next',
    ],
    cannotDo: [
      'Approve or reject submissions',
      'Comment on contributor credibility beyond metadata',
      'Suggest edits to memories',
      'Speak as the system',
      'Promise interpretive certainty',
      'Perform tool actions',
    ],
  },
  guide: {
    canDo: [
      'Explain how the tool works',
      'Describe processes step by step',
      'Help navigate features',
      'Clarify visibility and permissions',
      'Assist with submissions (with confirmation)',
    ],
    cannotDo: [
      'Interpret meaning from memories',
      'Use motifs or pattern language',
      'Draw conclusions about Valerie',
      'Speak warmly about the subject',
      'Offer emotional framing',
    ],
  },
  listener: {
    canDo: [
      'Receive feedback',
      'Paraphrase to confirm understanding',
      'Ask one clarifying question',
      'Offer to record feedback',
      'Thank the user',
    ],
    cannotDo: [
      'Solve problems',
      'Interpret memories',
      'Take actions',
      'Promise changes',
      'Defend design decisions',
      'Commit roadmap',
    ],
  },
} as const;

// === Mixed Intent Handler ===

/**
 * Generates a response for mixed-intent messages.
 * Handles the first intent, then offers to switch.
 */
export function buildMixedIntentResponse(
  primaryStance: Stance,
  secondaryIntents: string[]
): string {
  const stanceLabels: Record<Stance, string> = {
    interpreter: 'interpreting patterns about Valerie',
    guide: 'helping you use the tool',
    listener: 'capturing your feedback',
  };

  const otherModes = secondaryIntents
    .map((intent) => {
      if (intent === 'action_request' || intent === 'tool_question') return 'Guide';
      if (intent === 'feedback') return 'Listener';
      if (intent === 'valerie_question') return 'Interpreter';
      return null;
    })
    .filter(Boolean)
    .filter((mode) => mode !== primaryStance);

  if (otherModes.length === 0) {
    return '';
  }

  return `I can do one at a time. I'll start with ${stanceLabels[primaryStance]}. When you're ready, I can switch to ${otherModes.join(' or ')} mode.`;
}

// === Stance Switch Detection ===

/**
 * Detects if user is requesting a stance switch.
 */
export function detectStanceSwitch(
  userMessage: string
): { requested: boolean; targetStance?: Stance } {
  const switchPatterns: { pattern: RegExp; stance: Stance }[] = [
    { pattern: /switch to (interpreter|pattern)/i, stance: 'interpreter' },
    { pattern: /tell me about (val|her pattern)/i, stance: 'interpreter' },
    { pattern: /switch to (guide|help)/i, stance: 'guide' },
    { pattern: /help me (add|use|navigate)/i, stance: 'guide' },
    { pattern: /switch to (listener|feedback)/i, stance: 'listener' },
    { pattern: /(give|have|share) feedback/i, stance: 'listener' },
  ];

  for (const { pattern, stance } of switchPatterns) {
    if (pattern.test(userMessage)) {
      return { requested: true, targetStance: stance };
    }
  }

  return { requested: false };
}
