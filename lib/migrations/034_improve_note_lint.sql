-- Improved lint_note: curated adjectives, actor+verb+object for intent,
-- quote masking, clearer patterns

CREATE OR REPLACE FUNCTION public.lint_note(note_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  warnings JSONB := '[]'::jsonb;
  lower_body TEXT := lower(coalesce(note_body, ''));
  masked_body TEXT;
  hedge_regex TEXT;
  rule RECORD;
  severity TEXT;
  matched_text TEXT;
  hedge_pattern TEXT;
BEGIN
  -- Mask quoted speech to avoid false positives
  -- Handles "...", '...', and "..." (curly quotes)
  masked_body := regexp_replace(lower_body, E'(["\u201c])[^"\u201d]*(["\u201d])', '[QUOTED]', 'g');
  masked_body := regexp_replace(masked_body, E'''[^'']+''', '[QUOTED]', 'g');

  -- Hedging language that softens assertions
  hedge_regex := E'\\m(?:maybe|perhaps|possibly|probably|likely|unlikely|apparently|roughly|sort\\s+of|kind\\s+of|in\\s+a\\s+way|it\\s+seems|it\\s+appears|it\\s+looks\\s+like|i\\s+think|i\\s+feel|i\\s+suspect|i\\s+wonder|my\\s+sense\\s+is|often|sometimes|occasionally|generally|typically|tends?\\s+to|can\\s+be|may\\s+be|might|could|a\\s+bit|somewhat|i\\s+guess|i\\s+believe|to\\s+me|in\\s+my\\s+view)\\y';

  FOR rule IN
    SELECT * FROM (VALUES
      -- Trait labels: curated evaluative adjectives only (not "nurse", "tall", etc.)
      ('TRAIT_LABEL',
        E'\\m(?:she|he|they|valerie|val)\\s+(?:is|was|were|''s|''re)\\s+(?:(?:so|very|really|always|never)\\s+)?(?:a\\s+)?(?:narcissist|narcissistic|toxic|selfish|cruel|cold|distant|loving|kind|wonderful|terrible|awful|amazing|brilliant|stupid|lazy|crazy|difficult|impossible|perfect|controlling|manipulative|abusive|neglectful|supportive|caring|mean|sweet|angry|bitter|jealous|resentful|insecure|paranoid|dramatic|hysterical|unstable|unreliable|dishonest|honest|generous|stingy|warm|frigid|passive|aggressive|passive-aggressive|codependent|emotionally\\s+unavailable|overbearing|smothering|domineering|spineless|weak|strong|brave|cowardly|evil|saintly|angelic|demonic)\\y',
        'Describing someone with a trait label. Try a specific moment instead.',
        'Rewrite as: "When ___ happened, she/he …"'),

      -- Meaning assertions: "this shows/proves..."
      ('MEANING_ASSERTION',
        E'\\m(?:this|that|it)\\s+(?:clearly\\s+|obviously\\s+|really\\s+)?(?:shows|proves|reveals|means|demonstrates|indicates|implies|confirms|establishes)\\y',
        'Asserting meaning as fact. Let the reader draw conclusions.',
        'Remove the "this shows…" framing and add concrete detail.'),

      -- Consensus claims: "everyone knows..."
      ('CONSENSUS_CLAIM',
        E'\\m(?:everyone|everybody|no\\s+one|nobody|we\\s+all|all\\s+of\\s+us|most\\s+people|people\\s+(?:say|think|know|agree|remember|believe))\\y',
        'Speaking for others. Share your own perspective.',
        'Rewrite with "I" and specific context.'),

      -- Ranking: "the best/worst/most important"
      ('RANKING',
        E'\\m(?:(?:the\\s+)?most\\s+important|the\\s+best|the\\s+worst|the\\s+only|the\\s+biggest|the\\s+greatest)\\y',
        'Ranking as fact. Describe the thing itself.',
        'Replace with a concrete instance or observation.'),

      -- Contradiction policing: "that's not true"
      ('CONTRADICTION',
        E'(?:\\m(?:that''?s|that\\s+is|this\\s+is)\\s+(?:not\\s+true|wrong|false|a\\s+lie)\\y|\\m(?:they|you)\\s+(?:are|''re)\\s+(?:wrong|lying|mistaken)\\y|\\mthat\\s+(?:didn''?t|never)\\s+happen)',
        'Rebutting others. Share your version instead.',
        'Rewrite as your own memory: "What I remember is …"'),

      -- Interprets intent: requires actor + verb + object (not passive "I was abandoned")
      ('INTERPRETS_INTENT',
        E'\\m(?:she|he|they|my\\s+(?:mother|father|mom|dad|parent|parents|brother|sister|family|husband|wife|partner|ex|boss|friend))\\s+(?:would\\s+)?(?:brainwashed?|brainwashing|gaslighted?|gaslighting|gaslit|manipulated?|manipulating|coerced?|coercing|triangulated?|triangulating|lovebombed?|lovebombing|betrayed?|betraying|abandoned?|abandoning|exploited?|exploiting|deceived?|deceiving|neglected?|neglecting|abused?|abusing|isolated?|isolating|controlled?|controlling|dominated?|dominating|enabled?|enabling|victimized?|victimizing|scapegoated?|scapegoating|parentified|parentifying|infantilized?|infantilizing|invalidated?|invalidating|(?:used|uses|using))\\s+(?:me|us|him|her|them)\\y',
        'Interpreting intent as fact. Describe what happened.',
        'Try: "I experienced it as…" or describe specific actions.'),

      -- Motive attribution: "because he was jealous"
      ('MOTIVE_ATTRIBUTION',
        E'\\mbecause\\s+(?:she|he|they|i|we|[a-z]+)\\s+(?:is|was|were|''s|''d|had\\s+been)\\s+(?:just\\s+|so\\s+)?(?:jealous|angry|bitter|insecure|resentful|selfish|controlling|narcissistic|toxic|crazy|lazy|mean|petty|spiteful|vengeful|paranoid|manipulative|abusive|greedy|envious|threatened|scared|afraid|guilty|ashamed)\\y',
        'Stating motives as fact. Frame it as your interpretation.',
        'Try: "I felt like…" or "It seemed to me that…"')
    ) AS t(code, pattern, message, suggestion)
  LOOP
    -- Check against masked body (quotes removed)
    IF masked_body ~ rule.pattern THEN
      -- Check for nearby hedges to soften severity
      hedge_pattern := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || rule.pattern || E'|' || rule.pattern || E'[^.!?\\n]{0,120}' || hedge_regex || E')';
      severity := CASE WHEN masked_body ~ hedge_pattern THEN 'soft' ELSE 'strong' END;

      -- Extract matched text from original (unmasked) for display
      matched_text := btrim(coalesce(
        substring(note_body from '(?i)' || rule.pattern),
        substring(lower_body from rule.pattern)
      ));

      warnings := warnings || jsonb_build_array(jsonb_build_object(
        'code', rule.code,
        'message', rule.message,
        'suggestion', rule.suggestion,
        'severity', severity,
        'match', matched_text
      ));
    END IF;
  END LOOP;

  RETURN warnings;
END;
$$;

-- Update list_lint_rules to match
CREATE OR REPLACE FUNCTION public.list_lint_rules()
RETURNS TABLE(code TEXT, message TEXT, suggestion TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM (VALUES
    ('TRAIT_LABEL', 'Describing someone with a trait label. Try a specific moment instead.', 'Rewrite as: "When ___ happened, she/he …"'),
    ('MEANING_ASSERTION', 'Asserting meaning as fact. Let the reader draw conclusions.', 'Remove the "this shows…" framing and add concrete detail.'),
    ('CONSENSUS_CLAIM', 'Speaking for others. Share your own perspective.', 'Rewrite with "I" and specific context.'),
    ('RANKING', 'Ranking as fact. Describe the thing itself.', 'Replace with a concrete instance or observation.'),
    ('CONTRADICTION', 'Rebutting others. Share your version instead.', 'Rewrite as your own memory: "What I remember is …"'),
    ('INTERPRETS_INTENT', 'Interpreting intent as fact. Describe what happened.', 'Try: "I experienced it as…" or describe specific actions.'),
    ('MOTIVE_ATTRIBUTION', 'Stating motives as fact. Frame it as your interpretation.', 'Try: "I felt like…" or "It seemed to me that…"')
  ) AS t(code, message, suggestion);
$$;
