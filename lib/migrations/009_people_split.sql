-- =============================================================================
-- Migration 009: People Split
-- Separates identity (people) from accounts (contributors)
-- =============================================================================

-- People - identity nodes (private, masked by visibility rules)
CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_name TEXT NOT NULL,
  visibility TEXT DEFAULT 'pending'
    CHECK (visibility IN ('pending', 'approved', 'anonymized', 'blurred', 'removed')),
  created_by UUID REFERENCES contributors(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Person aliases - name variants for search and matching
CREATE TABLE IF NOT EXISTS person_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  kind TEXT,
  created_by UUID REFERENCES contributors(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Person claims - link identities to accounts
CREATE TABLE IF NOT EXISTS person_claims (
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

-- Event references now link to people (person_id)
ALTER TABLE event_references
  ADD COLUMN IF NOT EXISTS person_id UUID REFERENCES people(id) ON DELETE SET NULL;

-- Update constraints to allow person_id in place of contributor_id
ALTER TABLE event_references
  DROP CONSTRAINT IF EXISTS valid_person_ref;
ALTER TABLE event_references
  DROP CONSTRAINT IF EXISTS valid_link_ref;

ALTER TABLE event_references
  ADD CONSTRAINT valid_person_ref
    CHECK (type != 'person' OR person_id IS NOT NULL OR contributor_id IS NOT NULL),
  ADD CONSTRAINT valid_link_ref
    CHECK (type != 'link' OR (url IS NOT NULL AND display_name IS NOT NULL));

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_people_visibility ON people(visibility);
CREATE INDEX IF NOT EXISTS idx_people_created_by ON people(created_by);
CREATE INDEX IF NOT EXISTS idx_person_aliases_person ON person_aliases(person_id);
CREATE INDEX IF NOT EXISTS idx_person_aliases_alias ON person_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_person_claims_person ON person_claims(person_id);
CREATE INDEX IF NOT EXISTS idx_person_claims_contributor ON person_claims(contributor_id);
CREATE INDEX IF NOT EXISTS idx_references_person ON event_references(person_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_claims ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PRIVILEGES
-- =============================================================================

GRANT ALL ON TABLE
  people,
  person_aliases,
  person_claims
TO service_role;
