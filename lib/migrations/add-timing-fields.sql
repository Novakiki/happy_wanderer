-- =============================================================================
-- Add timing flexibility fields to timeline_events
-- Run this in Supabase SQL Editor
-- =============================================================================

-- Timing certainty: how confident is the contributor about when this happened?
-- 'exact' = specific date/year known
-- 'approximate' = rough idea (default for most memories)
-- 'vague' = uncertain, just a life stage
ALTER TABLE timeline_events
ADD COLUMN IF NOT EXISTS timing_certainty TEXT
DEFAULT 'approximate'
CHECK (timing_certainty IN ('exact', 'approximate', 'vague'));

-- How the timing was provided
-- 'date' = full date given
-- 'year' = just a year
-- 'year_range' = span of years (e.g., 1985-1990)
-- 'age_range' = age of subject (e.g., 10-15)
-- 'life_stage' = childhood, teens, etc.
ALTER TABLE timeline_events
ADD COLUMN IF NOT EXISTS timing_input_type TEXT
DEFAULT 'year'
CHECK (timing_input_type IN ('date', 'year', 'year_range', 'age_range', 'life_stage'));

-- For ranges: end year (start year uses existing 'year' column)
ALTER TABLE timeline_events
ADD COLUMN IF NOT EXISTS year_end INTEGER;

-- For age-based input
ALTER TABLE timeline_events
ADD COLUMN IF NOT EXISTS age_start INTEGER;

ALTER TABLE timeline_events
ADD COLUMN IF NOT EXISTS age_end INTEGER;

-- Life stage (maps to year ranges via app logic)
ALTER TABLE timeline_events
ADD COLUMN IF NOT EXISTS life_stage TEXT
CHECK (life_stage IN ('childhood', 'teens', 'college', 'young_family', 'beyond'));

-- Optional timing note from contributor
ALTER TABLE timeline_events
ADD COLUMN IF NOT EXISTS timing_note TEXT;

-- =============================================================================
-- Family Constellation: link memories across people
-- =============================================================================

-- Subject of the memory (for constellation feature)
-- NULL = Valerie (default subject)
-- Otherwise references a constellation member
ALTER TABLE timeline_events
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES contributors(id);

-- Constellation members (her father, children, etc.)
CREATE TABLE IF NOT EXISTS constellation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  relation_to_subject TEXT NOT NULL,  -- "father", "son", "daughter"
  birth_year INTEGER,
  passing_year INTEGER,
  contributor_id UUID REFERENCES contributors(id),  -- links to their contributor record if they're also a contributor
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE constellation_members ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read constellation" ON constellation_members
  FOR SELECT USING (true);

-- Service role full access
GRANT ALL ON TABLE constellation_members TO service_role;
GRANT SELECT ON TABLE constellation_members TO anon, authenticated;

-- =============================================================================
-- Indexes for new fields
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_events_life_stage ON timeline_events(life_stage);
CREATE INDEX IF NOT EXISTS idx_events_timing_certainty ON timeline_events(timing_certainty);
CREATE INDEX IF NOT EXISTS idx_events_subject ON timeline_events(subject_id);

-- =============================================================================
-- Update existing events to have default timing values
-- =============================================================================

-- Set all existing events with contributor_id to 'approximate' certainty
UPDATE timeline_events
SET timing_certainty = 'approximate', timing_input_type = 'year'
WHERE timing_certainty IS NULL;

-- Origins/anchors with specific dates are 'exact'
UPDATE timeline_events
SET timing_certainty = 'exact'
WHERE type IN ('origin', 'milestone') AND date IS NOT NULL;
