-- Add enum-like constraints to timeline_event_versions for consistency with timeline_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timeline_event_versions_type_check'
  ) THEN
    ALTER TABLE timeline_event_versions
      ADD CONSTRAINT timeline_event_versions_type_check
      CHECK (type IN ('origin', 'milestone', 'memory'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timeline_event_versions_status_check'
  ) THEN
    ALTER TABLE timeline_event_versions
      ADD CONSTRAINT timeline_event_versions_status_check
      CHECK (status IN ('published', 'pending', 'private'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timeline_event_versions_privacy_level_check'
  ) THEN
    ALTER TABLE timeline_event_versions
      ADD CONSTRAINT timeline_event_versions_privacy_level_check
      CHECK (privacy_level IN ('public', 'family'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timeline_event_versions_timing_certainty_check'
  ) THEN
    ALTER TABLE timeline_event_versions
      ADD CONSTRAINT timeline_event_versions_timing_certainty_check
      CHECK (timing_certainty IN ('exact', 'approximate', 'vague'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timeline_event_versions_timing_input_type_check'
  ) THEN
    ALTER TABLE timeline_event_versions
      ADD CONSTRAINT timeline_event_versions_timing_input_type_check
      CHECK (timing_input_type IN ('date', 'year', 'year_range', 'age_range', 'life_stage'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timeline_event_versions_life_stage_check'
  ) THEN
    ALTER TABLE timeline_event_versions
      ADD CONSTRAINT timeline_event_versions_life_stage_check
      CHECK (life_stage IN ('childhood', 'teens', 'college', 'young_family', 'beyond'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timeline_event_versions_witness_type_check'
  ) THEN
    ALTER TABLE timeline_event_versions
      ADD CONSTRAINT timeline_event_versions_witness_type_check
      CHECK (witness_type IN ('direct', 'secondhand', 'mixed', 'unsure'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'timeline_event_versions_recurrence_check'
  ) THEN
    ALTER TABLE timeline_event_versions
      ADD CONSTRAINT timeline_event_versions_recurrence_check
      CHECK (recurrence IN ('one_time', 'repeated', 'ongoing'));
  END IF;
END $$;
