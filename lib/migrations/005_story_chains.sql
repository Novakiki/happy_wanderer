-- =============================================================================
-- Story Chains: Add root_event_id and chain_depth for grouping related notes
-- Run in Supabase SQL Editor.
-- =============================================================================

-- 1) Add columns for story chain tracking
ALTER TABLE timeline_events
  ADD COLUMN IF NOT EXISTS root_event_id UUID REFERENCES timeline_events(id),
  ADD COLUMN IF NOT EXISTS chain_depth INTEGER DEFAULT 0;

-- 2) Backfill: all standalone events are their own root
UPDATE timeline_events
SET root_event_id = id, chain_depth = 0
WHERE root_event_id IS NULL AND prompted_by_event_id IS NULL;

-- 3) Backfill: events with prompted_by_event_id inherit root from parent
-- This handles depth=1 cases (direct responses)
UPDATE timeline_events child
SET
  root_event_id = COALESCE(parent.root_event_id, parent.id),
  chain_depth = COALESCE(parent.chain_depth, 0) + 1
FROM timeline_events parent
WHERE child.prompted_by_event_id = parent.id
  AND child.root_event_id IS NULL;

-- 4) Handle deeper chains (depth=2+) with recursive update
-- Run multiple times if you have chains deeper than 2
DO $$
DECLARE
  updated_count INTEGER := 1;
  iterations INTEGER := 0;
BEGIN
  WHILE updated_count > 0 AND iterations < 10 LOOP
    WITH to_update AS (
      SELECT
        child.id AS child_id,
        COALESCE(parent.root_event_id, parent.id) AS new_root,
        COALESCE(parent.chain_depth, 0) + 1 AS new_depth
      FROM timeline_events child
      JOIN timeline_events parent ON child.prompted_by_event_id = parent.id
      WHERE child.root_event_id IS NULL
        AND parent.root_event_id IS NOT NULL
    )
    UPDATE timeline_events
    SET root_event_id = to_update.new_root, chain_depth = to_update.new_depth
    FROM to_update
    WHERE timeline_events.id = to_update.child_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    iterations := iterations + 1;
  END LOOP;
END $$;

-- 5) Final fallback: any remaining events without root become their own root
UPDATE timeline_events
SET root_event_id = id, chain_depth = 0
WHERE root_event_id IS NULL;

-- 6) Add indexes for efficient grouping
CREATE INDEX IF NOT EXISTS idx_events_root ON timeline_events(root_event_id);
CREATE INDEX IF NOT EXISTS idx_events_chain_depth ON timeline_events(chain_depth);

-- 7) Add constraint: root_event_id should always be set
ALTER TABLE timeline_events
  ALTER COLUMN root_event_id SET DEFAULT NULL;

COMMENT ON COLUMN timeline_events.root_event_id IS 'Points to the original event in a story chain. Self-referential for standalone events.';
COMMENT ON COLUMN timeline_events.chain_depth IS '0 = original story, 1 = first retelling, etc.';
