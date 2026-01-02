-- Sync prompted_by_event_id to trigger_event_id and record immutable versions
CREATE OR REPLACE FUNCTION public.sync_trigger_event_id()
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

DROP TRIGGER IF EXISTS trg_sync_trigger_event_id ON timeline_events;
CREATE TRIGGER trg_sync_trigger_event_id
BEFORE INSERT OR UPDATE ON timeline_events
FOR EACH ROW
EXECUTE FUNCTION public.sync_trigger_event_id();

CREATE OR REPLACE FUNCTION public.record_timeline_event_version()
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

DROP TRIGGER IF EXISTS trg_record_timeline_event_version ON timeline_events;
CREATE TRIGGER trg_record_timeline_event_version
AFTER INSERT OR UPDATE ON timeline_events
FOR EACH ROW
EXECUTE FUNCTION public.record_timeline_event_version();
