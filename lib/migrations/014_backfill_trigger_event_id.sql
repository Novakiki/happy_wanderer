-- Backfill trigger_event_id from prompted_by_event_id where missing
UPDATE timeline_events
SET trigger_event_id = prompted_by_event_id
WHERE trigger_event_id IS NULL
  AND prompted_by_event_id IS NOT NULL;
