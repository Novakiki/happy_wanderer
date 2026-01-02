-- View for latest note versions (shared read shape)
-- Ensure coordinate columns exist (some environments haven't run 006_add_coordinates.sql)
ALTER TABLE timeline_events
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_events_coordinates ON timeline_events(latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

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

COMMENT ON VIEW current_notes IS 'Latest version per note (timeline_event_versions + timeline_events).';

GRANT SELECT ON TABLE current_notes TO anon, authenticated;
