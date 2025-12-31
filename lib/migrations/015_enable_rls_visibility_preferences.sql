-- Migration: enable RLS for visibility_preferences
-- Purpose: Ensure public table is protected by RLS (Supabase security advisory)

ALTER TABLE visibility_preferences ENABLE ROW LEVEL SECURITY;

-- Access is intentionally server-only (service role bypasses RLS).
-- Add explicit policies later if client-side access is required.
