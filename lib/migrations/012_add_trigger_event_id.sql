-- Add trigger_event_id to track which note/page prompted a new note submission
DO $$
BEGIN
  -- Add the column only if it truly does not exist (defensive for environments
  -- where the column was added manually or via schema.sql).
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'timeline_events'
      AND column_name = 'trigger_event_id'
  ) THEN
    ALTER TABLE timeline_events
    ADD COLUMN trigger_event_id UUID REFERENCES timeline_events(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_timeline_events_trigger_event_id
  ON timeline_events(trigger_event_id);
