-- =============================================================================
-- Migration 007: Auth Profiles & Invite Codes
-- Adds Supabase Auth integration with user profiles and invite code system
-- =============================================================================

-- Profiles table linked to Supabase auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relation TEXT NOT NULL,
  email TEXT NOT NULL,
  contributor_id UUID REFERENCES contributors(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_contributor ON profiles(contributor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (for initial creation)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Service role has full access
GRANT ALL ON TABLE profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE profiles TO authenticated;

-- =============================================================================
-- Invite Codes Table
-- =============================================================================

-- Family invite codes (replacing SITE_PASSWORD)
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  uses_remaining INTEGER, -- NULL = unlimited
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Index for code lookup
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);

-- Enable RLS
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can check if a code is valid (for signup flow)
CREATE POLICY "Anyone can validate invite codes" ON invite_codes
  FOR SELECT USING (true);

-- Only service role can manage codes
GRANT ALL ON TABLE invite_codes TO service_role;
GRANT SELECT ON TABLE invite_codes TO anon;
GRANT SELECT ON TABLE invite_codes TO authenticated;

-- =============================================================================
-- Function to handle profile creation on auth.users insert
-- =============================================================================

-- This trigger function can be used to auto-create profiles
-- but we'll handle it in the application for more control
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Profile will be created by the application after collecting name/relation
  -- This is just a placeholder if we want auto-creation in the future
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Seed initial invite code (run manually or via seed script)
-- The code should match your existing SITE_PASSWORD for continuity
-- =============================================================================

-- INSERT INTO invite_codes (code, description, uses_remaining)
-- VALUES ('your-family-password', 'Family access code', NULL);
