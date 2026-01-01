-- Trim view_specs to metadata only (rules live in code)
ALTER TABLE view_specs
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE view_specs
  ADD COLUMN IF NOT EXISTS projection_version TEXT NOT NULL DEFAULT 'v1';

ALTER TABLE view_specs
  DROP COLUMN IF EXISTS rules;

ALTER TABLE view_specs
  DROP COLUMN IF EXISTS is_default;
