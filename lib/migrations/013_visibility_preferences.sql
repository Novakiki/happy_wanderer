-- Migration: visibility_preferences
-- Purpose: Store per-contributor trust settings for identity visibility
--
-- This enables:
-- 1. Global default visibility for a person (contributor_id = NULL)
-- 2. Per-contributor trust (e.g., "show my full name on all notes by Julie")
--
-- Resolution order:
-- 1. Per-note override (event_references.visibility)
-- 2. Per-contributor preference (visibility_preferences with contributor_id)
-- 3. Global default (visibility_preferences with contributor_id = NULL)
-- 4. Person's default (people.visibility)

CREATE TABLE IF NOT EXISTS visibility_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Who is being mentioned (the person controlling their visibility)
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  -- Who they trust (NULL = global default for all contributors)
  contributor_id UUID REFERENCES contributors(id) ON DELETE CASCADE,

  -- Their visibility preference
  visibility TEXT NOT NULL CHECK (visibility IN ('approved', 'blurred', 'anonymized', 'removed')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One preference per person-contributor pair (or one global per person)
  UNIQUE(person_id, contributor_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_visibility_preferences_person
  ON visibility_preferences(person_id);
CREATE INDEX IF NOT EXISTS idx_visibility_preferences_contributor
  ON visibility_preferences(contributor_id) WHERE contributor_id IS NOT NULL;

-- Comment for documentation
COMMENT ON TABLE visibility_preferences IS
  'Stores visibility preferences for people mentioned in notes. contributor_id=NULL means global default.';
