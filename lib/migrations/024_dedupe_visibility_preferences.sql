-- Deduplicate global visibility preferences and enforce one default per person
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY person_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC
    ) AS rn
  FROM visibility_preferences
  WHERE contributor_id IS NULL
)
DELETE FROM visibility_preferences vp
USING ranked
WHERE vp.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_visibility_preferences_person_default
  ON visibility_preferences(person_id)
  WHERE contributor_id IS NULL;
