-- Lint helper for note submissions (non-blocking guidance)
CREATE OR REPLACE FUNCTION public.lint_note(note_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  warnings JSONB := '[]'::jsonb;
  lower_body TEXT := lower(coalesce(note_body, ''));
  hedge_regex TEXT;
  trait_regex TEXT;
  trait_hedge_regex TEXT;
  meaning_regex TEXT;
  meaning_hedge_regex TEXT;
  consensus_regex TEXT;
  consensus_hedge_regex TEXT;
  ranking_regex TEXT;
  ranking_hedge_regex TEXT;
  contradiction_regex TEXT;
  contradiction_hedge_regex TEXT;
  severity TEXT;
  matched_text TEXT;
BEGIN
  hedge_regex := E'\\m(?:maybe|perhaps|possibly|probably|likely|unlikely|apparently|roughly|sort\\s+of|kind\\s+of|in\\s+a\\s+way|it\\s+seems|it\\s+appears|it\\s+looks\\s+like|i\\s+think|i\\s+feel|i\\s+suspect|i\\s+wonder|my\\s+sense\\s+is|often|sometimes|occasionally|generally|typically|tends?\\s+to|can\\s+be|may\\s+be|might|could)\\y';
  trait_regex := E'\\m(?:she|valerie)\\s+(?:is|was)\\s+(?:[a-z]{3,}(?:\\s+[a-z]{3,}){0,1}|a[n]?\\s+[a-z]{3,})';
  meaning_regex := E'\\m(?:this|that)\\s+(?:clearly\\s+|obviously\\s+)?(?:shows|proves|reveals|means|demonstrates|indicates|implies)\\y';
  consensus_regex := E'\\m(?:everyone|everybody|no\\s+one|nobody|we\\s+all|most\\s+people|people\\s+(?:say|think|know|agree|remember))\\y';
  ranking_regex := E'\\m(most\\s+important|the\\s+best|the\\s+worst|the\\s+only)\\y';
  contradiction_regex := E'(?:\\m(?:that''?s|that\\s+is)\\s+not\\s+true\\y|\\m(they\\s+are\\s+wrong)\\y|\\m(that\\s+didn''?t\\s+happen)\\y|\\m(you''?re\\s+mistaken)\\y)';

  trait_hedge_regex := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || trait_regex || E'|' || trait_regex || E'[^.!?\\n]{0,120}' || hedge_regex || E')';
  meaning_hedge_regex := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || meaning_regex || E'|' || meaning_regex || E'[^.!?\\n]{0,120}' || hedge_regex || E')';
  consensus_hedge_regex := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || consensus_regex || E'|' || consensus_regex || E'[^.!?\\n]{0,120}' || hedge_regex || E')';
  ranking_hedge_regex := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || ranking_regex || E'|' || ranking_regex || E'[^.!?\\n]{0,120}' || hedge_regex || E')';
  contradiction_hedge_regex := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || contradiction_regex || E'|' || contradiction_regex || E'[^.!?\\n]{0,120}' || hedge_regex || E')';

  -- Trait labels without grounding
  IF lower_body ~ trait_regex THEN
    severity := CASE WHEN lower_body ~ trait_hedge_regex THEN 'soft' ELSE 'strong' END;
    matched_text := btrim(coalesce(substring(note_body from '(?i)' || trait_regex), substring(lower_body from trait_regex)));
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'TRAIT_LABEL',
      'message', 'Try describing a moment that shows this, rather than a label.',
      'suggestion', 'Rewrite as: "One time when …, she …" or "When ___ happened, she …".',
      'severity', severity,
      'match', matched_text
    ));
  END IF;

  -- Meaning assertions
  IF lower_body ~ meaning_regex THEN
    severity := CASE WHEN lower_body ~ meaning_hedge_regex THEN 'soft' ELSE 'strong' END;
    matched_text := btrim(coalesce(substring(note_body from '(?i)' || meaning_regex), substring(lower_body from meaning_regex)));
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'MEANING_ASSERTION',
      'message', 'Avoid "this shows/proves…"; describe what happened and let meaning emerge.',
      'suggestion', 'Remove the "this shows…" clause and add concrete detail.',
      'severity', severity,
      'match', matched_text
    ));
  END IF;

  -- Speaking for others
  IF lower_body ~ consensus_regex THEN
    severity := CASE WHEN lower_body ~ consensus_hedge_regex THEN 'soft' ELSE 'strong' END;
    matched_text := btrim(coalesce(substring(note_body from '(?i)' || consensus_regex), substring(lower_body from consensus_regex)));
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'CONSENSUS_CLAIM',
      'message', 'Speak from your own experience rather than for others.',
      'suggestion', 'Rewrite with "I" and a specific context.',
      'severity', severity,
      'match', matched_text
    ));
  END IF;

  -- Ranking language
  IF lower_body ~ ranking_regex THEN
    severity := CASE WHEN lower_body ~ ranking_hedge_regex THEN 'soft' ELSE 'strong' END;
    matched_text := btrim(coalesce(substring(note_body from '(?i)' || ranking_regex), substring(lower_body from ranking_regex)));
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'RANKING',
      'message', 'Avoid ranking; describe the thing itself in context.',
      'suggestion', 'Replace with a concrete instance.',
      'severity', severity,
      'match', matched_text
    ));
  END IF;

  -- Conflict policing
  IF lower_body ~ contradiction_regex THEN
    severity := CASE WHEN lower_body ~ contradiction_hedge_regex THEN 'soft' ELSE 'strong' END;
    matched_text := btrim(coalesce(substring(note_body from '(?i)' || contradiction_regex), substring(lower_body from contradiction_regex)));
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'CONTRADICTION_POLICING',
      'message', 'Don''t rebut other memories in the public note. Use private context if needed.',
      'suggestion', 'Rewrite as your own memory: "In my experience …"',
      'severity', severity,
      'match', matched_text
    ));
  END IF;

  RETURN warnings;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lint_note(TEXT) TO anon, authenticated, service_role;
