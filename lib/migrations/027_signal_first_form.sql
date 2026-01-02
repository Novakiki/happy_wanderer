-- 027_signal_first_form.sql
-- Migration for Signal-first fragment capture form
-- Adds: pg_trgm extension, RPC functions for signal search, schema columns for form

BEGIN;

-- =============================================================================
-- 1) Enable pg_trgm extension for fuzzy matching
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- 2) Add columns to timeline_events for fragment capture
-- =============================================================================

ALTER TABLE timeline_events
  ADD COLUMN IF NOT EXISTS needs_signal_assignment boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fragment_kind text,    -- moment | pattern | quote | observation | secondhand | other
  ADD COLUMN IF NOT EXISTS subject_focus text,    -- valerie | relationship | family_system | other
  ADD COLUMN IF NOT EXISTS entry_mode text;       -- signal_first | fragment_first

-- Optional constraints (comment out if you prefer loose text)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timeline_events_fragment_kind_check') THEN
    ALTER TABLE timeline_events
      ADD CONSTRAINT timeline_events_fragment_kind_check
      CHECK (fragment_kind IS NULL OR fragment_kind IN ('moment','pattern','quote','observation','secondhand','other'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timeline_events_subject_focus_check') THEN
    ALTER TABLE timeline_events
      ADD CONSTRAINT timeline_events_subject_focus_check
      CHECK (subject_focus IS NULL OR subject_focus IN ('valerie','relationship','family_system','other'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'timeline_events_entry_mode_check') THEN
    ALTER TABLE timeline_events
      ADD CONSTRAINT timeline_events_entry_mode_check
      CHECK (entry_mode IS NULL OR entry_mode IN ('signal_first','fragment_first'));
  END IF;
END $$;

-- =============================================================================
-- 3) Add columns to motif_links for link semantics
-- =============================================================================

ALTER TABLE motif_links
  ADD COLUMN IF NOT EXISTS link_type text DEFAULT 'expresses',
  ADD COLUMN IF NOT EXISTS legibility_effect text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motif_links_link_type_check') THEN
    ALTER TABLE motif_links
      ADD CONSTRAINT motif_links_link_type_check
      CHECK (link_type IS NULL OR link_type IN ('expresses','amplifies','complicates'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motif_links_legibility_effect_check') THEN
    ALTER TABLE motif_links
      ADD CONSTRAINT motif_links_legibility_effect_check
      CHECK (legibility_effect IS NULL OR legibility_effect IN ('clarifies','flattens','fragments','romanticizes','hardens'));
  END IF;
END $$;

-- Index for "What's Emerging" queries
CREATE INDEX IF NOT EXISTS idx_motif_links_motif_expresses
  ON motif_links (motif_id)
  WHERE link_type = 'expresses';

CREATE INDEX IF NOT EXISTS idx_motif_links_note_type
  ON motif_links (note_id, link_type);

-- =============================================================================
-- 4) Create signal_suggestions table for freeform "something else"
-- =============================================================================

CREATE TABLE IF NOT EXISTS signal_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  text text NOT NULL,
  matched_motif_id uuid REFERENCES motifs(id),
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES contributors(id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signal_suggestions_status_check') THEN
    ALTER TABLE signal_suggestions
      ADD CONSTRAINT signal_suggestions_status_check
      CHECK (status IN ('pending','matched','promoted','rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_signal_suggestions_status ON signal_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_signal_suggestions_event ON signal_suggestions(event_id);
CREATE INDEX IF NOT EXISTS idx_signal_suggestions_created_at ON signal_suggestions(created_at DESC);

-- =============================================================================
-- 5) Ensure unique index on motifs.label for idempotent seeding
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_motifs_label ON motifs(label);

-- =============================================================================
-- 6) Seed initial signals (idempotent)
-- =============================================================================

INSERT INTO motifs (label, definition, status, created_at)
VALUES
  ('her humor', 'The way humor moved through her', 'active', now()),
  ('how she decided', 'Her patterns of decision-making', 'active', now()),
  ('what she noticed', 'What caught her attention', 'active', now()),
  ('how she corrected', 'How she offered correction', 'active', now()),
  ('how she welcomed', 'How she made people feel received', 'active', now()),
  ('what she returned to', 'Themes and places she came back to', 'active', now()),
  ('how ordinary moments changed around her', 'The texture shift when she was present', 'active', now())
ON CONFLICT (label) DO NOTHING;

-- =============================================================================
-- 7) RPC: search_motifs - fuzzy search for signal suggestions
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_motifs(
  q text,
  lim int DEFAULT 8,
  min_show_score float8 DEFAULT 0.10,
  confirm_threshold float8 DEFAULT 0.50
)
RETURNS TABLE (
  id uuid,
  label text,
  definition text,
  score float8,
  should_confirm boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH params AS (
    SELECT
      regexp_replace(lower(q), '[^a-z0-9\s]+', '', 'g')::text AS nq,
      lim AS nlim,
      min_show_score AS min_score,
      confirm_threshold AS cth
  ),
  scored AS (
    SELECT
      m.id,
      m.label,
      m.definition,
      similarity(
        regexp_replace(lower(m.label), '[^a-z0-9\s]+', '', 'g'),
        (SELECT nq FROM params)
      ) AS score
    FROM motifs m
    WHERE m.status = 'active'
  )
  SELECT
    s.id,
    s.label,
    s.definition,
    s.score,
    (s.score >= (SELECT cth FROM params)) AS should_confirm
  FROM scored s
  WHERE s.score >= (SELECT min_score FROM params)
  ORDER BY s.score DESC, s.label ASC
  LIMIT (SELECT nlim FROM params);
$$;

-- =============================================================================
-- 8) RPC: best_motif_match - single best match for near-duplicate confirmation
-- =============================================================================

CREATE OR REPLACE FUNCTION public.best_motif_match(
  q text,
  threshold float8 DEFAULT 0.50
)
RETURNS TABLE (
  id uuid,
  label text,
  definition text,
  score float8
)
LANGUAGE sql
STABLE
AS $$
  WITH params AS (
    SELECT
      regexp_replace(lower(q), '[^a-z0-9\s]+', '', 'g')::text AS nq,
      threshold AS th
  ),
  best AS (
    SELECT
      m.id,
      m.label,
      m.definition,
      similarity(
        regexp_replace(lower(m.label), '[^a-z0-9\s]+', '', 'g'),
        (SELECT nq FROM params)
      ) AS score
    FROM motifs m
    WHERE m.status = 'active'
    ORDER BY score DESC
    LIMIT 1
  )
  SELECT * FROM best
  WHERE score >= (SELECT th FROM params);
$$;

-- =============================================================================
-- 9) RPC: get_emerging_signals - "What's Emerging" query
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_emerging_signals(
  since_days int DEFAULT 90,
  motif_limit int DEFAULT 20,
  per_motif int DEFAULT 5
)
RETURNS TABLE (
  motif_id uuid,
  label text,
  definition text,
  expresses_count bigint,
  last_linked_at timestamptz,
  recent_fragments jsonb
)
LANGUAGE sql
STABLE
AS $$
  WITH recent_links AS (
    SELECT
      ml.motif_id,
      ml.note_id AS event_id,
      te.created_at,
      COALESCE(NULLIF(te.preview, ''), te.full_entry) AS body_text
    FROM motif_links ml
    JOIN timeline_events te ON te.id = ml.note_id
    WHERE ml.link_type = 'expresses'
      AND te.created_at >= now() - (since_days || ' days')::interval
      AND te.status IS DISTINCT FROM 'deleted'
  ),
  motif_rollup AS (
    SELECT
      m.id AS motif_id,
      m.label,
      m.definition,
      COUNT(*) AS expresses_count,
      MAX(rl.created_at) AS last_linked_at
    FROM motifs m
    JOIN recent_links rl ON rl.motif_id = m.id
    WHERE m.status = 'active'
    GROUP BY m.id, m.label, m.definition
    ORDER BY expresses_count DESC, last_linked_at DESC
    LIMIT motif_limit
  ),
  ranked_fragments AS (
    SELECT
      rl.motif_id,
      rl.event_id,
      rl.created_at,
      rl.body_text,
      ROW_NUMBER() OVER (PARTITION BY rl.motif_id ORDER BY rl.created_at DESC) AS rn
    FROM recent_links rl
    JOIN motif_rollup mr ON mr.motif_id = rl.motif_id
  )
  SELECT
    mr.motif_id,
    mr.label,
    mr.definition,
    mr.expresses_count,
    mr.last_linked_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'event_id', rf.event_id,
          'created_at', rf.created_at,
          'snippet', LEFT(regexp_replace(COALESCE(rf.body_text, ''), '\s+', ' ', 'g'), 240)
        )
        ORDER BY rf.created_at DESC
      ) FILTER (WHERE rf.rn <= per_motif),
      '[]'::jsonb
    ) AS recent_fragments
  FROM motif_rollup mr
  LEFT JOIN ranked_fragments rf ON rf.motif_id = mr.motif_id
  GROUP BY mr.motif_id, mr.label, mr.definition, mr.expresses_count, mr.last_linked_at
  ORDER BY mr.expresses_count DESC, mr.last_linked_at DESC;
$$;

COMMIT;
