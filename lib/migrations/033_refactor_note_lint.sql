-- Refactor lint_note: table-driven, consolidated patterns, expanded word lists
-- Merges MOTIVE_ATTRIBUTION + MINDREADING_MECHANISM → INTERPRETS_INTENT

CREATE OR REPLACE FUNCTION public.lint_note(note_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  warnings JSONB := '[]'::jsonb;
  lower_body TEXT := lower(coalesce(note_body, ''));
  hedge_regex TEXT;
  rule RECORD;
  severity TEXT;
  matched_text TEXT;
  hedge_pattern TEXT;
BEGIN
  -- Hedging language that softens assertions
  hedge_regex := E'\\m(?:maybe|perhaps|possibly|probably|likely|unlikely|apparently|roughly|sort\\s+of|kind\\s+of|in\\s+a\\s+way|it\\s+seems|it\\s+appears|it\\s+looks\\s+like|i\\s+think|i\\s+feel|i\\s+suspect|i\\s+wonder|my\\s+sense\\s+is|often|sometimes|occasionally|generally|typically|tends?\\s+to|can\\s+be|may\\s+be|might|could|a\\s+bit|somewhat|i\\s+guess|i\\s+believe|to\\s+me|in\\s+my\\s+view)\\y';

  -- Loop through lint rules
  FOR rule IN
    SELECT * FROM (VALUES
      -- Trait labels: "she is/was [adjective]" without grounding
      (
        'TRAIT_LABEL',
        E'\\m(?:she|he|they|valerie|val)\\s+(?:is|was|were|''s|''re)\\s+(?:(?:so|very|really|always|never)\\s+)?(?:[a-z]{3,}(?:\\s+[a-z]{3,})?|a[n]?\\s+[a-z]{3,})',
        'Describing someone with a label. Try a specific moment instead.',
        'Rewrite as: "When ___ happened, she/he …"'
      ),
      -- Meaning assertions: "this shows/proves..."
      (
        'MEANING_ASSERTION',
        E'\\m(?:this|that|it)\\s+(?:clearly\\s+|obviously\\s+|really\\s+)?(?:shows|proves|reveals|means|demonstrates|indicates|implies|confirms|establishes)\\y',
        'Asserting meaning as fact. Let the reader draw conclusions.',
        'Remove the "this shows…" framing and add concrete detail.'
      ),
      -- Consensus claims: "everyone knows..."
      (
        'CONSENSUS_CLAIM',
        E'\\m(?:everyone|everybody|no\\s+one|nobody|we\\s+all|all\\s+of\\s+us|most\\s+people|people\\s+(?:say|think|know|agree|remember|believe))\\y',
        'Speaking for others. Share your own perspective.',
        'Rewrite with "I" and specific context.'
      ),
      -- Ranking: "the best/worst/most important"
      (
        'RANKING',
        E'\\m(?:(?:the\\s+)?most\\s+important|the\\s+best|the\\s+worst|the\\s+only|the\\s+biggest|the\\s+greatest)\\y',
        'Ranking as fact. Describe the thing itself.',
        'Replace with a concrete instance or observation.'
      ),
      -- Contradiction policing: "that''s not true"
      (
        'CONTRADICTION',
        E'(?:\\m(?:that''?s|that\\s+is|this\\s+is)\\s+(?:not\\s+true|wrong|false|a\\s+lie)\\y|\\m(?:they|you)\\s+(?:are|''re)\\s+(?:wrong|lying|mistaken)\\y|\\mthat\\s+(?:didn''?t|never)\\s+happen)',
        'Rebutting others. Share your version instead.',
        'Rewrite as your own memory: "What I remember is …"'
      ),
      -- Interprets intent: verbs that assume motive/mechanism
      (
        'INTERPRETS_INTENT',
        E'\\m(?:brainwash(?:ed|ing|es)?|gaslight(?:ed|ing|s)?|gaslit|manipulat(?:ed|ing|es?)|coerc(?:ed|ing|es?)|guilt(?:ed|ing|s)?\\s+(?:me|him|her|them|us|into)|triangulat(?:ed|ing|es?)|lovebomb(?:ed|ing|s)?|betray(?:ed|ing|s)?|abandon(?:ed|ing|s)?|exploit(?:ed|ing|s)?|deceiv(?:ed|ing|es?)|neglect(?:ed|ing|s)?|abus(?:ed|ing|es?)|isolat(?:ed|ing|es?)|controll(?:ed|ing|s)?|dominat(?:ed|ing|es?)|enabl(?:ed|ing|es?)|victimiz(?:ed|ing|es?)|scapegoat(?:ed|ing|s)?|parentif(?:ied|ying|ies)|infantiliz(?:ed|ing|es?)|invalidat(?:ed|ing|es?)|us(?:ed|ing|es?)\\s+(?:me|him|her|them|us))\\y',
        'Interpreting intent as fact. Describe what happened.',
        'Try: "I experienced it as…" or describe specific actions.'
      ),
      -- Motive attribution: "because he was jealous"
      (
        'MOTIVE_ATTRIBUTION',
        E'\\mbecause\\s+(?:he|she|they|i|we|[a-z]+)\\s+(?:is|was|were|''s|''d|had\\s+been)\\s+(?:just\\s+|so\\s+)?(?:jealous|angry|bitter|insecure|resentful|selfish|controlling|narcissistic|toxic|crazy|lazy|mean|petty|spiteful|vengeful|paranoid|manipulative|abusive|greedy|envious|threatened|scared|afraid|guilty|ashamed)\\y',
        'Stating motives as fact. Frame it as your interpretation.',
        'Try: "I felt like…" or "It seemed to me that…"'
      )
    ) AS t(code, pattern, message, suggestion)
  LOOP
    IF lower_body ~ rule.pattern THEN
      -- Check for nearby hedges to soften severity
      hedge_pattern := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || rule.pattern || E'|' || rule.pattern || E'[^.!?\\n]{0,120}' || hedge_regex || E')';
      severity := CASE WHEN lower_body ~ hedge_pattern THEN 'soft' ELSE 'strong' END;

      -- Extract matched text
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
