-- =============================================================================
-- Backfill 010: people_involved -> people + event_references
-- Converts legacy timeline_events.people_involved into person references.
-- Run this after 009_people_split.sql and 009_people_backfill.sql.
-- =============================================================================

WITH raw_people AS (
  SELECT
    te.id AS event_id,
    te.contributor_id,
    TRIM(name) AS name
  FROM timeline_events te
  JOIN LATERAL UNNEST(te.people_involved) AS name ON TRUE
  WHERE te.people_involved IS NOT NULL
),
dedup AS (
  SELECT DISTINCT
    event_id,
    contributor_id,
    name,
    LOWER(name) AS name_key
  FROM raw_people
  WHERE name <> ''
),
existing_people AS (
  SELECT
    d.event_id,
    d.contributor_id,
    d.name,
    d.name_key,
    COALESCE(pa.person_id, p.id) AS person_id
  FROM dedup d
  LEFT JOIN person_aliases pa
    ON LOWER(pa.alias) = d.name_key
  LEFT JOIN people p
    ON LOWER(p.canonical_name) = d.name_key
),
inserted_people AS (
  INSERT INTO people (canonical_name, visibility, created_by, created_at)
  SELECT
    MIN(ep.name) AS canonical_name,
    'pending',
    MIN(ep.contributor_id::text)::uuid AS created_by,
    NOW()
  FROM existing_people ep
  WHERE ep.person_id IS NULL
  GROUP BY ep.name_key
  RETURNING id, canonical_name
),
inserted_aliases AS (
  INSERT INTO person_aliases (person_id, alias, created_by, created_at)
  SELECT
    ip.id,
    ip.canonical_name,
    NULL,
    NOW()
  FROM inserted_people ip
  RETURNING person_id
),
resolved AS (
  SELECT
    ep.event_id,
    ep.contributor_id,
    ep.name,
    COALESCE(ep.person_id, ip.id) AS person_id
  FROM existing_people ep
  LEFT JOIN inserted_people ip
    ON LOWER(ip.canonical_name) = ep.name_key
)
INSERT INTO event_references (
  event_id,
  type,
  person_id,
  role,
  relationship_to_subject,
  visibility,
  added_by
)
SELECT
  r.event_id,
  'person',
  r.person_id,
  'witness',
  NULL,
  'pending',
  r.contributor_id
FROM resolved r
WHERE r.person_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM event_references er
    WHERE er.event_id = r.event_id
      AND er.type = 'person'
      AND er.person_id = r.person_id
  );
