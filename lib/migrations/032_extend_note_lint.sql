-- Extend lint_note with motive attribution and mind-reading patterns
-- Also fix curly apostrophe support and add 'val' to trait subjects
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
  motive_regex TEXT;
  motive_hedge_regex TEXT;
  mindreading_regex TEXT;
  mindreading_hedge_regex TEXT;
  severity TEXT;
  matched_text TEXT;
BEGIN
  hedge_regex := E'\\m(?:maybe|perhaps|possibly|probably|likely|unlikely|apparently|roughly|sort\\s+of|kind\\s+of|in\\s+a\\s+way|it\\s+seems|it\\s+appears|it\\s+looks\\s+like|i\\s+think|i\\s+feel|i\\s+suspect|i\\s+wonder|my\\s+sense\\s+is|often|sometimes|occasionally|generally|typically|tends?\\s+to|can\\s+be|may\\s+be|might|could|a\\s+bit|somewhat|i\\s+guess)\\y';

  -- Added 'val' to subjects
  trait_regex := E'\\m(?:she|valerie|val)\\s+(?:is|was)\\s+(?:[a-z]{3,}(?:\\s+[a-z]{3,}){0,1}|a[n]?\\s+[a-z]{3,})';
  meaning_regex := E'\\m(?:this|that)\\s+(?:clearly\\s+|obviously\\s+)?(?:shows|proves|reveals|means|demonstrates|indicates|implies)\\y';
  consensus_regex := E'\\m(?:everyone|everybody|no\\s+one|nobody|we\\s+all|most\\s+people|people\\s+(?:say|think|know|agree|remember))\\y';
  ranking_regex := E'\\m(most\\s+important|the\\s+best|the\\s+worst|the\\s+only)\\y';

  -- Apostrophe support for contractions
  contradiction_regex := E'(?:\\m(?:that''?s|that\\s+is)\\s+not\\s+true\\y|\\m(they\\s+are\\s+wrong)\\y|\\m(that\\s+didn''?t\\s+happen)\\y|\\m(you''?re\\s+mistaken)\\y)';

  -- NEW: Motive attribution - "because he/she was [emotion]"
  motive_regex := E'\\mbecause\\s+(?:he|she|they|i|we|[a-z]+)\\s+(?:is|was|were|''s|''d)\\s+(?:just\\s+)?(?:jealous|angry|bitter|insecure|resentful|selfish|controlling|narcissistic|toxic|crazy|lazy|mean|petty|spiteful|vengeful|paranoid|manipulative|abusive)\\y';

  -- NEW: Mind-reading / coercion verbs stated as fact
  mindreading_regex := E'\\m(?:brainwash(?:ed|ing)?|gaslight(?:ed|ing)?|gaslit|manipulat(?:ed|es|ing)|coerc(?:ed|es|ing)|guilt(?:ed|ing)?\\s+(?:me|him|her|them|us)|triangulat(?:ed|ing)|lovebomb(?:ed|ing)?)\\y';

  trait_hedge_regex := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || trait_regex || E'|' || trait_regex || E'[^.!?\\n]{0,120}' || hedge_regex || E')';
  meaning_hedge_regex := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || meaning_regex || E'|' || meaning_regex || E'[^.!?\\n]{0,120}' || hedge_regex || E')';
  consensus_hedge_regex := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || consensus_regex || E'|' || consensus_regex || E'[^.!?\\n]{0,120}' || hedge_regex || E')';
  ranking_hedge_regex := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || ranking_regex || E'|' || ranking_regex || E'[^.!?\\n]{0,120}' || hedge_regex || E')';
  contradiction_hedge_regex := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || contradiction_regex || E'|' || contradiction_regex || E'[^.!?\\n]{0,120}' || hedge_regex || E')';
  motive_hedge_regex := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || motive_regex || E'|' || motive_regex || E'[^.!?\\n]{0,120}' || hedge_regex || E')';
  mindreading_hedge_regex := E'(?:' || hedge_regex || E'[^.!?\\n]{0,120}' || mindreading_regex || E'|' || mindreading_regex || E'[^.!?\\n]{0,120}' || hedge_regex || E')';

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

  -- NEW: Motive attribution
  IF lower_body ~ motive_regex THEN
    severity := CASE WHEN lower_body ~ motive_hedge_regex THEN 'soft' ELSE 'strong' END;
    matched_text := btrim(coalesce(substring(note_body from '(?i)' || motive_regex), substring(lower_body from motive_regex)));
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'MOTIVE_ATTRIBUTION',
      'message', 'Stating motives as facts. Frame it as your read.',
      'suggestion', 'Try: "I felt like…" / "It seemed like…" / "I read it as…"',
      'severity', severity,
      'match', matched_text
    ));
  END IF;

  -- NEW: Mind-reading / coercion mechanism
  IF lower_body ~ mindreading_regex THEN
    severity := CASE WHEN lower_body ~ mindreading_hedge_regex THEN 'soft' ELSE 'strong' END;
    matched_text := btrim(coalesce(substring(note_body from '(?i)' || mindreading_regex), substring(lower_body from mindreading_regex)));
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'MINDREADING_MECHANISM',
      'message', 'This interprets intent. Describe what happened instead.',
      'suggestion', 'Try: "I experienced it as…" or describe the specific actions.',
      'severity', severity,
      'match', matched_text
    ));
  END IF;

  RETURN warnings;
END;
$$;
