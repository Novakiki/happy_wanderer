-- Add event versioning and timing provenance fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'timeline_events'
      AND column_name = 'witness_type'
  ) THEN
    ALTER TABLE timeline_events
      ADD COLUMN witness_type TEXT DEFAULT 'direct';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'timeline_events'
      AND column_name = 'recurrence'
  ) THEN
    ALTER TABLE timeline_events
      ADD COLUMN recurrence TEXT DEFAULT 'one_time';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'timeline_events'
      AND column_name = 'timing_raw_text'
  ) THEN
    ALTER TABLE timeline_events
      ADD COLUMN timing_raw_text TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'timeline_events_witness_type_check'
  ) THEN
    ALTER TABLE timeline_events
      ADD CONSTRAINT timeline_events_witness_type_check
      CHECK (witness_type IN ('direct', 'secondhand', 'mixed', 'unsure'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'timeline_events_recurrence_check'
  ) THEN
    ALTER TABLE timeline_events
      ADD CONSTRAINT timeline_events_recurrence_check
      CHECK (recurrence IN ('one_time', 'repeated', 'ongoing'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS timeline_event_versions (
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
  timing_certainty TEXT,
  timing_input_type TEXT,
  age_start INTEGER,
  age_end INTEGER,
  life_stage TEXT,
  timing_note TEXT,
  timing_raw_text TEXT,
  witness_type TEXT,
  recurrence TEXT,
  privacy_level TEXT,
  people_involved TEXT[],
  type TEXT,
  status TEXT,

  UNIQUE (event_id, version)
);

CREATE INDEX IF NOT EXISTS idx_event_versions_event_id
  ON timeline_event_versions(event_id);

CREATE INDEX IF NOT EXISTS idx_event_versions_event_id_version
  ON timeline_event_versions(event_id, version);

ALTER TABLE timeline_event_versions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE timeline_event_versions TO service_role;

ALTER TABLE timeline_event_versions
  ADD COLUMN IF NOT EXISTS witness_type TEXT;

ALTER TABLE timeline_event_versions
  ADD COLUMN IF NOT EXISTS recurrence TEXT;

-- Backfill version 1 for existing events
INSERT INTO timeline_event_versions (
  event_id,
  version,
  created_at,
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
)
SELECT
  te.id,
  1,
  te.created_at,
  te.contributor_id,
  te.title,
  te.preview,
  te.full_entry,
  te.why_included,
  te.source_url,
  te.source_name,
  te.location,
  te.year,
  te.year_end,
  te.date,
  te.timing_certainty,
  te.timing_input_type,
  te.age_start,
  te.age_end,
  te.life_stage,
  te.timing_note,
  te.timing_raw_text,
  te.witness_type,
  te.recurrence,
  te.privacy_level,
  te.people_involved,
  te.type,
  te.status
FROM timeline_events te
WHERE NOT EXISTS (
  SELECT 1
  FROM timeline_event_versions tev
  WHERE tev.event_id = te.id
    AND tev.version = 1
);
