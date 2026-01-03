export const LINT_SUGGESTIONS: Record<string, string> = {
  TRAIT_LABEL: 'Add a concrete moment: who was there, where it happened, or what was said.',
  MEANING_ASSERTION: 'Describe what happened instead of what it meant.',
  CONSENSUS_CLAIM: 'Write from your perspective: "I remember..." with specific context.',
  RANKING: 'Describe the instance instead of ranking it.',
  CONTRADICTION_POLICING: 'Share your memory without correcting others; add context instead.',
};

export const getLintSuggestion = (code: string, fallback?: string, message?: string) => {
  if (LINT_SUGGESTIONS[code]) return LINT_SUGGESTIONS[code];
  const msg = (message || '').toLowerCase();
  if (msg.includes('consent') || msg.includes('named person')) {
    return 'Remove the name for now—use “someone” or no name. Best next step: add them in People and invite them so they can decide how they want to appear.';
  }
  return fallback;
};
