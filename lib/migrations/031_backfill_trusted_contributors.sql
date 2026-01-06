-- Backfill contributors.trusted for legacy rows.
-- Migration 028 introduced the column with DEFAULT FALSE, but existing rows may remain NULL.
-- We treat contributors with already-published notes as trusted to preserve pre-trust behavior.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contributors'
      AND column_name = 'trusted'
  ) THEN
    -- Ensure a consistent default for new rows.
    ALTER TABLE public.contributors
      ALTER COLUMN trusted SET DEFAULT FALSE;

    -- Normalize NULLs (legacy rows) so code doesn't have to special-case.
    UPDATE public.contributors
      SET trusted = FALSE
      WHERE trusted IS NULL;

    -- Preserve legacy behavior: if a contributor already has published notes, consider them trusted.
    UPDATE public.contributors c
      SET trusted = TRUE
      WHERE c.trusted = FALSE
        AND EXISTS (
          SELECT 1
          FROM public.timeline_events e
          WHERE e.contributor_id = c.id
            AND e.status = 'published'
        );
  END IF;
END $$;
