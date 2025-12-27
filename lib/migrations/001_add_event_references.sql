-- =============================================================================
-- Migration: Add event_references table
-- Run this in Supabase SQL Editor
-- =============================================================================

-- Event references - people and external sources that support a memory
CREATE TABLE IF NOT EXISTS event_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,

  -- Reference type: 'person' (family member) or 'link' (external URL)
  type TEXT NOT NULL CHECK (type IN ('person', 'link')),

  -- For 'person' type: links to contributors table
  contributor_id UUID REFERENCES contributors(id) ON DELETE SET NULL,

  -- For 'link' type: external URL reference
  url TEXT,
  display_name TEXT,

  -- Context for the reference (applies to both types)
  role TEXT CHECK (role IN ('corroborated', 'expanded', 'provided', 'source', 'related')),
  note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES contributors(id),

  -- Ensure person refs have contributor_id, link refs have url+display_name
  CONSTRAINT valid_person_ref CHECK (type != 'person' OR contributor_id IS NOT NULL),
  CONSTRAINT valid_link_ref CHECK (type != 'link' OR (url IS NOT NULL AND display_name IS NOT NULL))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_references_event ON event_references(event_id);
CREATE INDEX IF NOT EXISTS idx_references_contributor ON event_references(contributor_id);
CREATE INDEX IF NOT EXISTS idx_references_type ON event_references(type);

-- RLS
ALTER TABLE event_references ENABLE ROW LEVEL SECURITY;

-- Public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'event_references'
      AND policyname = 'Public can read references'
  ) THEN
    CREATE POLICY "Public can read references" ON event_references
      FOR SELECT USING (true);
  END IF;
END $$;

-- Grants
GRANT SELECT ON TABLE event_references TO anon, authenticated;
GRANT ALL ON TABLE event_references TO service_role;

-- =============================================================================
-- Migrate existing source_url/source_name data to references
-- =============================================================================

-- Get Amy's contributor ID for added_by
DO $$
DECLARE
  amy_id UUID;
BEGIN
  SELECT id INTO amy_id FROM contributors WHERE name ILIKE 'Amy' LIMIT 1;

  -- Migrate existing sources from timeline_events to event_references
  INSERT INTO event_references (event_id, type, url, display_name, role, added_by)
  SELECT
    id,
    'link',
    source_url,
    source_name,
    'source',
    amy_id
  FROM timeline_events
  WHERE source_url IS NOT NULL
    AND source_url != ''
    AND NOT EXISTS (
      SELECT 1 FROM event_references er
      WHERE er.event_id = timeline_events.id
        AND er.url = timeline_events.source_url
    );
END $$;

-- Add the Happy Wanderer YouTube link if not already present
DO $$
DECLARE
  amy_id UUID;
  happy_wanderer_id UUID;
BEGIN
  SELECT id INTO amy_id FROM contributors WHERE name ILIKE 'Amy' LIMIT 1;
  SELECT id INTO happy_wanderer_id FROM timeline_events WHERE title = 'Happy Wanderer' LIMIT 1;

  IF happy_wanderer_id IS NOT NULL THEN
    INSERT INTO event_references (event_id, type, url, display_name, role, added_by)
    SELECT
      happy_wanderer_id,
      'link',
      'https://www.youtube.com/watch?v=irInmv--DlE',
      'Listen to the song',
      'related',
      amy_id
    WHERE NOT EXISTS (
      SELECT 1 FROM event_references
      WHERE event_id = happy_wanderer_id
        AND url = 'https://www.youtube.com/watch?v=irInmv--DlE'
    );
  END IF;
END $$;
