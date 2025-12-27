-- Add story attribution fields and update reference roles

ALTER TABLE timeline_events
  ADD COLUMN IF NOT EXISTS prompted_by_event_id UUID REFERENCES timeline_events(id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_references_role_check'
      AND conrelid = 'event_references'::regclass
  ) THEN
    ALTER TABLE event_references DROP CONSTRAINT event_references_role_check;
  END IF;
END $$;

UPDATE event_references
SET role = 'witness'
WHERE role = 'corroborated';

UPDATE event_references
SET role = 'related'
WHERE role IN ('expanded', 'provided');

ALTER TABLE event_references
  ADD CONSTRAINT event_references_role_check
  CHECK (role IN ('heard_from', 'witness', 'source', 'related'));
