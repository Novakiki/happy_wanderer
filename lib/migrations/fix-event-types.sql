-- Fix event types: User-submitted memories should be 'memory', not 'milestone'
-- 'milestone' should only be used for major life events (marriage, births, etc.)
-- 'origin' is for synchronicity/contextual events

-- First, see what we have:
SELECT id, title, year, type, contributor_id FROM timeline_events ORDER BY year;

-- Option 1: Update ALL milestones to memories (if you want to reset everything)
-- UPDATE timeline_events SET type = 'memory' WHERE type = 'milestone';

-- Option 2: Update specific events by ID (recommended - run the SELECT first, then update specific IDs)
-- UPDATE timeline_events SET type = 'memory' WHERE id IN ('uuid1', 'uuid2', 'uuid3');

-- Option 3: Update events that have a contributor
-- UPDATE timeline_events SET type = 'memory' WHERE type = 'milestone' AND contributor_id IS NOT NULL;

-- Option 4: Keep only origin events as-is, change everything else to memory
-- UPDATE timeline_events SET type = 'memory' WHERE type != 'origin';

-- Verify the changes:
-- SELECT id, title, year, type FROM timeline_events ORDER BY year;
