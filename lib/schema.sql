-- =============================================================================
-- Happy Wanderer - Database Schema
-- Run this in Supabase SQL Editor to create all tables
-- =============================================================================

-- IDENTITY MODEL (accounts vs identity nodes)
--   contributors = accounts (people who log in and submit)
--   people        = identity nodes (anyone mentioned in a memory)
--   person_claims bridges them: contributor_id -> person_id
--   event_references links to people (preferred) or contributors (legacy)
-- Why separate?
--   - Anonymous submission (contributor exists, no person claim yet)
--   - Mentioning non-users (person exists, no contributor account)
--   - Deferred identity claiming ("that's me!" flow)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Contributors - people who share memories
CREATE TABLE contributors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  relation TEXT NOT NULL,  -- "sister", "cousin", "husband", "friend"
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ
);

-- People - identity nodes (separate from accounts)
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_name TEXT NOT NULL,
  visibility TEXT DEFAULT 'pending'
    CHECK (visibility IN ('pending', 'approved', 'anonymized', 'blurred', 'removed')),
  created_by UUID REFERENCES contributors(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT people_subject_name_check
    CHECK (
      lower(trim(canonical_name)) NOT IN (
        'val',
        'valerie',
        'valeri',
        'valera',
        'valeria',
        'valerius',
        'valerie anderson',
        'valerie park anderson'
      )
    )
);

-- Person aliases - name variants for search and matching
CREATE TABLE person_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  kind TEXT,
  created_by UUID REFERENCES contributors(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT person_aliases_subject_name_check
    CHECK (
      lower(trim(alias)) NOT IN (
        'val',
        'valerie',
        'valeri',
        'valera',
        'valeria',
        'valerius',
        'valerie anderson',
        'valerie park anderson'
      )
    )
);

-- Person claims - link identities to accounts
CREATE TABLE person_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES contributors(id),
  UNIQUE (person_id, contributor_id),
  UNIQUE (contributor_id)
);

-- Visibility preferences - per-person defaults and per-contributor trust
CREATE TABLE visibility_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  contributor_id UUID REFERENCES contributors(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL CHECK (visibility IN ('approved', 'blurred', 'anonymized', 'removed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (person_id, contributor_id)
);

-- Timeline events - the core content
CREATE TABLE timeline_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year INTEGER NOT NULL,
  date TEXT,  -- "October 13", "February 15"

  -- Content
  type TEXT NOT NULL CHECK (type IN ('origin', 'milestone', 'memory')),
  title TEXT NOT NULL,
  preview TEXT,
  full_entry TEXT,
  why_included TEXT,

  -- Source & Attribution
  source_url TEXT,
  source_name TEXT,
  contributor_id UUID REFERENCES contributors(id),

  -- Context
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  people_involved TEXT[],

  -- Admin & Privacy
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('published', 'pending', 'private')),
  privacy_level TEXT DEFAULT 'family' CHECK (privacy_level IN ('public', 'family')),

  -- Story chain: links to the event this is responding to
  prompted_by_event_id UUID REFERENCES timeline_events(id),
  trigger_event_id UUID REFERENCES timeline_events(id), -- Legacy alias for prompted_by_event_id
  root_event_id UUID REFERENCES timeline_events(id),
  chain_depth INTEGER DEFAULT 0,

  -- Timing flexibility
  timing_certainty TEXT DEFAULT 'approximate' CHECK (timing_certainty IN ('exact', 'approximate', 'vague')),
  timing_input_type TEXT DEFAULT 'year' CHECK (timing_input_type IN ('date', 'year', 'year_range', 'age_range', 'life_stage')),
  year_end INTEGER,
  age_start INTEGER,
  age_end INTEGER,
  life_stage TEXT CHECK (life_stage IN ('childhood', 'teens', 'college', 'young_family', 'beyond')),
  timing_note TEXT,
  timing_raw_text TEXT,

  -- Provenance (witnessing + recurrence)
  witness_type TEXT DEFAULT 'direct' CHECK (witness_type IN ('direct', 'secondhand', 'mixed', 'unsure')),
  recurrence TEXT DEFAULT 'one_time' CHECK (recurrence IN ('one_time', 'repeated', 'ongoing')),

  -- Family constellation
  subject_id UUID REFERENCES contributors(id)
);

-- Timeline event versions (audit trail for edits)
CREATE TABLE timeline_event_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES contributors(id) ON DELETE SET NULL,

  title TEXT,
  preview TEXT,
  full_entry TEXT,
  why_included TEXT,
  source_url TEXT,
  source_name TEXT,
  location TEXT,
  year INTEGER,
  year_end INTEGER,
  date TEXT,
  timing_certainty TEXT CHECK (timing_certainty IN ('exact', 'approximate', 'vague')),
  timing_input_type TEXT CHECK (timing_input_type IN ('date', 'year', 'year_range', 'age_range', 'life_stage')),
  age_start INTEGER,
  age_end INTEGER,
  life_stage TEXT CHECK (life_stage IN ('childhood', 'teens', 'college', 'young_family', 'beyond')),
  timing_note TEXT,
  timing_raw_text TEXT,
  witness_type TEXT CHECK (witness_type IN ('direct', 'secondhand', 'mixed', 'unsure')),
  recurrence TEXT CHECK (recurrence IN ('one_time', 'repeated', 'ongoing')),
  privacy_level TEXT CHECK (privacy_level IN ('public', 'family')),
  people_involved TEXT[],
  type TEXT CHECK (type IN ('origin', 'milestone', 'memory')),
  status TEXT CHECK (status IN ('published', 'pending', 'private')),

  UNIQUE (event_id, version)
);

-- Media attachments
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL CHECK (type IN ('photo', 'video', 'audio', 'document')),
  url TEXT NOT NULL,
  caption TEXT,
  year INTEGER,
  uploaded_by UUID REFERENCES contributors(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event media (many-to-many)
CREATE TABLE event_media (
  event_id UUID REFERENCES timeline_events(id) ON DELETE CASCADE,
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, media_id)
);

-- =============================================================================
-- SOCIAL / VIRAL FEATURES
-- =============================================================================

-- Witnesses - people who were present at a memory
CREATE TABLE witnesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES timeline_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_method TEXT CHECK (contact_method IN ('email', 'sms', 'link')),
  contact_info TEXT,
  status TEXT DEFAULT 'not-invited' CHECK (status IN ('not-invited', 'invited', 'viewed', 'contributed')),
  invited_at TIMESTAMPTZ,
  contributed_event_id UUID REFERENCES timeline_events(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invites - tracking outreach
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES timeline_events(id) ON DELETE CASCADE,
  recipient_name TEXT NOT NULL,
  recipient_contact TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('email', 'sms', 'link')),
  message TEXT,
  sender_id UUID REFERENCES contributors(id),

  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'opened', 'clicked', 'contributed')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  contributed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constellation members (her father, children, etc.)
CREATE TABLE constellation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  relation_to_subject TEXT NOT NULL,  -- "father", "son", "daughter"
  birth_year INTEGER,
  passing_year INTEGER,
  contributor_id UUID REFERENCES contributors(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edit tokens - magic links for editing submissions
CREATE TABLE edit_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,
  contributor_id UUID REFERENCES contributors(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES contributors(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('new-memory', 'witness-request', 'contribution-added', 'memory-approved')),
  title TEXT NOT NULL,
  body TEXT,
  related_event_id UUID REFERENCES timeline_events(id),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory threads (responses to memories)
CREATE TABLE memory_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_event_id UUID REFERENCES timeline_events(id) ON DELETE CASCADE,
  response_event_id UUID REFERENCES timeline_events(id) ON DELETE CASCADE,
  relationship TEXT CHECK (relationship IN ('perspective', 'addition', 'correction', 'related')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note mentions - detected name candidates (not people until promoted)
CREATE TABLE note_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  mention_text TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'context', 'ignored', 'promoted')),
  visibility TEXT NOT NULL DEFAULT 'pending'
    CHECK (visibility IN ('pending', 'approved', 'anonymized', 'blurred', 'removed')),
  display_label TEXT,
  source TEXT NOT NULL DEFAULT 'llm'
    CHECK (source IN ('llm', 'user')),
  created_by UUID REFERENCES contributors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  promoted_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  promoted_reference_id UUID REFERENCES event_references(id) ON DELETE SET NULL,
  CONSTRAINT note_mentions_subject_check
    CHECK (
      normalized_text NOT IN (
        'val',
        'valerie',
        'valeri',
        'valera',
        'valeria',
        'valerius',
        'valerie anderson',
        'valerie park anderson'
      )
    )
);

-- Event references - people and external sources that support a memory
CREATE TABLE event_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,

  -- Reference type: 'person' (family member) or 'link' (external URL)
  type TEXT NOT NULL CHECK (type IN ('person', 'link')),

  -- For 'person' type: links to contributors table
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Legacy link (kept for migration/backfill compatibility)
  contributor_id UUID REFERENCES contributors(id) ON DELETE SET NULL,

  -- For 'link' type: external URL reference
  url TEXT,
  display_name TEXT,

  -- Context for the reference (applies to both types)
  -- heard_from = "I heard this story from this person" (the original storyteller)
  -- witness = "This person was there" (corroboration)
  -- source = External factual source (Wikipedia, etc.)
  -- related = Related content (YouTube video, article)
  role TEXT CHECK (role IN ('heard_from', 'witness', 'source', 'related')),
  note TEXT,

  -- For person references: their relationship to the subject (Val)
  relationship_to_subject TEXT,

  -- Privacy control: how this reference should be displayed
  -- pending = shown anonymized until person decides
  -- approved = full name visible
  -- anonymized = show relationship only ("a cousin")
  -- blurred = show initials only ("S.M.")
  -- removed = reference not displayed
  visibility TEXT DEFAULT 'pending' CHECK (visibility IN ('pending', 'approved', 'anonymized', 'blurred', 'removed')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES contributors(id),

  -- Ensure person refs have person_id (or legacy contributor_id), link refs have url+display_name
  CONSTRAINT valid_person_ref CHECK (type != 'person' OR (person_id IS NOT NULL OR contributor_id IS NOT NULL)),
  CONSTRAINT valid_link_ref CHECK (type != 'link' OR (url IS NOT NULL AND display_name IS NOT NULL))
);

-- Motifs - recurring patterns across notes
CREATE TABLE motifs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  definition TEXT,
  created_by UUID REFERENCES contributors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'merged', 'deprecated')),
  merged_into_motif_id UUID REFERENCES motifs(id) ON DELETE SET NULL
);

-- Motif links - evidence edges between motifs and notes
CREATE TABLE motif_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  motif_id UUID NOT NULL REFERENCES motifs(id) ON DELETE RESTRICT,
  note_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE RESTRICT,
  link_type TEXT NOT NULL DEFAULT 'supports' CHECK (link_type IN ('supports', 'contrasts', 'contextualizes')),
  link_confidence SMALLINT NOT NULL DEFAULT 3 CHECK (link_confidence BETWEEN 1 AND 5),
  created_by UUID REFERENCES contributors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  asserted_by TEXT NOT NULL DEFAULT 'curator' CHECK (asserted_by IN ('system', 'curator', 'contributor')),
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  UNIQUE (motif_id, note_id, link_type)
);

-- View specs - projection metadata
CREATE TABLE view_specs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  projection_version TEXT NOT NULL DEFAULT 'v1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- VIEWS (CONVENIENCE ALIASES)
-- =============================================================================

CREATE OR REPLACE VIEW notes AS
  SELECT * FROM timeline_events;

CREATE OR REPLACE VIEW note_references AS
  SELECT * FROM event_references;

CREATE OR REPLACE VIEW note_threads AS
  SELECT * FROM memory_threads;

CREATE OR REPLACE VIEW current_notes AS
SELECT
  te.id,
  COALESCE(tev.year, te.year) AS year,
  COALESCE(tev.date, te.date) AS date,
  COALESCE(tev.type, te.type) AS type,
  COALESCE(tev.title, te.title) AS title,
  COALESCE(tev.preview, te.preview) AS preview,
  COALESCE(tev.full_entry, te.full_entry) AS full_entry,
  COALESCE(tev.why_included, te.why_included) AS why_included,
  COALESCE(tev.source_url, te.source_url) AS source_url,
  COALESCE(tev.source_name, te.source_name) AS source_name,
  te.contributor_id,
  COALESCE(tev.location, te.location) AS location,
  te.latitude,
  te.longitude,
  COALESCE(tev.people_involved, te.people_involved) AS people_involved,
  te.created_at,
  COALESCE(tev.status, te.status) AS status,
  COALESCE(tev.privacy_level, te.privacy_level) AS privacy_level,
  te.prompted_by_event_id,
  te.trigger_event_id,
  te.root_event_id,
  te.chain_depth,
  COALESCE(tev.timing_certainty, te.timing_certainty) AS timing_certainty,
  COALESCE(tev.timing_input_type, te.timing_input_type) AS timing_input_type,
  COALESCE(tev.year_end, te.year_end) AS year_end,
  COALESCE(tev.age_start, te.age_start) AS age_start,
  COALESCE(tev.age_end, te.age_end) AS age_end,
  COALESCE(tev.life_stage, te.life_stage) AS life_stage,
  COALESCE(tev.timing_note, te.timing_note) AS timing_note,
  COALESCE(tev.timing_raw_text, te.timing_raw_text) AS timing_raw_text,
  COALESCE(tev.witness_type, te.witness_type) AS witness_type,
  COALESCE(tev.recurrence, te.recurrence) AS recurrence,
  te.subject_id,
  tev.version AS version,
  tev.created_at AS version_created_at,
  tev.created_by AS version_created_by
FROM timeline_events te
LEFT JOIN LATERAL (
  SELECT *
  FROM timeline_event_versions
  WHERE event_id = te.id
  ORDER BY version DESC
  LIMIT 1
) tev ON true;

COMMENT ON VIEW notes IS 'Alias for timeline_events (Note records).';
COMMENT ON VIEW note_references IS 'Alias for event_references (provenance/chain).';
COMMENT ON VIEW note_threads IS 'Alias for memory_threads (parallel notes).';
COMMENT ON VIEW current_notes IS 'Latest version per note (timeline_event_versions + timeline_events).';

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_trigger_event_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.trigger_event_id := NEW.prompted_by_event_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION record_timeline_event_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_version INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.title IS NOT DISTINCT FROM OLD.title
      AND NEW.preview IS NOT DISTINCT FROM OLD.preview
      AND NEW.full_entry IS NOT DISTINCT FROM OLD.full_entry
      AND NEW.why_included IS NOT DISTINCT FROM OLD.why_included
      AND NEW.source_url IS NOT DISTINCT FROM OLD.source_url
      AND NEW.source_name IS NOT DISTINCT FROM OLD.source_name
      AND NEW.location IS NOT DISTINCT FROM OLD.location
      AND NEW.year IS NOT DISTINCT FROM OLD.year
      AND NEW.year_end IS NOT DISTINCT FROM OLD.year_end
      AND NEW.date IS NOT DISTINCT FROM OLD.date
      AND NEW.timing_certainty IS NOT DISTINCT FROM OLD.timing_certainty
      AND NEW.timing_input_type IS NOT DISTINCT FROM OLD.timing_input_type
      AND NEW.age_start IS NOT DISTINCT FROM OLD.age_start
      AND NEW.age_end IS NOT DISTINCT FROM OLD.age_end
      AND NEW.life_stage IS NOT DISTINCT FROM OLD.life_stage
      AND NEW.timing_note IS NOT DISTINCT FROM OLD.timing_note
      AND NEW.timing_raw_text IS NOT DISTINCT FROM OLD.timing_raw_text
      AND NEW.witness_type IS NOT DISTINCT FROM OLD.witness_type
      AND NEW.recurrence IS NOT DISTINCT FROM OLD.recurrence
      AND NEW.privacy_level IS NOT DISTINCT FROM OLD.privacy_level
      AND NEW.people_involved IS NOT DISTINCT FROM OLD.people_involved
      AND NEW.type IS NOT DISTINCT FROM OLD.type
      AND NEW.status IS NOT DISTINCT FROM OLD.status
    THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1
    INTO next_version
  FROM timeline_event_versions
  WHERE event_id = NEW.id;

  INSERT INTO timeline_event_versions (
    event_id,
    version,
    created_by,
    title,
    preview,
    full_entry,
    why_included,
    source_url,
    source_name,
    location,
    year,
    year_end,
    date,
    timing_certainty,
    timing_input_type,
    age_start,
    age_end,
    life_stage,
    timing_note,
    timing_raw_text,
    witness_type,
    recurrence,
    privacy_level,
    people_involved,
    type,
    status
  ) VALUES (
    NEW.id,
    next_version,
    NEW.contributor_id,
    NEW.title,
    NEW.preview,
    NEW.full_entry,
    NEW.why_included,
    NEW.source_url,
    NEW.source_name,
    NEW.location,
    NEW.year,
    NEW.year_end,
    NEW.date,
    NEW.timing_certainty,
    NEW.timing_input_type,
    NEW.age_start,
    NEW.age_end,
    NEW.life_stage,
    NEW.timing_note,
    NEW.timing_raw_text,
    NEW.witness_type,
    NEW.recurrence,
    NEW.privacy_level,
    NEW.people_involved,
    NEW.type,
    NEW.status
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION lint_note(note_body TEXT)
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

  IF lower_body ~ trait_regex THEN
    severity := CASE WHEN lower_body ~ trait_hedge_regex THEN 'soft' ELSE 'strong' END;
    matched_text := btrim(coalesce(substring(note_body from '(?i)' || trait_regex), substring(lower_body from trait_regex)));
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'TRAIT_LABEL',
      'message', 'Try describing a moment that shows this, rather than a label.',
      'suggestion', 'Rewrite as: “One time when …, she …” or “When ___ happened, she …”.',
      'severity', severity,
      'match', matched_text
    ));
  END IF;

  IF lower_body ~ meaning_regex THEN
    severity := CASE WHEN lower_body ~ meaning_hedge_regex THEN 'soft' ELSE 'strong' END;
    matched_text := btrim(coalesce(substring(note_body from '(?i)' || meaning_regex), substring(lower_body from meaning_regex)));
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'MEANING_ASSERTION',
      'message', 'Avoid “this shows/proves…”; describe what happened and let meaning emerge.',
      'suggestion', 'Remove the “this shows…” clause and add concrete detail.',
      'severity', severity,
      'match', matched_text
    ));
  END IF;

  IF lower_body ~ consensus_regex THEN
    severity := CASE WHEN lower_body ~ consensus_hedge_regex THEN 'soft' ELSE 'strong' END;
    matched_text := btrim(coalesce(substring(note_body from '(?i)' || consensus_regex), substring(lower_body from consensus_regex)));
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'CONSENSUS_CLAIM',
      'message', 'Speak from your own experience rather than for others.',
      'suggestion', 'Rewrite with “I” and a specific context.',
      'severity', severity,
      'match', matched_text
    ));
  END IF;

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

  IF lower_body ~ contradiction_regex THEN
    severity := CASE WHEN lower_body ~ contradiction_hedge_regex THEN 'soft' ELSE 'strong' END;
    matched_text := btrim(coalesce(substring(note_body from '(?i)' || contradiction_regex), substring(lower_body from contradiction_regex)));
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code', 'CONTRADICTION_POLICING',
      'message', 'Don’t rebut other memories in the public note. Use private context if needed.',
      'suggestion', 'Rewrite as your own memory: “In my experience …”',
      'severity', severity,
      'match', matched_text
    ));
  END IF;

  RETURN warnings;
END;
$$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

DROP TRIGGER IF EXISTS trg_sync_trigger_event_id ON timeline_events;
CREATE TRIGGER trg_sync_trigger_event_id
BEFORE INSERT OR UPDATE ON timeline_events
FOR EACH ROW
EXECUTE FUNCTION sync_trigger_event_id();

DROP TRIGGER IF EXISTS trg_record_timeline_event_version ON timeline_events;
CREATE TRIGGER trg_record_timeline_event_version
AFTER INSERT OR UPDATE ON timeline_events
FOR EACH ROW
EXECUTE FUNCTION record_timeline_event_version();

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_events_year ON timeline_events(year);
CREATE INDEX idx_events_type ON timeline_events(type);
CREATE INDEX idx_events_status ON timeline_events(status);
CREATE INDEX idx_events_coordinates ON timeline_events(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX idx_events_contributor ON timeline_events(contributor_id);
CREATE INDEX idx_events_life_stage ON timeline_events(life_stage);
CREATE INDEX idx_events_timing_certainty ON timeline_events(timing_certainty);
CREATE INDEX idx_events_subject ON timeline_events(subject_id);
CREATE INDEX idx_events_root ON timeline_events(root_event_id);
CREATE INDEX idx_events_chain_depth ON timeline_events(chain_depth);
CREATE INDEX idx_event_versions_event_id ON timeline_event_versions(event_id);
CREATE INDEX idx_event_versions_event_id_version ON timeline_event_versions(event_id, version);
CREATE INDEX idx_people_visibility ON people(visibility);
CREATE INDEX idx_people_created_by ON people(created_by);
CREATE INDEX idx_person_aliases_person ON person_aliases(person_id);
CREATE INDEX idx_person_aliases_alias ON person_aliases(alias);
CREATE INDEX idx_person_claims_person ON person_claims(person_id);
CREATE INDEX idx_person_claims_contributor ON person_claims(contributor_id);
CREATE INDEX idx_visibility_preferences_person ON visibility_preferences(person_id);
CREATE INDEX idx_visibility_preferences_contributor ON visibility_preferences(contributor_id) WHERE contributor_id IS NOT NULL;
CREATE UNIQUE INDEX idx_visibility_preferences_person_default ON visibility_preferences(person_id)
WHERE contributor_id IS NULL;
CREATE INDEX idx_witnesses_event ON witnesses(event_id);
CREATE INDEX idx_witnesses_status ON witnesses(status);
CREATE INDEX idx_invites_status ON invites(status);
CREATE INDEX idx_edit_tokens_token ON edit_tokens(token);
CREATE INDEX idx_edit_tokens_contributor ON edit_tokens(contributor_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE NOT read;
CREATE INDEX idx_references_event ON event_references(event_id);
CREATE INDEX idx_references_contributor ON event_references(contributor_id);
CREATE INDEX idx_references_type ON event_references(type);
CREATE INDEX idx_references_visibility ON event_references(visibility);
CREATE INDEX idx_references_person ON event_references(person_id);
CREATE UNIQUE INDEX idx_note_mentions_event_norm_source ON note_mentions(event_id, normalized_text, source);
CREATE INDEX idx_note_mentions_event ON note_mentions(event_id);
CREATE INDEX idx_note_mentions_status ON note_mentions(status);
CREATE INDEX idx_events_prompted_by ON timeline_events(prompted_by_event_id);
CREATE INDEX idx_memory_threads_original ON memory_threads(original_event_id);
CREATE INDEX idx_memory_threads_response ON memory_threads(response_event_id);
CREATE UNIQUE INDEX idx_motifs_label_active ON motifs (lower(label)) WHERE status = 'active';
CREATE INDEX idx_motif_links_motif_id ON motif_links(motif_id) WHERE status = 'active';
CREATE INDEX idx_motif_links_note_id ON motif_links(note_id) WHERE status = 'active';

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE visibility_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE witnesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE edit_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE constellation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_event_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE motifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE motif_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_specs ENABLE ROW LEVEL SECURITY;

-- Public read access for published events
CREATE POLICY "Public can read published events" ON timeline_events
  FOR SELECT USING (status = 'published');

-- Public read access for contributors (names only via join)
CREATE POLICY "Public can read contributors" ON contributors
  FOR SELECT USING (true);

-- Public read access for event references (excludes removed)
-- Note: Masking (pending/anonymized/blurred) is handled at the application layer
CREATE POLICY "Public can read visible references" ON event_references
  FOR SELECT USING (visibility IS NULL OR visibility != 'removed');

-- Public read access for constellation
CREATE POLICY "Public can read constellation" ON constellation_members
  FOR SELECT USING (true);

CREATE POLICY "Public can read active motifs" ON motifs
  FOR SELECT USING (status = 'active');

CREATE POLICY "Public can read active motif links" ON motif_links
  FOR SELECT USING (status = 'active');

CREATE POLICY "Public can read view specs" ON view_specs
  FOR SELECT USING (true);

-- =============================================================================
-- PRIVILEGES
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON TABLE
  contributors,
  timeline_events,
  motifs,
  motif_links,
  view_specs,
  media,
  event_media,
  event_references,
  constellation_members,
  notes,
  current_notes,
  note_references,
  note_threads
TO anon, authenticated;

GRANT ALL ON TABLE
  contributors,
  people,
  person_aliases,
  person_claims,
  visibility_preferences,
  timeline_events,
  timeline_event_versions,
  motifs,
  motif_links,
  view_specs,
  media,
  event_media,
  witnesses,
  invites,
  edit_tokens,
  notifications,
  constellation_members,
  memory_threads,
  note_mentions,
  event_references,
  notes,
  current_notes,
  note_references,
  note_threads
TO service_role;

GRANT EXECUTE ON FUNCTION lint_note(TEXT) TO anon, authenticated, service_role;
