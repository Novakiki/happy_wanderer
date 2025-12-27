-- =============================================================================
-- Migration 008: Reference Relationships & Visibility
-- Adds relationship context and privacy controls for person references
-- =============================================================================

-- Add relationship_to_subject for person references (their relationship to Val)
ALTER TABLE event_references
  ADD COLUMN IF NOT EXISTS relationship_to_subject TEXT;

-- Add visibility control for privacy management
-- pending: default, shown as anonymized until person decides
-- approved: full name visible
-- anonymized: show relationship only ("a cousin")
-- blurred: show initials only ("S.M.")
-- removed: reference not displayed
ALTER TABLE event_references
  ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'pending'
  CHECK (visibility IN ('pending', 'approved', 'anonymized', 'blurred', 'removed'));

-- Add index for visibility queries (e.g., finding pending references for a user)
CREATE INDEX IF NOT EXISTS idx_references_visibility ON event_references(visibility);

-- =============================================================================
-- RLS Policy Update: Filter out removed references
-- =============================================================================

-- Drop the old permissive policy
DROP POLICY IF EXISTS "Public can read references" ON event_references;

-- New policy: public can read references that aren't removed
-- Note: Masking (pending/anonymized/blurred) is handled at the application layer
-- because RLS can only filter, not transform data
CREATE POLICY "Public can read visible references" ON event_references
  FOR SELECT USING (visibility IS NULL OR visibility != 'removed');

-- =============================================================================
-- Common relationship labels (for reference, not enforced in DB)
-- =============================================================================
-- Family: parent, child, sibling, cousin, aunt, uncle, grandparent, grandchild,
--         niece, nephew, in-law, step-family
-- Social: friend, neighbor, coworker, classmate, teacher, mentor
-- Other: acquaintance, unknown
-- =============================================================================
