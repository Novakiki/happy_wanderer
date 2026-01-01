-- Ensure trigger_event_id foreign key exists with expected constraint name
DO $$
DECLARE
  existing_fk TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'timeline_events'
      AND column_name = 'trigger_event_id'
  ) THEN
    ALTER TABLE timeline_events
    ADD COLUMN trigger_event_id UUID;
  END IF;

  SELECT conname INTO existing_fk
  FROM pg_constraint
  JOIN pg_attribute
    ON pg_attribute.attrelid = conrelid
   AND pg_attribute.attnum = ANY (conkey)
  WHERE conrelid = 'timeline_events'::regclass
    AND contype = 'f'
    AND pg_attribute.attname = 'trigger_event_id'
  LIMIT 1;

  IF existing_fk IS NULL THEN
    ALTER TABLE timeline_events
      ADD CONSTRAINT timeline_events_trigger_event_id_fkey
      FOREIGN KEY (trigger_event_id) REFERENCES timeline_events(id);
  ELSIF existing_fk <> 'timeline_events_trigger_event_id_fkey' THEN
    EXECUTE format(
      'ALTER TABLE timeline_events RENAME CONSTRAINT %I TO timeline_events_trigger_event_id_fkey',
      existing_fk
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_timeline_events_trigger_event_id
  ON timeline_events(trigger_event_id);

-- Refresh PostgREST schema cache so relationship hints resolve immediately.
NOTIFY pgrst, 'reload schema';
