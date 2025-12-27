-- =============================================================================
-- Backfill 009: People Split
-- Creates people + aliases for existing person references
-- =============================================================================

-- Ensure legacy references track who added them (based on event contributor)
UPDATE event_references er
SET added_by = te.contributor_id
FROM timeline_events te
WHERE er.event_id = te.id
  AND er.added_by IS NULL;

DO $$
DECLARE
  rec RECORD;
  new_person_id UUID;
  visibility_text TEXT;
BEGIN
  FOR rec IN
    SELECT
      c.id AS contributor_id,
      c.name AS name,
      MAX(
        CASE COALESCE(er.visibility, 'pending')
          WHEN 'approved' THEN 4
          WHEN 'blurred' THEN 3
          WHEN 'anonymized' THEN 2
          WHEN 'pending' THEN 2
          WHEN 'removed' THEN 1
          ELSE 2
        END
      ) AS visibility_rank
    FROM contributors c
    JOIN event_references er
      ON er.contributor_id = c.id
     AND er.type = 'person'
    GROUP BY c.id, c.name
  LOOP
    visibility_text := CASE rec.visibility_rank
      WHEN 4 THEN 'approved'
      WHEN 3 THEN 'blurred'
      WHEN 2 THEN 'pending'
      WHEN 1 THEN 'removed'
      ELSE 'pending'
    END;

    INSERT INTO people (canonical_name, visibility, created_at)
    VALUES (rec.name, visibility_text, NOW())
    RETURNING id INTO new_person_id;

    INSERT INTO person_aliases (person_id, alias, created_at)
    VALUES (new_person_id, rec.name, NOW());

    UPDATE event_references
      SET person_id = new_person_id
      WHERE contributor_id = rec.contributor_id
        AND type = 'person';

    -- Link claimed contributors (profiles) to their person record
    IF EXISTS (SELECT 1 FROM profiles p WHERE p.contributor_id = rec.contributor_id) THEN
      INSERT INTO person_claims (person_id, contributor_id, status, created_at, approved_at)
      VALUES (new_person_id, rec.contributor_id, 'approved', NOW(), NOW())
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
