-- =============================================================================
-- Migration 029: Contributor deactivation (soft disable)
-- Adds a soft-delete style flag so admins can pause access without breaking
-- attribution/history.
-- =============================================================================

ALTER TABLE contributors
ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contributors_disabled_at
ON contributors(disabled_at)
WHERE disabled_at IS NOT NULL;
