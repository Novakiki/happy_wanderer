-- =============================================================================
-- Merge legacy "memories" table into timeline_events (one-score cleanup)
-- Review before running in Supabase SQL Editor.
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.memories') IS NULL THEN
    RAISE NOTICE 'Legacy table "memories" not found. Skipping merge.';
  ELSE
    -- 1) Create contributors from legacy memories (best-effort, avoids duplicates).
    WITH email_contributors AS (
      SELECT DISTINCT ON (LOWER(submitter_email))
        COALESCE(NULLIF(submitter_name, ''), 'Someone who loved her') AS name,
        COALESCE(NULLIF(submitter_relationship, ''), 'family/friend') AS relation,
        NULLIF(submitter_email, '') AS email
      FROM memories
      WHERE submitter_email IS NOT NULL AND BTRIM(submitter_email) <> ''
      ORDER BY LOWER(submitter_email), created_at DESC NULLS LAST
    ),
    name_contributors AS (
      SELECT DISTINCT ON (
        LOWER(submitter_name),
        LOWER(COALESCE(NULLIF(submitter_relationship, ''), 'family/friend'))
      )
        COALESCE(NULLIF(submitter_name, ''), 'Someone who loved her') AS name,
        COALESCE(NULLIF(submitter_relationship, ''), 'family/friend') AS relation,
        NULL AS email
      FROM memories
      WHERE (submitter_email IS NULL OR BTRIM(submitter_email) = '')
        AND submitter_name IS NOT NULL
        AND BTRIM(submitter_name) <> ''
      ORDER BY LOWER(submitter_name), LOWER(COALESCE(NULLIF(submitter_relationship, ''), 'family/friend')), created_at DESC NULLS LAST
    )
    INSERT INTO contributors (name, relation, email)
    SELECT name, relation, email
    FROM email_contributors
    WHERE NOT EXISTS (
      SELECT 1 FROM contributors c WHERE c.email ILIKE email
    )
    UNION ALL
    SELECT name, relation, email
    FROM name_contributors
    WHERE NOT EXISTS (
      SELECT 1 FROM contributors c WHERE c.name ILIKE name AND c.relation ILIKE relation
    );

    -- 2) Insert legacy memories into timeline_events with derived year + timing note.
    INSERT INTO timeline_events (
      year,
      type,
      title,
      preview,
      full_entry,
      contributor_id,
      status,
      privacy_level,
      created_at,
      timing_certainty,
      timing_input_type,
      timing_note
    )
    SELECT
      EXTRACT(YEAR FROM m.created_at)::int AS year,
      'memory' AS type,
      LEFT(m.content, 80) AS title,
      CASE
        WHEN LENGTH(m.content) > 160 THEN LEFT(m.content, 160) || '...'
        ELSE m.content
      END AS preview,
      m.content AS full_entry,
      (
        SELECT c.id
        FROM contributors c
        WHERE (m.submitter_email IS NOT NULL AND c.email ILIKE m.submitter_email)
           OR (m.submitter_email IS NULL AND m.submitter_name IS NOT NULL AND c.name ILIKE m.submitter_name)
        ORDER BY c.created_at ASC
        LIMIT 1
      ) AS contributor_id,
      CASE
        WHEN m.is_visible THEN 'published'
        ELSE 'private'
      END AS status,
      'family' AS privacy_level,
      m.created_at AS created_at,
      'vague' AS timing_certainty,
      'year' AS timing_input_type,
      'Imported from legacy memories table; year derived from submission date.' AS timing_note
    FROM memories m
    WHERE m.content IS NOT NULL
      AND BTRIM(m.content) <> ''
      AND m.created_at IS NOT NULL;
  END IF;
END $$;

-- 3) After verifying imported events, drop or archive the legacy table.
-- DROP TABLE memories;
